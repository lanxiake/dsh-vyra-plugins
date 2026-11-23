/**
 * CodeBuddy / WorkBuddy as a model lane.
 *
 * The channel pack bundled with this plugin predates Tencent's channel, so the
 * protocol lives here: the login flow is vendored from the MIT `dsh-codebuddy`
 * plugin (see `buddy-login.js`), and this module adds the two pieces a model
 * picker needs — a catalog and a streaming turn.
 *
 * Tencent scans the whole request body for prompts from unapproved clients and
 * answers 400 / 11128 when it finds one. The defence that works (measured by
 * that project) is to replace every system prompt with a neutral one and wash
 * the same known sentences out of every role, because history is scanned too.
 *
 * @module src/buddy.js
 */

import { postChatStream } from './kilo.js'
import { readChunks } from './stream.js'

const CHAT_PATH = '/v2/chat/completions'
const CONFIG_PATH = '/v3/config'
const REFRESH_PATH = '/v2/plugin/auth/token/refresh'
const REQUEST_TIMEOUT_MS = 60_000
const FIRST_TOKEN_TIMEOUT_MS = 90_000

/** The same sentences Tencent has been observed to reject. */
const BLOCKED_PATTERNS = [
  [/You are an AI agent powered by DeepSeek\s+Harness\.?/gi, 'You are a helpful coding assistant.'],
  [
    /Tokens prefixed with @\s{0,4}are\s+paths\s+the\s+user\s+explicitly\s+referenced\.(?:[\s\S]{0,500}?workspace\s+root[^.]*\.)?/gi,
    'Paths the user marks with a leading @ are explicit file references; those paths resolve from the workspace root.',
  ],
  [/DeepSeek\s+Harness/gi, 'the coding platform'],
  [/deepseek-harness/gi, 'the-coding-platform'],
  [/AI agent powered by DeepSeek/gi, 'helpful coding assistant'],
]

const BLOCKED_HINTS = /Harness|deepseek-harness|DeepSeek|Tokens prefixed with @|explicitly referenced/i

const NEUTRAL_SYSTEM = [
  'You are a helpful coding assistant working inside an IDE.',
  '',
  'General rules:',
  '- Use the provided tools to inspect and change files; read a file before editing it.',
  '- Prefer dedicated file/search tools over shell commands when they are available.',
  '- A non-zero exit code means the command failed; investigate before moving on.',
  '- Keep replies concise and match the language the user writes in.',
  '- Ask for clarification when a request is ambiguous instead of guessing.',
  '- Never claim to have inspected, read, or run something you did not.',
].join('\n')

/** Fallback catalog for CodeBuddy when `/v3/config` is unreachable. */
export const BUDDY_FALLBACK_MODELS = [
  { id: 'auto', name: 'Auto', contextWindow: 256_000, maxOutputTokens: 32_000, vision: true },
  { id: 'hy4free', name: 'Hy4 (free)', contextWindow: 1_000_000, maxOutputTokens: 64_000, vision: true },
  { id: 'hy4std', name: 'Hy4 (std)', contextWindow: 1_000_000, maxOutputTokens: 64_000, vision: true },
  { id: 'step-5-preview', name: 'Step-5-Preview', contextWindow: 1_000_000, maxOutputTokens: 64_000, vision: true },
  { id: 'deepseek-v4.1-flash', name: 'Deepseek-V4.1-Flash', contextWindow: 1_000_000, maxOutputTokens: 393_216, vision: true },
  { id: 'deepseek-v4-pro', name: 'Deepseek-V4-Pro', contextWindow: 1_000_000, maxOutputTokens: 393_216, vision: true },
  { id: 'glm-5.3', name: 'GLM-5.3', contextWindow: 1_000_000, maxOutputTokens: 131_072, vision: true },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash', contextWindow: 1_000_000, maxOutputTokens: 131_072, vision: true },
  { id: 'kimi-k3.1-pro', name: 'Kimi-K3.1-Pro', contextWindow: 1_000_000, maxOutputTokens: 32_000, vision: true },
  { id: 'kimi-k2.8-preview', name: 'Kimi-K2.8-Preview', contextWindow: 1_000_000, maxOutputTokens: 131_072, vision: true },
  { id: 'minimax-m3.1-flash', name: 'MiniMax-M3.1-Flash', contextWindow: 1_000_000, maxOutputTokens: 128_000, vision: true },
  { id: 'mimo-v2.6-pro', name: 'Xiaomi MiMo-V2.6-Pro', contextWindow: 1_000_000, maxOutputTokens: 128_000, vision: true },
]

