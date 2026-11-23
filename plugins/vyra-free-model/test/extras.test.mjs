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
