/**
 * Per-platform account snapshot: who is signed in, their playlists and liked
 * songs, kept on disk so the settings page and the login window can show the
 * last known account before the platform answers again.
 *
 * This file never holds credentials. Cookies and tokens stay in
 * `sessions.json` (`login/store.js`); this snapshot is safe to show and safe to
 * lose.
 *
 * @module dsh-music-panel/stores/accounts
 */

import { join } from 'node:path'
import { readJsonWithBackup, writeJsonAtomic } from './json-store.js'

export const ACCOUNTS_VERSION = 1

function emptyFile() {
  return { version: ACCOUNTS_VERSION, accounts: {} }
}

function normalise(parsed) {
  if (parsed === null || typeof parsed !== 'object') return emptyFile()
  if (parsed.version !== ACCOUNTS_VERSION) return emptyFile()
  const accounts = parsed.accounts !== null && typeof parsed.accounts === 'object' ? parsed.accounts : {}
  return { version: ACCOUNTS_VERSION, accounts }
}

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value))
}

/**
 * @param {{ dir: string }} options
 */
export function createAccountStore(options) {
  const file = join(options.dir, 'accounts.json')
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

    /** @returns {Promise<object|null>} */
    async get(provider) {
      const data = await load()
      const entry = data.accounts[provider]
      return entry === undefined ? null : clone(entry)
    },

    /** Public view of every stored snapshot. */
    async summary() {
      const data = await load()
      return Object.fromEntries(
        Object.entries(data.accounts).map(([provider, entry]) => [provider, clone(entry)]),
      )
    },

    /**
     * Merge one read result into the snapshot. A field omitted from `patch`
     * keeps what was stored; an explicit `null` clears it.
     */
    async save(provider, patch) {
      return enqueue(async () => {
        const data = await load()
        const previous = data.accounts[provider] ?? {}
        data.accounts[provider] = {
          ...previous,
          ...patch,
          savedAt: Number(patch?.savedAt) || Date.now(),
        }
        cache = data
        await persist()
      })
    },

    /** Keep the last known account, but mark that the latest read failed. */
    async markError(provider, error) {
      return enqueue(async () => {
        const data = await load()
        const previous = data.accounts[provider]
        if (previous === undefined) return
        data.accounts[provider] = {
          ...previous,
          freshness: 'error',
          error: String(error ?? ''),
          savedAt: previous.savedAt,
        }
        cache = data
        await persist()
      })
    },

    async clear(provider) {
      return enqueue(async () => {
        const data = await load()
        if (data.accounts[provider] === undefined) return
        delete data.accounts[provider]
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
