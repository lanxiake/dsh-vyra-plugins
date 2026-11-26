/**
 * Screenshot the real plugin (client.js over the fake shell) and report the
 * state as NUMBERS, so a screenshot can be checked rather than admired.
 * Usage: node scripts/shoot.mjs [outDir]
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

const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'shots')
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.route('http://dsh-boot.test/', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SHELL_HTML }))
await page.route('**/plugins/dsh-boot-duel/config', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, difficulty: 'easy' }),
}))
await page.route('**/plugins/dsh-boot-duel/sfx/*', (route) => route.fulfill({ status: 404, body: '' }))
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
  const entry = window.__dshBoot.registrations[0]
  window.ReactDOM.createRoot(document.querySelector('[data-shell-overlay]')).render(window.React.createElement(entry.component))
})

const shot = async (name) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) })
  console.log('shot', name)
}
await page.waitForSelector('.boot-duel-layer', { timeout: 10000 })
await page.waitForTimeout(1400)
await shot('01-ready')

await page.keyboard.press('Enter')
await page.waitForTimeout(1000)
await shot('02-idle')

// Close in and trade.
await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d')
await page.waitForTimeout(150)
await shot('03-closed')

for (const [key, name] of [['j', '04-jab'], ['h', '05-hook'], ['k', '06-kick'], ['f', '07-upper'], ['g', '08-sweep']]) {
  await page.keyboard.press(key)
  await page.waitForTimeout(170)
  await shot(name)
  await page.waitForTimeout(900)
  await page.keyboard.down('d'); await page.waitForTimeout(200); await page.keyboard.up('d')
  await page.waitForTimeout(120)
}

// Retreat: hold S.
await page.keyboard.press('s')
await page.waitForTimeout(200)
await shot('09-retreat')

await page.waitForTimeout(1500)
await shot('10-later')

console.log('errors', JSON.stringify(errors.slice(0, 6)))
await browser.close()
