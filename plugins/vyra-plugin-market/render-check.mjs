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

// The tab now loads a stats overlay in the background. A headless check must
// not reach the network (or wait for its 30s timeout); every read fails fast.
globalThis.fetch = () => Promise.reject(new Error('offline in render check'))

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
      readBundleDetail: (name, language) => {
        calls.push(['readBundleDetail', name, language])
        return ok({ status: 'found', origin: 'readme', path: 'README.md', markdown: '# Manual README' })
      },
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

/** A localStorage stand-in: `seeded` controls whether the profile already
 *  made its one-time dshmarket.com catalog choice. */
function makeStorage(seeded) {
  const values = new Map()
  if (seeded) values.set('vyra-market.sources-seeded', '2')
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)) },
    removeItem: (key) => { values.delete(key) },
  }
}

/** Mount the tab, settle its reads, and return the drawn tree with its Remote. */
async function mount({ sources = [{ url: 'https://example.invalid/index.json' }], entries = [entry('alpha'), entry('beta')], bundles = [], answers = {}, seeded = true, slot = 'plugins.tab', surface } = {}) {
  globalThis.localStorage = makeStorage(seeded)
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
    locale: {
      register: () => {}, bind: () => (key) => key,
      getSnapshot: () => ({ active: 'en' }), subscribe: () => () => {},
    },
    slots: {
      // Mount one surface per call; the other registrations are covered by the
      // registration block below.
      inject: (name, register) => { if (name === slot) register() },
      register: (_options, component) => { Component = component },
    },
    remote,
  })
  const props = {
    t: (key, params) => (params === undefined ? key : `${key}${JSON.stringify(params)}`),
    remote,
    useLocale: (select) => select({ active: 'en' }),
    ...(surface === undefined ? {} : { surface }),
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

// --- the settings surface carries the two visibility switches ----------------
{
  const { tree } = await mount({ slot: 'settings.section', surface: 'settings', bundles: [] })
  const drawn = texts(tree).join(' | ')
  assert.ok(drawn.includes('settingsVisibility'), `the settings surface shows the visibility row, got: ${drawn}`)
  assert.ok(drawn.includes('showSidebar'), 'the sidebar switch is there')
  assert.ok(drawn.includes('showPluginsTab'), 'the Plugins tab switch is there')
}

// --- the registration targets: Plugins tab, sidebar row, main panel ----------
await (async () => {
  const react = makeReact()
  const bundle = loadBundle(react)
  const options = []
  bundle.apply({
    effect: (fn) => fn(),
    locale: {
      register: () => {}, bind: () => (key) => key,
      getSnapshot: () => ({ active: 'en' }), subscribe: () => () => {},
    },
    slots: { inject: (_name, register) => { register() }, register: (seen) => { options.push(seen) } },
    remote: makeRemote({ sources: [], bundles: [], page: makePage([]) }),
  })
  const tab = options.find((entry) => entry.name === 'plugins.tab')
  const row = options.find((entry) => entry.name === 'sidebar.panellist')
  const panel = options.find((entry) => entry.name === 'main')
  const settings = options.find((entry) => entry.name === 'settings.section')
  const overlay = options.find((entry) => entry.name === 'shell.overlay')
  assert.ok(tab !== undefined, 'the Plugins tab is still registered')
  assert.equal(tab.id, 'market')
  assert.equal(tab.locale, 'vyra-plugin-market')
  assert.equal(typeof tab.label, 'function')
  assert.equal(tab.order, 10, 'the tab sorts after the page\'s own Installed entry')
  assert.ok(row !== undefined, 'the sidebar row is registered')
  assert.equal(row.id, 'vyra-market', 'the row id is the panel key')
  assert.equal(row.order, 2, 'the row sits below Plugins')
  assert.equal(row.locale, 'vyra-plugin-market')
  assert.ok(panel !== undefined, 'the sidebar main panel is registered')
  assert.equal(panel.key, 'vyra-market', 'the row opens this panel')
  assert.equal(panel.locale, 'vyra-plugin-market')
  assert.equal(typeof panel.inject, 'function', 'the panel injects its own remote and locale hook')
  assert.ok(settings !== undefined, 'the settings section is registered')
  assert.equal(settings.id, 'vyra-market')
  assert.equal(settings.locale, 'vyra-plugin-market')
  assert.equal(settings.inject().surface, 'settings', 'the settings surface shows the visibility switches')
  assert.ok(overlay !== undefined, 'the completion toast is registered in shell.overlay')
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
  const { remote } = await mount({ sources: [], entries: [], seeded: false })
  const set = remote.calls.find(([name]) => name === 'setIndexes')
  assert.ok(set !== undefined, 'an unconfigured profile gets a source added')
  // Veyra leads with the ghproxy mirror (reachable in CN without a GitHub
  // detour), then the three verified format-1 catalogs, seeded once.
  assert.deepEqual(set[1], [
    'https://ghproxy.net/https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/master/docs/index.json',
    'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json',
    'https://dshopen.org/index.json',
    'https://go.dshtui.com/market/index.json',
  ])
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
  assert.match(rowTexts[0] ?? '', /Veyra/, `our market leads the menu, got: ${JSON.stringify(rowTexts)}`)
  assert.ok(rowTexts.some((line) => line.includes('dsh.so')), 'the built-in dsh.so browser is always available')
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

// --- the Installed view lists bundles no market index knows about ------------
{
  const bundle = {
    name: 'manual-plugin', version: '1.2.3', description: 'Manual plugin',
    installed: true, enabled: true, removable: true, rows: [], overrides: [],
  }
  const { tree, remote, settle } = await mount({ entries: [entry('alpha')], bundles: [bundle] })
  const segment = findAll(tree, (node) => node.type === 'button' && texts(node).join('').includes('viewInstalled'))[0]
  assert.ok(segment !== undefined, 'the market page has an Installed segment')
  segment.props.onClick()
  const installed = await settle()
  const drawn = texts(installed).join(' | ')
  assert.ok(drawn.includes('manual-plugin'), `the installed list names a bundle outside the market, got: ${drawn}`)
  assert.ok(drawn.includes('Manual plugin'), 'the manifest description is shown')

  // There is no Details button any more: the whole card opens the dialog.
  const card = findAll(installed, (node) => node.type === 'li' && node.props.className === 'vpm-card' && texts(node).join('').includes('manual-plugin'))[0]
  assert.ok(card !== undefined, 'the installed card is clickable')
  card.props.onClick()
  const detail = await settle()
  assert.ok(remote.calls.some(([name, bundleName]) => name === 'readBundleDetail' && bundleName === 'manual-plugin'),
    'Details reads the local bundle README through the Host')
  assert.ok(texts(detail).join(' | ').includes('Manual README'), 'the local README is rendered')

  const close = buttonByText(detail, 'toastClose')
  close.props.onClick()
  const back = await settle()
  const disable = buttonByText(back, 'disable')
  assert.ok(disable !== undefined, 'an enabled bundle offers Disable')
  disable.props.onClick()
  await settle()
  assert.ok(remote.calls.some(([name, bundleName, enabled]) => name === 'setBundleEnabled' && bundleName === 'manual-plugin' && enabled === false),
    'Disable reaches setBundleEnabled for a non-market bundle')

  const uninstall = buttonByText(back, 'uninstall')
  assert.ok(uninstall !== undefined, 'a removable bundle offers Uninstall')
  uninstall.props.onClick()
  const confirm = await settle()
  const run = findAll(confirm, (node) => node.type === 'button' && String(node.props.className ?? '').includes('danger'))[0]
  assert.ok(run !== undefined, 'Uninstall asks before removing')
  run.props.onClick()
  await settle()
  assert.ok(remote.calls.some(([name, bundleName]) => name === 'removeBundle' && bundleName === 'manual-plugin'),
    'the confirmed uninstall reaches removeBundle')
}

// --- a Host change re-reads the bundles --------------------------------------
{
  const { remote } = await mount()
  const changed = remote.calls.find(([name, event]) => name === '$on' && event === 'plugin-manager/changed')
  assert.ok(changed !== undefined, 'the tab subscribes to Host changes')
  for (const event of ['plugin-manager/install-state', 'plugin-manager/update-state', 'plugin-manager/install-log']) {
    assert.ok(remote.calls.some(([name, seen]) => name === '$on' && seen === event), `the queue subscribes to ${event}`)
  }
}

console.log('vyra-plugin-market: render checks passed')
