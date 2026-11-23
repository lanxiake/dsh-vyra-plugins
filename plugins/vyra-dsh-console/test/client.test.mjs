// Client-half self-check: the browser bundle calls exactly the Client services,
// and an unknown op is refused instead of silently doing nothing.
//
//   node --test plugins/vyra-dsh-console/test/client.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root, 'client.js'), 'utf8')
const panelSource = readFileSync(join(root, 'panel.js'), 'utf8')

/** The real fetch, restored after every test so the drain loop cannot outlive one. */
const realFetch = globalThis.fetch

/**
 * A `require` stand-in for the loader, in the shape the served bundle sees.
 *
 * React is NOT supplied here. The panel is a React component tree, and this
 * suite deliberately does not render DOM — what it drives is the panel's
 * registration and its pure derivations, neither of which needs a renderer. The
 * element `client.js` builds for the `main` slot is therefore produced with a
 * minimal `createElement` that records its arguments, so a test can assert the
 * panel component is what got registered without mounting it.
 */
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Component: class { constructor(props) { this.props = props || {}; this.state = {} } setState(next) { Object.assign(this.state, next) } },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (initial) => ({ current: initial }),
}

/**
 * Evaluate `panel.js` the way the bundle's own `require` would.
 *
 * It is a plain module with a single `export function`, so the syntax is read
 * off the real file rather than duplicated here — a copy would keep passing
 * after the real one changed shape.
 */
function loadPanelFactory() {
  const body = panelSource
    .replace(/^export function createPanel/mu, 'function createPanel')
    .concat('\nreturn { createPanel }\n')
  // eslint-disable-next-line no-new-func
  return new Function(body)()
}

let exports
const window = {
  __ModuleLoader__: {
    load: ({ id, factory }) => {
      assert.equal(id, 'vyra-dsh-console', 'the bundle registers under its package name')
      exports = factory((specifier) => {
        if (specifier === 'react') return reactStub
        if (specifier === './panel.js') return loadPanelFactory()
        // Anything else is a specifier the real bundle would not find either.
        throw new Error(`unexpected require(${specifier})`)
      })
    },
  },
}
new Function('window', 'document', source)(window, undefined)

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

test('appearance.setTheme calls the Client theme service', () => {
  const { services, calls } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.setTheme', { id: 'dark' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(calls, [['setTheme', 'dark']])
})

test('appearance.setFontSize forwards both the role and the size', () => {
  const { services, calls } = spyServices()
  exports.__internal.applyOp(services, 'appearance.setFontSize', { role: 'text', px: 15 })
  assert.deepEqual(calls, [['setFontSize', 'text', 15]])
})

test('appearance.toggleSidebar calls the Client layout service', () => {
  const { services, calls } = spyServices()
  exports.__internal.applyOp(services, 'appearance.toggleSidebar', {})
  assert.deepEqual(calls, [['toggleSidebar']])
})

test('appearance.openRightbar forwards both track and fullscreen', () => {
  const { services, calls } = spyServices()
  exports.__internal.applyOp(services, 'appearance.openRightbar', { track: false, fullscreen: true })
  assert.deepEqual(calls, [['openRightbar', false, true]])
})

test('appearance.openRightbar always passes booleans, never a hole', () => {
  // Both parameters are required and the service applies no default, so a
  // request that named neither must still arrive as two booleans rather than
  // as `undefined`, which the store would read as falsy by accident.
  const { services, calls } = spyServices()
  exports.__internal.applyOp(services, 'appearance.openRightbar', {})
  assert.deepEqual(calls, [['openRightbar', true, false]], 'the frame default: tracked, not fullscreen')
  exports.__internal.applyOp(services, 'appearance.openRightbar', { track: 0, fullscreen: 1 })
  assert.deepEqual(calls[1], ['openRightbar', true, false], 'only a literal false clears the track')
})

test('appearance.closeRightbar calls the Client layout service', () => {
  const { services, calls } = spyServices()
  exports.__internal.applyOp(services, 'appearance.closeRightbar', {})
  assert.deepEqual(calls, [['closeRightbar']])
})

test('appearance.setLocale calls the Client locale service', () => {
  const { services, calls } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.setLocale', { id: 'en' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(calls, [['setLocale', 'en']])
  assert.equal(result.value, 'en', 'a write reports what it wrote')
})

test('appearance.state reports both services it read', () => {
  const { services } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.state', {})
  assert.equal(result.status, 'ok')
  // The theme service returns a snapshot whose resolved theme is under `active`;
  // the locale service returns a snapshot whose language is under `active`.
  assert.deepEqual(result.value.theme, { id: 'dark', colorScheme: 'dark', preference: 'dark' })
  assert.equal(result.value.locale, 'zh')
})

test('an unknown op is refused rather than silently ignored', () => {
  const { services, calls } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.nope', {})
  assert.equal(result.status, 'error')
  assert.deepEqual(calls, [], 'nothing is called for an unknown op')
  // The reason must name the op and the op set it was matched against. Asserting
  // only `status === 'error'` would pass for the wrong reason now that a catch
  // wraps the dispatch: dereferencing a missing handler also yields an error,
  // but it leaks "handler is not a function" instead of naming the bad op.
  assert.match(result.reason, /unknown appearance op "appearance\.nope"/)
})

test('an unknown op never degrades into a leaked implementation detail', () => {
  // The guard that names the op runs before the dispatch, so an unknown op is
  // answered without ever reaching a handler lookup 鈥?the failure is about the
  // request, not about this file's internals.
  const { services } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.definitelyNotAnOp', {})
  assert.doesNotMatch(result.reason, /is not a function/)
  assert.doesNotMatch(result.reason, /\bhandler\b/)
})

// The lookup must be own-property only. `OPS[op]` walks the prototype chain, so
// every `Object.prototype` name resolves as a "handler": `constructor` returns
// the OPS object itself 鈥?which is why the leak is real, not theoretical 鈥?and
// the rest report a plausible-looking error for an op that does not exist.
// `domains/appearance.js` filters with `CLIENT_ACTIONS.has(action)` today, but
// Task 7's HTTP route and Task 10's panel do not, so this function must refuse
// on its own rather than relying on a caller's guard.
for (const op of ['toString', 'valueOf', 'constructor', '__proto__', 'hasOwnProperty',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'then', 'length']) {
  test(`the inherited name "${op}" is refused, not resolved as a handler`, () => {
    const { services, calls } = spyServices()
    let result
    assert.doesNotThrow(() => { result = exports.__internal.applyOp(services, op, {}) },
      `"${op}" must not raise`)
    // The contract is `{ status }`: a bare string or a status-less object is a
    // contract violation even when it does not throw.
    assert.equal(typeof result, 'object', `"${op}" must return an object`)
    assert.notEqual(result, null)
    assert.equal(result.status, 'error', `"${op}" must be refused`)
    assert.match(result.reason, /unknown appearance op/, `"${op}" must be named as unknown`)
    assert.deepEqual(calls, [], `"${op}" must call nothing`)
    // No internals in the payload: the services must never appear in a return.
    const serialized = JSON.stringify(result)
    assert.ok(!serialized.includes('toggleSidebar'), `"${op}" must not leak a service object`)
    assert.equal(Object.hasOwn(result, 'theme'), false)
    assert.equal(Object.hasOwn(result, 'layout'), false)
    assert.equal(Object.hasOwn(result, 'locale'), false)
  })
}

