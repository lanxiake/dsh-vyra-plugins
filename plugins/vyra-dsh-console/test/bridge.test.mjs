// Client-half self-check for the Task 7 drain loop: the browser polls the Host
// endpoint, applies each queued op against the live Client services, and posts
// every answer back.
//
//   node --test plugins/vyra-dsh-console/test/bridge.test.mjs
//
// `fetch` is stubbed throughout — these are unit tests of the loop, and a real
// request would need a bound port and a running Host to say anything more.
// The loop is driven through the same `apply(ctx)` seam the module loader uses.
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root, 'client.js'), 'utf8')

/** The real fetch, restored after every test so no stub outlives its case. */
const realFetch = globalThis.fetch

/**
 * Find the first `undefined`-valued key anywhere in a value, as a path string.
 *
 * An own-key walk, never a JSON round trip: `JSON.stringify` drops such a key
 * silently, so a `parse(JSON.stringify(x))` comparison passes on exactly the
 * defect this looks for.
 */
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
 * Load the browser bundle the way the module loader does.
 *
 * A fresh evaluation per call, so one test's `apply()` cannot leak an effect —
 * or a fetch stub — into another's.
 */
function loadBundle() {
  let exports
  const window = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        assert.equal(id, 'dsh-vyra-dsh-console', 'the bundle registers under its package name')
        exports = factory(() => ({}))
      },
    },
  }
  new Function('window', 'document', source)(window, undefined)
  return exports
}

/** Client services whose calls are recorded, so "did it actually apply" is observable. */
function spyServices() {
  const calls = []
  return {
    calls,
    services: {
      theme: {
        getTheme: () => ({ preference: 'dark', active: { id: 'dark', colorScheme: 'dark' } }),
        setTheme: (id) => calls.push(['setTheme', id]),
        setFontSize: (role, px) => calls.push(['setFontSize', role, px]),
      },
      layout: {
        toggleSidebar: () => calls.push(['toggleSidebar']),
        openRightbar: (track, fullscreen) => calls.push(['openRightbar', track, fullscreen]),
        closeRightbar: () => calls.push(['closeRightbar']),
      },
      locale: {
        getLocale: () => ({ active: 'zh', locales: [], revision: 1 }),
        setLocale: (id) => calls.push(['setLocale', id]),
      },
    },
  }
}

/** A JSON Response stand-in. */
function jsonResponse(value, { ok = true, status = 200, raw } = {}) {
  return {
    ok,
    status,
    statusText: '',
    async json() {
      if (raw !== undefined) return JSON.parse(raw)
      return value
    },
    async text() {
      return raw !== undefined ? raw : JSON.stringify(value)
    },
  }
}

/**
 * A `fetch` stub that hands out scripted GET responses in order and records
 * every POST, so the whole round trip is observable without a network.
 *
 * `queue` is a list of items; a GET consumes the next one. When it is exhausted
 * the loop is stopped by rejecting, which is how every test ends cleanly without
 * waiting on a real timer.
 */
function stubFetch(queue, { onPost } = {}) {
  const gets = []
  const posts = []
  let index = 0
  const fetch = async (url, options = {}) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body)
      posts.push(body)
      if (onPost) onPost(body)
      return jsonResponse({ ok: true })
    }
    gets.push({ url, options })
    if (index >= queue.length) throw new Error('stub queue exhausted')
    const next = queue[index]
    index += 1
    if (typeof next === 'function') return next()
    return jsonResponse(next)
  }
  return { fetch, gets, posts }
}

/**
 * Capture the exact object the loop hands to `JSON.stringify` for a POST body.
 *
 * This indirection is the whole point. `JSON.stringify` silently drops an
 * `undefined` value, so a test that only inspected the POSTed TEXT could never
 * see a hole the reply had — the exact blindness that let the Task 5 Critical
 * through. The captured object is walked with `Reflect.ownKeys` instead, before
 * serialization has erased the evidence.
 */
