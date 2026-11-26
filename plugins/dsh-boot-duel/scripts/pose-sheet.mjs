/**
 * Render every key pose to one contact sheet, at the game's own scale, on the
 * game's own flat-grey stage.
 *
 * This exists because the way to match a reference animation is to put the
 * poses side by side and look, not to nudge numbers and screenshot the result.
 * Each cell is one frame of one move, drawn with the same `poseJoints` and the
 * same silhouette painter the game uses, on a ground line at the same relative
 * height as the real arena.
 *
 * Usage: node scripts/pose-sheet.mjs [outPath]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outPath = process.argv[2] || path.join(root, 'test', 'e2e', 'pose-sheet.png')
mkdirSync(path.dirname(outPath), { recursive: true })

const rigSource = readFileSync(path.join(root, 'rig.js'), 'utf8')
const constantsSource = readFileSync(path.join(root, 'sim', 'constants.mjs'), 'utf8')

/**
 * The rig is ESM with no imports of its own; constants is ESM with none
 * either. Strip the `export` keywords and evaluate both as classic scripts so
 * they are available synchronously — `page.setContent` with `<script
 * type="module">` does not run before `page.evaluate` and silently exposes
 * nothing, which is what broke the first version of this script.
 */
const asClassic = (src) => src.replace(/^export\s+(const|function|let)\s/gm, '$1 ')

const CHROME = 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.setContent('<!doctype html><html><body style="margin:0;background:#9a9a9a"></body></html>')

await page.addScriptTag({ content: asClassic(constantsSource) })
await page.addScriptTag({ content: asClassic(rigSource) })

const ready = await page.evaluate(() => typeof window.poseJoints === 'function' || typeof poseJoints === 'function')
if (!ready) {
  console.error('rig did not expose poseJoints; errors =', errors)
  await browser.close()
  process.exit(1)
}

