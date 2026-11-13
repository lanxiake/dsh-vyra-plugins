/**
 * Diagnosis state management and change resolution.
 *
 * @module vyra-tool-usage-stats/diagnose.test
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_POLICY } from '../src/analysis.ts'
import {
  EMPTY_STATE, applyRun, describeTool, dismiss, prepareRun, rejectParameters, resolveChange,
  type RegisteredTool,
} from '../src/diagnose.ts'
import { record, type ToolUsageState } from '../src/counters.ts'

const NOW = new Date(2026, 5, 30, 12, 0).getTime()

/** Counters with `failures` failures across `calls` calls. */
function countersWith(tool: string, calls: number, failures: number): ToolUsageState {
  let state: ToolUsageState = {}
  for (let index = 0; index < calls - failures; index += 1) state = record(state, tool, false, NOW, 90)
  for (let index = 0; index < failures; index += 1) state = record(state, tool, true, NOW, 90)
  return state
}

/** A definition map with one tool. */
function definitionsFor(tool: string, description = 'Old description.'): Map<string, RegisteredTool> {
  return new Map([[tool, { name: tool, description, parameters: {} }]])
}

/** A model answer proposing a description change. */
function answerFor(tool: string, description = 'New description.'): string {
  return '```json\n' + JSON.stringify([
    { tool, diagnosis: 'd', evidence: 'e', change: { kind: 'description', description } },
  ]) + '\n```'
}

test('describeTool coerces a malformed definition to safe defaults', () => {
  assert.deepEqual(describeTool({ name: 'a', description: 'b', parameters: { type: 'object' } }), {
    name: 'a', description: 'b', parameters: { type: 'object' },
  })
  assert.deepEqual(describeTool(undefined), { name: '', description: '', parameters: {} })
  assert.deepEqual(describeTool({ name: 42 }), { name: '', description: '', parameters: {} })
})

test('prepareRun returns nothing when no tool qualifies', () => {
  assert.equal(prepareRun(countersWith('bash', 20, 1), {}, EMPTY_STATE, DEFAULT_POLICY, NOW), undefined)
})

test('prepareRun builds a prompt naming the qualifying tools', () => {
  const prepared = prepareRun(countersWith('bash', 20, 10), {}, EMPTY_STATE, DEFAULT_POLICY, NOW)
  assert.ok(prepared !== undefined)
  assert.equal(prepared.targets.length, 1)
  assert.match(prepared.prompt, /bash/)
})

test('applyRun records every target as analyzed', () => {
  const counters = countersWith('bash', 20, 10)
  const prepared = prepareRun(counters, {}, EMPTY_STATE, DEFAULT_POLICY, NOW)!
  const next = applyRun(EMPTY_STATE, counters, prepared.targets, answerFor('bash'), definitionsFor('bash'), NOW)
  assert.deepEqual(next.history.bash, { analyzedAt: NOW, failuresAtAnalysis: 10 })
})

test('applyRun records a target the model declined to diagnose', () => {
  const counters = countersWith('bash', 20, 10)
  const prepared = prepareRun(counters, {}, EMPTY_STATE, DEFAULT_POLICY, NOW)!
  // An answer with nothing usable still counts as analyzed, or the same tool is
  // re-asked every run and each ask costs a request.
  const next = applyRun(EMPTY_STATE, counters, prepared.targets, 'I cannot tell.', definitionsFor('bash'), NOW)
  assert.equal(next.pending.length, 0)
  assert.deepEqual(next.history.bash, { analyzedAt: NOW, failuresAtAnalysis: 10 })
})

test('applyRun stores an applicable proposal with the previous description', () => {
  const counters = countersWith('bash', 20, 10)
  const prepared = prepareRun(counters, {}, EMPTY_STATE, DEFAULT_POLICY, NOW)!
  const next = applyRun(EMPTY_STATE, counters, prepared.targets, answerFor('bash'), definitionsFor('bash', 'Was this.'), NOW)
  assert.equal(next.pending.length, 1)
  assert.equal(next.pending[0]!.previousDescription, 'Was this.')
  assert.equal(next.pending[0]!.change.description, 'New description.')
})

