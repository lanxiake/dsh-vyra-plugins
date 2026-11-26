import { present } from '../core.js'

/**
 * Interface driving: enumerate the surfaces a running DSH offers, open one, and
 * verify it opened.
 *
 * Every action here is Client-realm. The Host can validate a request and relay
 * it, but it cannot see a dialog, read a slot ledger, or call `ctx.layout` —
 * those live in the browser. So this domain does two things and nothing else:
 * it refuses a malformed request before travelling, and it forwards a good one
 * over the same channel the appearance actions use. The implementation is
 * `uiOps` in `client.js`, and the panel reaches it through the same endpoint
 * the tool does.
 *
 * A request nobody answers is `unavailable`, never a success — the model will
 * tell the user "the settings page is open" from a `status: 'ok'`, so that
 * answer has to mean it happened.
 */

/** Targets `ui.open` accepts. `modal` is close-only: nothing opens "a modal". */
const OPEN_TARGETS = new Set(['settings', 'main', 'rightbar'])
const CLOSE_TARGETS = new Set(['settings', 'modal'])

/**
 * Why a `ui.open` request cannot be forwarded at all.
 *
 * Checked before the channel, so a malformed request reads as a bad request
 * rather than as a closed interface — the ordering `domains/appearance.js`
 * established for `setFontSize`.
 *
 * @returns a reason naming what is wrong, or `undefined`.
 */
function openProblem(args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return 'ui.open needs an args object with a target'
  }
  if (typeof args.target !== 'string' || !OPEN_TARGETS.has(args.target)) {
    return 'ui.open needs a target of "settings", "main" or "rightbar"'
  }
  if (args.target === 'settings') {
    if (args.section !== undefined && (typeof args.section !== 'string' || args.section === '')) {
      return 'ui.open target "settings" takes section as a non-empty string when supplied'
    }
    // With no section the dialog opens on whatever the shell last showed, which
    // is a legitimate "just open settings" request.
    return undefined
  }
  if (args.target === 'main') {
    return typeof args.id === 'string' && args.id !== ''
      ? undefined
      : 'ui.open target "main" needs a non-empty id (see ui.list for the ids)'
  }
  const hasKind = typeof args.kind === 'string' && args.kind !== ''
  const hasAddress = typeof args.address === 'string' && args.address !== ''
  if (hasKind && hasAddress) {
    return 'ui.open target "rightbar" takes either kind or address, not both'
  }
  if (!hasKind && !hasAddress) {
    return 'ui.open target "rightbar" needs either kind or address'
  }
  if (args.url !== undefined && typeof args.url !== 'string') {
    return 'ui.open target "rightbar" takes url as a string'
  }
  return undefined
}

/** Every action this domain serves. */
const CLIENT_ACTIONS = new Set(['ui.list', 'ui.state', 'ui.open', 'ui.close', 'ui.invoke'])

/** Why a request is malformed, per action. */
function problemWith(action, args) {
  switch (action) {
    case 'ui.open':
      return openProblem(args)
    case 'ui.close':
      if (args === null || typeof args !== 'object' || Array.isArray(args)) {
        return 'ui.close needs an args object with a target'
      }
      if (typeof args.target !== 'string' || !CLOSE_TARGETS.has(args.target)) {
        return 'ui.close needs a target of "settings" or "modal"'
      }
      return undefined
    case 'ui.invoke':
      return typeof args?.id === 'string' && args.id !== ''
        ? undefined
        : 'ui.invoke needs a non-empty command id (see ui.list for the ids)'
    default:
      return undefined
  }
}

export async function uiDomain(ctx, { action, args }) {
  if (!CLIENT_ACTIONS.has(action)) {
    return { status: 'error', action, reason: `ui domain has no action "${action}"` }
  }
  const problem = problemWith(action, args)
  if (problem !== undefined) return present({ status: 'error', action, reason: problem })

  // Read per call, exactly as `domains/appearance.js` does: the channel is
  // mounted by `apply()` before this domain is ever dispatched, and reading it
  // here keeps a test double (`{ __consoleChannel: undefined }`) working.
  const channel = typeof ctx?.__consoleChannel?.request === 'function' ? ctx.__consoleChannel : undefined
  if (channel === undefined) {
    return present({
      status: 'unavailable',
      action,
      reason: 'no interface is connected; open the DSH Web UI and retry',
    })
  }
  return channel.request(action, args ?? {})
}
