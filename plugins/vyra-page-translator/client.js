// Client half of vyra-page-translator: DOM adapter, button, and panel.
const BATCH_SIZE = 80
const CONCURRENCY = 2
const DEBOUNCE_MS = 800

const SCRIPT_TESTS = {
  zh: /\p{Script=Han}/gu,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu,
  ko: /\p{Script=Hangul}/gu,
}

function splitEdges(text) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  return { lead: m[1], core: m[2], trail: m[3] }
}

function isTranslatable(text, target) {
  const core = String(text).trim()
  if (!core || !/\p{L}/u.test(core)) return false
  const re = SCRIPT_TESTS[String(target || '').slice(0, 2)]
  if (re) {
    const letters = core.match(/\p{L}/gu).length
    const own = (core.match(re) || []).length
    if (own / letters >= 0.3) return false
  }
  return true
}

function createEngine(opts) {
  const schedule = opts.schedule || ((fn, ms) => setTimeout(fn, ms))
  const cancelTimer = opts.cancel || ((h) => clearTimeout(h))

  let records = new WeakMap()
  let refs = []
  let cache = new Map()
  let controller = null
  let timer = null
  let pending = new Set()
  let state = { active: false, busy: false, done: 0, total: 0, error: null }

  const emit = () => opts.onState({ ...state })
  const setState = (patch) => {
    state = { ...state, ...patch }
    emit()
  }
  const cacheKey = (s, core) => `${s.provider}|${s.source}|${s.target}|${core}`

  function register(item) {
    let rec = records.get(item.key)
    const cur = item.read()
    if (!rec) {
      rec = { item, original: cur, written: null }
      records.set(item.key, rec)
      refs.push(new WeakRef(item.key))
    } else {
      rec.item = item
      if (cur !== rec.written && cur !== rec.original) {
        rec.original = cur
        rec.written = null
      }
    }
    return rec
  }

  function apply(rec, translatedCore) {
    const { lead, trail } = splitEdges(rec.original)
    rec.written = lead + translatedCore + trail
    rec.item.write(rec.written)
  }

  function revert(rec) {
    if (rec.written !== null) {
      rec.item.write(rec.original)
      rec.written = null
    }
  }

  async function translateRecords(recs, signal) {
    const s = opts.settings()
    const need = new Map()
    let total = 0
    for (const rec of recs) {
      const { core } = splitEdges(rec.original)
      if (!isTranslatable(core, s.target)) {
        revert(rec)
        continue
      }
      total++
      const hit = cache.get(cacheKey(s, core))
      if (hit !== undefined) {
        apply(rec, hit)
      } else {
        if (!need.has(core)) need.set(core, [])
        need.get(core).push(rec)
      }
    }
    const cores = [...need.keys()]
    const batches = []
    for (let i = 0; i < cores.length; i += BATCH_SIZE) batches.push(cores.slice(i, i + BATCH_SIZE))
    const cached = total - [...need.values()].reduce((n, r) => n + r.length, 0)
    setState({ total: state.total + total, done: state.done + cached })

    let next = 0
    async function worker() {
      while (next < batches.length && !signal.aborted) {
        const batch = batches[next++]
        const out = await opts.request(batch, signal)
        if (signal.aborted) return
        if (!Array.isArray(out) || out.length !== batch.length) throw new Error('translation result size mismatch')
        let applied = 0
        batch.forEach((core, i) => {
          cache.set(cacheKey(s, core), out[i])
          for (const rec of need.get(core)) {
            apply(rec, out[i])
            applied++
          }
        })
        setState({ done: state.done + applied })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))
  }

  async function run(recs) {
    if (!controller) controller = new AbortController()
    const signal = controller.signal
    setState({ busy: true, error: null })
    try {
      await translateRecords(recs, signal)
    } catch (e) {
      if (!signal.aborted) setState({ error: String((e && e.message) || e) })
    } finally {
      if (!signal.aborted) setState({ busy: false })
    }
  }

  async function start() {
    if (controller) controller.abort()
    controller = new AbortController()
    state = { active: true, busy: true, done: 0, total: 0, error: null }
    emit()
    const recs = opts.collect().map(register)
    await run(recs)
  }

  function flush() {
    timer = null
    if (!state.active || pending.size === 0) return
    const recs = [...pending].map(register)
    pending = new Set()
    run(recs)
  }

  function notify(items) {
    if (!state.active) return
    const s = opts.settings()
    for (const item of items || opts.collect()) {
      const rec = records.get(item.key)
      const cur = item.read()
      if (rec && cur === rec.written) continue
      if (rec && cur === rec.original) {
        const hit = cache.get(cacheKey(s, splitEdges(cur).core))
        if (hit !== undefined) {
          apply(rec, hit)
          continue
        }
      }
      pending.add(item)
    }
    if (pending.size > 0 && timer === null) timer = schedule(flush, DEBOUNCE_MS)
  }

  function restore() {
    if (controller) controller.abort()
    controller = null
    if (timer !== null) cancelTimer(timer)
    timer = null
    pending = new Set()
    for (const ref of refs) {
      const key = ref.deref()
      const rec = key && records.get(key)
      if (rec) revert(rec)
    }
    records = new WeakMap()
    refs = []
    state = { active: false, busy: false, done: 0, total: 0, error: null }
    emit()
  }

  return { start, restore, retry: start, notify, get state() { return { ...state } } }
}