test('applyRun drops a proposal for a tool the registry does not have', () => {
  const counters = countersWith('ghost', 20, 10)
  const prepared = prepareRun(counters, {}, EMPTY_STATE, DEFAULT_POLICY, NOW)!
  // The map is empty: the tool was unloaded between the run and the answer.
  const next = applyRun(EMPTY_STATE, counters, prepared.targets, answerFor('ghost'), new Map(), NOW)
  assert.equal(next.pending.length, 0)
})

test('applyRun replaces an earlier proposal for the same tool', () => {
  const counters = countersWith('bash', 20, 10)
  const prepared = prepareRun(counters, {}, EMPTY_STATE, DEFAULT_POLICY, NOW)!
  const first = applyRun(EMPTY_STATE, counters, prepared.targets, answerFor('bash', 'First.'), definitionsFor('bash'), NOW)
  const second = applyRun(first, counters, prepared.targets, answerFor('bash', 'Second.'), definitionsFor('bash'), NOW)
  assert.equal(second.pending.length, 1)
  assert.equal(second.pending[0]!.change.description, 'Second.')
})

test('applyRun keeps an unrelated pending proposal', () => {
  const counters = { ...countersWith('bash', 20, 10), ...countersWith('read', 20, 10) }
  const prepared = prepareRun(counters, {}, EMPTY_STATE, DEFAULT_POLICY, NOW)!
  assert.equal(prepared.targets.length, 2)

  const both = applyRun(EMPTY_STATE, counters, prepared.targets,
    answerFor('bash'), definitionsFor('bash'), NOW)
  // A later run answers about read only; bash's earlier proposal must survive.
  const readOnly = prepared.targets.filter(target => target.tool === 'read')
  const next = applyRun(both, counters, readOnly, answerFor('read'), definitionsFor('read'), NOW)
  assert.deepEqual(next.pending.map(entry => entry.tool).sort(), ['bash', 'read'])
})

test('dismiss removes only the named tool', () => {
  const state = {
    history: {},
    lastRunAt: 0,
    pending: [
      { tool: 'bash', diagnosis: 'd', evidence: 'e', change: { kind: 'description' as const, description: 'x' }, proposedAt: 1, previousDescription: '' },
      { tool: 'read', diagnosis: 'd', evidence: 'e', change: { kind: 'description' as const, description: 'y' }, proposedAt: 1, previousDescription: '' },
    ],
  }
  assert.deepEqual(dismiss(state, 'bash').pending.map(entry => entry.tool), ['read'])
})

test('rejectParameters refuses a shape the registry cannot project', () => {
  assert.match(rejectParameters([]) ?? '', /对象/)
  assert.match(rejectParameters(null) ?? '', /对象/)
  assert.match(rejectParameters({ type: 'array' }) ?? '', /type/)
  assert.match(rejectParameters({ type: 'object', properties: [] }) ?? '', /properties/)
  assert.equal(rejectParameters({ type: 'object', properties: {} }), undefined)
  assert.equal(rejectParameters({ type: 'object' }), undefined)
})

test('resolveChange returns replacements for a description', () => {
  assert.deepEqual(resolveChange({ kind: 'description', description: 'New.' }), { description: 'New.' })
})

test('resolveChange refuses an empty description', () => {
  assert.match(resolveChange({ kind: 'description', description: '   ' }) as string, /没有给出/)
  assert.match(resolveChange({ kind: 'description' }) as string, /没有给出/)
})

test('resolveChange validates a proposed parameter schema', () => {
  assert.deepEqual(resolveChange({ kind: 'parameters', parameters: { type: 'object', properties: {} } }),
    { parameters: { type: 'object', properties: {} } })
  assert.match(resolveChange({ kind: 'parameters', parameters: { type: 'array' } }) as string, /type/)
})

test('resolveChange refuses to apply an implementation change', () => {
  const result = resolveChange({ kind: 'implementation', note: 'do X' })
  assert.match(result as string, /人工完成/)
})

test('a resolved description keeps the tool runnable', () => {
  // The registry borrows the definition, so a replacement carries the original
  // description's information plus the guidance — never a body the plugin
  // cannot supply.
  const resolution = resolveChange({ kind: 'description', description: 'Search. Batch queries.' })
  assert.ok(typeof resolution === 'object' && 'description' in resolution)
})