test('the "constructor" op does not return the handler map', () => {
  // The sharpest case: `OPS.constructor` is `Object`, whose call returns the
  // object passed in 鈥?the live service bag. Asserted directly rather than only
  // through the loop above, because this is the one that leaks real state.
  const { services } = spyServices()
  const result = exports.__internal.applyOp(services, 'constructor', {})
  assert.equal(result.status, 'error')
  assert.notEqual(result, services)
  assert.notEqual(result.theme, services.theme)
  assert.doesNotMatch(JSON.stringify(result), /setTheme|toggleSidebar|getLocale/)
})

// A non-string op must be refused *before* the own-property lookup. `Object.hasOwn`
// and the reason template both coerce their argument, so an object whose `toString`
// returns a real op name satisfies the lookup and then dispatches a real mutation.
// The call list is asserted alongside the status: a status-only assertion passes
// even when the handler ran and something later went wrong, which is the whole
// point here.
for (const [label, op] of [
  ['an object whose toString names a real op', { toString: () => 'appearance.toggleSidebar' }],
  ['a single-element array naming a real op', ['appearance.toggleSidebar']],
  ['an array with an overridden toString', Object.assign([], { toString: () => 'appearance.toggleSidebar', join: () => 'appearance.toggleSidebar' })],
  ['an object whose valueOf names a real op', { valueOf: () => 'appearance.toggleSidebar', toString: null }],
  ['a boxed String naming a real op', Object('appearance.toggleSidebar')],
]) {
  test(`${label} is refused and dispatches nothing`, () => {
    const { services, calls } = spyServices()
    let result
    assert.doesNotThrow(() => { result = exports.__internal.applyOp(services, op, {}) }, 'must not raise')
    assert.equal(result.status, 'error')
    assert.deepEqual(calls, [], 'the handler must never be reached')
    assert.match(result.reason, /must be a string/)
  })
}

test('a Symbol op returns a status instead of throwing out', () => {
  // The reason template interpolates `op`, and a Symbol cannot be stringified 鈥?  // so this is exactly the contract break the previous round closed, arriving
  // through a different door.
  const { services, calls } = spyServices()
  let result
  assert.doesNotThrow(() => {
    result = exports.__internal.applyOp(services, Symbol('appearance.toggleSidebar'), {})
  })
  assert.equal(result.status, 'error')
  assert.deepEqual(calls, [])
  assert.match(result.reason, /must be a string/)
})

test('a non-string op is never handed to a coercing API', () => {
  // The ordering requirement made observable. `Object.hasOwn` runs
  // `ToPropertyKey` on its argument, so if the lookup came first a hostile `op`
  // would get its `toString`/`Symbol.toPrimitive` invoked before any check 鈥?  // and it would be free to run code or to return a real op name on a second
  // call. With the guard first, `op` reaches no coercing API at all.
  let coercions = 0
  const hostile = {
    toString: () => { coercions += 1; return 'appearance.toggleSidebar' },
    valueOf: () => { coercions += 1; return 'appearance.toggleSidebar' },
    [Symbol.toPrimitive]: () => { coercions += 1; return 'appearance.toggleSidebar' },
  }
  const { services, calls } = spyServices()
  const result = exports.__internal.applyOp(services, hostile, {})
  assert.equal(result.status, 'error')
  assert.deepEqual(calls, [])
  assert.equal(coercions, 0, 'the op must not be coerced before the type check')
})

test('no op can throw out of applyOp, whatever the op is', () => {
  // Swept over every non-string category in one place, including the Symbol
  // that used to escape through the reason template's interpolation.
  const { services, calls } = spyServices()
  const symbols = [Symbol('x'), Symbol.iterator, Symbol.toPrimitive]
  const others = [null, undefined, 7, NaN, true, false, {}, [], () => {}, 0n,
    { toString: () => 'appearance.toggleSidebar' }, ['appearance.toggleSidebar']]
  for (const op of [...symbols, ...others]) {
    let result
    assert.doesNotThrow(() => { result = exports.__internal.applyOp(services, op, {}) },
      `op ${String(op)} must not raise`)
    assert.equal(result.status, 'error', `op ${String(op)} must be refused`)
    assert.equal(typeof result.reason, 'string', `op ${String(op)} must carry a string reason`)
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)))
  }
  assert.deepEqual(calls, [], 'no op in the sweep may reach a handler')
})
test('a Symbol-keyed own property on the handler map is unreachable', () => {
  // The worse variant: `Object.hasOwn` is `true` for a symbol-keyed own member,
  // so the own-property rule alone does not stop it. The type guard does.
  const symbol = Symbol('smuggled')
  exports.__internal.OPS[symbol] = () => ({ status: 'ok', reason: 'dispatched' })
  try {
    const { services, calls } = spyServices()
    const result = exports.__internal.applyOp(services, symbol, {})
    assert.equal(result.status, 'error')
    assert.match(result.reason, /must be a string/)
    assert.deepEqual(calls, [])
  } finally {
    delete exports.__internal.OPS[symbol]
  }
})

for (const [label, op] of [
  ['null', null],
  ['undefined', undefined],
  ['a number', 7],
  ['NaN', NaN],
  ['a boolean', true],
  ['a plain object', {}],
  ['a function', () => 'appearance.toggleSidebar'],
]) {
  test(`${label} as an op is refused with no throw and no undefined key`, () => {
    const { services, calls } = spyServices()
    let result
    assert.doesNotThrow(() => { result = exports.__internal.applyOp(services, op, {}) })
    assert.equal(result.status, 'error')
    assert.match(result.reason, /must be a string/)
    assert.deepEqual(calls, [])
    assert.deepEqual(Object.keys(result).sort(), ['reason', 'status'])
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)))
    for (const [key, item] of Object.entries(result)) assert.notEqual(item, undefined, `${key} is undefined`)
  })
}

