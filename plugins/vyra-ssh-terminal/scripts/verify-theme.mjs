/**
 * 主题验证：在真实 DSH 界面里读出「选中 / 悬停 / 底色 / 文字」的实际计算颜色。
 *
 * 为什么要读计算样式而不是看截图：截图我只能目测，颜色对不对得靠数字。
 * 上一轮就是因为没量，把 #232a3d 当成了"好看"，结果在浅色主题里是一块黑。
 *
 * 用法: node scripts/verify-theme.mjs "<url>"
 */
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const url = process.argv[2]
const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))

const profile = join(tmpdir(), `dsh-theme-${Date.now()}`)
const child = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''
  const t = setTimeout(() => reject(new Error('browser did not start')), 20000)
  child.stderr.on('data', (d) => {
    buf += String(d)
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf)
    if (m) {
      clearTimeout(t)
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
const send = (method, params) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await new Promise((r) => ws.addEventListener('open', r))
await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url })
await sleep(12000)

await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const byText = (t) => [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && (el.textContent || '').trim() === t)
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

// 先点一个工具栏按钮，制造一个"选中态"再量——否则量不到 .on 的背景。
await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const root = document.querySelector('.sx-root')
  if (!root) return false
  const btn = [...root.querySelectorAll('.sx-tbtn')].find((b) => (b.textContent || '').trim() === '命令提示')
  if (btn && !btn.disabled) { btn.click(); await sleep(600) }
  return true
})()`)
await sleep(600)

// 量颜色：底色、文字色、以及两个派生令牌算出来的实际值
const colors = await evaluate(`(() => {
  const root = document.querySelector('.sx-root')
  if (!root) return null
  const cs = getComputedStyle(root)
  const pick = (n) => cs.getPropertyValue(n).trim()

// color-mix 直接解析容易在嵌套括号上出错，交给浏览器自己算：
  // 把值赋给一个临时元素的 background-color，再读回来的就是最终 rgb。
  const probe = document.createElement('div')
  probe.style.display = 'none'
  root.appendChild(probe)
  const resolve = (v) => {
    if (!v) return null
    probe.style.backgroundColor = ''
    probe.style.backgroundColor = v
    const got = getComputedStyle(probe).backgroundColor
    const m = got.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    // 有些序列化会带空格/空段，过滤掉再取前三项，否则 parseFloat('') = NaN
    const parts = m[1].split(',').map((x) => x.trim()).filter((x) => x !== '').map(Number)
    if (parts.length < 3 || parts.slice(0, 3).some((x) => !Number.isFinite(x))) return null
    const a = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1
    // 半透明值按"叠在白底上"合成，便于统一比较亮度
    if (a === 0) return [255, 255, 255]
    return parts.slice(0, 3).map((x) => Math.round(x * a + 255 * (1 - a)))
  }
  const toRgb = resolve

  const lum = (c) => {
    if (!c) return null
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }

  const out = {}
  for (const name of ['--sx-bg', '--sx-bg2', '--sx-fg', '--sx-hover', '--sx-active', '--sx-sel', '--sx-accent', '--sx-b1']) {
    const raw = pick(name)
    const rgb = toRgb(raw)
    out[name] = { raw, rgb, lum: lum(rgb) }
  }
  probe.remove()
  const on = root.querySelector('.sx-tbtn.on')
  if (on) out['.sx-tbtn.on 实际背景'] = getComputedStyle(on).backgroundColor
  out['.sx-root 实际背景'] = getComputedStyle(root).backgroundColor
  return out
})()`)

console.log(JSON.stringify(colors, null, 2))

const snap = await send('Page.captureScreenshot', { format: 'png' })
if (snap.result?.data) {
  const out = join(tmpdir(), 'dsh-theme-light.png')
  writeFileSync(out, Buffer.from(snap.result.data, 'base64'))
  console.log(`\n截图: ${out}`)
}

ws.close()
child.kill()

// 判定：直接看**实际渲染出来的背景色**，不用自己算亮度——
  // 早先那套亮度计算在 color-mix / hex / rgba 三种写法上反复出错，而浏览器
  // 已经把最终颜色算好了，读它的结果最省事也最准。
  const rootBg = colors?.['.sx-root 实际背景'] ?? ''
  const activeBg = colors?.['.sx-tbtn.on 实际背景'] ?? ''
  const parseWhite = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s)
    if (!m) return null
    const p = m[1].split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x))
    return p.length >= 3 ? p.slice(0, 3) : null
  }
  const isLight = (rgb) => (rgb ? rgb.every((v) => v > 200) : null)

  const fail = []
  const rootRgb = parseWhite(rootBg)
  if (!rootRgb) fail.push(`拿不到面板背景色（${rootBg}）`)
  else if (!isLight(rootRgb)) fail.push(`面板背景太暗：${rootBg}（浅色主题下应为接近白）`)

  if (activeBg) {
    const a = parseWhite(activeBg)
    if (a && a.some((v) => v < 150)) fail.push(`选中态太暗：${activeBg}，浅色主题下会变成黑块`)
  }

  console.log(`\n面板背景: ${rootBg}`)
  console.log(`选中态背景: ${activeBg || '(当前没有选中项，跳过)'}`)
  console.log(fail.length ? `\nFAIL: ${fail.join('; ')}` : '\nOK: 浅色主题下背景与选中态都是亮的')
  process.exit(fail.length ? 1 : 0)