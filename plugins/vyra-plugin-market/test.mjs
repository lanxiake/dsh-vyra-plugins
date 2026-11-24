// Self-check for the market tab's pure logic: loading the bundle in a stubbed
// module shell and asserting the decisions a card and a bulk action make.
//
//   node plugins/vyra-plugin-market/test.mjs
//
// It covers the mapping from market records to card state and to a bulk plan,
// which is where a wrong answer silently does the wrong thing to a profile.

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname)
const source = readFileSync(join(root, 'client.js'), 'utf8')

/** Load the bundle under a stubbed module loader and return its exports. */
function loadBundle() {
  let exports
  const window = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        assert.equal(id, 'vyra-plugin-market', 'the bundle registers under its package name')
        exports = factory((specifier) => {
          assert.equal(specifier, 'react', `the bundle requires only react, got ${specifier}`)
          return {
            createElement: (type, props, ...children) => ({ type, props, children }),
            useState: () => [undefined, () => {}],
            useEffect: () => {},
            useMemo: () => {},
            useRef: () => ({ current: null }),
            useCallback: (fn) => fn,
          }
        })
      },
    },
  }
  // The bundle only touches `window` and `document` at load time.
  new Function('window', 'document', source)(window, undefined)
  return exports
}

const { __internal } = loadBundle()
const {
  marketText, presentedVersion, installable, prerelease, updateTarget, entryState, actionVersion, planBulk, orders, withText,
  TRANSIENT_FAILURE, RETRY_DELAY_MS, htmlImages, resolveAsset,
  compactCount, npmSpecName, specVersion, dshSoIndexUrlFrom, normalizeDshSo, dshSoPage, statsOfEntry, normalizeStats, marketSourceLabel,
  localizedValue, shortBundleName, bundleTitle, bundleDescription, visibility, region,
  pageCacheKey, cachedPage, rememberPage, pageCache,
  parseRepoRef, specPath, buildBundleIndex,
  AGENT_HINTS, QUEUE_AUTO_OPEN, ZH, EN,
} = __internal

// --- the Agent hint is a request, not tool syntax -----------------------------
{
  // The hint promises a person can paste what it copies. A copied line that
  // spells out the Host tool (or the CLI) is a worse prompt than the request
  // it stands for: the Agent decides the mechanism.
  assert.equal(QUEUE_AUTO_OPEN, 3, 'a queue longer than three folds itself away')
  for (const [lang, hints] of Object.entries(AGENT_HINTS)) {
    assert.ok(hints.length >= 4, `${lang} offers search, update, uninstall and batch use cases`)
    for (const hint of hints) {
      assert.ok(hint.prompt.trim().length > 0, `${lang}/${hint.key} has a prompt to copy`)
      assert.ok(!/plugin_manager|plugin_market|vyra-market|--apply/.test(hint.prompt),
        `${lang}/${hint.key} names an outcome, not a tool: ${hint.prompt}`)
      assert.ok(hint.label.trim().length > 0, `${lang}/${hint.key} has a button label`)
      assert.ok(!/[{}]/.test(hint.prompt), `${lang}/${hint.key} needs no interpolation`)
    }
    const keys = hints.map((hint) => hint.key).join(',')
    assert.equal(new Set(hints.map((hint) => hint.key)).size, hints.length, `${lang} use-case keys are unique`)
    assert.ok(keys.split(',').includes('search') && keys.split(',').includes('remove'), `${lang} covers both adding and removing`)
  }
  assert.deepEqual(Object.keys(AGENT_HINTS.zh).length, Object.keys(AGENT_HINTS.en).length, 'both editions offer the same number of use cases')
}

// --- the Agent hint names the mechanism it promises --------------------------
{
  // The lead sentence is where the tool and CLI belong, since it explains how
  // the request is served rather than being the request.
  assert.match(ZH.agentLead, /plugin_manager/, 'the Chinese hint names the Host plugin_manager tool')
  assert.match(ZH.agentLead, /vyra-market/, 'the Chinese hint names the vyra-market CLI')
  assert.match(EN.agentLead, /plugin_manager/, 'the English hint names the Host plugin_manager tool')
  assert.match(EN.agentLead, /vyra-market/, 'the English hint names the vyra-market CLI')
}

