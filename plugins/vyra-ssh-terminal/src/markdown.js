/**
 * 回答区用的极简 Markdown。
 *
 * 只处理模型实际会写的那几种：段落、行内代码、代码块、粗体、斜体、有序/无序列表、
 * 标题、链接。**不解析 HTML、不走 innerHTML**——回答是模型生成的，安全边界不能交给它。
 * 链接也只放行 http(s) / mailto，其余按纯文本显示。
 */
import { hostReact } from './react.js'
import { h, Fragment } from './jsx-shim.js'

const SAFE_HREF = /^(https?:\/\/|mailto:)/i

/** 行内元素：代码 / 粗体 / 斜体 / 链接。按出现顺序扫描，不嵌套同名标记。 */
function inline(text, keyBase) {
  const out = []
  let rest = String(text)
  let n = 0
  const push = (node) => out.push(globalThis.__dshSshTerminalReact.createElement(Fragment, { key: `${keyBase}-${n++}` }, node))

  for (;;) {
    const m = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/.exec(rest)
    if (!m) break
    if (m.index > 0) push(rest.slice(0, m.index))
    const token = m[0]
    const key = `${keyBase}-${n++}`
    if (token.startsWith('`')) push(h('code', { key, className: 'sx-md-code' }, token.slice(1, -1)))
    else if (token.startsWith('**')) push(h('strong', { key }, token.slice(2, -2)))
    else if (token.startsWith('*')) push(h('em', { key }, token.slice(1, -1)))
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token)
      // 只放行 http(s)/mailto：模型给的链接可能是 javascript:，绝不能变成可点的入口
      push(SAFE_HREF.test(href)
        ? h('a', { key, href, target: '_blank', rel: 'noreferrer noopener' }, label)
        : h('span', { key }, `${label} (${href})`))
    }
    rest = rest.slice(m.index + token.length)
  }
  if (rest) push(rest)
  return out
}

/**
 * 把一段 Markdown 渲染成 React 节点。
 * @param {string} markdown
 */
export function Markdown({ text }) {
  const source = String(text ?? '')
  if (!source.trim()) return null
  const blocks = []
  const lines = source.split('\n')
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const body = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++])
      i++ // 跳过收尾的 ```
      blocks.push(h('pre', { key: key++, className: 'sx-md-pre' }, h('code', { 'data-lang': lang || undefined }, body.join('\n'))))
      continue
    }

    // 标题
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      blocks.push(h(`h${Math.min(level + 2, 6)}`, { key: key++, className: 'sx-md-h' }, inline(heading[2], `h${key}`)))
      i++
      continue
    }

    // 列表（有序 / 无序，不嵌套——模型很少真的需要嵌套）
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(h('li', { key: items.length }, inline(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''), `li${key}-${items.length}`)))
        i++
      }
      blocks.push(h(ordered ? 'ol' : 'ul', { key: key++, className: 'sx-md-list' }, items))
      continue
    }

    // 空行
    if (!line.trim()) {
      i++
      continue
    }

    // 段落：连续的普通行合成一段
    const para = []
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
      para.push(lines[i++])
    }
    blocks.push(h('p', { key: key++, className: 'sx-md-p' }, inline(para.join('\n'), `p${key}`)))
  }

  return h('div', { className: 'sx-md' }, blocks)
}
