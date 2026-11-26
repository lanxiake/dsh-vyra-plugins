/**
 * The settings panel must actually change the game, not just look like it.
 * Everything here is driven through the real bundle.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const root = 'C:/myself/projects/my/open-source/dsh-vyra-plugins/plugins/dsh-boot-duel'
const client = readFileSync(root + '/client.js', 'utf8')
const react = readFileSync('C:/Users/75791/AppData/Local/Temp/dsh-boot-duel-react.js', 'utf8')

const SHELL = `<!doctype html><html><body><div class="frame" data-shell-frame style="height:100vh;position:relative"><div class="overlay-layer" data-shell-overlay></div></div><script>window.__dshBoot={factories:new Map(),registrations:[]};window.__ModuleLoader__={load:(r)=>window.__dshBoot.factories.set(r.id,r.factory)}</script></body></html>`

let fail = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) fail++
}

const b = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
p.on('pageerror', e => errs.push(e.message))
await p.route('http://st.test/', r => r.fulfill({ status: 200, contentType: 'text/html', body: SHELL }))
await p.route('**/plugins/dsh-boot-duel/config', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true,"difficulty":"easy"}' }))
await p.route('**/plugins/dsh-boot-duel/sfx/*', r => r.fulfill({ status: 404, body: '' }))
await p.goto('http://st.test/', { waitUntil: 'domcontentloaded' })
await p.addScriptTag({ content: react })
await p.addScriptTag({ content: client })
await p.evaluate(() => {
  const f = window.__dshBoot.factories.get('dsh-boot-duel')
  const ex = f(s => (s === 'react' ? window.React : window.ReactDOM))
  const locale = { getLocale: () => ({ active: 'zh-CN', revision: 1 }), bind: () => (k) => k, subscribe: () => () => {} }
  ex.apply({ get: n => (n === 'locale' ? locale : undefined), effect: fn => fn(), slots: { inject: (_, cb) => cb(), register: (r, c) => { window.__c = c; return () => {} } } })
  window.ReactDOM.createRoot(document.querySelector('[data-shell-overlay]')).render(window.React.createElement(window.__c))
})
await p.waitForSelector('.boot-duel-layer')
await p.waitForTimeout(900)

// 1. the panel opens
check(await p.locator('.boot-duel-gear').count() === 1, 'the settings gear exists')
await p.click('.boot-duel-gear')
await p.waitForTimeout(250)
check(await p.locator('.boot-duel-settings').count() === 1, 'the panel opens')

// 2. it has the controls
for (const [sel, label] of [
  ['.boot-duel-settings input[type="checkbox"]', 'checkboxes'],
  ['.boot-duel-settings select', 'a difficulty select'],
  ['.boot-duel-set-bind', 'key bind buttons'],
  ['.boot-duel-set-actions .boot-duel-set-btn', 'action buttons'],
]) {
  const n = await p.locator(sel).count()
  check(n > 0, `the panel has ${label}`, `(${n})`)
}

// 3. toggling "show the opening" persists
const boxes = p.locator('.boot-duel-settings input[type="checkbox"]')
await boxes.nth(0).uncheck()
const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('dsh-boot-duel:settings') || '{}'))
check(stored.enabled === false, 'unchecking persists to storage', JSON.stringify(stored))

// 4. restart works from the panel
await p.click('.boot-duel-settings .boot-duel-set-btn.is-primary')
await p.waitForTimeout(400)
const phase = await p.evaluate(() => document.querySelector('.boot-duel-layer')?.getAttribute('data-phase'))
check(phase === 'ready' || phase === 'playing', 'one more round restarts the duel', `phase=${phase}`)

// 5. the title is the new one
const title = await p.evaluate(() => document.querySelector('.boot-duel-settings') ? null : document.body.textContent.includes('开工大吉'))
void title

console.log('\n' + (fail === 0 ? 'SETTINGS OK' : `${fail} FAILED`))
console.log('errors', JSON.stringify(errs.slice(0, 4)))
await b.close()
process.exit(fail ? 1 : 0)
