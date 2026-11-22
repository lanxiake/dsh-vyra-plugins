import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { USAGE_INITIAL, dayKey, recordUsage, pruneDays, todayTotals } from '../src/usage.js'
import { JsonStore } from '../src/store.js'

const at = s => new Date(s).getTime()

test('dayKey uses the machine calendar', () => {
  assert.equal(dayKey(at('2026-11-22T10:00:00+08:00')), '2026-11-22')
})

test('recordUsage adds to the day and to the model row', () => {
  const v = recordUsage(USAGE_INITIAL, { at: at('2026-11-22T10:00:00+08:00'), model: 'm1',
    usage: { inputTokens: 10, outputTokens: 20, reasoningTokens: 5 } })
  assert.equal(v.days['2026-11-22'].models.m1.input, 10)
  assert.equal(v.days['2026-11-22'].models.m1.output, 20)
  assert.equal(v.days['2026-11-22'].models.m1.reasoning, 5)
})

test('two turns on the same day accumulate', () => {
  let v = recordUsage(USAGE_INITIAL, { at: at('2026-11-22T10:00:00+08:00'), model: 'm1',
    usage: { inputTokens: 10, outputTokens: 20 } })
  v = recordUsage(v, { at: at('2026-11-22T11:00:00+08:00'), model: 'm1',
    usage: { inputTokens: 1, outputTokens: 2 } })
  assert.equal(v.days['2026-11-22'].models.m1.input, 11)
})

test('a new day starts a fresh row', () => {
  let v = recordUsage(USAGE_INITIAL, { at: at('2026-11-22T23:00:00+08:00'), model: 'm1',
    usage: { inputTokens: 10, outputTokens: 20 } })
  v = recordUsage(v, { at: at('2026-11-23T01:00:00+08:00'), model: 'm1',
    usage: { inputTokens: 1, outputTokens: 2 } })
  assert.equal(v.days['2026-11-22'].models.m1.input, 10)
  assert.equal(v.days['2026-11-23'].models.m1.input, 1)
})

test('todayTotals sums every model of one day', () => {
  let v = recordUsage(USAGE_INITIAL, { at: at('2026-11-22T10:00:00+08:00'), model: 'm1',
    usage: { inputTokens: 10, outputTokens: 20 } })
  v = recordUsage(v, { at: at('2026-11-22T11:00:00+08:00'), model: 'm2',
    usage: { inputTokens: 5, outputTokens: 7 } })
  assert.deepEqual(todayTotals(v, '2026-11-22'), { input: 15, output: 27, total: 42 })
})

test('an empty day totals zero', () => {
  assert.deepEqual(todayTotals(USAGE_INITIAL, '2026-11-22'), { input: 0, output: 0, total: 0 })
})

test('pruneDays keeps the requested window and never drops today', () => {
  const v = { version: 1, days: {} }
  for (const d of ['2026-10-01', '2026-11-01', '2026-11-20', '2026-11-22']) v.days[d] = { models: {} }
  const out = pruneDays(v, 30, '2026-11-22')
  assert.deepEqual(Object.keys(out.days).sort(), ['2026-11-01', '2026-11-20', '2026-11-22'])
})

test('recordUsage does not mutate the input value', () => {
  const before = structuredClone(USAGE_INITIAL)
  recordUsage(USAGE_INITIAL, { at: at('2026-11-22T10:00:00+08:00'), model: 'm1', usage: { inputTokens: 1, outputTokens: 1 } })
  assert.deepEqual(USAGE_INITIAL, before)
})

test('missing usage counts are treated as zero rather than NaN', () => {
  const v = recordUsage(USAGE_INITIAL, { at: at('2026-11-22T10:00:00+08:00'), model: 'm1', usage: {} })
  assert.equal(v.days['2026-11-22'].models.m1.input, 0)
  assert.deepEqual(todayTotals(v, '2026-11-22'), { input: 0, output: 0, total: 0 })
})

test('JsonStore persists through a temp file and survives a corrupt source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vfm-'))
  const file = join(dir, 'settings.json')
  const store = new JsonStore(file, { a: 1 })
  store.update({ a: 2 })
  store.flush()
  assert.deepEqual(new JsonStore(file, {}).get().a, 2)

  await writeFile(file, '{broken', 'utf8')
  const recovered = new JsonStore(file, { a: 9 })
  assert.equal(recovered.get().a, 9)
  assert.ok(readdirSync(dir).some(n => n.includes('.corrupt-')))
})

test('JsonStore writes nothing after dispose', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vfm-'))
  const file = join(dir, 'x.json')
  const store = new JsonStore(file, { n: 1 })
  store.update({ n: 1 })
  store.flush()
  store.dispose()
  store.update({ n: 2 })
  store.flush()
  assert.equal(new JsonStore(file, { n: 0 }).get().n, 1)
})
