import { ACTIONS, FORBIDDEN, present } from '../core.js'

/**
 * The console describing itself.
 *
 * `console.actions` is the documented first call — `tool.js`'s description tells
 * the model to make it before anything else — so it is also how the model learns
 * the authority boundary: which actions exist and mutate, and which are refused
 * permanently. That makes `forbidden` load-bearing rather than decorative, and
 * it is why the reply carries both tables.
 *
 * Both are derived from the single exported sources of truth, `ACTIONS` and
 * `FORBIDDEN`, rather than restated here: a second copy of either table could
 * drift from the one `dispatch()` actually enforces, and a boundary that is
 * merely *documented* is worse than one that is absent, because it is believed.
 *
 * A domain handler receives only `(ctx, { action, args, spec })` and is built
 * before the console object exists, so it cannot reach `listActions()`. Reading
 * the same frozen tables gives the identical rows: `listActions()` is itself
 * `Object.entries(ACTIONS).map(([name, spec]) => ({ name, ...spec }))`.
 */

/** One callable action row, carrying the exact spec `dispatch()` reads. */
function actionRow(name, spec) {
  return present({
    name,
    domain: spec.domain,
    mutating: spec.mutating,
    destructive: spec.destructive,
    requiresClient: spec.requiresClient,
  })
}

/** One refused action, with the reason and the user-facing alternative. */
function forbiddenRow(name, entry) {
  return present({
    name,
    reason: entry.reason,
    alternative: entry.alternative,
  })
}

export async function consoleDomain(ctx, { action }) {
  switch (action) {
    case 'console.actions': {
      return {
        status: 'ok',
        actions: Object.entries(ACTIONS).map(([name, spec]) => actionRow(name, spec)),
        // The boundary as data. `FORBIDDEN` is checked before the confirmation
        // gate and before any handler, so these are refused for every caller.
        forbidden: Object.entries(FORBIDDEN).map(([name, entry]) => forbiddenRow(name, entry)),
      }
    }
    default:
      return { status: 'error', action, reason: `console domain has no action "${action}"` }
  }
}
