/**
 * Markdown 渲染器：只产结构、只认白名单。
 *
 * 这里守两件事：
 *  1. **绝不把模型生成的 HTML 变成节点**——所有文本都走 React 的文本节点；
 *  2. **链接只放行 http(s)/mailto**，`javascript:` 之类降级成纯文本。
 */
import assert from 'node:assert/strict'
import { setReact } from '../src/react.js'
import { Markdown } from '../src/markdown.js'

// 拿一份最小的假 React：只要 createElement 能构造出可检查的树。
const tree = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) })
setReact({ createElement: tree, Fragment: Symbol.for('react.fragment'), useState: (v) => [v, () => {}], useEffect: () => {}, useRef: () => ({ current: null }) })

const results = []
const test = (name, fn) => {
  try {
    fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    results.push(`✗ ${name}\n  ${e instanceof Error ? e.stack : e}`)
    process.exitCode = 1
  }
}

/** 把渲染树拍平成「文本 + 节点类型」，方便断言。 */
function walk(node, out = { types: [], text: '', links: [] }) {
  if (node == null) return out
  if (Array.isArray(node)) {
    for (const n of node) walk(n, out)
    return out
  }
  if (typeof node === 'string' || typeof node === 'number') {
    out.text += String(node)
    return out
  }
  out.types.push(String(node.type))
  if (node.type === 'a') out.links.push(node.props.href)
  for (const c of node.children ?? []) walk(c, out)
  return out
}

test('段落里的行内代码 / 粗体 / 斜体', () => {
  const r = walk(Markdown({ text: '用 `df -h` 看**磁盘**，*注意*权限' }))
  assert.equal(r.text, '用 df -h 看磁盘，注意权限')
  assert.ok(r.types.includes('code'))
  assert.ok(r.types.includes('strong'))
  assert.ok(r.types.includes('em'))
})

test('代码块原样保留，不做行内解析', () => {
  const r = walk(Markdown({ text: '```bash\nrm -rf *bold*\n```' }))
  assert.equal(r.types.filter((t) => t === 'pre').length, 1)
  assert.ok(r.text.includes('rm -rf *bold*'), '代码块里的星号不该被当成粗体')
})

test('列表与标题', () => {
  const r = walk(Markdown({ text: '## 结论\n- 磁盘 92%\n- 内存正常\n\n1. 先备份\n2. 再清理' }))
  assert.equal(r.types.filter((t) => t === 'h4').length, 1)
  assert.equal(r.types.filter((t) => t === 'ul').length, 1)
  assert.equal(r.types.filter((t) => t === 'ol').length, 1)
})

test('http(s) 链接保留', () => {
  const r = walk(Markdown({ text: '见 [文档](https://example.com/a)' }))
  assert.deepEqual(r.links, ['https://example.com/a'])
})

test('javascript: 链接降级成纯文本，绝不变成可点的入口', () => {
  const r = walk(Markdown({ text: '[点我](javascript:alert(1))' }))
  assert.deepEqual(r.links, [], '不应产出 <a>')
  assert.ok(r.text.includes('javascript:alert(1)'), '但原文要显示出来')
})

test('模型生成的 HTML 不会变成节点', () => {
  const r = walk(Markdown({ text: '<img src=x onerror=alert(1)>' }))
  assert.ok(!r.types.includes('img'))
  assert.ok(r.text.includes('<img'), '按纯文本显示')
})

test('空输入不渲染任何东西', () => {
  assert.equal(Markdown({ text: '   ' }), null)
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exit(process.exitCode ?? 0)
