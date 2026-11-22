/**
 * Turn wire payloads into harness stream chunks.
 *
 * The harness expects a block-structured stream, not a flat delta stream: a block
 * announces itself with `block-start` before any of its deltas, and closes with
 * `block-end` carrying the assembled value. Blocks are numbered and the numbering
 * is shared across text, reasoning and tool calls, so a consumer can tell two
 * parallel tool calls apart.
 *
 * Everything here is a pure transform over payload strings, which is what makes
 * it testable without a network.
 *
 * @module src/stream.js
 */

/** The wire's finish token, mapped onto the harness's finish kinds. */
const FINISH_KIND = {
  stop: 'stop',
  length: 'max-tokens',
  tool_calls: 'tool-calls',
  content_filter: 'stop',
}

/**
 * Block bookkeeping shared by every delta kind.
 *
 * A block is opened on demand by the first delta that belongs to it and closed
 * once, at the end of the stream. `slot` returns the block's index, opening it
 * the first time.
 */
class Blocks {
  constructor(yieldChunk, startIndex) {
    this.emit = yieldChunk
    this.next = startIndex
    this.open = new Map()
    /** The key a continuation delta with no index and no id belongs to. */
    this.lastToolKey = undefined
  }

  slot(key, kind) {
    const existing = this.open.get(key)
    if (existing !== undefined) return existing
    const block = { index: this.next++, kind, text: '', args: '', id: '', name: '' }
    this.open.set(key, block)
    this.emit({ type: 'block-start', index: block.index, blockType: kind })
    return block
  }

  /** Close every open block, in the order they opened. */
  closeAll() {
    const blocks = [...this.open.values()].sort((left, right) => left.index - right.index)
    for (const block of blocks) {
      this.emit({ type: 'block-end', index: block.index, block: valueOf(block) })
    }
    this.open.clear()
  }
}

/** The assembled value a closed block carries. */
function valueOf(block) {
  if (block.kind === 'tool-call') {
    return { type: 'tool-call', id: block.id, name: block.name, arguments: block.args }
  }
  if (block.kind === 'reasoning') return { type: 'reasoning', text: block.text }
  return { type: 'text', text: block.text }
}

/**
 * Read one stream of `data:` payloads and yield harness chunks.
 *
 * A malformed payload is skipped rather than fatal: the gateway has been observed
 * to interleave keepalive text, and one unparseable frame must not cost the user
 * the rest of the answer. An error envelope, by contrast, ends the stream — it is
 * the upstream saying this turn is over.
 *
 * @param {Iterable<string> | AsyncIterable<string>} payloads
 * @param {{ startIndex?: number }} [options]
 * @yields {object} harness StreamChunk
 */
export async function* readChunks(payloads, options = {}) {
  const startIndex = Number.isSafeInteger(options?.startIndex) && options.startIndex >= 0 ? options.startIndex : 0
  const outbox = []
  const blocks = new Blocks(chunk => outbox.push(chunk), startIndex)
  let finish
  let usage

  for await (const raw of payloads) {
    if (typeof raw !== 'string') continue
    let payload
    try { payload = JSON.parse(raw) } catch { continue }

    if (payload?.error !== undefined || payload?.type === 'error') {
      throw errorFrom(payload)
    }

    for (const choice of payload?.choices ?? []) {
      const delta = choice?.delta ?? {}

      const reasoning = reasoningOf(delta)
      if (reasoning !== '') {
        const block = blocks.slot('reasoning', 'reasoning')
        block.text += reasoning
        blocks.emit({ type: 'reasoning-delta', index: block.index, text: reasoning })
      }

      if (typeof delta.content === 'string' && delta.content !== '') {
        const block = blocks.slot('text', 'text')
        block.text += delta.content
        blocks.emit({ type: 'text-delta', index: block.index, text: delta.content })
      }

      if (Array.isArray(delta.tool_calls)) toolCallDeltas(blocks, delta.tool_calls)

      if (choice?.finish_reason !== undefined && choice.finish_reason !== null) {
        finish = FINISH_KIND[choice.finish_reason] ?? 'stop'
      }
    }

    if (payload?.usage !== undefined) usage = usageOf(payload.usage)

    while (outbox.length > 0) yield outbox.shift()
  }

  blocks.closeAll()
  while (outbox.length > 0) yield outbox.shift()

  if (usage !== undefined) yield { type: 'usage', usage }
  yield { type: 'finish', reason: { kind: finish ?? 'stop' } }
}

