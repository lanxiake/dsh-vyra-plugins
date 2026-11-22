/**
 * Login state machine, shared by every source.
 *
 * A platform only supplies *how* it signs in (QR start/poll, password submit, token
 * refresh, failure wording). This module owns the state transitions, so the UI can
 * render one spinner, one QR box and one error line regardless of platform.
 *
 * States:
 *   unknown → (start) → pending → success → authenticated
 *                            ↘ expired / failed
 *   authenticated → (expire) → expired      → (start) → pending
 *   any → (error) → error
 *
 * Failures are normalised to `{ code, retryable, retryAfterMs, message }`, the same
 * vocabulary `core/errors.js` uses for data calls.
 *
 * @module dsh-music-panel/login/state
 */

import { toMusicError } from '../../services/core/errors.js'

export const LOGIN_STATUS = {
  UNKNOWN: 'unknown',
  ANONYMOUS: 'anonymous',
  PENDING: 'pending',
  AUTHENTICATED: 'authenticated',
  EXPIRED: 'expired',
  ERROR: 'error',
}

/**
 * Folia-shaped login session view over this state machine's snapshot.
 * The client controller reads { providerId, phase, codeImage, failure, ... }
 * instead of the transport's raw status/key fields.
 */
export function accountSessionOf(snapshot) {
  if (snapshot === null || snapshot === undefined) return null
  const status = String(snapshot.status ?? '')
  if (status === LOGIN_STATUS.UNKNOWN || status === LOGIN_STATUS.ANONYMOUS) return null
  let phase = 'none'
  if (status === LOGIN_STATUS.PENDING) phase = snapshot.detail === 'scanned' ? 'scanned' : 'code'
  else if (status === LOGIN_STATUS.AUTHENTICATED) phase = 'account'
  else if (status === LOGIN_STATUS.EXPIRED || status === LOGIN_STATUS.ERROR) phase = 'failed'
  const failure = snapshot.failure === null || snapshot.failure === undefined
    ? null
    : {
        case: {
          id: String(snapshot.failure.case || snapshot.failure.code || 'login-failed'),
          kind: snapshot.failure.code === 'network' ? 'B' : 'C',
          action: 'retry',
          details: false,
        },
        facts: {
          message: String(snapshot.failure.message ?? snapshot.message ?? ''),
          step: String(snapshot.detail ?? status),
          retryAfterMs: Number(snapshot.failure.retryAfterMs) || undefined,
        },
        at: Number(snapshot.failure.at) || Date.now(),
      }
  return {
    sessionId: Number(snapshot.sessionId) || 0,
    providerId: snapshot.sourceId,
    phase,
    methods: Array.isArray(snapshot.methods) ? snapshot.methods.slice() : [],
    selectedMethodId: String(snapshot.selectedMethodId ?? ''),
    codeImage: phase === 'code' || phase === 'scanned' ? String(snapshot.imageDataUrl ?? '') : '',
    codeKey: phase === 'code' || phase === 'scanned' ? String(snapshot.key ?? '') : '',
    expiresAt: Number(snapshot.expiresAt) || 0,
    failure,
    transient: snapshot.transient === true,
    inBrowser: false,
    canReopenLoginPage: false,
    localService: null,
    selfCheck: null,
    checksAfterLogin: false,
    texts: snapshot.texts ?? null,
  }
}

/** QR check results that mean "keep polling". */
const PENDING_RESULTS = new Set(['waiting', 'scanned'])

function failureOf(error) {
  const failure = toMusicError(error)
  return {
    code: failure.code,
    message: failure.message,
    retryable: failure.retryable,
    retryAfterMs: failure.retryAfterMs,
  }
}

/**
 * @param {{
 *   sourceId: string,
 *   adapter: {
 *     start?: (kind?: string) => Promise<object>,
 *     poll?: (key: string) => Promise<object>,
 *     submit?: (form: object) => Promise<object>,
 *     readUser?: (session: object) => Promise<object | null>,
 *     refresh?: (session: object) => Promise<object | null>,
 *     isExpired?: (session: object) => boolean,
 *     describeFailure?: (error: unknown) => string,
 *   },
 *   now?: () => number,
 * }} options
 */
