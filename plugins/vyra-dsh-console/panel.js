// DSH console panel. A plain browser module: it is loaded through the bundle's
// own `require`, which resolves only what `client.js` hands it plus the modules
// the shell provides. It must therefore never name a Harness package — the
// bundle is served to the page with no dependency graph of its own, and a bare
// `@deepseek-ai/…` specifier would fail at runtime in the browser while every
// test in this repo, whose `require` stub answers anything, stayed green.
//
// One operation, two callers: this panel does not re-implement a single
// console operation. The appearance row and every Host action are sent down the
// same two channels the agent tool uses — `applyOp` for the Client realm and
// `/api/vyra-console/rpc` for the Host — so there is exactly one implementation
// of each and no second catalogue of action names to drift.
export function createPanel({ React, h, applyOp, services, call, t, localeApi }) {
  const { useState, useEffect, useMemo, useCallback, useRef } = React

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
   * One action row's arguments, built from the panel's own controls.
   *
   * Only the actions this panel actually drives are given a form; everything
   * else is read-only in the panel and named as such, because a generic
   * "arguments" text box would be a second, unvalidated way to invoke an
   * operation whose real validation lives in the domain handler.
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
      case 'mcp.restart':
      case 'mcp.probe':
        return draft.name ? { name: draft.name } : null
      default:
        return {}
    }
  }

  const isReadOnly = (row) => row.name === 'settings.get' || row.name === 'settings.set'

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
      try { console.error('[vyra-dsh-console] panel render failed', error, info) } catch { /* no console */ }
    }
    render() {
      if (this.state.error === null) return this.props.children
      return h('div', { className: 'vc' }, h('style', null, CSS),
        h('div', { className: 'vc-scroll' }, h('div', { className: 'vc-wrap' },
          h('div', { className: 'vc-banner error' }, Icon(I.warn, 16),
            h('div', { className: 'vc-grow' },
              h('b', null, t('boundary.title')),
              h('p', { className: 'vc-reason' }, String(this.state.error?.message || this.state.error)),
              h('p', { className: 'vc-reason' }, t('boundary.hint')))),
          h('button', { className: 'vc-btn primary', onClick: () => this.setState({ error: null }) }, t('app.retry')))))
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
        if (shape.kind === 'ok') notify(t('toast.done', { action: name }), 'ok')
        else if (shape.kind === 'warn') notify(t('toast.unavailable', { action: name, reason: String(reply?.reason || '') }), 'warn')
        else notify(t('toast.failed', { action: name, reason: String(reply?.reason || reply?.status || '') }), 'error')
        reload()
        return reply
      } catch (err) {
        notify(t('toast.failed', { action: name, reason: String(err?.message || err) }), 'error')
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
    const runAppearance = useCallback((op, args, label) => {
      setBusy(op)
      // A panel built without the accessor — a test double, or a future caller
      // that forgot it — must report a refusal rather than throw out of a click
      // handler. `applyOp` already answers that way for a missing service, so
      // an empty bag is the honest input rather than a special case here.
      const bag = typeof services === 'function' ? services() : {}
      const outcome = applyOp(bag, op, args || {})
      if (outcome.status === 'ok') notify(t('toast.done', { action: label || op }), 'ok')
      else notify(t('toast.failed', { action: label || op, reason: String(outcome.reason || '') }), 'error')
      setBusy(null)
      void loadState()
    }, [services, notify, loadState])

    const catalogueView = catalogue || { actions: [], forbidden: [] }
    const grouped = useMemo(() => groupByDomain(catalogueView.actions), [catalogueView.actions])

    const header = h('div', { className: 'vc-head' },
      h('div', null,
        h('h1', { className: 'vc-title' }, t('app.title')),
        h('p', { className: 'vc-sub' }, t('app.subtitle'))),
      h('div', { className: 'vc-head-actions' },
        h('button', { className: 'vc-btn', onClick: reload, disabled: busy !== null }, Icon(I.refresh, 15), t('app.refresh')),
        onClose ? h('button', { className: 'vc-btn', onClick: onClose }, t('app.close')) : null))

    const tabs = [
      ['overview', t('tab.overview')],
      ['appearance', t('tab.appearance')],
      ['models', t('tab.models')],
      ['plugins', t('tab.plugins')],
      ['mcp', t('tab.mcp')],
      ['actions', t('tab.actions')],
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
        tab === 'actions' ? h(Actions, { t, grouped, catalogue: catalogueView, catalogueError, busy, run, argsFor, isReadOnly }) : null)),
      toast ? h('div', { className: 'vc-toast', role: 'status' },
        h('i', { style: { background: toast.kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : toast.kind === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-state-success-primary)' } }),
        toast.text) : null)
  }

  /** Shared read-state rendering: a banner on failure, a skeleton while loading. */
  function ReadState({ t, error, loading, empty, children }) {
    if (error) return h('div', { className: 'vc-banner error' }, Icon(I.warn, 16), h('div', { className: 'vc-grow' }, t('app.loadFailed', { error })))
    if (loading) return h('div', null, [0, 1, 2].map((i) => h('div', { key: i, className: 'vc-skel' })))
    if (empty) return h('div', { className: 'vc-empty' }, h('b', null, t('app.empty')), h('span', null, t('app.emptyHint')))
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
        h('div', { className: 'vc-grow' }, t('overview.boundary'))),

      h('div', { className: 'vc-section' }, t('overview.sectionModel')),
      h('div', { className: 'vc-card' },
        modelError
          ? h('div', { className: 'vc-banner error' }, Icon(I.warn, 16), h('div', { className: 'vc-grow' }, modelError))
          : h('dl', { className: 'vc-kv' },
            h('dt', null, t('model.provider')), h('dd', { className: 'vc-mono' }, models?.current?.provider || t('value.unknown')),
            h('dt', null, t('model.model')), h('dd', { className: 'vc-mono' }, models?.current?.model || t('value.unknown')),
            h('dt', null, t('model.effort')), h('dd', { className: 'vc-mono' }, models?.current?.reasoningEffort || t('value.default'))),
        h('div', { className: 'vc-field' }, h('button', { className: 'vc-btn sm', onClick: () => onTab('models') }, t('overview.changeModel')))),

      h('div', { className: 'vc-section' }, t('overview.sectionAppearance')),
      h('div', { className: 'vc-card' },
        stateError
          ? h('div', { className: 'vc-banner warn' }, Icon(I.warn, 16), h('div', { className: 'vc-grow' }, stateError))
          : h('dl', { className: 'vc-kv' },
            h('dt', null, t('appearance.theme')), h('dd', null, state?.theme ? state.theme.id : t('value.unknown')),
            h('dt', null, t('appearance.scheme')), h('dd', null, state?.theme?.colorScheme || t('value.unknown')),
            h('dt', null, t('appearance.locale')), h('dd', { className: 'vc-mono' }, state?.locale || t('value.unknown'))),
        h('div', { className: 'vc-field' }, h('button', { className: 'vc-btn sm', onClick: () => onTab('appearance') }, t('overview.changeAppearance')))),

      h('div', { className: 'vc-section' }, t('overview.sectionFleet')),
      h('div', { className: 'vc-card' },
        h('dl', { className: 'vc-kv' },
          h('dt', null, t('overview.bundles')),
          h('dd', null, plugins ? t('overview.bundleCount', { enabled, total: bundles }) : (pluginError || t('loading'))),
          h('dt', null, t('overview.mcp')),
          h('dd', null, mcps ? String(mcps.length) : (mcpError || t('loading'))),
          h('dt', null, t('overview.actionCount')),
          h('dd', null, catalogueError || String(catalogue.actions.length)),
          h('dt', null, t('overview.forbiddenCount')),
          h('dd', null, catalogueError || String(catalogue.forbidden.length))),
        h('div', { className: 'vc-field' },
          h('button', { className: 'vc-btn sm', onClick: () => onTab('plugins') }, t('overview.openPlugins')),
          h('button', { className: 'vc-btn sm', onClick: () => onTab('mcp') }, t('overview.openMcp')),

          h('button', { className: 'vc-btn sm', onClick: () => onTab('actions') }, t('overview.openActions')))),
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
          h('span', { className: 'vc-label' }, t('appearance.theme')),
          h('select', {
            className: 'vc-select', value: themeValue, disabled: busy !== null,
            onChange: (e) => {
              const id = e.target.value
              setDraft((d) => ({ ...d, theme: id }))
              runAppearance('appearance.setTheme', { id }, t('appearance.theme'))
            },
          }, APPEARANCE[0].options.map((id) => h('option', { key: id, value: id }, t('theme.' + id)))),
          h('span', { className: 'vc-chip' }, state?.theme ? t('appearance.current', { value: state.theme.id }) : t('value.unknown'))),
        h('p', { className: 'vc-reason' }, t('appearance.themeHint'))),

      h('div', { className: 'vc-card' },
        h('div', { className: 'vc-field' },
          h('span', { className: 'vc-label' }, t('appearance.language')),
          h('input', {
            className: 'vc-input', value: draft.locale, placeholder: t('appearance.languagePlaceholder'),
            onChange: (e) => setDraft((d) => ({ ...d, locale: e.target.value })),
          }),
          h('button', {
            className: 'vc-btn', disabled: busy !== null || draft.locale === '',
            onClick: () => runAppearance('appearance.setLocale', { id: draft.locale }, t('appearance.language')),
          }, t('appearance.apply')),
          h('span', { className: 'vc-chip' }, state?.locale || t('value.unknown'))),
        h('p', { className: 'vc-reason' }, t('appearance.languageHint'))),

      h('div', { className: 'vc-card' },
        h('div', { className: 'vc-field' },
          h('span', { className: 'vc-label' }, t('appearance.layout')),
          h('button', { className: 'vc-btn', disabled: busy !== null, onClick: () => runAppearance('appearance.toggleSidebar', {}, t('appearance.sidebar')) }, t('appearance.sidebar')),
          h('button', { className: 'vc-btn', disabled: busy !== null, onClick: () => runAppearance('appearance.openRightbar', { track: true, fullscreen: false }, t('appearance.rightbarOpen')) }, t('appearance.rightbarOpen')),
          h('button', { className: 'vc-btn', disabled: busy !== null, onClick: () => runAppearance('appearance.closeRightbar', {}, t('appearance.rightbarClose')) }, t('appearance.rightbarClose'))),
        h('p', { className: 'vc-reason' }, t('appearance.layoutHint'))),
    )
  }

  function Models({ t, models, modelError, busy, run, draft, setDraft }) {
    const providers = models?.providers || []
    return h('div', null,
      h('div', { className: 'vc-card' },
        h('div', { className: 'vc-field' },
          h('span', { className: 'vc-label' }, t('model.provider')),
          h('select', {
            className: 'vc-select', value: draft.provider, disabled: busy !== null || providers.length === 0,
            onChange: (e) => setDraft((d) => ({ ...d, provider: e.target.value })),
          },
            providers.length === 0 ? h('option', { value: '' }, t('model.noProviders')) : null,
            providers.map((p) => h('option', { key: p.id, value: p.id }, p.name ? `${p.name} (${p.id})` : p.id)))),
        h('div', { className: 'vc-field' },
          h('span', { className: 'vc-label' }, t('model.model')),
          h('input', {
            className: 'vc-input', value: draft.model, placeholder: t('model.modelPlaceholder'),
            onChange: (e) => setDraft((d) => ({ ...d, model: e.target.value })),
          }),
          h('button', {
            className: 'vc-btn primary', disabled: busy !== null || draft.provider === '' || draft.model === '',
            onClick: () => run('model.select', { provider: draft.provider, model: draft.model }, t('model.select')),
          }, t('model.select'))),
        h('p', { className: 'vc-reason' }, t('model.hint'))),
      h('div', { className: 'vc-section' }, t('model.sectionCurrent')),
      h('ReadState', { t, error: modelError, loading: models === null && !modelError, empty: false },
        h('div', { className: 'vc-card' },
          h('dl', { className: 'vc-kv' },
            h('dt', null, t('model.provider')), h('dd', { className: 'vc-mono' }, models?.current?.provider || t('value.unknown')),
            h('dt', null, t('model.model')), h('dd', { className: 'vc-mono' }, models?.current?.model || t('value.unknown')),
            h('dt', null, t('model.effort')), h('dd', { className: 'vc-mono' }, models?.current?.reasoningEffort || t('value.default')))),
        h('p', { className: 'vc-reason' }, providers.length === 0 ? t('model.noProvidersHint') : t('model.providerCount', { n: providers.length }))),
    )
  }

  function Plugins({ t, plugins, pluginError, busy, run }) {
    const bundles = plugins?.bundles || []
    const entries = plugins?.plugins || []
    return h('div', null,
      h('p', { className: 'vc-reason' }, t('plugin.hint')),
      h('div', { className: 'vc-section' }, t('plugin.sectionBundles')),
      h('ReadState', { t, error: pluginError, loading: plugins === null && !pluginError, empty: bundles.length === 0 && !pluginError && plugins !== null },
        h('div', { className: 'vc-list' }, bundles.map((b) => h('div', { key: b.name, className: 'vc-row' },
          h('div', { className: 'vc-grow' },
            h('div', { className: 'vc-name' }, b.name),
            h('span', { className: 'vc-id' }, [b.version, b.installed ? t('plugin.installed') : t('plugin.notInstalled'), b.removable ? '' : t('plugin.protected')].filter(Boolean).join(' · '))),
          b.enabled ? h(Chip, { kind: 'ok' }, t('plugin.enabled')) : h(Chip, { kind: 'warn' }, t('plugin.disabled')),
          b.readOnlyReason ? h(Chip, { kind: 'error' }, b.readOnlyReason) : null,
          h('button', {
            className: 'vc-btn sm', disabled: busy !== null || Boolean(b.readOnlyReason),
            onClick: () => run('plugin.setEnabled', { name: b.name, enabled: !b.enabled }, t('plugin.setEnabled')),
          }, b.enabled ? t('plugin.disable') : t('plugin.enable')))))),
      h('div', { className: 'vc-section' }, t('plugin.sectionEntries')),
      h('ReadState', { t, error: '', loading: plugins === null && !pluginError, empty: entries.length === 0 && plugins !== null },
        h('div', { className: 'vc-list' }, entries.map((p) => h('div', { key: p.entryId, className: 'vc-row' },
          h('div', { className: 'vc-grow' },
            h('div', { className: 'vc-name' }, p.moduleName || p.entryId),
            h('span', { className: 'vc-id', title: p.entryId }, p.entryId)),
          p.fiberPhase ? h(Chip, null, p.fiberPhase) : null,
          p.diagnostic ? h(Chip, { kind: 'error' }, t('plugin.diagnostic')) : null,
          p.enabled ? h(Chip, { kind: 'ok' }, t('plugin.enabled')) : h(Chip, { kind: 'warn' }, t('plugin.disabled')),
          h('button', {
            className: 'vc-btn sm', disabled: busy !== null || Boolean(p.readOnlyReason),
            title: p.readOnlyReason || '',
            onClick: () => run('plugin.setEnabled', { id: p.entryId, enabled: !p.enabled }, t('plugin.setEnabled')),
          }, p.enabled ? t('plugin.disable') : t('plugin.enable')))))),
    )
  }

  function Mcp({ t, mcps, mcpError, busy, run, draft, setDraft }) {
    const servers = mcps || []
    return h('div', null,
      h('p', { className: 'vc-reason' }, t('mcp.hint')),
      h('ReadState', { t, error: mcpError, loading: mcps === null && !mcpError, empty: servers.length === 0 && mcps !== null },
        h('div', { className: 'vc-list' }, servers.map((s) => h('div', { key: s.name, className: 'vc-row' },
          h('div', { className: 'vc-grow' },
            h('div', { className: 'vc-name' }, s.name),
            h('span', { className: 'vc-id' },
              [t('mcp.state.' + (s.state || 'unknown')),
                s.toolCount === undefined ? '' : t('mcp.toolCount', { n: s.toolCount }),
                s.configured === false ? t('mcp.unconfigured') : ''].filter(Boolean).join(' · '))),
          h(Chip, { kind: s.state === 'connected' ? 'ok' : s.state === 'failed' ? 'error' : 'warn' },
            t('mcp.state.' + (s.state || 'unknown'))),
          h('button', {
            className: 'vc-btn sm', disabled: busy !== null,
            onClick: () => run('mcp.probe', { name: s.name }, t('mcp.probe')),
          }, t('mcp.probe')),
          h('button', {
            className: 'vc-btn sm', disabled: busy !== null,
            onClick: () => run('mcp.restart', { name: s.name }, t('mcp.restart')),
          }, t('mcp.restart')))))),
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
  function Actions({ t, grouped, catalogue, catalogueError, busy, run, argsFor, isReadOnly }) {
    const emptyCatalogue = catalogue.actions.length === 0 && catalogue.forbidden.length === 0
    const rows = grouped.map(({ domain, rows: group }) => h('div', { key: domain },
      h('div', { className: 'vc-section' }, domain),
      h('div', { className: 'vc-list' }, group.map((row) => h('div', { key: row.name, className: 'vc-row' },
        h('div', { className: 'vc-grow' },
          h('div', { className: 'vc-name vc-mono' }, row.name),
          h('span', { className: 'vc-id' },
            [row.mutating ? t('actions.mutating') : t('actions.readOnly'),
              row.destructive ? t('actions.destructive') : '',
              row.requiresClient ? t('actions.requiresClient') : ''].filter(Boolean).join(' · '))),
        row.destructive ? h(Chip, { kind: 'warn' }, t('actions.destructive')) : null,
        isReadOnly(row) || row.name === 'console.actions'
          ? h(Chip, null, t('actions.toolOnly'))
          : h('button', {
            className: 'vc-btn sm',
            disabled: busy !== null,
            onClick: () => run(row.name, argsFor(row, {}), row.name),
          }, t('actions.run')))))))

    const refused = catalogue.forbidden.length === 0 ? null : h('div', null,
      h('div', { className: 'vc-section' }, t('actions.sectionForbidden')),
      h('p', { className: 'vc-reason' }, t('actions.forbiddenHint')),
      h('div', { className: 'vc-list' }, catalogue.forbidden.map((row) => h('div', { key: row.name, className: 'vc-row' },
        h('div', { className: 'vc-grow' },
          h('div', { className: 'vc-name vc-mono' }, row.name),
          h('p', { className: 'vc-reason' }, row.reason || ''),
          row.alternative ? h('p', { className: 'vc-alt' }, h('b', null, t('actions.alternative') + ' '), row.alternative) : null),
        h(Chip, { kind: 'error' }, t('actions.refused'))))))

    return h('div', null,
      h('p', { className: 'vc-reason' }, t('actions.hint')),
      h(ReadState, { t, error: catalogueError, loading: emptyCatalogue && !catalogueError, empty: false },
        h('div', null, rows, refused)))
  }

  // The boundary wraps the WHOLE panel, and the sidebar icon does not need one:
  // it draws no data.
  function Panel(props) {
    return h(Boundary, { t }, h(Console, props || {}))
  }

  // `h` rides back out because the slot registration in `client.js` builds the
  // element for the main key: the panel module must not need a separate import
  // of React just to be mounted.
  return { Panel, PanelIcon, h, __internal: { deriveActions, groupByDomain, describeStatus, APPEARANCE, CSS } }
}
