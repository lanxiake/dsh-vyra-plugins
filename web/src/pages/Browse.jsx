import { useEffect, useMemo, useState } from 'react'
import { navigate, useQuery } from '../router.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useI18n } from '../i18n/index.jsx'
import { CATEGORY_ORDER, categoryLabel } from '../logic/categories.js'
import {
  decodeRows,
  loadAllCategories,
  loadCategory,
  loadFeatured,
  loadManifest,
  loadSearchIndex,
  loadTop,
  searchEntryMatches,
  searchEntryToPlugin,
} from '../data/catalog.js'
import CatalogGrid from '../components/catalog/CatalogGrid.jsx'

const SORTS = ['recommend', 'updated', 'downloads', 'name']
const QUALITY_FILTERS = ['all', 'installable', 'vyra', 'editors', 'latest', 'multi']

const normalizeCategory = (value) =>
  value === 'all' || CATEGORY_ORDER.includes(value) ? value : 'all'
const normalizeQuality = (value) =>
  QUALITY_FILTERS.includes(value) ? value : 'all'

function sortPlugins(list, sort) {
  const copy = [...list]
  if (sort === 'name') copy.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  else if (sort === 'updated') {
    copy.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')))
  } else if (sort === 'downloads') {
    copy.sort((a, b) => (b.stats?.downloads ?? b.stats?.stars ?? 0) - (a.stats?.downloads ?? a.stats?.stars ?? 0))
  } else {
    // stars：统一按索引源的真实 GitHub star 降序，其次按名称
    copy.sort((a, b) => {
      const av = a.stats?.stars ?? 0
      const bv = b.stats?.stars ?? 0
      if (av !== bv) return bv - av
      return String(a.name).localeCompare(String(b.name))
    })
  }
  return copy
}

function applyQuality(list, filter) {
  if (filter === 'installable') return list.filter((p) => p.install && p.install.method !== 'unknown')
  if (filter === 'vyra') return list.filter((p) => p.featured)
  if (filter === 'editors') return list.filter((p) => (p.stats?.stars ?? 0) >= 80)
  if (filter === 'latest') return sortPlugins(list, 'updated')
  if (filter === 'multi') return list.filter((p) => (p.sources?.length ?? 0) > 1)
  return list
}

/** sourceBits 已由 decodeRow 解成 sources 数组，按来源精确筛选。 */
function applySource(list, source) {
  if (source === 'all') return list
  return list.filter((p) => p.sources.includes(source))
}

