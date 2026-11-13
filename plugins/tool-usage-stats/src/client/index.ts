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
 * - **Proposals with a decision.** A diagnosis the user cannot act on is just
 *   another wall of text.
 *
 * Styling uses the theme's own semantic tokens, so the panel follows light and
 * dark with the rest of the interface. A fallback follows each token: an
 * out-of-tree plugin cannot rely on the theme being mounted, and a panel that
 * renders invisible text is worse than one that renders plain text.
 *
 * @module vyra-tool-usage-stats/client
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

/** One proposal awaiting a decision. */
interface PendingDiagnosis {
  tool: string
  diagnosis: string
  evidence: string
  change: {
    kind: 'description' | 'parameters' | 'implementation'
    description?: string
    parameters?: Record<string, unknown>
    note?: string
  }
  proposedAt: number
  previousDescription: string
}

/** One change already applied. */
interface AppliedChange {
  tool: string
  before: { description: string; parameters: Record<string, unknown> }
  appliedAt: number
  kind: string
}

/** The Host's response body. */
interface StatsResponse {
  global: ToolUsageReport
  windows: Record<string, ToolUsageReport>
  sessions: Record<string, ToolUsageReport>
  failures: Record<string, FailureSample[]>
  coverage: Coverage
  diagnosis: {
    pending: PendingDiagnosis[]
    applied: AppliedChange[]
    lastRunAt: number
    analyzing: boolean
    settings: { analyzeEveryHours: number; minFailures: number; cooldownDays: number }
  }
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
  { value: '0', label: '累计' },
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
] as const

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

  return function ToolUsagePanel(): unknown {
    const [data, setData] = React.useState<StatsResponse | undefined>(undefined)
    const [windowDays, setWindowDays] = React.useState(0)
    const [sortKey, setSortKey] = React.useState<SortKey>('count')
    const [ascending, setAscending] = React.useState(false)
    const [expanded, setExpanded] = React.useState<string | undefined>(undefined)
    const [busy, setBusy] = React.useState<string | undefined>(undefined)
    const [notice, setNotice] = React.useState<string | undefined>(undefined)

    const refresh = React.useCallback((): void => {
      void call(ENDPOINT).then((body) => {
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

    /** Ask the Host to run a diagnosis in the session that owns the page. */
    const analyze = (sessionId: string | undefined): void => {
      setBusy('analyze')
      setNotice(undefined)
      void call(`${ENDPOINT}/diagnose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).then((result) => {
        const typed = result as { ok?: boolean; detail?: string; targets?: string[] }
        setBusy(undefined)
        setNotice(typed.ok === true
          ? `已请求分析：${(typed.targets ?? []).join('、')}。结果会出现在当前会话里。`
          : typed.detail ?? '请求失败')
        refresh()
      })
    }

    /** Apply one proposal. */
    const apply = (tool: string): void => {
      setBusy(tool)
      setNotice(undefined)
      void call(`${ENDPOINT}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool }),
      }).then((result) => {
        const typed = result as { ok?: boolean; detail?: string; applied?: string }
        setBusy(undefined)
        setNotice(typed.ok === true ? `已应用 ${tool} 的${typed.applied === 'description' ? '描述' : '参数'}改动` : typed.detail ?? '应用失败')
        refresh()
      })
    }

    /** Drop one proposal. */
    const dismiss = (tool: string): void => {
      setBusy(tool)
      void call(`${ENDPOINT}/dismiss`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool }),
      }).then(() => {
        setBusy(undefined)
        refresh()
      })
    }

    if (data === undefined) {
      return h('div', { style: { padding: '20px', color: C.textSecondary, ...T.body } }, '正在读取工具用量…')
    }

    const report = windowDays === 0 ? data.global : data.windows[String(windowDays)]
    const windowLabel = WINDOWS.find(option => Number(option.value) === windowDays)?.label ?? '累计'

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

    const failuresFor = (tool: string): FailureSample[] => data.failures[tool] ?? []

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

    // ── Coverage ────────────────────────────────────────────────────────────
    //
    // A window longer than the recorded span is incomplete, and saying so is the
    // difference between "nothing ran" and "this data starts later".

    const coverageNote = data.coverage.since === null
      ? null
      : h('div', { style: { color: C.textTertiary, marginBottom: '10px', ...T.caption } },
        `按日数据覆盖 ${data.coverage.since} 至 ${data.coverage.until}（保留 ${data.coverage.retentionDays} 天）`)

    // ── Proposals ───────────────────────────────────────────────────────────
    //
    // The point of the whole plugin: a diagnosis the user can act on.

    /** The pending list, or nothing when there is none. */
    const proposals = (): unknown => {
      if (data.diagnosis.pending.length === 0) return null
      return h('div', { style: { marginBottom: '14px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
          h('span', { style: { fontWeight: '600', color: C.text, ...T.body } }, '改进建议'),
          h('span', { style: pill(C.dangerSoft, C.danger) }, `${data.diagnosis.pending.length} 条待处理`)),
        data.diagnosis.pending.map(proposal => proposalCard(proposal)))
    }

    /** One proposal, with the before/after and its two actions. */
    const proposalCard = (proposal: PendingDiagnosis): unknown => {
      const kindLabel = proposal.change.kind === 'description'
        ? '改描述'
        : proposal.change.kind === 'parameters' ? '改参数' : '改实现'
      const working = busy === proposal.tool

      const diff = proposal.change.description === undefined
        ? null
        : h('div', {
          style: {
            background: C.surface,
            border: `1px solid ${C.borderSoft}`,
            borderRadius: '6px',
            padding: '8px 10px',
            marginBottom: '8px',
          },
        },
        h('div', { style: { color: C.textTertiary, marginBottom: '4px', ...T.caption } }, '当前描述'),
        h('div', { style: { color: C.textSecondary, marginBottom: '8px', whiteSpace: 'pre-wrap', ...T.mono } },
          proposal.previousDescription || '（空）'),
        h('div', { style: { color: C.textTertiary, marginBottom: '4px', ...T.caption } }, '建议改为'),
        h('div', { style: { color: C.text, whiteSpace: 'pre-wrap', ...T.mono } }, proposal.change.description))

      const needsHuman = proposal.change.kind === 'implementation'
        ? h('div', { style: { color: C.warn, marginBottom: '8px', ...T.caption } },
          `实现改动需要人工完成：${proposal.change.note ?? ''}`)
        : null

      return h('div', { key: proposal.tool, style: CARD },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
          h('code', { style: { color: C.text, fontWeight: '600', ...T.mono } }, proposal.tool),
          h('span', { style: pill(C.surface, C.textSecondary) }, kindLabel)),
        h('div', { style: { color: C.text, marginBottom: '6px', ...T.body } }, proposal.diagnosis),
        h('div', { style: { color: C.textTertiary, marginBottom: '8px', ...T.caption } }, `依据：${proposal.evidence}`),
        needsHuman,
        diff,
        h('div', { style: { display: 'flex', gap: '8px' } },
          h('button', {
            type: 'button',
            disabled: working || needsHuman !== null,
            onClick: () => { apply(proposal.tool) },
            style: { ...PRIMARY_BUTTON, opacity: working ? 0.6 : 1 },
          }, working ? '应用中…' : '应用'),
          h('button', {
            type: 'button',
            disabled: working,
            onClick: () => { dismiss(proposal.tool) },
            style: GHOST_BUTTON,
          }, '忽略')))
    }

    // ── Applied ─────────────────────────────────────────────────────────────

    /** What has already been changed, newest first. */
    const appliedList = (): unknown => {
      if (data.diagnosis.applied.length === 0) return null
      return h('div', { style: { marginBottom: '14px' } },
        h('div', { style: { color: C.textTertiary, marginBottom: '6px', ...T.caption } }, '已应用的改动'),
        data.diagnosis.applied.slice(0, 5).map(change => h('div', {
          key: `${change.tool}-${change.appliedAt}`,
          style: { color: C.textSecondary, ...T.caption },
        }, `${formatTime(change.appliedAt)} · ${change.tool} · ${change.kind === 'description' ? '描述' : '参数'}`)))
    }

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
            padding: '5px 0',
            borderTop: `1px solid ${C.borderSoft}`,
            color: C.text,
            ...T.mono,
          },
        }, row.tool),
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
      // Only the failures say what to fix; the count alone never does.
      const detail = h('tr', { key: `${row.tool}-detail` },
        h('td', {
          colSpan: COLUMNS.length,
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

    // ── Analysis actions ────────────────────────────────────────────────────

    const analysisBar = h('div', {
      style: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: '4px',
        paddingTop: '12px',
        borderTop: `1px solid ${C.borderSoft}`,
      },
    },
      h('button', {
        type: 'button',
        disabled: busy === 'analyze' || data.diagnosis.analyzing,
        onClick: () => { analyze(undefined) },
        style: { ...PRIMARY_BUTTON, opacity: busy === 'analyze' ? 0.6 : 1 },
      }, busy === 'analyze' || data.diagnosis.analyzing ? '分析中…' : '立即分析'),
      h('span', { style: { color: C.textTertiary, ...T.caption } },
        data.diagnosis.lastRunAt === 0
          ? '还没有分析过'
          : `上次分析 ${formatTime(data.diagnosis.lastRunAt)}`))

    /**
     * The settings card.
     *
     * Editable here rather than only in YAML because these three numbers are the
     * difference between "asks too often and burns tokens" and "never asks" —
     * and the person who can judge that is looking at this table, not at a
     * profile patch.
     */
    const settingsCard = h('div', { style: { ...CARD, marginTop: '12px' } },
      h('div', { style: { fontWeight: '600', color: C.text, marginBottom: '10px', ...T.body } }, '自动分析设置'),
      h('div', { style: { display: 'grid', gap: '10px' } },
        settingRow('自动检查间隔', 'analyzeEveryHours', data.diagnosis.settings.analyzeEveryHours,
          '小时。0 = 关闭自动分析，只用「立即分析」。'),
        settingRow('触发门槛', 'minFailures', data.diagnosis.settings.minFailures,
          '新增失败达到几次才值得诊断。'),
        settingRow('冷却天数', 'cooldownDays', data.diagnosis.settings.cooldownDays,
          '同一个工具隔几天才能再分析一次。')))

    /** One labelled number input that writes on blur. */
    function settingRow(label: string, key: string, value: number, hint: string): unknown {
      return h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 80px 1fr', gap: '10px', alignItems: 'center' } },
        h('span', { style: { color: C.textSecondary, whiteSpace: 'nowrap', ...T.body } }, label),
        h('input', {
          type: 'number',
          defaultValue: String(value),
          min: key === 'minFailures' ? '1' : '0',
          disabled: busy === 'config',
          onBlur: (event: { target: { value: string } }) => {
            const next = Number(event.target.value)
            if (!Number.isFinite(next) || next === value) return
            setBusy('config')
            setNotice(undefined)
            void call(`${ENDPOINT}/config`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ [key]: next }),
            }).then((result) => {
              const typed = result as { ok?: boolean; detail?: string }
              setBusy(undefined)
              setNotice(typed.ok === true
                ? '设置已保存，插件会重新加载'
                : typed.detail ?? '保存失败')
              refresh()
            })
          },
          style: {
            padding: '4px 8px',
            borderRadius: '6px',
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.text,
            font: 'inherit',
          },
        }),
        h('span', { style: { color: C.textTertiary, ...T.caption } }, hint))
    }

    const noticeBar = notice === undefined
      ? null
      : h('div', {
        style: {
          marginTop: '8px',
          padding: '8px 10px',
          borderRadius: '6px',
          background: C.surface,
          color: C.textSecondary,
          ...T.caption,
        },
      }, notice)

    // ── Empty states ────────────────────────────────────────────────────────
    //
    // Two causes look identical in the data and mean opposite things: nothing
    // has run, or the window reaches past what the daily buckets retain.

    if (report === undefined || report.tools === 0) {
      return h('div', { style: { padding: '20px' } },
        toolbar,
        coverageNote,
        h('div', { style: { color: C.textSecondary, marginBottom: '14px', ...T.body } },
          emptyText(windowDays, data.coverage)),
        analysisBar,
        settingsCard,
        noticeBar)
    }

    return h('div', { style: { padding: '20px' } },
      toolbar,
      coverageNote,
      proposals(),
      appliedList(),
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'baseline', marginBottom: '8px' } },
        h('span', { style: { color: C.text, fontWeight: '600', ...T.body } },
          `${report.tools} 个工具`),
        h('span', { style: { color: C.textTertiary, ...T.caption } },
          `${windowLabel} · ${report.calls} 次调用`
          + (report.failures > 0 ? ` · ${report.failures} 次失败` : ''))),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' } },
        h('colgroup', null, COLUMNS.map(column => h('col', { key: column.key, style: { width: column.width } }))),
        h('thead', null, h('tr', null, header)),
        h('tbody', null, body)),
      analysisBar,
      settingsCard,
      noticeBar)
  }
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
