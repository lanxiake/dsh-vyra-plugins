import { useEffect, useState } from 'react'

const KEY = 'vyra-site.theme'

function detect() {
  const saved = localStorage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  // 站点定稿为深色主题，默认 dark；用户可随时切换到浅色。
  return 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState(detect)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(KEY, theme)
  }, [theme])

  return {
    theme,
    toggle: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }
}
