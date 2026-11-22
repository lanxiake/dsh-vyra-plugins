/**
 * Folder scanner for dsh-music-panel.
 *
 * Two caches keep repeated panel opens cheap:
 *   - a per-directory result cache (short TTL, bypassed by `refresh=1`), and
 *   - a per-file metadata cache keyed by mtime+size, so an unchanged file is
 *     never parsed twice.
 *
 * @module dsh-music-panel/library
 */

import { readdir, stat } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { pinyin } from 'pinyin-pro'
import { extensionOf, isAllowedName } from '../../stores/config.js'
import { readTrackMeta } from './meta.js'

/** A single scan refuses to grow past this many tracks. */
const MAX_TRACKS = 5000

/** Directory results are reused for this long unless the client asked for a refresh. */
const CACHE_TTL_MS = 30_000

/** How many metadata readers run at once. */
const CONCURRENCY = 6

/** Directories that are never music and only slow the walk down. */
const SKIP_DIRS = new Set(['node_modules', 'System Volume Information', '$RECYCLE.BIN', '@eaDir'])

function cacheKey(root, depth, extensions) {
  return `${root}\u0000${depth}\u0000${extensions.join(',')}`
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      out[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return out
}

async function walk(dir, depth, extensions, out, warnings) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    warnings.push(`${dir}: ${error?.code ?? 'readdir failed'}`)
    return
  }
  for (const entry of entries) {
    if (out.length >= MAX_TRACKS) return
    const name = entry.name
    if (name.startsWith('.')) continue
    const full = join(dir, name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue
      if (depth > 0) await walk(full, depth - 1, extensions, out, warnings)
      continue
    }
    if (!entry.isFile()) continue
    if (!isAllowedName(name, extensions)) continue
    out.push(full)
  }
}

