/**
 * Durable-store access: the domain declaration and its record validators.
 *
 * An out-of-tree plugin cannot import `@deepseek-ai/dsh-storage-domain`, so the
 * spec object is built literally. That is sound because both helpers are
 * identity functions — `defineDomain` validates and returns its argument, and
 * `domainTable` returns `{ valueSchema }` — and the storage service only ever
 * calls `valueSchema.parse(raw)`. Providing a plain object with that one method
 * satisfies the durable boundary without a schema-library dependency.
 *
 * Both records share one table because they are written together, on the same
 * debounce, and read together by the same request. Splitting them would double
 * the write path to keep one snapshot consistent.
 *
 * @module vyra-tool-usage-stats/storage
 */

import type { FailureLog, ToolUsageState } from './counters.ts'

/**
 * Domain name; doubles as the backend unit name.
 *
 * Lowercase with no capital letters: the storage service validates every
 * domain name against `/^[a-z][a-z0-9_]*$/` and rejects the whole spec
 * otherwise, which would leave the plugin silently in-memory.
 */
export const DOMAIN_NAME = 'tool_usage'

/** Domain format version. */
export const DOMAIN_VERSION = 1

/** Declared table name inside the domain. */
export const TABLE_NAME = 'usage'

/** Key of the single record holding counters and the audit. */
export const SNAPSHOT_KEY = 'snapshot'

/**
 * Key 0.1.x stored its bare counter set under.
 *
 * Read only to migrate: an installation upgrading from 0.1.x has its history
 * there, and losing it would silently reset every total the user was reading.
 */
export const LEGACY_KEY = 'global'

/** One proposal awaiting a decision, as stored. */
interface StoredDiagnosis {
  readonly tool: string
  readonly diagnosis: string
  readonly evidence: string
  readonly change: {
    readonly kind: string
    readonly description?: string
    readonly parameters?: Record<string, unknown>
    readonly note?: string
  }
  readonly proposedAt: number
  readonly previousDescription: string
}

/** Everything one snapshot holds. */
export interface Snapshot {
  readonly counters: ToolUsageState
  readonly failures: FailureLog
  /**
   * Analysis history and pending proposals.
   *
   * Persisted because losing it would re-ask about failures already diagnosed,
   * spending a model request to learn the same answer.
   */
  readonly diagnosis?: {
    readonly history: Readonly<Record<string, { readonly analyzedAt: number; readonly failuresAtAnalysis: number }>>
    readonly pending: readonly StoredDiagnosis[]
    readonly lastRunAt: number
  }
}

/**
 * Validate a counter entry, throwing on anything unrecognized.
 * @param tool - the tool name the entry belongs to, for the error message.
 * @param entry - the value read from the medium.
 * @returns the same value, narrowed to an entry.
 * @throws TypeError when the value is not a counter entry.
 */
function parseEntry(tool: string, entry: unknown): ToolUsageState[string] {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new TypeError(`entry '${tool}' must be an object`)
  }
  const typed = entry as Record<string, unknown>
  for (const field of ['count', 'errorCount', 'lastUsedAt'] as const) {
    const value = typed[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new TypeError(`entry '${tool}'.${field} must be a non-negative number`)
    }
  }
  if (typeof typed.lastUsedDay !== 'string') {
    throw new TypeError(`entry '${tool}'.lastUsedDay must be a string`)
  }
  const daily = typed.daily
  if (typeof daily !== 'object' || daily === null || Array.isArray(daily)) {
    throw new TypeError(`entry '${tool}'.daily must be an object`)
  }
  for (const [day, calls] of Object.entries(daily as Record<string, unknown>)) {
    if (typeof calls !== 'number' || !Number.isFinite(calls) || calls < 0) {
      throw new TypeError(`entry '${tool}'.daily['${day}'] must be a non-negative number`)
    }
  }

  // Absent on records written before per-day failures were tracked, and absent
  // is honest: those days genuinely have no failure split, and treating them as
  // zero is the same answer the data supports.
  const dailyErrorsRaw = typed.dailyErrors ?? {}
  if (typeof dailyErrorsRaw !== 'object' || dailyErrorsRaw === null || Array.isArray(dailyErrorsRaw)) {
    throw new TypeError(`entry '${tool}'.dailyErrors must be an object`)
  }
  const dailyErrors: Record<string, number> = {}
  for (const [day, failures] of Object.entries(dailyErrorsRaw)) {
    if (typeof failures !== 'number' || !Number.isFinite(failures) || failures < 0) {
      throw new TypeError(`entry '${tool}'.dailyErrors['${day}'] must be a non-negative number`)
    }
    dailyErrors[day] = failures
  }

  return {
    count: typed.count as number,
    errorCount: typed.errorCount as number,
    lastUsedAt: typed.lastUsedAt as number,
    lastUsedDay: typed.lastUsedDay,
    daily: { ...(daily as Record<string, number>) },
    dailyErrors,
  }
}

/**
 * Validate a stored snapshot, throwing on anything unrecognized.
 *
 * Storage treats a throw as a record failure and applies the domain's
 * `invalidRecords` policy, so this never returns a partially valid snapshot: a
 * counter set that failed validation would silently corrupt every later total.
 *
 * A bare counter set — the shape 0.1.x wrote at {@link LEGACY_KEY} — is
 * accepted and wrapped, so an upgrade keeps the history the user was reading
 * instead of starting from zero.
 *
 * @param raw - the value read from the medium.
 * @returns the same value, narrowed to a snapshot.
 * @throws TypeError when the value is neither a snapshot nor a legacy counter set.
 */
