/**
 * Write calibrated lyrics back into the audio file.
 *
 * Only formats with a reliable pure-JavaScript writer are supported:
 *   - MP3  → ID3v2 USLT via `node-id3`
 *   - FLAC → Vorbis comment `LYRICS` via `flac-tagger`
 *
 * M4A/Ogg/WAV are intentionally refused: silently rewriting their containers
 * is how players corrupt files. The caller can still keep the offset in
 * `stats.json` and apply it at playback time.
 *
 * @module dsh-music-panel/lyrics-write
 */

import { writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import NodeID3 from 'node-id3'
import { readFlacTags, writeFlacTags } from 'flac-tagger'

const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

function pad2(value) {
  return value < 10 ? `0${value}` : String(value)
}

function formatStamp(totalMs) {
  const safe = Math.max(0, Math.round(totalMs))
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1000)
  const centis = Math.floor((safe % 1000) / 10)
  return `[${pad2(minutes)}:${pad2(seconds)}.${pad2(centis)}]`
}

/**
 * Move every LRC timestamp by `offsetMs` (positive = later / delayed).
 * Timestamps that would go negative are clamped to 0.
 *
 * @param {string} raw
 * @param {number} offsetMs
 * @returns {string}
 */
export function shiftLrc(raw, offsetMs) {
  const offset = Number.isFinite(Number(offsetMs)) ? Number(offsetMs) : 0
  return String(raw).split(/\r?\n/).map((line) =>
    line.replace(TIME_TAG, (match, minutes, seconds, fraction) => {
      const base = Number(minutes) * 60_000 + Number(seconds) * 1000 +
        (fraction === undefined ? 0 : Math.round(Number(`0.${fraction}`) * 1000))
      return formatStamp(base + offset)
    }),
  ).join('\n')
}

/**
 * Turn parsed lines back into LRC (used when the source was a binary SYLT
 * frame, which has no original text to shift).
 *
 * @param {Array<{ time: number, text: string, translation?: string }>} lines
 * @returns {string}
 */
export function serializeLrc(lines) {
  const out = []
  for (const line of lines) {
    if (!line || typeof line.text !== 'string') continue
    if (line.time < 0) {
      out.push(line.text)
      if (line.translation) out.push(line.translation)
      continue
    }
    const stamp = formatStamp(line.time * 1000)
    out.push(stamp + line.text)
    if (line.translation) out.push(stamp + line.translation)
  }
  return out.join('\n')
}

/**
 * Back up the previous lyrics text next to the audio file (best effort).
 *
 * @param {string} file
 * @param {string} text
 */
export async function backupLyrics(file, text) {
  try {
    await writeFile(`${file}.lyrics.bak`, text, 'utf8')
    return `${file}.lyrics.bak`
  } catch {
    return null
  }
}

/**
 * @param {string} file absolute audio path already validated against roots
 * @param {string} lrcText
 * @returns {Promise<'id3' | 'flac'>}
 */
export async function writeEmbeddedLyrics(file, lrcText) {
  const ext = extname(file).toLowerCase()

  if (ext === '.mp3') {
    const result = NodeID3.update({ unsynchronisedLyrics: { language: 'chi', text: lrcText } }, file)
    if (result !== true) throw new Error(`ID3 写入失败：${result instanceof Error ? result.message : String(result)}`)
    return 'id3'
  }

  if (ext === '.flac') {
    const tags = await readFlacTags(file)
    const tagMap = { ...tags.tagMap, LYRICS: lrcText }
    await writeFlacTags({ tagMap, picture: tags.picture }, file)
    return 'flac'
  }

  throw Object.assign(new Error('当前格式不支持写回内嵌歌词（仅支持 MP3 / FLAC）'), { code: 'UNSUPPORTED_FORMAT' })
}
