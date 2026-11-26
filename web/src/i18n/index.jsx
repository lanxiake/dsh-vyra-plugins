import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import zh from './zh.json'
import en from './en.json'

const DICTS = { zh, en }
const KEY = 'vyra-site.lang'
const LanguageContext = createContext(null)

function detect() {
  const saved = localStorage.getItem(KEY)
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict)
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detect)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang(next) {
        setLang(next)
        localStorage.setItem(KEY, next)
      },
      /** 界面文案；vars 用于替换 {name} 占位符（如动态统计数字） */
      t(key, vars) {
        const hit = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key) ?? key
        if (!vars || typeof hit !== 'string') return hit
        return hit.replace(/\{(\w+)\}/g, (m, name) =>
          Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
        )
      },
      /** 插件数据里的 {zh, en} 字段 */
      pick(field, fallback = '') {
        if (field == null) return fallback
        if (typeof field === 'string') return field
        return field[lang] ?? field.en ?? field.zh ?? fallback
      },
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const ctx = useContext(LanguageContext)
  if (ctx === null) throw new Error('useI18n 必须在 LanguageProvider 内使用')
  return ctx
}
