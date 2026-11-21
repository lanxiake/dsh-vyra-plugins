// 用 DSH 自己的 agent 生成回复。
//
// ctx.agents.create 创建一个绑定指定 agent preset / provider / model 的会话；
// 回复通过一个临时工具交回来，不去猜 session 事件的结构。
// 插件不 import DSH 内部包：sessionId 和用户消息都是普通对象/字符串。
import { randomUUID } from 'node:crypto'

const REPLY_TOOL = 'send_buyer_reply'

/** 插件自带的客服 agent：不依赖 Agent Manager 里的 preset。 */
export const BUILTIN_AGENT = 'builtin'

function userMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

export function createDshAgent({ agents, getAgents, sessionTitle, config = {}, logger = () => {}, getPreset, workspaceCwd, getDefaultModel, attachSession, renameSession }) {
  // Cordis 的服务在插件 apply 时可能还没注册（注入顺序），必须每次现取；
  // 在 apply 时取一次会永久拿到 undefined，AI 客服就一直是关的。
  const liveAgents = () => (typeof getAgents === 'function' ? getAgents() : agents)
  // 活着的会话句柄：同一买家后续的消息续到同一个会话里，不重建。
  const liveHandles = new Map()
  // 已经装过 scoped 贡献的 agentCtx，避免重复注册同名工具/提示段。
  const preparedScopes = new WeakMap()
  // 每个会话一个回复槽，句柄复用后工具闭包仍写进同一个对象。
  const replySlots = new Map()
  const ai = config.ai || {}
  const provider = String(ai.provider || '').trim()
  const model = String(ai.model || '').trim()
  const timeoutMs = Number(ai.timeoutMs) || 90000

  const currentPreset = () => {
    const raw = String(getPreset?.() ?? ai.agentPreset ?? '').trim()
    // "builtin" 表示用插件内置的客服 prompt，不传 agentPreset。
    return raw === BUILTIN_AGENT ? '' : raw
  }

  async function ask({ prompt, systemPrompt = '', allowedTools = null, sessionKey, title = '', model = null }) {
    if (!liveAgents()?.create) return { text: null, error: 'agents-unavailable' }
    try {
      return await askOnce({ prompt, systemPrompt, allowedTools, sessionKey, title, model })
    } catch (err) {
      logger(`agent ask failed: ${err?.message || err}`)
      return { text: null, error: String(err?.message || err) }
    }
  }

  async function askOnce({ prompt, systemPrompt, allowedTools, sessionKey, title, model }) {
    const preset = currentPreset()
    const route = model && model.provider && model.model
      ? { provider: model.provider, model: model.model }
      : null
    // 插件自建的会话不会自动继承 DSH 默认模型，必须显式给 provider/model，
    // 否则运行时报 "agent has no provider/model"。优先级：
    // 客服指定的模型 → 插件配置 → DSH 当前默认模型。
    let agentOptions = route ?? (provider ? { provider, model } : null)
    if (!agentOptions) {
      try {
        const sel = getDefaultModel?.()
        if (sel?.provider && sel?.model) agentOptions = { provider: sel.provider, model: sel.model }
      } catch {
        // 默认模型读不到就交给 create 报错
      }
    }
    let systemDelivered = false
    // 一个买家一个会话：sessionId 固定为 xianyu-<cid>，第一次创建、之后 resume，
    // 这样 DSH 会话列表里是「一段连续对话」而不是每次一条。
    const sessionId = `xianyu-${String(sessionKey || 'chat').replace(/[^0-9a-zA-Z_-]/g, '') || 'chat'}`
    // 回复槽跟着会话走：handle 复用后，工具闭包必须写进同一个槽，
    // 而不是各自捕获一个只会用一次的局部变量。
    const slot = replySlots.get(sessionId) ?? { text: '' }
    slot.text = ''
    replySlots.set(sessionId, slot)
    const setup = (agentCtx) => {
      const state = preparedScopes.get(agentCtx)
      if (state) {
        systemDelivered = state.system
        return
      }
      const next = { system: false }
      preparedScopes.set(agentCtx, next)
      // 客服人设与技能放进系统提示段：续写时还在，也不会挤占用户消息。
      if (systemPrompt) {
        try {
          agentCtx.systemPrompt?.section({
            name: 'vyra-xianyu-cs',
            order: 10150,
            text: () => systemPrompt,
          })
          next.system = true
          systemDelivered = true
        } catch (err) {
          // 拿不到 systemPrompt 服务就退回把提示塞进用户消息，别让技能凭空消失。
          logger(`system prompt section failed, falling back to user message: ${err?.message || err}`)
        }
      }
      agentCtx.tools.register({
        name: REPLY_TOOL,
        description: '把最终要发给买家的回复原样交出来。必须调用且只调用一次。',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '发给买家的完整回复，不要带引号或解释' },
          },
          required: ['text'],
          additionalProperties: false,
        },
        output: {
          schema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
            additionalProperties: false,
          },
          render: () => [{ type: 'text', text: 'ok' }],
          presentationMeta: () => ({ expandable: false }),
        },
        execute: async (args) => {
          slot.text = String(args?.text || '').trim()
          return { ok: true }
        },
      })

      // 真正限制可用工具，而不是只在 prompt 里列名字。
      if (Array.isArray(allowedTools) && allowedTools.length > 0) {
        try {
          const schemas = agentCtx.tools.schemas?.() || []
          const present = new Set(schemas.map((tool) => tool?.name).filter(Boolean))
          const allow = [...new Set([...allowedTools, REPLY_TOOL])].filter((name) => present.has(name))
          if (allow.length > 0) agentCtx.tools.restrict({ allow })
        } catch (err) {
          logger(`tools restrict failed: ${err?.message || err}`)
        }
      }
    }

    // 会话落在专用工作区，DSH 侧栏会把它归到「闲鱼客服」分组下。
    const createOptions = {
      meta: {
        ...(workspaceCwd ? { cwd: workspaceCwd } : {}),
        delegationDepth: 0,
        ...(preset ? { agentPreset: preset } : {}),
      },
      ...(agentOptions ? { agentOptions } : {}),
      setup,
    }

    const agentsNow = liveAgents()
    // 同一会话复用同一个 handle：每轮结束不 dispose，否则下一轮只能重建，
    // 一旦 resume 失败就会掉进带时间戳的「临时会话」。
    let handle = liveHandles.get(sessionId)
    if (!handle) {
      const live = agentsNow.get?.(sessionId)
      if (live) {
        // DSH 自己已经在跑这个会话：补上本轮需要的 scoped 贡献即可。
        try {
          setup(live.ctx)
        } catch (err) {
          logger(`re-install setup on live agent failed: ${err?.message || err}`)
        }
        handle = { agent: live, dispose: async () => {} }
      } else {
        try {
          // 已有该买家的会话就续写，保持一段连续对话。
          handle = await agentsNow.resume({ resumeSessionId: sessionId, ...createOptions })
        } catch (resumeErr) {
          try {
            handle = await agentsNow.create({ sessionId, ...createOptions })
          } catch (err) {
            // 会话可能正被占用：退回到一次性会话，别让买家等着。
            logger(`create ${sessionId} failed, falling back to a fresh id: ${err?.message || err} (resume: ${resumeErr?.message || resumeErr})`)
            handle = await agentsNow.create({
              ...createOptions,
              sessionId: `${sessionId}-${Date.now()}`,
            })
          }
        }
      }
      liveHandles.set(sessionId, handle)
    }

    // 挂到「闲鱼客服」工作区：不 attach 的话会话不会出现在侧栏分组里。
    if (typeof attachSession === 'function') {
      try {
        await attachSession(sessionId)
      } catch (err) {
        logger(`attach session failed: ${err?.message || err}`)
      }
    }

    // 标题：优先用官方 sessionController，退回 sessionTitle。
    if (title) {
      let renamed = false
      if (typeof renameSession === 'function') {
        try {
          renamed = await renameSession(sessionId, title) !== false
        } catch (err) {
          logger(`rename via controller failed: ${err?.message || err}`)
        }
      }
      if (!renamed && sessionTitle?.rename) {
        try {
          sessionTitle.rename(handle.agent.session, title)
        } catch (err) {
          logger(`rename session failed: ${err?.message || err}`)
        }
      }
    }

    try {
      // 系统段没装进去时把同样的内容补在用户消息前面，技能不会丢。
      const userText = systemDelivered || !systemPrompt ? prompt : `${systemPrompt}\n\n${prompt}`
      handle.agent.followup(userMessage(userText))
      await Promise.race([
        handle.agent.whenIdle(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`agent timeout after ${timeoutMs}ms`)), timeoutMs).unref?.()
        }),
      ])
    } catch (err) {
      logger(`agent ask failed: ${err?.message || err}`)
      // handle 可能已经被 DSH 卸载：丢掉缓存，下一轮重新 resume/create。
      if (/(disposed|inactive|not live|inactive context)/i.test(String(err?.message || err))) {
        liveHandles.delete(sessionId)
      }
      return { text: null, error: String(err?.message || err) }
    }

    return { text: slot.text || null, error: slot.text ? '' : 'empty-reply' }
  }

  return {
    get available() {
      return Boolean(liveAgents()?.create)
    },
    get agentPreset() {
      return currentPreset()
    },
    get builtin() {
      return String(getPreset?.() ?? ai.agentPreset ?? '').trim() === BUILTIN_AGENT
    },
    provider,
    model,
    ask,
    // 插件卸载 / 切账号时把还活着的会话关掉。
    async disposeAll() {
      const handles = [...liveHandles.values()]
      liveHandles.clear()
      for (const handle of handles) {
        await Promise.resolve(handle.dispose?.()).catch(() => {})
      }
    },
  }
}