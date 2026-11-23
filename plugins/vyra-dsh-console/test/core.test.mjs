// Boundary and dispatch self-check for the DSH console.
//
//   node --test plugins/vyra-dsh-console/test/core.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { createConsole, present, presentDeep, ACTIONS, FORBIDDEN } from '../core.js'
import { createConsoleTool } from '../tool.js'
import { pluginDomain } from '../domains/plugin.js'
import { modelDomain } from '../domains/model.js'
import { settingsDomain } from '../domains/settings.js'

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

// ---------------------------------------------------------------------------
// Task 3: the model, settings and plugin-mutation domains, and the
// confirmDestructive gate. Field names below are the ones verified in the
// installed sources (see task-3-report.md): a service returning a shape other
// than these is a real bug, not a test-fixture detail.
// ---------------------------------------------------------------------------

/** A ctx exposing only the named services. */
function ctxWith(services) {
  return { get: (key) => services[key], logger: { warn() {} } }
}

/** The four fields `change()` always populates on a settled ChangeResult. */
function changeResult(extra = {}) {
  return { changed: true, application: 'applied', stage: 'enable', target: 'x', ...extra }
}

test('model.list reports the configured default selection', async () => {
  const ctx = { get: (k) => (k === 'agentDefaultModel' ? {
    currentSelection: () => ({ provider: 'deepseek', model: 'deepseek-chat' }),
  } : undefined) }
  const console_ = createConsole(ctx, { model: modelDomain })
  const result = await console_.dispatch('model.list', {})
  assert.equal(result.status, 'ok')
  assert.equal(result.current.model, 'deepseek-chat')
})

test('model.list omits reasoningEffort rather than emitting it as undefined', async () => {
  // ModelSelection carries an optional reasoningEffort. Emitting the key with an
  // undefined value would abort the tool pipeline's whole-value snapshot.
  const ctx = ctxWith({ agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) } })
  const tool = createConsoleTool(createConsole(ctx, { model: modelDomain }))
  const result = await tool.execute({ action: 'model.list' })
  assert.equal(result.status, 'ok')
  assert.equal('reasoningEffort' in result.current, false)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('model.list keeps reasoningEffort when the selection supplies it', async () => {
  const ctx = ctxWith({
    agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm', reasoningEffort: 'high' }) },
  })
  const console_ = createConsole(ctx, { model: modelDomain })
  const result = await console_.dispatch('model.list', {})
  assert.equal(result.current.reasoningEffort, 'high')
})

test('model.list reports available providers from the llm service', async () => {
  const ctx = ctxWith({
    agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) },
    llm: { listProviders: () => [{ id: 'p', name: 'Provider P' }] },
  })
  const console_ = createConsole(ctx, { model: modelDomain })
  const result = await console_.dispatch('model.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.providers, [{ id: 'p', name: 'Provider P' }])
})

test('model.list survives a missing llm service and still reports the selection', async () => {
  const ctx = ctxWith({ agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) } })
  const console_ = createConsole(ctx, { model: modelDomain })
  const result = await console_.dispatch('model.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.providers, [])
})

test('model.list reports unavailable when agentDefaultModel is absent', async () => {
  const console_ = createConsole(bareCtx(), { model: modelDomain })
  const result = await console_.dispatch('model.list', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /agentDefaultModel/)
})

test('model.select rejects a selection missing a provider', async () => {
  const console_ = createConsole(bareCtx(), { model: modelDomain })
  const result = await console_.dispatch('model.select', { model: 'x' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /provider/)
})

test('model.select rejects a selection missing a model', async () => {
  const console_ = createConsole(bareCtx(), { model: modelDomain })
  const result = await console_.dispatch('model.select', { provider: 'p' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /model/)
})

test('model.select persists the selection and reports the stored value', async () => {
  const saved = []
  const ctx = ctxWith({
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'p', model: 'm' }),
      saveSelection: async (next) => { saved.push(next) },
    },
  })
  const console_ = createConsole(ctx, { model: modelDomain })
  const result = await console_.dispatch('model.select', { provider: 'p', model: 'm' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(saved, [{ provider: 'p', model: 'm' }])
  assert.equal(result.current.model, 'm')
})

test('settings.set rejects a patch that is not an object', async () => {
  const console_ = createConsole(bareCtx(), { settings: settingsDomain })
  const result = await console_.dispatch('settings.set', { ns: 'x', patch: 'nope' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /object/)
})

test('settings.set rejects an array patch', async () => {
  // An array is `typeof 'object'`, so the plain-object check has to exclude it
  // explicitly or it would reach cloneJsonShaped as a nonsense layer.
  const console_ = createConsole(bareCtx(), { settings: settingsDomain })
  const result = await console_.dispatch('settings.set', { ns: 'x', patch: ['nope'] })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /object/)
})

test('settings.set rejects a missing namespace', async () => {
  const console_ = createConsole(bareCtx(), { settings: settingsDomain })
  const result = await console_.dispatch('settings.set', { patch: { a: 1 } })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /ns/)
})

