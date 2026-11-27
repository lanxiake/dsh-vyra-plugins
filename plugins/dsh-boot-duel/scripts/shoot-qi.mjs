/**
 * The wuxia qi vocabulary, photographed in a LIVE round.
 *
 * Three frames, each taken while the effect is genuinely happening in the
 * engine — not posed:
 *
 *   1. mid-strike  — the 拳锋 streak along the committed limb
 *   2. mid-fall    — the 踏空涟漪 under the pushing-off foot
 *   3. landing     — the 震地环 flat on the floor
 *
 * The afterimage trail is present in all three, because it is driven by the
 * body's own speed rather than by an event.
 *
 * Usage: node scripts/shoot-qi.mjs [outDir]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'qi')
mkdirSync(outDir, { recursive: true })

const SHELL = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#eef1f5}</style></head>
<body><canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import { Arena } from './js/arena.js'
import { createRenderer } from './js/render.js'
const c = document.getElementById('c')
const r = createRenderer(c, c.getContext('2d'))
r.resize(1280, 720, 1)
const a = new Arena({ round: 0 })
a.player.x = 430; a.enemy.x = 540
a.player.face = 1; a.enemy.face = -1
a.phase = 'playing'

/** Advance the real simulation N frames, drawing each one so the trail builds. */
const step = (n) => { for (let i = 0; i < n; i++) { a.step({}); r.draw(a.snapshot(), a.riot ? (ctx) => window.__riot?.drawRiot(ctx, a.snapshot().riot) : null) } }

window.__frames = (name, frames, mutate) => {
  if (mutate) mutate(a)
  step(frames)
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
  if (!u.startsWith('http://qi.test')) return route.continue()
  const rel = new URL(u).pathname
  try {
    const body = rel === '/' ? SHELL : readFileSync(path.join(root, rel))
    await route.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : 'text/html', body })
  } catch { await route.fulfill({ status: 404, body: 'nf' }) }
})
await page.goto('http://qi.test/', { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready === true)

/**
 * The shots. Each one runs the real `step`, so what is photographed is what
 * the engine produces — a struck pose, a body in the air, a body hitting the
 * floor. `frames` is tuned per shot rather than guessed: a move's active
 * window is a fraction of its duration, and the camera needs a few frames to
 * settle after the fighters are placed.
 */
const shots = [
  // A jab, caught in its active window: the arm is out and the streak is up.
  ['01-strike', 16, (a) => { a.player.startAttack('p1'); a.enemy.vx = 0 }],
  // A launch: the victim is off the ground and the attacker is recovering.
  ['02-launch', 30, (a) => { a.player.startAttack('p3') }],
  // The victim falling back down from the launch, for the air ripple.
  ['03-air', 18, () => {}],
  // After the landing: the ground ring on the floor.
  ['04-land', 24, () => {}],
]

for (const [name, frames, mutate] of shots) {
  const png = await page.evaluate(([f, src]) => {
    const fn = new Function('a', `(${src})(a)`)
    return window.__frames(null, f, fn)
  }, [frames, mutate.toString()])
  const { writeFileSync } = await import('node:fs')
  writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'))
  console.log(name)
}
console.log('errors', JSON.stringify(errs.slice(0, 4)))
await browser.close()