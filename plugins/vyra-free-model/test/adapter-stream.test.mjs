import test from 'node:test'
import assert from 'node:assert/strict'
import { KiloAdapter, ROUTE } from '../src/adapter.js'

const entry = { id: 'kilo-auto/free', name: '自动选择', contextWindow: 256000, maxOutput: 32768, vision: false }

const sseOf = frames => frames.map(frame => `data: ${frame}\n\n`).join('')

test('stream() emits text deltas and a finish', async () => {
  const sse = sseOf([
    '{"choices":[{"index":0,"delta":{"content":"hello"}}]}',
    '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2}}',
    '[DONE]',
  ])
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    fetchImpl: async () => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  })
  const chunks = []
  for await (const chunk of adapter.stream({
    provider: ROUTE,
    model: 'kilo-auto/free',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  })) chunks.push(chunk)

  assert.equal(chunks.filter(c => c.type === 'text-delta').map(c => c.text).join(''), 'hello')
  assert.equal(chunks.filter(c => c.type === 'finish').length, 1)
  assert.equal(chunks.find(c => c.type === 'finish').reason.kind, 'stop')
})

test('the request body carries the shaped messages and the stream flag', async () => {
  let seen
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    fetchImpl: async (_url, init) => {
      seen = JSON.parse(init.body)
      return new Response(sseOf(['[DONE]']), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    },
  })
  for await (const _chunk of adapter.stream({
    provider: ROUTE,
    model: 'kilo-auto/free',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    maxTokens: 128,
    temperature: 0.3,
  })) { /* drain */ }

  assert.equal(seen.model, 'kilo-auto/free')
  assert.equal(seen.stream, true)
  assert.equal(seen.max_tokens, 128)
  assert.equal(seen.temperature, 0.3)
  assert.deepEqual(seen.messages, [{ role: 'user', content: 'hi' }])
})

test('an aborted signal ends the turn as aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    fetchImpl: async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }) },
  })
  const chunks = []
  for await (const chunk of adapter.stream({
    provider: ROUTE,
    model: 'kilo-auto/free',
    messages: [],
    signal: controller.signal,
  })) chunks.push(chunk)

  assert.equal(chunks.find(c => c.type === 'finish').reason.kind, 'aborted')
})

test('a refusal becomes an error finish carrying its code, not a throw', async () => {
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    fetchImpl: async () => new Response('{"error":{"message":"慢点"}}', { status: 429 }),
  })
  const chunks = []
  for await (const chunk of adapter.stream({
    provider: ROUTE,
    model: 'kilo-auto/free',
    messages: [],
  })) chunks.push(chunk)

  const finish = chunks.find(c => c.type === 'finish')
  assert.equal(finish.reason.kind, 'error')
  assert.equal(finish.reason.failure.code, 'RATE_LIMIT')
})

test('an unknown model falls back to a sane context instead of throwing', async () => {
  const adapter = new KiloAdapter({ state: () => ({ catalog: [], settings: {} }) })
  const info = await adapter.resolveModel(ROUTE, 'ghost')
  assert.equal(info.id, 'ghost')
  assert.equal(info.context.contextWindow, 131072)
})

test('the dispatch is bound to the snapshot prepareCall froze', async () => {
  const first = { id: 'kilo-auto/free', name: 'A', contextWindow: 1000, maxOutput: 100, vision: false }
  const second = { id: 'kilo-auto/free', name: 'B', contextWindow: 2000, maxOutput: 200, vision: false }
  let live = [first]
  const adapter = new KiloAdapter({
    state: () => ({ catalog: live, settings: {} }),
    fetchImpl: async () => new Response(sseOf(['[DONE]']), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  })
  const prepared = await adapter.prepareCall(ROUTE, 'kilo-auto/free')
  live = [second]
  const chunks = []
  for await (const chunk of prepared.stream({ provider: ROUTE, model: 'kilo-auto/free', messages: [] })) chunks.push(chunk)
  // The frozen row's output ceiling still bounds the request, not the new one's.
  assert.equal(prepared.model.defaultMaxTokens, 100)
  assert.ok(chunks.length > 0)
})