// DOM adapter
const SKIP_ANCESTORS = 'script, style, noscript, code, pre, textarea, input, select, [contenteditable], [translate=no], [data-page-translator]'

function collectDomItems(root, keyRegistry) {
  const items = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest(SKIP_ANCESTORS)) continue
    if (!keyRegistry.has(node)) keyRegistry.set(node, {})
    items.push({
      key: keyRegistry.get(node),
      read: () => node.nodeValue,
      write: (v) => (node.nodeValue = v),
    })
  }
  const attrNames = ['placeholder', 'title', 'aria-label']
  document.querySelectorAll(`[${attrNames.join('],[')}]`).forEach((el) => {
    if (el.closest(SKIP_ANCESTORS)) return
    attrNames.forEach((attr) => {
      if (!el.hasAttribute(attr)) return
      const k = `${attr}@`
      if (!keyRegistry.has(el)) keyRegistry.set(el, {})
      const elReg = keyRegistry.get(el)
      if (!elReg[k]) elReg[k] = {}
      items.push({
        key: elReg[k],
        read: () => el.getAttribute(attr),
        write: (v) => el.setAttribute(attr, v),
      })
    })
  })
  return items
}

// RPC
async function rpc(op, payload, signal) {
  const res = await fetch('/api/page-translator/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ op, ...payload }),
    signal,
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'RPC failed')
  return data
}

// Settings
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('page-translator:settings') || '{}')
  } catch {
    return {}
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem('page-translator:settings', JSON.stringify(s))
  } catch {}
}

// Drop a saved provider that the server no longer offers.
function resolveConfig(config, settings) {
  const next = { ...settings }
  if (config.providers.length > 0 && !config.providers.some((p) => p.id === settings.provider)) {
    next.provider = config.defaults.provider
  }
  return next
}

// i18n
const TEXTS = {
  zh: {
    title: '页面翻译',
    sourceLang: '源语言',
    targetLang: '目标语言',
    provider: '翻译来源',
    translate: '翻译此页',
    restore: '显示原文',
    progress: '已翻译 {done} / 共 {total}',
    retry: '重试',
    llmNote: '会消耗 token',
    auto: '自动检测',
  },
  en: {
    title: 'Page Translator',
    sourceLang: 'Source',
    targetLang: 'Target',
    provider: 'Provider',
    translate: 'Translate',
    restore: 'Restore',
    progress: '{done} / {total}',
    retry: 'Retry',
    llmNote: 'consumes tokens',
    auto: 'Auto',
  },
}

function getLang() {
  const html = document.documentElement.lang || navigator.language || 'en'
  return html.startsWith('zh') ? 'zh' : 'en'
}

function t(key) {
  return TEXTS[getLang()][key] || TEXTS.en[key] || key
}

