/**
 * Headless render self-check: 用真实 React 19 在 Chromium 里渲染真实 UI。
 *
 * headless-check.mjs 证明 bundle 能装载；这个脚本证明组件体真的能渲染
 * （hooks 真的执行、子组件真的被调用、DOM 真的产出了 .sx-root）。
 *
 * 两条踩过的坑，留着当护栏：
 *  1. 不要 `define NODE_ENV=production`——React 19 的 production 构建把
 *     `useState` / `useRef` 等 hooks 从导出表摘掉，组件一取就是 undefined，
 *     脚本会自己制造假失败。
 *  2. 注入给 factory 的必须是**真 React 模块对象**（CJS `require('react')` 那种）。
 *     `import * as React` 在 esbuild 下是命名空间代理，属性可能是 getter 包装，
 *     拿它当 React 给组件用同样会失败。
 *
 * Usage: node scripts/render-check.mjs
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'

const toPath = (u) => u.pathname.replace(/^\/([A-Za-z]:)/, '$1')
const root = toPath(new URL('..', import.meta.url))
const clientPath = join(root, 'client.js')

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
const bootPath = join(tmpdir(), `render-boot-${stamp}.js`)
writeFileSync(
  bootPath,
  `
import * as ReactNS from 'react'
import { createElement } from 'react'

// esbuild 会给 ESM 命名空间套 __toESM 代理；宿主给组件的是**真模块对象**，
// 所以这里取 .default（CJS 互操作结果）而不是命名空间本身。
const React = ReactNS.default && ReactNS.default.createElement ? ReactNS.default : ReactNS
window.React = React
window.__errors = []
window.__views = []
window.__cleanups = []
window.addEventListener('error', (e) => {
  const stack = String((e.error && e.error.stack) || '')
  window.__errors.push('window: ' + String(e.message) + ' @ ' + stack.slice(0, 400))
})
window.__ModuleLoader__ = {
  load(def) {
    const ctx = {
      effect: (fn) => {
        try {
          const d = fn()
          if (typeof d === 'function') window.__cleanups.push(d)
        } catch (e) {
          window.__errors.push('effect: ' + e.message)
        }
      },
      on: () => () => {},
      get: () => undefined,
      slots: {
        inject: (name, fn) => fn(),
        register: (opts, view) => {
          window.__views.push({ name: opts.name, view })
          return () => {}
        },
      },
    }
    try {
      // 宿主在 factory 里把 React 交进来。这里传的就是真 React 模块对象。
      const api = def.factory((id) => (id === 'react' ? React : undefined))
      window.__injectedKeys = React ? Object.keys(React).length : 0
      window.__globalSet = typeof globalThis.__dshSshTerminalReact
      api.apply(ctx)
    } catch (e) {
      window.__errors.push('apply: ' + (e && (e.stack || e.message)))
    }
  },
}
export {}
`,
  'utf8'
)

const entryFile = join(tmpdir(), `render-entry-${stamp}.jsx`)
writeFileSync(
  entryFile,
  `
import { createRoot } from 'react-dom/client'
import ${JSON.stringify(bootPath)}
import ${JSON.stringify(clientPath)}

// boot 模块已把真 React 放在 window.React 上（它先于 client.js 求值）。
const React = window.React
const host = document.createElement('div')
host.id = 'host'
document.body.appendChild(host)

for (const v of window.__views) {
  const box = document.createElement('div')
  box.setAttribute('data-slot', v.name)
  host.appendChild(box)
  try {
    createRoot(box).render(React.createElement(v.view))
  } catch (e) {
    window.__errors.push('render ' + v.name + ': ' + (e && (e.stack || e.message)))
  }
}

setTimeout(() => {
  window.__done = {
    mounted: window.__views.map((v) => v.name),
    injectedKeys: window.__injectedKeys,
    globalSet: window.__globalSet,
    errors: window.__errors,
    html: host.innerHTML.length,
    hasRoot: !!host.querySelector('.sx-root'),
    classes: [...new Set(
      [...host.querySelectorAll('*')]
        .map((el) => (typeof el.className === 'string' ? el.className : ''))
        .filter((c) => c.startsWith('sx-'))
    )].slice(0, 60),
  }
}, 600)
`,
  'utf8'
)

const bundleFile = join(tmpdir(), `render-bundle-${stamp}.js`)
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

const PAGE = [
  '<!doctype html><html><head><meta charset="utf-8"><title>render</title>',
  '<script>window.__boot = { ok: false, err: null };',
  'window.addEventListener("error", (e) => { window.__boot.err = String(e.message || e.error) })</script>',
  '</head><body><script src="/bundle.js"></script>',
  '<script>window.__boot.ok = true</script></body></html>',
].join('')

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

const profile = join(tmpdir(), `dsh-render-${stamp}`)
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
await new Promise((r) => setTimeout(r, 3000))
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
  console.log('  script completed:', probe?.boot?.ok ? 'yes' : 'no')
  if (probe?.boot?.err) console.log('  boot error:', String(probe.boot.err).slice(0, 600))
  process.exit(1)
}

const fail = []
if (!done.mounted.length) fail.push('no views registered')
if (!done.hasRoot) fail.push('no .sx-root after render')
if (!done.html) fail.push('empty DOM')
const fatal = done.errors.filter((e) => /Cannot read|is not a function|Invalid hook|undefined is not|render |apply:/i.test(String(e)))
if (fatal.length) fail.push(`${fatal.length} render errors`)

console.log(`react  : injected ${done.injectedKeys} keys, global ${done.globalSet}`)
console.log(`views  : ${done.mounted.join(', ') || '(none)'}`)
console.log(`dom    : ${done.html} bytes, ${done.classes.length} sx-* classes`)
if (done.errors.length) {
  console.log('errors :')
  for (const e of done.errors.slice(0, 5)) console.log(`  - ${String(e).slice(0, 400)}`)
}
console.log(fail.length ? `FAIL: ${fail.join('; ')}` : 'OK: UI renders with real React')
process.exit(fail.length ? 1 : 0)
