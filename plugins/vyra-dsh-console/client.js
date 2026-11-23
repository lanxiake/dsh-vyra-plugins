// DSH console, Client half. Theme, layout and locale are Client-realm services,
// so this half is the only place they can be called. It renders no UI of its own
// (the panel arrives later); it answers the Host's requests.
//
// The id below MUST equal the package name: the module system matches startup
// rows by package name, and a mismatch means this half never mounts.
window.__ModuleLoader__.load({
  id: 'vyra-dsh-console',
  factory(require) {
    /**
     * The Client services this half reaches for, in the order the Host's
     * `appearance` domain needs them. Cordis resolves the context only once
     * every name here is mounted, so `apply()` sees all three — but `applyOp`
     * still checks each one, because a service can be disposed while a request
     * is in flight and because the tests drive it with services missing.
     */
    const SERVICES = ['theme', 'layout', 'locale']

    /**
     * Read one service, rejecting a half-mounted one.
     *
     * Presence is not enough. `ctx.theme` resolving to an object without
     * `setTheme` would otherwise escape as a TypeError, which the Host reports
     * as a harness failure rather than as an answer — the same mistake
     * `domains/appearance.js` guards against on its own side.
     *
     * @param services - the injected service bag (or a test double).
     * @param name - service key.
     * @param method - the one method the caller is about to use.
     * @returns the service, or a `reason` naming precisely what is absent.
     */
    function reach(services, name, method) {
      const service = services?.[name]
      if (service === null || service === undefined) {
        return { reason: `the ${name} service is unavailable` }
      }
      if (typeof service[method] !== 'function') {
        return { reason: `the ${name} service has no ${method}()` }
      }
      return { service }
    }

    /**
     * The snapshot subset `appearance.state` reports.
     *
     * The two services publish different shapes — `theme.getTheme()` returns a
     * `ThemeSnapshot` whose resolved theme sits under `active`, while
     * `locale.getLocale()` returns a `LocaleSnapshot` whose language sits under
     * `active`. Only fields that exist are copied: a key holding `undefined`
     * would be dropped by `JSON.stringify` on the way to the Host and read back
     * as absent, which is a different answer from the one meant.
     *
     * Both services are required. Reading is not exempt from the rule that a
     * missing service is an error rather than a false success: a snapshot with
     * `theme: null` still reads to the agent as "the theme is none", and the
     * Host would report the state as known when it is not.
     *
     * @param services - the injected service bag.
     * @returns `{ status: 'ok', value: { theme, locale } }`, or an error naming
     *   the first service that could not answer.
     */
    function readState(services) {
      const theme = reach(services, 'theme', 'getTheme')
      if (theme.reason) return { status: 'error', reason: theme.reason }
      const locale = reach(services, 'locale', 'getLocale')
      if (locale.reason) return { status: 'error', reason: locale.reason }
      const snapshot = theme.service.getTheme()
      const active = snapshot?.active
      return {
        status: 'ok',
        value: {
          theme: active
            ? {
              id: active.id,
              // `ThemeDefinition.colorScheme` is required, so a healthy service
              // always supplies it — but copying it straight through would write
              // a real own key holding `undefined` if it ever did not, which
              // JSON then drops and the Host reads back as "absent".
              colorScheme: active.colorScheme ?? null,
              preference: snapshot.preference ?? null,
            }
            : null,
          locale: locale.service.getLocale()?.active ?? null,
        },
      }
    }

    /** Which service each op needs, and how it is called. Ops absent here are refused. */
    const OPS = {
      'appearance.state': (services) => readState(services),
      'appearance.setTheme': (services, args) => {
        const found = reach(services, 'theme', 'setTheme')
        if (found.reason) return { status: 'error', reason: found.reason }
        found.service.setTheme(args.id)
        return { status: 'ok', value: args.id === undefined ? null : args.id }
      },
      'appearance.setFontSize': (services, args) => {
        const found = reach(services, 'theme', 'setFontSize')
        if (found.reason) return { status: 'error', reason: found.reason }
        found.service.setFontSize(args.role, args.px)
        return { status: 'ok' }
      },
      'appearance.toggleSidebar': (services) => {
        const found = reach(services, 'layout', 'toggleSidebar')
        if (found.reason) return { status: 'error', reason: found.reason }
        found.service.toggleSidebar()
        return { status: 'ok' }
      },
      'appearance.openRightbar': (services, args) => {
        const found = reach(services, 'layout', 'openRightbar')
        if (found.reason) return { status: 'error', reason: found.reason }
        // Both parameters are required and neither has a default the service
        // applies, so a request that named neither must still pass booleans.
        found.service.openRightbar(args.track !== false, args.fullscreen === true)
        return { status: 'ok' }
      },
      'appearance.closeRightbar': (services) => {
        const found = reach(services, 'layout', 'closeRightbar')
        if (found.reason) return { status: 'error', reason: found.reason }
        found.service.closeRightbar()
        return { status: 'ok' }
      },
      'appearance.setLocale': (services, args) => {
        const found = reach(services, 'locale', 'setLocale')
        if (found.reason) return { status: 'error', reason: found.reason }
        found.service.setLocale(args.id)
        return { status: 'ok', value: args.id === undefined ? null : args.id }
      },
    }

    /**
     * Apply one appearance op against the live Client services.
     *
     * The services are a parameter, not something this closes over, so the same
     * implementation serves the panel and the Host bridge and can be driven by
     * a test double. The panel and the agent tool share this one path.
     *
     * This function returns a status for every input and never raises. That is
     * not defensive padding: the Client services deliberately throw precise,
     * recoverable errors — `theme.setTheme` on an unregistered id,
     * `theme.setFontSize` on an out-of-range px — and `domains/appearance.js`
     * forwards `setFontSize` to them *because* they "reject an out-of-range
     * value with a precise message". That message is the answer the agent needs,
     * and it only survives if it comes back as a `reason` rather than as a
     * stack. One boundary around the whole dispatch, not a catch per op: the
     * contract belongs to this function, so this is where it is enforced.
     *
     * @param services - `{ theme, layout, locale }`, any of them possibly absent.
     * @param op - one of `domains/appearance.js`'s `CLIENT_ACTIONS`.
     * @param args - the action's arguments, as received over the channel.
     * @returns `{ status: 'ok', value? }` or `{ status: 'error', reason }`. A
     *   success carries `value` only when there is one to carry.
     */
    function applyOp(services, op, args) {
      const handler = OPS[op]
      if (handler === undefined) {
        return { status: 'error', reason: `unknown appearance op "${op}"` }
      }
      if (services === null || services === undefined) {
        return { status: 'error', reason: 'no Client services are available' }
      }
      try {
        return handler(services, args || {})
      } catch (err) {
        // The service's own message carries what to fix; a non-Error throw is
        // stringified so the reason is never the literal "undefined".
        return { status: 'error', reason: String(err?.message ?? err) }
      }
    }

    return {
      __internal: { applyOp, OPS },
      inject: SERVICES,
      apply(ctx) {
        // Nothing to do yet: the Host cannot reach this half until Task 7 adds
        // the HTTP endpoint, and polling for work with no endpoint to drain
        // would be a loop that never terminates. The effect still exists — it
        // is what keeps this half tied to its context's lifetime, and Task 7
        // fills the body with the drain loop, reading `ctx.theme`, `ctx.layout`
        // and `ctx.locale` at call time so a remounted service is picked up.
        ctx.effect(() => {
          // Task 7 replaces this body with the drain loop that polls the
          // Remote-backed endpoint for queued requests and answers each one
          // through `applyOp(ctx, op, args)`.
          return () => {}
        }, 'vyra-dsh-console: appearance bridge')
      },
    }
  },
})
