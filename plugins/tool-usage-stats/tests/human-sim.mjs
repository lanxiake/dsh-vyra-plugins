/**
 * Human-use simulation against the real Web client.
 *
 * Drives the shipped UI the way a person does: pick a workspace, start a
 * session, type a request that forces a tool call, send it, wait for the turn
 * to settle, then open Settings and read the Tool usage panel.
 *
 * Run from the `dsh-Veyra` checkout (it owns the playwright install):
 *
 *   CHROME_PATH=<chromium> node <path>/tests/human-sim.mjs <base-url-with-token>
 *
 * @module vyra-tool-usage-stats/human-sim
 */

const playwright = await import(
  'file:///C:/myself/projects/my/open-source/dsh-Veyra/apps/web/node_modules/playwright/index.mjs'
)
const { chromium } = playwright

const target = process.argv[2]
if (target === undefined) {
  console.error('usage: node tests/human-sim.mjs <http://127.0.0.1:PORT/?token=...>')
  process.exit(2)
}
const origin = new URL(target).origin
const shots = process.env.SHOT_DIR ?? '/tmp'

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: false })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })

/** Collect anything the page reports as an error. */
const problems = []
page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`)
})

const shot = name => page.screenshot({ path: `${shots}/vyra-${name}.png`, fullPage: false })
const text = () => page.locator('body').innerText().catch(() => '')

/** Click the first locator that is present and visible. */
async function clickFirst(candidates) {
  for (const selector of candidates) {
    const locator = page.locator(selector).first()
    if (await locator.count() > 0 && await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 5_000 }).catch(() => {})
      return selector
    }
  }
  return undefined
}

console.log('1. open the client')
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(6_000)
await shot('01-home')

console.log('2. pick a workspace')
const opened = await clickFirst([
  'text=选择工作区',
  'text=选择一个工作区开始',
  '[data-testid*="workspace"]',
])
console.log(`   opened via: ${opened ?? '(nothing matched)'}`)
await page.waitForTimeout(3_000)
await shot('02-workspace-picker')

// The picker may be a directory dialog or a list; take whichever appears.
const picked = await clickFirst([
  'text=我的 open-source',
  'text=open-source',
  'text=dsh-Veyra',
  '[role="option"]',
  'button:has-text("打开")',
  'button:has-text("确定")',
])
console.log(`   picked: ${picked ?? '(nothing matched)'}`)
await page.waitForTimeout(4_000)
await shot('03-workspace-chosen')

console.log('3. start a new session if the composer is not ready')
const composer = page.locator('textarea, [contenteditable="true"]').first()
if (await composer.count() === 0) {
  const started = await clickFirst(['text=新会话', 'text=新建会话', '[aria-label*="ew session"]'])
  console.log(`   started via: ${started ?? '(nothing matched)'}`)
  await page.waitForTimeout(3_000)
}
await shot('04-session')

const ready = await composer.count() > 0 && await composer.isVisible().catch(() => false)
console.log(`   composer ready: ${ready}`)

if (ready) {
  console.log('4. type a request that forces a tool call')
  const request = 'Use the bash tool to run the command `echo vyra-sim-marker` and tell me the exact output.'
  await composer.click()
  await composer.fill(request)
  await page.waitForTimeout(700)
  await shot('05-typed')

  console.log('5. send')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(4_000)
  await shot('06-sent')

  console.log('6. wait for the turn to settle')
  let answeredAt
  for (let waited = 0; waited < 240_000; waited += 6_000) {
    await page.waitForTimeout(6_000)
    const body = await text()
    if (/vyra-sim-marker/.test(body) && !/Send|发送/i.test(body.slice(0, 200))) {
      // The marker appears both in the request and the answer; wait past the
      // echo so the answer is present too.
      if (waited > 12_000) { answeredAt = waited + 6_000; break }
    }
    if (waited % 30_000 === 0) console.log(`   ...${(waited + 6_000) / 1000}s`)
  }
  console.log(`   settled after: ${answeredAt === undefined ? 'TIMEOUT' : `${answeredAt / 1000}s`}`)
  await shot('07-answered')
}

console.log('7. read the plugin endpoint from inside the page')
const endpoint = await page.evaluate(async (base) => {
  const response = await fetch(`${base}/api/vyra/tool-usage`, { credentials: 'include' })
  return { status: response.status, body: await response.text() }
}, origin)
console.log(`   HTTP ${endpoint.status}`)
console.log(`   ${endpoint.body}`)

console.log('8. open Settings and find the Tool usage section')
const settingsOpened = await clickFirst([
  '[aria-label*="设置"]',
  '[title*="设置"]',
  'text=设置',
  '[data-testid*="settings"]',
])
console.log(`   settings via: ${settingsOpened ?? '(nothing matched)'}`)
await page.waitForTimeout(3_500)
await shot('08-settings')

const settingsText = await text()
const hasSection = /tool usage|工具用量/i.test(settingsText)
console.log(`   "Tool usage" section present: ${hasSection}`)

if (hasSection) {
  const clicked = await clickFirst(['text=Tool usage', 'text=工具用量'])
  console.log(`   section clicked via: ${clicked ?? '(nothing matched)'}`)
  await page.waitForTimeout(4_000)
  await shot('09-tool-usage-panel')
  const panel = await text()
  console.log('   panel text:')
  console.log(panel.split('\n').filter(Boolean).slice(0, 40).map(line => `     | ${line}`).join('\n'))
}

console.log('9. page problems')
console.log(problems.length === 0 ? '   (none)' : [...new Set(problems)].slice(0, 10).map(p => `   ${p}`).join('\n'))

await page.waitForTimeout(1_000)
await browser.close()
console.log(`screenshots in ${shots}`)
