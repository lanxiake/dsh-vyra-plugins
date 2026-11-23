// Local integration check: whether a team member may name an agent preset.
// The host-side spawn path is compiled against the Harness packages, so this
// covers the one pure decision that runs before any child session exists.
//
//   node --test plugins/dsh-agent-teams/test/preset.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { resolveMemberPreset } from '../lib/preset.js'

const ctxWith = (roster) => ({
  get: (name) => (name === 'agentPresets' ? { list: async () => roster } : undefined),
})

test('a blank or missing preset keeps captain inheritance', async () => {
  const ctx = ctxWith([])
  assert.equal(await resolveMemberPreset(ctx, undefined), undefined)
  assert.equal(await resolveMemberPreset(ctx, ''), undefined)
  assert.equal(await resolveMemberPreset(ctx, '   '), undefined)
  assert.equal(await resolveMemberPreset(ctx, 42), undefined)
})

test('a live preset id resolves', async () => {
  const ctx = ctxWith([{ id: 'code-reviewer', name: 'Reviewer' }, { id: 'researcher' }])
  assert.equal(await resolveMemberPreset(ctx, ' code-reviewer '), 'code-reviewer')
})

test('an unknown preset fails with the available ids', async () => {
  await assert.rejects(
    () => resolveMemberPreset(ctxWith([{ id: 'code-reviewer' }]), 'nope'),
    /unknown agent_preset "nope".*code-reviewer/,
  )
})

test('a broken preset is refused', async () => {
  await assert.rejects(
    () => resolveMemberPreset(ctxWith([{ id: 'broken', broken: 'missing service' }]), 'broken'),
    /cannot compose a session: missing service/,
  )
})

test('a composition without the preset registry says what to mount', async () => {
  await assert.rejects(
    () => resolveMemberPreset({ get: () => undefined }, 'code-reviewer'),
    /agent-preset registry/,
  )
})

console.log('dsh-agent-teams: preset checks passed')