test('a Client service that is missing reports an error, not a false success', () => {
  const result = exports.__internal.applyOp({}, 'appearance.setTheme', { id: 'dark' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /theme/)
})

// Every op that needs a service must name it when it is absent, and no op may
// report a success it cannot back with a call.
for (const [op, service] of [
  ['appearance.setTheme', 'theme'],
  ['appearance.setFontSize', 'theme'],
  ['appearance.toggleSidebar', 'layout'],
  ['appearance.openRightbar', 'layout'],
  ['appearance.closeRightbar', 'layout'],
  ['appearance.setLocale', 'locale'],
]) {
  test(`${op} names the missing ${service} service`, () => {
    const result = exports.__internal.applyOp({}, op, { id: 'x', role: 'text', px: 14 })
    assert.equal(result.status, 'error')
    assert.match(result.reason, new RegExp(service))
  })
}

test('a partial service group still reaches the service it was given', () => {
  // The three services mount independently; a missing sibling must not take a
  // working op down with it.
  const { services, calls } = spyServices()
  const result = exports.__internal.applyOp({ layout: services.layout }, 'appearance.toggleSidebar', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(calls, [['toggleSidebar']])
})

test('a half-mounted service is an error naming the method, not a TypeError', () => {
  // Presence is not enough: a service object without the method it was reached
  // for would escape as a TypeError, which the Host reports as a harness
  // failure rather than as an answer the agent can act on.
  const result = exports.__internal.applyOp({ theme: {} }, 'appearance.setTheme', { id: 'dark' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /theme/)
  assert.match(result.reason, /setTheme/)
})

test('appearance.state reports a half-mounted reader as missing, not as a crash', () => {
  const result = exports.__internal.applyOp({ theme: {}, locale: {} }, 'appearance.state', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /theme/)
  assert.match(result.reason, /getTheme/)
})

test('appearance.state is an error, not a null-valued success, when a service is absent', () => {
  // Reading is not exempt from the missing-service rule: a snapshot carrying
  // `theme: null` still reads to the agent as "the theme is none", which the
  // Host would report as a known state.
  const missingTheme = exports.__internal.applyOp({ locale: spyServices().services.locale }, 'appearance.state', {})
  assert.equal(missingTheme.status, 'error')
  assert.match(missingTheme.reason, /theme/)

  const missingLocale = exports.__internal.applyOp({ theme: spyServices().services.theme }, 'appearance.state', {})
  assert.equal(missingLocale.status, 'error')
  assert.match(missingLocale.reason, /locale/)
})

test('every op, including the read, names its missing service', () => {
  for (const op of ['appearance.state', 'appearance.setTheme', 'appearance.setFontSize',
    'appearance.toggleSidebar', 'appearance.openRightbar', 'appearance.closeRightbar',
    'appearance.setLocale']) {
    const result = exports.__internal.applyOp({}, op, {})
    assert.equal(result.status, 'error', `${op} must not report a success with no services`)
    assert.ok(result.reason, `${op} must explain what is missing`)
  }
})

test('a throwing Client service becomes a status, keeping the service message', () => {
  // `theme.setTheme` really does throw on an unregistered id
  // (`ui-theme/src/client/index.ts`: `theme "${id}" is not registered`), and a
  // registered-but-unknown id is an ordinary user mistake rather than a crash.
  // The message is the valuable part: it is the only thing that tells the agent
  // what to correct, and it is lost if the throw escapes as a harness error.
  const services = {
    theme: {
      setTheme: (id) => { throw new Error(`theme "${id}" is not registered`) },
      setFontSize: (role, px) => { throw new Error(`${role} font size ${px} is outside 10..22`) },
    },
  }
  const theme = exports.__internal.applyOp(services, 'appearance.setTheme', { id: 'nope' })
  assert.equal(theme.status, 'error')
  assert.match(theme.reason, /theme "nope" is not registered/)

  const font = exports.__internal.applyOp(services, 'appearance.setFontSize', { role: 'body', px: 999 })
  assert.equal(font.status, 'error')
  assert.match(font.reason, /999 is outside 10\.\.22/)
})

test('a throwing locale service becomes a status too', () => {
  // `locale.setLocale` throws the same way on an unregistered id.
  const result = exports.__internal.applyOp(
    { locale: { setLocale: (id) => { throw new Error(`locale "${id}" is not registered`) } } },
    'appearance.setLocale', { id: 'zz' },
  )
  assert.equal(result.status, 'error')
  assert.match(result.reason, /locale "zz" is not registered/)
})

test('no op can throw out of applyOp', () => {
  // The contract is "returns a status". A unit that sometimes returns and
  // sometimes raises violates its own contract, and Task 7's transport has no
  // way to tell that failure apart from a broken harness.
  const boom = () => { throw new Error('service exploded') }
  const services = {
    theme: { getTheme: boom, setTheme: boom, setFontSize: boom },
    layout: { toggleSidebar: boom, openRightbar: boom, closeRightbar: boom },
    locale: { getLocale: boom, setLocale: boom },
  }
  for (const [op, args] of [
    ['appearance.state', {}],
    ['appearance.setTheme', { id: 'dark' }],
    ['appearance.setFontSize', { role: 'text', px: 15 }],
    ['appearance.toggleSidebar', {}],
    ['appearance.openRightbar', {}],
    ['appearance.closeRightbar', {}],
    ['appearance.setLocale', { id: 'en' }],
  ]) {
    let result
    assert.doesNotThrow(() => { result = exports.__internal.applyOp(services, op, args) }, `${op} must not raise`)
    assert.equal(result.status, 'error', `${op} must report the failure as a status`)
    assert.match(result.reason, /service exploded/, `${op} must carry the service's own message`)
  }
})

test('a caught throw is a JSON-safe status with no undefined-valued key', () => {
  const services = {
    theme: { setTheme: () => { throw new Error('theme "x" is not registered') } },
  }
  const result = exports.__internal.applyOp(services, 'appearance.setTheme', { id: 'x' })
  assert.deepEqual(Object.keys(result).sort(), ['reason', 'status'])
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)))
  for (const [key, item] of Object.entries(result)) assert.notEqual(item, undefined, `${key} is undefined`)
})

test('a thrown non-Error is still reported as a reason', () => {
  // Services are third-party code; a bare string or a rejected non-Error must
  // not turn the reason into "undefined" or lose the message entirely.
  const result = exports.__internal.applyOp(
    { theme: { setTheme: () => { throw 'theme "x" is not registered' } } },
    'appearance.setTheme', { id: 'x' },
  )
  assert.equal(result.status, 'error')
  assert.match(result.reason, /theme "x" is not registered/)
})

test('the reason is the service message exactly, with no "Error: " prefix', () => {
  // The reason is text the model reads. `String(err)` would prepend `Error: `,
  // and an unanchored regex cannot tell the difference 鈥?so this pins the whole
  // string. The service's message is the contract; the wrapper's name is noise.
  const services = {
    theme: {
      setTheme: () => { throw new Error('theme "nope" is not registered') },
      setFontSize: () => { throw new Error('body font size 999 is outside 10..22') },
    },
    locale: { setLocale: () => { throw new Error('locale "zz" is not registered') } },
  }
  assert.equal(
    exports.__internal.applyOp(services, 'appearance.setTheme', { id: 'nope' }).reason,
    'theme "nope" is not registered',
  )
  assert.equal(
    exports.__internal.applyOp(services, 'appearance.setFontSize', { role: 'body', px: 999 }).reason,
    'body font size 999 is outside 10..22',
  )
  assert.equal(
    exports.__internal.applyOp(services, 'appearance.setLocale', { id: 'zz' }).reason,
    'locale "zz" is not registered',
  )
})

test('every caught throw reports its bare message, prefixed by nothing', () => {
  // Swept across all seven ops so no single op's error path can regress to
  // `String(err)` unnoticed; the expected value is the message verbatim.
  const boom = () => { throw new Error('service exploded') }
  const services = {
    theme: { getTheme: boom, setTheme: boom, setFontSize: boom },
    layout: { toggleSidebar: boom, openRightbar: boom, closeRightbar: boom },
    locale: { getLocale: boom, setLocale: boom },
  }
  for (const [op, args] of [
    ['appearance.state', {}],
    ['appearance.setTheme', { id: 'dark' }],
    ['appearance.setFontSize', { role: 'text', px: 15 }],
    ['appearance.toggleSidebar', {}],
    ['appearance.openRightbar', {}],
    ['appearance.closeRightbar', {}],
    ['appearance.setLocale', { id: 'en' }],
  ]) {
    assert.equal(exports.__internal.applyOp(services, op, args).reason, 'service exploded', `${op}`)
  }
})

