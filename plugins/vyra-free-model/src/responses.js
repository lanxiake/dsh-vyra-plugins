/**
 * The OpenAI Responses shape.
 *
 * Codex speaks `wire_api = "responses"`: it POSTs to `/v1/responses` and reads a
 * typed event stream. The free lane speaks the chat shape, so this module is the
 * translation layer between them.
 *
 * Three details are load-bearing and each was learned the hard way upstream:
 *
 * 1. `sequence_number` is required on every event and must increase strictly.
 *    A client that checks it rejects the very first frame when the field is
 *    missing, which makes the whole streaming surface unusable.
 * 2. An item must be announced (`output_item.added`) before any delta that
 *    refers to it, and its `output_index` is its position in the completed
 *    `output` array — not a per-kind slot.
 * 3. Item ids are client-side thread identities, not positions in one response.
 *    Positional ids (`msg_0`) make every tool round reuse the previous round's
 *    ids, and the client then shows later output as an edit to an earlier card.
 *
 * @module src/responses.js
 */

/**
 * Translate a Responses request body into the chat call the adapter takes.
 *
 * @param {object} body
 * @returns {{ model: string, messages: object[], maxTokens?: number, temperature?: number }}
 */
export function toResponsesBody(body) {
  const messages = []
  const instructions = typeof body?.instructions === 'string' ? body.instructions.trim() : ''
  if (instructions !== '') messages.push({ role: 'system', content: [{ type: 'text', text: instructions }] })

  const input = body?.input
  if (typeof input === 'string') {
    if (input !== '') messages.push({ role: 'user', content: [{ type: 'text', text: input }] })
  } else if (Array.isArray(input)) {
    for (const turn of input) messages.push(...turnOf(turn))
  }

  const maxTokens = Number.isFinite(body?.max_output_tokens) && body.max_output_tokens > 0
    ? Math.floor(body.max_output_tokens)
    : undefined
  const temperature = Number.isFinite(body?.temperature) ? body.temperature : undefined

  return {
    model: typeof body?.model === 'string' ? body.model : '',
    messages,
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(temperature === undefined ? {} : { temperature }),
  }
}

/** One input entry as zero or more chat messages. */
function turnOf(turn) {
  if (turn === null || typeof turn !== 'object') return []

  // A tool call the caller already made, and the result it got back.
  if (turn.type === 'function_call') {
    return [{
      role: 'assistant',
      content: [{
        type: 'tool-call',
        id: String(turn.call_id ?? turn.id ?? ''),
        name: String(turn.name ?? ''),
        arguments: typeof turn.arguments === 'string' ? turn.arguments : JSON.stringify(turn.arguments ?? {}),
      }],
    }]
  }
  if (turn.type === 'function_call_output') {
    const callId = String(turn.call_id ?? '')
    if (callId === '') return []
    return [{ role: 'tool', toolCallId: callId, content: [{ type: 'text', text: textOfOutput(turn.output) }] }]
  }

  const role = turn.role === 'assistant' || turn.role === 'system' || turn.role === 'developer'
    ? (turn.role === 'developer' ? 'system' : turn.role)
    : 'user'
  const content = contentOf(turn.content)
  return content.length === 0 ? [] : [{ role, content }]
}

/** Text and images of one content value, in either shape the caller may send. */
function contentOf(content) {
  if (typeof content === 'string') return content === '' ? [] : [{ type: 'text', text: content }]
  if (!Array.isArray(content)) return []
  const parts = []
  for (const part of content) {
    if (part === null || typeof part !== 'object') continue
    if ((part.type === 'input_text' || part.type === 'text' || part.type === 'output_text')
      && typeof part.text === 'string' && part.text !== '') {
      parts.push({ type: 'text', text: part.text })
    } else if (part.type === 'input_image') {
      const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url
      if (typeof url === 'string' && url !== '') parts.push({ type: 'image', url })
    }
  }
  return parts
}

/** A function result arrives as a string, or as parts. */
function textOfOutput(output) {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    const text = output
      .map(part => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
    return text
  }
  return output === undefined || output === null ? '' : JSON.stringify(output)
}

/**
 * A live Responses event stream.
 *
 * Stateful on purpose: the client reads this while the upstream is still
 * thinking, so frames have to leave as chunks arrive. A one-shot builder would
 * make the caller stare at nothing until the whole turn finished.
 *
 * The `sequence_number` counter lives here and nowhere else, so every frame —
 * including the failure frames — takes the next number and the contract holds.
 *
 * @param {{ model?: string, id?: string, created?: number }} meta
 */
