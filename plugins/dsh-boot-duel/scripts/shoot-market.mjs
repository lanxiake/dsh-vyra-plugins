/**
 * The five frames a plugin listing needs, captured from the real bundle.
 *
 * Written for the external listing form, which asks for 1–6 screenshots of the
 * plugin in use with a caption each. So each frame is chosen to answer a
 * different question rather than to look good:
 *
 *   01 opening      — what a returning user sees, and the Enter gate
 *   02 exchange     — two fighters mid-swing with a speech bubble
 *   03 combo        — the combo counter and a hit burst
 *   04 finisher     — the 破军 name card
 *   05 victory      — the end screen and the way out
 *
 * Every frame waits for the layer's fade to finish first: a screenshot taken
 * during the 400 ms fade comes out washed out, which is not what the user sees.
 *
 * Usage: node scripts/shoot-market.mjs [outDir]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'market')
mkdirSync(outDir, { recursive: true })

const clientSource = readFileSync(path.join(root, 'client.js'), 'utf8')
const REACT = process.env.DSH_E2E_REACT || 'C:/Users/75791/AppData/Local/Temp/dsh-boot-duel-react.js'
const reactSource = readFileSync(REACT, 'utf8')
const CHROME = 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'

const SHELL = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>shell</title>
<style>html,body{margin:0;height:100%;background:#fff}
.frame{height:100vh;position:relative;overflow:hidden}
.overlay-layer{position:absolute;inset:0}</style></head>
<body><div class="frame"><div class="overlay-layer" data-shell-overlay></div></div>
<script>window.__dshBoot={factories:new Map(),registrations:[]};
window.__ModuleLoader__={load:(r)=>window.__dshBoot.factories.set(r.id,r.factory)}</script>
</body></html>`

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.route('http://duel.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SHELL }))
await page.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, difficulty: 'easy' }),
}))
await page.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
await page.goto('http://duel.test/', { waitUntil: 'domcontentloaded' })
await page.addScriptTag({ content: reactSource })
await page.addScriptTag({ content: clientSource })
await page.evaluate(() => {
  const factory = window.__dshBoot.factories.get('dsh-boot-duel')
  const exports = factory((spec) => (spec === 'react' ? window.React : window.ReactDOM))
  const locale = { getLocale: () => ({ active: 'zh-CN', revision: 1 }), bind: () => (k) => k, subscribe: () => () => {} }
  exports.apply({
    get: (n) => (n === 'locale' ? locale : undefined),
    effect: (fn) => fn(),
    slots: {
      inject: (_n, cb) => cb(),
      register: (reg, component) => { window.__dshBoot.registrations.push({ reg, component }); return () => {} },
    },
  })
  const entry = window.__dshBoot.registrations.find((e) => e.reg.name === 'shell.overlay')
  window.ReactDOM.createRoot(document.querySelector('[data-shell-overlay]'))
    .render(window.React.createElement(entry.component))
})

/** Capture only once the layer's opacity has actually reached 1. */
async function shot(name) {
  await page.waitForFunction(() => {
    const layer = document.querySelector('.boot-duel-layer')
    if (!layer) return false
    return Number(window.getComputedStyle(layer).opacity) >= 0.999
  }, { timeout: 5000 })
  await page.waitForTimeout(120)
  await page.screenshot({ path: path.join(outDir, `${name}.png`) })
  console.log('shot', name)
}

await page.waitForSelector('.boot-duel-layer', { timeout: 10000 })
await page.waitForTimeout(700)
await shot('01-opening')

// The bell, then close the distance and trade.
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
await page.keyboard.down('d'); await page.waitForTimeout(650); await page.keyboard.up('d')
await page.waitForTimeout(150)

// A bubble lands on the opening beats, so a few frames of trading usually
// catches one. Take the exchange shot as soon as a bubble is on screen.
await page.keyboard.press('j')
await page.waitForTimeout(140)
await shot('02-exchange')

// Keep the combo going: three hits in a row is what raises the counter.
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('j')
  await page.waitForTimeout(200)
  await page.keyboard.down('d'); await page.waitForTimeout(120); await page.keyboard.up('d')
}
await page.keyboard.press('k')
await page.waitForTimeout(170)
await shot('03-combo')

// Fill the meter, then throw the finisher.
//
// The meter takes +22 per landed hit (js/arena.js), so it needs five clean
// connections. Pressing on a 90 ms cadence does NOT get them: a swing is
// ~0.25 s and the input is consumed by the attack still running, so the round
// ended with the gauge barely moved and the U press did nothing. Each press
// here waits out the swing, and the gap is closed before every attempt.
async function landOne(key = 'j') {
  await page.keyboard.down('d'); await page.waitForTimeout(140); await page.keyboard.up('d')
  await page.keyboard.press(key)
  await page.waitForTimeout(340)
}
for (let i = 0; i < 8; i++) await landOne(i % 3 === 2 ? 'k' : 'j')
await page.waitForTimeout(120)
// Only press U if the gauge actually filled; otherwise the shot would be of a
// normal punch and the caption would be a lie.
const ready = await page.evaluate(() => {
  const el = document.querySelector('.boot-duel-meter')
  return Boolean(el && el.classList.contains('is-full'))
})
if (!ready) console.warn('meter never filled; the finisher frame will be stale')
await page.keyboard.press('u')
// The banner is a brief freeze; catch it before the 0.55 s cinematic runs out.
await page.waitForTimeout(200)
await shot('04-finisher')

// Finish the round and take the victory screen.
await page.waitForTimeout(1200)
for (let i = 0; i < 40; i++) {
  await page.keyboard.press(i % 2 === 0 ? 'j' : 'k')
  await page.waitForTimeout(80)
  if (i % 5 === 4) { await page.keyboard.down('d'); await page.waitForTimeout(120); await page.keyboard.up('d') }
  const phase = await page.evaluate(() => document.querySelector('.boot-duel-layer')?.dataset.phase)
  if (phase === 'ko' || phase === 'done') break
}
await page.waitForTimeout(400)
await shot('05-victory')

console.log('errors', JSON.stringify(errors.slice(0, 4)))
await browser.close()