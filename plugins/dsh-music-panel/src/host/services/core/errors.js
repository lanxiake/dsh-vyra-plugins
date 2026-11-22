/**
 * One error type for every source.
 *
 * The current routes answer with an HTTP status plus an ad-hoc `code` string
 * (`NO_STREAM`, …). That is enough for a human reading logs, not for a client
 * deciding whether to retry. `MusicError` adds the two facts a caller needs:
 * whether the same request may succeed later, and how long the platform asked us
 * to wait.
 *
 * @module dsh-music-panel/core/errors
 */

/** Failure kinds the UI can switch on. */
export const ERROR_CODES = [
  'not-configured',
  'unavailable',
  'auth-required',
  'rate-limited',
  'not-playable',
  'network',
  'timeout',
  'protocol',
  'invalid-response',
]

const RETRYABLE = new Set(['network', 'timeout', 'rate-limited'])

export class MusicError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, sourceId?: string, retryable?: boolean, retryAfterMs?: number, status?: number, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message)
    this.name = 'MusicError'
    this.code = ERROR_CODES.includes(options.code) ? options.code : 'protocol'
    this.sourceId = options.sourceId ?? ''
    this.retryable = options.retryable ?? RETRYABLE.has(this.code)
    this.retryAfterMs = options.retryAfterMs ?? 0
    this.status = options.status ?? 0
    if (options.cause !== undefined) this.cause = options.cause
  }

  /** Shape sent to the browser: never includes the cause chain. */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      sourceId: this.sourceId,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
      status: this.status,
    }
  }
}

const NETWORK_PATTERN = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|socket hang up|network/i
const TIMEOUT_PATTERN = /aborted|abort|timed? ?out|ETIMEDOUT/i

/**
 * Wrap anything thrown by a transport, keeping the provider's own words.
 * Unknown shapes fall back to `protocol` so a caller never sees an untyped throw.
 */
export function toMusicError(error, sourceId = '') {
  if (error instanceof MusicError) {
    if (sourceId === '' || error.sourceId !== '') return error
    return new MusicError(error.message, {
      code: error.code,
      sourceId,
      retryable: error.retryable,
      retryAfterMs: error.retryAfterMs,
      status: error.status,
      cause: error,
    })
  }
  const message = error instanceof Error ? error.message : String(error)
  const code = TIMEOUT_PATTERN.test(message)
    ? 'timeout'
    : NETWORK_PATTERN.test(message)
      ? 'network'
      : 'protocol'
  return new MusicError(message, { code, sourceId, cause: error })
}

/** HTTP status for a failure code, so routes and the new layer agree. */
export function statusFor(error) {
  switch (error?.code) {
    case 'auth-required':
      return 401
    case 'not-playable':
      return 404
    case 'not-configured':
      return 503
    case 'unavailable':
      return 501
    case 'timeout':
      return 504
    case 'rate-limited':
      return 429
    case 'network':
    case 'protocol':
    case 'invalid-response':
      return 502
    default:
      return 500
  }
}
