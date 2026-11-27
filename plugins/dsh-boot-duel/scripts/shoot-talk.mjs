/**
 * Two frames of the argument: the opening exchange, and the KO's cold cut.
 * Run after a script rewrite to confirm the new lines actually reach the
 * bubble and are not clipped by its width.
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'talk')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#fff"><div style="height:100vh;position:relative"><div data-shell-overlay></div></div>
<script>window.__dshBoot={factories:new Map(),registrations:[]};window.__ModuleLoader__={load:(r)=>window.__dshBoot.factories.set(r.id,r.factory)}</script></body></html>`

const b = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.route('http://talk.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SHELL }))
await p.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true,"difficulty":"normal"}' }))
await p.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
await p.goto('http://talk.test/', { waitUntil: 'domcontentloaded' })
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
await p.waitForTimeout(900)

const line = () => p.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena
  return a?.line ? `${a.line.speaker}: ${a.line.text}` : null
})
const layerZ = () => p.evaluate(() => getComputedStyle(document.querySelector('.boot-duel-layer')).zIndex)

await p.keyboard.press('Enter')
await p.waitForTimeout(900)
console.log('z-index', await layerZ())

// The standoff: nobody can move until the opening exchange has been spoken.
const heard = []
for (let i = 0; i < 60; i++) {
  const t = await line()
  if (t && heard[heard.length - 1] !== t) heard.push(t)
  const queued = await p.evaluate(() => document.querySelector('.boot-duel-layer')?.__bootDuel?.duel?.arena?.openQueue ?? 0)
  // Take the shot mid-exchange, while a bubble is fully on screen: the last
  // line is still fading when the queue empties, so waiting for zero lands on
  // a ghost.
  if (queued > 0 && queued <= 7 && heard.length >= 4) break
  if (queued === 0) break
  await p.waitForTimeout(250)
}
console.log(`opening exchange (${heard.length} lines):`)
for (const t of heard) console.log('  ' + t)
await p.screenshot({ path: path.join(outDir, '01-argue.png') })

// The cold cut: floor the rival, wait for the KO, read the last words.
await p.evaluate(() => {
  const a = document.querySelector('.boot-duel-layer').__bootDuel.duel.arena
  a.enemy.hp = 1
  a.enemy.x = a.player.x + 50
  a.enemy.vx = 0
})
for (let i = 0; i < 12; i++) {
  const beat = await p.evaluate(() => document.querySelector('.boot-duel-ko')?.dataset.beat ?? '')
  if (beat === 'seal') break
  await p.evaluate(() => { const a = document.querySelector('.boot-duel-layer').__bootDuel.duel.arena; a.player.invuln = 3; a.player.x = a.enemy.x - 50 })
  await p.keyboard.down('j'); await p.waitForTimeout(90); await p.keyboard.up('j')
  await p.waitForTimeout(500)
}
await p.waitForFunction(() => document.querySelector('.boot-duel-ko')?.dataset.beat === 'seal', { timeout: 6000 })
await p.waitForTimeout(400)
console.log('ko line:', await line())
await p.screenshot({ path: path.join(outDir, '02-coldcut.png') })
console.log('errors', JSON.stringify(errs.slice(0, 3)))
await b.close()