async function captureSerialized(body) {
  const real = JSON.stringify
  const captured = []
  JSON.stringify = function patched(value, ...rest) {
    captured.push(value)
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
 * Every bridge started by a test, so cleanup is guaranteed.
 *
 * This matters more than tidiness: the drain loop is a `while` that only ends
 * when its effect is disposed. A test that asserted before calling `stop()` left
 * the loop running, and the suite then hung instead of reporting the failure —
 * which hides the very assertion that failed. `afterEach` therefore disposes
 * whatever a test left behind, whether it passed or threw.
 */
const startedBridges = []

test.afterEach(() => {
  for (const bridge of startedBridges.splice(0)) {
    try {
      bridge.stop()
    } catch {
      // A test may already have disposed it; that is not an error.
    }
  }
  globalThis.fetch = realFetch
  // The ui tests supply a document; leaving it behind would let a later test
  // reach the DOM path against a stub it never intended.
  delete globalThis.document
})

/**
 * Install a fetch stub and run `apply()`, returning the effect's disposer.
 *
 * The bridge is registered for automatic disposal, so a failing assertion
 * cannot leave the loop running.
 */
function startBridge({ exports, services, stub, servicesAtCall } = {}) {
  const disposers = []
  const ctx = {
    theme: services.theme,
    layout: services.layout,
    locale: services.locale,
    effect: (fn, label) => {
      const disposer = fn()
      disposers.push({ label, disposer })
    },
  }
  if (servicesAtCall) Object.assign(ctx, servicesAtCall)
  globalThis.fetch = stub.fetch
  exports.apply(ctx)
  const bridge = {
    ctx,
    label: disposers[0]?.label,
    stop: () => disposers[0]?.disposer(),
  }
  startedBridges.push(bridge)
  return bridge
}

/** Let the drain loop run for a few microtask/timer turns. */
async function settle(rounds = 8) {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Wait until `condition()` holds, or fail the test at `timeoutMs`.
 *
 * Needed wherever the loop's own error backoff is part of what is being
 * observed: that wait is real wall-clock time, so draining microtasks would
 * simply outrun it and assert against a loop that has not retried yet.
 */
async function waitFor(condition, timeoutMs = 3000, stepMs = 25) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (condition()) return true
    await new Promise((resolve) => setTimeout(resolve, stepMs))
  }
  return condition()
}

/**
 * Run `body` with the stub installed.
 *
 * Restoration and loop disposal are both handled by `afterEach`, so a throw in
 * the middle of a case cannot leak either one into the next test.
 */
async function withFetchStub(stub, body) {
  globalThis.fetch = stub.fetch
  return body()
}

// ---------------------------------------------------------------------------
// The loop drains the endpoint and answers every request it took.
// ---------------------------------------------------------------------------

test('the loop GETs the endpoint and applies each queued op', async () => {
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([
    { ok: true, requests: [{ id: '1', op: 'appearance.setTheme', args: { id: 'dark' } }] },
  ])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.deepEqual(calls, [['setTheme', 'dark']], 'the op must actually be applied')
    bridge.stop()
  })
})

test('the loop requests the documented endpoint with no-store', async () => {
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.ok(stub.gets.length >= 1, 'the loop must poll')
    assert.equal(stub.gets[0].url, '/api/vyra-console/rpc')
    assert.equal(stub.gets[0].options.method, 'GET', 'a drain is a GET')
    assert.equal(stub.gets[0].options.cache, 'no-store')
    bridge.stop()
  })
})

test('the endpoint path the Client polls is the one the Host registers', async () => {
  // The two halves are separate modules — the browser bundle cannot import the
  // Host constant — so the path is necessarily written twice. Rather than trust
  // the two spellings to stay equal, read the Host's own constant and compare.
  const hostSource = readFileSync(join(root, 'index.js'), 'utf8')
  const hostPath = /const RPC_PATH = '([^']+)'/.exec(hostSource)?.[1]
  assert.ok(hostPath, 'the Host must declare its endpoint path')
  const clientPath = /const RPC = '([^']+)'/.exec(source)?.[1]
  assert.ok(clientPath, 'the Client must declare the endpoint path it polls')
  assert.equal(clientPath, hostPath, 'the two halves must agree on the endpoint')
})

test('the loop posts an answer for a request that succeeded', async () => {
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([
    { ok: true, requests: [{ id: '7', op: 'appearance.setTheme', args: { id: 'dark' } }] },
  ])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.equal(stub.posts.length, 1, 'every drained request must be answered')
    assert.deepEqual(stub.posts[0], { id: '7', ok: true, value: 'dark' })
    bridge.stop()
  })
})

