// Channel self-check: the Host asks, the Client answers, and every failure is
// explicit. A silent success would tell the agent the theme changed when it did
// not, which is the single failure mode this file exists to prevent.
//
//   node --test plugins/vyra-dsh-console/test/channel.test.mjs
//
// Theme, layout and locale are Client-realm services: they exist only in the
// browser, so there is nothing the Host can fall back to. Every path below
// therefore ends in either the Client's own answer or an explicit `unavailable`.
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { createChannel } from '../channel.js'
import { appearanceDomain } from '../domains/appearance.js'
import { ACTIONS, createConsole } from '../core.js'
import { apply } from '../index.js'

// ---------------------------------------------------------------------------
// The channel on its own.
// ---------------------------------------------------------------------------

test('a request resolves with the answer the client posts back', async () => {
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({ id: req.id, ok: true, value: 'dark' }))
  const result = await channel.request('theme.set', { id: 'dark' })
  assert.deepEqual(result, { status: 'ok', op: 'theme.set', value: 'dark' })
  assert.equal(channel.pendingCount(), 0)
})

test('requests are rejected as unavailable when no client answers', async () => {
  const channel = createChannel({ timeoutMs: 30 })
  const result = await channel.request('theme.set', { id: 'dark' })
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /no interface is connected/i)
  // The whole point: nothing else is claimed. A `value` here would be read by
  // the agent as "the theme is now dark".
  assert.equal('value' in result, false)
  assert.equal(channel.pendingCount(), 0, 'a timed-out request leaves nothing pending')
})

test('a client-reported failure surfaces as an error with its reason', async () => {
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({ id: req.id, ok: false, error: 'no such theme' }))
  const result = await channel.request('theme.set', { id: 'nope' })
  assert.equal(result.status, 'error')
  assert.equal(result.reason, 'no such theme')
  assert.equal(channel.pendingCount(), 0)
})

test('concurrent requests settle independently', async () => {
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({ id: req.id, ok: true, value: req.op }))
  const [a, b] = await Promise.all([channel.request('theme.set', {}), channel.request('layout.toggleSidebar', {})])
  assert.equal(a.value, 'theme.set')
  assert.equal(b.value, 'layout.toggleSidebar')
  assert.equal(channel.pendingCount(), 0, 'a settled request leaves nothing pending')
})

test('a request with no listener at all still settles as unavailable', async () => {
  // The literal "no interface is connected" case: nothing was ever wired to
  // answer. It must be indistinguishable from a client that stayed silent.
  const channel = createChannel({ timeoutMs: 20 })
  const result = await channel.request('appearance.state', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /no interface is connected/i)
  assert.equal(channel.pendingCount(), 0)
})

test('a reply that races the timeout cannot resolve the request twice', async () => {
  // THE leak/double-resolve path. A reply arriving exactly when the timer fires
  // must find nothing to settle: if `respond()` still found the entry, the
  // promise would already be resolved and the second resolution would be
  // dropped silently — but `pendingCount()` would have stayed at 1 forever.
  const channel = createChannel({ timeoutMs: 20 })
  let seen
  channel.onRequest((req) => { seen = req })
  const result = await channel.request('appearance.setTheme', { id: 'dark' })
  assert.equal(result.status, 'unavailable')
  // The reply for that same id, arriving after the timeout, must be reported as
  // unanswered rather than accepted — `respond()` returns false for exactly this.
  assert.equal(channel.respond({ id: seen.id, ok: true, value: 'dark' }), false)
  assert.equal(channel.pendingCount(), 0, 'a late reply must not re-add or retain an entry')
})

test('every pending request is eventually settled, and exactly once', async () => {
  // A slower check with real wall-clock separation, driven through the public
  // API only: a client that answers the first request and ignores the rest.
  const channel = createChannel({ timeoutMs: 25 })
  let n = 0
  channel.onRequest((req) => {
    n += 1
    if (n === 1) channel.respond({ id: req.id, ok: true, value: 'answered' })
  })
  const results = await Promise.all([
    channel.request('theme.set', {}),
    channel.request('theme.set', {}),
    channel.request('theme.set', {}),
  ])
  assert.equal(results.filter((r) => r.status === 'ok').length, 1)
  assert.equal(results.filter((r) => r.status === 'unavailable').length, 2)
  assert.equal(channel.pendingCount(), 0)
})

