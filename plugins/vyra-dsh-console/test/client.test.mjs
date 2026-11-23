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
    const result = exports.__internal.applyOp(services, op, args)
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)), `${op} must survive JSON`)
    seen(result, `${op} result`)
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
