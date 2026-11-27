/**
 * AI 助手的引擎：把一次对话跑成若干步工具调用，中间该停的停下来问人。
 *
 * 这里刻意不依赖 ssh2、也不依赖宿主包：所有环境能力都由调用方注入（`deps`），
 * 所以可以拿一份假的实现把整条对话跑一遍。四条不变量是承重的，去掉任何一条都会
 * 让"模型说做完了"和"真的做了"分家（都来自 liteshell 的 agent.ts）：
 *
 *  1. 每个 tool_call 都必须有对应的 tool 结果，哪怕它被拒绝、被跳过、参数写错了——
 *     少一条，下一轮请求就会被网关判成「消息格式非法」。
 *  2. 被截断的回合（finish = max-tokens）里出现的工具调用**一条都不执行**：命令行
 *     截断之后含义完全不同（`rm -rf /tmp/x` 截成 `rm -rf /` 就是另一回事）。
 *  3. 是否要用户确认，只看"这一步实际要跑什么"，不看模型怎么说；模型没有定级权。
 *  4. 输出超长先落盘，只把头尾和文件句柄交给模型，它要中间那段再读回来。
 */
import { gate, riskTone, sanitizeOutput } from './gate.js'

const MAX_STEPS = 12
const MAX_RESULT_CHARS = 30_000
const HEAD_LINES = 100
const TAIL_LINES = 50

/**
 * 面板 AI 的工具表。名字与 liteshell 的同名工具对齐，另外加一个 `exec_detached`
 * （走独立通道，不碰用户正在看的终端）。
 */
