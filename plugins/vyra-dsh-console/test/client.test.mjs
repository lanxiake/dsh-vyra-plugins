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

let exports
const window = {
  __ModuleLoader__: {
    load: ({ id, factory }) => {
      assert.equal(id, 'vyra-dsh-console', 'the bundle registers under its package name')
      exports = factory(() => ({}))
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
  // answered without ever reaching a handler lookup — the failure is about the
  // request, not about this file's internals.
  const { services } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.definitelyNotAnOp', {})
  assert.doesNotMatch(result.reason, /is not a function/)
  assert.doesNotMatch(result.reason, /\bhandler\b/)
})

// The lookup must be own-property only. `OPS[op]` walks the prototype chain, so
// every `Object.prototype` name resolves as a "handler": `constructor` returns
// the OPS object itself — which is why the leak is real, not theoretical — and
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
  // object passed in — the live service bag. Asserted directly rather than only
  // through the loop above, because this is the one that leaks real state.
  const { services } = spyServices()
  const result = exports.__internal.applyOp(services, 'constructor', {})
  assert.equal(result.status, 'error')
  assert.notEqual(result, services)
  assert.notEqual(result.theme, services.theme)
  assert.doesNotMatch(JSON.stringify(result), /setTheme|toggleSidebar|getLocale/)
})

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
  // and an unanchored regex cannot tell the difference — so this pins the whole
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
  // supplies it — but the "no undefined-valued key" constraint is absolute, and
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
  // service — but each is copied by hand, and a hand copy is exactly where an
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
