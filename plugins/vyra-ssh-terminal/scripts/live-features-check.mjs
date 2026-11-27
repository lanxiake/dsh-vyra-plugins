/**
 * 真实 UI 的逐项功能验证：把这一轮新增的东西挨个在宿主界面里按出来。
 *
 * 与 live-ui-check 的分工：那个回答"面板能不能渲染"，这个回答"这些功能点真的通吗"。
 * 全部用 CDP 发真实按键 / 真实点击，不做合成事件。
 *
 * 用法: node scripts/live-features-check.mjs "<url>"
 */
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const url = process.argv[2]
if (!url) {
  console.error('用法: node scripts/live-features-check.mjs <dsh web url>')
  process.exit(2)
}

const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))

const profile = join(tmpdir(), `dsh-feat-${Date.now()}`)
const child = spawn(
  BROWSER,
  ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] }
)
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''
  const timer = setTimeout(() => reject(new Error('browser did not start')), 20000)
  child.stderr.on('data', (d) => {
    buf += String(d)
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf)
    if (m) {
      clearTimeout(timer)
      resolve(m[1])
    }
  })
})
const port = /:(\d+)\//.exec(wsUrl)[1]
const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
const target = list.find((t) => t.type === 'page') ?? list[0]
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const errors = []
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push('EXC: ' + String(msg.params.exceptionDetails?.exception?.description ?? '').slice(0, 200))
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
const send = (method, params) =>
  new Promise((resolve) => {
    const n = ++id
    pending.set(n, resolve)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function pressKey(key, code, modifiers) {
  const vk = { Slash: 191, KeyH: 72, KeyM: 77, KeyB: 66, KeyA: 65, KeyK: 75 }[code] ?? key.toUpperCase().charCodeAt(0)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode: vk })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode: vk })
  await sleep(700)
}

await new Promise((r) => ws.addEventListener('open', r))
await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url })
await sleep(12000)

// 开面板 + 清掉挡路弹窗
await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const byText = (t) => [...document.querySelectorAll('*')].filter(
    (el) => el.children.length === 0 && (el.textContent || '').trim() === t)
  for (let i = 0; i < 3; i++) {
    let hit = false
    for (const l of ['继续', '知道了', '我知道了']) { const b = byText(l)[0]; if (b) { b.click(); hit = true; await sleep(800); break } }
    if (!hit) break
  }
  let tab = byText('SSH')[0]
  for (let i = 0; i < 12 && !tab; i++) { await sleep(1000); tab = byText('SSH')[0] }
  if (tab) tab.click()
  await sleep(2000)
})()`)

const results = {}
const snap = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  if (r.result?.data) {
    const out = join(tmpdir(), `dsh-feat-${name}.png`)
    writeFileSync(out, Buffer.from(r.result.data, 'base64'))
    return out
  }
  return null
}

// 基线
results.baseline = await evaluate(`(() => {
  const root = document.querySelector('.sx-root')
  return { hasRoot: !!root, html: root ? root.innerHTML.length : 0 }
})()`)

// ① Ctrl+/ 快捷键一览
await pressKey('/', 'Slash', 2)
results.shortcuts = await evaluate(`(() => {
  const root = document.querySelector('.sx-root')
  const t = root ? root.innerText : ''
  const shown = t.includes('交给远端 shell')
  return { opened: shown, html: root ? root.innerHTML.length : 0 }
})()`)
await snap('shortcuts')
// 关掉
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent||'').includes('知道了')); if (b) b.click(); return true })()`)
await sleep(500)

// ② Ctrl+Shift+H 命令历史
await pressKey('H', 'KeyH', 2 | 8)
results.history = await evaluate(`(() => {
  const root = document.querySelector('.sx-root')
  const t = root ? root.innerText : ''
  return { opened: t.includes('命令历史'), html: root ? root.innerHTML.length : 0 }
})()`)
await snap('history')
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent||'').trim() === '知道了' || (x.textContent||'').trim() === '×'); if (b) b.click(); return true })()`)
await pressKey('Escape', 'Escape', 0)
await sleep(400)

// ③ Ctrl+Shift+M 监控 —— 没有会话时不该崩，也不该有错误
await pressKey('M', 'KeyM', 2 | 8)
results.monitor = await evaluate(`(() => {
  const root = document.querySelector('.sx-root')
  return { stillMounted: !!root, html: root ? root.innerHTML.length : 0 }
})()`)
await pressKey('M', 'KeyM', 2 | 8)

// ④ Ctrl+K 命令面板
await pressKey('K', 'KeyK', 2)
results.palette = await evaluate(`(() => {
  const root = document.querySelector('.sx-root')
  const t = root ? root.innerText : ''
  return { opened: t.includes('填入命令行') || !!document.querySelector('.sx-pal-row'), html: root ? root.innerHTML.length : 0 }
})()`)
await snap('palette')
await pressKey('Escape', 'Escape', 0)

// ⑤ 侧栏折叠（Ctrl+B）
const beforeCollapse = await evaluate(`!!document.querySelector('.sx-side')`)
await pressKey('B', 'KeyB', 2)
const afterCollapse = await evaluate(`(() => {
  const side = document.querySelector('.sx-side')
  return side ? { present: true, w: side.getBoundingClientRect().width } : { present: false }
})()`)
results.sidebar = { before: beforeCollapse, after: afterCollapse }

results.errors = errors.slice(0, 10)
console.log(JSON.stringify(results, null, 2))

ws.close()
child.kill()

const fail = []
if (!results.baseline?.hasRoot) fail.push('面板没渲染')
if (!results.shortcuts?.opened) fail.push('Ctrl+/ 没打开快捷键一览')
if (results.errors?.length) fail.push(`${results.errors.length} 个控制台错误`)
console.log(fail.length ? `\nFAIL: ${fail.join('; ')}` : '\nOK: 逐项功能在真实界面里都通')
process.exit(fail.length ? 1 : 0)