export const TOOL_DEFS = [
  {
    name: 'exec',
    description:
      '在这台服务器的**当前终端里**执行一条 shell 命令，输出会显示在用户能看到的终端上。' +
      '命令必须是一行（终端一次只读一行）；需要多行就 bash -c \'…\'。vim/top 这类全屏程序占着终端时会拒绝执行。',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string', description: '要执行的命令，单行。' } },
      required: ['command'],
      additionalProperties: false,
    },
  },
  {
    name: 'exec_detached',
    description: '走独立 SSH 通道执行一条命令，不碰用户的终端。适合不该被打断的场合（长命令、要喂 stdin）。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令。' },
        timeout_seconds: { type: 'number', description: '超时秒数，默认 120。' },
      },
      required: ['command'],
      additionalProperties: false,
    },
  },
  {
    name: 'ls',
    description: '列出远程目录。',
    parameters: { type: 'object', properties: { path: { type: 'string', description: '目录路径，默认 "."。' } }, additionalProperties: false },
  },
  {
    name: 'cat',
    description: '读取远程文本文件（最多 200 KB）。更大的文件用 exec 配合 head/tail/grep。',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
  },
  {
    name: 'monitor',
    description: '读取这台机器的资源情况（CPU/内存/磁盘/网络/进程/GPU）。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mkdir',
    description: '在远端新建目录。',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
  },
  {
    name: 'rm',
    description: '删除远端文件或目录。',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, recursive: { type: 'boolean', description: '目录需要递归删除时设为 true。' } },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'mv',
    description: '移动或重命名远端文件/目录。',
    parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'], additionalProperties: false },
  },
  {
    name: 'upload',
    description: '把**本机**文件传到服务器。本机路径只能来自用户明确说过的位置，不能自己编。',
    parameters: {
      type: 'object',
      properties: { local: { type: 'string', description: '本机文件绝对路径。' }, remote: { type: 'string', description: '远端目标路径。' } },
      required: ['local', 'remote'],
      additionalProperties: false,
    },
  },
  {
    name: 'download',
    description: '把服务器上的文件或整个目录下载到本机。目录会先在服务器上打包再拉回来。',
    parameters: {
      type: 'object',
      properties: { remote: { type: 'string', description: '远端文件或目录路径。' } },
      required: ['remote'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_output',
    description: '读取之前某条命令被截断的那部分输出（按 handle）。',
    parameters: {
      type: 'object',
      properties: {
        handle: { type: 'string' },
        offset: { type: 'number', description: '从第几个字符开始，默认 0。' },
        limit: { type: 'number', description: '读多少字符，默认 8000。' },
      },
      required: ['handle'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_connections',
    description: '列出用户已配置的其它 SSH 连接（只读）。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
]

const SYSTEM_PROMPT = [
  '你是一个内嵌在 SSH 终端里的运维助手。用户正在通过这个客户端连着一台服务器，你在这个环境里帮他做事。',
  '',
  '规则：',
  '- 先看清现状再动手：不确定就用 ls / cat / exec 读一下，别猜。',
  '- `exec` 的命令会显示在用户能看到的终端里，所以命令要干净、单行、能直接看懂。',
  '- 破坏性操作（删除、覆盖、重启服务）会被拦下来等用户确认，这是正常的，不要试图绕过。',
  '- 命令输出被截断时，用 read_output 按 handle 把需要的那段读回来。',
  '- 上传时本机路径只能用用户明确给过的；不要编造本机文件路径。',
  '- 回答用中文，简洁。做完一件事就说结论和关键数据，不要复述执行过程。',
  '- 不确定的事情要说不确定，不要假装命令跑过了。',
].join('\n')

/** 安全的 JSON 解析：模型偶尔会给出被截断或带尾逗号的参数。 */
export function parseArgs(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { ok: true, value: {} }
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? { ok: true, value: v } : { ok: false, error: '参数必须是一个 JSON 对象' }
  } catch (e) {
    return { ok: false, error: `参数不是合法 JSON：${e instanceof Error ? e.message : e}` }
  }
}

/** 这条工具调用要执行的命令文本（只有 exec 类工具有）。 */
export function commandOf(name, args) {
  if (name === 'exec' || name === 'exec_detached') return String(args?.command ?? '')
  // 文件类工具把路径当成"要碰什么"，给审批卡展示用，但不进命令分类器。
  if (name === 'rm' || name === 'mv' || name === 'mkdir' || name === 'cat' || name === 'download') {
    return String(args?.path ?? args?.from ?? args?.remote ?? '')
  }
  if (name === 'upload') return `${args?.local ?? ''} → ${args?.remote ?? ''}`
  return ''
}

/**
 * 把一段长输出压成"头 + 尾 + handle"。
 * @param {(text: string) => Promise<string>} spill 落盘实现，返回 handle
 */
async function clipOutput(text, spill) {
  const value = String(text ?? '')
  if (value.length <= MAX_RESULT_CHARS) return { text: value }
  const handle = await spill(value)
  const lines = value.split('\n')
  const head = lines.slice(0, HEAD_LINES).join('\n')
  const tail = lines.slice(-TAIL_LINES).join('\n')
  return {
    text: `${head}\n\n…（中间省略 ${value.length - head.length - tail.length} 字节，完整输出已存为 ${handle}，用 read_output 按需读回）…\n\n${tail}`,
    handle,
  }
}

/**
 * 跑一轮对话。
 *
 * @param {object} opts
 * @param {object} opts.llm 宿主的 LLM 服务（`listProviders` / `listModels` / `stream`）
 * @param {object} opts.model `{ provider, model }`
 * @param {object[]} opts.messages 已有对话（`{role, content}`）
 * @param {object} opts.deps 环境能力，见 assets://engine 的说明
 * @param {(event: object) => void} [opts.onEvent] 流过界面的每一件事
 * @param {AbortSignal} [opts.signal]
 * @param {'loose'|'normal'|'strict'} [opts.mode]
 * @param {number} [opts.maxSteps]
 */
export async function runTurn(opts) {
  const { llm, model, deps, onEvent = () => {}, signal, mode = 'loose' } = opts
  const messages = [...opts.messages]
  const maxSteps = opts.maxSteps ?? MAX_STEPS
  const uid = deps.uid ?? (() => Math.random().toString(36).slice(2, 10))

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) return { messages, finish: 'aborted' }

    const turn = await readTurn(llm, model, messages, signal, onEvent, uid)
    if (turn.finish?.kind === 'error') {
      return { messages, finish: 'error', error: turn.finish.failure?.message || '模型返回错误' }
    }
    if (turn.finish?.kind === 'aborted') return { messages, finish: 'aborted' }

    const text = turn.text.trim()
    const calls = turn.toolCalls

    // 只有文字没有工具：这一轮结束了。
    if (calls.length === 0) {
      messages.push({ id: `m${uid()}`, role: 'assistant', content: text ? [{ type: 'text', text }] : [], ...(turn.replayState !== undefined ? { replayState: turn.replayState } : {}) })
      return { messages, finish: 'stop', text }
    }

    messages.push({
      id: `m${uid()}`,
      role: 'assistant',
      content: [...(text ? [{ type: 'text', text }] : []), ...calls.map((c) => ({ type: 'tool-call', id: c.id, name: c.name, arguments: c.arguments }))],
      // 同一个回合里还要继续调工具时，把 replayState 带上：有些适配器靠它续上
      // 服务端的会话，丢了就等于每步都重新开一段对话。
      ...(turn.replayState !== undefined ? { replayState: turn.replayState } : {}),
    })

    // 不变量 2：被截断的回合里出现的工具调用，一条都不执行。
    if (turn.finish?.kind === 'max-tokens') {
      onEvent({ type: 'warning', text: '模型输出被长度上限截断，这一轮的工具调用已跳过（命令行被截断后含义会变）' })
      for (const c of calls) {
        messages.push(toolResult(c.id, '【未执行】上一轮输出被截断，这一条工具调用没有执行。请用更短的命令重试，或把任务拆成几步。', true, `m${uid()}`))
      }
      continue
    }

    for (const call of calls) {
      if (signal?.aborted) return { messages, finish: 'aborted' }
      const outcome = await runStep(call, { deps, mode, uid, onEvent, signal })
      messages.push(toolResult(call.id, outcome.text, outcome.isError, `m${uid()}`))
      onEvent({ type: 'step-done', id: call.id, name: call.name, ok: !outcome.isError })
    }
  }

  onEvent({ type: 'warning', text: `已连续执行 ${maxSteps} 步工具调用，先停在这里。要继续就再说一句。` })
  return { messages, finish: 'max-steps' }
}

function toolResult(id, text, isError, msgId) {
  return { id: msgId, role: 'tool', toolCallId: id, content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) }
}

