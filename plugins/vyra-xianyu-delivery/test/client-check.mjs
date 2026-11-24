// 客户端冒烟测试：不启动 DSH，只验证模块注册结构、slot 挂载、RPC 路径。
// 跑法：node plugins/vyra-xianyu-delivery/test/client-check.mjs
import assert from 'node:assert/strict'

const loaded = []
globalThis.window = {
  __ModuleLoader__: {
    load(def) {
      loaded.push(def)
    },
  },
}

await import('../client.js')

assert.equal(loaded.length, 1, 'client.js 应注册一个模块')
const def = loaded[0]
assert.equal(def.id, 'dsh-vyra-xianyu-delivery')

// 最小 React 替身：只检查 factory 能返回插件对象。
const reactStub = {
  createElement: () => ({}),
  useState: (v) => [v, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}
const mod = def.factory((name) => {
  if (name === 'react') return reactStub
  throw new Error(`unexpected require: ${name}`)
})

assert.deepEqual(mod.inject, ['slots'], '需要 slots 服务')

const registrations = []
const ctx = {
  slots: {
    inject(name, cb) {
      cb()
    },
    register(config, component) {
      registrations.push({ config, component })
      return { dispose() {} }
    },
  },
}
mod.apply(ctx)

assert.equal(registrations.length, 2, '应注册侧边栏入口 + 主页面')
assert.equal(registrations[0].config.name, 'sidebar.panellist')
assert.equal(registrations[1].config.name, 'main')
assert.equal(registrations[1].config.key, 'xianyu-delivery')
assert.equal(typeof registrations[0].component, 'function')
assert.equal(typeof registrations[1].component, 'function')

console.log('client-check ok')