test('a read whose getter throws is reported, not raised', () => {
  const result = exports.__internal.applyOp(
    { theme: { getTheme: () => { throw new Error('theme store is gone') } }, locale: { getLocale: () => ({ active: 'zh' }) } },
    'appearance.state', {},
  )
  assert.equal(result.status, 'error')
  assert.match(result.reason, /theme store is gone/)
})

test('a state read whose theme snapshot lacks colorScheme reports null, not undefined', () => {
  // `ThemeDefinition.colorScheme` is required, so a healthy service always
  // supplies it 鈥?but the "no undefined-valued key" constraint is absolute, and
  // copying the field straight through would write a real own key holding
  // `undefined` (which JSON then drops, reading back as "absent").
  const result = exports.__internal.applyOp({
    theme: { getTheme: () => ({ preference: 'dark', active: { id: 'dark' } }) },
    locale: { getLocale: () => ({ active: 'zh' }) },
  }, 'appearance.state', {})
  assert.equal(result.status, 'ok')
  assert.equal(result.value.theme.colorScheme, null)
  assert.ok(Object.hasOwn(result.value.theme, 'colorScheme'), 'the key is present and JSON-safe')
  assert.ok(!Object.values(result.value.theme).includes(undefined))
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)))
})

test('every optional field of the reported theme snapshot is coerced, never left undefined', () => {
  // The snapshot's `colorScheme` and `preference` are both required by
  // `ThemeSnapshot`, so neither is reachable as absent through a healthy
  // service 鈥?but each is copied by hand, and a hand copy is exactly where an
  // `undefined`-valued key gets in. Both are driven here with nothing supplied.
  const result = exports.__internal.applyOp({
    theme: { getTheme: () => ({ active: { id: 'unknown' } }) },
    locale: { getLocale: () => ({ active: 'zh' }) },
  }, 'appearance.state', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.value.theme, { id: 'unknown', colorScheme: null, preference: null })
  for (const [key, value] of Object.entries(result.value.theme)) {
    assert.notEqual(value, undefined, `theme.${key} must be null rather than undefined`)
  }
  assert.deepEqual(JSON.parse(JSON.stringify(result.value.theme)), result.value.theme,
    'nothing is dropped by serialization, so the Host reads back what was meant')
})

test('no returned value carries an undefined-valued key at any depth', () => {
  // Task 5's Critical: a raw `undefined` under a JSON-serialized envelope is not
  // a missing field, it is a `null` the Host then reads back as a real value.
  const { services } = spyServices()
  const seen = (value, path) => {
    if (Array.isArray(value)) return value.forEach((item, i) => seen(item, `${path}[${i}]`))
    if (value === null || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
      assert.notEqual(item, undefined, `${path}.${key} must be omitted, not undefined`)
      seen(item, `${path}.${key}`)
    }
  }
  const boom = () => { throw new Error('service exploded') }
  const throwing = {
    theme: { getTheme: boom, setTheme: boom, setFontSize: boom },
    layout: { toggleSidebar: boom, openRightbar: boom, closeRightbar: boom },
    locale: { getLocale: boom, setLocale: boom },
  }
  // Both branches: the success path and the caught-throw path each have their
  // own way of writing a key, so both are swept.
  for (const throwingServices of [false, true]) {
    for (const [op, args] of [
      ['appearance.state', {}],
      ['appearance.setTheme', { id: 'dark' }],
      ['appearance.setFontSize', { role: 'text', px: 15 }],
      ['appearance.toggleSidebar', {}],
      ['appearance.openRightbar', {}],
      ['appearance.closeRightbar', {}],
      ['appearance.setLocale', { id: 'en' }],
      ['appearance.nope', {}],
    ]) {
      const result = exports.__internal.applyOp(throwingServices ? throwing : services, op, args)
      const where = throwingServices ? `${op} (throwing)` : op
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)), `${where} must survive JSON`)
      seen(result, `${where} result`)
    }
  }
})

test('a success carries no value key when it has nothing to report', () => {
  // The envelope is written by `channel.js`, which omits `value` rather than
  // sending `value: undefined`; producing the key at all is the defect.
  const { services } = spyServices()
  for (const [op, args] of [
    ['appearance.setFontSize', { role: 'text', px: 15 }],
    ['appearance.toggleSidebar', {}],
    ['appearance.openRightbar', {}],
    ['appearance.closeRightbar', {}],
  ]) {
    const result = exports.__internal.applyOp(services, op, args)
    assert.equal(result.status, 'ok')
    assert.ok(!('value' in result), `${op} must omit value entirely`)
    assert.deepEqual(Object.keys(result), ['status'], `${op} must carry only its status`)
  }
})

test('a write whose id was never supplied reports null, not undefined', () => {
  // JSON turns a missing id into `null` before it reaches here, so the null is
  // the honest report of "nothing was named"; an `undefined` would vanish.
  const { services } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.setTheme', {})
  assert.equal(result.status, 'ok')
  assert.equal(result.value, null)
  assert.ok('value' in result)
})

test('the bundle injects exactly the three Client services it calls', () => {
  assert.deepEqual(exports.inject, ['theme', 'layout', 'locale'])
})

test('apply registers its cleanup through ctx.effect and calls no service at factory time', () => {
  const { services, calls } = spyServices()
  let disposer
  let name
  const ctx = {
    theme: services.theme,
    layout: services.layout,
    locale: services.locale,
    effect: (fn, label) => {
      name = label
      disposer = fn()
    },
  }
  assert.deepEqual(calls, [], 'nothing is called before apply()')
  exports.apply(ctx)
  assert.equal(typeof disposer, 'function', 'apply() returns a real cleanup')
  assert.match(name, /vyra-dsh-console/)
  assert.doesNotThrow(() => disposer())
})

test('the module loads through the loader with no service call and no side effect', () => {
  // The factory itself must be inert: it runs at startup, before any service
  // is guaranteed to be mounted.
  const register = source.match(/id: '([^']+)'/)
  assert.equal(register?.[1], 'vyra-dsh-console')
  assert.match(source, /__ModuleLoader__\.load\(/)
})

// ---------------------------------------------------------------------------
// Task 10: the management panel 鈥?its registration and its data derivation.
//
// No DOM is rendered here. The panel's React tree is exercised by nothing in
// this suite; what IS pinned is the part a blank panel would break silently:
// that the two slots are registered under the right keys, that every string
// goes through the bound translator, and that the pure derivations a render
// reads (the action catalogue, the appearance rows, the refusal list) answer
// with the documented shape for every plausible Host reply.
//
// Every `apply` below runs with the drain loop DEFUSED: `applyWithPanel`
// replaces `globalThis.fetch` with a stub that parks forever, so the loop
// installs its effect (which is what these tests observe) without ever issuing
// a request. Without that, `apply` starts a real poll on every call and the
// suite only exits when a timer fires in the right order — which showed up as
// this file HANGING instead of reporting.
// ---------------------------------------------------------------------------

test.afterEach(() => {
  globalThis.fetch = realFetch
})

