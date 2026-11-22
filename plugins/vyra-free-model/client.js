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

        'accounts.title': '账号（可选）',
        'accounts.hint': '不登录也能用上面的免费模型。登录一个国内账号，就能多一份额度。',
        'accounts.login': '登录',
        'accounts.pending': '登录中…',
        'accounts.expired': '已过期',
        'accounts.claim': '重新领取',
        'accounts.claiming': '领取中…',
        'accounts.credits': '{n} 积分',
        'accounts.more': '更多',
        'accounts.less': '收起',
        'accounts.claimFailed': '上次自动领取没成功。',
        'accounts.retry': '重试',
        'accounts.ownedElsewhere': '账号功能已由 Our Free Model 接管。请到那里管理账号，这里继续用免费模型。',

        'forward.title': '让别的工具也用上（可选）',
        'forward.hint': '打开后，Cursor、Claude Code 这类工具就能用同一批免费模型。只在你这台电脑上有效。',
        'forward.on': '打开',
        'forward.off': '关闭',
        'forward.address': '地址',
        'forward.key': '密钥',
        'forward.forCursor': '给 Cursor',
        'forward.forClaudeCode': '给 Claude Code',
        'forward.copy': '复制',
        'forward.copied': '已复制',

        'degrade.laneDown': '暂时连不上，请检查网络',
        'degrade.laneThrottled': '免费额度暂时用完，稍后再试或登录一个账号',
        'degrade.accountsFailed': '账号功能暂时不可用',
        'degrade.accountsOwned': '账号功能已由 Our Free Model 接管，这里继续用免费模型。',
        'master.disable': '先关掉',
        'master.enable': '重新打开',
        'master.offHint': '已关闭。模型不会出现在选择器里；随时可以重新打开。',

        'tools.idle': '未配置',
        'tools.writing': '正在写入…',
        'tools.written': '已写入',
        'tools.failed': '写入失败',
        'tools.hintIdle': '会新增一段独立配置，你原有的设置不动。',
        'tools.hintWritten': '用它启动就能连上这里的免费模型；原有设置仍保持原样。',
        'tools.write': '写入',
        'tools.retry': '重试',
        'tools.restore': '还原',
        'tools.title': '给别的工具用（可选）',
        'tools.hint': '把本地地址写进下面两个工具的配置。写入前会整份备份，随时可还原；你原来的配置不会被动。',
        'tools.needPort': '请先打开上面的端口，再写入配置。',
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

        'accounts.title': 'Accounts (optional)',
        'accounts.hint': 'The free models above work without signing in. Sign into one account for extra quota.',
        'accounts.login': 'Sign in',
        'accounts.pending': 'Waiting…',
        'accounts.expired': 'Expired',
        'accounts.claim': 'Claim again',
        'accounts.claiming': 'Claiming…',
        'accounts.credits': '{n} credits',
        'accounts.more': 'More',
        'accounts.less': 'Show less',
        'accounts.claimFailed': 'The last automatic claim did not succeed.',
        'accounts.retry': 'Retry',
        'accounts.ownedElsewhere': 'Our Free Model already manages accounts here. Manage them there; the free models keep working.',

        'forward.title': 'Use these models elsewhere (optional)',
        'forward.hint': 'Once on, tools like Cursor or Claude Code can use the same free models. This machine only.',
        'forward.on': 'Turn on',
        'forward.off': 'Turn off',
        'forward.address': 'Address',
        'forward.key': 'Key',
        'forward.forCursor': 'For Cursor',
        'forward.forClaudeCode': 'For Claude Code',
        'forward.copy': 'Copy',
        'forward.copied': 'Copied',

        'degrade.laneDown': 'Cannot reach it right now; check the network.',
        'degrade.laneThrottled': 'The free quota is used up for now. Try later, or sign in.',
        'degrade.accountsFailed': 'Accounts are unavailable right now.',
        'degrade.accountsOwned': 'Our Free Model already manages accounts; the free models keep working.',
        'master.disable': 'Turn off',
        'master.enable': 'Turn back on',
        'master.offHint': 'Off. These models stay out of the picker; turn them back on any time.',

        'tools.idle': 'Not configured',
        'tools.writing': 'Writing…',
        'tools.written': 'Configured',
        'tools.failed': 'Write failed',
        'tools.hintIdle': 'Adds its own section; your existing settings stay untouched.',
        'tools.hintWritten': 'Launch it with this command to reach the free models here; your own setup is unchanged.',
        'tools.write': 'Write',
        'tools.retry': 'Retry',
        'tools.restore': 'Restore',
        'tools.title': 'Use from other tools (optional)',
        'tools.hint': 'Writes the local address into these two tools. Each file is backed up first and can be restored; your current settings are left alone.',
        'tools.needPort': 'Turn the port on above first, then write the configuration.',
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
/* No max-width here: the settings shell already bounds the column, and imposing
   a second one left the cards 20px off-centre inside their own container. */
