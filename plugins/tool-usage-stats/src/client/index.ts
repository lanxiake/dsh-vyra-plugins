/**
 * Browser half: the tool-usage panel.
 *
 * Registered into `settings.section`, where a whole-machine report belongs —
 * the numbers span every session, so a per-session tab would present them in
 * the wrong place.
 *
 * Three things this panel must do, each for a reason:
 *
 * - **A window selector.** Cumulative counts answer "was this ever used";
 *   daily buckets answer "is it still in use". A cleanup decision needs the
 *   second, and reading the first as if it answered it deletes live tools.
 * - **Expandable failures.** A count says a tool failed; only the reason says
 *   what to fix.
 * - **A coverage line.** A window longer than the retained span is incomplete,
 *   and "nothing ran" must not be confused with "this data starts later".
 *
 * The client bundle is CommonJS and receives `react` from the browser bundle's
 * module map, so this file declares no dependency on it and cannot end up with
 * a second copy.
 *
 * @module vyra-tool-usage-stats/client
 */

declare const require: (specifier: string) => unknown

/** React's surface, typed loosely because the module arrives at runtime. */
type ReactModule = typeof import('react')

/** Read endpoint, matching the Host plugin's default. */
const ENDPOINT = '/api/vyra/tool-usage'

/** Export endpoint, matching the Host plugin's default. */
const EXPORT_ENDPOINT = '/api/vyra/tool-usage/export'

/** Refresh cadence while the panel is mounted. */
const REFRESH_MS = 5_000

/** One failure retained by the Host. */
interface FailureSample {
  tool: string
  at: number
  summary: string
  code?: string
}

/** One tool's row. */
interface ToolUsageRow {
  tool: string
  count: number
  errorCount: number
  errorRate: number
  lastUsedAt: number
}

/** A report over one scope. */
interface ToolUsageReport {
  rows: ToolUsageRow[]
  tools: number
  calls: number
  failures: number
}

/** Which days the daily buckets cover. */
interface Coverage {
  since: string | null
  until: string | null
  retentionDays: number
}

/** The Host's response body. */
interface StatsResponse {
  global: ToolUsageReport
  windows: Record<string, ToolUsageReport>
  sessions: Record<string, ToolUsageReport>
  failures: Record<string, FailureSample[]>
  coverage: Coverage
}

/** Client root context members this plugin uses. */
interface ClientContext {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => () => unknown
  }
  get: (name: string) => unknown
  effect: (callback: () => (() => unknown) | undefined) => unknown
}

/**
 * Read the current statistics from the Host.
 *
 * Uses the page's own `fetch` because the endpoint is same-origin under `/api`
 * and the browser attaches the session cookie itself. The `connection`
 * service's fetch takes a required `RequestInit`, and calling it without one
 * fails silently.
 *
 * @returns the report, or `undefined` when the request cannot be served.
 */
async function fetchStats(): Promise<StatsResponse | undefined> {
  try {
    const response = await globalThis.fetch(ENDPOINT, { credentials: 'include' })
    if (!response.ok) return undefined
    return await response.json() as StatsResponse
  } catch {
    // A statistics panel that fails to read must not break its page.
    return undefined
  }
}

/** Format a timestamp as `MM-DD HH:mm`, dropping the year within this year. */
function formatTime(at: number, withYear = false): string {
  if (at === 0) return '—'
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withYear || date.getFullYear() !== new Date().getFullYear()
    ? `${date.getFullYear()}-${md}`
    : md
}

/** Format a fraction as a percentage with one decimal. */
function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/** Windows the selector offers. */
const WINDOWS = [
  { value: '0', label: '累计' },
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
] as const

/** Sortable columns, in header order. */
const COLUMNS = [
  { key: 'tool', label: '工具', numeric: false },
  { key: 'count', label: '调用次数', numeric: true },
  { key: 'errorCount', label: '失败', numeric: true },
  { key: 'lastUsedAt', label: '最后使用', numeric: false },
] as const

/** One sortable column key. */
type SortKey = (typeof COLUMNS)[number]['key']

/** Shared cell styling. */
const CELL = { padding: '4px 0' } as const

/**
 * Build the panel component.
 *
 * @param React - the runtime React module.
 * @returns the component the slot renders.
 */
