/**
 * 渲染冒烟测试：用最小 React 桩把每个注册的组件都渲染一遍，
 * 期望"不抛异常"。设置页丢了、按钮点不动这类问题，最先暴露在这里。
 *
 * 这个桩不做真实挂载，只按调用顺序执行组件函数——对"渲染时抛错"足够，
 * 对"事件处理器被调用后抛错"也能覆盖（桩会把 onClick 真的调一次）。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const code = readFileSync(path.join(here, '..', 'client.js'), 'utf8')

function fakeElement() {
  return {
    id: '', style: {}, textContent: '', className: '',
    setAttribute() {}, appendChild() {}, addEventListener() {}, removeEventListener() {},
  }
}

/** 收集渲染过程中被创建的树上所有节点。 */
function createHarness() {
  const nodes = []
  const errors = []
  let factory = null
  const sandbox = {
    console,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    fetch: async () => ({ ok: true, text: async () => '{"ok":true,"recording":false}', headers: { get: () => '0' } }),
    navigator: { language: 'zh-CN' },
    localStorage: { getItem: () => null, setItem() {} },
    Image: class { set src(_value) { /* 不发请求 */ } },
    Blob: class { constructor() { this.size = 0 } },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
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
      createElement: () => fakeElement(),
      head: { appendChild() {} },
      body: { style: {}, appendChild() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)

  const React = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => {
      const node = { type, props: props || {}, children: children.flat(4).filter(child => child !== null && child !== undefined && child !== false) }
      nodes.push(node)
      return node
    },
    useEffect: () => {},
    useMemo: (fn) => { try { return fn() } catch (error) { errors.push(error); return undefined } },
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
  }
  const module = factory((name) => {
    if (name === 'react') return React
    if (name === 'react-dom') return { createPortal: (node) => node }
    throw new Error('unknown module ' + name)
  })
  return { module, nodes, errors }
}

/** 深度优先找出 className 里含某个标记的节点。 */
function findByClass(nodes, className) {
  for (const node of nodes) {
    const value = node.props && node.props.className
    if (typeof value === 'string' && value.includes(className)) return node
    const found = findByClass(node.children || [], className)
    if (found) return found
  }
  return null
}

/** 找出所有可点击元素（带 onClick）。 */
function clickables(nodes) {
  const out = []
  for (const node of nodes) {
    if (node.props && typeof node.props.onClick === 'function') out.push(node)
    out.push(...clickables(node.children || []))
  }
  return out
}

const cases = [
  { name: '工具栏', slot: 'conversation.input.left', component: 'Toolbar', marker: 'vsr-toolbar' },
  { name: '设置页', slot: 'settings.section', component: 'SettingsPage', marker: 'vsr-settings' },
]

for (const item of cases) {
  const { module, nodes } = createHarness()
  const registered = []
  const ctx = {
    effect: (fn) => { const dispose = fn(); if (typeof dispose === 'function') dispose() },
    slots: {
      inject: (_name, callback) => callback(),
      register: (options, component) => { registered.push({ options, component }); return () => {} },
    },
  }
  module.apply(ctx)
  const entry = registered.find(row => row.options.name === item.slot)
  assert.ok(entry, item.slot + ' 没有注册')
  nodes.length = 0
  entry.component({})
  assert.ok(findByClass(nodes, item.marker), item.name + ' 没有渲染出 ' + item.marker)
  console.log(item.name + ' 渲染正常，节点数 ' + nodes.length)

  // 点一遍所有按钮：事件处理器里抛错同样算失败。
  let clicked = 0
  for (const node of clickables(nodes)) {
    try { node.props.onClick({ preventDefault() {}, stopPropagation() {}, target: { closest: () => null } }); clicked++ } catch (error) {
      if (!/Failed to fetch|noRoute/.test(String(error && error.message))) {
        throw new Error(item.name + ' 的按钮 onClick 抛错：' + (error && error.message))
      }
    }
  }
  console.log(item.name + ' 可点击元素 ' + clicked + ' 个，未抛错')
}