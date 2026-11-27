/**
 * 面板的状态与两件小东西：命令面板、日志面板。
 *
 * 与主界面分开的原因：它们各自有独立的开关、独立的查询词，混进 state.js 只会让那个
 * 文件越来越难读；而它们又都要读写 state（往终端里塞命令、看连接日志），所以只依赖
 * state 与 sessions 两个模块，不反向被它们依赖。
 */
import { hostReact } from './react.js'
import { h } from './jsx-shim.js'
import { searchPalette } from './palette.js'
import { activeSession, activate, closeSession, cycleTab, reloadTree } from './sessions.js'
import { editConnection, notify, state } from './state.js'
import { APP_KEYS, SHELL_KEYS } from './shortcut-table.js'

/* ── 命令面板 ────────────────────────────────────────────────────────────── */

let palette = false
let paletteQuery = ''
export const paletteOpen = () => palette
export const setPaletteOpen = (on) => {
  palette = Boolean(on)
  if (palette) paletteQuery = ''
  notify()
}

/* ── 日志 ────────────────────────────────────────────────────────────────── */

let logs = false
/** @type {{at: number, text: string, kind: 'info'|'error'|'auto'}[]} */
const lines = []
export const logOpen = () => logs
export const setLogOpen = (on) => {
  logs = Boolean(on)
  notify()
}
/** 记一条日志。connectionId 用来按连接分组。 */
export function pushLog(connectionId, text, kind = 'info') {
  lines.push({ at: Date.now(), text: String(text), kind, connectionId })
  if (lines.length > 500) lines.shift()
  if (logs) notify()
}
export const logLines = () => lines
export function clearLog() {
  lines.length = 0
  notify()
}

/* ── 视图 ────────────────────────────────────────────────────────────────── */

/** 命令面板：搜索、点一条填进命令行（**不执行**）。 */
export function CommandPalette() {
  const [q, setQ] = globalThis.__dshSshTerminalReact.useState(paletteQuery)
  globalThis.__dshSshTerminalReact.useEffect(() => {
    if (palette) {
      setQ('')
      paletteQuery = ''
    }
  }, [palette])
  if (!palette) return null
  const rows = searchPalette(q)
  const fill = (cmd) => {
    const s = activeSession()
    if (!s || s.status !== 'ready') return
    // 填进命令行而不执行：复杂命令先看一眼再回车更稳妥
    s.term.paste(cmd)
    setPaletteOpen(false)
    s.term.focus()
  }
  return h(
    'div',
    { className: 'sx-overlay', onMouseDown: (e) => e.target === e.currentTarget && setPaletteOpen(false) },
    h(
      'div',
      { className: 'sx-dialog sx-palette' },
      h('input', {
        className: 'sx-input',
        autoFocus: true,
        placeholder: '搜索命令（命令名 / 说明 / 分组都能搜）…',
        value: q,
        onInput: (e) => (setQ(e.target.value), (paletteQuery = e.target.value)),
        onKeyDown: (e) => {
          if (e.key === 'Escape') setPaletteOpen(false)
          // 有搜索词时回车填第一条，省一次点击
          if (e.key === 'Enter' && rows.length) fill(rows[0].cmd)
        },
      }),
      h(
        'div',
        { className: 'sx-pal-list' },
        rows.length
          ? rows.map((r, i) =>
              h(
                'div',
                { key: `${r.group}-${i}`, className: 'sx-pal-row', title: r.cmd, onClick: () => fill(r.cmd) },
                h('span', { className: 'sx-pal-group' }, r.group),
                h('code', { className: 'sx-pal-cmd' }, r.cmd),
                h('span', { className: 'sx-pal-hint' }, r.hint)
              )
            )
          : h('div', { className: 'sx-hint' }, '没有匹配的命令')
      ),
      h('div', { className: 'sx-pal-foot' }, '点击填入命令行（不执行）· Enter 填第一条 · Esc 关闭')
    )
  )
}

/* ── 命令历史 ────────────────────────────────────────────────────────────── */

let history = false
let historyQuery = ''
export const historyOpen = () => history
export const setHistoryOpen = (on) => {
  history = Boolean(on)
  if (history) historyQuery = ''
  notify()
}

