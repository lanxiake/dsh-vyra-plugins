/**
 * User playlists for dsh-music-panel.
 *
 * One JSON file under `<DSH_HOME>/music/playlists.json`. Tracks are stored by
 * path; the client resolves them against the scanned library, so a moved or
 * deleted file simply drops out of the playlist view instead of breaking it.
 *
 * @module dsh-music-panel/playlists
 */

import { randomUUID } from 'node:crypto'
import { readJsonWithBackup, writeJsonAtomic } from './json-store.js'
import { join } from 'node:path'

const MAX_PLAYLISTS = 200
const MAX_TRACKS = 5000
const MAX_NAME = 80
const DEFAULT_NAME = '新建播放列表'

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim() : ''
  return name.slice(0, MAX_NAME)
}

function normalizeTrackPaths(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const out = []
  for (const item of value) {
    if (typeof item !== 'string' || item === '' || seen.has(item)) continue
    seen.add(item)
    out.push(item)
    if (out.length >= MAX_TRACKS) break
  }
  return out
}

/**
 * @param {{ dir: string }} options `dir` is `<DSH_HOME>/music`
 */
export function createPlaylists({ dir }) {
  const file = join(dir, 'playlists.json')
  let cache = null

  async function load() {
    if (cache !== null) return cache
    const parsed = await readJsonWithBackup(file)
    const rows = parsed !== null && Array.isArray(parsed.playlists) ? parsed.playlists : []
    cache = rows
      .filter((row) => row !== null && typeof row === 'object')
      .map((row) => ({
        id: typeof row.id === 'string' && row.id !== '' ? row.id : randomUUID(),
        name: cleanName(row.name) || DEFAULT_NAME,
        trackPaths: normalizeTrackPaths(row.trackPaths),
        createdAt: Number.isFinite(row.createdAt) ? row.createdAt : Date.now(),
        updatedAt: Number.isFinite(row.updatedAt) ? row.updatedAt : Date.now(),
      }))
      .slice(0, MAX_PLAYLISTS)
    return cache
  }

  async function save() {
    await writeJsonAtomic(file, { playlists: cache })
  }

  return {
    async list() {
      const rows = await load()
      return rows.map((row) => ({ ...row, trackPaths: row.trackPaths.slice() }))
    },

    async create(name) {
      const rows = await load()
      if (rows.length >= MAX_PLAYLISTS) return null
      const now = Date.now()
      const playlist = {
        id: randomUUID(),
        name: cleanName(name) || DEFAULT_NAME,
        trackPaths: [],
        createdAt: now,
        updatedAt: now,
      }
      rows.unshift(playlist)
      await save()
      return { ...playlist, trackPaths: [] }
    },

    /**
     * @param {string} id
     * @param {{ name?: string, add?: string[], remove?: string[] }} patch
     */
    async update(id, patch) {
      const rows = await load()
      const playlist = rows.find((row) => row.id === id)
      if (playlist === undefined) return null

      if (typeof patch?.name === 'string') {
        const name = cleanName(patch.name)
        if (name !== '') playlist.name = name
      }
      if (Array.isArray(patch?.add)) {
        playlist.trackPaths = normalizeTrackPaths(playlist.trackPaths.concat(patch.add))
      }
      if (Array.isArray(patch?.remove)) {
        const drop = new Set(patch.remove.filter((item) => typeof item === 'string'))
        playlist.trackPaths = playlist.trackPaths.filter((path) => !drop.has(path))
      }
      playlist.updatedAt = Date.now()
      await save()
      return { ...playlist, trackPaths: playlist.trackPaths.slice() }
    },

    async remove(id) {
      const rows = await load()
      const index = rows.findIndex((row) => row.id === id)
      if (index < 0) return false
      rows.splice(index, 1)
      await save()
      return true
    },

    /** Forget the memoized file; the next call re-reads it. */
    invalidate() {
      cache = null
    },
  }
}