window.__ModuleLoader__.load({
  id: 'vyra-page-translator',
  factory(require) {
    const React = require('react')
    const { useState, useEffect } = React
    // Diagnostic: proves the browser bundle executed, before apply() runs.
    if (typeof location !== 'undefined') {
      try {
        fetch('/api/page-translator/rpc', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ op: 'ping' }),
        }).catch(() => {})
      } catch {}
    }

    function TranslateButton({ engine, state, settings, onOpen }) {
      const icon = state.active
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--dsw-alias-button-primary-background)" stroke="none"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H12a1.5 1.5 0 0 1 1.5 1.5V11a1.5 1.5 0 0 1-1.5 1.5H8L5 15v-2.5H4.5A1.5 1.5 0 0 1 3 11z"/><path d="M10.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h4l3 2.5v-2.5h.5a1.5 1.5 0 0 0 1.5-1.5v-5a1.5 1.5 0 0 0-1.5-1.5h-4"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H12a1.5 1.5 0 0 1 1.5 1.5V11a1.5 1.5 0 0 1-1.5 1.5H8L5 15v-2.5H4.5A1.5 1.5 0 0 1 3 11z"/><path d="M10.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h4l3 2.5v-2.5h.5a1.5 1.5 0 0 0 1.5-1.5v-5a1.5 1.5 0 0 0-1.5-1.5h-4"/></svg>'
      const color = state.error
        ? 'var(--dsw-alias-feedback-error-foreground)'
        : state.active
          ? 'var(--dsw-alias-button-primary-background)'
          : 'var(--dsw-alias-foreground-secondary)'
      return React.createElement(
        'button',
        {
          onClick: onOpen,
          'data-page-translator': '',
          style: {
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            color,
          },
          title: t('title'),
          dangerouslySetInnerHTML: { __html: icon },
        },
        null,
      )
    }

    function Panel({ onClose, engine, state, config, settings, setSettings, inline }) {
      useEffect(() => {
        if (inline) return undefined
        const handleClickOutside = (e) => {
          if (e.target?.closest?.('[data-page-translator]')) return
          onClose()
        }
        const handleEsc = (e) => {
          if (e.key === 'Escape') onClose()
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEsc)
        return () => {
          document.removeEventListener('mousedown', handleClickOutside)
          document.removeEventListener('keydown', handleEsc)
        }
      }, [onClose, inline])

      const changeSetting = (key, val) => {
        const next = { ...settings, [key]: val }
        setSettings(next)
        saveSettings(next)
      }

      return React.createElement(
        'div',
        {
          'data-page-translator': '',
          style: {
            position: inline ? 'static' : 'fixed',
            top: inline ? undefined : '60px',
            right: inline ? undefined : '20px',
            width: inline ? '100%' : '320px',
            background: inline ? 'transparent' : 'var(--dsw-alias-background-elevated)',
            border: inline ? 'none' : '1px solid var(--dsw-alias-border-default)',
            borderRadius: '8px',
            padding: inline ? 0 : '16px',
            boxShadow: inline ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          },
        },
        React.createElement('div', { style: { fontSize: '16px', fontWeight: 600 } }, t('title')),
        React.createElement(
          'label',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          React.createElement('span', { style: { fontSize: '12px' } }, t('sourceLang')),
          React.createElement(
            'select',
            {
              value: settings.source,
              onChange: (e) => changeSetting('source', e.target.value),
              style: {
                padding: '6px 8px',
                border: '1px solid var(--dsw-alias-border-default)',
                borderRadius: '4px',
                background: 'var(--dsw-alias-background-default)',
                color: 'var(--dsw-alias-foreground-default)',
              },
            },
            React.createElement('option', { value: 'auto' }, t('auto')),
            config.languages.map((l) =>
              React.createElement('option', { key: l.code, value: l.code }, l.name),
            ),
          ),
        ),
        React.createElement(
          'label',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          React.createElement('span', { style: { fontSize: '12px' } }, t('targetLang')),
          React.createElement(
            'select',
            {
              value: settings.target,
              onChange: (e) => changeSetting('target', e.target.value),
              style: {
                padding: '6px 8px',
                border: '1px solid var(--dsw-alias-border-default)',
                borderRadius: '4px',
                background: 'var(--dsw-alias-background-default)',
                color: 'var(--dsw-alias-foreground-default)',
              },
            },
            config.languages.map((l) =>
              React.createElement('option', { key: l.code, value: l.code }, l.name),
            ),
          ),
        ),
        React.createElement(
          'label',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          React.createElement('span', { style: { fontSize: '12px' } }, t('provider')),
          React.createElement(
            'select',
            {
              value: settings.provider,
              onChange: (e) => changeSetting('provider', e.target.value),
              style: {
                padding: '6px 8px',
                border: '1px solid var(--dsw-alias-border-default)',
                borderRadius: '4px',
                background: 'var(--dsw-alias-background-default)',
                color: 'var(--dsw-alias-foreground-default)',
              },
            },
            config.providers.map((p) =>
              React.createElement(
                'option',
                { key: p.id, value: p.id },
                p.name + (p.costsTokens ? ` (${t('llmNote')})` : ''),
              ),
            ),
          ),
        ),
        React.createElement(
          'button',
          {
            onClick: () => (state.active ? engine.restore() : engine.start()),
            style: {
              padding: '10px',
              background: 'var(--dsw-alias-button-primary-background)',
              color: 'var(--dsw-alias-button-primary-foreground)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            },
          },
          state.active ? t('restore') : t('translate'),
        ),
        state.busy &&
          React.createElement(
            'div',
            { style: { fontSize: '12px', color: 'var(--dsw-alias-foreground-secondary)' } },
            t('progress').replace('{done}', state.done).replace('{total}', state.total),
          ),
        state.error &&
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement(
              'span',
              { style: { fontSize: '12px', color: 'var(--dsw-alias-feedback-error-foreground)', flex: 1 } },
              state.error,
            ),
            React.createElement(
              'button',
              {
                onClick: () => engine.retry(),
                style: {
                  padding: '4px 8px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--dsw-alias-button-primary-background)',
                  border: '1px solid currentColor',
                  borderRadius: '4px',
                  cursor: 'pointer',
                },
              },
              t('retry'),
            ),
          ),
      )
    }

    function note(message) {
      if (typeof location === 'undefined') return
      try {
        fetch('/api/page-translator/rpc', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ op: 'note', message: String(message).slice(0, 800) }),
        }).catch(() => {})
      } catch {}
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const keyRegistry = new WeakMap()
        let config = null
        let settings = { source: 'auto', target: 'zh-Hans', provider: 'bing', ...loadSettings() }
        let engineState = { active: false, busy: false, done: 0, total: 0, error: null }
        let stateListeners = []

        const engine = createEngine({
          collect: () => collectDomItems(document.body, keyRegistry),
          request: async (texts, signal) => {
            if (!config) config = await rpc('providers')
            const { texts: out } = await rpc('translate', { texts, ...settings }, signal)
            return out
          },
          settings: () => settings,
          onState: (s) => {
            engineState = s
            stateListeners.forEach((fn) => fn(s))
          },
        })

        const observer = new MutationObserver((mutations) => {
          if (!engineState.active) return
          const changed = new Set()
          for (const mut of mutations) {
            if (mut.type === 'childList') {
              mut.addedNodes.forEach((n) => {
                if (n.nodeType === Node.TEXT_NODE) changed.add(n)
                if (n.nodeType === Node.ELEMENT_NODE) {
                  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT)
                  let t
                  while ((t = w.nextNode())) changed.add(t)
                }
              })
            } else if (mut.type === 'characterData') {
              changed.add(mut.target)
            } else if (mut.type === 'attributes') {
              const el = mut.target
              const k = `${mut.attributeName}@`
              if (!keyRegistry.has(el)) keyRegistry.set(el, {})
              const elReg = keyRegistry.get(el)
              if (!elReg[k]) elReg[k] = {}
              changed.add({ _attr: true, el, attr: mut.attributeName, key: elReg[k] })
            }
          }
          const items = [...changed].map((node) => {
            if (node._attr) {
              return { key: node.key, read: () => node.el.getAttribute(node.attr), write: (v) => node.el.setAttribute(node.attr, v) }
            }
            if (!keyRegistry.has(node)) keyRegistry.set(node, {})
            return { key: keyRegistry.get(node), read: () => node.nodeValue, write: (v) => (node.nodeValue = v) }
          })
          engine.notify(items)
        })

        function useShared() {
          const [state, setState] = useState(engineState)
          const [localSettings, setLocalSettings] = useState(settings)
          const [remoteConfig, setRemoteConfig] = useState(null)

          useEffect(() => {
            let alive = true
            rpc('providers')
              .then((data) => {
                if (!alive) return
                config = data
                setRemoteConfig(data)
                setLocalSettings((s) => {
                  const next = resolveConfig(data, s)
                  if (next.provider !== s.provider) saveSettings(next)
                  return next
                })
              })
              .catch(() => {})
            return () => {
              alive = false
            }
          }, [])

          useEffect(() => {
            const fn = (s) => setState(s)
            stateListeners.push(fn)
            return () => {
              stateListeners = stateListeners.filter((x) => x !== fn)
            }
          }, [])

          useEffect(() => {
            settings = localSettings
          }, [localSettings])

          useEffect(() => {
            if (state.active) {
              observer.observe(document.body, {
                childList: true,
                characterData: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['placeholder', 'title', 'aria-label'],
              })
            } else {
              observer.disconnect()
            }
          }, [state.active])

          return { state, localSettings, setLocalSettings, remoteConfig }
        }

        const resolvedConfig = (remoteConfig) => remoteConfig || config || { providers: [], languages: [] }

        function ButtonHost() {
          const [panelOpen, setPanelOpen] = useState(false)
          const { state, localSettings, setLocalSettings, remoteConfig } = useShared()

          return React.createElement(
            React.Fragment,
            null,
            React.createElement(TranslateButton, {
              engine,
              state,
              settings: localSettings,
              onOpen: () => setPanelOpen(true),
            }),
            panelOpen &&
              React.createElement(Panel, {
                onClose: () => setPanelOpen(false),
                engine,
                state,
                config: resolvedConfig(remoteConfig),
                settings: localSettings,
                setSettings: setLocalSettings,
              }),
          )
        }

        function MainPanel() {
          const shared = useShared()
          const text =
            getLang() === 'zh'
              ? '选择目标语言后点击按钮，整页文字将被翻译，可随时还原。'
              : 'Pick a target language, then translate the whole page; restore any time.'
          return React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            React.createElement('div', { style: { fontSize: '16px', fontWeight: 600 } }, t('title')),
            React.createElement('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-foreground-secondary)' } }, text),
            React.createElement(Panel, {
              onClose: () => {},
              engine,
              state: shared.state,
              config: resolvedConfig(shared.remoteConfig),
              settings: shared.localSettings,
              setSettings: shared.setLocalSettings,
              inline: true,
            }),
          )
        }

        function SidebarIcon({ size }) {
          const s = size || 20
          return React.createElement(
            'svg',
            {
              xmlns: 'http://www.w3.org/2000/svg',
              viewBox: '0 0 24 24',
              width: s,
              height: s,
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            },
            React.createElement('path', { d: 'M3 5.5A1.5 1.5 0 0 1 4.5 4H12a1.5 1.5 0 0 1 1.5 1.5V11a1.5 1.5 0 0 1-1.5 1.5H8L5 15v-2.5H4.5A1.5 1.5 0 0 1 3 11z' }),
            React.createElement('path', { d: 'M10.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h4l3 2.5v-2.5h.5a1.5 1.5 0 0 0 1.5-1.5v-5a1.5 1.5 0 0 0-1.5-1.5h-4' }),
          )
        }

        const disposers = []
        const track = (name, fn) => {
          try {
            const d = fn()
            note(`${name}: registered`)
            disposers.push(d)
          } catch (e) {
            note(`${name}-error: ${(e && e.stack) || e}`)
          }
        }

        track('header', () =>
          ctx.slots.inject('conversation.session.header.utilities', () =>
            ctx.slots.register(
              {
                name: 'conversation.session.header.utilities',
                id: 'page-translator',
                order: 5,
                label: () => 'Page Translator',
              },
              ButtonHost,
            ),
          ),
        )
        track('sidebar', () =>
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              { name: 'sidebar.panellist', id: 'page-translator', order: 25, label: () => 'Page Translator' },
              SidebarIcon,
            ),
          ),
        )
        track('main', () =>
          ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: 'page-translator' }, MainPanel),
          ),
        )

        note('apply-ok')
        return () => {
          for (const d of disposers) {
            if (typeof d === 'function') d()
            else if (Array.isArray(d)) d.forEach((x) => typeof x === 'function' && x())
          }
        }
      },
      __engine: { isTranslatable, splitEdges, createEngine, resolveConfig },
    }
  },
})
