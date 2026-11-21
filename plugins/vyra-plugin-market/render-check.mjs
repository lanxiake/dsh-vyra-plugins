// Render-time self-check: mount the market tab against a stubbed React and
// Remote, let its effects settle, and assert what it drew and what a press on
// its controls issues.
//
//   node plugins/vyra-plugin-market/render-check.mjs
//
// The React stub gives each component its own hook slots, runs function
// components inline, and flushes effects after each render, so the tab reaches
// its loaded state the way it does in the client. It is still a smoke test: it
// does not model re-render scheduling, so a bug that needs two competing
// renders can slip past it.

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname)
const source = readFileSync(join(root, 'client.js'), 'utf8')

/** A React stub: per-component persistent hooks, inline function components, flushed effects. */
function makeReact() {
  /** Each component's own slots and its first-render effect queue. */
  const components = new Map()
  /** Effects queued by the render in progress. */
  let pending = []

  /** The frame of the component now rendering. */
  let frame = null
  const hook = () => {
    const at = frame.cursor
    frame.cursor += 1
    return at
  }

  const api = {
    useState: (initial) => {
      const at = hook()
      const record = frame
      if (!(at in record.slots)) record.slots[at] = typeof initial === 'function' ? initial() : initial
      // The setter writes the component's own slot, so it works outside the
      // render too — which is exactly when an async read settles.
      return [record.slots[at], (value) => { record.slots[at] = typeof value === 'function' ? value(record.slots[at]) : value }]
    },
    useRef: (initial) => {
      const at = hook()
      frame.slots[at] ??= { current: initial }
      return frame.slots[at]
    },
    useEffect: (fn) => { hook(); pending.push(fn) },
    useMemo: (fn) => { hook(); return fn() },
    useCallback: (fn) => { hook(); return fn },
    createElement: (type, props, ...children) => {
      if (typeof type !== 'function') return { type, props: props ?? {}, children }
      const record = components.get(type) ?? { slots: [], cursor: 0, effects: [], mounted: false }
      components.set(type, record)
      record.cursor = 0
      const outer = { frame, pending }
      frame = record
      pending = []
      const element = type({ ...(props ?? {}), children })
      // A component runs its effects once, on its first render.
      if (!record.mounted) { record.mounted = true; outer.pending.push(...pending) }
      ;({ frame, pending } = outer)
      return element
    },
    /** Start a component's render frame. */
    begin(type) {
      const record = components.get(type) ?? { slots: [], cursor: 0, effects: [], mounted: false }
      components.set(type, record)
      record.cursor = 0
      const outer = { frame, pending }
      frame = record
      pending = []
      return { outer, record }
    },
    /** End it, queueing the render's effects and checking the hook count. */
    end(handle) {
      // React's own rule: a component must call the same hooks on every render.
      // A hook behind an early return changes this count, which React reports
      // as error #310 — the exact failure this guard exists to catch.
      if (handle.record.hooks === undefined) handle.record.hooks = handle.record.cursor
      else assert.equal(
        handle.record.cursor, handle.record.hooks,
        `a render called ${handle.record.cursor} hooks, an earlier one called ${handle.record.hooks}`
        + ' — a hook likely sits behind an early return',
      )
      // This stub reruns every effect on every render rather than comparing a
      // dependency list, so a component that should react to a changed value
      // does; one that must not rerun would show up as extra Host reads only.
      handle.outer.pending.push(...pending)
      ;({ frame, pending } = handle.outer)
    },
    /** Drain the queued effects, then let their promises settle. */
    async flush() {
      while (pending.length > 0) {
        const queue = pending
        pending = []
        for (const fn of queue) fn()
      }
      for (let turn = 0; turn < 12; turn += 1) await Promise.resolve()
    },
  }
  return api
}

/** The browser surface the bundle touches: a stylesheet insert and two listeners. */
function makeDocument() {
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: () => {} },
  }
}

