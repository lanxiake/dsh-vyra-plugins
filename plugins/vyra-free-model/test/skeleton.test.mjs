import test from 'node:test'
import assert from 'node:assert/strict'
import { KiloAdapter, ROUTE } from '../src/adapter.js'

const entry = { id: 'kilo-auto/free', name: '自动选择', contextWindow: 256000, maxOutput: 32768, vision: false }

test('adapter advertises the single vyra-free route', async () => {
  const adapter = new KiloAdapter({ state: () => ({ catalog: [entry], settings: {} }) })
  assert.equal(adapter.providerInfo(ROUTE).name, '免费模型')
  const models = await adapter.listModels(ROUTE)
  assert.deepEqual(models.map(m => m.id), ['kilo-auto/free'])
})

test('retry policy never retries the quota wall', () => {
  const adapter = new KiloAdapter({ state: () => ({ catalog: [], settings: {} }) })
  const policy = adapter.providerRetryPolicy()
  assert.equal(policy.maxRetries, 1)
  assert.deepEqual([...policy.retryableCodes].sort(), ['SERVER', 'TIMEOUT', 'TRANSPORT'])
  assert.ok(!policy.retryableCodes.includes('RATE_LIMIT'))
})

test('a disabled plugin advertises no models so its picker group disappears', async () => {
  const adapter = new KiloAdapter({ state: () => ({ catalog: [entry], settings: { enabled: false } }) })
  assert.deepEqual(await adapter.listModels(ROUTE), [])
})

test('the picker group is named 免费模型 and nothing else', () => {
  const adapter = new KiloAdapter({ state: () => ({ catalog: [entry], settings: {} }) })
  assert.deepEqual(adapter.providerInfo(ROUTE), { id: ROUTE, name: '免费模型' })
})
