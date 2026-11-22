import test from 'node:test'
import assert from 'node:assert/strict'
import { effortsFor, defaultEffortFor } from '../src/effort.js'
import { KiloAdapter, ROUTE } from '../src/adapter.js'

const E = { id: 'm', name: 'M', contextWindow: 1e5, maxOutput: 1e4, vision: false }

test('a declared effort table becomes a menu with capitalised names', () => {
  const menu = effortsFor({ ...E, efforts: ['none', 'low', 'high'] })
  assert.deepEqual(menu.map(m => m.id), ['none', 'low', 'high'])
  assert.equal(menu[1].name, 'Low')
  assert.equal(menu[2].name, 'High')
})

test('a single rung is not a menu', () => {
  assert.equal(effortsFor({ ...E, efforts: ['high'] }), undefined)
})

test('no declaration means no control at all', () => {
  assert.equal(effortsFor(E), undefined)
  assert.equal(effortsFor({ ...E, efforts: [] }), undefined)
})

test('the default effort falls back to the middle rung when undeclared', () => {
  assert.equal(defaultEffortFor({ ...E, efforts: ['low', 'high', 'max'] }), 'high')
  assert.equal(defaultEffortFor({ ...E, efforts: ['low', 'high', 'max'], defaultEffort: 'max' }), 'max')
  assert.equal(defaultEffortFor(E), undefined)
})

test('a declared default that is not in the menu is ignored', () => {
  assert.equal(defaultEffortFor({ ...E, efforts: ['low', 'high'], defaultEffort: 'max' }), 'high')
})

test('resolveModel declares a reasoning menu only where one exists', async () => {
  const withMenu = { ...E, id: 'a', efforts: ['low', 'high'] }
  const adapter = new KiloAdapter({ state: () => ({ catalog: [withMenu], settings: {} }) })
  const info = await adapter.resolveModel(ROUTE, 'a')
  assert.deepEqual(info.reasoning.efforts.map(e => e.id), ['low', 'high'])
  assert.equal(info.reasoning.defaultEffort, 'high')

  const withoutMenu = { ...E, id: 'b' }
  const other = new KiloAdapter({ state: () => ({ catalog: [withoutMenu], settings: {} }) })
  const plain = await other.resolveModel(ROUTE, 'b')
  assert.equal(plain.reasoning, undefined)
})

test('a declared rung rides the wire as reasoning_effort', async () => {
  const entry = { ...E, id: 'kilo-auto/free', efforts: ['none', 'low', 'high'] }
  let sent
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body)
      return new Response('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n', {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  for await (const _c of adapter.stream({
    provider: ROUTE, model: 'kilo-auto/free', messages: [], reasoningEffort: 'low',
  })) { /* drain */ }
  assert.equal(sent.reasoning_effort, 'low')
})

test('an undeclared rung is never sent, because the gateway rejects it', async () => {
  const entry = { ...E, id: 'kilo-auto/free', efforts: ['low', 'high'] }
  let sent
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body)
      return new Response('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n', {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  for await (const _c of adapter.stream({
    provider: ROUTE, model: 'kilo-auto/free', messages: [], reasoningEffort: 'max',
  })) { /* drain */ }
  assert.equal(sent.reasoning_effort, undefined)
})

test('a model with no menu never gets an effort field', async () => {
  const entry = { ...E, id: 'kilo-auto/free' }
  let sent
  const adapter = new KiloAdapter({
    state: () => ({ catalog: [entry], settings: {} }),
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body)
      return new Response('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n', {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  for await (const _c of adapter.stream({
    provider: ROUTE, model: 'kilo-auto/free', messages: [], reasoningEffort: 'high',
  })) { /* drain */ }
  assert.equal(sent.reasoning_effort, undefined)
})
