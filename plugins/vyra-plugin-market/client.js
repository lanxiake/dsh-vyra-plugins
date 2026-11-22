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

    /**
     * dshmarket.com's browsable directory is the same curated catalog that is
     * published as a format-1 index on npm. It is a host source, not a virtual
     * one: the Host already knows how to fetch, validate and annotate it.
     */
    const DSHMARKET_CATALOG = 'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json'
    /** DSH Open Market — 1,340 community plugins, validated format 1. */
    const DSHOPEN_CATALOG = 'https://dshopen.org/index.json'
    /** DSH Go Market — 41 curated plugins, served by its cached worker. */
    const DSH_GO_CATALOG = 'https://go.dshtui.com/market/index.json'
    /** The host indexes this plugin seeds once, in display order. */
    const BUILTIN_CATALOGS = [DSHMARKET_CATALOG, DSHOPEN_CATALOG, DSH_GO_CATALOG]

    /**
     * dsh.so exposes a compact index of its own (≈11 MB, immutable, CORS *),
     * but not in format 1. It is browsed by the adapter below rather than being
     * written into the profile's index sources, which only accept format 1.
     */
    const DSH_SO_SOURCE = {
      url: 'dsh-so://market',
      title: { zh: 'dsh.so 插件市场', en: 'dsh.so market' },
      builtin: true,
    }
    const DSH_SO_PAGE = 'https://www.dsh.so/zh/artifacts/'
    /** Used when the page cannot be read; the page's own hash is preferred. */
    const DSH_SO_FALLBACK_INDEX = 'https://www.dsh.so/assets/idx/9984f3eb98ae4bf8896e23b591ec8989/artifacts-index-zh.json'
    const DSH_SO_CACHE_MS = 6 * 60 * 60 * 1000

    /**
     * A compact star/download overlay generated from the community catalog at
     * publish time. Host indexes (including dshmarket.com's format-1 catalog)
     * do not carry these numbers, so cards look them up here; a miss simply
     * hides the metric. Never fetched per card.
     */
    const STATS_SOURCES = [
      'https://fastly.jsdelivr.net/gh/lanxiake/dsh-vyra-plugins@master/docs/stats.json',
      'https://ghproxy.net/https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/master/docs/stats.json',
      'https://lanxiake.github.io/dsh-vyra-plugins/stats.json',
    ]
    const STATS_CACHE_MS = 6 * 60 * 60 * 1000

    /** Entries loaded before "Show more", and loaded again by each press. */
    const PAGE = 40

    /**
     * A small client-side page cache. The Host already caches each index, but
     * a source or query switch still waits for a round trip; this answers the
     * exact page it just showed and makes switching back instant. It is
     * cleared on refresh and whenever the profile's bundles change, because
     * installation state is part of every page.
     */
    const PAGE_CACHE_MS = 5 * 60 * 1000
    const PAGE_CACHE_MAX = 80
    const pageCache = new Map()

    function pageCacheKey(url, query, offset, limit) {
      return JSON.stringify([
        url, query.text ?? '', query.category ?? null,
        query.sort?.kind ?? 'index', query.sort?.id ?? null, query.sort?.direction ?? null,
        offset, limit,
      ])
    }

    function cachedPage(key, offset, fetchedAt) {
      const hit = pageCache.get(key)
      if (hit === undefined || Date.now() - hit.at >= PAGE_CACHE_MS) return undefined
      // Page two onwards must belong to the same index revision the first
      // page came from; the Host reports that identity as `fetchedAt`.
      if (offset > 0 && hit.page.fetchedAt !== fetchedAt) return undefined
      return hit.page
    }

    function rememberPage(key, page) {
      pageCache.set(key, { at: Date.now(), page })
      while (pageCache.size > PAGE_CACHE_MAX) {
        const oldest = pageCache.keys().next().value
        pageCache.delete(oldest)
      }
    }

    /** Typing pause before a query is sent. */
    const TEXT_DELAY_MS = 250

    /** localStorage in a browser, nothing in a headless check or a sandboxed renderer. */
    function storeGet(key) {
      try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key) } catch { return null }
    }
    function storeSet(key, value) {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value) } catch { /* storage full or denied */ }
    }

    /**
     * Where the market appears. Settings is always a door, so turning both
     * switches off never strands the market; the sidebar and Plugins tab are
     * opt-out. Stored in the browser, like the startup-check toggle.
     */
    const VISIBILITY_KEY = 'vyra-market.visibility'
    const DEFAULT_VISIBILITY = { sidebar: true, pluginsTab: true }
    function readVisibility() {
      try {
        const raw = storeGet(VISIBILITY_KEY)
        const value = raw === null ? null : JSON.parse(raw)
        return {
          sidebar: value?.sidebar !== false,
          pluginsTab: value?.pluginsTab !== false,
        }
      } catch {
        return { ...DEFAULT_VISIBILITY }
      }
    }
    const visibility = (() => {
      let state = readVisibility()
      const listeners = new Set()
      return {
        get: () => state,
        set(key, value) {
          state = { ...state, [key]: value !== false }
          storeSet(VISIBILITY_KEY, JSON.stringify(state))
          for (const listener of listeners) listener(state)
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    })()
    function useVisibility() {
      const [state, setState] = useState(visibility.get)
      useEffect(() => visibility.subscribe(setState), [])
      return state
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
    // Built-in aggregators
    // ---------------------------------------------------------------------------

    /** Compact counts in the same style dsh.so uses: 1.2k, 3.4M. */
    function compactCount(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number < 0) return ''
      if (number >= 1e6) return `${(number / 1e6).toFixed(number >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`
      if (number >= 1e3) return `${(number / 1e3).toFixed(number >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`
      return String(Math.round(number))
    }

    /**
     * The npm package name inside an install spec, or '' when it is not an npm
     * spec. `@scope/name@1.2.3` keeps the scope; a bare `name` is itself.
     */
    function npmSpecName(spec) {
      const text = String(spec ?? '').trim()
      if (text === '' || text.startsWith('github:') || text.startsWith('~')) return ''
      if (text.startsWith('@')) {
        const slash = text.indexOf('/')
        if (slash === -1) return text
        const at = text.indexOf('@', slash)
        return at === -1 ? text : text.slice(0, at)
      }
      const at = text.indexOf('@')
      return at <= 0 ? text : text.slice(0, at)
    }

    /** The repository identity in a URL or install spec, without `.git`. */
    function parseRepoRef(value) {
      const text = String(value ?? '')
      const match = /(?:github(?:\.com)?|gitcode(?:\.com)?|atomgit(?:\.com)?|gitee(?:\.com)?|gitlab(?:\.com)?)[/:]([^/#?\s]+)\/([^/#?\s]+?)(?:\.git)?(?=$|[#?&\s])/i.exec(text)
      return match === null ? null : { repo: `${match[1]}/${match[2]}`.toLowerCase() }
    }

    /** The `path:` segment of a pnpm Git spec, normalized. */
    function specPath(spec) {
      const match = /(?:[#&?]|\b)path:\/?([^&?#\s]+)/i.exec(String(spec ?? ''))
      return match === null ? '' : match[1].replace(/^\/+|\/+$/g, '').toLowerCase()
    }

    /**
     * Match a market entry to the profile's installed bundle even when the two
     * names differ (scoped vs short, GitHub vs a GitCode mirror, a display name
     * vs the package name). Keys are tried strongest first; a key shared by
     * more than one bundle is refused rather than guessed.
     */
    function buildBundleIndex(bundles) {
      const index = new Map()
      const add = (key, bundle) => {
        if (key === '') return
        const list = index.get(key)
        if (list === undefined) index.set(key, [bundle])
        else if (!list.includes(bundle)) list.push(bundle)
      }
      for (const bundle of bundles.values()) {
        const name = String(bundle.name ?? '').toLowerCase()
        if (name === '') continue
        add(`name:${name}`, bundle)
        const npm = npmSpecName(String(bundle.source ?? ''))
        if (npm !== '') add(`name:${npm.toLowerCase()}`, bundle)
        const repo = parseRepoRef(bundle.source)
        const path = specPath(bundle.source)
        if (repo !== null) {
          add(`repo:${repo.repo}`, bundle)
          if (path !== '') {
            add(`repopath:${repo.repo}#${path}`, bundle)
            add(`path:${path}`, bundle)
          }
        } else if (path !== '') {
          add(`path:${path}`, bundle)
        }
        add(`short:${shortBundleName(name).toLowerCase()}`, bundle)
      }
      return (entry) => {
        const keys = []
        const name = String(entry.name ?? '').toLowerCase()
        if (name !== '') keys.push(`name:${name}`)
        const directory = String(entry.repository?.directory ?? '').replace(/^\/+|\/+$/g, '').toLowerCase()
        const entryRepo = parseRepoRef(typeof entry.repository === 'string' ? entry.repository : entry.repository?.url)
        for (const version of Array.isArray(entry.versions) ? entry.versions : []) {
          const spec = version?.install?.spec
          const npm = npmSpecName(spec)
          if (npm !== '') keys.push(`name:${npm.toLowerCase()}`)
          const repo = parseRepoRef(spec) ?? (version?.source?.type === 'git' ? parseRepoRef(version.source.url) : null)
          const path = specPath(spec)
            || String(version?.source?.path ?? '').replace(/^\/+|\/+$/g, '').toLowerCase()
          if (repo !== null) {
            if (path !== '') keys.push(`repopath:${repo.repo}#${path}`)
            if (path !== '') keys.push(`path:${path}`)
            keys.push(`repo:${repo.repo}`)
          } else if (path !== '') {
            keys.push(`path:${path}`)
          }
        }
        if (entryRepo !== null) {
          keys.push(`repo:${entryRepo.repo}`)
          if (directory !== '') {
            keys.push(`repopath:${entryRepo.repo}#${directory}`)
            keys.push(`path:${directory}`)
          }
        } else if (directory !== '') {
          keys.push(`path:${directory}`)
        }
        if (name !== '') keys.push(`short:${shortBundleName(name).toLowerCase()}`)
        const seen = new Set()
        for (const key of keys) {
          if (seen.has(key)) continue
          seen.add(key)
          const list = index.get(key)
          if (list !== undefined && list.length === 1) return list[0]
        }
        return undefined
      }
    }

    /** The version a spec pins, or '' when it pins none. */
    function specVersion(spec) {
      const text = String(spec ?? '').trim()
      if (text === '') return ''
      if (text.startsWith('github:')) {
        const hash = text.indexOf('#')
        if (hash === -1) return ''
        const ref = text.slice(hash + 1).split('&')[0].replace(/^v/, '')
        return /^\d+\.\d+\.\d+/.test(ref) ? ref : ''
      }
      const at = text.lastIndexOf('@')
      if (at <= 0) return ''
      const version = text.slice(at + 1).replace(/^v/, '')
      return /^\d+\.\d+\.\d+/.test(version) ? version : ''
    }

    /** The artifact index URL the dsh.so page itself references. */
    function dshSoIndexUrlFrom(html) {
      const match = /\/assets\/idx\/[a-f0-9]+\/artifacts-index-(?:zh|en)\.json/.exec(String(html ?? ''))
      return match === null ? null : new URL(match[0], 'https://www.dsh.so').href
    }

    /** A dsh.so artifact's repository page, following its URL-code field. */
    function dshSoRepoUrl(raw) {
      const owner = String(raw[2] ?? '').trim()
      const repo = String(raw[3] ?? '').trim()
      switch (Number(raw[10] ?? 4)) {
        case 0: return owner === '' || repo === '' ? '' : `https://github.com/${owner}/${repo}`
        case 1: return owner === '' || repo === '' ? '' : `https://gitlab.com/${owner}/${repo}`
        case 2: return owner === '' || repo === '' ? '' : `https://gitee.com/${owner}/${repo}`
        case 3: return ''
        default: return String(raw[11] ?? '')
      }
    }

    /** A dsh.so artifact's icon: a curated avatar, else the owner's avatar. */
    function dshSoIcon(raw, dictionary) {
      const avatar = Number(raw[28] ?? 0)
      if (avatar > 0 && typeof dictionary?.av?.[avatar] === 'string') return dictionary.av[avatar]
      const owner = String(raw[2] ?? '').trim()
      if (owner === '') return ''
      const code = Number(raw[10] ?? 4)
      if (code === 0) return `https://github.com/${owner}.png`
      if (code === 2) return `https://gitee.com/${owner}.png`
      return ''
    }

    /**
     * Turn dsh.so's compact artifact index into the entry shape the Host's
     * pluginMarket returns, so cards, selection and the batch runner do not
     * need a second code path. Non-plugins, entries with no install target and
     * dsh-TUI-only specs are skipped.
     */
    function normalizeDshSo(data, now = Date.now()) {
      const dictionary = data?.d ?? {}
      const cats = Array.isArray(dictionary.cat) ? dictionary.cat : []
      const catLabels = Array.isArray(dictionary.catL) ? dictionary.catL : []
      const useCases = Array.isArray(dictionary.ucL) ? dictionary.ucL : []
      const categories = {}
      for (let index = 0; index < cats.length; index += 1) {
        const label = String(catLabels[index] ?? cats[index])
        categories[cats[index]] = { title: { en: label, zh: label } }
      }
      const byName = new Map()
      for (const raw of Array.isArray(data?.i) ? data.i : []) {
        if (!Array.isArray(raw)) continue
        const flags = Number(raw[9] ?? 0)
        const spec = String(raw[8] ?? '').trim()
        // Bit 8 marks an artifact that is not a DSH plugin; `~` is dsh-TUI's
        // own install command and cannot go through pluginManager.
        if ((flags & 8) !== 0 || spec === '' || spec.startsWith('~')) continue
        const display = String(raw[1] ?? raw[0] ?? '').trim()
        if (display === '') continue
        const npmName = spec.startsWith('github:') ? '' : npmSpecName(spec)
        const name = npmName === '' ? display : npmName
        const version = specVersion(spec)
        const repoUrl = dshSoRepoUrl(raw)
        const catIndexes = Array.isArray(raw[12]) ? raw[12] : []
        const catIds = catIndexes.map((id) => cats[id]).filter(Boolean)
        const categoryLabels = catIndexes.map((id) => catLabels[id]).filter(Boolean)
        const labels = (Array.isArray(raw[13]) ? raw[13] : []).map((id) => useCases[id]).filter(Boolean)
        const npm = data?.npm?.[String(raw[0] ?? '')]
        const stars = Number(raw[5] ?? 0) || 0
        const downloads = Array.isArray(npm) && Number.isFinite(Number(npm[1])) ? Number(npm[1]) : undefined
        const downloadsWeek = Array.isArray(npm) && Number.isFinite(Number(npm[0])) ? Number(npm[0]) : undefined
        const updated = Date.parse(String(raw[6] ?? ''))
        const entry = {
          name,
          title: display,
          description: String(raw[4] ?? ''),
          icon: dshSoIcon(raw, dictionary),
          author: String(raw[2] ?? ''),
          ...(repoUrl === '' ? {} : { homepage: repoUrl, repository: { url: repoUrl } }),
          metadata: {
            ...(catIds.length === 0 ? {} : { category: catIds[0] }),
            keywords: labels,
            labels: [],
            sortKeys: {
              ...(stars > 0 ? { stars } : {}),
              ...(downloads === undefined ? {} : { downloads }),
            },
          },
          versions: [{
            version: version === '' ? 'latest' : version,
            publishTimestamp: Number.isFinite(updated) ? Math.floor(updated / 1000) : 0,
            source: spec.startsWith('github:')
              ? { type: 'git', url: repoUrl === '' ? spec : repoUrl, commit: '' }
              : { type: 'npm' },
            install: { spec },
            compatibility: { compatible: true },
            update: false,
          }],
          defaultVersion: version === '' ? 'latest' : version,
          installation: { status: 'not-installed' },
          external: true,
          // 26k entries are searched on every debounced keystroke; lower-case
          // the haystack once instead of rebuilding it per query.
          marketSearchText: [display, name, String(raw[4] ?? ''), String(raw[2] ?? ''), repoUrl, catIds.join(' '), labels.join(' ')]
            .join(' ').toLowerCase(),
          marketStats: {
            ...(stars > 0 ? { stars } : {}),
            ...(downloads === undefined ? {} : { downloads, downloadsWeek, window: 'total' }),
          },
          marketExtra: {
            kind: (flags & 1) !== 0 ? 'app' : 'plugin',
            verification: String(dictionary.ver?.[Number(raw[14] ?? 0)] ?? ''),
            verificationShort: (/L\d/.exec(String(dictionary.verKey?.[Number(raw[15] ?? 0)] ?? '')) ?? [])[0] ?? '',
            verificationTone: String(dictionary.verTone?.[Number(raw[16] ?? 0)] ?? ''),
            security: String(dictionary.sec?.[Number(raw[17] ?? 0)] ?? ''),
            securityTone: String(dictionary.secTone?.[Number(raw[18] ?? 0)] ?? ''),
            health: String(dictionary.health?.[Number(raw[19] ?? 0)] ?? ''),
            healthTone: String(dictionary.healthTone?.[Number(raw[20] ?? 0)] ?? ''),
            trust: String(dictionary.trust?.[Number(raw[21] ?? 0)] ?? ''),
            trustTone: String(dictionary.trustTone?.[Number(raw[22] ?? 0)] ?? ''),
            quality: Number(raw[7] ?? 0) || 0,
            license: String(dictionary.lic?.[Number(raw[24] ?? 0)] ?? ''),
            releaseUrl: String(raw[27] ?? ''),
            categories: catIds,
            categoryLabels,
            useCases: labels,
            dshVersions: Number(raw[25] ?? 0) === 0
              ? []
              : (Array.isArray(dictionary.dv) ? dictionary.dv : []).filter((_value, index) => (Number(raw[25]) & (1 << index)) !== 0),
          },
        }
        const score = (downloads ?? 0) * 1e6 + (stars ?? 0)
        const existing = byName.get(name)
        const oldScore = existing === undefined
          ? -1
          : (existing.marketStats.downloads ?? 0) * 1e6 + (existing.marketStats.stars ?? 0)
        if (score > oldScore) byName.set(name, entry)
      }
      const entries = [...byName.values()].sort((left, right) =>
        (right.marketStats.downloads ?? 0) - (left.marketStats.downloads ?? 0)
        || (right.marketStats.stars ?? 0) - (left.marketStats.stars ?? 0)
        || left.name.localeCompare(right.name))
      return {
        entries,
        metadata: {
          categories,
          labels: {},
          sortKeys: {
            stars: { title: { en: 'Stars', zh: '星标' }, order: 'desc' },
            downloads: { title: { en: 'Downloads', zh: '下载量' }, order: 'desc' },
          },
        },
        fetchedAt: now,
      }
    }

    /** Match one dsh.so entry against a query and score it. */
    function dshSoScore(entry, words) {
      if (words.length === 0) return 0
      const name = String(entry.name ?? '').toLowerCase()
      const title = String(entry.title ?? '').toLowerCase()
      const author = String(entry.author ?? '').toLowerCase()
      const haystack = entry.marketSearchText
        ?? [name, title, String(entry.description ?? ''), author, repoOfEntry(entry),
          ...(entry.marketExtra?.categories ?? []), ...(entry.metadata?.keywords ?? [])].join(' ').toLowerCase()
      let score = 0
      for (const word of words) {
        if (name === word) score += 12
        else if (name.startsWith(word)) score += 8
        else if (name.includes(word)) score += 5
        else if (title.includes(word)) score += 4
        else if (author.includes(word)) score += 3
        else if (haystack.includes(word)) score += 2
        else return -1
      }
      return score
    }

    /** One page of the dsh.so index, in the shape the Host's search returns. */
    function dshSoPage(data, query, offset, limit) {
      const words = String(query.text ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
      const scored = []
      for (const entry of data.entries) {
        if (query.category !== undefined && query.category !== null && entry.metadata.category !== query.category) continue
        const score = dshSoScore(entry, words)
        if (score >= 0) scored.push({ entry, score })
      }
      const sort = query.sort ?? { kind: 'index' }
      if (sort.kind === 'relevance' && words.length > 0) {
        scored.sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name))
      } else if (sort.kind === 'published') {
        const sign = sort.direction === 'asc' ? 1 : -1
        scored.sort((left, right) => sign * (Math.max(...left.entry.versions.map((version) => version.publishTimestamp)) - Math.max(...right.entry.versions.map((version) => version.publishTimestamp))))
      } else if (sort.kind === 'key') {
        const sign = sort.direction === 'asc' ? 1 : -1
        const value = (entry) => {
          const candidate = entry.metadata?.sortKeys?.[sort.id]
          return typeof candidate === 'number' ? candidate : undefined
        }
        scored.sort((left, right) => {
          const a = value(left.entry)
          const b = value(right.entry)
          if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1
          return sign * (a - b) || left.entry.name.localeCompare(right.entry.name)
        })
      }
      const total = scored.length
      const entries = scored.slice(offset, offset + limit).map((item) => item.entry)
      return {
        url: DSH_SO_SOURCE.url,
        title: DSH_SO_SOURCE.title,
        metadata: data.metadata,
        fetchedAt: data.fetchedAt,
        total,
        nextOffset: offset + entries.length < total ? offset + limit : null,
        entries,
      }
    }

    /** dsh.so's index is large, immutable and CORS-enabled; keep it per session. */
    let dshSoCache = { data: null, at: 0, pending: null }

    /** Combine a caller's abort signal with a timeout where the runtime can. */
    function withTimeout(signal, milliseconds) {
      const timeout = AbortSignal.timeout(milliseconds)
      if (signal === undefined || signal === null) return timeout
      return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal
    }

    /** Read and normalize dsh.so's artifact index, reusing it until it expires. */
    function loadDshSoData(refresh, signal) {
      if (!refresh && dshSoCache.data !== null && Date.now() - dshSoCache.at < DSH_SO_CACHE_MS) {
        return Promise.resolve(dshSoCache.data)
      }
      if (dshSoCache.pending !== null) return dshSoCache.pending
      const task = (async () => {
        let indexUrl = DSH_SO_FALLBACK_INDEX
        try {
          const page = await fetch(DSH_SO_PAGE, { signal: withTimeout(signal, 20_000), headers: { accept: 'text/html' } })
          if (page.ok) indexUrl = dshSoIndexUrlFrom(await page.text()) ?? indexUrl
        } catch {
          // The page is only a way to discover the hash; the fallback still works.
        }
        const response = await fetch(indexUrl, { signal: withTimeout(signal, 90_000), headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error(`dsh.so index: HTTP ${response.status}`)
        const data = normalizeDshSo(await response.json())
        dshSoCache = { data, at: Date.now(), pending: null }
        return data
      })()
      dshSoCache.pending = task
      return task.catch((error) => {
        dshSoCache.pending = null
        throw error
      })
    }

    /** Index the compact stats overlay by package, repository and display name. */
    function normalizeStats(raw) {
      const byName = new Map()
      const byNpm = new Map()
      const byRepo = new Map()
      for (const row of Array.isArray(raw?.plugins) ? raw.plugins : []) {
        if (row === null || typeof row !== 'object') continue
        const stars = Number(row.stars)
        const downloads = Number(row.downloads)
        const statistic = {
          ...(Number.isFinite(stars) && stars > 0 ? { stars } : {}),
          ...(Number.isFinite(downloads) && downloads >= 0 ? { downloads, window: '30d' } : {}),
          ...(typeof row.start === 'string' ? { start: row.start } : {}),
          ...(typeof row.end === 'string' ? { end: row.end } : {}),
          ...(typeof row.checked === 'string' ? { checkedAt: row.checked } : {}),
        }
        if (statistic.stars === undefined && statistic.downloads === undefined) continue
        if (typeof row.name === 'string' && row.name !== '') byName.set(row.name.toLowerCase(), statistic)
        if (typeof row.npm === 'string' && row.npm !== '') byNpm.set(row.npm.toLowerCase(), statistic)
        if (typeof row.repo === 'string' && row.repo !== '') byRepo.set(row.repo.toLowerCase(), statistic)
      }
      return { byName, byNpm, byRepo, updated: typeof raw?.updated === 'string' ? raw.updated : '' }
    }

    let statsCache = { data: null, at: 0, pending: null }
    let statsFailureAt = 0

    /** Read the shared stats overlay once per session; a failure is silent. */
    function loadStatsData() {
      if (statsCache.data !== null && Date.now() - statsCache.at < STATS_CACHE_MS) {
        return Promise.resolve(statsCache.data)
      }
      if (statsCache.pending !== null) return statsCache.pending
      if (statsFailureAt !== 0 && Date.now() - statsFailureAt < 10 * 60 * 1000) return Promise.resolve(null)
      const task = (async () => {
        for (const url of STATS_SOURCES) {
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: 'application/json' } })
            if (!response.ok) continue
            const data = normalizeStats(await response.json())
            if (data.byName.size === 0 && data.byNpm.size === 0 && data.byRepo.size === 0) continue
            statsCache = { data, at: Date.now(), pending: null }
            return data
          } catch {
            // Try the next mirror.
          }
        }
        statsFailureAt = Date.now()
        return null
      })()
      statsCache.pending = task
      return task.catch(() => {
        statsCache.pending = null
        statsFailureAt = Date.now()
        return null
      })
    }

    /** The stats a card shows, from the entry itself or the shared overlay. */
    function statsOfEntry(entry, overlay) {
      if (entry.marketStats !== undefined) return entry.marketStats
      const sortKeys = entry.metadata?.sortKeys ?? {}
      if (typeof sortKeys.stars === 'number' || typeof sortKeys.downloads === 'number') {
        return {
          ...(typeof sortKeys.stars === 'number' ? { stars: sortKeys.stars } : {}),
          ...(typeof sortKeys.downloads === 'number' ? { downloads: sortKeys.downloads, window: '30d' } : {}),
        }
      }
      if (overlay === null || overlay === undefined) return null
      const name = entry.name.toLowerCase()
      const repo = repoOfEntry(entry).toLowerCase()
      // One catalog row is indexed under all three keys, but an entry can
      // match different rows (a display name and an npm package). Merge them
      // so a repository row can contribute stars while the npm row contributes
      // downloads; never add the two download sources together.
      const candidates = [
        overlay.byNpm.get(name),
        repo === '' ? undefined : overlay.byRepo.get(repo),
        overlay.byName.get(name),
      ].filter((candidate) => candidate !== undefined)
      if (candidates.length === 0) return null
      const merged = {}
      for (const candidate of candidates) {
        if (merged.stars === undefined && candidate.stars !== undefined) merged.stars = candidate.stars
        if (merged.downloads === undefined && candidate.downloads !== undefined) {
          merged.downloads = candidate.downloads
          merged.window = candidate.window
          if (candidate.start !== undefined) merged.start = candidate.start
          if (candidate.end !== undefined) merged.end = candidate.end
        }
        if (merged.checkedAt === undefined && candidate.checkedAt !== undefined) merged.checkedAt = candidate.checkedAt
      }
      return merged
    }

    // ---------------------------------------------------------------------------
    // The install queue
    // ---------------------------------------------------------------------------

    /**
     * A queue's state, module-scoped on purpose: leaving the Plugins page
     * unmounts the tab component, and a run owned by that component would die
     * with the unmount. The runner below owns the queue; the tab and the toast
     * only subscribe and draw whatever state they find on return.
     */
    const runner = (() => {
      let state = {
        queue: [],
        current: null,
        running: null,
        outcome: null,
        failures: new Map(),
        cancel: false,
        canceling: false,
        cancelNotice: null,
        canceledQueue: 0,
        completed: 0,
        total: 0,
      }
      let logTimer = null
      let pendingLog = ''
      let pendingRequestId = null
      let outcomeSeq = 0
      const listeners = new Set()
      const notify = () => { for (const listener of listeners) listener(state) }
      return {
        get: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        update(patch) {
          state = { ...state, ...patch }
          notify()
        },
        /** Apply a Host phase to the current request only. */
        progress(requestId, phase) {
          if (state.current?.requestId !== requestId) return
          state = {
            ...state,
            current: { ...state.current, phase },
            running: state.running === null ? null : { ...state.running, phase },
          }
          notify()
        },
        /** Append pnpm output, coalescing renders to one per 180ms. */
        appendLog(requestId, text) {
          if (state.current?.requestId !== requestId) return
          pendingRequestId = requestId
          // pnpm colours its output; the log viewer is plain text.
          pendingLog = `${pendingLog}${String(text ?? '').replace(/\x1b\[[0-9;]*m/g, '')}`.slice(-8000)
          if (logTimer !== null) return
          logTimer = setTimeout(() => {
            logTimer = null
            if (state.current?.requestId !== pendingRequestId) return
            state = {
              ...state,
              current: { ...state.current, log: pendingLog },
              running: state.running === null ? null : { ...state.running, log: pendingLog },
            }
            notify()
          }, 180)
        },
        /** Drop one item that has not started yet. */
        removeQueued(index) {
          const queue = state.queue.slice()
          if (index < 0 || index >= queue.length) return
          queue.splice(index, 1)
          state = {
            ...state,
            queue,
            total: Math.max(state.completed + (state.current === null ? 0 : 1), state.total - 1),
          }
          notify()
        },
        /** Cancel the current item where the Host supports it, and clear the queue. */
        requestCancel(remote, t) {
          if (state.running === null || state.cancel) return
          const current = state.current
          // Remember the unrun tail before clearing it: the finish path
          // reports that count, and a later enqueue starts a clean queue.
          state = {
            ...state,
            cancel: true,
            canceling: true,
            canceledQueue: state.queue.length,
            queue: [],
          }
          notify()
          const cancellable = current !== null
            && (current.order.action === 'install' || current.order.action === 'update')
            && typeof remote.pluginManager.cancelInstall === 'function'
          if (!cancellable) {
            state = { ...state, canceling: false, cancelNotice: t('cancelUnsupported') }
            notify()
            return
          }
          Promise.resolve(remote.pluginManager.cancelInstall(current.requestId)).then((answer) => {
            if (state.current?.requestId !== current.requestId) return
            if (!answer.ok) {
              state = { ...state, canceling: false, cancelNotice: answer.error.message }
              notify()
              return
            }
            const status = answer.value?.status
            if (status === 'too-late') state = { ...state, canceling: false, cancelNotice: t('cancelTooLate') }
            else if (status === 'not-running') state = { ...state, canceling: false }
            notify()
          }, (error) => {
            if (state.current?.requestId !== current.requestId) return
            state = { ...state, canceling: false, cancelNotice: String(error?.message ?? error) }
            notify()
          })
        },
        /** Finish the queue and publish an outcome for the toast. */
        finish(outcome) {
          if (logTimer !== null) { clearTimeout(logTimer); logTimer = null }
          pendingLog = ''
          pendingRequestId = null
          outcomeSeq += 1
          state = {
            ...state,
            queue: [],
            current: null,
            running: null,
            cancel: false,
            canceling: false,
            cancelNotice: null,
            canceledQueue: 0,
            completed: 0,
            total: 0,
            outcome: { ...outcome, seq: outcomeSeq },
          }
          notify()
        },
      }
    })()

    /** The running queue, kept across tab unmounts. */
    function useRunner() {
      const [state, setState] = useState(runner.get)
      useEffect(() => runner.subscribe(setState), [])
      return state
    }

    /** The running bar's verb for one order action. */
    function actionLabel(t, action) {
      return t(`act${action[0].toUpperCase()}${action.slice(1)}`)
    }

    /**
     * The completion toast, mounted in `shell.overlay` so it is visible after
     * the market page or its Plugins tab has been left. It subscribes to the
     * same module-level queue and only shows when a new outcome settles.
     */
    function MarketToast({ t, onOpen, canOpen }) {
      const job = useRunner()
      const outcome = job.outcome
      // A ref, not state: setting `seen` would re-run this effect and its
      // cleanup would clear the very timer that hides the toast.
      const seen = useRef(runner.get().outcome?.seq ?? 0)
      const [visible, setVisible] = useState(false)
      useEffect(() => {
        if (outcome === null || outcome.seq <= seen.current) return undefined
        seen.current = outcome.seq
        setVisible(true)
        const timer = setTimeout(() => setVisible(false), outcome.failed > 0 ? 12_000 : 6_500)
        if (typeof timer?.unref === 'function') timer.unref()
        return () => clearTimeout(timer)
      }, [outcome])
      if (!visible || outcome === null) return null
      const openable = onOpen !== undefined && (canOpen === undefined || canOpen())
      return h('div', { className: 'vpm-toast' },
        h('div', { className: 'vpm-toast-card' },
          h('div', { className: 'vpm-toast-copy' },
            h('p', { className: 'vpm-toast-title' }, t('toastTitle')),
            h('p', { className: 'vpm-toast-body' },
              [
                t('toastBody', { ok: outcome.ok, failed: outcome.failed, restart: outcome.restart }),
                outcome.canceled ? t('canceled', { n: outcome.skipped }) : null,
              ].filter(Boolean).join(' · '))),
          h('div', { className: 'vpm-toast-actions' },
            openable ? h('button', {
              className: 'vpm-btn small', onClick: () => { setVisible(false); onOpen() },
            }, t('toastOpen')) : null,
            h('button', {
              className: 'vpm-btn small', onClick: () => { setVisible(false) },
            }, t('toastClose')))))
    }

    /** A request id the Host can cancel; the wire only requires a string. */
    let requestSeq = 0
    function newRequestId() {
      try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      } catch {
        // Fall through to the counter.
      }
      requestSeq += 1
      return `vpm-${Date.now().toString(36)}-${requestSeq}`
    }

    /**
     * Issue one order and read the Host's answer without judging it.
     * @param {object} order - one order from {@link orders}.
     * @param {object} remote - the injected Host namespaces.
     * @param {string} requestId - names this attempt's Host progress and cancellation.
     * @returns {Promise<{pass: boolean, canceled?: boolean, reason?: string, result?: object}>} the outcome.
     */
    async function perform(order, remote, requestId) {
      let answer
      // A built-in aggregator's display name is not always the installed
      // package name (dsh.so shows the repository name). The profile's own
      // bundle is the name the Host can remove or toggle.
      const installed = order.bundle?.name ?? order.entry.name
      try {
        if (order.action === 'install') {
          answer = await remote.pluginManager.installBundle(order.version.install.spec, {
            enabled: true, saveExact: true, requestId,
            ...order.version.install.registry === undefined ? {} : { registry: order.version.install.registry },
          })
        } else if (order.action === 'update') {
          answer = await remote.pluginManager.updateBundle(order.entry.name, order.version.version, {
            spec: order.version.install.spec,
            requestId,
          })
        } else if (order.action === 'uninstall') {
          answer = await remote.pluginManager.removeBundle(installed)
        } else {
          answer = await remote.pluginManager.setBundleEnabled(installed, order.action === 'enable')
        }
      } catch (error) {
        return { pass: false, reason: String(error?.message ?? error) }
      }
      if (!answer.ok) {
        return {
          pass: false,
          canceled: /cancel/i.test(answer.error.message),
          reason: answer.error.message,
        }
      }
      // An update answers with its own step result and restores the removed
      // version when the replacement fails; both wrap one change result.
      const result = order.action === 'update' ? answer.value.result : answer.value
      if (result === undefined || result.application === 'cancelled') {
        return {
          pass: false,
          canceled: true,
          reason: result?.error?.diagnostic ?? '',
          result,
        }
      }
      if (result.application === 'failed') {
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
     * Put back a package that another writer stripped between two orders.
     * A second failure is reported like any other instead of retried forever.
     */
    async function repair(orders, failed, remote) {
      const kept = orders.filter((order) => !failed.has(order.entry.name)
        && order.action !== 'uninstall' && order.action !== 'disable')
      if (kept.length === 0) return
      const answer = await remote.pluginManager.listBundles()
      if (!answer.ok) return
      const present = new Map(answer.value.map((bundle) => [bundle.name, bundle]))
      let repaired = false
      for (const order of kept) {
        const installed = order.bundle?.name ?? order.entry.name
        if (present.get(installed)?.enabled === true) continue
        repaired = true
        try {
          if (order.action === 'install' || order.action === 'update') {
            await remote.pluginManager.installBundle(order.version.install.spec, { enabled: true, saveExact: true })
          } else {
            await remote.pluginManager.setBundleEnabled(installed, true)
          }
        } catch (error) {
          try { await remote.pluginManager.setBundleEnabled(installed, true) }
          catch (again) { failed.set(order.entry.name, String(again?.message ?? again)) }
        }
      }
      // Only a second read tells whether the repair landed. A package that is
      // back is not a failure, whatever the attempt said.
      if (!repaired) return
      const settled = await remote.pluginManager.listBundles()
      if (!settled.ok) return
      const now = new Map(settled.value.map((bundle) => [bundle.name, bundle]))
      for (const order of kept) {
        const installed = order.bundle?.name ?? order.entry.name
        if (now.get(installed)?.enabled === true) failed.delete(order.entry.name)
      }
    }

    /** Append orders to the live queue; the pump starts itself. */
    function enqueue(list, remote, t) {
      if (list.length === 0) return
      const state = runner.get()
      const fresh = state.running === null && state.queue.length === 0 && !pumping
      runner.update({
        queue: fresh ? [...list] : [...state.queue, ...list],
        total: fresh ? list.length : state.total + list.length,
        completed: fresh ? 0 : state.completed,
        outcome: fresh ? null : state.outcome,
        failures: fresh ? new Map() : new Map(state.failures),
        cancel: false,
        canceling: false,
        cancelNotice: null,
        canceledQueue: 0,
      })
      void pump(remote, t)
    }

    /**
     * Drain the queue one order at a time, then repair the profile once. A
     * failure never stops the items behind it; a cancel stops the queue and
     * asks the Host to abort the current install/update.
     */
    let pumping = false
    async function pump(remote, t) {
      if (pumping) return
      pumping = true
      const failed = new Map()
      const attempted = []
      let ok = 0
      let restart = 0
      let builds = 0
      let canceled = false
      try {
        while (true) {
          while (true) {
            const state = runner.get()
            if (state.cancel) { canceled = true; break }
            const order = state.queue[0]
            if (order === undefined) break
            const requestId = newRequestId()
            const startedAt = Date.now()
            attempted.push(order)
            runner.update({
              queue: state.queue.slice(1),
              current: { order, requestId, phase: 'starting', startedAt, log: '' },
              running: {
                action: order.action, done: state.completed, total: state.total,
                name: order.entry.name, requestId, phase: 'starting', startedAt, log: '',
              },
              cancelNotice: null,
            })
            let outcome = null
            for (let attempt = 0; attempt <= RETRY_DELAY_MS.length; attempt += 1) {
              if (runner.get().cancel) break
              if (attempt > 0) {
                const retryId = newRequestId()
                const current = runner.get()
                runner.update({
                  current: current.current === null ? null : { ...current.current, requestId: retryId, phase: 'starting', log: '' },
                  running: current.running === null ? null : { ...current.running, requestId: retryId, phase: 'starting', log: '' },
                })
              }
              outcome = await perform(order, remote, runner.get().running?.requestId ?? requestId)
              if (outcome.pass || outcome.canceled) break
              // A permanent answer is the run's verdict, not the road's:
              // retrying "not a bundle" or a refused version only wastes time.
              if (attempt === RETRY_DELAY_MS.length || !TRANSIENT_FAILURE.test(outcome.reason ?? '')) break
              if (runner.get().cancel) break
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS[attempt]))
              if (runner.get().cancel) break
            }
            const after = runner.get()
            const wasCanceled = outcome?.canceled === true || (after.cancel && !outcome?.pass)
            if (outcome?.pass) {
              ok += 1
              if (outcome.result.application === 'restart-required') restart += 1
              if ((outcome.result.pendingBuilds?.length ?? 0) > 0) builds += 1
            } else if (!wasCanceled) {
              failed.set(order.entry.name, outcome?.reason === '' || outcome?.reason === undefined ? t('loadFailed') : outcome.reason)
            }
            runner.update({
              completed: after.completed + 1,
              failures: new Map(failed),
            })
            if (wasCanceled) { canceled = true; break }
            if (runner.get().cancel) { canceled = true; break }
          }
          if (canceled || runner.get().cancel) { canceled = true; break }
          await repair(attempted, failed, remote)
          if (runner.get().queue.length === 0) break
        }
      } finally {
        pumping = false
        const state = runner.get()
        if (!canceled && state.queue.length > 0) {
          // Items appended while the repair pass ran: keep the queue alive.
          void pump(remote, t)
        } else {
          runner.finish({
            ok,
            failed: failed.size,
            restart,
            builds,
            canceled,
            skipped: canceled ? state.canceledQueue : 0,
          })
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Dictionaries
    // ---------------------------------------------------------------------------

    const ZH = {
      title: '插件市场',
      eyebrow: 'DSH PLUGIN MARKET',
      subtitle: '发现、安装与更新 DeepSeek Harness 插件。',
      summary: '{total} 个插件 · {installed} 已安装 · {updates} 可更新',
      emptyTitle: '这个源还没有插件',
      emptyBody: '换一个市场源，或在「管理市场源」里添加新的索引。',
      noMatchTitle: '没有匹配的插件',
      noMatchBody: '试试更短的关键词，或清空分类筛选。',
      loadingTitle: '正在载入市场',
      loadingBody: '首次打开 dsh.so 或社区目录时，索引较大，请稍等。',
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
      category: '分类',
      allCategories: '全部分类',
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
      cancelRun: '取消',
      canceling: '正在取消…',
      canceled: '已取消，剩余 {n} 项未执行',
      ok: '确定',
      actInstall: '安装',
      actUpdate: '更新',
      actUninstall: '卸载',
      actEnable: '启用',
      actDisable: '停用',
      progress: '{action} {done}/{total}',
      elapsed: '{n} 秒',
      queue: '队列还有 {n} 项',
      removeQueued: '移出队列',
      phase_starting: '准备中',
      phase_installing: '安装中',
      phase_cancelling: '正在取消',
      phase_applying: '正在应用',
      phase_checking: '检查更新',
      phase_removing: '移除旧版本',
      phase_restoring: '恢复旧版本',
      cancelTooLate: '已进入应用阶段，当前安装无法中止',
      cancelUnsupported: '当前宿主不支持中止，已停止后续队列',
      logShow: '查看日志',
      logHide: '收起日志',
      logEmpty: '暂无日志输出',
      toastTitle: '插件安装完成',
      toastBody: '成功 {ok} 项 · 失败 {failed} 项 · 需重启 {restart} 项',
      toastOpen: '查看',
      toastClose: '关闭',
      settingsVisibility: '显示位置',
      showSidebar: '左侧菜单栏',
      showPluginsTab: '插件页面',
      settingsNote: '设置菜单中始终保留插件市场入口。',
      viewMarket: '市场',
      viewInstalled: '已安装',
      searchInstalled: '搜索已安装插件',
      installedSummary: '{total} 个已安装 · {enabled} 启用 · {disabled} 停用',
      installedEmptyTitle: '没有可显示的插件',
      installedEmptyBody: '手动安装或其他市场安装的插件会出现在这里。',
      installedProfileTitle: '已安装插件',
      installedBundledTitle: 'DSH 内置插件',
      tagEnabled: '已启用',
      tagOfficial: '客户端自带',
      tagOptional: '可选',
      tagReadOnly: '只读',
      tagMissing: '文件缺失',
      tagError: '读取失败',
      installedDetailTitle: '插件详情',
      detailReadmeLoading: '正在读取本地 README…',
      detailReadmeFailed: 'README 读取失败，仅显示包信息。',
      installedRows: '组件行',
      installedOverrides: '覆盖项',
      installedSource: '安装来源',
      installedAvailability: '文件位置',
      confirmUninstallInstalled: '卸载这个插件？',
      confirmUninstallInstalledBody: '它提供的功能会消失，已装文件会被移除。',
      actionFailed: '操作失败：{reason}',
      restartNeeded: '需要重启客户端生效',
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
      builtinSources: '内置聚合源',
      recommendedSources: '推荐源',
      builtinBadge: '内置',
      builtinTrust: '内置源同样是第三方内容，安装前请确认来源可信。',
      dshSoDesc: '32,000+ 条，带 star、npm 下载量、安全扫描与验证等级。',
      dshmarketDesc: 'dshmarket.com 的精选目录，6,000+ 条可安装插件。',
      dshOpenDesc: '开放插件市场，1,340 个社区插件，format-1 索引。',
      dshGoDesc: 'DSH Go 市场，41 个精选插件，带缓存 worker。',
      addRecommended: '添加',
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
      eyebrow: 'DSH PLUGIN MARKET',
      subtitle: 'Discover, install and update DeepSeek Harness plugins.',
      summary: '{total} plugins · {installed} installed · {updates} update(s)',
      emptyTitle: 'No plugins in this source yet',
      emptyBody: 'Switch to another market source, or add an index under Manage sources.',
      noMatchTitle: 'No matching plugins',
      noMatchBody: 'Try a shorter query, or clear the category filter.',
      loadingTitle: 'Loading the market',
      loadingBody: 'The first visit to dsh.so or the community catalog downloads a larger index.',
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
      category: 'Category',
      allCategories: 'All categories',
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
      cancelRun: 'Cancel',
      canceling: 'Cancelling…',
      canceled: 'Cancelled — {n} not run',
      ok: 'Confirm',
      actInstall: 'Installing',
      actUpdate: 'Updating',
      actUninstall: 'Uninstalling',
      actEnable: 'Enabling',
      actDisable: 'Disabling',
      progress: '{action} {done}/{total}',
      elapsed: '{n}s',
      queue: '{n} more queued',
      removeQueued: 'Remove from queue',
      phase_starting: 'Preparing',
      phase_installing: 'Installing',
      phase_cancelling: 'Cancelling',
      phase_applying: 'Applying',
      phase_checking: 'Checking update',
      phase_removing: 'Removing old version',
      phase_restoring: 'Restoring old version',
      cancelTooLate: 'Already applying; this install can no longer be stopped',
      cancelUnsupported: 'This Host cannot abort an install; the rest of the queue was stopped',
      logShow: 'Show log',
      logHide: 'Hide log',
      logEmpty: 'No log output yet',
      toastTitle: 'Plugin install finished',
      toastBody: '{ok} done · {failed} failed · {restart} need a restart',
      toastOpen: 'View',
      toastClose: 'Close',
      settingsVisibility: 'Show in',
      showSidebar: 'Sidebar',
      showPluginsTab: 'Plugins page',
      settingsNote: 'Settings always keeps a market entry.',
      viewMarket: 'Market',
      viewInstalled: 'Installed',
      searchInstalled: 'Search installed plugins',
      installedSummary: '{total} installed · {enabled} enabled · {disabled} disabled',
      installedEmptyTitle: 'Nothing to show',
      installedEmptyBody: 'Plugins installed by hand or from another market appear here.',
      installedProfileTitle: 'Installed plugins',
      installedBundledTitle: 'Bundled with DSH',
      tagEnabled: 'Enabled',
      tagOfficial: 'Bundled',
      tagOptional: 'Optional',
      tagReadOnly: 'Read only',
      tagMissing: 'Files missing',
      tagError: 'Unreadable',
      installedDetailTitle: 'Plugin details',
      detailReadmeLoading: 'Loading the local README…',
      detailReadmeFailed: 'Could not read the README; showing package facts.',
      installedRows: 'Rows',
      installedOverrides: 'Overrides',
      installedSource: 'Install source',
      installedAvailability: 'Files',
      confirmUninstallInstalled: 'Uninstall this plugin?',
      confirmUninstallInstalledBody: 'What it provides goes away and its installed files are removed.',
      actionFailed: 'Action failed: {reason}',
      restartNeeded: 'Restart the client to apply',
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
      builtinSources: 'Built-in aggregators',
      recommendedSources: 'Recommended',
      builtinBadge: 'Built-in',
      builtinTrust: 'Built-in sources are still third-party content; verify before installing.',
      dshSoDesc: '32,000+ artifacts with stars, npm downloads, security scans and verification levels.',
      dshmarketDesc: 'The curated dshmarket.com directory: 6,000+ installable plugins.',
      dshOpenDesc: 'DSH Open Market: 1,340 community plugins as a format-1 index.',
      dshGoDesc: 'DSH Go Market: 41 curated plugins behind a cached worker.',
      addRecommended: 'Add',
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

    const SearchIcon = ({ size = 15 }) => icon(size, [
      h('circle', { key: 'a', cx: 11, cy: 11, r: 7 }),
      h('path', { key: 'b', d: 'M20 20l-3.5-3.5' }),
    ])
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
    /** The sidebar row's mark: a storefront awning over a package. */
    const MarketIcon = ({ size = 16 }) => icon(size, [
      h('path', { key: 'a', d: 'M4 10h16l-1.2 9.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 10z' }),
      h('path', { key: 'b', d: 'M8 10V7a4 4 0 0 1 8 0v3' }),
      h('path', { key: 'c', d: 'M9.5 14.5h5' }),
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
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px',
        font: 'inherit', fontSize: '12.5px', fontWeight: 500, flex: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        border: `1px solid ${primary ? 'transparent' : 'var(--dsw-alias-border-l2)'}`,
        background: primary ? 'var(--dsw-alias-button-primary-fill)' : 'transparent',
        color: primary ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-label-primary)',
        transition: 'transform .16s, background-color .16s, opacity .16s',
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
        background: 'rgba(15,23,42,.32)', backdropFilter: 'blur(8px)',
      },
      modal: {
        width: 'min(560px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', display: 'flex',
        flexDirection: 'column', gap: '10px', padding: '20px 22px', borderRadius: '20px', border: '0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2))',
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 28px 90px rgba(15,23,42,.26)',
      },
      modalTitle: { fontSize: '16px', fontWeight: 650, letterSpacing: '-.01em', margin: 0 },
      modalBody: { fontSize: '12.5px', lineHeight: '19px', color: 'var(--dsw-alias-label-secondary)', margin: 0 },
      modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' },
      list: { display: 'flex', flexDirection: 'column', gap: '6px', margin: 0, padding: 0, listStyle: 'none' },
      row: {
        display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '12px',
        border: '0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2))',
        background: 'var(--dsw-alias-bg-layer-2)', minWidth: 0,
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

    /**
     * Apple-like surface language for the list page. Static styling lives here
     * so hover, focus, media queries and reduced motion are possible at all;
     * only values React must compute (progress width, selected state) stay
     * inline. Every colour is a DSH alias token, so light and dark themes and
     * the user's own theme both repaint the page.
     */
    const APPLE_CSS = `
      .vpm-page{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;padding:22px 24px 0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:var(--dsw-alias-label-primary)}
      .vpm-page *,.vpm-page *::before,.vpm-page *::after{box-sizing:border-box}
      .vpm-segment{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);align-self:flex-start}
      .vpm-segment-item{height:28px;padding:0 14px;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background-color .16s,color .16s,box-shadow .16s}
      .vpm-segment-item:hover{color:var(--dsw-alias-label-primary)}
      .vpm-segment-item.on{background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-weight:650;box-shadow:0 1px 3px rgba(15,23,42,.10)}
      .vpm-segment.sm{padding:2px}
      .vpm-segment.sm .vpm-segment-item{height:26px;padding:0 10px;font-size:11.5px}
      .vpm-menu.scroll{max-height:320px;overflow-y:auto}
      .vpm-queue{display:flex;flex-direction:column;gap:5px;margin-top:4px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2)}
      .vpm-queue-item{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);min-width:0}
      .vpm-queue-item .vpm-queue-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
      .vpm-queue-remove{width:22px;height:22px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;line-height:22px;cursor:pointer;flex:none}
      .vpm-queue-remove:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
      .vpm-log{margin:8px 0 0;max-height:150px;overflow:auto;padding:9px 11px;border-radius:11px;background:var(--dsw-alias-bg-layer-1);font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:16px;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
      .vpm-toast{position:fixed;right:22px;bottom:22px;z-index:2000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
      .vpm-toast-card{pointer-events:auto;display:flex;align-items:center;gap:12px;min-width:280px;max-width:460px;padding:12px 14px;border-radius:16px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-1);box-shadow:0 18px 50px rgba(15,23,42,.22);box-sizing:border-box;backdrop-filter:blur(18px) saturate(170%)}
      .vpm-toast-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
      .vpm-toast-title{font-size:13px;line-height:18px;font-weight:650;color:var(--dsw-alias-label-primary);margin:0}
      .vpm-toast-body{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary);margin:0}
      .vpm-toast-actions{display:flex;align-items:center;gap:6px;flex:none}
      .vpm-settings{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:8px 14px;border-radius:13px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-1)}
      .vpm-switch{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}
      .vpm-switch input{appearance:none;-webkit-appearance:none;width:38px;height:22px;margin:0;border-radius:999px;background:var(--dsw-alias-border-l3);position:relative;transition:background-color .18s;cursor:pointer;flex:none}
      .vpm-switch input::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.25);transition:transform .18s}
      .vpm-switch input:checked{background:var(--dsw-alias-brand-primary)}
      .vpm-switch input:checked::after{transform:translateX(16px)}
      .vpm-switch input:focus-visible{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent)}
      @media (prefers-reduced-motion:reduce){.vpm-switch input,.vpm-switch input::after{transition:none}}
      @media (max-width:680px){.vpm-toast{left:14px;right:14px;bottom:14px}.vpm-toast-card{min-width:0;max-width:none}}
      .vpm-page-inner{display:flex;flex-direction:column;height:100%;min-height:0;gap:14px;width:100%;max-width:1160px;margin:0 auto}
      .vpm-hero{position:relative;flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:22px 24px;border-radius:24px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-1);overflow:hidden}
      @supports (background:color-mix(in srgb,red 10%,blue)){.vpm-hero{background:linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-1)) 0%,var(--dsw-alias-bg-layer-1) 58%)}}
      .vpm-hero::after{content:"";position:absolute;right:-70px;top:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent) 0%,transparent 68%);pointer-events:none}
      .vpm-hero-copy{position:relative;z-index:1;display:flex;flex-direction:column;gap:5px;min-width:0}
      .vpm-eyebrow{font-size:10.5px;font-weight:650;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
      .vpm-title{margin:0;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-.03em;color:var(--dsw-alias-label-primary)}
      .vpm-subtitle{margin:0;font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary)}
      .vpm-summary{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:4px;font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
      .vpm-summary b{font-weight:650;color:var(--dsw-alias-label-secondary)}
      .vpm-summary .vpm-dot{width:3px;height:3px;border-radius:50%;background:var(--dsw-alias-border-l3);display:inline-block}
      .vpm-hero-actions{position:relative;z-index:1;display:flex;align-items:center;gap:9px;flex:1;max-width:520px;justify-content:flex-end}
      .vpm-search{position:relative;display:flex;align-items:center;flex:1;min-width:200px}
      .vpm-search .vpm-search-icon{position:absolute;left:13px;display:flex;color:var(--dsw-alias-label-tertiary);pointer-events:none}
      .vpm-search input{width:100%;height:40px;padding:0 14px 0 38px;border-radius:13px;border:1px solid transparent;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none;transition:border-color .18s,box-shadow .18s,background-color .18s}
      .vpm-search input::placeholder{color:var(--dsw-alias-label-tertiary)}
      .vpm-search input:focus{border-color:var(--dsw-alias-border-selected);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);background:var(--dsw-alias-bg-layer-1)}
      .vpm-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border-radius:13px;border:1px solid transparent;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;transition:transform .16s,background-color .16s}
      .vpm-icon-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-hover,var(--dsw-alias-bg-layer-1))}
      .vpm-icon-btn:active:not(:disabled){transform:scale(.94)}
      .vpm-icon-btn:disabled{opacity:.45;cursor:default}
      .vpm-toolbar{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .vpm-source-btn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;max-width:220px;transition:background-color .16s,transform .16s}
      .vpm-source-btn:hover{background:var(--dsw-alias-bg-layer-2)}
      .vpm-source-btn:active{transform:scale(.98)}
      .vpm-menu{position:absolute;top:calc(100% + 7px);left:0;z-index:60;min-width:230px;padding:5px;display:flex;flex-direction:column;border-radius:14px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-1);box-shadow:0 18px 44px rgba(15,23,42,.18);backdrop-filter:blur(20px) saturate(170%)}
      .vpm-menu.right{left:auto;right:0}
      .vpm-menu-item{display:block;width:100%;padding:8px 11px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background-color .12s}
      .vpm-menu-item:hover{background:var(--dsw-alias-bg-layer-2)}
      .vpm-menu-item.on{font-weight:650;color:var(--dsw-alias-state-business-primary)}
      .vpm-menu-sep{height:1px;margin:5px 3px;background:var(--dsw-alias-border-l2)}
      .vpm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:none;height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:transform .16s,background-color .16s,opacity .16s}
      .vpm-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
      .vpm-btn:active:not(:disabled){transform:scale(.97)}
      .vpm-btn:disabled{opacity:.45;cursor:default}
      .vpm-btn.primary{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}
      .vpm-btn.primary:hover:not(:disabled){filter:brightness(.96);background:var(--dsw-alias-button-primary-fill)}
      .vpm-btn.danger{background:var(--dsw-alias-state-error-primary);border-color:transparent;color:#fff}
      .vpm-btn.danger:hover:not(:disabled){filter:brightness(.95);background:var(--dsw-alias-state-error-primary)}
      .vpm-btn.small{height:26px;padding:0 11px;font-size:11.5px}
      .vpm-pills{flex:none;display:flex;gap:7px;flex-wrap:wrap;align-items:center}
      .vpm-pill{height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background-color .14s,color .14s,border-color .14s,transform .14s}
      .vpm-pill:hover{border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
      .vpm-pill:active{transform:scale(.97)}
      .vpm-pill.on{background:var(--dsw-alias-label-primary);border-color:transparent;color:var(--dsw-alias-bg-layer-1);font-weight:600}
      .vpm-bar{flex:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 13px;border-radius:13px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);font-size:12.5px;color:var(--dsw-alias-label-primary)}
      .vpm-bar.bulk{border-color:var(--dsw-alias-border-selected)}
      .vpm-bar.error{color:var(--dsw-alias-state-error-primary)}
      .vpm-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:2px 2px 20px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l3) transparent}
      .vpm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin:0;padding:0;list-style:none;align-items:start}
      .vpm-installed-section{display:flex;flex-direction:column;gap:10px}
      .vpm-installed-section + .vpm-installed-section{margin-top:24px;padding-top:18px;border-top:1px solid var(--dsw-alias-border-l2)}
      .vpm-section-title{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;line-height:18px;font-weight:650;letter-spacing:-.01em;color:var(--dsw-alias-label-secondary)}
      .vpm-section-title .vpm-count{font-size:11px;line-height:16px;font-weight:500;color:var(--dsw-alias-label-tertiary)}
      .vpm-card{position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;min-height:164px;align-self:start;padding:16px;border-radius:18px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-1));cursor:pointer;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s,border-color .18s,background-color .18s}
      .vpm-card:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(15,23,42,.11);border-color:var(--dsw-alias-border-l3)}
      .vpm-card:active{transform:translateY(0) scale(.996)}
      .vpm-card:focus-within{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent)}
      .vpm-card.picked{border-color:var(--dsw-alias-border-selected);background:var(--dsw-alias-bg-multi-select)}
      .vpm-card-top{display:flex;align-items:flex-start;gap:11px;min-width:0}
      .vpm-icon{flex:none;display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
      .vpm-icon img{width:100%;height:100%;object-fit:cover;display:block}
      .vpm-card-head{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;padding-top:1px}
      .vpm-card-title{font-size:15px;line-height:20px;font-weight:650;letter-spacing:-.015em;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vpm-card-sub{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vpm-card-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .vpm-check{margin:1px 0 0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;flex:none}
      .vpm-desc{margin:0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
      .vpm-card-footer{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:auto}
      .vpm-tag{padding:1px 9px;border-radius:999px;font-size:11px;line-height:17px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);background:transparent;flex:none}
      .vpm-tag.ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
      .vpm-tag.warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}
      .vpm-tag.error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);cursor:pointer;font:inherit}
      .vpm-tag.bad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
      .vpm-metrics{margin-left:auto;display:flex;align-items:center;gap:9px;font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
      .vpm-metrics b{font-weight:650;color:var(--dsw-alias-label-secondary)}
      .vpm-meta{margin:0;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
      .vpm-state{padding:52px 16px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px}
      .vpm-state .vpm-state-mark{width:54px;height:54px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
      .vpm-state .vpm-state-title{font-size:15px;font-weight:650;color:var(--dsw-alias-label-primary);margin:0}
      .vpm-state .vpm-state-body{margin:0;max-width:360px;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary)}
      .vpm-skeleton{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin:0;padding:0;list-style:none}
      .vpm-skeleton-card{height:176px;border-radius:18px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));background:linear-gradient(100deg,var(--dsw-alias-bg-layer-2) 30%,var(--dsw-alias-bg-layer-1) 50%,var(--dsw-alias-bg-layer-2) 70%);background-size:220% 100%;animation:vpm-shimmer 1.4s ease-in-out infinite;opacity:.9}
      .vpm-skeleton-card:nth-child(2){animation-delay:.08s}.vpm-skeleton-card:nth-child(3){animation-delay:.16s}
      .vpm-skeleton-card:nth-child(4){animation-delay:.24s}.vpm-skeleton-card:nth-child(5){animation-delay:.32s}.vpm-skeleton-card:nth-child(6){animation-delay:.4s}
      @keyframes vpm-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
      .vpm-skeleton-card,.vpm-card,.vpm-btn,.vpm-pill,.vpm-icon-btn{outline:none}
      .vpm-card:focus-visible,.vpm-btn:focus-visible,.vpm-pill:focus-visible,.vpm-icon-btn:focus-visible,.vpm-source-btn:focus-visible,.vpm-search input:focus-visible{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent)}
      .vpm-spin{width:14px;height:14px;flex:none;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:vpm-spin .9s linear infinite}
      .vpm-progress{height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
      .vpm-progress > span{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .3s ease}
      .vpm-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
      .vpm-grow{margin-right:auto}
      @media (max-width:900px){.vpm-hero{flex-direction:column;align-items:stretch;padding:20px}.vpm-hero-actions{max-width:none;justify-content:flex-start}.vpm-title{font-size:23px;line-height:29px}}
      @media (max-width:680px){.vpm-page{padding:14px 14px 0}.vpm-grid,.vpm-skeleton{grid-template-columns:minmax(0,1fr)}.vpm-toolbar{gap:6px}}
      @media (prefers-reduced-motion:reduce){.vpm-card,.vpm-btn,.vpm-pill,.vpm-icon-btn,.vpm-search input{transition:none}.vpm-card:hover{transform:none}.vpm-skeleton-card{animation:none}}
    `
    const APPLE_STYLE = 'vpm-apple'
    if (typeof document !== 'undefined' && document.querySelector(`style[data-${APPLE_STYLE}]`) === null) {
      const tag = document.createElement('style')
      tag.dataset[APPLE_STYLE.replace(/-(\w)/g, (_all, char) => char.toUpperCase())] = '1'
      tag.textContent = APPLE_CSS
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
      if (source.type === 'npm') {
        return version.install?.spec === undefined ? 'npm' : version.install.spec
      }
      // Aggregators pin a tag rather than a commit, so there may be no SHA to
      // shorten; fall back to the repository URL.
      return `${source.url}${source.commit === '' || source.commit === undefined ? '' : `@${source.commit.slice(0, 8)}`}${source.path === undefined ? '' : ` ${source.path}`}`
    }

    /** Format a publish timestamp in the active language. */
    function formatDate(timestamp, lang) {
      try {
        return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(timestamp * 1000))
      } catch {
        return ''
      }
    }

    /** The name a configured or built-in source carries in the picker. */
    function marketSourceLabel(source, text, lang) {
      if (VEYRA_SOURCES.includes(source.url)) return lang === 'zh' ? 'Veyra 精选' : 'Veyra picks'
      if (source.url === DSHMARKET_CATALOG) return 'dshmarket.com'
      if (source.url === DSHOPEN_CATALOG) return lang === 'zh' ? '开放插件市场' : 'DSH Open Market'
      if (source.url === DSH_GO_CATALOG) return 'DSH Go Market'
      if (source.url === DSH_SO_SOURCE.url) return text(source.title)
      return source.title === undefined ? source.url : text(source.title)
    }

    /** A localized display string, accepting a plain string, a locale map, or nothing. */
    function localizedValue(value, lang) {
      if (typeof value === 'string') return value
      if (value === null || typeof value !== 'object') return ''
      const direct = value[lang] ?? value[lang === 'zh' ? 'zh-CN' : 'en'] ?? value.en
      if (typeof direct === 'string') return direct
      const first = Object.values(value).find((candidate) => typeof candidate === 'string')
      return typeof first === 'string' ? first : ''
    }

    /** The short name a person reads: no scope, no `dsh-` prefix. */
    function shortBundleName(name) {
      const text = String(name ?? '')
      const base = text.startsWith('@') ? text.slice(text.indexOf('/') + 1) : text
      return base.replace(/^dsh-/, '') || text
    }

    /** One bundle's display title, from its localized metadata or its name. */
    function bundleTitle(bundle, lang) {
      return localizedValue(bundle?.meta?.title, lang) || shortBundleName(bundle?.name)
    }

    /** One bundle's description, from localized metadata or the manifest. */
    function bundleDescription(bundle, lang) {
      return localizedValue(bundle?.meta?.description, lang) || String(bundle?.description ?? '')
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
    function SourcesDialog({ sources, lang, t, text, saving, failure, onAdd, onRemove, onClose }) {
      const [draft, setDraft] = useState('')
      // Recommended host catalogs that the profile does not carry yet.
      const recommended = [
        { url: DSHMARKET_CATALOG, label: 'dshmarket.com', desc: t('dshmarketDesc') },
        { url: DSHOPEN_CATALOG, label: marketSourceLabel({ url: DSHOPEN_CATALOG }, text, lang), desc: t('dshOpenDesc') },
        { url: DSH_GO_CATALOG, label: 'DSH Go Market', desc: t('dshGoDesc') },
      ].filter((item) => !sources.some((source) => source.url === item.url))
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
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('span', { style: { ...S.meta, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' } }, t('builtinSources')),
        h('ul', { style: S.list },
          h('li', { key: 'dsh-so', style: S.row },
            h('div', { style: S.rowMain },
              h('span', { style: S.name }, text(DSH_SO_SOURCE.title)),
              h('span', { style: S.mono }, t('dshSoDesc'))),
            h('span', { style: S.tag('neutral') }, t('builtinBadge'))),
          recommended.map((item) => h('li', { key: item.url, style: S.row },
            h('div', { style: S.rowMain },
              h('span', { style: S.name }, item.label),
              h('span', { style: S.mono }, item.desc)),
            h('button', {
              style: S.btn(true, saving), disabled: saving,
              onClick: () => { onAdd(item.url) },
            }, t('addRecommended'))))),
        h('p', { style: { ...S.meta, margin: 0 } }, t('builtinTrust'))),
      sources.length === 0 ? null : h('ul', { style: S.list },
        sources.map((source) => h('li', { key: source.url, style: S.row },
          h('div', { style: S.rowMain },
            h('span', { style: S.name }, marketSourceLabel(source, text, lang)),
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
    function Card({ entry, bundle, lang, t, text, busy, picked, failure, copied, stats, onPick, onRun, onConfirm, onDetails, onCopyFailure, onClearFailure }) {
      const title = entry.title === undefined ? entry.name : text(entry.title)
      const state = entryState(entry)
      const shown = presentedVersion(entry)
      const version = actionVersion(entry)
      const date = shown === undefined || !shown.publishTimestamp ? '' : formatDate(shown.publishTimestamp, lang)
      const incompatible = state === 'available' && version === undefined
      const installed = state === 'installed' || state === 'updatable'
      const statistic = statsOfEntry(entry, stats)
      const metrics = statistic === null ? [] : [
        statistic.stars === undefined ? null : `★ ${compactCount(statistic.stars)}`,
        statistic.downloads === undefined ? null : `↓ ${compactCount(statistic.downloads)}${statistic.window === '30d' ? '/30d' : ''}`,
      ].filter(Boolean)
      const statsTitle = statistic === null ? undefined : [
        statistic.stars === undefined ? null : `${lang === 'zh' ? 'GitHub 仓库' : 'GitHub repository'} ${statistic.stars} stars`,
        statistic.downloads === undefined ? null : `${lang === 'zh' ? 'npm 下载' : 'npm downloads'} ${statistic.downloads}${statistic.start !== undefined && statistic.end !== undefined ? ` (${statistic.start} ~ ${statistic.end})` : statistic.window === '30d' ? (lang === 'zh' ? '（近 30 天）' : ' (last 30 days)') : ''}`,
        statistic.checkedAt === undefined ? null : `${lang === 'zh' ? '数据时间' : 'as of'} ${statistic.checkedAt.slice(0, 10)}`,
      ].filter(Boolean).join(' · ')

      const currentVersion = bundle?.version
      const nextVersion = state === 'updatable' ? updateTarget(entry)?.version : undefined

      const actions = []
      if (version !== undefined) {
        const update = state === 'updatable'
        actions.push(h('button', {
          key: 'act', className: 'vpm-btn small primary', disabled: busy,
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
            key: 'remove', className: 'vpm-btn small', disabled: busy,
            onClick: (event) => { event?.stopPropagation(); onConfirm({ action: 'uninstall', orders: [{ action: 'uninstall', entry, bundle }] }) },
          }, t('uninstall')))
        }
        if (bundle !== undefined && bundle.readOnlyReason === undefined) {
          const disable = bundle.enabled
          actions.push(h('button', {
            key: 'toggle', className: 'vpm-btn small', disabled: busy,
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
          className: 'vpm-tag error',
          onClick: (event) => { event?.stopPropagation(); void onCopyFailure(entry.name, failure) },
        }, copied === entry.name ? t('copied') : t('failedTag')))
        tags.push(h('button', {
          key: 'fc', type: 'button', title: t('clearError'), 'aria-label': t('clearError'),
          className: 'vpm-tag error',
          onClick: (event) => { event?.stopPropagation(); onClearFailure(entry.name) },
        }, '×'))
      }
      if (state === 'provided') tags.push(h('span', { key: 'p', className: 'vpm-tag' }, t('tagProvided')))
      if (state === 'updatable') tags.push(h('span', { key: 'u', className: 'vpm-tag warn' }, t('tagUpdate')))
      if (state === 'installed') tags.push(h('span', { key: 'i', className: 'vpm-tag ok' }, t(bundle !== undefined && bundle.enabled === false ? 'tagDisabled' : 'tagInstalled')))
      if (incompatible) tags.push(h('span', { key: 'x', className: 'vpm-tag warn' }, t('tagIncompatible')))
      if (shown !== undefined && prerelease(shown.version)) tags.push(h('span', { key: 'r', className: 'vpm-tag' }, t('tagPrerelease')))
      // dsh.so scores every artifact; one compact tag keeps the source's
      // security/verification signal without turning the card into a report.
      const quality = entry.marketExtra
      if (quality?.verificationShort || quality?.security) {
        const tone = quality.securityTone === 'green'
          ? ' ok'
          : quality.securityTone === 'amber' ? ' warn' : quality.securityTone === 'red' || quality.securityTone === 'darkred' ? ' bad' : ''
        tags.push(h('span', {
          key: 'q', className: `vpm-tag${tone}`,
          title: [quality.verification, quality.security, quality.trust?.replace(/^./, (char) => char.toUpperCase())].filter(Boolean).join(' · '),
        }, [quality.verificationShort, quality.security].filter(Boolean).join(' · ')))
      }

      // Static controls: the actions sit in the top-right rather than appearing on hover, so
      // nothing moves under the pointer and an action is never missed. A click elsewhere on the
      // card opens this market's detail view; the checkbox and buttons stop propagation.
      const open = onDetails === undefined ? undefined : () => { onDetails(entry) }
      const subtitle = [
        entry.author === undefined ? null : entry.author,
        shown === undefined ? null : `${t('version')} ${shown.version}`,
        date === '' ? null : date,
      ].filter(Boolean).join(' · ')
      const metricNodes = statistic === null ? null : h('div', { className: 'vpm-metrics', title: statsTitle },
        statistic.stars === undefined ? null : h('span', { key: 's' }, '★ ', h('b', null, compactCount(statistic.stars))),
        statistic.downloads === undefined ? null : h('span', { key: 'd' }, '↓ ', h('b', null, compactCount(statistic.downloads)), statistic.window === '30d' ? ' /30d' : ''))
      return h('li', {
        className: `vpm-card${picked ? ' picked' : ''}`,
        onClick: open,
      },
        h('div', { className: 'vpm-card-top' },
          h('input', {
            type: 'checkbox', className: 'vpm-check', checked: picked, disabled: busy,
            'aria-label': title, onChange: onPick,
            onClick: (event) => { event?.stopPropagation() },
          }),
          h('span', { className: 'vpm-icon' }, h(Artwork, { src: entry.icon })),
          h('div', { className: 'vpm-card-head' },
            h('span', { className: 'vpm-card-title', title }, title),
            subtitle === '' ? null : h('span', { className: 'vpm-card-sub' }, subtitle)),
          actions.length === 0 ? null : h('div', {
            className: 'vpm-card-actions',
            onClick: (event) => { event?.stopPropagation() },
          }, actions)),
        entry.description === undefined ? null : h('p', { className: 'vpm-desc' }, text(entry.description)),
        h('div', { className: 'vpm-card-footer' },
          tags.length === 0 ? null : h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } }, tags),
          metricNodes))
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
          const src = resolve(image[2])
          // A local bundle README may use relative assets the client cannot
          // fetch; skip them rather than draw a broken image box.
          if (src !== '') {
            blocks.push(h('img', {
              key: `${key}i${blocks.length}`, src, alt: image[1],
              style: S.mdImg, loading: 'lazy', referrerPolicy: 'no-referrer',
            }))
          }
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

    function DetailDialog({ entry, bundle, lang, t, text, busy, stats, onRun, onConfirm, onClose }) {
      const title = entry.title === undefined ? entry.name : text(entry.title)
      const statistic = statsOfEntry(entry, stats)
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
        entry.marketExtra?.categoryLabels?.[0] ?? (entry.metadata && entry.metadata.category ? entry.metadata.category : null),
        statistic?.stars === undefined ? null : `★ ${compactCount(statistic.stars)}`,
        statistic?.downloads === undefined ? null : `↓ ${compactCount(statistic.downloads)}${statistic.window === '30d' ? '/30d' : ''}`,
        entry.marketExtra?.verification === undefined || entry.marketExtra.verification === '' ? null : entry.marketExtra.verification,
        entry.marketExtra?.security === undefined || entry.marketExtra.security === '' ? null : entry.marketExtra.security,
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
                  h('span', { style: { ...S.meta, marginLeft: 'auto' } }, v.publishTimestamp ? formatDate(v.publishTimestamp, lang) : '')))),
              entry.versions.length > history.length
                ? h('p', { style: S.meta }, lang === 'zh' ? `还有 ${entry.versions.length - history.length} 个更早版本未显示` : `${entry.versions.length - history.length} older versions not shown`)
                : null),
            h('div', { style: { flex: 'none', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--dsw-alias-border-l1)', fontSize: '12.5px', lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } },
              '有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。'))
        )
      )
    }

    /**
     * One bundle on the installed tab. It is deliberately not a market card:
     * the bundle object carries no index entry, install target or market stats,
     * and every action here is the Host's own bundle control.
     */
    function InstalledCard({ bundle, lang, t, busy, onDetails, onToggle, onUninstall }) {
      const title = bundleTitle(bundle, lang)
      const description = bundleDescription(bundle, lang)
      const official = bundle.official === true || bundle.availability === 'installation'
      const missing = bundle.availability === 'missing'
      const tags = [
        h('span', { key: 'state', className: `vpm-tag${bundle.enabled === true ? ' ok' : ''}` },
          bundle.enabled === true ? t('tagEnabled') : t('tagDisabled')),
        official ? h('span', { key: 'official', className: 'vpm-tag' }, t('tagOfficial')) : null,
        bundle.optional === true ? h('span', { key: 'optional', className: 'vpm-tag' }, t('tagOptional')) : null,
        missing ? h('span', { key: 'missing', className: 'vpm-tag bad' }, t('tagMissing')) : null,
        bundle.readOnlyReason === undefined ? null : h('span', {
          key: 'readonly', className: 'vpm-tag', title: bundle.readOnlyReason,
        }, t('tagReadOnly')),
        bundle.error === undefined ? null : h('span', {
          key: 'error', className: 'vpm-tag bad',
          title: bundle.error.diagnostic ?? bundle.error.code,
        }, t('tagError')),
      ].filter(Boolean)
      const actions = [
        // No Details button: the whole card opens the detail dialog.
        bundle.readOnlyReason !== undefined || missing ? null : h('button', {
          key: 'toggle', className: 'vpm-btn small', disabled: busy,
          onClick: (event) => { event?.stopPropagation(); onToggle(bundle) },
        }, bundle.enabled === true ? t('disable') : t('enable')),
        bundle.removable === true && !missing ? h('button', {
          key: 'uninstall', className: 'vpm-btn small', disabled: busy,
          onClick: (event) => { event?.stopPropagation(); onUninstall(bundle) },
        }, t('uninstall')) : null,
      ].filter(Boolean)
      return h('li', {
        className: 'vpm-card',
        onClick: () => { onDetails(bundle) },
      },
        h('div', { className: 'vpm-card-top' },
          h('span', { className: 'vpm-icon' }, h(BoxIcon, { size: 20 })),
          h('div', { className: 'vpm-card-head' },
            h('span', { className: 'vpm-card-title', title }, title),
            h('span', { className: 'vpm-card-sub' },
              [bundle.name, bundle.version === undefined ? null : `v${bundle.version}`].filter(Boolean).join(' · '))),
          h('div', { className: 'vpm-card-actions', onClick: (event) => { event?.stopPropagation() } }, actions)),
        description === '' ? null : h('p', { className: 'vpm-desc' }, description),
        h('div', { className: 'vpm-card-footer' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } }, tags),
          bundle.source === undefined || bundle.source === ''
            ? null
            : h('span', { className: 'vpm-meta vpm-ellipsis', style: { maxWidth: '58%' }, title: bundle.source }, bundle.source)))
    }

    /**
     * Details for a bundle the profile holds, read from the local package
     * (`readBundleDetail`) rather than from a market index. Older Hosts
     * without that method still show the manifest facts.
     */
    function InstalledDetailDialog({ bundle, remote, lang, t, busy, onToggle, onUninstall, onClose }) {
      const [view, setView] = useState({ loading: true, markdown: '', error: '' })
      useEffect(() => {
        let live = true
        const read = remote.pluginManager.readBundleDetail
        if (typeof read !== 'function') {
          setView({ loading: false, markdown: '', error: '' })
          return () => { live = false }
        }
        setView({ loading: true, markdown: '', error: '' })
        Promise.resolve(read.call(remote.pluginManager, bundle.name, lang === 'zh' ? 'zh-CN' : 'en')).then(
          (answer) => {
            if (!live) return
            if (answer.ok && answer.value.status === 'found') {
              setView({ loading: false, markdown: answer.value.markdown, error: '' })
            } else {
              setView({ loading: false, markdown: '', error: answer.ok ? '' : answer.error.message })
            }
          },
          (error) => {
            if (live) setView({ loading: false, markdown: '', error: String(error?.message ?? error) })
          },
        )
        return () => { live = false }
      }, [bundle.name, lang, remote])

      const title = bundleTitle(bundle, lang)
      const description = bundleDescription(bundle, lang)
      const official = bundle.official === true || bundle.availability === 'installation'
      const missing = bundle.availability === 'missing'
      const facts = [
        bundle.version === undefined ? null : `v${bundle.version}`,
        bundle.enabled === true ? t('tagEnabled') : t('tagDisabled'),
        official ? t('tagOfficial') : null,
        bundle.optional === true ? t('tagOptional') : null,
        bundle.availability === undefined ? null : `${t('installedAvailability')}: ${bundle.availability}`,
      ].filter(Boolean)
      const footer = [
        h('button', { key: 'close', className: 'vpm-btn small', onClick: onClose }, t('toastClose')),
        bundle.readOnlyReason !== undefined || missing ? null : h('button', {
          key: 'toggle', className: 'vpm-btn small', disabled: busy,
          onClick: () => { onToggle(bundle) },
        }, bundle.enabled === true ? t('disable') : t('enable')),
        bundle.removable === true && !missing ? h('button', {
          key: 'uninstall', className: 'vpm-btn small', disabled: busy,
          onClick: () => { onUninstall(bundle) },
        }, t('uninstall')) : null,
      ].filter(Boolean)
      const resolve = (src) => (/^(?:https?:|data:)/i.test(src) ? src : '')
      return h(Modal, { title, onClose, footer },
        h('p', { style: { ...S.modalBody, margin: 0, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '11.5px', wordBreak: 'break-all' } }, bundle.name),
        facts.length === 0 ? null : h('p', { style: { ...S.meta, margin: 0 } }, facts.join(' · ')),
        description === '' ? null : h('p', { style: S.modalBody }, description),
        bundle.readOnlyReason === undefined ? null : h('p', { style: { ...S.modalBody, ...S.error } }, `${t('tagReadOnly')}: ${bundle.readOnlyReason}`),
        bundle.error === undefined ? null : h('p', { style: { ...S.modalBody, ...S.error } }, bundle.error.diagnostic ?? bundle.error.code),
        h('div', { style: { marginTop: '4px' } },
          view.loading
            ? h('p', { style: S.meta }, t('detailReadmeLoading'))
            : view.error !== ''
              ? h('p', { style: S.meta }, `${t('detailReadmeFailed')} ${view.error}`)
              : view.markdown === ''
                ? null
                : h('div', null, renderMarkdown(view.markdown, `${bundle.name}-installed`, resolve))),
        bundle.source === undefined || bundle.source === ''
          ? null
          : h('p', { style: { ...S.meta, margin: 0, wordBreak: 'break-all' } }, `${t('installedSource')}: ${bundle.source}`),
        bundle.rows === undefined || bundle.rows.length === 0 ? null : h('div', {
          style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l1)' },
        },
          h('h4', { style: S.mdHead }, t('installedRows')),
          h('ul', { style: S.list },
            bundle.rows.map((row) => h('li', { key: row.rowId, style: S.row },
              h('div', { style: S.rowMain },
                h('span', { style: S.name }, row.rowId),
                h('span', { style: S.mono }, row.moduleName)))))),
        bundle.overrides === undefined || bundle.overrides.length === 0 ? null : h('div', { style: { marginTop: '8px' } },
          h('h4', { style: S.mdHead }, t('installedOverrides')),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            bundle.overrides.map((id) => h('span', { key: id, className: 'vpm-tag' }, id)))))
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
        const resolveBundle = buildBundleIndex(new Map(bundles.value.map((bundle) => [bundle.name, bundle])))
        const updatable = page.value.entries
          .filter((entry) => resolveBundle(entry) !== undefined && updateTarget(entry) !== undefined).length
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
      const surface = props.surface ?? 'plugins'
      const showVisibility = surface === 'settings'
      const lang = useLocale((snapshot) => snapshot.active)
      const text = useCallback((value) => marketText(value, lang), [lang])
      const visibilityState = useVisibility()

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
      const [statsIndex, setStatsIndex] = useState(null)
      const [refreshed, setRefreshed] = useState(false)
      const [view, setView] = useState('market')
      const [showLog, setShowLog] = useState(false)
      const [clock, setClock] = useState(() => Date.now())
      const [installedBusy, setInstalledBusy] = useState(null)
      const [installedNotice, setInstalledNotice] = useState(null)
      const [installedConfirm, setInstalledConfirm] = useState(null)
      const [installedDetail, setInstalledDetail] = useState(null)
      /** The batch, owned outside this component so leaving the page does not stop it. */
      const job = useRunner()
      const { running, outcome } = job
      // A new queue item starts a fresh log view; a retry of the same item
      // keeps `startedAt`, so reopening the log is not lost on a retry.
      useEffect(() => {
        if (running === null) {
          setShowLog(false)
          return undefined
        }
        setShowLog(false)
        setClock(Date.now())
        const timer = setInterval(() => setClock(Date.now()), 1000)
        // The headless render check never unmounts; an active Node interval
        // would keep the process alive after the assertions finish.
        if (typeof timer?.unref === 'function') timer.unref()
        return () => clearInterval(timer)
      }, [running?.startedAt])
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

      // A batch belongs to the plugin, not to this tab, so `running` is the runner's. Nothing to
      // release on unmount — the run keeps going and the next mount subscribes to its state.

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
        // The profile always gets Veyra back. The dshmarket.com catalog is
        // seeded once; removing it later is a choice, not a missing default.
        const hasVeyra = list.some((item) => VEYRA_SOURCES.includes(item.url))
        // Seeding version 2 adds the newer built-in catalogs beside the
        // original dshmarket.com one. A profile that already carries them is
        // itself the choice: removing one later must not bring it back.
        const seedState = storeGet('vyra-market.sources-seeded')
        const seeded = seedState === '2'
        const hasUrl = (url) => list.some((item) => item.url === url)
        // Version 1 seeded only dshmarket.com. An upgraded profile that
        // removed it made a choice; add the two new catalogs without undoing
        // that choice.
        const missingCatalogs = BUILTIN_CATALOGS.filter((url) => !hasUrl(url)
          && !(seedState === '1' && url === DSHMARKET_CATALOG))
        if (!seeded && missingCatalogs.length === 0) storeSet('vyra-market.sources-seeded', '2')
        const wantsVeyra = list.length === 0 || !hasVeyra
        const wantsCatalogs = !seeded && missingCatalogs.length > 0
        if (adopt && (wantsVeyra || wantsCatalogs)) {
          const additions = []
          if (wantsVeyra) additions.push(VEYRA_SOURCES[0])
          if (wantsCatalogs) additions.push(...missingCatalogs)
          const added = await remote.pluginMarket.setIndexes([...additions, ...list.map((s) => s.url)])
          if (!alive.current) return
          if (added.ok) {
            storeSet('vyra-market.sources-seeded', '2')
            const reread = await remote.pluginMarket.listIndexes()
            if (!alive.current) return
            list = reread.ok ? reread.value : []
          }
        }
        setSources(list)
        // Prefer Veyra; when the Host has no sources at all, the built-in
        // dsh.so browser is still a usable landing page.
        setActiveUrl((current) => {
          if (current === DSH_SO_SOURCE.url) return current
          if (list.some((item) => item.url === current)) return current
          const veyra = list.find((item) => VEYRA_SOURCES.includes(item.url))
          return veyra?.url ?? list[0]?.url ?? DSH_SO_SOURCE.url
        })
      }, [remote])

      /** Read the installed bundles: enabled state, removability, and read-only reason. */
      const loadBundles = useCallback(async () => {
        const answer = await remote.pluginManager.listBundles()
        if (!alive.current || !answer.ok) return
        const next = new Map(answer.value.map((bundle) => [bundle.name, bundle]))
        setBundles(next)
        // Keep an open details dialog on the same bundle's fresh facts; a
        // bundle removed meanwhile closes it rather than showing stale state.
        setInstalledDetail((current) => current === null ? null : (next.get(current.name) ?? null))
      }, [remote])

      /** Enable or disable any installed bundle, market-listed or not. */
      const toggleInstalled = useCallback(async (bundle) => {
        if (installedBusy !== null) return
        setInstalledBusy(bundle.name)
        setInstalledNotice(null)
        try {
          const answer = await remote.pluginManager.setBundleEnabled(bundle.name, bundle.enabled !== true)
          if (!alive.current) return
          if (!answer.ok) setInstalledNotice(t('actionFailed', { reason: answer.error.message }))
          else if (answer.value?.application === 'restart-required') setInstalledNotice(t('restartNeeded'))
          await loadBundles()
        } catch (error) {
          if (alive.current) setInstalledNotice(t('actionFailed', { reason: String(error?.message ?? error) }))
        } finally {
          if (alive.current) setInstalledBusy(null)
        }
      }, [installedBusy, loadBundles, remote, t])

      /** Remove an installed bundle after the explicit confirmation. */
      const uninstallInstalled = useCallback(async (bundle) => {
        if (installedBusy !== null) return
        setInstalledBusy(bundle.name)
        setInstalledNotice(null)
        setInstalledConfirm(null)
        try {
          const answer = await remote.pluginManager.removeBundle(bundle.name)
          if (!alive.current) return
          if (!answer.ok) setInstalledNotice(t('actionFailed', { reason: answer.error.message }))
          else if (answer.value?.application === 'restart-required') setInstalledNotice(t('restartNeeded'))
          setInstalledDetail(null)
          await loadBundles()
        } catch (error) {
          if (alive.current) setInstalledNotice(t('actionFailed', { reason: String(error?.message ?? error) }))
        } finally {
          if (alive.current) setInstalledBusy(null)
        }
      }, [installedBusy, loadBundles, remote, t])

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

        if (refresh) pageCache.clear()
        const cacheKey = pageCacheKey(url, next, offset, limit)
        const cached = refresh ? undefined : cachedPage(cacheKey, offset, fetchedAt)
        if (cached !== undefined) {
          // Answer the page we just showed instead of waiting for the Host to
          // repeat it. Installation state is refreshed by `changed` events.
          setListing((current) => {
            const kept = offset > 0 && current !== null && current.url === url && current.value !== null
              ? current.value.entries
              : []
            return { url, query: next, status: 'ready', failure: null, value: { ...cached, entries: [...kept, ...cached.entries] } }
          })
          return
        }

        try {
          let page
          if (url === DSH_SO_SOURCE.url) {
            // A built-in aggregator: its index is fetched and filtered here,
            // not by the Host, because the Host only reads format 1.
            const data = await loadDshSoData(refresh, signal)
            if (signal.aborted || !alive.current) return
            page = dshSoPage(data, next, offset, limit)
          } else {
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
            page = answer.value
            if (offset > 0 && page.fetchedAt !== fetchedAt) {
              if (depth < 1) await loadRef.current(url, next, 0, Math.max(offset + limit, PAGE), undefined, depth + 1)
              return
            }
          }
          rememberPage(cacheKey, page)
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
      // The stats overlay is independent of the active source and is shared by
      // every card; it never blocks the list.
      useEffect(() => {
        let live = true
        void loadStatsData().then((data) => {
          if (live && data !== null) setStatsIndex(data)
        })
        return () => { live = false }
      }, [])

      // The Host announces every completed change, so a change made anywhere —
      // this tab, the Installed tab, or an agent — lands here too.
      useEffect(() => {
        const off = remote.$on('plugin-manager/changed', () => {
          // Every page carries the profile's install state; do not answer a
          // change from a page cached before it.
          pageCache.clear()
          void loadBundles()
          if (view === 'installed') return
          setListing((current) => {
            if (current === null || current.status !== 'ready' || current.value === null) return current
            void load(current.url, current.query, 0, Math.max(current.value.entries.length, PAGE), undefined)
            return current
          })
        })
        return off
      }, [remote, loadBundles, load, view])

      useEffect(() => {
        if (activeUrl !== null) void load(activeUrl, query, 0, PAGE, undefined)
      }, [activeUrl])

      // Typing is debounced. The effect reads the listing and loader through
      // refs, so a page settling mid-typing does not restart the pause and the
      // query never waits on events it has nothing to do with.
      const liveRef = useRef(null)
      liveRef.current = { listing, load, query }
      useEffect(() => {
        if (view === 'installed' || draft === query.text) return undefined
        const timer = setTimeout(() => {
          const live = liveRef.current
          const next = withText(live.query, draft)
          setQuery(next)
          rememberQuery(next.text)
          if (live.listing !== null) void live.load(live.listing.url, next, 0, PAGE, undefined)
        }, TEXT_DELAY_MS)
        return () => { clearTimeout(timer) }
      }, [draft, query.text, rememberQuery, view])

      const entries = listing === null || listing.value === null ? [] : listing.value.entries

      // Match every market entry to the profile's bundles, not just entries
      // whose package name happens to equal the bundle name. This is what
      // stops an entry from another source offering Install for a plugin that
      // is already on disk under a scoped or mirrored name.
      const bundleOf = useMemo(() => buildBundleIndex(bundles), [bundles])
      const liveEntries = useMemo(() => entries.map((entry) => {
        const bundle = bundleOf(entry)
        if (bundle === undefined || bundle.installed === false) return entry
        const status = entry.installation?.status
        if (status !== undefined && status !== 'not-installed') return entry
        return { ...entry, installation: { status: 'installed', installedVersion: bundle.version } }
      }), [entries, bundleOf])

      // The installed view is independent of any market source: every bundle
      // the Host reports, including ones installed by hand or by another
      // market, and the ones the client ships.
      const installedBundles = useMemo(() => {
        const rank = (bundle) => bundle.installed === true
          ? 0
          : bundle.availability === 'installation' || bundle.official === true || bundle.optional === true ? 1 : 2
        return [...bundles.values()]
          // `listBundles` also names on-demand catalog entries that are not
          // installed. They belong to discovery, not to this tab; a shipped
          // bundle (`installation`) and a profile dependency (`profile` or
          // `installed`) do. An old Host without `availability` keeps its
          // official/optional entries.
          .filter((bundle) => bundle.installed === true
            || bundle.availability === 'profile'
            || bundle.availability === 'installation'
            || (bundle.availability === undefined && (bundle.official === true || bundle.optional === true)))
          .sort((left, right) => rank(left) - rank(right) || left.name.localeCompare(right.name))
      }, [bundles])
      const installedEnabled = installedBundles.filter((bundle) => bundle.enabled === true).length
      const installedFiltered = useMemo(() => {
        const terms = draft.toLowerCase().trim().split(/\s+/).filter(Boolean)
        if (terms.length === 0) return installedBundles
        return installedBundles.filter((bundle) => {
          const haystack = [
            bundle.name,
            bundleTitle(bundle, lang),
            bundleDescription(bundle, lang),
            bundle.source ?? '',
            bundle.availability ?? '',
          ].join(' ').toLowerCase()
          return terms.every((term) => haystack.includes(term))
        })
      }, [installedBundles, draft, lang])
      // DSH's own bundles stay at the bottom under their own heading; a
      // profile dependency is the person's plugin, a shipped one is the client.
      const installedGroups = useMemo(() => ({
        profile: installedFiltered.filter((bundle) => bundle.installed === true),
        bundled: installedFiltered.filter((bundle) => bundle.installed !== true),
      }), [installedFiltered])

      // ponytail: 快捷筛选 - 根据 quickFilter 过滤条目
      const filteredEntries = useMemo(() => {
        if (quickFilter === 'installed') {
          return liveEntries.filter((entry) => {
            const state = entryState(entry)
            return state === 'installed' || state === 'updatable' || state === 'provided'
          })
        }
        if (quickFilter === 'updatable') {
          return liveEntries.filter((entry) => entryState(entry) === 'updatable')
        }
        return liveEntries
      }, [liveEntries, quickFilter])

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
        .map((entry) => ({ entry, bundle: bundleOf(entry) })), [filteredEntries, picked, bundleOf])
      const plan = useMemo(() => planBulk(selected), [selected])

      // ponytail: 收集所有可更新的插件（用于"全部更新"按钮）
      const allUpdatable = useMemo(() => {
        return filteredEntries
          .filter((entry) => entryState(entry) === 'updatable')
          .map((entry) => ({ entry, bundle: bundleOf(entry) }))
      }, [filteredEntries, bundleOf])

      /** Apply a query everywhere at once: field, state, and loaded results. */
      const search = useCallback((next) => {
        setQuery(next)
        setDraft(next.text)
        if (listing !== null) void load(listing.url, next, 0, PAGE, undefined)
      }, [listing, load])

      /** Switch sources: category ids are source-local, so clear that filter. */
      const switchSource = useCallback((url) => {
        setQuery((current) => ({ ...current, category: null }))
        setActiveUrl(url)
      }, [])

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

      /** Clear one entry's failure tag once it has been read. */
      const clearFailure = useCallback((name) => {
        const current = runner.get().failures
        if (!current.has(name)) return
        const next = new Map(current)
        next.delete(name)
        runner.update({ failures: next })
      }, [])

      /**
       * Start a batch. The runner outlives this tab, so the run continues if the page is
       * switched; the confirm dialog is settled here because its work is now under way.
       * @param {ReadonlyArray<object>} list - orders from {@link orders}.
       */
      const start = useCallback((list) => {
        setConfirm(null)
        enqueue(list, remote, t)
      }, [remote, t])

      // The selection exists to describe what the one batch would touch, so it clears
      // when the batch ends — whichever page is on screen at the time.
      const wasRunning = useRef(false)
      useEffect(() => {
        if (wasRunning.current && running === null) setPicked(new Set())
        wasRunning.current = running !== null
      }, [running])

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
      const categoryMenu = useMenu(menu === 'category', () => { setMenu(null) })
      const sortMenu = useMenu(menu === 'sort', () => { setMenu(null) })
      // The built-in dsh.so browser is always available; host-configured
      // indexes follow it. Veyra leads, then dsh.so, then dshmarket.com.
      const sourceRank = (source) => VEYRA_SOURCES.includes(source.url)
        ? 0
        : source.url === DSH_SO_SOURCE.url ? 1
          : source.url === DSHMARKET_CATALOG ? 2
            : source.url === DSHOPEN_CATALOG ? 3
              : source.url === DSH_GO_CATALOG ? 4 : 5
      const orderedSources = [...(sources ?? []), DSH_SO_SOURCE].sort((left, right) => sourceRank(left) - sourceRank(right))
      const active = orderedSources.find((source) => source.url === activeUrl)
      const market = active === undefined
        ? (activeUrl ?? t('noSources'))
        : marketSourceLabel(active, text, lang)
      const pagePicked = filteredEntries.length > 0 && filteredEntries.every((entry) => picked.has(entry.name))
      const directed = query.sort.kind === 'published' || query.sort.kind === 'key'
      const buildable = plan.install.length + plan.update.length
      const currentCategory = query.category === null
        ? t('allCategories')
        : (categories.find((category) => category.id === query.category)?.title ?? t('allCategories'))
      const installedCount = liveEntries.filter((entry) => {
        const state = entryState(entry)
        return state === 'installed' || state === 'updatable' || state === 'provided'
      }).length
      const updatesCount = liveEntries.filter((entry) => entryState(entry) === 'updatable').length

      if (sources === null && sourcesFailure === null) {
        return h('div', { className: 'vpm-page' },
          h('div', { className: 'vpm-page-inner' },
            h('div', { className: 'vpm-state' },
              h('span', { className: 'vpm-spin' }),
              h('p', { className: 'vpm-state-title' }, t('loadingTitle')),
              h('p', { className: 'vpm-state-body' }, t('loadingBody')))))
      }
      if (sourcesFailure !== null) {
        return h('div', { className: 'vpm-page' },
          h('div', { className: 'vpm-page-inner' },
            h('div', { className: 'vpm-state' },
              h('span', { className: 'vpm-state-mark' }, h(BoxIcon, { size: 24 })),
              h('p', { className: 'vpm-state-title', role: 'alert' }, t('sourceFailed')),
              h('p', { className: 'vpm-state-body' }, sourcesFailure),
              h('button', { className: 'vpm-btn', onClick: () => { setSourcesFailure(null); void loadSources(true) } }, t('retry')))))
      }

      const rows = []
      if (outcome !== null) {
        rows.push(h('p', {
          key: 'outcome', role: 'status',
          className: `vpm-bar${outcome.failed > 0 ? ' error' : ''}`,
        }, [
          outcome.canceled ? t('canceled', { n: outcome.skipped }) : null,
          t('done', { ok: outcome.ok }),
          outcome.failed === 0 ? null : t('failed', { n: outcome.failed }),
          outcome.restart === 0 ? null : t('needRestart', { n: outcome.restart }),
          outcome.builds === 0 ? null : t('needBuilds', { n: outcome.builds }),
          outcome.failed === 0 ? null : t('failureHint'),
        ].filter(Boolean)))
      }
      if (running !== null) {
        // A visible progress bar, not a fake percentage: the Host does not
        // report one, so `done/total` is the queue position and the phase is
        // what the Host is actually doing.
        const pct = running.total === 0 ? 0 : Math.min(100, Math.round((running.done / running.total) * 100))
        const elapsed = Math.max(0, Math.round((clock - (running.startedAt ?? clock)) / 1000))
        const phase = running.phase === undefined ? '' : t(`phase_${running.phase}`)
        rows.push(h('div', {
          key: 'running', role: 'status', className: 'vpm-bar',
          style: { flexDirection: 'column', alignItems: 'stretch', gap: '7px' },
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            h('span', { className: 'vpm-spin' }),
            h('span', { className: 'vpm-ellipsis', style: { flex: 1, minWidth: '140px' } },
              `${t('progress', { action: actionLabel(t, running.action), done: running.done, total: running.total })} — ${running.name}`),
            phase === '' ? null : h('span', { className: 'vpm-tag' }, phase),
            h('span', { className: 'vpm-meta' }, t('elapsed', { n: elapsed })),
            h('button', {
              className: 'vpm-btn small', disabled: job.canceling || job.cancel,
              onClick: () => { runner.requestCancel(remote, t) },
            }, t(job.canceling || job.cancel ? 'canceling' : 'cancelRun')),
            h('button', {
              className: 'vpm-btn small',
              onClick: () => { setShowLog((value) => !value) },
            }, t(showLog ? 'logHide' : 'logShow'))),
          h('div', { className: 'vpm-progress' },
            h('span', { style: { width: `${pct}%` } })),
          job.cancelNotice ? h('p', { className: 'vpm-meta', style: { margin: 0, color: 'var(--dsw-alias-state-warn-primary)' } }, job.cancelNotice) : null,
          job.queue.length === 0 ? null : h('div', { className: 'vpm-queue' },
            h('span', { className: 'vpm-meta' }, t('queue', { n: job.queue.length })),
            job.queue.map((order, index) => h('div', { key: `${order.entry.name}-${index}`, className: 'vpm-queue-item' },
              h('span', { className: 'vpm-queue-name' }, `${actionLabel(t, order.action)} · ${order.entry.name}`),
              h('button', {
                className: 'vpm-queue-remove', 'aria-label': t('removeQueued'),
                onClick: () => { runner.removeQueued(index) },
              }, '×')))),
          showLog ? h('pre', { className: 'vpm-log' }, running.log === undefined || running.log === '' ? t('logEmpty') : running.log) : null))
      }
      if (picked.size > 0) {
        const bulk = []
        if (buildable > 0) bulk.push(h('button', {
          key: 'apply', className: 'vpm-btn primary', disabled: busy,
          // An update is confirmed as one, so the dialog names the versions
          // being replaced rather than only what will be installed.
          onClick: () => { setConfirm({ action: plan.install.length === 0 ? 'update' : 'install', orders: orders(plan, plan.install.length === 0 ? 'update' : 'install') }) },
        }, t('bulkApply', { n: buildable })))
        if (plan.uninstall.length > 0) bulk.push(h('button', {
          key: 'remove', className: 'vpm-btn small', disabled: busy,
          onClick: () => { setConfirm({ action: 'uninstall', orders: orders(plan, 'uninstall') }) },
        }, t('bulkUninstall', { n: plan.uninstall.length })))
        if (plan.enable.length > 0) bulk.push(h('button', {
          key: 'enable', className: 'vpm-btn', disabled: busy,
          onClick: () => { start(orders(plan, 'enable')) },
        }, t('bulkEnable', { n: plan.enable.length })))
        if (plan.disable.length > 0) bulk.push(h('button', {
          key: 'disable', className: 'vpm-btn', disabled: busy,
          onClick: () => { start(orders(plan, 'disable')) },
        }, t('bulkDisable', { n: plan.disable.length })))
        bulk.push(h('button', {
          key: 'clear', className: 'vpm-btn', disabled: busy,
          onClick: () => { setPicked(new Set()) },
        }, t('clear')))
        rows.push(h('div', { key: 'bulk', className: 'vpm-bar bulk' },
          h('span', { className: 'vpm-grow', style: { fontWeight: 600 } }, t('selected', { n: picked.size })), bulk))
      }

      const installedCard = (bundle) => h(InstalledCard, {
        key: bundle.name, bundle, lang, t,
        busy: installedBusy === bundle.name,
        onDetails: setInstalledDetail,
        onToggle: toggleInstalled,
        onUninstall: (target) => { setInstalledConfirm(target) },
      })

      return h('div', { className: 'vpm-page' },
        h('div', { className: 'vpm-page-inner' },
        h('header', { className: 'vpm-hero' },
          h('div', { className: 'vpm-hero-copy' },
            h('div', { className: 'vpm-eyebrow' }, t('eyebrow')),
            h('h2', { className: 'vpm-title' }, t('title')),
            h('p', { className: 'vpm-subtitle' }, t('subtitle')),
            h('div', { className: 'vpm-summary' },
              view === 'installed'
                ? t('installedSummary', {
                  total: installedBundles.length,
                  enabled: installedEnabled,
                  disabled: installedBundles.length - installedEnabled,
                })
                : t('summary', { total: liveEntries.length, installed: installedCount, updates: updatesCount })),
            h('div', { className: 'vpm-segment', role: 'tablist', 'aria-label': t('title') },
              h('button', {
                className: `vpm-segment-item${view === 'market' ? ' on' : ''}`,
                role: 'tab', 'aria-selected': view === 'market',
                onClick: () => { setView('market'); setDraft(query.text); setInstalledNotice(null) },
              }, t('viewMarket')),
              h('button', {
                className: `vpm-segment-item${view === 'installed' ? ' on' : ''}`,
                role: 'tab', 'aria-selected': view === 'installed',
                onClick: () => { setView('installed'); setDraft(''); setInstalledNotice(null); void loadBundles() },
              }, `${t('viewInstalled')} (${installedBundles.length})`))),
          h('div', { className: 'vpm-hero-actions' },
            h('div', { className: 'vpm-search' },
              h('span', { className: 'vpm-search-icon' }, h(SearchIcon, {})),
              h('input', {
                type: 'search', value: draft, spellCheck: false,
                placeholder: view === 'installed' ? t('searchInstalled') : t('search'),
                'aria-label': view === 'installed' ? t('searchInstalled') : t('search'),
                list: view === 'installed' ? undefined : 'vpm-recent-searches',
                onChange: (event) => { setDraft(event.target.value) },
              }),
              // A native suggestion list: the browser/Electron draws and filters it, so no custom
              // dropdown state, no positioning code, and it still works on a fresh profile.
              recent.length === 0 ? null : h('datalist', { id: 'vpm-recent-searches' },
                recent.map((term) => h('option', { key: term, value: term }))),
              h('button', {
                className: 'vpm-icon-btn', title: t('refresh'), 'aria-label': t('refresh'),
                disabled: busy || (view === 'market' && (listing === null || loadingPage)),
                onClick: async () => {
                  if (view === 'installed') {
                    await loadBundles()
                    setRefreshed(true)
                    return
                  }
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
              refreshed ? h('span', { className: 'vpm-meta' }, lang === 'zh' ? '已刷新' : 'Refreshed') : null))),
        showVisibility ? h('div', { className: 'vpm-settings' },
          h('span', { className: 'vpm-meta' }, t('settingsVisibility')),
          h('label', { className: 'vpm-switch' },
            h('input', {
              type: 'checkbox', checked: visibilityState.sidebar,
              onChange: (event) => { visibility.set('sidebar', event.target.checked) },
            }),
            h('span', null, t('showSidebar'))),
          h('label', { className: 'vpm-switch' },
            h('input', {
              type: 'checkbox', checked: visibilityState.pluginsTab,
              onChange: (event) => { visibility.set('pluginsTab', event.target.checked) },
            }),
            h('span', null, t('showPluginsTab'))),
          h('span', { className: 'vpm-meta' }, t('settingsNote'))) : null,
        h('div', { className: 'vpm-toolbar' },
          view === 'market' ? h(React.Fragment, null,
          h('div', { style: { position: 'relative', display: 'flex' }, ref: sourceMenu },
            h('button', {
              className: 'vpm-source-btn', 'aria-haspopup': 'menu', 'aria-expanded': menu === 'source',
              onClick: () => { setMenu(menu === 'source' ? null : 'source') },
            }, h('span', { className: 'vpm-ellipsis' }, market), h(ChevronIcon, {})),
            menu !== 'source' ? null : h('div', { className: 'vpm-menu', role: 'menu' },
              orderedSources.map((source) => h('button', {
                key: source.url, role: 'menuitem', title: source.builtin === true ? undefined : source.url,
                className: `vpm-menu-item${source.url === activeUrl ? ' on' : ''}`,
                onClick: () => { setMenu(null); switchSource(source.url) },
              }, marketSourceLabel(source, text, lang))),
              h('div', { className: 'vpm-menu-sep' }),
              h('button', {
                role: 'menuitem', className: 'vpm-menu-item',
                onClick: () => { setMenu(null); setSourcesOpen(true) },
              }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, h(SlidersIcon, {}), t('manageSources'))),
              h('div', { className: 'vpm-menu-sep' }),
              // A toggle, not a checkbox input: one row in a menu, no extra layout.
              h('button', {
                role: 'menuitemcheckbox', 'aria-checked': autoCheckOn, className: 'vpm-menu-item',
                onClick: () => {
                  const next = !autoCheckOn
                  setAutoCheckOn(next)
                  storeSet('vyra-market.autoCheck', next ? 'on' : 'off')
                  setMenu(null)
                },
              }, `${autoCheckOn ? '✓ ' : ''}${lang === 'zh' ? '启动时检查更新' : 'Check updates at startup'}`))),
          // Status and category live in the same row as source and sort now;
          // the old two full-width pill rows pushed the cards down.
          h('div', { className: 'vpm-segment sm', role: 'group', 'aria-label': t('all') },
            [
              { value: null, label: t('all') },
              { value: 'installed', label: t('onlyInstalled') },
              { value: 'updatable', label: t('onlyUpdatable') },
            ].map((option) => h('button', {
              key: String(option.value),
              className: `vpm-segment-item${quickFilter === option.value ? ' on' : ''}`,
              'aria-pressed': quickFilter === option.value,
              onClick: () => { setQuickFilter(option.value); setPicked(new Set()) },
            }, option.label))),
          h('div', { style: { position: 'relative', display: 'flex' }, ref: categoryMenu },
            h('button', {
              className: 'vpm-btn', 'aria-haspopup': 'menu', 'aria-expanded': menu === 'category',
              onClick: () => { setMenu(menu === 'category' ? null : 'category') },
            }, h('span', { className: 'vpm-ellipsis', style: { maxWidth: '150px' } }, `${t('category')}: ${currentCategory}`), h(ChevronIcon, {})),
            menu !== 'category' ? null : h('div', { className: 'vpm-menu right scroll', role: 'menu' },
              h('button', {
                role: 'menuitemradio', 'aria-checked': query.category === null,
                className: `vpm-menu-item${query.category === null ? ' on' : ''}`,
                onClick: () => { setMenu(null); search({ ...query, category: null }) },
              }, t('allCategories')),
              categories.map((category) => h('button', {
                key: category.id, role: 'menuitemradio', 'aria-checked': query.category === category.id,
                className: `vpm-menu-item${query.category === category.id ? ' on' : ''}`,
                onClick: () => { setMenu(null); search({ ...query, category: category.id }) },
              }, category.title)))),
          h('div', { style: { position: 'relative', display: 'flex' }, ref: sortMenu },
            h('button', {
              className: 'vpm-btn', 'aria-haspopup': 'menu', 'aria-expanded': menu === 'sort',
              onClick: () => { setMenu(menu === 'sort' ? null : 'sort') },
            }, t('sortBy'), h(ChevronIcon, {})),
            menu !== 'sort' ? null : h('div', { className: 'vpm-menu right', role: 'menu' },
              [
                { kind: 'index', label: t('sortIndex') },
                ...draft.trim() === '' ? [] : [{ kind: 'relevance', label: t('sortRelevance') }],
                { kind: 'published', label: t('sortPublished') },
                // A source may declare numeric sort keys (ours writes stars
                // and downloads); the Host and the dsh.so adapter both honour
                // `{ kind: 'key', id }`.
                ...Object.entries(declarations?.sortKeys ?? {}).map(([id, declaration]) => ({
                  kind: 'key', id, direction: declaration.order, label: text(declaration.title),
                })),
              ].map((option) => h('button', {
                key: option.kind === 'key' ? `key-${option.id}` : option.kind,
                role: 'menuitemradio',
                'aria-checked': query.sort.kind === option.kind && (option.kind !== 'key' || query.sort.id === option.id),
                className: `vpm-menu-item${query.sort.kind === option.kind && (option.kind !== 'key' || query.sort.id === option.id) ? ' on' : ''}`,
                onClick: () => {
                  setMenu(null)
                  search({
                    ...query,
                    sort: option.kind === 'published'
                      ? { kind: 'published', direction: 'desc' }
                      : option.kind === 'key'
                        ? { kind: 'key', id: option.id, direction: option.direction ?? 'desc' }
                        : { kind: option.kind },
                  })
                },
              }, option.label)))),
          directed ? h('button', {
            className: 'vpm-btn', disabled: busy,
            onClick: () => { search({ ...query, sort: { ...query.sort, direction: query.sort.direction === 'asc' ? 'desc' : 'asc' } }) },
          }, t('switchDirection', { dir: t(query.sort.direction === 'asc' ? 'ascending' : 'descending') })) : null,
          // ponytail: "全部更新"按钮 - 一键更新所有可更新插件
          allUpdatable.length > 0 && quickFilter !== 'updatable' ? h('button', {
            className: 'vpm-btn primary', disabled: busy,
            onClick: () => {
              const updatePlan = planBulk(allUpdatable)
              const updateOrders = orders(updatePlan, 'update')
              if (updateOrders.length > 0) setConfirm({ action: 'update', orders: updateOrders })
            },
          }, t('updateAll', { n: allUpdatable.length })) : null
          ) : (installedNotice === null ? null : h('p', { className: 'vpm-bar error' }, installedNotice)),
          h('span', { className: 'vpm-grow' }),
          view === 'market' ? h('button', {
            className: 'vpm-btn', onClick: () => { setSourcesOpen(true) },
          }, h(SlidersIcon, { size: 13 }), t('manageSources')) : null),
        rows,
        h('div', { className: 'vpm-scroll' },
          view === 'installed'
            ? (installedFiltered.length === 0
              ? h('div', { className: 'vpm-state' },
                h('span', { className: 'vpm-state-mark' }, h(BoxIcon, { size: 24 })),
                h('p', { className: 'vpm-state-title' }, installedBundles.length === 0 ? t('installedEmptyTitle') : t('noMatchTitle')),
                h('p', { className: 'vpm-state-body' }, installedBundles.length === 0 ? t('installedEmptyBody') : t('noMatchBody')))
              : h('div', null,
                installedGroups.profile.length === 0 ? null : h('section', { className: 'vpm-installed-section' },
                  h('h3', { className: 'vpm-section-title' },
                    t('installedProfileTitle'),
                    h('span', { className: 'vpm-count' }, installedGroups.profile.length)),
                  h('ul', { className: 'vpm-grid' }, installedGroups.profile.map(installedCard))),
                installedGroups.bundled.length === 0 ? null : h('section', { className: 'vpm-installed-section' },
                  h('h3', { className: 'vpm-section-title' },
                    t('installedBundledTitle'),
                    h('span', { className: 'vpm-count' }, installedGroups.bundled.length)),
                  h('ul', { className: 'vpm-grid' }, installedGroups.bundled.map(installedCard)))))
            : (listing === null ? h('div', null,
            h('div', { className: 'vpm-state' },
              h('span', { className: 'vpm-spin' }),
              h('p', { className: 'vpm-state-title' }, t('loadingTitle')),
              h('p', { className: 'vpm-state-body' }, t('loadingBody'))),
            h('ul', { className: 'vpm-skeleton' },
              Array.from({ length: 6 }, (_value, index) => h('li', { key: index, className: 'vpm-skeleton-card' }))))
            : listing.status === 'error' ? h('div', { className: 'vpm-state' },
              h('span', { className: 'vpm-state-mark' }, h(BoxIcon, { size: 24 })),
              h('p', { className: 'vpm-state-title', role: 'alert' }, t('loadFailed')),
              h('p', { className: 'vpm-state-body' }, listing.failure),
              h('button', { className: 'vpm-btn', onClick: () => { void load(listing.url, listing.query, 0, PAGE, undefined, 0, true) } }, t('retry')))
              : filteredEntries.length === 0
                ? (listing.status === 'loading'
                  ? h('div', null,
                    h('div', { className: 'vpm-state' },
                      h('span', { className: 'vpm-spin' }),
                      h('p', { className: 'vpm-state-title' }, t('loadingTitle')),
                      h('p', { className: 'vpm-state-body' }, t('loadingBody'))),
                    h('ul', { className: 'vpm-skeleton' },
                      Array.from({ length: 6 }, (_value, index) => h('li', { key: index, className: 'vpm-skeleton-card' }))))
                  : listing.query.text.trim() === '' && listing.query.category === null && quickFilter === null
                    ? h('div', { className: 'vpm-state' },
                      h('span', { className: 'vpm-state-mark' }, h(BoxIcon, { size: 24 })),
                      h('p', { className: 'vpm-state-title' }, t('emptyTitle')),
                      h('p', { className: 'vpm-state-body' }, t('emptyBody')),
                      h('button', { className: 'vpm-btn', onClick: () => { setSourcesOpen(true) } }, t('manageSources')))
                    : h('div', { className: 'vpm-state' },
                      h('span', { className: 'vpm-state-mark' }, h(SearchIcon, { size: 24 })),
                      h('p', { className: 'vpm-state-title' }, t('noMatchTitle')),
                      h('p', { className: 'vpm-state-body' }, t('noMatchBody')),
                      h('button', {
                        className: 'vpm-btn',
                        onClick: () => { setQuickFilter(null); search({ text: '', category: null, sort: { kind: 'index' } }) },
                      }, t('clear'))))
                : h('div', null,
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px' } },
                    h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }, className: 'vpm-meta' },
                      h('input', {
                        type: 'checkbox', className: 'vpm-check', checked: pagePicked, disabled: busy,
                        onChange: () => { setPicked(pagePicked ? new Set() : new Set(filteredEntries.map((entry) => entry.name))) },
                      }),
                      t('selectPage')),
                    h('span', { className: 'vpm-meta' }, t('total', { n: filteredEntries.length }))),
                  h('ul', { className: 'vpm-grid' },
                    filteredEntries.map((entry) => h(Card, {
                      key: entry.name, entry, bundle: bundleOf(entry), lang, t, text, busy, stats: statsIndex,
                      picked: picked.has(entry.name),
                      failure: job.failures.get(entry.name),
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
                      onRun: start,
                      onConfirm: setConfirm,
                      onDetails: setDetailEntry,
                    }))),
                  listing.value.nextOffset === null ? null : h('div', { style: { display: 'flex', justifyContent: 'center', margin: '12px 0' } },
                    h('button', {
                      className: 'vpm-btn',
                      disabled: busy || listing.status !== 'ready',
                      onClick: () => { void load(listing.url, listing.query, entries.length, PAGE, listing.value.fetchedAt) },
                    }, t('more')))))),
        h('div', { style: { height: '14px', flex: 'none' } }),
        confirm === null ? null : h(ConfirmDialog, {
          action: confirm.action, orders: confirm.orders, lang, t, text,
          onCancel: () => { setConfirm(null) },
          onRun: () => { start(confirm.orders) },
        }),
        detailEntry === null ? null : h(DetailDialog, {
          entry: detailEntry, bundle: bundleOf(detailEntry), lang, t, text, busy, stats: statsIndex,
          onRun: start,
          onConfirm: setConfirm,
          onClose: () => { setDetailEntry(null) },
        }),
        installedConfirm === null ? null : h(Modal, {
          title: t('confirmUninstallInstalled'),
          onClose: () => { setInstalledConfirm(null) },
          footer: [
            h('button', { key: 'cancel', className: 'vpm-btn small', onClick: () => { setInstalledConfirm(null) } }, t('cancel')),
            h('button', {
              key: 'run', className: 'vpm-btn small danger', disabled: installedBusy !== null,
              onClick: () => { void uninstallInstalled(installedConfirm) },
            }, t('uninstall')),
          ],
        },
          h('p', { style: S.modalBody }, `${bundleTitle(installedConfirm, lang)} · ${installedConfirm.name}`),
          h('p', { style: S.modalBody }, t('confirmUninstallInstalledBody'))),
        installedDetail === null ? null : h(InstalledDetailDialog, {
          bundle: installedDetail, remote, lang, t, busy: installedBusy === installedDetail.name,
          onToggle: toggleInstalled,
          onUninstall: (target) => { setInstalledDetail(null); setInstalledConfirm(target) },
          onClose: () => { setInstalledDetail(null) },
        }),
        sourcesOpen ? h(SourcesDialog, {
          sources, lang, t, text, saving: savingSources, failure: sourceFailure,
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
        }) : null))
    }

    /**
     * The tab slot hands down the host's locale hook. A `main` panel does not,
     * so this builds the same shape from the locale service: a hook that
     * subscribes to changes and returns the selected value. It is a plain
     * function on purpose — it is called by React during render, like the
     * host-provided one.
     */
    function makeLocaleHook(ctx) {
      return (select) => {
        const [snapshot, setSnapshot] = useState(() => ctx.locale.getSnapshot())
        useEffect(() => {
          const off = ctx.locale.subscribe(() => setSnapshot(ctx.locale.getSnapshot()))
          return typeof off === 'function' ? off : undefined
        }, [])
        return select(snapshot)
      }
    }

    /** The sidebar's main panel: the market page, filling the host's content area. */
    function MarketPanel(props) {
      return h('div', { style: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' } },
        h(MarketTab, props))
    }

    return {
      __internal: {
        marketText, presentedVersion, installable, prerelease, updateTarget, entryState, actionVersion, planBulk, orders, withText,
        TRANSIENT_FAILURE, RETRY_DELAY_MS, htmlImages, resolveAsset, enqueue, pump, newRequestId, runner,
        compactCount, npmSpecName, specVersion, dshSoIndexUrlFrom, normalizeDshSo, dshSoPage, statsOfEntry, normalizeStats, marketSourceLabel,
        localizedValue, shortBundleName, bundleTitle, bundleDescription, visibility,
        pageCacheKey, cachedPage, rememberPage, pageCache,
        parseRepoRef, specPath, buildBundleIndex,
      },
      inject: ['slots', 'locale', 'remote', 'remote.pluginMarket', 'remote.pluginManager'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), `${NS}: dictionaries`)
        // A background update check at client startup; silent on any failure and behind a toggle.
        void autoCheck(ctx.remote)
        const t = ctx.locale.bind(NS)
        // Host progress is useful only while the queue is running, but the
        // subscription lives with the plugin so the queue survives a page
        // switch. Events carry the request id we generated for each attempt.
        ctx.effect(() => {
          const offs = []
          const listen = (event, handler) => {
            try {
              const off = ctx.remote.$on(event, handler)
              if (typeof off === 'function') offs.push(off)
            } catch {
              // An older Host without this event keeps the coarse UI.
            }
          }
          listen('plugin-manager/install-state', (progress) => {
            if (progress?.requestId !== undefined) runner.progress(progress.requestId, progress.phase)
          })
          listen('plugin-manager/update-state', (progress) => {
            if (progress?.requestId !== undefined) runner.progress(progress.requestId, progress.step)
          })
          listen('plugin-manager/install-log', (chunk) => {
            if (chunk?.requestId !== undefined) runner.appendLog(chunk.requestId, chunk.text)
          })
          return () => { for (const off of offs) off() }
        }, `${NS}: install events`)
        // The toast's "view" button opens the sidebar panel when the Host
        // exposes its layout service; older Hosts keep the message only.
        let layout
        try {
          ctx.inject(['layout'], (scoped) => { layout = scoped.layout })
        } catch {
          // No layout service; the toast still reports the outcome.
        }
        const openMarket = () => {
          try { layout?.selectPanel?.('vyra-market') } catch { /* no panel service */ }
        }
        try {
          ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay',
            id: 'vyra-market-toast',
          }, () => h(MarketToast, {
            t,
            onOpen: openMarket,
            canOpen: () => typeof layout?.selectPanel === 'function',
          })))
        } catch {
          // A Host without an overlay slot keeps the in-page outcome bar.
        }
        const useLocale = makeLocaleHook(ctx)

        // The Plugins tab is opt-out. Its registration is kept in a gate so a
        // settings switch can add or remove it without a reload.
        let tabSeat = false
        let offTab = null
        const syncTab = () => {
          if (!tabSeat) return
          const want = visibility.get().pluginsTab
          if (want && offTab === null) {
            offTab = ctx.slots.register({
              name: 'plugins.tab',
              id: 'market',
              order: 10,
              locale: NS,
              label: () => t('title'),
              inject: () => ({ remote: ctx.remote, hooks: { locale: ctx.locale }, surface: 'plugins' }),
            }, MarketTab)
          } else if (!want && offTab !== null) {
            if (typeof offTab === 'function') offTab()
            offTab = null
          }
        }
        try {
          ctx.slots.inject('plugins.tab', () => {
            tabSeat = true
            syncTab()
            return () => {
              tabSeat = false
              if (typeof offTab === 'function') offTab()
              offTab = null
            }
          })
        } catch {
          // A host without the Plugins tab keeps the other doors.
        }

        // The sidebar row is opt-out; its `main` panel stays registered even
        // when the row is off, so the completion toast can still open it.
        let sidebarSeat = false
        let offRow = null
        let offPanel = null
        const syncSidebar = () => {
          if (!sidebarSeat) return
          if (offPanel === null) {
            offPanel = ctx.slots.register({
              name: 'main',
              key: 'vyra-market',
              locale: NS,
              inject: () => ({ remote: ctx.remote, t, useLocale, surface: 'sidebar' }),
            }, MarketPanel)
          }
          const want = visibility.get().sidebar
          if (want && offRow === null) {
            offRow = ctx.slots.register({
              name: 'sidebar.panellist',
              id: 'vyra-market',
              order: 2,
              locale: NS,
              label: () => t('title'),
            }, MarketIcon)
          } else if (!want && offRow !== null) {
            if (typeof offRow === 'function') offRow()
            offRow = null
          }
        }
        try {
          ctx.slots.inject('sidebar.panellist', () => {
            sidebarSeat = true
            syncSidebar()
            return () => {
              sidebarSeat = false
              if (typeof offRow === 'function') offRow()
              offRow = null
              if (typeof offPanel === 'function') offPanel()
              offPanel = null
            }
          })
        } catch {
          // A host before the sidebar panel slot keeps the other doors.
        }

        // Settings is the third door and is always available, so both
        // switches can be off without stranding the market.
        try {
          ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: 'vyra-market',
            order: 20,
            locale: NS,
            label: () => t('title'),
            inject: () => ({ remote: ctx.remote, t, useLocale, surface: 'settings' }),
          }, MarketPanel))
        } catch {
          // A host without a settings section keeps the other doors.
        }
        try {
          ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
            name: 'settings.section.icon',
            id: 'vyra-market',
          }, MarketIcon))
        } catch {
          // Older hosts render the section label without a custom icon.
        }

        ctx.effect(() => {
          syncTab()
          syncSidebar()
          const off = visibility.subscribe(() => {
            syncTab()
            syncSidebar()
          })
          return () => off()
        }, `${NS}: visibility`)
      },
    }
  },
})
