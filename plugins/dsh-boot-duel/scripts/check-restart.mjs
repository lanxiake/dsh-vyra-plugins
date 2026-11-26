/**
 * "再来一局" on the host settings page must actually start a round.
 *
 * Two cases, both through the real bundle in a real browser:
 *   1. the layer is mounted and the round is live  -> restart in place;
 *   2. the opening was skipped/finished and the layer is gone -> mount it again.
 *
 * Case 2 is the one that could not work before: `store.hide()` was one-way and
 * `hasPassed()` was a permanent gate, so the settings page had no way back in.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const root = 'C:/myself/projects/my/open-source/dsh-vyra-plugins/plugins/dsh-boot-duel'
const client = readFileSync(root + '/client.js', 'utf8')
const react = readFileSync('C:/Users/75791/AppData/Local/Temp/dsh-boot-duel-react.js', 'utf8')

const SHELL = `<!doctype html><html><body style="margin:0">
<div class="overlay" data-shell-overlay></div><div id="settings"></div>
<script>window.__dshBoot={factories:new Map(),registrations:[]};
window.__ModuleLoader__={load:(r)=>window.__dshBoot.factories.set(r.id,r.factory)}</script></body></html>`

let fail = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) fail++
}

const b = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.route('http://st.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: SHELL }))
await p.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true,"difficulty":"easy"}' }))
await p.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
await p.goto('http://st.test/', { waitUntil: 'domcontentloaded' })
await p.addScriptTag({ content: react })
await p.addScriptTag({ content: client })
await p.evaluate(() => {
  const f = window.__dshBoot.factories.get('dsh-boot-duel')
  const ex = f((s) => (s === 'react' ? window.React : window.ReactDOM))
  const locale = { getLocale: () => ({ active: 'zh-CN', revision: 1 }), bind: () => (k) => k, subscribe: () => () => {} }
  ex.apply({
    get: (n) => (n === 'locale' ? locale : undefined),
    effect: (fn) => fn(),
    slots: {
      inject: (_, cb) => cb(),
      register: (reg, component) => {
        window.__dshBoot.registrations.push({ reg, component })
        if (reg.name === 'shell.overlay') {
          window.ReactDOM.createRoot(document.querySelector('[data-shell-overlay]'))
            .render(window.React.createElement(component))
        }
        if (reg.name === 'settings.section') {
          window.ReactDOM.createRoot(document.getElementById('settings'))
            .render(window.React.createElement(component))
        }
        return () => {}
      },
    },
  })
})

const sectionText = async () => p.locator('.boot-duel-host-section').innerText()
const phaseOf = () => p.evaluate(() => document.querySelector('.boot-duel-layer')?.getAttribute('data-phase') ?? null)
const layerCount = () => p.locator('.boot-duel-layer').count()

// ---- the button exists on the host page -------------------------------
await p.waitForSelector('.boot-duel-host-section')
const text = await sectionText()
check(/再来一局/.test(text), 'the host settings page has 再来一局', JSON.stringify(text.split('\n').slice(0, 2)))
const restartBtn = p.locator('.boot-duel-host-actions .boot-duel-set-btn.is-primary')
check(await restartBtn.count() === 1, 'and it is a single primary button')
check((await restartBtn.innerText()) === '再来一局', 'labelled 再来一局')

// ---- case 1: the layer is live ----------------------------------------
await p.waitForSelector('.boot-duel-layer')
check(await layerCount() === 1, 'the game layer mounted at boot')
const before = await phaseOf()
await restartBtn.evaluate((el) => el.click())
await p.waitForTimeout(250)
check(await layerCount() === 1, 'restart in place keeps exactly one layer')
const after = await phaseOf()
check(after === 'ready' || after === 'playing', 'and puts the round back in play', `before=${before} after=${after}`)
// The panel must not have been left in "listening for a key" state.
check(await p.locator('.boot-duel-set-bind.is-listening').count() === 0, 'no key capture left armed')

// ---- give it a moment, then check the duel is actually running ---------
await p.waitForTimeout(600)
const running = await p.evaluate(() => {
  const c = document.querySelector('.boot-duel-canvas')
  return Boolean(c && c.width > 0 && c.height > 0)
})
check(running, 'the canvas is live after the restart')

// ---- case 2: skip the opening, then ask for a round --------------------
await p.keyboard.press('Escape')
await p.waitForTimeout(900) // fade is 400 ms
check(await layerCount() === 0, 'Esc dismisses the layer')

await restartBtn.evaluate((el) => el.click())
await p.waitForTimeout(900)
check(await layerCount() === 1, '再来一局 mounts the layer again after it was dismissed')
const back = await phaseOf()
check(back === 'ready' || back === 'playing', 'and the new round is live', `phase=${back}`)

// ---- the pending fade of a finished round must not kill the new one ----
await p.keyboard.press('Enter')
await p.waitForTimeout(300)
// Finish the round from inside, then ask for another DURING the fade window.
await p.evaluate(() => { /* the layer owns its own engine; use the skip button */ })
await p.locator('.boot-duel-skip').click()
await p.waitForTimeout(80) // inside the 400 ms fade
await restartBtn.evaluate((el) => el.click())
await p.waitForTimeout(700) // past where the old fade would have fired
check(await layerCount() === 1, 'a restart during the outro fade survives that fade')

// ---- with the opening turned off, the button turns it back on ----------
// Dismiss the layer first: while it is mounted it covers the whole viewport,
// which is the point, and a real pointer cannot reach the checkbox.
await p.keyboard.press('Escape')
await p.waitForTimeout(900)
check(await layerCount() === 0, 'layer dismissed before the switch test')

const enabledBox = p.locator('.boot-duel-host-row').first().locator('input[type="checkbox"]')
await enabledBox.evaluate((el) => el.click())
await p.waitForTimeout(120)
check(await p.evaluate(() => JSON.parse(localStorage.getItem('dsh-boot-duel:settings') || '{}').enabled) === false, 'the opening can be turned off')
await restartBtn.evaluate((el) => el.click())
await p.waitForTimeout(900)
check(await layerCount() === 1, '再来一局 still works with the opening switched off')
check(await p.evaluate(() => JSON.parse(localStorage.getItem('dsh-boot-duel:settings') || '{}').enabled) === true, 'and turns the opening back on so the round is not a dead end')

check(errs.length === 0, 'no page errors throughout', JSON.stringify(errs.slice(0, 3)))

console.log('\n' + (fail === 0 ? 'RESTART OK' : `${fail} FAILED`))
await b.close()
process.exit(fail ? 1 : 0)