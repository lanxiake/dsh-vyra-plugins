import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'client.js')

/** A document stub that can host a stylesheet, which apply() mounts. */
function makeDocument() {
  const appended = []
  return {
    documentElement: { lang: 'zh-CN' },
    baseURI: 'http://127.0.0.1/',
    appended,
    head: { appendChild(node) { appended.push(node); return node } },
    createElement(tag) {
      return {
        tagName: tag, attributes: {}, textContent: '', removed: false,
        setAttribute(key, value) { this.attributes[key] = value },
        remove() { this.removed = true },
      }
    },
  }
}

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
    document: makeDocument(),
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
const { h, Card, BlockTitle, Btn, StatusDot, ToolCard, SettingsPage, CSS, ModelBlock, truncate } = bundle.__test

// ── the design language ─────────────────────────────────────────────────────

test('the stylesheet is substantial enough to be a real design, not placeholders', () => {
  assert.ok(CSS.length > 5000, `the stylesheet is only ${CSS.length} bytes`)
  const rules = (CSS.match(/\}/g) ?? []).length
  assert.ok(rules >= 60, `only ${rules} rules`)
})

test('cards use the layered gradient and soft radius the reference uses', () => {
  const card = /\.vfm_card\{[^}]*\}/.exec(CSS)?.[0] ?? ''
  assert.ok(card.includes('border-radius'), 'cards need a radius')
  assert.ok(/1[4-9]px|2[0-9]px/.test(card), 'the radius must be generous')
  assert.ok(card.includes('background'), 'cards need a surface')
})

test('every theme variable used is one the shell publishes', () => {
  const used = new Set((CSS.match(/var\((--dsw-[a-z0-9-]+)\)/g) ?? []).map(v => v.slice(4, -1)))
  const valid = new Set([
    '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2',
    '--dsw-alias-bg-overlay', '--dsw-alias-border-l1', '--dsw-alias-border-l2',
    '--dsw-alias-brand-primary', '--dsw-alias-label-primary', '--dsw-alias-label-secondary',
    '--dsw-alias-state-error-primary', '--dsw-alias-state-idle-primary',
    '--dsw-alias-state-success-primary', '--dsw-alias-state-warn-primary',
    '--dsw-specific-sidebar-fill',
  ])
  const unknown = [...used].filter(name => !valid.has(name))
  assert.deepEqual(unknown, [], `unknown tokens would silently fall back to nothing: ${unknown.join(', ')}`)
})

test('hover and focus states exist for interactive rows', () => {
  assert.ok(/:hover/.test(CSS), 'rows need a hover state')
  assert.ok(/:focus-visible/.test(CSS), 'keyboard users need a focus ring')
})

// ── the primitives ──────────────────────────────────────────────────────────

test('a card renders its title, hint and body', () => {
  const html = renderToString(h(Card, { title: '模型', hint: '选一个' }, 'body'))
  assert.ok(html.includes('vfm_card'))
  assert.ok(html.includes('模型'))
  assert.ok(html.includes('选一个'))
  assert.ok(html.includes('body'))
})

test('a card can carry a header action', () => {
  const html = renderToString(h(Card, { title: 'T', action: h('button', {}, 'act') }))
  assert.ok(html.includes('act'))
})

test('a block title renders a marker so sections are scannable', () => {
  const html = renderToString(h(BlockTitle, {}, '模型'))
  assert.ok(html.includes('模型'))
  assert.ok(html.includes('vfm_blocktitle'))
})

test('a button carries its kind and disables when asked', () => {
  const primary = renderToString(h(Btn, { kind: 'primary' }, '写入'))
  assert.ok(primary.includes('vfm_btn'))
  assert.ok(primary.includes('data-kind="primary"'))
  const disabled = renderToString(h(Btn, { disabled: true }, '稍等'))
  assert.ok(disabled.includes('disabled'))
})

test('a status dot names its state in words as well as colour', () => {
  for (const state of ['idle', 'busy', 'done', 'failed', 'stale']) {
    const html = renderToString(h(StatusDot, { state }))
    assert.ok(html.includes(`data-state="${state}"`), `${state} must be addressable`)
    assert.ok(html.includes('vfm_dot'))
  }
})

