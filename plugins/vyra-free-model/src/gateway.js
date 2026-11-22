/**
 * A local OpenAI-compatible port.
 *
 * Other tools on this machine — an editor, a CLI agent — speak the OpenAI shape
 * and cannot call a harness adapter. This exposes the same models on a loopback
 * port so they can borrow them without a second plugin.
 *
 * Deliberate limits:
 *
 * - Loopback only. This is not a LAN share; binding `0.0.0.0` would turn the
 *   user's free quota into something anyone on the network can spend.
 * - A bearer key, generated locally. Without it, any page the user visits could
 *   POST to the port, because a loopback listener is still reachable from a
 *   browser.
 * - A client that hangs up aborts the upstream call. Otherwise a closed tab keeps
 *   burning the quota in the background.
 *
 * @module src/gateway.js
 */

import http from 'node:http'

const HOST = '127.0.0.1'
const BODY_LIMIT_BYTES = 8 * 1024 * 1024

/**
 * Bind the port and start answering.
 *
 * @param {object} options
 * @param {number} options.port - 0 lets the system choose
 * @param {string} options.key - the bearer token clients must present
 * @param {Array<object>} options.models - catalog rows to advertise
 * @param {(request: object, onChunk: (chunk: object) => void, signal: AbortSignal) => Promise<{ usage?: object }>} options.complete
 * @param {(message: string) => void} [options.log]
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startGateway({ host = HOST, port, key, models, complete, log = () => {} }) {
  const server = http.createServer((req, res) => {
    void handle(req, res, { key, models, complete, log })
  })

  // A socket error on a half-closed connection is normal traffic, not a fault:
  // without a listener it would surface as an uncaught exception.
  server.on('clientError', (_error, socket) => {
    try { socket.destroy() } catch { /* already gone */ }
  })

  await new Promise((resolve, reject) => {
    const onError = error => {
      server.removeListener('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })

  const address = server.address()
  const boundPort = typeof address === 'object' && address !== null ? address.port : port

  return {
    port: boundPort,
    close: () => new Promise(resolve => {
      server.closeAllConnections?.()
      server.close(() => resolve())
    }),
  }
}

/** One request. */
async function handle(req, res, { key, models, complete, log }) {
  const url = new URL(req.url ?? '/', `http://${HOST}`)
  const send = (status, payload) => {
    const body = JSON.stringify(payload)
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(body)
  }

  if (!authorized(req, key)) {
    return send(401, { error: { type: 'authentication_error', message: 'missing or invalid api key' } })
  }

  if (url.pathname === '/v1/models') {
    if (req.method !== 'GET') return send(405, { error: { message: 'method not allowed' } })
    return send(200, {
      object: 'list',
      data: (models ?? []).map(model => ({ id: model.id, object: 'model', owned_by: 'vyra-free-model' })),
    })
  }

  if (url.pathname === '/v1/chat/completions') {
    if (req.method !== 'POST') return send(405, { error: { message: 'method not allowed' } })
    return chatCompletions(req, res, { complete, log })
  }

  return send(404, { error: { message: 'not found' } })
}

/** Does this request carry the port's key? */
function authorized(req, key) {
  if (typeof key !== 'string' || key === '') return false
  const header = req.headers.authorization
  if (typeof header !== 'string') return false
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (match === null) return false
  return timingSafeEqual(match[1], key)
}

/** Compare without leaking length or prefix through timing. */
function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index]
  return diff === 0
}

/** Read a JSON body, refusing anything oversized. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', chunk => {
      if (settled) return
      size += chunk.length
      if (size > BODY_LIMIT_BYTES) {
        fail(Object.assign(new Error('request body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') return resolve({})
      try { resolve(JSON.parse(text)) } catch { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })) }
    })
    req.on('error', fail)
  })
}

/** One chat completion, streamed or whole. */
async function chatCompletions(req, res, { complete, log }) {
  let body
  try {
    body = await readBody(req)
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 400
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: { message: String(error?.message ?? 'bad request') } }))
    return
  }

  const model = typeof body?.model === 'string' && body.model !== '' ? body.model : ''
  if (model === '') {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: { message: 'model is required' } }))
    return
  }

  const controller = new AbortController()
  // A closed tab must stop the upstream turn, or the quota keeps burning in the
  // background with nobody reading the answer.
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  const id = `chatcmpl-${Date.now().toString(36)}`
  const created = Math.floor(Date.now() / 1000)
  const streaming = body?.stream === true

  if (streaming) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    })
    const write = payload => {
      if (res.writableEnded) return
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }
    write({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })
    let finishReason = 'stop'
    try {
      const result = await complete(
        { model, messages: body?.messages ?? [], tools: body?.tools, maxTokens: body?.max_tokens, temperature: body?.temperature, signal: controller.signal },
        chunk => {
          if (chunk?.text) {
            write({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { content: chunk.text }, finish_reason: null }] })
          }
          if (chunk?.reasoning) {
            write({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { reasoning: chunk.reasoning }, finish_reason: null }] })
          }
          if (Array.isArray(chunk?.toolCalls) && chunk.toolCalls.length > 0) {
            write({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { tool_calls: chunk.toolCalls }, finish_reason: null }] })
            finishReason = 'tool_calls'
          }
        },
        controller.signal,
      )
      if (result?.finish === 'max-tokens') finishReason = 'length'
      write({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })
      if (result?.usage) {
        write({
          id, object: 'chat.completion.chunk', created, model, choices: [],
          usage: {
            prompt_tokens: result.usage.inputTokens ?? 0,
            completion_tokens: result.usage.outputTokens ?? 0,
            total_tokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          },
        })
      }
      res.write('data: [DONE]\n\n')
      res.end()
    } catch (error) {
      if (controller.signal.aborted) {
        // The client left; there is nobody to tell.
        try { res.end() } catch { /* already closed */ }
        return
      }
      log(`vyra-free-model: forward stream failed (${error?.message ?? error})`)
      write({ error: { message: String(error?.message ?? 'upstream error') } })
      res.write('data: [DONE]\n\n')
      res.end()
    }
    return
  }

  try {
    let text = ''
    let reasoning = ''
    const toolCalls = []
    const result = await complete(
      { model, messages: body?.messages ?? [], tools: body?.tools, maxTokens: body?.max_tokens, temperature: body?.temperature, signal: controller.signal },
      chunk => {
        if (chunk?.text) text += chunk.text
        if (chunk?.reasoning) reasoning += chunk.reasoning
        if (Array.isArray(chunk?.toolCalls)) toolCalls.push(...chunk.toolCalls)
      },
      controller.signal,
    )
    const message = { role: 'assistant', content: text }
    if (toolCalls.length > 0) message.tool_calls = toolCalls
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify({
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [{
        index: 0,
        message,
        finish_reason: result?.finish === 'max-tokens' ? 'length' : toolCalls.length > 0 ? 'tool_calls' : 'stop',
      }],
      ...result?.usage === undefined ? {} : {
        usage: {
          prompt_tokens: result.usage.inputTokens ?? 0,
          completion_tokens: result.usage.outputTokens ?? 0,
          total_tokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
        },
      },
    }))
  } catch (error) {
    if (controller.signal.aborted) return
    log(`vyra-free-model: forward completion failed (${error?.message ?? error})`)
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: { message: String(error?.message ?? 'upstream error') } }))
  }
}
