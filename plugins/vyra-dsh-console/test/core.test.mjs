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

test('plugin.list reports unavailable when pluginManager is absent', async () => {
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

test('plugin.list never emits an undefined-valued key, which the output pipeline rejects', async () => {
  // The pipeline snapshots every successful value as lossless JSON
  // (dsh-tools/src/pipeline.ts snapshotToolValue). An own key holding `undefined`
  // does not round-trip, so it throws INVALID_TOOL_OUTPUT. Optional PluginInfo /
  // BundleInfo fields must therefore be omitted, never emitted as undefined.
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    listPlugins: async () => [{ entryId: 'e1', moduleName: 'm', enabled: true, fiberPhase: 'active' }],
    listBundles: async () => [{ name: 'b', enabled: true, installed: true, availability: 'profile', removable: true }],
  } : undefined) }
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }))
  const result = await tool.execute({ action: 'plugin.list' })
  assert.equal(result.status, 'ok')
  const rows = [...result.plugins, ...result.bundles]
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      assert.notEqual(value, undefined, `row key "${key}" holds undefined`)
    }
  }
})

test('a plugin.list result survives a JSON round trip unchanged', async () => {
  // The exact property the pipeline enforces, asserted directly so a future
  // nested value cannot slip an undefined past the flat scan above.
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    listPlugins: async () => [{ entryId: 'e1', moduleName: 'm', enabled: true, fiberPhase: 'active' }],
    listBundles: async () => [
      { name: 'b1', enabled: true, installed: true, availability: 'profile', removable: true },
      { name: 'b2', enabled: false, installed: false, availability: 'missing', removable: false, version: '1.2.3' },
    ],
  } : undefined) }
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }))
  const result = await tool.execute({ action: 'plugin.list' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, 'the value must round-trip losslessly')
  // A present optional field is kept, an absent one stays absent.
  assert.equal(result.bundles[1].version, '1.2.3')
  assert.equal('version' in result.bundles[0], false)
  assert.equal('diagnostic' in result.plugins[0], false)
  assert.equal('readOnlyReason' in result.plugins[0], false)
})

test('plugin.list keeps an optional field when the service supplies it', async () => {
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    listPlugins: async () => [{
      entryId: 'e1', moduleName: 'm', enabled: true, fiberPhase: 'failed',
      diagnostic: 'boom', readOnlyReason: 'management-required',
    }],
    listBundles: async () => [{ name: 'b', enabled: true, installed: true, availability: 'profile', removable: true, version: '9.9.9' }],
  } : undefined) }
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }))
  const result = await tool.execute({ action: 'plugin.list' })
  assert.equal(result.status, 'ok')
  assert.equal(result.plugins[0].diagnostic, 'boom')
  assert.equal(result.plugins[0].readOnlyReason, 'management-required')
  assert.equal(result.bundles[0].version, '9.9.9')
})
