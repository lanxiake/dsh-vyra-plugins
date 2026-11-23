/**
 * Outbound wire for the Kilo lane.
 *
 * Kilo AI publishes an OpenAI-compatible gateway whose free pool answers with no
 * credential at all — no key, no login. That is what makes this plugin's
 * zero-configuration promise honest: there is genuinely nothing to fill in.
 *
 * The trade belongs in front of the user rather than hidden: the gateway's own
 * model cards state that free-pool prompts may be logged upstream and used to
 * improve its services. The settings page and the README both say so.
 *
 * This module is pure transport and shaping. It knows nothing about the harness:
 * it takes a body, calls the gateway, and hands every SSE payload to a callback
 * as a string. Turning those payloads into harness chunks is `stream.js`.
 *
 * @module src/kilo.js
 */

/**
 * The gateway base. Overridable so the offline suite and a local probe never
 * touch the real quota.
 */
export const KILO_BASE = (process.env.VYRA_KILO_BASE ?? 'https://ai-gateway.kilo.ai/api/v1').replace(/\/+$/, '')

/** The attribution headers Kilo's own clients send; documented optional. */
export const ATTRIBUTION = {
  'http-referer': 'https://kilo.ai/',
  'x-title': 'Vyra Free Model',
}

const LISTING_TIMEOUT_MS = 15000
const TURN_TIMEOUT_MS = 300000

/** The one id that makes the picker's default item an always-available choice. */
export const AUTO_ID = 'kilo-auto/free'

/** How the recommended auto pick reads in the picker. */
const AUTO_LABEL = '自动选择（推荐）'

/**
 * A classified upstream refusal.
 *
 * `code` is the vocabulary the harness reads off a finish reason, so it is the
 * same set `src/adapter.js` reports: RATE_LIMIT / INVALID_CREDENTIAL /
 * QUOTA_EXHAUSTED / SERVER / TIMEOUT / TRANSPORT / EMPTY_RESPONSE /
 * CLIENT_ERROR / ABORTED.
 */
export class KiloError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'KiloError'
    this.code = code
    Object.assign(this, details)
  }
}

/** Markers the pool uses for "the balance is gone", not "slow down". */
const QUOTA_MARKERS = ['insufficient credit', 'no credit', 'credit exhausted', 'out of credit', 'not enough credit', '余额', '额度已用', '积分不足']

/**
 * Classify one refusal.
 *
 * A 429 is the free pool's quota window and must NOT be retried — retrying only
 * lengthens the wait. A 5xx is worth one retry. Everything else is the caller's
 * request being wrong, which no retry fixes.
 */
export function classifyStatus(status, bodyText, retryAfterMs) {
  const text = String(bodyText ?? '')
  const lower = text.toLowerCase()
  const detail = { status, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) }
  const message = messageOf(text) || `HTTP ${status}`

  if (status === 429) return new KiloError(message, 'RATE_LIMIT', detail)
  if (status === 401 || status === 403) return new KiloError(message, 'INVALID_CREDENTIAL', detail)
  if (status === 402 || QUOTA_MARKERS.some(marker => lower.includes(marker))) {
    return new KiloError(message, 'QUOTA_EXHAUSTED', detail)
  }
  if (status >= 500) return new KiloError(message, 'SERVER', detail)
  return new KiloError(message, 'CLIENT_ERROR', detail)
}

/** The upstream's own message when it sent one, else empty. */
function messageOf(text) {
  try {
    const payload = JSON.parse(text)
    const message = payload?.error?.message ?? payload?.message
    return typeof message === 'string' ? message.slice(0, 300) : ''
  } catch {
    return text.trim().slice(0, 300)
  }
}