test('an unknown reply is refused rather than queued', () => {
  const channel = createChannel({ timeoutMs: 50 })
  assert.equal(channel.respond({ id: '999', ok: true }), false)
  assert.equal(channel.respond(undefined), false)
  assert.equal(channel.respond({ ok: true }), false)
  assert.equal(channel.pendingCount(), 0)
})

test('only an explicit ok:true counts as an answer', async () => {
  // The silent-success failure in its purest form: the Client replied, so the
  // request "settled" — but it never claimed to have done anything. Every
  // reply that is not a literal `ok: true` must be an error, never an assumed
  // success, or the agent reports a theme change the browser never made.
  for (const reply of [{}, { ok: false }, { ok: 'yes' }, { ok: 1 }, { ok: null }]) {
    const channel = createChannel({ timeoutMs: 1000 })
    let seen
    channel.onRequest((req) => { seen = req })
    const settled = channel.request('appearance.setTheme', { id: 'dark' })
    // Give the listener a turn before answering, so the reply finds the entry.
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(channel.respond({ ...reply, id: seen.id }), true, 'a live request must be settled')
    const result = await settled
    assert.equal(result.status, 'error', `${JSON.stringify(reply)} must not read as success`)
    assert.match(result.reason, /client refused/)
    assert.equal('value' in result, false)
  }
})

test('with timeoutMs of 0 the immediate timeout still settles and leaves nothing pending', async () => {
  // The ordering hazard inside `request()`: the timer is armed after the entry
  // is installed. Reverse that and an immediate timeout fires into a map that
  // does not have the entry yet, so the request hangs — or, once installed,
  // stays pending forever. `timeoutMs: 0` is the only input that can see the
  // difference, which is why it is exercised directly.
  const channel = createChannel({ timeoutMs: 0 })
  const result = await channel.request('appearance.state', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /no interface is connected/i)
  assert.equal(channel.pendingCount(), 0)
})

test('the channel imports nothing outside Node and this plugin', async () => {
  // The plugin is plain ESM with no build step and no node_modules, so a static
  // import of a PACKAGE would fail the whole load with ERR_MODULE_NOT_FOUND — the
  // failure @deepseek-ai/schemastery already caused once in index.js. A relative
  // import of this plugin's own module carries no such risk. This reads the
  // source, since a resolved import graph is not observable from here.
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('../channel.js', import.meta.url), 'utf8')
  const specifiers = [...source.matchAll(/(?:^|\n)\s*import\s[^\n]*?from\s+'([^']+)'/g)].map((m) => m[1])
  assert.ok(specifiers.length > 0, 'the import scan must find the module imports it is checking')
  for (const specifier of specifiers) {
    assert.ok(
      specifier.startsWith('node:') || specifier.startsWith('./') || specifier.startsWith('../'),
      `channel.js imports the package "${specifier}", which this plugin does not declare`,
    )
  }
})

// ---------------------------------------------------------------------------
// The appearance domain: the same failure modes, one level up.
// ---------------------------------------------------------------------------

/** A channel stub the domain can be driven with, with no Cordis context at all. */
function stubChannel(result) {
  const calls = []
  return {
    calls,
    request: async (op, args) => { calls.push({ op, args }); return result },
  }
}

function appearanceCtx(channel) {
  return { get: () => undefined, __consoleChannel: channel }
}

test('appearance.state travels over the channel and needs no argument', async () => {
  const channel = stubChannel({ status: 'ok', value: { theme: 'dark' } })
  const result = await appearanceDomain(appearanceCtx(channel), { action: 'appearance.state', args: {} })
  assert.deepEqual(result, { status: 'ok', value: { theme: 'dark' } })
  assert.deepEqual(channel.calls, [{ op: 'appearance.state', args: {} }])
})

test('every appearance action is unavailable when no client is connected', async () => {
  // Not "ok", not a silent no-op: the agent must learn the interface is closed.
  for (const action of Object.keys(ACTIONS).filter((a) => ACTIONS[a].domain === 'appearance')) {
    const result = await appearanceDomain(appearanceCtx(undefined), { action, args: { id: 'dark', role: 'text', px: 14 } })
    assert.equal(result.status, 'unavailable', `${action} must report unavailable without a channel`)
    assert.equal(result.action, action)
    assert.match(result.reason, /interface/i)
  }
})

