/**
 * Track metadata via `music-metadata`, plus a small cover-art cache.
 *
 * Scanning needs `duration` and "has a cover" for every file, and the browser
 * needs the cover bytes only for the rows it actually renders. Keeping the two
 * apart means a 268-track library is not held in memory as decoded artwork.
 *
 * @module dsh-music-panel/meta
 */

import { parseFile, selectCover } from 'music-metadata'

/** Upper bound on cached cover blobs; a library page rarely shows more. */
const COVER_CACHE_LIMIT = 64

/** path -> { mtime, mime, data } */
const covers = new Map()

function textOf(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(' / ').trim()
  return ''
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Read tags, duration and format facts for one file. Never throws: a broken or
 * unfamiliar file yields zeros, and the caller falls back to the file name.
 *
 * @param {string} file
 */
export async function readTrackMeta(file) {
  const empty = {
    title: '',
    artist: '',
    album: '',
    year: 0,
    durationSec: 0,
    sampleRate: 0,
    bitrate: 0,
    codec: '',
    hasCover: false,
  }
  try {
    const meta = await parseFile(file, { duration: true })
    const common = meta.common ?? {}
    const format = meta.format ?? {}
    return {
      title: textOf(common.title),
      artist: textOf(common.artist),
      album: textOf(common.album),
      year: finite(common.year),
      durationSec: finite(format.duration),
      sampleRate: finite(format.sampleRate),
      bitrate: finite(format.bitrate),
      codec: textOf(format.codec),
      hasCover: Array.isArray(common.picture) && common.picture.length > 0,
    }
  } catch {
    return empty
  }
}

/**
 * The front cover for one file, cached by mtime so a re-scan after an edit
 * invalidates it. Returns null when the file has no embedded picture.
 *
 * @param {string} file
 * @param {number} mtime
 * @returns {Promise<{ mime: string, data: Buffer } | null>}
 */
export async function readCover(file, mtime) {
  const hit = covers.get(file)
  if (hit !== undefined && hit.mtime === mtime) {
    // Refresh recency so a pinned "now playing" cover survives eviction.
    covers.delete(file)
    covers.set(file, hit)
    return { mime: hit.mime, data: hit.data }
  }

  let picture
  try {
    const meta = await parseFile(file, { duration: false })
    picture = selectCover(meta.common.picture)
  } catch {
    return null
  }
  if (picture === undefined || picture === null || !(picture.data instanceof Uint8Array)) return null
  if (picture.data.length === 0) return null

  const entry = {
    mtime,
    mime: typeof picture.format === 'string' && picture.format !== '' ? picture.format : 'image/jpeg',
    data: Buffer.from(picture.data),
  }
  covers.set(file, entry)
  while (covers.size > COVER_CACHE_LIMIT) {
    const oldest = covers.keys().next().value
    if (oldest === undefined) break
    covers.delete(oldest)
  }
  return { mime: entry.mime, data: entry.data }
}

/** Drop every cached cover; used by tests and by a settings reset. */
export function clearCoverCache() {
  covers.clear()
}
