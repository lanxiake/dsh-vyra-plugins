/**
 * AI 面板的 Host 端：把引擎、工具、DSH 的模型服务接在一起。
 *
 * ## 模型从哪来（这是本插件与 liteshell 的关键区别）
 *
 * **默认就用 DSH 已经配好的模型提供商**，不需要用户再填一遍地址、密钥和模型名：
 *   1. `ctx.agentDefaultModel.currentSelection()` —— DSH 里选中的默认模型；
 *   2. 取不到就退到 `ctx.llm.listProviders()` + `listModels()` 里第一个能用的。
 * 用户也可以在面板里手动指定（写进插件自己的设置），但那是可选覆盖，不是前置配置。
 *
 * ## 一次对话怎么跑
 *
 * 界面上发一条消息 → Host 建一个「会话」（保存 messages）→ 调 `runTurn()` →
 * 引擎每要走一步工具就发一条 SSE 事件；需要用户确认的那一步会**停在这里**，等界面
 * 回一个 `approve` / `deny`，超时按拒绝处理（宁可少做，不可擅自做）。
 *
 * 不用 WebSocket：DSH 的 webServer 只有普通 HTTP 路由，SSE 已经够用。
 */
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { runTurn } from './agent.js'
import { createTools } from './agent-tools.js'

/** 审批等多久：一分钟没回话就当拒绝。 */
const APPROVAL_TIMEOUT_MS = 60_000
/** 上下文占用超过这个比例就压缩。 */
const COMPACT_AT = 0.9