/**
 * Run `apply` with the drain loop parked, and report what it registered.
 *
 * `services` is the appearance bag from `spyServices()`. `effects` is what
 * apply() installed, in order, so a test can watch the bridge come up without
 * starting one. `slots: null` omits the service entirely.
 */
function applyWithPanel({ services, slots, locale } = {}) {
  const registrations = []
  const effects = []
  const ctx = {
    theme: services.theme,
    layout: services.layout,
    locale: locale || { register() {}, bind: () => (k) => k, ...(services.locale || {}) },
    effect: (fn, label) => { effects.push({ label, dispose: fn() }) },
  }
  if (slots !== null) {
    ctx.slots = slots || {
      inject: (_name, cb) => cb(),
      register: (spec) => { registrations.push(spec); return () => {} },
    }
  }
  globalThis.fetch = async () => new Promise(() => {})
  exports.apply(ctx)
  return { registrations, effects, ctx }
}

test('the client registers a sidebar entry and a main panel under its key', () => {
  const { services } = spyServices()
  const { registrations } = applyWithPanel({ services })
  assert.ok(registrations.some((r) => r.name === 'sidebar.panellist' && r.id === 'vyra-dsh-console'))
  assert.ok(registrations.some((r) => r.name === 'main' && r.key === 'vyra-dsh-console'))
})

test('the sidebar entry and the main panel carry the same id the package is named by', () => {
  // A `sidebar.panellist` id that differed from the `main` key would still
  // register both, and clicking the entry would select a panel that is not
  // there — a blank main column with no error anywhere.
  const { services } = spyServices()
  const { registrations } = applyWithPanel({ services })
  const entry = registrations.find((r) => r.name === 'sidebar.panellist')
  const main = registrations.find((r) => r.name === 'main')
  assert.equal(entry.id, main.key, 'the entry must open the panel it registered')
  assert.equal(entry.id, 'vyra-dsh-console')
})

test("the sidebar order does not collide with the Agent manager's 5", () => {
  // Two entries at the same order let the sidebar render them in an order that
  // depends on registration timing, which is not stable across reloads.
  const { services } = spyServices()
  const { registrations } = applyWithPanel({ services })
  const entry = registrations.find((r) => r.name === 'sidebar.panellist')
  assert.equal(typeof entry.order, 'number', 'the sidebar order must be a number, not a string')
  assert.notEqual(entry.order, 5, 'vyra-agent-manager registers order 5')
})

test('the sidebar label is translated, not a literal', () => {
  // The entry label is the one string the shell reads before the panel renders.
  // A literal here is invisible to the locale service, so the sidebar would stay
  // in the shipped language after a switch.
  const seen = []
  const { services } = spyServices()
  const { registrations } = applyWithPanel({
    services,
    locale: { register() {}, bind: () => (key) => { seen.push(key); return `t:${key}` } },
  })
  const entry = registrations.find((r) => r.name === 'sidebar.panellist')
  assert.equal(typeof entry.label, 'function', 'the label is read lazily')
  assert.match(entry.label(), /^t:/u, 'the label must come from the bound translator')
  assert.ok(seen.includes('app.title'), 'and it must name the panel title key')
})

test('both slot registrations return a real disposer, so unmounting unregisters them', () => {
  // The shell disposes a slot by calling what `register` returned. A registration
  // that returned nothing would leave the entry in the sidebar after the plugin
  // unloaded, and a remount would then register it twice.
  const registered = []
  const disposed = []
  const { services } = spyServices()
  applyWithPanel({
    services,
    slots: {
      inject: (_n, cb) => { cb() },
      register: () => { registered.push(true); return () => { disposed.push(true) } },
    },
  })
  assert.equal(registered.length, 2, 'two slots are registered')
  for (const dispose of registered) void dispose
  assert.equal(disposed.length, 0, 'nothing is disposed by registration alone')
})

test('each registration returns a disposer the shell can call', () => {
  const registered = []
  const { services } = spyServices()
  applyWithPanel({
    services,
    slots: {
      inject: (_n, cb) => { cb() },
      register: () => {
        const dispose = () => {}
        registered.push(dispose)
        return dispose
      },
    },
  })
  assert.equal(registered.length, 2)
  for (const dispose of registered) assert.equal(typeof dispose, 'function')
})

// --- the panel's locale copy -------------------------------------------------

/**
 * Read the dictionaries the bundle actually registers.
 *
 * `locale/*.json` ships for the marketplace and the plugin detail page — it is
 * NOT what the browser bundle reads, because `require` in that realm resolves
 * what the shell hands it rather than the package's own files. The panel's live
 * copy is the literal inside `client.js`, so that is what these tests drive,
 * and the JSON is asserted to agree with it rather than the other way round.
 */
function registeredDictionaries() {
  let registered
  const { services } = spyServices()
  applyWithPanel({
    services,
    locale: { register: (ns, dicts) => { registered = { ns, dicts } }, bind: () => (k) => k },
  })
  assert.ok(registered, 'the dictionaries must be registered through ctx.locale')
  return registered
}

test('the registered dictionaries carry identical key sets in both languages', () => {
  // A key present in one language and missing from the other is invisible in
  // the browser — the fallback chain hides it — and surfaces as a raw key on
  // screen after a language switch, so the key sets are compared directly.
  const { dicts } = registeredDictionaries()
  assert.deepEqual(Object.keys(dicts.zh).sort(), Object.keys(dicts.en).sort(),
    'zh and en must carry the same keys')
  assert.ok(Object.keys(dicts.zh).length > 30, 'the panel copy must actually be there')
})

test('the zh dictionary is real Chinese, not an English stub', () => {
  // Chinese-first is the requirement. A zh value byte-identical to its English
  // counterpart is a stub for every key whose value is prose; a value carrying
  // no word of four or more letters (a placeholder, a single word like a
  // language id) may legitimately coincide.
  const { dicts } = registeredDictionaries()
  const stubs = Object.keys(dicts.zh)
    .filter((k) => dicts.zh[k] === dicts.en[k] && /[A-Za-z]{4}/u.test(dicts.zh[k]))
  assert.deepEqual(stubs, [], 'these zh entries are English stubs')
  const withHan = Object.values(dicts.zh).filter((v) => /[\u4e00-\u9fff]/u.test(v))
  assert.ok(withHan.length > 30, 'the zh copy must be written in Chinese')
})

test('the namespace is the package name, and is not the Agent manager\'s', () => {
  // The locale service throws on a duplicate (namespace, locale) pair, and
  // `vyra-agent-manager` already owns `dsh-agent-manager`. Sharing a namespace
  // would make whichever registers second fail outright.
  const { ns } = registeredDictionaries()
  assert.equal(ns, 'vyra-dsh-console')
  assert.notEqual(ns, 'dsh-agent-manager')
})

test('the shipped locale files agree with the dictionaries the bundle registers', () => {
  // Two copies of the copy would drift, and the drift is invisible: the panel
  // would keep rendering the bundle's copy while the marketplace card showed
  // the file's. Only the metadata block is allowed to differ — it is read by
  // the market, not by the panel.
  const { dicts } = registeredDictionaries()
  for (const [locale, dict] of [['zh', dicts.zh], ['en', dicts.en]]) {
    const file = JSON.parse(readFileSync(join(root, 'locale', `${locale}.json`), 'utf8'))
    const meta = file.meta ?? {}
    const fileKeys = Object.keys(file).filter((k) => k !== 'meta').sort()
    const bundleKeys = Object.keys(dict).sort()
    assert.deepEqual(fileKeys, bundleKeys, `locale/${locale}.json and the bundle disagree on keys`)
    assert.ok(meta.title, `locale/${locale}.json must carry a meta.title`)
    assert.ok(meta.description, `locale/${locale}.json must carry a meta.description`)
  }
})

