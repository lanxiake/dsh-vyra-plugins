/**
 * 插件能不能加载：用假的 ctx 真的调一次 `apply()`。
 *
 * 这不是单元测试——它守的是**装配**：`index.js` 的 import 图、工具注册、路由注册、
 * 以及 `terminals`/`routes` 之间的接线。任何一处名字写错都会在这里直接炸，而不是等到
 * 用户在面板里点了一下才发现「后端没加载」。
 *
 * （真正在 DSH 里跑起来还另有一段路：装进 profile、重启客户端、看界面。这一步只能人工验。）
 */
import assert from 'node:assert/strict'

const results = []
const test = async (name, fn) => {
  try {
    await fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    results.push(`✗ ${name}\n  ${e instanceof Error ? e.stack : e}`)
    process.exitCode = 1
  }
}

/** 记录注册了什么的假 ctx。 */
function fakeCtx() {
  const seen = { tools: [], routes: [], events: [], disposed: 0 }
  const ctx = {
    credentials: {
      readRecord: async () => null,
      modifyRecord: async () => {},
      deleteRecord: async () => {},
    },
    tools: { register: (def) => (seen.tools.push(def.name), () => {}) },
    on: (event) => (seen.events.push(event), () => {}),
    effect: (fn) => {
      const dispose = fn()
      return () => {
        seen.disposed++
        dispose?.()
      }
    },
    inject: (names, fn) =>
      fn({
        effect: (f) => {
          f()
        },
        webServer: {
          register: (route) => (seen.routes.push(route.path), () => {}),
        },
      }),
  }
  return { ctx, seen }
}

const mod = await import('../index.js')

await test('apply() 不抛，并且注册了命令工具与审批钩子', async () => {
  const { ctx, seen } = fakeCtx()
  mod.apply(ctx)
  assert.ok(seen.tools.includes('ssh_exec'), '宿主的 ssh_exec 工具必须在')
  assert.ok(seen.tools.includes('ssh_list_connections'))
  assert.ok(seen.events.includes('tools/pre-execute'), '审批钩子必须在')
})

await test('每条界面路由都被注册了，且路径都以 /api/ssh-terminal/ 开头', async () => {
  const { ctx, seen } = fakeCtx()
  mod.apply(ctx)
  assert.ok(seen.routes.length >= 30, `路由太少：${seen.routes.length}`)
  for (const path of seen.routes) {
    assert.ok(path.startsWith('/api/ssh-terminal/'), path)
  }
  // 这次改动新增的两条必须在内
  assert.ok(seen.routes.includes('/api/ssh-terminal/export/preview'))
  assert.ok(seen.routes.includes('/api/ssh-terminal/terminal/run'))
})

await test('重复 apply 不会互相干扰（每个 ctx 各拿一份）', async () => {
  const a = fakeCtx()
  const b = fakeCtx()
  mod.apply(a.ctx)
  mod.apply(b.ctx)
  assert.equal(a.seen.routes.length, b.seen.routes.length)
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exit(process.exitCode ?? 0)
