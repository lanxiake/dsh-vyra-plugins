/**
 * DEMO: 工位暴走 — the workdesk riot finisher, scrubbed beat by beat.
 *
 * Not a regression test — a contact sheet for review. It runs the real arena
 * for its snapshot (fighters, camera, juice) and the real `riot.js` timeline,
 * then pauses at key milliseconds and photographs each. If the pictures are
 * approved, the same timeline gets driven by the real cinematic clock.
 *
 * Usage: node scripts/shoot-riot-demo.mjs [outDir]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'riot-demo')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0b0d12}</style></head>
<body><canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import { Arena } from './js/arena.js'
import { createRenderer } from './js/render.js'
import { createRiot, drawRiot } from './js/riot.js'
const c = document.getElementById('c')
const ctx = c.getContext('2d')
const r = createRenderer(c, ctx)
r.resize(1280, 720, 1)
const a = new Arena({ round: 0 })
a.player.x = 430; a.enemy.x = 520
a.player.face = 1; a.enemy.face = -1
a.phase = 'playing'
const riot = createRiot({ player: { x: a.player.x, y: a.player.y }, enemy: { x: a.enemy.x, y: a.enemy.y }, groundY: 300, face: 1 })

window.__beat = (t, opts = {}) => {
  riot.t = t
  const s = a.snapshot()
  // A frame that holds still: the cinematic freezes the fighters for its first
  // two beats, so a scrubbed screenshot must not show them mid-walk.
  s.player.time = 1.2
  s.enemy.time = 0.8
  s.player.state = 'idle'
  s.enemy.state = opts.hurt ? 'hurt' : 'idle'
  s.juice.ox = opts.shake ? (Math.random() - 0.5) * opts.shake : 0
  s.juice.oy = opts.shake ? (Math.random() - 0.5) * opts.shake : 0
  s.line = null
  s.hit = null
  s.superCine = opts.cine ?? null
  s.superBanner = opts.banner ?? 0
  // The riot rides the renderer's own world transform, camera shake included.
  r.draw(s, (ctx) => drawRiot(ctx, riot))
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
  if (!u.startsWith('http://riot.test')) return route.continue()
  const rel = new URL(u).pathname
  try {
    const body = rel === '/' ? SHELL : readFileSync(path.join(root, rel))
    await route.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : 'text/html', body })
  } catch { await route.fulfill({ status: 404, body: 'nf' }) }
})
await page.goto('http://riot.test/', { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready === true)

/** millisecond, filename, drawing options */
const SHOTS = [
  [300, 'riot-1-charge', { cine: { phase: 'charge', bars: 0.8, landed: false, t: 300 }, banner: 1 }],
  [800, 'riot-2-name', { cine: { phase: 'name', bars: 1, landed: false, t: 800 }, banner: 1 }],
  [1010, 'riot-3-launch', { cine: { phase: 'strike', bars: 0, landed: false, t: 1010 }, banner: 0 }],
  [1160, 'riot-4-monitor', { cine: { phase: 'impact', bars: 0, landed: true, t: 1160 }, shake: 9 }],
  [1350, 'riot-5-chair', { cine: { phase: 'impact', bars: 0, landed: true, t: 1350 }, shake: 14 }],
  [1720, 'riot-6-stamp', { cine: { phase: 'impact', bars: 0, landed: true, t: 1720 }, shake: 10 }],
  [1960, 'riot-7-wreck', { cine: { phase: 'recover', bars: 0, landed: true, t: 1960 } }],
]

for (const [t, name, opts] of SHOTS) {
  const png = await page.evaluate(([ms, o]) => window.__beat(ms, o), [t, opts])
  writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'))
  console.log(name, t)
}
console.log('errors', JSON.stringify(errs.slice(0, 4)))
await browser.close()