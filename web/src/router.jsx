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

export function navigate(to) {
  const next = BASE + to
  if (next === window.location.pathname) return
  window.history.pushState({}, '', next)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

export function Link({ to, children, className, ...rest }) {
  return (
    <a
      href={BASE + to}
      className={className}
      {...rest}
      onClick={(event) => {
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
