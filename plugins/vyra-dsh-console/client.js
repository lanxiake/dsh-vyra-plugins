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
     * The Host endpoint this half drains.
     *
     * The Host declares the same path as `RPC_PATH` in `index.js`. This bundle
     * cannot import it — it is loaded through `window.__ModuleLoader__` with no
     * access to the Host's modules — so the value is necessarily written twice,
     * and `bridge.test.mjs` reads the Host's constant and asserts the two agree
     * rather than trusting them to.
     */
    const RPC = '/api/vyra-console/rpc'

    /**
     * How long one poll may hang before it is abandoned.
     *
     * Comfortably longer than the Host's long-poll bound (`LONG_POLL_MS`, 25s),
     * so a normal empty poll that waits its full bound is never cut off — and
     * still bounded, so a Host that accepts the connection and then stalls
     * cannot wedge the loop forever.
     */
    const REQUEST_TIMEOUT_MS = 30000

    /**
     * How long the loop waits after a failed poll before trying again.
     *
     * Long enough that a Host which is down does not get hammered, short enough
     * that appearance actions recover promptly once it comes back.
     */
    const ERROR_BACKOFF_MS = 1000

    /**
     * A bounded signal for one poll, or `undefined` where the platform has no
     * `AbortSignal.timeout`.
     *
     * The bound is what stops a Host that accepts the connection and then stalls
     * from wedging the loop forever. It is used defensively rather than assumed:
     * `AbortSignal.timeout` is recent enough that an older embedded browser may
     * lack it, and a version check that THREW here would take the whole bridge
     * down for want of an optimisation — the poll would then hang the loop, which
     * is strictly worse than the unbounded case it was guarding. An absent signal
     * is the pre-existing behaviour, not a new failure.
     */
    function pollSignal() {
      try {
        return typeof AbortSignal?.timeout === 'function'
          ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          : undefined
      } catch {
        return undefined
      }
    }

    /**
     * Drop `undefined`-valued keys from a reply envelope.
     *
     * A local copy of `core.js`'s `present`, because this bundle cannot import
     * it: the Client half is a browser module served to the page, not part of
     * the Host's module graph. The rule it enforces is still the repo's — an own
     * key holding `undefined` does not survive the tool pipeline's lossless
     * snapshot, and `JSON.stringify` would silently drop it on the wire so the
     * Host would read an absent field as a different answer. `value`/`error` are
     * the two keys this writes, and exactly one of them is ever present.
     */
    function present(entries) {
      const out = {}
      for (const [key, value] of Object.entries(entries)) {
        if (value !== undefined) out[key] = value
      }
      return out
    }

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
      // A string first, before anything below coerces or interpolates `op`.
      // Both the own-property lookup and the reason template run `ToPropertyKey`
      // / `ToString` on their argument, so a boxed or overridden value satisfies
      // the lookup and then dispatches a real mutation — `{ toString: () =>
      // 'appearance.toggleSidebar' }` was reaching `layout.toggleSidebar()`,
      // and a Symbol threw out of the reason template. Reachable as soon as
      // Task 7 forwards a request body, so the type is checked here rather than
      // trusted from the caller.
      if (typeof op !== 'string') {
        return { status: 'error', reason: 'an appearance op must be a string' }
      }
      // Own properties only. `OPS[op]` walks the prototype chain, so `toString`,
      // `valueOf`, `hasOwnProperty` and friends would resolve as "handlers" and
      // be *called*: `constructor` returns the OPS object itself, and the rest
      // fail inside the dispatch and surface as a plausible-looking error for an
      // op that does not exist. `domains/appearance.js` filters with
      // `CLIENT_ACTIONS.has(action)` before it gets here, but Task 7's HTTP route
      // and Task 10's panel post ops in directly, so this function must refuse on
      // its own rather than trust a caller's guard.
      const handler = Object.hasOwn(OPS, op) ? OPS[op] : undefined
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
        // The drain loop: the Host queues appearance requests, this half is the
        // only thing that can answer them, and this effect is the wire between
        // the two. It is tied to the context's lifetime, so disposing the
        // effect stops the loop — an unmounted panel must not keep polling and
        // mutating a UI the user has left.
        //
        // The services are NOT captured here. `ctx.theme`, `ctx.layout` and
        // `ctx.locale` are read on every dispatch, because Cordis can dispose and
        // remount one of them while the loop is running, and a bag captured at
        // install time would keep dispatching into the dead service — every
        // appearance action failing after a theme reload.
        ctx.effect(() => {
          let stopped = false
          /** The pending backoff timer, and its resolver, so disposal can cut it short. */
          let backoffTimer
          let backoffDone

          /**
           * Hand one drained request to `applyOp` and post its outcome back.
           *
           * EVERY request is answered, including a refusal: a request left
           * unanswered hangs the Host until its timeout and then reports "no
           * interface is connected" even though an interface just replied.
           *
           * The reply is built to the channel's contract — `{ id, ok, value |
           * error }` — and the absent branch is OMITTED rather than written as
           * `undefined`. That is not cosmetic: `channel.respond()` reads
           * `reply.value === undefined` as "nothing to report", and an own key
           * holding `undefined` is the Task 5 defect this repo has already paid
           * for once.
           */
          async function answer(request) {
            // Read at call time, so a remounted service is picked up.
            const services = { theme: ctx.theme, layout: ctx.layout, locale: ctx.locale }
            // `op` is passed through UNTOUCHED. It arrives over HTTP and is
            // untrusted, and `applyOp` refuses a non-string op precisely so that
            // a coerced value cannot reach a handler — stringifying it here
            // would silently disarm that guard.
            const outcome = applyOp(services, request?.op, request?.args)
            const reply = outcome.status === 'ok'
              ? present({ id: request?.id, ok: true, value: outcome.value })
              : present({ id: request?.id, ok: false, error: outcome.reason })
            await fetch(RPC, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(reply),
              cache: 'no-store',
            })
          }

          /** One poll: fetch what is queued and answer all of it. */
          async function poll() {
            const response = await fetch(RPC, {
              method: 'GET',
              cache: 'no-store',
              // Bounded where the platform supports it, so a Host that accepts the
              // connection and then stalls cannot wedge the loop forever.
              // Comfortably longer than the Host's own long-poll bound, so a
              // normal empty poll is never cut off mid-wait.
              signal: pollSignal(),
            })
            const data = await response.json()
            const requests = Array.isArray(data?.requests) ? data.requests : []
            for (const request of requests) {
              // Re-checked per request, so a dispose that lands mid-batch stops
              // the remaining dispatches rather than finishing them against a
              // UI that is already gone.
              if (stopped) return
              // One failed answer must not drop the rest of the batch: each is
              // caught, so a single bad POST cannot silently discard every
              // request behind it.
              try {
                await answer(request)
              } catch {
                // The Host will time this request out and report `unavailable`,
                // which is the honest outcome — the answer did not get through.
              }
            }
          }

          async function drain() {
            while (!stopped) {
              try {
                await poll()
              } catch {
                // A failed or malformed poll must not end the loop: the Host may
                // be restarting, and ending here would leave every appearance
                // action unavailable until the page is reloaded. Back off
                // briefly rather than retrying flat out.
                await backoff()
                continue
              }
              // Yield to the MACROTASK queue between polls. This is not
              // politeness — without it the loop is a microtask-only `while`, and
              // such a loop never returns control to the event loop at all, so
              // it starves timers, paint and I/O while the heap climbs until the
              // process dies. Measured on this exact code with a stub that always
              // had work queued: an out-of-memory crash within seconds, and the
              // tab would simply freeze. A `setTimeout(…, 0)` is the smallest
              // thing that hands the loop back.
              //
              // It costs one turn per poll, which is nothing next to the HTTP
              // round trip the poll just made, and it only delays the NEXT poll —
              // the batch just drained was already applied.
              await backoff(0)
            }
          }

          /**
           * Wait, interruptibly, and let the event loop run meanwhile.
           *
           * `ms` of 0 is the yield above; a longer value is the error backoff. The
           * timer is tracked so disposal can cut the wait short: a disposed loop
           * must not sit out a whole backoff holding a live timer, which is the
           * leak `channel.js` documents for its own timeout.
           */
          function backoff(ms = ERROR_BACKOFF_MS) {
            return new Promise((resolve) => {
              backoffTimer = setTimeout(() => {
                backoffTimer = undefined
                backoffDone = undefined
                resolve()
              }, ms)
              backoffDone = resolve
            })
          }

          void drain()
          return () => {
            stopped = true
            // Cut a pending wait short, so disposal is immediate rather than
            // "within a second" — and so nothing outlives the effect.
            if (backoffTimer !== undefined) clearTimeout(backoffTimer)
            if (backoffDone !== undefined) backoffDone()
          }
        }, 'vyra-dsh-console: appearance bridge')
      },
    }
  },
})
