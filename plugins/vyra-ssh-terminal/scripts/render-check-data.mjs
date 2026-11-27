/**
 * 有数据状态下的渲染检查：把监控面板和 AI 面板**直接**渲染出来，喂假数据。
 *
 * render-check.mjs 只渲染空状态（没有会话），工具栏、监控、AI 面板那些分支根本
 * 不会执行——正是这些分支藏着"占位符能过、有数据就崩"的 bug。这里补上。
 *
 * Usage: node scripts/render-check-data.mjs
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'

const toPath = (u) => u.pathname.replace(/^\/([A-Za-z]:)/, '$1')
const root = toPath(new URL('..', import.meta.url))

const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
if (!BROWSER) {
  console.error('no chromium found')
  process.exit(2)
}

const REACT_DIR = join(process.env.USERPROFILE ?? '', '.dsh/profiles/desktop/node_modules')
if (!existsSync(join(REACT_DIR, 'react'))) {
  console.error('no react in profile node_modules, skipping')
  process.exit(0)
}

const stamp = Date.now()
const bootPath = join(tmpdir(), `data-boot-${stamp}.js`)
writeFileSync(
  bootPath,
  `
import * as ReactNS from 'react'

const React = ReactNS.default && ReactNS.default.createElement ? ReactNS.default : ReactNS
window.React = React
window.__errors = []
window.__views = []
window.addEventListener('error', (e) => {
  window.__errors.push('window: ' + String(e.message) + ' @ ' + String((e.error && e.error.stack) || '').slice(0, 300))
})

// 面板用到的会话接口：给一个"已连上"的假会话，让监控与 AI 真的走进有数据的分支。
const fakeSnap = {
  at: Date.now(),
  cpu: 42.5, cpuCores: 8, load: [1.2, 0.9, 0.7],
  memTotal: 16e9, memUsed: 9e9, swapTotal: 2e9, swapUsed: 5e8,
  netDown: 1024 * 800, netUp: 1024 * 120,
  net: [{ name: 'eth0', rx: 1024 * 800, tx: 1024 * 120 }],
  netTotals: [{ name: 'eth0', rxBytes: 5e9, txBytes: 1e9 }],
  diskIo: [{ name: 'sda', read: 1048576, write: 524288 }],
  diskRead: 1048576, diskWrite: 524288,
  disk: [{ fs: '/dev/sda1', mount: '/', size: 100e9, used: 55e9, device: 'sda1', read: 1048576, write: 524288 }],
  gpu: [{ name: 'NVIDIA A100', util: 87, memUsed: 20e9, memTotal: 40e9, temp: 72 }],
  npu: [{ id: 0, name: '910ProB', health: 'OK', util: 33, temp: 61, power: 150, hbmUsed: 1e9, hbmTotal: 32e9, ddrUsed: 2e9, ddrTotal: 32e9 }],
  proc: [{ pid: 1234, user: 'root', cpu: 42.5, mem: 3.1, rss: 5e8, diskRead: 1e6, diskWrite: 5e5, name: 'java', cmd: 'java -jar app.jar', path: '/usr/bin/java' }],
  uptime: 123456,
  info: { hostname: 'web-01', os: 'Debian 12', kernel: 'Linux 6.1', arch: 'x86_64', cpuModel: 'EPYC' },
  latencyMs: 23,
}
window.__fakeSnap = fakeSnap

// ai/history 给几条历史，historyOpen 由面板自己控制；这里只验证面板主体能渲染。
window.__calls = []
window.fetch = async (input) => {
  const path = typeof input === 'string' ? input : String(input && input.url)
  window.__calls.push(path)
  const body = path.includes('monitor')
    ? fakeSnap
    : path.includes('ai/history')
      ? { items: [{ id: 'h1', at: Date.now(), title: '检查磁盘' }] }
      : { items: [] }
  return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(body), json: async () => body, blob: async () => new Blob([]) }
}

window.__ModuleLoader__ = {
  load(def) {
    const ctx = {
      effect: (fn) => { try { fn() } catch (e) { window.__errors.push('effect: ' + e.message) } },
      on: () => () => {},
      get: () => undefined,
      slots: { inject: (n, fn) => fn(), register: () => () => {} },
    }
    try {
      const api = def.factory((id) => (id === 'react' ? React : undefined))
      api.apply(ctx)
    } catch (e) {
      window.__errors.push('apply: ' + (e && (e.stack || e.message)))
    }
  },
}

// 会话替身：面板通过它拿 connId。
window.__session = { id: 's1', connId: 'c1', status: 'ready', term: { paste() {}, focus() {} } }
export {}
`,
  'utf8'
)

const entryFile = join(tmpdir(), `data-entry-${stamp}.jsx`)
writeFileSync(
  entryFile,
  `
import { createRoot } from 'react-dom/client'
import { setReact } from ${JSON.stringify(join(root, 'src/react.js').replace(/\\\\/g, '/'))}
import ${JSON.stringify(bootPath)}
import { state } from ${JSON.stringify(join(root, 'src/state.js').replace(/\\\\/g, '/'))}
import { MonitorDrawer } from ${JSON.stringify(join(root, 'src/monitor-panel.jsx').replace(/\\\\/g, '/'))}
import { AiPanel } from ${JSON.stringify(join(root, 'src/ai-panel.jsx').replace(/\\\\/g, '/'))}
import { Markdown } from ${JSON.stringify(join(root, 'src/markdown.js').replace(/\\\\/g, '/'))}

// 面板通过 globalThis.__dshSshTerminalReact 取 hooks；这里把真 React 放进去，
// 等价于宿主 factory 里那次 setReact(require('react'))。
setReact(window.React)

// activeSession() 读的是 state.sessions：塞一个"已连上"的假会话，监控才会真的采样。
state.sessions = [{ id: 's1', connId: 'c1', status: 'ready', name: 'web-01', term: { paste() {}, focus() {} } }]
state.active = 's1'
state.drawer = 'monitor'

const React = window.React
const tick = String.fromCharCode(96)
const host = document.createElement('div')
host.id = 'host'
document.body.appendChild(host)

// 直接渲染"有数据"的面板：不走 App 的会话判断。
for (const [name, Comp] of [['monitor', MonitorDrawer], ['ai', AiPanel]]) {
  const box = document.createElement('div')
  box.setAttribute('data-panel', name)
  host.appendChild(box)
  try {
    createRoot(box).render(React.createElement(Comp, { open: true }))
  } catch (e) {
    window.__errors.push('render ' + name + ': ' + (e && (e.stack || e.message)))
  }
}

// Markdown 单独渲染一份：AI 面板里要有消息才走到它，这里直接验转换结果。
// 这个文件是模板字符串：样例文本里的换行与反引号都用运行时变量拼，
// 不能把字面量直接写进来（模板字符串会把它们当成语法）。
const mdText = ['# 标题', '', '**粗体** 与 ' + tick + 'code' + tick, '', '- 一项', '- 两项', '', tick + tick + tick + 'sh', 'ls -la', tick + tick + tick].join(String.fromCharCode(10))
const mdBox = document.createElement('div')
mdBox.setAttribute('data-panel', 'markdown')
host.appendChild(mdBox)
try {
  createRoot(mdBox).render(React.createElement(Markdown, { text: mdText }))
} catch (e) {
  window.__errors.push('render markdown: ' + (e && (e.stack || e.message)))
}

setTimeout(() => {
  const text = host.innerText || ''
  window.__done = {
    errors: window.__errors,
    html: host.innerHTML.length,
    text: text.slice(0, 1200),
    hasCpu: text.includes('CPU'),
    hasDiskIo: text.includes('磁盘 I/O'),
    hasNpu: text.includes('NPU'),
    // Markdown 真的被解析成元素了吗（双星号应该变成 <strong>）
    mdRendered: !!host.querySelector('strong, code, pre, ul'),
    hasAiInput: !!host.querySelector('textarea, input[type=text], .sx-ai-input'),
    calls: window.__calls.slice(0, 10),
  }
}, 1200)
`,
  'utf8'
)

const bundleFile = join(tmpdir(), `data-bundle-${stamp}.js`)
await build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'iife',
  outfile: bundleFile,
  nodePaths: [REACT_DIR],
  loader: { '.jsx': 'jsx' },
  logLevel: 'error',
})
const bundleCode = readFileSync(bundleFile, 'utf8')

const PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><title>data</title></head><body>' +
  '<script>window.__boot={ok:false,err:null};window.addEventListener("error",(e)=>{window.__boot.err=String(e.message||e.error)})</script>' +
  '<script src="/bundle.js"></script><script>window.__boot.ok=true</script></body></html>'

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(PAGE)
  }
  if (req.url === '/bundle.js') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' })
    return res.end(bundleCode)
  }
  res.writeHead(404)
  res.end()
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/`

const profile = join(tmpdir(), `dsh-data-${stamp}`)
const child = spawn(
  BROWSER,
  ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
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
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
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
await new Promise((r) => ws.addEventListener('open', r))
await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, 3500))
const res = await send('Runtime.evaluate', {
  expression: 'JSON.stringify({ done: window.__done || null, boot: window.__boot || null })',
  returnByValue: true,
})
let probe = null
try {
  probe = JSON.parse(res.result.result.value)
} catch {}
ws.close()
child.kill()
server.close()

const done = probe?.done ?? null
if (!done) {
  console.log('FAIL: page produced no result')
  if (probe?.boot?.err) console.log('  boot error:', String(probe.boot.err).slice(0, 500))
  process.exit(1)
}

const fatal = done.errors.filter((e) => /Cannot read|is not a function|is not defined|Invalid hook|undefined is not|render |apply:/i.test(String(e)))
const fail = []
if (!done.html) fail.push('empty DOM')
if (!done.hasCpu) fail.push('监控没渲染出 CPU 卡')
if (!done.hasDiskIo) fail.push('监控没渲染出磁盘 I/O')
if (!done.mdRendered) fail.push('Markdown 没有解析出任何元素')
if (fatal.length) fail.push(`${fatal.length} render errors`)

console.log(`dom    : ${done.html} bytes`)
console.log(`markdown: ${done.mdRendered ? '已解析为 DOM 元素' : '仍是纯文本'}`)
console.log(`calls  : ${done.calls.join(', ') || '(none)'}`)
console.log(`文本   : ${String(done.text || '').replace(/\s+/g, ' ').slice(0, 400)}`)
if (done.errors.length) {
  console.log('errors :')
  for (const e of done.errors.slice(0, 6)) console.log(`  - ${String(e).slice(0, 300)}`)
}
console.log(fail.length ? `FAIL: ${fail.join('; ')}` : 'OK: 有数据的监控面板渲染正常')
process.exit(fail.length ? 1 : 0)
