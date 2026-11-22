/**
 * Token accounting.
 *
 * One question the settings page answers: how much has been used today. That is
 * a per-day, per-model sum kept for a month — enough to see a heavy day, short
 * enough that the file never grows without bound, and small enough to load
 * synchronously on boot.
 *
 * Every function here is pure and copies rather than mutates, so a caller that
 * drops the result loses nothing.
 *
 * @module src/usage.js
 */

/** Bumped when the shape or the meaning of a stored field changes. */
export const USAGE_VERSION = 1

/** The empty document. */
export const USAGE_INITIAL = Object.freeze({
  version: USAGE_VERSION,
  days: {},
})

/** How many days of history the file keeps. */
export const KEEP_DAYS = 30

/** `YYYY-MM-DD` in the machine's own calendar. */
export function dayKey(at = Date.now()) {
  const date = new Date(at)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Add one turn's usage to the day and model it belongs to.
 *
 * @param {object} value - the stored document
 * @param {{ at?: number, model?: string, usage?: object }} turn
 * @returns {object} a new document
 */
export function recordUsage(value, { at = Date.now(), model = '', usage } = {}) {
  const day = dayKey(at)
  const key = typeof model === 'string' && model !== '' ? model : '(unknown)'
  const base = value !== null && typeof value === 'object' && value.days !== null && typeof value.days === 'object'
    ? value
    : USAGE_INITIAL
  const days = { ...base.days }
  const bucket = days[day] !== undefined && days[day]?.models !== null && typeof days[day]?.models === 'object'
    ? days[day]
    : { models: {} }
  const models = { ...bucket.models }
  const previous = models[key] ?? { input: 0, output: 0, reasoning: 0, calls: 0 }

  models[key] = {
    input: previous.input + count(usage?.inputTokens),
    output: previous.output + count(usage?.outputTokens),
    reasoning: previous.reasoning + count(usage?.reasoningTokens),
    calls: previous.calls + 1,
  }
  days[day] = { models }
  return { ...base, version: USAGE_VERSION, days }
}

/**
 * Keep the newest `keepDays` days.
 *
 * Today is always kept, even if the window would drop it: a clock skewed
 * backwards must not erase the only row the user is looking at.
 */
export function pruneDays(value, keepDays = KEEP_DAYS, today = dayKey()) {
  const base = value !== null && typeof value === 'object' && value.days !== null && typeof value.days === 'object'
    ? value
    : USAGE_INITIAL
  const cutoff = new Date(`${today}T00:00:00`)
  cutoff.setDate(cutoff.getDate() - (keepDays - 1))

  const days = {}
  for (const [day, bucket] of Object.entries(base.days)) {
    if (day === today) {
      days[day] = bucket
      continue
    }
    const parsed = new Date(`${day}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) continue
    if (parsed.getTime() >= cutoff.getTime()) days[day] = bucket
  }
  return { ...base, version: USAGE_VERSION, days }
}

/** The three totals for one day, summed across its models. */
export function todayTotals(value, today = dayKey()) {
  const models = value?.days?.[today]?.models
  if (models === null || typeof models !== 'object') return { input: 0, output: 0, total: 0 }
  let input = 0
  let output = 0
  for (const row of Object.values(models)) {
    input += count(row?.input)
    output += count(row?.output)
  }
  return { input, output, total: input + output }
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}