// --- the two views: the installed tab carries no count, the filter says it ----
{
  // The header count moved into the summary line when the Installed tab took
  // over the list, and the market filter now says "installed in this market"
  // so it is not read as the profile's whole installed list.
  assert.equal(ZH.viewInstalled, '已安装')
  assert.equal(EN.viewInstalled, 'Installed')
  assert.equal(ZH.onlyInstalled, '仅市场已安装', 'the market filter is distinguished from the Installed tab')
  assert.equal(EN.onlyInstalled, 'Installed in market')
}

// --- both dictionaries carry every key the new surfaces ask for --------------
{
  const keys = (dict) => Object.keys(dict).sort()
  const missing = keys(ZH).filter((key) => !(key in EN))
  assert.deepEqual(missing, [], `the English dictionary is missing: ${missing.join(', ')}`)
  const extra = keys(EN).filter((key) => !(key in ZH))
  assert.deepEqual(extra, [], `the Chinese dictionary is missing: ${extra.join(', ')}`)
  for (const key of ['queueShow', 'queueHide', 'selectedMore', 'showMore', 'showLess', 'agentTitle', 'agentLead', 'agentCopy', 'agentCopied', 'agentCopyFailed']) {
    assert.ok(typeof ZH[key] === 'string' && typeof EN[key] === 'string', `${key} is translated in both editions`)
  }
}

// --- README images: a <picture> block must become the Markdown image it wraps --
{
  const readme = '<picture>\n<source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />\n<img alt="QQ 群" src="./assets/qq-group.png" width="220" />\n</picture>'
  const md = htmlImages(readme)
  assert.ok(!/<picture|<source|<img/i.test(md), `HTML image tags are gone, got: ${md}`)
  assert.match(md, /!\[QQ 群\]\(\.\/assets\/qq-group\.png\)/, 'the <img> became a Markdown image')
  const base = 'https://cdn.jsdelivr.net/gh/o/r@HEAD/plugins/p/'
  assert.equal(resolveAsset('./assets/qq-group.png', base), 'https://cdn.jsdelivr.net/gh/o/r@HEAD/plugins/p/assets/qq-group.png', 'a relative asset resolves against the README directory')
  assert.equal(resolveAsset('https://x.invalid/a.png', base), 'https://x.invalid/a.png', 'an absolute asset is left alone')
}

// A transport hiccup earns another run; a verdict about the package does not.
// Getting this backwards would either give up on a flaky line or hammer the
// Host with answers that cannot change.
for (const text of [
  'Error: read ECONNRESET',
  'connect ETIMEDOUT 140.82.112.4:443',
  'getaddrinfo ENOTFOUND github.com',
  'socket hang up',
  'ERR_PNPM_META_FETCH_FAIL GET https://github.com/…',
  'ERR_PNPM_FETCH_TIMEOUT',
  'The operation timed out',
]) assert.match(text, TRANSIENT_FAILURE, `retried: ${text}`)

for (const text of [
  'not-bundle：package.json 没有 dsh.bundle 声明',
  'incompatible-version',
  'already-installed',
  'ERR_PNPM_FETCH_404 Not Found',
  '',
]) assert.doesNotMatch(text, TRANSIENT_FAILURE, `not retried: ${text || '(empty)'}`)

assert.deepEqual(RETRY_DELAY_MS, [1000, 3000, 8000], 'three retries, backing off')

/** One market version with sensible defaults. */
const version = (value, extra = {}) => ({
  version: value,
  publishTimestamp: 1_700_000_000,
  source: { type: 'npm' },
  install: { spec: `pkg@${value}` },
  compatibility: { compatible: true },
  update: false,
  ...extra,
})

/** One market listing entry with sensible defaults. */
const entry = (name, extra = {}) => ({
  name,
  title: { en: name, zh: `${name} 中文` },
  description: { en: 'a plugin' },
  versions: [version('1.0.0')],
  installation: { status: 'not-installed' },
  defaultVersion: '1.0.0',
  metadata: { keywords: [], labels: [], sortKeys: {} },
  ...extra,
})

/** One installed bundle with sensible defaults. */
const bundle = (name, extra = {}) => ({
  name, official: false, availability: 'profile', enabled: true, installed: true, optional: false, removable: true,
  rows: [], overrides: [], ...extra,
})

