import { present } from '../core.js'
import { runRecordedWalkthrough } from './pipeline.js'

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
const CLIENT_ACTIONS = new Set([
  'ui.list', 'ui.state', 'ui.open', 'ui.close', 'ui.invoke', 'ui.snapshot', 'ui.act',
  // `ui.record` is Host-orchestrated: the steps still run in the page, but the
  // recording around them is started and stopped here.
  'ui.record',
])

/**
 * Run a recorded walkthrough.
 *
 * The origin of this host's own web server is what makes the recorder
 * reachable: the recorder registers its routes on `webServer`, and the pipeline
 * talks to it over loopback. Read per call, because the server binds its port
 * during its own init and that port can change across a restart.
 */
async function recordWalkthrough(ctx, args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return {
      status: 'error',
      action: 'ui.record',
      reason: 'ui.record needs an args object with out and steps',
      // The shape is stated where it is refused: a caller that guessed the
      // fields from the error message should not have to guess twice.
      expects: {
        out: 'absolute path for the video, e.g. "C:/Users/me/Desktop/demo.mp4"',
        steps: 'array of steps; see example',
        fps: 'optional, 4-12 (default from settings)',
        maxSeconds: 'optional cap, 2-600 (default 120)',
        format: 'optional, "mp4" or "webm"',
      },
      example: {
        out: 'C:/Users/me/Desktop/demo.mp4',
        maxSeconds: 30,
        steps: [
          { open: { target: 'settings', section: 'dsh-vyra-free-model' }, settle: 900 },
          { act: { name: '模型', action: 'click' }, settle: 500 },
          { wait: 1200 },
        ],
      },
    }
  }
  if (typeof args.out !== 'string' || args.out === '') {
    return {
      status: 'error',
      action: 'ui.record',
      reason: 'ui.record needs an out path for the recording',
      expects: {
        out: 'absolute path for the video, e.g. "C:/Users/me/Desktop/demo.mp4"',
      },
      example: { out: 'C:/Users/me/Desktop/demo.mp4', steps: [{ open: { target: 'settings' }, settle: 900 }] },
    }
  }
  const webServer = typeof ctx?.get === 'function' ? ctx.get('webServer') : undefined
  let origin
  try {
    origin = typeof webServer?.getOrigin === 'function' ? webServer.getOrigin() : undefined
  } catch (error) {
    return {
      status: 'error',
      action: 'ui.record',
      reason: `this host's web server has not bound a port yet: ${String(error?.message ?? error)}`,
    }
  }
  const channel = typeof ctx?.__consoleChannel?.request === 'function' ? ctx.__consoleChannel : undefined
  if (channel === undefined) {
    return { status: 'unavailable', action: 'ui.record', reason: 'no interface is connected; open the DSH Web UI and retry' }
  }
  return present({
    action: 'ui.record',
    ...await runRecordedWalkthrough(
      { recorderBase: origin, channel, console: ctx?.__consoleObject },
      {
        out: args.out,
        fps: args.fps,
        maxSeconds: args.maxSeconds,
        format: args.format,
        steps: args.steps,
        // Optional, and worth passing: a window source keeps the user's other
        // windows out of the video, and `silent` keeps the recorder's own pill
        // out of it.
        source: args.source,
        silent: args.silent,
      },
    ),
  })
}

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
    case 'ui.act': {
      const action = args?.action
      if (!['click', 'type', 'select', 'key'].includes(String(action))) {
        return 'ui.act needs action of "click", "type", "select" or "key"'
      }
      if (action === 'key') {
        return typeof args.key === 'string' && args.key !== ''
          ? undefined
          : 'ui.act action "key" needs a key'
      }
      if (typeof args.ref !== 'string' || args.ref === '') {
        return 'ui.act needs a ref from ui.list'
      }
      if (action === 'type' && typeof args.text !== 'string') {
        return 'ui.act action "type" needs text'
      }
      if (action === 'select' && args.value === undefined && args.label === undefined) {
        return 'ui.act action "select" needs value or label'
      }
      return undefined
    }
    case 'ui.snapshot':
      return undefined
    default:
      return undefined
  }
}

export async function uiDomain(ctx, { action, args }) {  if (!CLIENT_ACTIONS.has(action)) {
    return { status: 'error', action, reason: `ui domain has no action "${action}"` }
  }
  // Recording is orchestrated HERE, not forwarded: it starts and stops a
  // recorder this host owns, and only the steps travel to the page.
  if (action === 'ui.record') return recordWalkthrough(ctx, args)
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