function createPanel(React: ReactModule): () => unknown {
  const h = React.createElement

  return function ToolUsagePanel(): unknown {
    const [data, setData] = React.useState<StatsResponse | undefined>(undefined)
    const [windowDays, setWindowDays] = React.useState(0)
    const [sortKey, setSortKey] = React.useState<SortKey>('count')
    const [ascending, setAscending] = React.useState(false)
    const [expanded, setExpanded] = React.useState<string | undefined>(undefined)

    React.useEffect(() => {
      let cancelled = false
      const refresh = (): void => {
        void fetchStats().then((next) => {
          if (cancelled) return
          setData(next)
        })
      }
      refresh()
      const timer = setInterval(refresh, REFRESH_MS)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [])

    const report: ToolUsageReport | undefined = data === undefined
      ? undefined
      : windowDays === 0
        ? data.global
        : data.windows[String(windowDays)]

    const rows = React.useMemo(() => {
      if (report === undefined) return []
      const sorted = [...report.rows]
      sorted.sort((left, right) => {
        const delta = sortKey === 'tool'
          ? left.tool.localeCompare(right.tool)
          : (left[sortKey] as number) - (right[sortKey] as number)
        return ascending ? delta : -delta
      })
      return sorted
    }, [report, sortKey, ascending])

    const sortBy = (key: SortKey): void => {
      if (key === sortKey) {
        setAscending(value => !value)
        return
      }
      setSortKey(key)
      setAscending(false)
    }

    if (data === undefined) return h('p', { style: { opacity: 0.7 } }, '正在读取工具用量…')

    const windowLabel = WINDOWS.find(option => Number(option.value) === windowDays)?.label ?? '累计'

    /** The toolbar: window selector, totals, export. */
    const toolbar = h('div', {
      style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' },
    },
      h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        '统计范围',
        h('select', {
          value: String(windowDays),
          onChange: (event: { target: { value: string } }) => { setWindowDays(Number(event.target.value)) },
          style: { padding: '3px 6px' },
        }, WINDOWS.map(option => h('option', { key: option.value, value: option.value }, option.label)))),
      h('a', {
        href: EXPORT_ENDPOINT,
        download: '',
        style: { marginLeft: 'auto', fontSize: '0.9em' },
      }, '导出 JSON'),
    )

    // A window longer than the recorded span is incomplete, and saying so is
    // the difference between "nothing ran" and "this data starts later".
    const coverageNote = data.coverage.since === null
      ? null
      : h('p', { style: { opacity: 0.6, fontSize: '0.85em', margin: '0 0 10px' } },
        `按日数据覆盖 ${data.coverage.since} 至 ${data.coverage.until}（保留 ${data.coverage.retentionDays} 天）`)

    if (report === undefined || report.tools === 0) {
      return h('div', { style: { padding: '16px' } }, toolbar, coverageNote,
        h('p', { style: { opacity: 0.7 } }, emptyText(windowDays, data.coverage)))
    }

    const header = COLUMNS.map(column => h('th', {
      key: column.key,
      onClick: () => { sortBy(column.key) },
      style: {
        textAlign: column.numeric ? 'right' : 'left',
        cursor: 'pointer',
        userSelect: 'none',
        paddingBottom: '4px',
        whiteSpace: 'nowrap',
      },
    }, `${column.label}${column.key === sortKey ? (ascending ? ' ↑' : ' ↓') : ''}`))

    const body = rows.flatMap((row) => {
      const samples = data.failures[row.tool] ?? []
      const open = expanded === row.tool
      const cells = h('tr', { key: row.tool },
        h('td', { style: { ...CELL, fontFamily: 'monospace' } }, row.tool),
        h('td', { style: { ...CELL, textAlign: 'right' } }, String(row.count)),
        h('td', { style: { ...CELL, textAlign: 'right' } },
          row.errorCount === 0
            ? '—'
            : h('button', {
              type: 'button',
              onClick: () => { setExpanded(open ? undefined : row.tool) },
              disabled: samples.length === 0,
              title: samples.length === 0 ? '没有保留的失败记录' : '展开查看失败原因',
              style: {
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: samples.length === 0 ? 'default' : 'pointer',
                color: 'inherit',
                textDecoration: samples.length === 0 ? 'none' : 'underline dotted',
              },
            }, `${row.errorCount}${open ? ' ▾' : ' ▸'}`)),
        h('td', { style: CELL }, formatTime(row.lastUsedAt)))

      if (!open || samples.length === 0) return [cells]

      // Only the failures say what to fix; the count alone never does.
      const detail = h('tr', { key: `${row.tool}-detail` },
        h('td', { colSpan: COLUMNS.length, style: { padding: '6px 0 10px 16px' } },
          h('div', { style: { fontSize: '0.85em', opacity: 0.85, display: 'grid', gap: '5px' } },
            samples.map((sample, index) => h('div', {
              key: `${sample.at}-${index}`,
              style: { display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '8px', alignItems: 'baseline' },
            },
            h('span', { style: { opacity: 0.7, whiteSpace: 'nowrap' } }, formatTime(sample.at, true)),
            sample.code === undefined
              ? h('span')
              : h('code', { style: { opacity: 0.75, fontSize: '0.95em' } }, sample.code),
            h('span', { style: { wordBreak: 'break-word' } }, sample.summary))))))
      return [cells, detail]
    })

    return h('div', { style: { padding: '16px' } },
      toolbar,
      coverageNote,
      h('p', { style: { opacity: 0.7, margin: '0 0 8px' } },
        `${report.tools} 个工具 · ${windowLabel}共 ${report.calls} 次调用`
        + (report.failures > 0 ? ` · ${report.failures} 次失败` : '')),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' } },
        h('thead', null, h('tr', null, header)),
        h('tbody', null, body)))
  }
}

/**
 * Explain an empty result honestly.
 *
 * Two causes look identical in the data and mean opposite things: nothing has
 * run, or the window reaches past what the daily buckets retain.
 *
 * @param windowDays - the selected window, 0 for cumulative.
 * @param coverage - which days the buckets hold.
 * @returns the message to show.
 */
function emptyText(windowDays: number, coverage: Coverage): string {
  if (windowDays === 0) return '还没有任何工具调用记录——先让 Agent 干点活。'
  if (coverage.since === null) {
    return `最近 ${windowDays} 天没有工具调用记录。按日统计需要先有调用才会开始累积。`
  }
  return `最近 ${windowDays} 天没有工具调用记录。按日数据最早只到 ${coverage.since}，更早的历史在「累计」里。`
}

/**
 * Register the Settings section.
 * @param ctx - the client root context.
 */
export function apply(ctx: ClientContext): void {
  const React = require('react') as ReactModule
  const Panel = createPanel(React)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'vyra-tool-usage',
    order: 50,
    label: () => '工具用量',
  }, Panel))
}

/** Required services: the slot registry this section registers into. */
export const inject = ['slots']