// --- marketText: localized text resolution -----------------------------------
assert.equal(marketText('plain', 'en'), 'plain')
assert.equal(marketText({ en: 'English', zh: '中文' }, 'zh'), '中文')
assert.equal(marketText({ en: 'English', zh: '中文' }, 'ja'), 'English', 'a missing locale falls back to English')
assert.equal(marketText({ zh: '只有中文' }, 'en'), '只有中文', 'no English falls back to any present locale')
assert.equal(marketText(undefined, 'en'), '')
assert.equal(marketText(null, 'en'), '')

// --- presentedVersion / installable / prerelease ------------------------------
assert.equal(presentedVersion(entry('a', { versions: [version('2.0.0'), version('1.0.0')], defaultVersion: '1.0.0' })).version, '1.0.0', 'the default version wins')
assert.equal(presentedVersion(entry('b', { versions: [version('2.0.0')], defaultVersion: undefined })).version, '2.0.0', 'without a default the newest listed is presented')
assert.equal(installable(version('1.0.0')), true)
assert.equal(installable(version('1.0.0', { compatibility: { compatible: false, exempted: true } })), true, 'an exemption is installable')
assert.equal(installable(version('1.0.0', { compatibility: { compatible: false, exempted: false } })), false)
assert.equal(prerelease('1.0.0'), false)
assert.equal(prerelease('1.0.0-beta.1'), true)
assert.equal(prerelease('1.0.0+build-7'), false, 'build metadata is not a prerelease')

// --- updateTarget: only what the Host accepts as an update --------------------
assert.equal(updateTarget(entry('c')), undefined, 'an unflagged version is not an update target')
assert.equal(updateTarget(entry('c', { versions: [version('1.0.0')] })), undefined, 'an unflagged version is never an update target')
assert.equal(
  updateTarget(entry('d', { versions: [version('2.0.0', { update: true }), version('1.0.0')] })).version,
  '2.0.0',
)

// --- entryState / actionVersion ----------------------------------------------
assert.equal(entryState(entry('e')), 'available')
assert.equal(entryState(entry('f', { installation: { status: 'provided' } })), 'provided')
assert.equal(entryState(entry('g', { installation: { status: 'installed' } })), 'installed')
assert.equal(
  entryState(entry('h', { installation: { status: 'installed' }, versions: [version('2.0.0', { update: true })] })),
  'updatable',
)
assert.equal(
  entryState(entry('i', { installation: { status: 'update-available' } })),
  'installed',
  'a newer registry version alone is not an update this tab can run',
)
assert.equal(actionVersion(entry('j')).version, '1.0.0')
assert.equal(actionVersion(entry('k', { versions: [version('1.0.0', { compatibility: { compatible: false, exempted: false } })] })), undefined, 'an incompatible version offers no action')

// --- planBulk: what each bulk action would touch ------------------------------
{
  const plan = planBulk([
    { entry: entry('fresh'), bundle: undefined },
    { entry: entry('held', { installation: { status: 'installed' } }), bundle: bundle('held') },
    {
      entry: entry('behind', { installation: { status: 'installed' }, versions: [version('2.0.0', { update: true })] }),
      bundle: bundle('behind'),
    },
    { entry: entry('shipped', { installation: { status: 'provided' } }), bundle: bundle('shipped', { removable: false }) },
    { entry: entry('locked', { installation: { status: 'installed' } }), bundle: bundle('locked', { readOnlyReason: 'management-required' }) },
    { entry: entry('off', { installation: { status: 'installed' } }), bundle: bundle('off', { enabled: false }) },
  ])
  assert.deepEqual(plan.install.map((item) => item.entry.name), ['fresh'], 'only an uninstalled entry installs')
  assert.deepEqual(plan.update.map((item) => item.entry.name), ['behind'], 'only a flagged version updates')
  assert.deepEqual(plan.uninstall.map((item) => item.entry.name), ['held', 'behind', 'locked', 'off'], 'a provided bundle is never removed')
  // `removable: false` blocks removal alone; switching needs `readOnlyReason`.
  // So a provided bundle the client ships can still be turned off, which is
  // what `optional` bundles exist for.
  assert.deepEqual(plan.disable.map((item) => item.entry.name), ['held', 'behind', 'shipped'], 'a read-only bundle is never switched')
  assert.deepEqual(plan.enable.map((item) => item.entry.name), ['off'], 'a disabled bundle is offered for enabling')
}

