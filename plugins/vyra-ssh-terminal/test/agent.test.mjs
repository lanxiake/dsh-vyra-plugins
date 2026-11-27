/**
 * AI 引擎的四条承重不变量。
 *
 * 这些不是"顺手测一下"，每一条都对应一个会让面板变成危险东西的失效模式：
 * 少一条工具结果 → 下一轮 400；截断的回合照样执行 → 命令行含义变了；模型能定级 →
 * 审批卡形同虚设；输出不截断 → 上下文被一条 du 撑爆。
 *
 * 这里用一份假的 llm 与假的 deps，不需要 SSH，也不会真的跑任何命令。
 */
import assert from 'node:assert/strict'
import { runTurn, parseArgs, commandOf, TOOL_DEFS } from '../agent.js'

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

/** 一份按脚本回放的假 llm：每次 stream() 取下一个回合。 */
function fakeLlm(turns) {
  let i = 0
  return {
    seen: [],
    stream(req) {
      this.seen.push(req)
      const turn = turns[Math.min(i++, turns.length - 1)]
      return (async function* () {
        for (const chunk of turn) yield chunk
      })()
    },
  }
}

const text = (t) => [{ type: 'text-delta', index: 0, text: t }, { type: 'finish', reason: { kind: 'stop' } }]
const call = (id, name, args) => [
  { type: 'block-start', index: 0, blockType: 'tool-call' },
  { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: JSON.stringify(args) },
  { type: 'finish', reason: { kind: 'tool-calls' } },
]

function deps(over = {}) {
  const ran = []
  return {
    ran,
    ask: async () => true,
    spill: async (t) => `out-${t.length}`,
    execute: async (name, args) => {
      ran.push({ name, args })
      return `ran ${name}`
    },
    ...over,
  }
}

const model = { provider: 'p', model: 'm' }

await test('没有工具调用的回合直接给出文字并结束', async () => {
  const llm = fakeLlm([text('你好')])
  const d = deps()
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], deps: d })
  assert.equal(out.finish, 'stop')
  assert.equal(out.text, '你好')
  assert.equal(d.ran.length, 0)
  // 请求里带上了系统提示与工具表
  assert.match(llm.seen[0].system, /运维助手/)
  assert.equal(llm.seen[0].tools.length, TOOL_DEFS.length)
})

await test('每个 tool_call 都有对应的 tool 结果（少一条下一轮就会被网关判非法）', async () => {
  const llm = fakeLlm([
    [
      { type: 'tool-call-delta', index: 0, id: 'c1', name: 'ls', argumentsDelta: '{"path":"/tmp"}' },
      { type: 'tool-call-delta', index: 1, id: 'c2', name: 'exec', argumentsDelta: '{"command":"df -h"}' },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ],
    text('看完了'),
  ])
  const d = deps()
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d })
  const asks = out.messages.filter((m) => m.role === 'assistant').flatMap((m) => m.content.filter((b) => b.type === 'tool-call'))
  const tools = out.messages.filter((m) => m.role === 'tool')
  assert.equal(asks.length, 2)
  assert.equal(tools.length, 2)
  assert.deepEqual(tools.map((t) => t.toolCallId), ['c1', 'c2'])
  // 第二轮的请求里，这两条 tool 结果按宿主的 ToolResultMessage 契约发出去：
  // 既要 `toolCallId`，也要 `source:{kind:'tool',callId}`。少任何一个，
  // 宿主要么对不上调用、要么在读 source 时崩掉。
  const wire = llm.seen[1].messages.filter((m) => m.role === 'tool')
  assert.deepEqual(wire.map((m) => m.toolCallId), ['c1', 'c2'])
  assert.deepEqual(wire.map((m) => m.source?.callId), ['c1', 'c2'], 'tool 消息的 source.callId 必须与 toolCallId 一致')
  assert.ok(wire.every((m) => m.source?.kind === 'tool'), 'tool 消息的 source.kind 必须是 tool')
})

await test('被拒绝的工具调用也必须有结果，且要明确告诉模型别再试', async () => {
  const llm = fakeLlm([call('c1', 'exec', { command: 'rm -rf /data' }), text('好的')])
  const d = deps({ ask: async () => false })
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d })
  const tool = out.messages.find((m) => m.role === 'tool')
  assert.ok(tool, '被拒绝也要有结果')
  assert.equal(tool.isError, true)
  assert.match(tool.content[0].text, /用户拒绝了/)
  assert.equal(d.ran.length, 0, '被拒绝的绝不能真的执行')
})

