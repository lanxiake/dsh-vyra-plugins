// Boundary and dispatch self-check for the DSH console.
//
//   node --test plugins/vyra-dsh-console/test/core.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { createConsole, ACTIONS, FORBIDDEN } from '../core.js'
import { createConsoleTool } from '../tool.js'
import { pluginDomain } from '../domains/plugin.js'

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
  // plugin.list is declared in ACTIONS from Task 2 on, but a bare ctx has no
  // pluginManager, so the domain must degrade to `unavailable` instead of throwing.
  const console_ = createConsole(bareCtx(), { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.list', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /pluginManager/)
})

test('plugin.list returns the running entries with their own enabled state', async () => {
  // The stub mirrors the real PluginInfo/BundleInfo field names: a running entry
  // is keyed by `entryId`/`moduleName`, never by `id`.
  const ctx = {
    get: (k) => (k === 'pluginManager' ? {
      listPlugins: async () => [
        { entryId: 'a', moduleName: 'pkg-a', enabled: true, fiberPhase: 'active' },
        { entryId: 'b', moduleName: 'pkg-b', enabled: false, fiberPhase: null },
      ],
      listBundles: async () => [],
    } : undefined),
  }
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.plugins.map((p) => p.entryId), ['a', 'b'])
  assert.deepEqual(result.plugins.map((p) => p.enabled), [true, false])
  assert.deepEqual(result.bundles, [])
})

test('the tool refuses a forbidden action without calling any handler', async () => {
  let called = false
  const console_ = createConsole({ get: () => undefined }, { plugin: () => { called = true } })
  const tool = createConsoleTool(console_)
  const result = await tool.execute({ action: 'sandbox.setMode' })
  assert.equal(result.status, 'forbidden')
  assert.equal(called, false, 'a forbidden action never reaches a domain handler')
})

test('the tool definition declares the output contract registration requires', () => {
  // tools.register() throws "tool ... must declare output { schema, render,
  // presentationMeta? }" without this, which fails the whole plugin's apply().
  const tool = createConsoleTool(createConsole(bareCtx()))
  assert.equal(typeof tool.output?.render, 'function')
  assert.ok(tool.output?.schema, 'the output schema is what registration validates values against')
})
