/**
 * Analysis selection, prompt construction, and answer parsing.
 *
 * @module vyra-tool-usage-stats/analysis.test
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_POLICY, MAX_TARGETS, buildPrompt, groupFailures, parseDiagnoses, selectTargets,
  type AnalysisPolicy,
} from '../src/analysis.ts'
import { record, recordFailure, type FailureLog, type ToolUsageState } from '../src/counters.ts'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 5, 30, 12, 0).getTime()

/** Build counters with `failures` failures out of `calls` calls. */
function countersWith(tool: string, calls: number, failures: number, at = NOW): ToolUsageState {
  let state: ToolUsageState = {}
  for (let index = 0; index < calls - failures; index += 1) state = record(state, tool, false, at, 90)
  for (let index = 0; index < failures; index += 1) state = record(state, tool, true, at, 90)
  return state
}

test('groupFailures groups by code and keeps distinct reasons only', () => {
  const log = [
    { at: 3, summary: 'same', code: 'A', tool: 't' },
    { at: 2, summary: 'same', code: 'A', tool: 't' },
    { at: 1, summary: 'other', code: 'A', tool: 't' },
  ]
  assert.deepEqual(groupFailures(log), [{ code: 'A', count: 3, samples: ['same', 'other'] }])
})

test('groupFailures caps samples per group', () => {
  const log = Array.from({ length: 50 }, (_, index) => ({
    at: index, summary: `reason ${index}`, code: 'A', tool: 't',
  }))
  const [group] = groupFailures(log)
  assert.equal(group!.count, 50)
  assert.equal(group!.samples.length, 2, 'grouping is what keeps the prompt affordable')
})

test('groupFailures orders by count and labels a missing code', () => {
  const log = [
    { at: 1, summary: 'x', code: 'RARE', tool: 't' },
    { at: 2, summary: 'y', tool: 't' },
    { at: 3, summary: 'z', tool: 't' },
  ]
  assert.deepEqual(groupFailures(log).map(g => g.code), ['(none)', 'RARE'])
})

test('selectTargets requires both enough failures and enough elapsed time', () => {
  const counters = countersWith('bash', 20, 10)
  const history = { bash: { analyzedAt: NOW - 1 * DAY, failuresAtAnalysis: 0 } }
  // 10 new failures, but analyzed one day ago: the cooldown alone refuses it.
  assert.deepEqual(selectTargets(counters, {}, history, DEFAULT_POLICY, NOW), [])
})

test('selectTargets ignores a tool whose new failures are below the threshold', () => {
  const counters = countersWith('bash', 20, 3)
  assert.deepEqual(selectTargets(counters, {}, {}, DEFAULT_POLICY, NOW), [],
    'a handful of failures does not justify a diagnosis')
})

test('selectTargets counts only failures since the last analysis', () => {
  // 10 cumulative failures, all already analyzed: nothing new to ask about.
  const counters = countersWith('bash', 20, 10)
  const history = { bash: { analyzedAt: NOW - 30 * DAY, failuresAtAnalysis: 10 } }
  assert.deepEqual(selectTargets(counters, {}, history, DEFAULT_POLICY, NOW), [])
})

test('selectTargets accepts a tool that is past its cooldown with new failures', () => {
  const counters = countersWith('bash', 20, 10)
  const history = { bash: { analyzedAt: NOW - 30 * DAY, failuresAtAnalysis: 4 } }
  const targets = selectTargets(counters, {}, history, DEFAULT_POLICY, NOW)
  assert.equal(targets.length, 1)
  assert.equal(targets[0]!.tool, 'bash')
  assert.equal(targets[0]!.newFailures, 6)
})

test('selectTargets never selects a tool with no failures', () => {
  const counters = countersWith('bash', 100, 0)
  assert.deepEqual(selectTargets(counters, {}, {}, DEFAULT_POLICY, NOW), [])
})

test('selectTargets orders by new failures and caps the list', () => {
  let counters: ToolUsageState = {}
  for (let index = 0; index < MAX_TARGETS + 4; index += 1) {
    counters = { ...counters, ...countersWith(`tool_${index}`, 20, 6 + index) }
  }
  const targets = selectTargets(counters, {}, {}, DEFAULT_POLICY, NOW)
  assert.equal(targets.length, MAX_TARGETS)
  // tool_11 has the most new failures (6 + 11).
  assert.equal(targets[0]!.tool, `tool_${MAX_TARGETS + 3}`)
})

