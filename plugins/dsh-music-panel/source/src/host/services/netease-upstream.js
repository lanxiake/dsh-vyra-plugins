/**
 * Policies applied to the upstream NetEase package before it starts.
 *
 * Folia's desktop side does the same thing by replacing the package's own module
 * exports before the server boots (`electron/netease/neteaseApiStartup.cjs`,
 * `withoutImplicitClientIp`). The plugin hosts the package in a worker thread, so
 * the patch is installed there, from this module.
 *
 * Why: the package stamps every request with `X-Real-IP` / `X-Forwarded-For` taken
 * from the calling socket. For a local service that socket is always 127.0.0.1, and
 * NetEase reads a loopback source as a spoofed one — Folia measured that the QR
 * *confirm* step then fails. The header is only kept where a request explicitly asks
 * for a random domestic IP (`randomCNIP`).
 *
 * @module dsh-music-panel/services/netease-upstream
 */

/**
 * Wrap the package's request function so the client IP is only forwarded when the
 * caller asked for a random domestic IP.
 *
 * @param {(uri: string, data: object, options?: object) => Promise<unknown>} request
 */
export function withoutImplicitClientIp(request) {
  return (uri, data, options = {}) => request(uri, data, options.randomCNIP ? options : { ...options, ip: '' })
}

/**
 * Replace the package's `util/request` export in the require cache.
 *
 * The package's own modules (`server.js`, `main.js`) read the export at load time, so
 * this has to run before either is required: the worker calls it first.
 *
 * @param {NodeRequire} requireFn
 * @param {string} requestPath resolved path of `@neteasecloudmusicapienhanced/api/util/request.js`
 */
export function installClientIpPolicy(requireFn, requestPath) {
  // Populate the cache first: the package reads this module synchronously and there
  // is nothing to replace until it has been loaded once.
  if (requireFn.cache?.[requestPath] === undefined) requireFn(requestPath)
  const entry = requireFn.cache[requestPath]
  if (entry === undefined) throw new Error('the NetEase request module did not load')
  entry.exports = withoutImplicitClientIp(entry.exports)
  return requestPath
}

// ── 扫码请求的网络层重试 ───────────────────────────────────────────────────

/**
 * Node connection failures the package turns into `{ status: 502, body: { msg } }`.
 * Same list as Folia's shared/networkErrorText: the package drops `err.code`, so the
 * message is all there is to go on.
 */
const NETWORK_FAILURE_PATTERN = /ECONNRESET|socket hang up|socket disconnected before secure TLS connection|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNREFUSED|ECONNABORTED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|EPIPE|timeout of \d+ms exceeded/i

export const isNetworkFailureMessage = (text) => NETWORK_FAILURE_PATTERN.test(String(text ?? ''))

/** Did the request fail before any HTTP answer arrived? */
export const isUpstreamNetworkFailure = (error) => Boolean(
  error
  && typeof error === 'object'
  && Number(error.status) === 502
  && isNetworkFailureMessage(error.body?.msg),
)

/** The two QR steps. Both are safe to repeat: a second key, or another look at the same one. */
export const QR_RETRY_URIS = new Set(['/api/login/qrcode/unikey', '/api/login/qrcode/client/login'])

const sleepFor = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))

/**
 * Retry a QR request once when it failed at the network level.
 *
 * Folia measured single-connection resets around the QR steps (#445 #469 #502): the
 * requests on either side of the reset succeed, so one reset should not end a sign-in.
 * `data` and `options` are copied per attempt because the package writes into them.
 */
export function withQrNetworkRetry(request, {
  uris = QR_RETRY_URIS,
  delayMs = 300,
  sleep = sleepFor,
  logger = console,
} = {}) {
  const attempt = (uri, data, options) => request(uri, { ...data }, {
    ...options,
    ...(options?.cookie && typeof options.cookie === 'object' ? { cookie: { ...options.cookie } } : {}),
  })
  return async (uri, data = {}, options = {}) => {
    try {
      return await attempt(uri, data, options)
    } catch (error) {
      if (!uris.has(uri) || !isUpstreamNetworkFailure(error)) throw error
      logger.warn('[netease] QR request failed at the network level, retrying once', { uri, message: error.body?.msg })
      await sleep(delayMs)
      return attempt(uri, data, options)
    }
  }
}

// ── 上游 login_qr_check 的修正 ─────────────────────────────────────────────

/**
 * The QR poll the package ships reads `result` inside its `catch`, where `result` does
 * not exist: a refused request throws ReferenceError, and server.js answers a bodiless
 * 404 — the window cannot tell "unreachable" from "refused". Folia replaces that module
 * (electron/netease/neteaseApiStartup.cjs, `createLoginQrCheck`) so the rejection keeps
 * the status and body the package produced.
 *
 * @param {(query: object) => object} createOption the package's own util/option
 */
export function createLoginQrCheck(createOption) {
  return async (query, request) => {
    const result = await request('/api/login/qrcode/client/login', { key: query.key, type: 3 }, createOption(query))
    return {
      status: 200,
      body: { ...result.body, cookie: result.cookie.join(';') },
      cookie: result.cookie,
    }
  }
}

/**
 * Install both policies into the package's require cache. Must run before `server.js`
 * is required: it reads both modules at load time (see the worker source).
 *
 * @param {NodeRequire} requireFn
 * @param {{ requestPath: string, qrCheckPath: string, optionPath: string }} paths
 */
export function installUpstreamPolicies(requireFn, paths) {
  // The QR retry sits outside the IP policy: a retry is another request, and each one
  // goes through the same header policy.
  installClientIpPolicy(requireFn, paths.requestPath)
  const requestEntry = requireFn.cache[paths.requestPath]
  requestEntry.exports = withQrNetworkRetry(requestEntry.exports)

  if (requireFn.cache?.[paths.qrCheckPath] === undefined) requireFn(paths.qrCheckPath)
  const qrEntry = requireFn.cache?.[paths.qrCheckPath]
  if (qrEntry === undefined) throw new Error('the NetEase QR check module did not load')
  qrEntry.exports = createLoginQrCheck(requireFn(paths.optionPath))
  return { clientIpPolicy: true, loginQrCheck: true }
}