/** 日志面板：每条连接的操作与错误按时间排。 */
export function LogPanel() {
  if (!logs) return null
  const all = logLines()
  const s = activeSession()
  const mine = s ? all.filter((l) => l.connectionId === s.connId) : all
  return h(
    'div',
    { className: 'sx-overlay', onMouseDown: (e) => e.target === e.currentTarget && setLogOpen(false) },
    h(
      'div',
      { className: 'sx-dialog wide' },
      h('div', { className: 'sx-dtitle2' }, '日志'),
      h(
        'div',
        { className: 'sx-log' },
        mine.length
          ? mine.map((l, i) =>
              h(
                'div',
                { key: i, className: `sx-log-row ${l.kind}` },
                h('span', { className: 'sx-log-time' }, new Date(l.at).toLocaleTimeString()),
                h('span', { className: 'sx-log-text' }, l.text)
              )
            )
          : h('div', { className: 'sx-hint' }, '还没有记录。连接、命令与错误都会记在这里。')
      ),
      h(
        'div',
        { className: 'sx-dbtns' },
        h('button', { className: 'sx-btn', onClick: clearLog }, '清空'),
        h('button', { className: 'sx-btn', onClick: () => navigator.clipboard?.writeText(mine.map((l) => `${new Date(l.at).toISOString()} ${l.text}`).join('\n')) }, '复制'),
        h('button', { className: 'sx-btn pri', onClick: () => setLogOpen(false) }, '关闭')
      )
    )
  )
}

/**
 * 命令历史：带过滤，点一条填进命令行（**不执行**）。
 *
 * 历史一直在存（sessions.js 每次回车都记一条），但以前没有任何界面能看它——
 * 存了读不回来，等于没存。
 */
export function HistoryPanel() {
  const [q, setQ] = globalThis.__dshSshTerminalReact.useState(historyQuery)
  if (!history) return null
  const s = activeSession()
  const all = s?.history ?? []
  const rows = all.filter((c) => !q.trim() || String(c).includes(q.trim())).slice().reverse()
  const fill = (cmd) => {
    const cur = activeSession()
    if (!cur || cur.status !== 'ready') return
    // 填进命令行而不回车：历史里的命令多半要改了参数再用
    cur.term.paste(cmd)
    setHistoryOpen(false)
    cur.term.focus()
  }
  return h(
    'div',
    { className: 'sx-overlay', onMouseDown: (e) => e.target === e.currentTarget && setHistoryOpen(false) },
    h(
      'div',
      { className: 'sx-dialog wide' },
      h('div', { className: 'sx-dtitle2' }, '命令历史'),
      h('input', {
        className: 'sx-input',
        autoFocus: true,
        placeholder: '过滤…',
        value: q,
        onInput: (e) => ((historyQuery = e.target.value), setQ(e.target.value)),
        onKeyDown: (e) => {
          if (e.key === 'Escape') setHistoryOpen(false)
          if (e.key === 'Enter' && rows.length) fill(rows[0])
        },
      }),
      h(
        'div',
        { className: 'sx-log' },
        rows.length
          ? rows.slice(0, 500).map((c, i) =>
              h('div', { key: i, className: 'sx-log-row', title: c, style: { cursor: 'pointer' }, onClick: () => fill(c) },
                h('code', { className: 'sx-log-text' }, c))
            )
          : h('div', { className: 'sx-hint' }, all.length ? '没有匹配的命令' : '这条连接还没有历史命令')
      ),
      h('div', { className: 'sx-pal-foot' }, '点击填入命令行（不执行）· Enter 填第一条 · Esc 关闭')
    )
  )
}

/* ── 快捷键一览 ──────────────────────────────────────────────────────────── */

let help = false
export const helpOpen = () => help
export const setHelpOpen = (on) => {
  help = Boolean(on)
  notify()
}

/**
 * 快捷键表。纯数据放在 shortcut-table.js 里：面板要渲染它，测试也要能直接断言，
 * 挂在这里会把 sessions / xterm 一起拖进纯 node 测试。
 */
export { APP_KEYS, SHELL_KEYS } from './shortcut-table.js'

