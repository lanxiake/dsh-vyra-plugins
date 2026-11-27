/**
 * The victory screen, captured from the real bundle in a real browser.
 *
 * The seal is a DOM element over the canvas, so a canvas-only capture shows
 * the effects and none of the words. This drives the real layer: fight until
 * the KO, wait for the seal beat, and photograph what a player actually sees.
 *
 * WHY THE ROUND IS SHORTENED. The capture is not a test of the AI: a fair
 * round against a dodging opponent took upwards of forty swings, and any frame
 * grabbed before the last of them is a picture of two fighters standing. The
 * layer exposes the live duel (`layer.__bootDuel`), so the harness puts the
 * opponent on one hit and lets the engine play its own finish — the same beats
 * a real knockout produces, only sooner.
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

const SHELL = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#fff"><div style="height:100vh;position:relative">
<div data-shell-overlay></div></div>
<script>window.__dshBoot={factories:new Map(),registrations:[]};
window.__ModuleLoader__={load:(r)=>window.__dshBoot.factories.set(r.id,r.factory)}</script></body></html>`

const b = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.route('http://v.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SHELL }))
await p.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true,"difficulty":"easy"}' }))
await p.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
await p.goto('http://v.test/', { waitUntil: 'domcontentloaded' })
await p.addScriptTag({ content: readFileSync('C:/Users/75791/AppData/Local/Temp/dsh-boot-duel-react.js', 'utf8') })
await p.addScriptTag({ content: readFileSync(path.join(root, 'client.js'), 'utf8') })
await p.evaluate(() => {
  const f = window.__dshBoot.factories.get('dsh-boot-duel')
  const ex = f((s) => (s === 'react' ? window.React : window.ReactDOM))
  const loc = { getLocale: () => ({ active: 'zh-CN', revision: 1 }), bind: () => (k) => k, subscribe: () => () => {} }
  ex.apply({
    get: (n) => (n === 'locale' ? loc : undefined), effect: (fn) => fn(),
    slots: { inject: (_, cb) => cb(), register: (r, c) => { window.__dshBoot.registrations.push({ r, c }); return () => {} } },
  })
  const e = window.__dshBoot.registrations.find((x) => x.r.name === 'shell.overlay')
  window.ReactDOM.createRoot(document.querySelector('[data-shell-overlay]')).render(window.React.createElement(e.c))
})
await p.waitForSelector('.boot-duel-layer')
await p.waitForTimeout(900)

// Reach the live round through the handle the layer publishes, and put the
// opponent one clean hit from the floor.
const reached = await p.evaluate(() => {
  const h = document.querySelector('.boot-duel-layer')?.__bootDuel
  if (!h?.duel?.arena) return false
  h.duel.arena.enemy.hp = Math.min(h.duel.arena.enemy.hp, 4)
  return true
})
if (!reached) throw new Error('the layer did not expose the live duel; the harness cannot shorten the round')

await p.keyboard.press('Enter')
await p.waitForTimeout(600)

// Stand the pair up near the middle of the stage before the killing blow.
// Left alone, the player chases the opponent across the room and the launch
// then throws the body to one edge with the player pinned to the other — the
// seal ends up framed between two clipped silhouettes.
await p.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer').__bootDuel.duel.arena
  a.player.x = 440
  a.enemy.x = 496
  a.player.vx = 0
  a.enemy.vx = 0
  a.player.face = 1
  a.enemy.face = -1
})
await p.waitForTimeout(120)

// Land hits with the swing's own cadence, then watch for the finish.
//
// The walk direction is READ, not assumed. Pressing `d` on every attempt was
// what kept this capture failing: once the player has walked past the
// opponent, `d` carries them further away and every swing whiffs — the rival
// in the last frame was still on 4 hp after sixteen attempts.
async function walkIn() {
  for (let i = 0; i < 8; i++) {
    const { px, ex } = await p.evaluate(() => {
      const a = document.querySelector('.boot-duel-layer').__bootDuel.duel.arena
      return { px: a.player.x, ex: a.enemy.x }
    })
    if (Math.abs(ex - px) <= 70) return
    const key = ex > px ? 'd' : 'a'
    await p.keyboard.down(key)
    await p.waitForTimeout(140)
    await p.keyboard.up(key)
  }
}
/**
 * Throw one move, HOLDING the key for a few frames.
 *
 * `keyboard.press` is down+up inside a single browser task; the sim samples the
 * held set once per animation frame and edge-triggers every move, so a press
 * that opens and closes between two frames is never seen. That is why earlier
 * runs swung into thin air at point-blank range.
 */
async function tap(key, hold = 90) {
  await p.keyboard.down(key)
  await p.waitForTimeout(hold)
  await p.keyboard.up(key)
}

/** The player's invulnerability, so the AI cannot end the capture first. */
const shield = () => p.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena
  if (a) a.player.invuln = 3
})

async function landOne(key = 'j') {
  await shield()
  await walkIn()
  await p.waitForTimeout(110)
  await tap(key)
  await p.waitForTimeout(560)
}
const beat = () => p.evaluate(() => document.querySelector('.boot-duel-ko')?.dataset.beat ?? '')

// The opponent can still slip a swing, so keep pressing — but on a one-hit
// body every connection ends the round, which is a few attempts at most.
for (let i = 0; i < 16 && !(await beat()); i++) await landOne(i % 3 === 2 ? 'k' : 'j')
console.log('rival hp at the end:', await p.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena
  return a ? a.enemy.hp : 'gone'
}))
const sealed = await p.waitForFunction(
  () => document.querySelector('.boot-duel-ko')?.dataset.beat === 'seal',
  { timeout: 6000 },
).then(() => true).catch(() => false)
// Let the stamp's entrance settle before the shutter. This is the frame:
// past the seal the layer fades out, so a later capture is a wash of white.
await p.waitForTimeout(650)
await p.screenshot({ path: path.join(outDir, '05-victory.png') })
console.log(sealed ? 'shot 05-victory (seal)' : 'shot 05-victory (NOT the seal — check the frame before using it)')
console.log('errors', JSON.stringify(errs.slice(0, 3)))
await b.close()
if (!sealed) process.exitCode = 1