/**
 * AI 会话层：模型选择、审批往返、停止、历史落盘。
 *
 * 引擎的四条不变量在 agent.test.mjs 里单独测过；这里测的是**接线**——模型从 DSH
 * 里取的顺序对不对、审批能不能来回、停止会不会真停、历史存得下来。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AiSession, pickModel, listModels, readHistory, createSpill, createReadOutput } from '../ai.js'

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

const dir = mkdtempSync(join(tmpdir(), 'ssh-ai-'))
process.env.DSH_PROFILE_DIR = dir

await test('模型优先用 DSH 的默认选择', async () => {
  const picked = await pickModel({}, { provider: 'deepseek', model: 'deepseek-chat' })
  assert.deepEqual(picked, { provider: 'deepseek', model: 'deepseek-chat' })
})

await test('没有默认选择时，退到第一个可用提供商', async () => {
  const llm = {
    listProviders: () => [{ id: 'a' }, { id: 'b', name: 'B' }],
    listModels: async (id) => {
      if (id === 'a') throw new Error('这个适配器坏了')
      return [{ id: 'm1', name: 'M1' }]
    },
  }
  assert.deepEqual(await pickModel(llm), { provider: 'b', model: 'm1' })
  // 一个坏适配器不能把面板判死
})

await test('面板里手动指定优先于一切', async () => {
  const picked = await pickModel({}, { provider: 'deepseek', model: 'x' }, { provider: 'custom', model: 'y' })
  assert.deepEqual(picked, { provider: 'custom', model: 'y' })
})

await test('模型下拉列出所有提供商的模型 + 当前选择', async () => {
  const llm = {
    listProviders: () => [{ id: 'p', name: 'P' }],
    listModels: async () => [{ id: 'm', name: 'M' }],
  }
  assert.deepEqual(await listModels(llm, { provider: 'p', model: 'm' }), {
    groups: [{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M' }] }],
    current: { provider: 'p', model: 'm' },
  })
})

/** 一份只说一句就停的假 llm。 */
const quietLlm = (text) => ({
  stream: () =>
    (async function* () {
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })(),
})

await test('整条会话：发消息 → 收到文字 → done 事件', async () => {
  const events = []
  const s = new AiSession({
    id: 's1',
    connectionId: 'c1',
    llm: quietLlm('你好'),
    model: { provider: 'p', model: 'm' },
    tools: {},
    emit: (e) => events.push(e),
    spill: async () => 'h',
  })
  const out = await s.send('hi')
  assert.equal(out.finish, 'stop')
  assert.equal(out.text, '你好')
  const done = events.find((e) => e.type === 'done')
  assert.ok(done, '必须发 done 事件')
  assert.equal(done.finish, 'stop')
  assert.ok(done.context.approxTokens > 0)
})

await test('需要确认的一步会停下来等界面回执', async () => {
  const events = []
  const ran = []
  const s = new AiSession({
    id: 's2',
    connectionId: 'c1',
    llm: {
      stream: () =>
        (async function* () {
          yield { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"rm -rf /data"}' }
          yield { type: 'finish', reason: { kind: 'tool-calls' } }
        })(),
    },
    model: { provider: 'p', model: 'm' },
    tools: {
      exec: async () => {
        ran.push('exec')
        return 'ok'
      },
    },
    emit: (e) => events.push(e),
    spill: async () => 'h',
  })

  // 假模型：第一轮请求执行一条破坏性命令，用户批准之后**就收尾**。
  // （如果每轮都吐同一条工具调用，引擎会忠实地重试——只在 maxSteps 才停，那是对的。）
  let turn = 0
  s.llm = {
    stream: () =>
      (async function* () {
        if (turn++ === 0) {
          yield { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"rm -rf /data"}' }
          yield { type: 'finish', reason: { kind: 'tool-calls' } }
          return
        }
        yield { type: 'text-delta', index: 0, text: '好了' }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })(),
  }

  const running = s.send('删掉 /data')
  // 等审批事件冒出来
  await new Promise((r) => setTimeout(r, 20))
  const approval = events.find((e) => e.type === 'approval')
  assert.ok(approval, '破坏性命令必须弹审批')
  // `rm -rf /data` 命中「递归删根」那条高危模式，定为 critical；别的递归删除是
  // destructive。两者都要停，这里只断言"确实停下来了、级别对得上"。
  assert.ok(['critical', 'destructive'].includes(approval.risk), `unexpected risk ${approval.risk}`)
  assert.equal(ran.length, 0, '没批准之前不能执行')

  s.approve(approval.id, true)
  await running
  assert.deepEqual(ran, ['exec'])
  s.dispose()
})

