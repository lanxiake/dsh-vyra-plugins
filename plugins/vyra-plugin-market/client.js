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


    /** Our own market index: the source this plugin exists to browse. */
    const HOME_SOURCE = 'https://lanxiake.github.io/dsh-vyra-plugins/index.json'

    /** Veyra 市场源候选列表（国内优先） */
    const VEYRA_SOURCES = [
      'https://ghproxy.net/https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/master/docs/index.json',
      'https://fastly.jsdelivr.net/gh/lanxiake/dsh-vyra-plugins@master/docs/index.json',
      HOME_SOURCE,
    ]

    /** Entries loaded before "Show more", and loaded again by each press. */
    const PAGE = 60

    /** Typing pause before a query is sent. */
    const TEXT_DELAY_MS = 250

    /** localStorage in a browser, nothing in a headless check or a sandboxed renderer. */
    function storeGet(key) {
      try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key) } catch { return null }
    }
    function storeSet(key, value) {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value) } catch { /* storage full or denied */ }
    }

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
      updateAll: '全部更新 ({n})',
      onlyInstalled: '仅已安装',
      onlyUpdatable: '仅可更新',
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
      updateAll: 'Update all ({n})',
      onlyInstalled: 'Installed only',
      onlyUpdatable: 'Updatable only',
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
        display: 'flex', flexDirection: 'column', gap: '6px', padding: '11px 12px', borderRadius: '10px', minWidth: 0,
        border: `1px solid ${picked ? 'var(--dsw-alias-border-selected)' : 'var(--dsw-alias-border-l2)'}`,
        background: picked ? 'var(--dsw-alias-bg-multi-select)' : 'var(--dsw-alias-card-fill)',
        transition: 'box-shadow .15s, border-color .15s',
      }),
      cardTop: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
      artwork: {
        width: '34px', height: '34px', borderRadius: '8px', flex: 'none', overflow: 'hidden', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      head: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
      titleRow: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' },
      titleTags: { display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' },
      titleActions: { display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' },
      date: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', flex: 'none' },
      name: { fontSize: '13.5px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
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
      progressTrack: { height: '4px', borderRadius: '999px', background: 'var(--dsw-alias-bg-layer-1)', overflow: 'hidden' },
      progressFill: { height: '100%', borderRadius: '999px', background: 'var(--dsw-alias-brand-primary)', transition: 'width .3s ease' },
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
      versionRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', border: BORDER, background: 'var(--dsw-alias-bg-layer-2)', fontSize: '12.5px' },
      mdPara: { margin: '0 0 10px', fontSize: '12.5px', lineHeight: '1.7', color: 'var(--dsw-alias-label-primary)' },
      mdHead: { margin: '14px 0 8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      mdLi: { marginLeft: '18px', marginBottom: '4px', fontSize: '12.5px', lineHeight: '1.7', color: 'var(--dsw-alias-label-primary)' },
      mdPre: { margin: '0 0 10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--dsw-alias-bg-layer-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px', lineHeight: 1.6, color: 'var(--dsw-alias-label-primary)' },
      mdHr: { border: 0, borderTop: '1px solid var(--dsw-alias-border-l1)', margin: '14px 0' },
      mdImg: { display: 'block', maxWidth: 'min(260px, 100%)', height: 'auto', margin: '10px 0', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)' },
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
     * One entry, flattened: the title row carries artwork, name, state tags and the actions that
     * apply; the whole card opens this market's detail view. A failure this session left stays as
     * a tag whose tooltip holds the whole reason and whose press copies it.
     */
    function Card({ entry, bundle, lang, t, text, busy, picked, failure, copied, onPick, onRun, onConfirm, onDetails, onCopyFailure, onClearFailure }) {
      const title = entry.title === undefined ? entry.name : text(entry.title)
      const state = entryState(entry)
      const shown = presentedVersion(entry)
      const version = actionVersion(entry)
      const date = shown === undefined ? '' : formatDate(shown.publishTimestamp, lang)
      const incompatible = state === 'available' && version === undefined
      const installed = state === 'installed' || state === 'updatable'
      
      const currentVersion = bundle?.version
      const nextVersion = state === 'updatable' ? updateTarget(entry)?.version : undefined

      const actions = []
      if (version !== undefined) {
        const update = state === 'updatable'
        actions.push(h('button', {
          key: 'act', style: { ...S.btn(true, busy), padding: '2px 9px', fontSize: '11.5px' }, disabled: busy,
          onClick: (event) => { event?.stopPropagation(); onRun([{ action: update ? 'update' : 'install', entry, version }]) },
        }, t(update ? 'update' : 'install')))
      }
      if (installed) {
        // The bulk plan already decides what may be removed and switched; a
        // card offers exactly the same actions, so the two never disagree about
        // a bundle the Host reports as unreadable or shipped.
        const removable = bundle !== undefined && bundle.removable !== false
        if (removable) {
          actions.push(h('button', {
            key: 'remove', style: { ...S.btn(false, busy), padding: '2px 9px', fontSize: '11.5px' }, disabled: busy,
            onClick: (event) => { event?.stopPropagation(); onConfirm({ action: 'uninstall', orders: [{ action: 'uninstall', entry, bundle }] }) },
          }, t('uninstall')))
        }
        if (bundle !== undefined && bundle.readOnlyReason === undefined) {
          const disable = bundle.enabled
          actions.push(h('button', {
            key: 'toggle', style: { ...S.btn(false, busy), padding: '2px 9px', fontSize: '11.5px' }, disabled: busy,
            onClick: (event) => { event?.stopPropagation(); onRun([{ action: disable ? 'disable' : 'enable', entry, bundle }]) },
          }, t(disable ? 'disable' : 'enable')))
        }
      }
      const tags = []
      if (failure !== undefined) {
        // Hover reads the whole reason; a press copies it; the × drops the tag
        // once it has been dealt with, so a card is not marked forever.
        tags.push(h('button', {
          key: 'f', type: 'button', title: failure, 'aria-label': `${t('failedTag')}: ${failure}`,
          style: { ...S.tag('error'), cursor: 'pointer', font: 'inherit', margin: 0 },
          onClick: (event) => { event?.stopPropagation(); void onCopyFailure(entry.name, failure) },
        }, copied === entry.name ? t('copied') : t('failedTag')))
        tags.push(h('button', {
          key: 'fc', type: 'button', title: t('clearError'), 'aria-label': t('clearError'),
          style: { ...S.tag('error'), cursor: 'pointer', font: 'inherit', margin: 0, padding: '1px 6px' },
          onClick: (event) => { event?.stopPropagation(); onClearFailure(entry.name) },
        }, '×'))
      }
      if (state === 'provided') tags.push(h('span', { key: 'p', style: S.tag('neutral') }, t('tagProvided')))
      if (state === 'updatable') tags.push(h('span', { key: 'u', style: S.tag('warn') }, t('tagUpdate')))
      if (state === 'installed') tags.push(h('span', { key: 'i', style: S.tag('ok') }, t(bundle !== undefined && bundle.enabled === false ? 'tagDisabled' : 'tagInstalled')))
      if (incompatible) tags.push(h('span', { key: 'x', style: S.tag('warn') }, t('tagIncompatible')))
      if (shown !== undefined && prerelease(shown.version)) tags.push(h('span', { key: 'r', style: S.tag('neutral') }, t('tagPrerelease')))

      // Static controls: the actions sit beside the state tags rather than appearing on hover, so
      // nothing moves under the pointer and an action is never missed. A click elsewhere on the
      // card opens this market's detail view; the checkbox and buttons stop propagation.
      const open = onDetails === undefined ? undefined : () => { onDetails(entry) }
      return h('li', {
        style: { ...S.card(picked), cursor: open === undefined ? 'default' : 'pointer' },
        onClick: open,
      },
        h('div', { style: S.cardTop },
          h('input', {
            type: 'checkbox', style: S.check, checked: picked, disabled: busy,
            'aria-label': title, onChange: onPick,
            onClick: (event) => { event?.stopPropagation() },
          }),
          h('span', { style: S.artwork }, h(Artwork, { src: entry.icon })),
          h('div', { style: S.head },
            h('div', { style: S.titleRow },
              h('span', { style: S.name, title }, title),
              h('div', { style: { ...S.titleTags, gap: '6px' } },
                tags,
                actions.length === 0 ? null : h('div', {
                  style: S.titleActions,
                  onClick: (event) => { event?.stopPropagation() },
                }, actions)))),
          date === '' ? null : h('span', { style: S.date }, date)),
        entry.description === undefined ? null : h('p', { style: S.desc }, text(entry.description)),
        h('p', { style: S.meta }, [
          currentVersion !== undefined && nextVersion !== undefined && currentVersion !== nextVersion
            ? `${currentVersion} → ${nextVersion}`
            : shown === undefined ? null : `${t('version')} ${shown.version}`,
          entry.author === undefined ? null : entry.author,
        ].filter(Boolean).join(' · ')))
    }

    /** Resolve `owner/repo` from the entry's repository or homepage, for fetching its README. */
    function repoOfEntry(entry) {
      const repo = entry.repository
      const url = typeof repo === 'string' ? repo : (repo && repo.url) || entry.homepage || ''
      const m = String(url).match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/)
      return m ? m[1].replace(/\.git$/, '') : ''
    }

    /** README candidates for one entry: its own directory first, then the repo root. */
    function readmeUrls(entry) {
      const repo = repoOfEntry(entry)
      if (!repo) return []
      const raw = entry.repository
      const dir = raw && typeof raw === 'object' && typeof raw.directory === 'string'
        ? raw.directory.replace(/^\/+|\/+$/g, '')
        : ''
      const paths = dir && dir !== '.' ? [`${dir}/README.md`, 'README.md'] : ['README.md']
      const bases = [
        (p) => `https://cdn.jsdelivr.net/gh/${repo}@HEAD/${p}`,
        (p) => `https://raw.githubusercontent.com/${repo}/HEAD/${p}`,
      ]
      return bases.flatMap((make) => paths.map(make))
    }

    /**
     * Market entry detail. Works before install: the card carries title, description,
     * author and repository, and the plugin's own README (repository.directory/README.md)
     * is fetched from GitHub — jsDelivr first (reachable in CN), then raw.githubusercontent.com.
     */
    /**
     * Turn the HTML image forms a README actually uses into Markdown, so the block renderer sees
     * them. `<picture>`/`<source>` carry the same image twice (dark and light variants); the
     * `<img>` inside is the one to draw. Raw HTML is otherwise not rendered.
     */
    function htmlImages(md) {
      return String(md ?? '')
        .replace(/<picture\b[^>]*>/gi, '')
        .replace(/<\/picture\s*>/gi, '')
        .replace(/<source\b[^>]*\/?>/gi, '')
        .replace(/<img\b([^>]*)>/gi, (_all, attrs) => {
          const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? ''
          const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? ''
          return src === '' ? '' : `\n![${alt}](${src})\n`
        })
    }

    /** Absolute URL for a README-relative asset; absolute and data: sources are left alone. */
    function resolveAsset(src, base) {
      if (/^(?:https?:|data:)/i.test(src)) return src
      try { return new URL(src, base).href } catch { return src }
    }

    /**
     * Render README Markdown as real blocks — headings, bullets, fenced code, images,
     * paragraphs — so the detail view reads like the client's own plugin pages rather than a
     * pasted blob. Inline markers the renderer cannot draw are stripped; images are drawn.
     */
    function renderMarkdown(md, key, resolve = (src) => src) {
      const blocks = []
      let code = null
      let para = null
      const flush = () => {
        if (para !== null) { blocks.push(...para.map((line, i) => h('p', { key: `${key}p${blocks.length}${i}`, style: S.mdPara }, line))); para = null }
      }
      for (const raw of htmlImages(md).replace(/\r\n/g, '\n').split('\n')) {
        const line = raw.trimEnd()
        if (/^\s*```/.test(line)) {
          flush()
          if (code === null) code = []
          else { blocks.push(h('pre', { key: `${key}c${blocks.length}`, style: S.mdPre }, code.join('\n'))); code = null }
          continue
        }
        if (code !== null) { code.push(raw); continue }
        if (line.trim() === '') { flush(); continue }
        // A line that is nothing but an image is drawn as one; an image mixed into prose is
        // still flattened to its alt text by `inline`.
        const image = /^\s*!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)\s*$/.exec(line)
        if (image) {
          flush()
          blocks.push(h('img', {
            key: `${key}i${blocks.length}`, src: resolve(image[2]), alt: image[1],
            style: S.mdImg, loading: 'lazy', referrerPolicy: 'no-referrer',
          }))
          continue
        }
        const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line)
        if (heading) {
          flush()
          blocks.push(h('h4', { key: `${key}h${blocks.length}`, style: { ...S.mdHead, fontSize: heading[1].length <= 2 ? '14px' : '13px' } }, inline(heading[2])))
          continue
        }
        const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
        if (bullet) { flush(); blocks.push(h('li', { key: `${key}l${blocks.length}`, style: S.mdLi }, inline(bullet[1]))); continue }
        const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line)
        if (numbered) { flush(); blocks.push(h('li', { key: `${key}l${blocks.length}`, style: S.mdLi }, `${numbered[1]}. ${inline(numbered[2])}`)); continue }
        if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flush(); blocks.push(h('hr', { key: `${key}r${blocks.length}`, style: S.mdHr })); continue }
        para = para === null ? [inline(line)] : [...para, inline(line)]
      }
      flush()
      if (code !== null) blocks.push(h('pre', { key: `${key}c${blocks.length}`, style: S.mdPre }, code.join('\n')))
      return blocks
    }

    /** Strip inline markers the detail view cannot draw, keeping the words. */
    function inline(text) {
      return text
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/(^|[\s(])[*_]([^*_]+)[*_]([\s).,，。])/g, '$1$2$3')
        .trim()
    }

    function DetailDialog({ entry, bundle, lang, t, text, busy, onRun, onConfirm, onClose }) {
      const title = entry.title === undefined ? entry.name : text(entry.title)
      const urls = readmeUrls(entry)
      const [view, setView] = useState({ loading: true, md: '', error: '' })

      useEffect(() => {
        let alive = true
        if (urls.length === 0) {
          setView({ loading: false, md: '', error: '' })
          return () => { alive = false }
        }
        void (async () => {
          for (const url of urls) {
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
              if (res.ok) {
                const md = await res.text()
                // The README's own directory is the base every relative asset resolves
                // against — a QR image is `./assets/qq-group.png`, not a repository URL.
                const base = url.slice(0, url.lastIndexOf('/') + 1)
                if (alive) setView({ loading: false, md, error: '', base })
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
      }, [entry.name, lang])

      const state = entryState(entry)
      const shown = presentedVersion(entry)
      const version = actionVersion(entry)
      const installed = state === 'installed' || state === 'updatable'
      const removable = bundle !== undefined && bundle.removable !== false
      const nextVersion = state === 'updatable' ? updateTarget(entry)?.version : undefined
      const facts = [
        shown === undefined ? null : `${lang === 'zh' ? '版本' : 'version'} ${shown.version}`,
        entry.author === undefined ? null : `${lang === 'zh' ? '作者' : 'author'} ${entry.author}`,
        entry.metadata && entry.metadata.category ? entry.metadata.category : null,
      ].filter(Boolean)

      const actions = []
      if (version !== undefined) {
        const update = state === 'updatable'
        actions.push(h('button', {
          key: 'act', style: { ...S.btn(true, busy), padding: '2px 9px', fontSize: '11.5px' }, disabled: busy,
          onClick: () => { onRun([{ action: update ? 'update' : 'install', entry, version }]) },
        }, t(update ? 'update' : 'install')))
      }
      if (installed && removable && onConfirm !== undefined) {
        actions.push(h('button', {
          key: 'remove', style: { ...S.btn(false, busy), padding: '2px 9px', fontSize: '11.5px' }, disabled: busy,
          onClick: () => { onConfirm({ action: 'uninstall', orders: [{ action: 'uninstall', entry, bundle }] }) },
        }, t('uninstall')))
      }
      if (installed && bundle !== undefined && bundle.readOnlyReason === undefined) {
        const disable = bundle.enabled
        actions.push(h('button', {
          key: 'toggle', style: { ...S.btn(false, busy), padding: '2px 9px', fontSize: '11.5px' }, disabled: busy,
          onClick: () => { onRun([{ action: disable ? 'disable' : 'enable', entry, bundle }]) },
        }, t(disable ? 'disable' : 'enable')))
      }

      // The version list the index carries, newest first, with the running one marked.
      const history = entry.versions.slice(0, 8)
      const current = bundle?.version

      return h('div', { style: S.backdrop, onClick: onClose },
        h('div', {
          style: { ...S.modal, width: 'min(760px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0 },
          onClick: (e) => e.stopPropagation(),
        },
          // --- header ---
          h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 'none', padding: '16px 18px 12px', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
            h('span', { style: { ...S.artwork, width: '44px', height: '44px' } }, h(Artwork, { src: entry.icon })),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
                h('h3', { style: { ...S.modalTitle, margin: 0 } }, title),
                nextVersion !== undefined && current !== undefined && current !== nextVersion
                  ? h('span', { style: S.tag('warn') }, `${current} → ${nextVersion}`)
                  : null),
              h('span', { style: S.mono }, entry.name)),
            h('button', { style: S.btn(false, false), 'aria-label': 'close', onClick: onClose }, '×')),
          // --- actions + facts ---
          h('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '10px 18px', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
            actions,
            facts.length === 0 ? null : h('span', { style: { ...S.meta, marginLeft: 'auto' } }, facts.join(' · '))),
          // --- README ---
          h('div', { style: { flex: 1, overflow: 'auto', padding: '14px 18px', minHeight: '180px' } },
            entry.description === undefined ? null : h('p', { style: { ...S.modalBody, marginTop: 0 } }, text(entry.description)),
            view.loading
              ? h('div', { style: { fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary)', marginTop: '12px' } }, lang === 'zh' ? '正在读取 README…' : 'Loading README…')
              : view.error
                ? h('div', { style: { fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary)', marginTop: '12px' } }, view.error)
                : h('div', { style: { marginTop: '12px' } }, renderMarkdown(view.md, `${entry.name}-md`, (src) => resolveAsset(src, view.base))),
            // --- version history ---
            entry.versions.length === 0 ? null : h('div', { style: { marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l1)' } },
              h('h4', { style: { ...S.mdHead, marginBottom: '8px' } }, lang === 'zh' ? '版本历史' : 'Version history'),
              h('ul', { style: { ...S.list, marginTop: '6px' } },
                history.map((v) => h('li', { key: v.version, style: S.versionRow },
                  h('span', { style: { fontWeight: current === v.version ? 600 : 400 } }, v.version),
                  v.version === shown?.version ? h('span', { style: S.tag('ok') }, lang === 'zh' ? '最新' : 'Latest') : null,
                  h('span', { style: { ...S.meta, marginLeft: 'auto' } }, formatDate(v.publishTimestamp, lang))))),
              entry.versions.length > history.length
                ? h('p', { style: S.meta }, lang === 'zh' ? `还有 ${entry.versions.length - history.length} 个更早版本未显示` : `${entry.versions.length - history.length} older versions not shown`)
                : null),
            h('div', { style: { flex: 'none', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l1)', fontSize: '12.5px', lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } },
              '有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。'))
        )
      )
    }

    /**
     * Check for updates once, in the background, and tell the user if any exist.
     *
     * This runs when the client UI loads rather than when the market tab is opened — the point of
     * an automatic check is to tell someone who was not going to look. It stays silent on every
     * failure: a market that is unreachable at startup is not worth interrupting anyone over.
     * The toggle lives in this plugin's own localStorage key, so no host storage is needed.
     */
    async function autoCheck(remote) {
      try {
        if (storeGet('vyra-market.autoCheck') === 'off') return
        const indexes = await remote.pluginMarket.listIndexes()
        if (!indexes.ok || indexes.value.length === 0) return
        const url = indexes.value.find((source) => VEYRA_SOURCES.includes(source.url))?.url ?? indexes.value[0].url
        const [page, bundles] = await Promise.all([
          remote.pluginMarket.search(url, { sort: { kind: 'index' }, offset: 0, limit: 500 }),
          remote.pluginManager.listBundles(),
        ])
        if (!page.ok || !bundles.ok) return
        const installed = new Set(bundles.value.map((bundle) => bundle.name))
        const updatable = page.value.entries
          .filter((entry) => installed.has(entry.name) && updateTarget(entry) !== undefined).length
        if (updatable === 0) return
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('插件市场 · Plugin market', { body: `发现 ${updatable} 个插件可更新 / ${updatable} update(s) available` })
        }
      } catch {
        /* Startup is not the place to report a market error. */
      }
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
      const [refreshed, setRefreshed] = useState(false)
      const [running, setRunning] = useState(null)
      const [outcome, setOutcome] = useState(null)
      /** Per-entry failure text, kept on the card after the summary bar is gone. */
      const [failures, setFailures] = useState(() => new Map())
      /** The entry whose failure text was just copied, for the tag's own feedback. */
      const [copied, setCopied] = useState(null)
      // ponytail: 快捷筛选状态（仅已安装/仅可更新）
      const [quickFilter, setQuickFilter] = useState(null)
      // Startup update check toggle, persisted locally (no host storage needed).
      const [autoCheckOn, setAutoCheckOn] = useState(() => storeGet('vyra-market.autoCheck') !== 'off')
      // Recent search terms, offered through a native <datalist> rather than a custom dropdown.
      const [recent, setRecent] = useState(() => {
        try { return JSON.parse(storeGet('vyra-market.recent') ?? '[]') } catch { return [] }
      })
      const rememberQuery = useCallback((term) => {
        const value = String(term).trim()
        if (value === '') return
        setRecent((current) => {
          const next = [value, ...current.filter((item) => item !== value)].slice(0, 5)
          storeSet('vyra-market.recent', JSON.stringify(next))
          return next
        })
      }, [])

      // ponytail: AbortController 用于取消未完成的请求
      const loadAbortController = useRef(null)

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
        // ponytail: 首次打开或列表为空时，自动添加 Veyra 源（优先使用 ghproxy 加速）
        const hasVeyra = list.some((item) => VEYRA_SOURCES.includes(item.url))
        if ((list.length === 0 || !hasVeyra) && adopt) {
          // 使用国内加速源作为默认
          const defaultSource = VEYRA_SOURCES[0]
          const added = await remote.pluginMarket.setIndexes([defaultSource, ...list.map((s) => s.url)])
          if (!alive.current) return
          if (added.ok) {
            const reread = await remote.pluginMarket.listIndexes()
            if (!alive.current) return
            list = reread.ok ? reread.value : []
          }
        }
        setSources(list)
        // ponytail: 优先激活 Veyra 源（任意一个）
        setActiveUrl((current) => {
          if (list.some((item) => item.url === current)) return current
          const veyra = list.find((item) => VEYRA_SOURCES.includes(item.url))
          return veyra?.url ?? list[0]?.url ?? null
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
        // ponytail: 取消上一个未完成的请求，避免显示旧数据
        if (loadAbortController.current) {
          loadAbortController.current.abort()
        }
        loadAbortController.current = new AbortController()
        const signal = loadAbortController.current.signal

        // ponytail: 立即清空旧数据并显示加载状态，避免切换源时显示上一个市场的数据
        setListing({
          url, query: next, status: 'loading',
          value: offset === 0 ? null : (listing?.url === url ? listing.value : null),
          failure: null,
        })

        try {
          const answer = await remote.pluginMarket.search(url, {
            ...next.text.trim() === '' ? {} : { text: next.text },
            ...next.category === null ? {} : { category: next.category },
            sort: next.sort, offset, limit,
            ...fetchedAt === undefined ? {} : { fetchedAt },
            ...refresh ? { refresh: true } : {},
          })

          // ponytail: 请求被取消，不更新状态
          if (signal.aborted) return
          if (!alive.current) return

          if (!answer.ok) {
            setListing({ url, query: next, status: 'error', value: null, failure: answer.error.message })
            return
          }
          const page = answer.value
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
        } catch (error) {
          if (signal.aborted) return
          if (!alive.current) return
          setListing({ url, query: next, status: 'error', value: null, failure: error.message || '请求失败' })
        }
      }, [remote, listing])
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
          rememberQuery(next.text)
          if (live.listing !== null) void live.load(live.listing.url, next, 0, PAGE, undefined)
        }, TEXT_DELAY_MS)
        return () => { clearTimeout(timer) }
      }, [draft, query.text, rememberQuery])

      const entries = listing === null || listing.value === null ? [] : listing.value.entries

      // ponytail: 快捷筛选 - 根据 quickFilter 过滤条目
      const filteredEntries = useMemo(() => {
        if (quickFilter === 'installed') {
          return entries.filter((entry) => {
            const state = entryState(entry)
            return state === 'installed' || state === 'updatable' || state === 'provided'
          })
        }
        if (quickFilter === 'updatable') {
          return entries.filter((entry) => entryState(entry) === 'updatable')
        }
        return entries
      }, [entries, quickFilter])

      const declarations = listing === null || listing.value === null ? undefined : listing.value.metadata
      const categories = useMemo(() => {
        if (declarations === undefined) return []
        const collator = new Intl.Collator(lang)
        return Object.entries(declarations.categories)
          .map(([id, declaration]) => ({ id, title: text(declaration.title) }))
          .sort((left, right) => collator.compare(left.title, right.title))
      }, [declarations, lang, text])

      const selected = useMemo(() => filteredEntries
        .filter((entry) => picked.has(entry.name))
        .map((entry) => ({ entry, bundle: bundles.get(entry.name) })), [filteredEntries, picked, bundles])
      const plan = useMemo(() => planBulk(selected), [selected])

      // ponytail: 收集所有可更新的插件（用于"全部更新"按钮）
      const allUpdatable = useMemo(() => {
        return filteredEntries
          .filter((entry) => entryState(entry) === 'updatable')
          .map((entry) => ({ entry, bundle: bundles.get(entry.name) }))
      }, [filteredEntries, bundles])

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
      const loadingPage = listing !== null && listing.status === 'loading'

      useEffect(() => {
        if (!refreshed) return undefined
        const timer = setTimeout(() => setRefreshed(false), 2500)
        return () => clearTimeout(timer)
      }, [refreshed])
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
      const pagePicked = filteredEntries.length > 0 && filteredEntries.every((entry) => picked.has(entry.name))
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
        // A visible progress bar, not just a counter: a batch of ten installs can take a
        // minute, and the person needs to see it moving rather than wonder if it hung.
        const pct = running.total === 0 ? 0 : Math.round((running.done / running.total) * 100)
        rows.push(h('div', { key: 'running', style: { ...S.bar, flexDirection: 'column', alignItems: 'stretch', gap: '6px' }, role: 'status' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('span', { style: S.spinner }),
            h('span', { style: { flex: 1, minWidth: 0, ...S.ellipsis } },
              `${t('progress', { action: running.action, done: running.done, total: running.total })} — ${running.name}`),
            h('span', { style: { ...S.meta, flex: 'none' } }, `${pct}%`)),
          h('div', { style: S.progressTrack },
            h('div', { style: { ...S.progressFill, width: `${pct}%` } }))))
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
          key: 'remove', style: { ...S.btn(false, busy), padding: '2px 9px', fontSize: '11.5px' }, disabled: busy,
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
              }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, h(SlidersIcon, {}), t('manageSources'))),
              h('div', { style: S.menuSep }),
              // A toggle, not a checkbox input: one row in a menu, no extra layout.
              h('button', {
                role: 'menuitemcheckbox', 'aria-checked': autoCheckOn, style: S.menuItem(false),
                onClick: () => {
                  const next = !autoCheckOn
                  setAutoCheckOn(next)
                  storeSet('vyra-market.autoCheck', next ? 'on' : 'off')
                  setMenu(null)
                },
              }, `${autoCheckOn ? '✓ ' : ''}${lang === 'zh' ? '启动时检查更新' : 'Check updates at startup'}`))),
          h('div', { style: S.searchWrap },
            h('span', { style: S.searchIcon }, h(SearchIcon, {})),
            h('input', {
              style: S.input, type: 'search', value: draft, spellCheck: false,
              placeholder: t('search'), 'aria-label': t('search'), list: 'vpm-recent-searches',
              onChange: (event) => { setDraft(event.target.value) },
            }),
            // A native suggestion list: the browser/Electron draws and filters it, so no custom
            // dropdown state, no positioning code, and it still works on a fresh profile.
            recent.length === 0 ? null : h('datalist', { id: 'vpm-recent-searches' },
              recent.map((term) => h('option', { key: term, value: term })))),
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
          // ponytail: "全部更新"按钮 - 一键更新所有可更新插件
          allUpdatable.length > 0 && quickFilter !== 'updatable' ? h('button', {
            style: S.btn(true, busy), disabled: busy,
            onClick: () => {
              const updatePlan = planBulk(allUpdatable)
              const updateOrders = orders(updatePlan, 'update')
              if (updateOrders.length > 0) setConfirm({ action: 'update', orders: updateOrders })
            },
          }, t('updateAll', { n: allUpdatable.length })) : null,
          h('button', {
            style: { ...S.squareBtn, opacity: loadingPage ? 0.45 : 1 },
            title: t('refresh'), 'aria-label': t('refresh'),
            disabled: busy || listing === null || loadingPage,
            onClick: async () => {
              if (listing === null) return
              try {
                // refresh=true 让 Host 绕过十分钟的索引缓存；顺带刷新安装状态。
                await load(listing.url, query, 0, PAGE, undefined, 0, true)
                await loadBundles()
                setRefreshed(true)
              } catch {
                // load 已经把失败写进 listing.failure
              }
            },
          }, h(RefreshIcon, {})),
          refreshed ? h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, lang === 'zh' ? '已刷新' : 'Refreshed') : null),
        // ponytail: 快捷筛选行 - 仅已安装、仅可更新
        h('div', { style: S.pills, role: 'group', 'aria-label': t('all') },
          h('button', {
            style: S.pill(quickFilter === null), 'aria-pressed': quickFilter === null,
            onClick: () => { setQuickFilter(null); setPicked(new Set()) },
          }, t('all')),
          h('button', {
            style: S.pill(quickFilter === 'installed'), 'aria-pressed': quickFilter === 'installed',
            onClick: () => { setQuickFilter('installed'); setPicked(new Set()) },
          }, t('onlyInstalled')),
          h('button', {
            style: S.pill(quickFilter === 'updatable'), 'aria-pressed': quickFilter === 'updatable',
            onClick: () => { setQuickFilter('updatable'); setPicked(new Set()) },
          }, t('onlyUpdatable'))),
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
              : filteredEntries.length === 0 ? h('div', { style: S.state },
                t(listing.status === 'loading' ? 'loading' : listing.query.text.trim() === '' && listing.query.category === null && quickFilter === null ? 'empty' : 'noMatch'))
                : h('div', null,
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 8px' } },
                    h('label', { style: { ...S.meta, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } },
                      h('input', {
                        type: 'checkbox', style: S.check, checked: pagePicked, disabled: busy,
                        onChange: () => { setPicked(pagePicked ? new Set() : new Set(filteredEntries.map((entry) => entry.name))) },
                      }),
                      t('selectPage')),
                    h('span', { style: S.meta }, t('total', { n: filteredEntries.length }))),
                  h('ul', { style: S.grid },
                    filteredEntries.map((entry) => h(Card, {
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
          entry: detailEntry, bundle: bundles.get(detailEntry.name), lang, t, text, busy,
          onRun: (list) => { void run(list) },
          onConfirm: setConfirm,
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
      __internal: { marketText, presentedVersion, installable, prerelease, updateTarget, entryState, actionVersion, planBulk, orders, withText, TRANSIENT_FAILURE, RETRY_DELAY_MS, htmlImages, resolveAsset },
      inject: ['slots', 'locale', 'remote', 'remote.pluginMarket', 'remote.pluginManager'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), `${NS}: dictionaries`)
        // A background update check at client startup; silent on any failure and behind a toggle.
        void autoCheck(ctx.remote)
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
