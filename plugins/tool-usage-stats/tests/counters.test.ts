/**
 * Counter-fold behavior. Runs under `node --test` against the TypeScript source
 * through Node's type stripping, so no build step and no test framework.
 *
 * @module vyra-tool-usage-stats/counters.test
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dayKey, record, resultIsError, takeName } from '../src/counters.ts'

test('dayKey formats local time as YYYY-MM-DD', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 13, 30).getTime()), '2026-01-05')
  assert.equal(dayKey(new Date(2026, 11, 31, 23, 59).getTime()), '2026-12-31')
})

test('record creates an entry on first observation', () => {
  const at = new Date(2026, 5, 1, 10, 0).getTime()
  const state = record({}, 'bash', false, at, 90)
  assert.deepEqual(state.bash, {
    count: 1,
    errorCount: 0,
    lastUsedAt: at,
    lastUsedDay: '2026-06-01',
    daily: { '2026-06-01': 1 },
  })
})

test('record accumulates failures separately from calls', () => {
  const day = new Date(2026, 5, 1, 10, 0).getTime()
  let state = record({}, 'read', false, day, 90)
  state = record(state, 'read', true, day, 90)
  state = record(state, 'read', true, day, 90)
  assert.equal(state.read!.count, 3)
  assert.equal(state.read!.errorCount, 2)
})

test('record keeps separate buckets per day', () => {
  const first = new Date(2026, 5, 1, 10, 0).getTime()
  const second = new Date(2026, 5, 2, 10, 0).getTime()
  let state = record({}, 'grep', false, first, 90)
  state = record(state, 'grep', false, second, 90)
  assert.deepEqual(state.grep!.daily, { '2026-06-01': 1, '2026-06-02': 1 })
  assert.equal(state.grep!.lastUsedDay, '2026-06-02')
})

test('record drops buckets older than retainDays but keeps the total', () => {
  let state = {}
  const base = new Date(2026, 5, 1, 10, 0).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  for (let index = 0; index < 5; index += 1) {
    state = record(state, 'bash', false, base + index * dayMs, 2)
  }
  assert.equal(Object.keys(state.bash!.daily).length, 2)
  assert.equal(state.bash!.count, 5)
})

test('a serialized snapshot does not change when the fold advances', () => {
  const at = new Date(2026, 5, 1, 10, 0).getTime()
  const before = record({}, 'bash', false, at, 90)
  const serialized = JSON.stringify(before)
  record(before, 'bash', false, at, 90)
  assert.equal(JSON.stringify(before), serialized)
})

test('resultIsError reads only an explicit true', () => {
  assert.equal(resultIsError({ message: { isError: true } }), true)
  assert.equal(resultIsError({ message: { isError: false } }), false)
  assert.equal(resultIsError({ message: {} }), false)
  assert.equal(resultIsError({}), false)
  assert.equal(resultIsError(null), false)
  assert.equal(resultIsError('not an object'), false)
})

test('takeName pairs a result with its call and consumes the entry', () => {
  const names = new Map([['call-1', 'bash']])
  assert.equal(takeName(names, 'call-1'), 'bash')
  assert.equal(takeName(names, 'call-1'), undefined)
  assert.equal(names.size, 0)
})
