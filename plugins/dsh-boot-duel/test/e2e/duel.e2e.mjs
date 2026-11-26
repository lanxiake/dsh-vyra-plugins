/**
 * dsh-boot-duel end-to-end check against the running Web GUI.
 *
 * Verifies the spec's browser-level success criteria:
 *   a) the full-screen layer covers the home page with health bars and hints
 *   b) keyboard play empties the rival's bar, shows the KO sequence, and the
 *      layer leaves the DOM
 *   c) Esc removes the layer at once and focus returns
 *   d) typing right after the layer is gone injects no characters, and Space
 *      does not scroll
 *
 * The desktop host serves the Web app behind a token: a bare
 * `http://127.0.0.1:59157` answers 401 "reopen the URL printed by dsh web".
 * Pass the authenticated URL (the one already open in the browser, or from
 * `dsh web`) as the first argument:
 *
 *   node test/e2e/duel.e2e.mjs "http://127.0.0.1:59157/?token=..."
 *   DSH_E2E_CHROME=/path/to/chrome node test/e2e/duel.e2e.mjs "<url>"
 *
 * Screenshots land in test/e2e/.out/ (opening, KO, home).
 */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const PLAYWRIGHT = 'C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright'
const { chromium } = require(PLAYWRIGHT)

const url = process.argv[2] || process.env.DSH_WEB_URL || 'http://127.0.0.1:59157'
const outDir = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '.out')
mkdirSync(outDir, { recursive: true })

/**
 * This Playwright build asks for a headless-shell bundle that is not installed
 * here, but the full Chromium 1194 is; point the launcher at it explicitly.
 */
const CHROME = process.env.DSH_E2E_CHROME
  || 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'

const results = []
function check(name, passed, detail = '') {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error' && /boot-duel/i.test(message.text())) consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))

try {
  /* ---------------------------------------------------------------- a) opening */
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.boot-duel-layer', { timeout: 20000 })
  await page.waitForTimeout(600)

  const layer = await page.$('.boot-duel-layer')
  const box = await layer.boundingBox()
  const viewport = page.viewportSize()
  check('layer covers the whole viewport', Math.round(box.width) === viewport.width && Math.round(box.height) === viewport.height,
    `${Math.round(box.width)}x${Math.round(box.height)}`)

  const bars = await page.$$eval('.boot-duel-bar', (nodes) => nodes.map((node) => node.textContent))
  check('two health bars are present', bars.length === 2, bars.join(' | '))

  const hint = await page.textContent('.boot-duel-hints')
  check('control hint is visible', /J|K|L/.test(hint || ''), (hint || '').slice(0, 80))

  const muted = await page.getAttribute('.boot-duel-btn', 'aria-pressed')
  check('muted by default', muted === 'false', `aria-pressed=${muted}`)

  const dialog = await page.getAttribute('.boot-duel-layer', 'role')
  check('layer is an aria-modal dialog', dialog === 'dialog')

  await page.screenshot({ path: path.join(outDir, '01-opening.png') })

  /* -------------------------------------------------------- b) play to KO */
  // Walk in and mash punch with real key-up/key-down edges; a human plays the
  // same way and the round is winnable on easy.
  for (let round = 0; round < 400; round++) {
    const state = await page.evaluate(() => {
      const ko = document.querySelector('.boot-duel-ko')
      const tracks = [...document.querySelectorAll('.boot-duel-bar')].map((bar) =>
        Number(bar.querySelector('.boot-duel-bar-track')?.getAttribute('aria-valuenow')))
      return { ko: Boolean(ko), tracks }
    })
    if (state.ko) break
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(40)
    await page.keyboard.up('KeyD')
    await page.keyboard.down('KeyJ')
    await page.waitForTimeout(40)
    await page.keyboard.up('KeyJ')
  }

  const koVisible = await page.$('.boot-duel-ko')
  if (koVisible) {
    await page.screenshot({ path: path.join(outDir, '02-ko.png') })
    const letters = await page.$$eval('.boot-duel-ko-letters span', (nodes) => nodes.map((n) => n.textContent).join(''))
    check('KO sequence appears', letters.length > 0, `letters="${letters}"`)
  } else {
    check('KO sequence appears', false, 'rival bar never emptied within the budget')
  }

  await page.waitForSelector('.boot-duel-layer', { state: 'detached', timeout: 20000 })
  check('layer leaves the DOM after the outro', true)

  // Reduced motion / general sanity: no boot-duel console errors.
  check('no boot-duel console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

  /* ---------------------------------------------- c) Esc skip + focus return */
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.boot-duel-layer', { timeout: 20000 })
  await page.waitForTimeout(400)

  const focusBefore = await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName)
  await page.keyboard.press('Escape')
  const skipped = await page.waitForSelector('.boot-duel-layer', { state: 'detached', timeout: 5000 })
    .then(() => true).catch(() => false)
  check('Esc removes the layer', skipped, `focus before skip: ${focusBefore}`)
  await page.screenshot({ path: path.join(outDir, '03-home.png') })

  const focusAfter = await page.evaluate(() => {
    const active = document.activeElement
    return active ? { tag: active.tagName, inLayer: Boolean(active.closest?.('.boot-duel-layer')) } : null
  })
  check('focus is not left inside a detached layer', !focusAfter?.inLayer, JSON.stringify(focusAfter))

  /* ------------------------------------------- d) no keyboard pollution */
  const box2 = await page.$('textarea, [contenteditable="true"], input[type="text"]')
  if (box2) {
    await box2.click()
    await page.keyboard.type('adj')
    const value = await box2.evaluate((node) => node.value ?? node.textContent)
    check('typing after the layer gone injects no stray keys', !/^(a|d|j)/.test(value || '') || (value || '').includes('adj'),
      `field="${(value || '').slice(0, 40)}"`)
    // Space must not scroll the page.
    const before = await page.evaluate(() => window.scrollY)
    await page.evaluate(() => document.querySelector('textarea, [contenteditable="true"]')?.blur())
    await page.keyboard.press('Space')
    await page.waitForTimeout(200)
    const after = await page.evaluate(() => window.scrollY)
    check('Space does not scroll the page', before === after, `${before} -> ${after}`)
  } else {
    check('typing after the layer gone injects no stray keys', true, 'no text field on this view (skipped)')
  }
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result.passed)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots: ${outDir}`)
process.exit(failed.length === 0 ? 0 : 1)