test('the loop posts an answer for every request in a batch, in order', async () => {
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([
    { ok: true, requests: [
      { id: '1', op: 'appearance.toggleSidebar', args: {} },
      { id: '2', op: 'appearance.setLocale', args: { id: 'en' } },
      { id: '3', op: 'appearance.closeRightbar', args: {} },
    ] },
  ])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.deepEqual(calls, [['toggleSidebar'], ['setLocale', 'en'], ['closeRightbar']])
    assert.deepEqual(stub.posts.map((p) => p.id), ['1', '2', '3'])
    bridge.stop()
  })
})

test('a success with no value omits the value key rather than sending undefined', async () => {
  // The channel's reply contract is `{ id, ok, value|error }`, and `respond()`
  // reads `reply.value === undefined` as "nothing to report". Sending
  // `value: undefined` would be dropped by JSON.stringify anyway, but building
  // an object with a hole is the defect this repo has already been bitten by —
  // so the loop must omit the key.
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '5', op: 'appearance.toggleSidebar', args: {} }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.equal(stub.posts.length, 1)
    assert.equal(Object.hasOwn(stub.posts[0], 'value'), false, 'an absent value must be omitted')
    assert.equal(Object.hasOwn(stub.posts[0], 'error'), false)
    bridge.stop()
  })
})

// ---------------------------------------------------------------------------
// A failure on either side is reported, never swallowed into a fake success.
// ---------------------------------------------------------------------------

test('an op that fails is reported as an error with its reason', async () => {
  // The theme service really does throw on an unregistered id, and that message
  // is the only thing that tells the agent what to correct.
  const exports = loadBundle()
  const services = { theme: { setTheme: () => { throw new Error('theme "nope" is not registered') } } }
  const stub = stubFetch([{ ok: true, requests: [{ id: '9', op: 'appearance.setTheme', args: { id: 'nope' } }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.equal(stub.posts.length, 1)
    assert.equal(stub.posts[0].ok, false, 'a failed op must not be reported as applied')
    assert.equal(stub.posts[0].error, 'theme "nope" is not registered')
    assert.equal(Object.hasOwn(stub.posts[0], 'value'), false, 'a refusal carries no value')
    bridge.stop()
  })
})

test('an unknown op is answered with a refusal, not silence', async () => {
  // `applyOp` refuses an unknown op. The loop must still POST that refusal: a
  // request left unanswered would hang the Host until its timeout and then read
  // as "no interface is connected" even though one just answered.
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '3', op: 'appearance.nope', args: {} }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.equal(stub.posts.length, 1, 'even a refusal must be posted')
    assert.equal(stub.posts[0].ok, false)
    assert.match(stub.posts[0].error, /unknown appearance op/)
    bridge.stop()
  })
})

test('a non-string op is refused and nothing is dispatched', async () => {
  // The op arrives over HTTP and is untrusted. `applyOp` refuses a non-string
  // op; the loop must pass it through UNCOERCED so that guard is what decides.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '1', op: { toString: () => 'appearance.toggleSidebar' }, args: {} }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.deepEqual(calls, [], 'a non-string op must reach no service')
    assert.equal(stub.posts.length, 1)
    assert.equal(stub.posts[0].ok, false)
    assert.match(stub.posts[0].error, /must be a string/)
    bridge.stop()
  })
})

test('a missing op is refused rather than treated as an empty string', async () => {
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '1', args: {} }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.deepEqual(calls, [])
    assert.equal(stub.posts[0].ok, false)
    bridge.stop()
  })
})

test('a request whose id is missing is still answered', async () => {
  // `respond()` stringifies the id, so an absent one becomes the literal
  // "undefined" and settles nothing — but the loop's job is to report what it
  // did, and the Host decides whether the reply lands. Swallowing it here would
  // be the silent-drop failure again.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ op: 'appearance.toggleSidebar', args: {} }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.deepEqual(calls, [['toggleSidebar']], 'the op still runs')
    assert.equal(stub.posts.length, 1, 'and the outcome is still reported')
    bridge.stop()
  })
})

// ---------------------------------------------------------------------------
// The loop survives everything, and stops on disposal.
// ---------------------------------------------------------------------------