test('a channel whose request is missing is unavailable, not a TypeError', async () => {
  // A half-mounted channel (the property exists, the method does not) must not
  // escape the handler as an exception.
  for (const broken of [{}, { request: 'not a function' }, null]) {
    const result = await appearanceDomain(appearanceCtx(broken), { action: 'appearance.state', args: {} })
    assert.equal(result.status, 'unavailable')
  }
})

test('appearance.setFontSize needs a numeric px and a role string', async () => {
  const channel = stubChannel({ status: 'ok' })
  const ctx = appearanceCtx(channel)

  const noPx = await appearanceDomain(ctx, { action: 'appearance.setFontSize', args: { role: 'text' } })
  assert.equal(noPx.status, 'error')
  assert.match(noPx.reason, /px/)
  assert.doesNotMatch(noPx.reason, /role/, 'the reason must name only what is missing')

  const stringPx = await appearanceDomain(ctx, { action: 'appearance.setFontSize', args: { role: 'text', px: '14' } })
  assert.equal(stringPx.status, 'error')
  assert.match(stringPx.reason, /px/)

  const nanPx = await appearanceDomain(ctx, { action: 'appearance.setFontSize', args: { role: 'text', px: Number.NaN } })
  assert.equal(nanPx.status, 'error')
  assert.match(nanPx.reason, /px/)

  const noRole = await appearanceDomain(ctx, { action: 'appearance.setFontSize', args: { px: 14 } })
  assert.equal(noRole.status, 'error')
  assert.match(noRole.reason, /role/)
  assert.doesNotMatch(noRole.reason, /px/, 'the reason must name only what is missing')

  const emptyRole = await appearanceDomain(ctx, { action: 'appearance.setFontSize', args: { px: 14, role: '' } })
  assert.equal(emptyRole.status, 'error')
  assert.match(emptyRole.reason, /role/)

  const bothMissing = await appearanceDomain(ctx, { action: 'appearance.setFontSize', args: {} })
  assert.equal(bothMissing.status, 'error')
  assert.match(bothMissing.reason, /px/)
  assert.match(bothMissing.reason, /role/)

  assert.equal(channel.calls.length, 0, 'a malformed call must never reach the client')
})

test('appearance.setFontSize forwards both parts once they are valid', async () => {
  const channel = stubChannel({ status: 'ok' })
  const result = await appearanceDomain(appearanceCtx(channel), {
    action: 'appearance.setFontSize',
    args: { role: 'code', px: 11 },
  })
  assert.equal(result.status, 'ok')
  assert.deepEqual(channel.calls, [{ op: 'appearance.setFontSize', args: { role: 'code', px: 11 } }])
})

test('the appearance domain refuses an action it does not own', async () => {
  const result = await appearanceDomain(appearanceCtx(stubChannel({ status: 'ok' })), { action: 'plugin.list', args: {} })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /plugin\.list/)
})

test('the registry declares every appearance action as a client action', () => {
  const names = Object.keys(ACTIONS).filter((a) => ACTIONS[a].domain === 'appearance')
  assert.deepEqual(names.sort(), [
    'appearance.closeRightbar',
    'appearance.openRightbar',
    'appearance.setFontSize',
    'appearance.setLocale',
    'appearance.setTheme',
    'appearance.state',
    'appearance.toggleSidebar',
  ])
  for (const name of names) {
    assert.equal(ACTIONS[name].requiresClient, true, `${name} must be a client action`)
    // None of these can widen the agent's authority, so none is destructive —
    // and therefore none is behind the confirmation gate.
    assert.equal(ACTIONS[name].destructive, false, `${name} must not be destructive`)
    assert.equal(ACTIONS[name].mutating, name !== 'appearance.state', `${name} mutation flag`)
  }
})

