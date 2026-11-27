/**
 * 资源监控的阈值表——数字和颜色都从这一张表来，改一处就够。
 *
 * 移植自 liteshell 的 alerts.ts。每条规则给两个界线：过 warn 变黄，过 crit 变红。
 * `metric` 用来在预警条上排序（严重的在前），`label` 是胶囊上那句话。
 */

/** 每条规则的文案。`value` 是已经格式化好的读数，比如 "92%"、"/data 92%"。 */
export const RULES = [
  { id: 'cpu', warn: 80, crit: 95 },
  { id: 'mem', warn: 85, crit: 95 },
  { id: 'swap', warn: 60, crit: 85 },
  { id: 'disk', warn: 80, crit: 90 },
  { id: 'gpuMem', warn: 85, crit: 95 },
  { id: 'gpuTemp', warn: 75, crit: 88 },
  { id: 'load', warn: 1.5, crit: 2.5 },
  { id: 'latency', warn: 100, crit: 300 },
]

const RULE = new Map(RULES.map((r) => [r.id, r]))

/** 0 = 正常，1 = 警告，2 = 严重。 */
export function tone(id, value) {
  const rule = RULE.get(id)
  if (!rule || !Number.isFinite(value)) return 0
  if (value >= rule.crit) return 2
  if (value >= rule.warn) return 1
  return 0
}

/** 进度条 / 数字的着色类名，与样式表里的 `.warn` / `.err` 对应。 */
export function level(pct) {
  return pct >= 90 ? 'err' : pct >= 75 ? 'warn' : ''
}

const fmtPct = (v) => `${Math.round(v)}%`

/**
 * 把一份监控快照翻成预警清单。
 *
 * 正常情况下返回空数组，界面画一行「都正常」；有事才变成橙/红胶囊，严重的排前面。
 * 每核负载要除以核数才是「这台机器的负载」，否则 64 核的机器一忙就被判成红线。
 *
 * @param {object} m parseMonitor 的快照
 * @returns {{id: string, level: 1 | 2, text: string}[]}
 */
export function alerts(m) {
  if (!m) return []
  const out = []
  const add = (id, value, text) => {
    const t = tone(id, value)
    if (t > 0) out.push({ id, level: t, text, value })
  }

  add('cpu', m.cpu, `CPU ${fmtPct(m.cpu)}`)
  const memPct = m.memTotal > 0 ? (m.memUsed / m.memTotal) * 100 : 0
  add('mem', memPct, `内存 ${fmtPct(memPct)}`)
  if (m.swapTotal > 0) {
    const swapPct = (m.swapUsed / m.swapTotal) * 100
    add('swap', swapPct, `Swap ${fmtPct(swapPct)}`)
  }
  for (const d of m.disk ?? []) {
    const p = d.size > 0 ? (d.used / d.size) * 100 : 0
    add('disk', p, `${d.mount} 已用 ${fmtPct(p)}`)
  }
  for (const g of m.gpu ?? []) {
    const p = g.memTotal > 0 ? (g.memUsed / g.memTotal) * 100 : 0
    add('gpuMem', p, `显存 ${fmtPct(p)}`)
    add('gpuTemp', g.temp, `GPU ${Math.round(g.temp)}℃`)
  }
  const cores = m.cpuCores > 0 ? m.cpuCores : 1
  add('load', (m.load?.[0] ?? 0) / cores, `负载 ${(m.load?.[0] ?? 0).toFixed(2)}`)
  if (typeof m.latencyMs === 'number') add('latency', m.latencyMs, `延迟 ${Math.round(m.latencyMs)} ms`)

  // 严重的先排，同级按数值从大到小。
  return out.sort((a, b) => b.level - a.level || b.value - a.value).map(({ value, ...rest }) => rest)
}

/** 预警条上那句话：没事就说没事，并点明查了哪几样。 */
export function verdict(list) {
  if (!list.length) return { level: 0, text: 'CPU / 内存 / 磁盘 都正常' }
  const level = Math.max(...list.map((a) => a.level))
  return { level, text: list.map((a) => a.text).join(' · ') }
}
