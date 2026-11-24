import { Link } from '../../router.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { categoryLabel } from '../../logic/categories.js'
import Badge from '../ui/Badge.jsx'

export default function PluginCard({ plugin }) {
  const { lang, t, pick } = useI18n()
  const title = pick(plugin.title, plugin.name)
  const description = pick(plugin.description, '')
  const installable = plugin.install != null && plugin.install.method !== 'unknown'

  return (
    <Link to={`/plugins/${encodeURIComponent(plugin.name)}`} className="card">
      <div className="card-head">
        {plugin.icon ? (
          <img className="card-icon" src={plugin.icon} alt="" loading="lazy" />
        ) : (
          <span className="card-icon fallback">{String(title).slice(0, 1).toUpperCase()}</span>
        )}
        <div className="card-titles">
          <h3 title={title}>{title}</h3>
          <code>{plugin.name}</code>
        </div>
      </div>

      <p className="card-desc">{description}</p>

      <div className="card-meta">
        <Badge>{categoryLabel(plugin.category, lang)}</Badge>
        {plugin.featured && <Badge tone="brand">Vyra</Badge>}
        {plugin.version && <Badge tone="muted">v{plugin.version}</Badge>}
        {!installable && <Badge tone="warn">{t('badge.manual')}</Badge>}
        {plugin.stats?.stars ? <span className="card-stars">★ {plugin.stats.stars}</span> : null}
      </div>
    </Link>
  )
}
