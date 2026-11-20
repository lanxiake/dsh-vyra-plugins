// 渲染冒烟测试：用最小 React 替身真正执行面板组件，捕获运行时异常。
// 面板空白最常见的来源是渲染期抛错，这个脚本不需要 DSH 也能发现。
// 跑法：node plugins/vyra-xianyu-delivery/test/render-smoke.mjs
globalThis.window = { __ModuleLoader__: { load(def) { globalThis.__def = def } } }
await import('../client.js')
const def = globalThis.__def
if (!def) throw new Error('client.js 没有注册模块')

function createElement(type, props, ...children) {
  const merged = { ...(props || {}) }
  if (children.length) merged.children = children.length === 1 ? children[0] : children
  if (typeof type === 'function') return type(merged)
  return { type, props: merged }
}

let stateCalls = 0
let overrides = {}

const React = {
  createElement,
  useState(init) {
    stateCalls += 1
    const forced = overrides[stateCalls]
    if (forced !== undefined) return forced
    return [typeof init === 'function' ? init() : init, () => {}]
  },
  useEffect: () => {},
  useCallback: (fn) => fn,
  useRef: (init) => ({ current: init }),
}

const mod = def.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})

const registered = []
mod.apply({
  slots: {
    inject: (_name, cb) => cb(),
    register: (config, component) => {
      registered.push({ config, component })
      return { dispose() {} }
    },
  },
})

const main = registered.find((r) => r.config.name === 'main')
if (!main) throw new Error('没有注册主页面')

const shopItem = { item_id: '1095', title: '测试商品', price: '1.99', image_url: 'http://x/y.png', status: '在线' }
const service = { id: 1, name: '客服A', skills: 's1', enabled: 1, auto_deliver: 1 }
const linked = { item_id: '1095', title: '测试商品', service_id: 1 }

const scenarios = {
  orders: { 1: ['orders', () => {}] },
  chat: { 1: ['chat', () => {}], 13: [[{ session_id: 'c1', peer_nick: '买家', peer_user_id: '1', last_msg: '你好', ts: Date.now() }], () => {}] },
  cards: { 1: ['cards', () => {}] },
  items: {
    1: ['items', () => {}],
    6: [[linked], () => {}],
    10: [[{ name: 's1', description: '技能一' }, { name: 's2', description: '技能二' }], () => {}],
    11: [[{ id: 'customer-service', name: '客服 Agent' }], () => {}],
    12: [[shopItem], () => {}],
    20: [[service], () => {}],
  },
  services: {
    1: ['services', () => {}],
    6: [[linked], () => {}],
    20: [[service], () => {}],
    21: [{ service: null }, () => {}],
  },
  'bind-dialog': {
    1: ['items', () => {}],
    6: [[linked], () => {}],
    12: [[shopItem], () => {}],
    20: [[service], () => {}],
    22: [shopItem, () => {}],
  },
  'items+agent-dialog': {
    1: ['items', () => {}],
    6: [[linked], () => {}],
    10: [[{ name: 's1', description: '技能一' }], () => {}],
    11: [[{ id: 'customer-service', name: '客服 Agent' }], () => {}],
    12: [[shopItem], () => {}],
    27: [{ item: shopItem, current: linked, agentPreset: 'builtin' }, () => {}],
  },
  'order-detail': { 1: ['orders', () => {}], 25: ['5127944941190007915', () => {}] },
  'item-detail': { 1: ['items', () => {}], 26: [shopItem, () => {}] },
  deliveries: { 1: ['deliveries', () => {}] },
  login: { 1: ['chat', () => {}], 32: [true, () => {}], 33: [{ state: 'waiting', qr: '' }, () => {}] },
}

for (const [name, forced] of Object.entries(scenarios)) {
  stateCalls = 0
  overrides = forced
  try {
    main.component()
    console.log(`ok  ${name}`)
  } catch (err) {
    console.log(`FAIL ${name}: ${err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : err}`)
    process.exitCode = 1
  }
}
