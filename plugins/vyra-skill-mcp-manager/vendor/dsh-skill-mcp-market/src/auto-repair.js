// 空 tool-call 自动修复（需求 B）
//
// 插件启动后浅扫所有会话日志；只处理「已确认的那一类」损坏（空 tool-call / 非法 JSON 行），
// 且只动 mtime 已经静止的日志——正在写入的会话不会被碰。
// 修复走 session-repair.js 的前缀截断 + 原子写回 + 自动备份，并把每次修复记进
// $DSH_HOME/dsh-market/session-repairs.json（插件自己的修复标记）。
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { inspectSessionLog, repairSessionLog } from "./session-repair.js";

const MARKER = "session-repairs.json";

/** Collect every session log under the sessions root (bounded depth/count). */
async function collectSessionLogs(root, { limit = 400, maxDepth = 3 } = {}) {
  const files = [];
  const walk = async (dir, depth) => {
    if (depth > maxDepth || files.length >= limit) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= limit) return;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.name === "session.v4.jsonl.zstd") files.push(full);
    }
  };
  await walk(root, 0);
  return files;
}

/** Append one repair record so the panel can show what the plugin healed on its own. */
async function recordRepair(markerPath, record) {
  let existing = [];
  try {
    const raw = await readFile(markerPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    existing = [];
  }
  existing.push(record);
  const trimmed = existing.slice(-200);
  await mkdir(dirname(markerPath), { recursive: true });
  await writeFile(markerPath, JSON.stringify(trimmed, null, 2), "utf8");
}

/**
 * Repair corrupt session logs that have stopped changing.
 * @param {{ dshHome: string, quietMs?: number, log?: Function, dryRun?: boolean }} options
 * @returns {Promise<{ scanned: number, corrupt: number, repaired: object[], skipped: object[] }>}
 */
export async function autoRepairSessions({ dshHome, quietMs = 120000, log, dryRun = false } = {}) {
  const warn = typeof log === "function" ? log : () => {};
  const root = join(dshHome, "sessions");
  const markerPath = join(dshHome, "dsh-market", MARKER);
  const files = await collectSessionLogs(root);
  const summary = { scanned: 0, corrupt: 0, repaired: [], skipped: [] };
  const now = Date.now();
  for (const file of files) {
    summary.scanned += 1;
    let info;
    try {
      info = await inspectSessionLog(file);
    } catch (error) {
      summary.skipped.push({ file, reason: `无法解码：${String((error && error.message) || error)}` });
      continue;
    }
    if (!info.corrupt) continue;
    summary.corrupt += 1;
    let mtimeMs = 0;
    try {
      mtimeMs = (await stat(file)).mtimeMs;
    } catch {
      mtimeMs = 0;
    }
    // 只在日志静止后动手：正在写入的会话交给 DSH 自己
    if (now - mtimeMs < quietMs) {
      summary.skipped.push({ file, reason: `仍在写入（${Math.round((now - mtimeMs) / 1000)}s 前有更新），暂不修复`, seq: info.corruption && info.corruption.seq });
      continue;
    }
    if (dryRun) {
      summary.repaired.push({ file, dryRun: true, seq: info.corruption && info.corruption.seq, reason: info.corruption && info.corruption.reason });
      continue;
    }
    try {
      const result = await repairSessionLog(file, {});
      const record = {
        at: new Date().toISOString(),
        file,
        seq: info.corruption && info.corruption.seq,
        reason: info.corruption && info.corruption.reason,
        keepEvents: result.keepEvents,
        dropped: result.dropped,
        backup: result.backup,
        by: "dsh-market/auto",
      };
      summary.repaired.push(record);
      try {
        await recordRepair(markerPath, record);
      } catch (error) {
        warn("warn", `dsh-market: 写修复标记失败 ${String((error && error.message) || error)}`);
      }
      warn("info", `dsh-market: 自动修复会话 ${file}（seq ${record.seq}，丢弃 ${result.dropped} 条）`);
    } catch (error) {
      summary.skipped.push({ file, reason: `修复失败：${String((error && error.message) || error)}`, seq: info.corruption && info.corruption.seq });
    }
  }
  return { ...summary, markerPath };
}