test('console.actions advertises the appearance flags the client work depends on', async () => {
  // The regression this exists for, found by mutation-testing: `core.test.mjs`'s
  // "every action row carries the full spec shape" asserts only that the flag
  // KEYS are present, so flipping `requiresClient` to false, marking a read as
  // mutating, or putting a theme switch behind the destructive gate all left the
  // suite green. This reads the flags back through the tool — the surface the
  // model actually sees — so a wrong flag is a failure rather than a silent
  // change in what the agent is told about its own capabilities.
  const { ctx, dispatch } = applyPlugin()
  ctx.__consoleChannel = { request: async () => ({ status: 'ok' }) }
  const result = await dispatch('console.actions', {})
  const rows = new Map(result.actions.map((row) => [row.name, row]))
  for (const name of Object.keys(ACTIONS).filter((a) => ACTIONS[a].domain === 'appearance')) {
    const row = rows.get(name)
    assert.ok(row, `${name} is registered but not advertised`)
    assert.equal(row.requiresClient, true, `${name} must be advertised as a client action`)
    assert.equal(row.destructive, false, `${name} must be advertised as non-destructive`)
    assert.equal(row.mutating, name !== 'appearance.state', `${name} mutation flag as advertised`)
    assert.equal(row.domain, 'appearance', `${name} must be advertised under its own domain`)
  }
})

test('a destructive appearance action would be refused, which is why none is marked so', async () => {
  // The consequence, through the real gate: with confirmDestructive on, a
  // destructive action refuses until the caller re-runs it with confirm: true.
  // If any appearance action were marked destructive, this is what the model
  // would hit — so the flags above are load-bearing, not cosmetic.
  let tool
  apply({
    get: () => undefined,
    logger: { info() {}, warn() {} },
    tools: { register: (registered) => { tool = registered } },
  }, { confirmDestructive: true, clientTimeoutMs: 20 })
  const results = []
  for (const name of Object.keys(ACTIONS).filter((a) => ACTIONS[a].domain === 'appearance')) {
    results.push([name, (await tool.execute({ action: name, args: { id: 'dark', role: 'text', px: 14 } })).status])
  }
  assert.deepEqual(
    results.filter(([, status]) => status === 'confirm-required'),
    [],
    'no appearance action may sit behind the confirmation gate',
  )
})

test('every advertised appearance action has exactly one name in the client drop table', async () => {
  // The domain's own dispatch table and the registry are two lists that must
  // agree: a name in the registry the client cannot apply would be advertised
  // and then always fail. (Tools never reach the client's real op switch until
  // Task 6/7, so this pins our half of the contract.)
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('../domains/appearance.js', import.meta.url), 'utf8')
  for (const name of Object.keys(ACTIONS).filter((a) => ACTIONS[a].domain === 'appearance')) {
    assert.ok(source.includes(`'${name}'`), `${name} is registered but the appearance domain does not name it`)
  }
})

// ---------------------------------------------------------------------------
// End to end through the real apply(): the dispatcher reaches the domain, the
// domain reaches the channel, and a closed interface is reported as such.
// ---------------------------------------------------------------------------

/**
 * Run the plugin's real `apply()` against a bare ctx and dispatch one action.
 *
 * `clientTimeoutMs` is passed explicitly: the shipped default is 5s, and a test
 * that waited it out twice would spend ten seconds proving nothing extra — the
 * default itself is pinned by `clientTimeoutMsFrom`'s own test below.
 *
 * The `ctx` is returned so a test can install the channel the way Task 7 will
 * (after `apply()` returns), which is the only seam that proves the domain reads
 * the channel lazily rather than capturing it at wiring time.
 */
function applyPlugin(config = { clientTimeoutMs: 20 }) {
  let tool
  const ctx = {
    get: () => undefined,
    logger: { info() {}, warn() {} },
    tools: { register: (registered) => { tool = registered } },
  }
  apply(ctx, config)
  return { ctx, dispatch: (action, args) => tool.execute({ action, args }) }
}

test('a registered appearance action reaches the domain through the real apply()', async () => {
  const { ctx, dispatch } = applyPlugin()
  const seen = []
  ctx.__consoleChannel = { request: async (op, args) => { seen.push({ op, args }); return { status: 'ok', value: 'wire' } } }
  const result = await dispatch('appearance.setTheme', { id: 'dark' })
  assert.deepEqual(result, { status: 'ok', value: 'wire' })
  assert.deepEqual(seen, [{ op: 'appearance.setTheme', args: { id: 'dark' } }])
})

