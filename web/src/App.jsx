import { useRoute } from './router.jsx'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import Home from './pages/Home.jsx'
import Browse from './pages/Browse.jsx'
import PluginDetail from './pages/PluginDetail.jsx'
import Docs from './pages/Docs.jsx'
import { useI18n } from './i18n/index.jsx'

function match(path) {
  if (path === '/') return { page: 'home' }
  if (path === '/plugins') return { page: 'browse' }
  if (path === '/docs') return { page: 'docs' }
  const detail = path.match(/^\/plugins\/(.+)$/)
  if (detail) return { page: 'detail', name: decodeURIComponent(detail[1]) }
  return { page: '404' }
}

export default function App() {
  const path = useRoute()
  const route = match(path)
  const { t } = useI18n()

  return (
    <div className="app">
      <Header path={path} />
      <main className="main">
        {route.page === 'home' && <Home />}
        {route.page === 'browse' && <Browse />}
        {route.page === 'detail' && <PluginDetail name={route.name} />}
        {route.page === 'docs' && <Docs />}
        {route.page === '404' && (
          <section className="section">
            <h1>404</h1>
            <p className="muted">{t('notFound')}</p>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