const dataUrl = await page.evaluate(() => {
  // `addScriptTag` with classic content declares these as globals.
  /* eslint-disable no-undef */
  const P = poseJoints
  /* eslint-enable no-undef */

  const COLS = 8
  const CW = 200
  const CH = 330
  const canv = document.createElement('canvas')
  canv.width = COLS * CW
  canv.height = Math.ceil(40 / COLS) * CH
  const ctx = canv.getContext('2d')

  // Same grey as the game, so a pose is judged against its real background.
  ctx.fillStyle = '#9a9a9a'
  ctx.fillRect(0, 0, canv.width, canv.height)

  // The game's silhouette widths, on a 640-unit figure.
  const W = {
    thigh: 40, knee: 40, ankle: 30,
    upperArm: 40, elbow: 40, wrist: 32,
    torsoHip: 46, torsoChest: 50, shoulder: 44, neck: 34,
  }

  const cap = (a, b, w1, w2, col) => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const p = w1 / 2
    const q = w2 / 2
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(a[0] + nx * p, a[1] + ny * p)
    ctx.lineTo(b[0] + nx * q, b[1] + ny * q)
    ctx.arc(b[0], b[1], q, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true)
    ctx.lineTo(a[0] - nx * p, a[1] - ny * p)
    ctx.arc(a[0], a[1], p, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true)
    ctx.closePath()
    ctx.fill()
  }

  const fig = (o = {}) => ({
    x: 0, y: 0, facing: 1, hp: 100, action: null, actionFrame: 0,
    blocking: false, stagger: 0, onGround: true, breathing: 0, ...o,
  })

  /** Draw one figure with its soles on `gy`. */
  const draw = (cx, gy, fighter) => {
    const j = P(fighter, { time: 0 })
    const k = j.scale
    ctx.save()
    ctx.translate(cx, gy)
    // Back to front, exactly as the renderer orders it.
    cap(j.hip, j.kneeBack, W.thigh * k, W.knee * k, '#000')
    cap(j.kneeBack, j.footBack, W.knee * k, W.ankle * k, '#000')
    cap(j.shoulderBack, j.elbowBack, W.upperArm * k, W.elbow * k, '#000')
    cap(j.elbowBack, j.handBack, W.elbow * k, W.wrist * k, '#000')
    cap(j.hip, j.chest, W.torsoHip * k, W.torsoChest * k, '#000')
    cap(j.chest, j.neck, W.shoulder * k, W.neck * k, '#000')
    cap(j.neck, j.head, W.neck * k, W.neck * 0.9 * k, '#000')
    cap(j.hip, j.kneeFront, W.thigh * k, W.knee * k, '#000')
    cap(j.kneeFront, j.footFront, W.knee * k, W.ankle * k, '#000')
    cap(j.shoulderFront, j.elbowFront, W.upperArm * k, W.elbow * k, '#000')
    cap(j.elbowFront, j.handFront, W.elbow * k, W.wrist * k, '#000')
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(j.handFront[0], j.handFront[1], W.wrist * 0.62 * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(j.head[0], j.head[1], j.headRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return j
  }

  const cells = []
  const add = (label, f) => cells.push({ label, f })
  add('idle', fig())
  add('block', fig({ blocking: true }))
  add('stagger', fig({ stagger: 10 }))
  add('jump', fig({ onGround: false }))
  // The jab's phases: coil, launch, contact, hold, recover.
  for (const fr of [0, 3, 4, 5, 6, 8, 11, 14]) add(`jab ${fr}`, fig({ action: 'jab', actionFrame: fr }))
  // The kick's: plant, chamber, extend, contact, retract.
  for (const fr of [0, 6, 9, 11, 12, 14, 18, 24]) add(`kick ${fr}`, fig({ action: 'kick', actionFrame: fr }))
  // The finisher: charge, peak, cut, contact, settle.
  for (const fr of [0, 8, 14, 16, 18, 19, 24, 32]) add(`spc ${fr}`, fig({ action: 'special', actionFrame: fr }))
  // The extended vocabulary.
  for (const fr of [0, 4, 7, 8, 10, 14, 20]) add(`hook ${fr}`, fig({ action: 'hook', actionFrame: fr }))
  for (const fr of [0, 6, 9, 11, 13, 18, 24, 36]) add(`sweep ${fr}`, fig({ action: 'sweep', actionFrame: fr }))
  for (const fr of [0, 5, 8, 10, 12, 16, 24, 36]) add(`upper ${fr}`, fig({ action: 'uppercut', actionFrame: fr }))
  for (const fr of [0, 3, 5, 6, 8, 12, 22]) add(`kUp ${fr}`, fig({ action: 'kickUp', actionFrame: fr }))
  for (const fr of [0, 3, 5, 7, 10, 14, 20]) add(`air ${fr}`, fig({ action: 'airKick', actionFrame: fr }))
  // Body states.
  // The three zone reactions, side by side — this is the "被攻击部位不一样，
  // 效果也不一样" contract made visible.
  add('hit · body', fig({ stagger: 10, hitZone: 'body' }))
  add('hit · head', fig({ stagger: 10, hitZone: 'head' }))
  add('hit · legs', fig({ stagger: 10, hitZone: 'legs' }))
  add('downed', fig({ knockdown: 30, prone: true }))
  add('getUp', fig({ knockdown: 10, prone: false }))
  add('juggled', fig({ juggled: true, onGround: false }))
  add('backStep', fig({ backStep: 8 }))
  for (const fr of [20, 30, 40, 48]) add(`spc ${fr}`, fig({ action: 'special', actionFrame: fr }))

  ctx.font = '600 13px "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  for (const [i, cell] of cells.entries()) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const cx = col * CW + CW / 2 + 20
    // Ground line sits 40px above the cell bottom, leaving room for the label.
    const gy = row * CH + CH - 58
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(col * CW + 4, gy)
    ctx.lineTo(col * CW + CW - 4, gy)
    ctx.stroke()
    draw(cx, gy, cell.f)
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillText(cell.label, cx, row * CH + 18)
  }
  return canv.toDataURL('image/png')
})

writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'))
if (errors.length) console.log('page errors:', errors.slice(0, 4))
console.log('wrote', outPath)
await browser.close()
