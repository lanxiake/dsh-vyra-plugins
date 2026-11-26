import { useEffect, useState } from 'react'

/** 去掉 Vite base 后剩下的站点内路径。 */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

function readPath() {
  const pathname = window.location.pathname
  const stripped = BASE !== '' && pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname
  // 尾斜杠归一：/plugins/ 与 /plugins 视为同一路由
  if (stripped.length > 1) return stripped.replace(/\/+$/, '') || '/'
  return stripped === '' ? '/' : stripped
}

/**
 * 极简路径路由：不引第三方路由库，popstate + pushState 足够。
 * GitHub Pages 需要把 index.html 复制成 404.html 才能回退到 SPA。
 */
export function useRoute() {
  const [path, setPath] = useState(readPath)

  useEffect(() => {
    const onPop = () => setPath(readPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return path
}

export function navigate(to, options = {}) {
  let next = BASE + to
  const query = options.query
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== '' && value != null) params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs !== '') next += '?' + qs
  }
  if (next === window.location.pathname + window.location.search) return
  window.history.pushState({}, '', next)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

/** 读取当前 URL 查询参数，随 popstate 更新。 */
export function useQuery() {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search))
  useEffect(() => {
    const onPop = () => setQuery(new URLSearchParams(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return query
}

export function Link({ to, query, children, className, ...rest }) {
  let href = BASE + to
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== '' && value != null) params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs !== '') href += '?' + qs
  }

  return (
    <a
      href={href}
      className={className}
      {...rest}
      onClick={(event) => {
        event.preventDefault()
        navigate(to, { query })
      }}
    >
      {children}
    </a>
  )
}
