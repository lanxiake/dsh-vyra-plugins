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

    /**
     * Build the panel, once, on first use.
     *
     * `require('react')` and `require('./panel.js')` both go through the module
     * loader's own resolver. Doing it lazily matters: the factory above runs at
     * startup in EVERY realm, and evaluating the panel there would pull a
     * DOM-touching module into a load that has nothing to render yet.
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
        const React = require('react')
        const factory = require('./panel.js')
        panelModule = factory.createPanel({
          React,
          h: React.createElement,
          // The SAME `applyOp` the bridge dispatches drained requests into. The
          // panel's appearance controls are therefore not a parallel path: they
          // are the identical function.
          applyOp,
          // ...and these are the same three services, read the same way.
          services,
          call,
          t: () => t,
          localeApi: () => localeApi,
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
      __internal: { applyOp, OPS, loadPanel, panelServices: () => panelServices },
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