test('a failed fetch does not kill the loop', async () => {
  // A Host that is mid-restart answers with a connection error. If that ended
  // the loop, appearance actions would be unavailable until the page reloaded.
  //
  // The recovery is behind the loop's error backoff, so this waits real time
  // rather than draining microtasks — the backoff IS the behaviour under test.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  let attempts = 0
  const stub = stubFetch([])
  const inner = stub.fetch
  stub.fetch = async (url, options) => {
    if (options?.method === 'POST') return inner(url, options)
    attempts += 1
    if (attempts === 1) throw new Error('ECONNREFUSED')
    // The request is served once, then the queue is empty — a real Host drains
    // what it hands over, so replaying it would only measure the stub.
    if (attempts === 2) return jsonResponse({ ok: true, requests: [{ id: '1', op: 'appearance.toggleSidebar', args: {} }] })
    return jsonResponse({ ok: true, requests: [] })
  }
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => calls.length > 0, 4000)
    assert.ok(attempts >= 2, `the loop must retry after a failure (attempts=${attempts})`)
    assert.deepEqual(calls, [['toggleSidebar']], 'and recover to drain the next response')
    bridge.stop()
  })
})

test('a malformed response does not throw out of the loop', async () => {
  // A gateway or a mid-start Host can answer with plain text, or a JSON shape the
  // Client did not expect. Parsing must not escape the loop, and the loop must
  // reach the next response rather than dying on the bad one.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  let polls = 0
  const stub = stubFetch([])
  stub.fetch = async (url, options) => {
    if (options?.method === 'POST') return jsonResponse({ ok: true })
    polls += 1
    if (polls === 1) return jsonResponse(undefined, { raw: 'not json at all' })
    if (polls === 2) return jsonResponse({ ok: true, requests: null })
    // Served once, then empty — a real Host drains what it hands over, so a
    // stub that replayed the request forever would be measuring itself.
    if (polls === 3) return jsonResponse({ ok: true, requests: [{ id: '1', op: 'appearance.toggleSidebar', args: {} }] })
    return jsonResponse({ ok: true, requests: [] })
  }
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => calls.length > 0, 8000)
    assert.ok(polls >= 3, `the loop must keep polling past malformed bodies (polls=${polls})`)
    assert.deepEqual(calls, [['toggleSidebar']], 'the loop must keep draining past malformed bodies')
    bridge.stop()
  })
})

test('every poll is bounded by a timeout signal', async () => {
  // Without a bound, a Host that accepts the connection and then stalls wedges
  // the loop: no poll ever settles, so no appearance action is ever answered
  // again. The signal is the loop's only way out, so its presence is pinned.
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [] }])
  const seen = []
  const inner = stub.fetch
  stub.fetch = async (url, options = {}) => {
    if (options.method !== 'POST') seen.push(options)
    return inner(url, options)
  }
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => seen.length > 0)
    assert.ok(seen[0].signal, 'the poll must carry an abort signal')
    assert.ok(seen[0].signal instanceof AbortSignal, 'and it must be a real AbortSignal')
    bridge.stop()
  })
})

test('the reply built for the Host carries no undefined-valued key, checked before serialization', async () => {
  // The own-key walk, on the object itself. `JSON.stringify` would drop a hole
  // and the POSTed text would look identical to a correct omission — so the
  // captured pre-serialization object is what gets walked, for both the success
  // and the refusal branch (each writes a different optional key).
  const cases = [
    ['appearance.toggleSidebar', {}, 'a success with nothing to report'],
    ['appearance.setTheme', { id: 'dark' }, 'a success with a value'],
    ['appearance.nope', {}, 'a refusal'],
  ]
  for (const [op, args, label] of cases) {
    const exports = loadBundle()
    const { services } = spyServices()
    const stub = stubFetch([{ ok: true, requests: [{ id: '1', op, args }] }])
    await withFetchStub(stub, async () => {
      const captured = await captureSerialized(async () => {
        const bridge = startBridge({ exports, services, stub })
        await waitFor(() => stub.posts.length > 0)
        bridge.stop()
      })
      // The reply is the object carrying `id`/`ok`; the drained-response body is
      // not serialized by this half at all.
      const reply = captured.find((value) => value && typeof value === 'object' && 'ok' in value && 'id' in value)
      assert.ok(reply, `${label}: no reply object was serialized`)
      const hole = scanForUndefined(reply)
      assert.equal(hole, 'none', `${label}: the reply carries undefined at ${hole}`)
      // Exactly one of value/error, and only on the branch that has one.
      if (op === 'appearance.nope') {
        assert.equal(typeof reply.error, 'string', `${label}: a refusal must carry its reason`)
        assert.equal(Object.hasOwn(reply, 'value'), false)
      } else {
        assert.equal(Object.hasOwn(reply, 'error'), false, `${label}: a success carries no error`)
      }
    })
  }
})