/** 与 searchEntryMatches 保持同样的匹配字段：名称 / 双语标题 / 标签。 */
function pluginMatches(plugin, needle) {
  if (needle === '') return true
  return [plugin.name, plugin.title?.zh, plugin.title?.en, ...(plugin.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

export default function Browse() {
  const { lang, t } = useI18n()
  const query = useQuery()
  const requestedQ = query.get('q') ?? ''
  const requestedCategory = query.get('category') ?? 'all'
  const requestedQuality = query.get('quality') ?? 'all'
  const requestedSource = query.get('source') ?? 'all'

  const [category, setCategory] = useState(() => normalizeCategory(requestedCategory))
  const [searchText, setSearchText] = useState(requestedQ)
  const [sort, setSort] = useState('recommend')
  const [quality, setQuality] = useState(() => normalizeQuality(requestedQuality))
  const [source, setSource] = useState(requestedSource)

  // URL 是筛选状态的唯一来源：首页入口、浏览器前进后退都能正确还原分类。
  useEffect(() => {
    setSearchText(requestedQ)
    setCategory(normalizeCategory(requestedCategory))
    setQuality(normalizeQuality(requestedQuality))
    setSource(requestedSource)
  }, [requestedQ, requestedCategory, requestedQuality, requestedSource])

  const manifestState = useAsync(loadManifest, [])
  const manifest = manifestState.data
  const searching = searchText.trim() !== ''

  // 只有在「全部来源 + 无归属筛选」时才用轻量搜索索引；
  // 指定来源时 search.json 不带来源位图，必须回到带 sourceBits 的分类数据。
  const usingSearchIndex = searching && source === 'all'
  const needle = searchText.trim().toLowerCase()

  const searchState = useAsync(
    () => (usingSearchIndex ? loadSearchIndex() : Promise.resolve(null)),
    [usingSearchIndex],
  )

  // Vyra 出品 / 编辑精选读各自的数据文件；全部分类合并所有分类文件；
  // 具体分类只读对应文件。featured 不再兼作「全部分类」的标识。
  const catalogState = useAsync(() => {
    if (usingSearchIndex) return Promise.resolve(null)
    if (category !== 'all') return loadCategory(category)
    if (quality === 'vyra') return loadFeatured()
    if (quality === 'editors') return loadTop()
    return loadAllCategories()
  }, [usingSearchIndex, category, quality])

  // 未知来源 ID 在 manifest 到位后回退到全部，避免下拉框显示无效值。
  useEffect(() => {
    if (manifest && source !== 'all' && !manifest.sources.includes(source)) setSource('all')
  }, [manifest, source])

  const items = useMemo(() => {
    if (manifest == null) return []
    let base
    if (usingSearchIndex) {
      if (searchState.data === null) return []
      base = searchState.data
        .filter((entry) => searchEntryMatches(entry, needle))
        .map((entry) => searchEntryToPlugin(entry, manifest.sources))
    } else {
      if (catalogState.data === null) return []
      base = decodeRows(catalogState.data, manifest.sources)
      if (searching) base = base.filter((plugin) => pluginMatches(plugin, needle))
    }
    base = applySource(base, source)
    // 专属数据文件已经按 Vyra 出品 / 编辑精选筛好，不再重复套阈值。
    const effectiveQuality =
      !usingSearchIndex && category === 'all' && (quality === 'vyra' || quality === 'editors')
        ? 'all'
        : quality
    return sortPlugins(applyQuality(base, effectiveQuality), sort)
  }, [
    manifest, usingSearchIndex, searchState.data, catalogState.data, needle,
    searching, source, sort, quality, category,
  ])

  if (manifestState.status === 'loading') {
    return <section className="section"><p className="muted">{t('common.loading')}</p></section>
  }
  if (manifestState.status === 'error') {
    return <section className="section"><p className="error">{t('common.error')}</p></section>
  }

  const categories = manifest.categories.filter((entry) => entry.count > 0)
  const busy = usingSearchIndex ? searchState.status === 'loading' : catalogState.status === 'loading'

  function paramsFor(next) {
    const params = {}
    const q = (next.q ?? searchText).trim()
    if (q !== '') params.q = q
    if (next.category !== 'all') params.category = next.category
    if (next.quality !== 'all') params.quality = next.quality
    if (next.source !== 'all') params.source = next.source
    return params
  }

  function update(next) {
    setCategory(next.category)
    setQuality(next.quality)
    setSource(next.source)
    setSearchText(next.q ?? '')
    navigate('/plugins', { query: paramsFor(next) })
  }

  function selectQuality(key) {
    update({
      q: '',
      category: 'all',
      quality: normalizeQuality(key),
      source,
    })
  }

  function selectCategory(key) {
    update({
      q: '',
      category: normalizeCategory(key),
      quality: 'all',
      source,
    })
  }

  function selectSource(next) {
    update({
      q: searchText,
      category,
      quality,
      source: next === 'all' || manifest.sources.includes(next) ? next : 'all',
    })
  }

  function sourceLabel(id) {
    const key = `browse.sourceLabels.${id}`
    const label = t(key)
    return label === key ? id : label
  }

  return (
    <section className="section">
      <div className="section-head">
        <h1>{t('browse.title')}</h1>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          value={searchText}
          onChange={(event) => {
            setSearchText(event.target.value)
            if (event.target.value.trim() !== '') setQuality('all')
          }}
          placeholder={t('browse.search', { total: (manifest.stats.total ?? 0).toLocaleString() })}
        />
        <select className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
          {SORTS.map((key) => (
            <option key={key} value={key}>
              {t({
                recommend: 'browse.sortRecommend',
                updated: 'browse.sortUpdated',
                downloads: 'browse.sortDownloads',
                name: 'browse.sortName',
              }[key])}
            </option>
          ))}
        </select>
        <select className="select" value={source} onChange={(event) => selectSource(event.target.value)}>
          <option value="all">{t('browse.sourceAll')}</option>
          {manifest.sources.map((id) => (
            <option key={id} value={id}>{sourceLabel(id)}</option>
          ))}
        </select>
      </div>

      <div className="quality-bar">
        <span className="quality-label">{t('browse.quality')}</span>
        {QUALITY_FILTERS.map((key) => {
          const label = {
            all: t('browse.filterAll'),
            installable: t('browse.filterInstallable'),
            vyra: t('browse.filterVyra'),
            editors: t('browse.filterEditors'),
            latest: t('browse.filterLatest'),
            multi: t('browse.filterMultiSource'),
          }[key]
          const vyraClass = key === 'vyra' ? ' vyra' : ''
          return (
            <button
              key={key}
              type="button"
              className={quality === key ? `tab active${vyraClass}` : `tab${vyraClass}`}
              onClick={() => selectQuality(key)}
            >
              {label}
              {key === 'vyra' && <span className="tab-count">{manifest.stats.featured}</span>}
            </button>
          )
        })}
      </div>

      <div className="category-bar">
        <button
          type="button"
          className={!searching && category === 'all' ? 'active' : ''}
          onClick={() => selectCategory('all')}
        >
          {t('browse.allCategories')}
        </button>
        {categories.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={!searching && category === entry.key ? 'active' : ''}
            onClick={() => selectCategory(entry.key)}
          >
            {categoryLabel(entry.key, lang)}
          </button>
        ))}
      </div>

      <div className="result-count">
        {busy ? t('common.loading') : (
          <>{t('browse.found')} <b>{items.length.toLocaleString()}</b> {t('browse.pluginsFound')} · <span className="rec-star">★</span> {t('browse.sortedBy')}</>
        )}
      </div>

      {busy ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <CatalogGrid items={items} dense />
      )}
    </section>
  )
}
