/**
 * 宿主 `llm.stream()` 契约测试。
 *
 * 这个文件的来历：线上报 `Cannot read properties of undefined (reading 'replayState')`，
 * 因为我把 assistant 消息只写成 `{role, content}`，而宿主约定了
 * `source: {kind:'model', provider, model, replayState?}`。第一轮没有历史消息，所以
 * 单测全绿；一旦把上一轮的 assistant / tool 消息带回去，宿主一读 `source.replayState`
 * 就崩。
 *
 * 所以这里不再用"能跑通"当标准，而是**按 Service 契约逐字段断言**发出去的每条消息。
 */
import assert from 'node:assert/strict'
import { runTurn } from '../agent.js'

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

/** 收下所有请求的假 llm：把每次的 options 记下来，按脚本吐块。 */
function recordingLlm(script) {
  const seen = []
  let turn = 0
  return {
    seen,
    stream(options) {
      seen.push(options)
      const chunks = script(turn++)
      return (async function* () {
        for (const c of chunks) yield c
      })()
    },
  }
}

const MODEL = { provider: 'deepseek', model: 'deepseek-v4' }
const deps = {
  execute: async () => '目录内容',
  ask: async () => true,
  spill: async () => 'h',
}

await test('第一轮：user 消息必须带 id', async () => {
  const llm = recordingLlm(() => [
    { type: 'text-delta', index: 0, text: '好' },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
  await runTurn({
    llm, model: MODEL, messages: [{ id: 'm0', role: 'user', content: [{ type: 'text', text: '你好' }] }],
    deps, mode: 'loose', onEvent: () => {}, uid: () => 'x',
  })
  const sent = llm.seen[0].messages[0]
  assert.equal(sent.role, 'user')
  assert.ok(sent.id, 'user 消息必须有 id')
})

await test('带工具的回合：assistant 消息必须带 source.kind=model 与 provider/model', async () => {
  const llm = recordingLlm((turn) => {
    if (turn === 0) {
      return [
        { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"ls"}' },
        { type: 'finish', reason: { kind: 'tool-calls' } },
      ]
    }
    return [{ type: 'text-delta', index: 0, text: '完了' }, { type: 'finish', reason: { kind: 'stop' } }]
  })
  const out = await runTurn({
    llm, model: MODEL, messages: [{ id: 'm0', role: 'user', content: [{ type: 'text', text: '看一眼' }] }],
    deps, mode: 'loose', onEvent: () => {}, uid: () => Math.random().toString(36).slice(2),
  })
  assert.equal(out.finish, 'stop')
  assert.equal(llm.seen.length, 2, '应该跑了两轮')

  // 第二轮里必须能看到上一轮的 assistant 消息，且形状对
  const second = llm.seen[1].messages
  const assistant = second.find((m) => m.role === 'assistant')
  assert.ok(assistant, '第二轮必须把 assistant 消息带回去')
  assert.ok(assistant.source, 'assistant 必须有 source —— 少了它宿主读 replayState 就崩')
  assert.equal(assistant.source.kind, 'model')
  assert.equal(assistant.source.provider, 'deepseek')
  assert.equal(assistant.source.model, 'deepseek-v4')
  assert.ok(assistant.id, 'assistant 消息必须有 id')
})

await test('带工具的回合：tool 消息必须同时有 toolCallId 与 source.callId', async () => {
  const llm = recordingLlm((turn) => {
    if (turn === 0) {
      return [
        { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"ls"}' },
        { type: 'finish', reason: { kind: 'tool-calls' } },
      ]
    }
    return [{ type: 'text-delta', index: 0, text: '完了' }, { type: 'finish', reason: { kind: 'stop' } }]
  })
  await runTurn({
    llm, model: MODEL, messages: [{ id: 'm0', role: 'user', content: [{ type: 'text', text: '看一眼' }] }],
    deps, mode: 'loose', onEvent: () => {}, uid: () => Math.random().toString(36).slice(2),
  })
  const toolMsg = llm.seen[1].messages.find((m) => m.role === 'tool')
  assert.ok(toolMsg, '第二轮必须带上工具结果')
  assert.equal(toolMsg.toolCallId, 't1')
  assert.ok(toolMsg.source, 'tool 消息必须有 source')
  assert.equal(toolMsg.source.kind, 'tool')
  assert.equal(toolMsg.source.callId, 't1')
  assert.ok(toolMsg.id, 'tool 消息必须有 id')
})

await test('replayState 从 finish 块带回，并在下一轮原样回传', async () => {
  const REPLAY = { response: { id: 'resp-1' }, blocks: [] }
  const llm = recordingLlm((turn) => {
    if (turn === 0) {
      return [
        { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"ls"}' },
        { type: 'finish', reason: { kind: 'tool-calls' }, replayState: REPLAY },
      ]
    }
    return [{ type: 'text-delta', index: 0, text: '完了' }, { type: 'finish', reason: { kind: 'stop' } }]
  })
  const out = await runTurn({
    llm, model: MODEL, messages: [{ id: 'm0', role: 'user', content: [{ type: 'text', text: '看一眼' }] }],
    deps, mode: 'loose', onEvent: () => {}, uid: () => Math.random().toString(36).slice(2),
  })
  const assistant = llm.seen[1].messages.find((m) => m.role === 'assistant')
  assert.deepEqual(assistant.source.replayState, REPLAY, 'replayState 必须原样回传（宿主靠它续会话）')

  // 回合结束时也要留在消息里，供下一轮用户发消息时继续带
  const finalAssistant = out.messages.filter((m) => m.role === 'assistant').at(-1)
  assert.ok(finalAssistant, '要有 assistant 消息')
})

await test('每条发给宿主的消息都有 id（会话要靠它挂结果）', async () => {
  const llm = recordingLlm((turn) => {
    if (turn === 0) {
      return [
        { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"ls"}' },
        { type: 'finish', reason: { kind: 'tool-calls' } },
      ]
    }
    return [{ type: 'text-delta', index: 0, text: '完了' }, { type: 'finish', reason: { kind: 'stop' } }]
  })
  await runTurn({
    llm, model: MODEL, messages: [{ id: 'm0', role: 'user', content: [{ type: 'text', text: '看一眼' }] }],
    deps, mode: 'loose', onEvent: () => {}, uid: () => Math.random().toString(36).slice(2),
  })
  for (const m of llm.seen[1].messages) {
    assert.ok(m.id, `${m.role} 消息缺少 id`)
    assert.ok(m.role, '消息必须有 role')
  }
})

await test('tools 按 ToolSchema 形状发：name / description / parameters', async () => {
  const llm = recordingLlm(() => [{ type: 'finish', reason: { kind: 'stop' } }])
  await runTurn({
    llm, model: MODEL, messages: [{ id: 'm0', role: 'user', content: [{ type: 'text', text: 'x' }] }],
    deps, mode: 'loose', onEvent: () => {}, uid: () => 'u',
  })
  assert.ok(Array.isArray(llm.seen[0].tools), 'tools 必须是数组')
  for (const t of llm.seen[0].tools) {
    assert.equal(typeof t.name, 'string')
    assert.equal(typeof t.description, 'string')
    assert.equal(typeof t.parameters, 'object')
    assert.ok(t.parameters && t.parameters.type === 'object', `${t.name} 的 parameters 应该是 JSON Schema`)
  }
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)