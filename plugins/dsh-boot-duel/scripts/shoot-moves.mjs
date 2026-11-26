/**
 * Frame-accurate captures of individual moves.
 *
 * `shoot.mjs` drives the whole round with human-ish delays, which is right for
 * judging the look of the fight but useless for judging a MOVE: a jab is nine
 * frames long, and a 200ms wait lands after it. This script presses one key
 * and screenshots every few display frames, so each move is caught mid-action.
 *
 * Usage: node scripts/shoot-moves.mjs [outDir]
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const clientSource = readFileSync(path.join(root, 'client.js'), 'utf8')
const REACT = process.env.DSH_E2E_REACT || 'C:/Users/75791/AppData/Local/Temp/dsh-boot-duel-react.js'
const reactSource = readFileSync(REACT, 'utf8')
const CHROME = 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'

const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'moves')
mkdirSync(outDir, { recursive: true })

const SHELL_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>shell</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  .frame { height: 100vh; position: relative; overflow: hidden; }
  .app { display: grid; grid-template-columns: 260px 1fr; height: 100%; }
  .sidebar { background: #111; }
  .chat { background: #fff; }
  .overlay-layer { position: absolute; inset: 0; z-index: 20; pointer-events: none; }
  .overlay-layer > * { pointer-events: auto; }
</style></head>
<body>
  <div class="frame" data-shell-frame>
    <div class="app"><div class="sidebar"></div><div class="chat" id="chat"></div></div>
    <div class="overlay-layer" data-shell-overlay></div>
  </div>
<script>
  window.__dshBoot = { factories: new Map(), registrations: [] }
  window.__ModuleLoader__ = { load: (r) => window.__dshBoot.factories.set(r.id, r.factory) }
</script>
</body></html>`

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.route('http://dsh-boot.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SHELL_HTML }))
await page.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, difficulty: 'easy' }),
}))
await page.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
await page.goto('http://dsh-boot.test/', { waitUntil: 'domcontentloaded' })
await page.addScriptTag({ content: reactSource })
await page.addScriptTag({ content: clientSource })
await page.evaluate(() => {
  const factory = window.__dshBoot.factories.get('dsh-boot-duel')
  const exports = factory((spec) => (spec === 'react' ? window.React : window.ReactDOM))
  const locale = { getLocale: () => ({ active: 'zh-CN', revision: 1 }), bind: () => (k) => k, subscribe: () => () => {} }
  exports.apply({
    get: (n) => (n === 'locale' ? locale : undefined),
    effect: (fn) => fn(),
    slots: { inject: (_n, cb) => cb(), register: (reg, component) => { window.__dshBoot.registrations.push({ reg, component }); return () => {} } },
  })
  const entry = window.__dshBoot.registrations.find((e) => e.reg.name === 'shell.overlay') ?? window.__dshBoot.registrations[0]
  window.ReactDOM.createRoot(document.querySelector('[data-shell-overlay]')).render(window.React.createElement(entry.component))
})

await page.waitForSelector('.boot-duel-layer')
await page.waitForTimeout(1200)
await page.keyboard.press('Enter')
await page.waitForTimeout(900)

/** Close the distance so every move is in range. */
async function closeIn() {
  await page.keyboard.down('d')
  await page.waitForTimeout(650)
  await page.keyboard.up('d')
  await page.waitForTimeout(120)
}

/**
 * Press `key` and capture `count` frames spaced by one display frame, so the
 * whole arc of the move is on file.
 */
async function captureMove(name, key, count = 10) {
  await page.keyboard.press(key)
  for (let i = 0; i < count; i++) {
    await page.screenshot({ path: path.join(outDir, `${name}-${String(i).padStart(2, '0')}.png`) })
    // One animation frame: the game steps at 60Hz, the browser at ~60Hz.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
  }
  await page.waitForTimeout(700)
}

for (const [name, key] of [
  ['jab', 'j'], ['hook', 'h'], ['kick', 'k'], ['sweep', 'g'],
  ['uppercut', 'f'], ['retreat', 's'], ['block', 'l'],
]) {
  await closeIn()
  await captureMove(name, key, key === 'l' ? 6 : 12)
}

console.log('captured', errors.length ? `with ${errors.length} page errors` : 'clean')
await browser.close()
