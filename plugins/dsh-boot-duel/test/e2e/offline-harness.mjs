/**
 * dsh-boot-duel — offline browser harness.
 *
 * Boots the built `client.js` inside headless Chromium against a page that
 * mirrors the host shell: a `#root` app area, a pointer-events:none
 * `[data-shell-overlay]` seat inside the frame, and a chat list underneath.
 *
 * This is where the reported bug is reproduced and proven fixed:
 *
 *   - before the fix the bundle threw `styles is not defined`, so the layer
 *     had no CSS: `position: fixed` never applied, the canvas band sat above
 *     the untouched chat list, and keyboard listeners (bound only to the
 *     layer's focus container) never fired;
 *   - now the layer must cover the whole viewport, game keys must reach the
 *     fight without clicking first, and Esc must always detach the layer.
 *
 * Usage: node test/e2e/offline-harness.mjs
 *   Requires a React browser bundle; set DSH_E2E_REACT to the IIFE file that
 *   assigns window.React and window.ReactDOM (see scripts/build-react-bundle.mjs).
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const PLAYWRIGHT = 'C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright'
const { chromium } = require(PLAYWRIGHT)

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const clientSource = readFileSync(path.join(root, 'client.js'), 'utf8')
const outDir = path.join(here, '.out')
mkdirSync(outDir, { recursive: true })

const CHROME = process.env.DSH_E2E_CHROME
  || 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'
const REACT_BUNDLE = process.env.DSH_E2E_REACT
const CONFIG_PATH = '**/plugins/dsh-boot-duel/config'

if (!REACT_BUNDLE) {
  console.error('set DSH_E2E_REACT to a React/ReactDOM IIFE bundle (see scripts/build-react-bundle.mjs)')
  process.exit(2)
}
const reactSource = readFileSync(REACT_BUNDLE, 'utf8')

