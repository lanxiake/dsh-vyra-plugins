/**
 * 无头浏览器自检（CDP 版）：在真 Chromium 里加载打包后的 client.js，把结果取回来。
 *
 * 单元测试覆盖纯逻辑；**这个覆盖另一半**——打包产物能不能被宿主的模块加载器接住、
 * 样式挂没挂上、`apply()` 注册插槽时会不会炸。这些错误在 Node 里测不出来，只会在
 * 用户面前变成一片空白。
 *
 * 做法：本地静态服务 + 最小宿主替身（`window.__ModuleLoader__` / `require('react')`），
 * 然后用 CDP 的 Runtime.evaluate 把 `window.__done` 取回来。
 *
 * 用法：node scripts/headless-check.mjs
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))

if (!BROWSER) {
  console.error('没找到 Chromium（Edge 或 Chrome）')
  process.exit(2)
}

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>harness</title></head>
<body>
<div id="root"></div>
<script>
  window.__errors = []
  window.addEventListener('error', (e) => window.__errors.push(String(e.message)))
  window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)))

  // 极简 React：不渲染，只让元素树能建起来（factory 里的组件定义阶段就会调用 h()）
  window.__react = {
    createElement: (type, props, ...kids) => ({ type, props: props || {}, children: kids.flat(Infinity) }),
    Fragment: Symbol.for('react.fragment'),
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useRef: () => ({ current: null }),
    useMemo: (f) => f(),
    useCallback: (f) => f(),
  }

  window.__slots = []
  window.__ModuleLoader__ = {
    load(def) {
      const React = window.__react
      const ctx = {
        effect: (fn) => {
          try {
            fn()
          } catch (e) {
            window.__errors.push('effect: ' + (e && e.message))
          }
        },
        on: () => () => {},
        get: () => undefined,
        slots: {
          inject: (name, fn) => {
            try {
              fn()
            } catch (e) {
              window.__errors.push('slots.inject ' + name + ': ' + (e && e.message))
            }
          },
          register: (opts, view) => {
            window.__slots.push({ name: opts.name, view: typeof view, key: opts.key || opts.id })
            return () => {}
          },
        },
      }
      try {
        const mod = def.factory((id) => (id === 'react' ? React : undefined))
        mod.apply(ctx)
      } catch (e) {
        window.__errors.push('factory/apply: ' + (e && e.stack ? e.stack : e))
      }
    },
  }
</script>
<script src="/client.js"></script>
<script>
  window.__done = {
    slots: window.__slots,
    errors: window.__errors,
    styleTags: document.head.querySelectorAll('style').length,
    cssBytes: [...document.head.querySelectorAll('style')].reduce((n, s) => n + s.textContent.length, 0),
  }
</script>
</body></html>`

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(PAGE)
  }
  if (req.url === '/client.js') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' })
    return res.end(readFileSync(join(root, 'client.js')))
  }
  res.writeHead(404)
  res.end()
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/`

const profile = join(tmpdir(), `dsh-headless-${Date.now()}`)
const child = spawn(
  BROWSER,
  ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] }
)

// 浏览器把调试端口打在 stderr 上
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''
  const timer = setTimeout(() => reject(new Error('浏览器没起来')), 20000)
  child.stderr.on('data', (d) => {
    buf += String(d)
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf)
    if (m) {
      clearTimeout(timer)
      resolve(m[1])
    }
  })
  child.on('close', () => reject(new Error('浏览器提前退出')))
})

// 极简 CDP：Node 22+ 自带 WebSocket
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
await new Promise((r) => setTimeout(r, 1500))
const res = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__done || null)', returnByValue: true })

let done = null
try {
  done = JSON.parse(res.result.result.value)
} catch {
  done = null
}

ws.close()
child.kill()
server.close()

if (!done) {
  console.log('✗ 页面没有产出结果（脚本可能没执行完）')
  process.exit(1)
}

const fail = []
if (!done.styleTags) fail.push('样式没有挂到 <head>')
if (!done.slots.length) fail.push('没有注册任何插槽')
if (done.errors.length) fail.push(`运行期报错 ${done.errors.length} 条`)

console.log(`样式：${done.styleTags} 个 <style>，共 ${done.cssBytes} 字节`)
console.log(`插槽：${done.slots.map((s) => `${s.name}(view=${s.view})`).join(', ') || '（无）'}`)
if (done.errors.length) {
  console.log(`报错：`)
  for (const e of done.errors.slice(0, 8)) console.log(`  - ${String(e).slice(0, 300)}`)
}
console.log(fail.length ? `✗ ${fail.join('；')}` : '✓ 打包产物能在浏览器里加载并注册插槽')
process.exit(fail.length ? 1 : 0)
