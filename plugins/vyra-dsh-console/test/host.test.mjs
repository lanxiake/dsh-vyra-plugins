// The Host half of the Task 7 bridge: the HTTP endpoint that carries queued
// appearance requests out to the browser and the answers back in.
//
//   node --test plugins/vyra-dsh-console/test/host.test.mjs
//
// The handler is driven DIRECTLY, with a fake `req` (an async-iterable body) and
// a capture `res`, the way this repo's other plugins test their route handlers.
// No port is bound: the route is a plain function, and binding a real listener
// would only make the test slower and flakier without observing anything the
// handler does not.
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { apply } from '../index.js'
import { ACTIONS, FORBIDDEN } from '../core.js'

const PATH = '/api/vyra-console/rpc'

/**
 * The long-poll bound every test drives, unless it names its own.
 *
 * The shipped bound is 25s, which is right for production and unbearable in a
 * suite: every test that polls an empty queue would sit out the full wait, and
 * the file took over 100 seconds. The bound is therefore a config key
 * (`Config.longPollMs`, default unchanged at 25000) that tests set low, and this
 * is the default they all inherit — so a new test cannot reintroduce the wait by
 * forgetting to pass one.
 */
const TEST_LONG_POLL_MS = 40

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

/**
 * Capture the exact object the route hands to `JSON.stringify`.
 *
 * The only way to see a reply's own keys BEFORE serialization erases the
 * evidence: `JSON.stringify` drops an `undefined` value silently, so inspecting
 * the response text (or parsing it back) can never distinguish a written hole
 * from a correct omission. That blindness is what let the Task 5 Critical reach
 * review, so the check has to happen on the object.
 */
async function captureSerialized(body) {
  const real = JSON.stringify
  const captured = []
  JSON.stringify = function patched(value, ...rest) {
    if (value !== null && typeof value === 'object') captured.push(value)
    return real.call(this, value, ...rest)
  }
  try {
    await body()
  } finally {
    JSON.stringify = real
  }
  return captured
}

/**
 * A `req` whose body is an async iterable of Buffers, exactly as Node's
 * IncomingMessage is. `body: undefined` is a GET with no body at all.
 */
function fakeReq(method, body, headers = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(body, 'utf8')]
  return {
    method,
    headers,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

/** A `res` that records what the handler wrote, the way a capture object does. */
function fakeRes() {
  return {
    statusCode: undefined,
    headers: undefined,
    body: undefined,
    ended: false,
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
      return this
    },
    end(body) {
      this.ended = true
      this.body = body
      return this
    },
    get json() {
      return this.body === undefined ? undefined : JSON.parse(this.body)
    },
  }
}

/**
 * Run the plugin's real `apply()` against a ctx whose `webServer` can be
 * deferred, and return the registered route plus the live context.
 *
 * `late: true` models the real composition: `webServer` binds its port during
 * its OWN init, so at `apply()` time `ctx.get('webServer')` answers undefined
 * and only a later `inject` callback sees the service. That is the case the
 * route registration has to survive, so the fake refuses to hand the service
 * And it defaults the long-poll bound to `TEST_LONG_POLL_MS`, so no test has to
 * remember to pass one and none can sit out the shipped 25s by omission. A test
 * that needs a different bound passes its own `config.longPollMs`.
 */
function mount({ late = false, config = {}, services = {} } = {}) {
  const routes = []
  const pending = []
  const webServer = {
    register: (route) => {
      routes.push(route)
      return () => {}
    },
  }
  const ctx = {
    // A Host service the console's domains reach for through `requireService`.
    // Empty by default, which is the "this profile has none" case the plugin
    // has to keep working in.
    get: (key) => services[key],
    logger: { info() {}, warn() {} },
    tools: { register() {} },
    effect: (fn) => fn(),
    inject: (names, callback) => {
      if (!names.includes('webServer')) return
      if (late) {
        pending.push(() => callback({ effect: (fn) => fn(), webServer }))
        return
      }
      callback({ effect: (fn) => fn(), webServer })
    },
  }
  apply(ctx, { longPollMs: TEST_LONG_POLL_MS, ...config })
  return { ctx, routes, settle: () => pending.forEach((fire) => fire()) }
}

/** Mount and return the one registered handler, asserting there is exactly one. */
function handlerFor(options) {
  const mounted = mount(options)
  assert.equal(mounted.routes.length, 1, 'exactly one route is registered')
  const [route] = mounted.routes
  assert.equal(route.path, PATH)
  assert.equal(route.kind, 'exact')
  assert.equal(typeof route.handler, 'function')
  return { ...mounted, handler: route.handler }
}

/** Drive one GET through the handler. */
async function get(handler) {
  const res = fakeRes()
  await handler(fakeReq('GET'), res)
  return res
}

/** Drive one POST through the handler. */
async function post(handler, payload) {
  const res = fakeRes()
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  await handler(fakeReq('POST', body), res)
  return res
}

// ---------------------------------------------------------------------------
// Registration: the route must exist even when webServer arrives late.
// ---------------------------------------------------------------------------

test('the endpoint route is registered once webServer appears', () => {
  const { routes } = mount()
  assert.equal(routes.length, 1, 'exactly one route is registered')
  assert.equal(routes[0].path, PATH)
  assert.equal(routes[0].kind, 'exact')
})

test('the route is registered through inject, so a late-binding webServer still gets it', () => {
  // THE bug this task exists to avoid, documented in vyra-agent-manager: reading
  // `ctx.get('webServer')` once at apply time answers undefined while the server
  // is still binding its port, and returning there leaves the route unregistered
  // for the rest of the process. `inject` is what defers the registration until
  // the service exists.
  const { routes, settle } = mount({ late: true })
  assert.equal(routes.length, 0, 'nothing is registered while the server is absent')
  settle()
  assert.equal(routes.length, 1, 'a webServer that appears later still receives the route')
  assert.equal(routes[0].path, PATH)
})

