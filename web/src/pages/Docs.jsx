import { useI18n } from '../i18n/index.jsx'
import { INDEX_URLS } from '../logic/site.js'

export default function Docs() {
  const { t } = useI18n()

  return (
    <article className="section docs">
      <h1>{t('docs.title')}</h1>
      <p className="muted">{t('docs.intro')}</p>

      <section className="block">
        <h2>{t('docs.installTitle')}</h2>
        <p>{t('docs.installBody')}</p>
        <pre className="code-block">
          <code>dsh plugin --profile web add &lt;package-name&gt;</code>
        </pre>
      </section>

      <section className="block">
        <h2>{t('docs.indexTitle')}</h2>
        <p>{t('docs.indexBody')}</p>
        <dl className="meta-grid">
          <div>
            <dt>{t('docs.indexDomestic')}</dt>
            <dd>
              <code className="break">{INDEX_URLS.domestic}</code>
            </dd>
          </div>
          <div>
            <dt>{t('docs.indexOverseas')}</dt>
            <dd>
              <code className="break">{INDEX_URLS.overseas}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="block">
        <h2>{t('docs.sourceTitle')}</h2>
        <p>{t('docs.sourceBody')}</p>
        <ul className="source-list">
          <li><code>vyra</code><span>lanxiake/dsh-vyra-plugins</span></li>
          <li><code>market</code><span>dsh-plugin.shop</span></li>
          <li><code>dshmarket</code><span>dshmarket.com</span></li>
          <li><code>dshopen</code><span>dshopen.org</span></li>
          <li><code>dshtui</code><span>go.dshtui.com</span></li>
        </ul>
      </section>
    </article>
  )
}
