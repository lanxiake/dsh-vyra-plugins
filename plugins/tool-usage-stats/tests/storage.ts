/**
 * Storage-layer check: the hand-built domain spec the plugin submits must be
 * one the real storage service accepts, and its `valueSchema.parse` must reject
 * malformed records rather than admitting them.
 *
 * Run from the `dsh-Veyra` checkout:
 *
 *   npx tsx <path>/tests/storage.ts
 *
 * The plugin cannot import `@deepseek-ai/dsh-storage-domain`, so it builds the
 * spec literally. This test is what proves that substitution is sound: the real
 * `defineDomain` is applied to the plugin's own spec object, so a field the
 * validator rejects — or a `valueSchema` without `parse` — fails here instead of
 * in a user's installation.
 *
 * @module vyra-tool-usage-stats/storage-test
 */

import assert from 'node:assert/strict'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'
import { TABLE_NAME, toolUsageDomain } from '../src/storage.ts'

// `defineDomain` is an identity function that validates its argument. Feeding it
// the plugin's literal spec is the whole point: it proves the shape the plugin
// assumes is the shape the service requires.
const accepted = defineDomain(toolUsageDomain as never) as unknown as {
  name: string
  version: number
  invalidRecords?: string
  tables: Record<string, { valueSchema: { parse: (raw: unknown) => unknown } }>
}

assert.equal(accepted.name, 'tool_usage')
assert.equal(accepted.version, 1)
assert.equal(accepted.invalidRecords, 'backup-and-skip', 'derived counters must survive one unreadable record')
assert.ok(TABLE_NAME in accepted.tables, `table ${TABLE_NAME} must be declared`)

const parse = accepted.tables[TABLE_NAME]!.valueSchema.parse
assert.equal(typeof parse, 'function', 'the table must expose a parse method')

// A well-formed snapshot round-trips, counters and audit together.
const good = {
  counters: {
    bash: {
      count: 3,
      errorCount: 1,
      lastUsedAt: 1_760_000_000_000,
      lastUsedDay: '2026-06-01',
      daily: { '2026-06-01': 3 },
      dailyErrors: { '2026-06-01': 1 },
    },
  },
  failures: {
    bash: [{ at: 1_760_000_000_000, summary: 'exited with code 1', code: 'BASH_FAILED', tool: 'bash' }],
  },
}
assert.deepEqual(parse(good), good)

// A record written before per-day failures were tracked carries no
// `dailyErrors`. Absent is honest — those days have no failure split — so it
// normalizes to an empty map instead of failing the read.
const preDailyErrors = {
  counters: {
    bash: {
      count: 3,
      errorCount: 1,
      lastUsedAt: 1_760_000_000_000,
      lastUsedDay: '2026-06-01',
      daily: { '2026-06-01': 3 },
    },
  },
}
assert.deepEqual(parse(preDailyErrors), {
  counters: { ...good.counters, bash: { ...good.counters.bash, dailyErrors: {} } },
  failures: {},
})

// A snapshot with no audit yet is still valid: a fresh install has no failures.
assert.deepEqual(parse({ counters: {} }), { counters: {}, failures: {} })

// Each malformed shape must throw, because the storage service treats a throw
// as a record failure and applies `backup-and-skip`. Returning a partial
// snapshot instead would silently corrupt every later total.
const rejects: [string, unknown][] = [
  ['not an object', 'nope'],
  ['null', null],
  ['an array', []],
  ['no counters', { failures: {} }],
  ['counters as an array', { counters: [] }],
  ['a non-object entry', { counters: { bash: 3 } }],
  ['a missing count', { counters: { bash: { errorCount: 0, lastUsedAt: 0, lastUsedDay: 'x', daily: {} } } }],
  ['a negative count', { counters: { bash: { count: -1, errorCount: 0, lastUsedAt: 0, lastUsedDay: 'x', daily: {} } } }],
  ['a NaN count', { counters: { bash: { count: NaN, errorCount: 0, lastUsedAt: 0, lastUsedDay: 'x', daily: {} } } }],
  ['a non-string day', { counters: { bash: { count: 1, errorCount: 0, lastUsedAt: 0, lastUsedDay: 7, daily: {} } } }],
  ['a non-object daily', { counters: { bash: { count: 1, errorCount: 0, lastUsedAt: 0, lastUsedDay: 'x', daily: 3 } } }],
  ['a non-numeric daily count', { counters: { bash: { count: 1, errorCount: 0, lastUsedAt: 0, lastUsedDay: 'x', daily: { d: 'many' } } } }],
  ['failures as an array', { counters: {}, failures: [] }],
  ['a failure list that is not an array', { counters: {}, failures: { bash: 3 } }],
  ['a failure missing its summary', { counters: {}, failures: { bash: [{ at: 1 }] } }],
  ['a failure with a non-numeric time', { counters: {}, failures: { bash: [{ at: 'x', summary: 's' }] } }],
]

for (const [label, value] of rejects) {
  assert.throws(() => parse(value), TypeError, `parse must reject ${label}`)
}

console.log(`storage: the plugin's hand-built spec passes defineDomain; parse rejects ${rejects.length} malformed shapes.`)

// An installation upgrading from 0.1.x stored a bare counter set. Reading it
// must keep the history rather than resetting every total.
const legacy = {
  bash: {
    count: 7,
    errorCount: 3,
    lastUsedAt: 1_760_000_000_000,
    lastUsedDay: '2026-06-01',
    daily: { '2026-06-01': 7 },
  },
}
assert.deepEqual(parse(legacy), {
  counters: { bash: { ...legacy.bash, dailyErrors: {} } },
  failures: {},
}, 'a legacy counter set must be adopted')

console.log('storage: legacy 0.1.x counter sets are adopted rather than dropped.')