export class ResponsesEmitter {
  constructor(meta) {
    this.id = typeof meta?.id === 'string' && meta.id !== '' ? meta.id : 'resp-1'
    this.model = typeof meta?.model === 'string' ? meta.model : ''
    this.created = Number.isFinite(meta?.created) ? meta.created : Math.floor(Date.now() / 1000)
    this.sequence = 0
    this.nextOutputIndex = 0
    /** Announcements by kind, each with the index it was given. */
    this.rows = new Map()
    /** Announcement order, so the completed output replays it. */
    this.order = []
    this.text = ''
    this.reasoning = ''
    this.calls = []
    this.usage = undefined
    this.finished = false
    this.suffix = this.id.startsWith('resp-') ? this.id.slice('resp-'.length) : this.id
  }

  /** The response envelope at the moment a frame reports it. */
  shape(over = {}) {
    return {
      id: this.id, object: 'response', created_at: this.created,
      model: this.model, status: 'in_progress', output: [], ...over,
    }
  }

  /** One frame, with its sequence number stamped. */
  frame(type, payload) {
    return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload, sequence_number: this.sequence++ })}\n\n`
  }

  /** The item id for the item announced most recently. */
  itemId(kind) {
    return `${kind}_${this.suffix}_${this.nextOutputIndex - 1}`
  }

  /** Open the stream. */
  start() {
    return this.frame('response.created', { response: this.shape() })
  }

  announceMessage() {
    if (this.rows.has('message')) return ''
    const index = this.nextOutputIndex++
    const item = { id: this.itemId('msg'), type: 'message', status: 'in_progress', role: 'assistant', content: [] }
    this.rows.set('message', { index, item })
    this.order.push('message')
    return this.frame('response.output_item.added', { output_index: index, item })
      + this.frame('response.content_part.added', {
        item_id: item.id, output_index: index, content_index: 0,
        part: { type: 'output_text', text: '', annotations: [] },
      })
  }

  announceReasoning() {
    if (this.rows.has('reasoning')) return ''
    const index = this.nextOutputIndex++
    const item = { id: this.itemId('rs'), type: 'reasoning', summary: [] }
    this.rows.set('reasoning', { index, item })
    this.order.push('reasoning')
    return this.frame('response.output_item.added', { output_index: index, item })
      + this.frame('response.reasoning_summary_part.added', {
        item_id: item.id, output_index: index, summary_index: 0,
        part: { type: 'summary_text', text: '' },
      })
  }

  announceCall(call) {
    const key = `call:${call.id}:${this.calls.length}`
    const index = this.nextOutputIndex++
    const item = { id: this.itemId('fc'), type: 'function_call', status: 'in_progress', call_id: call.id, name: call.name, arguments: '' }
    this.rows.set(key, { index, item })
    this.order.push(key)
    return this.frame('response.output_item.added', { output_index: index, item })
  }

  /**
   * Feed one adapter chunk; returns the frames it produced.
   *
   * Empty string means this chunk needed no frame (an unknown chunk type), which
   * is normal traffic rather than a fault.
   */
  push(chunk) {
    if (chunk === null || typeof chunk !== 'object') return ''
    if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string' && chunk.text !== '') {
      this.reasoning += chunk.text
      const opened = this.announceReasoning()
      const row = this.rows.get('reasoning')
      return opened + this.frame('response.reasoning_summary_text.delta', {
        item_id: row.item.id, output_index: row.index, summary_index: 0, delta: chunk.text,
      })
    }
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text !== '') {
      this.text += chunk.text
      const opened = this.announceMessage()
      const row = this.rows.get('message')
      return opened + this.frame('response.output_text.delta', {
        item_id: row.item.id, output_index: row.index, content_index: 0, delta: chunk.text,
      })
    }
    if (chunk.type === 'tool-call' && typeof chunk.name === 'string') {
      const call = {
        id: String(chunk.id ?? ''),
        name: chunk.name,
        arguments: typeof chunk.arguments === 'string' ? chunk.arguments : '{}',
      }
      this.calls.push(call)
      const opened = this.announceCall(call)
      const row = this.rows.get(this.order[this.order.length - 1])
      const delta = call.arguments === ''
        ? ''
        : this.frame('response.function_call_arguments.delta', {
          item_id: row.item.id, output_index: row.index, delta: call.arguments,
        })
      return opened + delta
    }
    if (chunk.type === 'usage') this.usage = chunk.usage
    return ''
  }

  /**
   * Close every announced item and report the result.
   *
   * Called once. A second call returns an empty string so a caller that both
   * finishes normally and runs a cleanup path cannot double-report a response.
   */
  finish() {
    if (this.finished) return ''
    this.finished = true
    const out = []
    const output = []
    let callPosition = 0
    for (const entry of this.order) {
      if (entry === 'message') {
        const row = this.rows.get('message')
        const item = {
          ...row.item,
          status: 'completed',
          // Text alongside tool calls is progress narration; terminal text is
          // what the client shows before its completion footer.
          phase: this.calls.length > 0 ? 'commentary' : 'final_answer',
          content: [{ type: 'output_text', text: this.text, annotations: [] }],
        }
        output.push(item)
        out.push(this.frame('response.output_text.done', { item_id: item.id, output_index: row.index, content_index: 0, text: this.text }))
        out.push(this.frame('response.content_part.done', { item_id: item.id, output_index: row.index, content_index: 0, part: item.content[0] }))
        out.push(this.frame('response.output_item.done', { output_index: row.index, item }))
        continue
      }
      if (entry === 'reasoning') {
        const row = this.rows.get('reasoning')
        const item = { ...row.item, summary: [{ type: 'summary_text', text: this.reasoning }] }
        output.push(item)
        const payload = { item_id: item.id, output_index: row.index, summary_index: 0 }
        out.push(this.frame('response.reasoning_summary_text.done', { ...payload, text: this.reasoning }))
        out.push(this.frame('response.reasoning_summary_part.done', { ...payload, part: item.summary[0] }))
        out.push(this.frame('response.output_item.done', { output_index: row.index, item }))
        continue
      }
      const call = this.calls[callPosition++]
      if (call === undefined) continue
      const row = this.rows.get(entry)
      const item = { ...row.item, status: 'completed', name: call.name, arguments: call.arguments }
      output.push(item)
      out.push(this.frame('response.function_call_arguments.done', {
        item_id: item.id, output_index: row.index, name: call.name, arguments: call.arguments,
      }))
      out.push(this.frame('response.output_item.done', { output_index: row.index, item }))
    }
    out.push(this.frame('response.completed', {
      response: this.shape({
        status: 'completed',
        output,
        ...(this.usage === undefined ? {} : { usage: usageOf(this.usage) }),
      }),
    }))
    return out.join('')
  }

  /** Report the turn as failed, closing the stream. */
  fail(failure) {
    if (this.finished) return ''
    this.finished = true
    return this.frame('response.failed', {
      response: this.shape({
        status: 'failed',
        error: {
          code: String(failure?.code ?? 'SERVER'),
          message: String(failure?.message ?? 'upstream error'),
        },
      }),
    })
  }
}

/**
 * The whole turn as one string, for callers that already have every chunk.
 *
 * Thin wrapper over the emitter so the one-shot and live paths cannot drift.
 */
export function readResponsesSse(chunks, meta) {
  const emitter = new ResponsesEmitter(meta)
  let out = emitter.start()
  if (meta?.failure !== undefined) return out + emitter.fail(meta.failure)
  for (const chunk of Array.isArray(chunks) ? chunks : []) out += emitter.push(chunk)
  return out + emitter.finish()
}

export function responsesJson(chunks, meta) {
  const id = typeof meta?.id === 'string' && meta.id !== '' ? meta.id : 'resp-1'
  const model = typeof meta?.model === 'string' ? meta.model : ''
  const created = Number.isFinite(meta?.created) ? meta.created : Math.floor(Date.now() / 1000)
  const shape = over => ({ id, object: 'response', created_at: created, model, status: 'completed', output: [], ...over })

  if (meta?.failure !== undefined) {
    return shape({
      status: 'failed',
      error: { code: String(meta.failure.code ?? 'SERVER'), message: String(meta.failure.message ?? 'upstream error') },
    })
  }

  // One pass to assemble, so the JSON body and the streamed result agree.
  let text = ''
  let reasoning = ''
  let usage
  const calls = []
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    if (chunk === null || typeof chunk !== 'object') continue
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
    else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') reasoning += chunk.text
    else if (chunk.type === 'tool-call' && typeof chunk.name === 'string') {
      calls.push({ id: String(chunk.id ?? ''), name: chunk.name, arguments: typeof chunk.arguments === 'string' ? chunk.arguments : '{}' })
    } else if (chunk.type === 'usage') usage = chunk.usage
  }

  const suffix = id.startsWith('resp-') ? id.slice('resp-'.length) : id
  const output = []
  if (reasoning !== '') {
    output.push({ id: `rs_${suffix}_${output.length}`, type: 'reasoning', summary: [{ type: 'summary_text', text: reasoning }] })
  }
  if (text !== '') {
    output.push({
      id: `msg_${suffix}_${output.length}`, type: 'message', status: 'completed', role: 'assistant',
      phase: calls.length > 0 ? 'commentary' : 'final_answer',
      content: [{ type: 'output_text', text, annotations: [] }],
    })
  }
  for (const call of calls) {
    output.push({
      id: `fc_${suffix}_${output.length}`, type: 'function_call', status: 'completed',
      call_id: call.id, name: call.name, arguments: call.arguments,
    })
  }

  return shape({ output, ...(usage === undefined ? {} : { usage: usageOf(usage) }) })
}

/** Counts in the spelling this shape uses. */
function usageOf(usage) {
  return {
    input_tokens: Number.isFinite(usage?.inputTokens) ? usage.inputTokens : 0,
    output_tokens: Number.isFinite(usage?.outputTokens) ? usage.outputTokens : 0,
    total_tokens: (Number.isFinite(usage?.inputTokens) ? usage.inputTokens : 0)
      + (Number.isFinite(usage?.outputTokens) ? usage.outputTokens : 0),
  }
}
