/**
 * Counter fold, event decoding, failure summarization, and aggregation.
 *
 * Kept free of any Cordis reference so the logic is testable without booting a
 * context.
 *
 * @module vyra-tool-usage-stats/counters
 */

/** Day key used by the daily buckets, in local time as `YYYY-MM-DD`. */
export function dayKey(at: number): string {
  const date = new Date(at)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Cumulative and daily counters for one tool. */
export interface ToolUsageEntry {
  /** Calls since this counter was first created, including failures. */
  count: number
  /** Calls whose recorded result carried `isError`. */
  errorCount: number
  /** Epoch milliseconds of the most recent call. */
  lastUsedAt: number
  /** `YYYY-MM-DD` of the most recent call, matching its daily bucket. */
  lastUsedDay: string
  /** Per-day call counts, keyed `YYYY-MM-DD`. */
  daily: Record<string, number>
  /**
   * Per-day failure counts, keyed `YYYY-MM-DD`.
   *
   * Split from {@link daily} because a windowed read must report the failures
   * that happened inside the window. Showing the cumulative failure count in a
   * short window overstates it; showing nothing claims the tool never failed,
   * which is worse — the user is looking at the column precisely to find out.
   */
  dailyErrors: Record<string, number>
}

/** The counter set: a tool name maps to its counters. */
export type ToolUsageState = Record<string, ToolUsageEntry>

/**
 * Longest failure summary retained.
 *
 * A count alone answers "how often did this fail" and cannot answer "why" —
 * which is the only question worth asking when deciding how to fix a tool. The
 * summary is capped so an audit trail cannot grow without bound.
 */
export const FAILURE_SUMMARY_MAX_CHARS = 300

/** Failures retained per tool, newest first. */
export const FAILURE_SAMPLES_PER_TOOL = 20

/** One retained failure. */
export interface FailureSample {
  /** Epoch milliseconds of the failure. */
  at: number
  /** Single-line, truncated reason. */
  summary: string
  /** Failure identity when the tool threw a `HarnessError`. */
  code?: string
  /** Tool that failed. */
  tool: string
}

/** The failure audit: tool name to its most recent failures. */
export type FailureLog = Record<string, FailureSample[]>

/**
 * Collapse whitespace and truncate a failure reason.
 *
 * Collapsing to one line is not only about size: attribution groups by the
 * reason text, and a multi-line reason splits one failure class into several
 * groups that should have been counted together.
 *
 * @param text - the raw reason.
 * @returns a single-line summary, at most {@link FAILURE_SUMMARY_MAX_CHARS} characters.
 */
export function summarize(text: string, max = FAILURE_SUMMARY_MAX_CHARS): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`
}

/**
 * Fold one observed result into the counter set.
 *
 * Entry objects are replaced rather than mutated, so a caller that serialized
 * an earlier state never sees it change underfoot.
 *
 * @param state - the current counter set.
 * @param toolName - the model-visible tool name that ran.
 * @param isError - whether the recorded result was a failure.
 * @param at - epoch milliseconds of the observation.
 * @param retainDays - daily buckets to keep per tool.
 * @returns the updated counter set.
 */
export function record(
  state: ToolUsageState,
  toolName: string,
  isError: boolean,
  at: number,
  retainDays: number,
): ToolUsageState {
  const previous = state[toolName]
  const day = dayKey(at)
  const daily: Record<string, number> = { ...(previous?.daily ?? {}) }
  const dailyErrors: Record<string, number> = { ...(previous?.dailyErrors ?? {}) }
  daily[day] = (daily[day] ?? 0) + 1
  if (isError) dailyErrors[day] = (dailyErrors[day] ?? 0) + 1

  const days = Object.keys(daily).sort()
  while (days.length > retainDays) {
    const oldest = days.shift()!
    delete daily[oldest]
    delete dailyErrors[oldest]
  }

  return {
    ...state,
    [toolName]: {
      count: (previous?.count ?? 0) + 1,
      errorCount: (previous?.errorCount ?? 0) + (isError ? 1 : 0),
      lastUsedAt: at,
      lastUsedDay: day,
      daily,
      dailyErrors,
    },
  }
}

/**
 * Append one failure to the audit, keeping the newest samples per tool.
 *
 * @param log - the current audit.
 * @param sample - the failure to retain.
 * @param keep - samples to retain per tool.
 * @returns the updated audit.
 */
export function recordFailure(
  log: FailureLog,
  sample: FailureSample,
  keep = FAILURE_SAMPLES_PER_TOOL,
): FailureLog {
  const existing = log[sample.tool] ?? []
  return { ...log, [sample.tool]: [sample, ...existing].slice(0, keep) }
}

/**
 * Read a tool result's outcome and pairing id.
 *
 * The pairing id lives on the result message, not on the event: a `tool/result`
 * payload is `{ turn, step, message, error?, meta? }` and the message carries
 * `toolCallId`.
 *
 * @param data - the event's `data` member.
 * @returns the call id and whether the result was a failure, or `undefined`.
 */
export function readResult(data: unknown): { callId: string; isError: boolean } | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const message = (data as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return undefined
  const callId = (message as { toolCallId?: unknown }).toolCallId
  if (typeof callId !== 'string') return undefined
  return { callId, isError: (message as { isError?: unknown }).isError === true }
}

/**
 * Extract the human-readable reason a failed call reports.
 *
 * Two paths reach a failure and both must be read. A tool that *returns* a
 * failed result carries its reason in the model-facing content; a tool that
 * *throws* carries it in the event's `error` member. Reading only one path
 * leaves whole failure classes unattributable — the exact gap that made a
 * historical `web_search` count of 181 failures undiagnosable.
 *
 * @param data - the event's `data` member.
 * @param result - the failure identity parsed from the event, when present.
 * @returns the summary and error code, either possibly empty.
 */
export function failureDetail(
  data: unknown,
  result: { isError: boolean },
): { summary: string; code?: string } {
  if (!result.isError) return { summary: '' }

  const payload = data as {
    message?: { content?: unknown }
    error?: { name?: unknown; code?: unknown; reason?: unknown }
  }

  // A thrown HarnessError states its own reason; that is the most specific text
  // available and it is outside model content by design.
  const error = payload.error
  const code = typeof error?.code === 'string' ? error.code : undefined
  const reason = typeof error?.reason === 'string' ? error.reason : ''

  // Otherwise take the model-facing content the tool produced.
  let fromContent = ''
  const content = payload.message?.content
  if (Array.isArray(content)) {
    const text = content
      .filter((block): block is { type: string; text: string } =>
        typeof block === 'object' && block !== null
        && (block as { type?: unknown }).type === 'text'
        && typeof (block as { text?: unknown }).text === 'string')
      .map(block => block.text)
      .join(' ')
    fromContent = text
  }

  const chosen = reason || fromContent
  const summary = chosen === '' ? '工具返回失败结果（无正文）' : summarize(chosen)
  return code === undefined ? { summary } : { summary, code }
}

/**
 * Find the tool name a result belongs to.
 *
 * `tool/call` carries the name and `tool/result` carries the outcome, paired by
 * `callId`. A result whose call was never observed — a resumed session whose
 * earlier calls predate this process — reports `undefined` rather than
 * attributing the call to the wrong tool.
 *
 * @param names - the live callId-to-name map for one session.
 * @param callId - the result's pairing id.
 * @returns the tool name, or `undefined` when the call was not observed.
 */
export function takeName(names: Map<string, string>, callId: string): string | undefined {
  const found = names.get(callId)
  names.delete(callId)
  return found
}

/** One tool's row in a rendered report. */
export interface ToolUsageRow {
  readonly tool: string
  readonly count: number
  readonly errorCount: number
  /** `errorCount / count`, or 0 for a tool that never ran. */
  readonly errorRate: number
  readonly lastUsedAt: number
}

/** A report over a set of counters. */
export interface ToolUsageReport {
  readonly rows: readonly ToolUsageRow[]
  readonly tools: number
  readonly calls: number
  readonly failures: number
}

/**
 * Build a report from one counter set.
 *
 * @param state - the counters to report.
 * @returns rows sorted by descending call count, then by name for stability.
 */
export function report(state: ToolUsageState): ToolUsageReport {
  const rows = Object.entries(state)
    .map(([tool, entry]) => ({
      tool,
      count: entry.count,
      errorCount: entry.errorCount,
      errorRate: entry.count === 0 ? 0 : entry.errorCount / entry.count,
      lastUsedAt: entry.lastUsedAt,
    }))
    .sort((left, right) => right.count - left.count || left.tool.localeCompare(right.tool))

  return {
    rows,
    tools: rows.length,
    calls: rows.reduce((sum, row) => sum + row.count, 0),
    failures: rows.reduce((sum, row) => sum + row.errorCount, 0),
  }
}

/**
 * Restrict a counter set to the last `days` days, using the daily buckets.
 *
 * A windowed read must come from the daily buckets, never from the cumulative
 * counters. Cumulative totals include history from before the window, so
 * presenting them as "recently used" answers a different question than the one
 * asked — the failure mode that made a cleanup decision delete a tool still in
 * use.
 *
 * @param state - the full counter set.
 * @param days - window length in days, including today.
 * @param from - epoch milliseconds the window is measured back from.
 * @returns counters containing only calls inside the window.
 */
export function windowed(state: ToolUsageState, days: number, from: number): ToolUsageState {
  if (days <= 0) return state
  const dayMs = 24 * 60 * 60 * 1000
  const cutoff = dayKey(from - (days - 1) * dayMs)

  const out: ToolUsageState = {}
  for (const [tool, entry] of Object.entries(state)) {
    let count = 0
    let errorCount = 0
    let lastUsedAt = 0
    for (const [day, calls] of Object.entries(entry.daily)) {
      if (day < cutoff) continue
      count += calls
      errorCount += entry.dailyErrors?.[day] ?? 0
      if (entry.lastUsedAt > lastUsedAt) lastUsedAt = entry.lastUsedAt
    }
    if (count === 0) continue
    out[tool] = {
      count,
      errorCount,
      lastUsedAt,
      lastUsedDay: dayKey(lastUsedAt),
      daily: {},
      dailyErrors: {},
    }
  }
  return out
}

/** The window a report covers. */
export interface Coverage {
  /** Earliest day any daily bucket holds, `YYYY-MM-DD`, or null when empty. */
  readonly since: string | null
  /** Latest day any daily bucket holds, `YYYY-MM-DD`, or null when empty. */
  readonly until: string | null
  /** Days the daily buckets retain. */
  readonly retentionDays: number
}

/**
 * Report which days the daily buckets actually cover.
 *
 * A window longer than the retained span is incomplete, and saying so is the
 * difference between "nothing ran" and "this data starts later".
 *
 * @param state - the counter set.
 * @param retentionDays - the configured retention.
 * @returns the covered span.
 */
export function coverage(state: ToolUsageState, retentionDays: number): Coverage {
  let since: string | null = null
  let until: string | null = null
  for (const entry of Object.values(state)) {
    for (const day of Object.keys(entry.daily)) {
      if (since === null || day < since) since = day
      if (until === null || day > until) until = day
    }
  }
  return { since, until, retentionDays }
}
