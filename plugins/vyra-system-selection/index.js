// System-wide selection assistant for the DSH desktop client.
//
// Right-click a selection in any application and a native menu appears next to it: AI search,
// translate, summarize, explain, copy. The reading half never touches the DSH window; only an
// explicitly chosen action reaches the network.
//
// The popup is a Win32 window painted with GDI, and the native context menu is suppressed by a
// low-level mouse hook (see native.js for why). This file owns the trigger policy, the actions,
// and the small HTTP surface the settings page uses.
import {
  ACTIONS, MAX_TEXT_CHARS, buildRequest, buildSearchRequest, findAction, pickModel, reduceMouse,
  saneRect, searchQuery, selectionProblem,
} from './core.js'
import { CAPTURE_DELAY_MS, POLL_MS, captureSelection, createOverlay, readClipboardText, setWarnSink, writeClipboardText } from './native.js'
import { loadSettings, saveSettings } from './store.js'

export const name = '@local/system-selection'

// Deliberately no module-level `inject`: the gesture loop should start with the Host rather than
// wait for the web server. The route attaches through `ctx.inject` below whenever it appears.

/**
 * Host plugin entry.
 * @param ctx - Cordis context. `ctx.llm` and `ctx.web` are resolved per action because either may
 *   be registered after this plugin applies.
 */