function fallbackTitle(name) {
  const base = basename(name)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

function uniqueTracks(tracks) {
  const seen = new Set()
  const out = []
  for (const track of tracks) {
    const key = String(track.path).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(track)
  }
  return out
}

/** Lower-case full pinyin + initials, cached by the joined search text. */
const searchCache = new Map()

function searchKeysOf(text) {
  const key = String(text || '')
  if (key === '') return { py: '', pyf: '' }
  const hit = searchCache.get(key)
  if (hit !== undefined) return hit
  let py = ''
  let pyf = ''
  try {
    py = pinyin(key, { toneType: 'none', type: 'array' }).join('').toLowerCase()
    pyf = pinyin(key, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase()
  } catch {
    // Unsupported characters simply stay unmatched.
  }
  const value = { py, pyf }
  if (searchCache.size > 20_000) {
    const oldest = searchCache.keys().next().value
    if (oldest !== undefined) searchCache.delete(oldest)
  }
  searchCache.set(key, value)
  return value
}

/**
 * @param {{ getSettings: () => Promise<{ roots: string[], depth: number, extensions: string[] }> }} options
 */
export function createLibrary({ getSettings, stats }) {
  /** key -> { at, tracks, warnings, truncated } */
  const dirCache = new Map()
  /** file -> { mtime, size, meta } */
  const metaCache = new Map()

  async function trackOf(file, root, extensions, statsMap) {
    let info
    try {
      info = await stat(file)
    } catch {
      return null
    }
    const mtime = info.mtimeMs
    const size = info.size
    const cached = metaCache.get(file)
    let meta
    if (cached !== undefined && cached.mtime === mtime && cached.size === size) {
      meta = cached.meta
    } else {
      meta = await readTrackMeta(file)
      metaCache.set(file, { mtime, size, meta })
      if (metaCache.size > 20_000) {
        // Bound the cache in pathological libraries; oldest first.
        const oldest = metaCache.keys().next().value
        if (oldest !== undefined) metaCache.delete(oldest)
      }
    }

    const ext = extensionOf(file)
    const entry = statsMap !== undefined ? statsMap[file] : undefined
    const title = meta.title !== '' ? meta.title : fallbackTitle(file)
    const keys = searchKeysOf([title, meta.artist, meta.album].filter((part) => part !== '').join(' '))
    return {
      path: file,
      name: basename(file),
      folder: relative(root, resolve(file, '..')),
      ext,
      size,
      mtime,
      title,
      artist: meta.artist,
      album: meta.album,
      year: meta.year,
      durationSec: meta.durationSec,
      sampleRate: meta.sampleRate,
      bitrate: meta.bitrate,
      codec: meta.codec,
      hasCover: meta.hasCover,
      addedAt: entry !== undefined ? entry.addedAt : mtime,
      plays: entry !== undefined ? entry.plays : 0,
      py: keys.py,
      pyf: keys.pyf,
    }
  }

  async function scanRoot(root, depth, extensions) {
    const key = cacheKey(root, depth, extensions)
    const hit = dirCache.get(key)
    if (hit !== undefined) return hit

    const files = []
    const warnings = []
    await walk(root, depth, extensions, files, warnings)

    // Register first-seen tracks once per scan so "added" has a stable value.
    const statsMap = stats !== undefined ? await stats.ensure(files) : undefined

    const tracks = []
    const settled = await mapLimit(files, CONCURRENCY, (file) => trackOf(file, root, extensions, statsMap))
    for (const track of settled) if (track !== null) tracks.push(track)
    tracks.sort((a, b) => a.path.localeCompare(b.path, 'zh'))

    const result = { at: Date.now(), tracks, warnings, truncated: files.length >= MAX_TRACKS }
    dirCache.set(key, result)
    return result
  }

  /** Overlay the freshest play counts / added times onto scanned tracks. */
  async function withStats(tracks) {
    if (stats === undefined) return tracks
    const snapshot = await stats.snapshot()
    for (const track of tracks) {
      const entry = snapshot[track.path]
      if (entry !== undefined) {
        track.plays = entry.plays
        track.addedAt = entry.addedAt
      }
    }
    return tracks
  }

  /**
   * Scan every configured root. `refresh` bypasses the directory cache.
   *
   * @param {{ refresh?: boolean }} [options]
   */
  async function scan(options = {}) {
    const settings = await getSettings()
    const refresh = options.refresh === true
    const startedAt = Date.now()
    const hidden = new Set(settings.hiddenRoots || [])
    const activeRoots = settings.roots.filter((root) => !hidden.has(root))

    if (!refresh) {
      // Reuse the whole answer when every root cache is still warm.
      const warm = activeRoots.map((root) => {
        const hit = dirCache.get(cacheKey(resolve(root), settings.depth, settings.extensions))
        return hit !== undefined && Date.now() - hit.at < CACHE_TTL_MS ? hit : undefined
      })
      if (activeRoots.length > 0 && warm.every((entry) => entry !== undefined)) {
        const tracks = await withStats(uniqueTracks(warm.flatMap((entry) => entry.tracks)))
        const warnings = warm.flatMap((entry) => entry.warnings)
        return {
          tracks,
          roots: settings.roots.map((root) => resolve(root)),
          warnings,
          truncated: warm.some((entry) => entry.truncated),
          empty: settings.roots.length === 0,
          cached: true,
          scannedAt: startedAt,
        }
      }
    }

    const perRoot = []
    const warnings = []
    for (const root of activeRoots) {
      const abs = resolve(root)
      try {
        const info = await stat(abs)
        if (!info.isDirectory()) {
          warnings.push(`${abs}: not a directory`)
          continue
        }
      } catch {
        warnings.push(`${abs}: missing`)
        continue
      }
      if (refresh) {
        dirCache.delete(cacheKey(abs, settings.depth, settings.extensions))
      }
      const result = await scanRoot(abs, settings.depth, settings.extensions)
      perRoot.push(result)
      warnings.push(...result.warnings)
    }

    return {
      tracks: await withStats(uniqueTracks(perRoot.flatMap((result) => result.tracks))),
      roots: settings.roots.map((root) => resolve(root)),
      warnings,
      truncated: perRoot.some((result) => result.truncated),
      empty: settings.roots.length === 0,
      cached: false,
      scannedAt: startedAt,
    }
  }

  return {
    scan,
    /** Forget every cached scan and file fact. */
    clear() {
      dirCache.clear()
      metaCache.clear()
    },
  }
}