export function createLoginState(options) {
  const sourceId = options.sourceId
  const adapter = options.adapter ?? {}
  const now = options.now ?? (() => Date.now())

  let snapshot = Object.freeze({
    sourceId,
    sessionId: 0,
    status: LOGIN_STATUS.UNKNOWN,
    key: '',
    imageDataUrl: '',
    url: '',
    expiresAt: 0,
    session: null,
    user: null,
    message: '',
    // Raw platform status for the current attempt ('waiting' | 'scanned' | …).
    detail: '',
    failure: null,
    // Folia's transient check: a network-level miss while the platform-side code
    // may still be valid must not end the wait.
    transient: false,
    transientFailures: 0,
    methods: Array.isArray(adapter.methods) ? adapter.methods.slice() : [],
    selectedMethodId: '',
    texts: adapter.texts ?? null,
  })
  const listeners = new Set()

  function set(next) {
    snapshot = Object.freeze({ ...snapshot, ...next, sourceId })
    for (const listener of [...listeners]) {
      try {
        listener(snapshot)
      } catch {
        // A broken listener must not break the machine.
      }
    }
    return snapshot
  }

  function describe(error) {
    if (typeof adapter.describeFailure === 'function') {
      try {
        return adapter.describeFailure(error)
      } catch {
        // Fall through to the generic message.
      }
    }
    return error instanceof Error ? error.message : String(error)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Begin a sign-in. `kind` is platform-defined (`qr`, `password`, …). */
    async start(kind) {
      if (typeof adapter.start !== 'function') {
        return set({
          status: LOGIN_STATUS.ERROR,
          failure: { code: 'unavailable', message: 'this source has no sign-in flow', retryable: false, retryAfterMs: 0 },
        })
      }
      const sessionId = snapshot.sessionId + 1
      set({
        sessionId,
        status: LOGIN_STATUS.PENDING,
        failure: null,
        message: '',
        transient: false,
        transientFailures: 0,
        selectedMethodId: String(kind ?? ''),
      })
      try {
        const started = await adapter.start(kind)
        return set({
          status: LOGIN_STATUS.PENDING,
          key: String(started?.key ?? ''),
          imageDataUrl: String(started?.imageDataUrl ?? ''),
          url: String(started?.url ?? ''),
          expiresAt: Number(started?.expiresAt) || 0,
        })
      } catch (error) {
        return set({
          status: LOGIN_STATUS.ERROR,
          message: describe(error),
          failure: failureOf(error),
        })
      }
    },

    /** One poll of the current QR key. */
    async poll() {
      if (snapshot.status !== LOGIN_STATUS.PENDING) return snapshot
      if (snapshot.expiresAt > 0 && now() > snapshot.expiresAt) {
        return set({ status: LOGIN_STATUS.EXPIRED, message: '二维码已过期', transient: false })
      }
      if (typeof adapter.poll !== 'function' || snapshot.key === '') return snapshot

      try {
        const result = await adapter.poll(snapshot.key)
        const status = String(result?.status ?? 'failed')
        if (PENDING_RESULTS.has(status)) {
          return set({
            status: LOGIN_STATUS.PENDING,
            message: String(result?.message ?? ''),
            detail: status,
            transient: false,
            transientFailures: 0,
          })
        }
        if (status === 'success') return await this.complete(result)
        if (status === 'expired') {
          return set({ status: LOGIN_STATUS.EXPIRED, message: String(result?.message ?? '二维码已过期'), transient: false })
        }
        // A miss at the network layer, while the platform still holds the code:
        // keep waiting for the first two, then report it as a real failure.
        if (result?.transient === true && snapshot.transientFailures < 2) {
          return set({
            status: LOGIN_STATUS.PENDING,
            message: String(result?.message ?? '网络暂时不可用，正在重试'),
            detail: status,
            transient: true,
            transientFailures: snapshot.transientFailures + 1,
          })
        }
        return set({
          status: LOGIN_STATUS.ERROR,
          message: String(result?.message ?? '登录失败'),
          transient: false,
          failure: {
            code: 'auth-required',
            message: String(result?.message ?? ''),
            retryable: true,
            retryAfterMs: Number(result?.retryAfterMs) || 0,
            // Folia's case id, when the provider named one.
            case: String(result?.case ?? ''),
          },
        })
      } catch (error) {
        return set({ status: LOGIN_STATUS.ERROR, message: describe(error), transient: false, failure: failureOf(error) })
      }
    },

    /** Password / credential submit for sources without a QR flow. */
    async submit(form) {
      if (typeof adapter.submit !== 'function') {
        return set({
          status: LOGIN_STATUS.ERROR,
          failure: { code: 'unavailable', message: 'this source has no password flow', retryable: false, retryAfterMs: 0 },
        })
      }
      set({ status: LOGIN_STATUS.PENDING, failure: null, message: '' })
      try {
        const result = await adapter.submit(form)
        if (result?.status !== 'success') {
          return set({
            status: LOGIN_STATUS.ERROR,
            message: String(result?.message ?? '登录失败'),
            failure: { code: 'auth-required', message: String(result?.message ?? ''), retryable: true, retryAfterMs: 0 },
          })
        }
        return await this.complete(result)
      } catch (error) {
        return set({ status: LOGIN_STATUS.ERROR, message: describe(error), failure: failureOf(error) })
      }
    },

    /** Adopt a successful sign-in: read the profile, mark authenticated. */
    async complete(result) {
      const session = result?.session ?? null
      let user = result?.user ?? null
      if (user === null && session !== null && typeof adapter.readUser === 'function') {
        try {
          user = await adapter.readUser(session)
        } catch {
          // A missing profile is cosmetic; the session is still valid.
          user = null
        }
      }
      return set({
        status: LOGIN_STATUS.AUTHENTICATED,
        session,
        user,
        key: '',
        imageDataUrl: '',
        url: '',
        message: '',
        failure: null,
        transient: false,
        transientFailures: 0,
      })
    },

    /** Restore a stored session on load. */
    async restore(session, user = null) {
      if (session === null || session === undefined) {
        return set({ status: LOGIN_STATUS.ANONYMOUS, session: null, user: null })
      }
      if (typeof adapter.isExpired === 'function' && adapter.isExpired(session)) {
        return set({ status: LOGIN_STATUS.EXPIRED, session, user, message: '登录已过期' })
      }
      return set({ status: LOGIN_STATUS.AUTHENTICATED, session, user, failure: null })
    },

    /** Refresh an expiring session (token renewal). */
    async refresh() {
      if (typeof adapter.refresh !== 'function' || snapshot.session === null) return snapshot
      try {
        const next = await adapter.refresh(snapshot.session)
        if (next === null || next === undefined) {
          return set({ status: LOGIN_STATUS.EXPIRED, message: '登录已过期' })
        }
        return set({ session: next, status: LOGIN_STATUS.AUTHENTICATED, message: '' })
      } catch (error) {
        return set({ status: LOGIN_STATUS.ERROR, message: describe(error), failure: failureOf(error) })
      }
    },

    /** Mark the session as no longer usable without discarding it. */
    expire(message = '登录已过期') {
      return set({ status: LOGIN_STATUS.EXPIRED, message })
    },

    /**
     * Release a pending key (window closed / new attempt) and clear the view.
     *
     * A key may be passed: a late cancel belongs to the attempt it started, and must not
     * throw away a newer one (that race is what showed "this sign-in was replaced").
     */
    async cancel(key) {
      const wanted = typeof key === 'string' && key !== '' ? key : snapshot.key
      if (wanted !== '' && wanted !== snapshot.key) {
        try {
          if (typeof adapter.cancel === 'function') await adapter.cancel(wanted)
        } catch {
          // Best effort: the old key is already gone.
        }
        return snapshot
      }
      try {
        if (typeof adapter.cancel === 'function' && wanted !== '') await adapter.cancel(wanted)
      } catch {
        // Cancelling is best-effort: an expired/unknown key must not surface.
      }
      return this.reset()
    },

    /** Tell the platform this sign-out is intentional, then clear the view. */
    async logout() {
      try {
        if (typeof adapter.logout === 'function') await adapter.logout()
      } catch {
        // The local session is dropped regardless; the platform call is best-effort.
      }
      return this.reset()
    },

    reset() {
      return set({
        status: LOGIN_STATUS.ANONYMOUS,
        key: '',
        imageDataUrl: '',
        url: '',
        expiresAt: 0,
        session: null,
        user: null,
        message: '',
        failure: null,
        transient: false,
        transientFailures: 0,
      })
    },
  }
}