/**
 * 读一轮模型输出。
 *
 * 文字可能以三种方式到达：`text-delta` 流、整个 `block-end`、或者根本没有（模型把
 * 预算全花在思考上）。只认其中一种会让某些适配器永远显示空白。
 */
async function readTurn(llm, model, messages, signal, onEvent, nextId) {
  const parts = new Map()
  const calls = new Map()
  let finish = null
  let reasoning = ''
  /** finish 块里带回来的不透明会话状态，原样存着等下一轮回传。 */
  let replayState

  const render = () =>
    [...parts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v)
      .join('')

  const stream = llm.stream({
    provider: model.provider,
    model: model.model,
    ...(model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}),
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => toWire(m, model, nextId)),
    tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
    ...(signal ? { signal } : {}),
  })

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'text-delta':
        parts.set(chunk.index, (parts.get(chunk.index) || '') + chunk.text)
        onEvent({ type: 'text', text: render() })
        break
      case 'reasoning-delta':
        reasoning += chunk.text
        break
      case 'tool-call-delta': {
        const cur = calls.get(chunk.index) ?? { id: chunk.id, name: '', arguments: '' }
        cur.id = chunk.id || cur.id
        if (chunk.name) cur.name = chunk.name
        cur.arguments += chunk.argumentsDelta ?? ''
        calls.set(chunk.index, cur)
        break
      }
      case 'block-end':
        if (chunk.block?.type === 'text' && !parts.has(chunk.index)) {
          parts.set(chunk.index, chunk.block.text || '')
          onEvent({ type: 'text', text: render() })
        } else if (chunk.block?.type === 'tool-call') {
          const cur = calls.get(chunk.index) ?? { id: '', name: '', arguments: '' }
          calls.set(chunk.index, {
            id: chunk.block.id || cur.id,
            name: chunk.block.name || cur.name,
            arguments: chunk.block.arguments || cur.arguments,
          })
        }
        break
      case 'finish':
        finish = chunk.reason
        if (chunk.replayState !== undefined) replayState = chunk.replayState
        break
      default:
        break
    }
  }

  return {
    text: render(),
    reasoning,
    finish,
    replayState,
    toolCalls: [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v).filter((c) => c.name),
  }
}

