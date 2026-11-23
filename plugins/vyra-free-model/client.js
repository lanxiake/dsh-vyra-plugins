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
    const { createElement: h, Fragment, useState, useEffect, useMemo, useCallback, useRef } = React

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
        'models.autoCurrent': '当前 · {name}',
        'models.autoUnknown': '运行一次后显示实际模型',
        'models.vision': '能看图',
        'models.context': '上下文',
        'models.empty': '还没拿到模型列表。检查网络后点下面的按钮。',
        'models.recheck': '重新检测',
        'models.rechecking': '检测中…',
        'models.count': '{n} 个模型',
        'models.more': '展开全部 {n} 个',
        'models.less': '收起',
        'models.offline': '所有模型都连不上。稍后再试，或登录账号换取更多额度。',
        'models.source': '模型来自 Kilo AI 公共免费网关（kilo.ai），由上游免费提供。提示词可能被上游记录，别发敏感内容。',
        'models.switchHint': '模型在对话框顶部的选择器里切换；这里只显示可用状态。',
        'models.autoSwitch': '自动切换模型',
        'models.autoSwitchHint': '自动选择失败时，换一个可用模型重试一次；关闭后直接报错。',
        'models.probe.ok': '可用',
        'models.probe.limited': '限流',
        'models.probe.unavailable': '不可用',
        'models.probe.unknown': '未确认',
        'models.probe.none': '未检测',
        'models.extra': '更多来源',

        'collapse.expand': '展开',
        'collapse.collapse': '收起',

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
        'accounts.notLogged': '未登录',
        'accounts.loggedIn': '{n} 个已登录',
        'accounts.waiting': '等待浏览器授权…',
        'accounts.openLink': '打开授权页',
        'accounts.copyLink': '复制链接',
        'accounts.copied': '已复制',
        'accounts.relogin': '再登录',
        'accounts.remove': '移除',
        'accounts.failed': '登录失败：{message}',
        'accounts.expiredHint': '登录已过期，请重新登录。',
        'accounts.addAccount': '添加账号',
        'accounts.toggleOff': '停用',
        'accounts.toggleOn': '启用',
        'accounts.delete': '删除',
        'accounts.credit': '{n} {unit}',
        'accounts.creditUnit': '积分',
        'accounts.creditError': '积分查不到',
        'accounts.creditsLoading': '查询积分中…',
        'accounts.refreshCredits': '刷新积分',
        'accounts.checkedIn': '今日已领',

        'loginModal.title': '登录 {name}',
        'loginModal.hint': '浏览器没有自动打开时，复制下面的链接，手动在浏览器里打开完成授权。',
        'loginModal.open': '打开授权页',
        'loginModal.copy': '复制链接',
        'loginModal.copied': '已复制',
        'loginModal.close': '关闭',
        'loginModal.waiting': '等待授权完成…',

        'buddy.title': 'CodeBuddy / WorkBuddy（可选）',
        'buddy.hint': '登录腾讯账号后，它的模型会出现在上面的「免费模型」里。',
        'buddy.product.buddy': 'CodeBuddy（腾讯）',
        'buddy.product.workbuddy': 'WorkBuddy（国际版）',
        'buddy.login': '登录',
        'buddy.relogin': '再登录',
        'buddy.remove': '移除',
        'buddy.waiting': '请在浏览器里完成登录，完成后这里会自动更新。',
        'buddy.failed': '登录失败：{message}',
        'buddy.none': '还没登录',

        'endpoints.title': '自带 Key 的模型（可选）',
        'endpoints.hint': '支持豆包（火山方舟）、Kimi、智谱、SiliconFlow 等任何 OpenAI 兼容接口。Key 只保存在本机。',
        'endpoints.add': '添加接口',
        'endpoints.cancel': '取消',
        'endpoints.preset': '快速填入',
        'endpoints.name': '名称',
        'endpoints.baseUrl': '接口地址',
        'endpoints.apiKey': 'API Key（留空保持不变）',
        'endpoints.save': '保存',
        'endpoints.saving': '保存中…',
        'endpoints.discover': '检测模型',
        'endpoints.discovering': '检测中…',
        'endpoints.remove': '删除',
        'endpoints.hasKey': '已保存 Key',
        'endpoints.models': '{n} 个模型',
        'endpoints.empty': '还没有添加接口。',
        'endpoints.failed': '失败：{message}',
        'endpoints.saved': '已保存。',

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
        'models.autoCurrent': 'Now · {name}',
        'models.autoUnknown': 'The real model appears after one turn',
        'models.vision': 'Sees images',
        'models.context': 'context',
        'models.empty': 'No models yet. Check the network, then retry below.',
        'models.recheck': 'Check again',
        'models.rechecking': 'Checking…',
        'models.count': '{n} models',
        'models.more': 'Show all {n}',
        'models.less': 'Show less',
        'models.offline': 'No model is reachable right now. Try later, or sign in for more quota.',
        'models.source': 'Models come from the Kilo AI public free gateway (kilo.ai). Prompts may be logged upstream — avoid sensitive content.',
        'models.switchHint': 'Switch models in the picker above the composer; this list shows availability.',
        'models.autoSwitch': 'Switch models automatically',
        'models.autoSwitchHint': 'When the automatic pick fails, retry once on another working model; off means show the error.',
        'models.probe.ok': 'Works',
        'models.probe.limited': 'Rate-limited',
        'models.probe.unavailable': 'Unavailable',
        'models.probe.unknown': 'Unclear',
        'models.probe.none': 'Not checked',
        'models.extra': 'More sources',

        'collapse.expand': 'Expand',
        'collapse.collapse': 'Collapse',

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
        'accounts.notLogged': 'Not signed in',
        'accounts.loggedIn': '{n} signed in',
        'accounts.waiting': 'Waiting for the browser…',
        'accounts.openLink': 'Open sign-in page',
        'accounts.copyLink': 'Copy link',
        'accounts.copied': 'Copied',
        'accounts.relogin': 'Sign in again',
        'accounts.remove': 'Remove',
        'accounts.failed': 'Sign-in failed: {message}',
        'accounts.expiredHint': 'This sign-in expired; sign in again.',
        'accounts.addAccount': 'Add account',
        'accounts.toggleOff': 'Disable',
        'accounts.toggleOn': 'Enable',
        'accounts.delete': 'Delete',
        'accounts.credit': '{n} {unit}',
        'accounts.creditUnit': 'credits',
        'accounts.creditError': 'Credits unavailable',
        'accounts.creditsLoading': 'Checking credits…',
        'accounts.refreshCredits': 'Refresh credits',
        'accounts.checkedIn': 'Claimed today',

        'loginModal.title': 'Sign in to {name}',
        'loginModal.hint': 'If the browser did not open, copy this link and open it yourself to finish signing in.',
        'loginModal.open': 'Open sign-in page',
        'loginModal.copy': 'Copy link',
        'loginModal.copied': 'Copied',
        'loginModal.close': 'Close',
        'loginModal.waiting': 'Waiting for authorization…',

        'buddy.title': 'CodeBuddy / WorkBuddy (optional)',
        'buddy.hint': 'Sign into a Tencent account and its models join the free-model group above.',
        'buddy.product.buddy': 'CodeBuddy (Tencent)',
        'buddy.product.workbuddy': 'WorkBuddy (international)',
        'buddy.login': 'Sign in',
        'buddy.relogin': 'Sign in again',
        'buddy.remove': 'Remove',
        'buddy.waiting': 'Finish in the browser; this updates on its own.',
        'buddy.failed': 'Sign-in failed: {message}',
        'buddy.none': 'Not signed in',

        'endpoints.title': 'Models with your own key (optional)',
        'endpoints.hint': 'Works with Doubao (Volcengine Ark), Kimi, Zhipu, SiliconFlow and any OpenAI-compatible API. The key stays on this machine.',
        'endpoints.add': 'Add endpoint',
        'endpoints.cancel': 'Cancel',
        'endpoints.preset': 'Quick fill',
        'endpoints.name': 'Name',
        'endpoints.baseUrl': 'Base URL',
        'endpoints.apiKey': 'API key (leave blank to keep)',
        'endpoints.save': 'Save',
        'endpoints.saving': 'Saving…',
        'endpoints.discover': 'Discover models',
        'endpoints.discovering': 'Discovering…',
        'endpoints.remove': 'Delete',
        'endpoints.hasKey': 'Key saved',
        'endpoints.models': '{n} models',
        'endpoints.empty': 'No endpoint yet.',
        'endpoints.failed': 'Failed: {message}',
        'endpoints.saved': 'Saved.',

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
      if (value >= 1_000_000) {
        const millions = Math.round((value / 1_000_000) * 10) / 10
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
.vfm_acct{flex-wrap:wrap}
.vfm_acct > .vfm_loginbox{flex-basis:100%;margin-top:2px}
.vfm_acct > .vfm_acctlines{flex-basis:100%;width:100%;margin-top:4px}
.vfm_autoNow{color:var(--dsw-alias-label-primary);font-size:11.5px}

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

/* ── collapsible cards ────────────────────────────────────────────────── */
/* Model and account blocks start folded: the page opens as four readable
   rows, and only the block a user is working in takes vertical space. */
.vfm_card[data-collapsed="1"]{gap:0;padding:14px 22px}
.vfm_click{display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:pointer;user-select:none;border-radius:8px;margin:-4px;padding:4px}
.vfm_click:hover{background:var(--dsw-alias-bg-layer-2)}
.vfm_click:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 78%,transparent);outline-offset:2px}
.vfm_chev{width:0;height:0;flex:none;border-top:4px solid transparent;border-bottom:4px solid transparent;
  border-left:5px solid var(--dsw-alias-label-secondary);transition:transform .15s ease}