test('selectTargets attaches the grouped reasons', () => {
  let log: FailureLog = {}
  const counters = countersWith('bash', 20, 6)
  // Newest first, matching how the audit retains them.
  for (let index = 5; index >= 0; index -= 1) {
    log = recordFailure(log, { at: NOW - index, summary: `exit ${index}`, code: 'BASH_FAILED', tool: 'bash' })
  }
  const [target] = selectTargets(counters, log, {}, DEFAULT_POLICY, NOW)
  assert.equal(target!.groups.length, 1)
  assert.equal(target!.groups[0]!.code, 'BASH_FAILED')
  assert.equal(target!.groups[0]!.count, 6)
  assert.deepEqual(target!.groups[0]!.samples, ['exit 0', 'exit 1'],
    'the newest retained reasons are the representatives')
})

test('buildPrompt states counts, codes, and reasons without prescribing a fix', () => {
  const prompt = buildPrompt([{
    tool: 'web_search',
    calls: 181,
    failures: 181,
    newFailures: 181,
    groups: [{ code: 'SEARCH_QUOTA', count: 181, samples: ['quota exceeded'] }],
  }])
  assert.match(prompt, /web_search/)
  assert.match(prompt, /失败率 100%/)
  assert.match(prompt, /SEARCH_QUOTA：181 次/)
  assert.match(prompt, /quota exceeded/)
  assert.match(prompt, /```json/)
})

test('buildPrompt notes a target whose reasons were not retained', () => {
  const prompt = buildPrompt([{
    tool: 'old_tool', calls: 5, failures: 5, newFailures: 5, groups: [],
  }])
  assert.match(prompt, /没有保留的原因文本/)
})

test('parseDiagnoses reads a fenced JSON array', () => {
  const answer = [
    'Here is my analysis:',
    '```json',
    '[{"tool":"web_search","diagnosis":"配额超限","evidence":"quota exceeded","change":{"kind":"description","description":"New text."}}]',
    '```',
  ].join('\n')
  assert.deepEqual(parseDiagnoses(answer), [{
    tool: 'web_search',
    diagnosis: '配额超限',
    evidence: 'quota exceeded',
    change: { kind: 'description', description: 'New text.' },
  }])
})

test('parseDiagnoses reads a bare array without a fence', () => {
  const answer = '[{"tool":"a","diagnosis":"d","evidence":"e","change":{"kind":"implementation","note":"do X"}}]'
  assert.deepEqual(parseDiagnoses(answer)[0]!.change, { kind: 'implementation', note: 'do X' })
})

test('parseDiagnoses drops entries it cannot apply', () => {
  const answer = JSON.stringify([
    { tool: 'good', diagnosis: 'd', evidence: 'e', change: { kind: 'description', description: 'x' } },
    { tool: 'bad', diagnosis: 'd', evidence: 'e', change: { kind: 'nonsense' } },
    { diagnosis: 'd', evidence: 'e', change: { kind: 'description', description: 'x' } },
    { tool: 'nochange', diagnosis: 'd', evidence: 'e' },
  ])
  assert.deepEqual(parseDiagnoses(answer).map(d => d.tool), ['good'],
    'a malformed proposal is worse than none')
})

test('parseDiagnoses returns nothing rather than guessing', () => {
  assert.deepEqual(parseDiagnoses('I could not determine the cause.'), [])
  assert.deepEqual(parseDiagnoses('```json\n{oops\n```'), [])
  assert.deepEqual(parseDiagnoses(''), [])
})

test('a custom policy can require a different bar', () => {
  const strict: AnalysisPolicy = { minFailures: 20, cooldownDays: 1 }
  const counters = countersWith('bash', 100, 10)
  assert.deepEqual(selectTargets(counters, {}, {}, strict, NOW), [])
  assert.equal(selectTargets(countersWith('bash', 100, 25), {}, {}, strict, NOW).length, 1)
})
