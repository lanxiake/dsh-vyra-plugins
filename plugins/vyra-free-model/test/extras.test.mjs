import test from 'node:test'
import assert from 'node:assert/strict'
import { KiloAdapter, ROUTE } from '../src/adapter.js'

const kilo = { id: 'kilo-auto/free', name: '自动选择（推荐）', contextWindow: 256000, maxOutput: 32768, vision: false }
const extra = {
  id: 'buddy:buddy/hy4flash', lane: 'buddy', name: 'CodeBuddy · Hy4 flash',
  contextWindow: 1_000_000, maxOutput: 64_000, vision: true, source: 'buddy',
}

function adapter(overrides = {}) {
  return new KiloAdapter({
    state: () => ({ catalog: [kilo, { id: 'a:free', name: 'A', contextWindow: 1000, maxOutput: 100, vision: false }], settings: {} }),
    extraCatalog: () => [extra],
    autoModel: () => ({ id: 'baidu/x:free', name: 'Baidu: ERNIE', contextWindow: 1_000_000, maxOutput: 32_000, vision: true }),
    autoLabel: () => '自动选择 · ERNIE',
    ...overrides,
  })
}

test('extra lanes join the same picker group', async () => {
  const models = await adapter().listModels(ROUTE)
  assert.deepEqual(models.map(model => model.id), ['kilo-auto/free', 'a:free', extra.id])
})

test('a model the probe proved dead is not advertised', async () => {
  const models = await adapter({ probes: () => ({ 'a:free': { state: 'unavailable' } }) }).listModels(ROUTE)
  assert.equal(models.some(model => model.id === 'a:free'), false)
  assert.equal(models.some(model => model.id === 'kilo-auto/free'), true, 'the auto row is always offered')
})

test('the automatic row names the model that actually answered', async () => {
  const models = await adapter().listModels(ROUTE)
  assert.equal(models[0].name, '自动选择 · ERNIE')
})

test('resolving the automatic row uses the routed model window and modality', async () => {
  const resolved = await adapter().resolveModel(ROUTE, 'kilo-auto/free')
  assert.match(resolved.name, /^自动选择 · ERNIE/)
  assert.equal(resolved.context.contextWindow, 1_000_000)
  assert.deepEqual(resolved.inputModalities, ['text', 'image'])
})

test('an extra row carries its own window and modality', async () => {
  const resolved = await adapter().resolveModel(ROUTE, extra.id)
  assert.equal(resolved.context.contextWindow, 1_000_000)
  assert.deepEqual(resolved.inputModalities, ['text', 'image'])
})

test('a turn on an extra row is handed to the extra transport', async () => {
  let seen
  const a = adapter({
    extraStream: async function* (entry) { seen = entry.id; yield { type: 'finish', reason: { kind: 'stop' } } },
  })
  const chunks = []
  for await (const chunk of a.stream({ model: extra.id, messages: [] })) chunks.push(chunk)
  assert.equal(seen, extra.id)
  assert.equal(chunks[0].type, 'finish')
})
test('the picker label states the window and modality in one line', async () => {
  const { formatWindow, shortModelName } = await import('../index.js')
  assert.equal(formatWindow(1_024_000), '1M')
  assert.equal(formatWindow(262_144), '256K')
  assert.equal(shortModelName('Baidu: ERNIE-5.5-Flash-Preview (free)'), 'ERNIE-5.5-Flash-Preview')
})

test('the automatic lane switches to a working model instead of failing', async () => {
  let calls = 0
  const fetchImpl = async (url, init) => {
    calls += 1
    const requested = JSON.parse(init.body).model
    if (requested === 'kilo-auto/free') {
      return new Response('{"error":{"message":"quota window"}}', { status: 429 })
    }
    return new Response('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
  }
  const lane = new KiloAdapter({
    state: () => ({
      catalog: [
        { id: 'kilo-auto/free', name: '自动选择', contextWindow: 256000, maxOutput: 32768, vision: false },
        { id: 'b:free', name: 'B', contextWindow: 1000, maxOutput: 100, vision: false },
      ],
      settings: {},
    }),
    autoSwitch: () => true,
    fallbackModels: () => ['b:free'],
    fetchImpl,
  })
  const chunks = []
  for await (const chunk of lane.stream({ model: 'kilo-auto/free', messages: [], maxTokens: 4 })) chunks.push(chunk)
  assert.equal(calls, 2)
  assert.ok(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text === 'ok'))
  assert.equal(chunks.filter(chunk => chunk.type === 'finish')[0].reason.kind, 'stop')
})

test('with the switch off the refusal is reported as before', async () => {
  const fetchImpl = async () => new Response('{"error":{"message":"quota window"}}', { status: 429 })
  const lane = new KiloAdapter({
    state: () => ({
      catalog: [{ id: 'kilo-auto/free', name: '自动选择', contextWindow: 256000, maxOutput: 32768, vision: false }],
      settings: {},
    }),
    autoSwitch: () => false,
    fallbackModels: () => ['b:free'],
    fetchImpl,
  })
  const chunks = []
  for await (const chunk of lane.stream({ model: 'kilo-auto/free', messages: [] })) chunks.push(chunk)
  assert.equal(chunks[0].type, 'finish')
  assert.equal(chunks[0].reason.kind, 'error')
})

test('the adapter declares image pricing so compaction can call it', () => {
  const lane = adapter()
  assert.equal(typeof lane.imageRequestPricing, 'function')
  assert.equal(lane.imageRequestPricing('vyra-free', 'kilo-auto/free'), undefined)
})
