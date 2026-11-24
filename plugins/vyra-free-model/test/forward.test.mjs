import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createApiRoutes } from '../index.js'

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
  if (typeof node === 'string' || typeof node === 'number') return escape(String(node))
  if (Array.isArray(node)) return node.map(renderToString).join('')
  if (typeof node.type === 'function') return renderToString(node.type({ ...node.props, children: node.children }))
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
const { h, ForwardBlock, cursorSnippet, claudeCodeSnippet } = bundle.__test

test('the cursor snippet carries the base url and key', () => {
  const snippet = cursorSnippet(8899, 'sk-abc')
  assert.ok(snippet.includes('http://127.0.0.1:8899/v1'))
  assert.ok(snippet.includes('sk-abc'))
})

test('the claude code snippet sets the three environment variables with the given model', () => {
  const snippet = claudeCodeSnippet(8899, 'sk-abc', 'kilo-auto/free')
  assert.ok(snippet.includes('ANTHROPIC_BASE_URL=http://127.0.0.1:8899'))
  assert.ok(snippet.includes('ANTHROPIC_AUTH_TOKEN=sk-abc'))
  assert.ok(snippet.includes('ANTHROPIC_MODEL=kilo-auto/free'))
})

test('the claude code snippet falls back to automatic when no model is chosen', () => {
  const snippet = claudeCodeSnippet(8899, 'sk-abc', '')
  assert.ok(snippet.includes('ANTHROPIC_MODEL=kilo-auto/free'))
})

test('a disabled forward block shows the switch and hides the address', () => {
  const out = renderToString(h(ForwardBlock, { enabled: false, port: 0, hasKey: false, onToggle: () => {} }))
  assert.equal(out.includes('http://127.0.0.1'), false)
  assert.ok(out.includes('别的工具'))
  assert.ok(out.includes('打开'))
})

test('an enabled forward block shows the real port and a masked key', () => {
  const out = renderToString(h(ForwardBlock, { enabled: true, port: 8901, hasKey: true, onToggle: () => {} }))
  assert.ok(out.includes('8901'))
  assert.ok(out.includes('••'))
})

test('the masked key never contains the key itself', () => {
  const out = renderToString(h(ForwardBlock, {
    enabled: true, port: 8901, hasKey: true, key: 'sk-supersecret', onToggle: () => {},
  }))
  assert.equal(out.includes('sk-supersecret'), false)
  assert.ok(out.includes('••'))
})

test('an enabled block explains both client snippets are copyable', () => {
  const out = renderToString(h(ForwardBlock, { enabled: true, port: 8901, hasKey: true, onToggle: () => {} }))
  assert.ok(out.includes('Cursor'))
  assert.ok(out.includes('Claude Code'))
})

/** Drive one route request. */
function call(handler, { method = 'POST', path, body } = {}) {
  return new Promise(resolve => {
    const req = {
      method,
      url: `/api/dsh-vyra-free-model${path}`,
      headers: {},
      on(event, fn) {
        if (event === 'data' && body !== undefined) fn(Buffer.from(JSON.stringify(body)))
        if (event === 'end') fn()
        return req
      },
    }
    const res = {
      statusCode: 0,
      writeHead(status) { this.statusCode = status },
      end(payload) { resolve({ status: this.statusCode, body: payload === '' ? undefined : JSON.parse(payload) }) },
    }
    void handler(req, res)
  })
}

const deps = overrides => ({
  version: '0.1.0',
  settings: {},
  catalog: () => [],
  laneOk: () => true,
  accounts: () => ({ state: 'ready', providers: [] }),
  usage: () => ({ input: 0, output: 0, total: 0 }),
  forward: () => ({ enabled: true, port: 8901, key: 'sk-local-only' }),
  refreshCatalog: async () => [],
  setForward: async enabled => ({ enabled, port: enabled ? 8901 : 0, key: enabled ? 'sk-local-only' : '' }),
  ...overrides,
})

test('the key route hands back the local key so the copy buttons can work', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { path: '/forward/key' })
  assert.equal(res.status, 200)
  assert.equal(res.body.key, 'sk-local-only')
})

test('the key route answers 409 when the port is off', async () => {
  const handler = createApiRoutes(deps({ forward: () => ({ enabled: false, port: 0, key: '' }) }))
  const res = await call(handler, { path: '/forward/key' })
  assert.equal(res.status, 409)
})

test('the summary still hides the key even when one exists', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { method: 'GET', path: '/summary' })
  assert.equal(res.body.forward.hasKey, true)
  assert.equal(JSON.stringify(res.body).includes('sk-local-only'), false)
})

test('the key route refuses a proxied request', async () => {
  const handler = createApiRoutes(deps())
  const res = await new Promise(resolve => {
    const req = { method: 'POST', url: '/api/dsh-vyra-free-model/forward/key', headers: { 'x-forwarded-for': '10.0.0.1' },
      on() { return req } }
    const res2 = { statusCode: 0, writeHead(status) { this.statusCode = status }, end(p) { resolve({ status: this.statusCode, body: JSON.parse(p) }) } }
    void handler(req, res2)
  })
  assert.equal(res.status, 403)
})
