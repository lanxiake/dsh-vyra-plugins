/**
 * 监控卡片里的小曲线。
 *
 * 一张 <canvas>，画最近 N 个点：面积淡淡的、线一条、末端一个点。不引图表库——
 * 这里要的就是一条趋势线，不是交互式图表。首帧只有一个点时，把它撑满整宽（否则
 * 一条曲线要等十几个采样才画得出来）。
 */
import { hostReact } from './react.js'
import { h } from './jsx-shim.js'

export const POINTS = 60

/** 每个会话一条环形历史：`Map<sessionId, {cpu: [], mem: [], down: [], up: [], diskRead: [], diskWrite: [], rx: Map<iface, []>}>` */
const histories = new Map()

const push = (list, value) => {
  list.push(Number.isFinite(value) ? value : 0)
  if (list.length > POINTS) list.shift()
}

/** 取某个会话的历史（没有就建）。采样推送由监控面板负责，曲线只读。 */
export function historyFor(key) {
  let h0 = histories.get(key)
  if (!h0) {
    h0 = { cpu: [], mem: [], swap: [], down: [], up: [], diskRead: [], diskWrite: [], ifaces: new Map() }
    histories.set(key, h0)
  }
  return h0
}

/** 记一次采样。会话关掉时由 forgetHistory 释放。 */
export function recordSample(key, m) {
  const hist = historyFor(key)
  push(hist.cpu, m.cpu)
  push(hist.mem, m.memTotal > 0 ? (m.memUsed / m.memTotal) * 100 : 0)
  push(hist.swap, m.swapTotal > 0 ? (m.swapUsed / m.swapTotal) * 100 : 0)
  push(hist.down, m.netDown)
  push(hist.up, m.netUp)
  push(hist.diskRead, m.diskRead)
  push(hist.diskWrite, m.diskWrite)
  const seen = new Set()
  for (const n of m.net ?? []) {
    if (n.name === 'lo') continue
    seen.add(n.name)
    let list = hist.ifaces.get(n.name)
    if (!list) {
      list = []
      hist.ifaces.set(n.name, list)
    }
    push(list, n.rx + n.tx)
  }
  // 已经消失的网卡要从历史里删掉，否则它的旧曲线会一直占着图例。
  for (const name of [...hist.ifaces.keys()]) if (!seen.has(name)) hist.ifaces.delete(name)
  return hist
}

export function forgetHistory(key) {
  histories.delete(key)
}

/**
 * 一条迷你曲线。
 *
 * @param {object} props
 * @param {number[]} props.values 最近若干个采样（旧的在前）
 * @param {number} [props.max] 纵轴上限；省略时取本组数据的峰值（至少 1，免得除以 0）
 * @param {number} [props.height] 像素高度
 * @param {string} [props.color] 线色，默认取主题里的强调色
 */
export function Spark({ values, max, height = 38, color }) {
  const ref = globalThis.__dshSshTerminalReact.useRef(null)
  const peak = max ?? Math.max(1, ...(values.length ? values : [0]))

  globalThis.__dshSshTerminalReact.useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 160
    const hh = height
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(hh * dpr)
    const g = canvas.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, hh)

    const stroke = color || getComputedStyle(canvas).getPropertyValue('--sx-accent').trim() || '#4aa3ff'
    const pts = values.length ? values : [0]
    const stepX = pts.length > 1 ? w / (pts.length - 1) : 0
    const yOf = (v) => hh - 2 - Math.min(1, Math.max(0, v / peak)) * (hh - 4)
    const at = (i) => [pts.length === 1 ? w : i * stepX, yOf(pts[i])]

    // 面积：一层很淡的填充，让人一眼看出曲线下面还有多少。
    const fill = g.createLinearGradient(0, 0, 0, hh)
    fill.addColorStop(0, `${withAlpha(stroke, 0.28)}`)
    fill.addColorStop(1, `${withAlpha(stroke, 0.02)}`)
    g.beginPath()
    g.moveTo(0, hh)
    for (let i = 0; i < pts.length; i++) g.lineTo(...at(i))
    g.lineTo(at(pts.length - 1)[0], hh)
    g.closePath()
    g.fillStyle = fill
    g.fill()

    // 折线
    g.beginPath()
    for (let i = 0; i < pts.length; i++) g.lineTo(...at(i))
    g.strokeStyle = stroke
    g.lineWidth = 1.5
    g.lineJoin = 'round'
    g.stroke()

    // 末端那个点：当下的读数落在哪
    const [lx, ly] = at(pts.length - 1)
    g.beginPath()
    g.arc(lx - 1.5, ly, 2, 0, Math.PI * 2)
    g.fillStyle = stroke
    g.fill()
  }, [values.join(','), peak, height, color])

  return h('canvas', { ref, className: 'sx-spark', style: { height } })
}

/** 把 `rgb()` / `#rgb` / `#rrggbb` 都接受的取色加上透明度。 */
function withAlpha(color, alpha) {
  const c = String(color).trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (hex) {
    const v = hex[1].length === 3 ? hex[1].split('').map((x) => x + x).join('') : hex[1]
    const n = parseInt(v, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(c)
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((x) => x.trim())
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return c
}
