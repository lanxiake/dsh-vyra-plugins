/**
 * Thinking-strength menus.
 *
 * The rule this module exists to enforce: a control appears only where the model
 * itself declares a choice. The gateway validates `reasoning_effort` against the
 * accepted set and answers 400 for anything outside it, so a fabricated rung is
 * not a helpful extra — it is a request that fails.
 *
 * Two declared shapes produce no menu:
 *
 * - `type: 'toggle'` — the model's thinking can be switched, but not levelled,
 *   and this wire's only expression is a level. Some of these models cannot turn
 *   thinking off at all.
 * - a table with one rung — one option is not a choice, and rendering it would
 *   promise a control that does nothing.
 *
 * @module src/effort.js
 */

/**
 * The menu for one catalog entry, or `undefined` when there is nothing to choose.
 *
 * @param {{ efforts?: readonly string[] }} entry
 * @returns {Array<{ id: string, name: string }> | undefined}
 */
export function effortsFor(entry) {
  const values = declaredRungs(entry)
  if (values === undefined) return undefined
  return values.map(id => ({ id, name: labelFor(id) }))
}

/**
 * The rung a fresh turn starts on.
 *
 * A declared default wins only when it is actually in the menu; otherwise the
 * middle rung is used, which is the one that trades a little latency for a
 * little depth rather than picking an extreme on the user's behalf.
 */
export function defaultEffortFor(entry) {
  const values = declaredRungs(entry)
  if (values === undefined) return undefined
  const declared = entry?.defaultEffort
  if (typeof declared === 'string' && values.includes(declared)) return declared
  return values[Math.floor(values.length / 2)]
}

/** The usable rung list, or `undefined` when the entry declares none. */
function declaredRungs(entry) {
  const values = entry?.efforts
  if (!Array.isArray(values) || values.length < 2) return undefined
  const clean = values.filter(value => typeof value === 'string' && value !== '')
  return clean.length >= 2 ? clean : undefined
}

/** `xhigh` -> `XHigh`, `none` -> `None`. */
function labelFor(id) {
  const text = String(id)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
