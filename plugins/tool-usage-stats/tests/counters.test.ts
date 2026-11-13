/**
 * Counter fold, failure summarization, and windowing.
 *
 * Runs under `node --test` against the TypeScript source through Node's type
 * stripping, so no build step and no test framework.
 *
 * @module vyra-tool-usage-stats/counters.test
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  coverage, dayKey, failureDetail, readResult, record, recordFailure, report, summarize, takeName, windowed,
} from '../src/counters.ts'

test('dayKey formats local time as YYYY-MM-DD', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 13, 30).getTime()), '2026-01-05')
  assert.equal(dayKey(new Date(2026, 11, 31, 23, 59).getTime()), '2026-12-31')
})

test('record creates an entry on first observation', () => {
  const at = new Date(2026, 5, 1, 10, 0).getTime()
  assert.deepEqual(record({}, 'bash', false, at, 90).bash, {
    count: 1,
    errorCount: 0,
    lastUsedAt: at,
    lastUsedDay: '2026-06-01',
    daily: { '2026-06-01': 1 },
    dailyErrors: {},
  })
})

test('record tracks failures per day alongside calls', () => {
  const day = new Date(2026, 5, 1, 10, 0).getTime()
  let state = record({}, 'read', false, day, 90)
  state = record(state, 'read', true, day, 90)
  assert.deepEqual(state.read!.daily, { '2026-06-01': 2 })
  assert.deepEqual(state.read!.dailyErrors, { '2026-06-01': 1 })
})

test('record drops the failure bucket with its day', () => {
  let state = {}
  const base = new Date(2026, 5, 1, 10, 0).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  for (let index = 0; index < 3; index += 1) {
    state = record(state, 'bash', true, base + index * dayMs, 1)
  }
  assert.deepEqual(Object.keys(state.bash!.daily), ['2026-06-03'])
  assert.deepEqual(Object.keys(state.bash!.dailyErrors), ['2026-06-03'],
    'a trimmed day must not leave its failure count behind')
})

test('record accumulates failures separately from calls', () => {
  const day = new Date(2026, 5, 1, 10, 0).getTime()
  let state = record({}, 'read', false, day, 90)
  state = record(state, 'read', true, day, 90)
  state = record(state, 'read', true, day, 90)
  assert.equal(state.read!.count, 3)
  assert.equal(state.read!.errorCount, 2)
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

test('summarize collapses whitespace and truncates', () => {
  assert.equal(summarize('  a\n\n  b\tc  '), 'a b c')
  const long = 'x'.repeat(400)
  const out = summarize(long)
  assert.equal(out.length, 301, '300 characters plus the ellipsis')
  assert.ok(out.endsWith('…'))
})

test('recordFailure keeps the newest samples and caps the count', () => {
  let log = {}
  for (let index = 0; index < 5; index += 1) {
    log = recordFailure(log, { at: index, summary: `e${index}`, tool: 'bash' }, 3)
  }
  assert.deepEqual(log.bash!.map(s => s.summary), ['e4', 'e3', 'e2'])
})

test('readResult reads the pairing id from the message', () => {
  assert.deepEqual(
    readResult({ turn: 1, message: { toolCallId: 'c1', isError: true } }),
    { callId: 'c1', isError: true },
  )
  assert.deepEqual(readResult({ message: { toolCallId: 'c1' } }), { callId: 'c1', isError: false })
  assert.equal(readResult({ callId: 'c1' }), undefined, 'a top-level callId is not the real field')
  assert.equal(readResult(null), undefined)
})

test('failureDetail prefers a thrown error reason over content', () => {
  const detail = failureDetail(
    {
      message: { content: [{ type: 'text', text: 'from content' }] },
      error: { name: 'HarnessError', code: 'BASH_FAILED', reason: 'from reason' },
    },
    { isError: true },
  )
  assert.equal(detail.summary, 'from reason')
  assert.equal(detail.code, 'BASH_FAILED')
})

test('failureDetail falls back to the model-facing content', () => {
  const detail = failureDetail(
    { message: { content: [{ type: 'text', text: '  command   failed\n  badly ' }] } },
    { isError: true },
  )
  assert.equal(detail.summary, 'command failed badly')
  assert.equal(detail.code, undefined)
})

test('failureDetail covers a throw with neither reason nor content', () => {
  assert.deepEqual(failureDetail({ message: {} }, { isError: true }), {
    summary: '工具返回失败结果（无正文）',
  })
})

test('failureDetail reports nothing for a successful call', () => {
  assert.deepEqual(failureDetail({ message: { content: [] } }, { isError: false }), { summary: '' })
})

test('takeName pairs a result with its call and consumes the entry', () => {
  const names = new Map([['call-1', 'bash']])
  assert.equal(takeName(names, 'call-1'), 'bash')
  assert.equal(takeName(names, 'call-1'), undefined)
  assert.equal(names.size, 0)
})

test('report orders by descending calls then by name', () => {
  const at = new Date(2026, 5, 1, 10, 0).getTime()
  let state = record({}, 'bash', false, at, 90)
  state = record(state, 'bash', false, at, 90)
  state = record(state, 'zebra', false, at, 90)
  state = record(state, 'alpha', false, at, 90)
  assert.deepEqual(report(state).rows.map(row => row.tool), ['bash', 'alpha', 'zebra'])
})

test('windowed reads only the daily buckets, never the cumulative total', () => {
  // A tool used 100 times 60 days ago and never since: it must not appear in a
  // 7-day window, which is exactly the mistake that deletes live tools in
  // reverse — a cumulative total read as "recently used".
  const dayMs = 24 * 60 * 60 * 1000
  const now = new Date(2026, 5, 30, 12, 0).getTime()
  let state = {}
  for (let index = 0; index < 100; index += 1) {
    state = record(state, 'old-tool', false, now - 60 * dayMs, 90)
  }
  state = record(state, 'new-tool', false, now - dayMs, 90)

  const week = windowed(state, 7, now)
  assert.equal(week['old-tool'], undefined, 'the old tool is outside the window')
  assert.equal(week['new-tool']?.count, 1)

  const cumulative = windowed(state, 0, now)
  assert.equal(cumulative['old-tool']?.count, 100, 'a zero window is the cumulative set')
})

test('windowed drops a tool whose only calls predate the window', () => {
  const dayMs = 24 * 60 * 60 * 1000
  const now = new Date(2026, 5, 30, 12, 0).getTime()
  const state = record({}, 'gone', false, now - 40 * dayMs, 90)
  assert.deepEqual(windowed(state, 7, now), {})
})

test('windowed reports the failures inside the window, not the cumulative count', () => {
  // A window that showed the cumulative failure count would overstate it, and a
  // window that showed nothing would claim the tool never failed. Both mislead
  // the reader who opened the column to find out.
  const dayMs = 24 * 60 * 60 * 1000
  const now = new Date(2026, 5, 30, 12, 0).getTime()
  let state = {}
  // 10 old failures, well outside the window.
  for (let index = 0; index < 10; index += 1) {
    state = record(state, 'search', true, now - 60 * dayMs, 90)
  }
  // 2 successes and 1 failure inside it.
  state = record(state, 'search', false, now - dayMs, 90)
  state = record(state, 'search', false, now - dayMs, 90)
  state = record(state, 'search', true, now - dayMs, 90)

  const week = windowed(state, 7, now)
  assert.equal(week.search!.count, 3)
  assert.equal(week.search!.errorCount, 1, 'the 10 old failures must not be counted')
  assert.equal(state.search!.errorCount, 11, 'the cumulative total is unchanged')
})

test('coverage reports the retained span', () => {
  let state = {}
  state = record(state, 'a', false, new Date(2026, 5, 10, 9, 0).getTime(), 90)
  state = record(state, 'b', false, new Date(2026, 5, 20, 9, 0).getTime(), 90)
  assert.deepEqual(coverage(state, 90), {
    since: '2026-06-10',
    until: '2026-06-20',
    retentionDays: 90,
  })
  assert.deepEqual(coverage({}, 90), { since: null, until: null, retentionDays: 90 })
})

test('summarize strips the Native Error envelope', () => {
  // The canonical failure message excludes this prefix, so keeping it would
  // stop the same reason recorded two ways from grouping together.
  assert.equal(summarize('Error: cannot read "a.txt": not found'), 'cannot read "a.txt": not found')
  assert.equal(summarize('  Error:   spaced out  '), 'spaced out')
  assert.equal(summarize('ENOENT: no such file'), 'ENOENT: no such file',
    'a reason that merely contains Error later keeps it')
})
