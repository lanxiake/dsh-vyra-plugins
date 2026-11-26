import { useState } from 'react'
import { Link, navigate } from '../router.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useI18n } from '../i18n/index.jsx'
import { decodeRow, loadFeatured, loadManifest, loadTop } from '../data/catalog.js'
import CatalogGrid from '../components/catalog/CatalogGrid.jsx'

const PROFILES = ['web', 'work', 'auto']

/** 安装命令（与详情页一致）。 */
function copyText(text, done) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done))
  } else {
    fallbackCopy(text, done)
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch { /* 忽略 */ }
  document.body.removeChild(ta)
  done()
}

export default function Home() {
  const { t } = useI18n()
  const [profile, setProfile] = useState('web')
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')

  const { status, data, error } = useAsync(async () => {
    const [manifest, featured, top] = await Promise.all([loadManifest(), loadFeatured(), loadTop()])
    return {
      manifest,
      featured: featured.map((row) => decodeRow(row, manifest.sources)),
      top: top.map((row) => decodeRow(row, manifest.sources)),
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

  const { manifest, featured, top } = data
  const sources = Object.entries(manifest.stats.sources ?? {}).filter(([, count]) => count > 0)
  const vyraCount = manifest.stats.featured ?? 0
  const statVars = {
    total: (manifest.stats.total ?? 0).toLocaleString(),
    sources: sources.length,
  }
  const command = `dsh plugin --profile ${profile} add dsh-vyra-plugin-market`
  // 「Vyra 出品」= 自研插件按真实 star 排序取前 4；「编辑精选」= 全站跨源 top 取前 4。
  const vyraTop = [...featured].sort((a, b) => (b.stats?.stars ?? 0) - (a.stats?.stars ?? 0)).slice(0, 4)
  const editorsPick = top.slice(0, 4)

  function submitSearch(event) {
    event.preventDefault()
    navigate('/plugins', { query: { q: search.trim() } })
  }

  function copyInstall() {
    copyText(command, () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <section className="hero">
        <p className="hero-kicker">{t('home.kicker')}</p>
        <h1>{t('home.title')}</h1>
        <p className="hero-sub">{t('home.subtitle', statVars)}</p>

        <form className="hero-search" onSubmit={submitSearch}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('browse.search', statVars)}
            aria-label={t('browse.search', statVars)}
          />
          <button type="submit" className="button primary">{t('home.browse')}</button>
        </form>

        <p className="hero-rec">
          <span className="rec-star">★</span>
          {t('home.recLegend')}
        </p>

        <div className="install-banner">
          <div className="install-bar">
            <span className="install-icon">⚡</span>
            <span className="install-label">{t('home.installTitle')}</span>
            <span className="install-cmd">
              dsh plugin --profile{' '}
              <select value={profile} onChange={(event) => setProfile(event.target.value)} aria-label="profile">
                {PROFILES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {' '}add dsh-vyra-plugin-market
            </span>
            <button type="button" className={copied ? 'button primary copied' : 'button primary'} onClick={copyInstall}>
              {copied ? t('home.copied') : t('home.copy')}
            </button>
          </div>
          <p className="install-hint">{t('home.installHint')}</p>
        </div>

        <div className="stats">
          <div className="stat">
            <strong>{manifest.stats.total.toLocaleString()}</strong>
            <span>{t('home.statTotal')}</span>
          </div>
          <div className="stat highlight">
            <strong>{vyraCount}</strong>
            <span>{t('home.statVyra')}</span>
          </div>
          <div className="stat">
            <strong>{sources.length}</strong>
            <span>{t('home.statSources')}</span>
          </div>
          <div className="stat">
            <strong className="stat-upkeep">{t('home.upkeep')}</strong>
            <span>{t('home.statUpkeep')}</span>
          </div>
        </div>
      </section>

      {vyraTop.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t('home.featured')}</h2>
            <span className="muted">{vyraCount} {t('home.featuredNote')}</span>
            <Link to="/plugins" query={{ quality: 'vyra' }} className="more-link">
              {t('home.viewVyra')} →
            </Link>
          </div>
          <CatalogGrid items={vyraTop} dense />
        </section>
      )}

      {editorsPick.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t('home.editorsPick')}</h2>
            <span className="muted">{t('home.editorsPickNote')}</span>
            <Link to="/plugins" query={{ quality: 'editors' }} className="more-link">
              {t('home.enterMarket')} →
            </Link>
          </div>
          <CatalogGrid items={editorsPick} dense />
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
        <p className="muted footer-note">{t('home.footer')}</p>
      </section>
    </>
  )
}