await test('拒绝之后不执行，并把拒绝结果交还给模型', async () => {
  const events = []
  const ran = []
  const s = new AiSession({
    id: 's3',
    connectionId: 'c1',
    llm: {
      stream: () =>
        (async function* () {
          yield { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"mv /etc/hosts /etc/hosts.bak"}' }
          yield { type: 'finish', reason: { kind: 'tool-calls' } }
        })(),
    },
    model: { provider: 'p', model: 'm' },
    tools: { exec: async () => (ran.push(1), 'ok') },
    emit: (e) => events.push(e),
    spill: async () => 'h',
  })
  // 同样的道理：第一轮请求一次改名，用户拒绝之后模型收尾，不再反复请求。
  let turn = 0
  s.llm = {
    stream: () =>
      (async function* () {
        if (turn++ === 0) {
          yield { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"mv /etc/hosts /etc/hosts.bak"}' }
          yield { type: 'finish', reason: { kind: 'tool-calls' } }
          return
        }
        yield { type: 'text-delta', index: 0, text: '那我先不动' }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })(),
  }
  const running = s.send('改个名')
  await new Promise((r) => setTimeout(r, 20))
  const approval = events.find((e) => e.type === 'approval')
  assert.ok(approval, '破坏性命令必须弹审批')
  s.approve(approval.id, false)
  await running
  assert.deepEqual(ran, [], '拒绝了就不能执行')
  s.dispose()
})

await test('停止会中断正在跑的回合', async () => {
  let aborted = false
  const s = new AiSession({
    id: 's4',
    connectionId: 'c1',
    llm: {
      stream: (req) =>
        (async function* () {
          for (let i = 0; i < 50; i++) {
            if (req.signal?.aborted) {
              aborted = true
              yield { type: 'finish', reason: { kind: 'aborted', failure: { message: 'aborted', code: 'ABORTED' } } }
              return
            }
            await new Promise((r) => setTimeout(r, 5))
            yield { type: 'text-delta', index: 0, text: '.' }
          }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })(),
    },
    model: { provider: 'p', model: 'm' },
    tools: {},
    emit: () => {},
    spill: async () => 'h',
  })
  const running = s.send('长任务')
  await new Promise((r) => setTimeout(r, 20))
  s.stop()
  const out = await running
  assert.equal(out.finish, 'aborted')
  assert.ok(aborted)
})

await test('停止会立刻收掉挂着的审批，而不是干等 60 秒超时', async () => {
  const events = []
  const ran = []
  const s = new AiSession({
    id: 's5',
    connectionId: 'c1',
    llm: {
      stream: () =>
        (async function* () {
          yield { type: 'tool-call-delta', index: 0, id: 't1', name: 'exec', argumentsDelta: '{"command":"rm -rf /data"}' }
          yield { type: 'finish', reason: { kind: 'tool-calls' } }
        })(),
    },
    model: { provider: 'p', model: 'm' },
    tools: { exec: async () => (ran.push(1), 'ok') },
    emit: (e) => events.push(e),
    spill: async () => 'h',
  })

  const running = s.send('删掉 /data')
  await new Promise((r) => setTimeout(r, 20))
  assert.ok(events.find((e) => e.type === 'approval'), '破坏性命令要弹审批')

  // 用户不想等，直接按停止。回合必须马上收尾——审批超时是 60 秒，
  // 靠它收尾等于界面僵住一分钟（这正是之前的 bug）。
  const started = Date.now()
  s.stop()
  const out = await Promise.race([
    running,
    new Promise((r) => setTimeout(() => r({ finish: 'TIMEOUT' }), 2000)),
  ])
  const ms = Date.now() - started
  assert.notEqual(out.finish, 'TIMEOUT', `停止之后回合没有收尾（${ms}ms）`)
  assert.ok(ms < 1000, `收尾用了 ${ms}ms，应该几乎是立刻的`)
  assert.deepEqual(ran, [], '停止之后那一步不能被执行')
  assert.ok(events.find((e) => e.type === 'approval-aborted'), '要发一个「审批已作废」事件给界面')
  s.dispose()
})

await test('历史按连接落盘，标题取第一句话', async () => {
  const s = new AiSession({
    id: 'h1',
    connectionId: 'web-01',
    llm: quietLlm('好'),
    model: { provider: 'p', model: 'm' },
    tools: {},
    emit: () => {},
    spill: async () => 'h',
  })
  await s.send('帮我看一下磁盘用得怎么样')
  s.save()
  const all = readHistory()
  assert.equal(all['web-01'].length, 1)
  assert.match(all['web-01'][0].title, /帮我看一下磁盘/)
  // 再存一次同一会话：替换而不是追加
  s.save()
  assert.equal(readHistory()['web-01'].length, 1)
})

await test('超长输出落盘，能按 handle 读回来', async () => {
  const spill = createSpill()
  const read = createReadOutput()
  const handle = await spill('abcdefghij')
  assert.equal(await read(handle, 0, 4), 'abcd\n…（还有 6 字节，用 offset=4 继续读）')
  assert.equal(await read(handle, 0, 100), 'abcdefghij')
  await assert.rejects(() => read('../etc/passwd', 0, 10), /不合法/)
})

rmSync(dir, { recursive: true, force: true })
console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exit(process.exitCode ?? 0)