test('the loop never stringifies the op, so applyOp decides its type', async () => {
  // Observed on the reply rather than the call list: a `String(op)` in the loop
  // would make the hostile object below DISPATCH, and the reply would come back
  // ok. The refusal is the proof the raw value survived every hop.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '1', op: { toString: () => 'appearance.toggleSidebar' }, args: {} }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => stub.posts.length > 0)
    assert.deepEqual(calls, [], 'a coerced op would have dispatched a real mutation')
    assert.equal(stub.posts[0].ok, false)
    assert.match(stub.posts[0].error, /must be a string/)
    bridge.stop()
  })
})

test('a partial batch is answered for the requests before the failure point', async () => {
  // The invariant in one place: what the loop drained is what the Host must see
  // answered, so a successful request followed by a failing one yields one
  // success reply and one refusal — never one reply for two requests.
  const exports = loadBundle()
  const services = { theme: { setTheme: () => { throw new Error('theme "x" is not registered') } } }
  const stub = stubFetch([{ ok: true, requests: [
    { id: 'a', op: 'appearance.toggleSidebar', args: {} },
    { id: 'b', op: 'appearance.setTheme', args: { id: 'x' } },
  ] }])
  await withFetchStub(stub, async () => {
    // `layout` is absent, so both actually refuse — the point is that BOTH are
    // answered, in order, with their own reasons.
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => stub.posts.length >= 2)
    assert.deepEqual(stub.posts.map((p) => p.id), ['a', 'b'])
    assert.deepEqual(stub.posts.map((p) => p.ok), [false, false])
    assert.match(stub.posts[0].error, /layout/)
    assert.match(stub.posts[1].error, /theme/)
    bridge.stop()
  })
})

test('a response whose body is not an object is ignored rather than fatal', async () => {
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([
    () => jsonResponse(42),
    () => jsonResponse('a string'),
    () => jsonResponse({ ok: true, requests: [{ id: '1', op: 'appearance.toggleSidebar', args: {} }] }),
  ])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => calls.length > 0, 8000)
    assert.deepEqual(calls, [['toggleSidebar']])
    bridge.stop()
  })
})

test('a requests field that is present but not an array dispatches nothing', async () => {
  // The shape guard, isolated from `null`. `null`/`undefined` are the easy cases
  // (a `?? []` fallback covers them identically); the guard earns its place on a
  // TRUTHY non-array, where the two implementations genuinely diverge:
  //   - `requests: 42`   — iterating a number throws out of the poll;
  //   - `requests: "op"` — a string iterates as its CHARACTERS, so the loop would
  //                        answer one request per character, each with an
  //                        `undefined` op, instead of none.
  // The POST COUNT is the assertion that separates them: a guarded loop answers
  // only the one real request it later receives, an unguarded one answers those
  // phantom requests too.
  const cases = [42, 'appearance.toggleSidebar', { id: '1' }, true]
  for (const requests of cases) {
    const exports = loadBundle()
    const { services, calls } = spyServices()
    // The malformed batch is served on the FIRST poll, the one real request on
    // the next, and nothing after that. A counter would be brittle — the two
    // implementations consume a different number of polls before recovering —
    // so the phase is advanced by the stub itself.
    let phase = 0
    const stub = stubFetch([])
    const inner = stub.fetch
    stub.fetch = async (url, options) => {
      // POSTs are delegated so they are RECORDED; only the GET script is
      // overridden here. Answering the POST inline would leave `stub.posts`
      // empty and the assertion below would be measuring nothing.
      if (options?.method === 'POST') return inner(url, options)
      phase += 1
      if (phase === 1) return jsonResponse({ ok: true, requests })
      if (phase === 2) return jsonResponse({ ok: true, requests: [{ id: 'real', op: 'appearance.toggleSidebar', args: {} }] })
      return jsonResponse({ ok: true, requests: [] })
    }
    await withFetchStub(stub, async () => {
      const bridge = startBridge({ exports, services, stub })
      // Wait for the real answer to be posted, then for the loop to settle, so
      // any phantom answer a missing guard would produce has time to appear too.
      await waitFor(() => stub.posts.length > 0, 8000)
      await settle(20)
      assert.deepEqual(calls, [['toggleSidebar']],
        `requests=${JSON.stringify(requests)} must dispatch nothing of its own, then recover`)
      assert.deepEqual(stub.posts.map((p) => p.id), ['real'],
        `requests=${JSON.stringify(requests)} must produce exactly one answer, not one per character`)
      bridge.stop()
    })
  }
})