.vfm_page{display:flex;flex-direction:column;gap:20px;padding:2px 0 28px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}

/* the page head: title left, master switch right, on one baseline */
.vfm_head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.vfm_headtext{display:flex;flex-direction:column;gap:6px;min-width:0}
.vfm_title{margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em}
.vfm_sub{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;max-width:56ch}

/* ── cards ────────────────────────────────────────────────────────────── */
.vfm_card{position:relative;display:flex;flex-direction:column;gap:14px;padding:20px 22px;
  border-radius:18px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 70%,transparent);
  background:linear-gradient(168deg,color-mix(in srgb,var(--dsw-alias-bg-layer-2) 92%,transparent),color-mix(in srgb,var(--dsw-alias-bg-layer-1) 86%,transparent));
  overflow:hidden}
.vfm_card::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 140% at 10% -30%,color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent),transparent 62%)}
.vfm_card>*{position:relative}

.vfm_cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px}
.vfm_cardtitle{display:flex;align-items:center;gap:9px;margin:0;font-size:13.5px;font-weight:600;letter-spacing:-0.005em}
.vfm_blocktitle{display:flex;align-items:center;gap:9px;margin:0;font-size:13.5px;font-weight:600}
.vfm_blocktitle::before{content:'';width:3px;height:14px;border-radius:2px;background:var(--dsw-alias-brand-primary);flex:none}

.vfm_note{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.6}
.vfm_count{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}

/* ── selectable rows (models and accounts share this) ─────────────────── */
/* One rhythm for every stacked list. Three different gaps (2 / 10 / 21) read as
   three different pages, and the extra margin on accounts doubled the parent's
   own gap. */
.vfm_rows{display:flex;flex-direction:column;gap:4px}
.vfm_row{display:flex;align-items:center;gap:11px;width:100%;padding:9px 10px;border-radius:10px;
  border:1px solid transparent;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;
  transition:background-color .15s ease,border-color .15s ease}
.vfm_row:hover{background:var(--dsw-alias-bg-layer-2)}
.vfm_row:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 78%,transparent);outline-offset:2px}
.vfm_row[data-on="1"]{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 46%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}
.vfm_dot{width:15px;height:15px;border-radius:50%;border:1.5px solid var(--dsw-alias-border-l2);flex:none;position:relative;transition:border-color .15s ease}
.vfm_row[data-on="1"] .vfm_dot{border-color:var(--dsw-alias-brand-primary)}
.vfm_row[data-on="1"] .vfm_dot::after{content:'';position:absolute;inset:3px;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.vfm_name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vfm_meta{display:flex;align-items:center;gap:7px;flex:none;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-variant-numeric:tabular-nums}
.vfm_tag{padding:1.5px 6px;border-radius:5px;border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent);
  background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:1.5}

/* ── buttons ──────────────────────────────────────────────────────────── */
.vfm_btn{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:8px;cursor:pointer;
  border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 72%,transparent);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12.5px;line-height:1.5;white-space:nowrap;
  transition:background-color .15s ease,border-color .15s ease,transform .1s ease}
.vfm_btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l2)}
.vfm_btn:active:not(:disabled){transform:translateY(1px)}
.vfm_btn:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 78%,transparent);outline-offset:2px}
.vfm_btn:disabled{opacity:.5;cursor:default}
/* ghost is Btn's default kind, so it needs a real rule: without one every plain
   action fell back to the solid base and the page lost its action hierarchy. */
.vfm_btn[data-kind="ghost"]{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}
.vfm_btn[data-kind="ghost"]:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.vfm_btn[data-kind="primary"]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:500}
.vfm_btn[data-kind="primary"]:hover:not(:disabled){filter:brightness(1.08)}
.vfm_btn[data-kind="quiet"]{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}
.vfm_btn[data-kind="quiet"]:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}

/* ── account cards ────────────────────────────────────────────────────── */
/* Inner surfaces must read as raised: at the parent's own tone they measured
   1.00:1 and the "layered cards" the design calls for simply was not there. */
.vfm_acct{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:11px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 62%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 86%,transparent);
  box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 5%,transparent)}
.vfm_accts{display:flex;flex-direction:column;gap:6px}
.vfm_acct[data-state="ready"]{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 38%,transparent)}
.vfm_acctmain{display:flex;align-items:center;gap:9px;min-width:0}
.vfm_acctname{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── tool configuration ───────────────────────────────────────────────── */
.vfm_tools{display:flex;flex-direction:column;gap:6px}
.vfm_tool{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:13px 14px;border-radius:12px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 62%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 86%,transparent);
  box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 5%,transparent)}