.vfm_chev[data-open="1"]{transform:rotate(90deg)}
.vfm_summary{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%}
.vfm_collapsebody{display:flex;flex-direction:column;gap:14px;margin-top:14px}

/* ── probe status ─────────────────────────────────────────────────────── */
.vfm_probe{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-secondary);flex:none}
.vfm_probe::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.vfm_probe[data-state="ok"]::before{background:var(--dsw-alias-state-success-primary)}
.vfm_probe[data-state="limited"]::before{background:var(--dsw-alias-state-warn-primary)}
.vfm_probe[data-state="unavailable"]::before{background:var(--dsw-alias-state-error-primary)}
.vfm_probe[data-state="unknown"]::before{background:var(--dsw-alias-state-warn-primary)}

/* ── login link, account lines, endpoints ─────────────────────────────── */
.vfm_loginbox{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:9px;
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 80%,transparent);
  border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent)}
.vfm_loginurl{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;
  color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vfm_loginacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vfm_link{color:var(--dsw-alias-brand-primary);text-decoration:none;font-size:12px}
.vfm_link:hover{text-decoration:underline}
.vfm_acctlines{display:flex;flex-direction:column;gap:2px}
.vfm_acctline{color:var(--dsw-alias-label-secondary);font-size:11.5px}
.vfm_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5}
.vfm_form{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:11px;
  border:1px dashed color-mix(in srgb,var(--dsw-alias-border-l2) 80%,transparent)}
.vfm_formrow{display:flex;flex-direction:column;gap:4px}
.vfm_input{padding:6px 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;min-width:0}
.vfm_input:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 70%,transparent);outline-offset:1px}
.vfm_ep{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:11px 13px;border-radius:11px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2) 62%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 86%,transparent)}
.vfm_epmain{display:flex;flex-direction:column;gap:3px;min-width:0}
.vfm_epname{font-weight:500}
.vfm_epurl{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vfm_epacts{display:flex;align-items:center;gap:6px;flex:none}

/* ── account rows and the sign-in dialog ──────────────────────────────── */
.vfm_accline{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;
  border-top:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 70%,transparent)}
