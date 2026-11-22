/**
 * KuGou session maintenance.
 *
 * Standard KuGou tokens are short-lived (observed under a day) but can be
 * extended with `/v5/login_by_token` while they are still valid. Refresh them
 * on a schedule and, when a provider rejects the stored token, mark the
 * account as signed out instead of leaving a misleading "logged in" state.
 *
 * KuGou Lite (概念版) is intentionally refresh-less for now: its token renewal
 * needs Lite web-session fields that the QR login does not persist. We only
 * validate it and surface expiry.
 *
 * @module dsh-music-panel/kugou-session
 */

import * as KG from './kugou.js'
import * as KGL from './kugou-lite.js'

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

/** A provider error that means the stored credential is no longer usable. */
export function isKugouAuthError(error) {
  const code = Number(error && error.code)
  if (code === 20017 || code === 20018) return true
  const message = error instanceof Error ? error.message : String(error || '')
  return /20017|20018|登录态与设备不匹配|登录信息过期|登录已失效|重新扫码/.test(message)
}

export function createKugouSessionManager({
  providerStore,
  refresh = KG.refreshSession,
  profile = KG.getMyUserInfo,
  litePlaylists = KGL.getMyPlaylists,
}) {
  const pending = new Map()

  /**
   * Refresh the standard KuGou token when it is old enough.
   * `force` is used by the settings/status path so it can also probe legacy
   * rows that predate `token_refreshed_at`.
   */
  async function refreshIfDue(provider = 'kugou', { force = false } = {}) {
    if (providerStore === undefined || provider !== 'kugou') return null
    if (pending.has(provider)) return pending.get(provider)
    const task = (async () => {
      const session = await providerStore.session(provider)
      if (!session.token) return null
      const refreshedAt = Number(session.refreshedAt) || 0
      if (!force && refreshedAt > 0 && Date.now() - refreshedAt < REFRESH_INTERVAL_MS) {
        return null
      }
      try {
        const next = await refresh(session)
        await providerStore.setLogin(provider, {
          token: next.token,
          userid: Number(next.userid) || session.userid || 0,
          vip_type: next.vipType || session.vipType || '',
          vip_token: next.vipToken || session.vipToken || '',
        })
        return next
      } catch (error) {
        if (isKugouAuthError(error)) {
          // A refresh failure alone must not sign the user out: the request
          // shape can be rejected for reasons other than an expired token.
          // Confirm against a cheap authenticated endpoint before clearing.
          try {
            await profile(session)
          } catch (probeError) {
            if (isKugouAuthError(probeError)) await providerStore.markExpired(provider)
          }
        }
        return null
      }
    })()
    pending.set(provider, task)
    try {
      return await task
    } finally {
      pending.delete(provider)
    }
  }

  /**
   * Validate a session that cannot be refreshed (KuGou Lite). Uses the
   * account playlist call because its profile endpoint can return an empty
   * object for an expired token instead of an auth error.
   */
  async function validate(provider) {
    if (providerStore === undefined || provider !== 'kugouLite') return null
    if (pending.has(provider)) return pending.get(provider)
    const task = (async () => {
      const session = await providerStore.session(provider)
      if (!session.token) return null
      try {
        await litePlaylists(session)
        return session
      } catch (error) {
        if (isKugouAuthError(error)) await providerStore.markExpired(provider)
        return null
      }
    })()
    pending.set(provider, task)
    try {
      return await task
    } finally {
      pending.delete(provider)
    }
  }

  /** Mark a provider expired after a route observed an auth error. */
  async function markExpiredFromError(provider, error) {
    if (providerStore === undefined) return false
    if (provider !== 'kugou' && provider !== 'kugouLite') return false
    if (!isKugouAuthError(error)) return false
    await providerStore.markExpired(provider)
    return true
  }

  return {
    refreshIfDue,
    validate,
    markExpiredFromError,
    intervalMs: REFRESH_INTERVAL_MS,
  }
}