/**
 * 我们自己的消息形状 → 宿主的 `RequestMessage`。
 *
 * 这里**必须**严格按 `llm.stream()` 的 `GenerateOptions.messages` 契约来写（见宿主
 * Service 契约里的 RequestMessage / ToolResultMessage / ModelMessageSource）：
 *
 *  - `assistant` 需要 `source: { kind:'model', provider, model, replayState? }`。
 *    宿主会去读 `source.replayState`，不传 source 就是
 *    `Cannot read properties of undefined (reading 'replayState')`——第一轮没有历史消息
 *    所以看不出问题，一旦把上一轮的 assistant 消息带回去就炸。
 *  - `tool` 需要 `toolCallId` 且 `source: { kind:'tool', callId }`。少任何一个，
 *    工具结果就和那次调用对不上。
 *  - 每条消息都要有 `id`，否则会话无法把结果挂回原来的那一轮。
 *
 * `replayState` 是上一轮 finish 块里带回来的**不透明**数据，原样回传即可；我们不需要
 * 理解它，但丢了它，某些适配器（带服务端会话的）就没法续上。
 *
 * @param {object} m     我们内部的消息
 * @param {{provider: string, model: string}} route 当前使用的模型路由
 * @param {() => string} nextId 生成消息 id
 */
function toWire(m, route, nextId) {
  if (m.role === 'tool') {
    return {
      role: 'tool',
      id: m.id ?? nextId(),
      toolCallId: m.toolCallId,
      source: { kind: 'tool', callId: m.toolCallId },
      content: m.content,
      ...(m.isError ? { isError: true } : {}),
    }
  }
  if (m.role === 'assistant') {
    return {
      role: 'assistant',
      id: m.id ?? nextId(),
      source: {
        kind: 'model',
        provider: route.provider,
        model: route.model,
        ...(m.replayState !== undefined ? { replayState: m.replayState } : {}),
      },
      content: m.content,
    }
  }
  // user（以及将来可能出现的 developer/system）
  return { role: m.role, id: m.id ?? nextId(), content: m.content }
}

/** 执行一步工具调用，返回要交还给模型的文本。 */
async function runStep(call, { deps, mode, onEvent, signal }) {
  const args = parseArgs(call.arguments)
  if (!args.ok) {
    onEvent({ type: 'tool-start', id: call.id, name: call.name, args: {}, command: '' })
    onEvent({ type: 'tool-end', id: call.id, ok: false, ms: 0 })
    return { text: `【工具参数错误】${args.error}。请重新给出合法的 JSON 参数。`, isError: true }
  }

  const known = TOOL_DEFS.some((t) => t.name === call.name)
  if (!known) {
    onEvent({ type: 'tool-start', id: call.id, name: call.name, args: args.value, command: '' })
    onEvent({ type: 'tool-end', id: call.id, ok: false, ms: 0 })
    return { text: `【没有这个工具】${call.name}。可用工具：${TOOL_DEFS.map((t) => t.name).join(', ')}`, isError: true }
  }

  const command = commandOf(call.name, args.value)
  onEvent({ type: 'tool-start', id: call.id, name: call.name, args: args.value, command })

  // 不变量 3：定级只看这一步实际要做什么。
  const verdict = gate(call.name, command, { mode })
  if (!verdict.auto) {
    const approved = await deps.ask({
      id: call.id,
      name: call.name,
      command,
      args: args.value,
      risk: verdict.risk,
      tone: riskTone(verdict.risk),
      reason: verdict.reason,
      signal,
    })
    if (!approved) {
      onEvent({ type: 'tool-end', id: call.id, ok: false, ms: 0 })
      return { text: '【用户拒绝了这一步】不要重复尝试同一个操作；先说明你原本想做什么、为什么，或者换个办法。', isError: true }
    }
  }

  const started = Date.now()
  try {
    const result = await deps.execute(call.name, args.value, { signal })
    const ms = Date.now() - started
    const raw = typeof result === 'string' ? result : result?.text ?? JSON.stringify(result)
    const clipped = await clipOutput(sanitizeOutput(command, raw), deps.spill)
    onEvent({ type: 'tool-end', id: call.id, ok: true, ms, output: clipped.text, handle: clipped.handle })
    return { text: clipped.text, isError: false }
  } catch (e) {
    const ms = Date.now() - started
    const message = e instanceof Error ? e.message : String(e)
    onEvent({ type: 'tool-end', id: call.id, ok: false, ms, output: message })
    return { text: `【执行失败】${message}`, isError: true }
  }
}
