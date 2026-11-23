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
import { catalogDomain } from '../domains/catalog.js'

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

test('plugin.setEnabled rejects a call that names both an entry and a bundle', async () => {
  // `id` and `name` address different levels through different setters. Rather
  // than silently preferring one, say so: a caller that sent both does not know
  // which it wants, and guessing would change the wrong thing.
  const calls = []
  const ctx = ctxWith({ pluginManager: {
    setPluginEnabled: async (...a) => { calls.push(['entry', ...a]); return changeResult() },
    setBundleEnabled: async (...a) => { calls.push(['bundle', ...a]); return changeResult() },
  } })
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.setEnabled', { id: 'e1', name: 'pkg-a', enabled: true })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /both|ambiguous/i)
  assert.deepEqual(calls, [], 'an ambiguous call must not reach either setter')
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

test('the dispatcher itself opens the gate when confirm is already inside args', async () => {
  // Dispatch-level guard for the comparison. This does NOT prove the tool can
  // open the gate — the tool has to get `confirm` into args first, which is what
  // the next test covers.
  const ctx = ctxWith({ pluginManager: { removeBundle: async () => changeResult({ stage: 'remove', target: 'x' }) } })
  const console_ = createConsole(ctx, { plugin: pluginDomain }, { confirmDestructive: true })
  const result = await console_.dispatch('plugin.remove', { name: 'x', confirm: true })
  assert.equal(result.status, 'ok')
})

test('a destructive action is refused through the tool without confirm, and allowed with it', async () => {
  // The gate has to be openable through the surface the model actually uses.
  // dispatch() reads args.confirm, but the tool schema declares `confirm` as a
  // top-level sibling of `args`, and the pipeline calls execute(exec.arguments)
  // with the raw arguments object. An execute() that forwards only input.args
  // makes the gate unsatisfiable: it refuses forever, and the reason it prints
  // tells the caller to do the one thing that changes nothing.
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    removeBundle: async () => ({ application: 'applied', changed: true, stage: 'remove', target: 'x' }),
  } : undefined) }
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }, { confirmDestructive: true }))

  const refused = await tool.execute({ action: 'plugin.remove', args: { name: 'x' } })
  assert.equal(refused.status, 'confirm-required')

  const allowed = await tool.execute({ action: 'plugin.remove', args: { name: 'x' }, confirm: true })
  assert.equal(allowed.status, 'ok')
})

test('the tool passes confirm through without inventing it when absent', async () => {
  // Two things at once: a top-level confirm reaches the dispatcher, and a
  // top-level `confirm: false` is carried as false rather than dropped, so the
  // gate still refuses.
  const seen = []
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    listPlugins: async () => [],
    listBundles: async () => [],
  } : undefined) }
  const spying = { dispatch: (action, args) => { seen.push(args); return { status: 'ok' } } }
  const tool = createConsoleTool(spying)

  await tool.execute({ action: 'plugin.list', args: { a: 1 } })
  await tool.execute({ action: 'plugin.list', args: { a: 1 }, confirm: false })
  await tool.execute({ action: 'plugin.list', args: { a: 1 }, confirm: true })
  await tool.execute({ action: 'plugin.list' })

  assert.deepEqual(seen[0], { a: 1 }, 'confirm absent: no confirm key is added')
  assert.deepEqual(seen[1], { a: 1, confirm: false }, 'confirm: false is carried through as false')
  assert.deepEqual(seen[2], { a: 1, confirm: true })
  assert.deepEqual(seen[3], {}, 'no args at all still dispatches with an empty object')
  // Reference safety: the caller's own args object must not be mutated.
  const own = { a: 1 }
  await tool.execute({ action: 'plugin.list', args: own, confirm: true })
  assert.deepEqual(own, { a: 1 })
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

// ---------------------------------------------------------------------------
// Task 3b: the skills inventory and the MCP server fleet. Field names below are
// the ones verified in the installed sources (see task-3b-report.md):
// `SkillSummary` in @deepseek-ai/dsh-skill/src/index.ts, `McpManagedServerView`
// and `McpManagedServerStatus` in @deepseek-ai/dsh-mcp-manager/src/types.ts,
// `McpConnectionStatus`/`McpProbeResult` in @deepseek-ai/dsh-mcp-client/src/types.ts.
// A service returning another shape is a real bug, not a fixture detail.
// ---------------------------------------------------------------------------