export function apply(ctx) {
  setWarnSink((message) => ctx.logger?.warn?.(`system-selection: ${message}`))

  let lastResult = ''
  let lastSources = []
  /** The selection whose menu the user closed, so the poll does not reopen it. See `alreadyDismissed`. */
  let dismissed = ''
  const overlay = createOverlay({
    onAction: (id, anchor) => runAction(id, anchor),
    onDismiss: () => dismiss(),
    onPanelClose: () => dismiss(),
    onPanelCopy: () => {
      copyResult()
      overlay.setStatus('已复制到剪贴板', 'info')
    },
    onOpenUrl: (url) => openUrl(ctx, url),
    onRightClick: (pt, cached) => onRightClick(pt, cached),
  })

  if (!overlay) {
    ctx.logger?.info?.('system-selection: 仅支持 Windows，已跳过')
    registerRoute(ctx, {
      status: () => ({ supported: false, enabled: false, message: '当前平台不支持系统级划词（仅 Windows）' }),
      setEnabled: () => ({ ok: false, error: 'unsupported' }),
    })
    return
  }

  const stored = loadSettings()
  let enabled = stored.enabled
  let settings = stored.settings
  let pending = null // { text, anchor }
  let generation = 0
  let pollTimer = null
  let captureTimer = null
  let mouse = null
  const stats = { ticks: 0, rightClicks: 0, gestures: 0, captured: 0, empty: 0, searches: 0, inApp: 0, lastCapture: '' }

  // --- triggers ------------------------------------------------------------------------------

  /**
   * The synchronous decision the mouse hook makes. It must not touch the clipboard: the callback
   * has to return well inside Windows' LowLevelHooksTimeout or the system drops the hook, and a
   * selection read costs far more than that budget.
   *
   * `cached` is the selection the native layer read at the last left-button release, which is the
   * only moment a selection can appear.
   *
   * @returns true to swallow the right-click and open our menu instead of the application's.
   */
  function onRightClick(pt, cached) {
    stats.rightClicks++
    if (!enabled) return false
    const text = cached || ''
    if (!text || selectionProblem(text)) {
      // Nothing selected: let the application show its own menu, which is what the user wants when
      // right-clicking over a link, a field, or empty space. This is also the safety net for the
      // DSH window: if its selection cannot be copied, the client's own menu still appears.
      stats.empty++
      return false
    }
    stats.captured++
    stats.lastCapture = text.slice(0, 120)
    generation++
    lastResult = ''
    lastSources = []
    // An explicit right-click is a fresh request, so it may reopen text the user closed the menu on.
    dismissed = ''
    // The system-wide path has no selection rect — the text came from the clipboard, and the
    // application it belonged to is not ours to measure. The pointer is all there is, and for a
    // right-click that is the same end of the selection the user just clicked, which is the anchor
    // the menu wants anyway.
    const anchor = { left: pt.x, top: pt.y, right: pt.x, bottom: pt.y }
    pending = { text, anchor }
    // Deferred: showing a window inside the hook callback would run window management on the
    // input path, which is exactly what the timeout forbids.
    const mine = generation
    setTimeout(() => {
      if (mine !== generation || !pending) return
      overlay.showMenu({ anchor, actions: ACTIONS })
    }, 0)
    return true
  }

  /**
   * Open the menu from inside the DSH client.
   *
   * The page knows the selection (`window.getSelection()`) and the screen coordinates
   * (`MouseEvent.screenX/screenY`) directly, so the whole gesture arrives as arguments — no
   * clipboard round-trip and no coordinate translation.
   *
   * This is a second entry point rather than a second implementation: it lands in the same
   * `pending` + `showMenu` path the hook uses, so both triggers behave identically.
   *
   * @param args - `{ text, x, y }` where x/y are screen coordinates.
   */
  function openInApp({ text, x, y, rect, auto = false }) {
    if (!enabled) return { shown: false, error: '插件已关闭' }
    // The in-page auto path runs in the renderer, which does not hold the settings; the decision
    // stays here so the toggle means the same thing on both halves.
    if (auto && !settings.openOnSelect) return { shown: false, reason: 'auto-disabled' }
    const core = typeof text === 'string' ? text.trim() : ''
    if (!core) return { shown: false, error: '没有选中文字' }
    const problem = selectionProblem(core)
    if (problem) return { shown: false, error: problem }
    // Same guard as the system-wide path: a pointer release over text whose menu was already
    // dismissed must not bring it straight back. The right-click path clears `dismissed` itself,
    // so this only ever refuses the auto gesture.
    if (auto && alreadyDismissed(core)) return { shown: false, reason: 'dismissed' }

    const at = { x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) }

    // Where to put the windows: under the selection, not under the pointer.
    //
    // The pointer is at whichever end the drag finished, so anchoring there puts the menu over
    // the text below the selection on a right-to-left drag and gives the panel no idea what it
    // must not cover. The renderer measures the selection in screen coordinates and sends that;
    // when it cannot (an exotic selection, or an older client half), fall back to the pointer,
    // which at least keeps the gesture working.
    const anchor = saneRect(rect) ?? { left: at.x, top: at.y, right: at.x, bottom: at.y }

    stats.inApp++
    stats.captured++
    stats.lastCapture = core.slice(0, 120)
    generation++
    lastResult = ''
    lastSources = []
    pending = { text: core, anchor, pointer: at }
    overlay.showMenu({ anchor, actions: ACTIONS })
    return { shown: true, at }
  }

  function tick() {
    if (!enabled) return
    stats.ticks++
    const pt = overlay.cursor()
    if (overlay.visible && overlay.containsPoint(pt)) {
      mouse = null
      return
    }
    const down = overlay.leftButtonDown()
    const { state, fire } = reduceMouse(mouse, { down, x: pt.x, y: pt.y, t: Date.now() })
    mouse = state
    // Drag-select still opens the menu, but only when the user asks for it with the modifier:
    // popping a menu after every swipe is the behaviour the toolbar had, and it fights the
    // right-click flow this plugin is built around.
    if (fire && settings.openOnSelect && !overlay.modifierHeld?.()) {
      // Over the DSH window the poll must not capture: the page owns that surface and reports its
      // own selection (see `installInAppAutoSelect` in the client half). Capturing here would
      // inject Ctrl+C into a Chromium renderer that ignores it, costing the full 220 ms wait to
      // learn nothing.
      if (!overlay.windowUnderPoint?.(pt)) {
        stats.gestures++
        scheduleCapture(pt)
      }
    }
  }

  /**
   * Whether this selection was already dismissed, so the poll must not reopen it.
   *
   * The selection outlives the menu: the user picks text, the menu appears, they close it — and
   * every later poll tick still sees the same drag and would pop it straight back up. Closing a
   * menu that refuses to stay closed is worse than not opening it. A new drag, or a different
   * text, is a new intent and opens normally.
   */
  function alreadyDismissed(text) {
    return dismissed === text
  }

  function scheduleCapture(pt) {
    // The target application is still committing its selection when the button comes up; copying
    // immediately returns the previous clipboard far more often than not.
    if (captureTimer) clearTimeout(captureTimer)
    captureTimer = setTimeout(() => {
      captureTimer = null
      // The hook primed this selection on the same left-button release, ~10-40 ms earlier, and a
      // prime costs a 220 ms injected Ctrl+C. `cachedSelection` is a read of that result, not a new
      // capture, so reusing it keeps auto-open at one synthetic copy per gesture.
      //
      // Only a fresh entry qualifies: a stale one belongs to an earlier gesture, and opening the
      // menu on text the user has since replaced would be worse than a second capture.
      const primed = overlay.freshSelection?.() || ''
      const text = primed || captureSelection()
      if (!text || selectionProblem(text) || alreadyDismissed(text)) { hideAll(); return }
      stats.captured++
      stats.lastCapture = text.slice(0, 120)
      generation++
      lastResult = ''
      lastSources = []
      // The paste-triggered path shares the system-wide limitation: the text came from the
      // clipboard, so there is no rectangle to anchor to. The pointer stands in.
      const anchor = { left: pt.x, top: pt.y, right: pt.x, bottom: pt.y }
      pending = { text, anchor }
      overlay.showMenu({ anchor, actions: ACTIONS })
    }, CAPTURE_DELAY_MS)
  }

  function hideAll() {
    generation++
    pending = null
    overlay.hide()
  }

  /**
   * The user closed the popup themselves, so the selection underneath must not reopen it.
   *
   * Distinct from {@link hideAll}: that one also runs when an action finishes and the panel goes
   * away on its own, and remembering the text there would stop the very next auto-open on the same
   * selection — the user would pick text, watch the answer render, close it, and then find the menu
   * refusing to come back.
   */
  function dismiss() {
    if (pending) dismissed = pending.text
    hideAll()
  }

  // --- actions -------------------------------------------------------------------------------

  function copyResult() {
    const text = overlay.visible && overlay.mode === 'panel' ? lastResult : pending?.text
    if (text) writeClipboardText(text)
  }

  async function openUrl(ctx, url) {
    try {
      await ctx.get('shell')?.openExternal?.(url)
    } catch {
      // No shell service: fall back to the OS handler through a child process, which is what the
      // client would have done anyway.
      const { spawn } = await import('node:child_process')
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    }
  }

  /**
   * The provider and model an action runs on, or null when none can be determined.
   *
   * A provider alone is not enough: `llm.stream` needs a concrete model id, and the provider
   * list carries names rather than models, so the catalog is asked for one. Returning
   * `{ provider, model: '' }` — which this used to do — made every action report "no model
   * selected" even though a usable default existed, which reads to the user as a dead button.
   */
  async function resolveModel() {
    const llm = ctx.get('llm')
    if (settings.model) return { provider: settings.modelProvider || settings.provider, model: settings.model }
    const agentDefault = ctx.get('agentDefaultModel')
    const current = agentDefault && typeof agentDefault.currentSelection === 'function'
      ? agentDefault.currentSelection()
      : null
    if (current && current.provider && current.model) return current
    if (!llm || typeof llm.listProviders !== 'function') return null
    return pickModel(llm.listProviders(), (provider) =>
      typeof llm.listModels === 'function' ? llm.listModels(provider) : [])
  }

  async function runAction(actionId, anchor) {
    const action = findAction(actionId)
    if (!action || !pending) return
    const { text } = pending
    // `anchor` arrives from the menu's click handler as `{x, y}`; the stored one is the selection
    // rect. Normalising here keeps the four call sites below on one shape.
    const at = saneRect(anchor) ?? pending.anchor

    if (action.kind === 'local') {
      writeClipboardText(text)
      hideAll()
      return
    }
    if (actionId === 'search') return runSearch(text, at)
    return runModel(action, text, at)
  }

  /** One assistant turn over `ctx.llm`, streaming into the panel. */
  async function runModel(action, text, at) {
    const llm = ctx.get('llm')
    const picked = await resolveModel()
    if (!llm || typeof llm.stream !== 'function' || !picked || !picked.model) {
      overlay.showPanel({ anchor: at, title: action.label, status: '' })
      overlay.setStatus(!llm ? 'LLM 服务不可用，请检查模型配置' : '没有可用的模型，请先在设置里选择', 'error')
      return
    }

    const mine = ++generation
    lastResult = ''
    lastSources = []
    overlay.showPanel({ anchor: at, title: `${action.label} · ${preview(text)}`, status: '正在生成…' })

    const request = buildRequest(action.id, text, { targetLanguage: settings.targetLanguage })
    try {
      for await (const chunk of llm.stream({
        provider: picked.provider,
        model: picked.model,
        system: request.system,
        messages: request.messages,
      })) {
        if (mine !== generation) return // superseded by a newer gesture or an explicit close
        if (chunk.type === 'text-delta') {
          lastResult += chunk.text
          overlay.setContent(lastResult, [])
        } else if (chunk.type === 'finish') {
          const reason = chunk.reason
          if (reason && reason.kind === 'error') {
            overlay.setStatus((reason.failure && reason.failure.message) || '模型返回错误', 'error')
            return
          }
          if (reason && reason.kind === 'aborted') return
        }
      }
      if (mine !== generation) return
      overlay.setStatus(`${picked.provider} / ${picked.model}`, 'info')
    } catch (error) {
      if (mine !== generation) return
      overlay.setStatus(String(error && error.message ? error.message : error), 'error')
    }
  }

  /**
   * AI search: retrieve with `ctx.web.search`, then answer over the retrieved pages.
   *
   * The answer is written by the model rather than pasted from the provider so it reads as an
   * explanation of the selection; the sources are listed separately and stay clickable.
   */
  async function runSearch(text, at) {
    const web = ctx.get('web')
    const mine = ++generation
    lastResult = ''
    lastSources = []
    overlay.showPanel({ anchor: at, title: `AI 搜索 · ${preview(text)}`, status: '正在搜索…' })
    stats.searches++

    if (!web || typeof web.search !== 'function') {
      overlay.setStatus('联网搜索服务不可用（未启用网页搜索插件）', 'error')
      return
    }

    let result
    try {
      result = await web.search({ query: searchQuery(text), maxResults: settings.maxResults || 6 })
    } catch (error) {
      if (mine !== generation) return
      overlay.setStatus(`搜索失败：${error && error.message ? error.message : error}`, 'error')
      return
    }
    if (mine !== generation) return

    lastSources = Array.isArray(result && result.sources) ? result.sources : []
    if (lastSources.length === 0) {
      overlay.setStatus('没有检索到结果', 'error')
      return
    }

    const llm = ctx.get('llm')
    const picked = await resolveModel()
    if (!llm || typeof llm.stream !== 'function' || !picked || !picked.model) {
      // No model: the provider's own summary is still worth showing, with its sources.
      const fallback = (result.content || '').trim()
      lastResult = fallback || `检索到 ${lastSources.length} 条来源`
      overlay.setContent(lastResult, lastSources)
      overlay.setStatus(fallback ? '搜索服务摘要（未配置模型，无 AI 总结）' : '检索到来源（未配置模型，无 AI 总结）', 'info')
      return
    }

    overlay.setStatus(`检索到 ${lastSources.length} 条来源，正在总结…`, 'info')
    const request = buildSearchRequest(text, lastSources, { targetLanguage: settings.targetLanguage })
    try {
      for await (const chunk of llm.stream({
        provider: picked.provider,
        model: picked.model,
        system: request.system,
        messages: request.messages,
      })) {
        if (mine !== generation) return
        if (chunk.type === 'text-delta') {
          lastResult += chunk.text
          overlay.setContent(lastResult, lastSources)
        } else if (chunk.type === 'finish') {
          const reason = chunk.reason
          if (reason && reason.kind === 'error') {
            const message = (reason.failure && reason.failure.message) || '模型返回错误'
            // Keep whatever sources were retrieved: they are still the useful half of the answer.
            overlay.setContent(lastResult || '（总结失败）', lastSources)
            overlay.setStatus(message, 'error')
            return
          }
          if (reason && reason.kind === 'aborted') return
        }
      }
      if (mine !== generation) return
      overlay.setStatus(`${picked.provider} / ${picked.model} · ${lastSources.length} 条来源`, 'info')
    } catch (error) {
      if (mine !== generation) return
      overlay.setContent(lastResult || '（总结失败）', lastSources)
      overlay.setStatus(String(error && error.message ? error.message : error), 'error')
    }
  }

  // --- lifecycle -----------------------------------------------------------------------------

  function start() {
    overlay.installHook()
    if (pollTimer) return
    // The poll only serves the optional drag-trigger mode; the hook does the real work. It runs
    // anyway so the pump keeps servicing the hook's message queue.
    pollTimer = setInterval(tick, POLL_MS)
    if (pollTimer.unref) pollTimer.unref()
  }
  function stop() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    mouse = null
  }

  if (enabled) start()
  ctx.effect(() => () => {
    stop()
    if (captureTimer) clearTimeout(captureTimer)
    overlay.destroy()
  }, 'system-selection.lifecycle')

  /** Persist on every change: the settings page has no save button to forget to press. */
  function persist() {
    saveSettings({ enabled, settings })
  }

  registerRoute(ctx, {
    status: () => ({
      supported: true,
      enabled,
      settings,
      actions: ACTIONS.map((a) => ({ id: a.id, label: a.label })),
      platform: process.platform,
      maxChars: MAX_TEXT_CHARS,
      hookActive: overlay.hookActive,
      stats: { ...stats },
      overlayVisible: overlay.visible,
      overlayRect: overlay.rect(),
    }),
    setEnabled: (value) => {
      enabled = Boolean(value)
      if (enabled) start()
      else { stop(); hideAll() }
      persist()
      return { ok: true, enabled }
    },
    setSettings: (patch) => {
      if (patch && typeof patch === 'object') {
        for (const key of ['targetLanguage', 'provider', 'model', 'modelProvider']) {
          if (typeof patch[key] === 'string') settings[key] = patch[key]
        }
        if (typeof patch.openOnSelect === 'boolean') settings.openOnSelect = patch.openOnSelect
        if (Number.isFinite(patch.maxResults)) settings.maxResults = Math.max(1, Math.min(10, patch.maxResults))
      }
      persist()
      return { ok: true, settings }
    },
    models: async () => listModels(ctx),
    /** Called by the client half when the user right-clicks a selection inside DSH. */
    openInApp,
    /** Report whether the retrieval half is usable, so the settings page can say so up front. */
    capability: async () => {
      const web = ctx.get('web')
      return {
        search: Boolean(web && typeof web.search === 'function'),
        searchReady: typeof web?.searchReady === 'function' ? Boolean(web.searchReady()) : null,
        model: (await resolveModel()) !== null,
      }
    },
    /** Trigger the menu for the current selection. Used by tests and the settings page. */
    probe: () => {
      const pt = overlay.cursor()
      const text = overlay.readSelection() || ''
      return {
        wouldOpen: Boolean(text) && !selectionProblem(text),
        text: text.slice(0, 120),
        cached: overlay.cachedSelection().slice(0, 120),
        hookActive: overlay.hookActive,
      }
    },
    /**
     * Run one action against a given text, without going through a real click.
     *
     * This exists because the action path is otherwise only reachable by synthesizing a click on
     * the native menu, which no test can do without seizing the machine's mouse. It also gives the
     * settings page something to offer when a user reports that one action fails.
     */
    runActionWith: async (args) => {
      const actionId = String((args && args.actionId) || '')
      const text = String((args && args.text) || '')
      if (!findAction(actionId)) throw new Error(`unknown action: ${actionId}`)
      const problem = selectionProblem(text)
      if (problem) throw new Error(problem)
      const at = overlay.cursor()
      pending = { text, anchor: at }
      await runAction(actionId, at)
      return { started: true, actionId, panel: overlay.visible, mode: overlay.mode }
    },
    clipboard: () => ({ text: readClipboardText() ?? '' }),
    /**
     * Close the popup the way the user does — the same entry point the window's own close paths
     * call. Exists for the same reason as `runActionWith`: the real gesture needs a synthesized
     * click on the native popup, which no test can do.
     */
    dismiss: () => { dismiss(); return { visible: overlay.visible } },
  })
}