.vfm_tool[data-state="done"]{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 36%,transparent)}
.vfm_tool[data-state="failed"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent)}
.vfm_toolmain{display:flex;flex-direction:column;gap:5px;min-width:0}
.vfm_toolname{display:flex;align-items:center;gap:8px;font-weight:500}
.vfm_toolhint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}
.vfm_toolactions{display:flex;align-items:center;gap:8px;flex:none}
.vfm_cmd{display:inline-flex;align-items:center;gap:6px;margin-top:2px;padding:3px 8px;border-radius:6px;
  background:var(--dsw-alias-bg-layer-2);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;
  color:var(--dsw-alias-label-primary);align-self:flex-start;max-width:100%;overflow:hidden}
.vfm_cmd code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── status dot ───────────────────────────────────────────────────────── */
.vfm_state{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--dsw-alias-label-secondary);flex:none}
.vfm_state .vfm_dot{width:8px;height:8px;border:none;background:var(--dsw-alias-state-idle-primary)}
.vfm_state .vfm_dot::after{display:none}
.vfm_state[data-state="done"] .vfm_dot{background:var(--dsw-alias-state-success-primary)}
.vfm_state[data-state="failed"] .vfm_dot{background:var(--dsw-alias-state-error-primary)}
.vfm_state[data-state="stale"] .vfm_dot{background:var(--dsw-alias-state-warn-primary)}
.vfm_state[data-state="busy"] .vfm_dot{background:var(--dsw-alias-brand-primary);animation:vfm_pulse 1.1s ease-in-out infinite}
@keyframes vfm_pulse{0%,100%{opacity:.35}50%{opacity:1}}

/* ── forward block fields ─────────────────────────────────────────────── */
/* The divider sits inside a card whose first child is the head, so
   :first-of-type never matched a field and every block opened with a stray
   rule under its hint. The :not(:first-child) form is the selector that holds. */
.vfm_field{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;
  border-top:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 76%,transparent)}
.vfm_field:not(:first-child){margin-top:0}
.vfm_fields{border-top:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 76%,transparent)}
.vfm_fields .vfm_field:first-child{border-top:none}
.vfm_label{color:var(--dsw-alias-label-secondary);font-size:12px;flex:none}
.vfm_code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;
  color:var(--dsw-alias-label-primary);text-align:right}

/* ── banners and states ───────────────────────────────────────────────── */
.vfm_banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:11px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 46%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,var(--dsw-alias-bg-layer-1));
  font-size:12.5px;color:var(--dsw-alias-label-primary)}
.vfm_warn{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border-radius:10px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);font-size:12.5px;
  color:var(--dsw-alias-label-secondary)}
.vfm_center{display:flex;align-items:center;justify-content:center;padding:40px 16px;
  color:var(--dsw-alias-label-secondary);font-size:12.5px}