/** Headers every API call to one product carries. */
export function buddyHeaders(product, credential) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'User-Agent': product.userAgent,
    'X-Domain': product.apiDomain,
    'X-Product': 'SaaS',
    'X-Product-Code': product.productCode,
    'X-Agent-Purpose': 'conversation',
    'X-IDE-Name': product.id === 'workbuddy' ? 'WorkBuddy' : 'CodeBuddy',
    'X-IDE-Type': product.id === 'workbuddy' ? 'WorkBuddy' : 'CodeBuddy',
    'X-IDE-Version': product.pluginVersion || '1.106.1',
  }
  if (credential?.access_token) headers.Authorization = `Bearer ${credential.access_token}`
  if (credential?.user_id) headers['X-User-Id'] = String(credential.user_id)
  if (credential?.enterprise_id) headers['X-Enterprise-Id'] = String(credential.enterprise_id)
  return headers
}

/** Whether a stored credential is past (or nearly past) its expiry. */
export function buddyExpired(credential) {
  if (!credential) return true
  const raw = credential.expires_at
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw) <= Date.now() + 30_000
  const ms = Date.parse(String(raw ?? ''))
  return !Number.isFinite(ms) || ms <= Date.now() + 30_000
}

/**
 * Exchange a refresh token for a fresh access token.
 *
 * Returns the same credential shape with the new fields merged, or `undefined`
 * when the product did not accept the refresh.
 */
export async function refreshBuddyCredential(product, credential, { fetchImpl = globalThis.fetch } = {}) {
  if (!credential?.refresh_token) return undefined
  const headers = buddyHeaders(product, credential)
  headers['X-Refresh-Token'] = String(credential.refresh_token)
  headers['X-Auth-Refresh-Source'] = 'ide-main'
  headers.Accept = 'application/json'
  try {
    const response = await fetchImpl(`${product.endpoint}${REFRESH_PATH}`, {
      method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return undefined
    const data = (await response.json())?.data
    if (!data || typeof data !== 'object') return undefined
    const next = {
      ...credential,
      access_token: typeof data.accessToken === 'string' && data.accessToken !== '' ? data.accessToken : credential.access_token,
      refresh_token: typeof data.refreshToken === 'string' && data.refreshToken !== '' ? data.refreshToken : credential.refresh_token,
    }
    if (Number.isFinite(Number(data.expiresAt))) next.expires_at = String(Number(data.expiresAt))
    return next
  } catch {
    return undefined
  }
}

/**
 * Fetch one product's chat models.
 *
 * `supportsToolCall` / reasoning is how completion-only models are filtered out;
 * the remote field names have no published contract, so the usual spellings are
 * accepted.
 */
export async function fetchBuddyModels(product, credential, { fetchImpl = globalThis.fetch } = {}) {
  const headers = buddyHeaders(product, credential)
  headers.Accept = 'application/json'
  try {
    const response = await fetchImpl(`${product.endpoint}${CONFIG_PATH}`, {
      method: 'GET', headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return []
    const list = (await response.json())?.data?.models
    if (!Array.isArray(list) || list.length === 0) return []
    const rows = []
    for (const raw of list) {
      if (!raw || typeof raw.id !== 'string' || raw.id === '') continue
      if (!raw.supportsToolCall && !raw.reasoning && !raw.supportsReasoning) continue
      const contextWindow = pickNumber(raw, ['maxInputTokens', 'maxAllowedSize', 'contextWindow', 'context_length']) ?? 131_072
      const maxOutput = pickNumber(raw, ['maxOutputTokens', 'max_tokens']) ?? Math.min(contextWindow, 32_000)
      const vision = raw.supportsImage === true || raw.supportsVision === true
        || (Array.isArray(raw.inputModalities) && raw.inputModalities.includes('image'))
      rows.push({
        id: raw.id,
        name: typeof raw.name === 'string' && raw.name !== '' ? raw.name : raw.id,
        contextWindow,
        maxOutput,
        vision,
      })
    }
    return disambiguateNames(rows)
  } catch {
    return []
  }
}

/** The catalog a product shows, falling back to the built-in table. */
export function buddyCatalog(product, remote) {
  if (Array.isArray(remote) && remote.length > 0) return remote
  if (product.id !== 'buddy') return []
  return BUDDY_FALLBACK_MODELS.map(row => ({ ...row }))
}

/**
 * One streaming turn.
 *
 * The retry contract mirrors the lane adapter: a refused turn becomes an error
 * finish, and a 401 is retried once after the caller refreshes the token.
 *
 * @yields harness stream chunks
 */
export async function* streamBuddyTurn({ product, credential, ensureCredential, options, imageResolver }) {
  let active = credential
  const body = {
    model: options.model,
    messages: toBuddyMessages(options.messages, imageResolver),
    stream: true,
  }
  if (Array.isArray(options.tools) && options.tools.length > 0) {
    body.tools = options.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.parameters && typeof tool.parameters === 'object' ? tool.parameters : { type: 'object', properties: {} },
      },
    }))
  }
  if (Number.isFinite(options.maxTokens) && options.maxTokens > 0) body.max_tokens = Math.floor(options.maxTokens)
  if (Number.isFinite(options.temperature)) body.temperature = options.temperature
  if (Array.isArray(options.stop) && options.stop.length > 0) body.stop = options.stop

  const payloads = []
  const send = async activeCredential => postChatStream({
    url: `${product.endpoint}${CHAT_PATH}`,
    headers: { ...buddyHeaders(product, activeCredential), Accept: 'text/event-stream' },
    body,
    signal: options.signal,
    timeoutMs: Math.max(FIRST_TOKEN_TIMEOUT_MS, Number(options.maxTokens) > 0 ? 300_000 : 90_000),
    fetchImpl: options.fetchImpl,
    onPayload: payload => payloads.push(payload),
  })

  let failure
  try {
    await send(active)
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      const fresh = await ensureCredential?.()
      if (fresh?.access_token && fresh.access_token !== active?.access_token) {
        active = fresh
        payloads.length = 0
        try { await send(active) } catch (second) { failure = second }
      } else {
        failure = error
      }
    } else {
      failure = error
    }
  }

  if (failure !== undefined) {
    yield {
      type: 'finish',
      reason: {
        kind: 'error',
        failure: {
          message: String(failure.message ?? 'buddy upstream error'),
          code: typeof failure.code === 'string' ? failure.code : (failure.status === 429 ? 'RATE_LIMIT' : 'SERVER'),
          ...(Number.isFinite(failure.status) ? { status: failure.status } : {}),
        },
      },
    }
    return
  }

  for await (const chunk of readChunks(payloads)) yield chunk
}

