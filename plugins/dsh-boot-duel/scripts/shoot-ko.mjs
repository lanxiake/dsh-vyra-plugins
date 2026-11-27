/** Capture the finish's three beats: launch, freeze, seal. */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = path.join(root, 'test', 'e2e', 'ko')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html><body style="margin:0;background:#9a9a9a">
<canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import { Arena } from './js/arena.js'
import { createRenderer } from './js/render.js'
const c = document.getElementById('c')
const r = createRenderer(c, c.getContext('2d'))
r.resize(1280, 720, 1)
const a = new Arena({ round: 0 })
a.player.x = 430; a.enemy.x = 560
a.player.face = 1; a.enemy.face = -1
a.begin()
window.__a = a; window.__r = r; window.__c = c
const IDLE = { left:false,right:false,jump:false,jab:false,punch2:false,kick:false,upper:false,sweep:false,slide:false,retreat:false,block:false,crouch:false,special:false }
window.__step = (attack) => {
  a.juice.update(1 / 60)
  a.step(attack ? { ...IDLE, jab: true } : IDLE)
  const s = a.snapshot()
  r.draw(s)
  return { png: c.toDataURL('image/png'), beat: s.koBeat, t: s.koT, phase: s.phase }
}
window.__ready = true
</script></body></html>`

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.route('**/*', async (route) => {
  const u = route.request().url()
  if (!u.startsWith('http://s.test')) return route.continue()
  const rel = new URL(u).pathname
  try {
    const body = rel === '/' ? SHELL : readFileSync(path.join(root, rel))
    await route.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : 'text/html', body })
  } catch { await route.fulfill({ status: 404, body: 'nf' }) }
})
await page.goto('http://s.test/', { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready === true)

// Put the enemy on one hit, then land it.
await page.evaluate(() => { window.__a.enemy.hp = 4 })
for (let i = 0; i < 10; i++) await page.evaluate(() => window.__step())
await page.evaluate(() => { window.__a.player.x = window.__a.enemy.x - 46 })
const got = {}
for (let i = 0; i < 220; i++) {
  const res = await page.evaluate((first) => window.__step(first), i === 0 || (i % 3 === 0))
  if (res.beat && !got[res.beat]) {
    got[res.beat] = true
    writeFileSync(path.join(outDir, `${res.beat}.png`), Buffer.from(res.png.split(',')[1], 'base64'))
    console.log('beat', res.beat, 'at t=', Number(res.t).toFixed(2))
  }
  if (got.seal) break
}
console.log('captured:', Object.keys(got).join(', ') || '(none)')
console.log('errors', JSON.stringify(errs.slice(0, 3)))
await browser.close()