await test('截断的回合里，工具调用一条都不执行', async () => {
  const llm = fakeLlm([
    [
      { type: 'tool-call-delta', index: 0, id: 'c1', name: 'exec', argumentsDelta: '{"command":"rm -rf /tmp/x"}' },
      { type: 'finish', reason: { kind: 'max-tokens' } },
    ],
    text('好'),
  ])
  const d = deps()
  const events = []
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d, onEvent: (e) => events.push(e) })
  assert.equal(d.ran.length, 0, '截断回合里的命令不能执行')
  const tool = out.messages.find((m) => m.role === 'tool')
  assert.match(tool.content[0].text, /未执行/)
  assert.ok(events.some((e) => e.type === 'warning' && /截断/.test(e.text)))
})

await test('只读命令不问人，破坏性命令就问一次', async () => {
  const asked = []
  const d = deps({
    ask: async (req) => {
      asked.push(req.command)
      return true
    },
  })
  const llm = fakeLlm([call('c1', 'exec', { command: 'df -h' }), call('c2', 'exec', { command: 'mv /etc/hosts /etc/hosts.bak' }), text('ok')])
  await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d })
  assert.deepEqual(asked, ['mv /etc/hosts /etc/hosts.bak'], '只读的不打扰，破坏性的必须问')
})

await test('严格模式连只读也问', async () => {
  const asked = []
  const d = deps({ ask: async (r) => (asked.push(r.command), true) })
  const llm = fakeLlm([call('c1', 'exec', { command: 'df -h' }), text('ok')])
  await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d, mode: 'strict' })
  assert.deepEqual(asked, ['df -h'])
})

await test('参数不是合法 JSON：不执行，但要有结果', async () => {
  const llm = fakeLlm([
    [
      { type: 'tool-call-delta', index: 0, id: 'c1', name: 'exec', argumentsDelta: '{"command": "df -h"' },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ],
    text('好的'),
  ])
  const d = deps()
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d })
  assert.equal(d.ran.length, 0)
  assert.match(out.messages.find((m) => m.role === 'tool').content[0].text, /参数错误/)
})

await test('不存在的工具名：回报可用清单而不是崩', async () => {
  const llm = fakeLlm([call('c1', 'reboot_server', {}), text('ok')])
  const d = deps()
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d })
  assert.equal(d.ran.length, 0)
  assert.match(out.messages.find((m) => m.role === 'tool').content[0].text, /没有这个工具.*ls/s)
})

await test('超长输出先落盘，只给头尾和 handle', async () => {
  const huge = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n')
  const spilled = []
  const d = deps({
    spill: async (t) => (spilled.push(t.length), 'out-abc'),
    execute: async () => huge,
  })
  const llm = fakeLlm([call('c1', 'exec', { command: 'du -a /' }), text('ok')])
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: d })
  const body = out.messages.find((m) => m.role === 'tool').content[0].text
  assert.equal(spilled.length, 1, '超长的确实落盘了')
  assert.ok(body.length < huge.length / 3, '交还给模型的部分要小得多')
  assert.match(body, /read_output/)
  assert.match(body, /line 0/, '头在')
  assert.match(body, /line 4999/, '尾在')
})

await test('模型返回错误：这一轮结束并报出原因，不吞掉', async () => {
  const llm = fakeLlm([[{ type: 'finish', reason: { kind: 'error', failure: { message: '配额不足', code: 'QUOTA' } } }]])
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: deps() })
  assert.equal(out.finish, 'error')
  assert.equal(out.error, '配额不足')
})

await test('步数上限兜底，不会无限打转', async () => {
  let n = 0
  const llm = {
    stream() {
      const id = `c${++n}`
      return (async function* () {
        yield { type: 'tool-call-delta', index: 0, id, name: 'ls', argumentsDelta: '{"path":"."}' }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      })()
    },
  }
  const out = await runTurn({ llm, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], deps: deps(), maxSteps: 3 })
  assert.equal(out.finish, 'max-steps')
  assert.equal(out.messages.filter((m) => m.role === 'tool').length, 3)
})

await test('parseArgs / commandOf 的边界', () => {
  assert.deepEqual(parseArgs(''), { ok: true, value: {} })
  assert.equal(parseArgs('[]').ok, false)
  assert.equal(parseArgs('{bad').ok, false)
  assert.equal(commandOf('exec', { command: 'ls' }), 'ls')
  assert.equal(commandOf('rm', { path: '/tmp/a' }), '/tmp/a')
  assert.equal(commandOf('upload', { local: 'C:/a', remote: '/b' }), 'C:/a → /b')
  assert.equal(commandOf('monitor', {}), '')
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