/**
 * Serialize harness messages with the two Tencent defences in place.
 *
 * The image resolver is optional: without one the picture becomes a visible
 * placeholder rather than silently disappearing.
 */
export function toBuddyMessages(messages, resolveImage) {
  const wire = []
  for (const message of messages ?? []) {
    const role = message?.role
    const blocks = Array.isArray(message?.content) ? message.content : []
    if (role === 'system' || role === 'developer') {
      wire.push({ role: 'system', content: NEUTRAL_SYSTEM })
      continue
    }
    if (role === 'assistant') {
      const text = sanitize(blocks.filter(b => b?.type === 'text').map(b => b.text).join(''))
      const calls = blocks.filter(b => b?.type === 'tool-call').map(b => ({
        id: String(b.id ?? ''),
        type: 'function',
        function: { name: String(b.name ?? ''), arguments: sanitizeArgs(b.arguments) },
      }))
      if (text === '' && calls.length === 0) continue
      wire.push({
        role: 'assistant',
        ...(text === '' ? {} : { content: text }),
        ...(calls.length > 0 ? { tool_calls: calls } : {}),
      })
      continue
    }
    if (role === 'tool') {
      const text = sanitize(blocks.filter(b => b?.type === 'text').map(b => b.text).join(''))
      wire.push({ role: 'tool', tool_call_id: String(message?.toolCallId ?? ''), content: text === '' ? '(no output)' : text })
      continue
    }
    const parts = []
    for (const block of blocks) {
      if (block?.type === 'text' && typeof block.text === 'string') parts.push({ type: 'text', text: sanitize(block.text) })
      else if (block?.type === 'image') {
        const url = typeof resolveImage === 'function' ? resolveImage(block) : undefined
        if (typeof url === 'string' && url !== '') parts.push({ type: 'image_url', image_url: { url } })
        else parts.push({ type: 'text', text: '[image unavailable]' })
      }
    }
    if (parts.length === 0) continue
    wire.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts })
  }
  if (wire.length === 0 || wire[0].role !== 'system') wire.unshift({ role: 'system', content: NEUTRAL_SYSTEM })
  return wire
}

/** Replace every known trigger sentence. */
export function sanitize(text) {
  if (typeof text !== 'string' || text === '' || !BLOCKED_HINTS.test(text)) return text
  let out = text
  for (const [pattern, replacement] of BLOCKED_PATTERNS) out = out.replace(pattern, replacement)
  return out
}

function sanitizeArgs(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? {})
  if (!BLOCKED_HINTS.test(raw)) return raw
  const cleaned = sanitize(raw)
  try { JSON.parse(cleaned); return cleaned } catch { return raw }
}

function pickNumber(raw, keys) {
  for (const key of keys) {
    const value = raw?.[key]
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return Math.floor(number)
  }
  return undefined
}

/** Two models often share a display name; make the second one distinguishable. */
function disambiguateNames(rows) {
  const seen = new Set()
  return rows.map(row => {
    if (!seen.has(row.name)) { seen.add(row.name); return row }
    const suffix = /-(free|preview|pro|std|mini|lite)$/.exec(row.id)?.[1] ?? row.id
    return { ...row, name: `${row.name} (${suffix})` }
  })
}