/** The thinking text of one delta, across the spellings this gateway uses. */
function reasoningOf(delta) {
  if (typeof delta.reasoning === 'string' && delta.reasoning !== '') return delta.reasoning
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content !== '') return delta.reasoning_content
  if (Array.isArray(delta.reasoning_details)) {
    let text = ''
    for (const detail of delta.reasoning_details) {
      if (typeof detail?.text === 'string') text += detail.text
    }
    return text
  }
  return ''
}

/**
 * Feed one `tool_calls` delta array into its blocks.
 *
 * `tool_calls[].index` is the wire's accumulator key and is what real servers
 * send; keying calls without one to a constant would merge every parallel call
 * into a single block with the ids overwriting each other. The call id — present
 * on exactly the shapes that omit the index — separates those, and a bare
 * arguments continuation continues the call in front of it.
 *
 * The assembled `arguments` string is delivered verbatim even when it is not
 * valid JSON: the harness repairs tool-call pairing on the next turn, and
 * dropping or rewriting the fragment here would lose what the model actually
 * asked for.
 */
function toolCallDeltas(blocks, calls) {
  for (const call of calls) {
    if (call === null || typeof call !== 'object') continue
    const key = toolKey(blocks, call)
    const block = blocks.slot(key, 'tool-call')

    if (block.id === '' && typeof call.id === 'string' && call.id !== '') block.id = call.id
    const name = call?.function?.name
    if (block.name === '' && typeof name === 'string' && name !== '') block.name = name

    const fragment = call?.function?.arguments
    if (typeof fragment === 'string' && fragment !== '') {
      block.args += fragment
      blocks.emit({ type: 'tool-call-delta', index: block.index, id: block.id, name: block.name, argumentsDelta: fragment })
    }
  }
}

/**
 * The accumulator key for one tool-call delta.
 *
 * Remembered per block map so a later call that omits both `index` and `id`
 * continues the one in front of it rather than opening a phantom call.
 */
function toolKey(blocks, call) {
  if (call.index !== undefined && call.index !== null) {
    const key = `i${call.index}`
    blocks.lastToolKey = key
    return key
  }
  if (typeof call.id === 'string' && call.id !== '') {
    for (const [key, block] of blocks.open) {
      if (block.kind === 'tool-call' && block.id === call.id) {
        blocks.lastToolKey = key
        return key
      }
    }
    blocks.lastToolKey = `id:${call.id}`
    return blocks.lastToolKey
  }
  return blocks.lastToolKey ?? 'i0'
}

function usageOf(usage) {
  return {
    inputTokens: count(usage?.prompt_tokens),
    outputTokens: count(usage?.completion_tokens),
    reasoningTokens: count(usage?.reasoning_tokens),
  }
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** An in-stream error envelope, classified onto the harness vocabulary. */
function errorFrom(payload) {
  const error = payload?.error ?? payload
  const message = typeof error?.message === 'string' && error.message !== '' ? error.message : 'upstream error'
  const raw = String(error?.code ?? error?.type ?? '').toLowerCase()
  const code = raw.includes('rate') || raw.includes('429')
    ? 'RATE_LIMIT'
    : raw.includes('auth') || raw.includes('credential') || raw.includes('401')
      ? 'INVALID_CREDENTIAL'
      : raw.includes('quota') || raw.includes('insufficient') || raw.includes('credit')
        ? 'QUOTA_EXHAUSTED'
        : 'SERVER'
  return Object.assign(new Error(message), { name: 'KiloError', code, upstream: payload })
}
