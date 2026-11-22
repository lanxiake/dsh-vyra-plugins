/**
 * Vyra Free Model — browser half.
 *
 * One settings section, three blocks, top to bottom in the order a new user
 * needs them: which model, which account, and how to use the models from
 * another tool. Nothing else is contributed — no onboarding, no picker
 * shadowing, no extra panel — because the whole point of this plugin is that a
 * person who does not want to configure anything can finish here in three
 * steps.
 *
 * Data comes from this plugin's own same-origin `/api/vyra-free-model/*` routes
 * rather than a typed Remote binding: those routes are served by the host
 * process on every kernel line this plugin targets.
 *
 * Hand-written ModuleLoader bundle. No build step; the only dependency is the
 * `react` the shell already provides. Every colour is a theme variable, so the
 * page survives a light/dark switch without a second stylesheet.
 */
window.__ModuleLoader__.load({
  id: 'vyra-free-model',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createElement: h, Fragment, useState, useEffect, useMemo, useCallback } = React

    const NS = 'settings.vyraFreeModel'
    const inject = ['slots', 'locale']

    /**
     * Every string the page shows.
     *
     * Wording rules, applied strictly: no 车道 / 渠道 / 适配器 / effort / 凭据 /
     * OAuth / ref. A user who has never heard those words must still understand
     * each line. The Chinese reads first because that is who this is for.
     */
    const DICT = {
      zh: {
        nav: '免费模型',
        title: '免费模型',
        subtitle: '装上就能用。选个模型，需要更多额度时登录一次账号。',

        'load.failed': '读不到状态。插件可能刚重载，稍等一下再试。',
        'load.retry': '重试',

        'models.title': '模型',
        'models.auto': '自动选择（推荐）',
        'models.autoHint': '自动挑一个当前能用的',
        'models.vision': '能看图',
        'models.context': '上下文',
        'models.empty': '还没拿到模型列表。检查网络后点下面的按钮。',
        'models.recheck': '重新检测',
        'models.rechecking': '检测中…',
        'models.count': '{n} 个可用',
        'models.more': '展开全部 {n} 个',
        'models.less': '收起',
        'models.offline': '所有模型都连不上。稍后再试，或登录账号换取更多额度。',
      },
      en: {
        nav: 'Free models',
        title: 'Free models',
        subtitle: 'Works out of the box. Pick a model; sign in once for more quota.',

        'load.failed': 'Could not read the state. Try again in a moment.',
        'load.retry': 'Retry',

        'models.title': 'Models',
        'models.auto': 'Automatic (recommended)',
        'models.autoHint': 'Picks one that works right now',
        'models.vision': 'Sees images',
        'models.context': 'context',
        'models.empty': 'No models yet. Check the network, then retry below.',
        'models.recheck': 'Check again',
        'models.rechecking': 'Checking…',
        'models.count': '{n} available',
        'models.more': 'Show all {n}',
        'models.less': 'Show less',
        'models.offline': 'No model is reachable right now. Try later, or sign in for more quota.',
      },
    }

    /** The active language, from the shell when it says, else `zh`. */
    function localeTag() {
      try {
        const active = document?.documentElement?.lang ?? ''
        return active.toLowerCase().startsWith('en') ? 'en' : 'zh'
      } catch {
        return 'zh'
      }
    }

    /** One string, with `{name}` placeholders filled. */
    function t(key, params) {
      const table = DICT[localeTag()] ?? DICT.zh
      const template = table[key] ?? DICT.zh[key] ?? key
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (whole, name) => (params[name] === undefined ? whole : String(params[name])))
    }

    /** This plugin's own routes, resolved against the page's base. */
    const API = (() => {
      try { return new URL('api/vyra-free-model', document.baseURI).pathname } catch { return '/api/vyra-free-model' }
    })()

    /**
     * One call to this plugin's routes.
     *
     * Always bounded in time: a route that hangs must become a visible failure,
     * never a page stuck on "loading" with no way forward.
     */
    async function api(path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`${API}${path}`, {
          method,
          signal: controller.signal,
          headers: body === undefined ? undefined : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await response.text()
        const payload = text === '' ? {} : JSON.parse(text)
        if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`)
        return payload
      } finally {
        clearTimeout(timer)
      }
    }

    /** `1048576` -> `1M`; `262144` -> `256K`. Users read sizes, not integers. */
    function formatContext(value) {
      if (!Number.isFinite(value) || value <= 0) return ''
      if (value >= 1048576) {
        const millions = value / 1048576
        return `${millions % 1 === 0 ? millions : millions.toFixed(1)}M`
      }
      if (value >= 1024) return `${Math.round(value / 1024)}K`
      return String(value)
    }

    // ── styles ───────────────────────────────────────────────────────────────

    const CSS = `
.vfm_page{display:flex;flex-direction:column;gap:20px;padding:4px 0 24px;color:var(--dsw-alias-label-primary);font-size:13px}
.vfm_head{display:flex;flex-direction:column;gap:4px}
.vfm_title{font-size:16px;font-weight:600;margin:0}
.vfm_sub{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}
.vfm_card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:14px}
.vfm_cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.vfm_cardtitle{font-size:13px;font-weight:600;margin:0}
.vfm_note{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;margin:8px 0 0}
.vfm_row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent;background:transparent;width:100%;text-align:left;color:inherit;font:inherit}
.vfm_row:hover{background:var(--dsw-alias-bg-layer-2)}
.vfm_row[data-on="1"]{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-2)}
.vfm_dot{width:14px;height:14px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);flex:none;position:relative}
.vfm_row[data-on="1"] .vfm_dot{border-color:var(--dsw-alias-state-business-primary)}
.vfm_row[data-on="1"] .vfm_dot::after{content:'';position:absolute;inset:3px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}
.vfm_name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vfm_meta{display:flex;gap:8px;align-items:center;flex:none;color:var(--dsw-alias-label-secondary);font-size:11px}
.vfm_tag{border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px}
.vfm_btn{border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;padding:4px 10px}
.vfm_btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3)}
.vfm_btn:disabled{opacity:.55;cursor:default}
.vfm_center{display:flex;align-items:center;justify-content:center;padding:28px 12px;color:var(--dsw-alias-label-secondary);font-size:12px}
.vfm_more{align-self:flex-start;margin-top:6px}
`

    // ── the model block ──────────────────────────────────────────────────────

    /** How many rows a collapsed roster shows. */
    const COLLAPSED_ROWS = 8

    /**
     * Which model to use.
     *
     * "Automatic" is first and is the default, because the honest answer to
     * "which of these thirteen should I pick" is "you should not have to pick".
     * A model with an image ability gets a small tag, since that is the one
     * difference a user can actually feel.
     */
    function ModelBlock({ models, selected, onSelect, laneOk, onRecheck, busy }) {
      const [expanded, setExpanded] = useState(false)
      const roster = Array.isArray(models) ? models : []
      const shown = expanded ? roster : roster.slice(0, COLLAPSED_ROWS)
      const hidden = roster.length - shown.length

      const row = (id, name, meta, isAuto) => h('button', {
        type: 'button',
        className: 'vfm_row',
        'data-on': (selected === id || (isAuto && (selected === '' || selected === undefined))) ? '1' : undefined,
        onClick: () => onSelect?.(id),
      },
      h('span', { className: 'vfm_dot' }),
      h('span', { className: 'vfm_name' }, name),
      h('span', { className: 'vfm_meta' }, ...meta))

      return h('section', { className: 'vfm_card' },
        h('div', { className: 'vfm_cardhead' },
          h('h3', { className: 'vfm_cardtitle' }, t('models.title')),
          h('div', { className: 'vfm_meta' },
            h('span', {}, t('models.count', { n: roster.length })),
            h('button', {
              type: 'button',
              className: 'vfm_btn',
              disabled: busy === true,
              onClick: () => onRecheck?.(),
            }, busy === true ? t('models.rechecking') : t('models.recheck')))),

        row('', t('models.auto'), [h('span', {}, t('models.autoHint'))], true),

        ...shown.map(entry => row(
          entry.id,
          entry.name ?? entry.id,
          [
            formatContext(entry.contextWindow) === '' ? null : h('span', { className: 'vfm_tag' }, formatContext(entry.contextWindow)),
            entry.vision === true ? h('span', { className: 'vfm_tag' }, t('models.vision')) : null,
          ].filter(Boolean),
          false,
        )),

        hidden > 0
          ? h('button', { type: 'button', className: 'vfm_btn vfm_more', onClick: () => setExpanded(true) },
            t('models.more', { n: roster.length }))
          : (expanded && roster.length > COLLAPSED_ROWS
            ? h('button', { type: 'button', className: 'vfm_btn vfm_more', onClick: () => setExpanded(false) }, t('models.less'))
            : null),

        roster.length === 0 ? h('p', { className: 'vfm_note' }, t('models.empty')) : null,
        laneOk === false && roster.length > 0 ? h('p', { className: 'vfm_note' }, t('models.offline')) : null)
    }

    // ── the page ─────────────────────────────────────────────────────────────

    /**
     * The settings page.
     *
     * One read on mount; the three blocks render from that single document, so
     * the user never sees a half-loaded page.
     */
    function SettingsPage() {
      const [summary, setSummary] = useState(undefined)
      const [error, setError] = useState('')
      const [selected, setSelected] = useState('')
      const [busy, setBusy] = useState(false)

      const load = useCallback(async () => {
        try {
          setError('')
          setSummary(await api('/summary'))
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        }
      }, [])

      useEffect(() => {
        let alive = true
        api('/summary')
          .then(payload => { if (alive) setSummary(payload) })
          .catch(cause => { if (alive) setError(String(cause?.message ?? cause)) })
        return () => { alive = false }
      }, [])

      const recheck = useCallback(async () => {
        setBusy(true)
        try {
          const payload = await api('/recheck', { method: 'POST' })
          if (payload?.summary !== undefined) setSummary(payload.summary)
          setError('')
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        } finally {
          setBusy(false)
        }
      }, [])

      if (error !== '' && summary === undefined) {
        return h('div', { className: 'vfm_page' },
          h('div', { className: 'vfm_center' },
            h('div', {},
              h('p', { className: 'vfm_note' }, t('load.failed')),
              h('button', { type: 'button', className: 'vfm_btn', onClick: () => void load() }, t('load.retry')))))
      }

      if (summary === undefined) {
        return h('div', { className: 'vfm_page' }, h('div', { className: 'vfm_center' }, '…'))
      }

      return h('div', { className: 'vfm_page' },
        h('header', { className: 'vfm_head' },
          h('h2', { className: 'vfm_title' }, t('title')),
          h('p', { className: 'vfm_sub' }, t('subtitle'))),
        h(ModelBlock, {
          models: summary?.lane?.models ?? [],
          selected,
          onSelect: setSelected,
          laneOk: summary?.lane?.ok === true,
          onRecheck: () => void recheck(),
          busy,
        }))
    }

    // ── registration ─────────────────────────────────────────────────────────

    /** The section's tab glyph, drawn from theme colour. */
    function SectionIcon() {
      return h('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true' },
        h('path', {
          d: 'M8 1.6 9.7 6l4.4 1.7-4.4 1.7L8 13.8 6.3 9.4 1.9 7.7 6.3 6z',
          fill: 'currentColor',
        }))
    }

    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'vyra-free-model',
        order: 36,
        label: () => t('nav'),
        locale: NS,
      }, () => h(SettingsPage)))

      ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
        name: 'settings.section.icon',
        id: 'vyra-free-model',
        order: 36,
      }, () => h(SectionIcon)))
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = 'vyra-free-model'
    // Headless seams: the same stub-React renderer the tests use.
    exports.__test = { h, t, formatContext, ModelBlock, SettingsPage, DICT, CSS, API }
    return module.exports
  },
})