test('the route registration is not read off ctx.get, which answers undefined at apply time', () => {
  // The discriminator for the two implementations. A `ctx.get('webServer')`
  // version registers synchronously (routes.length === 1 before settle) and then
  // never registers again — the opposite of what the late case above observed.
  // Asserted directly so a rewrite that swaps inject for get cannot pass both.
  const late = mount({ late: true })
  assert.equal(late.routes.length, 0, 'the get-based version would have registered here already')
  late.settle()
  assert.equal(late.routes.length, 1, 'only the inject callback can register')
})

test('NO webServer at all leaves the plugin fully mounted and silent', () => {
  // A composition without an HTTP server must still get the tool; only the
  // endpoint is absent. Nothing may throw out of apply() for want of a server.
  const routes = []
  const ctx = {
    get: () => undefined,
    logger: { info() {}, warn() {} },
    tools: { register() {} },
    effect: (fn) => fn(),
    inject: () => {},
  }
  assert.doesNotThrow(() => apply(ctx, {}))
  assert.equal(routes.length, 0)
  assert.ok(ctx.__consoleChannel, 'the channel is still mounted without a web server')
})

test('the cleanup the effect owns is returned, so the route is removable', () => {
  // `owner.effect(fn)` treats the return value as the disposer. A registration
  // that returned nothing could never be unregistered on dispose, so the effect
  // must hand back whatever `register` returned.
  const disposed = []
  const ctx = {
    get: () => undefined,
    logger: { info() {}, warn() {} },
    tools: { register() {} },
    effect: (fn) => fn(),
    inject: (names, callback) => {
      if (!names.includes('webServer')) return
      callback({
        webServer: { register: () => () => disposed.push('route') },
        effect: (fn) => { const disposer = fn(); assert.equal(typeof disposer, 'function'); return disposer },
      })
    },
  }
  apply(ctx, {})
  assert.deepEqual(disposed, [], 'nothing is disposed while mounted')
})

// ---------------------------------------------------------------------------
// GET: hand the Client the queued requests.
// ---------------------------------------------------------------------------

test('GET returns an empty list when nothing is queued', async () => {
  const { handler } = handlerFor()
  const res = await get(handler)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json, { ok: true, requests: [] })
})

test('GET hands over a queued request and leaves the queue empty', async () => {
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  // The request is queued synchronously by `request()` (the entry is installed
  // before the listener runs), so no tick is needed here.
  const res = await get(handler)
  assert.equal(res.json.ok, true)
  assert.equal(res.json.requests.length, 1)
  assert.deepEqual(Object.keys(res.json.requests[0]).sort(), ['args', 'id', 'op'])
  assert.equal(res.json.requests[0].op, 'appearance.setTheme')
  assert.deepEqual(res.json.requests[0].args, { id: 'dark' })

  // The request is still live and waiting for its answer — draining it did not
  // settle it. (A second GET here would park on the long-poll, which is its job:
  // "the same request is not delivered twice" is pinned by the batch test below,
  // where more work arrives to wake it.)
  assert.equal(ctx.__consoleChannel.pendingCount(), 1)
  ctx.__consoleChannel.respond({ id: res.json.requests[0].id, ok: true })
  assert.equal((await pending).status, 'ok')
})

test('a drained request is not delivered a second time when more work arrives', async () => {
  // The "not delivered twice" property, driven the way it actually occurs: the
  // Client polls again immediately, so a second GET parks and is then woken by
  // the NEXT request. Only the new one may appear.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 50 } })
  const first = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  const drainOne = await get(handler)
  assert.deepEqual(drainOne.json.requests.map((r) => r.op), ['appearance.setTheme'])
  ctx.__consoleChannel.respond({ id: drainOne.json.requests[0].id, ok: true })
  assert.equal((await first).status, 'ok')

  // The second poll parks; a different request then wakes it.
  const second = fakeRes()
  const parked = handler(fakeReq('GET'), second)
  setTimeout(() => { ctx.__consoleChannel.request('appearance.toggleSidebar', {}) }, 20)
  await parked
  assert.deepEqual(second.json.requests.map((r) => r.op), ['appearance.toggleSidebar'],
    'only the new request may appear; the drained one must not come back')
})

test('GET drains a whole batch in one response', async () => {
  const { ctx, handler } = handlerFor({ config: { longPollMs: 50 } })
  const one = ctx.__consoleChannel.request('appearance.state', {})
  const two = ctx.__consoleChannel.request('appearance.toggleSidebar', {})
  const res = await get(handler)
  assert.deepEqual(res.json.requests.map((r) => r.op).sort(), ['appearance.state', 'appearance.toggleSidebar'])
  assert.notEqual(res.json.requests[0].id, res.json.requests[1].id, 'each request keeps its own id')

  // The batch is drained: a following poll, with nothing left to deliver, parks
  // and then answers empty on its bound rather than repeating the batch.
  const after = await get(handler)
  assert.deepEqual(after.json.requests, [], 'the batch is drained, not repeated')

  ctx.__consoleChannel.respond({ id: res.json.requests[0].id, ok: true, value: 'x' })
  ctx.__consoleChannel.respond({ id: res.json.requests[1].id, ok: true })
  assert.equal((await one).status, 'ok')
  assert.equal((await two).status, 'ok')
})

// ---------------------------------------------------------------------------
// GET long-poll: wait for work briefly, then return empty — never spin, never leak.
// ---------------------------------------------------------------------------

