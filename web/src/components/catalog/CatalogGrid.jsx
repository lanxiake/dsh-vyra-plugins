import { useIncrementalList } from '../../hooks/useIncrementalList.js'
import { useI18n } from '../../i18n/index.jsx'
import PluginCard from './PluginCard.jsx'

export default function CatalogGrid({ items, dense = false }) {
  const { visible, sentinelRef, total } = useIncrementalList(items)
  const { t } = useI18n()

  if (total === 0) return <p className="muted">{t('browse.empty')}</p>

  return (
    <>
      <div className={dense ? 'grid dense' : 'grid'}>
        {visible.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </div>
      {visible.length < total && (
        <div ref={sentinelRef} className="sentinel">
          {t('common.loading')}
        </div>
      )}
    </>
  )
}
