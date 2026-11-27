/**
 * 资源监控面板。
 *
 * 版式按「先看结论，再看细节」排（对齐 liteshell）：
 *   预警条 → 主机信息 → CPU / 内存 / Swap / 网络 四张卡（两列，一屏看完）
 *   → GPU / NPU / 磁盘 / 进程 / 网卡，每块点标题就能折起来。
 *
 * 采样：连上服务器的标签页**自动打开**这次监控（只对当前标签生效，后台附加的会话
 * 不会偷偷开始采样），之后每 2 秒刷一次；面板一关就停，不在后台空转。
 */
import { hostReact } from './react.js'
import { h } from './jsx-shim.js'
import { api } from './api.js'
import { bytes, rate, uptime } from './fmt.js'
import { activeSession } from './sessions.js'
import { notify, state } from './state.js'
import { Spark, historyFor, recordSample } from './spark.js'
import { alerts, level, verdict } from './alerts.js'

const REFRESH_MS = 2000

/** 每块折叠状态在一次会话里记着；刷新只重写内容，不会把折起来的那块弹开。 */
const collapsed = new Set()

const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0)

/** 带曲线和进度条的读数卡：曲线看趋势，进度条看当下。 */
function MeterCard({ title, value, sub, values, max, tone = '' }) {
  return h(
    'div',
    { className: 'sx-mcard' },
    h('div', { className: 'sx-mcard-t' }, h('span', null, title), h('b', { className: tone }, value)),
    h(Spark, { values, max }),
    sub && h('div', { className: 'sx-mcard-sub' }, sub)
  )
}

/** 每块的可折叠外壳。标题就是一个按钮，`aria-expanded` 让读屏也跟得上。 */
function Fold({ id, title, right, children }) {
  const open = !collapsed.has(id)
  return h(
    'div',
    { className: `sx-fold ${open ? '' : 'closed'}` },
    h(
      'button',
      {
        type: 'button',
        className: 'sx-fold-h',
        'aria-expanded': open,
        onClick: () => {
          open ? collapsed.add(id) : collapsed.delete(id)
          notify()
        }
      },
      h('span', { className: 'sx-caret' }, open ? '▾' : '▸'),
      h('span', null, title),
      right && h('span', { className: 'sx-fold-r' }, right)
    ),
    open && h('div', { className: 'sx-fold-b' }, children)
  )
}

/** 预警条：正常一行绿字，有事才变成橙/红胶囊，严重的排前面。 */
function Alerts({ list }) {
  const v = verdict(list)
  const cls = v.level === 2 ? 'err' : v.level === 1 ? 'warn' : 'ok'
  return h(
    'div',
    { className: `sx-malert ${cls}`, role: 'status' },
    list.length
      ? list.map((a, i) => h('span', { key: i, className: `sx-pill ${a.level === 2 ? 'err' : 'warn'}` }, a.text))
      : h('span', null, v.text)
  )
}

/** 进程表的一行：三行一张卡（对齐 liteshell），而不是挤成四列。 */
function ProcRow({ p }) {
  return h(
    'div',
    { className: 'sx-proc-row' },
    h(
      'div',
      { className: 'sx-proc-l1' },
      h('span', { className: 'sx-dim' }, p.pid),
      h('span', { className: 'sx-proc-name', title: p.cmd }, p.name),
      h('span', { className: `sx-proc-metric ${level(p.cpu * 2)}` }, `${p.cpu.toFixed(1)}%`)
    ),
    h(
      'div',
      { className: 'sx-proc-l2' },
      h('span', null, p.user),
      h('span', null, `${p.mem.toFixed(1)}% · ${bytes(p.rss)}`)
    ),
    h(
      'div',
      { className: 'sx-proc-l3', title: p.cmd },
      h('span', null, p.path || p.cmd),
      (p.diskRead > 0 || p.diskWrite > 0) && h('span', { className: 'sx-dim' }, ` R ${bytes(p.diskRead)} · W ${bytes(p.diskWrite)}`)
    )
  )
}