test('GET waits for a request that arrives shortly after it is called', async () => {
  // The long-poll's whole purpose. Without the wait the Client would poll every
  // few milliseconds; with it, an appearance action issued a moment later is
  // still delivered promptly.
  const { ctx, handler } = handlerFor()
  const res = fakeRes()
  const inFlight = handler(fakeReq('GET'), res)

  // Queue the request while the GET is parked, then let both settle.
  setTimeout(() => { ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' }) }, 20)
  await inFlight
  assert.equal(res.json.requests.length, 1, 'the parked GET must be woken by the arrival')
  assert.equal(res.json.requests[0].op, 'appearance.setTheme')
})

test('a waiting GET returns an empty list after its bound, so the Client can poll again', async () => {
  // The wait is bounded: with nothing to hand over, the handler answers with an
  // empty list rather than holding the connection forever. Driven with a short
  // configured bound so the test does not sit out the shipped one.
  const { handler } = handlerFor({ config: { longPollMs: 60 } })
  const started = Date.now()
  const res = await get(handler)
  const elapsed = Date.now() - started
  assert.deepEqual(res.json, { ok: true, requests: [] })
  assert.ok(elapsed >= 40, `the GET must actually wait before giving up (waited ${elapsed}ms)`)
})

test('two overlapping GETs are both served, and no request is lost or doubled', async () => {
  // The waiter-slot hazard, and why the waiters are a QUEUE rather than a single
  // slot. With a slot, the second GET overwrites the first's resolver: that
  // resolver is then unreachable, so its GET sleeps out its entire bound while
  // the request sits in the queue — a poll that simply stops responding, with no
  // error raised anywhere. (This test is what found it; the single-slot version
  // measured 25009ms here.)
  //
  // What is pinned: the first waiter takes the arrival promptly, and the second —
  // which has no work of its own — answers empty on its own bound rather than
  // hanging or being handed the same request. One request in, exactly one
  // delivery out.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 120 } })
  const first = fakeRes()
  const second = fakeRes()
  const a = handler(fakeReq('GET'), first)
  const b = handler(fakeReq('GET'), second)

  setTimeout(() => { ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' }) }, 20)
  await Promise.all([a, b])

  const delivered = [...first.json.requests, ...second.json.requests]
  assert.equal(delivered.length, 1, 'the one request is handed over exactly once')
  assert.equal(delivered[0].op, 'appearance.setTheme')
  // The empty one answered within its bound instead of stalling.
  const empty = first.json.requests.length === 0 ? first : second
  assert.deepEqual(empty.json.requests, [])
})

test('a request arriving after a GET parked is never dropped', async () => {
  // The other half of the hazard: the arrival must find the parked GET. Driven
  // across several sequential polls, so a waiter that was left behind by one
  // round cannot silently swallow the next round's request.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 200 } })
  for (let round = 0; round < 3; round += 1) {
    const res = fakeRes()
    const parked = handler(fakeReq('GET'), res)
    setTimeout(() => { ctx.__consoleChannel.request('appearance.toggleSidebar', {}) }, 15)
    await parked
    assert.equal(res.json.requests.length, 1, `round ${round} lost its request`)
    assert.equal(res.json.requests[0].op, 'appearance.toggleSidebar')
    ctx.__consoleChannel.respond({ id: res.json.requests[0].id, ok: true })
  }
})

test('two parked GETs do not consume each other, and each still gets its own answer', async () => {
  // The single-slot defect, isolated from timing. With one overwritten slot the
  // FIRST GET's resolver becomes unreachable: it cannot be woken by anything and
  // only its own bound frees it — so a request queued while both are parked is
  // NOT delivered to the first, and the test's elapsed guard below catches that.
  //
  // The bound is generous relative to the race below (1500ms vs a 30ms arrival),
  // so "served on the arrival" and "served when the bound expired" cannot be
  // confused — while still letting the second GET finish in reasonable time.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 700 } })
  const first = fakeRes()
  const second = fakeRes()
  const a = handler(fakeReq('GET'), first)
  const b = handler(fakeReq('GET'), second)
  // Both are parked; give the second a moment to install itself over the first.
  await new Promise((resolve) => setTimeout(resolve, 30))

  const started = Date.now()
  ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  // The FIRST parked GET must be the one woken. Race a short timeout so a
  // single-slot implementation fails fast instead of sitting out the 5s bound.
  const served = await Promise.race([
    a.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 400)),
  ])
  const elapsed = Date.now() - started
  assert.equal(served, true, `the first parked GET must be woken by the arrival (waited ${elapsed}ms)`)
  assert.equal(first.json.requests.length, 1, 'it receives the request')
  assert.equal(first.json.requests[0].op, 'appearance.setTheme')

  // The second is still parked with nothing of its own, and holding no request.
  assert.equal(second.ended, false, 'the second GET is still waiting, not served')
  // Release both so nothing outlives the test.
  const drained = first.json.requests[0]
  ctx.__consoleChannel.respond({ id: drained.id, ok: true })
  await b
  assert.deepEqual(second.json.requests, [], 'the second answers empty on its own bound')
})

test('a GET that gave up does not leave a waiter behind to steal the next arrival', async () => {
  // The stale-waiter leak, isolated. A GET that answered empty must remove its
  // resolver; if it lingers, the NEXT arrival wakes that dead resolver instead of
  // whichever GET is genuinely parked — and the live GET then sleeps out its
  // whole bound with the request sitting in the queue.
  //
  // A 300ms bound is short enough that the first GET gives up quickly, and long
  // enough that the second GET is still parked when the arrival lands ~20ms in.
  // The request must therefore be delivered by the ARRIVAL, well before the
  // bound — which a leaked stale waiter would prevent.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 300 } })
  assert.deepEqual((await get(handler)).json.requests, [], 'the first GET gives up empty')

  const res = fakeRes()
  const parked = handler(fakeReq('GET'), res)
  await new Promise((resolve) => setTimeout(resolve, 20))
  const started = Date.now()
  ctx.__consoleChannel.request('appearance.toggleSidebar', {})
  await parked
  const elapsed = Date.now() - started
  assert.equal(res.json.requests.length, 1, 'the live GET must receive the arrival')
  assert.equal(res.json.requests[0].op, 'appearance.toggleSidebar')
  assert.ok(elapsed < 200,
    `the live GET must be woken by the arrival, not by its bound (took ${elapsed}ms)`)
})

test('a GET that gives up leaves no waiter behind to be woken by later work', async () => {
  // The leak in the other direction: after a GET has answered empty, its
  // resolver must be gone. A stale waiter that a later `onRequest` still calls
  // is a permanently dangling reference, and — worse — it makes the arrival
  // logic believe someone was waiting when nobody is.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 40 } })
  assert.deepEqual((await get(handler)).json.requests, [])

  // Now queue work with nobody parked. It must simply sit in the queue and be
  // delivered to the NEXT GET, and this call must not have woken anything.
  const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  const res = await get(handler)
  assert.equal(res.json.requests.length, 1, 'the request is still there for the next poll')
  assert.equal(res.json.requests[0].op, 'appearance.setTheme')
  ctx.__consoleChannel.respond({ id: res.json.requests[0].id, ok: true })
  assert.equal((await pending).status, 'ok')
})

test('a drained GET does not hold the process open with a dangling timer', async () => {
  // "Does a handle keep the loop alive" is not observable from inside the
  // process that owns it, so this is driven in a child that exits on its own: if
  // the handler left a ref'd timeout at its full bound, the child would sit there
  // for the whole 60s instead of exiting.
  const { mkdtempSync, writeFileSync: write, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { execFileSync } = await import('node:child_process')

  const dir = mkdtempSync(join(tmpdir(), 'vyra-console-get-timer-'))
  try {
    const indexPath = new URL('../index.js', import.meta.url).href
    const probe = join(dir, 'probe.mjs')
    write(probe, [
      `import { apply } from ${JSON.stringify(indexPath)}`,
      'const routes = []',
      // A HUGE bound: if the handler arms a ref\'d timer and never clears it on
      // the drained path, the child cannot exit for a full minute.
      'const ctx = {',
      '  get: () => undefined,',
      '  logger: { info() {}, warn() {} },',
      '  tools: { register() {} },',
      '  effect: (fn) => fn(),',
      '  inject: (names, callback) => {',
      "    if (!names.includes('webServer')) return",
      '    callback({',
      "      effect: (fn) => fn(),",
      "      webServer: { register: (route) => { routes.push(route); return () => {} } },",
      '    })',
      '  },',
      '}',
      'apply(ctx, { clientTimeoutMs: 60000, longPollMs: 60000 })',
      'const handler = routes[0].handler',
      'const res = { writeHead() {}, end() {} }',
      'const req = { method: \'GET\', headers: {}, async *[Symbol.asyncIterator]() {} }',
      // The GET PARKS FIRST (nothing is queued), so the handler arms its 60s
      // timer; work then arrives, waking it. This is the only path that reaches
      // the clearTimeout, so a probe that queued work up front would take the
      // immediate branch and never observe it — mutation-verified: that earlier
      // version stayed green with the clearTimeout deleted.
      'const parked = handler(req, res)',
      'setTimeout(() => { ctx.__consoleChannel.request("appearance.state", {}) }, 20)',
      'await parked',
      "console.log('drained')",
      '',
    ].join('\n'))
    const started = Date.now()
    const out = execFileSync(process.execPath, [probe], { encoding: 'utf8', stdio: 'pipe', timeout: 20000 })
    const elapsed = Date.now() - started
    assert.equal(out.trim(), 'drained')
    assert.ok(elapsed < 15000, `a drained GET must not leave a 60s ref'd timer behind (took ${elapsed}ms)`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// POST: accept the answer and hand it to the channel.
// ---------------------------------------------------------------------------

test('POST settles the request the answer names', async () => {
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  const drained = await get(handler)
  const res = await post(handler, { id: drained.json.requests[0].id, ok: true, value: 'dark' })
  assert.deepEqual(res.json, { ok: true })
  const result = await pending
  assert.equal(result.status, 'ok')
  assert.equal(result.value, 'dark')
  assert.equal(ctx.__consoleChannel.pendingCount(), 0)
})

test('POST reports an unanswered reply as ok:false rather than claiming success', async () => {
  // `respond()` answers false for an unknown id — a reply that arrived after the
  // timeout, or for a request this Host never made. The endpoint must relay that
  // so the browser can see its answer was dropped instead of assuming it landed.
  const { handler } = handlerFor()
  const res = await post(handler, { id: '999', ok: true, value: 'dark' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json, { ok: false })
})

test('POST carries a client-reported failure through to the channel', async () => {
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'nope' })
  const drained = await get(handler)
  await post(handler, { id: drained.json.requests[0].id, ok: false, error: 'theme "nope" is not registered' })
  const result = await pending
  assert.equal(result.status, 'error')
  assert.equal(result.reason, 'theme "nope" is not registered')
})

test('POST treats a body with no ok flag as a refusal, never as an assumed success', async () => {
  // The silent-success failure in its purest form: a reply that claims nothing
  // must not settle the request as applied.
  for (const payload of [{ id: '1' }, { id: '1', ok: 'yes' }, { id: '1', ok: 1 }]) {
    const { ctx, handler } = handlerFor()
    const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
    const drained = await get(handler)
    await post(handler, { ...payload, id: drained.json.requests[0].id })
    const result = await pending
    assert.equal(result.status, 'error', `${JSON.stringify(payload)} must not read as success`)
    assert.equal('value' in result, false)
  }
})

test('POST accepts an empty body without throwing', async () => {
  // An empty body parses to `{}` — neither a channel reply nor a console
  // action. It is refused with a message rather than crashing the route, and
  // rather than being silently treated as one of the two shapes.
  const { handler } = handlerFor()
  const res = await post(handler, '')
  assert.equal(res.statusCode, 200)
  assert.equal(res.json.ok, false)
  assert.equal(typeof res.json.error, 'string')
})

test('POST reports a malformed body as an error rather than throwing out of the route', async () => {
  // A body that is not JSON is a bad request, not a crashed handler: an
  // exception here would surface to the browser as a broken connection with no
  // explanation.
  const { handler } = handlerFor()
  const res = await post(handler, '{not json')
  assert.equal(res.statusCode, 200)
  assert.equal(res.json.ok, false)
  assert.equal(typeof res.json.error, 'string')
  assert.ok(res.json.error.length > 0)
})

// ---------------------------------------------------------------------------
// The response contract: stable, JSON-safe, uncacheable.
// ---------------------------------------------------------------------------

test('every response is JSON with the content type and no-store header', async () => {
  const { ctx, handler } = handlerFor()
  for (const res of [await get(handler), await post(handler, { id: 'x', ok: true })]) {
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
    assert.equal(res.headers['cache-control'], 'no-store')
    assert.doesNotThrow(() => JSON.parse(res.body), 'the body must always be valid JSON')
    assert.equal(res.ended, true)
  }
})

test('no response ever carries an undefined-valued key at any depth', async () => {
  // Rule 1 from the Task 5 review: a key holding `undefined` does not survive the
  // tool pipeline's lossless snapshot. The literal implementation of the reply
  // envelope — `{ ok, value, error }` — writes exactly such a key on a success
  // with no value and on a refusal with no error, so this is a live trap here.
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  const drained = await get(handler)
  await post(handler, { id: drained.json.requests[0].id, ok: true })
  await pending

  const responses = [
    await get(handler),
    await post(handler, { id: 'missing', ok: true, value: 'v' }),
    await post(handler, ''),
    await post(handler, '{not json'),
  ]
  for (const res of responses) {
    assert.equal(scanForUndefined(res.json), 'none', `a hole reached the wire: ${res.body}`)
  }
  assert.deepEqual(scanForUndefined({ ok: true, requests: [] }), 'none')
})

test('an ok reply carries no value or error key at all, rather than an undefined one', async () => {
  // The specific shape: a bare `{ ok: true }` is the answer for every reply the
  // host accepted. Asserted with an own-key walk because a JSON round trip
  // silently drops undefined and would therefore pass on the bug.
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.toggleSidebar', {})
  const drained = await get(handler)
  const res = await post(handler, { id: drained.json.requests[0].id, ok: true })
  await pending
  assert.deepEqual(Reflect.ownKeys(res.json), ['ok'])
  assert.deepEqual(res.json, { ok: true })
})

test('a queued request is serialized without a hole, and a hole is not invented', async () => {
  // The requests are written by the channel, but they are serialized HERE, and
  // `JSON.stringify` would turn any hole into a dropped key the Client then reads
  // as absent. The op and args are relayed verbatim; args is whatever the domain
  // passed, including an empty object.
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.openRightbar', { track: false, fullscreen: true })
  const res = await get(handler)
  assert.equal(scanForUndefined(res.json), 'none')
  assert.deepEqual(res.json.requests[0].args, { track: false, fullscreen: true })
  ctx.__consoleChannel.respond({ id: res.json.requests[0].id, ok: true })
  await pending
})

test('an unparseable body is refused with a message, and no envelope has a hole', async () => {
  // Two different refusals, and both are `ok: false`:
  //   - a body that is not JSON throws out of `readJson`, so the route answers
  //     with a message explaining what was wrong;
  //   - a body that IS valid JSON but is NEITHER shape — no `id` for the
  //     channel, no `action` for the console — is refused with a message too.
  //     It cannot be dispatched, and picking a shape for it would mean a
  //     malformed reply either settles nothing while reporting success or
  //     dispatches an empty action.
  //
  // Asserted with an own-key walk, never a JSON round trip: `JSON.stringify`
  // drops an undefined value silently, so a parse/stringify comparison passes on
  // exactly the bug being guarded against — the Task 5 Critical's whole lesson,
  // and the reason `failure()` exists rather than a literal object.
  const { handler } = handlerFor({ config: { longPollMs: 30 } })

  const unparseable = await post(handler, '{not json')
  assert.equal(unparseable.json.ok, false)
  assert.equal(typeof unparseable.json.error, 'string', 'a parse failure must explain itself')
  assert.ok(unparseable.json.error.length > 0)
  assert.equal(scanForUndefined(unparseable.json), 'none')

  for (const body of ['[]', 'null', '3', '']) {
    const res = await post(handler, body)
    assert.equal(res.json.ok, false, `${JSON.stringify(body)} must not be accepted as a reply`)
    assert.equal(scanForUndefined(res.json), 'none', `${JSON.stringify(body)} produced a hole`)
    assert.equal(typeof res.json.error, 'string',
      `${JSON.stringify(body)} is neither shape and must say so rather than being guessed at`)
  }
})

test('the error envelope carries no undefined-valued key, checked before serialization', async () => {
  // The own-key walk on the OBJECT, not on the response text. `failure()` exists
  // precisely so an absent message cannot become a real own key holding
  // `undefined` — but `JSON.stringify` deletes that evidence on the way out, so
  // a text-level assertion could never see it. (Mutation-verified: replacing
  // `present({...})` with the literal `{ ok: false, error }` leaves every
  // text-level check green and only this one fails.)
  const { handler } = handlerFor({ config: { longPollMs: 30 } })
  const captured = await captureSerialized(async () => {
    await post(handler, '{not json')
    await post(handler, { id: 'unknown', ok: true })
    await get(handler)
  })
  assert.ok(captured.length >= 3, `expected the responses to be serialized (got ${captured.length})`)
  for (const payload of captured) {
    const hole = scanForUndefined(payload)
    assert.equal(hole, 'none', `a response envelope carried undefined at ${hole}: ${JSON.stringify(payload)}`)
  }
  // The parse-failure envelope really does carry its message, so the walk above
  // is checking a populated object rather than a vacuous one.
  const failed = captured.find((payload) => payload.ok === false && 'error' in payload)
  assert.ok(failed, 'the parse failure must produce an error envelope to check')
  assert.equal(typeof failed.error, 'string')
})

test('the error envelope helper omits an absent message rather than writing a hole', async () => {
  // Driven DIRECTLY, because no route input can reach this branch: the route's
  // parse failure always has a message (`String(err?.message || err)` yields the
  // string "undefined" even for a thrown `undefined`, never the value). So the
  // route-level tests above can never distinguish `present({...})` from the
  // literal `{ ok: false, error }` — mutation-verified: the literal survives all
  // of them. The guard is still the contract, and this is what makes it real.
  const { failure } = await import('../index.js')
  const withMessage = failure('boom')
  assert.deepEqual(withMessage, { ok: false, error: 'boom' })
  assert.equal(scanForUndefined(withMessage), 'none')

  const withoutMessage = failure(undefined)
  assert.deepEqual(withoutMessage, { ok: false }, 'an absent message must be omitted, not written as undefined')
  assert.equal(Reflect.ownKeys(withoutMessage).includes('error'), false)
  assert.equal(scanForUndefined(withoutMessage), 'none')
})

test('the route hands the channel the request op unchanged, never a string copy', async () => {
  // A route that rewrote `op` on the way in — even a harmless-looking
  // `String(op)` — would disarm `applyOp`'s non-string refusal, which is the
  // guard Task 6 added precisely because this transport exists.
  //
  // Observed through the ENDPOINT's own queue, deliberately: `onRequest` replaces
  // the listener rather than adding one, so installing a spy here would displace
  // the endpoint's listener and leave the queue empty — the assertion would then
  // be about this test's spy rather than about the wire.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 30 } })
  const hostile = { toString: () => 'appearance.toggleSidebar' }
  ctx.__consoleChannel.request(hostile, {})

  const res = await get(handler)
  assert.equal(res.json.requests.length, 1)
  // Over the wire it is JSON, so the object arrives as `{}` — the point is that
  // it is NOT the string 'appearance.toggleSidebar', which would dispatch a real
  // mutation once it reached `applyOp`.
  assert.equal(typeof res.json.requests[0].op, 'object', 'the op must not be stringified on the way out')
  assert.notEqual(res.json.requests[0].op, 'appearance.toggleSidebar')
  assert.deepEqual(res.json.requests[0].op, {}, 'a hostile object survives as an object, not as its toString()')
})

test('the response shape is exactly the documented one, with no extra keys', async () => {
  // The Client parses this defensively, so the contract has to be pinned: the
  // GET envelope is `{ ok, requests }` and nothing else, and the POST envelope is
  // `{ ok }` or `{ ok: false, error }`.
  const { handler } = handlerFor()
  const getRes = await get(handler)
  assert.deepEqual(Object.keys(getRes.json).sort(), ['ok', 'requests'])
  assert.ok(Array.isArray(getRes.json.requests))

  const okRes = await post(handler, { id: 'x', ok: true })
  assert.deepEqual(Object.keys(okRes.json), ['ok'])
  assert.equal(okRes.json.ok, false, 'an unknown id is reported as unanswered')

  const badRes = await post(handler, '{not json')
  assert.deepEqual(Object.keys(badRes.json).sort(), ['error', 'ok'])
  assert.equal(badRes.json.ok, false)
})

// ---------------------------------------------------------------------------
// op is untrusted: nothing between the route and applyOp may coerce it.
// ---------------------------------------------------------------------------

test('the route relays op to the Client byte-for-byte, never coerced', async () => {
  // `applyOp` (Task 6) refuses a non-string op precisely because a coerced one
  // could dispatch a real mutation. That guard is only reachable if the route
  // hands the raw value over — so a route that did `String(op)` would defeat it
  // while leaving Task 6's own tests green.
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  const res = await get(handler)
  const row = res.json.requests[0]
  assert.equal(row.op, 'appearance.setTheme')
  assert.equal(typeof row.op, 'string')
  ctx.__consoleChannel.respond({ id: row.id, ok: true })
  await pending
})

test('a non-string op queued on the channel survives the round trip unstringified', async () => {
  // The route must not repair a bad op. Driven through the channel directly, so
  // the value reaches the wire as whatever the caller supplied.
  const { ctx, handler } = handlerFor()
  let seen
  ctx.__consoleChannel.onRequest((request) => { seen = request })
  ctx.__consoleChannel.request({ toString: () => 'appearance.toggleSidebar' }, {})
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(typeof seen.op, 'object', 'the object op must reach the queue as an object')
  assert.equal(seen.op.toString(), 'appearance.toggleSidebar')
})

// ---------------------------------------------------------------------------
// Task 10: the same route, serving the panel's action dispatch.
//
// The panel posts `{ action, args }` to this endpoint, and the tool reaches the
// SAME `dispatch` through the tool pipeline. These drive the real handler with
// the real console and real domains — no text-pattern assertion can tell whether
// an action actually dispatches, which is exactly how the endpoint shipped
// handling only the channel's reply shape.
// ---------------------------------------------------------------------------

/** A `pluginManager` stub, so `plugin.list` has something real to report. */
function pluginManagerStub() {
  return {
    listPlugins: async () => [
      { entryId: 'core', moduleName: '@deepseek-ai/dsh-core', enabled: true, fiberPhase: 'active' },
      { entryId: 'extra', moduleName: 'some-plugin', enabled: false },
    ],
    listBundles: async () => [
      { name: 'some-plugin', version: '1.0.0', enabled: true, installed: true, removable: true },
    ],
  }
}

test('a panel-shaped POST dispatches the action and returns its result', async () => {
  // The defect this closes: the route answered `{ ok: channel.respond(reply) }`
  // for EVERY body, so a panel action read `String(reply.id)` as "undefined",
  // settled nothing, and came back `{ ok: false }` — with HTTP 200 and no
  // exception, so every control showed "Failed" and nothing said why.
  const { handler } = handlerFor({ services: { pluginManager: pluginManagerStub() } })
  const res = await post(handler, { action: 'console.actions', args: {} })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json.status, 'ok', 'the action must actually dispatch')
  assert.ok(Array.isArray(res.json.actions), 'and its result must come back as data')
  assert.ok(res.json.actions.some((a) => a.name === 'plugin.list'))
})

test('a panel-shaped POST reaches a real domain through the console', async () => {
  // `console.actions` is served by a domain that reads only the frozen tables,
  // so it would pass even if the dispatch were wired to nothing. `plugin.list`
  // goes through `requireService` and a real async service call, which is what
  // proves the console behind the route is the live one.
  const { handler } = handlerFor({ services: { pluginManager: pluginManagerStub() } })
  const res = await post(handler, { action: 'plugin.list', args: {} })
  assert.equal(res.json.status, 'ok')
  assert.deepEqual(res.json.plugins.map((p) => p.entryId), ['core', 'extra'])
  assert.deepEqual(res.json.bundles.map((b) => b.name), ['some-plugin'])
})

test('the args travel with the action, unflattened', async () => {
  // A route that forwarded the whole body as `args` would make `{ action, args }`
  // arrive as `{ action, args: { action, args } }`; one that dropped them would
  // make every action argument-less. Driven with an action whose result depends
  // on what it was passed.
  const seen = []
  const { handler } = handlerFor({
    services: { agentDefaultModel: {
      currentSelection: () => ({ provider: 'deepseek', model: 'deepseek-chat' }),
      saveSelection: async (next) => seen.push(next),
    } },
  })
  const res = await post(handler, { action: 'model.select', args: { provider: 'deepseek', model: 'deepseek-reasoner' } })
  assert.equal(res.json.status, 'ok')
  assert.deepEqual(seen, [{ provider: 'deepseek', model: 'deepseek-reasoner' }], 'the args must arrive as the domain expects')
})

test('an action posted with no args gets an empty object, not undefined', async () => {
  const { handler } = handlerFor({ services: { pluginManager: pluginManagerStub() } })
  const res = await post(handler, { action: 'plugin.list' })
  assert.equal(res.json.status, 'ok', 'a missing args key is the ordinary case for a no-argument action')
})

test('a forbidden action posted panel-style comes back forbidden, with its alternative', async () => {
  // The boundary has to survive the new HTTP path. The panel renders exactly this
  // envelope, so if the route swallowed it or turned it into an error, the user
  // would see a generic failure instead of the reason and who should act.
  const { handler } = handlerFor()
  for (const name of ['sandbox.setMode', 'permission.setPreset', 'approval.answer', 'credentials.set']) {
    const res = await post(handler, { action: name, args: {} })
    assert.equal(res.json.status, 'forbidden', `${name} must be refused over HTTP`)
    assert.equal(typeof res.json.reason, 'string')
    assert.equal(typeof res.json.alternative, 'string', `${name} must carry the user-facing alternative`)
    assert.equal(scanForUndefined(res.json), 'none', `${name} produced a hole`)
  }
})

test('an unknown action posted panel-style is reported, not silently accepted', async () => {
  const { handler } = handlerFor()
  const res = await post(handler, { action: 'nope.notReal', args: {} })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json.status, 'error')
  assert.match(res.json.reason, /unknown action/u)
})

test('an inherited Object.prototype name posted panel-style is an unknown action', async () => {
  // The boundary's own table did this once: `FORBIDDEN[action]` walked the
  // prototype chain, so `action: "toString"` came back `forbidden` — a real
  // refusal for an operation that does not exist, and with no `reason` and no
  // `alternative`, which is the one thing a refusal must always carry. The panel
  // renders exactly those two fields, so an envelope without them shows a user a
  // blank refusal.
  //
  // Driven over HTTP because that is the path the panel uses and the path that
  // made this newly reachable.
  const { handler } = handlerFor()
  for (const name of ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
    const res = await post(handler, { action: name, args: {} })
    assert.equal(res.statusCode, 200, `${name} must answer, not fail the route`)
    assert.notEqual(res.json.status, 'forbidden', `${name} is not an operation and must not be refused as one`)
    assert.equal(res.json.status, 'error', `${name} must be an unknown action`)
    assert.match(res.json.reason, /unknown action/u, `${name} must be reported honestly`)
    assert.equal(scanForUndefined(res.json), 'none', `${name} produced a hole`)
  }
})

test('every real forbidden action posted panel-style carries a reason and an alternative', async () => {
  // Swept over the whole table rather than spot-checked, on the HTTP path: the
  // panel and the skill both read these two fields, so a fifth forbidden action
  // added without them must fail here.
  const { handler } = handlerFor()
  const names = Object.keys(FORBIDDEN)
  assert.ok(names.length >= 4, 'the four authority-changing actions must all be present')
  for (const name of names) {
    const res = await post(handler, { action: name, args: {} })
    assert.equal(res.json.status, 'forbidden', `${name} must be refused over HTTP`)
    assert.equal(typeof res.json.reason, 'string', `${name} must explain why`)
    assert.ok(res.json.reason.length > 0, `${name}'s reason must say something`)
    assert.equal(typeof res.json.alternative, 'string', `${name} must name the user-facing alternative`)
    assert.ok(res.json.alternative.length > 0, `${name}'s alternative must say something`)
    assert.equal(scanForUndefined(res.json), 'none', `${name} produced a hole`)
  }
})

test('no action response ever lacks a status, whatever name is posted', async () => {
  // The envelope contract, swept over the whole surface the route exposes: real
  // actions, the forbidden table, the prototype names, and junk.
  const { handler } = handlerFor({ services: { pluginManager: pluginManagerStub() } })
  const probes = [
    ...Object.keys(ACTIONS), ...Object.keys(FORBIDDEN),
    'toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
    'propertyIsEnumerable', 'toLocaleString', '', 'nope.real',
  ]
  for (const name of probes) {
    const res = await post(handler, { action: name, args: {} })
    assert.equal(res.statusCode, 200, `${name} must answer`)
    assert.equal(typeof res.json, 'object', `${name} must answer with an object`)
    assert.equal(typeof res.json.status, 'string', `${name} produced a response with no status`)
    assert.equal(scanForUndefined(res.json), 'none', `${name} produced a hole`)
  }
})

test('a non-string action is refused rather than coerced into dispatching', async () => {
  // The same discipline the `op` path already has: `dispatch` is what decides
  // whether an action exists, so the route must hand it the raw value. A route
  // that stringified would let an object naming a real action dispatch it.
  const { handler } = handlerFor({ services: { pluginManager: pluginManagerStub() } })
  const res = await post(handler, { action: { toString: () => 'plugin.list' }, args: {} })
  assert.equal(res.json.status, 'error')
  assert.match(res.json.reason, /unknown action/u)
  assert.equal(Object.hasOwn(res.json, 'plugins'), false, 'nothing may have been dispatched')
})

test('the channel reply shape still settles a live request through the same route', async () => {
  // The other shape, unchanged: a reply must still reach `respond`, or the whole
  // appearance bridge dies the moment the action branch was added.
  const { ctx, handler } = handlerFor()
  const pending = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  const drained = await get(handler)
  const row = drained.json.requests[0]
  assert.equal(row.op, 'appearance.setTheme')

  const reply = await post(handler, { id: row.id, ok: true, value: 'dark' })
  assert.deepEqual(reply.json, { ok: true }, 'a settled reply reports true')
  assert.equal((await pending).status, 'ok')
  assert.equal(ctx.__consoleChannel.pendingCount(), 0)
})

test('a reply for an unknown id is reported false and stays a valid answer', async () => {
  // `false` is the honest answer for a reply that arrived after its timeout, so
  // the shape branch must not have turned it into an error envelope.
  const { handler } = handlerFor()
  const res = await post(handler, { id: 'no-such-request', ok: true })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json, { ok: false })
})

test('an action-shaped body does not disturb a parked poll', async () => {
  // The two shapes share one route, so an action POST must not be mistaken for a
  // reply to a parked GET and settle it with a meaningless value.
  const { ctx, handler } = handlerFor({ config: { longPollMs: 40 }, services: { pluginManager: pluginManagerStub() } })
  const parked = ctx.__consoleChannel.request('appearance.setTheme', { id: 'dark' })
  const drained = await get(handler)
  const row = drained.json.requests[0]

  await post(handler, { action: 'plugin.list', args: {} })
  assert.equal(ctx.__consoleChannel.pendingCount(), 1, 'the action POST must not settle the appearance request')

  await post(handler, { id: row.id, ok: true })
  assert.equal((await parked).status, 'ok', 'and the real reply still lands')
})

test('the action envelope has no undefined-valued key, checked before serialization', async () => {
  // The same lossless-JSON rule every other envelope in this plugin follows, on
  // the new branch. `dispatch` builds these, so the walk is on the object the
  // route serialized rather than on the text.
  const { handler } = handlerFor({ services: { pluginManager: pluginManagerStub() } })
  const captured = await captureSerialized(async () => {
    await post(handler, { action: 'console.actions', args: {} })
    await post(handler, { action: 'plugin.list', args: {} })
    await post(handler, { action: 'plugin.setEnabled', args: { enabled: 'not-a-boolean' } })
    await post(handler, { action: 'sandbox.setMode', args: {} })
    await post(handler, { action: 'nope.notReal', args: {} })
  })
  assert.ok(captured.length >= 5, `every action response must be serialized (got ${captured.length})`)
  for (const payload of captured) {
    assert.equal(scanForUndefined(payload), 'none', `a hole: ${JSON.stringify(payload)}`)
  }
  // And the walk is checking populated envelopes, not a vacuous list of them.
  assert.ok(captured.some((p) => p?.status === 'ok'), 'an ok envelope was among them')
  assert.ok(captured.some((p) => p?.status === 'forbidden'), 'and a forbidden one')
})

test('the action branch does not change the response headers', async () => {
  // The panel reads `cache-control` to decide nothing; the browser does. A
  // cached action response would make the panel show a stale result.
  const { handler } = handlerFor({ services: { pluginManager: pluginManagerStub() } })
  const res = await post(handler, { action: 'plugin.list', args: {} })
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(res.headers['cache-control'], 'no-store')
})