/** Load the bundle under a stubbed loader. */
function loadBundle(react) {
  let exports
  const window = { __ModuleLoader__: { load: ({ factory }) => { exports = factory((specifier) => {
    assert.equal(specifier, 'react', `the bundle requires only react, got ${specifier}`)
    return react
  }) } } }
  new Function('window', 'document', source)(window, makeDocument())
  return exports
}

/** One listing entry. */
function entry(name, overrides = {}) {
  return {
    name,
    title: { en: name },
    description: { en: `${name} description` },
    metadata: { keywords: [], labels: [], sortKeys: {} },
    defaultVersion: '1.0.0',
    installation: { status: 'not-installed' },
    versions: [{
      version: '1.0.0', publishTimestamp: 1_700_000_000, source: { type: 'npm' },
      install: { spec: `${name}@1.0.0` }, compatibility: { compatible: true }, update: false,
    }],
    ...overrides,
  }
}

/** One search page. */
function makePage(entries) {
  return {
    url: 'https://example.invalid/index.json',
    title: { en: 'Example market' },
    metadata: { categories: { tools: { title: { en: 'Tools' } } }, labels: {}, sortKeys: {} },
    fetchedAt: 1, total: entries.length, nextOffset: null, entries,
  }
}

/** A Host Remote that records every call and answers from mutable state.
 *  `state.answers` may override any method's answer, to drive a failure path. */
function makeRemote(state) {
  const calls = []
  const ok = (value) => Promise.resolve({ ok: true, value })
  const answers = state.answers ?? {}
  const answer = (name, fallback) => answers[name] ?? fallback
  return {
    calls,
    $on: (event) => { calls.push(['$on', event]); return () => {} },
    pluginMarket: {
      listIndexes: () => { calls.push(['listIndexes']); return ok(state.sources) },
      setIndexes: (urls) => { calls.push(['setIndexes', urls]); return ok(undefined) },
      search: (url, query) => { calls.push(['search', url, query]); return ok(state.page) },
    },
    pluginManager: {
      listBundles: () => { calls.push(['listBundles']); return ok(state.bundles) },
      installBundle: (spec, options) => { calls.push(['installBundle', spec, options]); return answer('installBundle', ok({ application: 'applied' })) },
      updateBundle: (name, version, options) => { calls.push(['updateBundle', name, version, options]); return answer('updateBundle', ok({ result: { application: 'applied' } })) },
      removeBundle: (name) => { calls.push(['removeBundle', name]); return answer('removeBundle', ok({ application: 'applied' })) },
      setBundleEnabled: (name, enabled) => { calls.push(['setBundleEnabled', name, enabled]); return answer('setBundleEnabled', ok({ application: 'applied' })) },
    },
  }
}

/** Every string a rendered tree would show. */
function texts(node, out = []) {
  if (node === null || node === undefined || node === false || node === true) return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { for (const child of node) texts(child, out); return out }
  if (typeof node === 'object') for (const child of node.children ?? []) texts(child, out)
  return out
}

/** Every element in a rendered tree for which `match` holds. */
function findAll(node, match, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) findAll(child, match, out); return out }
  if (match(node)) out.push(node)
  for (const child of node.children ?? []) findAll(child, match, out)
  return out
}

/** Every button whose accessible text is exactly `label`. */
function buttonByText(tree, label) {
  return findAll(tree, (node) => node.type === 'button' && texts(node).join('').trim() === label)[0]
}