// --- planBulk: an entry with no profile bundle never yields a removal ---------
{
  const plan = planBulk([{ entry: entry('ghost'), bundle: undefined }])
  assert.deepEqual(plan.uninstall, [], 'an entry the profile does not list has nothing to uninstall')
  assert.deepEqual(plan.install.map((item) => item.entry.name), ['ghost'])
}

// --- orders: an install and an update reach different Host methods -----------
{
  const plan = planBulk([
    { entry: entry('fresh'), bundle: undefined },
    {
      entry: entry('behind', { installation: { status: 'installed' }, versions: [version('2.0.0', { update: true })] }),
      bundle: bundle('behind'),
    },
    { entry: entry('off', { installation: { status: 'installed' } }), bundle: bundle('off', { enabled: false }) },
  ])
  const apply = orders(plan, 'install')
  assert.deepEqual(apply.map((item) => `${item.action}:${item.entry.name}`), ['install:fresh', 'update:behind'], 'an installed entry updates instead of installing over itself')
  assert.deepEqual(orders(plan, 'uninstall').map((item) => item.action), ['uninstall', 'uninstall'])
  assert.deepEqual(orders(plan, 'enable').map((item) => item.entry.name), ['off'])
  assert.deepEqual(orders(plan, 'disable').map((item) => item.entry.name), ['behind'], 'only an enabled bundle can be disabled')
}

// --- withText: the order follows the text ------------------------------------
assert.deepEqual(withText({ text: '', sort: { kind: 'index' } }, 'foo').sort, { kind: 'relevance' }, 'typing gains relevance order')
assert.deepEqual(withText({ text: 'foo', sort: { kind: 'relevance' } }, '').sort, { kind: 'index' }, 'clearing returns to index order')
assert.deepEqual(withText({ text: 'foo', sort: { kind: 'published', direction: 'desc' } }, '').sort, { kind: 'published', direction: 'desc' }, 'a chosen order is kept')

