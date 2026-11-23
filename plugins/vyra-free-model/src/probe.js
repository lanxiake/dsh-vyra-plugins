/**
 * One cheap reachability probe per model.
 *
 * "重新检测" used to refresh the listing only, which says the gateway answered —
 * not that a given model can answer. This asks each model for a single token so
 * the page can say which ones are actually usable right now.
 *
 * The classification matters more than the request: a 429 is the free pool's
 * quota window, not a dead model; a 5xx is the gateway having a bad minute. Only
 * a 404 or an explicit "model is unavailable" counts as unavailable, because
 * hiding a model on a transient error would leave the picker emptier than the
 * truth.
 *
 * @module src/probe.js
 */

import { KILO_BASE, ATTRIBUTION } from './kilo.js'

/** How long one probe may take before it is reported as unknown. */
export const PROBE_TIMEOUT_MS = 12_000

/** How many probes run at once. The free pool rate-limits bursts. */
export const PROBE_CONCURRENCY = 4

/**
 * Probe one model.
 *
 * @returns {Promise<{ state: 'ok'|'limited'|'unavailable'|'unknown', reason?: string, ms: number, at: number }>}
 */
export async function probeModel(id, { timeoutMs = PROBE_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const startedAt = Date.now()
  const at = startedAt
  let response
  try {
    response = await fetchImpl(`${KILO_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...ATTRIBUTION },
      body: JSON.stringify({
        model: id,
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
        max_tokens: 1,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return { state: 'unknown', reason: timeout ? '超时' : '连不上', ms: Date.now() - startedAt, at }
  }

  if (response.ok) {
    // Drain the stream so the socket is released, but never let a stuck stream
    // turn one probe into a page-wide hang.
    try {
      await withTimeout(response.text(), 8_000)
    } catch { /* a slow body does not make an accepted model unusable */ }
    return { state: 'ok', ms: Date.now() - startedAt, at }
  }

  const text = await response.text().catch(() => '')
  const reason = messageOf(text)
  if (response.status === 429) return { state: 'limited', reason: '上游限流', ms: Date.now() - startedAt, at }
  if (response.status === 402) return { state: 'limited', reason: '额度用完', ms: Date.now() - startedAt, at }
  if (response.status >= 500) return { state: 'unknown', reason: `上游错误 ${response.status}`, ms: Date.now() - startedAt, at }

  const lower = text.toLowerCase()
  const missing = response.status === 404
    || lower.includes('unavailable')
    || lower.includes('not found')
    || lower.includes('unknown model')
    || lower.includes('no such model')
  return {
    state: missing ? 'unavailable' : 'unknown',
    reason: reason || `HTTP ${response.status}`,
    ms: Date.now() - startedAt,
    at,
  }
}

/**
 * Probe every id, four at a time, preserving input order.
 *
 * @returns {Promise<Record<string, object>>}
 */
export async function probeAll(ids, options = {}) {
  const list = Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id !== '') : []
  const results = {}
  let index = 0
  const worker = async () => {
    while (index < list.length) {
      const id = list[index]
      index += 1
      results[id] = await probeModel(id, options)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, list.length) }, worker))
  return results
}

/** The upstream's own message when it sent one, else empty. */
function messageOf(text) {
  try {
    const payload = JSON.parse(text)
    const message = payload?.error?.message ?? payload?.message
    return typeof message === 'string' ? message.slice(0, 120) : ''
  } catch {
    return String(text ?? '').trim().slice(0, 120)
  }
}

/** Resolve after `ms`, or reject when the promise itself never settles. */
function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('probe body timeout')), ms); timer.unref?.() }),
  ])
}
