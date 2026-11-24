/**
 * Browser half: the tool-usage panel.
 *
 * Registered into `settings.section`, where a whole-machine report belongs —
 * the numbers span every session, so a per-session tab would present them in
 * the wrong place.
 *
 * Two things this panel must do, each for a reason:
 *
 * - **A window selector.** Cumulative counts answer "was this ever used";
 *   daily buckets answer "is it still in use". A cleanup decision needs the
 *   second, and reading the first as if it answered it deletes live tools.
 * - **Copyable evidence.** A count says a tool failed; only the reason says what
 *   to fix. The selected tools' statistics and failure samples go to the
 *   clipboard, so the model that can act on them is the one already in the
 *   conversation, with its own context.
 *
 * Styling uses the theme's own semantic tokens, so the panel follows light and
 * dark with the rest of the interface. A fallback follows each token: an
 * out-of-tree plugin cannot rely on the theme being mounted, and a panel that
 * renders invisible text is worse than one that renders plain text.
 *
 * @module dsh-vyra-tool-usage-stats/client
 */

declare const require: (specifier: string) => unknown

/** React's surface, typed loosely because the module arrives at runtime. */
type ReactModule = typeof import('react')

/** Read endpoint, matching the Host plugin's default. */
const ENDPOINT = '/api/vyra/tool-usage'

/** How often the panel re-reads. */
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

// ── Palette ─────────────────────────────────────────────────────────────────
//
// Read through the theme's semantic aliases so the panel follows the interface
// into dark mode. Each has a literal fallback because an out-of-tree plugin
// cannot assume the theme is mounted.

/** `var(--token, fallback)` for a themed value. */
function token(name: string, fallback: string): string {
  return `var(--dsw-alias-${name}, ${fallback})`
}

const C = {
  text: token('label-primary', '#1f2328'),
  textSecondary: token('label-secondary', '#57606a'),
  textTertiary: token('label-tertiary', '#6e7781'),
  danger: token('state-error-primary', '#cf222e'),
  dangerSoft: token('state-error-secondary', '#fff1f0'),
  warn: token('state-warn-primary', '#9a6700'),
  submission: token('state-success-primary', '#1a7f37'),
  border: token('border-l2', '#d8dee4'),
  borderSoft: token('border-l1', '#eaeef2'),
  card: token('card-fill', '#ffffff'),
  cardHover: token('card-fill-hover', '#f6f8fa'),
  surface: token('bg-layer-2', '#f6f8fa'),
  accent: token('brand-primary', '#2f6feb'),
  onAccent: token('label-on-color', '#ffffff'),
  code: token('markdown-inline-code', '#f0f3f6'),
} as const

/** Shared type roles, so sizes and weights stay consistent across the panel. */
const T = {
  caption: { fontSize: '11px', lineHeight: '16px' },
  body: { fontSize: '13px', lineHeight: '20px' },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px' },
} as const

/** A bordered container, the panel's primary grouping. */
const CARD = {
  border: `1px solid ${C.borderSoft}`,
  borderRadius: '8px',
  background: C.card,
  padding: '12px 14px',
  marginBottom: '10px',
} as const

/** A small capsule label. */
function pill(background: string, color: string): Record<string, string> {
  return {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: '999px',
    background,
    color,
    fontSize: '11px',
    lineHeight: '17px',
    fontWeight: '500',
  }
}

/** A text button, styled to sit inline. */
function textButton(color: string): Record<string, string> {
  return {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color,
    font: 'inherit',
    textDecoration: 'none',
  }
}

/** The primary action button. */
const PRIMARY_BUTTON = {
  border: 'none',
  borderRadius: '6px',
  padding: '5px 14px',
  cursor: 'pointer',
  background: C.accent,
  color: C.onAccent,
  fontSize: '12px',
  fontWeight: '600',
} as const

/** A secondary action button. */
const GHOST_BUTTON = {
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  padding: '4px 12px',
  cursor: 'pointer',
  background: 'transparent',
  color: C.text,
  fontSize: '12px',
} as const

/** Format a timestamp as `MM-DD HH:mm`, adding the year when it differs. */
function formatTime(at: number): string {
  if (at === 0) return '—'
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return date.getFullYear() !== new Date().getFullYear() ? `${date.getFullYear()}-${md}` : md
}

/** Format a fraction as a percentage with one decimal. */
function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Call the Host.
 *
 * @param path - endpoint path.
 * @param init - request options.
 * @returns the parsed body, or `undefined` on any failure.
 */
async function call(path: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await globalThis.fetch(path, { credentials: 'include', ...init })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { detail?: string }
      return { ok: false, detail: body.detail ?? `HTTP ${response.status}` }
    }
    return await response.json()
  } catch (error) {
    return { ok: false, detail: String(error) }
  }
}