test('the args the caller supplied are forwarded, not dropped or rewritten', async () => {
  // Covers every action with a distinct argument shape, including the two
  // properties the fake client would otherwise be handed as `{}`.
  const { ctx, dispatch } = applyPlugin()
  const seen = []
  ctx.__consoleChannel = { request: async (op, args) => { seen.push({ op, args }); return { status: 'ok' } } }
  const calls = [
    ['appearance.setTheme', { id: 'dark' }],
    ['appearance.setLocale', { id: 'zh-CN' }],
    ['appearance.setFontSize', { role: 'terminal', px: 13 }],
    ['appearance.openRightbar', { track: false, fullscreen: true }],
    ['appearance.state', {}],
  ]
  for (const [action, args] of calls) {
    assert.equal((await dispatch(action, args)).status, 'ok', `${action} must reach the channel`)
  }
  assert.deepEqual(seen, calls.map(([op, args]) => ({ op, args })))
})

test('the channel is read per call, so a client attached after apply() is found', async () => {
  // THE seam Task 7 needs. `webServer` binds its port during its own init and may
  // appear after this plugin's apply() has returned, so a channel captured at
  // wiring time would freeze the appearance domain onto a half-mounted transport
  // for the rest of the process. Nothing here is exotic: `applyPlugin` installs
  // the channel only after `apply()` has already returned.
  const { ctx, dispatch } = applyPlugin()
  const before = await dispatch('appearance.state', {})
  assert.equal(before.status, 'unavailable', 'nothing is attached yet, and that is reported')

  const seen = []
  ctx.__consoleChannel = { request: async (op) => { seen.push(op); return { status: 'ok', value: 'late' } } }
  const after = await dispatch('appearance.state', {})
  assert.equal(after.status, 'ok', 'a channel attached after apply() must be used')
  assert.deepEqual(seen, ['appearance.state'])
})

test('the same action reports unavailable through the tool when no client is connected', async () => {
  const { dispatch } = applyPlugin()
  const result = await dispatch('appearance.setTheme', { id: 'dark' })
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /interface/i)
})

test('apply() mounts a real channel, so the browser has somewhere to answer', async () => {
  // The other half of the wiring guard: `m70` proves the DOMAIN is wired, this
  // proves the CHANNEL is. Without it the domain exists and every appearance
  // action is permanently unavailable, which reads as "no interface is open"
  // even with the Web UI running — the failure mode this task exists to make
  // impossible.
  const { ctx } = applyPlugin()
  assert.ok(ctx.__consoleChannel, 'apply() must mount the console channel on the context')
  assert.equal(typeof ctx.__consoleChannel.request, 'function')
  assert.equal(typeof ctx.__consoleChannel.respond, 'function')
  assert.equal(typeof ctx.__consoleChannel.onRequest, 'function')
  assert.equal(ctx.__consoleChannel.pendingCount(), 0)

  // And it is the real channel: a request through it times out as unavailable
  // rather than throwing on a missing transport.
  const result = await ctx.__consoleChannel.request('appearance.state', {})
  assert.equal(result.status, 'unavailable')
})

test('appearance.state is read-only, so the confirmation gate never covers it', async () => {
  // Driven with confirmDestructive ON: a read that needs no confirmation is the
  // whole difference between this action and the six that mutate.
  let tool
  apply({
    get: () => undefined,
    logger: { info() {}, warn() {} },
    tools: { register: (registered) => { tool = registered } },
  }, { confirmDestructive: true, clientTimeoutMs: 20 })
  const result = await tool.execute({ action: 'appearance.state', args: {} })
  assert.notEqual(result.status, 'confirm-required')
  assert.equal(result.status, 'unavailable', 'still unavailable, never a made-up state')

  const mutating = await tool.execute({ action: 'appearance.setTheme', args: { id: 'dark' } })
  assert.notEqual(mutating.status, 'confirm-required', 'no appearance action is destructive')
})

test('the client timeout comes from config, and a malformed one falls back', async () => {
  // The default is 5s, so the discrimination here is the timing itself: a config
  // of 0 must settle on the next timer tick, and a nonsense value must not turn
  // the channel into an immediate-unavailable stub.
  const { dispatch: immediate } = applyPlugin({ clientTimeoutMs: 0 })
  assert.equal((await immediate('appearance.state', {})).status, 'unavailable')

  const { dispatch: fallback } = applyPlugin({ clientTimeoutMs: 'soon' })
  let settled = false
  const pending = fallback('appearance.state', {}).then((r) => { settled = true; return r })
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(settled, false, 'a malformed timeout must not mean "do not wait at all"')
  assert.equal((await pending).status, 'unavailable')
})

