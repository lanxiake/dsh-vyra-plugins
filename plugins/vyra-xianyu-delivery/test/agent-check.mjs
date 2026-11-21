// Agent 会话生命周期：同一买家第二轮必须复用同一个会话，不能另起临时会话。
import { createDshAgent } from '../lib/agent.js'

const created = []
const resumed = []
let live = null
let lastScope = null

function fakeAgent(tools) {
  return {
    id: 'session-1',
    session: { id: 'session-1' },
    followup(msg) {
      this.lastPrompt = msg.content[0].text
    },
    async whenIdle() {
      const tool = tools.get('send_buyer_reply')
      if (tool) await tool.execute({ text: `回复:${this.lastPrompt.slice(-8)}` })
    },
  }
}

const agents = {
  async create(options) {
    created.push(options.sessionId)
    const tools = new Map()
    live = fakeAgent(tools)
    const scoped = {
      section: null,
      restricted: null,
      systemPrompt: { section: (s) => { scoped.section = s } },
      tools: {
        register: (def) => { tools.set(def.name, def) },
        schemas: () => [...tools.values()].map((t) => ({ name: t.name })).concat([{ name: 'xianyu_get_item' }]),
        restrict: (filter) => { scoped.restricted = filter },
      },
    }
    live.tools = tools
    options.setup?.(scoped)
    lastScope = scoped
    return { agent: live, dispose: async () => {} }
  },
  async resume(options) {
    resumed.push(options.resumeSessionId)
    throw new Error('resume-should-not-be-called')
  },
  get() {
    return undefined
  },
}

const agent = createDshAgent({
  getAgents: () => agents,
  sessionTitle: null,
  config: {},
  logger: (msg) => console.log('[agent]', msg),
  getPreset: () => 'builtin',
  workspaceCwd: '/tmp/cs',
  getDefaultModel: () => ({ provider: 'p', model: 'm' }),
  attachSession: async () => {},
  renameSession: async () => true,
})

const first = await agent.ask({
  prompt: '买家：你好',
  systemPrompt: '技能：夸克网盘 …',
  allowedTools: ['xianyu_get_item'],
  sessionKey: '69360436252',
  title: '[客服] 商品-买家',
})
const resumedAfterFirst = resumed.length
const second = await agent.ask({
  prompt: '买家：怎么安装',
  systemPrompt: '技能：夸克网盘 …',
  allowedTools: ['xianyu_get_item'],
  sessionKey: '69360436252',
  title: '[客服] 商品-买家',
})

if (!first.text?.startsWith('回复:')) throw new Error(`第一轮没有回复：${JSON.stringify(first)}`)
if (!second.text?.startsWith('回复:')) throw new Error(`第二轮没有回复：${JSON.stringify(second)}`)
if (created.length !== 1) throw new Error(`应当只创建 1 个会话，实际 ${created.length}：${created.join(',')}`)
if (resumed.length !== resumedAfterFirst) throw new Error('第二轮不应重新 resume')
if (created[0] !== 'xianyu-69360436252') throw new Error(`会话 id 不稳定：${created[0]}`)

if (!lastScope?.section) throw new Error('系统提示段没有注册')
if (lastScope.section.text() !== '技能：夸克网盘 …') throw new Error('系统提示段内容不对')
const allow = lastScope.restricted?.allow
if (!allow || !allow.includes('send_buyer_reply')) throw new Error('没有限制工具（缺少回复工具）')
if (!allow.includes('xianyu_get_item')) throw new Error('允许的客服工具没有生效')
console.log('agent-check ok（1 个会话，2 轮回复，系统段与工具限制生效）')
await agent.disposeAll()
