/**
 * Reads one signed-in account from its platform and writes the display-level
 * snapshot (user, playlists, liked ids) into `stores/accounts.js`.
 *
 * Rules:
 * - one read per platform at a time; a second caller joins it
 * - a failed read never clears what was shown; it only marks the snapshot stale
 * - credentials are read from `providerStore` and never written here
 * - the function never rejects; callers are UI/status paths
 *
 * @module dsh-music-panel/services/account-read
 */

/** A snapshot older than this is refreshed the next time the account list is read. */
export const ACCOUNT_STALE_MS = 5 * 60 * 1000

function messageOf(error) {
  if (error === null || error === undefined) return ''
  if (typeof error === 'string') return error
  if (typeof error.message === 'string') return error.message
  return String(error)
}

function normaliseUser(user) {
  if (user === null || typeof user !== 'object') return null
  return {
    id: String(user.id ?? user.accountId ?? ''),
    nickname: String(user.nickname ?? ''),
    avatarUrl: String(user.avatarUrl ?? ''),
  }
}

/**
 * @param {{
 *   accountStore: ReturnType<import('../stores/accounts.js').createAccountStore>,
 *   providerStore: ReturnType<import('../providers/provider-store.js').createProviderStore>,
 *   omni: object,
 *   now?: () => number,
 * }} options
 */
export function createAccountReads(options) {
  const accountStore = options.accountStore
  const providerStore = options.providerStore
  const omni = options.omni
  const now = options.now ?? (() => Date.now())
  const pending = new Map()
  const lastAttempt = new Map()

  async function contextOf(provider) {
    return {
      cookie: await providerStore.cookie(provider),
      session: await providerStore.session(provider),
    }
  }

  async function isSignedIn(provider) {
    const summary = await providerStore.summary()
    return summary[provider]?.loggedIn === true
  }

  /**
   * Read one account. Never rejects. `reason` is diagnostic only for now, but
   * the call sites already use Folia's names (`start`, `sign-in`, `switch`,
   * `sync`) so the decisions stay in one place.
   */
  function read(provider, reason = 'start') {
    const running = pending.get(provider)
    if (running !== undefined) return running
    const task = (async () => {
      const previous = await accountStore.get(provider)
      if (!(await isSignedIn(provider))) return previous
      const ctx = await contextOf(provider)
      const capabilities = omni.capabilities(provider)
      let user = previous?.user ?? null
      let collections = previous?.collections ?? []
      let likedSongIds = previous?.likedSongIds ?? []
      let failed = false
      let error = ''

      try {
        const profile = await omni.profile(provider, ctx)
        const nextUser = normaliseUser(profile)
        if (nextUser !== null) {
          // A provider may answer with only a nickname or only an avatar; never replace a
          // fuller stored user with the empty fields of a partial read.
          const merged = { ...(user ?? {}) }
          if (nextUser.id !== '') merged.id = nextUser.id
          if (nextUser.nickname !== '') merged.nickname = nextUser.nickname
          if (nextUser.avatarUrl !== '') merged.avatarUrl = nextUser.avatarUrl
          if (merged.id || merged.nickname || merged.avatarUrl) user = merged
        }
      } catch (caught) {
        failed = true
        error = messageOf(caught)
      }

      if (capabilities?.userPlaylists === true) {
        try {
          const list = await omni.myPlaylists(provider, ctx)
          if (Array.isArray(list)) collections = list
        } catch (caught) {
          failed = true
          error = error || messageOf(caught)
        }
      }

      if (capabilities?.likes === true) {
        try {
          const ids = await omni.likedIds(provider, ctx)
          if (Array.isArray(ids)) likedSongIds = ids
        } catch (caught) {
          failed = true
          error = error || messageOf(caught)
        }
      }

      if (failed) {
        await accountStore.markError(provider, error)
        if (previous === null) {
          await accountStore.save(provider, {
            user,
            collections,
            likedSongIds,
            freshness: 'error',
            error,
          })
        }
      } else {
        await accountStore.save(provider, {
          user,
          collections,
          likedSongIds,
          freshness: 'fresh',
          error: null,
          savedAt: now(),
        })
      }
      return await accountStore.get(provider)
    })().finally(() => {
      pending.delete(provider)
    })
    pending.set(provider, task)
    return task
  }

  /** Read only when the snapshot is missing or older than the stale window. */
  async function readIfStale(provider) {
    const entry = await accountStore.get(provider)
    const last = lastAttempt.get(provider) ?? 0
    if (now() - last < 30_000) return entry
    if (entry === null || now() - (Number(entry.savedAt) || 0) > ACCOUNT_STALE_MS) {
      lastAttempt.set(provider, now())
      void read(provider, 'start')
    }
    return entry
  }

  async function signOut(provider) {
    pending.delete(provider)
    lastAttempt.delete(provider)
    await accountStore.clear(provider)
  }

  async function clearAll() {
    pending.clear()
    lastAttempt.clear()
    await accountStore.clearAll()
  }

  return {
    read,
    readIfStale,
    signOut,
    clearAll,
    summary: () => accountStore.summary(),
  }
}
