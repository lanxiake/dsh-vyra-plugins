/**
 * The cookie vocabulary `kugoumusicapi` reads, bridged from the plugin's device identity
 * and login session.
 *
 * The package keeps a device and an account in one cookie object: `KUGOU_API_*` for the
 * device (util/request.js builds every request's headers from them), `dfid` for the
 * fingerprint `register_dev` handed out, and `userid`/`token` for the account. Folia's
 * bridge keeps exactly that object (electron/kugou/kugouApiBridge.cjs); here it is built
 * per call from what the Host already stores, so no second session lives in the worker.
 *
 * @module dsh-music-panel/providers/kugou-cookie
 */

import { createHash } from 'node:crypto'

/** A stable value per (guid, field): sessions signed in before these fields existed still get device headers. */
const stableHex = (guid, field, length) => createHash('md5').update(field + ':' + String(guid ?? '')).digest('hex').slice(0, length)

/** `lite` is the concept build Folia runs; anything else is the standard app. */
export function kugouPlatformOf(value) {
  return value === 'lite' ? 'lite' : 'standard'
}

/**
 * The package's cookie object for one request.
 *
 * @param {{ guid?: string, mid?: string, dfid?: string, dev?: string, mac?: string, webgl?: string, userid?: string|number, token?: string }} device
 * @param {'standard'|'lite'} [platform]
 */
export function kugouCookies(device = {}, platform = 'standard') {
  const cookies = { KUGOU_API_PLATFORM: kugouPlatformOf(platform) }
  if (device.guid) cookies.KUGOU_API_GUID = String(device.guid)
  if (device.mid) cookies.KUGOU_API_MID = String(device.mid)
  const guid = device.guid ? String(device.guid) : ''
  cookies.KUGOU_API_DEV = String(device.dev || stableHex(guid, 'dev', 10).toUpperCase())
  cookies.KUGOU_API_MAC = String(device.mac || stableHex(guid, 'mac', 12).match(/.{2}/g).join(':').toUpperCase())
  cookies.KUGOU_API_WEBGL = String(device.webgl || BigInt('0x' + stableHex(guid, 'webgl', 16)).toString(10))
  // An empty dfid would be sent as a real one; '-' is what the package itself uses for none.
  cookies.dfid = device.dfid ? String(device.dfid) : '-'
  if (device.userid) cookies.userid = String(device.userid)
  if (device.token) cookies.token = String(device.token)
  return cookies
}

function parseCookieEntry(entry) {
  const first = String(entry || '').split(';', 1)[0]
  const at = first.indexOf('=')
  if (at <= 0) return null
  return [first.slice(0, at).trim(), first.slice(at + 1).trim()]
}

/**
 * What an answer added to the session: `dfid` from a device registration, and the
 * token/userid pair from a confirmed sign-in (status 4).
 *
 * The pair is taken only as a whole, as Folia's bridge does: a half pair would join the
 * new account's id to the old token (or the reverse).
 *
 * @param {string[]} cookieEntries the `cookie` array the package answered with
 * @param {object|null} body the answer body
 * @param {{ confirmedSignIn?: boolean }} [options]
 */
export function kugouSessionPatch(cookieEntries, body = null, { confirmedSignIn = false } = {}) {
  const patch = {}
  for (const entry of Array.isArray(cookieEntries) ? cookieEntries : []) {
    const parsed = parseCookieEntry(entry)
    if (parsed === null) continue
    const [name, value] = parsed
    if (name.toLowerCase() !== 'dfid') continue
    if (value !== '' && value !== 'undefined' && value !== 'null') patch.dfid = value
  }
  const data = body !== null && typeof body === 'object' && body.data !== undefined ? body.data : body
  if (data !== null && typeof data === 'object' && data.dfid) patch.dfid = String(data.dfid)
  if (confirmedSignIn && data !== null && typeof data === 'object') {
    const token = data.token === undefined || data.token === null || data.token === '' ? '' : String(data.token)
    const userid = data.userid === undefined || data.userid === null || data.userid === '' ? '' : String(data.userid)
    if (token !== '' && userid !== '') {
      patch.token = token
      patch.userid = userid
    }
  }
  return patch
}
