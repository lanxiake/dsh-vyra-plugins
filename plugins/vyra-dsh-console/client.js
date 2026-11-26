// DSH console, Client half. Theme, layout and locale are Client-realm services,
// so this half is the only place they can be called. It answers the Host's
// appearance requests over the drain loop, and it registers the management
// panel a person uses to do the same operations by clicking.
//
// The id below MUST equal the package name: the module system matches startup
// rows by package name, and a mismatch means this half never mounts.
window.__ModuleLoader__.load({
  id: 'dsh-vyra-dsh-console',
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
     * The panel's locale namespace.
     *
     * Distinct from the package name on purpose: the namespace keys the
     * dictionary table the `locale` service holds, and `dsh-vyra-agent-manager`
     * already owns `dsh-agent-manager`. Two plugins sharing one namespace would
     * make the second `register` throw on the duplicate (ns, locale) pair.
     */
    const NS = 'dsh-vyra-dsh-console'

    /** The two slot names, and the id/key both are registered under. */
    const PANEL_ID = 'dsh-vyra-dsh-console'

    /**
     * Where the panel sits in the sidebar.
     *
     * `dsh-vyra-agent-manager` registers order 5, and two entries at the same order
     * render in an order that depends on registration timing — which is not
     * stable across reloads. Six follows it and leaves room above.
     */
    const PANEL_ORDER = 6

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

    // -----------------------------------------------------------------------
    // Interface driving (ui.*).
    //
    // Two kinds of surface, and the difference decides how each is opened:
    //
    //   - the MAIN PANEL and the RIGHT DRAWER have public services
    //     (`ctx.layout.selectPanel`, `ctx.sidebarRight.openTab`), so they are
    //     opened by calling them;
    //   - the SETTINGS DIALOG has no service. `openSection` is a private owner
    //     prop handed to the `settings.launcher` registrant, so the only way in
    //     from outside is to click what a person would click — and then VERIFY
    //     the dialog actually opened, because a click is not a promise.
    //
    // Every path reports `verified: true` only after reading the result back.
    // The model turns `status: 'ok'` into "it is open now", so an unverified
    // success is a lie the user will discover by looking at the screen.
    // -----------------------------------------------------------------------

    /** The settings dialog's own marker, set by the shell (`ui-settings-general`). */
    const SETTINGS_MODAL = '[data-shortcut-modal="settings"]'
    /**
     * A real modal dialog — the only thing this plugin refuses to act around.
     *
     * Menus are deliberately NOT included. A popup menu is transient, it belongs
     * to whatever opened it, and the plugin opens menus itself on the way to the
     * settings row. Treating one as a foreign dialog blocked every retry after a
     * single failed attempt left a menu open, which is worse than the thing the
     * courtesy check was protecting: the caller could not try again until the
     * user clicked somewhere.
     */
    const ANY_DIALOG = '[data-shortcut-modal]'
    /** True when a menu (or menu-like popup) is currently rendered. */
    const ANY_MENU = '[role="menu"], [role="menuitem"]'
    /** How long a click may take to show its result before it is called a failure. */
    const VERIFY_TIMEOUT_MS = 900
    /**
     * The whole settings search must answer inside this, whatever it finds.
     *
     * The host's action timeout is 5s (Config.clientTimeoutMs). Exceeding it is
     * reported as 'no interface is connected', which reads as a closed window
     * and sends the caller into a retry loop — while the browser keeps working
     * on the previous attempt. 3.5s leaves room for the trip there and back.
     */
    const OPEN_BUDGET_MS = 3500
    /** Poll interval while waiting for a click's result. */
    const VERIFY_POLL_MS = 25

    /** The live document, read per call so a test double can install its own. */
    function doc() {
      return globalThis.document
    }

    /** Every element the current document matches, as an array. */
    function all(selector) {
      const root = doc()
      if (root === undefined || typeof root.querySelectorAll !== 'function') return []
      return [...root.querySelectorAll(selector)]
    }

    /** The first element matching `selector`, or null. */
    function first(selector) {
      return all(selector)[0] ?? null
    }

    /** Poll `probe` until it answers something truthy, or the bound expires. */
    async function waitFor(probe) {
      const started = Date.now()
      for (;;) {
        const answer = probe()
        if (answer !== undefined && answer !== null && answer !== false) return answer
        if (Date.now() - started >= VERIFY_TIMEOUT_MS) return undefined
        await new Promise((resolve) => setTimeout(resolve, VERIFY_POLL_MS))
      }
    }

    /**
     * Whether a request may be served at all.
     *
     * A backgrounded tab is REFUSED rather than served. A browser tab that is
     * not visible still runs this loop, and acting in it would change a page the
     * user is not looking at while another tab shows the old state — the action
     * would look like it silently failed. Saying so is the honest answer.
     */
    /**
     * Whether this realm has a document to act on.
     *
     * Deliberately NOT a visibility check. An earlier version refused every ui
     * op while `document.visibilityState !== 'visible'`, on the theory that
     * changing a page nobody is looking at is dishonest. It is not: a background
     * tab still renders, still dispatches clicks, and the state change is real.
     * What the check actually did was deadlock the agent — operating DSH required
     * bringing its window forward, bringing it forward required a shell command,
     * and running that command handed focus back to the terminal, so the next
     * call was refused again for being in the background.
     *
     * Opening a settings page and telling the user to switch to it is ordinary
     * use. Whether the page was visible when the work happened is reported as
     * data (`visible`), never used as a gate.
     */
    function unserviceable() {
      if (doc() === undefined) {
        return { status: 'unavailable', reason: 'no document is present in this realm' }
      }
      return undefined
    }

    /** Whether the page was visible when an op ran; absent where the platform omits it. */
    function visibleNow() {
      const state = doc()?.visibilityState
      return state === undefined ? undefined : state === 'visible'
    }

    /**
     * Try to bring the DSH window forward, and report whether it worked.
     *
     * Best effort and never a precondition: a background page may call
     * `window.focus()`, and most browsers ignore it while an Electron window
     * usually honours it. The result is reported rather than assumed, so the
     * model can say "switch to DSH" instead of guessing.
     *
     * @returns `{ attempted, visible }` — what was tried and what is true after.
     */
    async function revealWindow() {
      const root = doc()
      if (root === undefined || visibleNow() === true) return { attempted: false, visible: visibleNow() }
      const view = root.defaultView
      let attempted = false
      if (typeof view?.focus === 'function') {
        attempted = true
        try {
          view.focus()
        } catch {
          // A refused focus call is not an error; it is the common outcome.
        }
        // Give the platform a turn to act on it before reading the result back.
        await new Promise((resolve) => setTimeout(resolve, 60))
      }
      return { attempted, visible: visibleNow() }
    }

    /** The slot ledger rows for one key, normalized and ordered. */
    function ledgerRows(services, key) {
      const entries = services?.slots?.entries?.(key) ?? []
      return entries.map((entry) => ({
        id: entry?.options?.id,
        order: entry?.options?.order ?? 0,
        label: typeof entry?.options?.label === 'function'
          ? entry.options.label()
          : (entry?.options?.label ?? ''),
        registrant: entry?.registrant,
      })).filter((row) => typeof row.id === 'string' && row.id !== '')
        .sort((left, right) => left.order - right.order)
    }

    /** The five nearest ids to a misspelling, so a caller can correct itself. */
    function candidatesFor(rows, wanted) {
      const text = String(wanted ?? '').toLowerCase()
      const score = (candidate) => {
        const id = String(candidate.id).toLowerCase()
        if (id === text) return 100
        if (id.startsWith(text)) return 50
        if (id.includes(text)) return 25
        if (candidate.label?.toLowerCase?.().includes(text)) return 20
        return 0
      }
      return [...rows]
        .map((row) => ({ row, score: score(row) }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 5)
        .map(({ row }) => ({ id: row.id, label: row.label }))
    }

    /** The `settings.open` command's effective binding, if the catalogue has it. */
    function settingsShortcutAria(services) {
      const catalog = services?.shortcuts?.catalog?.getSnapshot?.() ?? []
      const row = catalog.find((entry) => entry?.id === 'settings.open')
      return typeof row?.aria === 'string' && row.aria !== '' ? row.aria : undefined
    }

    /**
     * Click the settings entry and wait for the dialog.
     *
     * Three routes, tried in the order that fails most honestly:
     *
     *   1. the button carrying the settings shortcut's `aria-keyshortcuts`. That
     *      is the sidebar launcher in a plain composition, and the account menu's
     *      "Settings" row when `ui-settings-account` owns the launcher seat —
     *      `MenuRow` renders the same attribute on menu rows;
     *   2. the account menu itself: open the `aria-haspopup="menu"` trigger, then
     *      click the row inside the opened menu. Needed because a closed menu is
     *      not in the document at all, so route 1 finds nothing until it is open;
     *   3. any `aria-haspopup="dialog"` button outside a modal — the generic
     *      launcher, which is the fallback for a composition that renames the
     *      seat.
     *
     * Every route ends the same way: wait for the dialog, and report failure if
     * it does not appear. Returning "opened" because a click happened is the one
     * thing this must not do.
     */
    async function openSettingsDialog(services) {
      const already = first(SETTINGS_MODAL)
      if (already !== null) return { ok: true, how: 'noop' }

      const foreign = all(ANY_DIALOG)
      const top = foreign[foreign.length - 1]
      if (top !== undefined && top.getAttribute?.('data-shortcut-modal') !== 'settings') {
        const id = top.getAttribute?.('data-shortcut-modal') ?? 'a dialog'
        return {
          ok: false,
          reason: `another dialog ("${id}") is open; the console does not close a dialog it did not open`,
        }
      }
      // A menu left open by an earlier attempt is dismissed rather than treated
      // as an obstacle: this plugin opens menus on the way to the settings row,
      // and a transient popup must not lock the caller out of retrying.
      if (all(ANY_MENU).length > 0) await dismissMenus()

      const tried = []

      /**
       * A budget for the whole search, not per attempt.
       *
       * The host gives an action five seconds before it reports "no interface",
       * and that answer is indistinguishable from a closed window — so an
       * overrun does not look like a slow search, it looks like the page is
       * gone. The search therefore stops itself well inside that budget and
       * answers with what it tried, which is a fact the caller can act on.
       */
      const deadline = Date.now() + OPEN_BUDGET_MS

      /**
       * Press one element the way a person does, then wait for a result.
       *
       * The sequence matters: the shell's menus open on `click` but the anchor
       * also closes on a document-level `pointerdown` from elsewhere, and a bare
       * `.click()` reaches neither. Every earlier version that used `.click()`
       * reported success while the menu stayed shut.
       */
      const press = (node) => {
        const root = doc()
        const view = root?.defaultView
        const box = node.getBoundingClientRect?.()
        const x = box === undefined ? 0 : Math.round(box.left + box.width / 2)
        const y = box === undefined ? 0 : Math.round(box.top + box.height / 2)
        for (const [type, Ctor] of [
          ['pointerover', 'PointerEvent'], ['pointerenter', 'PointerEvent'],
          ['pointermove', 'PointerEvent'], ['pointerdown', 'PointerEvent'], ['mousedown', 'MouseEvent'],
          ['pointerup', 'PointerEvent'], ['mouseup', 'MouseEvent'],
        ]) {
          if (typeof view?.[Ctor] !== 'function') continue
          node.dispatchEvent?.(new view[Ctor](type, {
            bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y,
            button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
          }))
        }
        node.click?.()
      }

      /**
       * Open a menu-shaped control and look for the settings row inside it.
       *
       * @returns the row when this menu holds one, otherwise `undefined`.
       */
      const menuRowOf = async (trigger, ariaHint) => {
        if (all(ANY_MENU).length > 0) await dismissMenus()
        press(trigger)
        return waitFor(() => {
          const items = all('[role="menuitem"]')
          return items.length === 0 ? undefined : settingsRowIn(items, ariaHint)
        })
      }

      // Ordering is the whole fix.
      //
      // The page has many `aria-haspopup="menu"` buttons — a sidebar panel's
      // overflow, a transcript's "more actions", the session view menu — and
      // trying them in DOM order burns a full verification window per miss.
      // Five misses is five seconds, which is this channel's timeout, so the
      // caller was told "no interface" while the browser was still walking the
      // list. The caller then retried, and the retained work made it look like a
      // settings page that needed several attempts to open.
      //
      // Nothing here guesses: a menu is only opened if there is a reason to
      // believe it holds the settings row.
      const aria = settingsShortcutAria(services)

      // 1. The element already carrying the settings shortcut, if the shell
      //    renders one on the page. This is the launcher in a plain composition.
      if (aria !== undefined) {
        for (const node of all(`[aria-keyshortcuts="${aria}"]`)) {
          tried.push('shortcut mark')
          press(node)
          if (await waitFor(() => first(SETTINGS_MODAL)) !== undefined) return { ok: true, how: 'dom' }
        }
      }

      // 2. Menu triggers whose accessible name says they are the account/entry
      //    menu. The shipped composition puts 设置 inside that one, and naming it
      //    is the difference between one click and a search.
      const named = all('button[aria-haspopup="menu"]').filter((node) => {
        const label = String(node.getAttribute?.('aria-label') ?? node.textContent ?? '')
        return /账号|账户|account|用户|user|更多|more/iu.test(label)
      })
      for (const trigger of named) {
        tried.push(`named menu:${String(trigger.getAttribute?.('aria-label') ?? '').slice(0, 12)}`)
        const row = await menuRowOf(trigger, aria)
        if (row !== undefined && row !== null) {
          press(row)
          if (await waitFor(() => first(SETTINGS_MODAL)) !== undefined) return { ok: true, how: 'dom' }
        }
      }

      // 3. Every remaining menu trigger, ONE attempt each, but only while the
      //    shared budget below still has room.
      for (const trigger of all('button[aria-haspopup="menu"]')) {
        if (named.includes(trigger)) continue
        if (Date.now() > deadline) break
        tried.push('other menu')
        const row = await menuRowOf(trigger, aria)
        if (row !== undefined && row !== null) {
          press(row)
          if (await waitFor(() => first(SETTINGS_MODAL)) !== undefined) return { ok: true, how: 'dom' }
        }
      }

      // 4. Any dialog-hinted button outside a modal: the generic launcher.
      for (const candidate of all('button[aria-haspopup="dialog"]')) {
        if (candidate.closest?.('[data-shortcut-modal]') != null) continue
        if (Date.now() > deadline) break
        tried.push('dialog trigger')
        press(candidate)
        if (await waitFor(() => first(SETTINGS_MODAL)) !== undefined) return { ok: true, how: 'dom' }
      }

      return {
        ok: false,
        reason: `the settings dialog did not open after trying ${tried.length} trigger(s)`,
        tried,
      }
    }

    /**
     * Close whatever menu is open, and wait for it to leave the DOM.
     *
     * Escape is the one path every menu surface in this shell honours, and the
     * menus that matter are portalled so a click elsewhere is not guaranteed to
     * reach them.
     */
    async function dismissMenus() {
      const root = doc()
      if (root?.defaultView?.KeyboardEvent !== undefined) {
        root.dispatchEvent(new root.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      }
      await waitFor(() => all(ANY_MENU).length === 0)
    }

    /**
     * The settings row inside an open menu.
     *
     * Two signals, in order of reliability:
     *
     *   1. the shortcut mark — present only when the shell passes the effective
     *      binding down to the row, which it does not always;
     *   2. the label. This is what the shipped composition actually shows: the
     *      "more" menu lists 设置 / Settings with no keycap beside it, so the
     *      attribute search finds nothing and only the text matches.
     *
     * Both languages are checked because the page's language is the user's.
     *
     * @returns the row element, or `undefined`.
     */
    function settingsRowIn(items, aria) {
      const marked = aria === undefined
        ? undefined
        : items.find((node) => node.getAttribute?.('aria-keyshortcuts') === aria)
      if (marked !== undefined) return marked
      return items.find((node) => /^\s*(设置|settings)\s*$/iu.test(node.textContent ?? ''))
    }

    /**
     * Select one section inside the open dialog.
     *
     * The nav is rendered from the same `settings.section` ledger this plugin
     * reads, sorted by `order`, so the POSITION of a section is stable across
     * languages while its label is not. Position is what is clicked; the label
     * only travels back in the answer.
     */
    async function selectSettingsSection(services, sectionId) {
      const rows = ledgerRows(services, 'settings.section')
      const index = rows.findIndex((row) => row.id === sectionId)
      if (index === -1) {
        return {
          ok: false,
          reason: `no settings section "${sectionId}" is registered in this interface`,
          candidates: candidatesFor(rows, sectionId),
        }
      }
      const target = rows[index]
      const dialog = first(SETTINGS_MODAL)
      const cells = dialog?.querySelectorAll?.('nav button') ?? []
      const button = cells[index]
      if (button === undefined || button === null) {
        return {
          ok: false,
          reason: `the settings dialog shows ${cells.length} section(s) but the ledger lists ${rows.length}; the interface is not rendering this registration`,
        }
      }
      if (button.getAttribute?.('aria-current') !== 'true') button.click()
      const selected = await waitFor(() => button.getAttribute?.('aria-current') === 'true')
      if (selected !== true) {
        return { ok: false, reason: `clicking the "${target.label || target.id}" section did not select it` }
      }
      return { ok: true, how: 'dom', section: target }
    }

    /** Close the settings dialog by asking the modal layer to close its top layer. */
    async function closeSettingsDialog() {
      const dialog = first(SETTINGS_MODAL)
      if (dialog === null) return { status: 'ok', target: 'settings', how: 'noop', verified: true }
      const root = doc()
      // `useModalLayer` listens for Escape on the document and does not inspect
      // `isTrusted`, so this is the same path a keystroke takes — and it is the
      // only path that works whatever the shell's close button looks like.
      const event = new root.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      root.dispatchEvent(event)
      const closed = await waitFor(() => first(SETTINGS_MODAL) === null)
      if (closed !== true) {
        return { status: 'error', target: 'settings', reason: 'the settings dialog did not close after Escape', verified: false }
      }
      return { status: 'ok', target: 'settings', how: 'dom', verified: true }
    }

    /** The current interface state, as `ui.state` and the panel both read it. */
    function readUiState(services) {
      const modal = all('[data-shortcut-modal]').at(-1)
      const dialog = first(SETTINGS_MODAL)
      const selected = dialog?.querySelector?.('nav button[aria-current="true"]')
      const rows = ledgerRows(services, 'settings.section')
      const selectedLabel = selected?.textContent
      const section = rows.find((row) => row.label === selectedLabel) ?? null
      const panelInfo = services?.layout?.panelInfo?.getSnapshot?.()
      const rightbar = services?.sidebarRight
      return {
        status: 'ok',
        // Reported so a caller knows whether a screenshot taken now would show
        // the result. Never a refusal: the state below is equally true while
        // hidden, and the user simply has to switch to DSH to see it.
        visible: visibleNow(),
        modal: modal === undefined ? null : (modal.getAttribute?.('data-shortcut-modal') ?? 'other'),
        settings: { open: dialog !== null, section },
        main: { active: panelInfo?.activePanelId ?? null },
        rightbar: {
          expanded: typeof rightbar?.isExpanded === 'function' ? rightbar.isExpanded() : undefined,
        },
      }
    }

    /**
     * Read the interactive elements the page currently shows, each with a stable
     * handle the caller can act on.
     *
     * This is the difference between guessing coordinates and naming a thing.
     * A screenshot answers "what does it look like"; this answers "what can be
     * pressed, what is it called, and is it reachable" — which is what an agent
     * needs to drive an interface it has never seen.
     *
     * The shape and the rules follow `app-ui-control/snapshot.ts` in lumii,
     * where the same problem was solved for a different shell:
     *
     *   - `ref` is derived from POSITION in the walk, not from an attribute, so
     *     it is stable within one snapshot and detectably stale across two;
     *   - `snapshotId` changes whenever the element list changes, so acting on a
     *     ref from a previous snapshot is refused rather than mis-clicked;
     *   - `occluded` marks an element whose centre is covered by a dialog or
     *     overlay — clicking it would hit the cover instead;
     *   - `value`/`placeholder` are separated, because reporting a placeholder as
     *     the current value is how a form silently gets rewritten with the wrong
     *     text.
     *
     * @param options.limit - maximum elements, default 120.
     * @param options.roles - keep only these roles.
     * @param options.scope - a CSS selector limiting the walk to one region.
     * @returns `{ snapshotId, elements, truncated }`.
     */
    function snapshotElements(options = {}) {
      const root = doc()
      if (root === undefined) return { snapshotId: '', elements: [], truncated: false }
      const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : 120
      const wanted = Array.isArray(options.roles) && options.roles.length > 0
        ? new Set(options.roles.map((role) => String(role).toLowerCase()))
        : undefined
      const scope = typeof options.scope === 'string' && options.scope !== ''
        ? (root.querySelector?.(options.scope) ?? null)
        : null

      const SELECTOR = [
        'button', 'a[href]', 'input', 'textarea', 'select',
        '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="switch"]', '[role="option"]',
        '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      ].join(',')

      /** Collapse whitespace the way a screen reader would read the label. */
      const text = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim()
      const NAME_MAX = 80

      /** The accessible name, in the order the platform resolves it. */
      function nameOf(node) {
        const label = node.getAttribute?.('aria-label')
        if (label) return text(label).slice(0, NAME_MAX)
        const labelledBy = node.getAttribute?.('aria-labelledby')
        if (labelledBy) {
          const ref = root.getElementById?.(labelledBy)
            ?? root.querySelector?.(`#${String(labelledBy).replace(/["\\]/gu, '\\$&')}`)
          if (ref?.textContent) return text(ref.textContent).slice(0, NAME_MAX)
        }
        const tag = String(node.tagName ?? '').toLowerCase()
        if (tag === 'input' || tag === 'textarea') {
          const title = node.getAttribute?.('title')
          if (title) return text(title).slice(0, NAME_MAX)
          const placeholder = node.getAttribute?.('placeholder')
          if (placeholder) return text(placeholder).slice(0, NAME_MAX)
          const name = node.getAttribute?.('name')
          if (name) return text(name).slice(0, NAME_MAX)
          return ''
        }
        if (tag === 'select') {
          const selected = node.options?.[node.selectedIndex]
          return text(selected?.textContent ?? '').slice(0, NAME_MAX)
        }
        return text(node.textContent).slice(0, NAME_MAX)
      }

      /** The role a caller can branch on. */
      function roleOf(node) {
        const explicit = node.getAttribute?.('role')
        if (explicit) return String(explicit).toLowerCase()
        const tag = String(node.tagName ?? '').toLowerCase()
        if (tag === 'select') return 'combobox'
        if (tag === 'input') {
          const type = String(node.getAttribute?.('type') ?? 'text').toLowerCase()
          if (type === 'checkbox') return 'checkbox'
          if (type === 'radio') return 'radio'
          if (type === 'submit' || type === 'button') return 'button'
          return 'textbox'
        }
        if (tag === 'textarea') return 'textbox'
        if (tag === 'a') return 'link'
        if (tag === 'button') return 'button'
        if (/^h[1-6]$/u.test(tag)) return 'heading'
        return 'generic'
      }

      /** Whether an ancestor hides this node from the user. */
      function hidden(node) {
        for (let at = node; at !== undefined && at !== null; at = at.parentElement ?? at.parent) {
          if (at.getAttribute?.('aria-hidden') === 'true') return true
          if (at.hidden === true) return true
          const style = at.style
          if (style !== undefined && (style.display === 'none' || style.visibility === 'hidden')) return true
        }
        return false
      }

      /**
       * Whether something else covers the element's centre.
       *
       * A click at that point would land on the cover — a dialog mask, a sticky
       * header, another popup — so the element is reported as unreachable rather
       * than offered and then missed. `elementFromPoint` is the same hit test the
       * browser uses to decide what receives the click.
       */
      function occluded(node, rect) {
        const view = root.defaultView
        if (typeof root.elementFromPoint !== 'function' || view === undefined) return false
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        if (x < 0 || y < 0 || x > (view.innerWidth ?? Infinity) || y > (view.innerHeight ?? Infinity)) return true
        const top = root.elementFromPoint(x, y)
        if (top === null || top === undefined) return false
        // Either the hit is the element itself, or it is a descendant of it
        // (an icon inside a button), which still means the element receives it.
        return top !== node && !node.contains?.(top)
      }

      const candidates = [...(scope ?? root).querySelectorAll(SELECTOR)]
      const elements = []
      let truncated = false

      for (const node of candidates) {
        if (elements.length >= limit) {
          truncated = true
          break
        }
        if (hidden(node)) continue
        const role = roleOf(node)
        if (wanted !== undefined && !wanted.has(role)) continue
        const box = node.getBoundingClientRect?.()
        if (box === undefined || box === null) continue
        if (box.width <= 0 || box.height <= 0) continue
        if (role === 'generic' && text(node.textContent) === '') continue

        const entry = {
          ref: `e${elements.length + 1}`,
          role,
          name: nameOf(node),
          x: Math.round(box.left),
          y: Math.round(box.top),
          w: Math.round(box.width),
          h: Math.round(box.height),
        }
        if (occluded(node, box)) entry.occluded = true
        if (node.closest?.('[data-shortcut-modal]') != null) entry.inDialog = true

        const tag = String(node.tagName ?? '').toLowerCase()
        if (tag === 'input' || tag === 'textarea') {
          const type = String(node.getAttribute?.('type') ?? '').toLowerCase()
          // A password field is never read back; the caller needs to know it is
          // there and that it holds something, not what.
          entry.value = type === 'password' ? (node.value ? '***' : '') : String(node.value ?? '')
          const placeholder = node.getAttribute?.('placeholder')
          if (placeholder) entry.placeholder = text(placeholder)
          if (node.disabled === true) entry.disabled = true
        } else if (tag === 'select') {
          entry.value = String(node.value ?? '')
          entry.options = [...(node.options ?? [])].slice(0, 50).map((option) => ({
            value: String(option.value),
            label: text(option.textContent),
          }))
          if (node.disabled === true) entry.disabled = true
        } else if (node.getAttribute?.('aria-disabled') === 'true' || node.disabled === true) {
          entry.disabled = true
        }

        // The live node rides along so `ui.act` can reach it without a second
        // lookup that might find something else by the time it runs.
        Object.defineProperty(entry, '__node', { value: node, enumerable: false })
        elements.push(entry)
      }

      // A snapshot id derived from what was found: two snapshots that describe
      // the same elements share it, and any change invalidates stale refs.
      const signature = elements.map((element) => `${element.role}|${element.name}|${element.x},${element.y}`).join('\n')
      const snapshotId = `s_${hash(String(signature))}`
      lastSnapshot = { id: snapshotId, elements }
      return { snapshotId, elements, truncated }
    }

    /** The most recent snapshot, so a ref can be resolved and its age checked. */
    let lastSnapshot = { id: '', elements: [] }

    /**
     * A cheap fingerprint of what the page currently shows.
     *
     * Used to decide whether a click DID anything. It counts the interactive
     * elements and hashes their names, which changes for a menu opening, a
     * dialog appearing, a list growing or a panel swapping — every effect a
     * click is supposed to have. It is deliberately not a full snapshot: this
     * runs on every verification poll.
     */
    function snapshotSignature() {
      const root = doc()
      if (root === undefined) return ''
      const nodes = root.querySelectorAll?.(
        'button, a[href], input, textarea, select, [role="menuitem"], [role="tab"], [role="switch"], [data-shortcut-modal]',
      ) ?? []
      const parts = []
      for (const node of nodes) {
        parts.push(`${node.tagName}|${(node.textContent ?? '').trim().slice(0, 24)}|${node.getAttribute?.('aria-expanded') ?? ''}`)
      }
      return hash(parts.join('\n'))
    }

    /** A small deterministic hash, enough to key a snapshot. */
    function hash(text) {
      let value = 5381
      for (let index = 0; index < text.length; index += 1) {
        value = ((value << 5) + value + text.charCodeAt(index)) | 0
      }
      return (value >>> 0).toString(36)
    }

    /** Resolve one ref against the current snapshot, or say why not. */
    function resolveRef(ref, snapshotId) {
      if (typeof ref !== 'string' || ref === '') {
        return { error: 'missing_ref', reason: 'ui.act needs a ref from ui.list' }
      }
      if (lastSnapshot.id === '') {
        return { error: 'stale_snapshot', reason: 'no snapshot has been taken; call ui.list first' }
      }
      if (snapshotId !== undefined && snapshotId !== lastSnapshot.id) {
        return {
          error: 'stale_snapshot',
          reason: `snapshot ${String(snapshotId)} is not the current one (${lastSnapshot.id}); call ui.list again`,
        }
      }
      const entry = lastSnapshot.elements.find((element) => element.ref === ref)
      if (entry === undefined) {
        return {
          error: 'missing_ref',
          reason: `no element "${ref}" in snapshot ${lastSnapshot.id}`,
          available: lastSnapshot.elements.slice(0, 10).map((element) => ({ ref: element.ref, role: element.role, name: element.name })),
        }
      }
      if (entry.disabled === true) {
        return { error: 'not_interactive', reason: `"${entry.name}" is disabled` }
      }
      return { entry }
    }

    /**
     * Act on one element from the last snapshot.
     *
     * Clicking is a real click on the live node rather than a synthesized
     * pointer event at coordinates: the node is the thing the snapshot named, so
     * a layout shift between snapshot and action cannot aim at a neighbour. The
     * scroll-into-view and re-measure lumii does with coordinates is unnecessary
     * here for the same reason.
     *
     * @param args.ref - the element handle from `ui.list`.
     * @param args.snapshotId - the snapshot the ref came from, for staleness.
     * @param args.action - `click`, `type`, `select` or `key`.
     */
    async function actOn(services, args) {
      const action = String(args?.action ?? '')
      if (!['click', 'type', 'select', 'key'].includes(action)) {
        return { status: 'error', reason: 'ui.act needs action of "click", "type", "select" or "key"' }
      }
      if (action === 'key') {
        const key = String(args.key ?? '')
        const allowed = ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown',
          'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Space']
        if (!allowed.includes(key)) {
          return { status: 'error', reason: `key must be one of ${allowed.join(', ')}` }
        }
        const root = doc()
        root?.dispatchEvent?.(new root.defaultView.KeyboardEvent('keydown', { key, bubbles: true }))
        return { status: 'ok', target: 'key', resolved: { key }, how: 'dom', verified: true }
      }

      const found = resolveRef(args.ref, args.snapshotId)
      if (found.error !== undefined) return { status: 'error', reason: found.reason, code: found.error, available: found.available }
      const element = found.entry
      const node = element.__node
      if (node === undefined || node.isConnected === false) {
        return {
          status: 'error',
          code: 'stale_snapshot',
          reason: `"${element.name}" is no longer in the document; call ui.list again`,
        }
      }

      if (action === 'click') {
        const root = doc()
        const view = root?.defaultView
        const box = node.getBoundingClientRect?.()
        const x = box === undefined ? 0 : Math.round(box.left + box.width / 2)
        const y = box === undefined ? 0 : Math.round(box.top + box.height / 2)

        // Capture what the page looked like BEFORE the press. Taking these
        // afterwards compares the result against itself and can never see a
        // change — which is how a no-op click would still report success.
        const before = snapshotSignature()
        const expandedBefore = node.getAttribute?.('aria-expanded')

        // A real press, not just `.click()`.
        //
        // The shell's menus open on `click` but close on a document-level
        // `pointerdown` from anywhere else, and several controls read
        // `pointerdown` before `click` to decide what they are. Calling only
        // `click()` therefore reports success while the UI does nothing — which
        // is exactly what a real run showed. The sequence below is what a mouse
        // actually produces, and the coordinates are the element's own centre so
        // a listener that hit-tests still lands on it.
        const pointer = (type, Ctor) => {
          if (typeof view?.[Ctor] !== 'function') return undefined
          return new view[Ctor](type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: type === 'pointerup' || type === 'mouseup' || type === 'click' ? 0 : 1,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          })
        }
        for (const [type, ctor] of [
          ['pointerover', 'PointerEvent'],
          ['pointerenter', 'PointerEvent'],
          ['pointermove', 'PointerEvent'],
          ['pointerdown', 'PointerEvent'],
          ['mousedown', 'MouseEvent'],
          ['pointerup', 'PointerEvent'],
          ['mouseup', 'MouseEvent'],
        ]) {
          const event = pointer(type, ctor)
          if (event !== undefined) node.dispatchEvent?.(event)
        }
        // `click` last, through the method so a synthetic listener that only
        // listens for the DOM `click` still runs.
        node.click?.()

        // VERIFY. A click is not a result: wait for something observable to
        // change and report failure when nothing does.
        const changed = await waitFor(() => {
          const expandedNow = node.getAttribute?.('aria-expanded')
          if (expandedBefore !== expandedNow) return true
          if (all(ANY_MENU).length > 0) return true
          if (first(SETTINGS_MODAL) !== null) return true
          return snapshotSignature() !== before
        })
        if (changed !== true) {
          return {
            status: 'error',
            target: 'element',
            verified: false,
            reason: `clicking "${element.name}" changed nothing on the page`,
            resolved: { element: { ref: element.ref, role: element.role, name: element.name } },
          }
        }
        return {
          status: 'ok', target: 'element', how: 'dom', verified: true,
          resolved: { element: { ref: element.ref, role: element.role, name: element.name } },
        }
      }

      // type / select both need a writable control.
      const tag = String(node.tagName ?? '').toLowerCase()
      if (action === 'type') {
        if (tag !== 'input' && tag !== 'textarea' && node.isContentEditable !== true) {
          return { status: 'error', code: 'not_editable', reason: `"${element.name}" (${element.role}) is not an editable field` }
        }
        const text = String(args.text ?? '')
        if (node.isContentEditable === true && tag !== 'input' && tag !== 'textarea') {
          node.textContent = text
        } else {
          // React tracks the previous value on the node itself, so a plain
          // assignment is not seen as an edit. Going through the prototype setter
          // is what makes its onChange fire — the same trick a test harness uses.
          // Resolved defensively: a fixture without the DOM constructors must
          // still get the value written, just without the React notification.
          const proto = tag === 'textarea'
            ? globalThis.HTMLTextAreaElement?.prototype
            : globalThis.HTMLInputElement?.prototype
          const setter = proto === undefined ? undefined : Object.getOwnPropertyDescriptor(proto, 'value')?.set
          if (typeof setter === 'function') setter.call(node, text)
          else node.value = text
          const view = doc()?.defaultView
          if (typeof view?.Event === 'function') {
            node.dispatchEvent?.(new view.Event('input', { bubbles: true }))
            node.dispatchEvent?.(new view.Event('change', { bubbles: true }))
          }
        }
        return { status: 'ok', target: 'element', how: 'dom', verified: true, resolved: { element: { ref: element.ref, name: element.name }, value: text } }
      }

      if (tag !== 'select') {
        return { status: 'error', code: 'not_select', reason: `"${element.name}" (${element.role}) is not a select` }
      }
      const wanted = args.value !== undefined ? String(args.value) : undefined
      const label = args.label !== undefined ? String(args.label) : undefined
      const option = [...(node.options ?? [])].find((candidate) => (wanted !== undefined && String(candidate.value) === wanted)
        || (wanted === undefined && label !== undefined && text(candidate.textContent) === label))
      if (option === undefined) {
        return {
          status: 'error', code: 'option_not_found',
          reason: `no option ${wanted !== undefined ? `with value "${wanted}"` : `labelled "${String(label)}"`}`,
          options: element.options,
        }
      }
      node.value = option.value
      const view = doc()?.defaultView
      if (typeof view?.Event === 'function') node.dispatchEvent?.(new view.Event('change', { bubbles: true }))
      return { status: 'ok', target: 'element', how: 'dom', verified: true, resolved: { element: { ref: element.ref, name: element.name }, value: option.value } }
    }

    /**
     * Play a recorded-walkthrough step list.
     *
     * Every step is resolved by NAME against a fresh snapshot, never by a ref
     * captured earlier: the whole point of a walkthrough is that the interface
     * moves between steps, and a ref from three steps ago is exactly the handle
     * that would be stale. The cost is one snapshot per acting step, which is
     * tens of milliseconds — invisible in a video and cheap next to clicking the
     * wrong thing.
     *
     * A failed step stops the list and reports which one, so the caller can
     * discard the recording rather than keep a take that went wrong halfway.
     *
     * @param services - the live Client services.
     * @param args.steps - the normalized steps from the Host.
     * @param args.stopOnError - whether a failure ends the run.
     * @returns `{ status, completed, failed? }`.
     */
    async function playSteps(services, args) {
      const steps = Array.isArray(args?.steps) ? args.steps : []
      if (steps.length === 0) return { status: 'error', reason: 'ui.pipeline needs steps' }
      let completed = 0
      for (const step of steps) {
        const index = Number.isFinite(step?.index) ? step.index : completed
        const failure = await playOne(services, step)
        if (failure !== undefined) {
          return {
            status: 'error',
            reason: failure.reason,
            failed: { index, step, reason: failure.reason, code: failure.code },
            completed,
          }
        }
        completed += 1
        // Settle: give the interface (and the codec) a moment to show the change.
        // The default is one frame at 12 fps plus a beat, which reads as "the
        // thing happened" without padding the video.
        const settle = Number.isFinite(step?.settle) ? step.settle : 90
        if (settle > 0) await new Promise((resolve) => setTimeout(resolve, settle))
      }
      return { status: 'ok', completed, total: steps.length }
    }

    /**
     * Run one step.
     *
     * @returns `undefined` on success, or `{ reason, code? }` naming the failure.
     */
    async function playOne(services, step) {
      const action = step?.action
      if (action === 'wait') {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(step.wait) || 0)))
        return undefined
      }
      if (action === 'snapshot') {
        const options = step.snapshot ?? {}
        const snap = snapshotElements({
          limit: options.limit,
          roles: options.roles,
          scope: options.scope,
        })
        if (snap.elements.length === 0) {
          return { reason: 'the page offers no interactive elements to capture', code: 'empty_snapshot' }
        }
        return undefined
      }
      if (action === 'expect') {
        return checkExpectation(services, step.expect)
      }
      if (action === 'close') {
        const outcome = await closeSettingsDialog()
        return outcome.status === 'ok' ? undefined : { reason: String(outcome.reason), code: 'close_failed' }
      }
      if (action === 'invoke') {
        const outcome = await invokeCommand(services, step.invoke)
        return outcome.status === 'ok' ? undefined : { reason: String(outcome.reason), code: String(outcome.status) }
      }
      if (action === 'open') {
        const revealed = await revealWindow()
        const outcome = await openTarget(services, step.open ?? {}, step.open?.target)
        if (outcome.status !== 'ok') return { reason: String(outcome.reason), code: String(outcome.status) }
        // The recording goes on regardless of whether the window came forward,
        // but a walkthrough shot against an unseen window is worthless, so it is
        // reported as a failure here rather than silently recorded.
        if (revealed.visible === false) {
          return { reason: 'the DSH window is in the background; bring it forward before recording', code: 'not_visible' }
        }
        return undefined
      }
      if (action === 'scroll') {
        return scrollToName(services, step.scroll)
      }
      if (action === 'act') {
        return playAct(services, step.act)
      }
      return { reason: `unknown step action "${String(action)}"`, code: 'bad_step' }
    }

    /**
     * One `act` step, resolved by name at the moment it runs.
     *
     * The match is exact on the accessible name and, when given, on the role.
     * A name that matches several elements is refused rather than resolved to
     * the first: a walkthrough that clicks "设置" and lands on a different 设置
     * from the one the author meant is worse than one that stops and says so.
     */
    async function playAct(services, act) {
      const wanted = String(act?.name ?? '')
      if (wanted === '') return { reason: 'act needs a name', code: 'bad_step' }
      const snap = snapshotElements({ limit: 300 })
      const matches = snap.elements.filter((element) => element.name === wanted
        && (act.role === undefined || element.role === act.role))
      if (matches.length === 0) {
        return {
          reason: `no element named "${wanted}"${act.role === undefined ? '' : ` with role ${String(act.role)}`} is on the page`,
          code: 'not_found',
        }
      }
      if (matches.length > 1 && act.allowAmbiguous !== true) {
        return {
          reason: `${String(matches.length)} elements are named "${wanted}"; add a role or set allowAmbiguous`,
          code: 'ambiguous',
          candidates: matches.slice(0, 5).map((element) => ({ ref: element.ref, role: element.role })),
        }
      }
      const target = matches[0]
      const outcome = await actOn(services, {
        action: act.action,
        ref: target.ref,
        snapshotId: snap.snapshotId,
        text: act.text,
        value: act.value,
        label: act.label,
      })
      return outcome.status === 'ok'
        ? undefined
        : { reason: String(outcome.reason ?? outcome.status), code: String(outcome.code ?? outcome.status) }
    }

    /** Check one expectation against the live page. */
    function checkExpectation(services, expect) {
      if (expect === null || typeof expect !== 'object') {
        return { reason: 'expect needs an object', code: 'bad_step' }
      }
      const state = readUiState(services)
      if (expect.modal !== undefined && state.modal !== expect.modal) {
        return { reason: `expected modal ${String(expect.modal)} but found ${String(state.modal)}`, code: 'expectation_failed' }
      }
      if (expect.section !== undefined) {
        const id = state.settings.section?.id
        if (id !== expect.section) {
          return { reason: `expected section ${String(expect.section)} but found ${String(id)}`, code: 'expectation_failed' }
        }
      }
      if (expect.main !== undefined && state.main.active !== expect.main) {
        return { reason: `expected main panel ${String(expect.main)} but found ${String(state.main.active)}`, code: 'expectation_failed' }
      }
      if (expect.visible !== undefined && visibleNow() !== expect.visible) {
        return { reason: `expected visible=${String(expect.visible)} but the page reports ${String(visibleNow())}`, code: 'expectation_failed' }
      }
      if (expect.name !== undefined) {
        const snap = snapshotElements({ limit: 300 })
        const found = snap.elements.some((element) => element.name === String(expect.name))
        if (expect.present === false ? found : !found) {
          return {
            reason: `expected "${String(expect.name)}" to be ${expect.present === false ? 'absent' : 'present'}`,
            code: 'expectation_failed',
          }
        }
      }
      return undefined
    }

    /** Scroll a named element into view, or fail naming it. */
    function scrollToName(services, scroll) {
      const wanted = String(scroll?.name ?? '')
      if (wanted === '') return { reason: 'scroll needs a name', code: 'bad_step' }
      const snap = snapshotElements({ limit: 300 })
      const target = snap.elements.find((element) => element.name === wanted)
      if (target === undefined) return { reason: `no element named "${wanted}" is on the page`, code: 'not_found' }
      target.__node?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
      return undefined
    }

    /**
     * Every surface this interface offers, with the plugin that contributed it.
     *
     * `registrant` is the answer to "which plugin owns this page": the renderer
     * stamps each registration with its entry name, and an entry name is a
     * package name. Nothing here is declared by the plugins themselves, so a new
     * settings page appears in this list the moment it registers.
     */
    function readUiList(services, args = {}) {
      const state = readUiState(services)
      const tabs = (services?.sidebarRightTabs?.entries?.() ?? []).map((entry) => ({
        kind: entry.kind,
        id: entry.id,
        multiple: entry.multiple === true,
      }))
      const commands = (services?.shortcuts?.catalog?.getSnapshot?.() ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        keys: row.keys,
        aria: row.aria,
        binding: row.binding,
        aliases: row.aliases,
      }))
      const panels = ledgerRows(services, 'sidebar.panellist')
      const mainKeys = (services?.slots?.entries?.('main') ?? [])
        .map((entry) => entry?.options?.key)
        .filter((key) => typeof key === 'string' && key !== '')
      const wantedElements = args.elements === true
      return {
        status: 'ok',
        visible: state.visible,
        modal: state.modal,
        settings: { open: state.settings.open, section: state.settings.section, sections: ledgerRows(services, 'settings.section') },
        main: {
          active: state.main.active,
          panels,
          // A sidebar entry without a matching main key selects nothing; naming
          // both lets a caller tell a real panel from a stale entry.
          registered: [...new Set(mainKeys)],
        },
        rightbar: { ...state.rightbar, tabs },
        commands,
        // The elements a caller can act on RIGHT NOW. This is the half that
        // makes the interface operable without coordinates: `ui.act` takes one
        // of these refs, so the agent never has to guess where anything is.
        //
        // Skipped unless asked for, because the walk is the expensive part and
        // most calls only want the ledger. `ui.list {elements:true}` opts in ;
        // `ui.snapshot` is the same thing when that is all the caller wants.
        ...(wantedElements ? elementSection() : {}),
      }
    }

    /** The element half of a list or snapshot reply, or a stated reason it is empty. */
    function elementSection(options = {}) {
      const snapshot = snapshotElements(options)
      return {
        snapshotId: snapshot.snapshotId,
        elements: snapshot.elements,
        truncated: snapshot.truncated,
      }
    }

    /** Open a main panel through its public service, translating its throw. */
    function openMainPanel(services, id) {
      const layout = services?.layout
      if (layout === undefined || typeof layout.selectPanel !== 'function') {
        return { status: 'error', reason: 'the layout service is unavailable' }
      }
      const rows = ledgerRows(services, 'sidebar.panellist')
      const known = rows.some((row) => row.id === id)
        || (services?.slots?.entries?.('main') ?? []).some((entry) => entry?.options?.key === id)
      if (!known) {
        return {
          status: 'error',
          reason: `no main panel "${id}" is registered in this interface`,
          candidates: candidatesFor(rows, id),
        }
      }
      try {
        layout.selectPanel(id)
      } catch (err) {
        return { status: 'error', reason: String(err?.message ?? err) }
      }
      return { status: 'ok', target: 'main', resolved: { panel: { id } }, how: 'service', verified: true }
    }

    /** Open a right-drawer tab through its public service. */
    function openRightbarTab(services, args) {
      const right = services?.sidebarRight
      if (right === undefined) return { status: 'error', reason: 'the sidebarRight service is unavailable' }
      if (args.address !== undefined) {
        if (typeof right.openResource !== 'function') return { status: 'error', reason: 'the sidebarRight service cannot open a resource' }
        try {
          right.openResource(args.address)
        } catch (err) {
          return { status: 'error', reason: String(err?.message ?? err) }
        }
        return { status: 'ok', target: 'rightbar', resolved: { address: args.address }, how: 'service', verified: true }
      }
      if (typeof right.openTab !== 'function') return { status: 'error', reason: 'the sidebarRight service cannot open a tab' }
      const kind = args.kind
      if (typeof services?.sidebarRightTabs?.get === 'function' && services.sidebarRightTabs.get(kind) === undefined) {
        return {
          status: 'error',
          reason: `no right-drawer tab type "${kind}" is registered in this interface`,
          candidates: (services.sidebarRightTabs.entries?.() ?? []).slice(0, 5).map((entry) => ({ id: entry.kind, label: entry.kind })),
        }
      }
      try {
        right.openTab(kind, args.url === undefined ? undefined : { params: { url: args.url } })
      } catch (err) {
        // `require()` throws "no session surface is mounted" for a global panel
        // or no session — a real property of the drawer, not a failure of this
        // request, so it is reported as unavailable with a way forward.
        const reason = String(err?.message ?? err)
        return reason.includes('no session')
          ? { status: 'unavailable', target: 'rightbar', reason, hint: 'open or create a session first' }
          : { status: 'error', target: 'rightbar', reason }
      }
      return { status: 'ok', target: 'rightbar', resolved: { kind }, how: 'service', verified: true }
    }

    /**
     * Invoke one command.
     *
     * `Shortcuts` deliberately does not expose `invoke`, and on a platform with
     * the native keyboard bridge installed the DOM route is dead too —
     * `installKeyboard(…, native = true)` returns before dispatching, because
     * native input owns the bindings. So this is attempted in order and REPORTED
     * for what it is:
     *
     *   1. a service-level `invoke`, if a future composition provides one;
     *   2. a synthesized keydown for a Web/Linux binding;
     *   3. otherwise `unavailable`, naming the keys so the user can press them.
     */
    async function invokeCommand(services, id) {
      const catalog = services?.shortcuts?.catalog?.getSnapshot?.() ?? []
      const row = catalog.find((entry) => entry?.id === id)
      if (row === undefined) {
        return {
          status: 'error',
          reason: `no command "${id}" is registered in this interface`,
          candidates: catalog.slice(0, 5).map((entry) => ({ id: entry.id, label: entry.label })),
        }
      }
      const shortcuts = services?.shortcuts
      if (typeof shortcuts?.invoke === 'function') {
        try {
          shortcuts.invoke(id, { region: 'page', modal: null, target: null })
        } catch (err) {
          return { status: 'error', reason: String(err?.message ?? err) }
        }
        return { status: 'ok', resolved: { command: { id, label: row.label } }, how: 'service', verified: true }
      }
      const binding = row.binding
      const root = doc()
      const key = binding?.code
      if (root?.defaultView?.KeyboardEvent !== undefined && typeof key === 'string' && key !== '') {
        const modifiers = new Set(binding.modifiers ?? [])
        const event = new root.defaultView.KeyboardEvent('keydown', {
          code: key,
          key: key.startsWith('Key') ? key.slice(3).toLowerCase() : (key.startsWith('Digit') ? key.slice(5) : key),
          ctrlKey: modifiers.has('control'),
          altKey: modifiers.has('alt'),
          shiftKey: modifiers.has('shift'),
          metaKey: modifiers.has('meta'),
          bubbles: true,
        })
        // `defaultPrevented` is how a consumed gesture reports itself; an
        // unbound row cannot be dispatched at all.
        root.dispatchEvent(event)
        if (event.defaultPrevented === true) {
          return { status: 'ok', resolved: { command: { id, label: row.label } }, how: 'keyboard', verified: true }
        }
      }
      const keys = Array.isArray(row.keys) && row.keys.length > 0 ? row.keys.join('+') : undefined
      return {
        status: 'unavailable',
        reason: 'this platform routes commands through its native keyboard layer, so the page cannot invoke one',
        hint: keys === undefined
          ? 'ask the user to run that command from the interface'
          : `ask the user to press ${keys}`,
        resolved: { command: { id, label: row.label, keys: row.keys } },
      }
    }

    /**
     * Open one surface. Split from the `ui.open` entry so the entry can try to
     * reveal the window without wrapping every branch in that concern.
     *
     * @param services - the live Client services.
     * @param args - the action's arguments.
     * @param target - `settings`, `main` or `rightbar`.
     * @returns the action's result envelope.
     */
    async function openTarget(services, args, target) {
      if (target === 'main') {
        if (typeof args.id !== 'string' || args.id === '') {
          return { status: 'error', target, reason: 'ui.open target "main" needs a non-empty id' }
        }
        return openMainPanel(services, args.id)
      }
      if (target === 'rightbar') {
        const hasKind = typeof args.kind === 'string' && args.kind !== ''
        const hasAddress = typeof args.address === 'string' && args.address !== ''
        if (!hasKind && !hasAddress) {
          return { status: 'error', target, reason: 'ui.open target "rightbar" needs either kind or address' }
        }
        return openRightbarTab(services, args)
      }
      if (target !== 'settings') {
        return { status: 'error', reason: `unknown ui.open target "${String(target)}"` }
      }
      const section = typeof args.section === 'string' && args.section !== '' ? args.section : undefined
      if (section !== undefined) {
        const rows = ledgerRows(services, 'settings.section')
        if (!rows.some((row) => row.id === section)) {
          // Refused before any click, so a typo cannot open the dialog on the
          // wrong page and then report a failure the user has to undo.
          return {
            status: 'error', target, reason: `no settings section "${section}" is registered in this interface`,
            candidates: candidatesFor(rows, section),
          }
        }
      }
      const opened = await openSettingsDialog(services)
      if (!opened.ok) return { status: 'error', target, reason: opened.reason, verified: false, tried: opened.tried }
      if (section === undefined) {
        return { status: 'ok', target, how: opened.how, verified: true }
      }
      const selected = await selectSettingsSection(services, section)
      if (!selected.ok) {
        return { status: 'error', target, reason: selected.reason, candidates: selected.candidates, verified: false }
      }
      return {
        status: 'ok',
        target,
        resolved: { section: selected.section },
        how: opened.how === 'noop' ? 'noop' : opened.how,
        verified: true,
      }
    }

    /** Every ui.* operation, in the same shape as `OPS`. */
    const uiOps = {
      'ui.list': (services, args) => readUiList(services, args),
      'ui.state': (services) => readUiState(services),
      // The element walk on its own, for a caller that already has the ledger
      // and only needs the current interactive set.
      'ui.snapshot': (_services, args) => {
        const section = elementSection({
          limit: args?.limit,
          roles: args?.roles,
          scope: args?.scope,
        })
        return { status: 'ok', ...section, visible: visibleNow() }
      },
      // Acting on one of those elements. The ref is the whole contract: no
      // coordinates are accepted, so a caller cannot aim at a pixel and a layout
      // shift cannot move the target.
      'ui.act': async (services, args) => actOn(services, args),
      'ui.open': async (services, args) => {
        const target = args.target
        // Bringing the window forward is an ATTEMPT, not a precondition. The
        // state change below happens either way; this only improves the odds that
        // the user sees it without switching manually, and its result is reported
        // rather than assumed.
        const revealed = await revealWindow()
        const outcome = await openTarget(services, args, target)
        if (outcome.status === 'ok' && revealed.visible !== undefined) outcome.visible = revealed.visible
        if (outcome.status === 'ok' && revealed.visible === false) {
          outcome.hint = 'the page changed while DSH was in the background; switch to it to see the result'
        }
        return outcome
      },
      'ui.close': async (_services, args) => {
        if (args.target === 'modal' || args.target === 'settings') return closeSettingsDialog()
        return { status: 'error', reason: `ui.close cannot close "${String(args.target)}"` }
      },
      'ui.invoke': async (services, args) => invokeCommand(services, args.id),
      // The step player. The Host's recording pipeline hands a validated list
      // here and waits; every step runs in THIS realm, because only the page can
      // see and press the interface.
      'ui.pipeline': async (services, args) => playSteps(services, args),
    }

    /**
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
      if (handler !== undefined) {
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
      // The ui ops are asynchronous (a DOM path has to wait for its own result)
      // and share this one entry point, so every caller — the drain loop, the
      // panel, a test — gets the same dispatch without knowing which family an
      // op belongs to.
      const ui = Object.hasOwn(uiOps, op) ? uiOps[op] : undefined
      if (ui === undefined) {
        return { status: 'error', reason: `unknown appearance op "${op}"` }
      }
      if (services === null || services === undefined) {
        return { status: 'error', reason: 'no Client services are available' }
      }
      const blocked = unserviceable()
      if (blocked !== undefined) return present({ ...blocked, op })
      return Promise.resolve()
        .then(() => ui(services, args || {}))
        .catch((err) => ({ status: 'error', reason: String(err?.message ?? err) }))
    }

    /**
     * The `value` an op's success reply should carry, or `undefined` for none.
     *
     * Two families answer through `applyOp`, and they are shaped differently:
     *
     *   - the APPEARANCE ops answer `{ status, value? }`, where `value` is the one
     *     fact worth reporting (the theme id just set, the snapshot just read) and
     *     a bare `{ status: 'ok' }` genuinely has nothing to carry;
     *   - the UI ops answer a whole envelope at the top level — `target`,
     *     `resolved`, `how`, `verified`, and a read's `settings`/`main`/… — with
     *     no `value` key at all.
     *
     * Forwarding `outcome.value` unconditionally sent `undefined` for every ui op,
     * which `present` then omitted, so `ui.list` arrived as a bare
     * `{ status: 'ok' }` and `ui.open` lost the `verified` flag that is the only
     * evidence it happened. Forwarding the whole outcome unconditionally would be
     * wrong the other way: `appearance.toggleSidebar` has no value and must not
     * grow a `value` key.
     *
     * The discriminator is the OP's namespace, not the shape of its answer: a ui
     * read (`ui.list`, `ui.state`) carries neither `target` nor `verified`, so
     * sniffing fields would send it back to the appearance branch and drop it.
     * `op` is the thing that actually decides which family ran.
     *
     * @param outcome - a successful op result.
     * @param op - the operation id that produced it.
     * @returns the appearance `value`, the ui envelope minus `status`, or
     *   `undefined` when there is nothing to report.
     */
    function replyValue(outcome, op) {
      if (typeof op === 'string' && op.startsWith('ui.')) return withoutStatus(outcome)
      return Object.hasOwn(outcome, 'value') ? outcome.value : undefined
    }

    /**
     * A ui op's envelope without its `status` key.
     *
     * The reply already carries success in `ok`, so keeping `status` inside
     * `value` would leave two places to read the same fact and a caller that
     * could see them disagree. Every other field rides through untouched, and a
     * key holding `undefined` is dropped for the reason `present` documents.
     */
    function withoutStatus(outcome) {
      const out = {}
      for (const [key, entry] of Object.entries(outcome)) {
        if (key !== 'status' && entry !== undefined) out[key] = entry
      }
      return out
    }

    /**
     * The panel's copy, in both shipped languages.
     *
     * Kept as a literal here rather than read from `locale/*.json` because this
     * is a browser bundle: `require` in this realm resolves what the shell hands
     * it, not the package's own files, so a JSON import would be a runtime miss
     * in the browser and a silent pass in every test whose `require` stub
     * answers anything. `locale/*.json` still ships — the marketplace and the
     * plugin detail page read it — and the suite asserts the two carry the same
     * key set, so they cannot drift apart unnoticed.
     */
    // i18n:zh:start
    const ZH = {
      'app.title': 'DSH 控制台',
      'app.subtitle': '用面板完成 Agent 能做到的同一批操作：模型、插件、MCP、外观。每个操作只有一份实现，面板和 dsh_console 工具调用的是同一段代码。',
      'app.refresh': '刷新',
      'app.retry': '重试',
      'app.close': '关闭',
      'app.loadFailed': '读取失败：{error}',
      'app.empty': '这里还没有内容',
      'app.emptyHint': '如果这不是你预期的结果，先确认 DSH 已经装好对应的服务。',
      'loading': '读取中…',
      'value.unknown': '未知',
      'value.default': '跟随默认',
      'status.ok': '已完成',
      'status.error': '失败',
      'status.unavailable': '当前不可用',
      'boundary.title': '面板没能渲染出来',
      'boundary.hint': '错误已经写进浏览器控制台（F12）。上面的「重试」会重新渲染；侧栏的其他入口不受影响。',
      'tab.overview': '总览',
      'tab.appearance': '外观',
      'tab.models': '模型',
      'tab.plugins': '插件',
      'tab.mcp': 'MCP',
      'tab.actions': '动作与边界',
      'overview.boundary': 'Agent 可以改变 DSH 长什么样、怎么配置，但永远不能改变自己握有多大的权限。沙箱模式、权限预设、审批应答、凭据写入这四类操作对所有调用方永久拒绝，原因与替代做法见「动作与边界」页。',
      'overview.sectionModel': '当前模型',
      'overview.sectionAppearance': '当前外观',
      'overview.sectionFleet': '本机概况',
      'overview.changeModel': '去切换模型',
      'overview.changeAppearance': '去调整外观',
      'overview.openPlugins': '打开插件',
      'overview.openMcp': '打开 MCP',
      'overview.openActions': '查看边界',
      'overview.bundles': '插件包',
      'overview.bundleCount': '{enabled} 启用 / 共 {total}',
      'overview.mcp': 'MCP 服务',
      'overview.actionCount': '可用动作',
      'overview.forbiddenCount': '永久拒绝',
      'appearance.theme': '主题',
      'appearance.themeHint': '「跟随系统」会随操作系统的浅色/深色设置切换。改的是这次登录的偏好，和界面里那处开关是同一个值。',
      'appearance.language': '语言',
      'appearance.languagePlaceholder': '例如 zh 或 en',
      'appearance.apply': '应用',
      'appearance.languageHint': '只能填已经注册过的语言标识，填错会收到明确的报错，而不是静默失败。',
      'appearance.scheme': '配色模式',
      'appearance.locale': '当前语言',
      'appearance.current': '当前 {value}',
      'appearance.layout': '布局',
      'appearance.sidebar': '折叠/展开侧栏',
      'appearance.rightbarOpen': '打开右栏',
      'appearance.rightbarClose': '关闭右栏',
      'appearance.layoutHint': '右栏需要由它自己的入口来填充内容；这里只控制它的显隐。',
      'theme.system': '跟随系统',
      'theme.light': '浅色',
      'theme.dark': '深色',
      'model.provider': '服务商',
      'model.model': '模型',
      'model.effort': '推理强度',
      'model.noProviders': '没有已注册的服务商',
      'model.modelPlaceholder': '模型 id，例如 deepseek-chat',
      'model.select': '设为默认',
      'model.hint': '改的是新建会话时用的默认选择，不会改变当前这个会话正在用的模型。',
      'model.sectionCurrent': '当前默认',
      'model.noProvidersHint': '当前 profile 没有注册任何 LLM 服务商，所以这里没有可选项。',
      'model.providerCount': '已注册 {n} 个服务商。',
      'plugin.hint': '插件包和插件行是两层：包可以整体启用或停用，包里面的一行也能单独停用。两者的标识符不同，下面的按钮按各自那一层提交。',
      'plugin.sectionBundles': '插件包',
      'plugin.sectionEntries': '已加载的插件行',
      'plugin.enabled': '已启用',
      'plugin.disabled': '已停用',
      'plugin.enable': '启用',
      'plugin.disable': '停用',
      'plugin.setEnabled': '启停插件',
      'plugin.installed': '已安装',
      'plugin.notInstalled': '未安装',
      'plugin.protected': '受保护',
      'plugin.diagnostic': '有诊断信息',
      'mcp.hint': '「探测」只做一次连接与列工具，不改动运行状态；「重启」会断开并按配置重新拉起这个服务。',
      'mcp.state.connected': '已连接',
      'mcp.state.connecting': '连接中',
      'mcp.state.reconnecting': '重连中',
      'mcp.state.waiting-credentials': '等待凭据',
      'mcp.state.closed': '已关闭',
      'mcp.state.disabled': '已停用',
      'mcp.state.failed': '失败',
      'mcp.state.unknown': '状态未知',
      'mcp.toolCount': '{n} 个工具',
      'mcp.unconfigured': '配置项已移除',
      'mcp.probe': '探测',
      'mcp.restart': '重启',
      'actions.hint': '这张表来自 console.actions —— 面板自己不带第二份动作清单。下面每个动作都走和 Agent 工具完全相同的那一次调用。',
      'actions.sectionForbidden': '永久拒绝的动作',
      'actions.forbiddenHint': '这些不是「暂时不可用」，而是对所有调用方永久关闭：Agent 想改自己的权限边界，就会被拒绝在这里。理由和该由谁来做，都是 console 自己给出的原文。',
      'actions.alternative': '该由用户来做：',
      'actions.refused': '永久拒绝',
      'actions.run': '执行',
      'actions.toolOnly': '请 Agent 执行',
      'actions.mutating': '会改动',
      'actions.readOnly': '只读',
      'actions.destructive': '不可逆',
      'actions.requiresClient': '需要界面',
      'toast.done': '已完成：{action}',
      'toast.failed': '失败：{action} —— {reason}',
      'toast.unavailable': '暂不可用：{action} —— {reason}',
    }
    // i18n:zh:end
    // i18n:en:start
    const EN = {
      'app.title': 'DSH console',
      'app.subtitle': 'Do from a panel what the Agent can do: models, plugins, MCP, appearance. Each operation has one implementation — the panel and the dsh_console tool call the same code.',
      'app.refresh': 'Refresh',
      'app.retry': 'Retry',
      'app.close': 'Close',
      'app.loadFailed': 'Could not read: {error}',
      'app.empty': 'Nothing here yet',
      'app.emptyHint': 'If that is not what you expected, check that the matching service is installed in this profile.',
      'loading': 'Loading…',
      'value.unknown': 'Unknown',
      'value.default': 'Provider default',
      'status.ok': 'Done',
      'status.error': 'Failed',
      'status.unavailable': 'Not available now',
      'boundary.title': 'The panel could not render',
      'boundary.hint': 'The error is in the browser console (F12). Retry above re-renders it; every other sidebar entry still works.',
      'tab.overview': 'Overview',
      'tab.appearance': 'Appearance',
      'tab.models': 'Models',
      'tab.plugins': 'Plugins',
      'tab.mcp': 'MCP',
      'tab.actions': 'Actions & boundary',
      'overview.boundary': 'An Agent may change how DSH looks and is configured, never how much authority it holds. Sandbox mode, permission presets, approval answers and credential writes are refused for every caller; the reasons and the user-facing alternative are on the Actions & boundary tab.',
      'overview.sectionModel': 'Current model',
      'overview.sectionAppearance': 'Current appearance',
      'overview.sectionFleet': 'This installation',
      'overview.changeModel': 'Change the model',
      'overview.changeAppearance': 'Change appearance',
      'overview.openPlugins': 'Open plugins',
      'overview.openMcp': 'Open MCP',
      'overview.openActions': 'See the boundary',
      'overview.bundles': 'Bundles',
      'overview.bundleCount': '{enabled} enabled of {total}',
      'overview.mcp': 'MCP servers',
      'overview.actionCount': 'Available actions',
      'overview.forbiddenCount': 'Permanently refused',
      'appearance.theme': 'Theme',
      'appearance.themeHint': 'Follow system tracks the operating system light/dark setting. This is the same preference the Appearance settings row writes.',
      'appearance.language': 'Language',
      'appearance.languagePlaceholder': 'e.g. zh or en',
      'appearance.apply': 'Apply',
      'appearance.languageHint': 'Only registered language ids are accepted; a wrong one comes back with a precise error rather than failing silently.',
      'appearance.scheme': 'Colour scheme',
      'appearance.locale': 'Active language',
      'appearance.current': 'Now {value}',
      'appearance.layout': 'Layout',
      'appearance.sidebar': 'Toggle the sidebar',
      'appearance.rightbarOpen': 'Open the right panel',
      'appearance.rightbarClose': 'Close the right panel',
      'appearance.layoutHint': 'The right panel needs its own surface to fill it; this only controls whether it is shown.',
      'theme.system': 'Follow system',
      'theme.light': 'Light',
      'theme.dark': 'Dark',
      'model.provider': 'Provider',
      'model.model': 'Model',
      'model.effort': 'Reasoning effort',
      'model.noProviders': 'No provider registered',
      'model.modelPlaceholder': 'model id, e.g. deepseek-chat',
      'model.select': 'Set as default',
      'model.hint': 'This changes the default a new session starts with. The model answering this session is unaffected.',
      'model.sectionCurrent': 'Current default',
      'model.noProvidersHint': 'This profile registers no LLM provider, so there is nothing to pick here.',
      'model.providerCount': '{n} providers registered.',
      'plugin.hint': 'Bundles and plugin rows are two layers: a bundle can be switched off as a whole, and a row inside an enabled bundle can be switched off on its own. They are identified differently, and each button below submits to its own layer.',
      'plugin.sectionBundles': 'Bundles',
      'plugin.sectionEntries': 'Loaded plugin rows',
      'plugin.enabled': 'Enabled',
      'plugin.disabled': 'Disabled',
      'plugin.enable': 'Enable',
      'plugin.disable': 'Disable',
      'plugin.setEnabled': 'Toggle a plugin',
      'plugin.installed': 'installed',
      'plugin.notInstalled': 'not installed',
      'plugin.protected': 'protected',
      'plugin.diagnostic': 'Has a diagnostic',
      'mcp.hint': 'Probe connects once and lists tools without changing anything; Restart disconnects the server and brings it back up from its configuration.',
      'mcp.state.connected': 'Connected',
      'mcp.state.connecting': 'Connecting',
      'mcp.state.reconnecting': 'Reconnecting',
      'mcp.state.waiting-credentials': 'Waiting for credentials',
      'mcp.state.closed': 'Closed',
      'mcp.state.disabled': 'Disabled',
      'mcp.state.failed': 'Failed',
      'mcp.state.unknown': 'State unknown',
      'mcp.toolCount': '{n} tools',
      'mcp.unconfigured': 'entry removed',
      'mcp.probe': 'Probe',
      'mcp.restart': 'Restart',
      'actions.hint': 'This table comes from console.actions — the panel carries no second catalogue of its own. Every action below runs through exactly the call the Agent tool makes.',
      'actions.sectionForbidden': 'Permanently refused actions',
      'actions.forbiddenHint': 'These are not "temporarily unavailable" — they are closed to every caller, which is how an Agent is stopped from widening its own authority. Both the reason and who should do it instead are the console\'s own words.',
      'actions.alternative': 'The user does this:',
      'actions.refused': 'Refused',
      'actions.run': 'Run',
      'actions.toolOnly': 'Ask the Agent',
      'actions.mutating': 'mutates',
      'actions.readOnly': 'read-only',
      'actions.destructive': 'irreversible',
      'actions.requiresClient': 'needs the interface',
      'toast.done': 'Done: {action}',
      'toast.failed': 'Failed: {action} — {reason}',
      'toast.unavailable': 'Not available: {action} — {reason}',
    }
    // i18n:en:end

    /**
     * The translator and the locale service the panel reads.
     *
     * Declared BEFORE `loadPanel`, which closes over both: `loadPanel` is only
     * called from `registerPanel` after `apply` has assigned them, but the
     * arrows inside it read the live bindings, and a `let` declared below its
     * reader is exactly the temporal-dead-zone trap `index.js` documents for
     * `DEFAULT_CLIENT_TIMEOUT_MS`.
     */
    let t = (key) => key
    let localeApi = null
    /**
     * The accessor the panel was built with: `() => ({ theme, layout, locale })`,
     * reading the context on every call.
     *
     * Held here so `__internal` can expose it. The property that matters — that
     * it reads the context AT CALL TIME rather than capturing a bag — cannot be
     * observed any other way, because reaching a panel's click handler needs a
     * renderer this suite deliberately does not have.
     */
    let panelServices = () => ({})

    /**
     * Ask the Host to run one console action — the same call the Agent tool makes.
     *
     * The panel deliberately owns no operation of its own: this posts the action
     * name to the one endpoint the Host registers, the Host dispatches it
     * through `core.js`, and the reply is the same envelope the model receives.
     * A panel that re-implemented even one operation would be a second
     * implementation free to drift from the reviewed one.
     */
    async function call(action, args) {
      const response = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // `{ action, args }` is the console's own request shape — the Host
        // reads exactly these two keys, and `console.actions` is reachable the
        // same way the model reaches it.
        body: JSON.stringify({ action, args: args || {} }),
        cache: 'no-store',
        signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
      })
      // The endpoint can answer with plain text when the Host half is missing or
      // mid-start, so the body is parsed defensively: a JSON syntax error here
      // would be reported as the panel's failure rather than as the Host's.
      const raw = await response.text()
      let data
      try { data = raw === '' ? undefined : JSON.parse(raw) } catch { data = undefined }
      if (!data) throw new Error(`HTTP ${response.status} ${response.statusText}${raw ? `: ${raw.replace(/\s+/gu, ' ').slice(0, 160)}` : ''}`)
      return data
    }

    // -----------------------------------------------------------------------
    // The management panel.
    //
    // It lives in THIS file rather than in a sibling module because a browser
    // bundle cannot `require` a package-local file: the client module system
    // resolves platform seeds, already-materialized modules and registered
    // factories, and nothing else. Every other client bundle in this repository
    // is single-file for the same reason.
    //
    // One operation, two callers still holds: this panel re-implements nothing.
    // Appearance controls call the same `applyOp` the bridge dispatches into,
    // and every Host action POSTs to the same endpoint the tool uses.
    // -----------------------------------------------------------------------

    function createPanel({ React, h, applyOp, services, call, t, localeApi }) {
      const { useState, useEffect, useMemo, useCallback, useRef } = React

      /**
       * The bound translator, read at CALL time.
       *
       * The bundle binds `t` to its locale namespace inside `registerPanel`, and the
       * locale service can be replaced under a live page. Capturing the function here
       * would freeze every label on whatever `t` was at construction, so a language
       * switch would never reach the panel. Reading the closure binding on each call
       * is the same discipline the appearance accessor follows.
       */
      const translate = (key, params) => t(key, params)

      // --- tokens only -----------------------------------------------------------
      //
      // `--dsw-alias-*` and `--dsw-specific-*` are the theme's own token names, and
      // a theme swaps their values. A literal colour here would survive that swap
      // and go illegible in the other colour scheme, which is why the test suite
      // walks every `var(--…)` in this file and refuses anything else.
      const CSS = `
    .vc{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;overflow:hidden}
    .vc *{box-sizing:border-box}
    .vc-scroll{flex:1;min-height:0;overflow:auto;padding:28px 32px 40px}
    .vc-wrap{max-width:1000px;margin:0 auto}
    .vc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
    .vc-title{margin:0;font-size:22px;font-weight:650;letter-spacing:-.01em}
    .vc-sub{margin:6px 0 0;color:var(--dsw-alias-label-secondary);line-height:1.5;max-width:600px}
    .vc-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .vc-tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-l1)}
    .vc-tab{height:34px;padding:0 13px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-weight:500;cursor:pointer;transition:color .15s,border-color .15s}
    .vc-tab:hover{color:var(--dsw-alias-label-primary)}
    .vc-tab.on{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
    .vc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 13px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-weight:500;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s;white-space:nowrap}
    .vc-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
    .vc-btn:disabled{opacity:.5;cursor:not-allowed}
    .vc-btn.primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
    .vc-btn.primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 88%,var(--dsw-alias-label-primary))}
    .vc-btn.sm{height:27px;padding:0 10px;font-size:12px;border-radius:7px}
    .vc-btn.danger{color:var(--dsw-alias-state-error-primary)}
    .vc-section{margin:24px 0 10px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.04em;text-transform:uppercase;display:flex;align-items:center;gap:8px}
    .vc-section::after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1)}
    .vc-card{padding:16px 18px;border-radius:14px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);margin-bottom:12px}
    .vc-card.dim{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 60%,var(--dsw-alias-bg-base))}
    .vc-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;align-items:baseline}
    .vc-kv dt{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
    .vc-kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
    .vc-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}
    .vc-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
    .vc-row:last-child{border-bottom:0}
    .vc-list{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
    .vc-row .vc-grow{flex:1;min-width:0}
    .vc-row .vc-name{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .vc-row .vc-id{display:block;color:var(--dsw-alias-label-secondary);font-size:11.5px;overflow-wrap:anywhere}
    .vc-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
    .vc-chip.ok{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 28%,transparent)}
    .vc-chip.warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 11%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 30%,transparent)}
    .vc-chip.error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent)}
    .vc-banner{display:flex;gap:10px;align-items:flex-start;padding:11px 14px;border-radius:10px;margin-bottom:16px;line-height:1.5;border:1px solid}
    .vc-banner.error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 28%,transparent)}
    .vc-banner.warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 9%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 28%,transparent)}
    .vc-banner.info{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}
    .vc-banner .vc-grow{flex:1}
    .vc-empty{padding:44px 20px;text-align:center;color:var(--dsw-alias-label-secondary);border:1px dashed var(--dsw-alias-border-l2);border-radius:14px}
    .vc-empty b{display:block;color:var(--dsw-alias-label-primary);font-size:14px;margin-bottom:6px}
    .vc-field{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
    .vc-label{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;min-width:74px}
    .vc-input,.vc-select{height:34px;padding:0 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
    .vc-input:focus,.vc-select:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
    .vc-input.narrow{width:76px}
    .vc-reason{margin:8px 0 0;color:var(--dsw-alias-label-secondary);line-height:1.6}
    .vc-alt{margin:6px 0 0;color:var(--dsw-alias-label-primary);line-height:1.6}
    .vc-alt b{color:var(--dsw-alias-state-warn-primary)}
    .vc-toast{position:absolute;left:50%;bottom:22px;z-index:40;transform:translateX(-50%);display:flex;gap:8px;align-items:center;max-width:min(620px,calc(100% - 32px));padding:10px 16px;border-radius:11px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 10px 30px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent)}
    .vc-toast i{width:8px;height:8px;border-radius:50%;flex:none}
    .vc-spin{width:14px;height:14px;border-radius:50%;border:2px solid color-mix(in srgb,currentColor 30%,transparent);border-top-color:currentColor;animation:vc-r .7s linear infinite}
    @keyframes vc-r{to{transform:rotate(360deg)}}
    .vc-skel{height:58px;border-radius:12px;background:linear-gradient(100deg,var(--dsw-alias-bg-layer-1) 30%,var(--dsw-alias-bg-layer-2) 50%,var(--dsw-alias-bg-layer-1) 70%);background-size:200% 100%;animation:vc-sh 1.2s linear infinite;margin-bottom:10px}
    @keyframes vc-sh{to{background-position:-200% 0}}
    @media (max-width:640px){.vc-scroll{padding:20px 16px 32px}.vc-kv{grid-template-columns:1fr}}
    `

      const Icon = (path, size = 16) => h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
        strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, ...[].concat(path).map((d, i) => h('path', { key: i, d })))
      const I = {
        refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
        warn: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
        lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
      }

      /** The sidebar glyph. A monitor with a dial: distinct from any other entry's. */
      function PanelIcon(props) {
        return h('svg', {
          viewBox: '0 0 24 24', width: props?.size || 20, height: props?.size || 20, fill: 'none',
          stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
          style: { display: 'block' }, 'aria-hidden': true,
        },
          h('rect', { x: 2.5, y: 3.5, width: 19, height: 14, rx: 3 }),
          h('path', { d: 'M2.5 8h19' }),
          h('circle', { cx: 5.5, cy: 5.75, r: 0.6, fill: 'currentColor', stroke: 'none' }),
          h('path', { d: 'M6 12.5h5M6 15h5' }),
          h('circle', { cx: 15.5, cy: 13.75, r: 2.9 }),
          h('path', { d: 'M15.5 9.1v1M15.5 17.4v1M11.35 13.75h1M18.65 13.75h1' }),
          h('path', { d: 'M9 21h6' }),
        )
      }

      // --- pure derivations. These are what the tests drive: no DOM, no React. ---

      /**
       * What the theme select shows before anything has told it better.
       *
       * It is deliberately NOT the value the panel assumes is active: it is the
       * option a user would land on with no preference stored, and it is shown only
       * while `appearance.state` is still in flight. A `select` needs SOME value,
       * and an unset one would render the control blank rather than usefully
       * incomplete.
       */
      const DEFAULT_THEME = 'system'

      /**
       * Every appearance control the panel can offer, as data.
       *
       * `op` and `args` are exactly what `applyOp` takes, so a control cannot drift
       * from the operation it names — the row IS the operation. `value` reads the
       * row's current setting out of the state snapshot `appearance.state` returned.
       */
      const APPEARANCE = [
        {
          id: 'theme',
          kind: 'select',
          op: 'appearance.setTheme',
          options: ['system', 'light', 'dark'],
          value: (state) => state?.theme?.preference ?? null,
          args: (v) => ({ id: v }),
        },    {
          id: 'locale',
          kind: 'locale',
          op: 'appearance.setLocale',
          value: (state) => state?.locale ?? null,
          args: (v) => ({ id: v }),
        },
        { id: 'sidebar', kind: 'button', op: 'appearance.toggleSidebar', args: () => ({}) },
        { id: 'rightbar', kind: 'button', op: 'appearance.openRightbar', args: () => ({ track: true, fullscreen: false }) },
        { id: 'rightbarClose', kind: 'button', op: 'appearance.closeRightbar', args: () => ({}) },
      ]

      /**
       * The action rows a render shows, derived from `console.actions`.
       *
       * The console is the single source of truth for what exists and what each
       * action does; this only groups and orders them. An action the console does
       * not list simply does not appear, and one it grows appears without a change
       * here — which is the point of asking rather than restating.
       *
       * @param reply - the `console.actions` payload, or anything at all.
       * @returns `{ actions, forbidden }`. Both are always arrays: a panel that
       *   threw on a malformed reply would blank its whole slot entry, and the
       *   reply is a Host answer this half cannot vouch for.
       */
      function deriveActions(reply) {
        const actions = Array.isArray(reply?.actions) ? reply.actions : []
        const forbidden = Array.isArray(reply?.forbidden) ? reply.forbidden : []
        const clean = (row) => (row === null || typeof row !== 'object' ? null : row)
        return {
          actions: actions.map(clean).filter((row) => row && typeof row.name === 'string'),
          forbidden: forbidden.map(clean).filter((row) => row && typeof row.name === 'string'),
        }
      }

      /** Group the action rows by the domain the console itself labelled them with. */
      function groupByDomain(actions) {
        const groups = new Map()
        for (const row of actions) {
          const domain = typeof row.domain === 'string' && row.domain !== '' ? row.domain : 'other'
          if (!groups.has(domain)) groups.set(domain, [])
          groups.get(domain).push(row)
        }
        return [...groups.entries()].map(([domain, rows]) => ({ domain, rows }))
      }

      /**
       * What went wrong, in words a person can act on.
       *
       * A status the panel does not recognise is reported as itself rather than
       * folded into "ok": a console that answers something new must not read as a
       * success.
       */
      function describeStatus(status) {
        switch (status) {
          case 'ok': return { kind: 'ok', key: 'status.ok' }
          case 'unavailable': return { kind: 'warn', key: 'status.unavailable' }
          default: return { kind: 'error', key: 'status.error' }
        }
      }

      /**
       * One action row's arguments, built from the panel's own controls, or `null`
       * when this panel cannot drive the action at all.
       *
       * Only the actions this panel actually drives are given a form; everything
       * else is read-only in the panel and named as such, because a generic
       * "arguments" text box would be a second, unvalidated way to invoke an
       * operation whose real validation lives in the domain handler.
       *
       * `null` is the single answer to "can the panel run this?", and the Actions
       * tab renders those rows as a chip rather than a Run button. That matters
       * because a Run button which can only fail is a false affordance: pressing it
       * on `plugin.remove` returns `confirm-required` (this panel never sends
       * `confirm: true`), and `mcp.probe` returns "needs a non-empty server name"
       * until a name has been typed. Both fail honestly, but the control promised
       * something the panel cannot deliver. Anything the panel CAN run must be
       * shaped here, so the two never drift apart.
       */
      function argsFor(row, draft) {
        switch (row.name) {
          case 'model.select': {
            const provider = draft.provider ?? ''
            const model = draft.model ?? ''
            return { provider, model }
          }
          case 'settings.get':
          case 'settings.set':
            return null // read-only in the panel: a namespace picker is the tool's job
          case 'plugin.setEnabled':
            // Either identifier, and the domain refuses a call that sends both. The
            // panel has controls for the bundle case only.
            return draft.name ? { name: draft.name, enabled: draft.enabled === true } : null
          case 'plugin.install':
            return draft.spec ? { spec: draft.spec } : null
          case 'plugin.remove':
            // Destructive, and the confirmation gate is the tool's to open: this
            // panel has no way to send `confirm: true`, so it must not offer a Run
            // button that can only ever come back `confirm-required`.
            return null
          case 'console.actions':
            // Runnable with no arguments, but this tab IS its output: the row is the
            // catalogue the user is already reading, so a button would re-fetch what
            // is on screen. Marked tool-only for that reason, not for incapability.
            return null
          case 'mcp.restart':
          case 'mcp.probe':
            return draft.name ? { name: draft.name } : null
          default:
            return {}
        }
      }

      /**
       * Whether the Actions tab can offer a Run button for this row.
       *
       * Read off `argsFor` rather than restated, so a row cannot advertise a control
       * whose arguments the panel does not actually build.
       */
      const canRun = (row, draft = {}) => argsFor(row, draft) !== null

      /**
       * What the Actions tab renders at the end of one row: `'run'` for a button,
       * `'chip'` for a non-interactive marker.
       *
       * A separate function from `canRun` on purpose, so the RENDER decision is a
       * named thing a test can call. Asserting only that `canRun` returns false
       * would leave the row free to ignore it and draw a button anyway.
       */
      const rowAffordance = (row) => (canRun(row) ? 'run' : 'chip')

      /**
       * The element one Actions row ends with: a Run button, or a tool-only chip.
       *
       * Extracted out of the row's JSX-equivalent so the RENDER decision is a named
       * function a test can call and inspect, rather than something only assertable
       * by pattern-matching this file's source text. `rowAffordance` decides; this
       * function is the only thing that builds the control, so the two cannot drift
       * apart without the element actually changing.
       */
      function rowControl({ row, t, busy, run }) {
        if (rowAffordance(row) !== 'run') return h(Chip, null, translate('actions.toolOnly'))
        return h('button', {
          className: 'vc-btn sm',
          disabled: busy !== null,
          onClick: () => run(row.name, argsFor(row, {}), row.name),
        }, translate('actions.run'))
      }

      // --- the panel -------------------------------------------------------------

      /**
       * Keep one bad render from taking the slot down.
       *
       * A `main` panel whose component throws blanks the main column with no
       * explanation, and the sidebar entry stays selectable — so the user sees an
       * empty page and no reason for it. The boundary shows the error and a retry
       * instead, and the sidebar keeps working.
       */
      class Boundary extends React.Component {
        constructor(props) { super(props); this.state = { error: null } }
        static getDerivedStateFromError(error) { return { error } }
        componentDidCatch(error, info) {
          try { console.error('[dsh-vyra-dsh-console] panel render failed', error, info) } catch { /* no console */ }
        }
        render() {
          if (this.state.error === null) return this.props.children
          return h('div', { className: 'vc' }, h('style', null, CSS),
            h('div', { className: 'vc-scroll' }, h('div', { className: 'vc-wrap' },
              h('div', { className: 'vc-banner error' }, Icon(I.warn, 16),
                h('div', { className: 'vc-grow' },
                  h('b', null, translate('boundary.title')),
                  h('p', { className: 'vc-reason' }, String(this.state.error?.message || this.state.error)),
                  h('p', { className: 'vc-reason' }, translate('boundary.hint')))),
              h('button', { className: 'vc-btn primary', onClick: () => this.setState({ error: null }) }, translate('app.retry')))))
        }
      }

      function Chip({ kind, children }) {
        return h('span', { className: 'vc-chip' + (kind ? ' ' + kind : '') }, children)
      }

      /** The state of one request: idle, busy, or the last answer. */
      function useCall() {
        const [busy, setBusy] = useState(null)
        const [toast, setToast] = useState(null)
        const timer = useRef(null)
        useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
        const notify = useCallback((text, kind) => {
          setToast({ text, kind })
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => setToast(null), 5000)
        }, [])
        return { busy, setBusy, toast, notify }
      }

      function Console({ onClose }) {
        const [tab, setTab] = useState('overview')
        const [version, setVersion] = useState(0)
        const reload = useCallback(() => setVersion((n) => n + 1), [])

        // Dictionaries can arrive after the first render (registration is an
        // effect), so the panel re-reads `t` when the locale service publishes.
        const [, bumpLocale] = useState(0)
        useEffect(() => {
          if (!localeApi || typeof localeApi.subscribe !== 'function') return undefined
          return localeApi.subscribe(() => bumpLocale((n) => n + 1))
        }, [])

        const [catalogue, setCatalogue] = useState(null)
        const [catalogueError, setCatalogueError] = useState('')
        const [state, setState] = useState(null)
        const [stateError, setStateError] = useState('')
        const [plugins, setPlugins] = useState(null)
        const [pluginError, setPluginError] = useState('')
        const [models, setModels] = useState(null)
        const [modelError, setModelError] = useState('')
        const [mcps, setMcps] = useState(null)
        const [mcpError, setMcpError] = useState('')
        // The draft holds only what a control has NOT yet read back from the live
        // services. It starts empty on purpose: a seeded `theme: 'system'` would be
        // shown as the current theme before `appearance.state` returned, whichever
        // theme was actually in force — a value the panel had no basis for.
        const [draft, setDraft] = useState({ provider: '', model: '', name: '', theme: '', locale: '' })
        const { busy, setBusy, toast, notify } = useCall()

        // Every read goes through the Host, which forwards it to this half — so the
        // panel and the agent tool read the same sources. `call` is the one
        // transport, and it is injected rather than imported.
        const loadCatalogue = useCallback(async () => {
          try {
            const reply = await call('console.actions', {})
            if (reply.status !== 'ok') { setCatalogueError(String(reply.reason || reply.status)); return }
            setCatalogue(deriveActions(reply))
            setCatalogueError('')
          } catch (err) { setCatalogueError(String(err?.message || err)) }
        }, [])

        const loadState = useCallback(async () => {
          try {
            const reply = await call('appearance.state', {})
            if (reply.status !== 'ok') { setStateError(String(reply.reason || reply.status)); setState(null); return }
            setState(reply.value ?? null)
            setStateError('')
          } catch (err) { setStateError(String(err?.message || err)) }
        }, [])

        const loadPlugins = useCallback(async () => {
          try {
            const reply = await call('plugin.list', {})
            if (reply.status !== 'ok') { setPluginError(String(reply.reason || reply.status)); return }
            setPlugins({ plugins: reply.plugins || [], bundles: reply.bundles || [] })
            setPluginError('')
          } catch (err) { setPluginError(String(err?.message || err)) }
        }, [])

        const loadModels = useCallback(async () => {
          try {
            const reply = await call('model.list', {})
            if (reply.status !== 'ok') { setModelError(String(reply.reason || reply.status)); return }
            setModels({ current: reply.current || {}, providers: reply.providers || [] })
            setDraft((d) => ({ ...d, provider: reply.current?.provider ?? d.provider, model: reply.current?.model ?? d.model }))
            setModelError('')
          } catch (err) { setModelError(String(err?.message || err)) }
        }, [])

        const loadMcps = useCallback(async () => {
          try {
            const reply = await call('mcp.list', {})
            if (reply.status !== 'ok') { setMcpError(String(reply.reason || reply.status)); return }
            setMcps(reply.servers || [])
            setMcpError('')
          } catch (err) { setMcpError(String(err?.message || err)) }
        }, [])

        // One effect per tab, so opening a tab issues only that tab's read.
        useEffect(() => {
          if (tab === 'overview' || tab === 'actions') void loadCatalogue()
          if (tab === 'overview' || tab === 'appearance') void loadState()
          if (tab === 'plugins') void loadPlugins()
          if (tab === 'models') void loadModels()
          if (tab === 'mcp') void loadMcps()
          // `version` is the manual refresh token.
        }, [tab, version, loadCatalogue, loadState, loadPlugins, loadModels, loadMcps])

        /** Run one console action through the Host, the same path the tool uses. */
        const run = useCallback(async (name, args, label) => {
          setBusy(name)
          try {
            const reply = await call(name, args || {})
            const shape = describeStatus(reply?.status)
            if (shape.kind === 'ok') notify(translate('toast.done', { action: name }), 'ok')
            else if (shape.kind === 'warn') notify(translate('toast.unavailable', { action: name, reason: String(reply?.reason || '') }), 'warn')
            else notify(translate('toast.failed', { action: name, reason: String(reply?.reason || reply?.status || '') }), 'error')
            reload()
            return reply
          } catch (err) {
            notify(translate('toast.failed', { action: name, reason: String(err?.message || err) }), 'error')
            return null
          } finally { setBusy(null) }
        }, [notify, reload])

        /**
         * Run an appearance op through `applyOp` — the SAME function the Host
         * bridge dispatches into.
         *
         * Not a POST: the appearance services are in this realm, and routing the
         * click back out to the Host so it could ask this half would be a round trip
         * through the very code the click is already standing in. Same function,
         * same services, same contract — which is what "one operation, two callers"
         * requires, and the reason the panel can never disagree with the tool.
         *
         * The services come from the injected ACCESSOR, called here on every
         * request, exactly as the bridge reads `ctx.theme` at dispatch time. An
         * object captured when the panel was built would keep writing into a service
         * that a reload has since replaced.
         */
        const runAppearance = useCallback(async (op, args, label) => {
          setBusy(op)
          // A panel built without the accessor — a test double, or a future caller
          // that forgot it — must report a refusal rather than throw out of a click
          // handler. `applyOp` already answers that way for a missing service, so
          // an empty bag is the honest input rather than a special case here.
          const bag = typeof services === 'function' ? services() : {}
          const outcome = await applyOp(bag, op, args || {})
          if (outcome.status === 'ok') notify(translate('toast.done', { action: label || op }), 'ok')
          else notify(translate('toast.failed', { action: label || op, reason: String(outcome.reason || '') }), 'error')
          setBusy(null)
          void loadState()
        }, [services, notify, loadState])

        const catalogueView = catalogue || { actions: [], forbidden: [] }
        const grouped = useMemo(() => groupByDomain(catalogueView.actions), [catalogueView.actions])

        const header = h('div', { className: 'vc-head' },
          h('div', null,
            h('h1', { className: 'vc-title' }, translate('app.title')),
            h('p', { className: 'vc-sub' }, translate('app.subtitle'))),
          h('div', { className: 'vc-head-actions' },
            h('button', { className: 'vc-btn', onClick: reload, disabled: busy !== null }, Icon(I.refresh, 15), translate('app.refresh')),
            onClose ? h('button', { className: 'vc-btn', onClick: onClose }, translate('app.close')) : null))

        const tabs = [
          ['overview', translate('tab.overview')],
          ['appearance', translate('tab.appearance')],
          ['models', translate('tab.models')],
          ['plugins', translate('tab.plugins')],
          ['mcp', translate('tab.mcp')],
          ['actions', translate('tab.actions')],
        ]
        const tabBar = h('div', { className: 'vc-tabs', role: 'tablist' },
          tabs.map(([key, label]) => h('button', {
            key, role: 'tab', 'aria-selected': tab === key, className: 'vc-tab' + (tab === key ? ' on' : ''),
            onClick: () => setTab(key),
          }, label)))

        return h('div', { className: 'vc' },
          h('style', null, CSS),
          h('div', { className: 'vc-scroll' }, h('div', { className: 'vc-wrap' },
            header,
            tabBar,
            tab === 'overview' ? h(Overview, {
              t, state, stateError, models, modelError, plugins, pluginError, mcps, mcpError,
              catalogue: catalogueView, catalogueError, onTab: setTab,
            }) : null,
            tab === 'appearance' ? h(Appearance, { t, state, stateError, busy, runAppearance, draft, setDraft }) : null,
            tab === 'models' ? h(Models, { t, models, modelError, busy, run, draft, setDraft }) : null,
            tab === 'plugins' ? h(Plugins, { t, plugins, pluginError, busy, run }) : null,
            tab === 'mcp' ? h(Mcp, { t, mcps, mcpError, busy, run, draft, setDraft }) : null,
            tab === 'actions' ? h(Actions, { t, grouped, catalogue: catalogueView, catalogueError, busy, run, argsFor, canRun }) : null)),
          toast ? h('div', { className: 'vc-toast', role: 'status' },
            h('i', { style: { background: toast.kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : toast.kind === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-state-success-primary)' } }),
            toast.text) : null)
      }

      /** Shared read-state rendering: a banner on failure, a skeleton while loading. */
      function ReadState({ t, error, loading, empty, children }) {
        if (error) return h('div', { className: 'vc-banner error' }, Icon(I.warn, 16), h('div', { className: 'vc-grow' }, translate('app.loadFailed', { error })))
        if (loading) return h('div', null, [0, 1, 2].map((i) => h('div', { key: i, className: 'vc-skel' })))
        if (empty) return h('div', { className: 'vc-empty' }, h('b', null, translate('app.empty')), h('span', null, translate('app.emptyHint')))
        return children
      }

      function Overview({ t, state, stateError, models, modelError, plugins, pluginError, mcps, mcpError, catalogue, catalogueError, onTab }) {
        const bundles = plugins ? plugins.bundles.length : 0
        const enabled = plugins ? plugins.bundles.filter((b) => b.enabled).length : 0
        return h('div', null,
          // The boundary, stated first. This is the plugin's point as much as its
          // actions are, and a user reading the panel should meet it before the
          // controls rather than discover it from a refusal.
          h('div', { className: 'vc-banner info' }, Icon(I.lock, 16),
            h('div', { className: 'vc-grow' }, translate('overview.boundary'))),

          h('div', { className: 'vc-section' }, translate('overview.sectionModel')),
          h('div', { className: 'vc-card' },
            modelError
              ? h('div', { className: 'vc-banner error' }, Icon(I.warn, 16), h('div', { className: 'vc-grow' }, modelError))
              : h('dl', { className: 'vc-kv' },
                h('dt', null, translate('model.provider')), h('dd', { className: 'vc-mono' }, models?.current?.provider || translate('value.unknown')),
                h('dt', null, translate('model.model')), h('dd', { className: 'vc-mono' }, models?.current?.model || translate('value.unknown')),
                h('dt', null, translate('model.effort')), h('dd', { className: 'vc-mono' }, models?.current?.reasoningEffort || translate('value.default'))),
            h('div', { className: 'vc-field' }, h('button', { className: 'vc-btn sm', onClick: () => onTab('models') }, translate('overview.changeModel')))),

          h('div', { className: 'vc-section' }, translate('overview.sectionAppearance')),
          h('div', { className: 'vc-card' },
            stateError
              ? h('div', { className: 'vc-banner warn' }, Icon(I.warn, 16), h('div', { className: 'vc-grow' }, stateError))
              : h('dl', { className: 'vc-kv' },
                h('dt', null, translate('appearance.theme')), h('dd', null, state?.theme ? state.theme.id : translate('value.unknown')),
                h('dt', null, translate('appearance.scheme')), h('dd', null, state?.theme?.colorScheme || translate('value.unknown')),
                h('dt', null, translate('appearance.locale')), h('dd', { className: 'vc-mono' }, state?.locale || translate('value.unknown'))),
            h('div', { className: 'vc-field' }, h('button', { className: 'vc-btn sm', onClick: () => onTab('appearance') }, translate('overview.changeAppearance')))),

          h('div', { className: 'vc-section' }, translate('overview.sectionFleet')),
          h('div', { className: 'vc-card' },
            h('dl', { className: 'vc-kv' },
              h('dt', null, translate('overview.bundles')),
              h('dd', null, plugins ? translate('overview.bundleCount', { enabled, total: bundles }) : (pluginError || translate('loading'))),
              h('dt', null, translate('overview.mcp')),
              h('dd', null, mcps ? String(mcps.length) : (mcpError || translate('loading'))),
              h('dt', null, translate('overview.actionCount')),
              h('dd', null, catalogueError || String(catalogue.actions.length)),
              h('dt', null, translate('overview.forbiddenCount')),
              h('dd', null, catalogueError || String(catalogue.forbidden.length))),
            h('div', { className: 'vc-field' },
              h('button', { className: 'vc-btn sm', onClick: () => onTab('plugins') }, translate('overview.openPlugins')),
              h('button', { className: 'vc-btn sm', onClick: () => onTab('mcp') }, translate('overview.openMcp')),

              h('button', { className: 'vc-btn sm', onClick: () => onTab('actions') }, translate('overview.openActions')))),
        )
      }

      function Appearance({ t, state, stateError, busy, runAppearance, draft, setDraft }) {
        // The select reads the LIVE state, not the draft. The draft exists only to
        // reflect a choice the moment it is made — before `appearance.state` has
        // come back — and it starts EMPTY, so the control shows what the theme
        // service actually reports rather than a seed that would claim `system`
        // whichever theme is in force.
        const themeValue = draft.theme || state?.theme?.preference || state?.theme?.id || DEFAULT_THEME
        return h('div', null,
          stateError ? h('div', { className: 'vc-banner warn' }, Icon(I.warn, 16), h('div', { className: 'vc-grow' }, stateError)) : null,
          h('div', { className: 'vc-card' },
            h('div', { className: 'vc-field' },
              h('span', { className: 'vc-label' }, translate('appearance.theme')),
              h('select', {
                className: 'vc-select', value: themeValue, disabled: busy !== null,
                onChange: (e) => {
                  const id = e.target.value
                  setDraft((d) => ({ ...d, theme: id }))
                  runAppearance('appearance.setTheme', { id }, translate('appearance.theme'))
                },
              }, APPEARANCE[0].options.map((id) => h('option', { key: id, value: id }, translate('theme.' + id)))),
              h('span', { className: 'vc-chip' }, state?.theme ? translate('appearance.current', { value: state.theme.id }) : translate('value.unknown'))),
            h('p', { className: 'vc-reason' }, translate('appearance.themeHint'))),

          h('div', { className: 'vc-card' },
            h('div', { className: 'vc-field' },
              h('span', { className: 'vc-label' }, translate('appearance.language')),
              h('input', {
                className: 'vc-input', value: draft.locale, placeholder: translate('appearance.languagePlaceholder'),
                onChange: (e) => setDraft((d) => ({ ...d, locale: e.target.value })),
              }),
              h('button', {
                className: 'vc-btn', disabled: busy !== null || draft.locale === '',
                onClick: () => runAppearance('appearance.setLocale', { id: draft.locale }, translate('appearance.language')),
              }, translate('appearance.apply')),
              h('span', { className: 'vc-chip' }, state?.locale || translate('value.unknown'))),
            h('p', { className: 'vc-reason' }, translate('appearance.languageHint'))),

          h('div', { className: 'vc-card' },
            h('div', { className: 'vc-field' },
              h('span', { className: 'vc-label' }, translate('appearance.layout')),
              h('button', { className: 'vc-btn', disabled: busy !== null, onClick: () => runAppearance('appearance.toggleSidebar', {}, translate('appearance.sidebar')) }, translate('appearance.sidebar')),
              h('button', { className: 'vc-btn', disabled: busy !== null, onClick: () => runAppearance('appearance.openRightbar', { track: true, fullscreen: false }, translate('appearance.rightbarOpen')) }, translate('appearance.rightbarOpen')),
              h('button', { className: 'vc-btn', disabled: busy !== null, onClick: () => runAppearance('appearance.closeRightbar', {}, translate('appearance.rightbarClose')) }, translate('appearance.rightbarClose'))),
            h('p', { className: 'vc-reason' }, translate('appearance.layoutHint'))),
        )
      }

      function Models({ t, models, modelError, busy, run, draft, setDraft }) {
        const providers = models?.providers || []
        return h('div', null,
          h('div', { className: 'vc-card' },
            h('div', { className: 'vc-field' },
              h('span', { className: 'vc-label' }, translate('model.provider')),
              h('select', {
                className: 'vc-select', value: draft.provider, disabled: busy !== null || providers.length === 0,
                onChange: (e) => setDraft((d) => ({ ...d, provider: e.target.value })),
              },
                providers.length === 0 ? h('option', { value: '' }, translate('model.noProviders')) : null,
                providers.map((p) => h('option', { key: p.id, value: p.id }, p.name ? `${p.name} (${p.id})` : p.id)))),
            h('div', { className: 'vc-field' },
              h('span', { className: 'vc-label' }, translate('model.model')),
              h('input', {
                className: 'vc-input', value: draft.model, placeholder: translate('model.modelPlaceholder'),
                onChange: (e) => setDraft((d) => ({ ...d, model: e.target.value })),
              }),
              h('button', {
                className: 'vc-btn primary', disabled: busy !== null || draft.provider === '' || draft.model === '',
                onClick: () => run('model.select', { provider: draft.provider, model: draft.model }, translate('model.select')),
              }, translate('model.select'))),
            h('p', { className: 'vc-reason' }, translate('model.hint'))),
          h('div', { className: 'vc-section' }, translate('model.sectionCurrent')),
          h('ReadState', { t, error: modelError, loading: models === null && !modelError, empty: false },
            h('div', { className: 'vc-card' },
              h('dl', { className: 'vc-kv' },
                h('dt', null, translate('model.provider')), h('dd', { className: 'vc-mono' }, models?.current?.provider || translate('value.unknown')),
                h('dt', null, translate('model.model')), h('dd', { className: 'vc-mono' }, models?.current?.model || translate('value.unknown')),
                h('dt', null, translate('model.effort')), h('dd', { className: 'vc-mono' }, models?.current?.reasoningEffort || translate('value.default')))),
            h('p', { className: 'vc-reason' }, providers.length === 0 ? translate('model.noProvidersHint') : translate('model.providerCount', { n: providers.length }))),
        )
      }

      function Plugins({ t, plugins, pluginError, busy, run }) {
        const bundles = plugins?.bundles || []
        const entries = plugins?.plugins || []
        return h('div', null,
          h('p', { className: 'vc-reason' }, translate('plugin.hint')),
          h('div', { className: 'vc-section' }, translate('plugin.sectionBundles')),
          h('ReadState', { t, error: pluginError, loading: plugins === null && !pluginError, empty: bundles.length === 0 && !pluginError && plugins !== null },
            h('div', { className: 'vc-list' }, bundles.map((b) => h('div', { key: b.name, className: 'vc-row' },
              h('div', { className: 'vc-grow' },
                h('div', { className: 'vc-name' }, b.name),
                h('span', { className: 'vc-id' }, [b.version, b.installed ? translate('plugin.installed') : translate('plugin.notInstalled'), b.removable ? '' : translate('plugin.protected')].filter(Boolean).join(' · '))),
              b.enabled ? h(Chip, { kind: 'ok' }, translate('plugin.enabled')) : h(Chip, { kind: 'warn' }, translate('plugin.disabled')),
              b.readOnlyReason ? h(Chip, { kind: 'error' }, b.readOnlyReason) : null,
              h('button', {
                className: 'vc-btn sm', disabled: busy !== null || Boolean(b.readOnlyReason),
                onClick: () => run('plugin.setEnabled', { name: b.name, enabled: !b.enabled }, translate('plugin.setEnabled')),
              }, b.enabled ? translate('plugin.disable') : translate('plugin.enable')))))),
          h('div', { className: 'vc-section' }, translate('plugin.sectionEntries')),
          h('ReadState', { t, error: '', loading: plugins === null && !pluginError, empty: entries.length === 0 && plugins !== null },
            h('div', { className: 'vc-list' }, entries.map((p) => h('div', { key: p.entryId, className: 'vc-row' },
              h('div', { className: 'vc-grow' },
                h('div', { className: 'vc-name' }, p.moduleName || p.entryId),
                h('span', { className: 'vc-id', title: p.entryId }, p.entryId)),
              p.fiberPhase ? h(Chip, null, p.fiberPhase) : null,
              p.diagnostic ? h(Chip, { kind: 'error' }, translate('plugin.diagnostic')) : null,
              p.enabled ? h(Chip, { kind: 'ok' }, translate('plugin.enabled')) : h(Chip, { kind: 'warn' }, translate('plugin.disabled')),
              h('button', {
                className: 'vc-btn sm', disabled: busy !== null || Boolean(p.readOnlyReason),
                title: p.readOnlyReason || '',
                onClick: () => run('plugin.setEnabled', { id: p.entryId, enabled: !p.enabled }, translate('plugin.setEnabled')),
              }, p.enabled ? translate('plugin.disable') : translate('plugin.enable')))))),
        )
      }

      function Mcp({ t, mcps, mcpError, busy, run, draft, setDraft }) {
        const servers = mcps || []
        return h('div', null,
          h('p', { className: 'vc-reason' }, translate('mcp.hint')),
          h('ReadState', { t, error: mcpError, loading: mcps === null && !mcpError, empty: servers.length === 0 && mcps !== null },
            h('div', { className: 'vc-list' }, servers.map((s) => h('div', { key: s.name, className: 'vc-row' },
              h('div', { className: 'vc-grow' },
                h('div', { className: 'vc-name' }, s.name),
                h('span', { className: 'vc-id' },
                  [translate('mcp.state.' + (s.state || 'unknown')),
                    s.toolCount === undefined ? '' : translate('mcp.toolCount', { n: s.toolCount }),
                    s.configured === false ? translate('mcp.unconfigured') : ''].filter(Boolean).join(' · '))),
              h(Chip, { kind: s.state === 'connected' ? 'ok' : s.state === 'failed' ? 'error' : 'warn' },
                translate('mcp.state.' + (s.state || 'unknown'))),
              h('button', {
                className: 'vc-btn sm', disabled: busy !== null,
                onClick: () => run('mcp.probe', { name: s.name }, translate('mcp.probe')),
              }, translate('mcp.probe')),
              h('button', {
                className: 'vc-btn sm', disabled: busy !== null,
                onClick: () => run('mcp.restart', { name: s.name }, translate('mcp.restart')),
              }, translate('mcp.restart')))))),
        )
      }

      /**
       * The catalogue as the console describes it, plus the boundary as data.
       *
       * The refused table is rendered as its own section rather than hidden: a user
       * who cannot see WHY the agent declines an action will ask it again and again,
       * and the console's own `reason`/`alternative` text is the answer. Nothing
       * here is authored by the panel — the strings come from `core.js` and are
       * shown verbatim, in the language the console wrote them in.
       */
      function Actions({ t, grouped, catalogue, catalogueError, busy, run, argsFor, canRun }) {
        const emptyCatalogue = catalogue.actions.length === 0 && catalogue.forbidden.length === 0
        const rows = grouped.map(({ domain, rows: group }) => h('div', { key: domain },
          h('div', { className: 'vc-section' }, domain),
          h('div', { className: 'vc-list' }, group.map((row) => h('div', { key: row.name, className: 'vc-row' },
            h('div', { className: 'vc-grow' },
              h('div', { className: 'vc-name vc-mono' }, row.name),
              h('span', { className: 'vc-id' },
                [row.mutating ? translate('actions.mutating') : translate('actions.readOnly'),
                  row.destructive ? translate('actions.destructive') : '',
                  row.requiresClient ? translate('actions.requiresClient') : ''].filter(Boolean).join(' · '))),
            row.destructive ? h(Chip, { kind: 'warn' }, translate('actions.destructive')) : null,
            // A row the panel cannot actually drive gets a chip, not a Run button.
            // `rowControl` is the only builder, and it decides through `rowAffordance`
            // → `argsFor`, so a control is only ever offered where the arguments
            // exist to back it.
            rowControl({ row, t, busy, run }))))))

        const refused = catalogue.forbidden.length === 0 ? null : h('div', null,
          h('div', { className: 'vc-section' }, translate('actions.sectionForbidden')),
          h('p', { className: 'vc-reason' }, translate('actions.forbiddenHint')),
          h('div', { className: 'vc-list' }, catalogue.forbidden.map((row) => h('div', { key: row.name, className: 'vc-row' },
            h('div', { className: 'vc-grow' },
              h('div', { className: 'vc-name vc-mono' }, row.name),
              h('p', { className: 'vc-reason' }, row.reason || ''),
              row.alternative ? h('p', { className: 'vc-alt' }, h('b', null, translate('actions.alternative') + ' '), row.alternative) : null),
            h(Chip, { kind: 'error' }, translate('actions.refused'))))))

        return h('div', null,
          h('p', { className: 'vc-reason' }, translate('actions.hint')),
          h(ReadState, { t, error: catalogueError, loading: emptyCatalogue && !catalogueError, empty: false },
            h('div', null, rows, refused)))
      }

      // The boundary wraps the WHOLE panel, and the sidebar icon does not need one:
      // it draws no data.
      function Panel(props) {
        return h(Boundary, { t }, h(Console, props || {}))
      }

      // `h` rides back out because the slot registration builds the main element
      // from it: this factory must not need a second React import just to mount.
      // `__internal` exposes what the tests drive directly — the pure derivations,
      // the live translator, and a render entry that needs no DOM renderer.
      return {
        Panel,
        PanelIcon,
        h,
        __internal: {
          deriveActions, groupByDomain, describeStatus, argsFor, canRun, rowAffordance, rowControl,
          APPEARANCE, CSS,
          translate: (key, params) => t(key, params),
          renderConsole: (props) => h(Panel, props || {}),
        },
      }
    }


    /**
     * Build the panel, once, on first use.
     *
     * `require('react')` is a PLATFORM SEED the shell provides; the panel itself
     * is defined above, in this file. Building lazily still matters: the factory
     * above runs at startup in EVERY realm, and evaluating the panel's React tree
     * there would pull a DOM-touching component into a load that has nothing to
     * render yet.
     *
     * @param services - an ACCESSOR, not a bag. It is called on every appearance
     *   request, because Cordis can dispose and remount one of these services
     *   while the panel is open — the identical reason the drain loop reads
     *   `ctx.theme` at dispatch time rather than capturing it at install time.
     *   A bag captured here would keep writing into a dead service after a theme
     *   reload, which is precisely the failure this plugin's bridge docstring
     *   records.
     */
    let panelModule
    function loadPanel(services) {
      if (panelModule === undefined) {
        // `react` is a PLATFORM SEED the shell hands this bundle; it is not a
        // package-local file. Everything else the panel needs is in this file,
        // because the module system's `require` cannot reach a sibling module of
        // this package in the browser (`client/modules/src/client/system.ts`):
        // only platform seeds, materialized modules and registered factories
        // resolve. `panel.js` used to be a separate file reached this way, and
        // the panel could never mount.
        const React = require('react')
        panelModule = createPanel({
          React,
          h: React.createElement,
          // The SAME `applyOp` the bridge dispatches drained requests into. The
          // panel's appearance controls are therefore not a parallel path: they
          // are the identical function.
          applyOp,
          // ...and these are the same three services, read the same way.
          services,
          call,
          // The bound translator and the locale service THEMSELVES. Passing a
          // thunk here is what made every label render as a function and left
          // the language subscription permanently inert.
          t,
          localeApi,
        })
      }
      return panelModule
    }

    /**
     * Register the sidebar entry and the main panel.
     *
     * Both go through `slots.inject`, never a one-shot `ctx.slots` read: the
     * renderer mounts its registry during its own init, so at this moment
     * `ctx.slots` may not exist yet, and `inject` is Cordis' "run this once the
     * service is here" — the same pattern the Host side uses for `webServer`
     * and `dsh-vyra-agent-manager` uses for both slots.
     */
    function registerPanel(ctx) {
      const slots = ctx.slots
      // Presence is not enough. A half-mounted registry — no `inject`, or no
      // `register` — would otherwise escape as a TypeError out of `apply` and
      // take the drain loop with it, which is strictly worse than no panel.
      if (typeof slots?.inject !== 'function' || typeof slots?.register !== 'function') return

      // The dictionaries first: the sidebar label and the panel both read `t`,
      // and registering them inside an effect ties their removal to the
      // context's lifetime — the locale service throws on a duplicate
      // (ns, locale), so a second mount would fail if this never released them.
      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-vyra-dsh-console: dictionaries')
      localeApi = ctx.locale
      t = ctx.locale.bind(NS)

      // The bag the panel's appearance controls hand to `applyOp`, built fresh
      // on every request. `ctx.theme` and friends are read HERE, at call time —
      // never captured into an object when the panel is built. A service can be
      // disposed and remounted while the panel is open, and a captured bag would
      // then keep writing into the dead one: every appearance control failing
      // after a theme reload, which is the exact failure the drain loop's own
      // comment records for its services.
      //
      // This accessor is why the panel does not need the global it used to read
      // (`globalThis.__vcServices`, which nothing ever assigned — so every
      // appearance control reached `applyOp` with an empty bag and reported
      // "the theme service is unavailable").
      const services = () => ({ theme: ctx.theme, layout: ctx.layout, locale: ctx.locale })
      // Kept where the tests (and a future caller) can reach it, because the
      // property that matters — "reads the context per call" — is only
      // observable by calling it, and the panel's own click handlers need a
      // renderer to reach.
      panelServices = services

      slots.inject('sidebar.panellist', () => {
        const panel = loadPanel(services)
        return slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: PANEL_ORDER,
          // Read at call time: the shell asks for the label on every render, and
          // a language switch must be reflected without re-registering.
          label: () => t('app.title'),
        }, panel.PanelIcon)
      })

      slots.inject('main', () => {
        const panel = loadPanel(services)
        return slots.register({ name: 'main', key: PANEL_ID }, (props) => {
          // The element is built here rather than inside the panel module, so
          // the module never needs the `h` binding itself. `props` is passed
          // through untouched: the shell hands a panel the store and the
          // injected face, and a component that reconstructed its own props
          // would silently drop both.
          return panelModule.h(panel.Panel, props || {})
        })
      })
    }

    return {
      __internal: {
        applyOp,
        OPS,
        loadPanel,
        createPanel,
        panelServices: () => panelServices,
      },
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
            // Read at call time, so a remounted service is picked up. The ui ops
            // need the ledger, the frame and the command catalogue; any of them
            // absent makes the affected op report `unavailable` rather than throw,
            // which is why they are spread from the live context instead of
            // asserted here.
            const services = {
              theme: ctx.theme,
              layout: ctx.layout,
              locale: ctx.locale,
              slots: ctx.get?.('slots') ?? ctx.slots,
              shortcuts: ctx.get?.('shortcuts') ?? ctx.shortcuts,
              sidebarRight: ctx.get?.('sidebarRight') ?? ctx.sidebarRight,
              sidebarRightTabs: ctx.get?.('sidebarRightTabs') ?? ctx.sidebarRightTabs,
            }
            // `op` is passed through UNTOUCHED. It arrives over HTTP and is
            // untrusted, and `applyOp` refuses a non-string op precisely so that
            // a coerced value cannot reach a handler — stringifying it here
            // would silently disarm that guard.
            const outcome = await applyOp(services, request?.op, request?.args)
            const reply = outcome.status === 'ok'
              ? present({ id: request?.id, ok: true, value: replyValue(outcome, request?.op) })
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
        }, 'dsh-vyra-dsh-console: appearance bridge')

        // The panel. Registered AFTER the bridge, and that ordering is not
        // cosmetic: everything below is inside the same `try`, and a slot
        // registry that is absent or half-mounted must not take the drain loop
        // down with it — the bridge is what makes every appearance action work
        // at all, the panel is the convenience.
        try {
          registerPanel(ctx)
        } catch (err) {
          // A panel that cannot register is a lost convenience, not a lost
          // plugin. Reported rather than swallowed, so it is visible in the
          // console instead of as an entry that simply never appears.
          try { console.warn('[dsh-vyra-dsh-console] panel not registered:', err) } catch { /* no console */ }
        }
      },
    }
  },
})
