/**
 * xterm 从后端自己的路由上加载（vendor 内置，不联网取 CDN）。
 * 三个脚本依次注入；`window.define` 临时摘掉，免得页面上的 AMD loader 抢走它们。
 */
let loading = null
let ok = false

export async function loadXterm() {
  if (ok) return
  if (loading) return loading
  loading = (async () => {
    const base = '/api/ssh-terminal/'
    const load2 = (src) =>
      new Promise((res, rej) => {
        const s = document.createElement('script')
        s.src = base + src
        s.onload = res
        s.onerror = () => rej(new Error('加载 ' + src + ' 失败'))
        document.head.append(s)
      })
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = base + 'xterm.css'
    document.head.append(link)
    const d = window.define
    window.define = undefined
    try {
      await load2('xterm.js')
      await load2('addon-fit.js')
      await load2('addon-search.js')
    } finally {
      window.define = d
    }
    ok = true
  })()
  return loading
}
