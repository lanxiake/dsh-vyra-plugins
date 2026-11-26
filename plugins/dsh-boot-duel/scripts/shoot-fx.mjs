/**
 * Capture the fighting-game effects at the exact frame they happen.
 *
 * The frame is produced by stepping the arena and drawing, then exported with
 * `canvas.toDataURL()` — taking a page screenshot instead races the browser's
 * own paint and lands on a different frame than the one just drawn.
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const CHROME = 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'
const outDir = path.join(root, 'test', 'e2e', 'fxframes')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html><body style="margin:0;background:#9a9a9a">
<canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import { Arena } from './js/arena.js'
import { createRenderer } from './js/render.js'

window.__boot = (gap) => {
  const c = document.getElementById('c')
  const ctx = c.getContext('2d')
  const r = createRenderer(c, ctx)
  r.resize(1280, 720, 1)
  const a = new Arena()
  a.begin()
  a.player.x = 480
  a.enemy.x = 480 + gap
  a.player.face = 1
  a.enemy.face = -1
  a.enemy.aiStep = () => ({ left: false, right: false, move: null })
  window.__m = { a, r, c, ctx }
}

const IDLE = { left:false,right:false,jump:false,jab:false,punch2:false,kick:false,upper:false,sweep:false,slide:false,retreat:false,block:false,crouch:false,special:false }

/** Step once, draw, and return the composited image. */
window.__frame = (press) => {
  const { a, r, c } = window.__m
  a.step(press ? { ...IDLE, [press]: true } : IDLE)
  const snap = a.snapshot()
  r.draw(snap)
  return { png: c.toDataURL('image/png'), hit: Boolean(snap.hit), combo: a.combo, hp: a.enemy.hp }
}
window.__ready = true
</script></body></html>`

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.route('**/*', async (route) => {
  const u = route.request().url()
  if (!u.startsWith('http://fx.test')) return route.continue()
  const rel = new URL(u).pathname
  try {
    const body = rel === '/' ? SHELL : readFileSync(path.join(root, rel))
    await route.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : 'text/html', body })
  } catch { await route.fulfill({ status: 404, body: 'nf' }) }
})
await page.goto('http://fx.test/', { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready === true)

async function capture(name, presses, frames = 18) {
  await page.evaluate((gap) => window.__boot(gap), 62)
  const total = presses.length + frames
  let peak = { hit: false, hp: 100 }
  for (let i = 0; i < total; i++) {
    const press = i < presses.length ? presses[i] : null
    const res = await page.evaluate((p) => window.__frame(p), press)
    if (res.hit) peak.hit = true
    peak.hp = res.hp
    writeFileSync(path.join(outDir, `${name}-${String(i).padStart(2, '0')}.png`),
      Buffer.from(res.png.split(',')[1], 'base64'))
  }
  await page.evaluate(() => { const m = window.__m; m.a = null; window.__m = null })
    .catch(() => {})
  console.log(name.padEnd(9), `hit=${peak.hit}`, `enemyHp=${peak.hp}`)
}

await capture('jab', ['jab'])
await capture('kick', ['kick'], 20)
await capture('upper', ['upper'], 20)
await capture('sweep', ['sweep'], 22)
await capture('chain', ['jab', null, null, null, null, 'jab'], 20)

console.log('errors', JSON.stringify(errors.slice(0, 4)))
await browser.close()
