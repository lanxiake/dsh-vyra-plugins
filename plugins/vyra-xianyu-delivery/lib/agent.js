// 用 DSH 自己的 agent 生成回复。
//
// ctx.agents.create 创建一个绑定指定 agent preset / provider / model 的会话；
// 回复通过一个临时工具交回来，不去猜 session 事件的结构。
// 插件不 import DSH 内部包：sessionId 和用户消息都是普通对象/字符串。
import { randomUUID } from 'node:crypto'

const REPLY_TOOL = 'send_buyer_reply'

function userMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

export function createDshAgent({ agents, config = {}, logger = () => {}, getPreset }) {
  const ai = config.ai || {}
  const provider = String(ai.provider || '').trim()
  const model = String(ai.model || '').trim()
  const timeoutMs = Number(ai.timeoutMs) || 90000

  const currentPreset = () => String(getPreset?.() ?? ai.agentPreset ?? '').trim()

  async function ask({ prompt, sessionKey }) {
    if (!agents?.create) throw new Error('DSH agents 服务不可用')

    const preset = currentPreset()
    let reply = ''
    const handle = await agents.create({
      sessionId: `xianyu-${sessionKey || 'chat'}-${randomUUID()}`,
      meta: preset ? { origin: 'subagent', agentPreset: preset } : { origin: 'subagent' },
      agentOptions: provider ? { provider, model } : undefined,
      setup: (agentCtx) => {
        agentCtx.tools.register({
          name: REPLY_TOOL,
          description: '把最终要发给买家的回复原样交出来。必须调用且只调用一次。',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string', description: '发给买家的完整回复，不要带引号或解释' },
            },
            required: ['text'],
          },
          output: {
            schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
            render: () => [{ type: 'text', text: 'ok' }],
            presentationMeta: () => ({}),
          },
          execute: async (args) => {
            reply = String(args?.text || '').trim()
            return { ok: true }
          },
        })
      },
    })

    try {
      handle.agent.followup(userMessage(prompt))
      await Promise.race([
        handle.agent.whenIdle(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`agent timeout after ${timeoutMs}ms`)), timeoutMs).unref?.()
        }),
      ])
    } catch (err) {
      logger(`agent ask failed: ${err?.message || err}`)
    } finally {
      await handle.dispose().catch(() => {})
    }

    return reply || null
  }

  return {
    available: Boolean(agents?.create),
    get agentPreset() {
      return currentPreset()
    },
    provider,
    model,
    ask,
  }
}