/**
 * Login failures, named the way Folia names them.
 *
 * Folia keeps one vocabulary for "why the sign-in did not finish"
 * (services/onlineMusic/login/loginFailureCase.ts): a case id, and the shared facts a
 * case is decided from (step, HTTP status, retry-after, whether it was a network
 * failure). Providers only say what is specific to them; everything else falls out of
 * the rules here. The plugin's Host has no i18n, so a case also carries the sentence
 * its login window shows today.
 *
 * @module dsh-music-panel/core/login-failure
 */

/** The cases this plugin can produce, with Folia's kind/action/details. */
export const LOGIN_CASES = {
  'code-expired': { kind: 'A', action: 'refresh-code', details: false },
  'expired-after-scan': { kind: 'A', action: 'refresh-code', details: true },
  'not-authorized': { kind: 'A', action: 'sign-in-again', details: true },
  'browser-unfinished': { kind: 'A', action: 'sign-in-again', details: false },
  unreachable: { kind: 'B', action: 'retry', details: true },
  'no-answer': { kind: 'B', action: 'retry', details: true },
  refused: { kind: 'C', action: 'retry', details: true },
  'retry-later': { kind: 'C', action: 'wait-then-retry', details: true },
  'device-limit': { kind: 'C', action: 'retry', details: true },
  'wrong-scan-app': { kind: 'C', action: 'retry', details: true },
  'account-restricted': { kind: 'C', action: 'retry', details: true },
  'local-service-stopped': { kind: 'D', action: 'restart-service', details: true },
  'local-service-unavailable': { kind: 'D', action: 'retry', details: true },
  'cannot-listen': { kind: 'D', action: 'retry', details: true },
  'no-browser': { kind: 'E', action: 'retry', details: true },
  'browser-not-opened': { kind: 'E', action: 'reopen-browser', details: true },
  'account-not-read': { kind: 'F', action: 'retry', details: true },
  unknown: { kind: 'G', action: 'retry', details: true },
}

/** The sentence the login window shows for each case (the Host speaks Chinese). */
export const LOGIN_FAILURE_MESSAGES = {
  'code-expired': '二维码已过期，请刷新后重试',
  'expired-after-scan': '二维码在你确认之前过期了，请刷新后重试',
  'not-authorized': '这次登录没有得到授权',
  'browser-unfinished': '浏览器里的登录还没有完成',
  unreachable: '连不上平台，请检查网络或代理',
  'no-answer': '平台没有回应，请稍后再试',
  refused: '平台拒绝了这次登录',
  'retry-later': '平台要求稍后再试',
  'device-limit': '登录设备已达上限，请先在手机 App 里移除旧设备',
  'wrong-scan-app': '扫码用的 App 与登录方式不匹配，请换对应的 App',
  'account-restricted': '这个账号被平台限制登录',
  'local-service-stopped': '本地登录服务没有在运行',
  'local-service-unavailable': '本地登录服务不可用',
  'cannot-listen': '本地登录服务起不来（端口或权限）',
  'no-browser': '打不开浏览器',
  'browser-not-opened': '浏览器没有打开登录页',
  'account-not-read': '登录成功但没读到账号',
  unknown: '登录没有成功，原因不明',
}

/** Cases a provider may name outright. */
export const PROVIDER_CASES = new Set(['device-limit', 'wrong-scan-app', 'account-restricted'])

/**
 * Facts from the error the Host caught, without inventing anything.
 *
 * `code` here is the platform's own code (Folia's meaning of the field); the plugin
 * only knows the transport's, which is `errorCode`.
 */
export function loginFailureFacts(step, error) {
  const facts = { step: String(step || 'start') }
  const record = error !== null && typeof error === 'object' ? error : {}
  if (Number.isFinite(record.status) && record.status > 0) facts.httpStatus = Number(record.status)
  if (Number.isFinite(record.retryAfterMs) && record.retryAfterMs > 0) facts.retryAfterMs = Number(record.retryAfterMs)
  if (record.code === 'network' || record.code === 'timeout') facts.errorCode = 'network'
  else if (typeof record.code === 'string' && record.code !== '') facts.transportCode = record.code
  if (record.scanned === true) facts.scanned = true
  // A provider that already named its case hands it over instead of making us guess.
  if (typeof record.case === 'string' && LOGIN_CASES[record.case] !== undefined) facts.case = record.case
  const message = record.message === undefined ? record.messageText : record.message
  if (typeof message === 'string' && message !== '') facts.messageText = message
  return facts
}

/**
 * Which case the facts add up to. Folia's order: a named case, then the step, then what
 * the platform asked for, then the transport facts.
 */
export function caseIdOf(facts) {
  if (facts.case !== undefined && LOGIN_CASES[facts.case] !== undefined) return facts.case
  const status = facts.httpStatus
  // The plugin's transport codes say more than the bare status where they are known.
  if (facts.transportCode === 'not-configured') return 'local-service-unavailable'
  if (facts.transportCode === 'rate-limited') return 'retry-later'
  if (facts.step === 'account') return 'account-not-read'
  if (facts.step === 'wait') {
    if (facts.errorCode === 'network') return 'unreachable'
    if (facts.scanned === true) return 'expired-after-scan'
    return 'code-expired'
  }
  if (facts.retryAfterMs !== undefined || status === 429) return 'retry-later'
  if (status !== undefined && status >= 500) return 'unreachable'
  if (status !== undefined && status >= 400) return 'refused'
  if (facts.errorCode === 'network') return 'unreachable'
  if (facts.transportCode === 'auth-required') return 'refused'
  // A route that asked for a code and got "not ready" is waiting, not refused.
  if (facts.transportCode === 'protocol' && facts.step === 'start') return 'no-answer'
  return 'unknown'
}

/**
 * The failure to hand back: Folia's case shape, its facts, and the sentence to show.
 *
 * @param {'start'|'wait'|'account'} step
 * @param {unknown} error
 */
export function loginFailureOf(step, error) {
  const facts = loginFailureFacts(step, error)
  const id = caseIdOf(facts)
  const meta = LOGIN_CASES[id]
  return {
    case: { id, kind: meta.kind, action: meta.action, details: meta.details },
    facts,
    message: LOGIN_FAILURE_MESSAGES[id],
  }
}
