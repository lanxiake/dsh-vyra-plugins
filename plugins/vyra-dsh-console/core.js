/**
 * The single business implementation of every DSH console operation.
 *
 * One operation, two callers: the `dsh_console` agent tool and the Client panel
 * both land here. Nothing in this file knows which of them called it.
 *
 * The boundary in FORBIDDEN is the point of this plugin as much as the actions
 * are: an agent may change how the harness looks and is configured, never how
 * much authority it holds. See docs/superpowers/specs/2026-11-23-vyra-dsh-console-design.md §2.2.
 */

/** Actions that change authority. Refused for every caller, permanently. */
export const FORBIDDEN = Object.freeze({
  'sandbox.setMode': {
    reason: 'Changing the sandbox mode widens or narrows your own file and process authority.',
    alternative: 'Ask the user to change it in Settings → Permissions, or via the /permission command.',
  },
  'permission.setPreset': {
    reason: 'A permission preset bundles the sandbox mode and approval policy; switching it changes your own authority.',
    alternative: 'Ask the user to pick a preset in the composer\'s permission control.',
  },
  'approval.answer': {
    reason: 'Answering an approval request would let you authorize your own tool calls.',
    alternative: 'The user answers it in the approval prompt.',
  },
  'credentials.set': {
    reason: 'Writing a credential is a secret-handling operation reserved for the user.',
    alternative: 'Ask the user to enter it in Settings.',
  },
})

/** Actions the console implements. `requiresClient` actions go through the Client half. */
export const ACTIONS = Object.freeze({
  'console.actions': { domain: 'console', mutating: false, destructive: false, requiresClient: false },
})

/**
 * Build the console over a Cordis context.
 *
 * @param ctx a Cordis context, or a bare `{ get }` stub in tests.
 * @param handlers optional `{ [domain]: (ctx, request) => Promise<object> }`; later
 *   tasks pass their domain in, so this file never imports a service directly.
 *   Every domain in this plugin has the signature `(ctx, { action, args, spec })`.
 */
export function createConsole(ctx, handlers = {}) {
  async function dispatch(action, args = {}) {
    if (FORBIDDEN[action]) {
      return { status: 'forbidden', action, ...FORBIDDEN[action] }
    }
    const spec = ACTIONS[action]
    if (!spec) {
      return { status: 'error', action, reason: `unknown action "${action}"` }
    }
    const handler = handlers[spec.domain]
    if (!handler) {
      return { status: 'error', action, reason: `no handler for domain "${spec.domain}"` }
    }
    return handler(ctx, { action, args, spec })
  }

  return {
    dispatch,
    listActions: () =>
      Object.entries(ACTIONS).map(([name, spec]) => ({ name, ...spec })),
  }
}

/** Read an optional service, or report it missing instead of throwing. */
export function requireService(ctx, key, action) {
  const service = ctx.get(key)
  if (!service) {
    return { missing: { status: 'unavailable', action, reason: `this profile has no ${key} service` } }
  }
  return { service }
}
