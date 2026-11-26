import { Link } from '../../router.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { useTheme } from '../../hooks/useTheme.js'
import { SITE } from '../../logic/site.js'

export default function Header({ path }) {
  const { lang, setLang, t } = useI18n()
  const { theme, toggle } = useTheme()

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">V</span>
          <span className="brand-name">Vyra × DSH</span>
        </Link>

        <nav className="nav">
          <Link to="/plugins" className={path.startsWith('/plugins') ? 'nav-link active' : 'nav-link'}>
            {t('nav.browse')}
          </Link>
          <Link to="/docs" className={path === '/docs' ? 'nav-link active' : 'nav-link'}>
            {t('nav.docs')}
          </Link>
          <a className="nav-link" href={SITE.repoUrl} target="_blank" rel="noopener noreferrer">
            {t('nav.github')}
          </a>
        </nav>

        <div className="header-actions">
          <button
            className="ghost"
            type="button"
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            {lang === 'zh' ? '中' : 'EN'}
          </button>
          <button
            className="ghost"
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </div>
    </header>
  )
}