/** Windows the selector offers. */
const WINDOWS = [
  { value: '0', label: '所有' },
  { value: '30', label: '最近 30 天' },
  { value: '7', label: '最近 7 天' },
  { value: '3', label: '最近 3 天' },
  { value: '1', label: '今天' },
] as const

/**
 * The windows the host must answer, as the query that asks for them.
 *
 * The host answers only the windows a request names, and its default
 * (`[7, 30]`) is narrower than this selector. Asking for every window offered
 * here is what keeps "最近 3 天" and "今天" from being permanently empty.
 */
const WINDOW_QUERY = WINDOWS
  .filter(option => option.value !== '0')
  .map(option => `window=${option.value}`)
  .join('&')

/** Sortable columns, in header order. */
const COLUMNS = [
  { key: 'tool', label: '工具', numeric: false, width: '34%' },
  { key: 'count', label: '调用', numeric: true, width: '16%' },
  { key: 'errorCount', label: '失败', numeric: true, width: '20%' },
  { key: 'lastUsedAt', label: '最后使用', numeric: false, width: '30%' },
] as const

/** One sortable column key. */
type SortKey = (typeof COLUMNS)[number]['key']

/**
 * Build the panel.
 *
 * @param React - the runtime React module.
 * @returns the component the slot renders.
 */
