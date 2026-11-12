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

/** Everything one snapshot holds. */
export interface Snapshot {
  readonly counters: ToolUsageState
  readonly failures: FailureLog
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
  return {
    count: typed.count as number,
    errorCount: typed.errorCount as number,
    lastUsedAt: typed.lastUsedAt as number,
    lastUsedDay: typed.lastUsedDay,
    daily: { ...(daily as Record<string, number>) },
  }
}

/**
 * Validate a stored snapshot, throwing on anything unrecognized.
 *
 * Storage treats a throw as a record failure and applies the domain's
 * `invalidRecords` policy, so this never returns a partially valid snapshot: a
 * counter set that failed validation would silently corrupt every later total.
 *
 * @param raw - the value read from the medium.
 * @returns the same value, narrowed to a snapshot.
 * @throws TypeError when the value is not a snapshot.
 */
function parseSnapshot(raw: unknown): Snapshot {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('snapshot must be an object')
  }
  const typed = raw as Record<string, unknown>

  const countersRaw = typed.counters
  if (typeof countersRaw !== 'object' || countersRaw === null || Array.isArray(countersRaw)) {
    throw new TypeError('snapshot.counters must be an object')
  }
  const counters: ToolUsageState = {}
  for (const [tool, entry] of Object.entries(countersRaw)) {
    counters[tool] = parseEntry(tool, entry)
  }

  const failuresRaw = typed.failures ?? {}
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

  return { counters, failures }
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
