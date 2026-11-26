/**
 * The settings section must be in the user's language.
 *
 * Two cases, both through the real bundle:
 *   1. **No locale service at all.** This is the host that produced "Clock In"
 *      over Chinese key names. The section must be fully Chinese.
 *   2. **A locale service that says `en`.** Then — and only then — the section
 *      is English, and the key names are English with it.
 *
 * The old default was English-on-unknown, which is why a Chinese plugin showed
 * an English heading beside hardcoded Chinese bind labels.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules/playwright')
const root = 'C:/myself/projects/my/open-source/dsh-vyra-plugins/plugins/dsh-boot-duel'
const client = readFileSync(root + '/client.js', 'utf8')
const react = readFileSync('C:/Users/75791/AppData/Local/Temp/dsh-boot-duel-react.js', 'utf8')

const SHELL = `<!doctype html><html lang="zh-CN"><body><div id="host"></div>
<script>window.__dshBoot={factories:new Map(),registrations:[]};
window.__ModuleLoader__={load:(r)=>window.__dshBoot.factories.set(r.id,r.factory)}</script></body></html>`

let fail = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) fail++
}
const hasHan = (s) => /[\u4e00-\u9fff]/.test(s)

const b = await chromium.launch({ headless: true, executablePath: 'C:/Users/75791/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' })

async function renderSection({ locale }) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.route('http://st.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: SHELL }))
  await p.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":true,"difficulty":"easy"}' }))
  await p.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
  await p.goto('http://st.test/', { waitUntil: 'domcontentloaded' })
  await p.addScriptTag({ content: react })
  await p.addScriptTag({ content: client })
  await p.evaluate((localeSpec) => {
    const f = window.__dshBoot.factories.get('dsh-boot-duel')
    const ex = f((s) => (s === 'react' ? window.React : window.ReactDOM))
    window.__ex = ex
    let section = null
    const locale = localeSpec === null ? undefined : {
      getLocale: () => ({ active: localeSpec, revision: 1 }),
      bind: () => (k) => k,
      subscribe: () => () => {},
    }
    ex.apply({
      get: (n) => (n === 'locale' ? locale : undefined),
      effect: (fn) => fn(),
      slots: {
        inject: (_, cb) => cb(),
        register: (r, c) => { if (r.name === 'settings.section') section = c; return () => {} },
      },
    })
    window.ReactDOM.createRoot(document.getElementById('host'))
      .render(window.React.createElement(section))
  }, locale)
  await p.waitForSelector('.boot-duel-host-section')
  const text = await p.locator('.boot-duel-host-section').innerText()
  const labels = await p.locator('.boot-duel-host-bind-label').allInnerTexts()
  const keys = await p.locator('.boot-duel-host-binds .boot-duel-set-bind').allInnerTexts()
  await p.close()
  return { text, labels, keys, errs }
}

// ---- 1. no locale service: fully Chinese --------------------------------
{
  const { text, labels, keys, errs } = await renderSection({ locale: null })
  check(errs.length === 0, 'no page errors without a locale service', JSON.stringify(errs.slice(0, 2)))
  check(text.includes('开工大吉'), 'the heading is 开工大吉, not "Clock In"', JSON.stringify(text.split('\n')[0]))
  check(!/Clock In|Key bindings|Reset keys|Show the opening/i.test(text), 'no English UI copy leaks in')
  check(labels.length === 13, 'all 13 binds are listed', String(labels.length))
  check(labels.every(hasHan), 'every bind label is Chinese', JSON.stringify(labels))
  check(keys.includes('空格'), 'Space is shown as 空格', JSON.stringify(keys))
  check(keys.includes('左Shift'), 'Shift is shown as 左Shift', JSON.stringify(keys))
  check(keys.includes('A') && keys.includes('J'), 'letter keys stay their own letter')
}

// ---- 2. the host says English ------------------------------------------
{
  const { text, labels, keys, errs } = await renderSection({ locale: 'en-US' })
  check(errs.length === 0, 'no page errors with an English host', JSON.stringify(errs.slice(0, 2)))
  check(/Clock In/.test(text), 'the heading follows the host language')
  check(!hasHan(text), 'an English host gets no Chinese copy at all', JSON.stringify(text.slice(0, 120)))
  check(labels.length === 13, 'all 13 binds are listed in English', String(labels.length))
  check(keys.includes('Space') && keys.includes('L-Shift'), 'keys are named in English too', JSON.stringify(keys))
}

// ---- 3. a language switch repaints an already-mounted section ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.route('http://st.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: SHELL }))
  await p.route('**/plugins/dsh-boot-duel/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await p.route('**/plugins/dsh-boot-duel/sfx/*', (r) => r.fulfill({ status: 404, body: '' }))
  await p.goto('http://st.test/', { waitUntil: 'domcontentloaded' })
  await p.addScriptTag({ content: react })
  await p.addScriptTag({ content: client })
  await p.evaluate(() => {
    const f = window.__dshBoot.factories.get('dsh-boot-duel')
    const ex = f((s) => (s === 'react' ? window.React : window.ReactDOM))
    let active = 'zh-CN'
    const subs = []
    let section = null
    window.__switchTo = (next) => { active = next; for (const s of subs) s() }
    const locale = {
      getLocale: () => ({ active, revision: 1 }),
      bind: () => (k) => k,
      subscribe: (fn) => { subs.push(fn); return () => {} },
    }
    ex.apply({
      get: (n) => (n === 'locale' ? locale : undefined),
      effect: (fn) => fn(),
      slots: { inject: (_, cb) => cb(), register: (r, c) => { if (r.name === 'settings.section') section = c; return () => {} } },
    })
    window.ReactDOM.createRoot(document.getElementById('host')).render(window.React.createElement(section))
  })
  await p.waitForSelector('.boot-duel-host-section')
  const before = await p.locator('.boot-duel-host-section').innerText()
  check(before.includes('开工大吉'), 'starts in Chinese')
  await p.evaluate(() => window.__switchTo('en'))
  await p.waitForTimeout(150)
  const after = await p.locator('.boot-duel-host-section').innerText()
  check(after.includes('Clock In'), 'a live switch to English repaints the section')
  check(!/[\u4e00-\u9fff]/.test(after), 'and leaves no Chinese behind', JSON.stringify(after.slice(0, 100)))
  await p.evaluate(() => window.__switchTo('zh-CN'))
  await p.waitForTimeout(150)
  const back = await p.locator('.boot-duel-host-section').innerText()
  check(back.includes('开工大吉'), 'switching back to Chinese repaints too')
  check(errs.length === 0, 'no page errors during switching', JSON.stringify(errs.slice(0, 2)))
  await p.close()
}

console.log('\n' + (fail === 0 ? 'LOCALE OK' : `${fail} FAILED`))
await b.close()
process.exit(fail ? 1 : 0)