export function parseSnapshot(raw: unknown): Snapshot {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('snapshot must be an object')
  }
  const typed = raw as Record<string, unknown>

  // A legacy value has no `counters` member and maps tool names straight to
  // entries; `failures` cannot exist because 0.1.x never recorded any.
  const counterSource = typed.counters === undefined ? typed : typed.counters
  if (typeof counterSource !== 'object' || counterSource === null || Array.isArray(counterSource)) {
    throw new TypeError('snapshot.counters must be an object')
  }
  const counters: ToolUsageState = {}
  for (const [tool, entry] of Object.entries(counterSource)) {
    counters[tool] = parseEntry(tool, entry)
  }

  const failuresRaw = typed.counters === undefined ? {} : (typed.failures ?? {})
  if (typeof failuresRaw !== 'object' || failuresRaw === null || Array.isArray(failuresRaw)) {
    throw new TypeError('snapshot.failures must be an object')
  }
  const failures: FailureLog = {}
  for (const [tool, samples] of Object.entries(failuresRaw)) {
    if (!Array.isArray(samples)) throw new TypeError(`snapshot.failures['${tool}'] must be an array`)
    failures[tool] = samples.map((sample, index) => {
      if (typeof sample !== 'object' || sample === null || Array.isArray(sample)) {
        throw new TypeError(`snapshot.failures['${tool}'][${index}] must be an object`)
      }
      const typedSample = sample as Record<string, unknown>
      if (typeof typedSample.at !== 'number' || typeof typedSample.summary !== 'string') {
        throw new TypeError(`snapshot.failures['${tool}'][${index}] needs a numeric 'at' and a string 'summary'`)
      }
      return {
        at: typedSample.at,
        summary: typedSample.summary,
        ...(typeof typedSample.code === 'string' ? { code: typedSample.code } : {}),
        tool,
      }
    })
  }

  return { counters, failures, ...diagnosisOf(typed) }
}

/**
 * Validate the optional diagnosis block.
 *
 * Absent on records written before diagnosis existed, and absent is honest:
 * those installations have no analysis history, so treating them as empty is
 * the same answer the data supports. A stored block that is malformed is
 * dropped rather than failing the whole snapshot — losing counters to a bad
 * proposal record would be the worse outcome.
 *
 * @param raw - the snapshot object read from the medium.
 * @returns the block to keep, or an empty object.
 */
function diagnosisOf(raw: Record<string, unknown>): { diagnosis?: Snapshot['diagnosis'] } {
  const block = raw.diagnosis
  if (typeof block !== 'object' || block === null || Array.isArray(block)) return {}
  const typed = block as Record<string, unknown>

  const history: Record<string, { analyzedAt: number; failuresAtAnalysis: number }> = {}
  if (typeof typed.history === 'object' && typed.history !== null && !Array.isArray(typed.history)) {
    for (const [tool, entry] of Object.entries(typed.history as Record<string, unknown>)) {
      if (typeof entry !== 'object' || entry === null) continue
      const record = entry as Record<string, unknown>
      if (typeof record.analyzedAt !== 'number' || typeof record.failuresAtAnalysis !== 'number') continue
      history[tool] = { analyzedAt: record.analyzedAt, failuresAtAnalysis: record.failuresAtAnalysis }
    }
  }

  const pending: StoredDiagnosis[] = []
  if (Array.isArray(typed.pending)) {
    for (const entry of typed.pending) {
      if (typeof entry !== 'object' || entry === null) continue
      const record = entry as Record<string, unknown>
      const change = record.change
      if (typeof record.tool !== 'string' || typeof change !== 'object' || change === null) continue
      const typedChange = change as Record<string, unknown>
      if (typeof typedChange.kind !== 'string') continue
      pending.push({
        tool: record.tool,
        diagnosis: typeof record.diagnosis === 'string' ? record.diagnosis : '',
        evidence: typeof record.evidence === 'string' ? record.evidence : '',
        change: {
          kind: typedChange.kind,
          ...(typeof typedChange.description === 'string' ? { description: typedChange.description } : {}),
          ...(typeof typedChange.parameters === 'object' && typedChange.parameters !== null
            ? { parameters: typedChange.parameters as Record<string, unknown> }
            : {}),
          ...(typeof typedChange.note === 'string' ? { note: typedChange.note } : {}),
        },
        proposedAt: typeof record.proposedAt === 'number' ? record.proposedAt : 0,
        previousDescription: typeof record.previousDescription === 'string' ? record.previousDescription : '',
      })
    }
  }

  return {
    diagnosis: {
      history,
      pending,
      lastRunAt: typeof typed.lastRunAt === 'number' ? typed.lastRunAt : 0,
    },
  }
}

/**
 * The domain declaration this plugin submits to `ctx.storageDomain.open`.
 *
 * `invalidRecords: 'backup-and-skip'` is the right policy here: counters are
 * derived data a later tool call regenerates, so one unreadable record must not
 * stop the plugin from loading.
 */
export const toolUsageDomain = {
  name: DOMAIN_NAME,
  version: DOMAIN_VERSION,
  invalidRecords: 'backup-and-skip',
  tables: {
    [TABLE_NAME]: {
      valueSchema: { parse: parseSnapshot },
    },
  },
} as const
