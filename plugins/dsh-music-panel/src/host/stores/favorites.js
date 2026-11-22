/**
 * Favourite tracks ("我喜欢") for dsh-music-panel.
 *
 * A tiny ordered map path → addedAt, stored in
 * `<DSH_HOME>/music/favorites.json`. Keeping it separate from playlists means
 * the heart button never creates or mutates a user playlist, matching how
 * NetEase/Spotify treat "liked songs" as a first-class collection.
 *
 * @module dsh-music-panel/favorites
 */

import { readJsonWithBackup, writeJsonAtomic } from './json-store.js'
import { join } from 'node:path'

const MAX_FAVORITES = 20_000

function finiteOr(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/**
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
export function sanitizeFavorites(raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    ? raw.favorites !== undefined && typeof raw.favorites === 'object' ? raw.favorites : raw
    : {}
  const out = {}
  for (const [path, value] of Object.entries(source ?? {})) {
    if (typeof path !== 'string' || path === '') continue
    const addedAt = finiteOr(value, 0)
    out[path] = addedAt > 0 ? addedAt : Date.now()
    if (Object.keys(out).length >= MAX_FAVORITES) break
  }
  return out
}

/**
 * @param {{ dir: string }} options `dir` is `<DSH_HOME>/music`
 */
export function createFavorites({ dir }) {
  const file = join(dir, 'favorites.json')
  /** `undefined` = not read yet. */
  let cache

  async function load() {
    if (cache !== undefined) return cache
    cache = sanitizeFavorites(await readJsonWithBackup(file))
    return cache
  }

  async function save() {
    await writeJsonAtomic(file, { version: 1, favorites: cache })
  }

  function list() {
    return Object.entries(cache ?? {})
      .map(([path, addedAt]) => ({ path, addedAt }))
      .sort((left, right) => right.addedAt - left.addedAt)
  }

  return {
    file,
    /** Newest first. */
    async list() {
      await load()
      return list()
    },
    async has(path) {
      await load()
      return cache[path] !== undefined
    },
    /** Toggle one track; returns the new state and the full list. */
    async toggle(path) {
      await load()
      let favorite
      if (cache[path] === undefined) {
        cache[path] = Date.now()
        favorite = true
      } else {
        delete cache[path]
        favorite = false
      }
      await save()
      return { favorite, favorites: list() }
    },
    async snapshot() {
      await load()
      return { ...cache }
    },
    invalidate() {
      cache = undefined
    },
  }
}
