/**
 * Theme, layout and locale — the Client-realm half of the console.
 *
 * Every action here travels over the channel and none of them can be served
 * from the Host: `ctx.theme`, `ctx.layout` and `ctx.locale` exist only in the
 * browser. So the interesting outcome is not the success — it is the failure. A
 * missing interface is reported as `unavailable`, never faked, because the agent
 * reads a success as "the theme is now dark" and will tell the user so.
 *
 * The channel is read per call off the context the dispatcher hands in, not
 * captured when the domain is built. That is the seam Task 7 needs: the HTTP
 * route that answers requests belongs to `webServer`, which binds its port
 * during its own init and may appear after this plugin's `apply()` has already
 * returned. A channel captured at wiring time would freeze the domain onto a
 * half-mounted transport for the rest of the process.
 */

/**
 * Actions this domain owns. A Set, so the membership test is the dispatch guard
 * and the unknown-action failure below cannot be reached by a registered action
 * that this file simply forgot to list.
 */
const CLIENT_ACTIONS = new Set([
  'appearance.state',
  'appearance.setTheme',
  'appearance.setFontSize',
  'appearance.toggleSidebar',
  'appearance.openRightbar',
  'appearance.closeRightbar',
  'appearance.setLocale',
])

/**
 * Read the console channel off the context.
 *
 * @returns the channel, or `undefined` when this Host has none yet. Deliberately
 *   a property read rather than `ctx.get('…')`: Cordis services are typed and
 *   namespaced, and a third-party plugin cannot add one without an
 *   `inject`/`provide` declaration in the host's own service table. The console
 *   channel is process-local state shared by the two halves of *this* plugin, so
 *   it rides on the context object as a namespaced own property. (`ctx` here is
 *   the context the dispatcher passed in, so the read works for a bare test stub
 *   as well as a real Cordis context.)
 */
function channelOf(ctx) {
  const channel = ctx === null || ctx === undefined ? undefined : ctx.__consoleChannel
  // Presence is not enough: a half-mounted channel must degrade to `unavailable`
  // rather than escape the handler as a TypeError, which the tool pipeline would
  // report as a harness failure instead of as an answer.
  return typeof channel?.request === 'function' ? channel : undefined
}

/**
 * Validate the only action with arguments that can be wrong.
 *
 * @returns a `reason` naming exactly what is missing, or `undefined` when the
 *   call is well formed. Both checks are independent and both are stated: the
 *   action needs a numeric `px` AND a `role` string, and a caller that supplied
 *   neither must be told about both rather than being sent round the loop twice.
 *
 * `px` is checked for a finite number rather than for a client-side range: the
 * browser's theme service owns the per-role bounds (`FONT_SIZE_SPECS`), rejects
 * an out-of-range value with a precise message, and knows about roles the Host
 * cannot enumerate. Duplicating that table here would be a second source of
 * truth that drifts, and it would turn a recoverable client error into a Host
 * guess. The one thing the Host must not forward is a hole that JSON has already
 * turned into `null`, which is why `Number.isFinite` rather than `typeof`.
 */
function fontSizeProblem(args) {
  const problems = []
  if (typeof args?.px !== 'number' || !Number.isFinite(args.px)) problems.push('a numeric px')
  if (typeof args?.role !== 'string' || args.role === '') problems.push('a role string')
  if (problems.length === 0) return undefined
  return `appearance.setFontSize needs ${problems.join(' and ')}`
}

export async function appearanceDomain(ctx, { action, args }) {
  if (!CLIENT_ACTIONS.has(action)) {
    return { status: 'error', action, reason: `appearance domain has no action "${action}"` }
  }
  if (action === 'appearance.setFontSize') {
    const problem = fontSizeProblem(args)
    // Checked before the channel, so a malformed call is reported as a bad
    // request rather than as a closed interface — the same ordering the catalog
    // domain uses, and the same reason: a call naming no role is wrong whatever
    // the browser is doing.
    if (problem) return { status: 'error', action, reason: problem }
  }
  const channel = channelOf(ctx)
  if (!channel) {
    return {
      status: 'unavailable',
      action,
      reason: 'no interface is connected; open the DSH Web UI and retry',
    }
  }
  return channel.request(action, args ?? {})
}
