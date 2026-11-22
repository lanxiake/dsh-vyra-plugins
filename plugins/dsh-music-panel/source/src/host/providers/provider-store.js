/**
 * Compatibility facade over the new login store.
 *
 * The plugin grew up with one flat `providers.json` row per platform
 * (`{ cookie, token, mid, dfid, guid, userid, nickname, avatarUrl, vip_type, … }`)
 * and ~50 call sites read it through `providerStore.session()/cookie()`. The login
 * rewrite introduced `login/store.js` with a versioned, per-source structure; this
 * file keeps the old API on top of it so the migration is one layer, not fifty call
 * sites.
 *
 * Old `providers.json` files are intentionally **not** read: the migration decision
 * was "existing sign-ins are discarded", so users sign in once more.
 *
 * The store is deliberately generic: a platform that is not in `EMPTY` still
 * round-trips its credentials as long as it is registered here or already has a
 * row on disk. That is what lets Bodian share the same file instead of creating a
 * second `login/store.js` instance over it.
 *
 * @module dsh-music-panel/provider-store
 */

import { createLoginStore } from './login/store.js'

/** Known platforms, with their historical defaults. */
const EMPTY = {
  netease: { cookie: '', nickname: '', avatarUrl: '', loggedIn: false },
  qq: { cookie: '', nickname: '', avatarUrl: '', loggedIn: false },
  kugouLite: {
    cookie: '', mid: '', dfid: '', guid: '', token: '', vip_type: '', vip_token: '', userid: 0,
    nickname: '', avatarUrl: '', loggedIn: false, token_refreshed_at: 0,
  },
  navidrome: {
    server: '', username: '', salt: '', token: '', password: '', nativeSongs: false,
    nickname: '', avatarUrl: '', loggedIn: false,
  },
  // Bodian keeps an opaque session object; only the display fields are read here.
  bodian: { nickname: '', avatarUrl: '', loggedIn: false },
  // Qishui also keeps an opaque session; the display fields come from its user.
  qishui: { nickname: '', avatarUrl: '', loggedIn: false },
}

/** Providers whose session carries a KuGou-style device identity. */
const DEVICE_PROVIDERS = ['kugouLite']

/** Providers that sign in with a QR flow (Navidrome uses credentials instead). */
const QR_PROVIDERS = ['netease', 'qq', 'kugouLite', 'bodian', 'qishui']

const ALL_PROVIDERS = Object.keys(EMPTY)

function emptyRow(provider) {
  return JSON.parse(JSON.stringify(EMPTY[provider] ?? {}))
}

/**
 * @param {{ dir: string }} options
 */
export function createProviderStore(options) {
  const loginStore = createLoginStore({ dir: options.dir })

  /** Stored row for one provider, with defaults filled in. */
  async function row(provider) {
    const entry = await loginStore.get(provider)
    if (entry === null) return emptyRow(provider)
    return { ...emptyRow(provider), ...(entry.credentials ?? {}) }
  }

  async function hasEntry(provider) {
    return (await loginStore.get(provider)) !== null
  }

  return {
    /** The file the credentials now live in (kept for logs and tests). */
    file: loginStore.file,

    /** Full stored entry, for adapters that need opaque credentials (Bodian). */
    async getEntry(provider) {
      return await loginStore.get(provider)
    },

    /** Public summary for the settings UI (no cookies). */
    async summary() {
      const stored = await loginStore.summary()
      const ids = [...new Set([...ALL_PROVIDERS, ...Object.keys(stored)])]
      const result = {}
      for (const provider of ids) {
        const data = await row(provider)
        const entry = {
          loggedIn: data.loggedIn === true,
          nickname: data.nickname || '',
          avatarUrl: data.avatarUrl || '',
        }
        if (provider === 'navidrome') {
          entry.server = data.server || ''
          entry.nativeSongs = data.nativeSongs === true
        }
        result[provider] = entry
      }
      return result
    },

    /** Cookie for one provider ('' when signed out). */
    async cookie(provider) {
      return String((await row(provider)).cookie || '')
    },

    /** KuGou needs its device identity; Navidrome needs its server + token. */
    async session(provider) {
      const data = await row(provider)
      if (provider === 'navidrome') {
        return {
          server: data.server || '',
          username: data.username || '',
          salt: data.salt || '',
          token: data.token || '',
          // Server-side only: the native JWT is minted from this. Empty unless the
          // user opted into the complete-library listing.
          password: data.password || '',
          nativeSongs: data.nativeSongs === true,
        }
      }
      if (!DEVICE_PROVIDERS.includes(provider)) return {}
      return {
        mid: data.mid || '',
        dfid: data.dfid || '',
        guid: data.guid || '',
        token: data.token || '',
        vipType: data.vip_type || '',
        vipToken: data.vip_token || '',
        userid: Number(data.userid) || 0,
        refreshedAt: Number(data.token_refreshed_at) || 0,
      }
    },

    /** Persist a successful login. `user` may carry display fields for opaque sessions. */
    async setLogin(provider, value, user = null) {
      if (typeof provider !== 'string' || provider === '') return
      if (!ALL_PROVIDERS.includes(provider) && !(await hasEntry(provider))) return
      const current = await row(provider)
      const kugou = DEVICE_PROVIDERS.includes(provider)
      const next = {
        ...current,
        ...value,
        ...(user?.nickname ? { nickname: String(user.nickname) } : {}),
        ...(user?.avatarUrl ? { avatarUrl: String(user.avatarUrl) } : {}),
        loggedIn: true,
        ...(kugou ? { token_refreshed_at: Date.now() } : {}),
      }
      const profile = next.nickname || next.avatarUrl
        ? { nickname: next.nickname || '', avatarUrl: next.avatarUrl || '' }
        : null
      await loginStore.save(provider, next, profile)
    },

    /** Mark a stored session as rejected by the provider, keeping device/profile fields. */
    async markExpired(provider) {
      if (!ALL_PROVIDERS.includes(provider)) return
      const data = await row(provider)
      const kugou = DEVICE_PROVIDERS.includes(provider)
      await loginStore.save(provider, {
        ...data,
        loggedIn: false,
        token: '',
        vip_type: '',
        vip_token: '',
        ...(kugou ? { token_refreshed_at: 0 } : {}),
      })
    },

    /** Persist device identity (KuGou needs a stable mid). */
    async setSession(provider, value) {
      if (!DEVICE_PROVIDERS.includes(provider)) return
      const data = await row(provider)
      await loginStore.save(provider, {
        ...data,
        mid: String(value?.mid ?? data.mid ?? ''),
        userid: Number(value?.userid ?? data.userid ?? 0) || 0,
      })
    },

    /** Clear one provider (or all when omitted). */
    async clear(provider) {
      if (provider === undefined) {
        await loginStore.clearAll()
        return
      }
      if (typeof provider !== 'string' || provider === '') return
      if (!ALL_PROVIDERS.includes(provider) && !(await hasEntry(provider))) return
      await loginStore.clear(provider)
    },
  }
}

export { ALL_PROVIDERS, DEVICE_PROVIDERS, QR_PROVIDERS }