.vfm_centerbox{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.vfm_more{align-self:flex-start;margin-top:2px}
`

    // ── primitives ───────────────────────────────────────────────────────────

    /**
     * The card every block sits in.
     *
     * One shell rather than per-block markup: the three blocks must look like
     * they belong to the same page, and the only way to guarantee that is to
     * have exactly one place that draws a card.
     */
    function Card({ title, hint, action, children }) {
      // `title` is a node, not a string, so the caller decides its own heading —
      // wrapping it here nested one <h3> inside another and doubled the markup.
      return h('section', { className: 'vfm_card' },
        title === undefined && action === undefined
          ? null
          : h('div', { className: 'vfm_cardhead' },
            title === undefined ? null : (typeof title === 'string' ? h('h3', { className: 'vfm_cardtitle' }, title) : title),
            action === undefined ? null : h('div', { className: 'vfm_meta' }, action)),
        hint === undefined ? null : h('p', { className: 'vfm_note' }, hint),
        children)
    }

    /** A section heading with the accent marker. */
    function BlockTitle({ children }) {
      return h('h3', { className: 'vfm_blocktitle' }, children)
    }

    /**
     * A button.
     *
     * Three kinds only. `primary` is for the one action a block wants the user
     * to take; everything else is neutral or quiet, so a page of cards never
     * competes for attention.
     */
    function Btn({ kind = 'ghost', disabled, onClick, children, title }) {
      return h('button', {
        type: 'button',
        className: 'vfm_btn',
        'data-kind': kind,
        disabled: disabled === true,
        title,
        onClick: event => { if (disabled !== true) onClick?.(event) },
      }, children)
    }

    /** A state dot with its label: colour is never the only signal. */
    function StatusDot({ state = 'idle', label }) {
      return h('span', { className: 'vfm_state', 'data-state': state },
        h('span', { className: 'vfm_dot' }),
        label === undefined ? null : h('span', {}, label))
    }

    /**
     * One tool's configuration row.
     *
     * Five states, each with one sentence and at most one action: not
     * configured, writing, written, failed, and stale (written but the port has
     * moved since). A failure shows a trimmed reason rather than an upstream
     * stack, and never the port key.
     */
    function ToolCard({ tool, name, status, onWrite, onRestore }) {
      const entry = status !== null && typeof status === 'object' ? status : {}
      const configured = entry.configured === true
      const busy = entry.busy === true
      const failed = typeof entry.error === 'string' && entry.error !== ''
      const command = typeof entry.command === 'string' ? entry.command : ''
      const state = busy ? 'busy' : failed ? 'failed' : configured ? 'done' : 'idle'

      const label = busy
        ? t('tools.writing')
        : failed
          ? t('tools.failed')
          : configured
            ? t('tools.written')
            : t('tools.idle')

      return h('div', { className: 'vfm_tool', 'data-state': state, 'data-tool': tool },
        h('div', { className: 'vfm_toolmain' },
          h('span', { className: 'vfm_toolname' }, name, h(StatusDot, { state, label })),
          failed
            ? h('span', { className: 'vfm_toolhint' }, truncate(entry.error, 120))
            : h('span', { className: 'vfm_toolhint' }, configured ? t('tools.hintWritten') : t('tools.hintIdle')),
          configured && command !== ''
            ? h('span', { className: 'vfm_cmd' }, h('code', {}, command))
            : null),
        h('div', { className: 'vfm_toolactions' },
          failed
            ? h(Btn, { kind: 'primary', disabled: busy, onClick: () => onWrite?.(tool) }, t('tools.retry'))
            : configured
              ? h(Btn, { kind: 'quiet', disabled: busy, onClick: () => onRestore?.(tool) }, t('tools.restore'))
              : h(Btn, { kind: 'primary', disabled: busy, onClick: () => onWrite?.(tool) }, t('tools.write'))))
    }

    /** Text trimmed for display, with an ellipsis so it reads as trimmed. */
    function truncate(text, limit) {
      const value = String(text ?? '')
      return value.length <= limit ? value : `${value.slice(0, limit)}…`
    }

    /**
     * The tools this plugin can configure.
     *
     * Both are named the way their own users name them; the launch command each
     * one produces is what keeps the user's existing default untouched.
     */
    const TOOL_LABELS = Object.freeze([
      Object.freeze({ id: 'codex', name: 'Codex' }),
      Object.freeze({ id: 'claude', name: 'Claude Code' }),
    ])

    // ── the model block ──────────────────────────────────────────────────────

    /** How many rows a collapsed roster shows. */
    const COLLAPSED_ROWS = 8

    /** How long a sign-in may stay open before the card gives up. */
    const LOGIN_TIMEOUT_MS = 5 * 60_000

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
      // The catalog already promotes the automatic model as its first row. Draw
      // the row once: two entries named "自动选择" read as a bug, not a choice.
      const automatic = roster.find(entry => entry.id === '' || entry.name === t('models.auto')
        || entry.id === 'kilo-auto/free')
      const others = roster.filter(entry => entry !== automatic)
      const shown = expanded ? others : others.slice(0, COLLAPSED_ROWS)
      const hidden = others.length - shown.length

      const row = (id, name, meta, isAuto) => h('button', {
        type: 'button',
        className: 'vfm_row',
        'data-on': (selected === id || (isAuto && (selected === '' || selected === undefined))) ? '1' : undefined,
        onClick: () => onSelect?.(id),
      },
      h('span', { className: 'vfm_dot' }),
      h('span', { className: 'vfm_name' }, name),
      h('span', { className: 'vfm_meta' }, ...meta))

      return h(Card, {
        title: h(BlockTitle, {}, t('models.title')),
        action: [
          h('span', { className: 'vfm_count' }, t('models.count', { n: others.length + 1 })),
          h(Btn, { disabled: busy === true, onClick: () => onRecheck?.() },
            busy === true ? t('models.rechecking') : t('models.recheck')),
        ],
      },
      h('div', { className: 'vfm_rows' },
        row('', t('models.auto'), [h('span', {}, t('models.autoHint'))], true),
        ...shown.map(entry => row(
          entry.id,
          entry.name ?? entry.id,
          [
            formatContext(entry.contextWindow) === '' ? null : h('span', { className: 'vfm_tag' }, formatContext(entry.contextWindow)),
            entry.vision === true ? h('span', { className: 'vfm_tag' }, t('models.vision')) : null,
          ].filter(Boolean),
          false,
        ))),

      hidden > 0
        ? h(Btn, { kind: 'quiet', onClick: () => setExpanded(true) }, t('models.more', { n: others.length }))
        : (expanded && others.length > COLLAPSED_ROWS
          ? h(Btn, { kind: 'quiet', onClick: () => setExpanded(false) }, t('models.less'))
          : null),

      roster.length === 0 ? h('p', { className: 'vfm_note' }, t('models.empty')) : null,
      laneOk === false && roster.length > 0 ? h('p', { className: 'vfm_note' }, t('models.offline')) : null)
    }

    // ── the account block ────────────────────────────────────────────────────

    /**
     * The accounts a user can sign into.
     *
     * These are the domestic products whose free quota this plugin can actually
     * reach. Three channels the pack also carries are deliberately absent:
     * Qoder international, Cline and Gemini all need a network position that
     * simply does not work from a normal connection here, and offering a login
     * that cannot finish is worse than not offering it.
     *
     * `more: true` marks the one product that is uncommon enough to fold away,
     * so the default view is six recognizable names.
     */
    const PROVIDERS = Object.freeze([
      Object.freeze({ id: 'qodercn', label: 'Qoder 中国版' }),
      Object.freeze({ id: 'trae', label: 'TRAE' }),
      Object.freeze({ id: 'zcode', label: 'ZCode' }),
      Object.freeze({ id: 'minimax', label: 'MiniMax' }),
      Object.freeze({ id: 'lobsterai', label: '有道 LobsterAI' }),
      Object.freeze({ id: 'loomy', label: '讯飞 Loomy' }),
      Object.freeze({ id: 'raccoon', label: '商汤 Raccoon', more: true }),
    ])

    /** The states a card can be in, in words a user reads. */
    function stateLabel(state) {
      if (state === 'ready') return ''
      if (state === 'pending') return t('accounts.pending')
      if (state === 'expired') return t('accounts.expired')
      return ''
    }

    /**
     * One provider card.
     *
     * A card answers exactly two questions: am I signed in, and how do I change
     * that. Everything else — the account id, the redirect, the token — stays
     * out of the markup.
     */
    function providerRow(provider, entry, handlers) {
      const status = entry ?? {}
      const state = typeof status.state === 'string' ? status.state : ''
      const ready = state === 'ready'
      const pending = state === 'pending'
      const nickname = typeof status.nickname === 'string' ? status.nickname : ''
      const credits = Number.isFinite(status.credits) ? status.credits : undefined

      return h('div', { className: 'vfm_acct', 'data-state': state },
        h('div', { className: 'vfm_acctmain' },
          h('span', { className: 'vfm_acctname' }, provider.label),
          ready
            ? h('span', { className: 'vfm_meta' },
              nickname === '' ? null : h('span', {}, nickname),
              credits === undefined ? null : h('span', { className: 'vfm_tag' }, t('accounts.credits', { n: credits })))
            : h('span', { className: 'vfm_meta' }, stateLabel(state))),
        h('div', { className: 'vfm_meta' },
          ready
            ? h('button', {
              type: 'button',
              className: 'vfm_btn',
              disabled: status.claiming === true,
              onClick: () => handlers.onClaim?.(provider.id),
            }, status.claiming === true ? t('accounts.claiming') : t('accounts.claim'))
            : h('button', {
              type: 'button',
              className: 'vfm_btn',
              disabled: pending,
              onClick: () => handlers.onLogin?.(provider.id),
            }, pending ? t('accounts.pending') : t('accounts.login'))))
    }

    /**
     * The accounts block.
     *
     * Signing in is the one step a user may not want to take, so it is presented
     * as optional: the sentence above the cards says the free models work
     * without it, and each card is a single button. Nothing here is required to
     * start chatting.
     */
    function AccountsBlock({ providers, status, ownedElsewhere, claimFailedAt, onLogin, onClaim }) {
      const [showMore, setShowMore] = useState(false)
      const roster = Array.isArray(providers) && providers.length > 0 ? providers : PROVIDERS
      const entries = status !== null && typeof status === 'object' ? status : {}
      const handlers = { onLogin, onClaim }
      const primary = roster.filter(entry => entry.more !== true)
      const extra = roster.filter(entry => entry.more === true)

      if (ownedElsewhere === true) {
        return h(Card, {
          title: h(BlockTitle, {}, t('accounts.title')),
          hint: t('accounts.ownedElsewhere'),
        })
      }

      return h(Card, {
        title: h(BlockTitle, {}, t('accounts.title')),
        hint: t('accounts.hint'),
      },
      claimFailedAt !== undefined && claimFailedAt !== null
        ? h('div', { className: 'vfm_warn' },
          h('span', {}, t('accounts.claimFailed')),
          h(Btn, { onClick: () => onClaim?.('') }, t('accounts.retry')))
        : null,

      h('div', { className: 'vfm_accts' },
        ...primary.map(entry => providerRow(entry, entries[entry.id], handlers)),
        showMore ? extra.map(entry => providerRow(entry, entries[entry.id], handlers)) : []),

      extra.length > 0
        ? (showMore
          ? h(Btn, { kind: 'quiet', onClick: () => setShowMore(false) }, t('accounts.less'))
          : h(Btn, { kind: 'quiet', onClick: () => setShowMore(true) }, t('accounts.more')))
        : null)
    }

    // ── the forward block ────────────────────────────────────────────────────

    /**
     * What to paste into Cursor.
     *
     * Two lines, in the order that tool asks for them. Plain text rather than
     * JSON on purpose: a person can read this and see it matches what the form
     * wants.
     */
    function cursorSnippet(port, key) {
      return [
        `Base URL: http://127.0.0.1:${port}/v1`,
        `API Key: ${key}`,
      ].join('\n')
    }

    /**
     * What to paste into a terminal for Claude Code.
     *
     * Three exported variables. The model falls back to the automatic one, so a
     * user who never picked a model still gets a working command.
     */
    function claudeCodeSnippet(port, key, model) {
      const chosen = typeof model === 'string' && model !== '' ? model : 'kilo-auto/free'
      return [
        `export ANTHROPIC_BASE_URL=http://127.0.0.1:${port}`,
        `export ANTHROPIC_AUTH_TOKEN=${key}`,
        `export ANTHROPIC_MODEL=${chosen}`,
      ].join('\n')
    }

    /** What a key looks like when it is present but not being shown. */
    const MASKED_KEY = 'sk-••••••••••••'

    /**
     * The forward block: let another tool on this machine use these models.
     *
     * Collapsed to a single switch until it is on, because this is the one
     * feature a beginner should not have to think about. When on, it shows the
     * two things needed to use it and a button per client.
     */
    function ForwardBlock({ enabled, port, hasKey, key, model, onToggle, onCopy }) {
      const [copied, setCopied] = useState('')

      const copy = async (which, text) => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(which)
          onCopy?.(which)
        } catch {
          setCopied('')
        }
      }

      const base = `http://127.0.0.1:${port}/v1`
      const realKey = typeof key === 'string' && key !== '' ? key : MASKED_KEY

      return h(Card, {
        title: h(BlockTitle, {}, t('forward.title')),
        action: h(Btn, { kind: enabled === true ? 'ghost' : 'primary', onClick: () => onToggle?.(!(enabled === true)) },
          enabled === true ? t('forward.off') : t('forward.on')),
      },
      h('p', { className: 'vfm_note' }, t('forward.hint')),

      enabled !== true
        ? null
        : h('div', { className: 'vfm_fields' },
          h('div', { className: 'vfm_field' },
            h('span', { className: 'vfm_label' }, t('forward.address')),
            h('code', { className: 'vfm_code' }, base)),
          h('div', { className: 'vfm_field' },
            h('span', { className: 'vfm_label' }, t('forward.key')),
            h('code', { className: 'vfm_code' }, hasKey === true ? MASKED_KEY : '')),
          h('div', { className: 'vfm_field' },
            h('span', { className: 'vfm_label' }, t('forward.forCursor')),
            h(Btn, { onClick: () => void copy('cursor', cursorSnippet(port, realKey)) },
              copied === 'cursor' ? t('forward.copied') : t('forward.copy'))),
          h('div', { className: 'vfm_field' },
            h('span', { className: 'vfm_label' }, t('forward.forClaudeCode')),
            h(Btn, { onClick: () => void copy('claude', claudeCodeSnippet(port, realKey, model)) },
              copied === 'claude' ? t('forward.copied') : t('forward.copy')))))
    }

    // ── degradation ──────────────────────────────────────────────────────────

    /**
     * What to tell the user when something is not working.
     *
     * The rule: one sentence naming what failed, and a retry only when retrying
     * could actually help. A quota that ran out is not fixed by pressing a
     * button, so it gets no retry — it points at the one action that does help.
     * An unknown state returns nothing: inventing a warning for a healthy page
     * would be worse than saying nothing.
     */
    function degradedMessage(state) {
      if (state === 'lane-down') return { text: t('degrade.laneDown'), canRetry: true }
      if (state === 'lane-throttled') return { text: t('degrade.laneThrottled'), canRetry: false }
      if (state === 'accounts-failed') return { text: t('degrade.accountsFailed'), canRetry: false }
      if (state === 'accounts-owned') return { text: t('degrade.accountsOwned'), canRetry: false }
      return undefined
    }

    /** The one line a degraded page shows, above its blocks. */
    function DegradedBanner({ state, onRetry }) {
      const message = degradedMessage(state)
      if (message === undefined) return null
      return h('div', { className: 'vfm_banner' },
        h('span', {}, message.text),
        message.canRetry && typeof onRetry === 'function'
          ? h(Btn, { kind: 'primary', onClick: () => onRetry() }, t('load.retry'))
          : null)
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
      const [accountStatus, setAccountStatus] = useState({})
      const [forwardKey, setForwardKey] = useState('')
      /** Per-tool configuration status, keyed by tool id. */
      const [configureStatus, setConfigureStatus] = useState({})

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
        // Read alongside the summary so the tool cards paint configured on the
        // first frame rather than after a second round trip.
        api('/configure/status')
          .then(payload => {
            if (!alive) return
            const next = {}
            for (const row of payload?.tools ?? []) {
              if (typeof row?.tool !== 'string') continue
              next[row.tool] = { ...row, command: row.tool === 'claude' ? 'claude-vyra' : 'codex-vyra' }
            }
            setConfigureStatus(next)
          })
          .catch(() => {})
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

      /**
       * Ask again until this account settles, then stop.
       *
       * Defined before the login handler that calls it: a `const` arrow used by
       * another hook in the same body must already be initialised.
       */
      const pollAccounts = useCallback(async providerId => {
        const deadline = Date.now() + LOGIN_TIMEOUT_MS
        while (Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          try {
            const payload = await api('/channel', {
              method: 'POST',
              body: { method: 'provider.status', payload: {} },
              timeoutMs: 15000,
            })
            const rows = payload?.value?.providers ?? []
            const mine = rows.find(row => row?.id === providerId)
            const state = typeof mine?.state === 'string' ? mine.state : ''
            if (state === 'ready' || state === 'expired') {
              setAccountStatus(current => ({ ...current, [providerId]: { ...mine } }))
              return
            }
          } catch { /* keep trying until the deadline */ }
        }
        setAccountStatus(current => ({ ...current, [providerId]: { state: '' } }))
      }, [])

      /**
       * Sign one account in.
       *
       * The pack opens the authorization page; this side marks the card
       * "waiting" and asks who has landed. Polling stops on its own: once
       * nothing is pending, or after five minutes, whichever comes first — a
       * user who closed the tab must not leave a spinner running forever.
       */
      const login = useCallback(async providerId => {
        setAccountStatus(current => ({ ...current, [providerId]: { state: 'pending' } }))
        try {
          const payload = await api('/channel', {
            method: 'POST',
            body: { method: 'account.create', payload: { provider: providerId } },
            timeoutMs: 30000,
          })
          const url = payload?.value?.loginUrl ?? payload?.value?.url
          if (typeof url === 'string' && url !== '') {
            window.open(url, '_blank', 'noopener,noreferrer')
          }
          await pollAccounts(providerId)
        } catch (cause) {
          setAccountStatus(current => ({ ...current, [providerId]: { state: '', message: String(cause?.message ?? cause) } }))
        }
      }, [pollAccounts])

      /** Claim credits, for one provider when named, otherwise for all. */
      const claim = useCallback(async providerId => {        const target = providerId === '' ? undefined : providerId
        setAccountStatus(current => {
          const next = { ...current }
          for (const key of target === undefined ? Object.keys(next) : [target]) {
            next[key] = { ...(next[key] ?? {}), claiming: true }
          }
          return next
        })
        try {
          await api('/channel', {
            method: 'POST',
            body: { method: 'credits.claimAll', payload: target === undefined ? {} : { provider: target } },
            timeoutMs: 60000,
          })
          const payload = await api('/channel', {
            method: 'POST',
            body: { method: 'provider.status', payload: {} },
            timeoutMs: 15000,
          })
          const rows = payload?.value?.providers ?? []
          setAccountStatus(current => {
            const next = { ...current }
            for (const row of rows) {
              if (typeof row?.id === 'string') next[row.id] = { ...row, claiming: false }
            }
            return next
          })
        } catch {
          setAccountStatus(current => {
            const next = { ...current }
            for (const key of target === undefined ? Object.keys(next) : [target]) {
              next[key] = { ...(next[key] ?? {}), claiming: false }
            }
            return next
          })
        }
      }, [])

      /**
       * Turn the local port on or off.
       *
       * The key is fetched only after the port is on: before that there is
       * nothing to paste, and the route answers 409. A failure leaves the switch
       * off rather than showing a half-enabled block.
       */
      const toggleForward = useCallback(async enabled => {
        try {
          const payload = await api('/forward', { method: 'POST', body: { enabled } })
          const next = payload?.forward ?? {}
          setSummary(current => (current === undefined ? current : { ...current, forward: next }))
          if (next.enabled === true) {
            try {
              const withKey = await api('/forward/key', { method: 'POST' })
              setForwardKey(typeof withKey?.key === 'string' ? withKey.key : '')
            } catch {
              setForwardKey('')
            }
          } else {
            setForwardKey('')
          }
        } catch {
          setForwardKey('')
        }
      }, [])

      /** The master switch: takes the model group out of the picker. */
      const toggleEnabled = useCallback(async enabled => {
        try {
          const payload = await api('/enabled', { method: 'POST', body: { enabled: !enabled } })
          setSummary(current => (current === undefined ? current : { ...current, enabled: payload?.enabled === true }))
        } catch { /* the page keeps its current reading */ }
      }, [])

      /** Read what each tool's configuration currently says. */
      const loadConfigureStatus = useCallback(async () => {
        try {
          const payload = await api('/configure/status')
          const next = {}
          for (const row of payload?.tools ?? []) {
            if (typeof row?.tool !== 'string') continue
            next[row.tool] = { ...row, command: row.tool === 'claude' ? 'claude-vyra' : 'codex-vyra' }
          }
          setConfigureStatus(next)
        } catch { /* leaving the cards as they were beats a page of errors */ }
      }, [])

      /**
       * Write the port into one tool.
       *
       * The card shows "writing" while the request is in flight and keeps the
       * failure message afterwards, so a refusal is visible rather than a
       * button that silently does nothing.
       */
      const writeTool = useCallback(async tool => {
        setConfigureStatus(current => ({ ...current, [tool]: { ...(current[tool] ?? {}), busy: true, error: undefined } }))
        try {
          const payload = await api('/configure', { method: 'POST', body: { tool }, timeoutMs: 30000 })
          setConfigureStatus(current => ({
            ...current,
            [tool]: {
              configured: true,
              busy: false,
              port: payload?.port,
              command: payload?.command ?? (tool === 'claude' ? 'claude-vyra' : 'codex-vyra'),
            },
          }))
        } catch (cause) {
          setConfigureStatus(current => ({
            ...current,
            [tool]: { ...(current[tool] ?? {}), configured: false, busy: false, error: String(cause?.message ?? cause) },
          }))
        }
      }, [])

      /** Put one tool's file back the way its backup holds it. */
      const restoreTool = useCallback(async tool => {
        setConfigureStatus(current => ({ ...current, [tool]: { ...(current[tool] ?? {}), busy: true, error: undefined } }))
        try {
          await api('/configure/restore', { method: 'POST', body: { tool }, timeoutMs: 30000 })
          setConfigureStatus(current => ({ ...current, [tool]: { configured: false, busy: false } }))
        } catch (cause) {
          setConfigureStatus(current => ({
            ...current,
            [tool]: { ...(current[tool] ?? {}), busy: false, error: String(cause?.message ?? cause) },
          }))
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
          h('div', { className: 'vfm_headtext' },
            h('h2', { className: 'vfm_title' }, t('title')),
            h('p', { className: 'vfm_sub' }, t('subtitle'))),
          h(Btn, {
            kind: 'quiet',
            onClick: () => void toggleEnabled(summary.enabled !== false),
          }, summary.enabled === false ? t('master.enable') : t('master.disable'))),
        summary.enabled === false ? h('p', { className: 'vfm_note' }, t('master.offHint')) : null,
        h(DegradedBanner, {
          state: summary?.lane?.ok === false && (summary?.lane?.models ?? []).length === 0
            ? 'lane-down'
            : summary?.accounts?.state === 'failed'
              ? 'accounts-failed'
              : 'ok',
          onRetry: () => void recheck(),
        }),
        h(ModelBlock, {
          models: summary?.lane?.models ?? [],
          selected,
          onSelect: setSelected,
          laneOk: summary?.lane?.ok === true,
          onRecheck: () => void recheck(),
          busy,
        }),
        h(AccountsBlock, {
          providers: summary?.accounts?.providers ?? [],
          status: accountStatus,
          ownedElsewhere: summary?.accounts?.state === 'owned-elsewhere',
          claimFailedAt: summary?.accounts?.claimFailedAt,
          onLogin: id => void login(id),
          onClaim: id => void claim(id),
        }),
        h(ForwardBlock, {
          enabled: summary?.forward?.enabled === true,
          port: summary?.forward?.port ?? 0,
          hasKey: summary?.forward?.hasKey === true,
          key: forwardKey,
          model: selected,
          onToggle: enabled => void toggleForward(enabled),
        }),
        h(Card, {
          title: h(BlockTitle, {}, t('tools.title')),
          hint: t('tools.hint'),
        },
        // Writing needs a live port to point at, so the block says so instead of
        // offering a button that can only fail.
        summary?.forward?.enabled !== true
          ? h('p', { className: 'vfm_note' }, t('tools.needPort'))
          : h('div', { className: 'vfm_tools' },
            ...TOOL_LABELS.map(entry => h(ToolCard, {
              key: entry.id,
              tool: entry.id,
              name: entry.name,
              status: configureStatus[entry.id],
              onWrite: id => void writeTool(id),
              onRestore: id => void restoreTool(id),
            })))))
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
      // The stylesheet has to be mounted, not merely defined: a page whose CSS
      // never reaches document.head renders as bare stacked HTML, which is what
      // shipped once and looked broken rather than plain.
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'vyra-free-model')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'vyra-free-model: styles')

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
    exports.__test = { h, t, formatContext, ModelBlock, AccountsBlock, providerRow, ForwardBlock,
      cursorSnippet, claudeCodeSnippet, degradedMessage, DegradedBanner, PROVIDERS, SettingsPage, DICT, CSS, API,
      Card, BlockTitle, Btn, StatusDot, ToolCard, truncate }
    return module.exports
  },
})
