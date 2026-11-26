/**
 * Screenshot the standalone preview: boot it in headless Chromium over a local
 * static server, press a sequence of keys, and capture the fight.
 * Usage: node scripts/shoot-preview.mjs [outDir]
 */
import { createRequire } from 'node:module'
import { mkdirSync, createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const outDir = process.argv[2] || path.join(root, 'test', 'e2e', 'preview')
mkdirSync(outDir, { recursive: true })

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }
const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0])
  const file = path.join(root, rel === '/' ? 'preview.html' : rel)
  try {
    const st = statSync(file)
    if (!st.isFile()) throw new Error('not a file')
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404); res.end('not found')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const CHROME = 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(`http://127.0.0.1:${port}/preview.html`, { waitUntil: 'load' })
await page.waitForTimeout(600)
const shot = async (n) => { await page.screenshot({ path: path.join(outDir, `${n}.png`) }); console.log('shot', n) }

await shot('01-ready')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
await shot('02-fight')

// close in, then throw a string of moves, capturing each
await page.keyboard.down('d'); await page.waitForTimeout(600); await page.keyboard.up('d')
await page.waitForTimeout(150)

for (const [key, name] of [['j', '03-jab'], ['k', '04-punch2'], ['l', '05-kick'], ['i', '06-upper'], ['u', '07-sweep']]) {
  await page.keyboard.press(key)
  await page.waitForTimeout(160)
  await shot(name)
  await page.waitForTimeout(900)
  await page.keyboard.down('d'); await page.waitForTimeout(220); await page.keyboard.up('d')
  await page.waitForTimeout(100)
}

// the state as numbers, so the shot can be checked, not just looked at
const state = await page.evaluate(() => {
  const a = window.__duel.arena
  return {
    phase: a.phase,
    playerHp: a.player.hp,
    enemyHp: a.enemy.hp,
    enemyState: a.enemy.state,
    particles: a.particles.length,
  }
})
console.log('state', JSON.stringify(state))
await page.waitForTimeout(1200)
await shot('08-later')

console.log('errors', JSON.stringify(errors.slice(0, 5)))
await browser.close()
server.close()
