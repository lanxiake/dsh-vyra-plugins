// Plugin market: a Plugins-page tab that browses market index sources as cards
// and installs, updates, uninstalls, enables or disables them in bulk.
//
// HOW IT WORKS. Every read and every change goes through the Host's own Remote
// namespaces, so this plugin needs no Host half of its own:
//
//   remote.pluginMarket   reads the configured index sources — the very same
//                         list `Settings -> Plugins -> Index sources` edits —
//                         and answers search pages. Each index is fetched,
//                         parsed, searched on, and annotated with this profile's
//                         install state on the Host, which is also why an index
//                         whose host sends no CORS header stays browsable.
//   remote.pluginManager  performs every change (install, git update, remove,
//                         enable, disable). The Host serialises them behind its
//                         own profile lock, so a bulk action can issue them in
//                         order without racing itself.
//
// Both namespaces are ordinary Cordis services. Declaring them in the `inject`
// this bundle exports is the whole requirement; `dsh.client.inject` in
// package.json is a different thing (bundle arrival order) and grants nothing.
// A browser page calls as the owner peer, so no access policy stands between
// this plugin and the Host's own management methods.
//
// Updates use `updateBundle`, which only accepts a version the Host lists with
// `update: true` — a Git copy whose target pins another commit of the same
// repository directory. An installed copy with no such version offers no update
// action, exactly as the built-in Discover tab treats it.
window.__ModuleLoader__.load({
  id: 'vyra-plugin-market',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React

    const NS = 'vyra-plugin-market'

    // QQ 交流群二维码，内联避免依赖 host 静态路由。
    const QQ_GROUP_IMG = 'data:image/png;base64,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';

    /** Our own market index: the source this plugin exists to browse. */
    const HOME_SOURCE = 'https://lanxiake.github.io/dsh-vyra-plugins/index.json'

    /** Entries loaded before "Show more", and loaded again by each press. */
    const PAGE = 60

    /** Typing pause before a query is sent. */
    const TEXT_DELAY_MS = 250

    // ---------------------------------------------------------------------------
    // Pure logic over market records (`__internal` exposes it to the test).
    // ---------------------------------------------------------------------------

    /**
     * Resolve a market-localized text in the active language.
     * @param {unknown} text - a string, a `{ locale: string }` map, or nothing.
     * @param {string} lang - active language id.
     * @returns {string} the text, or an empty string.
     */
    function marketText(text, lang) {
      if (text === undefined || text === null) return ''
      if (typeof text === 'string') return text
      return text[lang] ?? text.en ?? Object.values(text)[0] ?? ''
    }

    /**
     * The version a card presents: the index's default when it names one,
     * otherwise the newest it lists.
     * @param {object} entry - a market listing entry.
     * @returns {object|undefined} the version.
     */
    function presentedVersion(entry) {
      return entry.versions.find((version) => version.version === entry.defaultVersion) ?? entry.versions[0]
    }

    /**
     * Whether the running DSH accepts a version.
     * @param {object} version - a market listing version.
     * @returns {boolean} compatible, or covered by an exemption.
     */
    function installable(version) {
      return version.compatibility.compatible || version.compatibility.exempted
    }

    /**
     * Whether a version carries a SemVer prerelease suffix.
     * @param {string} version - the version string.
     * @returns {boolean} whether it is a prerelease.
     */
    function prerelease(version) {
      return String(version).split('+')[0].includes('-')
    }

    /**
     * The version an update would install: the Host accepts `updateBundle` only
     * for a version it flags `update`, so that flag is the whole test.
     * @param {object} entry - a market listing entry.
     * @returns {object|undefined} the update target.
     */
    function updateTarget(entry) {
      return entry.versions.find((version) => version.update && installable(version))
    }

    /**
     * How one entry stands next to the profile.
     * @param {object} entry - a market listing entry.
     * @returns {'provided'|'available'|'updatable'|'installed'} the state.
     */
    function entryState(entry) {
      const status = entry.installation.status
      if (status === 'provided') return 'provided'
      if (status === 'not-installed') return 'available'
      return updateTarget(entry) === undefined ? 'installed' : 'updatable'
    }

    /**
     * The version a card's single install-or-update button acts on.
     * @param {object} entry - a market listing entry.
     * @returns {object|undefined} the version, absent when there is no action.
     */
    function actionVersion(entry) {
      const state = entryState(entry)
      if (state === 'available') {
        const version = presentedVersion(entry)
        return version !== undefined && installable(version) ? version : undefined
      }
      return state === 'updatable' ? updateTarget(entry) : undefined
    }

    /**
     * Split a selection into the work each bulk action would do.
     *
     * Every action reads the whole selection and lists only what it applies to,
     * so a mixed selection never blocks a batch. A bundle the DSH installation
     * provides is not this profile's to remove, and a read-only bundle is not
     * its to switch: both are left out rather than reported as failures.
     * @param {ReadonlyArray<{entry: object, bundle: object|undefined}>} selected - selection with each entry's profile bundle.
     * @returns {{install: object[], update: object[], uninstall: object[], enable: object[], disable: object[]}} the plan.
     */
    function planBulk(selected) {
      const plan = { install: [], update: [], uninstall: [], enable: [], disable: [] }
      for (const { entry, bundle } of selected) {
        const state = entryState(entry)
        if (state === 'available') {
          const version = presentedVersion(entry)
          if (version !== undefined && installable(version)) plan.install.push({ entry, version })
        } else if (state === 'updatable') {
          const version = updateTarget(entry)
          if (version !== undefined) plan.update.push({ entry, version })
        }
        if (state !== 'provided' && bundle !== undefined && bundle.removable !== false) {
          plan.uninstall.push({ entry, bundle })
        }
        if (bundle !== undefined && bundle.readOnlyReason === undefined) {
          (bundle.enabled ? plan.disable : plan.enable).push({ entry, bundle })
        }
      }
      return plan
    }

    /**
     * Replace a query's text, moving between index and relevance order the way
     * the built-in Discover tab does: typing gains relevance, clearing returns
     * to index order, and an order chosen while text is present is kept.
     * @param {object} query - the current query.
     * @param {string} text - the new text.
     * @returns {object} the query with its text and order.
     */
    function withText(query, text) {
      const [was, blank] = [query.text.trim() === '', text.trim() === '']
      const sort = was && !blank && query.sort.kind === 'index'
        ? { kind: 'relevance' }
        : blank && query.sort.kind === 'relevance' ? { kind: 'index' } : query.sort
      return { ...query, text, sort }
    }

    /**
     * Answers worth asking again. pnpm's store is content-addressed, so a
     * retry resumes from whatever the failed run already fetched instead of
     * starting over — which is why a transport hiccup costs a pause, not the
     * whole download. A permanent answer (not a bundle, a refused version, a
     * missing package) is never retried: only the road to GitHub is.
     */
    const TRANSIENT_FAILURE = /ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|FETCH_ERROR|socket hang up|Could not resolve host|unable to access|ERR_PNPM_META_FETCH_FAIL|ERR_PNPM_FETCH_(?:5\d\d|TIMEOUT)|timed out/i

    /** Pause before each retry, in order; the last attempt is the last entry plus one. */
    const RETRY_DELAY_MS = [1000, 3000, 8000]

    /**
     * Turn what a batch will touch into the orders one press issues.
     *
     * An install and an update reach different Host methods: `installBundle`
     * refuses a package the profile already holds, and only `updateBundle`
     * replaces one in place. A selected installed entry the index flags a newer
     * reachable version for therefore becomes an update order, and everything
     * else an install order.
     * @param {object} plan - a {@link planBulk} result.
     * @param {string} action - install, update, uninstall, enable or disable.
     * @returns {ReadonlyArray<object>} one order per subject.
     */
    function orders(plan, action) {
      if (action === 'uninstall') return plan.uninstall.map(({ entry, bundle }) => ({ action, entry, bundle }))
      if (action === 'enable' || action === 'disable') return plan[action].map(({ entry, bundle }) => ({ action, entry, bundle }))
      const installing = plan.install.map(({ entry, version }) => ({ action: 'install', entry, version }))
      const updating = plan.update.map(({ entry, version }) => ({ action: 'update', entry, version }))
      // An update replaces an installed copy, so it runs after the installs
      // that add new ones — never before a removal that would take its target.
      return action === 'update' ? updating : installing.concat(updating)
    }

    // ---------------------------------------------------------------------------
    // Dictionaries
    // ---------------------------------------------------------------------------

    const ZH = {
      title: '插件市场',
      search: '搜索插件',
      refresh: '刷新',
      loading: '加载中…',
      retry: '重试',
      more: '显示更多',
      empty: '这个市场源里没有插件。',
      noMatch: '没有匹配的插件。',
      loadFailed: '读取市场源失败。',
      sourceFailed: '读取市场源列表失败。',
      all: '全部',
      sortBy: '排序',
      sortIndex: '默认',
      sortPublished: '发布时间',
      sortRelevance: '相关度',
      switchDirection: '改为{dir}',
      ascending: '降序',
      descending: '升序',
      install: '安装',
      update: '更新',
      uninstall: '卸载',
      enable: '启用',
      disable: '停用',
      open: '详情',
      tagInstalled: '已安装',
      tagUpdate: '可更新',
      tagProvided: '客户端自带',
      tagDisabled: '已停用',
      tagIncompatible: '版本不兼容',
      tagPrerelease: '预览版',
      selected: '已选 {n} 项',
      selectPage: '全选本页',
      clear: '取消选择',
      bulkApply: '安装 / 更新 {n}',
      bulkUninstall: '卸载 {n}',
      bulkEnable: '启用 {n}',
      bulkDisable: '停用 {n}',
      confirmInstall: '安装或更新 {n} 个插件',
      confirmInstallBody: '它们从下面列出的来源安装，装完即启用。',
      confirmUninstall: '卸载 {n} 个插件',
      confirmUninstallBody: '它们提供的功能会随之消失，已装的文件会被移除。',
      cancel: '取消',
      ok: '确定',
      actInstall: '安装',
      actUpdate: '更新',
      actUninstall: '卸载',
      actEnable: '启用',
      actDisable: '停用',
      progress: '{action} {done}/{total}',
      done: '完成 {ok} 项',
      failed: '失败 {n} 项',
      needRestart: '{n} 项需要重启客户端才生效',
      needBuilds: '{n} 项需要先允许构建脚本，请到「已安装」页安装',
      failedTag: '失败',
      failureHint: '失败原因在卡片的「失败」标签上，悬停可看，点击可复制',
      copyError: '复制错误',
      copied: '已复制',
      clearError: '忽略',
      sourcesTitle: '市场源',
      manageSources: '管理市场源…',
      addSource: '添加',
      sourcePlaceholder: 'https://example.com/index.json',
      remove: '移除',
      sourceBody: '与「设置 → 插件 → 索引源」是同一份配置，两处看到的一样。',
      sourceTrust: '索引是第三方内容：标题、图标与安装来源都由索引自己声明，客户端只校验格式。只添加你信任的源。',
      noSources: '还没有配置市场源',
      version: '版本',
      author: '作者',
      published: '发布',
      total: '共 {n} 个插件',
    }

    const EN = {
      title: 'Plugin market',
      search: 'Search plugins',
      refresh: 'Refresh',
      loading: 'Loading…',
      retry: 'Retry',
      more: 'Show more',
      empty: 'This market lists no plugins.',
      noMatch: 'No matching plugin.',
      loadFailed: 'Could not read the market.',
      sourceFailed: 'Could not read the market sources.',
      all: 'All',
      sortBy: 'Sort',
      sortIndex: 'Default',
      sortPublished: 'Publish date',
      sortRelevance: 'Relevance',
      switchDirection: 'Switch to {dir}',
      ascending: 'descending',
      descending: 'ascending',
      install: 'Install',
      update: 'Update',
      uninstall: 'Uninstall',
      enable: 'Enable',
      disable: 'Disable',
      open: 'Details',
      tagInstalled: 'Installed',
      tagUpdate: 'Update available',
      tagProvided: 'Provided by the client',
      tagDisabled: 'Disabled',
      tagIncompatible: 'Incompatible version',
      tagPrerelease: 'Prerelease',
      selected: '{n} selected',
      selectPage: 'Select page',
      clear: 'Clear',
      bulkApply: 'Install / update {n}',
      bulkUninstall: 'Uninstall {n}',
      bulkEnable: 'Enable {n}',
      bulkDisable: 'Disable {n}',
      confirmInstall: 'Install or update {n} plugins',
      confirmInstallBody: 'They install from the sources listed below and are enabled once installed.',
      confirmUninstall: 'Uninstall {n} plugins',
      confirmUninstallBody: 'What they provide goes away and their installed files are removed.',
      cancel: 'Cancel',
      ok: 'Confirm',
      actInstall: 'Installing',
      actUpdate: 'Updating',
      actUninstall: 'Uninstalling',
      actEnable: 'Enabling',
      actDisable: 'Disabling',
      progress: '{action} {done}/{total}',
      done: '{ok} done',
      failed: '{n} failed',
      needRestart: '{n} need a client restart to take effect',
      needBuilds: '{n} need their build scripts allowed first — install them from the Installed tab',
      failedTag: 'Failed',
      failureHint: 'The reason is on each card\'s Failed tag — hover to read it, click to copy',
      copyError: 'Copy error',
      copied: 'Copied',
      clearError: 'Dismiss',
      sourcesTitle: 'Market sources',
      manageSources: 'Manage sources…',
      addSource: 'Add',
      sourcePlaceholder: 'https://example.com/index.json',
      remove: 'Remove',
      sourceBody: 'The same list Settings -> Plugins -> Index sources edits; both show the same thing.',
      sourceTrust: 'An index is third-party content: it declares its own titles, icons and install sources, and the client checks only the format. Add sources you trust.',
      noSources: 'No market source is configured',
      version: 'Version',
      author: 'Author',
      published: 'Published',
      total: '{n} plugins',
    }

    // ---------------------------------------------------------------------------
    // Icons
    // ---------------------------------------------------------------------------

    const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

    function icon(size, children) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', ...stroke }, children)
    }

    const SearchIcon = ({ size = 15 }) => icon(size, h('circle', { cx: 11, cy: 11, r: 7 }))
    const ChevronIcon = ({ size = 12 }) => icon(size, h('path', { d: 'M6 9l6 6 6-6' }))
    const TrashIcon = ({ size = 14 }) => icon(size, [
      h('path', { key: 'a', d: 'M4 7h16' }),
      h('path', { key: 'b', d: 'M10 7V5h4v2' }),
      h('path', { key: 'c', d: 'M6 7l1 13h10l1-13' }),
    ])
    const SlidersIcon = ({ size = 14 }) => icon(size, [
      h('path', { key: 'a', d: 'M4 8h9' }),
      h('path', { key: 'b', d: 'M19 8h1' }),
      h('path', { key: 'c', d: 'M4 16h4' }),
      h('path', { key: 'd', d: 'M14 16h6' }),
      h('circle', { key: 'e', cx: 16, cy: 8, r: 2 }),
      h('circle', { key: 'f', cx: 11, cy: 16, r: 2 }),
    ])
    const RefreshIcon = ({ size = 15 }) => icon(size, [
      h('path', { key: 'a', d: 'M20 11a8 8 0 1 0-2.34 6.34' }),
      h('path', { key: 'b', d: 'M20 5v6h-6' }),
    ])
    const BoxIcon = ({ size = 20 }) => icon(size, [
      h('path', { key: 'a', d: 'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }),
      h('path', { key: 'b', d: 'M3.3 7L12 12l8.7-5' }),
      h('path', { key: 'c', d: 'M12 22V12' }),
    ])
    // ---------------------------------------------------------------------------
    // Styles, expressed as DSH alias tokens so every theme repaints us
    // ---------------------------------------------------------------------------

    const BORDER = '1px solid var(--dsw-alias-border-l2)'

    const S = {
      root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '10px', padding: '14px 16px 0' },
      toolbar: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      host: { position: 'relative', display: 'flex' },
      sourceBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px',
        border: BORDER, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        font: 'inherit', fontSize: '12.5px', cursor: 'pointer', maxWidth: '260px',
      },
      ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      searchWrap: { position: 'relative', flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center' },
      searchIcon: { position: 'absolute', left: '9px', display: 'flex', color: 'var(--dsw-alias-label-tertiary)' },
      input: {
        width: '100%', height: '32px', padding: '0 10px 0 30px', borderRadius: '8px', font: 'inherit', fontSize: '12.5px',
        border: BORDER, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', outline: 'none',
      },
      plainInput: {
        flex: 1, minWidth: 0, height: '32px', padding: '0 10px', borderRadius: '8px', font: 'inherit', fontSize: '12.5px',
        border: BORDER, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', outline: 'none',
      },
      // The button tokens are the ones the client's own Button uses:
      // `brand-primary` is a colour for text and strokes, never a filled
      // surface, and `brand-text` is near-black — pairing them painted a dark
      // button whose label matched its own fill and could not be read.
      btn: (primary, disabled) => ({
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 11px', borderRadius: '8px',
        font: 'inherit', fontSize: '12.5px', flex: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        border: `1px solid ${primary ? 'transparent' : 'var(--dsw-alias-border-l2)'}`,
        background: primary ? 'var(--dsw-alias-button-primary-fill)' : 'transparent',
        color: primary ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-label-primary)',
      }),
      squareBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', padding: 0,
        borderRadius: '8px', border: BORDER, background: 'transparent', color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer', flex: 'none',
      },
      menu: (right) => ({
        position: 'absolute', top: 'calc(100% + 6px)', left: right ? 'auto' : 0, right: right ? 0 : 'auto', zIndex: 60,
        minWidth: '220px', padding: '4px', display: 'flex', flexDirection: 'column', borderRadius: '10px',
        border: BORDER, background: 'var(--dsw-alias-bg-layer-1)', boxShadow: '0 10px 28px rgba(0,0,0,.22)',
      }),
      menuItem: (active) => ({
        padding: '7px 10px', borderRadius: '7px', border: 0, background: 'transparent', font: 'inherit', fontSize: '12.5px',
        color: active ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-label-primary)',
        fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }),
      menuSep: { height: '1px', background: 'var(--dsw-alias-border-l2)', margin: '4px 2px' },
      pills: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
      // The client's own Pill marks its active member with the ghost-active
      // pair; a brand-primary border and text is for links, not selections.
      pill: (active) => ({
        padding: '3px 11px', borderRadius: '999px', font: 'inherit', fontSize: '12px', cursor: 'pointer',
        border: `1px solid ${active ? 'var(--dsw-alias-button-ghost-active-border)' : 'var(--dsw-alias-border-l2)'}`,
        background: active ? 'var(--dsw-alias-button-ghost-active-fill)' : 'var(--dsw-alias-bg-layer-2)',
        color: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
      }),
      scroll: { flex: 1, minHeight: 0, overflowY: 'auto' },
      grid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '10px',
        margin: 0, padding: 0, listStyle: 'none',
      },
      card: (picked) => ({
        display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '12px', minWidth: 0,
        border: `1px solid ${picked ? 'var(--dsw-alias-border-selected)' : 'var(--dsw-alias-border-l2)'}`,
        background: picked ? 'var(--dsw-alias-bg-multi-select)' : 'var(--dsw-alias-card-fill)',
      }),
      cardTop: { display: 'flex', alignItems: 'flex-start', gap: '9px', minWidth: 0 },
      artwork: {
        width: '38px', height: '38px', borderRadius: '9px', flex: 'none', overflow: 'hidden', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      head: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
      name: { fontSize: '13.5px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      mono: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      desc: {
        fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', margin: 0,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      },
      tags: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
      tag: (tone) => ({
        padding: '1px 8px', borderRadius: '999px', fontSize: '11px', lineHeight: '17px', flex: 'none',
        border: `1px solid ${tone === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : tone === 'ok' ? 'var(--dsw-alias-state-success-primary)' : tone === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-border-l2)'}`,
        color: tone === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : tone === 'ok' ? 'var(--dsw-alias-state-success-primary)' : tone === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-tertiary)',
        background: 'transparent',
      }),
      meta: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', margin: 0 },
      actions: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto' },
      check: { width: '15px', height: '15px', flex: 'none', marginTop: '2px', cursor: 'pointer', accentColor: 'var(--dsw-alias-brand-primary)' },
      state: { padding: '28px 8px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: '13px' },
      error: { color: 'var(--dsw-alias-state-error-primary)' },
      bar: {
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '9px 12px', borderRadius: '10px',
        border: BORDER, background: 'var(--dsw-alias-bg-layer-2)', flex: 'none', fontSize: '12.5px',
        color: 'var(--dsw-alias-label-primary)',
      },
      bulkBar: { borderColor: 'var(--dsw-alias-border-selected)' },
      grow: { marginRight: 'auto' },
      spinner: {
        width: '13px', height: '13px', flex: 'none', borderRadius: '50%', border: '2px solid var(--dsw-alias-border-l2)',
        borderTopColor: 'var(--dsw-alias-brand-primary)', animation: 'vpm-spin .9s linear infinite',
      },
      backdrop: {
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.45)',
      },
      modal: {
        width: 'min(560px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', display: 'flex',
        flexDirection: 'column', gap: '10px', padding: '16px 18px', borderRadius: '12px', border: BORDER,
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
      },
      modalTitle: { fontSize: '14px', fontWeight: 600, margin: 0 },
      modalBody: { fontSize: '12.5px', lineHeight: '19px', color: 'var(--dsw-alias-label-secondary)', margin: 0 },
      modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' },
      list: { display: 'flex', flexDirection: 'column', gap: '6px', margin: 0, padding: 0, listStyle: 'none' },
      row: {
        display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px',
        border: BORDER, background: 'var(--dsw-alias-bg-layer-2)', minWidth: 0,
      },
      rowMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
    }

    const KEYFRAMES = 'vpm-keyframes'
    if (typeof document !== 'undefined' && document.querySelector(`style[data-${KEYFRAMES}]`) === null) {
      const tag = document.createElement('style')
      tag.dataset[KEYFRAMES.replace(/-(\w)/g, (_all, char) => char.toUpperCase())] = '1'
      tag.textContent = '@keyframes vpm-spin{to{transform:rotate(360deg)}}'
      document.head.appendChild(tag)
    }

    // ---------------------------------------------------------------------------
    // Small pieces
    // ---------------------------------------------------------------------------

    /** Close a dropdown when a pointer lands outside its anchor. */
    function useMenu(open, close) {
      const ref = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onDown = (event) => { if (ref.current !== null && !ref.current.contains(event.target)) close() }
        document.addEventListener('pointerdown', onDown)
        return () => { document.removeEventListener('pointerdown', onDown) }
      }, [open, close])
      return ref
    }

    /** A card's artwork, falling back to the box glyph when it cannot load. */
    function Artwork({ src }) {
      const [failed, setFailed] = useState(null)
      if (src === undefined || src === null || src === '' || src === failed) return h(BoxIcon, {})
      return h('img', {
        style: S.img, src, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer',
        onError: () => { setFailed(src) },
      })
    }

    /** Where a version installs from, as one short line. */
    function sourceLine(version) {
      const { source } = version
      if (source.type === 'npm') return source.registry === undefined ? 'npm' : source.registry
      return `${source.url}@${source.commit.slice(0, 8)}${source.path === undefined ? '' : ` ${source.path}`}`
    }

    /** Format a publish timestamp in the active language. */
    function formatDate(timestamp, lang) {
      try {
        return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(timestamp * 1000))
      } catch {
        return ''
      }
    }

    /** A dialog closed by Escape, its backdrop, or its own close control. */
    function Modal({ title, children, footer, onClose }) {
      useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('keydown', onKey) }
      }, [onClose])
      return h('div', {
        style: S.backdrop,
        onPointerDown: (event) => { if (event.target === event.currentTarget) onClose() },
      },
      h('div', { style: S.modal, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h3', { style: S.modalTitle }, title),
        children,
        footer === undefined ? null : h('div', { style: S.modalFooter }, footer)))
    }

    /** The confirmation a bulk change runs behind, naming exactly what it will do. */
    function ConfirmDialog({ action, orders, lang, t, text, onCancel, onRun }) {
      const uninstall = action === 'uninstall'
      return h(Modal, {
        title: t(uninstall ? 'confirmUninstall' : 'confirmInstall', { n: orders.length }),
        onClose: onCancel,
        footer: [
          h('button', { key: 'cancel', style: S.btn(false, false), onClick: onCancel }, t('cancel')),
          h('button', { key: 'run', style: S.btn(true, false), onClick: onRun }, t('ok')),
        ],
      },
      h('p', { style: S.modalBody }, t(uninstall ? 'confirmUninstallBody' : 'confirmInstallBody')),
      h('ul', { style: S.list },
        orders.map(({ entry, version }) => h('li', { key: entry.name, style: S.row },
          h('div', { style: S.rowMain },
            h('span', { style: S.name }, entry.title === undefined ? entry.name : text(entry.title)),
            h('span', { style: S.mono },
              version === undefined ? entry.name : `${version.version} · ${sourceLine(version)}`))))))
    }

    /** Read and write the configured market sources. */
    function SourcesDialog({ sources, t, text, saving, failure, onAdd, onRemove, onClose }) {
      const [draft, setDraft] = useState('')
      const submit = (event) => {
        event.preventDefault()
        const url = draft.trim()
        if (url === '' || saving) return
        setDraft('')
        onAdd(url)
      }
      return h(Modal, {
        title: t('sourcesTitle'), onClose,
        footer: h('button', { style: S.btn(false, false), onClick: onClose }, t('cancel')),
      },
      h('p', { style: S.modalBody }, t('sourceBody')),
      sources.length === 0 ? null : h('ul', { style: S.list },
        sources.map((source) => h('li', { key: source.url, style: S.row },
          h('div', { style: S.rowMain },
            h('span', { style: S.name }, source.title === undefined ? source.url : text(source.title)),
            h('span', { style: S.mono }, source.url),
            source.error === undefined ? null : h('span', { style: { ...S.mono, ...S.error } }, source.error)),
          h('button', {
            style: S.squareBtn, title: t('remove'), 'aria-label': `${t('remove')} ${source.url}`,
            disabled: saving, onClick: () => { onRemove(source.url) },
          }, h(TrashIcon, {}))))),
      h('form', { style: { display: 'flex', gap: '8px' }, onSubmit: submit },
        h('input', {
          style: S.plainInput, value: draft, spellCheck: false, disabled: saving,
          placeholder: t('sourcePlaceholder'), 'aria-label': t('sourcePlaceholder'),
          onChange: (event) => { setDraft(event.target.value) },
        }),
        h('button', {
          type: 'submit', style: S.btn(true, saving || draft.trim() === ''),
          disabled: saving || draft.trim() === '',
        }, t('addSource'))),
      failure === null ? null : h('p', { style: { ...S.modalBody, ...S.error }, role: 'alert' }, failure),
      h('p', { style: { ...S.bar, margin: 0, fontSize: '12px' } }, t('sourceTrust')))
    }

    /**
     * One entry: artwork, title, state, description, and its actions. A failure
     * this session left on the entry stays here as a tag whose tooltip holds the
     * whole reason and whose press copies it.
     */
    function Card({ entry, bundle, lang, t, text, busy, picked, failure, copied, onPick, onRun, onConfirm, onOpen, onDetails, onCopyFailure, onClearFailure }) {
      const title = entry.title === undefined ? entry.name : text(entry.title)
      const state = entryState(entry)
      const shown = presentedVersion(entry)
      const version = actionVersion(entry)
      const date = shown === undefined ? '' : formatDate(shown.publishTimestamp, lang)
      const incompatible = state === 'available' && version === undefined
      const installed = state === 'installed' || state === 'updatable'
      const actions = []
      // 详情对未安装的条目也开放：卡片本身的数据 + GitHub 上的 README。
      if (onDetails !== undefined) {
        actions.push(h('button', {
          key: 'detail', style: S.btn(false, false), disabled: busy,
          onClick: () => { onDetails(entry) },
        }, lang === 'zh' ? '详情' : 'Details'))
      }
      if (version !== undefined) {
        const update = state === 'updatable'
        actions.push(h('button', {
          key: 'act', style: S.btn(true, busy), disabled: busy,
          onClick: () => { onRun([{ action: update ? 'update' : 'install', entry, version }]) },
        }, t(update ? 'update' : 'install')))
      }
      if (installed) {
        // The bulk plan already decides what may be removed and switched; a
        // card offers exactly the same actions, so the two never disagree about
        // a bundle the Host reports as unreadable or shipped.
        const removable = bundle !== undefined && bundle.removable !== false
        if (removable) {
          actions.push(h('button', {
            key: 'remove', style: S.btn(false, busy), disabled: busy,
            onClick: () => { onConfirm({ action: 'uninstall', orders: [{ action: 'uninstall', entry, bundle }] }) },
          }, t('uninstall')))
        }
        if (bundle !== undefined && bundle.readOnlyReason === undefined) {
          const disable = bundle.enabled
          actions.push(h('button', {
            key: 'toggle', style: S.btn(false, busy), disabled: busy,
            onClick: () => { onRun([{ action: disable ? 'disable' : 'enable', entry, bundle }]) },
          }, t(disable ? 'disable' : 'enable')))
        }
        if (onOpen !== undefined) {
          actions.push(h('button', {
            key: 'open', style: S.btn(false, busy), disabled: busy,
            onClick: () => { onOpen(entry.name) },
          }, t('open')))
        }
      }
      const tags = []
      if (failure !== undefined) {
        // Hover reads the whole reason; a press copies it; the × drops the tag
        // once it has been dealt with, so a card is not marked forever.
        tags.push(h('button', {
          key: 'f', type: 'button', title: failure, 'aria-label': `${t('failedTag')}: ${failure}`,
          style: { ...S.tag('error'), cursor: 'pointer', font: 'inherit', margin: 0 },
          onClick: () => { void onCopyFailure(entry.name, failure) },
        }, copied === entry.name ? t('copied') : t('failedTag')))
        tags.push(h('button', {
          key: 'fc', type: 'button', title: t('clearError'), 'aria-label': t('clearError'),
          style: { ...S.tag('error'), cursor: 'pointer', font: 'inherit', margin: 0, padding: '1px 6px' },
          onClick: () => { onClearFailure(entry.name) },
        }, '×'))
      }
      if (state === 'provided') tags.push(h('span', { key: 'p', style: S.tag('neutral') }, t('tagProvided')))
      if (state === 'updatable') tags.push(h('span', { key: 'u', style: S.tag('warn') }, t('tagUpdate')))
      if (state === 'installed') tags.push(h('span', { key: 'i', style: S.tag('ok') }, t(bundle !== undefined && bundle.enabled === false ? 'tagDisabled' : 'tagInstalled')))
      if (incompatible) tags.push(h('span', { key: 'x', style: S.tag('warn') }, t('tagIncompatible')))
      if (shown !== undefined && prerelease(shown.version)) tags.push(h('span', { key: 'r', style: S.tag('neutral') }, t('tagPrerelease')))
      return h('li', { style: S.card(picked) },
        h('div', { style: S.cardTop },
          h('input', {
            type: 'checkbox', style: S.check, checked: picked, disabled: busy,
            'aria-label': title, onChange: onPick,
          }),
          h('span', { style: S.artwork }, h(Artwork, { src: entry.icon })),
          h('div', { style: S.head },
            h('span', { style: S.name, title }, title),
            h('span', { style: S.mono }, entry.name))),
        tags.length === 0 ? null : h('div', { style: S.tags }, tags),
        entry.description === undefined ? null : h('p', { style: S.desc }, text(entry.description)),
        h('p', { style: S.meta }, [
          shown === undefined ? null : `${t('version')} ${shown.version}`,
          entry.author === undefined ? null : `${t('author')} ${entry.author}`,
          date === '' ? null : `${t('published')} ${date}`,
        ].filter(Boolean).join(' · ')),
        h('div', { style: S.actions }, actions))
    }

    /** Resolve `owner/repo` from the entry's repository or homepage, for fetching its README. */
    function repoOfEntry(entry) {
      const repo = entry.repository
      const url = typeof repo === 'string' ? repo : (repo && repo.url) || entry.homepage || ''
      const m = String(url).match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/)
      return m ? m[1].replace(/\.git$/, '') : ''
    }

    /**
     * Market entry detail. Works before install: the card carries title, description,
     * author and repository, and the README is fetched from GitHub (jsDelivr first —
     * reachable in CN — then raw.githubusercontent.com).
     */
    function DetailDialog({ entry, lang, text, onClose }) {
      const title = entry.title === undefined ? entry.name : text(entry.title)
      const repo = repoOfEntry(entry)
      const [view, setView] = useState({ loading: true, md: '', error: '' })

      useEffect(() => {
        let alive = true
        if (!repo) {
          setView({ loading: false, md: '', error: '' })
          return () => { alive = false }
        }
        const urls = [
          `https://cdn.jsdelivr.net/gh/${repo}@HEAD/README.md`,
          `https://raw.githubusercontent.com/${repo}/HEAD/README.md`,
        ]
        void (async () => {
          for (const url of urls) {
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
              if (res.ok) {
                const md = await res.text()
                if (alive) setView({ loading: false, md, error: '' })
                return
              }
            } catch {
              // 换下一个源
            }
          }
          if (alive) {
            setView({ loading: false, md: '', error: lang === 'zh' ? 'README 读取失败，可以打开来源页查看' : 'Could not load the README; open the homepage instead' })
          }
        })()
        return () => { alive = false }
      }, [repo, lang])

      const shown = presentedVersion(entry)
      const facts = [
        shown === undefined ? null : `${lang === 'zh' ? '版本' : 'version'} ${shown.version}`,
        entry.author === undefined ? null : `${lang === 'zh' ? '作者' : 'author'} ${entry.author}`,
        entry.metadata && entry.metadata.category ? entry.metadata.category : null,
      ].filter(Boolean)

      return h('div', { style: S.backdrop, onClick: onClose },
        h('div', {
          style: { ...S.modal, width: 'min(760px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', margin: 0 },
          onClick: (e) => e.stopPropagation(),
        },
          h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 'none' } },
            h('span', { style: S.artwork }, h(Artwork, { src: entry.icon })),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('h3', { style: S.modalTitle }, title),
              h('span', { style: S.mono }, entry.name)),
            h('button', { style: S.btn(false, false), 'aria-label': 'close', onClick: onClose }, '×')),
          entry.description === undefined ? null : h('p', { style: { ...S.modalBody, marginTop: '10px', flex: 'none' } }, text(entry.description)),
          facts.length === 0 ? null : h('p', { style: { ...S.meta, marginTop: '6px', flex: 'none' } }, facts.join(' · ')),
          h('div', { style: { flex: 1, overflow: 'auto', marginTop: '12px', borderRadius: '10px', background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)', padding: '12px 14px', minHeight: '180px' } },
            view.loading
              ? h('div', { style: { fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary)' } }, lang === 'zh' ? '正在读取 README…' : 'Loading README…')
              : view.error
                ? h('div', { style: { fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary)' } }, view.error)
                : h('pre', { style: { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' } }, view.md)),
          h('div', { style: { flex: 'none', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l1)', display: 'flex', alignItems: 'center', gap: '14px' } },
            QQ_GROUP_IMG && h('img', { src: QQ_GROUP_IMG, alt: 'QQ 群 1121362543', style: { width: '92px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)' } }),
            h('div', { style: { flex: 1, fontSize: '12.5px', lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } },
              '有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。'))
        )
      )
    }

    // ---------------------------------------------------------------------------
    // The tab
    // ---------------------------------------------------------------------------

    function MarketTab(props) {
      const { t, remote, useLocale } = props
      const lang = useLocale((snapshot) => snapshot.active)
      const text = useCallback((value) => marketText(value, lang), [lang])

      const [sources, setSources] = useState(null)
      const [sourcesFailure, setSourcesFailure] = useState(null)
      const [activeUrl, setActiveUrl] = useState(null)
      const [listing, setListing] = useState(null)
      const [draft, setDraft] = useState('')
      const [query, setQuery] = useState({ text: '', category: null, sort: { kind: 'index' } })
      const [bundles, setBundles] = useState(() => new Map())
      const [picked, setPicked] = useState(() => new Set())
      const [menu, setMenu] = useState(null)
      const [sourcesOpen, setSourcesOpen] = useState(false)
      const [savingSources, setSavingSources] = useState(false)
      const [sourceFailure, setSourceFailure] = useState(null)
      const [confirm, setConfirm] = useState(null)
      const [detailEntry, setDetailEntry] = useState(null)
      const [running, setRunning] = useState(null)
      const [outcome, setOutcome] = useState(null)
      /** Per-entry failure text, kept on the card after the summary bar is gone. */
      const [failures, setFailures] = useState(() => new Map())
      /** The entry whose failure text was just copied, for the tag's own feedback. */
      const [copied, setCopied] = useState(null)

      const alive = useRef(true)
      useEffect(() => () => { alive.current = false }, [])

      // One batch at a time. `running` below is state, so two presses landing
      // before React re-renders would both pass its check and interleave two
      // batches; a ref cannot be raced that way. It is released at the end of
      // the run, and never on unmount because nothing is left to press.
      const batch = useRef(false)

      /** Read the configured sources; an empty list adopts our own market. */
      const loadSources = useCallback(async (adopt) => {
        const answer = await remote.pluginMarket.listIndexes()
        if (!alive.current) return
        if (!answer.ok) {
          setSourcesFailure(answer.error.message)
          setSources(null)
          return
        }
        setSourcesFailure(null)
        let list = answer.value
        // A fresh profile configures no source at all, which leaves this tab
        // with nothing to browse. This plugin exists for one market, so it adds
        // its own — through the same Setting the official page edits — instead
        // of showing an empty list the user has to fill in by hand.
        if (list.length === 0 && adopt) {
          const added = await remote.pluginMarket.setIndexes([HOME_SOURCE])
          if (!alive.current) return
          if (added.ok) {
            const reread = await remote.pluginMarket.listIndexes()
            if (!alive.current) return
            list = reread.ok ? reread.value : []
          }
        }
        setSources(list)
        // The tab opens on this plugin's own market rather than whichever source
        // happens to be configured first: a profile typically lists a
        // third-party index ahead of ours, and this tab exists to browse ours.
        // The menu still switches to any other source, and a choice already
        // made is kept.
        setActiveUrl((current) => {
          if (list.some((item) => item.url === current)) return current
          return list.find((item) => item.url === HOME_SOURCE)?.url ?? list[0]?.url ?? null
        })
      }, [remote])

      /** Read the installed bundles: enabled state, removability, and read-only reason. */
      const loadBundles = useCallback(async () => {
        const answer = await remote.pluginManager.listBundles()
        if (!alive.current || !answer.ok) return
        setBundles(new Map(answer.value.map((bundle) => [bundle.name, bundle])))
      }, [remote])

      /** Load one page of a source, replacing the results it answers. */
      const loadRef = useRef(null)
      const load = useCallback(async (url, next, offset, limit, fetchedAt, depth = 0, refresh = false) => {
        setListing((current) => ({
          url, query: next, status: 'loading',
          value: current !== null && current.url === url ? current.value : null, failure: null,
        }))
        const answer = await remote.pluginMarket.search(url, {
          ...next.text.trim() === '' ? {} : { text: next.text },
          ...next.category === null ? {} : { category: next.category },
          sort: next.sort, offset, limit,
          ...fetchedAt === undefined ? {} : { fetchedAt },
          // The Host reuses one index document for ten minutes unless a read says
          // otherwise. The refresh button exists to see a just-published plugin,
          // so it has to bypass that cache; without this it silently re-reads it.
          ...refresh ? { refresh: true } : {},
        })
        if (!alive.current) return
        if (!answer.ok) {
          setListing({ url, query: next, status: 'error', value: null, failure: answer.error.message })
          return
        }
        const page = answer.value
        // A different `fetchedAt` is a different document: the pages already
        // shown answer the replaced one, so a later page restarts from the top
        // instead of appending to results that no longer belong together. The
        // depth bound stops an index that replaces its document on every page
        // from looping forever.
        if (offset > 0 && page.fetchedAt !== fetchedAt) {
          if (depth < 1) await loadRef.current(url, next, 0, Math.max(offset + limit, PAGE), undefined, depth + 1)
          return
        }
        setListing((current) => {
          const kept = offset > 0 && current !== null && current.url === url && current.value !== null
            ? current.value.entries
            : []
          return { url, query: next, status: 'ready', failure: null, value: { ...page, entries: [...kept, ...page.entries] } }
        })
      }, [remote])
      loadRef.current = load

      useEffect(() => { void loadSources(true) }, [loadSources])
      useEffect(() => { void loadBundles() }, [loadBundles])

      // The Host announces every completed change, so a change made anywhere —
      // this tab, the Installed tab, or an agent — lands here too.
      useEffect(() => {
        const off = remote.$on('plugin-manager/changed', () => {
          void loadBundles()
          setListing((current) => {
            if (current === null || current.status !== 'ready' || current.value === null) return current
            void load(current.url, current.query, 0, Math.max(current.value.entries.length, PAGE), undefined)
            return current
          })
        })
        return off
      }, [remote, loadBundles, load])

      useEffect(() => {
        if (activeUrl !== null) void load(activeUrl, query, 0, PAGE, undefined)
      }, [activeUrl])

      // Typing is debounced. The effect reads the listing and loader through
      // refs, so a page settling mid-typing does not restart the pause and the
      // query never waits on events it has nothing to do with.
      const liveRef = useRef(null)
      liveRef.current = { listing, load, query }
      useEffect(() => {
        if (draft === query.text) return undefined
        const timer = setTimeout(() => {
          const live = liveRef.current
          const next = withText(live.query, draft)
          setQuery(next)
          if (live.listing !== null) void live.load(live.listing.url, next, 0, PAGE, undefined)
        }, TEXT_DELAY_MS)
        return () => { clearTimeout(timer) }
      }, [draft, query.text])

      const entries = listing === null || listing.value === null ? [] : listing.value.entries
      const declarations = listing === null || listing.value === null ? undefined : listing.value.metadata
      const categories = useMemo(() => {
        if (declarations === undefined) return []
        const collator = new Intl.Collator(lang)
        return Object.entries(declarations.categories)
          .map(([id, declaration]) => ({ id, title: text(declaration.title) }))
          .sort((left, right) => collator.compare(left.title, right.title))
      }, [declarations, lang, text])

      const selected = useMemo(() => entries
        .filter((entry) => picked.has(entry.name))
        .map((entry) => ({ entry, bundle: bundles.get(entry.name) })), [entries, picked, bundles])
      const plan = useMemo(() => planBulk(selected), [selected])

      /** Apply a query everywhere at once: field, state, and loaded results. */
      const search = useCallback((next) => {
        setQuery(next)
        setDraft(next.text)
        if (listing !== null) void load(listing.url, next, 0, PAGE, undefined)
      }, [listing, load])

      /**
       * Copy a failure's text, so it can be pasted into a report. The clipboard
       * is optional (an insecure origin has none), so a refusal is swallowed
       * rather than thrown at a person who only pressed a tag.
       * @param {string} name - the entry whose failure this is.
       * @param {string} reason - the text to copy.
       */
      const copyFailure = useCallback(async (name, reason) => {
        try {
          await navigator.clipboard.writeText(reason)
          setCopied(name)
          setTimeout(() => { if (alive.current) setCopied((current) => current === name ? null : current) }, 1600)
        } catch {
          /* No clipboard here; the tag's tooltip still shows the whole text. */
        }
      }, [])

      /** Drop one entry's failure tag once it has been read. */
      const clearFailure = useCallback((name) => {
        setFailures((current) => {
          if (!current.has(name)) return current
          const next = new Map(current)
          next.delete(name)
          return next
        })
      }, [])

      /**
       * Issue one order and read the Host's answer without judging it.
       * @param {object} order - one order from {@link orders}.
       * @param {object} remote - the injected Host namespaces.
       * @returns {Promise<{pass: boolean, reason?: string, result?: object}>} the outcome.
       */
      async function perform(order, remote) {
        let answer
        try {
          if (order.action === 'install') {
            answer = await remote.pluginManager.installBundle(order.version.install.spec, {
              enabled: true, saveExact: true,
              ...order.version.install.registry === undefined ? {} : { registry: order.version.install.registry },
            })
          } else if (order.action === 'update') {
            answer = await remote.pluginManager.updateBundle(order.entry.name, order.version.version, {
              spec: order.version.install.spec,
            })
          } else if (order.action === 'uninstall') {
            answer = await remote.pluginManager.removeBundle(order.entry.name)
          } else {
            answer = await remote.pluginManager.setBundleEnabled(order.entry.name, order.action === 'enable')
          }
        } catch (error) {
          return { pass: false, reason: String(error?.message ?? error) }
        }
        if (!answer.ok) return { pass: false, reason: answer.error.message }
        // An update answers with its own step result and restores the removed
        // version when the replacement fails; both wrap one change result.
        const result = order.action === 'update' ? answer.value.result : answer.value
        if (result === undefined || result.application === 'failed') {
          // The run's own output says more than the code does — a failed
          // import, a refused build script — so it is part of the reason.
          return {
            pass: false,
            reason: [result?.error?.diagnostic, result?.packageResult?.output].filter(Boolean).join('\n'),
            result,
          }
        }
        return { pass: true, result }
      }

      /**
       * Run a batch: every order is attempted in turn, so one failure never
       * hides the entries that follow it.
       * @param {ReadonlyArray<object>} list - orders from {@link orders}.
       */
      const run = useCallback(async (list) => {
        if (list.length === 0 || batch.current) return
        batch.current = true
        setOutcome(null)
        setConfirm(null)
        setFailures(new Map())
        let ok = 0
        let restart = 0
        let builds = 0
        // Keyed by entry, so the card that failed keeps its reason after the
        // summary bar is gone — which is where the person looks for it.
        const failed = new Map()
        for (let index = 0; index < list.length; index += 1) {
          const order = list[index]
          if (!alive.current) return
          setRunning({
            action: t(`act${order.action[0].toUpperCase()}${order.action.slice(1)}`),
            done: index, total: list.length, name: order.entry.name,
          })
          let outcome = null
          for (let attempt = 0; attempt <= RETRY_DELAY_MS.length; attempt += 1) {
            outcome = await perform(order, remote)
            if (outcome.pass) break
            // A permanent answer is the run's verdict, not the road's: retrying
            // "not a bundle" or a refused version only wastes the person's time.
            if (attempt === RETRY_DELAY_MS.length || !TRANSIENT_FAILURE.test(outcome.reason ?? '')) break
            if (!alive.current) return
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS[attempt]))
          }
          if (!alive.current) return
          if (!outcome.pass) {
            failed.set(order.entry.name, outcome.reason === '' ? t('loadFailed') : outcome.reason)
            continue
          }
          ok += 1
          if (outcome.result.application === 'restart-required') restart += 1
          if ((outcome.result.pendingBuilds?.length ?? 0) > 0) builds += 1
        }
        // A writer outside this batch — another tab, the Host's own plugin
        // page, the third-party console's maintenance run — can rewrite
        // `package.json` between two orders. The next pnpm run then prunes the
        // package it no longer finds declared, so a batch silently loses a
        // plugin it had just installed. Assert the state the batch meant to
        // leave and put each lost entry back once; a second failure is
        // reported like any other instead of retried forever.
        if (alive.current) {
          const kept = list.filter((order) => !failed.has(order.entry.name)
            && order.action !== 'uninstall' && order.action !== 'disable')
          if (kept.length > 0) {
            const answer = await remote.pluginManager.listBundles()
            if (answer.ok) {
              const present = new Map(answer.value.map((bundle) => [bundle.name, bundle]))
              let repaired = false
              for (const order of kept) {
                if (present.get(order.entry.name)?.enabled === true) continue
                repaired = true
                try {
                  if (order.action === 'install' || order.action === 'update') {
                    await remote.pluginManager.installBundle(order.version.install.spec, { enabled: true, saveExact: true })
                  } else {
                    await remote.pluginManager.setBundleEnabled(order.entry.name, true)
                  }
                } catch (error) {
                  // Installed but switched off: re-enabling is all it needs.
                  try { await remote.pluginManager.setBundleEnabled(order.entry.name, true) }
                  catch (again) { failed.set(order.entry.name, String(again?.message ?? again)) }
                }
              }
              // Only a second read tells whether the repair landed. A package
              // that is back is not a failure, whatever the attempt said —
              // `listBundles` omits plain dependencies, so an absence there is
              // reported only when the re-enable that follows also failed.
              if (repaired) {
                const settled = await remote.pluginManager.listBundles()
                if (settled.ok) {
                  const now = new Map(settled.value.map((bundle) => [bundle.name, bundle]))
                  for (const order of kept) {
                    if (now.get(order.entry.name)?.enabled === true) failed.delete(order.entry.name)
                  }
                }
              }
            }
          }
        }
        batch.current = false
        if (!alive.current) return
        setRunning(null)
        setPicked(new Set())
        setFailures(failed)
        setOutcome({ ok, failed: [...failed.keys()].length, restart, builds })
        await loadBundles()
      }, [remote, running, t, loadBundles])

      // Every hook runs before any early return, so the count never changes
      // between the first render and the loaded one (React error #310).
      const busy = running !== null
      const sourceMenu = useMenu(menu === 'source', () => { setMenu(null) })
      const sortMenu = useMenu(menu === 'sort', () => { setMenu(null) })
      // This plugin's own market leads the source menu, without touching the
      // configured order: the list belongs to Settings, and reordering it here
      // would silently rewrite a preference the user set elsewhere.
      const orderedSources = sources === null ? [] : [...sources].sort((left, right) => {
        if (left.url === HOME_SOURCE) return -1
        if (right.url === HOME_SOURCE) return 1
        return 0
      })
      const active = sources === null ? undefined : sources.find((source) => source.url === activeUrl)
      const market = active === undefined
        ? (activeUrl ?? t('noSources'))
        : (active.title === undefined ? activeUrl : text(active.title))
      const pagePicked = entries.length > 0 && entries.every((entry) => picked.has(entry.name))
      const directed = query.sort.kind === 'published' || query.sort.kind === 'key'
      const buildable = plan.install.length + plan.update.length

      if (sources === null && sourcesFailure === null) return h('div', { style: S.state }, t('loading'))
      if (sourcesFailure !== null) {
        return h('div', { style: S.state },
          h('p', { style: S.error, role: 'alert' }, t('sourceFailed')),
          h('p', { style: S.meta }, sourcesFailure),
          h('button', { style: S.btn(false, false), onClick: () => { setSourcesFailure(null); void loadSources(true) } }, t('retry')))
      }

      const rows = []
      if (outcome !== null) {
        rows.push(h('p', {
          key: 'outcome', role: 'status',
          style: { ...S.bar, ...outcome.failed > 0 ? S.error : {} },
        }, [
          t('done', { ok: outcome.ok }),
          outcome.failed === 0 ? null : t('failed', { n: outcome.failed }),
          outcome.restart === 0 ? null : t('needRestart', { n: outcome.restart }),
          outcome.builds === 0 ? null : t('needBuilds', { n: outcome.builds }),
          outcome.failed === 0 ? null : t('failureHint'),
        ].filter(Boolean)))
      }
      if (running !== null) {
        rows.push(h('div', { key: 'running', style: S.bar, role: 'status' },
          h('span', { style: S.spinner }),
          `${t('progress', { action: running.action, done: running.done, total: running.total })} — ${running.name}`))
      }
      if (picked.size > 0) {
        const bulk = []
        if (buildable > 0) bulk.push(h('button', {
          key: 'apply', style: S.btn(true, busy), disabled: busy,
          // An update is confirmed as one, so the dialog names the versions
          // being replaced rather than only what will be installed.
          onClick: () => { setConfirm({ action: plan.install.length === 0 ? 'update' : 'install', orders: orders(plan, plan.install.length === 0 ? 'update' : 'install') }) },
        }, t('bulkApply', { n: buildable })))
        if (plan.uninstall.length > 0) bulk.push(h('button', {
          key: 'remove', style: S.btn(false, busy), disabled: busy,
          onClick: () => { setConfirm({ action: 'uninstall', orders: orders(plan, 'uninstall') }) },
        }, t('bulkUninstall', { n: plan.uninstall.length })))
        if (plan.enable.length > 0) bulk.push(h('button', {
          key: 'enable', style: S.btn(false, busy), disabled: busy,
          onClick: () => { void run(orders(plan, 'enable')) },
        }, t('bulkEnable', { n: plan.enable.length })))
        if (plan.disable.length > 0) bulk.push(h('button', {
          key: 'disable', style: S.btn(false, busy), disabled: busy,
          onClick: () => { void run(orders(plan, 'disable')) },
        }, t('bulkDisable', { n: plan.disable.length })))
        bulk.push(h('button', {
          key: 'clear', style: S.btn(false, busy), disabled: busy,
          onClick: () => { setPicked(new Set()) },
        }, t('clear')))
        rows.push(h('div', { key: 'bulk', style: { ...S.bar, ...S.bulkBar } },
          h('span', { style: { fontWeight: 600, ...S.grow } }, t('selected', { n: picked.size })), bulk))
      }

      return h('div', { style: S.root },
        h('div', { style: S.toolbar },
          h('div', { style: S.host, ref: sourceMenu },
            h('button', {
              style: S.sourceBtn, 'aria-haspopup': 'menu', 'aria-expanded': menu === 'source',
              onClick: () => { setMenu(menu === 'source' ? null : 'source') },
            }, h('span', { style: S.ellipsis }, market), h(ChevronIcon, {})),
            menu !== 'source' ? null : h('div', { style: S.menu(false), role: 'menu' },
              orderedSources.map((source) => h('button', {
                key: source.url, role: 'menuitem', title: source.url,
                style: S.menuItem(source.url === activeUrl),
                onClick: () => { setMenu(null); setActiveUrl(source.url) },
              }, source.title === undefined ? source.url : text(source.title))),
              h('div', { style: S.menuSep }),
              h('button', {
                role: 'menuitem', style: S.menuItem(false),
                onClick: () => { setMenu(null); setSourcesOpen(true) },
              }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, h(SlidersIcon, {}), t('manageSources'))))),
          h('div', { style: S.searchWrap },
            h('span', { style: S.searchIcon }, h(SearchIcon, {})),
            h('input', {
              style: S.input, type: 'search', value: draft, spellCheck: false,
              placeholder: t('search'), 'aria-label': t('search'),
              onChange: (event) => { setDraft(event.target.value) },
            })),
          h('div', { style: S.host, ref: sortMenu },
            h('button', {
              style: S.btn(false, false), 'aria-haspopup': 'menu', 'aria-expanded': menu === 'sort',
              onClick: () => { setMenu(menu === 'sort' ? null : 'sort') },
            }, t('sortBy'), h(ChevronIcon, {})),
            menu !== 'sort' ? null : h('div', { style: S.menu(true), role: 'menu' },
              [
                { kind: 'index', label: t('sortIndex') },
                ...draft.trim() === '' ? [] : [{ kind: 'relevance', label: t('sortRelevance') }],
                { kind: 'published', label: t('sortPublished') },
              ].map((option) => h('button', {
                key: option.kind, role: 'menuitemradio', 'aria-checked': query.sort.kind === option.kind,
                style: S.menuItem(query.sort.kind === option.kind),
                onClick: () => {
                  setMenu(null)
                  search({ ...query, sort: option.kind === 'published' ? { kind: 'published', direction: 'desc' } : { kind: option.kind } })
                },
              }, option.label)))),
          directed ? h('button', {
            style: S.btn(false, busy), disabled: busy,
            onClick: () => { search({ ...query, sort: { ...query.sort, direction: query.sort.direction === 'asc' ? 'desc' : 'asc' } }) },
          }, t('switchDirection', { dir: t(query.sort.direction === 'asc' ? 'ascending' : 'descending') })) : null,
          h('button', {
            style: S.squareBtn, title: t('refresh'), 'aria-label': t('refresh'),
            disabled: busy || activeUrl === null,
            onClick: () => { if (listing !== null) void load(listing.url, query, 0, PAGE, undefined, 0, true) },
          }, h(RefreshIcon, {}))),
        categories.length === 0 ? null : h('div', { style: S.pills, role: 'group', 'aria-label': t('all') },
          h('button', {
            style: S.pill(query.category === null), 'aria-pressed': query.category === null,
            onClick: () => { search({ ...query, category: null }) },
          }, t('all')),
          categories.map((category) => h('button', {
            key: category.id, style: S.pill(query.category === category.id), 'aria-pressed': query.category === category.id,
            onClick: () => { search({ ...query, category: category.id }) },
          }, category.title))),
        rows,
        h('div', { style: S.scroll },
          listing === null ? h('div', { style: S.state }, t('loading'))
            : listing.status === 'error' ? h('div', { style: S.state },
              h('p', { style: S.error, role: 'alert' }, t('loadFailed')),
              h('p', { style: S.meta }, listing.failure),
              h('button', { style: S.btn(false, false), onClick: () => { void load(listing.url, listing.query, 0, PAGE, undefined, 0, true) } }, t('retry')))
              : entries.length === 0 ? h('div', { style: S.state },
                t(listing.status === 'loading' ? 'loading' : listing.query.text.trim() === '' && listing.query.category === null ? 'empty' : 'noMatch'))
                : h('div', null,
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 8px' } },
                    h('label', { style: { ...S.meta, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } },
                      h('input', {
                        type: 'checkbox', style: S.check, checked: pagePicked, disabled: busy,
                        onChange: () => { setPicked(pagePicked ? new Set() : new Set(entries.map((entry) => entry.name))) },
                      }),
                      t('selectPage')),
                    h('span', { style: S.meta }, t('total', { n: listing.value.total }))),
                  h('ul', { style: S.grid },
                    entries.map((entry) => h(Card, {
                      key: entry.name, entry, bundle: bundles.get(entry.name), lang, t, text, busy,
                      picked: picked.has(entry.name),
                      failure: failures.get(entry.name),
                      copied,
                      onCopyFailure: copyFailure,
                      onClearFailure: clearFailure,
                      onPick: () => {
                        setPicked((current) => {
                          const next = new Set(current)
                          if (next.has(entry.name)) next.delete(entry.name)
                          else next.add(entry.name)
                          return next
                        })
                      },
                      onRun: (list) => { void run(list) },
                      onConfirm: setConfirm,
                      onOpen: props.openPackage,
                      onDetails: setDetailEntry,
                    }))),
                  listing.value.nextOffset === null ? null : h('div', { style: { display: 'flex', justifyContent: 'center', margin: '12px 0' } },
                    h('button', {
                      style: S.btn(false, busy || listing.status !== 'ready'),
                      disabled: busy || listing.status !== 'ready',
                      onClick: () => { void load(listing.url, listing.query, entries.length, PAGE, listing.value.fetchedAt) },
                    }, t('more'))))),
        h('div', { style: { height: '14px', flex: 'none' } }),
        confirm === null ? null : h(ConfirmDialog, {
          action: confirm.action, orders: confirm.orders, lang, t, text,
          onCancel: () => { setConfirm(null) },
          onRun: () => { void run(confirm.orders) },
        }),
        detailEntry === null ? null : h(DetailDialog, {
          entry: detailEntry, lang, text,
          onClose: () => { setDetailEntry(null) },
        }),
        sourcesOpen ? h(SourcesDialog, {
          sources, t, text, saving: savingSources, failure: sourceFailure,
          onAdd: async (url) => {
            setSavingSources(true)
            setSourceFailure(null)
            const answer = await remote.pluginMarket.setIndexes([...sources.map((source) => source.url), url])
            if (!alive.current) return
            setSavingSources(false)
            if (!answer.ok) { setSourceFailure(answer.error.message); return }
            await loadSources(false)
          },
          onRemove: async (url) => {
            setSavingSources(true)
            setSourceFailure(null)
            const answer = await remote.pluginMarket.setIndexes(sources.map((source) => source.url).filter((item) => item !== url))
            if (!alive.current) return
            setSavingSources(false)
            if (!answer.ok) { setSourceFailure(answer.error.message); return }
            await loadSources(false)
          },
          onClose: () => { setSourcesOpen(false) },
        }) : null)
    }

    return {
      __internal: { marketText, presentedVersion, installable, prerelease, updateTarget, entryState, actionVersion, planBulk, orders, withText, TRANSIENT_FAILURE, RETRY_DELAY_MS },
      inject: ['slots', 'locale', 'remote', 'remote.pluginMarket', 'remote.pluginManager'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), `${NS}: dictionaries`)
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('plugins.tab', () => ctx.slots.register({
          name: 'plugins.tab',
          id: 'market',
          order: 10,
          locale: NS,
          label: () => t('title'),
          inject: () => ({ remote: ctx.remote, hooks: { locale: ctx.locale } }),
        }, MarketTab))
      },
    }
  },
})
