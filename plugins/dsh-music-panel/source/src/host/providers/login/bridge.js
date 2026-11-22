/**
 * Login bridge: the state machine wired to real platform adapters.
 *
 * The bridge owns one `createLoginState` per source and turns a platform's raw
 * `loginStatus` answer into the credential row the rest of the plugin persists.
 * Persistence is injected (`store`), so the call site can keep using the legacy
 * provider store today and switch to `login/store.js` without touching the routes.
 *
 * @module dsh-music-panel/login/bridge
 */

import { accountSessionOf, createLoginState } from './state.js'

/**
 * Map a provider `loginStatus` answer onto the credential row stored on disk.
 * Mirrors what the route persisted before the bridge existed.
 *
 * @param {object} result
 */
export function credentialsOf(result) {
  const device = result?.device ?? {}
  return {
    cookie: String(result?.cookie ?? ''),
    token: String(result?.token ?? ''),
    mid: String(device.mid ?? ''),
    dfid: String(device.dfid ?? ''),
    guid: String(device.guid ?? ''),
    userid: Number(result?.userid) || 0,
    nickname: String(result?.nickname ?? result?.extra?.nickname ?? ''),
    avatarUrl: String(result?.avatarUrl ?? ''),
    vip_type: String(result?.vipType ?? ''),
    vip_token: String(result?.vipToken ?? ''),
  }
}

/**
 * QR adapter over a source's `loginStart` / `loginStatus`.
 *
 * @param {{
 *   sourceId: string,
 *   omni: { loginStart: Function, loginStatus: Function },
 *   getSession: () => Promise<object>,
 *   mode?: string,
 * }} options
 */
export function createQrAdapter(options) {
  const mode = options.mode ?? 'qq'
  return {
    mode,
    async start() {
      const session = await options.getSession()
      const qr = await options.omni.loginStart(options.sourceId, { session }, mode)
      return {
        key: String(qr?.key ?? ''),
        imageDataUrl: String(qr?.imageDataUrl ?? ''),
        url: String(qr?.url ?? ''),
        expiresAt: Number(qr?.expiresAt) || 0,
      }
    },
    async poll(key) {
      const result = await options.omni.loginStatus(options.sourceId, key, mode)
      const status = String(result?.status ?? 'failed')
      if (status !== 'success') {
        return {
          status,
          message: String(result?.message ?? ''),
          // A provider that named the case (QQ's package does) hands it over here.
          case: String(result?.case ?? ''),
          retryAfterMs: Number(result?.retryAfterMs) || 0,
          // A network-level miss whose platform-side code may still be valid.
          transient: result?.transient === true,
        }
      }
      const credentials = result?.session !== null && typeof result?.session === 'object'
        ? result.session
        : credentialsOf(result)
      const user = {
        id: String(result?.userid ?? result?.user?.id ?? ''),
        nickname: String(result?.nickname ?? result?.user?.nickname ?? ''),
        avatarUrl: String(result?.avatarUrl ?? result?.user?.avatarUrl ?? ''),
      }
      // Some platforms answer the QR check without a profile. Ask once, now
      // that the credentials are known, so the account row is not nameless.
      if (user.nickname === '' && typeof options.omni.profile === 'function') {
        try {
          const profile = await options.omni.profile(options.sourceId, {
            cookie: String(result?.cookie ?? ''),
            session: credentials,
          })
          if (profile !== null && typeof profile === 'object') {
            user.id = String(profile.id ?? profile.accountId ?? user.id)
            user.nickname = String(profile.nickname ?? user.nickname)
            user.avatarUrl = String(profile.avatarUrl ?? user.avatarUrl)
          }
        } catch {
          // A profile is cosmetic; the credentials above still count as signed in.
        }
      }
      return {
        status,
        // Platforms with an opaque session object (Bodian) hand it over whole;
        // the flat cookie/token platforms are shaped by `credentialsOf`.
        session: credentials,
        user,
      }
    },
    async logout() {
      if (typeof options.logout === 'function') await options.logout()
    },
    async cancel(key) {
      if (typeof options.omni.cancelLogin === 'function') await options.omni.cancelLogin(options.sourceId, key)
    },
  }
}

/**
 * @param {{
 *   adapters: Record<string, object>,
 *   store: { save: (sourceId: string, credentials: object, user: object|null) => Promise<void>, clear: (sourceId: string) => Promise<void> },
 * }} options
 */
export function createLoginBridge(options) {
  const adapters = options.adapters ?? {}
  const store = options.store ?? { save: async () => {}, clear: async () => {} }
  const states = new Map()

  /**
   * Resolve one source's adapter at the moment it starts. `adapterFor` exists so
   * a platform registered after the routes were built (Bodian) is still found;
   * the static `adapters` map stays for tests and the fixed built-ins.
   */
  function adapterFor(sourceId, kind) {
    if (typeof options.adapterFor === 'function') return options.adapterFor(sourceId, kind) ?? {}
    const entry = adapters[sourceId]
    return typeof entry === 'function' ? entry(kind) : (entry ?? {})
  }

  /**
   * One state per source. The adapter may be built per attempt so a changed
   * QR method (`qq` vs `wx`) takes effect on the next attempt.
   */
  function stateFor(sourceId, kind) {
    let state = states.get(sourceId)
    if (state !== undefined) return state
    state = createLoginState({ sourceId, adapter: adapterFor(sourceId, kind) })
    states.set(sourceId, state)
    return state
  }

  return {
    stateFor,
    snapshot: (sourceId) => stateFor(sourceId).getSnapshot(),
    sessionOf: (sourceId) => accountSessionOf(stateFor(sourceId).getSnapshot()),

    async start(sourceId, kind) {
      // Rebuild the adapter so a changed mode takes effect on the next attempt.
      states.delete(sourceId)
      return stateFor(sourceId, kind).start(kind)
    },

    /** Poll once and persist the credentials on success. */
    async poll(sourceId) {
      const state = stateFor(sourceId, undefined)
      const snapshot = await state.poll()
      // A new start replaced this state while the poll was in flight: the
      // answer belongs to the old attempt and must not be handed to the client.
      if (states.get(sourceId) !== state) {
        return stateFor(sourceId, undefined).getSnapshot()
      }
      if (snapshot.status === 'authenticated' && snapshot.session !== null) {
        await store.save(sourceId, snapshot.session, snapshot.user)
      }
      return snapshot
    },

    async cancel(sourceId, key) {
      const state = states.get(sourceId)
      if (state === undefined) return
      const wanted = typeof key === 'string' ? key : ''
      const currentKey = String(state.getSnapshot().key ?? '')
      // The window closing/refreshing may send its cancel after a newer attempt has
      // started. Only that attempt's key is released; the current one is left alone.
      if (wanted !== '' && currentKey !== wanted) {
        await state.cancel(wanted)
        return
      }
      states.delete(sourceId)
      await state.cancel(wanted)
    },

    async logout(sourceId) {
      const state = states.get(sourceId)
      states.delete(sourceId)
      if (state !== undefined) await state.logout()
      await store.clear(sourceId)
    },
  }
}
