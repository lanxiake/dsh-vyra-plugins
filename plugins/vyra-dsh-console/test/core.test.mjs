// Boundary and dispatch self-check for the DSH console.
//
//   node --test plugins/vyra-dsh-console/test/core.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { createConsole, ACTIONS, FORBIDDEN } from '../core.js'

/** A ctx with no optional service present, to prove graceful degradation. */
function bareCtx() {
  return { get: () => undefined, logger: { warn() {} } }
}

test('every forbidden action is refused with a reason and an alternative', async () => {
  const console_ = createConsole(bareCtx())
  for (const name of Object.keys(FORBIDDEN)) {
    const result = await console_.dispatch(name, {})
    assert.equal(result.status, 'forbidden', `${name} must be forbidden`)
    assert.ok(result.reason, `${name} must explain why`)
    assert.ok(result.alternative, `${name} must name the user-facing alternative`)
  }
})

test('the permission boundary names exactly the authority-changing actions', () => {
  // These four are the spec's §2.2 exclusions. If one disappears, the agent
  // silently regains the ability to widen its own authority.
  for (const name of ['sandbox.setMode', 'permission.setPreset', 'approval.answer', 'credentials.set']) {
    assert.ok(FORBIDDEN[name], `${name} must be forbidden`)
  }
})

test('a non-mutating action is marked non-mutating and non-destructive', () => {
  const action = ACTIONS['console.actions']
  assert.equal(action.mutating, false)
  assert.equal(action.destructive, false)
})

test('an unknown action fails instead of throwing', async () => {
  const console_ = createConsole(bareCtx())
  const result = await console_.dispatch('nope.notReal', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /unknown action/i)
})

test('an action with no handler yet is reported, not thrown', async () => {
  // Task 1 declares only console.actions; Task 2 adds plugin.list together with
  // its domain handler. Until a domain exists, dispatch must say so clearly.
  const console_ = createConsole(bareCtx())
  const result = await console_.dispatch('plugin.list', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /unknown action/i)
})
