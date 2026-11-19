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
  TRANSIENT_FAILURE, RETRY_DELAY_MS,
} = __internal

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

console.log('vyra-plugin-market: all checks passed')