test('no appearance reply carries an undefined-valued key at any depth', async () => {
  // The tool pipeline snapshots every successful return recursively
  // (`dsh-util-values` walks with Reflect.ownKeys), so one bad key aborts the
  // whole value as INVALID_TOOL_OUTPUT.
  const { ctx, dispatch } = applyPlugin()
  ctx.__consoleChannel = { request: async () => ({ status: 'ok', op: 'appearance.state', value: 'x' }) }
  for (const action of Object.keys(ACTIONS).filter((a) => ACTIONS[a].domain === 'appearance')) {
    const result = await dispatch(action, { id: 'dark', role: 'text', px: 14 })
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)), `${action} is not lossless JSON`)
    assert.equal(scanForUndefined(result), 'none', `${action} emitted an undefined-valued key`)
  }
})

test('a client-owned payload that holds undefined is cleaned before it reaches the model', async () => {
  // THE domination path for this repository's lossless-JSON rule. `reply.value`
  // is arbitrary JSON written by the browser, so the channel is the one place in
  // this plugin whose payload it does not control — and the snapshot walk is
  // recursive, so ONE hole in the browser's answer would abort the whole tool
  // result as INVALID_TOOL_OUTPUT. Driven through the real channel (not a stub),
  // because the cleaning is the channel's own job.
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({
    id: req.id,
    ok: true,
    value: { theme: 'dark', dropped: undefined, nested: { keep: 1, gone: undefined }, list: [1, 'two'] },
  }))
  const { ctx, dispatch } = applyPlugin()
  ctx.__consoleChannel = channel
  const result = await dispatch('appearance.state', {})
  assert.equal(result.status, 'ok')
  assert.equal(scanForUndefined(result), 'none', 'a holey client payload must not reach the model')
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)), 'a holey client payload must stay serializable')
  // The value is relayed, not trimmed away: what the browser did report survives.
  assert.deepEqual(result.value, { theme: 'dark', nested: { keep: 1 }, list: [1, 'two'] })
})

test('a client answer can never replace the operation outcome', async () => {
  // `status` and `op` are written last in the channel's envelope, because the
  // value it describes comes from the browser. Driven against the real channel so
  // the assertion is about the envelope the channel builds, not about a stub.
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({
    id: req.id,
    ok: false,
    error: 'the layout service is unavailable',
    status: 'ok',
    op: 'appearance.setLocale',
    value: 'lied',
  }))
  const result = await channel.request('appearance.openRightbar', {})
  assert.equal(result.status, 'error', 'a client-supplied status must not overwrite the outcome')
  assert.equal(result.op, 'appearance.openRightbar', 'the op must name what was actually requested')
  assert.equal('value' in result, false, 'a refusal carries no value')
  assert.equal(result.reason, 'the layout service is unavailable')
})

/** Find the first undefined-valued key anywhere in a value, as a path string. */
function scanForUndefined(value, path = '$') {
  if (value === null || typeof value !== 'object') return 'none'
  for (const key of Reflect.ownKeys(value)) {
    const entry = value[key]
    if (entry === undefined) return `${path}.${String(key)}`
    const found = scanForUndefined(entry, `${path}.${String(key)}`)
    if (found !== 'none') return found
  }
  return 'none'
}

test('a client failure reaches the tool as an error, not as a success', async () => {
  const { ctx, dispatch } = applyPlugin()
  ctx.__consoleChannel = {
    request: async () => ({ status: 'error', op: 'appearance.setTheme', reason: 'no such theme' }),
  }
  const result = await dispatch('appearance.setTheme', { id: 'nope' })
  assert.equal(result.status, 'error')
  assert.equal(result.reason, 'no such theme')
})

test('the domain is reachable through createConsole without a Cordis context', async () => {
  // The seam is a plain function taking `(ctx, { action, args })`, exactly like
  // every other domain: no Cordis lifecycle, no service container.
  const console_ = createConsole({ get: () => undefined }, { appearance: appearanceDomain })
  const result = await console_.dispatch('appearance.state', {})
  assert.equal(result.status, 'unavailable')
})