export function MonitorDrawer({ open }) {
  const s = activeSession()
  const cid = s?.id ?? null
  const connId = s?.connId ?? null
  const [m, setM] = globalThis.__dshSshTerminalReact.useState(null)
  const [err, setErr] = globalThis.__dshSshTerminalReact.useState('')
  const [hist, setHist] = globalThis.__dshSshTerminalReact.useState(null)

  globalThis.__dshSshTerminalReact.useEffect(() => {
    if (!open || !connId) return
    let stop = false
    let timer = null
    let busy = false
    setM(null)
    setErr('')
    const tick = async () => {
      // 上一次还没回来就不再叠一次请求：慢服务器上叠起来只会在服务端排队。
      if (busy) return
      busy = true
      try {
        const r = await api('monitor', { connection: connId })
        if (stop) return
        setM(r)
        setErr('')
        setHist({ ...recordSample(connId, r) })
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : String(e))
      } finally {
        busy = false
      }
      if (!stop) timer = setTimeout(tick, REFRESH_MS)
    }
    tick()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [open, connId])

  const histNow = hist ?? (connId ? historyFor(connId) : null)
  const ifaces = m
    ? m.net
        .filter((n) => n.name !== 'lo')
        .sort((a, b) => b.rx + b.tx - (a.rx + a.tx))
        .slice(0, 6)
    : []
  const memPct = m ? pct(m.memUsed, m.memTotal) : 0
  const swapPct = m && m.swapTotal > 0 ? pct(m.swapUsed, m.swapTotal) : 0
  // 网卡的几条曲线共用同一个峰值刻度：各画各的会把 10KB/s 的显卡得和 10MB/s 一样高。
  const netPeak = ifaces.length
    ? Math.max(1, ...ifaces.flatMap((n) => histNow?.ifaces?.get(n.name) ?? []))
    : 1
  const diskPeak = Math.max(1, ...(histNow?.diskRead ?? []), ...(histNow?.diskWrite ?? []))

  return h(
    'div',
    { className: 'sx-drawer sx-monitor' },
    h(
      'div',
      { className: 'sx-dhead' },
      h('span', { className: 'sx-dtitle' }, m?.info?.hostname ? `监控 · ${m.info.hostname}` : '资源监控'),
      h(
        'span',
        { className: 'sx-dhead-r' },
        typeof m?.latencyMs === 'number' && h('span', { className: 'sx-dim' }, `${Math.round(m.latencyMs)} ms`),
        h('button', {
          className: 'sx-btn sm',
          title: '关闭监控',
          onClick: () => {
            // 记住了：这一次会话里连上新机器时不再自动弹出。
            state.monitorDismissed = true
            state.drawer = null
            notify()
          }
        }, '×')
      )
    ),
    h(
      'div',
      { className: 'sx-dbody' },
      !m && h('div', { className: 'sx-hint' }, err || '读取中…'),
      m &&
        h(
          globalThis.__dshSshTerminalReact.Fragment,
          null,
          h(Alerts, { list: alerts(m) }),
          err && h('div', { className: 'sx-malert err' }, err),

          // 主机信息：一眼看出这是哪台机器、什么系统、跑了多久。
          h(
            'div',
            { className: 'sx-minfo' },
            [m.info.os || '—', m.info.kernel, m.info.arch].filter(Boolean).join(' · '),
            h('span', { className: 'sx-dim' }, `已运行 ${uptime(m.uptime)}`)
          ),

          // 四张读数卡：两列，一屏看完不用下拉。
          h(
            'div',
            { className: 'sx-mgrid' },
            h(MeterCard, {
              title: 'CPU',
              value: `${m.cpu.toFixed(1)}%`,
              tone: level(m.cpu),
              values: histNow?.cpu ?? [m.cpu],
              max: 100,
              sub: `${m.cpuCores} 核 · 负载 ${m.load.map((x) => x.toFixed(2)).join(' / ')}`
            }),
            h(MeterCard, {
              title: '内存',
              value: `${memPct}%`,
              tone: level(memPct),
              values: histNow?.mem ?? [memPct],
              max: 100,
              sub: `${bytes(m.memUsed)} / ${bytes(m.memTotal)}`
            }),
            h(MeterCard, {
              title: 'Swap',
              value: m.swapTotal > 0 ? `${swapPct}%` : '未启用',
              tone: level(swapPct),
              values: histNow?.swap ?? [swapPct],
              max: 100,
              sub: m.swapTotal > 0 ? `${bytes(m.swapUsed)} / ${bytes(m.swapTotal)}` : '·'
            }),
            h(MeterCard, {
              title: '网络',
              value: `↓ ${rate(m.netDown)}`,
              values: histNow?.down ?? [m.netDown],
              sub: `↑ ${rate(m.netUp)}`
            }),
            // 磁盘 I/O 进四张主卡：这两项以前完全看不到，是监控与 LiteShell 的主要差距。
            h(MeterCard, {
              title: '磁盘 I/O',
              value: `读 ${rate(m.diskRead)}`,
              values: histNow?.diskRead ?? [m.diskRead],
              sub: `写 ${rate(m.diskWrite)}`
            })
          ),

          m.gpu.length > 0 &&
            h(
              Fold,
              { id: 'gpu', title: 'GPU', right: `${m.gpu.length} 张` },
              m.gpu.map((g, i) =>
                h(
                  'div',
                  { key: i, className: 'sx-mblock' },
                  h('div', { className: 'sx-mcard-t' }, h('span', null, g.name), h('b', { className: level(g.util) }, `${g.util}%`)),
                  h(Spark, { values: (histNow?.gpu?.[i] ?? [g.util]), max: 100, height: 30 }),
                  h(
                    'div',
                    { className: 'sx-mcard-sub' },
                    `显存 ${bytes(g.memUsed)} / ${bytes(g.memTotal)} · ${Math.round(g.temp)}℃`,
                    h('div', { className: 'sx-bar sm' }, h('i', { className: level(pct(g.memUsed, g.memTotal)), style: { width: `${pct(g.memUsed, g.memTotal)}%` } }))
                  )
                )
              )
            ),

          m.npu && m.npu.length > 0 &&            h(
              Fold,
              { id: 'npu', title: 'NPU', right: `${m.npu.length} 张` },
              m.npu.map((n) =>
                h(
                  'div',
                  { key: n.id, className: 'sx-mblock' },
                  h(
                    'div',
                    { className: 'sx-mcard-t' },
                    h('span', null, `#${n.id} ${n.name}`),
                    h('b', { className: level(n.util) }, `${n.util}%`)
                  ),
                  h(
                    'div',
                    { className: 'sx-mcard-sub' },
                    `${n.health} · ${Math.round(n.temp)}℃ · ${n.power}W`,
                    (n.hbmTotal > 0 || n.ddrTotal > 0) &&
                      h(
                        'div',
                        null,
                        n.hbmTotal > 0 ? `HBM ${bytes(n.hbmUsed)} / ${bytes(n.hbmTotal)}` : '',
                        n.ddrTotal > 0 ? ` · DDR ${bytes(n.ddrUsed)} / ${bytes(n.ddrTotal)}` : ''
                      )
                  )
                )
              )
            ),

          m.disk.length > 0 &&
            h(
              Fold,
              { id: 'disk', title: '磁盘', right: `${m.disk.length} 个挂载点` },
              m.disk.slice(0, 12).map((d) => {
                const p = pct(d.used, d.size)
                // 有速率就写出来；对不上块设备的（LVM / 网络盘）干脆不写，别显示一个假的 0。
                const io = d.read || d.write ? ` · 读 ${rate(d.read)} 写 ${rate(d.write)}` : ''
                return h(
                  'div',
                  { key: d.mount, className: 'sx-mblock' },
                  h('div', { className: 'sx-mcard-t' }, h('span', { title: d.fs }, d.mount), h('b', { className: level(p) }, `${p}%`)),
                  h('div', { className: 'sx-bar sm' }, h('i', { className: level(p), style: { width: `${p}%` } })),
                  h('div', { className: 'sx-mcard-sub' }, `${bytes(d.used)} / ${bytes(d.size)}${io}`)
                )
              })
            ),

          m.proc.length > 0 &&
            h(
              Fold,
              { id: 'proc', title: '进程（按 CPU）', right: `${m.proc.length} 个` },
              m.proc.slice(0, 10).map((p) => h(ProcRow, { key: p.pid, p }))
            ),

          ifaces.length > 0 &&
            h(
              Fold,
              { id: 'net', title: '网络', right: `↓ ${rate(m.netDown)} ↑ ${rate(m.netUp)}` },
              ifaces.map((n) =>
                h(
                  'div',
                  { key: n.name, className: 'sx-mblock' },
                  h('div', { className: 'sx-mcard-t' }, h('span', null, n.name), h('span', { className: 'sx-dim' }, `↓ ${rate(n.rx)} ↑ ${rate(n.tx)}`)),
                  h(Spark, { values: histNow?.ifaces?.get(n.name) ?? [n.rx + n.tx], max: netPeak, height: 28 }),
                  h(
                    'div',
                    { className: 'sx-mcard-sub' },
                    `累计 ${(m.netTotals ?? []).find((t) => t.name === n.name) ? `↓ ${bytes(m.netTotals.find((t) => t.name === n.name).rxBytes)} ↑ ${bytes(m.netTotals.find((t) => t.name === n.name).txBytes)}` : '—'}`
                  )
                )
              )
            ),

          // 磁盘 I/O：整机读写速率 + 每块盘的明细。读不到 diskstats（老内核、容器里
          // 没挂 /proc）时整块不出现，而不是给一排 0 让人以为磁盘不动。
          (m.diskIo?.length ?? 0) > 0 &&
            h(
              Fold,
              { id: 'diskio', title: '磁盘 I/O', right: `读 ${rate(m.diskRead)} 写 ${rate(m.diskWrite)}` },
              h(
                'div',
                { className: 'sx-mblock' },
                h(
                  'div',
                  { className: 'sx-mcard-t' },
                  h('span', null, '整机'),
                  h('span', { className: 'sx-dim' }, `读 ${rate(m.diskRead)} · 写 ${rate(m.diskWrite)}`)
                ),
                // 两条曲线共用刻度，否则读写各自的峰值会把对方压平成一条直线。
                h(Spark, { values: histNow?.diskRead ?? [m.diskRead], max: diskPeak, height: 28 }),
                h(Spark, { values: histNow?.diskWrite ?? [m.diskWrite], max: diskPeak, height: 28 })
              ),
              m.diskIo.map((d) =>
                h(
                  'div',
                  { key: d.name, className: 'sx-mblock' },
                  h('div', { className: 'sx-mcard-t' }, h('span', null, d.name), h('span', { className: 'sx-dim' }, `读 ${rate(d.read)} 写 ${rate(d.write)}`))
                )
              )
            )
        )
    )
  )
}