function createPanel(React: ReactModule): () => unknown {
  const h = React.createElement

  return function ToolAnalysisPanel(): unknown {
    const [data, setData] = React.useState<StatsResponse | undefined>(undefined)
    // The panel opens on the recent window: "what did my tools do lately" is
    // the question it exists to answer, and the cumulative totals are one
    // selection away.
    const [windowDays, setWindowDays] = React.useState(3)
    const [sortKey, setSortKey] = React.useState<SortKey>('count')
    const [ascending, setAscending] = React.useState(false)
    const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set())
    const [expanded, setExpanded] = React.useState<string | undefined>(undefined)
    const [notice, setNotice] = React.useState<string | undefined>(undefined)
    const [copied, setCopied] = React.useState(false)

    const refresh = React.useCallback((): void => {
      void call(`${ENDPOINT}?${WINDOW_QUERY}`).then((body) => {
        if (body !== undefined && typeof body === 'object' && 'global' in (body as object)) {
          setData(body as StatsResponse)
        }
      })
    }, [])

    React.useEffect(() => {
      refresh()
      const timer = setInterval(refresh, REFRESH_MS)
      return () => clearInterval(timer)
    }, [refresh])

    if (data === undefined) {
      return h('div', { style: { padding: '20px', color: C.textSecondary, ...T.body } }, '正在读取工具用量…')
    }

    const report = windowDays === 0 ? data.global : data.windows[String(windowDays)]
    const windowLabel = WINDOWS.find(option => Number(option.value) === windowDays)?.label ?? '所有'
    const failuresFor = (tool: string): FailureSample[] => data.failures[tool] ?? []

    const rows = [...(report?.rows ?? [])].sort((left, right) => {
      const delta = sortKey === 'tool'
        ? left.tool.localeCompare(right.tool)
        : (left[sortKey] as number) - (right[sortKey] as number)
      return ascending ? delta : -delta
    })

    const sortBy = (key: SortKey): void => {
      if (key === sortKey) {
        setAscending(value => !value)
        return
      }
      setSortKey(key)
      setAscending(false)
    }

    // The selection holds tool names rather than rows, so a refresh that
    // reorders or drops rows cannot leave it pointing at a row that is gone.
    const selectedRows = rows.filter(row => selected.has(row.tool))
    const toggle = (tool: string): void => {
      setSelected((current) => {
        const next = new Set(current)
        if (next.has(tool)) next.delete(tool)
        else next.add(tool)
        return next
      })
    }
    const allSelected = rows.length > 0 && rows.every(row => selected.has(row.tool))
    const toggleAll = (): void => { setSelected(allSelected ? new Set() : new Set(rows.map(row => row.tool))) }

    // ── Copy ────────────────────────────────────────────────────────────────
    //
    // The plugin used to ask a model itself, which needed a live session, a
    // configured model, and three numbers deciding when asking was worth it.
    // Handing the text over instead removes all of them: the model that can act
    // on it is the one already in the conversation, with its own context.

    const buildCopyText = (): string => {
      const parts: string[] = [
        '请分析下面这些工具调用失败，找出反复出错的原因，并给出具体的修复建议。',
        '',
        `统计范围：${windowLabel}`,
      ]
      for (const row of selectedRows) {
        parts.push(
          '',
          `## ${row.tool}`,
          `调用 ${row.count} 次，失败 ${row.errorCount} 次（${percent(row.errorRate)}），最后使用 ${formatTime(row.lastUsedAt)}`,
        )
        const samples = failuresFor(row.tool)
        if (samples.length === 0) {
          parts.push('（没有保留的失败记录）')
          continue
        }
        parts.push('最近的失败：')
        for (const sample of samples) {
          const code = sample.code === undefined ? '' : ` [${sample.code}]`
          parts.push(`- ${formatTime(sample.at)}${code} ${sample.summary}`)
        }
      }
      return parts.join('\n')
    }

    const copySelected = (): void => {
      if (selectedRows.length === 0) return
      const text = buildCopyText()
      setNotice(undefined)
      // A clipboard write rejects on an insecure origin, so a refusal offers the
      // text as a download rather than appearing to have done nothing.
      void globalThis.navigator?.clipboard?.writeText(text).then(
        () => {
          setCopied(true)
          setTimeout(() => { setCopied(false) }, 2_000)
        },
        () => { setNotice(`剪贴板不可用，已下载为 ${downloadText(text, 'tool-usage-failures.txt')}`) },
      )
    }

    // ── Toolbar ─────────────────────────────────────────────────────────────

    const toolbar = h('div', {
      style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' },
    },
      h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', color: C.textSecondary, ...T.body } },
        '统计范围',
        h('select', {
          value: String(windowDays),
          onChange: (event: { target: { value: string } }) => { setWindowDays(Number(event.target.value)) },
          style: {
            padding: '3px 8px',
            borderRadius: '6px',
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.text,
            font: 'inherit',
          },
        }, WINDOWS.map(option => h('option', { key: option.value, value: option.value }, option.label)))),
      h('a', {
        href: `${ENDPOINT}/export`,
        download: '',
        style: { marginLeft: 'auto', color: C.accent, ...textButton(C.accent) },
      }, '导出 JSON'))

    // ── Actions ─────────────────────────────────────────────────────────────
    //
    // Above the table, where the work starts: pick what looks wrong, then take
    // its evidence somewhere a model can see it. The buttons do not move when a
    // selection changes, because nothing below them changes what they do.

    const actionBar = h('div', {
      style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' },
    },
    h('button', {
      type: 'button',
      disabled: selectedRows.length === 0,
      onClick: copySelected,
      style: { ...PRIMARY_BUTTON, opacity: selectedRows.length === 0 ? 0.5 : 1 },
    }, copied ? '已复制' : `复制错误日志（${selectedRows.length}）`),
    h('span', { style: { color: C.textTertiary, ...T.caption } },
      selectedRows.length === 0
        ? '勾选下面的工具，把它们的失败记录和分析提示词复制走，粘贴到对话里让模型处理。'
        : '粘贴到对话输入框即可。'))

    // ── Coverage ────────────────────────────────────────────────────────────
    //
    // A window longer than the recorded span is incomplete, and saying so is the
    // difference between "nothing ran" and "this data starts later".

    const coverageNote = data.coverage.since === null
      ? null
      : h('div', { style: { color: C.textTertiary, marginBottom: '10px', ...T.caption } },
        `按日数据覆盖 ${data.coverage.since} 至 ${data.coverage.until}（保留 ${data.coverage.retentionDays} 天）`)

    const noticeBar = notice === undefined
      ? null
      : h('div', {
        style: {
          marginBottom: '10px',
          padding: '8px 10px',
          borderRadius: '6px',
          background: C.surface,
          color: C.textSecondary,
          ...T.caption,
        },
      }, notice)

    // ── Table ───────────────────────────────────────────────────────────────

    const header = COLUMNS.map(column => h('th', {
      key: column.key,
      onClick: () => { sortBy(column.key) },
      style: {
        textAlign: column.numeric ? 'right' : 'left',
        cursor: 'pointer',
        userSelect: 'none',
        paddingBottom: '6px',
        paddingRight: column.numeric ? '14px' : 0,
        whiteSpace: 'nowrap',
        color: C.textSecondary,
        fontWeight: '500',
        ...T.caption,
      },
    }, `${column.label}${column.key === sortKey ? (ascending ? ' ↑' : ' ↓') : ''}`))

    const body = rows.flatMap((row) => {
      const samples = failuresFor(row.tool)
      const open = expanded === row.tool

      const cells = h('tr', { key: row.tool },
        h('td', {
          style: {
            padding: '5px 0 5px 2px',
            borderTop: `1px solid ${C.borderSoft}`,
            color: C.text,
            ...T.mono,
          },
        },
        h('input', {
          type: 'checkbox',
          checked: selected.has(row.tool),
          onChange: () => { toggle(row.tool) },
          style: { marginRight: '8px', cursor: 'pointer', verticalAlign: 'middle' },
          'aria-label': `选择 ${row.tool}`,
        }),
        row.tool),
        h('td', {
          style: {
            padding: '5px 14px 5px 0',
            borderTop: `1px solid ${C.borderSoft}`,
            textAlign: 'right',
            color: C.text,
            ...T.body,
          },
        }, String(row.count)),
        h('td', {
          style: {
            padding: '5px 14px 5px 0',
            borderTop: `1px solid ${C.borderSoft}`,
            textAlign: 'right',
            ...T.body,
          },
        },
        row.errorCount === 0
          ? h('span', { style: { color: C.textTertiary } }, '—')
          : h('button', {
            type: 'button',
            onClick: () => { setExpanded(open ? undefined : row.tool) },
            disabled: samples.length === 0,
            title: samples.length === 0 ? '没有保留的失败记录' : '展开查看失败原因',
            style: {
              ...textButton(C.danger),
              color: C.danger,
              cursor: samples.length === 0 ? 'default' : 'pointer',
            },
          }, `${row.errorCount} (${percent(row.errorRate)}) ${samples.length === 0 ? '' : open ? '▾' : '▸'}`)),
        h('td', {
          style: {
            padding: '5px 0',
            borderTop: `1px solid ${C.borderSoft}`,
            color: C.textSecondary,
            ...T.body,
          },
        }, formatTime(row.lastUsedAt)))

      if (!open || samples.length === 0) return [cells]

      // Only the failures say what to fix; the count alone never does.
      const detail = h('tr', { key: `${row.tool}-detail` },
        h('td', {
          colSpan: COLUMNS.length + 1,
          style: { padding: '0 0 10px 16px', background: C.surface },
        },
        h('div', { style: { display: 'grid', gap: '5px', paddingTop: '8px' } },
          samples.map((sample, index) => (
            h('div', {
              key: `${sample.at}-${index}`,
              style: { display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '10px', alignItems: 'baseline' },
            },
            h('span', { style: { color: C.textTertiary, whiteSpace: 'nowrap', ...T.caption } }, formatTime(sample.at)),
            sample.code === undefined
              ? h('span')
              : h('code', { style: { color: C.warn, whiteSpace: 'nowrap', ...T.mono } }, sample.code),
            h('span', { style: { color: C.textSecondary, wordBreak: 'break-word', ...T.mono } }, sample.summary))
          )))))

      return [cells, detail]
    })

    // ── Empty states ────────────────────────────────────────────────────────
    //
    // Two causes look identical in the data and mean opposite things: nothing
    // has run, or the window reaches past what the daily buckets retain.

    if (report === undefined || report.tools === 0) {
      return h('div', { style: { padding: '20px' } },
        toolbar,
        actionBar,
        coverageNote,
        noticeBar,
        h('div', { style: { color: C.textSecondary, marginBottom: '14px', ...T.body } },
          emptyText(windowDays, data.coverage)))
    }

    return h('div', { style: { padding: '20px' } },
      toolbar,
      actionBar,
      coverageNote,
      noticeBar,
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'baseline', marginBottom: '8px' } },
        h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', color: C.textTertiary, cursor: 'pointer', ...T.caption } },
          h('input', {
            type: 'checkbox',
            checked: allSelected,
            onChange: toggleAll,
            style: { cursor: 'pointer' },
            'aria-label': '选择全部',
          }),
          '全选'),
        h('span', { style: { color: C.text, fontWeight: '600', ...T.body } },
          `${report.tools} 个工具`),
        h('span', { style: { color: C.textTertiary, ...T.caption } },
          `${windowLabel} · ${report.calls} 次调用`
          + (report.failures > 0 ? ` · ${report.failures} 次失败` : ''))),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' } },
        h('colgroup', null, COLUMNS.map(column => h('col', { key: column.key, style: { width: column.width } }))),
        h('thead', null, h('tr', null, header)),
        h('tbody', null, body)))
  }
}

/**
 * Offer `text` as a download, for a clipboard that refused.
 * @param text - the document.
 * @param name - the file name to offer.
 * @returns the file name, so the caller can name it in its message.
 */
function downloadText(text: string, name: string): string {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
  return name
}

/**
 * Explain an empty result honestly.
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
  return `最近 ${windowDays} 天没有工具调用记录。按日数据最早只到 ${coverage.since}，更早的历史在「所有」里。`
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
    label: () => '工具分析',
  }, Panel))
}

/** Required services: the slot registry this section registers into. */
export const inject = ['slots']
