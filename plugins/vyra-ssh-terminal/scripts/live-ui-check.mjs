/**
 * 在**真实运行的 DSH Web UI** 里验证 SSH 插件。
 *
 * 与 headless-check / render-check 的区别：那两个跑的是我们自己搭的桩，这个跑的是
 * 宿主真实的前端（真实模块加载器、真实 slot 系统、真实 React）。只有它能回答
 * 「用户打开界面到底看得见什么」。
 *
 * 用法：
 *   node scripts/live-ui-check.mjs "http://127.0.0.1:53111/?token=..."
 */
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const url = process.argv[2]
if (!url) {
  console.error('用法: node scripts/live-ui-check.mjs <dsh web url>')
  process.exit(2)
}

const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
if (!BROWSER) {
  console.error('no chromium found')
  process.exit(2)
}

const profile = join(tmpdir(), `dsh-live-${Date.now()}`)
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
const consoleErrors = []
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push('EXC: ' + String(msg.params.exceptionDetails?.exception?.description ?? '').slice(0, 300))
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
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) {
    consoleErrors.push('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
  }
  return r.result?.result?.value
}

await new Promise((r) => ws.addEventListener('open', r))
await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, 12000))

// 1) 先开面板（并把挡路的弹窗点掉）
await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const byText = (t) => [...document.querySelectorAll('*')].filter(
    (el) => el.children.length === 0 && (el.textContent || '').trim() === t)
  for (let round = 0; round < 3; round++) {
    let hit = false
    for (const label of ['继续', '知道了', '我知道了', '稍后再说']) {
      const btn = byText(label)[0]
      if (btn) { btn.click(); hit = true; await sleep(900); break }
    }
    const close = [...document.querySelectorAll('button,[role="button"]')]
      .find((b) => (b.getAttribute('aria-label') || '') === '关闭' || (b.getAttribute('aria-label') || '') === 'Close')
    if (close) { close.click(); hit = true; await sleep(600) }
    if (!hit) break
  }
  let tab = byText('SSH')[0] || null
  for (let i = 0; i < 12 && !tab; i++) { await sleep(1000); tab = byText('SSH')[0] || null }
  if (tab) { tab.click(); await sleep(2000) }
  return !!tab
})()`)

// 2) 用 CDP 发**真实**按键（合成 KeyboardEvent 走不到宿主的默认路径）
async function pressKey(key, code, modifiers) {
  const vk = code === 'Slash' ? 191 : key.toUpperCase().charCodeAt(0)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode: vk })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode: vk })
}
await pressKey('/', 'Slash', 2) // Ctrl+/
await new Promise((r) => setTimeout(r, 900))

const state = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const byText = (t) => [...document.querySelectorAll('*')].filter(
    (el) => el.children.length === 0 && (el.textContent || '').trim() === t)

  const root = document.querySelector('.sx-root')
  const classes = root
    ? [...new Set([...root.querySelectorAll('*')]
        .map((el) => (typeof el.className === 'string' ? el.className : ''))
        .filter((c) => c.startsWith('sx-')))].slice(0, 80)
    : []

  const text = root ? (root.innerText || '') : ''
  // Ctrl+/ 的结果：快捷键一览里有这一行
  const helpShown = text.includes('Ctrl + Shift + H') && text.includes('交给远端 shell')

  return {
    hasTab: !!byText('SSH')[0],
    hasRoot: !!root,
    html: root ? root.innerHTML.length : 0,
    text: text.slice(0, 500),
    classes,
    styleTags: [...document.querySelectorAll('style')].filter((s) => (s.textContent || '').includes('.sx-root')).length,
    checks: {
      shortcutsHelpOnCtrlSlash: helpShown,
      hasNewConnectionButton: text.includes('新建'),
      hasImport: text.includes('导入'),
      emptyHint: text.includes('还没有连接'),
    },
  }
})()`)

if (state) state.errors = consoleErrors.slice(0, 10)
console.log(JSON.stringify(state, null, 2))

const snap = await send('Page.captureScreenshot', { format: 'png' })
if (snap.result?.data) {
  const out = join(tmpdir(), 'dsh-live-ui.png')
  writeFileSync(out, Buffer.from(snap.result.data, 'base64'))
  console.log(`\n截图: ${out}`)
}

ws.close()
child.kill()

const fail = []
if (!state?.hasTab) fail.push('侧栏没有 SSH 入口')
if (!state?.hasRoot) fail.push('没有 .sx-root')
if (!(state?.html > 200)) fail.push(`DOM 太小（${state?.html}）`)
if (state?.errors?.length) fail.push(`${state.errors.length} 个控制台错误`)

console.log(fail.length ? `\nFAIL: ${fail.join('; ')}` : '\nOK: SSH 面板在真实 DSH Web UI 里正常渲染')
process.exit(fail.length ? 1 : 0)