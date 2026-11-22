import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalog, classifyStatus, parseSseText, postKiloStreamed } from '../src/kilo.js'

test('buildCatalog keeps only free models and reads real capabilities', () => {
  const raw = [
    { id: 'a:free', isFree: true, name: 'A', context_length: 1048576,
      top_provider: { max_completion_tokens: 262144 },
      architecture: { input_modalities: ['text', 'image'] } },
    { id: 'b', isFree: false, name: 'B' },
  ]
  const out = buildCatalog(raw)
  assert.equal(out.length, 1)
  assert.deepEqual(out[0], {
    id: 'a:free', name: 'A', contextWindow: 1048576, maxOutput: 262144, vision: true,
    efforts: undefined, defaultEffort: undefined,
  })
})

test('buildCatalog falls back when max_completion_tokens is null', () => {
  const out = buildCatalog([{ id: 'x:free', isFree: true, name: 'X', context_length: 200000,
    top_provider: { max_completion_tokens: null }, architecture: { input_modalities: ['text'] } }])
  assert.equal(out[0].maxOutput, 50000)
})

test('buildCatalog caps the fallback at 65536 and defaults context to 131072', () => {
  const big = buildCatalog([{ id: 'y:free', isFree: true, name: 'Y', context_length: 1048576,
    top_provider: { max_completion_tokens: null }, architecture: { input_modalities: ['text'] } }])
  assert.equal(big[0].maxOutput, 65536)
  const none = buildCatalog([{ id: 'z:free', isFree: true, name: 'Z' }])
  assert.equal(none[0].contextWindow, 131072)
  assert.equal(none[0].vision, false)
})

test('kilo-auto/free leads the list and is labelled as the recommended auto pick', () => {
  const out = buildCatalog([
    { id: 'a:free', isFree: true, name: 'A' },
    { id: 'kilo-auto/free', isFree: true, name: 'Auto Free' },
  ])
  assert.equal(out[0].id, 'kilo-auto/free')
  assert.equal(out[0].name, '自动选择（推荐）')
  assert.equal(out[1].id, 'a:free')
})

test('without kilo-auto/free the upstream order is preserved', () => {
  const out = buildCatalog([
    { id: 'b:free', isFree: true, name: 'B' },
    { id: 'a:free', isFree: true, name: 'A' },
  ])
  assert.deepEqual(out.map(m => m.id), ['b:free', 'a:free'])
})

test('429 with a Chinese message and no retry-after is a rate limit, not a transport fault', () => {
  const err = classifyStatus(429, '{"error":{"message":"免费额度已用完，请稍后再试"}}', undefined)
  assert.equal(err.code, 'RATE_LIMIT')
})

test('401 is a credential problem', () => {
  assert.equal(classifyStatus(401, '{}', undefined).code, 'INVALID_CREDENTIAL')
})

test('500 is retryable, 400 is not', () => {
  assert.equal(classifyStatus(500, '{}', undefined).code, 'SERVER')
  assert.equal(classifyStatus(400, '{}', undefined).code, 'CLIENT_ERROR')
})

test('an exhausted balance reads as quota exhaustion', () => {
  assert.equal(classifyStatus(402, '{"error":{"message":"insufficient credit"}}', undefined).code, 'QUOTA_EXHAUSTED')
})

test('an empty body mention in the message stays a server fault', () => {
  // 只有 200 + 无内容才是 EMPTY_RESPONSE；带状态码的拒绝不能冒充它
  assert.equal(classifyStatus(503, 'upstream unavailable', undefined).code, 'SERVER')
})

test('parseSseText skips comments, joins multi-line data, stops at [DONE]', () => {
  const text = [
    ': KILO PROCESSING',
    '',
    'data: {"a":1}',
    '',
    'data: {"b":',
    'data: 2}',
    '',
    'data: [DONE]',
    '',
  ].join('\n')
  assert.deepEqual(parseSseText(text), ['{"a":1}', '{"b":\n2}'])
})

test('parseSseText tolerates CRLF and a trailing partial frame', () => {
  assert.deepEqual(parseSseText('data: {"a":1}\r\n\r\ndata: {"b":2'), ['{"a":1}'])
})

test('a JSON document served as text/event-stream is still delivered', async () => {
  const body = JSON.stringify({ choices: [{ delta: { content: 'hi' }, index: 0 }] })
  const seen = []
  await postKiloStreamed({
    body: { model: 'x' },
    fetchImpl: async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    onPayload: p => seen.push(p),
  })
  assert.equal(seen.length, 1)
  assert.equal(JSON.parse(seen[0]).choices[0].delta.content, 'hi')
})

test('a Chinese character split across two chunks is not mangled', async () => {
  const payload = 'data: {"choices":[{"delta":{"content":"你好"},"index":0}]}\n\n'
  const bytes = new TextEncoder().encode(payload)
  // 切在多字节字符中间：定位「你」的 UTF-8 首字节后只取首字节
  const cut = payload.indexOf('你') + 1
  const seen = []
  await postKiloStreamed({
    body: { model: 'x' },
    fetchImpl: async () => new Response(new ReadableStream({
      start(c) { c.enqueue(bytes.slice(0, cut)); c.enqueue(bytes.slice(cut)); c.close() },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    onPayload: p => seen.push(p),
  })
  assert.equal(JSON.parse(seen[0]).choices[0].delta.content, '你好')
})

test('a non-2xx answer throws a classified error carrying its status', async () => {
  await assert.rejects(
    postKiloStreamed({
      body: { model: 'x' },
      fetchImpl: async () => new Response('{"error":{"message":"nope"}}', { status: 429 }),
      onPayload: () => {},
    }),
    err => err.code === 'RATE_LIMIT' && err.status === 429,
  )
})

test('several SSE events are each delivered exactly once', async () => {
  const sse = [
    'data: {"n":1}', '',
    'data: {"n":2}', '',
    'data: [DONE]', '',
  ].join('\n')
  const seen = []
  await postKiloStreamed({
    body: { model: 'x' },
    fetchImpl: async () => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    onPayload: p => seen.push(JSON.parse(p).n),
  })
  assert.deepEqual(seen, [1, 2])
})
