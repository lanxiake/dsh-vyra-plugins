// System-wide selection assistant for the DSH desktop client.
//
// Right-click a selection in any application and a native menu appears next to it: translate,
// copy, explain, summarize. The reading half never touches the DSH window; only an explicitly
// chosen action reaches the network.
//
// The popup is a Win32 window painted with GDI, and the native context menu is suppressed by a
// low-level mouse hook (see native.js for why). This file owns the trigger policy, the actions,
// and the small HTTP surface the settings page uses.
import { readFileSync } from 'node:fs'

import {
  ACTIONS, MAX_TEXT_CHARS, buildFollowUpRequest, buildRequest, explainAuthFailure, findAction, pickModel,
  reduceMouse, saneRect, selectionProblem, splitSuggestions,
} from './core.js'
import { CAPTURE_DELAY_MS, POLL_MS, captureSelection, createOverlay, readClipboardText, setWarnSink, writeClipboardText } from './native.js'
import { loadSettings, saveLastRun, saveSettings } from './store.js'

/** The version this Host actually loaded, not the one on disk: a stale process is otherwise invisible. */
let VERSION = ''
try {
  VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
} catch {
  // A package.json that cannot be read is not worth failing the plugin over.
}

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
  /**
   * What the last action did.
   *
   * The user reports "点了没有反应" and cannot see this process's log, so every action leaves a
   * record: the chunk types the model actually emitted, the finish reason, and the error that
   * ended it. `status` exposes it and it is written to `storages/system-selection/last-run.json`.
   */
  let lastRun = null
  function recordRun(entry) {
    lastRun = { at: new Date().toISOString(), version: VERSION, ...entry }
    saveLastRun(lastRun)
  }

  /** Show a model-call failure, in the panel body when it is one the user has to go fix. */
  function showModelFailure(error) {
    const message = describe(error)
    const hint = explainAuthFailure(message)
    if (hint) {
      overlay.setContent(hint.body)
      overlay.setStatus(hint.short, 'error')
    } else {
      overlay.setStatus(message, 'error')
    }
    return message
  }
  /** The selection whose menu the user closed, so the poll does not reopen it. See `alreadyDismissed`. */
  let dismissed = ''
  const overlay = createOverlay({
    onAction: (id, anchor) => runAction(id, anchor),
    onDismiss: () => dismiss(),
    onPanelClose: () => dismiss(),
    onPanelCopy: () => {
      // Say what actually happened: a copy that failed because another program is holding the
      // clipboard used to report success, so a dead button looked the same as a working one.
      const ok = copyResult()
      overlay.setStatus(ok ? '已复制到剪贴板' : '复制失败：剪贴板正被其他程序占用', ok ? 'info' : 'error')
    },
    /**
     * A mouse selection was released. The window never takes focus, so there is no Ctrl+C to
     * press: the drag itself completes the copy, and the footer says what was copied.
     */
    onPanelSelection: (text) => {
      const ok = writeClipboardText(text) === true
      overlay.setStatus(ok ? `已复制选中的 ${text.length} 字` : '复制失败：剪贴板正被其他程序占用', ok ? 'info' : 'error')
    },
    /** The refresh icon: ask the same question again. */
    onPanelRegenerate: () => regenerate(),
    /** A suggestion chip or the input box. */
    onPanelFollowUp: (question) => { void runFollowUp(question) },
    /** The translation card's target pill; changing it re-translates immediately. */
    onTargetLanguage: (language) => {
      if (typeof language !== 'string' || language === settings.targetLanguage) return
      settings.targetLanguage = language
      persist()
      if (lastRequest && lastRequest.action && lastRequest.action.id === 'translate') {
        void runModel(lastRequest.action, lastRequest.text, lastRequest.at)
      }
    },
    onRightClick: (pt, cached) => onRightClick(pt, cached),
    // ponytail: 新增事件驱动回调，替代轮询 tick() — 只在钩子检测到拖动释放时才触发。
    onDragRelease: (pt) => {
      if (!enabled || !settings.openOnSelect) return
      // 与原 tick() 的逻辑保持一致：窗口可见时不捕获，DSH 窗口内不捕获。
      if (overlay.visible || overlay.windowUnderPoint?.(pt)) return
      stats.gestures++
      scheduleCapture(pt)
    },
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
  // A migrated profile must not keep the old file: without writing it back, the next start
  // reads `true` again and reinstalls the hook that made remote sessions sticky.
  if (stored.migrated) saveSettings({ enabled, settings })
  let pending = null // { text, anchor }
  let generation = 0
  let captureTimer = null
  // Drag detection when no hook is installed: the poll watches left-button transitions and
  // carries its own state machine. With the hook installed this stays null and unused.
  let pollTimer = null
  let mouse = null
  const stats = { rightClicks: 0, gestures: 0, captured: 0, empty: 0, inApp: 0, lastCapture: '' }

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
    pending = { text: core, anchor, pointer: at }
    overlay.showMenu({ anchor, actions: ACTIONS })
    return { shown: true, at }
  }

  /**
   * Poll fallback for the drag trigger, used only when the right-click hook is not installed.
   *
   * The hook sees every button release already, so running both would duplicate the detection.
   * Without a hook nothing else watches the left button, and polling two FFI calls at 30 ms does
   * not sit in the system's input path — unlike the hook, it cannot make the desktop feel slow.
   */
  function tick() {
    if (!enabled || !settings.openOnSelect) return
    const pt = overlay.cursor()
    if (overlay.visible && overlay.containsPoint(pt)) {
      mouse = null
      return
    }
    const down = overlay.leftButtonDown()
    const { state, fire } = reduceMouse(mouse, { down, x: pt.x, y: pt.y, t: Date.now() })
    mouse = state
    // The unmodified drag is the auto-open gesture; the modifier check keeps a scroll-like swipe
    // from opening the menu. Over the DSH window the page reports its own selection.
    if (fire && !overlay.modifierHeld?.() && !overlay.windowUnderPoint?.(pt)) {
      stats.gestures++
      scheduleCapture(pt)
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

  /** Copy what the panel shows (or, from the menu, the selected text). @returns whether it landed. */
  function copyResult() {
    // The follow-up suggestions are chrome, not part of the answer: copying them would paste
    // questions into whatever the user is writing.
    const text = overlay.visible && overlay.mode === 'panel' ? splitSuggestions(lastResult).answer : pending?.text
    if (!text) return false
    return writeClipboardText(text) === true
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
    // A rejection here used to escape as an unhandled promise: no panel, no message, nothing —
    // which is exactly the "点了没有反应" the user reported. Whatever breaks, the panel opens and
    // says so.
    try {
      await runModel(action, text, at)
    } catch (error) {
      const message = describe(error)
      overlay.showPanel({ anchor: at, title: action.label, status: '' })
      overlay.setStatus(message, 'error')
      recordRun({ action: actionId, error: message })
    }
  }

  /**
   * Read one model stream into text.
   *
   * Text can arrive three ways: as `text-delta` chunks, as a whole `block-end` block, or not at
   * all (the model spent everything on reasoning). Ignoring `block-end` — which this did — turns
   * every adapter that assembles before emitting into a permanently blank panel.
   *
   * @returns what the stream actually produced, so the caller can report an empty answer instead
   *   of painting nothing.
   */
  async function readStream(llm, picked, request, mine, onText) {
    const parts = new Map()
    const counts = { text: 0, reasoning: 0, other: 0 }
    let reasoning = ''
    let finish = null
    const render = () => [...parts.entries()].sort((a, b) => a[0] - b[0]).map(([, part]) => part).join('')

    for await (const chunk of llm.stream({
      provider: picked.provider,
      model: picked.model,
      system: request.system,
      messages: request.messages,
    })) {
      if (mine !== generation) return { superseded: true }
      if (chunk.type === 'text-delta') {
        counts.text++
        parts.set(chunk.index, (parts.get(chunk.index) || '') + chunk.text)
        onText(render())
      } else if (chunk.type === 'reasoning-delta') {
        counts.reasoning++
        reasoning += chunk.text
      } else if (chunk.type === 'block-end') {
        if (chunk.block && chunk.block.type === 'text' && !parts.has(chunk.index)) {
          parts.set(chunk.index, chunk.block.text || '')
          onText(render())
        }
      } else if (chunk.type === 'finish') {
        finish = chunk.reason
      } else {
        counts.other++
      }
    }
    return { text: render(), reasoning, finish, counts }
  }

  /** One assistant turn over `ctx.llm`, streaming into the panel. */
  /** What the card is currently about, so 重新生成 and the chips can re-ask or continue it. */
  let lastRequest = null

  async function runModel(action, text, at) {
    await runTurn({
      action,
      text,
      at,
      title: `${action.label} · ${preview(text)}`,
      question: null,
      request: () => buildRequest(action.id, text, { targetLanguage: settings.targetLanguage }),
    })
  }

  /** A chip or the input box asked something about the answer already on screen. */
  async function runFollowUp(question) {
    if (!lastRequest) return
    const base = lastRequest
    const previous = lastResult
    await runTurn({
      action: base.action,
      text: base.text,
      at: base.at,
      title: `追问 · ${preview(question)}`,
      question,
      request: () => buildFollowUpRequest(base.text, previous, question, { targetLanguage: settings.targetLanguage }),
    })
  }

  /** Re-run whatever the card is showing. */
  function regenerate() {
    if (!lastRequest) return
    if (lastRequest.question) void runFollowUp(lastRequest.question)
    else void runModel(lastRequest.action, lastRequest.text, lastRequest.at)
  }

  async function runTurn({ action, text, at, title, question, request }) {
    const llm = ctx.get('llm')
    let picked = null
    try {
      picked = await resolveModel()
    } catch (error) {
      // Enumeration can throw (an adapter's catalog fetch); without this the action dies
      // silently before the panel exists.
      const message = `无法选择模型：${describe(error)}`
      overlay.showPanel({ anchor: at, title: action.label, status: '', action, source: text, targetLanguage: settings.targetLanguage })
      overlay.setStatus(message, 'error')
      recordRun({ action: action.id, error: message })
      return
    }
    if (!llm || typeof llm.stream !== 'function' || !picked || !picked.model) {
      const message = !llm ? 'LLM 服务不可用，请检查模型配置' : '没有可用的模型，请先在设置里选择'
      overlay.showPanel({ anchor: at, title: action.label, status: '', action, source: text, targetLanguage: settings.targetLanguage })
      overlay.setStatus(message, 'error')
      recordRun({ action: action.id, error: message })
      return
    }

    const mine = ++generation
    lastResult = ''
    lastRequest = { action, text, at, question }
    overlay.showPanel({
      anchor: at,
      title,
      status: '正在生成…',
      action,
      // The card quotes the selection it is about, so a follow-up still shows its subject.
      source: text,
      targetLanguage: settings.targetLanguage,
    })

    const startedAt = Date.now()
    const built = request()
    try {
      const seen = await readStream(llm, picked, built, mine, (answer) => {
        lastResult = answer
        overlay.setContent(lastResult)
      })
      if (seen.superseded) return
      const base = { action: action.id, provider: picked.provider, model: picked.model, counts: seen.counts, ms: Date.now() - startedAt }
      const reason = seen.finish
      if (reason && reason.kind === 'error') {
        const message = showModelFailure((reason.failure && reason.failure.message) || '模型返回错误')
        recordRun({ ...base, finish: 'error', error: message })
        return
      }
      if (reason && reason.kind === 'aborted') {
        recordRun({ ...base, finish: 'aborted' })
        return
      }
      lastResult = seen.text
      if (!lastResult.trim()) {
        // An empty body is not "no response" — say what the model actually sent.
        const message = seen.reasoning.trim()
          ? `模型只返回了思考过程（${seen.reasoning.length} 字），没有正文`
          : '模型没有返回任何内容'
        if (seen.reasoning.trim()) lastResult = seen.reasoning
        overlay.setContent(lastResult)
        overlay.setStatus(message, 'error')
        recordRun({ ...base, finish: reason && reason.kind, reasoning: seen.reasoning.slice(0, 4000), error: message })
        return
      }
      overlay.setStatus(`${picked.provider} / ${picked.model}`, 'info')
      recordRun({ ...base, finish: reason && reason.kind, answer: lastResult.slice(0, 4000) })
    } catch (error) {
      if (mine !== generation) return
      const message = showModelFailure(error)
      recordRun({ action: action.id, provider: picked.provider, model: picked.model, ms: Date.now() - startedAt, error: message })
    }
  }


  // --- lifecycle -----------------------------------------------------------------------------

  function start() {
    // The right-click takeover is opt-in. A WH_MOUSE_LL hook puts this process in the system's
    // input path: every mouse event machine-wide waits for the Host's message pump, which on a
    // remote-desktop session reads as a sticky pointer. It is worth that cost only when someone
    // explicitly asked for our right-click menu.
    const hooked = settings.interceptRightClick === true
    if (hooked) overlay.installHook()
    else overlay.uninstallHook()
    // Auto-open needs one of the two watchers: the hook when it is installed, a light poll when
    // it is not. The poll is not in the input path, so it costs no input latency.
    if (!hooked && settings.openOnSelect) {
      if (!pollTimer) {
        pollTimer = setInterval(tick, POLL_MS)
        if (pollTimer.unref) pollTimer.unref()
      }
    } else if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }
  function stop() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    mouse = null
    overlay.uninstallHook()
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
      version: VERSION,
      enabled,
      settings,
      actions: ACTIONS.map((a) => ({ id: a.id, label: a.label })),
      platform: process.platform,
      maxChars: MAX_TEXT_CHARS,
      hookActive: overlay.hookActive,
      stats: { ...stats },
      lastRun,
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
        if (typeof patch.interceptRightClick === 'boolean') {
          settings.interceptRightClick = patch.interceptRightClick
          // A deliberate choice survives the one-time migration in `loadSettings`.
          settings.rightClickExplicit = true
        }
      }
      persist()
      // Apply the takeover change now rather than at the next start.
      if (enabled) start()
      return { ok: true, settings }
    },
    models: async () => listModels(ctx),
    /** Called by the client half when the user right-clicks a selection inside DSH. */
    openInApp,
    /** Report whether a model is usable, so the settings page can say so up front. */
    capability: async () => ({ model: (await resolveModel()) !== null }),
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
      // A point, not a rectangle: this path has no selection to anchor to, and a rect with
      // undefined edges used to place the panel at NaN — which Windows rounds to (0,0).
      const pt = overlay.cursor()
      const at = { left: pt.x, top: pt.y, right: pt.x, bottom: pt.y }
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

/** One line of text for an error, whatever shape the throwable has. */
function describe(error) {
  if (error && error.message) return String(error.message)
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
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
