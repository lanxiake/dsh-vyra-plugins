// Session log guard: detect and repair the "empty tool-call" corruption that
// permanently breaks a v4 session log.
//
// The DSH session artifact is a concatenated Zstandard frame container; each
// frame decompresses to a batch of JSONL events. Node's zstdDecompress only
// decodes the FIRST frame, so this module scans frame boundaries itself (the
// same structural walk the host persistence backend performs) and decodes each
// frame separately.
//
// The corruption this guards against: a provider stream that emits a tool call
// with an empty id and empty name. The host persists it verbatim; on reload the
// v4 relationship validator rejects the whole log, so everything after that
// event becomes unreadable. Repair keeps the valid prefix and drops the rest.
import { zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const ZSTD_MAGIC = 0xFD2FB528;

/**
 * Walk the concatenated frame container without decompressing block payloads.
 * @param {Buffer} buffer - complete artifact bytes.
 * @returns {{ frames: {start: number, end: number}[], tornStart?: number }}
 */
export function scanZstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset;
    if (buffer.length - offset < 4) return { frames, tornStart: start };
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`不是有效的会话日志：位移 ${offset} 处的帧魔数无效`);
    }
    offset += 4;
    if (offset === buffer.length) return { frames, tornStart: start };
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
    if ((descriptor & 0x18) !== 0) throw new Error(`会话日志损坏：帧头保留位被置位（位移 ${offset - 1}）`);
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 0x20) !== 0;
    const checksum = (descriptor & 0x04) !== 0;
    const dictionaryFlag = descriptor & 0x03;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start };
    offset += remainingHeaderBytes;
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start };
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 0x03;
      const blockSize = blockHeader >>> 3;
      if (blockType === 0x03) throw new Error(`会话日志损坏：位移 ${offset - 3} 处为保留块类型`);
      const payloadBytes = blockType === 0x01 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start };
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start };
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return { frames };
}

/**
 * Decode every frame into JSONL events.
 * @param {Buffer} buffer - artifact bytes.
 * @returns {{ events: object[], tornStart?: number, decodeErrors: number }}
 */
export function decodeSessionLog(buffer) {
  const scan = scanZstdFrames(buffer);
  const chunks = [];
  let decodeErrors = 0;
  for (const frame of scan.frames) {
    try {
      chunks.push(zstdDecompressSync(buffer.subarray(frame.start, frame.end)));
    } catch {
      decodeErrors += 1;
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  const events = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // A half-written tail line is the other, recoverable failure mode.
      parsed = undefined;
    }
    events.push({ raw: trimmed, json: parsed });
  }
  const out = { events, decodeErrors };
  if (scan.tornStart !== undefined) out.tornStart = scan.tornStart;
  return out;
}

/** A tool call must carry both a non-empty id and a non-empty name. */
function toolCallDefect(id, name) {
  const badId = typeof id !== "string" || id.trim() === "";
  const badName = typeof name !== "string" || name.trim() === "";
  if (!badId && !badName) return undefined;
  return `tool-call 的 ${badId ? "id" : ""}${badId && badName ? " 与 " : ""}${badName ? "name" : ""} 为空`;
}

/**
 * Find the first event that would make the log unreadable.
 * Only the confirmed corruption class is checked: an unparsable line, a tool
 * call with an empty id/name in either the assistant message or the call
 * record. Nothing else is treated as corruption, so a valid log is never cut.
 * @param {{raw: string, json: object|undefined}[]} events
 * @returns {{ index: number, seq?: number, type?: string, reason: string } | undefined}
 */
export function findCorruption(events) {
  for (let index = 0; index < events.length; index += 1) {
    const entry = events[index];
    if (entry.json === undefined) {
      return { index, reason: "该行不是合法 JSON（半写入或损坏）" };
    }
    const event = entry.json;
    const type = event && event.type;
    const data = event && event.data;
    if (type === "assistant/message" && data && data.message && Array.isArray(data.message.content)) {
      for (const block of data.message.content) {
        if (!block || block.type !== "tool-call") continue;
        const defect = toolCallDefect(block.id, block.name);
        if (defect) return { index, seq: event.seq, type, reason: defect };
      }
    }
    if (type === "tool/call" && data) {
      const defect = toolCallDefect(data.callId, data.name);
      if (defect) return { index, seq: event.seq, type, reason: defect };
    }
  }
  return undefined;
}

/** Re-encode kept events as a single valid frame. */
export function encodeEvents(events) {
  const text = events.map((entry) => entry.raw).join("\n") + "\n";
  return zstdCompressSync(Buffer.from(text, "utf8"));
}

/**
 * Inspect one artifact without touching it.
 * @param {string} filePath - session.v4.jsonl.zstd path.
 */
export async function inspectSessionLog(filePath) {
  const buffer = await readFile(filePath);
  const decoded = decodeSessionLog(buffer);
  const corruption = findCorruption(decoded.events);
  return {
    file: filePath,
    sessionId: basename(dirname(filePath)),
    bytes: buffer.length,
    frames: scanZstdFrames(buffer).frames.length,
    events: decoded.events.length,
    decodeErrors: decoded.decodeErrors,
    torn: decoded.tornStart !== undefined,
    corrupt: corruption !== undefined,
    corruption: corruption || null,
    keepEvents: corruption === undefined ? decoded.events.length : corruption.index,
  };
}

/**
 * Repair one artifact: keep the valid prefix, back up the original, rewrite atomically.
 * @param {string} filePath - session.v4.jsonl.zstd path.
 * @param {{ dryRun?: boolean }} [options]
 */
export async function repairSessionLog(filePath, options = {}) {
  const buffer = await readFile(filePath);
  const decoded = decodeSessionLog(buffer);
  const corruption = findCorruption(decoded.events);
  const keep = corruption === undefined ? decoded.events.length : corruption.index;
  const report = {
    file: filePath,
    sessionId: basename(dirname(filePath)),
    eventsBefore: decoded.events.length,
    keepEvents: keep,
    dropped: decoded.events.length - keep,
    corruption: corruption || null,
    dryRun: options.dryRun === true,
    repaired: false,
  };
  if (corruption === undefined) return report;
  if (options.dryRun === true) return report;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `${filePath}.repair-${stamp}`;
  await copyFile(filePath, backup);
  report.backup = backup;

  const kept = decoded.events.slice(0, keep);
  if (kept.length === 0) throw new Error("损坏点之前没有任何事件，无法修复（请从备份恢复）");
  const encoded = encodeEvents(kept);
  const tmp = join(dirname(filePath), `.repair-tmp-${Date.now()}`);
  await writeFile(tmp, encoded);
  await rename(tmp, filePath);
  report.repaired = true;
  report.bytesAfter = encoded.length;
  return report;
}

