// 买家消息的自动回复。走 OpenAI 兼容接口（DeepSeek / OpenAI / 自建网关都行）。
//
// 每个商品在 items 表里有 knowledge（商品资料/FAQ）和 skills（常用回复片段），
// 一起注入 system prompt，让回复贴着这个商品，而不是通用套话。

const DEFAULT_SYSTEM = `你是闲鱼店铺的客服。只回答和商品相关的问题，语气自然、简短，像真人卖家。
规则：
- 不确定的事不要编，可以说"我看一下"或让买家拍前确认。
- 不承诺法律效力，不提供外部链接，不报低于底线的价格。
- 不主动提"AI""机器人""自动回复"。

商品资料：
{knowledge}

常用回复：
{skills}`

export function createAi({ config = {}, store, logger = () => {} }) {
  const ai = config.ai || {}
  const enabled = Boolean(ai.enabled && ai.baseUrl && ai.apiKey && ai.model)
  const cooldowns = new Map()
  const counts = new Map()

  function coolingDown(cid) {
    const last = cooldowns.get(cid) || 0
    return Date.now() - last < (Number(ai.cooldownSeconds) || 8) * 1000
  }

  async function reply({ cid, itemId, text, history = [], selfUserId = '' }) {
    if (!enabled) return null
    if (coolingDown(cid)) return null
    if ((counts.get(cid) || 0) >= (Number(ai.maxRepliesPerChat) || 8)) return null

    const item = itemId ? store.getItem(itemId) : null
    const system = String(ai.systemPrompt || DEFAULT_SYSTEM)
      .replace('{knowledge}', (item && item.knowledge) || '（无）')
      .replace('{skills}', (item && item.skills) || '（无）')

    const messages = [{ role: 'system', content: system }]
    for (const m of history.slice(-8)) {
      const content = m?.message?.text?.text
      if (!content) continue
      const isBuyer = String(m.send_user_id || '') !== String(selfUserId || '')
      messages.push({ role: isBuyer ? 'user' : 'assistant', content })
    }
    messages.push({ role: 'user', content: String(text) })

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
          messages,
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
    if (!out || !String(out).trim()) return null

    cooldowns.set(cid, Date.now())
    counts.set(cid, (counts.get(cid) || 0) + 1)
    return String(out).trim()
  }

  return {
    enabled,
    reply,
    resetChat(cid) {
      counts.delete(cid)
      cooldowns.delete(cid)
    },
  }
}
