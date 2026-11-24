/**
 * 设置页渲染结构回归测试。
 *
 * 背景：这个 bug 连过一次——某次批量替换把「文字识别」卡片的右括号
 * 多写了一个，整条 `return h('div', { className: 'vsr-settings' }, ...)`
 * 在那里就提前闭合，后面 4 张卡片变成独立语句，函数最后返回的是
 * 「文件」卡片。用户在设置里只看得到一张卡。
 *
 * 静态语法检查抓不到（仍是合法 JS），之前的测试也没覆盖，因为它们只
 * 检查源码里有没有那些字符串。这个测试真正执行 SettingsPage，检查它
 * 返回的是根容器、并且五张卡片都在它的子树里。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const code = readFileSync(path.join(here, '..', 'client.js'), 'utf8')

/** 用最小桩执行 client.js，交出 SettingsPage 组件。 */
function loadSettingsPage() {
  let factory = null
  const sandbox = {
    console,
    TextEncoder,
    TextDecoder,
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    fetch: async () => ({ ok: true, headers: { get: () => '0' }, text: async () => '{}' }),
    navigator: { language: 'zh-CN' },
    localStorage: { getItem: () => null, setItem() {} },
    Image: class { set src(_value) {} },
    Blob: class {},
    File: class {},
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    requestAnimationFrame: () => 0,
    window: {
      __ModuleLoader__: { load: (value) => { factory = value.factory } },
      addEventListener() {},
      removeEventListener() {},
      innerWidth: 1280,
      innerHeight: 800,
      devicePixelRatio: 1,
    },
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      head: { appendChild() {} },
      body: { style: {}, appendChild() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {},
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)

  const React = {
    Fragment: 'FRAGMENT',
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(8) }),
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useState: (initial) => [initial, () => {}],
  }
  const module = factory((name) => (name === 'react' ? React : { createPortal: (node) => node }))

  let page = null
  module.apply({
    effect: (fn) => fn(),
    slots: {
      inject: (_name, callback) => callback(),
      register: (options, component) => {
        if (options && options.name === 'settings.section') page = component
        return () => {}
      },
    },
  })
  return page
}

/** 深度收集子树里所有节点。 */
function collect(node, out = []) {
  if (!node || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children || []) collect(child, out)
  return out
}

test('SettingsPage 返回的是根容器，不是某一张卡片', () => {
  const page = loadSettingsPage()
  assert.ok(page, '没有注册 settings.section')

  const root = page({})
  assert.equal(root.type, 'div', '根节点必须是 div，收到 ' + root.type)
  assert.equal(root.props.className, 'vsr-settings', '根节点 className 不对：' + root.props.className)
})

test('五张设置卡片都在根节点的子树里', () => {
  const page = loadSettingsPage()
  const root = page({})
  const all = collect(root)
  const cards = all.filter((node) => node.type === 'section' && node.props && node.props.className === 'vsr-card')
  const titles = cards.map((card) => {
    // 「文件」卡片的标题包在 .vsr-library-head 里，和筛选按钮同一行，
    // 所以要深度找，不能只看直接子节点。
    const heading = collect(card).find((node) => node && node.type === 'h3')
    return heading ? heading.children.join('') : '?'
  })

  assert.ok(cards.length >= 4, '卡片数量不对，只渲染出 ' + cards.length + ' 张：' + titles.join(' / '))
  for (const expected of ['存储位置', '录制', '快捷键', '文字识别', '文件']) {
    assert.ok(titles.includes(expected), '缺少卡片：' + expected + '（实际：' + titles.join(' / ') + '）')
  }
})

test('卡片是根容器的直接子节点，没有被挤出 return 语句', () => {
  // 提前闭合括号时，卡片会变成函数体里的独立语句，不在 root.children 里。
  const page = loadSettingsPage()
  const root = page({})
  const direct = (root.children || []).filter((node) => node && node.props && node.props.className === 'vsr-card')
  assert.ok(direct.length >= 4, '根容器的直接子节点里只有 ' + direct.length + ' 张卡片')
})

test('return 表达式里括号平衡，不会提前闭合', () => {
  // 静态兜底：万一又出现类似的多余括号，这条给出可读的定位信息。
  const lines = code.split('\n')
  const start = lines.findIndex((line) => line.includes("className: 'vsr-settings'"))
  assert.ok(start > 0, '找不到根节点')

  let depth = 0
  const early = []
  for (let index = start; index < lines.length; index++) {
    const clean = lines[index]
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/`(?:\\.|[^`\\])*`/g, '``')
      .replace(/\/\/.*$/, '')
    for (const char of clean) {
      if (char === '(' || char === '[' || char === '{') depth++
      else if (char === ')' || char === ']' || char === '}') depth--
    }
    // 根 return 还没结束就回到 0，说明闭合早了
    if (depth === 0 && index < lines.length - 1) {
      const next = lines.slice(index + 1, index + 4).join('\n')
      if (/h\('section'|card\(/.test(next)) early.push('第 ' + (index + 1) + ' 行后提前闭合')
    }
    if (depth < 0) break
  }
  assert.deepEqual(early, [], '括号提前闭合：' + early.join('；'))
})