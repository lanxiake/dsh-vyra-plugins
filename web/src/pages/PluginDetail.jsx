import { useState } from 'react'
import { Link } from '../router.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useI18n } from '../i18n/index.jsx'
import { categoryLabel } from '../logic/categories.js'
import { CATEGORY_ORDER } from '../logic/categories.js'
import { decodeRows, loadCategory, loadLookup, loadManifest, lookupMap } from '../data/catalog.js'
import Badge from '../components/ui/Badge.jsx'

/** 展示用的安装命令。第 3 步会换成 install-info.mjs 的 5 类判定。 */
function installCommandOf(plugin) {
  if (plugin.install?.command) return plugin.install.command
  if (plugin.install?.spec) return `dsh plugin --profile web add ${plugin.install.spec}`
  if (plugin.package) return `dsh plugin --profile web add ${plugin.package}`
  return ''
}

export default function PluginDetail({ name }) {
  const { lang, t, pick } = useI18n()
  const [copied, setCopied] = useState(false)

  const { status, data, error } = useAsync(async () => {
    const [manifest, lookup] = await Promise.all([loadManifest(), loadLookup()])
    const index = lookupMap(lookup)
    const catIdx = index.get(name)
    if (catIdx === undefined) return { manifest, plugin: null }

    const rows = await loadCategory(CATEGORY_ORDER[catIdx] ?? 'other')
    const plugin = decodeRows(rows, manifest.sources).find((item) => item.name === name) ?? null
    return { manifest, plugin }
  }, [name])

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

  const { plugin } = data
  if (plugin === null) {
    return (
      <section className="section">
        <h1>{t('detail.notFound')}</h1>
        <Link to="/plugins">{t('detail.back')}</Link>
      </section>
    )
  }

  const title = pick(plugin.title, plugin.name)
  const description = pick(plugin.description, '')
  const command = installCommandOf(plugin)

  async function copy() {
    if (command === '') return
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="section detail">
      <Link to="/plugins" className="back">
        ← {t('detail.back')}
      </Link>

      <header className="detail-head">
        {plugin.icon ? (
          <img className="detail-icon" src={plugin.icon} alt="" />
        ) : (
          <span className="detail-icon fallback">{String(title).slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <h1>{title}</h1>
          <code className="detail-name">{plugin.name}</code>
          <div className="card-meta">
            <Badge>{categoryLabel(plugin.category, lang)}</Badge>
            {plugin.version && <Badge tone="muted">v{plugin.version}</Badge>}
            {plugin.featured && <Badge tone="brand">Vyra</Badge>}
          </div>
        </div>
      </header>

      {description !== '' && <p className="detail-desc">{description}</p>}

      <section className="block">
        <h2>{t('detail.install')}</h2>
        {command !== '' ? (
          <div className="install-box">
            <code>{command}</code>
            <button type="button" className="button" onClick={copy}>
              {copied ? t('detail.copied') : t('detail.copy')}
            </button>
          </div>
        ) : (
          <p className="muted">{t('detail.noInstall')}</p>
        )}
      </section>

      <section className="block">
        <h2>{t('detail.category')}</h2>
        <dl className="meta-grid">
          {plugin.version && (
            <div>
              <dt>{t('detail.version')}</dt>
              <dd>{plugin.version}</dd>
            </div>
          )}
          {plugin.publishedAt && (
            <div>
              <dt>{t('detail.updated')}</dt>
              <dd>{new Date(plugin.publishedAt).toLocaleDateString()}</dd>
            </div>
          )}
          <div>
            <dt>{t('detail.sources')}</dt>
            <dd>{plugin.sources.join(', ')}</dd>
          </div>
        </dl>
      </section>

      {(plugin.repo || plugin.homepage) && (
        <section className="block">
          <h2>{t('detail.repo')}</h2>
          <ul className="link-list">
            {plugin.repo && (
              <li>
                <a href={`https://github.com/${plugin.repo}`} target="_blank" rel="noopener noreferrer">
                  github.com/{plugin.repo}
                </a>
              </li>
            )}
            {plugin.homepage && (
              <li>
                <a href={plugin.homepage} target="_blank" rel="noopener noreferrer">
                  {plugin.homepage}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
    </article>
  )
}
