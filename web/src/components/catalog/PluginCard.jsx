import { useState } from 'react'
import { Link } from '../../router.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { categoryLabel } from '../../logic/categories.js'
import Badge from '../ui/Badge.jsx'

/** 卡片上的安装命令（与详情页一致）。 */
function installCommandOf(plugin) {
  if (plugin.install?.command) return plugin.install.command
  if (plugin.install?.spec) return `dsh plugin --profile web add ${plugin.install.spec}`
  if (plugin.package) return `dsh plugin --profile web add ${plugin.package}`
  return ''
}

export default function PluginCard({ plugin, showInstall = true }) {
  const { lang, t, pick } = useI18n()
  const [copied, setCopied] = useState(false)
  const title = pick(plugin.title, plugin.name)
  const description = pick(plugin.description, '')
  const installable = plugin.install != null && plugin.install.method !== 'unknown'
  const command = installCommandOf(plugin)

  // 推荐分：Vyra 出品用构建期注入的 stars，第三方沿用索引源 star。
  const recommend = plugin.stats?.stars ?? null
  const downloads = plugin.stats?.downloads ?? null
  const sourceCount = plugin.sources?.length ?? 0

  async function copyInstall(event) {
    event.preventDefault()
    event.stopPropagation()
    if (command === '') return
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = command
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* 忽略 */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Link
      to={`/plugins/${encodeURIComponent(plugin.name)}`}
      className={plugin.featured ? 'card vyra-own' : 'card'}
    >
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

      <div className="card-meta compact">
        {recommend !== null && <span className="card-recommend">★ {recommend}</span>}
        {downloads !== null && <span className="card-downloads">↓ {downloads}</span>}
        {sourceCount > 1 && <span className="card-sources">{sourceCount} 源</span>}
        {plugin.featured && <Badge tone="brand">Vyra</Badge>}
        {!installable && <Badge tone="warn">{t('badge.manual')}</Badge>}
        {showInstall && installable && command !== '' && (
          <button type="button" className="card-install" onClick={copyInstall}>
            {copied ? t('detail.copied') : t('detail.install')}
          </button>
        )}
      </div>
    </Link>
  )
}