.vfm_accline:first-child{border-top:none}
.vfm_accline .vfm_acctline{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vfm_accline .vfm_btn{padding:2px 7px;font-size:11px}
.vfm_modalbackdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  padding:24px;background:color-mix(in srgb,#000 42%,transparent)}
.vfm_modal{width:min(460px,100%);display:flex;flex-direction:column;gap:12px;padding:20px 22px;border-radius:16px;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  box-shadow:0 18px 60px color-mix(in srgb,#000 45%,transparent)}
.vfm_modalTitle{margin:0;font-size:14px;font-weight:600}
.vfm_modalurl{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
.vfm_modalacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
`

    // ── primitives ───────────────────────────────────────────────────────────

    /**
     * The card every block sits in.
     *
     * One shell rather than per-block markup: the three blocks must look like
     * they belong to the same page, and the only way to guarantee that is to
     * have exactly one place that draws a card.
     */
    function Card({ title, hint, action, children, collapsible = false, defaultOpen = true, summary }) {
      const [open, setOpen] = useState(defaultOpen)
      // `title` is a node, not a string, so the caller decides its own heading —
      // wrapping it here nested one <h3> inside another and doubled the markup.
      const heading = title === undefined ? null : (typeof title === 'string' ? h('h3', { className: 'vfm_cardtitle' }, title) : title)
      const head = title === undefined && action === undefined && summary === undefined
        ? null
        : h('div', { className: 'vfm_cardhead' },
          collapsible !== true
            ? heading
            : h('div', {
              className: 'vfm_click',
              role: 'button',
              tabIndex: 0,
              'aria-expanded': open ? 'true' : 'false',
              onClick: () => setOpen(!open),
              onKeyDown: event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(!open) }
              },
            },
            h('span', { className: 'vfm_chev', 'data-open': open ? '1' : '0' }),
            heading,
            summary === undefined ? null : h('span', { className: 'vfm_summary' }, summary)),
          action === undefined ? null : h('div', { className: 'vfm_meta' }, action))

      if (collapsible !== true) {
        return h('section', { className: 'vfm_card' }, head,
          hint === undefined ? null : h('p', { className: 'vfm_note' }, hint),
          children)
      }
      return h('section', { className: 'vfm_card', 'data-collapsed': open ? '0' : '1' }, head,
        open ? h('div', { className: 'vfm_collapsebody' },
          hint === undefined ? null : h('p', { className: 'vfm_note' }, hint),
          children) : null)
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
    /** The one-word verdict for a probe result. */
    function probeLabel(probe) {
      if (probe === null || typeof probe !== 'object') return t('models.probe.none')
      if (probe.state === 'ok') return t('models.probe.ok')
      if (probe.state === 'limited') return t('models.probe.limited')
      if (probe.state === 'unavailable') return t('models.probe.unavailable')
      return t('models.probe.unknown')
    }

    /** `nvidia/x` -> `NVIDIA`; unknown prefixes are title-cased. */
    const VENDOR_NAMES = {
      nvidia: 'NVIDIA', baidu: '百度', inclusionai: 'inclusionAI', liquid: 'LiquidAI',
      'particle-ai': 'Particle', recursive: 'Recursive', reflection: 'Reflection',
      stealth: 'Stealth', openrouter: 'OpenRouter', kilo: 'Kilo',
    }
    function vendorOf(id) {
      const prefix = String(id ?? '').split('/')[0]
      if (prefix === '' || prefix === id) return ''
      return VENDOR_NAMES[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }

    /** A short name for the automatic row and the picker label. */
    function shortName(name) {
      const value = String(name ?? '').trim()
      const after = value.includes(': ') ? value.slice(value.indexOf(': ') + 2) : value
      return after.replace(/\s*\(free\)\s*$/i, '').replace(/\s+/g, ' ').slice(0, 48)
    }

    /**
     * Which model to use.
     *
     * "Automatic" is first and is the default, because the honest answer to
     * "which of these thirteen should I pick" is "you should not have to pick".
     * Once the router has answered a turn, the row names the upstream it used
     * and its window/modality, so the choice is no longer opaque.
     */
    function ModelBlock({
      models, extraModels, auto, selected, onSelect, laneOk, onRecheck, busy,
      autoSwitch, onToggleAutoSwitch,
      defaultOpen = true, collapsed = false,
    }) {
      const [expanded, setExpanded] = useState(false)
      const roster = Array.isArray(models) ? models : []
      const extras = Array.isArray(extraModels) ? extraModels : []
      // The catalog already promotes the automatic model as its first row. Draw
      // the row once: two entries named "自动选择" read as a bug, not a choice.
      const automatic = roster.find(entry => entry.id === '' || entry.name === t('models.auto')
        || entry.id === 'kilo-auto/free')
      const others = roster.filter(entry => entry !== automatic)
      const shown = expanded ? others : others.slice(0, COLLAPSED_ROWS)
      const hidden = others.length - shown.length
      const total = others.length + 1 + extras.length

      const row = (id, name, meta, isAuto) => h('button', {
        type: 'button',
        className: 'vfm_row',
        'data-on': (selected === id || (isAuto && (selected === '' || selected === undefined))) ? '1' : undefined,
        onClick: () => onSelect?.(id),
      },
      h('span', { className: 'vfm_dot' }),
      h('span', { className: 'vfm_name', title: String(name ?? '').length > 24 ? name : undefined }, name),
      h('span', { className: 'vfm_meta' }, ...meta))

      const modelRow = entry => row(
        entry.id,
        entry.name ?? entry.id,
        [
          vendorOf(entry.id) === '' ? null : h('span', { className: 'vfm_tag' }, vendorOf(entry.id)),
          formatContext(entry.contextWindow) === '' ? null : h('span', { className: 'vfm_tag' }, formatContext(entry.contextWindow)),
          entry.vision === true ? h('span', { className: 'vfm_tag' }, t('models.vision')) : null,
          h('span', {
            className: 'vfm_probe',
            'data-state': entry.probe?.state ?? '',
            title: entry.probe?.reason ?? '',
          }, probeLabel(entry.probe)),
        ].filter(Boolean),
        false,
      )

      const autoMeta = auto !== null && auto !== undefined
        ? [
          h('span', { className: 'vfm_autoNow' }, t('models.autoCurrent', { name: shortName(auto.name) })),
          formatContext(auto.contextWindow) === '' ? null : h('span', { className: 'vfm_tag' }, formatContext(auto.contextWindow)),
          auto.vision === true ? h('span', { className: 'vfm_tag' }, t('models.vision')) : null,
        ].filter(Boolean)
        : [h('span', {}, t('models.autoUnknown'))]

      return h(Card, {
        title: h(BlockTitle, {}, t('models.title')),
        collapsible: true,
        defaultOpen,
        summary: collapsed
          ? `${t('models.count', { n: total })} · ${auto === null || auto === undefined ? t('models.auto') : shortName(auto.name)}`
          : undefined,
        action: [
          collapsed === true ? null : h('span', { className: 'vfm_count' }, t('models.count', { n: total })),
          h(Btn, { disabled: busy === true, onClick: () => onRecheck?.() },
            busy === true ? t('models.rechecking') : t('models.recheck')),
        ],
      },
      h('p', { className: 'vfm_note' }, t('models.source')),
      h('p', { className: 'vfm_note' }, t('models.switchHint')),
      h('div', { className: 'vfm_rows' },
        row('', t('models.auto'), autoMeta, true),
        ...shown.map(modelRow),
        ...(expanded ? extras.map(entry => row(
          entry.id,
          entry.name ?? entry.id,
          [
            h('span', { className: 'vfm_tag' }, entry.source === 'buddy' ? 'CodeBuddy' : 'Key'),
            formatContext(entry.contextWindow) === '' ? null : h('span', { className: 'vfm_tag' }, formatContext(entry.contextWindow)),
            entry.vision === true ? h('span', { className: 'vfm_tag' }, t('models.vision')) : null,
          ].filter(Boolean),
          false,
        )) : extras.length > 0
          ? [h('p', { className: 'vfm_note' }, `${t('models.extra')}：${extras.length}`)]
          : [])),

      hidden > 0 || (!expanded && extras.length > 0)
        ? h(Btn, { kind: 'quiet', onClick: () => setExpanded(true) }, t('models.more', { n: others.length + extras.length }))
        : (expanded && (others.length > COLLAPSED_ROWS || extras.length > 0)
          ? h(Btn, { kind: 'quiet', onClick: () => setExpanded(false) }, t('models.less'))
          : null),

      h('div', { className: 'vfm_field' },
        h('div', { className: 'vfm_toolmain' },
          h('span', { className: 'vfm_label' }, t('models.autoSwitch')),
          h('span', { className: 'vfm_toolhint' }, t('models.autoSwitchHint'))),
        h(Btn, {
          kind: autoSwitch !== false ? 'ghost' : 'primary',
          onClick: () => onToggleAutoSwitch?.(autoSwitch === false),
        }, autoSwitch !== false ? t('forward.off') : t('forward.on'))),

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
      Object.freeze({ id: 'qoder', label: 'Qoder 国际版' }),
      Object.freeze({ id: 'trae', label: 'TRAE' }),
      Object.freeze({ id: 'zcode', label: 'ZCode' }),
      Object.freeze({ id: 'minimax', label: 'MiniMax' }),
      Object.freeze({ id: 'lobsterai', label: '有道 LobsterAI' }),
      Object.freeze({ id: 'loomy', label: '讯飞 Loomy' }),
      Object.freeze({ id: 'cline', label: 'Cline' }),
      Object.freeze({ id: 'raccoon', label: '商汤 Raccoon', more: true }),
    ])

    /** The credit line for one account, when the provider published a balance. */
    function creditLine(providerId, accountId, credits) {
      const bucket = credits?.[providerId]
      if (bucket === null || bucket === undefined) return null
      const entry = Array.isArray(bucket.accounts) ? bucket.accounts.find(row => row?.id === accountId) : undefined
      if (entry === undefined) return null
      if (entry.credits === undefined && typeof entry.error === 'string' && entry.error !== '') {
        return h('span', { className: 'vfm_tag', title: entry.error }, t('accounts.creditError'))
      }
      const unit = typeof entry.unit === 'string' && entry.unit !== '' ? entry.unit : t('accounts.creditUnit')
      return h('span', { className: 'vfm_meta' },
        entry.credits === undefined
          ? null
          : h('span', { className: 'vfm_tag' }, t('accounts.credit', { n: entry.credits, unit })),
        entry.checkedIn === true
          ? h('span', { className: 'vfm_tag' }, t('accounts.checkedIn'))
          : null)
    }

    /**
     * One provider card.
     *
     * Shows every signed-in account under its provider, because the pack and
     * the Tencent lane both allow several. A provider answers exactly two
     * questions: who is signed in (with balance), and how do I change that.
     * The authorization URL lives in a dialog — a popup opened after an await is
     * what browsers block, and the user needs a visible link when that happens.
     */
    function providerRow(provider, entry, handlers, credits) {
      const status = entry !== null && typeof entry === 'object' ? entry : {}
      // A placeholder row appears the instant sign-in starts; showing it would
      // read as "already signed in" before the browser side has finished.
      const accounts = Array.isArray(status.accounts) ? status.accounts.filter(account => account?.pending !== true) : []
      const pending = status.state === 'pending'
      const error = typeof status.message === 'string' ? status.message : ''
      const claimable = provider.claimable === true
      const now = Date.now()

      const accountLines = accounts.map(account => {
        const expired = Number(account.expiresAt) > 0 && Number(account.expiresAt) < now
        const name = typeof account.nickname === 'string' && account.nickname !== '' ? account.nickname : account.id
        return h('div', { className: 'vfm_accline', key: account.id },
          h('span', { className: 'vfm_acctline' },
            name,
            expired ? ` · ${t('accounts.expired')}` : '',
            account.enabled === false ? ` · ${t('accounts.toggleOn')}` : ''),
          h('span', { className: 'vfm_meta' },
            creditLine(provider.id, account.id, credits),
            h(Btn, {
              kind: 'quiet',
              onClick: () => handlers.onToggle?.(provider.id, account.id, account.enabled === false),
            }, account.enabled === false ? t('accounts.toggleOn') : t('accounts.toggleOff')),
            h(Btn, { kind: 'quiet', onClick: () => handlers.onRemove?.(provider.id, account.id) }, t('accounts.delete'))))
      })

      const actions = h('div', { className: 'vfm_meta' },
        claimable && accounts.length > 0
          ? h(Btn, { disabled: status.claiming === true, onClick: () => handlers.onClaim?.(provider.id) },
            status.claiming === true ? t('accounts.claiming') : t('accounts.claim'))
          : null,
        h(Btn, {
          kind: accounts.length > 0 ? 'quiet' : 'ghost',
          disabled: pending,
          onClick: () => handlers.onLogin?.(provider),
        }, pending ? t('accounts.pending') : (accounts.length > 0 ? t('accounts.addAccount') : t('accounts.login'))))

      return h('div', { className: 'vfm_acct', 'data-state': accounts.length > 0 ? 'ready' : '' },
        h('div', { className: 'vfm_acctmain' },
          h('span', { className: 'vfm_acctname' }, provider.label),
          accounts.length > 0
            ? h('span', { className: 'vfm_meta' }, t('accounts.loggedIn', { n: accounts.length }))
            : h('span', { className: 'vfm_meta' }, t('accounts.notLogged'))),
        actions,
        pending || error !== ''
          ? h('div', { className: 'vfm_loginbox' },
            pending ? h('span', { className: 'vfm_acctline' }, t('accounts.waiting')) : null,
            error !== '' ? h('span', { className: 'vfm_error' }, t('accounts.failed', { message: truncate(error, 160) })) : null,
            pending && typeof status.loginUrl === 'string' && status.loginUrl !== ''
              ? h('div', { className: 'vfm_loginacts' },
                h(Btn, { onClick: () => handlers.onShowLogin?.(provider, status.loginUrl) }, t('loginModal.open')))
              : null,
            error !== ''
              ? h('div', { className: 'vfm_loginacts' },
                h(Btn, { kind: 'primary', onClick: () => handlers.onLogin?.(provider) }, t('accounts.retry')))
              : null)
          : null,
        accounts.length > 0 ? h('div', { className: 'vfm_acctlines' }, ...accountLines) : null)
    }

    /**
     * The accounts block.
     *
     * Signing in is the one step a user may not want to take, so it is presented
     * as optional: the sentence above the cards says the free models work
     * without it, and each card is a single button. Nothing here is required to
     * start chatting.
     */
    function AccountsBlock({
      providers, status, credits, creditsLoading, ownedElsewhere, claimFailedAt, onLogin, onClaim,
      onToggle, onRemove, onShowLogin, onRefreshCredits,
      defaultOpen = true, collapsed = false,
    }) {
      const [showMore, setShowMore] = useState(false)
      const roster = Array.isArray(providers) && providers.length > 0 ? providers : PROVIDERS
      const entries = status !== null && typeof status === 'object' ? status : {}
      const handlers = { onLogin, onClaim, onToggle, onRemove, onShowLogin }
      const primary = roster.filter(entry => entry.more !== true)
      const extra = roster.filter(entry => entry.more === true)
      const signedIn = roster.reduce((sum, entry) => sum
        + (Array.isArray(entry.accounts) ? entry.accounts.filter(account => account?.pending !== true).length : 0), 0)

      if (ownedElsewhere === true) {
        return h(Card, {
          title: h(BlockTitle, {}, t('accounts.title')),
          collapsible: true,
          defaultOpen,
          summary: t('accounts.ownedElsewhere'),
          hint: t('accounts.ownedElsewhere'),
        })
      }

      return h(Card, {
        title: h(BlockTitle, {}, t('accounts.title')),
        collapsible: true,
        defaultOpen,
        summary: collapsed
          ? (signedIn > 0 ? t('accounts.loggedIn', { n: signedIn }) : t('accounts.notLogged'))
          : undefined,
        hint: t('accounts.hint'),
        action: h(Btn, { kind: 'quiet', disabled: creditsLoading === true, onClick: () => onRefreshCredits?.() },
          creditsLoading === true ? t('accounts.creditsLoading') : t('accounts.refreshCredits')),
      },
      claimFailedAt !== undefined && claimFailedAt !== null
        ? h('div', { className: 'vfm_warn' },
          h('span', {}, t('accounts.claimFailed')),
          h(Btn, { onClick: () => onClaim?.('') }, t('accounts.retry')))
        : null,

      h('div', { className: 'vfm_accts' },
        ...primary.map(entry => providerRow(entry, { ...(entries[entry.id] ?? {}), accounts: entry.accounts }, handlers, credits)),
        showMore ? extra.map(entry => providerRow(entry, { ...(entries[entry.id] ?? {}), accounts: entry.accounts }, handlers, credits)) : []),

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
    function ForwardBlock({
      enabled, port, hasKey, key, model, onToggle, onCopy,
      defaultOpen = true, collapsed = false,
    }) {
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
        collapsible: true,
        defaultOpen,
        summary: collapsed
          ? (enabled === true ? `127.0.0.1:${port}` : t('forward.on'))
          : undefined,
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

    // ── keyed endpoints ──────────────────────────────────────────────────────

    /**
     * Vendor presets. Only the address is filled in: the key belongs to the user
     * and is never part of a preset.
     */
    const ENDPOINT_PRESETS = Object.freeze([
      Object.freeze({ id: 'ark', name: '豆包（火山方舟）', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' }),
      Object.freeze({ id: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1' }),
      Object.freeze({ id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' }),
      Object.freeze({ id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1' }),
      Object.freeze({ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' }),
    ])

    /**
     * Bring-your-own-key endpoints.
     *
     * Doubao has no anonymous free API, so the honest way to offer it is a key
     * the user already owns. The same block therefore covers every
     * OpenAI-compatible vendor instead of one bespoke protocol each.
     */
    function EndpointsBlock({ endpoints, defaultOpen = false, collapsed = false, onSummary }) {
      const [draft, setDraft] = useState(undefined)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [note, setNote] = useState('')
      const list = Array.isArray(endpoints) ? endpoints : []

      const openDraft = preset => setDraft({
        id: '',
        name: preset?.name ?? '',
        baseUrl: preset?.baseUrl ?? '',
        apiKey: '',
      })
      const setField = (key, value) => setDraft(current => ({ ...(current ?? {}), [key]: value }))

      const save = async () => {
        if (draft === undefined) return
        setBusy('save')
        setError('')
        setNote('')
        try {
          const payload = await api('/endpoints', {
            method: 'POST',
            body: { action: 'save', endpoint: draft },
            timeoutMs: 20000,
          })
          setDraft(undefined)
          setNote(t('endpoints.saved'))
          const summary = await api('/summary')
          onSummary?.(summary)
          return payload
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        } finally {
          setBusy('')
        }
      }

      const discover = async id => {
        setBusy(id)
        setError('')
        setNote('')
        try {
          await api('/endpoints', { method: 'POST', body: { action: 'models', id }, timeoutMs: 30000 })
          const summary = await api('/summary')
          onSummary?.(summary)
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        } finally {
          setBusy('')
        }
      }

      const remove = async id => {
        try {
          await api('/endpoints', { method: 'POST', body: { action: 'remove', id }, timeoutMs: 20000 })
          const summary = await api('/summary')
          onSummary?.(summary)
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        }
      }

      return h(Card, {
        title: h(BlockTitle, {}, t('endpoints.title')),
        collapsible: true,
        defaultOpen,
        summary: collapsed ? (list.length > 0 ? t('endpoints.models', { n: list.reduce((sum, row) => sum + (row.models?.length ?? 0), 0) }) : t('endpoints.empty')) : undefined,
        hint: t('endpoints.hint'),
        action: h(Btn, { kind: 'primary', onClick: () => openDraft() }, t('endpoints.add')),
      },
      error !== '' ? h('p', { className: 'vfm_error' }, t('endpoints.failed', { message: truncate(error, 200) })) : null,
      note !== '' ? h('p', { className: 'vfm_note' }, note) : null,

      list.length === 0 && draft === undefined
        ? h('p', { className: 'vfm_note' }, t('endpoints.empty'))
        : h('div', { className: 'vfm_accts' },
          ...list.map(row => h('div', { className: 'vfm_ep' },
            h('div', { className: 'vfm_epmain' },
              h('span', { className: 'vfm_epname' },
                row.name,
                row.hasKey === true ? h('span', { className: 'vfm_tag' }, t('endpoints.hasKey')) : null),
              h('span', { className: 'vfm_epurl', title: row.baseUrl }, row.baseUrl),
              h('span', { className: 'vfm_acctline' }, t('endpoints.models', { n: row.models?.length ?? 0 }))),
            h('div', { className: 'vfm_epacts' },
              h(Btn, { disabled: busy === row.id, onClick: () => void discover(row.id) },
                busy === row.id ? t('endpoints.discovering') : t('endpoints.discover')),
              h(Btn, { kind: 'quiet', onClick: () => void remove(row.id) }, t('endpoints.remove')))))),

      draft === undefined
        ? null
        : h('div', { className: 'vfm_form' },
          h('div', { className: 'vfm_loginacts' },
            ...ENDPOINT_PRESETS.map(preset => h(Btn, {
              key: preset.id,
              kind: 'quiet',
              onClick: () => setDraft(current => ({
                ...(current ?? {}),
                name: preset.name,
                baseUrl: preset.baseUrl,
              })),
            }, preset.name))),
          h('label', { className: 'vfm_formrow' },
            h('span', { className: 'vfm_label' }, t('endpoints.name')),
            h('input', {
              className: 'vfm_input',
              value: draft.name,
              placeholder: t('endpoints.name'),
              onChange: event => setField('name', event.target.value),
            })),
          h('label', { className: 'vfm_formrow' },
            h('span', { className: 'vfm_label' }, t('endpoints.baseUrl')),
            h('input', {
              className: 'vfm_input',
              value: draft.baseUrl,
              placeholder: 'https://…/v1',
              onChange: event => setField('baseUrl', event.target.value),
            })),
          h('label', { className: 'vfm_formrow' },
            h('span', { className: 'vfm_label' }, t('endpoints.apiKey')),
            h('input', {
              className: 'vfm_input',
              type: 'password',
              value: draft.apiKey,
              placeholder: 'sk-…',
              onChange: event => setField('apiKey', event.target.value),
            })),
          h('div', { className: 'vfm_loginacts' },
            h(Btn, { kind: 'primary', disabled: busy === 'save', onClick: () => void save() },
              busy === 'save' ? t('endpoints.saving') : t('endpoints.save')),
            h(Btn, { kind: 'quiet', onClick: () => setDraft(undefined) }, t('endpoints.cancel')))))
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
     * The sign-in dialog.
     *
     * It exists because the system browser is a convenience, not a guarantee: a
     * browser blocked from opening, a remote session, or a locked-down desktop
     * all need the URL itself. The link is selectable, copyable, and one more
     * click can open it.
     */
    function LoginModal({ dialog, onClose, onCopy, onOpen }) {
      const [copied, setCopied] = useState(false)
      if (dialog === null || dialog === undefined) return null
      const url = typeof dialog.url === 'string' ? dialog.url : ''
      return h('div', {
        className: 'vfm_modalbackdrop',
        onClick: event => { if (event.target === event.currentTarget) onClose?.() },
      },
      h('div', {
        className: 'vfm_modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('loginModal.title', { name: dialog.label ?? '' }),
      },
      h('h3', { className: 'vfm_modalTitle' }, t('loginModal.title', { name: dialog.label ?? '' })),
      h('p', { className: 'vfm_note' }, t('loginModal.hint')),
      h('p', { className: 'vfm_note' }, t('loginModal.waiting')),
      h('input', {
        className: 'vfm_input vfm_modalurl',
        readOnly: true,
        value: url,
        onFocus: event => event.target.select(),
        onClick: event => event.target.select(),
      }),
      h('div', { className: 'vfm_modalacts' },
        h(Btn, { kind: 'primary', onClick: () => onOpen?.(url) }, t('loginModal.open')),
        h(Btn, { onClick: () => { onCopy?.(url); setCopied(true) } }, copied ? t('loginModal.copied') : t('loginModal.copy')),
        h(Btn, { kind: 'quiet', onClick: () => onClose?.() }, t('loginModal.close')))))
    }

    /**
     * The settings page.
     *
     * One read on mount; the three blocks render from that single document, so
     * the user never sees a half-loaded page.
     */
    function SettingsPage() {
      const [summary, setSummary] = useState(undefined)
      const alive = useRef(true)
      useEffect(() => () => { alive.current = false }, [])
      const [error, setError] = useState('')
      const [selected, setSelected] = useState('')
      const [busy, setBusy] = useState(false)
      const [accountStatus, setAccountStatus] = useState({})
      const [credits, setCredits] = useState({})
      const [creditsLoading, setCreditsLoading] = useState(false)
      /** The sign-in dialog: { label, url } or undefined. */
      const [loginDialog, setLoginDialog] = useState(undefined)

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
          // Probing thirteen models takes longer than a normal status read.
          const payload = await api('/recheck', { method: 'POST', timeoutMs: 90_000 })
          if (payload?.summary !== undefined) setSummary(payload.summary)
          setError('')
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        } finally {
          setBusy(false)
        }
      }, [])

      /** Balances for every signed-in account, from both lanes. */
      const loadCredits = useCallback(async () => {
        setCreditsLoading(true)
        try {
          const payload = await api('/credits', { timeoutMs: 40_000 })
          setCredits(payload?.providers ?? {})
        } catch {
          /* the account cards keep whatever they showed before */
        } finally {
          setCreditsLoading(false)
        }
      }, [])

      // Balances are a second, slower read; paint the page first, then fill them.
      useEffect(() => { void loadCredits() }, [loadCredits])

      /** Stop a sign-in with a readable reason, and close its dialog. */
      const failLogin = useCallback((providerId, message) => {
        if (!alive.current) return
        setLoginDialog(undefined)
        setAccountStatus(current => ({ ...current, [providerId]: { message } }))
      }, [])

      /** Mark a sign-in as landed, then reload the account and balance lists. */
      const succeedLogin = useCallback(async () => {
        if (!alive.current) return
        setLoginDialog(undefined)
        await load()
        await loadCredits()
      }, [load, loadCredits])

      /**
       * Ask again until this account lands, then stop.
       *
       * The channel pack writes a placeholder account the instant a sign-in
       * starts and fills it in (nickname / expiry / refresh flag) when the
       * browser side finishes. Counting rows therefore proves nothing — the
       * placeholder is already there. This watches the specific account id the
       * pack returned, and treats a placeholder that disappears as a failed
       * sign-in (the pack removes it when authorization is refused).
       */
      const pollAccounts = useCallback(async (provider, accountId) => {
        const providerId = typeof provider === 'string' ? provider : provider.id
        const isBuddy = typeof provider === 'object' && provider.kind === 'buddy'
        const before = (summary?.accounts?.providers ?? [])
          .find(row => row.id === providerId)?.accounts?.filter(account => account?.pending !== true).length ?? 0
        const deadline = Date.now() + LOGIN_TIMEOUT_MS
        let missingSince = 0

        while (Date.now() < deadline && alive.current) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          if (!alive.current) return
          try {
            if (isBuddy) {
              const payload = await api('/summary')
              const mine = (payload?.accounts?.providers ?? []).find(row => row.id === providerId)
              const count = Array.isArray(mine?.accounts) ? mine.accounts.filter(account => account?.pending !== true).length : 0
              if (count > before) {
                setSummary(payload)
                await succeedLogin()
                return
              }
              continue
            }

            const payload = await api('/channel', {
              method: 'POST',
              body: { method: 'account.list', payload: { provider: providerId } },
              timeoutMs: 15000,
            })
            const accounts = payload?.value?.accounts ?? []

            if (typeof accountId !== 'string' || accountId === '') {
              if (accounts.length > before) { await succeedLogin(); return }
              continue
            }

            const mine = accounts.find(account => account?.id === accountId)
            if (mine === undefined) {
              // Placeholders are created synchronously; a missing one after a
              // short grace period means the pack dropped it (auth refused).
              if (missingSince === 0) missingSince = Date.now()
              if (Date.now() - missingSince > 20_000) {
                failLogin(providerId, '登录失败：账号未注册，或授权没有完成。')
                return
              }
              continue
            }
            missingSince = 0

            const nickname = typeof mine.nickname === 'string' ? mine.nickname : ''
            const expiresAt = Number(mine.expiresAt) || 0
            const refreshable = mine.refreshable === true
            if ((nickname !== '' && nickname !== accountId) || expiresAt > 0 || refreshable) {
              await succeedLogin()
              return
            }
          } catch { /* keep trying until the deadline */ }
        }
        if (alive.current) failLogin(providerId, '登录超时，请重试。')
      }, [failLogin, load, loadCredits, succeedLogin, summary])

      /**
       * Sign one account in.
       *
       * The host opens the authorization page in the system browser. A dialog
       * repeats the URL with copy, because a popup opened after an await is
       * exactly what browsers block — and that is when the user needs a link.
       */
      const login = useCallback(async provider => {
        const providerId = typeof provider === 'string' ? provider : provider.id
        const isBuddy = typeof provider === 'object' && provider.kind === 'buddy'
        setAccountStatus(current => ({ ...current, [providerId]: { state: 'pending' } }))
        try {
          const payload = isBuddy
            ? await api('/buddy', {
              method: 'POST',
              body: { action: 'login', product: providerId },
              timeoutMs: 30000,
            })
            : await api('/channel', {
              method: 'POST',
              body: { method: 'account.create', payload: { provider: providerId } },
              timeoutMs: 30000,
            })
          const url = payload?.value?.loginUrl ?? payload?.value?.url
          const accountId = typeof payload?.value?.accountId === 'string' ? payload.value.accountId : undefined
          if (typeof url === 'string' && url !== '') {
            setAccountStatus(current => ({ ...current, [providerId]: { state: 'pending', loginUrl: url } }))
            setLoginDialog({ label: provider.label ?? providerId, url })
            try { window.open(url, '_blank', 'noopener,noreferrer') } catch { /* the dialog has the link */ }
          }
          await pollAccounts(provider, accountId)
        } catch (cause) {
          if (alive.current) {
            setAccountStatus(current => ({ ...current, [providerId]: { message: String(cause?.message ?? cause) } }))
            setLoginDialog(undefined)
          }
        }
      }, [pollAccounts])

      /** Copy the authorization link and show "已复制" in the dialog. */
      const copyLogin = useCallback(url => {
        try { void navigator.clipboard?.writeText(url) } catch { /* the link is selectable */ }
      }, [])

      /** Claim credits for one provider, or every claimable one. */
      const claim = useCallback(async providerId => {
        const targets = providerId === ''
          ? (summary?.accounts?.providers ?? []).filter(row => row.claimable === true).map(row => row.id)
          : [providerId]
        setAccountStatus(current => {
          const next = { ...current }
          for (const key of targets) next[key] = { ...(next[key] ?? {}), claiming: true }
          return next
        })
        try {
          for (const target of targets) {
            await api('/credits/claim', { method: 'POST', body: { provider: target }, timeoutMs: 90000 })
          }
        } catch {
          /* the list below reloads whatever actually landed */
        }
        setAccountStatus(current => {
          const next = { ...current }
          for (const key of targets) next[key] = { ...(next[key] ?? {}), claiming: false }
          return next
        })
        await load()
        await loadCredits()
      }, [load, loadCredits, summary])

      /** Enable or disable one account on either lane. */
      const toggleAccount = useCallback(async (providerId, accountId, enabled) => {
        try {
          const provider = (summary?.accounts?.providers ?? []).find(row => row.id === providerId)
          if (provider?.kind === 'buddy') {
            await api('/buddy', { method: 'POST', body: { action: 'toggle', id: accountId, enabled }, timeoutMs: 20000 })
          } else {
            await api('/channel', {
              method: 'POST',
              body: { method: 'account.update', payload: { accountId, patch: { enabled } } },
              timeoutMs: 20000,
            })
          }
          await load()
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        }
      }, [load, summary])

      /** Remove one account on either lane. */
      const removeAccount = useCallback(async (providerId, accountId) => {
        try {
          const provider = (summary?.accounts?.providers ?? []).find(row => row.id === providerId)
          if (provider?.kind === 'buddy') {
            await api('/buddy', { method: 'POST', body: { action: 'remove', id: accountId }, timeoutMs: 20000 })
          } else {
            await api('/channel', {
              method: 'POST',
              body: { method: 'account.delete', payload: { accountId } },
              timeoutMs: 20000,
            })
          }
          await load()
          await loadCredits()
        } catch (cause) {
          setError(String(cause?.message ?? cause))
        }
      }, [load, loadCredits, summary])

      /** The automatic lane's retry switch. */
      const toggleAutoSwitch = useCallback(async enabled => {
        try {
          const payload = await api('/auto-switch', { method: 'POST', body: { enabled } })
          setSummary(current => (current === undefined ? current : { ...current, autoSwitch: payload?.autoSwitch === true }))
        } catch { /* keep the current reading */ }
      }, [])

      /** The master switch: takes the model group out of the picker. */
      const toggleEnabled = useCallback(async enabled => {
        try {
          const payload = await api('/enabled', { method: 'POST', body: { enabled: !enabled } })
          setSummary(current => (current === undefined ? current : { ...current, enabled: payload?.enabled === true }))
        } catch { /* the page keeps its current reading */ }
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
          extraModels: summary?.extras?.models ?? [],
          auto: summary?.lane?.auto ?? null,
          selected,
          onSelect: setSelected,
          laneOk: summary?.lane?.ok === true,
          onRecheck: () => void recheck(),
          autoSwitch: summary?.autoSwitch !== false,
          onToggleAutoSwitch: enabled => void toggleAutoSwitch(enabled),
          busy,
          collapsed: true,
          defaultOpen: false,
        }),
        h(AccountsBlock, {
          providers: summary?.accounts?.providers ?? [],
          status: accountStatus,
          credits,
          creditsLoading,
          ownedElsewhere: summary?.accounts?.state === 'owned-elsewhere',
          claimFailedAt: summary?.accounts?.claimFailedAt,
          onLogin: provider => void login(provider),
          onClaim: id => void claim(id),
          onToggle: (providerId, accountId, enabled) => void toggleAccount(providerId, accountId, enabled),
          onRemove: (providerId, accountId) => void removeAccount(providerId, accountId),
          onShowLogin: (provider, url) => setLoginDialog({ label: provider.label, url }),
          onRefreshCredits: () => void loadCredits(),
          collapsed: true,
          defaultOpen: false,
        }),
        h(EndpointsBlock, {
          endpoints: summary?.extras?.endpoints ?? [],
          onSummary: payload => setSummary(payload),
          collapsed: true,
          defaultOpen: false,
        }),
        h(LoginModal, {
          dialog: loginDialog,
          onClose: () => setLoginDialog(undefined),
          onCopy: url => copyLogin(url),
          onOpen: url => { try { window.open(url, '_blank', 'noopener,noreferrer') } catch { /* the URL is selectable */ } },
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
      EndpointsBlock, LoginModal, creditLine, probeLabel, vendorOf, shortName,
      cursorSnippet, claudeCodeSnippet, degradedMessage, DegradedBanner, PROVIDERS, SettingsPage, DICT, CSS, API,
      Card, BlockTitle, Btn, StatusDot, ToolCard, truncate }
    return module.exports
  },
})
