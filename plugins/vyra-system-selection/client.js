// Client half of vyra-system-selection: the settings page.
//
// The feature itself lives entirely in the Host process — it reads other applications, which a
// browser page cannot do. This half only configures it and reports whether it is alive.
window.__ModuleLoader__.load({
  id: 'vyra-system-selection',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useState } = React
    const h = React.createElement

    const RPC = '/api/system-selection/rpc'

    async function call(op, value) {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(value === undefined ? { op } : { op, value }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || '请求失败')
      return data
    }

    // The token names here are DSH's real aliases (`--dsw-alias-*`), not the `--dsw-color-*` ones
    // this file used first: those do not exist anywhere in the client, so every fallback below was
    // what actually rendered — a dark palette on a light theme, and a select whose popup list the
    // browser painted in the UA's light colours because nothing set `color-scheme` on it.
    //
    // The select is styled the way the platform styles its own (`ui-primitives/ConfigField`):
    // layer-3 fill, border-l4 stroke, label-primary text. A bare `<option>` list cannot be styled
    // from CSS, so the select carries `colorScheme: 'inherit'` and inherits the root's scheme —
    // DSH sets it on `documentElement` from the active theme — which is what makes the popup match
    // the app instead of the OS default.
    const S = {
      wrap: { padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '18px' },
      card: { border: '1px solid var(--dsw-alias-border-l4, #d0d0d0)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
      label: { fontSize: '14px', fontWeight: 500 },
      hint: { fontSize: '12px', opacity: 0.6, lineHeight: 1.6, marginTop: '4px' },
      select: {
        minWidth: '220px', padding: '6px 8px', borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid var(--dsw-alias-border-l4, #d0d0d0)',
        background: 'var(--dsw-alias-bg-layer-3, #fff)',
        color: 'var(--dsw-alias-label-primary, #1a1a1a)',
        colorScheme: 'inherit', fontSize: '13px',
      },
      badge: (ok, warn) => ({
        fontSize: '12px', padding: '2px 8px', borderRadius: '99px',
        background: ok ? 'color-mix(in srgb, var(--dsw-alias-state-success-primary, #2f9e44) 15%, transparent)'
          : warn ? 'color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e8a33d) 15%, transparent)'
            : 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #d1242f) 15%, transparent)',
        color: ok ? 'var(--dsw-alias-state-success-primary, #2f9e44)'
          : warn ? 'var(--dsw-alias-state-warn-primary, #e8a33d)'
            : 'var(--dsw-alias-state-error-primary, #d1242f)',
      }),
      btn: { padding: '7px 14px', borderRadius: 'var(--dsw-radius-sm, 8px)', border: '1px solid var(--dsw-alias-border-l4, #d0d0d0)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '13px' },
      toggle: (on) => ({ width: '42px', height: '24px', borderRadius: '99px', border: 'none', cursor: 'pointer', background: on ? 'var(--dsw-alias-brand-primary, #4d9aff)' : 'color-mix(in srgb, currentColor 35%, transparent)', position: 'relative', flex: '0 0 auto' }),
      knob: (on) => ({ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left .15s' }),
    }

    function Toggle({ on, onChange, label }) {
      return h('button', {
        type: 'button', style: S.toggle(on), onClick: () => onChange(!on),
        role: 'switch', 'aria-checked': on, 'aria-label': label,
      }, h('span', { style: S.knob(on) }))
    }

    function SettingsBody() {
      const [state, setState] = useState(null)
      const [models, setModels] = useState({ groups: [], default: null })
      const [capability, setCapability] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)

      const load = useCallback(async () => {
        try {
          setState(await call('status'))
          setModels(await call('models'))
          setCapability(await call('capability'))
        } catch (e) {
          setError(String(e.message || e))
        }
      }, [])

      useEffect(() => { load() }, [load])

      const settings = state?.settings || {}

      const patch = useCallback(async (next) => {
        setBusy(true)
        try {
          const res = await call('setSettings', next)
          setState((s) => (s ? { ...s, settings: res.settings } : s))
        } catch (e) {
          setError(String(e.message || e))
        } finally {
          setBusy(false)
        }
      }, [])

      const toggleEnabled = useCallback(async (value) => {
        try {
          await call('setEnabled', value)
          setState((s) => (s ? { ...s, enabled: value } : s))
        } catch (e) {
          setError(String(e.message || e))
        }
      }, [])

      if (error && !state) {
        return h('div', { style: S.wrap }, h('div', { style: S.hint }, `无法读取插件状态：${error}`))
      }
      if (!state) return h('div', { style: S.hint }, '正在读取状态…')

      if (!state.supported) {
        return h('div', { style: S.wrap }, h('div', { style: S.card },
          h('div', { style: S.label }, '当前平台不支持'),
          h('div', { style: S.hint }, '系统级划词依赖 Win32 原生接口与鼠标钩子，目前只在 Windows 桌面端可用。')))
      }

      const d = models.default
      const defaultLabel = d && d.model ? `跟随 DSH 默认（${d.provider} / ${d.model}）` : '跟随 DSH 默认'
      const stats = state.stats || {}

      return h('div', { style: S.wrap },
        h('div', { style: S.card },
          h('div', { style: S.row },
            h('div', null,
              h('div', { style: S.label }, '启用系统级划词'),
              h('div', { style: S.hint }, '在任意应用里选中文字后点右键，弹出 AI 搜索、翻译、总结、解释、复制。'),
            ),
            h(Toggle, { on: state.enabled, onChange: toggleEnabled, label: '启用系统级划词' })),
          h('div', { style: S.row },
            h('div', { style: S.label }, '右键拦截'),
            h('span', { style: S.badge(state.hookActive, !state.hookActive) },
              state.hookActive ? '已接管' : '未生效')),
          state.hookActive ? null : h('div', { style: S.hint },
            '鼠标钩子没装上，右键仍会弹出应用自带的菜单。通常是安全软件拦截了全局钩子。'),
          h('div', { style: S.row },
            h('div', { style: S.label }, '运行状态'),
            h('span', { style: S.badge(state.enabled) },
              `已捕获 ${stats.captured || 0} 次 · AI 搜索 ${stats.searches || 0} 次`))),

        h('div', { style: S.card },
          h('div', { style: S.row },
            h('div', null,
              h('div', { style: S.label }, '划选后也自动弹出'),
              h('div', { style: S.hint }, '开启后，拖动选中文字并松手就会弹出菜单，不必再点右键。'),
            ),
            h(Toggle, { on: Boolean(settings.openOnSelect), onChange: (v) => patch({ openOnSelect: v }), label: '划选后自动弹出' }))),

        h('div', { style: S.card },
          h('div', { style: S.row },
            h('div', { style: S.label }, 'AI 搜索'),
            h('span', { style: S.badge(Boolean(capability?.search), !capability?.search) },
              capability?.search ? (capability.searchReady === false ? '服务未就绪' : '可用') : '不可用')),
          capability?.search ? null : h('div', { style: S.hint },
            '联网搜索不可用，需要在「插件」页启用网页搜索。其余四个动作不受影响。'),
          h('div', { style: S.row },
            h('div', null,
              h('div', { style: S.label }, '检索来源条数'),
              h('div', { style: S.hint }, 'AI 搜索会先检索这些条数的网页，再据此作答。'),
            ),
            h('select', {
              style: S.select, disabled: busy,
              value: String(settings.maxResults || 6),
              onChange: (e) => patch({ maxResults: Number(e.target.value) }),
            }, [3, 5, 6, 8, 10].map((n) => h('option', { key: n, value: String(n) }, `${n} 条`))))),

        h('div', { style: S.card },
          h('div', null,
            h('div', { style: S.label }, '翻译目标语言'),
            h('div', { style: S.hint }, '只影响「翻译」动作。')),
          h('select', {
            style: S.select, value: settings.targetLanguage || '简体中文', disabled: busy,
            onChange: (e) => patch({ targetLanguage: e.target.value }),
          }, ['简体中文', '繁體中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español', 'Русский']
            .map((lang) => h('option', { key: lang, value: lang }, lang)))),

        h('div', { style: S.card },
          h('div', null,
            h('div', { style: S.label }, '回答使用的模型'),
            h('div', { style: S.hint }, '五个动作里除「复制」外都走这一个模型。列表来自本机已配置的提供方。')),
          h('select', {
            style: S.select, disabled: busy,
            value: settings.model ? `${settings.modelProvider || settings.provider}::${settings.model}` : '',
            onChange: (e) => {
              const v = e.target.value
              if (!v) return patch({ model: '', modelProvider: '', provider: '' })
              const [provider, model] = v.split('::')
              patch({ model, modelProvider: provider, provider })
            },
          },
          [h('option', { key: '', value: '' }, defaultLabel)].concat(
            models.groups.flatMap((group) => group.models.map((m) =>
              h('option', { key: `${group.id}::${m.id}`, value: `${group.id}::${m.id}` }, `${group.name} / ${m.name}`)))))),
        error ? h('div', { style: { ...S.hint, color: '#ff7b72' } }, error) : null)
    }

    function Icon() {
      // A selection bracket with a caret: reads at 16px and needs no asset.
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M3 2h3M3 2v3M13 2h-3M13 2v3M3 14h3M3 14v-3M13 14h-3M13 14v-3',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
        }),
        h('path', { d: 'M6.5 8h5M10 6l2 2-2 2', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function Page() {
      return h('div', { 'data-system-selection-ui': '', style: { padding: '8px 4px', maxWidth: '640px' } },
        h('h2', { style: { fontSize: '18px', fontWeight: 600, margin: '0 0 6px' } }, '系统级划词'),
        h('p', { style: { ...S.hint, marginBottom: '20px' } },
          '在任意应用里选中文字后点右键，弹出 AI 搜索、翻译、总结、解释、复制。DSH 窗口内同样可用。'),
        h(SettingsBody))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const disposers = []
        const track = (fn) => { const d = fn(); if (typeof d === 'function') disposers.push(d) }

        track(() => ctx.slots.inject('settings.section', () => ctx.slots.register(
          // `label` is the navigation entry's text: without it the settings list shows a blank row.
          // Kept short because it sits in a narrow sidebar; the page's own heading is longer.
          { name: 'settings.section', id: 'system-selection', order: 40, label: '划词助手' },
          Page)))

        track(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register(
          { name: 'settings.section.icon', id: 'system-selection' },
          Icon)))

        track(() => installInAppSelection())

        return () => { for (const d of disposers) d() }
      },
      __internal: { SettingsBody, RPC, selectionFromDom },
    }
  },
})

/**
 * Read the current in-page selection as plain text, or '' when there is nothing usable.
 *
 * Excludes selections inside editable controls: right-clicking a text field or the composer is
 * the user asking for cut/copy/paste, not for an AI action, and it is the one place the browser's
 * own menu is genuinely more useful.
 */
function selectionFromDom(win, doc) {
  const selection = win.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return ''
  const text = selection.toString().trim()
  if (!text) return ''

  const node = selection.anchorNode
  const element = node && (node.nodeType === 1 ? node : node.parentElement)
  // `parentElement` is null for a detached node and for the document itself, neither of which has
  // `closest`; checking the method rather than the node covers both.
  if (element && typeof element.closest === 'function' &&
      element.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) return ''
  return text
}

/**
 * Take over right-clicks on a selection inside the DSH window.
 *
 * The page already knows the selection and the screen coordinates, so nothing is captured from
 * the clipboard here — the gesture is handed to the Host, which shows the same menu the system
 * path shows. Capture phase is required: the chat surface stops propagation on its own handlers.
 *
 * A right-click with no selection is deliberately left alone, so the browser's menu still works
 * for links, inputs and empty space.
 */
/**
 * Take over right-clicks on a selection inside the DSH window.
 *
 * The page already knows the selection and the screen coordinates, so nothing is captured from
 * the clipboard: the gesture is handed to the Host, which shows the same menu the system path
 * shows. Capture phase is required — the chat surface stops propagation on its own handlers.
 *
 * `preventDefault` has to run synchronously (an async decision would come too late to cancel the
 * native menu), so the browser menu is suppressed before the Host has answered. A failed request
 * therefore removes one menu without providing the other — which is why the failure path reports
 * itself on screen instead of failing silently.
 *
 * A right-click with no selection is left alone, so the browser's menu still works for links,
 * inputs and empty space.
 */
function installInAppSelection() {
  const win = window
  const doc = win.document

  const onContextMenu = (event) => {
    // Never fight our own settings page: it has its own text fields.
    const target = event.target
    if (target instanceof Element && target.closest('[data-system-selection-ui]')) return

    const text = selectionFromDom(win, doc)
    if (!text) return // no selection: the browser menu is what the user wants

    // Hold the event open while the Host decides. A synchronous preventDefault here would drop the
    // browser menu even when the request never lands.
    event.preventDefault()
    event.stopPropagation()

    void fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ op: 'openInApp', value: { text, x: event.screenX, y: event.screenY } }),
    }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }).then((data) => {
      if (!data || data.ok !== true || !data.shown) throw new Error((data && data.error) || 'not shown')
      // Opened: the native popup replaces the browser menu, which stays suppressed.
    }).catch((error) => {
      // The Host could not open its menu. The browser menu is already suppressed, so the honest
      // recovery is to tell the user rather than leave them wondering where it went.
      reportInAppFailure(win, error)
    })
  }

  doc.addEventListener('contextmenu', onContextMenu, true)
  return () => doc.removeEventListener('contextmenu', onContextMenu, true)
}

/** Let the user know a right-click was swallowed without a replacement menu appearing. */
function reportInAppFailure(win, error) {
  const doc = win.document
  const note = doc.createElement('div')
  note.setAttribute('data-system-selection-ui', '')
  note.textContent = `划词菜单未能打开：${error && error.message ? error.message : error}`
  Object.assign(note.style, {
    position: 'fixed', left: '50%', bottom: '32px', transform: 'translateX(-50%)',
    zIndex: '2147483647', padding: '8px 14px', borderRadius: '8px',
    background: 'rgba(209,36,47,.95)', color: '#fff', fontSize: '13px',
    fontFamily: 'inherit', pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
  })
  doc.body.appendChild(note)
  win.setTimeout(() => note.remove(), 4000)
}
