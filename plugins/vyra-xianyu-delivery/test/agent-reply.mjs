#!/usr/bin/env node
/**
 * 测试 Agent 回复链路：模拟买家消息，验证 Agent 能否调用 send_buyer_reply 工具。
 *
 * 运行：node test/agent-reply.mjs
 *
 * 期望：打印 "Agent 回复: <生成的文本>"
 * 失败：打印错误原因（empty-reply / agents-unavailable / 超时）
 */

import { createDshAgent } from '../lib/agent.js'

// 模拟 DSH agents 服务（最简实现）
const mockAgents = {
  create: async ({ sessionId, meta, agentOptions, setup }) => {
    console.log('[mock] 创建 agent:', { sessionId, meta })

    const tools = new Map()
    const agentCtx = {
      tools: {
        register: (def) => {
          console.log('[mock] 注册工具:', def.name)
          tools.set(def.name, def)
        },
      },
    }

    if (setup) await setup(agentCtx)

    // 模拟 Agent 执行：自动调用 send_buyer_reply
    const replyTool = tools.get('send_buyer_reply')
    let disposed = false

    const agent = {
      id: sessionId,
      session: { id: sessionId },
      followup: (msg) => {
        console.log('[mock] 收到消息:', msg.content[0].text.slice(0, 60))
      },
      whenIdle: async () => {
        // 模拟思考 500ms 后调用工具
        await new Promise(r => setTimeout(r, 500))
        if (replyTool && !disposed) {
          console.log('[mock] Agent 调用 send_buyer_reply...')
          await replyTool.execute({ text: '你好！我是闲鱼客服，有什么可以帮到你？' })
        }
      },
    }

    return {
      agent,
      dispose: async () => { disposed = true },
    }
  },
}

const agent = createDshAgent({
  getAgents: () => mockAgents,
  sessionTitle: null,
  config: { ai: { timeoutMs: 5000 } },
  logger: (msg) => console.log('[agent]', msg),
  getPreset: () => 'builtin',
})

console.log('Agent 可用:', agent.available)

const result = await agent.ask({
  prompt: '买家说：你好\n\n请生成回复，然后调用 send_buyer_reply 工具把回复原样交出来。',
  sessionKey: 'test-chat',
  title: '[测试客服] 测试商品-测试买家',
})

if (result.text) {
  console.log('✓ Agent 回复:', result.text)
} else {
  console.error('✗ 失败:', result.error)
  process.exit(1)
}
