/**
 * Counter fold, event decoding, and aggregation, kept free of any Cordis
 * reference so the logic is testable without booting a context.
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
}

/** The counter set for one scope: a tool name maps to its counters. */
export type ToolUsageState = Record<string, ToolUsageEntry>

/**
 * Fold one observed result into the counter set.
 *
 * Entry objects are replaced rather than mutated, so a caller that serialized
 * an earlier state never sees it change underfoot — which matters because the
 * same value is handed to the durable store.
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
  daily[day] = (daily[day] ?? 0) + 1

  const days = Object.keys(daily).sort()
  while (days.length > retainDays) delete daily[days.shift()!]

  return {
    ...state,
    [toolName]: {
      count: (previous?.count ?? 0) + 1,
      errorCount: (previous?.errorCount ?? 0) + (isError ? 1 : 0),
      lastUsedAt: at,
      lastUsedDay: day,
      daily,
    },
  }
}

/**
 * Read the outcome flag from a `tool/result` payload.
 *
 * @param data - the event's `data` member.
 * @returns whether the recorded result was a failure.
 */
export function resultIsError(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const message = (data as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return false
  return (message as { isError?: unknown }).isError === true
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

/** A report over one or more counter sets. */
export interface ToolUsageReport {
  readonly rows: readonly ToolUsageRow[]
  readonly tools: number
  readonly calls: number
  readonly failures: number
}

/**
 * Merge counter sets into one report, summing matching tool names.
 *
 * Merging is what makes the session view and the global view the same code
 * path: a session report is one set, a global report is every set folded
 * together. Per-day buckets are not merged because neither view renders a
 * trend; `lastUsedAt` takes the maximum.
 *
 * @param states - the counter sets to merge.
 * @returns rows sorted by descending call count, then by name for stability.
 */
export function report(states: readonly ToolUsageState[]): ToolUsageReport {
  const merged = new Map<string, { count: number; errorCount: number; lastUsedAt: number }>()

  for (const state of states) {
    for (const [tool, entry] of Object.entries(state)) {
      const current = merged.get(tool)
      if (current === undefined) {
        merged.set(tool, { count: entry.count, errorCount: entry.errorCount, lastUsedAt: entry.lastUsedAt })
        continue
      }
      current.count += entry.count
      current.errorCount += entry.errorCount
      current.lastUsedAt = Math.max(current.lastUsedAt, entry.lastUsedAt)
    }
  }

  const rows = [...merged]
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