const results = []
function check(name, passed, detail = '') {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** The shell the host actually renders, reduced to what the layer depends on. */
const SHELL_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>shell</title>
<style>
  html, body { margin: 0; height: 100%; }
  .frame { height: 100vh; position: relative; overflow: hidden; }
  .app { display: grid; grid-template-columns: 260px 1fr; height: 100%; }
  .sidebar { background: #111; color: #ccc; overflow: auto; }
  .chat { background: #fff; overflow: auto; padding: 16px; }
  .chat .row { height: 64px; border-bottom: 1px solid #eee; }
  .overlay-layer { position: absolute; inset: 0; z-index: 20; pointer-events: none; }
  .overlay-layer > * { pointer-events: auto; }
</style></head>
<body>
  <div class="frame" data-shell-frame>
    <div class="app">
      <div class="sidebar">sidebar</div>
      <div class="chat" id="chat">
        ${'<div class="row">message</div>'.repeat(40)}
        <textarea id="composer" placeholder="composer"></textarea>
      </div>
    </div>
    <div class="overlay-layer" data-shell-overlay></div>
  </div>
<script>
  // Minimal host surface: __ModuleLoader__ only. host and styles are
  // deliberately absent, exactly as for a real bundle client.
  window.__dshBoot = { factories: new Map(), registrations: [] }
  window.__ModuleLoader__ = {
    load: (registration) => window.__dshBoot.factories.set(registration.id, registration.factory),
  }
</script>
</body></html>`

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error' && /boot-duel/i.test(message.text())) consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))

/** Boot the bundle and let the host mount the registered overlay component. */
async function boot({ activeLocale = 'zh-CN' } = {}) {
  // A real http origin, so the package route resolves the way it does on the
  // host (a relative fetch from about:blank is not representative).
  await page.route('http://dsh-boot.test/', (route) => route.fulfill({
    status: 200, contentType: 'text/html; charset=utf-8', body: SHELL_HTML,
  }))
  await page.route(CONFIG_PATH, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ enabled: true, difficulty: 'easy' }),
  }))
  await page.goto('http://dsh-boot.test/', { waitUntil: 'domcontentloaded' })
  await page.addScriptTag({ content: reactSource })
  await page.addScriptTag({ content: clientSource })
  return page.evaluate((localeId) => {
    const { factories } = window.__dshBoot
    const factory = factories.get('dsh-boot-duel')
    if (!factory) return { ok: false, reason: 'bundle did not register' }
    let exports
    try {
      exports = factory((spec) => {
        if (spec === 'react') return window.React
        if (spec === 'react-dom') return window.ReactDOM
        throw new Error(`unexpected require(${spec})`)
      })
    } catch (error) {
      return { ok: false, reason: `factory threw: ${error.message}` }
    }
    const locale = {
      getLocale: () => ({ active: localeId, revision: 1 }),
      bind: () => (key) => key,
      subscribe: () => () => {},
    }
    let applyError = null
    try {
      exports.apply({
        get: (name) => (name === 'locale' ? locale : undefined),
        effect: (fn) => { const off = fn(); return typeof off === 'function' ? off : () => {} },
        slots: {
          inject: (_name, callback) => callback(),
          register: (registration, component) => {
            window.__dshBoot.registrations.push({ registration, component })
            return () => {}
          },
        },
      })
    } catch (error) {
      applyError = error.message
    }
    const entry = window.__dshBoot.registrations.find((e) => e.reg.name === 'shell.overlay') ?? window.__dshBoot.registrations[0]
    if (!entry) return { ok: false, reason: applyError || 'no overlay registered' }
    const seat = document.querySelector('[data-shell-overlay]')
    window.ReactDOM.createRoot(seat).render(window.React.createElement(entry.component))
    return { ok: true, applyError }
  }, activeLocale)
}

try {
  const booted = await boot()
  check('bundle boots and registers its overlay', booted.ok, booted.reason || '')
  await page.waitForSelector('.boot-duel-layer', { timeout: 8000 })
  await page.waitForTimeout(600)

  /* ---------------------------------------------------- a) real coverage */
  const geometry = await page.evaluate(() => {
    const layer = document.querySelector('.boot-duel-layer')
    const rect = layer.getBoundingClientRect()
    const style = getComputedStyle(layer)
    return {
      rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
      position: style.position,
      zIndex: style.zIndex,
      viewport: { width: innerWidth, height: innerHeight },
      hasStyleTag: Boolean(document.getElementById('dsh-boot-duel-style')),
      styleOwner: document.getElementById('dsh-boot-duel-style')?.getAttribute('data-plugin') ?? null,
      chatVisibleHeight: document.getElementById('chat').getBoundingClientRect().height,
    }
  })
  check('layer stylesheet was injected by the client itself', geometry.hasStyleTag)
  check('the sheet is tagged with the package id', geometry.styleOwner === 'dsh-boot-duel', String(geometry.styleOwner))
  check('layer is position: fixed', geometry.position === 'fixed', geometry.position)
  check('layer covers the whole viewport',
    geometry.rect.width === geometry.viewport.width && geometry.rect.height === geometry.viewport.height,
    `${geometry.rect.width}x${geometry.rect.height} vs ${geometry.viewport.width}x${geometry.viewport.height}`)
  check('layer starts at the frame origin (no band above the chat)',
    geometry.rect.top === 0 && geometry.rect.left === 0, JSON.stringify(geometry.rect))
  check('the chat list is fully behind the layer, not beside it',
    geometry.chatVisibleHeight <= geometry.viewport.height, `${geometry.chatVisibleHeight}px`)

  const hud = await page.evaluate(() => ({
    bars: document.querySelectorAll('.boot-duel-bar').length,
    hint: document.querySelector('.boot-duel-hints')?.textContent ?? '',
    skip: document.querySelector('.boot-duel-skip')?.textContent ?? '',
    overlayPointerEvents: getComputedStyle(document.querySelector('[data-shell-overlay]')).pointerEvents,
  }))
  check('two health bars render', hud.bars === 2, `${hud.bars}`)
  check('control hint renders', /J|K|L/.test(hud.hint), hud.hint.slice(0, 40))
  check('a visible Skip button renders', Boolean(hud.skip), hud.skip)

  /* ------------------------------------------- a2) the Enter gate */
  const gate = await page.evaluate(() => ({
    present: Boolean(document.querySelector('.boot-duel-gate')),
    phase: document.querySelector('.boot-duel-layer')?.getAttribute('data-phase'),
    call: document.querySelector('.boot-duel-gate-call')?.textContent ?? '',
    title: document.querySelector('.boot-duel-gate-main')?.textContent ?? '',
    state: document.querySelector('.boot-duel-mid-state')?.textContent ?? '',
  }))
  check('the opening stance shows a start gate', gate.present, gate.phase)
  check('the gate carries a Chinese title', /[一-鿿]/.test(gate.title), gate.title)
  check('the gate asks for Enter', /Enter/.test(gate.call), gate.call)
  check('the layer is in the ready phase', gate.phase === 'ready', String(gate.phase))
  check('the HUD state reads 蓄势', gate.state === '蓄势', gate.state)

  await page.screenshot({ path: path.join(outDir, 'offline-opening.png') })

  // Ten seconds of doing nothing must not cost a single point of health:
  // the opponent is not allowed to open the fight on the player's behalf.
  const idleHp = await page.evaluate(() =>
    [...document.querySelectorAll('.boot-duel-bar')].map((bar) =>
      Number(bar.querySelector('[aria-valuenow]').getAttribute('aria-valuenow'))))
  await page.waitForTimeout(2500)
  const stillIdle = await page.evaluate(() =>
    [...document.querySelectorAll('.boot-duel-bar')].map((bar) =>
      Number(bar.querySelector('[aria-valuenow]').getAttribute('aria-valuenow'))))
  check('nobody is punched before the player begins',
    JSON.stringify(stillIdle) === JSON.stringify(idleHp), `${idleHp} -> ${stillIdle}`)

  /* ------------------------------------ b) Enter starts; keys reach the fight */
  await page.keyboard.press('Enter')
  await page.waitForTimeout(120)
  const afterEnter = await page.evaluate(() => ({
    phase: document.querySelector('.boot-duel-layer')?.getAttribute('data-phase'),
    gate: Boolean(document.querySelector('.boot-duel-gate')),
    state: document.querySelector('.boot-duel-mid-state')?.textContent ?? '',
  }))
  check('Enter begins the fight', afterEnter.phase === 'playing', String(afterEnter.phase))
  check('the gate is dismissed on begin', afterEnter.gate === false)
  check('the HUD state reads 对决', afterEnter.state === '对决', afterEnter.state)

  const hpBefore = await page.evaluate(() =>
    Number(document.querySelectorAll('.boot-duel-bar')[1].querySelector('[aria-valuenow]').getAttribute('aria-valuenow')))
  let koShown = false
  let layerGone = false
  let hpAfter = hpBefore
  for (let round = 0; round < 400; round++) {
    const state = await page.evaluate(() => {
      const layer = document.querySelector('.boot-duel-layer')
      const bars = [...document.querySelectorAll('.boot-duel-bar')]
      return {
        ko: Boolean(document.querySelector('.boot-duel-ko')),
        gone: layer === null,
        hp: bars.length > 1 ? Number(bars[1].querySelector('[aria-valuenow]').getAttribute('aria-valuenow')) : 0,
      }
    })
    hpAfter = state.hp
    if (state.ko && !koShown) {
      koShown = true
      // The KO seal only lives for the outro; capture it before it leaves.
      await page.screenshot({ path: path.join(outDir, 'offline-knockout.png') })
    }
    if (state.gone) { layerGone = true; break }
    if (state.ko) { await page.waitForTimeout(120); continue }
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(30)
    await page.keyboard.up('KeyD')
    await page.keyboard.down('KeyJ')
    await page.waitForTimeout(40)
    await page.keyboard.up('KeyJ')
  }
  check('keyboard play lands damage without clicking first', hpAfter < hpBefore, `${hpBefore} -> ${hpAfter}`)
  check('KO sequence appears', koShown)
  const goneAfterKo = layerGone
    || await page.waitForSelector('.boot-duel-layer', { state: 'detached', timeout: 20000 })
      .then(() => true).catch(() => false)
  check('layer leaves the DOM after the KO outro', goneAfterKo)

  /* ------------------------------------------- c) Esc from outside focus */
  await boot()
  await page.waitForSelector('.boot-duel-layer', { timeout: 8000 })
  await page.waitForTimeout(400)
  await page.evaluate(() => document.getElementById('composer')?.focus())
  await page.keyboard.press('Escape')
  const escDetached = await page.waitForSelector('.boot-duel-layer', { state: 'detached', timeout: 5000 })
    .then(() => true).catch(() => false)
  check('Esc leaves even when focus wandered to the app beneath', escDetached)

  /* ------------------------------------------------ d) Esc double press */
  await boot()
  await page.waitForSelector('.boot-duel-layer', { timeout: 8000 })
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  const doubleDetached = await page.waitForSelector('.boot-duel-layer', { state: 'detached', timeout: 5000 })
    .then(() => true).catch(() => false)
  check('double Esc detaches without throwing', doubleDetached)

  /* ---------------------------------------- e) Skip button, no keyboard */
  await boot()
  await page.waitForSelector('.boot-duel-skip', { timeout: 8000 })
  await page.click('.boot-duel-skip')
  const skipped = await page.waitForSelector('.boot-duel-layer', { state: 'detached', timeout: 5000 })
    .then(() => true).catch(() => false)
  check('the Skip button alone exits', skipped)
  await page.screenshot({ path: path.join(outDir, 'offline-home.png') })

  /* ------------------------------------------ f) no typing interference */
  await page.evaluate(() => document.getElementById('composer')?.focus())
  await page.keyboard.type('adj')
  const typed = await page.evaluate(() => document.getElementById('composer').value)
  check('typing lands in the composer untouched', typed === 'adj', `value="${typed}"`)

  check('no boot-duel console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result.passed)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots: ${outDir}`)
process.exit(failed.length === 0 ? 0 : 1)