/** The fields a real SkillSummary always carries alongside name/description. */
function skillSummary(extra = {}) {
  return {
    name: 'brainstorming',
    description: 'd',
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'bundled',
    provider: 'filesystem',
    ...extra,
  }
}

test('skill.list reports the registered skills', async () => {
  const ctx = { get: (k) => (k === 'skills' ? {
    list: async () => [skillSummary()],
  } : undefined) }
  const console_ = createConsole(ctx, { catalog: catalogDomain })
  const result = await console_.dispatch('skill.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.skills.map((s) => s.name), ['brainstorming'])
})

test('skill.list reports unavailable when the skills service is absent', async () => {
  // A minimal profile can carry no skill registry at all, so the inventory must
  // degrade to `unavailable` rather than throwing out of the handler.
  const console_ = createConsole(bareCtx(), { catalog: catalogDomain })
  const result = await console_.dispatch('skill.list', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /skills/)
})

test('skill.list maps the SkillSummary fields that exist, including invocation', async () => {
  // SkillSummary carries path?, name, description, whenToUse?, invocation,
  // source, provider and resourceBase?; `invocation` is a real field, not an
  // invented one, and the panel needs it to tell a model-invocable skill from
  // a user-only one.
  const ctx = ctxWith({ skills: { list: async () => [skillSummary({
    path: '/x/SKILL.md',
    whenToUse: 'when starting',
    resourceBase: { kind: 'directory', path: '/x' },
  })] } })
  const console_ = createConsole(ctx, { catalog: catalogDomain })
  const result = await console_.dispatch('skill.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.skills[0], {
    name: 'brainstorming',
    description: 'd',
    path: '/x/SKILL.md',
    whenToUse: 'when starting',
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'bundled',
    provider: 'filesystem',
    resourceBase: { kind: 'directory', path: '/x' },
  })
})

