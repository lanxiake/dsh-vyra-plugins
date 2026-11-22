import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'client.js')

function makeReact() {
  const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children: flatten(children) })
  return {
    createElement,
    Fragment: Symbol('Fragment'),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useMemo: fn => fn(),
    useRef: value => ({ current: value }),
    useCallback: fn => fn,
    useSyncExternalStore: () => undefined,
  }
}

function flatten(children) {
  const out = []
  for (const child of children) {
    if (Array.isArray(child)) out.push(...flatten(child))
    else if (child !== null && child !== undefined && child !== false && child !== true) out.push(child)
  }
  return out
}

function renderToString(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(renderToString).join('')
  if (typeof node.type === 'function') return renderToString(node.type({ ...node.props, children: node.children }))
  if (typeof node.type === 'symbol') return node.children.map(renderToString).join('')
  return node.children.map(renderToString).join('')
}

function loadBundle() {
  const source = readFileSync(clientPath, 'utf8')
  let registeredModule
  const window = {
    __ModuleLoader__: {
      load(definition) {
        registeredModule = definition.factory(name => {
          if (name === 'react') return makeReact()
          if (name === 'react-dom') return { createPortal: node => node }
          throw new Error(`unexpected require(${name})`)
        })
      },
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { documentElement: { lang: 'zh-CN' }, baseURI: 'http://127.0.0.1/' },
    location: { origin: 'http://127.0.0.1' },
    setTimeout, clearTimeout,
    fetch: () => Promise.reject(new Error('no network in tests')),
  }
  const context = { window, document: window.document, localStorage: window.localStorage,
    location: window.location, setTimeout, clearTimeout, fetch: window.fetch, console, URL, TextDecoder, structuredClone }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(source, context, { filename: 'client.js' })
  assert.ok(registeredModule !== undefined)
  return registeredModule
}

const bundle = loadBundle()
const { degradedMessage, DegradedBanner, h } = bundle.__test

test('an unreachable lane says so and offers a retry', () => {
  assert.deepEqual({ ...degradedMessage('lane-down') }, { text: '暂时连不上，请检查网络', canRetry: true })
})

test('an exhausted quota points at logging in', () => {
  assert.deepEqual({ ...degradedMessage('lane-throttled') },
    { text: '免费额度暂时用完，稍后再试或登录一个账号', canRetry: false })
})

test('a failed channel pack leaves the other two blocks alone', () => {
  assert.deepEqual({ ...degradedMessage('accounts-failed') }, { text: '账号功能暂时不可用', canRetry: false })
})

test('owned elsewhere names the other plugin', () => {
  assert.equal(degradedMessage('accounts-owned').text.includes('Our Free Model'), true)
})

test('a healthy state needs no message', () => {
  assert.equal(degradedMessage('ok'), undefined)
})

test('an unknown state is not treated as healthy', () => {
  assert.equal(degradedMessage('something-else'), undefined)
})

test('the banner renders nothing when there is no message', () => {
  assert.equal(renderToString(h(DegradedBanner, { state: 'ok' })), '')
})

test('the banner renders the text and a retry only when allowed', () => {
  const withRetry = renderToString(h(DegradedBanner, { state: 'lane-down', onRetry: () => {} }))
  assert.ok(withRetry.includes('暂时连不上'))
  assert.ok(withRetry.includes('重试'))
  const noRetry = renderToString(h(DegradedBanner, { state: 'lane-throttled', onRetry: () => {} }))
  assert.ok(noRetry.includes('免费额度'))
  assert.equal(noRetry.includes('重试'), false)
})
