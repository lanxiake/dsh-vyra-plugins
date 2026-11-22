/**
 * Project harness messages onto the OpenAI Chat wire.
 *
 * The chat wire is a flat role sequence, while a harness turn is a list of typed
 * blocks. Three block kinds need care and are the whole reason this module
 * exists: reasoning (never sent back), tool calls (become `tool_calls` on an
 * assistant turn), and tool results (a separate `role: 'tool'` message keyed by
 * the id they answer). An image rides along as a data URL part.
 *
 * @module src/messages.js
 */

/**
 * Convert one harness message list into chat messages.
 *
 * @param {readonly object[]} messages
 * @param {((block: object) => string | undefined) | undefined} resolveImage
 *   returns a data URL for an image block, or `undefined` when it cannot be read
 * @param {string[]} [warnings] collects `'image-dropped'` when a picture is lost
 * @returns {Array<object>}
 */
export function toChatMessages(messages, resolveImage, warnings) {
  const out = []
  for (const message of messages ?? []) {
    const blocks = Array.isArray(message?.content) ? message.content : []
    switch (message?.role) {
      case 'system':
      case 'developer': {
        const text = textOf(blocks)
        if (text !== '') out.push({ role: 'system', content: text })
        break
      }
      case 'user': {
        const parts = []
        for (const block of blocks) {
          if (block?.type === 'text' && typeof block.text === 'string' && block.text !== '') {
            parts.push({ type: 'text', text: block.text })
          } else if (block?.type === 'image') {
            const url = resolveImage?.(block)
            if (typeof url === 'string' && url !== '') parts.push({ type: 'image_url', image_url: { url } })
            else warnings?.push('image-dropped')
          }
        }
        if (parts.length === 0) break
        // A single text part is sent as a bare string: some upstreams treat an
        // array-of-parts as a multimodal request and slow down or refuse it.
        out.push({
          role: 'user',
          content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts,
        })
        break
      }
      case 'assistant': {
        const text = textOf(blocks)
        const calls = blocks.filter(block => block?.type === 'tool-call')
        if (text === '' && calls.length === 0) break
        const turn = { role: 'assistant' }
        // A tool-calling turn with no prose must not carry an empty string: the
        // wire reads that as a real (empty) answer and some gateways reject it.
        if (text !== '') turn.content = text
        if (calls.length > 0) {
          turn.tool_calls = calls.map(call => ({
            id: String(call.id ?? ''),
            type: 'function',
            function: {
              name: String(call.name ?? ''),
              arguments: typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? {}),
            },
          }))
        }
        out.push(turn)
        break
      }
      case 'tool': {
        const callId = String(message?.toolCallId ?? message?.source?.callId ?? '')
        if (callId === '') break
        const text = textOf(blocks)
        out.push({ role: 'tool', tool_call_id: callId, content: text === '' ? '(no output)' : text })
        break
      }
      default:
        break
    }
  }
  return out
}

/** Concatenate the text blocks of one turn. Reasoning blocks are not text. */
function textOf(blocks) {
  let text = ''
  for (const block of blocks ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') text += block.text
  }
  return text
}

/**
 * Shape harness tool schemas for the chat wire.
 *
 * A tool that declares no parameters still needs a valid object schema: the wire
 * validates the shape, and an absent `parameters` is rejected by some upstreams.
 */
export function toToolDefs(tools) {
  if (!Array.isArray(tools)) return []
  const out = []
  for (const tool of tools) {
    if (tool === null || typeof tool !== 'object') continue
    const name = typeof tool.name === 'string' ? tool.name : ''
    if (name === '') continue
    out.push({
      type: 'function',
      function: {
        name,
        description: typeof tool.description === 'string' ? tool.description : '',
        parameters: isObjectSchema(tool.parameters) ? tool.parameters : { type: 'object', properties: {} },
      },
    })
  }
  return out
}

function isObjectSchema(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Map the wire's usage block onto the harness's three counts.
 *
 * `reasoning_tokens` sits inside `completion_tokens` on this wire, so it is a
 * breakdown rather than an addition — keeping it separate is what lets the speed
 * figure exclude a long think.
 */
export function toUsage(usage) {
  return {
    inputTokens: count(usage?.prompt_tokens),
    outputTokens: count(usage?.completion_tokens),
    reasoningTokens: count(usage?.reasoning_tokens),
  }
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}
