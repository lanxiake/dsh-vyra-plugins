/**
 * Inspect and clear the plugin's own data directory (`<DSH_HOME>/music`).
 *
 * This module only touches the plugin data root. It never removes a configured
 * music root, and it never touches the user's music files unless the user has
 * explicitly added the data directory itself as a music root (in which case that
 * entry is skipped and reported as protected).
 *
 * @module dsh-music-panel/plugin-data
 */

import { readdir, rm, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const CATEGORIES = [
  { id: 'settings', label: 'settings', names: ['settings.json'] },
  // Every store writes a `.bak` copy next to the live file (json-store.js); clearing the
  // category has to remove it too or the next read resurrects the data (readJsonWithBackup).
  { id: 'favorites', label: 'favorites', names: ['favorites.json', 'favorites.json.bak'] },
  { id: 'playlists', label: 'playlists', names: ['playlists.json', 'playlists.json.bak'] },
  { id: 'stats', label: 'stats', names: ['stats.json', 'stats.json.bak'] },
  { id: 'lyrics', label: 'lyrics', names: ['lyric-states.json', 'lyric-states.json.bak', 'lyrics'] },
  { id: 'playback', label: 'playback', names: ['playback.json', 'playback.json.bak'] },
  { id: 'accounts', label: 'accounts', names: ['sessions.json', 'accounts.json', 'providers.json', 'bodian-device.json', 'qishui-device.json', 'qq-auth-sessions.json'] },
  { id: 'cache', label: 'cache', names: ['cache'] },
  { id: 'trash', label: 'trash', names: ['trash'] },
]

function categoryOf(name) {
  for (const category of CATEGORIES) {
    if (category.names.includes(name)) return category.id
  }
  return 'other'
}

async function fileSize(path) {
  try {
    const info = await stat(path)
    return info.isFile() ? info.size : 0
  } catch {
    return 0
  }
}

async function walk(dir, base, rows) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, base, rows)
    } else if (entry.isFile()) {
      const size = await fileSize(full)
      rows.push({ path: relative(base, full), size })
    }
  }
}

/**
 * @param {string} dir
 * @returns {Promise<{dir:string, files:number, bytes:number, categories:Array<{id:string, files:number, bytes:number}>}>}
 */
export async function inspectData(dir) {
  const rows = []
  await walk(dir, dir, rows)
  const buckets = new Map()
  for (const row of rows) {
    const top = row.path.split(sep)[0]
    const id = categoryOf(top)
    const bucket = buckets.get(id) ?? { id, files: 0, bytes: 0 }
    bucket.files += 1
    bucket.bytes += row.size
    buckets.set(id, bucket)
  }
  const order = [...CATEGORIES.map((category) => category.id), 'other']
  const categories = order
    .map((id) => buckets.get(id))
    .filter((bucket) => bucket !== undefined)
    .map((bucket) => ({ id: bucket.id, files: bucket.files, bytes: bucket.bytes }))
  return {
    dir,
    files: rows.length,
    bytes: rows.reduce((total, row) => total + row.size, 0),
    categories,
  }
}

/** Categories a single row may clear; settings and accounts are only cleared wholesale. */
export const CLEARABLE_CATEGORIES = ['favorites', 'playlists', 'stats', 'lyrics', 'playback', 'cache', 'trash', 'other']

/**
 * Remove one category's entries from the plugin data directory. Settings and sign-ins are
 * deliberately not addressable here: logging the listener out is the clear-all path's job.
 *
 * @param {string} dir
 * @param {string} category
 * @param {string[]} [roots]
 */
export async function clearDataCategory(dir, category, roots = []) {
  if (!CLEARABLE_CATEGORIES.includes(category)) return { removed: [], bytes: 0, protected: [] }
  const known = CATEGORIES.find((entry) => entry.id === category)
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return { removed: [], bytes: 0, protected: [] }
  }
  const removed = []
  const protectedEntries = []
  let bytes = 0
  for (const entry of entries) {
    const matches = category === 'other'
      ? categoryOf(entry.name) === 'other'
      : known.names.includes(entry.name)
    if (!matches) continue
    const full = join(dir, entry.name)
    if (isProtected(full, roots)) {
      protectedEntries.push(entry.name)
      continue
    }
    let size = 0
    if (entry.isDirectory()) {
      const rows = []
      await walk(full, dir, rows)
      size = rows.reduce((total, row) => total + row.size, 0)
    } else if (entry.isFile()) {
      size = await fileSize(full)
    }
    try {
      await rm(full, { recursive: true, force: true })
      removed.push(entry.name)
      bytes += size
    } catch {
      /* A locked file must not stop the rest of the category. */
    }
  }
  return { removed, bytes, protected: protectedEntries }
}

function isProtected(entry, roots) {
  return roots.some((root) => {
    if (typeof root !== 'string' || root === '') return false
    return entry === root || entry.startsWith(root + sep) || root.startsWith(entry + sep)
  })
}

/**
 * Remove every plugin data entry under `dir`, except paths that overlap a
 * configured music root. Returns the removed entry names and bytes.
 *
 * @param {string} dir
 * @param {string[]} roots
 */
export async function clearData(dir, roots = []) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return { removed: [], bytes: 0, protected: [] }
  }
  const removed = []
  const protectedEntries = []
  let bytes = 0
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (isProtected(full, roots)) {
      protectedEntries.push(entry.name)
      continue
    }
    let size = 0
    if (entry.isDirectory()) {
      const rows = []
      await walk(full, dir, rows)
      size = rows.reduce((total, row) => total + row.size, 0)
    } else if (entry.isFile()) {
      size = await fileSize(full)
    }
    try {
      await rm(full, { recursive: true, force: true })
      removed.push(entry.name)
      bytes += size
    } catch {
      /* A locked cache file must not stop the rest of the reset. */
    }
  }
  return { removed, bytes, protected: protectedEntries }
}
