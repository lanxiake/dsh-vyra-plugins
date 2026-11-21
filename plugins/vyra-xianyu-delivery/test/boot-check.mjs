// 用假 ctx 把插件真正 apply 起来，再走一遍 RPC。
//
// 不能覆盖 DSH 的全部行为，但能抓住「模块导入错、变量拼错、服务接线错」
// 这类只有加载时才炸的问题，比只做语法检查强。
import { apply } from '../index.js'

const calls = []
const cleanups = []
let rpcHandler = null

const ctx = {
  logger: {
    info: (msg) => calls.push(['log', msg]),
    warn: () => {},
    error: () => {},
  },
  effect(fn, label) {
    const dispose = fn()
    if (typeof dispose === 'function') cleanups.push([label, dispose])
    return () => {}
  },
  inject(names, callback) {
    if (names.includes('webServer')) {
      callback({
        effect: (fn) => { const d = fn(); if (typeof d === 'function') cleanups.push(['webServer', d]) },
        webServer: {
          register(route) {
            rpcHandler = route.handler
            return () => {}
          },
        },
      })
    }
  },
  tools: { register: () => () => {} },
  get(name) {
    if (name === 'agents') {
      return {
        create: async () => { throw new Error('boot-check 不创建真实 agent') },
        resume: async () => { throw new Error('boot-check 不创建真实 agent') },
      }
    }
    if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'stub', model: 'stub-model' }) }
    if (name === 'workspaceRegistry') return { create: async () => ({ path: '/tmp', attachSession: async () => {} }) }
    if (name === 'sessionController') return { rename: async () => true }
    if (name === 'sessionTitle') return { rename: () => ({}) }
    return undefined
  },
}

// 用临时数据库，别碰真实数据。
const dataFile = process.env.BOOT_DATA || 'C:/Users/75791/AppData/Local/Temp/xy-boot.sqlite'
apply(ctx, { dataFile, chatPollSeconds: 999, pollSeconds: 999, watchEnabled: false })

if (!rpcHandler) throw new Error('RPC 路由没有注册')

async function rpc(body) {
  let statusCode = 0
  let payload = ''
  const req = {
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify(body))
    },
  }
  const res = {
    writeHead(code) { statusCode = code },
    end(text) { payload = text },
  }
  await rpcHandler(req, res)
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`)
  return JSON.parse(payload)
}

for (const op of ['status', 'cards', 'settings', 'events', 'services', 'itemLinks']) {
  const out = await rpc({ op })
  if (!out.ok) throw new Error(`${op} failed: ${out.error}`)
  console.log(`ok ${op}`)
}

const status = await rpc({ op: 'status' })
if (typeof status.data.watch !== 'boolean') throw new Error('status.watch 缺失')

console.log('boot-check ok')
for (const [label, dispose] of cleanups) {
  try { dispose() } catch { /* ignore */ }
}
process.exit(0)
