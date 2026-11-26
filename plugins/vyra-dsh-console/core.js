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
  'console.map': { domain: 'inventory', mutating: false, destructive: false, requiresClient: false },
  'plugin.list': { domain: 'plugin', mutating: false, destructive: false, requiresClient: false },
  'plugin.setEnabled': { domain: 'plugin', mutating: true, destructive: false, requiresClient: false },
  'plugin.install': { domain: 'plugin', mutating: true, destructive: false, requiresClient: false },
  'plugin.remove': { domain: 'plugin', mutating: true, destructive: true, requiresClient: false },
  'model.list': { domain: 'model', mutating: false, destructive: false, requiresClient: false },
  'model.select': { domain: 'model', mutating: true, destructive: false, requiresClient: false },
  'settings.list': { domain: 'settings', mutating: false, destructive: false, requiresClient: false },
  'settings.get': { domain: 'settings', mutating: false, destructive: false, requiresClient: false },
  'settings.set': { domain: 'settings', mutating: true, destructive: false, requiresClient: false },
  'skill.list': { domain: 'catalog', mutating: false, destructive: false, requiresClient: false },
  'mcp.list': { domain: 'catalog', mutating: false, destructive: false, requiresClient: false },
  // A restart remounts the same configured entry, so it changes something real
  // but is recoverable by running it again: mutating, not destructive, and
  // therefore not behind the confirmation gate.
  'mcp.restart': { domain: 'catalog', mutating: true, destructive: false, requiresClient: false },
  'mcp.probe': { domain: 'catalog', mutating: false, destructive: false, requiresClient: false },
  // The appearance actions are the only ones that MUST travel to the browser:
  // theme, layout and locale live in the Client realm, so `requiresClient` is
  // true for all of them and the Host half can only ask and relay the answer.
  // `appearance.state` is a read and is marked as one; the other six change what
  // the interface looks like. None of them changes what the agent may DO, so
  // none is destructive and none is behind the confirmation gate — switching a
  // theme is undone by switching back, not by asking the user first.
  'appearance.state': { domain: 'appearance', mutating: false, destructive: false, requiresClient: true },
  'appearance.setTheme': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.setFontSize': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.toggleSidebar': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.openRightbar': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.closeRightbar': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.setLocale': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  // Interface driving. Every action reads or moves a surface that exists only in
  // the browser, so all of them are `requiresClient`. The reads are not
  // mutating; opening and closing change what the user sees but change no
  // configuration, and every one of them is undone by the user's next click —
  // so none is destructive and none sits behind the confirmation gate.
  'ui.list': { domain: 'ui', mutating: false, destructive: false, requiresClient: true },
  'ui.state': { domain: 'ui', mutating: false, destructive: false, requiresClient: true },
  'ui.open': { domain: 'ui', mutating: true, destructive: false, requiresClient: true },
  'ui.close': { domain: 'ui', mutating: true, destructive: false, requiresClient: true },
  // Invoking a command runs whatever that command was written to do, which for
  // most of them changes something. Still not destructive: a command that is
  // irreversible declares itself so through its own confirmation, and this
  // plugin's gate must not pretend to be that gate.
  'ui.invoke': { domain: 'ui', mutating: true, destructive: false, requiresClient: true },
})

/**
 * Build an object from `[key, value]` entries, dropping every entry whose value
 * is `undefined`.
 *
 * A tool return value is snapshotted as lossless JSON
 * (`dsh-tools/src/pipeline.ts` snapshotToolValue → `dsh-util-values`
 * walkJsonValue). That walk visits the value recursively, so a key holding
 * `undefined` — at any depth, not only the top level — makes the whole value
 * unserializable and the snapshot fails as INVALID_TOOL_OUTPUT. An optional
 * field must therefore be omitted, never assigned as `undefined`.
 *
 * This filters one level. Use {@link presentDeep} for a value that came from
 * elsewhere and may carry `undefined` below its own top-level keys.
 */
export function present(entries) {
  const out = {}
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

/**
 * Recursively drop every `undefined`-valued key from a value read off a service.
 *
 * `present` guards the keys this plugin writes itself, but a value passed
 * through from a service (a settings descriptor, a package manager result) can
 * carry `undefined` deeper down, where `present` cannot see it — and the
 * snapshot walk that enforces lossless JSON visits every level, so one such
 * value rejects the whole result.
 *
 * A key is dropped entirely. Inside an array a gap is not representable in JSON
 * and cannot be dropped without renumbering the entries, so an array holding an
 * `undefined` element is itself dropped rather than silently shortened: a gap
 * means the producer's data is not JSON, and reporting less is better than
 * reporting something that did not happen.
 *
 * @returns the cleaned value, or `undefined` when it cannot be represented.
 */
export function presentDeep(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    const out = []
    for (const item of value) {
      const cleaned = presentDeep(item)
      if (cleaned === undefined) return undefined
      out.push(cleaned)
    }
    return out
  }
  const out = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue
    const cleaned = presentDeep(entry)
    if (cleaned === undefined) continue
    out[key] = cleaned
  }
  return out
}

/**
 * Build the console over a Cordis context.
 *
 * @param ctx a Cordis context, or a bare `{ get }` stub in tests.
 * @param handlers optional `{ [domain]: (ctx, request) => Promise<object> }`; later
 *   tasks pass their domain in, so this file never imports a service directly.
 *   Every domain in this plugin has the signature `(ctx, { action, args, spec })`.
 * @param options `confirmDestructive` makes a destructive action refuse until the
 *   caller re-runs it with `confirm: true`.
 */
export function createConsole(ctx, handlers = {}, options = {}) {
  async function dispatch(action, args = {}) {
    // OWN properties only, and this is a correctness requirement rather than a
    // style choice. `FORBIDDEN[action]` walks the prototype chain, so every
    // inherited `Object.prototype` name matched: a caller sending
    // `action: "toString"` — or `"constructor"`, `"valueOf"`, `"__proto__"` —
    // was told a real operation is forbidden when no such operation exists, and
    // the spread of a function put NO `reason` and NO `alternative` in the
    // envelope. That breaks the contract this whole boundary rests on: a
    // refusal must always explain itself and name the user-facing alternative,
    // because that text is what the model and the panel show a person.
    //
    // `hasOwn` is the same guard `client.js`'s `OPS` lookup already carries for
    // the same reason. It is a LOOKUP change only: FORBIDDEN is still decided
    // first, before the ACTIONS lookup and before the confirmation gate, so no
    // option and no action name can make a forbidden operation confirmable.
    if (Object.hasOwn(FORBIDDEN, action)) {
      return { status: 'forbidden', action, ...FORBIDDEN[action] }
    }
    // The SAME prototype hazard, one line down, and the same fix. `ACTIONS` is
    // an object literal, so `ACTIONS[action]` answers a function for every
    // inherited name — truthy, so the `!spec` guard below never fired and
    // `"toString"` fell through to `spec.domain === undefined`, reported as
    // "no handler for domain undefined". The honest answer is that no such
    // action exists, which is what `hasOwn` restores.
    const spec = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined
    if (!spec) {
      return { status: 'error', action, reason: `unknown action "${action}"` }
    }
    // Checked after FORBIDDEN and before the handler: the authority boundary is
    // decided first, so no option can make a forbidden action confirmable.
    if (spec.destructive && options.confirmDestructive && args.confirm !== true) {
      return {
        status: 'confirm-required',
        action,
        reason: `"${action}" is irreversible; re-run with confirm: true, or ask the user first.`,
      }
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
