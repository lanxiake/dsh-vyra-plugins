// 买家消息的自动回复。
//
// 两种模式：
//   dsh — 通过 DSH 自己的 agent（ctx.agents），复用 profile 里配置的模型与 agent preset
//   api — 直连 OpenAI 兼容接口，插件自己填 baseUrl/apiKey/model（兜底）
//
// 知识库不在这里:每个商品在 items.skills 里绑定技能名，技能正文从 skillsDir 读取后注入 prompt。
// 商品图片、文件等资料放在技能里，由技能自己描述。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const REPLY_TOOL = 'send_buyer_reply'

function stripFrontmatter(md) {
  const text = String(md || '')
  if (!text.startsWith('---')) return text.trim()
  const end = text.indexOf('\n---', 3)
  return end === -1 ? text.trim() : text.slice(end + 4).trim()
}

export function createAi({ config = {}, store, agent, logger = () => {} }) {
  const ai = config.ai || {}
  const skillsDir = String(ai.skillsDir || join(homedir(), '.dsh', 'skills'))
  const cooldownSeconds = Number(ai.cooldownSeconds) || 8
  const maxRepliesPerChat = Number(ai.maxRepliesPerChat) || 8
  const mode = String(ai.mode || (agent?.available ? 'dsh' : 'api'))
  const apiReady = Boolean(ai.baseUrl && ai.apiKey && ai.model)
  const enabled = ai.enabled === true && (mode === 'dsh' ? Boolean(agent?.available) : apiReady)

  const cooldowns = new Map()
  const counts = new Map()
  const skillCache = new Map()

  async function loadSkill(name) {
    if (skillCache.has(name)) return skillCache.get(name)
    let body = ''
    for (const candidate of [
      join(skillsDir, name, 'SKILL.md'),
      join(skillsDir, `${name}.md`),
    ]) {
      try {
        body = stripFrontmatter(await readFile(candidate, 'utf8'))
        break
      } catch {
        // 试下一个位置
      }
    }
    skillCache.set(name, body)
    return body
  }

  async function buildPrompt({ text, itemId, history, selfUserId }) {
    const item = itemId ? store.getItem(itemId) : null
    const names = String(item?.skills || '')
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const skills = []
    for (const name of names) {
      const body = await loadSkill(name)
      if (body) skills.push(`## ${name}\n${body}`)
    }

    const lines = []
    for (const m of history.slice(-8)) {
      const content = m?.message?.text?.text
      if (!content) continue
      const who = String(m.send_user_id || '') === String(selfUserId || '') ? '你' : '买家'
      lines.push(`${who}：${content}`)
    }

    return [
      '你是闲鱼店铺客服。只回答和商品相关的问题，语气自然简短，像真人卖家。',
      '规则：不确定的事不要编；不承诺法律效力；不给外部链接；不报低于底线的价格；不提"AI""机器人""自动回复"。',
      itemId ? `当前商品 ID：${itemId}` : '',
      skills.length ? `商品技能资料：\n\n${skills.join('\n\n')}` : '商品技能资料：（未配置）',
      lines.length ? `最近对话：\n${lines.join('\n')}` : '',
      `买家最新消息：${text}`,
      `请生成回复，然后调用 ${REPLY_TOOL} 工具把回复原样交出来。`,
    ].filter(Boolean).join('\n\n')
  }

  async function apiReply(prompt) {
    let res
    try {
      res = await fetch(`${String(ai.baseUrl).replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${ai.apiKey}`,
        },
        body: JSON.stringify({
          model: ai.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: Number(ai.temperature ?? 0.6),
          max_tokens: Number(ai.maxTokens ?? 300),
        }),
        signal: AbortSignal.timeout(30000),
      })
    } catch (err) {
      logger(`ai request failed: ${err?.message || err}`)
      return null
    }
    if (!res.ok) {
      logger(`ai http ${res.status}`)
      return null
    }
    const json = await res.json()
    const out = json?.choices?.[0]?.message?.content
    return out && String(out).trim() ? String(out).trim() : null
  }

  function coolingDown(cid) {
    const last = cooldowns.get(cid) || 0
    return Date.now() - last < cooldownSeconds * 1000
  }

  async function reply({ cid, itemId, text, history = [], selfUserId = '' }) {
    if (!enabled) return null
    if (coolingDown(cid)) return null
    if ((counts.get(cid) || 0) >= maxRepliesPerChat) return null

    const prompt = await buildPrompt({ text, itemId, history, selfUserId })
    const out = mode === 'dsh' ? await agent.ask({ prompt, sessionKey: cid }) : await apiReply(prompt)
    if (!out) return null

    cooldowns.set(cid, Date.now())
    counts.set(cid, (counts.get(cid) || 0) + 1)
    return out
  }

  return {
    enabled,
    mode,
    reply,
    resetChat(cid) {
      counts.delete(cid)
      cooldowns.delete(cid)
    },
  }
}