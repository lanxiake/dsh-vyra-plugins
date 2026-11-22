import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'client.js')

/**
 * A React stub just large enough to build elements and evaluate a component
 * tree to a string. It keys on the element's `type`, so a component is simply
 * invoked and a host tag becomes markup.
 */
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
  if (typeof node === 'string' || typeof node === 'number') return escape(String(node))
  if (Array.isArray(node)) return node.map(renderToString).join('')
  if (typeof node.type === 'function') {
    return renderToString(node.type({ ...node.props, children: node.children }))
  }
  if (typeof node.type === 'symbol') return node.children.map(renderToString).join('')
  const attrs = Object.entries(node.props ?? {})
    .filter(([key, value]) => key !== 'children' && typeof value !== 'function' && value !== undefined && value !== null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${escape(String(value))}"`))
    .join('')
  return `<${node.type}${attrs}>${node.children.map(renderToString).join('')}</${node.type}>`
}

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Load `client.js` under a fake shell and return its exported module. */
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
    setTimeout,
    clearTimeout,
    fetch: () => Promise.reject(new Error('no network in tests')),
  }
  const context = { window, globalThis: undefined, document: window.document, localStorage: window.localStorage,
    location: window.location, setTimeout, clearTimeout, fetch: window.fetch, console, URL, TextDecoder, structuredClone }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(source, context, { filename: 'client.js' })
  assert.ok(registeredModule !== undefined, 'the bundle must call window.__ModuleLoader__.load')
  return registeredModule
}

const bundle = loadBundle()
const { h, ModelBlock, t } = bundle.__test

test('the client bundle registers the settings section and its icon', () => {
  const registered = []
  let injected = 0
  const ctx = {
    slots: {
      inject: (name, fn) => { injected += 1; return fn() },
      register: decl => { registered.push(decl); return () => {} },
    },
    locale: { getLocale: () => ({ active: 'zh-CN' }) },
  }
  bundle.apply(ctx)
  assert.ok(injected >= 1)
  assert.ok(registered.some(r => r.name === 'settings.section' && r.id === 'vyra-free-model' && r.order === 36))
  assert.ok(registered.some(r => r.name === 'settings.section.icon' && r.id === 'vyra-free-model'))
})

test('the section declares a nav label in both languages', () => {
  assert.equal(typeof t('nav'), 'string')
  assert.ok(t('nav').length > 0)
})

test('the model block lists every catalog model with its context', () => {
  const html = renderToString(h(ModelBlock, {
    models: [{ id: 'a:free', name: 'A', contextWindow: 1048576, vision: true }],
    selected: 'a:free',
    onSelect: () => {},
  }))
  assert.ok(html.includes('A'))
  assert.ok(html.includes('1M'))
  assert.ok(html.includes('能看图'))
})

test('the model block always offers automatic selection first', () => {
  const html = renderToString(h(ModelBlock, { models: [], selected: '', onSelect: () => {} }))
  assert.ok(html.includes('自动选择'))
})

test('a 256K context is written as 256K, not as a raw number', () => {
  const html = renderToString(h(ModelBlock, {
    models: [{ id: 'b:free', name: 'B', contextWindow: 262144, vision: false }],
    selected: '',
    onSelect: () => {},
  }))
  assert.ok(html.includes('256K'))
  assert.equal(html.includes('262144'), false)
})

test('a long roster collapses and offers to expand', () => {
  const models = Array.from({ length: 13 }, (_, index) => ({
    id: `m${index}:free`, name: `Model ${index}`, contextWindow: 262144, vision: false,
  }))
  const html = renderToString(h(ModelBlock, { models, selected: '', onSelect: () => {} }))
  assert.ok(html.includes('展开全部 13 个'))
  assert.equal(html.includes('Model 12'), false)
})

test('a short roster shows everything without an expand control', () => {
  const models = [{ id: 'a:free', name: 'Only', contextWindow: 262144, vision: false }]
  const html = renderToString(h(ModelBlock, { models, selected: '', onSelect: () => {} }))
  assert.equal(html.includes('展开全部'), false)
  assert.ok(html.includes('Only'))
})
