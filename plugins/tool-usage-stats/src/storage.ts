/**
 * Durable-store access: the domain declaration and its record validator.
 *
 * An out-of-tree plugin cannot import `@deepseek-ai/dsh-storage-domain`, so the
 * spec object is built literally. That is sound because both helpers are
 * identity functions — `defineDomain` validates and returns its argument, and
 * `domainTable` returns `{ valueSchema }` — and the storage service only ever
 * calls `valueSchema.parse(raw)`. Providing a plain object with that one method
 * therefore satisfies the durable boundary without a schema-library dependency.
 *
 * @module vyra-tool-usage-stats/storage
 */

import type { ToolUsageState } from './counters.ts'

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

/** Key of the single global counter record. */
export const GLOBAL_KEY = 'global'

/**
 * Validate a stored counter set, throwing on anything unrecognized.
 *
 * Storage treats a throw as a record failure and applies the domain's
 * `invalidRecords` policy, so this never returns a partially valid set: a
 * counter set that failed validation would silently corrupt every later total.
 *
 * @param raw - the value read from the medium.
 * @returns the same value, narrowed to a counter set.
 * @throws TypeError when the value is not a counter set.
 */
function parseState(raw: unknown): ToolUsageState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('tool usage state must be an object')
  }
  const state: ToolUsageState = {}
  for (const [tool, entry] of Object.entries(raw)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new TypeError(`tool usage entry '${tool}' must be an object`)
    }
    const typed = entry as Record<string, unknown>
    for (const field of ['count', 'errorCount', 'lastUsedAt'] as const) {
      const value = typed[field]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`tool usage entry '${tool}'.${field} must be a non-negative number`)
      }
    }
    if (typeof typed.lastUsedDay !== 'string') {
      throw new TypeError(`tool usage entry '${tool}'.lastUsedDay must be a string`)
    }
    const daily = typed.daily
    if (typeof daily !== 'object' || daily === null || Array.isArray(daily)) {
      throw new TypeError(`tool usage entry '${tool}'.daily must be an object`)
    }
    for (const [day, count] of Object.entries(daily as Record<string, unknown>)) {
      if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
        throw new TypeError(`tool usage entry '${tool}'.daily['${day}'] must be a non-negative number`)
      }
    }
    state[tool] = {
      count: typed.count as number,
      errorCount: typed.errorCount as number,
      lastUsedAt: typed.lastUsedAt as number,
      lastUsedDay: typed.lastUsedDay,
      daily: { ...(daily as Record<string, number>) },
    }
  }
  return state
}

/**
 * The domain declaration this plugin submits to `ctx.storageDomain.open`.
 *
 * `invalidRecords: 'backup-and-skip'` is the right policy here: counters are
 * derived data that a later tool call regenerates, so one unreadable record
 * must not stop the plugin from loading. The global slot is deliberately absent
 * — the counter set lives in a table record, which is what the skip policy
 * covers.
 */
export const toolUsageDomain = {
  name: DOMAIN_NAME,
  version: DOMAIN_VERSION,
  invalidRecords: 'backup-and-skip',
  tables: {
    [TABLE_NAME]: {
      valueSchema: { parse: parseState },
    },
  },
} as const