const keyRow = (keys, what, i) =>
  h(
    'div',
    { key: i, className: 'sx-key-row' },
    h('span', { className: 'sx-key-keys' }, ...String(keys).split(' / ').flatMap((one, j) => (j ? [' / ', h('kbd', { key: j }, one)] : [h('kbd', { key: 0 }, one)]))),
    h('span', { className: 'sx-key-what' }, what)
  )

/** 快捷键一览。 */
export function ShortcutsPanel() {
  if (!help) return null
  return h(
    'div',
    { className: 'sx-overlay', onMouseDown: (e) => e.target === e.currentTarget && setHelpOpen(false) },
    h(
      'div',
      { className: 'sx-dialog wide' },
      h('div', { className: 'sx-dtitle2' }, '快捷键'),
      h('div', { className: 'sx-keys-title' }, '本插件'),
      h('div', { className: 'sx-keys' }, APP_KEYS.map(([k, w], i) => keyRow(k, w, i))),
      h('div', { className: 'sx-keys-title' }, '终端里交给远端 shell（本插件不拦）'),
      h('div', { className: 'sx-keys' }, SHELL_KEYS.map(([k, w], i) => keyRow(k, w, i))),
      h('div', { className: 'sx-dbtns' }, h('button', { className: 'sx-btn pri', autoFocus: true, onClick: () => setHelpOpen(false) }, '知道了'))
    )
  )
}

/** 全局快捷键。在 terminal 里时不抢 shell 自己的键（都是带 Shift/Ctrl 的组合）。 */
export function installShortcuts() {
  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    // 终端里有些组合属于远端 shell（Ctrl+C 中断、Ctrl+R 反向搜索…），我们一律不接。
    // 这里只判断「焦点在终端里」，具体让不让由各个分支自己决定。
    const inTerm = !!document.activeElement?.closest?.('.xterm')
    const key = e.key.toLowerCase()

    // Ctrl+Shift+K / Ctrl+L(非终端) → 清屏
    if (e.shiftKey && key === 'k') {
      e.preventDefault()
      activeSession()?.term?.clear?.()
      return
    }
    if (e.shiftKey && key === 'h') {
      e.preventDefault()
      setHistoryOpen(!history)
      return
    }
    // Ctrl+/ → 快捷键一览
    if (key === '/' || e.code === 'Slash') {
      e.preventDefault()
      setHelpOpen(!help)
      return
    }
    if (e.shiftKey && key === 'a') {
      e.preventDefault()
      state.aiOpen = !state.aiOpen
      notify()
      return
    }
    if (e.shiftKey && key === 'm') {
      e.preventDefault()
      state.drawer = state.drawer === 'monitor' ? null : 'monitor'
      notify()
      return
    }
    if (e.shiftKey && key === 'b') {
      e.preventDefault()
      state.drawer = state.drawer === 'files' ? null : 'files'
      notify()
      return
    }
    if (e.shiftKey && key === 'w') {
      e.preventDefault()
      const s = activeSession()
      if (s) closeSession(s)
      return
    }
    // Ctrl+Tab / Ctrl+Shift+Tab → 切换标签
    if (key === 'tab') {
      e.preventDefault()
      cycleTab(e.shiftKey ? -1 : 1)
      return
    }
    // Ctrl+1 … 9 → 跳到第 N 个标签
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault()
      const target = state.sessions[Number(e.key) - 1]
      if (target) activate(target)
      return
    }
    if (key === 't') {
      // Ctrl+T 在终端里不是 shell 的键，可以安全占用。
      e.preventDefault()
      void editConnection(null, null).then((ok) => ok && reloadTree())
      return
    }
    // Ctrl+K → 命令面板（不带 Shift，与 Ctrl+Shift+K 清屏区分开）
    if (!e.shiftKey && key === 'k') {
      e.preventDefault()
      setPaletteOpen(!palette)
      return
    }
    if (e.shiftKey && key === 'l') {
      e.preventDefault()
      setLogOpen(!logs)
      return
    }
    // 终端里 Ctrl+R 归 shell（反向搜索），其余地方才给历史面板。
    if (!e.shiftKey && key === 'r' && !inTerm) {
      e.preventDefault()
      setHistoryOpen(!history)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
