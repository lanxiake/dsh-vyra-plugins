/**
 * The Host side of the console's Host↔Client channel.
 *
 * Theme, layout and locale are Client-realm services: they exist only in the
 * browser, so the Host cannot call them and has nothing to fall back on. The
 * Host therefore queues a request, the browser half answers it, and the promise
 * settles with that answer — or with an explicit failure.
 *
 * The one rule that matters: a request nobody answers must NOT look like a
 * success. `unavailable` after the timeout is what tells the agent the interface
 * is not open, instead of leaving it reporting a theme change that never
 * happened.
 *
 * The only import is this plugin's own `core.js`, which is pure functions over
 * plain values and imports nothing itself. The plugin is plain ESM with no build
 * step and no `node_modules`, so a static import of any *package* would fail the
 * whole load with ERR_MODULE_NOT_FOUND — the failure `@deepseek-ai/schemastery`
 * has already caused once in `index.js`. A local module carries no such risk, and
 * `presentDeep` is the one helper that knows what the tool pipeline's lossless
 * snapshot accepts. Re-implementing it here would be a second copy of that rule,
 * which is the thing "one operation, two callers" forbids.
 *
 * The transport is deliberately absent: this half only knows how to *ask* and
 * how to be *answered*. Task 7 connects the two with an HTTP endpoint, and the
 * Client half (Task 6) never sees this file at all.
 */

import { presentDeep } from './core.js'

/** The single answer when nobody is listening. One wording, one meaning. */
const NO_INTERFACE = 'no interface is connected; open the DSH Web UI and retry'

export function createChannel({ timeoutMs = 5000 } = {}) {
  /**
   * Every request awaiting an answer, keyed by its id.
   *
   * This map is the only thing a timeout can leak, which is why `settle()` is the
   * single exit for both the timer and a reply: whoever gets there first deletes
   * the entry, so a reply racing the timeout cannot resolve twice or leave the
   * entry behind. `pendingCount()` is the observable form of that.
   *
   * (The entry object is internal — it is never returned or serialized — so its
   * `timer` slot is filled in immediately after the entry is stored.)
   *
   * @type {Map<string, {resolve: (result: object) => void, timer: ReturnType<typeof setTimeout>, op: string}>}
   */
  const pending = new Map()
  let nextId = 1
  let listener = () => {}

  /**
   * Settle one pending request and forget it, permanently.
   *
   * Both the timeout and `respond()` go through here, and the `delete` happens
   * before the resolve, so the two racing paths are mutually exclusive: whichever
   * runs first removes the entry and the other finds nothing to settle. Without
   * that, a reply landing exactly on the timeout would resolve an
   * already-resolved promise (a silent no-op) while leaving the entry in the map
   * forever — the leak `pendingCount()` exists to catch.
   */
  function settle(id, result) {
    const entry = pending.get(id)
    if (!entry) return false
    pending.delete(id)
    clearTimeout(entry.timer)
    entry.resolve(result)
    return true
  }

  /**
   * Ask the Client to run `op`, and settle on its answer or on `unavailable`.
   *
   * The returned promise never rejects: every outcome is a value with a
   * `status`, because this result is handed back to the model as a tool result
   * and a rejection would surface as a harness error rather than as an answer.
   *
   * @param op the client operation id, e.g. `appearance.setTheme`.
   * @param args the operation's arguments, already validated by the domain.
   */
  function request(op, args = {}) {
    const id = String(nextId++)
    return new Promise((resolve) => {
      const entry = {
        resolve,
        timer: undefined,
        op,
      }
      // Stored before the listener runs, so a listener that answers synchronously
      // finds the entry — the task's own first test does exactly that.
      pending.set(id, entry)
      entry.timer = setTimeout(() => {
        settle(id, { status: 'unavailable', op, reason: NO_INTERFACE })
      }, timeoutMs)
      listener({ id, op, args })
    })
  }

  /**
   * Accept the Client's answer to one queued request.
   *
   * @returns `true` when the reply settled a live request, `false` when there was
   *   nothing to settle — an unknown id, or a reply that arrived after the
   *   timeout already reported the interface as unavailable. The caller (the
   *   Task 7 endpoint) reports that boolean back to the browser so a late reply
   *   is visibly dropped instead of being mistaken for an applied change.
   */
  function respond(reply) {
    const id = String(reply?.id)
    const entry = pending.get(id)
    if (!entry) return false
    // An explicit `ok: true` is required. Anything else — a missing flag, a
    // string, a client that answered a different question — is a refusal, never
    // an assumed success.
    if (reply.ok !== true) {
      return settle(id, { status: 'error', reason: String(reply?.error ?? 'client refused'), op: entry.op })
    }
    // `op` last, and the value cleaned deeply, for the same reason every action
    // envelope in this plugin writes `status` last: this object is assembled from
    // data the browser supplied. `reply.value` is arbitrary JSON written by the
    // Client half, so it can carry a key holding `undefined` at any depth, which
    // the tool pipeline's lossless snapshot (`dsh-util-values` walks with
    // Reflect.ownKeys) rejects as INVALID_TOOL_OUTPUT for the WHOLE result — one
    // hole in the browser's answer would turn a successful theme change into a
    // harness error. `presentDeep` is exactly the helper for a value that came
    // from elsewhere, so it is reused rather than re-implemented here.
    return settle(id, { status: 'ok', value: presentDeep(reply.value), op: entry.op })
  }

  return {
    request,
    respond,
    /**
     * Install the transport that carries requests to the Client.
     *
     * Assignment rather than `addEventListener`: there is exactly one client
     * half, and a second registration replacing the first is easier to reason
     * about than two listeners racing to answer the same request. A throwing
     * listener cannot strand the request either — the timeout still settles it.
     */
    onRequest(handler) { listener = typeof handler === 'function' ? handler : () => {} },
    /** How many requests are still awaiting an answer; 0 whenever all settled. */
    pendingCount: () => pending.size,
  }
}