/** First line of the selection, short enough for a title bar. */
function preview(text) {
  const line = text.trim().split('\n')[0]
  return line.length > 24 ? `${line.slice(0, 24)}…` : line
}

/**
 * Register the settings/health endpoint.
 *
 * Uses `ctx.inject` rather than `ctx.get`: the web server binds its port during its own init, so
 * a plain `get` at apply time can return undefined and leave the settings page permanently dead.
 */
function registerRoute(ctx, ops) {
  ctx.inject(['webServer'], (owner) => {
    owner.effect(() => owner.webServer.register({
      kind: 'exact',
      path: '/api/system-selection/rpc',
      handler: async (req, res) => {
        let payload
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const text = Buffer.concat(chunks).toString('utf8')
          const body = text ? JSON.parse(text) : {}
          const op = String(body.op || '')
          if (!(op in ops)) throw new Error(`unknown op: ${op}`)
          payload = { ok: true, ...(await ops[op](body.value ?? body)) }
        } catch (error) {
          payload = { ok: false, error: String(error && error.message ? error.message : error) }
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(payload))
      },
    }), 'system-selection.route')
  })
}

/** The models this deployment already has configured, so the picker offers real choices. */
async function listModels(ctx) {
  const llm = ctx.get('llm')
  const groups = []
  if (llm && typeof llm.listProviders === 'function') {
    for (const provider of llm.listProviders()) {
      try {
        const models = await llm.listModels(provider.id)
        if (models.length > 0) {
          groups.push({
            id: provider.id,
            name: provider.name || provider.id,
            models: models.map((m) => ({ id: m.id, name: m.name || m.id })),
          })
        }
      } catch {
        // A provider that cannot enumerate models is simply not offered.
      }
    }
  }
  const agentDefault = ctx.get('agentDefaultModel')
  const current = agentDefault && typeof agentDefault.currentSelection === 'function'
    ? agentDefault.currentSelection()
    : null
  return { groups, default: current }
}
