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

// 编号只按 useState 递增；useRef/useEffect/useCallback 不占位，场景表的键才稳定。
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
  useRef: (init) => ({ current: init }),
  useEffect: () => {},
  useCallback: (fn) => fn,
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

// useState 编号（XianyuDelivery，按出现顺序）：
//  1 tab  2 status  3 orders  4 deliveries  5 cards  6 items  7 itemDraft  8 auth  9 settings
// 10 skillList 11 agentList 12 models 13 shopItems 14 chats 15 activeChat 16 chatMessages
// 17 replyText 18 remoteOrders 19 remoteOrdersLoading 20 accounts 21 services 22 editingCard
// 23 events 24 serviceDialog 25 bindItem 26 avatars 27 selfAvatar 28 orderDetailId
// 29 itemDetailItem 30 agentConfig 31 busy 32 error 33 notice 34 draft 35 loginOpen 36 login 37 steps
const scenarios = {
  orders: { 1: ['orders', () => {}] },
  chat: { 1: ['chat', () => {}], 14: [[{ session_id: 'c1', peer_nick: '买家', peer_user_id: '1', last_msg: '你好', ts: Date.now() }], () => {}] },
  cards: { 1: ['cards', () => {}] },
  items: {
    1: ['items', () => {}],
    6: [[linked], () => {}],
    10: [[{ name: 's1', description: '技能一' }, { name: 's2', description: '技能二' }], () => {}],
    11: [[{ id: 'customer-service', name: '客服 Agent' }], () => {}],
    13: [[shopItem], () => {}],
    21: [[service], () => {}],
  },
  services: {
    1: ['services', () => {}],
    6: [[linked], () => {}],
    21: [[service], () => {}],
    24: [{ service: null }, () => {}],
    9: [{ tools: [{ name: 'xianyu_list_chats', description: '列出会话' }] }, () => {}],
    12: [[{ provider: 'ydy-ds', id: 'deepseek-v4.1-flash', name: 'deepseek-v4.1-flash' }], () => {}],
  },
  'bind-dialog': {
    1: ['items', () => {}],
    6: [[linked], () => {}],
    13: [[shopItem], () => {}],
    21: [[service], () => {}],
    25: [shopItem, () => {}],
  },
  'items+agent-dialog': {
    1: ['items', () => {}],
    6: [[linked], () => {}],
    10: [[{ name: 's1', description: '技能一' }], () => {}],
    11: [[{ id: 'customer-service', name: '客服 Agent' }], () => {}],
    13: [[shopItem], () => {}],
    30: [{ item: shopItem, current: linked, agentPreset: 'builtin' }, () => {}],
  },
  'order-detail': { 1: ['orders', () => {}], 28: ['5127944941190007915', () => {}] },
  'item-detail': { 1: ['items', () => {}], 29: [shopItem, () => {}] },
  deliveries: { 1: ['deliveries', () => {}] },
  login: { 1: ['chat', () => {}], 35: [true, () => {}], 36: [{ state: 'waiting', qr: '' }, () => {}] },
  // 网盘页：CLI 就绪但还没授权
  netdisk: {
    1: ['netdisk', () => {}],
    2: [{ config: { pollSeconds: 60 }, ai: true, cards: 0, watchEnabled: false }, () => {}],
    13: [[shopItem], () => {}],
  },
  // 通知页：dsh-im 在，但机器人还没有投递目标
  notify: {
    1: ['notify', () => {}],
    2: [{ config: { pollSeconds: 60 }, ai: true, cards: 0, watchEnabled: false }, () => {}],
  },
  // 待人工页：一条生成失败
  pending: {
    1: ['pending', () => {}],
    23: [[{
      id: 1, created_at: '2026-11-27 03:26:15', kind: 'generate_failed', order_no: 'O1',
      buyer_nick: '买家', detail: 'generate_failed:path_not_found:weflow.zip',
    }], () => {}],
  },
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