test('skill.list omits the optional SkillSummary fields rather than emitting undefined', async () => {
  // path, whenToUse and resourceBase are optional; emitting any of them as an
  // undefined-valued key aborts the pipeline's whole-value snapshot.
  const ctx = ctxWith({ skills: { list: async () => [skillSummary({ path: undefined, whenToUse: undefined })] } })
  const tool = createConsoleTool(createConsole(ctx, { catalog: catalogDomain }))
  const result = await tool.execute({ action: 'skill.list' })
  assert.equal(result.status, 'ok')
  for (const key of ['path', 'whenToUse', 'resourceBase']) {
    assert.equal(key in result.skills[0], false, `"${key}" must be omitted, not emitted as undefined`)
  }
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('mcp.list reports each server with its status state', async () => {
  const ctx = { get: (k) => (k === 'mcpManager' ? {
    list: () => [{ name: 'mcp', configured: true, status: { state: 'connected', toolCount: 3, connectedAt: 0 } }],
  } : undefined) }
  const console_ = createConsole(ctx, { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.list', {})
  assert.equal(result.status, 'ok')
  assert.equal(result.servers[0].state, 'connected')
})

test('mcp.list reports unavailable when mcpManager is absent', async () => {
  const console_ = createConsole(bareCtx(), { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.list', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /mcpManager/)
})

test('mcp.list keeps only the status fields the current state variant carries', async () => {
  // McpManagedServerStatus is a union whose variants carry different fields:
  // `connected` has toolCount/connectedAt but no lastError, while the
  // `failed`/`reconnecting` variants carry lastError and no toolCount. A single
  // flat projection that reads all of them would emit undefined for whichever
  // half does not apply.
  const ctx = ctxWith({ mcpManager: { list: () => [
    { name: 'a', configured: true, status: { state: 'connected', toolCount: 3, connectedAt: 1700 } },
    { name: 'b', configured: true, status: { state: 'failed', reason: 'load', lastError: 'boom' } },
    { name: 'c', configured: false, status: { state: 'disabled' } },
  ] } })
  const tool = createConsoleTool(createConsole(ctx, { catalog: catalogDomain }))
  const result = await tool.execute({ action: 'mcp.list' })
  assert.equal(result.status, 'ok')

  assert.equal(result.servers[0].state, 'connected')
  assert.equal(result.servers[0].toolCount, 3)
  assert.equal(result.servers[0].connectedAt, 1700)
  assert.equal('lastError' in result.servers[0], false, 'a connected server has no lastError')

  assert.equal(result.servers[1].state, 'failed')
  assert.equal(result.servers[1].lastError, 'boom')
  assert.equal(result.servers[1].reason, 'load')
  assert.equal('toolCount' in result.servers[1], false)

  assert.equal(result.servers[2].state, 'disabled')
  assert.equal(result.servers[2].configured, false)
  assert.equal('toolCount' in result.servers[2], false)
  assert.equal('lastError' in result.servers[2], false)

  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('mcp.list carries the closing result on a closed server', async () => {
  // The `closed` variant carries an McpCloseResult instead of any tool fields.
  const ctx = ctxWith({ mcpManager: { list: () => [
    { name: 'a', configured: true, status: { state: 'closed', result: { closeConfirmed: true, cleanupError: 'x' } } },
  ] } })
  const console_ = createConsole(ctx, { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.list', {})
  assert.equal(result.status, 'ok')
  assert.equal(result.servers[0].state, 'closed')
  assert.deepEqual(result.servers[0].close, { closeConfirmed: true, cleanupError: 'x' })
})

test('mcp.list carries an unrecognised status state without inventing its fields', async () => {
  // A future variant, or a status the manager left unset, must still project
  // something rather than throwing — and the `state` token must survive the
  // service spread, so it is written after it.
  const ctx = ctxWith({ mcpManager: { list: () => [
    { name: 'a', configured: true, status: { state: 'weird-future-state', extra: 1 } },
    { name: 'b', configured: true, status: undefined },
  ] } })
  const tool = createConsoleTool(createConsole(ctx, { catalog: catalogDomain }))
  const result = await tool.execute({ action: 'mcp.list' })
  assert.equal(result.status, 'ok')
  assert.equal(result.servers[0].state, 'weird-future-state')
  assert.equal(result.servers[0].extra, 1)
  // A status the manager never recorded contributes no state token at all.
  assert.equal('state' in result.servers[1], false)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('mcp.restart needs a server name', async () => {
  const console_ = createConsole(bareCtx(), { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.restart', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /name/)
})

test('mcp.restart forwards the name and is marked mutating but not destructive', async () => {
  // A restart is a real mutation, but it is recoverable: the manager remounts
  // the same configured entry, so it is not destructive and must not sit behind
  // the confirmation gate.
  assert.equal(ACTIONS['mcp.restart'].mutating, true)
  assert.equal(ACTIONS['mcp.restart'].destructive, false)
  const restarted = []
  const ctx = ctxWith({ mcpManager: { restart: async (name) => { restarted.push(name) } } })
  const console_ = createConsole(ctx, { catalog: catalogDomain }, { confirmDestructive: true })
  const result = await console_.dispatch('mcp.restart', { name: 'mcp' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(restarted, ['mcp'])
  assert.equal(result.name, 'mcp')
})

test('mcp.probe needs a server name', async () => {
  const console_ = createConsole(bareCtx(), { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.probe', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /name/)
})

test('a successful mcp.probe reports the success variant without a failure field', async () => {
  // McpProbeSuccess carries ok, serverInfo?, toolNames, truncated, durationMs
  // and the always-present McpCloseResult — but no `stage` and no `message`.
  // Flattening both variants into one object would emit those as undefined.
  const ctx = ctxWith({ mcpManager: { probe: async () => ({
    ok: true,
    serverInfo: { name: 'srv', version: '1.0' },
    toolNames: ['t1', 't2'],
    truncated: false,
    durationMs: 12,
    closeConfirmed: true,
  }) } })
  const tool = createConsoleTool(createConsole(ctx, { catalog: catalogDomain }))
  const result = await tool.execute({ action: 'mcp.probe', args: { name: 'mcp' } })
  assert.equal(result.status, 'ok')
  assert.equal(result.ok, true)
  assert.equal(result.probe.ok, true)
  assert.deepEqual(result.probe.toolNames, ['t1', 't2'])
  assert.deepEqual(result.probe.serverInfo, { name: 'srv', version: '1.0' })
  assert.equal(result.probe.durationMs, 12)
  assert.equal('stage' in result.probe, false, 'a successful probe has no failure stage')
  assert.equal('message' in result.probe, false, 'a successful probe has no failure message')
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('a failed mcp.probe reports the failure variant without tool fields', async () => {
  // McpProbeFailure carries ok:false, stage, message, durationMs — but neither
  // `toolNames` nor `serverInfo`.
  const ctx = ctxWith({ mcpManager: { probe: async () => ({
    ok: false, stage: 'connect', message: 'refused', durationMs: 5, closeConfirmed: false,
  }) } })
  const tool = createConsoleTool(createConsole(ctx, { catalog: catalogDomain }))
  const result = await tool.execute({ action: 'mcp.probe', args: { name: 'mcp' } })
  // The probe ran to a settled answer, so the call succeeded; the negative
  // outcome rides inside `ok`/`probe` rather than failing the action.
  assert.equal(result.status, 'ok')
  assert.equal(result.ok, false)
  assert.equal(result.probe.stage, 'connect')
  assert.equal(result.probe.message, 'refused')
  assert.equal('toolNames' in result.probe, false, 'a failed probe listed no tools')
  assert.equal('serverInfo' in result.probe, false)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('mcp.probe accepts a timeoutMs budget and rejects a nonsensical one', async () => {
  const seen = []
  const ctx = ctxWith({ mcpManager: { probe: async (name, options) => {
    seen.push([name, options])
    return { ok: true, toolNames: [], truncated: false, durationMs: 1, closeConfirmed: true }
  } } })
  const console_ = createConsole(ctx, { catalog: catalogDomain })

  const result = await console_.dispatch('mcp.probe', { name: 'mcp', timeoutMs: 250 })
  assert.equal(result.status, 'ok')
  assert.deepEqual(seen, [['mcp', { timeoutMs: 250 }]])

  // A non-positive or non-finite budget is a bad request, not something to hand
  // to the service, whose own guard would throw out of the handler.
  for (const timeoutMs of [0, -1, 'slow', Number.NaN]) {
    const bad = await console_.dispatch('mcp.probe', { name: 'mcp', timeoutMs })
    assert.equal(bad.status, 'error', `timeoutMs ${String(timeoutMs)} must be rejected`)
    assert.match(bad.reason, /timeoutMs/)
  }
  assert.equal(seen.length, 1, 'a rejected budget never reaches the service')
})

test('every catalog action degrades to unavailable without its service', async () => {
  const console_ = createConsole(bareCtx(), { catalog: catalogDomain })
  for (const [action, args] of [
    ['skill.list', {}],
    ['mcp.list', {}],
    ['mcp.restart', { name: 'mcp' }],
    ['mcp.probe', { name: 'mcp' }],
  ]) {
    const result = await console_.dispatch(action, args)
    assert.equal(result.status, 'unavailable', `${action} must degrade`)
  }
})

test('console.actions lists the catalog actions with their mutation flags', async () => {
  const console_ = createConsole(bareCtx())
  const names = console_.listActions().map((a) => a.name)
  for (const name of ['skill.list', 'mcp.list', 'mcp.restart', 'mcp.probe']) {
    assert.ok(names.includes(name), `${name} must be registered`)
  }
  assert.equal(ACTIONS['skill.list'].mutating, false)
  assert.equal(ACTIONS['mcp.list'].mutating, false)
  assert.equal(ACTIONS['mcp.probe'].mutating, false)
  assert.equal(ACTIONS['skill.list'].domain, 'catalog')
  assert.equal(ACTIONS['mcp.probe'].domain, 'catalog')
})
