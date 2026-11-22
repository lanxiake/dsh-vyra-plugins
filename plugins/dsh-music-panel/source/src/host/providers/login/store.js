/**
 * Credential store for the new login model.
 *
 * Replaces the old `providers.json` shape wholesale (the migration decision was
 * "old sign-ins are discarded"): every entry is versioned, keyed by source id, and
 * keeps credentials separate from the display profile so a profile read can fail
 * without losing the session.
 *
 * Written 0600 with the same atomic temp+rename as the rest of the plugin.
 *
 * @module dsh-music-panel/login/store
 */

import { join } from 'node:path'
import { readJsonWithBackup, writeJsonAtomic } from '../../stores/json-store.js'

export const SESSION_VERSION = 1

/** @typedef {{ credentials: object, profile: object|null, updatedAt: number, expiresAt: number }} SessionEntry */

function emptyFile() {
  return { version: SESSION_VERSION, sessions: {} }
}

function normalise(parsed) {
  if (parsed === null || typeof parsed !== 'object') return emptyFile()
  if (parsed.version !== SESSION_VERSION) return emptyFile()
  const sessions = parsed.sessions !== null && typeof parsed.sessions === 'object' ? parsed.sessions : {}
  return { version: SESSION_VERSION, sessions }
}

/**
 * @param {{ dir: string }} options
 */
export function createLoginStore(options) {
  const file = join(options.dir, 'sessions.json')
  let cache = null
  let loading = null
  let queue = Promise.resolve()

  async function load() {
    if (cache !== null) return cache
    if (loading === null) {
      loading = readJsonWithBackup(file).then((parsed) => {
        cache = normalise(parsed)
        return cache
      })
    }
    return loading
  }

  function enqueue(task) {
    const next = queue.then(task, task)
    queue = next.catch(() => undefined)
    return next
  }

  async function persist() {
    await writeJsonAtomic(file, cache, { mode: 0o600 })
  }

  return {
    file,

    /** @returns {Promise<SessionEntry | null>} */
    async get(sourceId) {
      const data = await load()
      const entry = data.sessions[sourceId]
      return entry === undefined ? null : { ...entry }
    },

    /** Browser-safe view: never includes credentials. */
    async summary() {
      const data = await load()
      return Object.fromEntries(
        Object.entries(data.sessions).map(([sourceId, entry]) => [sourceId, {
          signedIn: true,
          profile: entry.profile ?? null,
          updatedAt: Number(entry.updatedAt) || 0,
          expiresAt: Number(entry.expiresAt) || 0,
        }]),
      )
    },

    async save(sourceId, credentials, profile = null, expiresAt = 0) {
      return enqueue(async () => {
        const data = await load()
        const previous = data.sessions[sourceId]
        data.sessions[sourceId] = {
          credentials: credentials ?? {},
          profile: profile ?? previous?.profile ?? null,
          updatedAt: Date.now(),
          expiresAt: Number(expiresAt) || 0,
        }
        cache = data
        await persist()
      })
    },

    /** Update only the display profile, keeping the credentials untouched. */
    async saveProfile(sourceId, profile) {
      return enqueue(async () => {
        const data = await load()
        const entry = data.sessions[sourceId]
        if (entry === undefined) return
        data.sessions[sourceId] = { ...entry, profile, updatedAt: Date.now() }
        cache = data
        await persist()
      })
    },

    async clear(sourceId) {
      return enqueue(async () => {
        const data = await load()
        if (data.sessions[sourceId] === undefined) return
        delete data.sessions[sourceId]
        cache = data
        await persist()
      })
    },

    async clearAll() {
      return enqueue(async () => {
        cache = emptyFile()
        await persist()
      })
    },
  }
}
