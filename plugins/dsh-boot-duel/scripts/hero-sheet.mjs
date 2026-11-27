/**
 * A contact sheet of the two fighters at game scale, drawn by the REAL
 * renderer, to judge the swordsman costume marks.
 *
 * Screenshotting the live arena to check a 10-unit bun is hopeless: the fight
 * moves, the camera lerps, a bubble lands on the head, and by the time the
 * pixels settle the pose is something else. This serves the plugin's own
 * modules over a static origin, builds REAL `Fighter` instances (so the poses
 * are the game's, not a hand-authored approximation), and calls
 * `Renderer.drawFighter` — the exact code path the game uses, with nothing
 * else in the frame.
 *
 * Usage: node scripts/hero-sheet.mjs [outPath]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outPath = process.argv[2] || path.join(root, 'test', 'e2e', 'hero-marks', 'sheet.png')
mkdirSync(path.dirname(outPath), { recursive: true })

const CHROME = 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

/**
 * Serve the plugin directory as a static origin so the modules' own relative
 * imports (`./rig.js`) resolve. A data-URL module cannot: its base is opaque.
 */
await page.route('http://sheet.test/**', async (route) => {
  const url = new URL(route.request().url())
  if (url.pathname === '/') {
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body style="margin:0;background:#eef1f5"><canvas id="c"></canvas></body></html>',
    })
  }
  const file = path.join(root, decodeURIComponent(url.pathname).replace(/^\//, ''))
  try {
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: readFileSync(file) })
  } catch {
    route.fulfill({ status: 404, body: '' })
  }
})

await page.goto('http://sheet.test/', { waitUntil: 'domcontentloaded' })

const dataUrl = await page.evaluate(async () => {
  const mods = {}
  for (const name of ['rig', 'juice', 'fighter', 'effects', 'riot', 'render']) {
    mods[name] = await import(`/js/${name}.js`)
  }
  const { Fighter } = mods.fighter
  const { Renderer } = mods.render

  /**
   * One real fighter, advanced into a state, and its points read back. Every
   * pose below is produced by the game's own pose solver — the same code that
   * runs in a round — so the sheet cannot drift from what ships.
   */
  const build = (kind, setup) => {
    const f = new Fighter(kind, 0, 0)
    f.time = 0
    f.face = 1
    if (setup) setup(f)
    f.pose()
    f.rig.snapPose(f.tx, f.ty)
    return f
  }
  const points = (f) => Array.from({ length: 11 }, (_, i) => [f.rig.x[i], f.rig.y[i]])

  const POSES = [
    ['idle', build('player')],
    ['guard', build('player', (f) => { f.block = true })],
    ['jab', build('player', (f) => { f.startAttack('p1'); f.t = 0.09 })],
    ['kick', build('player', (f) => { f.startAttack('k'); f.t = 0.22 })],
    ['sweep', build('player', (f) => { f.startAttack('sweep'); f.t = 0.30 })],
    ['air', build('player', (f) => { f.state = 'air'; f.y = -60; f.onGround = false })],
  ]

  const COLS = POSES.length
  const CW = 240
  const CH = 400
  const ROWS = 2
  const canvas = document.getElementById('c')
  canvas.width = COLS * CW
  canvas.height = ROWS * CH
  canvas.style.width = `${(COLS * CW) / 2}px`
  canvas.style.height = `${(ROWS * CH) / 2}px`
  const ctx = canvas.getContext('2d')

  // `Renderer.resize` assigns `canvas.width`, which CLEARS the canvas and
  // resets the context state — so the wall has to be painted after it, not
  // before. Painting first produced a black sheet with transparent figures.
  const r = new Renderer(canvas, ctx)
  r.resize(COLS * CW, ROWS * CH, 1)

  ctx.fillStyle = '#e8ecf2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const FLOOR = 330
  for (const [row, inkName] of [[0, 'black'], [1, 'white']]) {
    for (const [col, [label, source]] of POSES.entries()) {
      const gx = col * CW + CW / 2
      const gy = row * CH + FLOOR
      const pts = points(source).map(([x, y]) => [x + gx, y + gy])
      const f = {
        points: pts,
        scale: 1,
        lw: 6.4,
        face: 1,
        state: source.state,
        flash: 0,
        time: 0,
        x: gx,
        topknot: Boolean(source.k.topknot),
      }
      ctx.save()
      ctx.fillStyle = 'rgba(40, 50, 66, 0.14)'
      ctx.beginPath()
      ctx.ellipse(gx, gy + 2, 48, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      r.drawFighter(ctx, f, inkName, null)

      ctx.fillStyle = 'rgba(20,26,36,0.5)'
      ctx.font = '600 19px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${inkName} · ${label}`, gx, row * CH + CH - 26)
    }
  }

  return canvas.toDataURL('image/png')
})

/**
 * A 3x detail sheet: one idle figure of each ink, big enough to judge a
 * 10-unit bun and a 40-unit sash. The contact sheet is for the whole costume
 * at game size; this is for the strokes themselves.
 */
const detailUrl = await page.evaluate(async () => {
  const mods = {}
  for (const name of ['rig', 'juice', 'fighter', 'effects', 'riot', 'render']) {
    mods[name] = await import(`/js/${name}.js`)
  }
  const { Fighter } = mods.fighter
  const { Renderer } = mods.render
  const ZOOM = 3
  const W = 520
  const H = 640
  const canvas = document.createElement('canvas')
  canvas.width = W * 2
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const r = new Renderer(canvas, ctx)
  r.resize(W * 2, H, 1)
  ctx.fillStyle = '#e8ecf2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const [i, inkName] of [[0, 'black'], [1, 'white']]) {
    const f = new Fighter('player', 0, 0)
    f.time = 0
    f.face = 1
    f.pose()
    f.rig.snapPose(f.tx, f.ty)
    const gx = i * W + W / 2
    const gy = H - 90
    const pts = Array.from({ length: 11 }, (_, k) => [f.rig.x[k] * ZOOM + gx, f.rig.y[k] * ZOOM + gy])
    r.drawFighter(ctx, {
      points: pts, scale: ZOOM, lw: 6.4, face: 1, state: 'idle',
      flash: 0, time: 0, x: gx, topknot: true,
    }, inkName, null)
  }
  return canvas.toDataURL('image/png')
})

if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
  console.error('sheet came back empty; page errors =', errors)
  await browser.close()
  process.exit(1)
}
writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'))
if (detailUrl?.startsWith('data:image/png')) {
  writeFileSync(outPath.replace(/\.png$/, '-detail.png'), Buffer.from(detailUrl.split(',')[1], 'base64'))
}
console.log('wrote', outPath, 'errors =', errors)
await browser.close()