// --- queue: a cancel stops the rest and asks the Host to abort the current --
async function waitIdle() {
  for (let turn = 0; turn < 100 && __internal.runner.get().running !== null; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
{
  const performed = []
  const { enqueue, runner } = __internal
  const applied = { ok: true, value: { application: 'applied' } }
  let canceled = false
  const remote = {
    pluginManager: {
      installBundle: async (spec, options) => {
        performed.push([spec, options])
        if (performed.length === 1) {
          // Cancel while the first install is under way, as a person would.
          runner.requestCancel(remote, (key) => key)
          await Promise.resolve()
        }
        return canceled ? { ok: true, value: { application: 'cancelled' } } : applied
      },
      cancelInstall: async (requestId) => {
        canceled = true
        return { ok: true, value: { status: 'cancelled', requestId } }
      },
      listBundles: async () => ({ ok: true, value: performed.map((name) => ({ name, enabled: true, removable: true })) }),
      setBundleEnabled: async () => applied,
      removeBundle: async () => applied,
    },
  }
  const list = ['a', 'b', 'c'].map((name) => ({
    action: 'install', entry: { name }, version: { install: { spec: name } },
  }))
  enqueue(list, remote, (key) => key)
  await waitIdle()
  assert.deepEqual(performed.map(([spec]) => spec), ['a'], 'the current item was the only one issued')
  assert.ok(performed[0][1].requestId !== undefined, 'the current install carries a cancellable request id')
  const state = runner.get()
  assert.equal(state.running, null, 'the queue does not hang after a cancel')
  assert.equal(state.outcome.ok, 0)
  assert.equal(state.outcome.canceled, true)
  assert.equal(state.outcome.skipped, 2, 'the unrun tail is reported, not hidden')
}

// --- queue: an install added while one is running is not dropped -----------
{
  const performed = []
  const { enqueue, runner } = __internal
  const applied = { ok: true, value: { application: 'applied' } }
  let release
  const first = new Promise((resolve) => { release = resolve })
  const remote = {
    pluginManager: {
      installBundle: async (spec) => {
        performed.push(spec)
        if (spec === 'a') await first
        return applied
      },
      listBundles: async () => ({ ok: true, value: performed.map((name) => ({ name, enabled: true, removable: true })) }),
      setBundleEnabled: async () => applied,
      removeBundle: async () => applied,
    },
  }
  const order = (name) => ({ action: 'install', entry: { name }, version: { install: { spec: name } } })
  enqueue([order('a'), order('b')], remote, (key) => key)
  await new Promise((resolve) => setTimeout(resolve, 0))
  enqueue([order('c')], remote, (key) => key)
  assert.deepEqual(performed, ['a'], 'the running item is not duplicated')
  assert.equal(runner.get().queue.length, 2, 'b and the newly added c wait in the queue')
  release()
  await waitIdle()
  assert.deepEqual(performed, ['a', 'b', 'c'], 'the queue drains in order')
  assert.equal(runner.get().outcome.ok, 3)
}

// --- dsh.so adapter: npm specs, versions and compact counts -------------------
assert.equal(npmSpecName('@scope/name@1.2.3'), '@scope/name', 'a scoped package keeps its scope')
assert.equal(npmSpecName('@scope/name'), '@scope/name', 'a bare scoped package is itself')
assert.equal(npmSpecName('plain@2.0.0'), 'plain')
assert.equal(npmSpecName('github:o/r#v1.0.0'), '', 'a GitHub spec is not an npm name')
assert.equal(specVersion('@scope/name@1.2.3'), '1.2.3')
assert.equal(specVersion('plain'), '', 'a bare spec pins no version')
assert.equal(specVersion('github:o/r#v1.2.3'), '1.2.3')
assert.equal(specVersion('github:o/r#v1.2.3&path:/p'), '1.2.3')
assert.equal(compactCount(999), '999')
assert.equal(compactCount(1_234), '1.2k')
assert.equal(compactCount(12_345), '12k')
assert.equal(compactCount(1_234_567), '1.2M')

// --- dsh.so adapter: normalize, filter, dedupe, search and page --------------
{
  const row = (slug, name, owner, repo, description, stars, install, flags = 0, extras = {}) => {
    const value = Array(29).fill(0)
    value[0] = slug; value[1] = name; value[2] = owner; value[3] = repo; value[4] = description
    value[5] = stars; value[6] = '2026-11-20T00:00:00Z'; value[7] = 4; value[8] = install; value[9] = flags
    value[12] = extras.categories ?? [0]; value[13] = extras.useCases ?? [0]
    value[14] = extras.verification ?? 0; value[16] = 0; value[17] = extras.security ?? 0; value[18] = 0
    value[19] = extras.health ?? 0; value[20] = 0; value[21] = extras.trust ?? 0; value[22] = 0
    value[24] = extras.license ?? 0; value[28] = extras.avatar ?? 0
    return value
  }
  const data = {
    v: 4,
    npm: { alpha: [120, 4500], dup: [10, 200] },
    d: {
      cat: ['dev', 'ui'], catL: ['Developer', 'UI'],
      uc: ['git'], ucL: ['GitHub integration'],
      ver: ['L4 · 生态插件'], verKey: ['L4'], verTone: ['cyan'],
      sec: ['低风险'], secTone: ['green'], health: ['活跃'], healthTone: ['green'],
      trust: ['金'], trustTone: ['amber'], lic: ['\u0000', 'MIT'], dv: ['0.2.1'], av: ['', 'https://a.invalid/avatar.png'],
    },
    i: [
      row('alpha', '@scope/alpha', 'owner', 'alpha', 'Alpha plugin', 42, '@scope/alpha@1.2.3', 0, { categories: [0], security: 0, verification: 0, avatar: 1 }),
      row('dup-old', 'dup', 'owner', 'dup', 'Dup old', 1, 'dup@1.0.0'),
      row('dup-new', 'dup', 'owner2', 'dup2', 'Dup new', 99, 'dup@2.0.0'),
      row('non', 'non', 'o', 'r', 'Non plugin', 100, 'non@1.0.0', 8),
      row('noinstall', 'noinstall', 'o', 'r', 'No install target', 50, ''),
      row('tui', 'tui', 'o', 'r', 'dsh-TUI only', 60, '~dsh-tui add github:o/r#v1.0.0'),
      row('beta', 'beta', 'owner', 'beta', 'Beta plugin', 7, 'beta', 0, { categories: [1] }),
    ],
  }
  const normalized = normalizeDshSo(data, 123)
  assert.equal(normalized.entries.length, 3, 'non-plugins, no-install and dsh-TUI rows are skipped')
  const alpha = normalized.entries.find((entry) => entry.name === '@scope/alpha')
  assert.ok(alpha !== undefined, 'the npm name is the entry name')
  assert.equal(alpha.title, '@scope/alpha')
  assert.equal(alpha.versions[0].version, '1.2.3')
  assert.equal(alpha.versions[0].install.spec, '@scope/alpha@1.2.3')
  assert.equal(alpha.metadata.category, 'dev')
  assert.deepEqual(alpha.metadata.sortKeys, { stars: 42, downloads: 4500 })
  assert.equal(alpha.marketStats.downloads, 4500)
  assert.equal(alpha.marketStats.stars, 42)
  assert.equal(alpha.marketExtra.security, '低风险')
  assert.equal(alpha.marketExtra.verificationShort, 'L4')
  assert.equal(alpha.icon, 'https://a.invalid/avatar.png')
  const dup = normalized.entries.find((entry) => entry.name === 'dup')
  assert.equal(dup.versions[0].version, '2.0.0', 'a duplicate keeps the more popular artifact')
  assert.equal(dup.marketStats.stars, 99)
  assert.equal(normalized.metadata.categories.dev.title.en, 'Developer')
  assert.equal(normalized.metadata.sortKeys.stars.order, 'desc')

  const byText = dshSoPage(normalized, { text: 'alpha', sort: { kind: 'relevance' }, offset: 0, limit: 10 }, 0, 10)
  assert.deepEqual(byText.entries.map((entry) => entry.name), ['@scope/alpha'], 'text search matches the package name')
  const byCategory = dshSoPage(normalized, { category: 'ui', sort: { kind: 'index' }, offset: 0, limit: 10 }, 0, 10)
  assert.deepEqual(byCategory.entries.map((entry) => entry.name), ['beta'], 'category filter uses the first category')
  const byStars = dshSoPage(normalized, { sort: { kind: 'key', id: 'stars', direction: 'desc' }, offset: 0, limit: 10 }, 0, 10)
  assert.deepEqual(byStars.entries.map((entry) => entry.name), ['dup', '@scope/alpha', 'beta'], 'numeric sort key works')
  const paged = dshSoPage(normalized, { sort: { kind: 'index' }, offset: 1, limit: 1 }, 1, 1)
  assert.equal(paged.entries.length, 1)
  assert.equal(paged.total, 3)
  assert.equal(paged.nextOffset, 2)
  assert.equal(paged.fetchedAt, 123)

  const overlay = normalizeStats({
    updated: '2026-11-21',
    plugins: [
      { name: 'alpha', npm: '@scope/alpha', repo: 'owner/alpha', stars: 88, downloads: 9000, checked: '2026-11-21T00:00:00Z' },
      { name: 'unused', stars: 0, downloads: 0 },
    ],
  })
  const overlayed = statsOfEntry({ name: '@scope/alpha', title: '@scope/alpha', repository: { url: 'https://github.com/owner/alpha' } }, overlay)
  assert.deepEqual(overlayed, { stars: 88, downloads: 9000, window: '30d', checkedAt: '2026-11-21T00:00:00Z' }, 'overlay matches by npm name')
  assert.equal(statsOfEntry({ name: 'beta', metadata: { sortKeys: { stars: 7 } } }, overlay).stars, 7, 'index sort keys win over the overlay')
}

// --- dsh.so page discovers the current immutable index URL -------------------
assert.equal(
  dshSoIndexUrlFrom('<script>const u="/assets/idx/abc123/artifacts-index-zh.json?v=1"</script>'),
  'https://www.dsh.so/assets/idx/abc123/artifacts-index-zh.json',
)
assert.equal(dshSoIndexUrlFrom('<html></html>'), null)

// --- source labels: known URLs get product names, not raw URLs ---------------
assert.equal(marketSourceLabel({ url: 'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json' }, (value) => value.en, 'en'), 'dshmarket.com')
assert.equal(marketSourceLabel({ url: 'dsh-so://market', title: { en: 'dsh.so market' } }, (value) => value.en, 'en'), 'dsh.so market')

// --- installed bundle labels ------------------------------------------------
assert.equal(shortBundleName('@scope/dsh-foo'), 'foo', 'a scoped dsh prefix is reduced to the short name')
assert.equal(shortBundleName('manual-plugin'), 'manual-plugin', 'a plain name stays itself')
assert.equal(localizedValue({ en: 'English', zh: '中文' }, 'zh'), '中文')
assert.equal(localizedValue({ 'zh-CN': '简中', en: 'English' }, 'zh'), '简中')
assert.equal(bundleTitle({ name: '@scope/dsh-foo', meta: { title: { en: 'Foo', zh: '福' } } }, 'zh'), '福')
assert.equal(bundleTitle({ name: '@scope/dsh-foo' }, 'en'), 'foo')
assert.equal(bundleDescription({ name: 'x', description: 'A manual bundle' }, 'en'), 'A manual bundle')

// --- visibility switches are opt-out and immediately observable -------------
assert.deepEqual(visibility.get(), { sidebar: true, pluginsTab: true }, 'both doors default to on')
visibility.set('sidebar', false)
assert.equal(visibility.get().sidebar, false)
visibility.set('sidebar', true)
assert.equal(visibility.get().sidebar, true)

// --- region override: manual modes are immediate and probe-free ------------
region.setMode('overseas')
assert.equal(region.snapshot().active, 'overseas')
region.setMode('domestic')
assert.equal(region.snapshot().active, 'domestic')

// --- region probe: a much faster overseas line wins in auto mode -----------
{
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const domestic = /npmmirror|gitcode/.test(url)
    await new Promise((resolve) => setTimeout(resolve, domestic ? 30 : 5))
    return { ok: true }
  }
  try {
    region.setMode('auto')
    const snap = await region.detect(true)
    assert.equal(snap.detected, 'overseas', 'the 6x faster overseas line wins')
    assert.equal(snap.active, 'overseas', 'auto follows the detected line')
  } finally {
    region.setMode('domestic')
    globalThis.fetch = realFetch
  }
}

// --- page cache: first page is instant, later pages must share a revision ---
{
  const query = { text: 'x', category: null, sort: { kind: 'index' } }
  const key = pageCacheKey('https://example.invalid/index.json', query, 0, 40)
  rememberPage(key, { fetchedAt: 7, entries: [{ name: 'alpha' }] })
  assert.deepEqual(cachedPage(key, 0), { fetchedAt: 7, entries: [{ name: 'alpha' }] }, 'the first page is served from cache')
  assert.equal(cachedPage(key, 40, 8), undefined, 'a page from another index revision is not reused')
  assert.deepEqual(cachedPage(key, 40, 7), { fetchedAt: 7, entries: [{ name: 'alpha' }] }, 'the same revision is reused')
  pageCache.clear()
}

// --- installed-state matching across source spellings ------------------------
{
  assert.deepEqual(parseRepoRef('git+https://github.com/o/r.git#abcdef'), { repo: 'o/r' })
  assert.equal(specPath('git+https://x/o/r.git#sha&path:/plugins/foo'), 'plugins/foo')
  const bundle = {
    name: '@scope/dsh-foo', version: '1.0.0', installed: true,
    source: 'github:owner/repo#sha&path:/plugins/foo',
  }
  const resolve = buildBundleIndex(new Map([[bundle.name, bundle]]))
  assert.equal(resolve({ name: 'foo', versions: [] }), bundle, 'a short/unscoped entry finds a scoped bundle')
  assert.equal(resolve({
    name: 'other', versions: [],
    repository: { url: 'https://github.com/mirror/repo', directory: 'plugins/foo' },
  }), bundle, 'the same package directory matches across a repository mirror')
  assert.equal(resolve({
    name: 'other',
    versions: [{ install: { spec: 'github:owner/repo#sha&path:/plugins/foo' } }],
  }), bundle, 'the same Git spec matches')
  assert.equal(resolve({
    name: 'other', versions: [],
    repository: { url: 'https://github.com/owner/repo' },
  }), bundle, 'a repository with one installed bundle matches')
  const npmBundle = { name: '@scope/foo', version: '1.2.3', installed: true, source: '@scope/foo@1.2.3' }
  const npmResolve = buildBundleIndex(new Map([['npm', npmBundle]]))
  assert.equal(npmResolve({
    name: 'other',
    versions: [{ install: { spec: '@scope/foo@1.0.0' } }],
  }), npmBundle, 'the npm package name inside an install spec matches the bundle')

  const ambiguous = buildBundleIndex(new Map([
    ['a', { name: 'dsh-x', installed: true, source: 'github:o/a' }],
    ['b', { name: '@s/x', installed: true, source: 'github:o/b' }],
  ]))
  assert.equal(ambiguous({ name: 'x', versions: [] }), undefined, 'an ambiguous short name is refused instead of guessed')
}

console.log('vyra-plugin-market: all checks passed')