test('a failed POST does not stop the remaining answers or the loop', async () => {
  // Every drained request must be answered, and one failed POST must not abort
  // the batch — the remaining requests would otherwise be silently dropped.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  let posts = 0
  const stub = stubFetch([{ ok: true, requests: [
    { id: '1', op: 'appearance.toggleSidebar', args: {} },
    { id: '2', op: 'appearance.closeRightbar', args: {} },
  ] }], {
    onPost: () => { posts += 1; if (posts === 1) throw new Error('POST failed') },
  })
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => posts >= 2, 4000)
    assert.deepEqual(calls, [['toggleSidebar'], ['closeRightbar']], 'both ops still ran')
    assert.ok(posts >= 2, 'the second answer must still be attempted')
    bridge.stop()
  })
})

test('the loop stops once the effect is disposed', async () => {
  // No leak after unmount: a disposed effect must stop polling, or a remount
  // would leave the previous loop racing the new one for the same queue.
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [] }, { ok: true, requests: [] }, { ok: true, requests: [] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle(4)
    const before = stub.gets.length
    assert.ok(before >= 1, 'the loop must have polled at least once')
    bridge.stop()
    const atStop = stub.gets.length
    await settle(30)
    assert.equal(stub.gets.length, atStop, 'a disposed loop must issue no further requests')
  })
})

test('the loop does not spin: a poll is issued only after the previous one settles', async () => {
  // A busy loop would hammer the Host with hundreds of requests per second. The
  // loop must await each poll before issuing the next, which is observable as a
  // request count that grows by one per settle round rather than unboundedly.
  const exports = loadBundle()
  const { services } = spyServices()
  let concurrent = 0
  let maxConcurrent = 0
  const stub = stubFetch([{ ok: true, requests: [] }, { ok: true, requests: [] }, { ok: true, requests: [] }])
  const inner = stub.fetch
  stub.fetch = async (url, options) => {
    if (options?.method !== 'POST') {
      concurrent += 1
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      try {
        return await inner(url, options)
      } finally {
        concurrent -= 1
      }
    }
    return inner(url, options)
  }
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle(10)
    assert.equal(maxConcurrent, 1, 'only one poll may be in flight at a time')
    bridge.stop()
  })
})

test('the loop backs off briefly after an error instead of hammering', async () => {
  // "Do not hammer": with every poll failing, the count over a short window must
  // stay small. An unthrottled loop would issue thousands of requests in this
  // window and blow straight past the bound.
  const exports = loadBundle()
  const { services } = spyServices()
  let attempts = 0
  const stub = stubFetch([])
  stub.fetch = async () => { attempts += 1; throw new Error('down') }
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await new Promise((resolve) => setTimeout(resolve, 250))
    assert.ok(attempts >= 1, 'it must retry')
    assert.ok(attempts <= 5, `a failing loop must not hammer the Host (attempts=${attempts} in 250ms)`)
    bridge.stop()
  })
})

// ---------------------------------------------------------------------------
// The services are read at call time, so a remounted service is picked up.
// ---------------------------------------------------------------------------

test('a platform without AbortSignal.timeout still polls, unbounded rather than throwing', async () => {
  // `AbortSignal.timeout` is recent enough that an older embedded browser may
  // lack it. A bare call would throw inside `poll()`, so EVERY poll would fail
  // and the bridge would be permanently dead — a worse outcome than the
  // unbounded poll it was guarding. The fallback must be a plain poll.
  const realTimeout = AbortSignal.timeout
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '1', op: 'appearance.toggleSidebar', args: {} }] }])
  try {
    Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true, writable: true })
    await withFetchStub(stub, async () => {
      const bridge = startBridge({ exports, services, stub })
      await waitFor(() => calls.length > 0, 4000)
      assert.deepEqual(calls, [['toggleSidebar']], 'the poll must still work without a bounded signal')
      assert.equal(stub.gets[0].options.signal, undefined, 'and it carries no signal')
      bridge.stop()
    })
  } finally {
    Object.defineProperty(AbortSignal, 'timeout', { value: realTimeout, configurable: true, writable: true })
  }
})

