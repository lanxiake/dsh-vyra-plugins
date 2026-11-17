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
      btn: (primary, disabled) => ({
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 11px', borderRadius: '8px',
        font: 'inherit', fontSize: '12.5px', flex: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        border: `1px solid ${primary ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)'}`,
        background: primary ? 'var(--dsw-alias-brand-primary)' : 'transparent',
        color: primary ? 'var(--dsw-alias-brand-text)' : 'var(--dsw-alias-label-primary)',
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
      pill: (active) => ({
        padding: '3px 11px', borderRadius: '999px', font: 'inherit', fontSize: '12px', cursor: 'pointer',
        border: `1px solid ${active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)'}`,
        background: active ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
        color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
      }),
      scroll: { flex: 1, minHeight: 0, overflowY: 'auto' },
      grid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '10px',
        margin: 0, padding: 0, listStyle: 'none',
      },
      card: (picked) => ({
        display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '12px', minWidth: 0,
        border: `1px solid ${picked ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)'}`,
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
        border: `1px solid ${tone === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : tone === 'ok' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-border-l2)'}`,
        color: tone === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : tone === 'ok' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-tertiary)',
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
      bulkBar: { borderColor: 'var(--dsw-alias-brand-primary)' },
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

    /** One entry: artwork, title, state, description, and its single-entry actions. */
    function Card({ entry, bundle, lang, t, text, busy, picked, onPick, onRun, onConfirm, onOpen }) {
      const title = entry.title === undefined ? entry.name : text(entry.title)
      const state = entryState(entry)
      const shown = presentedVersion(entry)
      const version = actionVersion(entry)
      const date = shown === undefined ? '' : formatDate(shown.publishTimestamp, lang)
      const incompatible = state === 'available' && version === undefined
      const installed = state === 'installed' || state === 'updatable'
      const actions = []
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
      const [running, setRunning] = useState(null)
      const [outcome, setOutcome] = useState(null)

      const alive = useRef(true)
      useEffect(() => () => { alive.current = false }, [])

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
        setActiveUrl((current) => list.some((item) => item.url === current) ? current : (list[0]?.url ?? null))
      }, [remote])

      /** Read the installed bundles: enabled state, removability, and read-only reason. */
      const loadBundles = useCallback(async () => {
        const answer = await remote.pluginManager.listBundles()
        if (!alive.current || !answer.ok) return
        setBundles(new Map(answer.value.map((bundle) => [bundle.name, bundle])))
      }, [remote])

      /** Load one page of a source, replacing the results it answers. */
      const loadRef = useRef(null)
      const load = useCallback(async (url, next, offset, limit, fetchedAt, depth = 0) => {
        setListing((current) => ({
          url, query: next, status: 'loading',
          value: current !== null && current.url === url ? current.value : null, failure: null,
        }))
        const answer = await remote.pluginMarket.search(url, {
          ...next.text.trim() === '' ? {} : { text: next.text },
          ...next.category === null ? {} : { category: next.category },
          sort: next.sort, offset, limit,
          ...fetchedAt === undefined ? {} : { fetchedAt },
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
       * Run a batch: every order is attempted in turn, so one failure never
       * hides the entries that follow it.
       * @param {ReadonlyArray<object>} list - orders from {@link orders}.
       */
      const run = useCallback(async (list) => {
        if (list.length === 0 || running !== null) return
        setOutcome(null)
        setConfirm(null)
        let ok = 0
        let restart = 0
        let builds = 0
        const failures = []
        for (let index = 0; index < list.length; index += 1) {
          const order = list[index]
          if (!alive.current) return
          setRunning({
            action: t(`act${order.action[0].toUpperCase()}${order.action.slice(1)}`),
            done: index, total: list.length, name: order.entry.name,
          })
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
            failures.push(`${order.entry.name}: ${String(error?.message ?? error)}`)
            continue
          }
          if (!alive.current) return
          if (!answer.ok) {
            failures.push(`${order.entry.name}: ${answer.error.message}`)
            continue
          }
          // An update answers with its own step result and restores the removed
          // version when the replacement fails; both wrap one change result.
          const result = order.action === 'update' ? answer.value.result : answer.value
          if (result === undefined || result.application === 'failed') {
            failures.push(`${order.entry.name}: ${result?.error?.diagnostic ?? t('loadFailed')}`)
            continue
          }
          ok += 1
          if (result.application === 'restart-required') restart += 1
          if ((result.pendingBuilds?.length ?? 0) > 0) builds += 1
        }
        if (!alive.current) return
        setRunning(null)
        setPicked(new Set())
        setOutcome({ ok, failures, restart, builds })
        await loadBundles()
      }, [remote, running, t, loadBundles])

      // Every hook runs before any early return, so the count never changes
      // between the first render and the loaded one (React error #310).
      const busy = running !== null
      const sourceMenu = useMenu(menu === 'source', () => { setMenu(null) })
      const sortMenu = useMenu(menu === 'sort', () => { setMenu(null) })
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
          style: { ...S.bar, ...outcome.failures.length > 0 ? S.error : {} },
        }, [
          t('done', { ok: outcome.ok }),
          outcome.failures.length === 0 ? null : t('failed', { n: outcome.failures.length }),
          outcome.restart === 0 ? null : t('needRestart', { n: outcome.restart }),
          outcome.builds === 0 ? null : t('needBuilds', { n: outcome.builds }),
          outcome.failures.length === 0 ? null : h('span', { key: 'why', title: outcome.failures.join('\n'), style: { cursor: 'help' } }, 'ⓘ'),
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
              sources.map((source) => h('button', {
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
            onClick: () => { if (listing !== null) void load(listing.url, query, 0, PAGE, undefined) },
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
              h('button', { style: S.btn(false, false), onClick: () => { void load(listing.url, listing.query, 0, PAGE, undefined) } }, t('retry')))
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
      __internal: { marketText, presentedVersion, installable, prerelease, updateTarget, entryState, actionVersion, planBulk, orders, withText },
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
