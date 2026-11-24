import { Link } from '../router.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useI18n } from '../i18n/index.jsx'
import { decodeRow, loadFeatured, loadManifest } from '../data/catalog.js'
import CatalogGrid from '../components/catalog/CatalogGrid.jsx'

export default function Home() {
  const { t } = useI18n()
  const { status, data, error } = useAsync(async () => {
    const [manifest, featured] = await Promise.all([loadManifest(), loadFeatured()])
    return {
      manifest,
      featured: featured.map((row) => decodeRow(row, manifest.sources)),
    }
  }, [])

  if (status === 'loading') {
    return <section className="section"><p className="muted">{t('common.loading')}</p></section>
  }
  if (status === 'error') {
    return (
      <section className="section">
        <p className="error">{t('common.error')}</p>
        <p className="muted">{String(error?.message ?? error)}</p>
      </section>
    )
  }

  const { manifest, featured } = data
  const sources = Object.entries(manifest.stats.sources ?? {}).filter(([, count]) => count > 0)

  return (
    <>
      <section className="hero">
        <h1>{t('home.title')}</h1>
        <p className="hero-sub">{t('home.subtitle')}</p>
        <div className="hero-actions">
          <Link to="/plugins" className="button primary">
            {t('home.browse')}
          </Link>
        </div>

        <div className="stats">
          <div className="stat">
            <strong>{manifest.stats.total.toLocaleString()}</strong>
            <span>{t('home.statTotal')}</span>
          </div>
          <div className="stat">
            <strong>{manifest.stats.installable.toLocaleString()}</strong>
            <span>{t('home.statInstallable')}</span>
          </div>
          <div className="stat">
            <strong>{sources.length}</strong>
            <span>{t('home.statSources')}</span>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t('home.featured')}</h2>
            <Link to="/plugins">{t('home.browse')} →</Link>
          </div>
          <CatalogGrid items={featured} />
        </section>
      )}

      <section className="section">
        <h2>{t('home.sources')}</h2>
        <ul className="source-list">
          {sources.map(([id, count]) => (
            <li key={id}>
              <code>{id}</code>
              <span>{count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