/** Mount the tab, settle its reads, and return the drawn tree with its Remote. */
async function mount({ sources = [{ url: 'https://example.invalid/index.json' }], entries = [entry('alpha'), entry('beta')], bundles = [], answers = {} } = {}) {
  const react = makeReact()
  const bundle = loadBundle(react)
  assert.deepEqual(
    bundle.inject,
    ['slots', 'locale', 'remote', 'remote.pluginMarket', 'remote.pluginManager'],
    'the bundle declares every service it reads',
  )
  const remote = makeRemote({ sources, bundles, page: makePage(entries), answers })
  let Component = null
  bundle.apply({
    effect: (fn) => fn(),
    locale: { register: () => {}, bind: () => (key) => key },
    slots: {
      inject: (name, register) => { assert.equal(name, 'plugins.tab', 'the tab registers beside Installed'); register() },
      register: (_options, component) => { Component = component },
    },
    remote,
  })
  const props = {
    t: (key, params) => (params === undefined ? key : `${key}${JSON.stringify(params)}`),
    remote,
    useLocale: (select) => select({ active: 'en' }),
  }
  // The stub has no scheduler, so render and settle several turns by hand: a
  // read sets state, which the next render reads, which loads the page, and so
  // on until the tab reaches its loaded state. `settle` re-runs that loop after
  // a press, which is how a test follows an action to what it drew.
  let tree = null
  const render = async (turns = 1) => {
    for (let turn = 0; turn < turns; turn += 1) {
      const handle = react.begin(Component)
      tree = Component(props, {})
      react.end(handle)
      await react.flush()
    }
    return tree
  }
  tree = await render(8)
  return { tree, remote, settle: () => render(3) }
}

// --- the registration targets the tab slot beside Installed ------------------
await (async () => {
  const react = makeReact()
  const bundle = loadBundle(react)
  let options = null
  bundle.apply({
    effect: (fn) => fn(),
    locale: { register: () => {}, bind: () => (key) => key },
    slots: { inject: (_name, register) => { register() }, register: (seen) => { options = seen } },
    remote: makeRemote({ sources: [], bundles: [], page: makePage([]) }),
  })
  assert.equal(options.name, 'plugins.tab')
  assert.equal(options.id, 'market')
  assert.equal(options.locale, 'vyra-plugin-market')
  assert.equal(typeof options.label, 'function')
  assert.equal(options.order, 10, 'the tab sorts after the page\'s own Installed entry')
})()

// --- a page draws one card per entry, with the source name in the toolbar -----
{
  const { tree, remote } = await mount({ entries: [entry('alpha'), entry('beta')] })
  const drawn = texts(tree).join(' | ')
  assert.ok(drawn.includes('alpha'), `the tree names alpha, got: ${drawn}`)
  assert.ok(drawn.includes('beta'), `the tree names beta, got: ${drawn}`)
  assert.ok(remote.calls.some(([name]) => name === 'search'), 'the tab searched the active source')
  assert.ok(remote.calls.some(([name]) => name === 'listBundles'), 'the tab read the installed bundles')
}

// --- an empty source list adopts our own market instead of showing nothing ---
{
  const { remote } = await mount({ sources: [], entries: [] })
  const set = remote.calls.find(([name]) => name === 'setIndexes')
  assert.ok(set !== undefined, 'an unconfigured profile gets a source added')
  // The default source is the ghproxy mirror: reachable in CN without a GitHub detour.
  assert.deepEqual(set[1], ['https://ghproxy.net/https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/master/docs/index.json'])
}

// --- this plugin's own market leads, whatever the configured order ----------
{
  // A profile often lists a third-party index ahead of ours, which is exactly
  // the case the tab has to get right: it opens on our market, and our market
  // is the first row of the menu.
  const ours = 'https://lanxiake.github.io/dsh-vyra-plugins/index.json'
  const other = 'https://cdn.example.invalid/market/index.json'
  const { remote } = await mount({ sources: [{ url: other }, { url: ours }], entries: [entry('alpha')] })
  const searched = remote.calls.filter(([name]) => name === 'search').map(([, url]) => url)
  assert.ok(searched.length > 0, 'the tab searched something')
  assert.deepEqual([...new Set(searched)], [ours], 'the tab opened on our own market, not the first configured source')
  // The sources it read are the configured ones, in their own order: the tab
  // leads with ours for display only and never rewrites someone else's list.
  assert.equal(remote.calls.some(([name]) => name === 'setIndexes'), false, 'opening the tab wrote no source list')
}