test('a platform whose AbortSignal.timeout throws is survived, not fatal', async () => {
  // The other half: the API can exist and still refuse (a locked-down or
  // patched environment). Throwing out of `pollSignal` would be the same
  // permanent death, so the call itself is guarded.
  const realTimeout = AbortSignal.timeout
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '1', op: 'appearance.toggleSidebar', args: {} }] }])
  try {
    Object.defineProperty(AbortSignal, 'timeout', {
      value: () => { throw new Error('timeout is not permitted here') },
      configurable: true,
      writable: true,
    })
    await withFetchStub(stub, async () => {
      const bridge = startBridge({ exports, services, stub })
      await waitFor(() => calls.length > 0, 4000)
      assert.deepEqual(calls, [['toggleSidebar']], 'a refusing timeout API must not kill the bridge')
      assert.equal(stub.gets[0].options.signal, undefined)
      bridge.stop()
    })
  } finally {
    Object.defineProperty(AbortSignal, 'timeout', { value: realTimeout, configurable: true, writable: true })
  }
})

test('the services are read at call time, not captured when the effect was installed', async () => {
  // The seam the old inert effect documented: a Client service can be disposed
  // and remounted, and a bag captured at `apply()` time would keep dispatching
  // into the dead one — every appearance action failing after a theme reload.
  //
  // The stub hands out one request per poll and then parks, so the service can
  // be swapped between two requests without the loop racing ahead of the test.
  const exports = loadBundle()
  const stale = spyServices()
  const fresh = spyServices()
  let poll = 0
  let parkedResolve
  const stub = stubFetch([])
  stub.fetch = async (url, options) => {
    if (options?.method === 'POST') return jsonResponse({ ok: true })
    poll += 1
    if (poll === 1) return jsonResponse({ ok: true, requests: [{ id: '1', op: 'appearance.setTheme', args: { id: 'dark' } }] })
    // Park every later poll, so no further request is handed out until released.
    await new Promise((resolve) => { parkedResolve = resolve })
    return jsonResponse({ ok: true, requests: [{ id: '2', op: 'appearance.setTheme', args: { id: 'light' } }] })
  }
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services: stale.services, stub })
    await waitFor(() => stale.calls.length > 0)
    assert.deepEqual(stale.calls, [['setTheme', 'dark']], 'the first request uses the mounted service')

    // Remount: the context now exposes a different service object.
    bridge.ctx.theme = fresh.services.theme
    assert.ok(parkedResolve, 'the loop must be parked on the next poll')
    parkedResolve()
    await waitFor(() => fresh.calls.length > 0)
    assert.deepEqual(fresh.calls, [['setTheme', 'light']], 'a remounted service must be picked up')
    assert.deepEqual(stale.calls, [['setTheme', 'dark']], 'the dead service must not be used again')
    bridge.stop()
  })
})

test('a missing service is reported as an error rather than a silent no-op', async () => {
  // A half-mounted Client must not answer "ok" for an op it could not perform.
  const exports = loadBundle()
  const stub = stubFetch([{ ok: true, requests: [{ id: '1', op: 'appearance.setTheme', args: { id: 'dark' } }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services: {}, stub })
    await settle()
    assert.equal(stub.posts.length, 1)
    assert.equal(stub.posts[0].ok, false)
    assert.match(stub.posts[0].error, /theme/)
    bridge.stop()
  })
})

// ---------------------------------------------------------------------------
// The effect contract itself.
// ---------------------------------------------------------------------------

test('apply installs exactly one effect and returns a real disposer', async () => {
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [] }])
  await withFetchStub(stub, async () => {
    const labels = []
    const disposers = []
    const ctx = {
      theme: services.theme,
      layout: services.layout,
      locale: services.locale,
      effect: (fn, label) => { labels.push(label); disposers.push(fn()) },
    }
    exports.apply(ctx)
    await settle(2)
    assert.equal(disposers.length, 1, 'exactly one effect is installed')
    assert.match(labels[0], /dsh-vyra-dsh-console/)
    assert.equal(typeof disposers[0], 'function', 'the effect must return a cleanup')
    assert.doesNotThrow(() => disposers[0]())
  })
})

test('apply calls no Client service at install time', async () => {
  // The drain loop must not dispatch anything before a request arrives; a
  // service call here would fire on every mount with nothing asked of it.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    assert.deepEqual(calls, [], 'nothing is called synchronously by apply()')
    await settle()
    assert.deepEqual(calls, [], 'an empty queue dispatches nothing')
    bridge.stop()
  })
})

