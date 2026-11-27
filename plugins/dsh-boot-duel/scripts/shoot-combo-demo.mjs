/**
 * DEMO: the combo escalation ladder, link by link.
 *
 * Not a regression test — a contact sheet for review. It drives the real
 * renderer with a synthetic hit whose `combo` field is set to 1..5, so the
 * five tiers are photographed side by side under identical conditions. If the
 * pictures are approved, the same code path runs in a real round.
 *
 * Usage: node scripts/shoot-combo-demo.mjs [outDir]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'combo-demo')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0b0d12}</style></head>
<body><canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import { Arena } from './js/arena.js'
import { createRenderer } from './js/render.js'
const c = document.getElementById('c')
const r = createRenderer(c, c.getContext('2d'))
r.resize(1280, 720, 1)
const a = new Arena({ round: 0 })
a.player.x = 430; a.enemy.x = 520
a.player.face = 1; a.enemy.face = -1
a.phase = 'playing'
// One hit, frozen at its own peak, with the chain depth the caller asks for.
window.__link = (combo) => {
  const s = a.snapshot()
  s.hit = { x: 505, y: 205, dir: 1, angle: -0.45, life: 0.85, power: 0.62, kill: false, combo, fromPlayer: true }
  s.combo = combo
  s.comboPop = 1
  r.draw(s)
  return c.toDataURL('image/png')
}
window.__ready = true
</script></body></html>`

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.route('**/*', async (route) => {
  const u = route.request().url()
  if (!u.startsWith('http://combo.test')) return route.continue()
  const rel = new URL(u).pathname
  try {
    const body = rel === '/' ? SHELL : readFileSync(path.join(root, rel))
    await route.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : 'text/html', body })
  } catch { await route.fulfill({ status: 404, body: 'nf' }) }
})
await page.goto('http://combo.test/', { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready === true)

for (const n of [1, 2, 3, 4, 5]) {
  const png = await page.evaluate((combo) => window.__link(combo), n)
  writeFileSync(path.join(outDir, `link-${n}.png`), Buffer.from(png.split(',')[1], 'base64'))
  console.log('link', n)
}
console.log('errors', JSON.stringify(errs.slice(0, 3)))
await browser.close()