const dirOf = () => join(process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh'), 'ssh-terminal')
const agentOutDir = () => join(dirOf(), 'agent-out')
const historyFile = () => join(dirOf(), 'agent-history.json')

/**
 * 选模型：先用 DSH 的默认选择，再退到目录里的第一个。
 *
 * @param {object} llm `ctx.llm`
 * @param {object|null} current `ctx.agentDefaultModel.currentSelection()`
 * @param {{provider?: string, model?: string}} [override] 面板里手动指定的
 */
export async function pickModel(llm, current, override = {}) {
  if (override.provider && override.model) return { provider: override.provider, model: override.model }
  if (current?.provider && current?.model) {
    return {
      provider: current.provider,
      model: current.model,
      ...(current.reasoningEffort ? { reasoningEffort: current.reasoningEffort } : {}),
    }
  }
  if (typeof llm?.listProviders !== 'function') return null
  for (const provider of llm.listProviders()) {
    try {
      const models = await llm.listModels(provider.id)
      const first = models.find((m) => m?.id)
      if (first) return { provider: provider.id, model: first.id }
    } catch {
      // 枚举不出来的提供商直接跳过，不因为一个坏适配器把面板判死
    }
  }
  return null
}

/** 面板的模型下拉：DSH 里所有提供商的模型 + 当前默认。 */
export async function listModels(llm, current) {
  const groups = []
  if (typeof llm?.listProviders === 'function') {
    for (const provider of llm.listProviders()) {
      try {
        const models = await llm.listModels(provider.id)
        if (models.length) {
          groups.push({
            id: provider.id,
            name: provider.name || provider.id,
            models: models.map((m) => ({ id: m.id, name: m.name || m.id })),
          })
        }
      } catch {
        // 同上
      }
    }
  }
  return {
    groups,
    current: current?.provider && current?.model ? { provider: current.provider, model: current.model } : null,
  }
}

/**
 * 一次 AI 会话。一个终端标签页一条；关掉标签就丢。
 */
export class AiSession {
  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.connectionId
   * @param {object} opts.llm
   * @param {{provider: string, model: string}} opts.model
   * @param {object} opts.tools createTools() 的产物
   * @param {(event: object) => void} opts.emit 推给界面
   * @param {() => Promise<string>} opts.spill
   */
  constructor(opts) {
    this.id = opts.id
    this.connectionId = opts.connectionId
    /** 这一次对话的标识：历史条目按它存，换一条就是"新对话"。 */
    this.conversationId = opts.conversationId ?? `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    this.llm = opts.llm
    this.model = opts.model
    this.tools = opts.tools
    this.emitRaw = opts.emit
    this.spill = opts.spill
    /** 对话历史：只有 user / assistant / tool 三种，与 agent.js 一致 */
    this.messages = opts.messages ?? []
    /** 正在等的审批：id → { resolve, timer } */
    this.approvals = new Map()
    /** 正在跑的回合：用来支持「停止」 */
    this.controller = null
    this.busy = false
  }

  #emit(event) {
    this.emitRaw({ session: this.id, ...event })
  }

  /**
   * 用户发来一条消息，跑一轮。
   * @param {string | object[]} input 纯文本，或者已经组装好的 content 块数组
   */
  async send(input) {
    if (this.busy) throw new Error('上一轮还在进行，先等它结束或点停止')
    const content = typeof input === 'string' ? [{ type: 'text', text: input }] : input
    if (!Array.isArray(content) || !content.length) throw new Error('消息为空')
    this.busy = true
    this.controller = new AbortController()
    this.messages.push({ role: 'user', content })
    try {
      const out = await runTurn({
        llm: this.llm,
        model: this.model,
        messages: this.messages,
        deps: {
          ask: (req) => this.#ask(req),
          execute: (name, args) => this.#execute(name, args),
          spill: this.spill,
        },
        onEvent: (e) => this.#emit(e),
        signal: this.controller.signal,
      })
      this.messages = out.messages
      this.#emit({ type: 'done', finish: out.finish, error: out.error, context: this.#contextUse() })
      return out
    } finally {
      this.busy = false
      this.controller = null
      // 每轮结束都落盘：包括出错和用户中止的那一轮——那半段对话往往正是
      // 用户要回看"它到底卡在哪"的依据，丢了就白问了。
      //
      // 写盘放在 finally 里且吞掉异常：磁盘满、目录只读都不该让一次已经跑完的
      // 对话变成报错。
      try {
        this.save()
      } catch {
        // 记不住就算了，对话本身是成功的
      }
    }
  }

  /**
   * 开一段新对话：清空上下文并换一个 conversationId。
   *
   * 不清就换 id 会有个隐蔽后果：新对话的第一轮会把旧对话的全部消息一起发出去，
   * 用户看到的是"新对话却记得上件事"。所以两件事必须一起做。
   */
  newConversation() {
    this.messages = []
    this.conversationId = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    this.#emit({ type: 'reset' })
    return this.conversationId
  }

  /**
   * 从历史恢复一段对话，接着聊。
   *
   * 只恢复 `messages`——正在等的审批、运行中的回合都不属于这段历史，硬塞回去
   * 会让界面显示一堆点了没反应的按钮。
   *
   * @param {{id: string, messages: object[]}} entry 历史条目
   */
  restore(entry) {
    const messages = Array.isArray(entry?.messages) ? structuredClone(entry.messages) : []
    this.messages = messages
    if (entry?.id) this.conversationId = entry.id
    this.#emit({ type: 'reset' })
    return this.messages.length
  }

  /** 停：只停请求，不偷偷把已经发出的操作撤回。 */
  stop() {
    // 先作废信号：在途的 #ask 会通过 abort 监听自己收尾，不必依赖下面这轮遍历。
    this.controller?.abort()
    // 再兜底处理还没被信号覆盖到的（例如请求已结束但审批还在等）。
    for (const [, a] of [...this.approvals]) a.resolve(false)
    this.approvals.clear()
  }

  /** 丢掉这条会话：清掉还挂着的审批定时器（否则进程会被它们拖着不退）。 */
  dispose() {
    this.stop()
  }

  /** 界面回执：同意 / 拒绝某一步。 */
  approve(id, approved) {
    const a = this.approvals.get(id)
    if (!a) return false
    // 单一定居路径：定时器从 a.timer 清、Map 由 done 删、promise 由 done 落地。
    a.resolve(Boolean(approved))
    return true
  }

  /**
   * 等用户点「执行 / 拒绝」；超时按拒绝算。
   *
   * 必须同时认 `req.signal`：用户按下停止时整个回合已经作废，这一步没有理由再占着
   * 审批位。早先只看定时器，于是"点停止"之后界面还要僵住最多 60 秒才动——在用户
   * 眼里那就是按钮不灵。
   */
  #ask(req) {
    return new Promise((resolve) => {
      // settled 是这一条审批自己的状态，不看 Map 里还有没有它：
      // approve() 会先 delete 再 resolve，若在 done() 里用 get() 判定「还在不在」，
      // 就永远判定为"已经被处理过"，于是什么都不做、promise 永不落地。
      let settled = false
      const done = (approved, why) => {
        if (settled) return
        settled = true
        const a = this.approvals.get(req.id)
        if (a) clearTimeout(a.timer)
        this.approvals.delete(req.id)
        if (why) this.#emit({ type: why, id: req.id })
        resolve(approved)
      }
      const timer = setTimeout(() => done(false, 'approval-timeout'), APPROVAL_TIMEOUT_MS)
      this.approvals.set(req.id, { resolve: (v) => done(v), timer })
      // 中止时按拒绝收尾：回合已经不需要这一步了，静默放行比拒绝更危险。
      const signal = req.signal
      if (signal) {
        if (signal.aborted) return done(false, 'approval-aborted')
        signal.addEventListener('abort', () => done(false, 'approval-aborted'), { once: true })
      }
      this.#emit({ type: 'approval', ...req })
    })
  }

  async #execute(name, args) {
    const fn = this.tools[name]
    if (!fn) throw new Error(`没有这个工具：${name}`)
    return fn(args)
  }

  #contextUse() {
    // 粗略估计：字符数 / 3.5 当成 token。只用来判断"要不要压缩"，不需要精确。
    const chars = this.messages.reduce((n, m) => {
      for (const block of m.content ?? []) n += String(block.text ?? block.arguments ?? '').length
      return n
    }, 0)
    return { chars, approxTokens: Math.round(chars / 3.5) }
  }

  /**
   * 这一条会话存进磁盘（按连接分开，最多 200 条）。
   *
   * 用 `conversationId` 而不是 `id` 当条目主键：`id` 就是连接 id，一个连接只会有
   * 一条记录，用户聊第二件事时第一件就被覆盖了——"历史"于是永远只有一条。
   * 开始新对话时换一个新的 conversationId，旧的自然留在列表里。
   */
  save() {
    const all = readHistory()
    const list = all[this.connectionId] ?? []
    const entry = {
      id: this.conversationId,
      at: Date.now(),
      title: titleOf(this.messages),
      messages: this.messages,
      // 存下当时的模型与轮数，回看时才知道"这是用哪个模型聊的"
      model: this.model ? { provider: this.model.provider, model: this.model.model } : null,
    }
    const at = list.findIndex((x) => x.id === this.conversationId)
    if (at >= 0) list[at] = entry
    else list.push(entry)
    all[this.connectionId] = list.slice(-200)
    writeHistory(all)
  }
}

/** 会话标题：第一句话的前 24 个字。 */
function titleOf(messages) {
  for (const m of messages) {
    if (m.role !== 'user') continue
    const text = (m.content ?? []).map((b) => b.text ?? '').join(' ').trim()
    if (text) return text.length > 24 ? `${text.slice(0, 24)}…` : text
  }
  return '新对话'
}

export function readHistory() {
  try {
    const parsed = JSON.parse(readFileSync(historyFile(), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeHistory(all) {
  mkdirSync(dirOf(), { recursive: true })
  writeFileSync(historyFile(), JSON.stringify(all))
}

/** 写入整个历史表。给「删除某一条」这类操作直接用（它们不走 AiSession）。 */
export function writeAiHistory(all) {
  writeHistory(all)
}

/**
 * 超长输出落盘：返回一个 handle，模型用 read_output 按需读回。
 * 每次插件启动清空一次——这些文件只是给当前对话用的。
 */
export function createSpill() {
  const root = agentOutDir()
  if (existsSync(root)) {
    // 清空上一次的：它们只服务于已经结束的对话
    for (const f of readdirSync(root)) {
      try {
        unlinkSync(join(root, f))
      } catch {
        // 删不掉就算了，不要因为清理失败把面板卡死
      }
    }
  }
  mkdirSync(root, { recursive: true })
  return async (text) => {
    const handle = randomBytes(6).toString('hex')
    writeFileSync(join(root, `${handle}.txt`), text)
    return handle
  }
}

/** 按 handle 读回一段。 */
export function createReadOutput() {
  return async (handle, offset, limit) => {
    const root = agentOutDir()
    if (!/^[0-9a-f]+$/.test(handle)) throw new Error('handle 不合法')
    const file = join(root, `${handle}.txt`)
    if (!existsSync(file)) throw new Error(`找不到输出文件 ${handle}（可能已经过期）`)
    const text = readFileSync(file, 'utf8')
    const from = Math.max(0, offset)
    const to = Math.min(text.length, from + Math.max(1, limit))
    return text.slice(from, to) + (to < text.length ? `\n…（还有 ${text.length - to} 字节，用 offset=${to} 继续读）` : '')
  }
}
