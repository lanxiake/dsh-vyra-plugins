/** Capture the dialogue bubbles across all three stories. */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = path.join(root, 'test', 'e2e', 'story')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html><body style="margin:0;background:#9a9a9a">
<canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import { Arena } from './js/arena.js'
import { createRenderer } from './js/render.js'
window.__boot = (round) => {
  const c = document.getElementById('c')
  const r = createRenderer(c, c.getContext('2d'))
  r.resize(1280, 720, 1)
  const a = new Arena({ round })
  a.player.x = 480; a.enemy.x = 542
  a.player.face = 1; a.enemy.face = -1
  a.enemy.aiStep = () => ({ left: false, right: false, move: null })
  a.begin()
  window.__m = { a, r, c }
}
const IDLE = { left:false,right:false,jump:false,jab:false,punch2:false,kick:false,upper:false,sweep:false,slide:false,retreat:false,block:false,crouch:false,special:false }
window.__step = (press) => {
  const { a, r, c } = window.__m
  a.step(press ? { ...IDLE, [press]: true } : IDLE)
  const s = a.snapshot()
  r.draw(s)
  return { png: c.toDataURL('image/png'), line: s.line ? s.line.text : null, speaker: s.line ? s.line.speaker : null }
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

for (const round of [0, 1, 2]) {
  await page.evaluate((r) => window.__boot(r), round)
  // Opening line, on frame 1.
  let res = await page.evaluate(() => window.__step(null))
  for (let i = 0; i < 4; i++) res = await page.evaluate(() => window.__step(null))
  const lines = new Set([res.line])
  writeFileSync(path.join(outDir, `r${round}-open.png`), Buffer.from(res.png.split(',')[1], 'base64'))
  // Land hits to trigger a chain line.
  for (let i = 0; i < 40; i++) {
    res = await page.evaluate((k) => window.__step(k), i % 20 === 0 ? 'jab' : null)
    if (res.line) lines.add(res.line)
  }
  writeFileSync(path.join(outDir, `r${round}-hit.png`), Buffer.from(res.png.split(',')[1], 'base64'))
  console.log(`round ${round}: ${[...lines].filter(Boolean).join(' | ')}`)
}
console.log('errors', JSON.stringify(errs.slice(0, 3)))
await browser.close()
