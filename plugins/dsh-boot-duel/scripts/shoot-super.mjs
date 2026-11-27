/** Capture the finisher's five beats, one frame each. */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = path.join(root, 'test', 'e2e', 'super')
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
window.__step = (special) => {
  // The real client drives juice.update() from its frame loop; without it the
  // flash never decays and every frame after the release is washed white.
  const scale = a.juice.update(1 / 60)
  void scale
  a.step(special ? { ...IDLE, special: true } : IDLE)
  const s = a.snapshot()
  r.draw(s)
  return { png: c.toDataURL('image/png'), phase: s.superCine ? s.superCine.phase : null }
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

await page.evaluate(() => { window.__a.player.superMeter = 100; window.__a.player.superReady = true })
// wind-up frames before the press
for (let i = 0; i < 20; i++) await page.evaluate(() => window.__step(false))

const WANT = ['charge', 'name', 'strike', 'impact', 'recover']
const got = {}
await page.evaluate(() => window.__step(true))
for (let i = 0; i < 220; i++) {
  const res = await page.evaluate(() => window.__step(false))
  if (res.phase && !got[res.phase]) {
    got[res.phase] = true
    writeFileSync(path.join(outDir, `${res.phase}.png`), Buffer.from(res.png.split(',')[1], 'base64'))
    console.log('beat', res.phase)
  }
  if (WANT.every((b) => got[b])) break
  if (!res.phase && got.recover) break
}
console.log('captured:', WANT.filter((b) => got[b]).join(', '))
console.log('missing:', WANT.filter((b) => !got[b]).join(', ') || '(none)')
console.log('errors', JSON.stringify(errs.slice(0, 3)))
await browser.close()
