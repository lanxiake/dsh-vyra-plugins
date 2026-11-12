/**
 * Browser half: a Settings section showing per-tool usage.
 *
 * Registered into `settings.section`, where a whole-machine report belongs —
 * the numbers span every session, so a per-session tab would present them in
 * the wrong place. The section reads the Host endpoint registered by
 * `src/index.ts` through the page's authenticated connection.
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

/** Endpoint path below `/api`, matching the Host plugin's default. */
const ENDPOINT = '/api/vyra/tool-usage'

/** Refresh cadence while the section is mounted. */
const REFRESH_MS = 5_000

/** One tool's row as the Host reports it. */
interface ToolUsageRow {
  tool: string
  count: number
  errorCount: number
  errorRate: number
  lastUsedAt: number
}

/** One report: rows plus totals. */
interface ToolUsageReport {
  rows: ToolUsageRow[]
  tools: number
  calls: number
  failures: number
}

/** The Host's response body. */
interface StatsResponse {
  global: ToolUsageReport
  sessions: Record<string, ToolUsageReport>
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
 * service's fetch takes a required `RequestInit` and its absence fails
 * silently, so depending on it here would trade a working path for a fragile
 * one.
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

/** Format a timestamp as a short relative age. */
function relativeAge(at: number, now: number): string {
  if (at === 0) return '—'
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.round(days / 30)}mo ago`
}

/** Format a fraction as a percentage with one decimal. */
function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/** Sortable column keys, in header order. */
const COLUMNS = [
  { key: 'tool', label: 'Tool', numeric: false },
  { key: 'count', label: 'Calls', numeric: true },
  { key: 'errorRate', label: 'Failures', numeric: true },
  { key: 'lastUsedAt', label: 'Last used', numeric: false },
] as const

/** One sortable column key. */
type SortKey = (typeof COLUMNS)[number]['key']

/**
 * Build the section component.
 *
 * @param React - the runtime React module.
 * @param ctx - the client root context.
 * @returns the component the slot renders.
 */
function createSection(React: ReactModule, ctx: ClientContext): () => unknown {
  const h = React.createElement

  return function ToolUsageSection(): unknown {
    const [data, setData] = React.useState<StatsResponse | undefined>(undefined)
    const [now, setNow] = React.useState(() => Date.now())
    const [sortKey, setSortKey] = React.useState<SortKey>('count')
    const [ascending, setAscending] = React.useState(false)

    React.useEffect(() => {
      let cancelled = false
      const refresh = (): void => {
        void fetchStats().then((next) => {
          if (cancelled) return
          setData(next)
          setNow(Date.now())
        })
      }
      refresh()
      const timer = setInterval(refresh, REFRESH_MS)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    }, [])

    const rows = React.useMemo(() => {
      if (data === undefined) return []
      const sorted = [...data.global.rows]
      sorted.sort((left, right) => {
        const delta = sortKey === 'tool'
          ? left.tool.localeCompare(right.tool)
          : (left[sortKey] as number) - (right[sortKey] as number)
        return ascending ? delta : -delta
      })
      return sorted
    }, [data, sortKey, ascending])

    const sortBy = (key: SortKey): void => {
      if (key === sortKey) {
        setAscending(value => !value)
        return
      }
      setSortKey(key)
      setAscending(false)
    }

    if (data === undefined) {
      return h('p', { style: { opacity: 0.7 } }, 'Reading tool usage…')
    }

    if (data.global.tools === 0) {
      return h('p', { style: { opacity: 0.7 } }, 'No tool calls recorded yet.')
    }

    const header = COLUMNS.map(column => h('th', {
      key: column.key,
      onClick: () => { sortBy(column.key) },
      style: {
        textAlign: column.numeric ? 'right' : 'left',
        cursor: 'pointer',
        userSelect: 'none',
        paddingBottom: '4px',
      },
    }, `${column.label}${column.key === sortKey ? (ascending ? ' ↑' : ' ↓') : ''}`))

    const body = rows.map(row => h('tr', { key: row.tool },
      h('td', { style: { padding: '3px 0' } }, row.tool),
      h('td', { style: { textAlign: 'right' } }, String(row.count)),
      h('td', { style: { textAlign: 'right' } },
        row.errorCount === 0 ? '—' : `${row.errorCount} (${percent(row.errorRate)})`),
      h('td', null, relativeAge(row.lastUsedAt, now))))

    return h('div', { style: { padding: '16px' } },
      h('p', { style: { opacity: 0.7, marginTop: 0 } },
        `${data.global.tools} tool${data.global.tools === 1 ? '' : 's'} · `
        + `${data.global.calls} call${data.global.calls === 1 ? '' : 's'} · `
        + `${data.global.failures} failure${data.global.failures === 1 ? '' : 's'}`),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' } },
        h('thead', null, h('tr', null, header)),
        h('tbody', null, body)))
  }
}

/**
 * Register the Settings section.
 * @param ctx - the client root context.
 */
export function apply(ctx: ClientContext): void {
  const React = require('react') as ReactModule
  const Section = createSection(React, ctx)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'vyra-tool-usage',
    order: 50,
    label: () => 'Tool usage',
  }, Section))
}

/** Required services: the slot registry this section registers into. */
export const inject = ['slots']