// --- our market is the first row of the source menu -------------------------
{
  const ours = 'https://lanxiake.github.io/dsh-vyra-plugins/index.json'
  const other = 'https://cdn.example.invalid/market/index.json'
  const { tree, settle } = await mount({ sources: [{ url: other }, { url: ours }], entries: [entry('alpha')] })
  const anchor = findAll(tree, (node) => node.props?.['aria-haspopup'] === 'menu' && node.props?.['aria-expanded'] !== undefined)[0]
  assert.ok(anchor !== undefined, 'the toolbar has a source menu button')
  anchor.props.onClick()
  const opened = await settle()
  const menu = findAll(opened, (node) => node.props?.role === 'menu')[0]
  assert.ok(menu !== undefined, 'the source menu opened')
  const rowTexts = (menu.children ?? []).flatMap((row) => texts(row))
  assert.ok(rowTexts[0]?.includes('lanxiake.github.io'), `our market leads the menu, got: ${JSON.stringify(rowTexts)}`)
  assert.ok(rowTexts.some((line) => line.includes('cdn.example.invalid')), 'the other source is still listed')
}

// --- Install on a card reaches installBundle, not updateBundle ----------------
{
  const { tree, remote } = await mount({ entries: [entry('alpha')] })
  const install = buttonByText(tree, 'install')
  assert.ok(install !== undefined, 'an installable card offers Install')
  install.props.onClick()
  await Promise.resolve()
  const call = remote.calls.find(([name]) => name === 'installBundle')
  assert.ok(call !== undefined, 'Install issued an install')
  assert.equal(call[1], 'alpha@1.0.0')
  assert.equal(call[2].enabled, true, 'a batch installs what it added')
}

// --- Uninstall on a card asks before removing ---------------------------------
{
  const bundle = { name: 'beta', installed: true, enabled: true, removable: true, rows: [], overrides: [] }
  const { tree } = await mount({ entries: [entry('beta', { installation: { status: 'installed' } })], bundles: [bundle] })
  const remove = buttonByText(tree, 'uninstall')
  assert.ok(remove !== undefined, 'an installed card offers Uninstall')
  remove.props.onClick()
}

// --- a failed update leaves its reason on the card ---------------------------
{
  // The very failure this plugin hid before: the Host answers `failed` with a
  // diagnostic and the run's own output, and the card has to carry both.
  const reason = "Duplicate type name 'POINT'"
  const output = 'dsh: warning: 1 entry did not activate'
  const { tree, settle } = await mount({
    entries: [entry('alpha', { installation: { status: 'installed' }, versions: [{ version: '2.0.0', publishTimestamp: 1, source: { type: 'git', url: 'https://e/r.git', commit: 'a'.repeat(40) }, install: { spec: 'git+https://e/r.git#aaa' }, compatibility: { compatible: true }, update: true }] })],
    bundles: [{ name: 'alpha', installed: true, enabled: true, removable: true, update: 'git', rows: [], overrides: [] }],
    answers: {
      updateBundle: Promise.resolve({ ok: true, value: { result: { application: 'failed', error: { diagnostic: reason, code: 'operation-error' }, packageResult: { output } } } }),
    },
  })
  const update = buttonByText(tree, 'update')
  assert.ok(update !== undefined, 'an updatable card offers Update')
  update.props.onClick()
  const after = await settle()
  const tag = findAll(after, (node) => node.type === 'button' && typeof node.props.title === 'string' && node.props.title.includes(reason))[0]
  assert.ok(tag !== undefined, 'the card carries a tag whose tooltip holds the failure')
  assert.ok(tag.props.title.includes(output), 'the tooltip holds the run output too, not just the code')
  assert.ok(texts(tag).join('').includes('failedTag'), 'the tag renders the Failed label')
}

// --- a Host change re-reads the bundles --------------------------------------
{
  const { remote } = await mount()
  const subscription = remote.calls.find(([name]) => name === '$on')
  assert.ok(subscription !== undefined, 'the tab subscribes to Host changes')
  assert.equal(subscription[1], 'plugin-manager/changed')
}

console.log('vyra-plugin-market: render checks passed')
