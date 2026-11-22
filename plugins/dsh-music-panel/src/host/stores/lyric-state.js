/**
 * Per-song lyric records for dsh-music-panel.
 *
 * Folia keeps a song's lyrics on the song's own record (local library record or
 * the platform song) — the source the listener chose, the lyric a match found,
 * the instrumental mark. This plugin has no library database, so the record is
 * keyed by the song's identity instead:
 *
 *   - a local file: its absolute path
 *   - an online song: `online:<provider>:<id>`
 *
 * `<DSH_HOME>/music/lyric-states.json` holds the index (small: source choice,
 * match metadata, flags). The lyric text itself lives in
 * `<DSH_HOME>/music/lyrics/<sha1(key)>.json` so the index never has to be
 * rewritten for one song's lyrics, and "clear cache" cannot throw a listener's
 * choice away.
 *
 * @module dsh-music-panel/lyric-state
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readJsonWithBackup, writeJsonAtomic } from './json-store.js'

/** Bound the index so a long-lived library cannot grow without limit. */
const MAX_ENTRIES = 5000

const SOURCES = new Set(['local', 'embedded', 'online', 'imported'])

function textOf(value, limit = 400) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text.length > limit ? text.slice(0, limit) : text
}

function finiteOr(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/** The payload name for one key: a hash, so any path or id is a safe file name. */
export function payloadNameFor(key) {
  return createHash('sha1').update(String(key)).digest('hex') + '.json'
}

function sanitizeMatch(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const source = textOf(raw.source, 40)
  if (source === '') return null
  return {
    source,
    id: textOf(raw.id, 80),
    title: textOf(raw.title),
    artist: textOf(raw.artist),
    album: textOf(raw.album),
    coverUrl: textOf(raw.coverUrl, 1000),
    score: Math.max(0, Math.min(100, Math.round(finiteOr(raw.score, 0)))),
    wordLevel: raw.wordLevel === true,
    isPureMusic: raw.isPureMusic === true,
    at: Math.max(0, Math.round(finiteOr(raw.at, 0))),
  }
}

function sanitizeRecord(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = {
    source: SOURCES.has(raw.source) ? raw.source : null,
    noAutoMatch: raw.noAutoMatch === true,
    markedPureMusic: raw.markedPureMusic === true,
    pureMusic: raw.pureMusic === true,
    matched: sanitizeMatch(raw.matched),
    imported: raw.imported !== null && typeof raw.imported === 'object' && !Array.isArray(raw.imported)
      ? { name: textOf(raw.imported.name), at: Math.max(0, Math.round(finiteOr(raw.imported.at, 0))) }
      : null,
    // The platform's own parsed lyric, cached for the next play (Folia's `lyric_<key>`).
    lyric: raw.lyric !== null && typeof raw.lyric === 'object' && !Array.isArray(raw.lyric)
      ? { v: 1, at: Math.max(0, Math.round(finiteOr(raw.lyric.at, 0))) }
      : null,
    // The automatic pick already ran; `pure` records "every source agrees: instrumental".
    autoMatched: raw.autoMatched !== null && typeof raw.autoMatched === 'object' && !Array.isArray(raw.autoMatched)
      ? { at: Math.max(0, Math.round(finiteOr(raw.autoMatched.at, 0))), pure: raw.autoMatched.pure === true }
      : null,
    updatedAt: Math.max(0, Math.round(finiteOr(raw.updatedAt, 0))),
  }
  // A record of nothing is no record: the caller then falls back to the file's own lyric.
  if (
    record.source === null
    && !record.noAutoMatch
    && !record.markedPureMusic
    && !record.pureMusic
    && record.matched === null
    && record.imported === null
    && record.lyric === null
    && record.autoMatched === null
  ) {
    return null
  }
  return record
}

function sanitizePayload(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const text = typeof raw.text === 'string' ? raw.text : ''
  if (text.trim() === '') return null
  // Folia caches the parsed lyric, word timings included; the payload carries what the
  // lyric route answered so a replay does not lose the word-level timeline.
  let rawBody = null
  if (raw.raw !== null && typeof raw.raw === 'object' && !Array.isArray(raw.raw)) {
    try {
      rawBody = JSON.stringify(raw.raw).length <= 512 * 1024 ? raw.raw : null
    } catch {
      rawBody = null
    }
  }
  const lines = Array.isArray(raw.lines)
    ? raw.lines.filter((line) => line !== null && typeof line === 'object' && !Array.isArray(line))
    : null
  return {
    text,
    formatHint: textOf(raw.formatHint, 20),
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    romaji: typeof raw.romaji === 'string' ? raw.romaji : '',
    lines: lines === null || lines.length === 0 ? null : lines,
    wordLevel: raw.wordLevel === true,
    raw: rawBody,
  }
}

/**
 * @param {{ dir: string }} options `dir` is `<DSH_HOME>/music`
 */
export function createLyricState({ dir }) {
  const file = join(dir, 'lyric-states.json')
  const payloadDir = join(dir, 'lyrics')
  let cache = null

  async function load() {
    if (cache !== null) return cache
    const parsed = await readJsonWithBackup(file)
    const rows = parsed !== null && parsed.tracks !== null && typeof parsed.tracks === 'object' ? parsed.tracks : {}
    const next = {}
    for (const [key, raw] of Object.entries(rows)) {
      const record = sanitizeRecord(raw)
      if (record === null) continue
      next[key] = record
      if (Object.keys(next).length >= MAX_ENTRIES) break
    }
    cache = next
    return cache
  }

  async function save() {
    await writeJsonAtomic(file, { version: 1, tracks: cache })
  }

  function payloadPath(key) {
    return join(payloadDir, payloadNameFor(key))
  }

  return {
    /** Every song key with a record, for the data pane and the lyric export. */
    async listKeys() {
      return Object.keys(await load())
    },

    /** The record for one song, or null when nothing was ever chosen or matched. */
    async get(key) {
      const tracks = await load()
      const record = tracks[String(key)]
      return record === undefined ? null : { ...record }
    },

    /** Merge `patch` into the record; `null` values clear a field. */
    async patch(key, patch) {
      const id = String(key)
      const tracks = await load()
      const previous = tracks[id] ?? {
        source: null,
        noAutoMatch: false,
        markedPureMusic: false,
        pureMusic: false,
        matched: null,
        imported: null,
        updatedAt: 0,
      }
      const merged = { ...previous }
      for (const [field, value] of Object.entries(patch ?? {})) {
        if (field in merged) merged[field] = value
      }
      merged.updatedAt = Date.now()
      const record = sanitizeRecord(merged)
      if (record === null) {
        delete tracks[id]
        await save()
        return null
      }
      tracks[id] = record
      await save()
      return { ...record }
    },

    /** Drop the record and the lyric text stored with it. */
    async remove(key) {
      const id = String(key)
      const tracks = await load()
      if (tracks[id] !== undefined) {
        delete tracks[id]
        await save()
      }
      await unlink(payloadPath(id)).catch(() => {})
    },

    /** Write the lyric text for one song (raw source text + format hint). */
    async writePayload(key, payload) {
      const clean = sanitizePayload(payload)
      if (clean === null) return null
      await mkdir(payloadDir, { recursive: true })
      await writeFile(payloadPath(String(key)), JSON.stringify(clean), 'utf8')
      return clean
    },

    /** The lyric text stored for one song, or null. */
    async readPayload(key) {
      try {
        const raw = JSON.parse(await readFile(payloadPath(String(key)), 'utf8'))
        return sanitizePayload(raw)
      } catch {
        return null
      }
    },

    /** Forget one song's lyric text, keeping its record. */
    async clearPayload(key) {
      await unlink(payloadPath(String(key))).catch(() => {})
    },

    /** Forget memoized records; the files are removed by the data reset. */
    invalidate() {
      cache = null
    },

    /** Forget everything in memory (files are the caller's to remove). */
    clear() {
      cache = {}
    },
  }
}
