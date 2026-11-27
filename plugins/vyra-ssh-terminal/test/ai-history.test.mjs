/**
 * AI 对话历史的测试。
 *
 * 这个文件补的是一个大洞：`save()` 早就写好了，但**从来没有被调用过**，
 * 所以历史永远是空的，而当时所有测试都绿——因为没人断言"聊完之后磁盘上有东西"。
 *
 * 所以这里的重点不是"方法能跑"，而是这几条不变量：
 *  1. 一轮对话结束后，磁盘上真的多了这一条；
 *  2. 同一段对话继续聊，是同一条记录在更新，而不是每轮新建一条；
 *  3. 新建对话会换 conversationId，旧的那条留在列表里；
 *  4. 恢复历史要把 messages 装回去，且**不共享引用**（改了恢复出来的不该污染磁盘）。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ai.js 用 DSH_PROFILE_DIR 定位数据目录；指到临时目录，别碰真实配置。
const dir = mkdtempSync(join(tmpdir(), 'ssh-ai-hist-'))
process.env.DSH_PROFILE_DIR = dir

const { AiSession, readHistory, writeAiHistory } = await import('../ai.js')

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

const quietLlm = () => ({
  stream: () =>
    (async function* () {
      yield { type: 'text-delta', index: 0, text: '好的' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })(),
})

const make = (over = {}) =>
  new AiSession({
    id: 'conn1',
    connectionId: 'conn1',
    llm: quietLlm(),
    model: { provider: 'p', model: 'm' },
    tools: {},
    emit: () => {},
    spill: async () => 'h',
    ...over,
  })

const historyOf = (connId) => readHistory()[connId] ?? []

await test('跑完一轮，磁盘上应该有这条对话', async () => {
  const s = make()
  assert.equal(historyOf('conn1').length, 0, '开始前是空的')
  await s.send('你好')
  const list = historyOf('conn1')
  assert.equal(list.length, 1, '跑完必须有 1 条历史')
  assert.equal(list[0].title, '你好', '标题取第一句话')
  assert.ok(list[0].messages.length >= 2, '要存下完整的 user + assistant 消息')
  assert.equal(list[0].model?.model, 'm', '要记住当时用的模型')
})

await test('恢复后继续聊，是更新同一条而不是每轮新建', async () => {
  const before = historyOf('conn1')
  assert.equal(before.length, 1)
  const s = make()
  s.restore(before[0])
  const restoredLen = s.messages.length
  await s.send('再来一句')
  const after = historyOf('conn1')
  assert.equal(after.length, 1, '同一段对话不该变成两条')
  assert.ok(
    after[0].messages.length > restoredLen,
    `消息应该累加（恢复时 ${restoredLen} 条，保存后 ${after[0].messages.length} 条）`
  )
})

await test('新建对话：换 conversationId，旧的那条还在', async () => {
  const s = make()
  await s.send('第一件事')
  const firstId = s.conversationId
  const start = historyOf('conn1').length

  s.newConversation()
  assert.notEqual(s.conversationId, firstId, '必须换 id')
  assert.equal(s.messages.length, 0, '新对话的上下文必须清空，否则会带着旧对话发出去')

  await s.send('第二件事')
  const list = historyOf('conn1')
  assert.equal(list.length, start + 1, '新旧两条都要在')
  assert.ok(list.some((x) => x.id === firstId), '旧的那条不能被覆盖')
})

await test('恢复历史：messages 装回来，且不与磁盘共享引用', async () => {
  const list = historyOf('conn1')
  const target = list[0]
  const s = make()
  const n = s.restore(target)
  assert.ok(n > 0, '恢复后应该有消息')
  assert.equal(s.conversationId, target.id, '要接上同一条对话')
  assert.equal(s.messages.length, target.messages.length)

  // 改恢复出来的那条，磁盘上的不能跟着变
  s.messages[0].content[0].text = '被改过了'
  const reread = historyOf('conn1').find((x) => x.id === target.id)
  assert.notEqual(reread.messages[0].content[0].text, '被改过了', '恢复必须是深拷贝，否则会污染历史')
})

await test('恢复不存在的历史不会炸，只是空上下文', async () => {
  const s = make()
  const n = s.restore({ id: 'nope', messages: [] })
  assert.equal(n, 0)
})

await test('出错的那一轮也要存下来（用户要回看卡在哪）', async () => {
  const s = make({
    llm: {
      stream: () =>
        (async function* () {
          yield { type: 'finish', reason: { kind: 'error', failure: { message: '网关炸了' } } }
        })(),
    },
  })
  const before = historyOf('conn1').length
  await s.send('会失败的一句')
  const after = historyOf('conn1')
  assert.equal(after.length, before + 1, '失败的那轮也要落盘')
})

await test('历史文件真的落在磁盘上', async () => {
  const file = join(dir, 'ssh-terminal', 'agent-history.json')
  assert.ok(existsSync(file), 'agent-history.json 应该被创建')
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  assert.ok(parsed.conn1, '按连接分组')
})

await test('writeAiHistory 能把删掉一条后的结果写回去', async () => {
  const all = readHistory()
  const list = all.conn1 ?? []
  const removed = list[0].id
  all.conn1 = list.filter((x) => x.id !== removed)
  writeAiHistory(all)
  const after = historyOf('conn1')
  assert.ok(!after.some((x) => x.id === removed), '删掉的那条不该还在')
})

rmSync(dir, { recursive: true, force: true })
console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)