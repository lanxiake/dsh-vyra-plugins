/**
 * Last playback state for dsh-music-panel.
 *
 * Mirrors the resume behaviour of mainstream players (NetEase "remember the
 * last playback position on start", Spotify/YouTube Music restoring the queue):
 * the queue, the current index, the position and loop/order are written while
 * playing and read once when the plugin starts again.
 *
 * Stored as `<DSH_HOME>/music/playback.json`. Pure Node.
 *
 * @module dsh-music-panel/playback
 */

import { readJsonWithBackup, writeJsonAtomic } from '../../stores/json-store.js'
import { join } from 'node:path'

const MAX_QUEUE = 500
const LOOPS = new Set(['all', 'one', 'none'])
const ORDERS = new Set(['list', 'random'])

function finiteOr(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function textField(value, max = 2048) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function numberField(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sanitizeQueueEntry(value) {
  // Legacy states stored only paths. New states store enough metadata to
  // rehydrate online tracks after a restart.
  if (typeof value === 'string') return value === '' ? null : value.slice(0, 4096)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const path = textField(value.path, 4096)
  if (path === '') return null
  const entry = {
    path,
    title: textField(value.title, 512),
    artist: textField(value.artist, 512),
    album: textField(value.album, 512),
    durationSec: Math.max(0, numberField(value.durationSec)),
    coverUrl: textField(value.coverUrl, 2048),
    hasCover: value.hasCover === true,
    // Artwork for a self-hosted provider is addressed by id, not URL; without
    // it a restored queue shows blank covers.
    coverArtId: textField(value.coverArtId, 256),
    onlineProvider: textField(value.onlineProvider, 32),
    onlineId: textField(value.onlineId, 256),
    qualityHint: textField(value.qualityHint, 32),
  }
  return entry
}

/**
 * Coerce an arbitrary payload into a state the client can trust, or null.
 *
 * @param {unknown} raw
 * @returns {{queue: (string | object)[], index: number, positionSec: number, durationSec: number, loop: string, order: string, updatedAt: number} | null}
 */
export function sanitizePlayback(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const queue = Array.isArray(raw.queue)
    ? raw.queue.map(sanitizeQueueEntry).filter((entry) => entry !== null && entry !== '').slice(0, MAX_QUEUE)
    : []
  const durationSec = Math.max(0, finiteOr(raw.durationSec, 0))
  const positionSec = clamp(Math.max(0, finiteOr(raw.positionSec, 0)), 0, durationSec > 0 ? durationSec : Number.MAX_SAFE_INTEGER)
  const index = queue.length === 0
    ? -1
    : clamp(Math.floor(finiteOr(raw.index, 0)), 0, queue.length - 1)
  const loop = LOOPS.has(raw.loop) ? raw.loop : 'all'
  const order = ORDERS.has(raw.order) ? raw.order : 'list'
  return {
    queue,
    index,
    positionSec: Math.round(positionSec * 10) / 10,
    durationSec,
    loop,
    order,
    updatedAt: Math.max(0, Math.round(finiteOr(raw.updatedAt, 0))),
  }
}

/**
 * @param {{ dir: string }} options `dir` is `<DSH_HOME>/music`
 */
export function createPlayback({ dir }) {
  const file = join(dir, 'playback.json')
  /** `undefined` = not read yet, `null` = no usable file. */
  let cache

  async function read() {
    if (cache !== undefined) return cache
    const parsed = await readJsonWithBackup(file)
    cache = sanitizePlayback(parsed)
    return cache
  }

  async function write(raw) {
    const next = sanitizePlayback(raw)
    if (next === null) return null
    next.updatedAt = Date.now()
    await writeJsonAtomic(file, next)
    cache = next
    return next
  }

  return {
    file,
    read,
    write,
    invalidate() {
      cache = undefined
    },
  }
}