test('a dispose during a poll stops the loop rather than draining one more batch', async () => {
  // Disposal racing an in-flight poll is the ordinary unmount case. The loop
  // must re-check before applying, or it would dispatch ops and POST answers
  // after the panel is gone — mutating a UI the user has left.
  const exports = loadBundle()
  const { services, calls } = spyServices()
  let release
  const gate = new Promise((resolve) => { release = resolve })
  let inFlight = false
  const stub = stubFetch([])
  stub.fetch = async (url, options) => {
    if (options?.method === 'POST') return jsonResponse({ ok: true })
    inFlight = true
    await gate
    return jsonResponse({ ok: true, requests: [{ id: '1', op: 'appearance.toggleSidebar', args: {} }] })
  }
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await waitFor(() => inFlight)
    bridge.stop()
    release()
    await settle(10)
    assert.deepEqual(calls, [], 'a disposed loop must not apply a batch it had already fetched')
    assert.deepEqual(stub.posts, [], 'nor post answers')
  })
})

// ---------------------------------------------------------------------------
// The ui reply envelope.
//
// Found on the first real desktop run: `ui.list` answered `{"status":"ok"}` and
// nothing else. The loop forwarded `outcome.value`, but the appearance ops are
// the ones shaped `{ status, value? }` — the ui ops answer a whole envelope at
// the top level, so their payload was discarded on the wire. `ui.open` failed the
// same way, losing the `verified` flag that is the only evidence it happened.
// ---------------------------------------------------------------------------

test('a ui op reply carries its whole payload, not just a value field', async () => {
  // The ui ops refuse to act in a realm with no document; this test is about the
  // reply envelope, so it supplies the smallest document that passes.
  globalThis.document = { visibilityState: 'visible', querySelectorAll: () => [], querySelector: () => null };
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '9', op: 'ui.list', args: {} }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({
      exports,
      services,
      stub,
      servicesAtCall: {
        slots: {
          entries: (key) => (key === 'settings.section'
            ? [
                { options: { id: 'general', order: 0, label: '常规' }, registrant: 'ui-settings-general' },
                { options: { id: 'dsh-vyra-free-model', order: 36, label: '免费模型' }, registrant: 'dsh-vyra-free-model' },
              ]
            : []),
        },
        shortcuts: { catalog: { getSnapshot: () => [{ id: 'settings.open', label: '设置', aria: 'Control+Comma', keys: ['Ctrl', ','] }] } },
      },
    })
    await settle()
    const [reply] = stub.posts
    assert.equal(reply.ok, true, JSON.stringify(reply))
    assert.ok(reply.value, 'the reply must carry the ui payload')
    assert.equal(reply.value.settings.sections.length, 2, 'the section ledger must survive the trip')
    assert.equal(reply.value.settings.sections[1].registrant, 'dsh-vyra-free-model')
    assert.equal(reply.value.commands[0].id, 'settings.open')
    assert.equal(reply.value.status, undefined, 'status belongs to the envelope, not to its value')
    bridge.stop()
  })
})

test('a ui.open reply carries verified and how, which is what proves it happened', async () => {
  globalThis.document = { visibilityState: 'visible', querySelectorAll: () => [], querySelector: () => null };
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{
    ok: true,
    requests: [{ id: '4', op: 'ui.open', args: { target: 'rightbar', kind: 'browser' } }],
  }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({
      exports,
      services,
      stub,
      servicesAtCall: {
        sidebarRightTabs: { get: () => ({ id: 'browser' }), entries: () => [{ kind: 'browser', id: 'b' }] },
        sidebarRight: { openTab: () => {} },
      },
    })
    await settle()
    const [reply] = stub.posts
    assert.equal(reply.ok, true)
    assert.equal(reply.value.verified, true, 'without this flag ok means nothing')
    assert.equal(reply.value.how, 'service')
    assert.equal(reply.value.target, 'rightbar')
    bridge.stop()
  })
})

test('an appearance reply keeps its original value shape', async () => {
  // The fix must not reshape the ops that already worked: `appearance.setTheme`
  // answers `{ status, value }`, and the wire carries that value, not the whole
  // envelope.
  const exports = loadBundle()
  const { services } = spyServices()
  const stub = stubFetch([{ ok: true, requests: [{ id: '2', op: 'appearance.setTheme', args: { id: 'dark' } }] }])
  await withFetchStub(stub, async () => {
    const bridge = startBridge({ exports, services, stub })
    await settle()
    assert.deepEqual(stub.posts[0], { id: '2', ok: true, value: 'dark' })
    bridge.stop()
  })
})