test('settings.set writes the namespace and never invents a value field', async () => {
  const writes = []
  const ctx = ctxWith({ settings: {
    describe: () => [{ ns: 'llm-deepseek', autoGenerate: true, schema: {}, value: {}, revision: 0, applies: 'live' }],
    update: async (ns, patch) => { writes.push([ns, patch]) },
  } })
  const tool = createConsoleTool(createConsole(ctx, { settings: settingsDomain }))
  const result = await tool.execute({ action: 'settings.set', args: { ns: 'llm-deepseek', patch: { temperature: 0.2 } } })
  assert.equal(result.status, 'ok')
  assert.equal(result.ns, 'llm-deepseek')
  assert.deepEqual(writes, [['llm-deepseek', { temperature: 0.2 }]])
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('settings.set refuses a namespace the profile does not declare', async () => {
  // Without this, a typo would write a config section nothing ever reads.
  let updated = false
  const ctx = ctxWith({ settings: {
    describe: () => [{ ns: 'a', autoGenerate: true, schema: {}, value: {}, revision: 0, applies: 'live' }],
    update: async () => { updated = true },
  } })
  const console_ = createConsole(ctx, { settings: settingsDomain })
  const result = await console_.dispatch('settings.set', { ns: 'typo', patch: { x: 1 } })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /typo/)
  assert.equal(updated, false, 'an unknown namespace must not be written')
})

test('settings.list maps the descriptor fields that exist, without inventing a title', async () => {
  // The real SettingsDescriptor has no `title`; a descriptor only ever has
  // ns, autoGenerate, schema, value, revision, applies and optional base/user/
  // secrets. Reading `title` off it would emit an undefined-valued key.
  const ctx = ctxWith({ settings: {
    describe: () => [{ ns: 'llm-deepseek', autoGenerate: true, schema: {}, value: {}, revision: 3, applies: 'live' }],
  } })
  const tool = createConsoleTool(createConsole(ctx, { settings: settingsDomain }))
  const result = await tool.execute({ action: 'settings.list' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.namespaces, [{ ns: 'llm-deepseek', autoGenerate: true, revision: 3, applies: 'live' }])
  assert.equal('title' in result.namespaces[0], false)
})

test('settings.list omits base and user rather than emitting them as undefined', async () => {
  const ctx = ctxWith({ settings: {
    describe: () => [{
      ns: 'a', autoGenerate: false, schema: {}, value: {}, revision: 0, applies: 'live',
      base: { x: 1 }, user: undefined,
    }],
  } })
  const tool = createConsoleTool(createConsole(ctx, { settings: settingsDomain }))
  const result = await tool.execute({ action: 'settings.list' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.namespaces[0].base, { x: 1 })
  assert.equal('user' in result.namespaces[0], false)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('settings.get returns the whole descriptor for one namespace', async () => {
  const ctx = ctxWith({ settings: {
    describe: () => [
      { ns: 'a', autoGenerate: true, schema: { type: 'object' }, value: { x: 1 }, revision: 7, applies: 'live' },
      { ns: 'b', autoGenerate: true, schema: {}, value: {}, revision: 0, applies: 'live' },
    ],
  } })
  const console_ = createConsole(ctx, { settings: settingsDomain })
  const result = await console_.dispatch('settings.get', { ns: 'a' })
  assert.equal(result.status, 'ok')
  assert.equal(result.namespace.ns, 'a')
  assert.deepEqual(result.namespace.value, { x: 1 })
  assert.deepEqual(result.namespace.schema, { type: 'object' })
})

test('settings.get reports an unknown namespace as an error', async () => {
  const ctx = ctxWith({ settings: { describe: () => [] } })
  const console_ = createConsole(ctx, { settings: settingsDomain })
  const result = await console_.dispatch('settings.get', { ns: 'nope' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /nope/)
})

test('settings.list reports unavailable when the settings service is absent', async () => {
  const console_ = createConsole(bareCtx(), { settings: settingsDomain })
  const result = await console_.dispatch('settings.list', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /settings/)
})

test('plugin.setEnabled keys the change by Loader entryId, not a bundle name', async () => {
  // setPluginEnabled(id: PluginEntryId, enabled) is the entry-level setter;
  // setBundleEnabled(name, enabled) takes a bundle package name. Calling the
  // wrong one with the other's identifier silently changes the wrong thing.
  const calls = []
  const ctx = ctxWith({ pluginManager: {
    listPlugins: async () => [{ entryId: 'e1', moduleName: 'm', enabled: true, fiberPhase: 'active' }],
    listBundles: async () => [],
    setPluginEnabled: async (id, enabled) => { calls.push([id, enabled]); return changeResult() },
    setBundleEnabled: async () => { throw new Error('setBundleEnabled must not be called for an entryId') },
  } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.setEnabled', { id: 'e1', enabled: false })
  assert.equal(result.status, 'ok')
  assert.deepEqual(calls, [['e1', false]])
})

test('plugin.setEnabled still accepts a bundle name through the bundle setter', async () => {
  const calls = []
  const ctx = ctxWith({ pluginManager: {
    setBundleEnabled: async (name, enabled) => { calls.push([name, enabled]); return changeResult() },
  } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.setEnabled', { name: 'pkg-a', enabled: true })
  assert.equal(result.status, 'ok')
  assert.deepEqual(calls, [['pkg-a', true]])
})

test('plugin.setEnabled rejects a call with neither an id nor a name', async () => {
  const ctx = ctxWith({ pluginManager: { setBundleEnabled: async () => changeResult() } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.setEnabled', { enabled: true })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /id|name/)
})

test('plugin.setEnabled rejects a non-boolean enabled', async () => {
  const ctx = ctxWith({ pluginManager: { setBundleEnabled: async () => changeResult() } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.setEnabled', { id: 'e1', enabled: 'yes' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /boolean/)
})

test('plugin.setEnabled reports a missing setter instead of throwing a TypeError', async () => {
  // The two setters are distinct methods on the manager. Calling an absent one
  // would throw out of the handler, so each path checks for its own.
  const entryOnly = createConsole(ctxWith({ pluginManager: { setBundleEnabled: async () => changeResult() } }),
    { plugin: pluginDomain })
  const byEntry = await entryOnly.dispatch('plugin.setEnabled', { id: 'e1', enabled: true })
  assert.equal(byEntry.status, 'error')
  assert.match(byEntry.reason, /setPluginEnabled/)

  const bundleOnly = createConsole(ctxWith({ pluginManager: { setPluginEnabled: async () => changeResult() } }),
    { plugin: pluginDomain })
  const byBundle = await bundleOnly.dispatch('plugin.setEnabled', { name: 'pkg-a', enabled: true })
  assert.equal(byBundle.status, 'error')
  assert.match(byBundle.reason, /setBundleEnabled/)
})

test('plugin.install requires a spec and forwards it', async () => {
  const specs = []
  const ctx = ctxWith({ pluginManager: {
    installBundle: async (spec) => { specs.push(spec); return changeResult({ stage: 'install', target: 'pkg-a' }) },
  } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const missing = await console_.dispatch('plugin.install', {})
  assert.equal(missing.status, 'error')
  assert.match(missing.reason, /spec/)
  const result = await console_.dispatch('plugin.install', { spec: 'pkg-a@1.2.3' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(specs, ['pkg-a@1.2.3'])
})

test('plugin.remove requires a name and forwards it', async () => {
  const names = []
  const ctx = ctxWith({ pluginManager: {
    removeBundle: async (name) => { names.push(name); return changeResult({ stage: 'remove', target: name }) },
  } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const missing = await console_.dispatch('plugin.remove', {})
  assert.equal(missing.status, 'error')
  assert.match(missing.reason, /name/)
  const result = await console_.dispatch('plugin.remove', { name: 'pkg-a' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(names, ['pkg-a'])
})

test('a change result exposes exactly the fields the real ChangeResult carries', async () => {
  // The always-present quartet plus the optional fields the manager actually
  // sets. Anything outside this set would be an invented field name.
  const ctx = ctxWith({ pluginManager: {
    removeBundle: async () => changeResult({
      stage: 'remove', target: 'pkg-a', restartReason: 'no-hmr',
      application: 'restart-required', warnings: ['w'], bundle: 'pkg-a', version: '1.2.3',
    }),
  } })
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }))
  const result = await tool.execute({ action: 'plugin.remove', args: { name: 'pkg-a' } })
  assert.equal(result.status, 'ok')
  assert.equal(result.changed, true)
  assert.equal(result.application, 'restart-required')
  assert.equal(result.stage, 'remove')
  assert.equal(result.target, 'pkg-a')
  assert.equal(result.restartReason, 'no-hmr')
  assert.deepEqual(result.warnings, ['w'])
  assert.equal(result.bundle, 'pkg-a')
  assert.equal(result.version, '1.2.3')
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('a change result omits the optional fields the manager left unset', async () => {
  const ctx = ctxWith({ pluginManager: { removeBundle: async () => changeResult({ stage: 'remove', target: 'p' }) } })
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }))
  const result = await tool.execute({ action: 'plugin.remove', args: { name: 'p' } })
  assert.equal(result.status, 'ok')
  for (const key of ['restartReason', 'warnings', 'bundle', 'version', 'error', 'enabled']) {
    assert.equal(key in result, false, `"${key}" must be omitted, not emitted as undefined`)
  }
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('a failed application surfaces the ManagementError code instead of a bare ok', async () => {
  const ctx = ctxWith({ pluginManager: {
    removeBundle: async () => changeResult({ application: 'failed', error: { code: 'not-removable' } }),
  } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.remove', { name: 'p' })
  // The call itself completed, so the status reports the write's outcome and
  // the error code rides alongside rather than throwing.
  assert.equal(result.status, 'ok')
  assert.equal(result.application, 'failed')
  assert.equal(result.error.code, 'not-removable')
  assert.equal('diagnostic' in result.error, false)
})

test('every plugin mutation degrades to unavailable without a pluginManager', async () => {
  const console_ = createConsole(bareCtx(), { plugin: pluginDomain })
  for (const [action, args] of [
    ['plugin.setEnabled', { id: 'e1', enabled: true }],
    ['plugin.install', { spec: 'pkg-a' }],
    ['plugin.remove', { name: 'pkg-a' }],
  ]) {
    const result = await console_.dispatch(action, args)
    assert.equal(result.status, 'unavailable', `${action} must degrade`)
  }
})

test('a destructive action without confirm is refused when confirmation is on', async () => {
  const console_ = createConsole(bareCtx(), { plugin: pluginDomain }, { confirmDestructive: true })
  const result = await console_.dispatch('plugin.remove', { name: 'x' })
  assert.equal(result.status, 'confirm-required')
})

test('the same destructive action proceeds without confirm when confirmation is off', async () => {
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    removeBundle: async () => ({ application: 'applied', changed: true }),
  } : undefined) }
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.remove', { name: 'x' })
  assert.equal(result.status, 'ok')
})

test('the gate is not what refuses a destructive action that carries confirm: true', async () => {
  const ctx = ctxWith({ pluginManager: { removeBundle: async () => changeResult({ stage: 'remove', target: 'x' }) } })
  const console_ = createConsole(ctx, { plugin: pluginDomain }, { confirmDestructive: true })
  const result = await console_.dispatch('plugin.remove', { name: 'x', confirm: true })
  assert.equal(result.status, 'ok')
})

test('the confirmation gate never covers a non-destructive action', async () => {
  const ctx = ctxWith({ pluginManager: {
    listPlugins: async () => [], listBundles: async () => [],
  } })
  const console_ = createConsole(ctx, { plugin: pluginDomain }, { confirmDestructive: true })
  const result = await console_.dispatch('plugin.list', {})
  assert.equal(result.status, 'ok')
})

test('a forbidden action is refused before the confirmation gate is consulted', async () => {
  // Order matters: FORBIDDEN is the authority boundary and must be decided
  // first, so no option can turn a forbidden action into a confirmable one.
  const console_ = createConsole(bareCtx(), {}, { confirmDestructive: true })
  const result = await console_.dispatch('credentials.set', {})
  assert.equal(result.status, 'forbidden')
})

test('console.actions lists the Task 3 actions with their mutation flags', async () => {
  const console_ = createConsole(bareCtx())
  const names = console_.listActions().map((a) => a.name)
  for (const name of ['model.list', 'model.select', 'settings.list', 'settings.get', 'settings.set',
    'plugin.setEnabled', 'plugin.install', 'plugin.remove']) {
    assert.ok(names.includes(name), `${name} must be registered`)
  }
  assert.equal(ACTIONS['plugin.remove'].destructive, true)
  assert.equal(ACTIONS['plugin.install'].destructive, false)
  assert.equal(ACTIONS['settings.set'].mutating, true)
  assert.equal(ACTIONS['settings.get'].mutating, false)
  assert.equal(ACTIONS['model.list'].mutating, false)
  assert.equal(ACTIONS['model.select'].mutating, true)
  assert.equal(ACTIONS['plugin.setEnabled'].mutating, true)
})

test('every registered action declares the full spec shape', () => {
  for (const [name, spec] of Object.entries(ACTIONS)) {
    assert.equal(typeof spec.domain, 'string', `${name} needs a domain`)
    assert.equal(typeof spec.mutating, 'boolean', `${name} needs mutating`)
    assert.equal(typeof spec.destructive, 'boolean', `${name} needs destructive`)
    assert.equal(typeof spec.requiresClient, 'boolean', `${name} needs requiresClient`)
  }
})

test('present drops undefined-valued keys and keeps every other falsy value', () => {
  assert.deepEqual(present({ a: undefined }), {})
  // 0, '' and false are real values and must survive: only `undefined` is lossy.
  assert.deepEqual(present({ a: 0, b: '', c: false, d: null, e: undefined }), { a: 0, b: '', c: false, d: null })
  assert.deepEqual(Object.keys(present({ z: 1, a: undefined, m: 2 })), ['z', 'm'])
})

test('presentDeep cleans nested objects and reports an unrepresentable array', () => {
  assert.deepEqual(presentDeep({ a: 1, b: undefined, c: { d: undefined, e: 2 } }), { a: 1, c: { e: 2 } })
  assert.deepEqual(presentDeep([1, 2]), [1, 2])
  assert.deepEqual(presentDeep('x'), 'x')
  assert.deepEqual(presentDeep(null), null)
  // A gap cannot be expressed, so the array is reported as unrepresentable
  // rather than shortened into a value that misstates what happened.
  assert.equal(presentDeep([1, undefined]), undefined)
  // ...and the key holding it is then dropped, leaving the rest of the object.
  assert.deepEqual(presentDeep({ ok: 1, bad: [undefined] }), { ok: 1 })
  assert.deepEqual(presentDeep({ ok: 1, bad: [1, undefined] }), { ok: 1 })
})

test('presentDeep cleans a nested service value the snapshot walk would reject', async () => {
  // describe() builds its descriptors with conditional spreads today, but the
  // lossless-JSON rule is this plugin's contract and cannot depend on that: the
  // real snapshot walk is recursive, so one undefined at any depth rejects the
  // whole result.
  const ctx = ctxWith({ settings: { describe: () => [{
    ns: 'a', autoGenerate: true, schema: { type: 'object' }, revision: 0, applies: 'live',
    value: { keep: 1, drop: undefined, deeper: { drop: undefined, keep: 2 } },
    base: undefined, user: undefined, secrets: undefined,
  }] } })
  const tool = createConsoleTool(createConsole(ctx, { settings: settingsDomain }))
  const result = await tool.execute({ action: 'settings.get', args: { ns: 'a' } })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.namespace.value, { keep: 1, deeper: { keep: 2 } })
  for (const key of ['base', 'user', 'secrets']) {
    assert.equal(key in result.namespace, false, `"${key}" must be omitted`)
  }
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('a nested packageResult is cleaned rather than shipped unserializable', async () => {
  const ctx = ctxWith({ pluginManager: { removeBundle: async () => ({
    changed: true, application: 'applied', stage: 'remove', target: 'p',
    packageResult: { exitCode: 0, stderr: undefined, runs: [{ code: 1, note: undefined }] },
  }) } })
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }))
  const result = await tool.execute({ action: 'plugin.remove', args: { name: 'p' } })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.packageResult, { exitCode: 0, runs: [{ code: 1 }] })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('an array holding a gap drops the field instead of silently shortening it', async () => {
  // A hole is not representable in JSON, and closing it would report a run that
  // never happened, so the whole field is omitted.
  const ctx = ctxWith({ pluginManager: { removeBundle: async () => ({
    changed: true, application: 'applied', stage: 'remove', target: 'p',
    packageResult: { registries: [{ url: 'u' }, undefined] },
  }) } })
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }))
  const result = await tool.execute({ action: 'plugin.remove', args: { name: 'p' } })
  assert.equal(result.status, 'ok')
  assert.equal('registries' in result.packageResult, false)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})
