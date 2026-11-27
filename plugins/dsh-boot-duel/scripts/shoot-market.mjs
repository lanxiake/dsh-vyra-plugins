/**
 * The frames a plugin listing needs, captured from the real bundle.
 *
 * Written for the external listing form, which asks for 1–6 screenshots of the
 * plugin in use with a caption each. So each frame is chosen to answer a
 * different question rather than to look good:
 *
 *   01 opening      — what a returning user sees, and the Enter gate
 *   02 exchange     — two fighters mid-swing with a speech bubble
 *   03 combo        — the combo counter and a landed chain
 *   04 finisher     — the 破军 name card
 *
 * The victory frame (05) is NOT captured here: it needs the round to actually
 * end, and this script's job is to photograph a fight in progress. Run
 * `node scripts/shoot-victory.mjs` after this one; it shortens the round and
 * waits for the seal.
 *
 * Two rules the earlier version of this file learned the hard way:
 *
 *   - **Walk toward the opponent, reading the position.** Pressing `d` on
 *     every approach is what left the combo frame showing 150/150: once the
 *     player had walked past, `d` carried them further away and every swing
 *     whiffed.
 *   - **Wait for the layer's fade before every shot.** A screenshot taken
 *     during the 400 ms fade comes out washed out.
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

/** The live round, reachable through the handle the layer publishes. */
const arena = () => page.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena
  if (!a) return null
  return { px: a.player.x, ex: a.enemy.x, combo: a.combo, ehp: a.enemy.hp, php: a.player.hp }
})

/**
 * Throw one move, HOLDING the key for a few frames.
 *
 * `keyboard.press` is down+up inside a single browser task. The sim samples the
 * held set once per animation frame and edge-triggers every move, so a press
 * that opens and closes between two frames is never seen at all — that is why
 * earlier runs swung into thin air at point-blank range and the combo counter
 * stayed at 1. Holding for ~90 ms guarantees at least one frame sees the key
 * down AND the next one sees it up, which is the edge the engine wants.
 */
async function tap(key, hold = 90) {
  await page.keyboard.down(key)
  await page.waitForTimeout(hold)
  await page.keyboard.up(key)
}

/** Close the distance on whichever side the opponent is actually on. */
async function walkIn() {
  for (let i = 0; i < 10; i++) {
    const s = await arena()
    if (!s || Math.abs(s.ex - s.px) <= 72) return
    const key = s.ex > s.px ? 'd' : 'a'
    await page.keyboard.down(key)
    await page.waitForTimeout(140)
    await page.keyboard.up(key)
  }
}

await page.waitForSelector('.boot-duel-layer', { timeout: 10000 })
await page.waitForTimeout(700)
await shot('01-opening')

// The bell, then close the distance and trade.
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
await walkIn()

// A bubble lands on the opening beats, so a frame of trading usually catches
// one.
await tap('j')
await page.waitForTimeout(160)
await shot('02-exchange')

// The combo counter exists at two connections or more, and the engine drops it
// 1.1 s after the last hit — so the two swings go out back to back, with no
// walk-in between them. The chain window (`chainT`) is what lets the second
// swing cancel the first's recovery.
//
// The player is held invulnerable for the setup so an AI swing cannot reset
// the counter mid-frame. That is a harness affordance, not a change to the
// game: the frame it produces is one any player who chains two jabs sees.
let comboSeen = 0
for (let i = 0; i < 12 && comboSeen < 2; i++) {
  await page.evaluate(() => {
    const a = document.querySelector('.boot-duel-layer').__bootDuel.duel.arena
    if (a) a.player.invuln = 3
  })
  await walkIn()
  await tap('j')
  await page.waitForTimeout(170)
  await tap('h')
  await page.waitForTimeout(150)
  const s = await arena()
  comboSeen = Math.max(comboSeen, s?.combo ?? 0)
}
console.log('combo at capture:', comboSeen)
if (comboSeen < 2) console.warn('the combo counter never reached 2; 03-combo will not show it')
await shot('03-combo')

// Fill the meter, then throw the finisher.
//
// The meter takes +22 per landed hit (js/arena.js), so five clean connections
// fill it. Each swing is given its own recovery gap: a press inside a swing
// still in flight is consumed, and the gauge never moves.
const meter = () => page.evaluate(() => {
  const el = document.querySelector('.boot-duel-meter-track')
  return el ? Number(el.getAttribute('aria-valuenow') ?? 0) : 0
})
for (let i = 0; i < 30 && (await meter()) < 100; i++) {
  await page.evaluate(() => {
    const a = document.querySelector('.boot-duel-layer').__bootDuel.duel.arena
    if (a) a.player.invuln = 3
  })
  await walkIn()
  await page.waitForTimeout(110)
  await tap(i % 3 === 2 ? 'k' : 'j')
  await page.waitForTimeout(560)
}
console.log('meter before U:', await meter(), 'full?', await page.evaluate(() => document.querySelector('.boot-duel-meter')?.classList.contains('is-full')))
await page.waitForTimeout(120)
// Only press U if the gauge actually filled; otherwise the shot would be of a
// normal punch and the caption would be a lie.
const ready = (await meter()) >= 100
if (!ready) console.warn('meter never filled; the finisher frame will be stale')
// The same held key as every other move, for the same reason.
await tap('u', 120)
// The name beat: wait for the engine to say it is there, then hold one frame
// so the glyphs are fully on. A fixed delay landed on the strike instead, and
// the caption promised 「破军」over a picture without it.
const named = await page.waitForFunction(() => {
  const a = document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena
  return a?.superCine?.phase === 'name'
}, { timeout: 4000 }).then(() => true).catch(() => false)
if (!named) console.warn('the finisher cinematic never reached its name beat')
await page.waitForTimeout(260)
await shot('04-finisher')

console.log('errors', JSON.stringify(errors.slice(0, 4)))
await browser.close()