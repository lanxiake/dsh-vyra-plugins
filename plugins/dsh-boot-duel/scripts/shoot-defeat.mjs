/**
 * The LOSS ending, photographed in the real client, from a REAL hit.
 *
 * The win stamp is well covered by the existing capture scripts; the loss is
 * new, and it is the one ending nobody has ever seen. This drives the real
 * layer, puts the player on one hit point, and lets the rival's kick finish
 * them — the body has to be LAUNCHED for the finish to look like anything, so
 * writing `hp = 0` directly would photograph a still-life.
 *
 * Usage: node scripts/shoot-defeat.mjs [outDir]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'defeat')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#fff"><div style="height:100vh;position:relative"><div data-shell-overlay></div></div>
<script>window.__dshBoot={factories:new Map(),registrations:[]};window.__ModuleLoader__={load:(r)=>window.__dshBoot.factories.set(r.id,r.factory)}</script></body></html>`

const b = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.route('http://defeat.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SHELL }))
await p.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true,"difficulty":"normal"}' }))
await p.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
await p.goto('http://defeat.test/', { waitUntil: 'domcontentloaded' })
await p.addScriptTag({ content: readFileSync('C:/Users/75791/AppData/Local/Temp/dsh-boot-duel-react.js', 'utf8') })
await p.addScriptTag({ content: readFileSync(path.join(root, 'client.js'), 'utf8') })
await p.evaluate(() => {
  const f = window.__dshBoot.factories.get('dsh-boot-duel')
  const ex = f((s) => (s === 'react' ? window.React : window.ReactDOM))
  const loc = { getLocale: () => ({ active: 'zh-CN', revision: 1 }), bind: () => (k) => k, subscribe: () => () => {} }
  ex.apply({ get: (n) => (n === 'locale' ? loc : undefined), effect: (fn) => fn(),
    slots: { inject: (_, cb) => cb(), register: (r, c) => { window.__dshBoot.registrations.push({ r, c }); return () => {} } } })
  const e = window.__dshBoot.registrations.find((x) => x.r.name === 'shell.overlay')
  window.ReactDOM.createRoot(document.querySelector('[data-shell-overlay]')).render(window.React.createElement(e.c))
})
await p.waitForSelector('.boot-duel-layer')
await p.waitForTimeout(700)
await p.keyboard.press('Enter')

// Let the opening argument finish, so the frame is a fight and not a bubble.
for (let i = 0; i < 60; i++) {
  const q = await p.evaluate(() => document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena?.openQueue ?? 1)
  if (q === 0) break
  await p.waitForTimeout(250)
}
await p.waitForTimeout(400)

// The bigger framing, before anything is knocked down.
await p.screenshot({ path: path.join(outDir, '00-framing.png') })

/**
 * A REAL knockout. One hit point, the rival parked in range, and its kick
 * thrown — `applyHit` does the rest, including the launch that makes the
 * finish worth watching.
 */
const setup = await p.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer').__bootDuel.duel.arena
  a.player.hp = 1
  a.player.x = 470
  a.enemy.x = 520
  a.enemy.face = -1
  a.enemy.ai.cd = 0
  a.enemy.startAttack('k')
  a.player.invuln = 0
  return { playerHp: a.player.hp, enemyAtk: a.enemy.atkName }
})
console.log('setup', JSON.stringify(setup))

/**
 * Hold each beat for a beat before photographing it.
 *
 * The previous version read `data-beat` and shot immediately, and the DOM had
 * moved on by the time the shutter opened — the "launch" frame came back with
 * the seal already on screen. Waiting for the attribute to be STABLE across
 * two reads is the honest way to photograph a transition.
 */
const shots = new Map()
for (let i = 0; i < 220; i++) {
  const beat = await p.evaluate(() => document.querySelector('.boot-duel-ko')?.dataset.beat ?? '')
  if (beat && !shots.has(beat)) {
    // Confirm it is not a one-frame flash before spending a screenshot on it.
    const again = await p.evaluate(() => document.querySelector('.boot-duel-ko')?.dataset.beat ?? '')
    if (again === beat) {
      shots.set(beat, true)
      await p.screenshot({ path: path.join(outDir, `01-${beat}.png`) })
      console.log('beat', beat)
    }
  }
  // The layer UNMOUNTS when the outro ends, so a read after that has nothing
  // to read: `?.` all the way down, and treat a missing layer as finished.
  const done = await p.evaluate(() => document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.phase ?? 'gone')
  if (done === 'done' || done === 'gone') break
  await p.waitForTimeout(90)
}

// And after the stamp, with the rival's last line up — while the layer is
// still up. It fades out once the round is over, so this has to happen first.
await p.waitForTimeout(700)
await p.screenshot({ path: path.join(outDir, '02-last-word.png') })
const end = await p.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena
  if (!a) return { gone: true }
  return {
    result: a.result, loser: a.loser, playerHp: a.player.hp,
    line: a.line ? `${a.line.speaker}: ${a.line.text}` : null,
  }
})
console.log('end', JSON.stringify(end))
console.log('errors', JSON.stringify(errs))
await b.close()