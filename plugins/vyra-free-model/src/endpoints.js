/**
 * Bring-your-own-key endpoints.
 *
 * A category of product (Doubao / Volcengine Ark, Kimi, Zhipu, SiliconFlow, and
 * anything else that speaks the OpenAI chat wire) has free quota behind an API
 * key rather than behind an account login. One generic block covers all of them
 * instead of one bespoke protocol per vendor.
 *
 * Keys live in this plugin's own settings file (mode 0600) and are never echoed
 * back to the page; the summary only says whether one exists.
 *
 * @module src/endpoints.js
 */

import { postChatStream } from './kilo.js'
import { readChunks } from './stream.js'
import { toChatMessages, toToolDefs } from './messages.js'

/** Model ids this module owns in the shared catalog. */
export const ENDPOINT_PREFIX = 'ep:'

/** A row the settings page edits. */
export function sanitizeEndpoints(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object') continue
    const id = typeof raw.id === 'string' && /^[a-z0-9-]{1,32}$/.test(raw.id) ? raw.id : ''
    const baseUrl = normalizeBaseUrl(raw.baseUrl)
    if (id === '' || baseUrl === '' || !isCallableBaseUrl(baseUrl)) continue
    out.push({
      id,
      name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim().slice(0, 40) : baseUrl,
      baseUrl,
      apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
      enabled: raw.enabled !== false,
      models: Array.isArray(raw.models) ? raw.models.filter(row => row !== null && typeof row === 'object' && typeof row.id === 'string') : [],
      modelsAt: Number.isFinite(raw.modelsAt) ? raw.modelsAt : 0,
      lastError: typeof raw.lastError === 'string' ? raw.lastError.slice(0, 200) : '',
    })
  }
  return out
}

/** `https://ark.cn-beijing.volces.com/api/v3/` -> `.../api/v3`. */
export function normalizeBaseUrl(value) {
  if (typeof value !== 'string') return ''
  let url = value.trim()
  if (url === '') return ''
  // A bare host gets https; any other scheme (file:, ftp:, …) is not a chat
  // endpoint and must not be rewritten into an https URL that looks plausible.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    if (!/^https?:\/\//i.test(url)) return ''
  } else {
    url = `https://${url}`
  }
  url = url.replace(/\/+$/, '')
  // People paste the endpoint they use in code; the model list lives one level up.
  url = url.replace(/\/(chat\/completions|models)$/i, '')
  return url
}

/** A URL safe for this process to call: http(s), no credentials in the URL. */
export function isCallableBaseUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (url.username !== '' || url.password !== '') return false
    return true
  } catch {
    return false
  }
}

/** `ep:<endpointId>/<modelId>`; the model id may itself contain slashes. */
export function endpointModelId(endpointId, modelId) {
  return `${ENDPOINT_PREFIX}${endpointId}/${modelId}`
}

/** Split a composite id back into its endpoint and model halves. */
export function parseEndpointModelId(value) {
  if (typeof value !== 'string' || !value.startsWith(ENDPOINT_PREFIX)) return undefined
  const rest = value.slice(ENDPOINT_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0 || slash === rest.length - 1) return undefined
  return { endpointId: rest.slice(0, slash), modelId: rest.slice(slash + 1) }
}

/** The auth header, only when a key exists. */
export function endpointHeaders(endpoint) {
  const headers = { 'content-type': 'application/json', accept: 'text/event-stream' }
  if (typeof endpoint.apiKey === 'string' && endpoint.apiKey !== '') {
    headers.authorization = `Bearer ${endpoint.apiKey}`
  }
  return headers
}

/**
 * Fetch one endpoint's model list.
 *
 * `metadata` is whatever the vendor chose to publish; context and vision are
 * read from the common spellings and left at conservative defaults otherwise.
 */
export async function fetchEndpointModels(endpoint, { fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  if (!isCallableBaseUrl(endpoint.baseUrl)) throw new Error('Base URL 不是 http(s) 地址')
  const response = await fetchImpl(`${endpoint.baseUrl}/models`, {
    method: 'GET',
    headers: { accept: 'application/json', ...(endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : {}) },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}${text === '' ? '' : `: ${text.slice(0, 120)}`}`)
  }
  const payload = await response.json().catch(() => null)
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  const rows = []
  for (const raw of list) {
    const id = typeof raw === 'string' ? raw : (typeof raw?.id === 'string' ? raw.id : '')
    if (id === '') continue
    const context = numberOr(raw?.context_length ?? raw?.context_window ?? raw?.max_context_length, 131_072)
    rows.push({
      id,
      name: typeof raw?.name === 'string' && raw.name !== '' ? raw.name : id,
      contextWindow: context,
      maxOutput: numberOr(raw?.max_output_tokens ?? raw?.max_tokens, Math.min(context, 32_768)),
      vision: raw?.supports_vision === true || raw?.vision === true
        || (Array.isArray(raw?.input_modalities) && raw.input_modalities.includes('image')),
    })
  }
  return rows
}

/**
 * One streaming turn against a user's endpoint.
 *
 * @yields harness stream chunks
 */
export async function* streamEndpointTurn({ endpoint, model, options, imageResolver }) {
  const warnings = []
  const body = {
    model,
    messages: toChatMessages(options.messages, imageResolver, warnings),
    stream: true,
  }
  const tools = toToolDefs(options.tools)
  if (tools.length > 0) body.tools = tools
  if (Number.isFinite(options.maxTokens) && options.maxTokens > 0) body.max_tokens = Math.floor(options.maxTokens)
  if (Number.isFinite(options.temperature)) body.temperature = options.temperature
  if (Array.isArray(options.stop) && options.stop.length > 0) body.stop = options.stop

  const payloads = []
  try {
    await postChatStream({
      url: `${endpoint.baseUrl}/chat/completions`,
      headers: endpointHeaders(endpoint),
      body,
      signal: options.signal,
      timeoutMs: 300_000,
      fetchImpl: options.fetchImpl ?? globalThis.fetch,
      onPayload: payload => payloads.push(payload),
    })
  } catch (error) {
    yield {
      type: 'finish',
      reason: {
        kind: 'error',
        failure: {
          message: String(error?.message ?? error),
          code: typeof error?.code === 'string' ? error.code : 'SERVER',
          ...(Number.isFinite(error?.status) ? { status: error.status } : {}),
        },
      },
    }
    return
  }
  for await (const chunk of readChunks(payloads)) yield chunk
}

function numberOr(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}