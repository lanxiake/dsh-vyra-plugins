import test from 'node:test'
import assert from 'node:assert/strict'
import { readChunks } from '../src/stream.js'
import { KiloAdapter, ROUTE } from '../src/adapter.js'

const collect = async payloads => {
  const out = []
  for await (const c of readChunks(payloads)) out.push(c)
  return out
}

const ends = chunks => chunks.filter(c => c.type === 'block-end' && c.block.type === 'tool-call')

test('tool call arguments split across deltas are accumulated per index', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"get_weather","arguments":"{\\"ci"}}]}}]}',
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ty\\":\\"北京\\"}"}}]}}]}',
    '{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}',
  ])
  const deltas = chunks.filter(c => c.type === 'tool-call-delta')
  assert.ok(deltas.length >= 2)
  const args = deltas.map(c => c.argumentsDelta).join('')
  assert.deepEqual(JSON.parse(args), { city: '北京' })
  const end = ends(chunks)[0]
  assert.equal(end.block.name, 'get_weather')
  assert.equal(end.block.id, 'c1')
})

test('parallel tool calls keep separate accumulators', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"a","arguments":"{\\"x\\":"}},{"index":1,"id":"c2","function":{"name":"b","arguments":"{\\"y\\":"}}]}}]}',
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}},{"index":1,"function":{"arguments":"2}"}}]}}]}',
  ])
  const byId = Object.fromEntries(ends(chunks).map(e => [e.block.id, e.block]))
  assert.deepEqual(JSON.parse(byId.c1.arguments), { x: 1 })
  assert.deepEqual(JSON.parse(byId.c2.arguments), { y: 2 })
})

test('the finish reason for tool calls is tool-calls', async () => {
  const chunks = await collect(['{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}'])
  assert.equal(chunks.find(c => c.type === 'finish').reason.kind, 'tool-calls')
})

test('unparseable tool arguments are repaired rather than thrown', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"a","arguments":"{\\"x\\":"}}]}}]}',
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":""}}]},"finish_reason":"tool_calls"}]}',
  ])
  const end = ends(chunks)[0]
  assert.equal(typeof end.block.arguments, 'string')
  assert.equal(end.block.arguments, '{"x":')
})

test('block indexes advance so parallel calls get distinct indices', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"a","arguments":"{}"}},{"index":1,"id":"c2","function":{"name":"b","arguments":"{}"}}]}}]}',
  ])
  const distinct = new Set(ends(chunks).map(e => e.index))
  assert.equal(distinct.size, ends(chunks).length)
})

test('a tool block is announced before its first delta', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"a","arguments":"{}"}}]}}]}',
  ])
  const start = chunks.findIndex(c => c.type === 'block-start' && c.blockType === 'tool-call')
  const delta = chunks.findIndex(c => c.type === 'tool-call-delta')
  assert.ok(start >= 0)
  assert.ok(delta > start)
})

test('text, reasoning and tool calls all get their own index', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"reasoning":"想"}}]}',
    '{"choices":[{"index":0,"delta":{"content":"说"}}]}',
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"a","arguments":"{}"}}]}}]}',
  ])
  const indexes = chunks.filter(c => c.type === 'block-start').map(c => c.index)
  assert.equal(new Set(indexes).size, 3)
})

test('a tool call without an index still gets its own block', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"id":"c1","function":{"name":"a","arguments":"{\\"x\\":1}"}}]}}]}',
  ])
  const end = ends(chunks)[0]
  assert.equal(end.block.id, 'c1')
  assert.deepEqual(JSON.parse(end.block.arguments), { x: 1 })
})

test('imageRequestTarget asks for a bounded projection', () => {
  const entry = { id: 'kilo-auto/free', name: 'A', contextWindow: 1000, maxOutput: 100, vision: true }
  const adapter = new KiloAdapter({ state: () => ({ catalog: [entry], settings: {} }) })
  const target = adapter.imageRequestTarget(ROUTE, 'kilo-auto/free', { width: 4000, height: 3000, bytes: 9e6 })
  assert.ok(target.width <= 4000)
  assert.ok(target.width * target.height <= 640000)
  assert.ok(target.maxBytes > 0)
})

test('a small image passes through at its own size', () => {
  const entry = { id: 'k', name: 'K', contextWindow: 1, maxOutput: 1, vision: true }
  const adapter = new KiloAdapter({ state: () => ({ catalog: [entry], settings: {} }) })
  const target = adapter.imageRequestTarget(ROUTE, 'k', { width: 800, height: 600 })
  assert.equal(target.width, 800)
  assert.equal(target.height, 600)
})

test('an image reaches the wire as a data URL part through the resolver', async () => {
  const entry = { id: 'kilo-auto/free', name: 'A', contextWindow: 1000, maxOutput: 1000, vision: true }
  let sent
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    resolveImage: () => 'data:image/png;base64,ZZZ',
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body)
      return new Response('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n', {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  for await (const _c of adapter.stream({
    provider: ROUTE,
    model: 'kilo-auto/free',
    messages: [{ role: 'user', content: [
      { type: 'text', text: '看这张' },
      { type: 'image', attachment: { attachmentId: 'a1' } },
    ] }],
  })) { /* drain */ }

  assert.equal(sent.messages[0].content[1].type, 'image_url')
  assert.equal(sent.messages[0].content[1].image_url.url, 'data:image/png;base64,ZZZ')
})
