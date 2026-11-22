/**
 * Per-track statistics for dsh-music-panel: when a file first entered the
 * library, how many times it was played, how many seconds it was actually
 * played, and (optionally) the last position inside the track.
 *
 * Counting follows the Last.fm / MusicBee convention: a play only counts when
 * the track is longer than 30 seconds and has been played for at least half
 * its duration or 4 minutes (whichever comes first). The caller decides when
 * that threshold is reached; this module only records.
 *
 * Stored next to the settings in `<DSH_HOME>/music/stats.json`. Pure Node.
 *
 * @module dsh-music-panel/stats
 */

import { readJsonWithBackup, writeJsonAtomic } from './json-store.js'
import { join } from 'node:path'

/** Bound the file so a long-lived library cannot grow without limit. */
const MAX_ENTRIES = 20_000
/** Daily buckets older than this many days are dropped. */
const KEEP_DAYS = 31

const MIN_PLAY_SECONDS = 30
const FOUR_MINUTES = 240

function pad2(value) {
  return value < 10 ? `0${value}` : String(value)
}

/** Local calendar day, so "last week" matches what the user sees. */
export function dayKey(ts = Date.now()) {
  const date = new Date(ts)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function finiteOr(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function sanitizeBucket(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const plays = Math.max(0, Math.floor(finiteOr(raw.plays, 0)))
  const seconds = Math.max(0, Math.round(finiteOr(raw.seconds, 0) * 10) / 10)
  const lastAt = Math.max(0, Math.round(finiteOr(raw.lastAt, 0)))
  return { plays, seconds, lastAt }
}

function sanitizeEntry(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const addedAt = finiteOr(raw.addedAt, 0)
  const plays = Math.max(0, Math.floor(finiteOr(raw.plays, 0)))
  const playSeconds = Math.max(0, Math.round(finiteOr(raw.playSeconds, 0) * 10) / 10)
  const lastPlayedAt = raw.lastPlayedAt === null || raw.lastPlayedAt === undefined
    ? null
    : Math.max(0, Math.round(finiteOr(raw.lastPlayedAt, 0))) || null
  const lastPositionSec = raw.lastPositionSec === null || raw.lastPositionSec === undefined
    ? null
    : Math.max(0, Math.round(finiteOr(raw.lastPositionSec, 0) * 10) / 10)
  const days = {}
  if (raw.days !== null && typeof raw.days === 'object' && !Array.isArray(raw.days)) {
    for (const [key, value] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
      const bucket = sanitizeBucket(value)
      if (bucket !== null) days[key] = bucket
    }
  }
  return {
    addedAt: addedAt > 0 ? addedAt : Date.now(),
    plays,
    playSeconds,
    lastPlayedAt,
    lastPositionSec,
    lyricOffsetMs: Math.max(-60_000, Math.min(60_000, Math.round(finiteOr(raw.lyricOffsetMs, 0)))),
    days,
  }
}

function pruneDays(entry, now = Date.now()) {
  const cutoff = dayKey(now - (KEEP_DAYS - 1) * 86_400_000)
  for (const key of Object.keys(entry.days)) {
    if (key < cutoff) delete entry.days[key]
  }
}

function emptyEntry(now = Date.now()) {
  return {
    addedAt: now,
    plays: 0,
    playSeconds: 0,
    lastPlayedAt: null,
    lastPositionSec: null,
    lyricOffsetMs: 0,
    days: {},
  }
}

/**
 * Threshold after which one play is counted (Last.fm / MusicBee default).
 * `durationSec <= 0` means "unknown": the caller should wait for 4 minutes.
 *
 * @param {number} durationSec
 * @returns {number}
 */
export function playThreshold(durationSec) {
  const duration = finiteOr(durationSec, 0)
  if (duration <= 0) return FOUR_MINUTES
  if (duration <= MIN_PLAY_SECONDS) return duration + 0.5
  return Math.min(duration / 2, FOUR_MINUTES)
}

/**
 * @param {{ dir: string }} options `dir` is `<DSH_HOME>/music`
 */
export function createStats({ dir }) {
  const file = join(dir, 'stats.json')
  let cache = null

  async function load() {
    if (cache !== null) return cache
    const parsed = await readJsonWithBackup(file)
    const rows = parsed !== null && parsed.tracks !== null && typeof parsed.tracks === 'object' ? parsed.tracks : {}
    const next = {}
    for (const [path, raw] of Object.entries(rows)) {
      const entry = sanitizeEntry(raw)
      if (entry !== null) next[path] = entry
      if (Object.keys(next).length >= MAX_ENTRIES) break
    }
    cache = next
    return cache
  }

  async function save() {
    await writeJsonAtomic(file, { version: 2, tracks: cache })
  }

  function bucketOf(entry, now) {
    const key = dayKey(now)
    if (entry.days[key] === undefined) entry.days[key] = { plays: 0, seconds: 0, lastAt: 0 }
    return entry.days[key]
  }

  return {
    /** Register every path the library scan just saw; returns the map. */
    async ensure(paths) {
      const tracks = await load()
      const now = Date.now()
      let dirty = false
      for (const path of paths) {
        if (tracks[path] === undefined) {
          tracks[path] = emptyEntry(now)
          dirty = true
        }
      }
      if (dirty) await save()
      return tracks
    },

    async get(path) {
      const tracks = await load()
      return tracks[path] ?? null
    },

    /** Count one qualifying play (the caller applies the Last.fm threshold). */
    async recordPlay(path) {
      const tracks = await load()
      const entry = tracks[path] ?? emptyEntry()
      const now = Date.now()
      entry.plays = (Number(entry.plays) || 0) + 1
      entry.lastPlayedAt = now
      const bucket = bucketOf(entry, now)
      bucket.plays += 1
      bucket.lastAt = now
      pruneDays(entry, now)
      tracks[path] = entry
      await save()
      return { ...entry }
    },

    /** Add actually-listened seconds (never seeks or paused time). */
    async addPlayTime(path, seconds) {
      const value = finiteOr(seconds, 0)
      if (value <= 0) return null
      const tracks = await load()
      const entry = tracks[path] ?? emptyEntry()
      const now = Date.now()
      entry.playSeconds = Math.round((entry.playSeconds + value) * 10) / 10
      entry.lastPlayedAt = now
      const bucket = bucketOf(entry, now)
      bucket.seconds = Math.round((bucket.seconds + value) * 10) / 10
      bucket.lastAt = now
      pruneDays(entry, now)
      tracks[path] = entry
      await save()
      return { ...entry }
    },

    /** Per-track resume point, used when "remember per track" is enabled. */
    async setPosition(path, seconds) {
      const value = finiteOr(seconds, -1)
      if (value < 0) return null
      const tracks = await load()
      const entry = tracks[path] ?? emptyEntry()
      entry.lastPositionSec = Math.round(value * 10) / 10
      tracks[path] = entry
      await save()
      return { ...entry }
    },

    /** Lyrics timing offset in milliseconds (positive = lyrics appear later). */
    async setLyricOffset(path, offsetMs) {
      const value = Math.round(finiteOr(offsetMs, 0))
      const clamped = Math.max(-60_000, Math.min(60_000, value))
      const tracks = await load()
      const entry = tracks[path] ?? emptyEntry()
      entry.lyricOffsetMs = clamped
      tracks[path] = entry
      await save()
      return { ...entry }
    },

    /**
     * Aggregate per track over `all`, `week` (last 7 days) or `month`
     * (last 30 days). Only tracks with activity inside the range are kept.
     *
     * @param {'all'|'week'|'month'} [range]
     */
    async summarize(range = 'all') {
      const tracks = await load()
      const days = range === 'week' ? 7 : range === 'month' ? 30 : 0
      const since = days > 0 ? dayKey(Date.now() - (days - 1) * 86_400_000) : null
      const out = {}
      for (const [path, entry] of Object.entries(tracks)) {
        if (since === null) {
          if (entry.plays > 0 || entry.playSeconds > 0) {
            out[path] = {
              plays: entry.plays,
              playSeconds: entry.playSeconds,
              lastPlayedAt: entry.lastPlayedAt,
            }
          }
          continue
        }
        let plays = 0
        let seconds = 0
        let lastAt = 0
        for (const [day, bucket] of Object.entries(entry.days)) {
          if (day < since) continue
          plays += bucket.plays
          seconds += bucket.seconds
          if (bucket.lastAt > lastAt) lastAt = bucket.lastAt
        }
        if (plays > 0 || seconds > 0) {
          out[path] = {
            plays,
            playSeconds: Math.round(seconds * 10) / 10,
            lastPlayedAt: lastAt || entry.lastPlayedAt,
          }
        }
      }
      return out
    },

    /** In-memory view; the file is read once per process. */
    async snapshot() {
      return { ...(await load()) }
    },

    invalidate() {
      cache = null
    },
  }
}