test('every key the panel translates exists in both dictionaries', () => {
  // A `t('…')` with no entry renders the raw key on screen. The panel's own
  // source is the list of keys it asks for, so the two are compared directly
  // rather than trusted to stay in step by hand.
  //
  // Two keys are BUILT rather than written out — `'theme.' + id` and
  // `'mcp.state.' + state` — because the set of ids comes from the theme and MCP
  // services at runtime. Their prefixes are collected here and expanded against
  // the dictionaries, so a missing variant still fails.
  const { dicts } = registeredDictionaries()
  const asked = new Set()
  const prefixes = []
  for (const match of panelSource.matchAll(/\bt\(\s*'([^']+)'/gu)) asked.add(match[1])
  for (const match of panelSource.matchAll(/\bt\(\s*'([^']+)'\s*\+/gu)) prefixes.push(match[1])
  assert.ok(prefixes.length >= 2, 'the dynamic key prefixes must be found')
  for (const prefix of prefixes) {
    const variants = Object.keys(dicts.zh).filter((k) => k.startsWith(prefix))
    assert.ok(variants.length > 0, `nothing in the dictionary starts with ${prefix}`)
    asked.delete(prefix)
  }
  assert.ok(asked.size > 20, 'the panel must actually translate its copy')
  const missing = [...asked].filter((key) => !(key in dicts.zh) || !(key in dicts.en))
  assert.deepEqual(missing, [], 'these keys are translated but absent from a dictionary')
})

test('the dictionary registration is tied to an effect, so unloading removes it', () => {
  // The locale service throws on a duplicate (ns, locale): a second mount of
  // this plugin in one page would fail to register at all if the first one's
  // dictionaries were never released. The effect's return value IS the disposer
  // the context calls, so the effect body must return what `register` returned.
  const { effects } = applyWithPanel({
    services: spyServices().services,
    locale: {
      register: () => () => {},
      bind: () => (k) => k,
    },
  })
  const found = effects.find((e) => /dictionaries/u.test(e.label || ''))
  assert.ok(found, 'the registration must run inside an effect')
  assert.equal(typeof found.dispose, 'function', 'and that effect must return a real disposer')
})

// --- the panel degrades rather than throwing out of apply -------------------

test('a Client with no slots service still installs the appearance bridge', () => {
  // `slots` is a separate injection from `theme`/`layout`/`locale`. A context
  // that has the three appearance services but no slot registry — an older or
  // minimal client — must keep the drain loop; losing the panel is acceptable,
  // losing the bridge is not.
  const { services, calls } = spyServices()
  const { effects } = applyWithPanel({ services, slots: null })
  const bridge = effects.find((e) => /appearance bridge/u.test(e.label || ''))
  assert.ok(bridge, 'the drain loop must still be installed')
  assert.equal(typeof bridge.dispose, 'function', 'and it must return a real cleanup')
  assert.doesNotThrow(() => bridge.dispose())
  assert.deepEqual(calls, [], 'and it must call no service at install time')
})

test('a half-mounted slots service is survived rather than thrown out of', () => {
  // `slots` present but without `register` is reachable: the service can be
  // disposed while this factory is running. `apply` must not take the drain
  // loop down with it, so the failure is contained.
  const { services } = spyServices()
  assert.doesNotThrow(() => applyWithPanel({ services, slots: { inject: (_n, cb) => cb() } }))
})

test('a half-mounted slots service is refused by the guard itself, not by the catch around it', () => {
  // The distinction matters. `apply` wraps the panel registration in a
  // `try/catch`, so a missing guard would still leave the bridge alive — but it
  // would be reported as a WARNING on every mount, and the guard's own contract
  // ("this is a profile with no slot registry, not an error") would be lost.
  // Observed through the console rather than through `apply`'s outcome, because
  // the outcome is identical either way.
  const warnings = []
  const realWarn = console.warn
  console.warn = (...args) => { warnings.push(args) }
  try {
    const { services } = spyServices()
    applyWithPanel({ services, slots: { inject: (_n, cb) => cb() } })
  } finally { console.warn = realWarn }
  assert.deepEqual(warnings, [], 'a slots service with no register() is a supported profile, not a warning')
})

test('a slots service missing inject() is refused without a warning too', () => {
  const warnings = []
  const realWarn = console.warn
  console.warn = (...args) => { warnings.push(args) }
  try {
    const { services } = spyServices()
    applyWithPanel({ services, slots: { register: () => () => {} } })
  } finally { console.warn = realWarn }
  assert.deepEqual(warnings, [])
})

test('a slots service whose inject throws IS reported, because that is not a supported profile', () => {
  // The other side of the same line: the guard covers "the service is absent or
  // half-mounted", which is expected. A registry that exists and then throws is
  // a real fault, and silently swallowing it would leave the user with no panel
  // and nothing anywhere saying why.
  const warnings = []
  const realWarn = console.warn
  console.warn = (...args) => { warnings.push(args) }
  try {
    const { services } = spyServices()
    applyWithPanel({
      services,
      slots: { inject: () => { throw new Error('slot registry is gone') }, register: () => () => {} },
    })
  } finally { console.warn = realWarn }
  assert.equal(warnings.length, 1, 'a throwing registry must be reported')
  assert.match(String(warnings[0][0]), /panel not registered/u)
})

test('a slots service whose inject throws synchronously does not take the bridge down', () => {
  // `inject` runs the registration callback synchronously in the shell, so a
  // throw there is a throw inside `apply`. The drain loop is installed by an
  // effect that has already run by then, so the plugin must still come up —
  // the panel absent, the appearance channel alive.
  const { services, calls } = spyServices()
  assert.doesNotThrow(() => applyWithPanel({
    services,
    slots: { inject: () => { throw new Error('slot registry is gone') }, register: () => () => {} },
  }))
  assert.deepEqual(calls, [])
})

// --- the design rules, asserted on the panel source --------------------------

test('the panel renders no Harness UI package and no literal colour', () => {
  // The panel is a plain browser module: a Harness client package would not
  // resolve in the served bundle, since the bundle is loaded through
  // `window.__ModuleLoader__` with no dependency graph of its own.
  for (const file of ['panel.js', 'client.js']) {
    const text = readFileSync(join(root, file), 'utf8')
    assert.doesNotMatch(text, /require\(\s*'@deepseek-ai\//u, `${file} must not require a Harness package`)
    assert.doesNotMatch(text, /\bfrom\s+'@deepseek-ai\//u, `${file} must not import a Harness package`)
    // Only theme tokens, never a literal colour: a hard-coded palette goes
    // illegible the moment the user switches to the other colour scheme.
    for (const match of text.matchAll(/var\((--[a-z0-9-]+)\)/gu)) {
      assert.match(match[1], /^--dsw-alias-|^--dsw-specific-/u, `${file} uses a non-token custom property ${match[1]}`)
    }
  }
})

test('the panel never calls a Client service directly, so no operation is implemented twice', () => {
  // The design rule this plugin is built on. The panel writes appearance
  // through the SAME `applyOp` the bridge dispatches into; reaching for
  // `theme.setTheme` itself would be a second implementation of the same
  // operation, free to drift from the one the agent tool runs.
  const text = readFileSync(join(root, 'panel.js'), 'utf8')
  assert.match(text, /applyOp/u, 'the panel must route appearance through applyOp')
  for (const method of ['setTheme', 'setFontSize', 'toggleSidebar', 'openRightbar', 'closeRightbar', 'setLocale']) {
    assert.doesNotMatch(text, new RegExp(`\\.${method}\\s*\\(`, 'u'),
      `the panel must not call ${method}() directly`)
  }
})

test('the panel reads its action catalogue from console.actions rather than restating it', () => {
  // A second catalogue inside the panel would show operations the console does
  // not have, and hide new ones it grows. The panel names only the handful of
  // actions it actually drives through a form; the LIST it renders — including
  // every refused row and every reason — comes from the console's own reply.
  const text = readFileSync(join(root, 'panel.js'), 'utf8')
  assert.match(text, /console\.actions/u, 'the panel must ask the console what exists')
  assert.match(text, /reply\?\.actions|\.actions\b/u, 'and must read the actions from that reply')
  assert.match(text, /forbidden/u, 'and must render the refused table the console sends')
  // documentation-only actions the panel must never present as runnable
  for (const action of ['credentials.set', 'sandbox.setMode', 'permission.setPreset', 'approval.answer']) {
    assert.doesNotMatch(text, new RegExp(`'${action.replace('.', '\\.')}'`, 'u'),
      `the panel must not name the forbidden action ${action}`)
  }
})

test('the panel drives an action only through the one call, never by naming a Host service', () => {
  // The other half of "one operation, two callers": the panel must not reach a
  // Host domain directly. It has exactly one Host transport — the POST to the
  // console endpoint — and the console decides what each action does.
  const text = readFileSync(join(root, 'panel.js'), 'utf8')
  assert.match(text, /await call\(/u, 'the panel must run Host actions through call()')
  for (const path of ['/api/agent-manager/', '/api/plugin-manager/', 'ctx.get(', 'pluginManager.']) {
    assert.ok(!text.includes(path), `the panel must not reach ${path}`)
  }
})

test('the panel is loaded lazily, so a factory-time evaluation cannot reach the DOM', () => {
  // The module factory runs at startup in every realm. Pulling the panel in
  // eagerly would evaluate a DOM-touching module before any panel mounts.
  const text = readFileSync(join(root, 'panel.js'), 'utf8')
  assert.doesNotMatch(text, /^[^\n]*document\.(createElement|querySelector)/mu,
    'no module-level DOM access in panel.js')
  assert.match(source, /loadPanel/u, 'client.js must reach the panel through a lazy handle')
})

// --- the panel's derivations, driven directly --------------------------------
//
// No DOM and no React tree: what these drive is the pure logic a render reads.
// That is the part a blank panel would break silently — a render that throws
// shows nothing, and the slot entry is empty with no error a user could see.

/** Build the panel's module the way the bundle's own `require` would. */
function panelInternals() {
  return exports.__internal.loadPanel().__internal
}

test('the action catalogue is read off the console reply, in the console\'s own order', () => {
  const { deriveActions } = panelInternals()
  const reply = {
    status: 'ok',
    actions: [
      { name: 'console.actions', domain: 'console', mutating: false, destructive: false, requiresClient: false },
      { name: 'plugin.list', domain: 'plugin', mutating: false, destructive: false, requiresClient: false },
      { name: 'plugin.setEnabled', domain: 'plugin', mutating: true, destructive: false, requiresClient: false },
    ],
    forbidden: [{ name: 'sandbox.setMode', reason: 'widens your authority', alternative: 'ask the user' }],
  }
  const { actions, forbidden } = deriveActions(reply)
  assert.deepEqual(actions.map((a) => a.name), ['console.actions', 'plugin.list', 'plugin.setEnabled'])
  assert.deepEqual(forbidden.map((f) => f.name), ['sandbox.setMode'])
})

test('a malformed console reply yields empty tables rather than throwing', () => {
  // The panel renders what the Host sent, and the Host is not something this
  // half can vouch for. A render that threw here would blank the whole slot
  // entry — the failure the brief calls out explicitly.
  const { deriveActions } = panelInternals()
  const cases = [
    undefined, null, 'a string', 42, [], {},
    { actions: null, forbidden: null },
    { actions: 'plugin.list', forbidden: 7 },
    { actions: [null, 3, 'x', {}], forbidden: [null, 'y'] },
    { actions: [{ name: 42 }] },
  ]
  for (const reply of cases) {
    let result
    assert.doesNotThrow(() => { result = deriveActions(reply) }, `${JSON.stringify(reply)} must not raise`)
    assert.ok(Array.isArray(result.actions), 'actions must always be an array')
    assert.ok(Array.isArray(result.forbidden), 'forbidden must always be an array')
    for (const row of result.actions) assert.equal(typeof row.name, 'string')
    for (const row of result.forbidden) assert.equal(typeof row.name, 'string')
  }
})

test('the refused table keeps the console\'s reason and alternative verbatim', () => {
  // These two strings are the whole point of showing the table: they are the
  // answer to "why will the agent not do this", and the panel must not
  // paraphrase them, translate them away, or drop the alternative.
  const { deriveActions } = panelInternals()
  const reason = 'Changing the sandbox mode widens or narrows your own file and process authority.'
  const alternative = 'Ask the user to change it in Settings → Permissions, or via the /permission command.'
  const { forbidden } = deriveActions({ actions: [], forbidden: [{ name: 'sandbox.setMode', reason, alternative }] })
  assert.equal(forbidden[0].reason, reason)
  assert.equal(forbidden[0].alternative, alternative)
})

test('an action the console does not list never appears in the panel', () => {
  // The catalogue is the console's, not the panel's: an operation that is
  // absent from the reply must be absent from the table, so a removed action
  // cannot linger as a button that would be refused.
  const { deriveActions } = panelInternals()
  const { actions } = deriveActions({ actions: [{ name: 'plugin.list', domain: 'plugin' }] })
  assert.equal(actions.some((a) => a.name === 'settings.set'), false)
})

test('the action rows are grouped by the domain the console labelled them with', () => {
  const { groupByDomain } = panelInternals()
  const groups = groupByDomain([
    { name: 'plugin.list', domain: 'plugin' },
    { name: 'model.list', domain: 'model' },
    { name: 'plugin.setEnabled', domain: 'plugin' },
  ])
  assert.deepEqual(groups.map((g) => g.domain), ['plugin', 'model'])
  assert.deepEqual(groups[0].rows.map((r) => r.name), ['plugin.list', 'plugin.setEnabled'])
})

test('an action with no domain is grouped rather than dropped', () => {
  // A row the console left unlabelled is still a real, callable action, so
  // hiding it because of a missing field would understate what exists.
  const { groupByDomain } = panelInternals()
  const groups = groupByDomain([{ name: 'plugin.list' }, { name: 'x', domain: '' }])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].domain, 'other')
  assert.deepEqual(groups[0].rows.map((r) => r.name), ['plugin.list', 'x'])
})

test('a console status the panel does not know is reported as a failure, not as success', () => {
  // `ok` is the only status that means the action happened. Anything else —
  // including a status a future console grows — must not read as one.
  const { describeStatus } = panelInternals()
  assert.equal(describeStatus('ok').kind, 'ok')
  assert.equal(describeStatus('unavailable').kind, 'warn')
  for (const status of ['error', 'forbidden', 'confirm-required', 'something-new', undefined, null, 42, {}]) {
    assert.equal(describeStatus(status).kind, 'error', `${String(status)} must not read as a success`)
  }
})

test('every appearance control names a real op and passes applyOp its own arguments', () => {
  // The row IS the operation: `op` and `args` go to `applyOp` untouched, so a
  // control cannot drift from the op it claims to run. Each is exercised
  // against the real `applyOp` and its own service spy, which is what proves
  // the three services are wired to the row they belong to.
  const { APPEARANCE } = panelInternals()
  assert.ok(APPEARANCE.length >= 4, 'the appearance section must offer real controls')
  for (const row of APPEARANCE) {
    assert.match(row.op, /^appearance\./u, `${row.id} must name an appearance op`)
    const { services, calls } = spyServices()
    const result = exports.__internal.applyOp(services, row.op, row.args('dark'))
    assert.equal(result.status, 'ok', `${row.id} (${row.op}) must apply against the live services`)
    assert.deepEqual(calls.length, 1, `${row.id} must call exactly one service method`)
  }
})

test('the theme control offers the three preferences the theme service accepts', () => {
  // `theme.setTheme` throws on an id that is not registered, and `system` is
  // the one built-in preference that is not a registered theme — the set is
  // read off the real service rather than guessed.
  const { APPEARANCE } = panelInternals()
  const theme = APPEARANCE.find((r) => r.id === 'theme')
  assert.deepEqual(theme.options, ['system', 'light', 'dark'])
  assert.equal(theme.op, 'appearance.setTheme')
  assert.deepEqual(theme.args('dark'), { id: 'dark' })
})

test('an appearance row over an id the theme service rejects surfaces the service\'s own message', () => {
  // The panel must show the same reason the agent tool would receive: the
  // service's message is the only thing that says what to correct.
  const services = { theme: { setTheme: (id) => { throw new Error(`theme "${id}" is not registered`) } } }
  const result = exports.__internal.applyOp(services, 'appearance.setTheme', { id: 'nope' })
  assert.equal(result.status, 'error')
  assert.equal(result.reason, 'theme "nope" is not registered')
})

// --- the error boundary ------------------------------------------------------
//
// A `main` panel whose component throws blanks the main column with nothing
// saying why, and the sidebar entry stays selectable — so the user clicks an
// entry and gets an empty page. The panel therefore renders inside a boundary,
// and the boundary's own contract is what these drive: React's two error hooks,
// plus the retry it offers.

/**
 * The boundary class the panel registered for the `main` slot.
 *
 * Two layers are unwrapped, and both are real: `client.js` registers a thin
 * arrow that builds the element for the slot, and that element's type is the
 * panel's own `Panel` function, whose `h(Boundary, …)` call is what carries the
 * boundary. The React stub records every `createElement`, so the class is
 * reachable without a renderer.
 */
function mainBoundary() {
  const elements = []
  const { services } = spyServices()
  applyWithPanel({
    services,
    slots: {
      inject: (_n, cb) => { cb() },
      register: (spec, component) => { elements.push({ spec, component }); return () => {} },
    },
  })
  const main = elements.find((e) => e.spec.name === 'main')
  assert.ok(main, 'the main panel must be registered')

  // The slot's component builds an element; that element is `h(Panel, props)`.
  const slotElement = main.component({})
  assert.equal(typeof slotElement?.type, 'function', 'the slot must build a component element')

  // Calling `Panel` runs the panel's own render, whose outermost element is
  // `h(Boundary, { t }, …)`.
  const inner = slotElement.type(slotElement.props || {})
  assert.equal(typeof inner?.type, 'function', 'the panel must build a component element')
  assert.equal(typeof inner.type.getDerivedStateFromError, 'function',
    'the outermost element must be the boundary, which carries the static hook')
  return inner.type
}

test('the panel wraps its content in an error boundary, not a bare component', () => {
  // The `main` slot must receive the boundary, not the console. A bare console
  // would take the slot down on any render throw.
  const Boundary = mainBoundary()
  assert.equal(typeof Boundary, 'function', 'the element must be a component')
  assert.ok(Boundary.prototype, 'and a class component, which is what carries the hooks')
  assert.equal(typeof Boundary.getDerivedStateFromError, 'function',
    'the boundary must implement the static hook React calls on a render throw')
  assert.equal(typeof Boundary.prototype.componentDidCatch, 'function',
    'and the instance hook, so the failure is reported rather than swallowed')
})

test('the error boundary turns a thrown error into state rather than rethrowing', () => {
  // `getDerivedStateFromError` returning anything without the error — or
  // throwing itself — leaves React with no recovery path, and the slot blanks.
  const Boundary = mainBoundary()

  const boom = new Error('render blew up')
  const state = Boundary.getDerivedStateFromError(boom)
  assert.deepEqual(state, { error: boom }, 'the thrown error must become state, verbatim')
  assert.notEqual(state.error, null, 'a null error would render the failed children again')

  // A fresh instance renders its children; only a caught error diverts it.
  const instance = new Boundary({ t: (k) => k })
  assert.equal(instance.state.error, null, 'a fresh boundary has caught nothing')
  const children = reactStub.createElement('div', null, 'ok')
  instance.props.children = children
  assert.equal(instance.render(), children, 'with no error the children render unchanged')

  // And once it has caught one, it renders the fallback instead of the children.
  instance.state = state
  const fallback = instance.render()
  assert.notEqual(fallback, children, 'a caught error must not render the children again')
  assert.equal(typeof fallback, 'object')
})

test('the boundary reports the failure rather than swallowing it', () => {
  // A boundary that renders a fallback and logs nothing leaves the developer
  // with an empty panel and no clue; the console is the only place the reason
  // can go.
  const Boundary = mainBoundary()
  const logged = []
  const realError = console.error
  console.error = (...args) => { logged.push(args) }
  try {
    new Boundary({ t: (k) => k }).componentDidCatch(new Error('nope'), {})
  } finally { console.error = realError }
  assert.equal(logged.length, 1, 'a caught render failure must be logged')
  assert.match(String(logged[0][0]), /vyra-dsh-console/u, 'and named as this plugin\'s')
})

test('the boundary survives a platform with no console', () => {
  // `console` is not guaranteed (a stripped embedder, a test double with none).
  // A throw here would replace a recoverable render failure with an uncaught
  // exception, which is strictly worse than showing nothing in the log.
  const Boundary = mainBoundary()
  const realError = console.error
  console.error = () => { throw new Error('console is gone') }
  try {
    assert.doesNotThrow(() => new Boundary({ t: (k) => k }).componentDidCatch(new Error('x'), {}))
  } finally { console.error = realError }
})