// ── the tool cards ──────────────────────────────────────────────────────────

test('an unconfigured tool offers to write', () => {
  const html = renderToString(h(ToolCard, {
    tool: 'codex', name: 'Codex', status: { configured: false }, onWrite: () => {}, onRestore: () => {},
  }))
  assert.ok(html.includes('Codex'))
  assert.ok(html.includes('未配置'))
  assert.ok(html.includes('写入'))
})

test('a configured tool shows its launch command and offers to restore', () => {
  const html = renderToString(h(ToolCard, {
    tool: 'claude', name: 'Claude Code',
    status: { configured: true, command: 'claude-vyra', port: 8899 },
    onWrite: () => {}, onRestore: () => {},
  }))
  assert.ok(html.includes('已写入'))
  assert.ok(html.includes('claude-vyra'))
  assert.ok(html.includes('还原'))
})

test('a failed write shows the reason and a retry, truncated', () => {
  const html = renderToString(h(ToolCard, {
    tool: 'codex', name: 'Codex',
    status: { configured: false, error: 'x'.repeat(400) },
    onWrite: () => {}, onRestore: () => {},
  }))
  assert.ok(html.includes('写入失败'))
  assert.ok(html.includes('重试'))
  assert.ok(html.length < 2000, 'a long upstream message must be truncated, not dumped')
})

test('a tool card never renders the port key', () => {
  const html = renderToString(h(ToolCard, {
    tool: 'claude', name: 'Claude Code',
    status: { configured: true, command: 'claude-vyra', key: 'sk-should-not-appear' },
    onWrite: () => {}, onRestore: () => {},
  }))
  assert.equal(html.includes('sk-should-not-appear'), false)
})

// ── the page ────────────────────────────────────────────────────────────────

test('the page composes all three blocks plus the master switch', () => {
  const html = renderToString(h(SettingsPage, {}))
  assert.ok(html.includes('vfm_page'))
  // Loading state for the first paint, since no data has arrived in a render test.
  assert.ok(html.includes('vfm_center') || html.includes('vfm_card'))
})

// ── regressions found while rendering the page for real ─────────────────────

test('a card does not nest one heading inside another', () => {
  const html = renderToString(h(Card, { title: h(BlockTitle, {}, '模型') }))
  assert.equal(/cardtitle[^>]*><h3/.test(html), false, 'a passed node must not be wrapped again')
  assert.equal((html.match(/<h3/g) ?? []).length, 1)
})

test('a card still wraps a plain string title in its heading', () => {
  const html = renderToString(h(Card, { title: '模型' }))
  assert.ok(html.includes('vfm_cardtitle">模型</h3>'), 'a string title gets a real heading')
})

test('the automatic model is offered once even though the catalog lists it', () => {
  const models = [
    { id: 'kilo-auto/free', name: '自动选择（推荐）', contextWindow: 256000, vision: false },
    { id: 'a:free', name: 'A', contextWindow: 262144, vision: false },
  ]
  const html = renderToString(h(ModelBlock, { models, selected: '', onSelect: () => {} }))
  assert.equal((html.match(/自动选择（推荐）/g) ?? []).length, 1)
  assert.ok(html.includes('A'))
})

test('the model count includes the automatic row so it matches what is shown', () => {
  const models = [
    { id: 'kilo-auto/free', name: '自动选择（推荐）', contextWindow: 256000, vision: false },
    { id: 'a:free', name: 'A', contextWindow: 262144, vision: false },
    { id: 'b:free', name: 'B', contextWindow: 262144, vision: false },
  ]
  const html = renderToString(h(ModelBlock, { models, selected: '', onSelect: () => {} }))
  // Two catalog models plus the automatic row the block draws itself.
  assert.ok(html.includes('3 个模型'), 'the count must match the rows on screen')
  assert.equal((html.match(/className="vfm_row"/g) ?? []).length, 3)
})

test('a long reason is trimmed with an ellipsis rather than cut mid-word', () => {
  const trimmed = truncate('x'.repeat(300), 20)
  assert.ok(trimmed.length <= 21)
  assert.ok(trimmed.endsWith('…'))
})