/** One listing round. Returns the raw model documents. */
export async function fetchKiloListing({ signal, timeoutMs = LISTING_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetchImpl(`${KILO_BASE}/models`, {
      headers: { accept: 'application/json', ...ATTRIBUTION },
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw classifyStatus(response.status, await response.text().catch(() => ''))
    }
    const payload = await response.json()
    return Array.isArray(payload?.data) ? payload.data : []
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Project the raw listing onto this plugin's catalog rows.
 *
 * Only `isFree` entries are kept: everything else on that gateway is a paid id
 * that answers 401 without a key, so offering it would be offering a failure.
 *
 * @param {Array<object>} rawModels
 * @returns {Array<{ id: string, name: string, contextWindow: number, maxOutput: number, vision: boolean, efforts: readonly string[] | undefined, defaultEffort: string | undefined }>}
 */
export function buildCatalog(rawModels) {
  const rows = []
  for (const raw of rawModels ?? []) {
    if (raw === null || typeof raw !== 'object') continue
    if (raw.isFree !== true) continue
    const id = String(raw.id ?? '')
    if (id === '') continue

    const contextWindow = Number.isFinite(raw.context_length) && raw.context_length > 0
      ? Math.floor(raw.context_length)
      : 131072
    // The paid-tier documents name their output ceiling under top_provider; the
    // free ones sometimes leave it null, so a quarter of the window is the
    // fallback — capped, because a 921K ceiling on a 30s turn is not a promise
    // anyone should inherit silently.
    const declared = raw?.top_provider?.max_completion_tokens
    const maxOutput = Number.isFinite(declared) && declared > 0
      ? Math.floor(declared)
      : Math.min(Math.floor(contextWindow / 4), 65536)

    const modalities = raw?.architecture?.input_modalities
    const vision = Array.isArray(modalities) && modalities.includes('image')
    const efforts = declaredEfforts(raw)

    rows.push({
      id,
      name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : stripSuffix(id),
      contextWindow,
      maxOutput,
      vision,
      efforts,
      defaultEffort: undefined,
    })
  }

  // The gateway's own rotation entry is the one item that never goes stale: its
  // upstream picks whatever is currently free. Putting it first means a user who
  // never chooses still has a working model.
  return promoteAuto(rows)
}

/** Move `kilo-auto/free` to the front and label it, leaving the rest in order. */
function promoteAuto(rows) {
  const index = rows.findIndex(row => row.id === AUTO_ID)
  if (index < 0) return rows
  const [auto] = rows.splice(index, 1)
  return [{ ...auto, name: AUTO_LABEL }, ...rows]
}

/** `some-model:free` -> `some-model`. */
function stripSuffix(id) {
  return id.endsWith(':free') ? id.slice(0, -':free'.length) : id
}

/**
 * The effort rungs the model itself declares, if it declares a usable menu.
 *
 * Only `type: 'effort'` produces rungs: it is the one expression the wire has
 * (`reasoning_effort`), and a fabricated rung would be a value the upstream may
 * reject outright. `toggle` and an empty table produce nothing — those models'
 * thinking cannot be levelled, and a control that promises otherwise lies.
 *
 * A single declared rung is also not a menu.
 */
function declaredEfforts(raw) {
  const options = raw?.opencode?.reasoning_options
  if (!Array.isArray(options)) return undefined
  for (const option of options) {
    if (option?.type !== 'effort') continue
    const values = option.values
    if (!Array.isArray(values) || values.length < 2) continue
    const clean = values.filter(value => typeof value === 'string' && value !== '')
    return clean.length >= 2 ? clean : undefined
  }
  return undefined
}

/**
 * Split SSE text into its `data:` payloads.
 *
 * Comment lines (leading `:`) are keepalives and are dropped. A multi-line
 * `data:` block is joined with newlines, which is what the SSE grammar says it
 * means. `[DONE]` ends the stream. A trailing partial frame is dropped: it will
 * arrive whole in the next read.
 */
export function parseSseText(text) {
  const out = []
  let data = []
  for (const rawLine of String(text ?? '').split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line === '') {
      if (data.length > 0) {
        const payload = data.join('\n')
        if (payload === '[DONE]') return out
        out.push(payload)
        data = []
      }
      continue
    }
    if (line.startsWith(':')) continue
    if (line.startsWith('data:')) {
      data.push(line.slice('data:'.length).replace(/^ /, ''))
    }
  }
  return out
}

/**
 * POST one turn and hand every SSE payload to `onPayload` as a string.
 *
 * Two shapes arrive on this endpoint and both must work:
 *
 * 1. real SSE frames, which is the documented behaviour; and
 * 2. a single complete JSON document under a `text/event-stream` content type,
 *    which this gateway has been observed to send under load. Parsing that as
 *    SSE would silently discard the whole answer, so the first non-whitespace
 *    character decides: `{` means "not SSE", and the body is delivered whole.
 *
 * The decoder is incremental (`{ stream: true }`) because a multi-byte character
 * can be split across two network reads; decoding each chunk on its own mangles
 * every Chinese character that happens to land on a frame boundary.
 */
export async function postKiloStreamed(options) {
  return postChatStream({
    ...options,
    url: `${KILO_BASE}/chat/completions`,
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...ATTRIBUTION },
  })
}

/**
 * POST one OpenAI-compatible streaming turn to any endpoint.
 *
 * The Kilo lane and the user's own keyed endpoints differ only in URL and
 * headers, so the framing (SSE vs. a whole JSON document, incremental UTF-8
 * decode, partial-frame buffering) lives here once.
 */
export async function postChatStream({ url, headers = {}, body, signal, onPayload, timeoutMs = TURN_TIMEOUT_MS, fetchImpl = globalThis.fetch }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  let response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      redirect: 'error',
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    if (signal?.aborted === true || error?.name === 'AbortError') {
      throw new KiloError('request aborted', 'ABORTED')
    }
    throw new KiloError(`model request failed: ${error?.message ?? error}`, 'TRANSPORT')
  }

  try {
    const retrySeconds = Number(response.headers.get('retry-after'))
    const retryAfterMs = Number.isFinite(retrySeconds) && retrySeconds > 0 ? Math.trunc(retrySeconds * 1000) : undefined
    if (!response.ok) {
      throw classifyStatus(response.status, await response.text().catch(() => ''), retryAfterMs)
    }
    if (response.body === null) throw new KiloError('model stream returned no body', 'EMPTY_RESPONSE')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let mode = null // 'sse' | 'json' once the first bytes say which

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      if (mode === null) {
        const head = buffer.replace(/^\s+/, '')
        if (head === '') continue
        mode = head.startsWith('{') ? 'json' : 'sse'
      }

      if (mode === 'sse') {
        // Only complete frames may be handed on: the tail stays buffered until
        // its blank line arrives in a later read.
        const boundary = buffer.lastIndexOf('\n\n')
        if (boundary < 0) continue
        const frames = buffer.slice(0, boundary + 2)
        buffer = buffer.slice(boundary + 2)
        for (const payload of parseSseText(frames)) onPayload(payload)
      }
    }
    buffer += decoder.decode()

    if (mode === 'json') {
      if (buffer.trim() !== '') onPayload(buffer)
    } else if (buffer.trim() !== '') {
      for (const payload of parseSseText(`${buffer}\n\n`)) onPayload(payload)
    }
    return { status: response.status }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
