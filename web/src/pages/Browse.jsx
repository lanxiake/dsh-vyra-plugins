import { useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { useI18n } from '../i18n/index.jsx'
import { categoryLabel } from '../logic/categories.js'
import {
  decodeRows,
  loadCategory,
  loadFeatured,
  loadManifest,
  loadSearchIndex,
  searchEntryMatches,
  searchEntryToPlugin,
} from '../data/catalog.js'
import CatalogGrid from '../components/catalog/CatalogGrid.jsx'

const SORTS = ['stars', 'updated', 'name']

function sortPlugins(list, sort) {
  const copy = [...list]
  if (sort === 'name') copy.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  else if (sort === 'updated') {
    copy.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')))
  } else {
    copy.sort((a, b) => (b.stats?.stars ?? 0) - (a.stats?.stars ?? 0))
  }
  return copy
}

export default function Browse() {
  const { lang, t } = useI18n()
  const [category, setCategory] = useState('featured')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('stars')

  const manifestState = useAsync(loadManifest, [])
  const searching = query.trim() !== ''

  // 全局搜索索引：第一次搜索时才加载
  const searchState = useAsync(
    () => (searching ? loadSearchIndex() : Promise.resolve(null)),
    [searching],
  )

  // 分类数据：切换分类时按需加载。「推荐」只含本项目的插件。
  const categoryState = useAsync(
    () => (category === 'featured' ? loadFeatured() : loadCategory(category)),
    [category],
  )

  const manifest = manifestState.data
  const needle = query.trim().toLowerCase()

  const items = useMemo(() => {
    if (manifest === null) return []
    if (searching) {
      if (searchState.data === null) return []
      return sortPlugins(
        searchState.data
          .filter((entry) => searchEntryMatches(entry, needle))
          .map((entry) => searchEntryToPlugin(entry, [])),
        sort,
      )
    }
    if (categoryState.data === null) return []
    return sortPlugins(decodeRows(categoryState.data, manifest.sources), sort)
  }, [manifest, searching, searchState.data, categoryState.data, needle, sort])

  if (manifestState.status === 'loading') {
    return <section className="section"><p className="muted">{t('common.loading')}</p></section>
  }
  if (manifestState.status === 'error') {
    return <section className="section"><p className="error">{t('common.error')}</p></section>
  }

  const categories = manifest.categories.filter((entry) => entry.count > 0)
  const busy = searching ? searchState.status === 'loading' : categoryState.status === 'loading'

  return (
    <section className="section">
      <div className="section-head">
        <h1>{t('browse.title')}</h1>
        <span className="muted">
          {busy ? t('common.loading') : `${items.length.toLocaleString()} ${t('browse.count')}`}
        </span>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('browse.search')}
        />
        <select className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="stars">{t('browse.sortStars')}</option>
          <option value="updated">{t('browse.sortUpdated')}</option>
          <option value="name">{t('browse.sortName')}</option>
        </select>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={!searching && category === 'featured' ? 'tab active' : 'tab'}
          onClick={() => { setQuery(''); setCategory('featured') }}
        >
          {t('browse.top')}
          <span className="tab-count">{manifest.stats.featured}</span>
        </button>
        {categories.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={!searching && category === entry.key ? 'tab active' : 'tab'}
            onClick={() => { setQuery(''); setCategory(entry.key) }}
          >
            {categoryLabel(entry.key, lang)}
            <span className="tab-count">{entry.count}</span>
          </button>
        ))}
      </div>

      {busy ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <CatalogGrid items={items} />
      )}
    </section>
  )
}
