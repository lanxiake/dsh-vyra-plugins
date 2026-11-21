// 会话历史里的纯函数：找订单号、找商品、找"最新一条买家文本"。
//
// 抽出来是为了能脱离 DSH 直接测：下单卡片没有文本、系统提示带 HTML，
// 这些边界都在这里定死。

/** 历史里的订单卡片 / 系统提示带的订单号（最新一条优先）。 */
export function findOrderId(messages) {
  const list = [...(messages || [])].reverse()
  for (const m of list) {
    const tip = m?.message?.tip?.argInfo?.args
    if (tip && tip.orderId) return String(tip.orderId)
    const card = m?.message?.dxCard?.item?.main?.clickParam?.args
    if (card && card.orderId) return String(card.orderId)
  }
  return ''
}

/** 会话里的商品卡片会带 itemId（字段或 URL 两种形态）。 */
export function findItemId(messages) {
  for (const m of messages || []) {
    const raw = JSON.stringify(m?.message || {})
    const direct = raw.match(/"itemId"\s*:\s*"?(\d{6,})"?/)
    if (direct) return direct[1]
    const fromUrl = raw.match(/itemId=(\d{6,})/)
    if (fromUrl) return fromUrl[1]
  }
  return ''
}

const digits = (value) => String(value || '').replace(/\D/g, '')
const textOf = (m) => String(m?.message?.text?.text || '').trim()

/**
 * 最新一条「带文本」的消息是不是买家提问。
 *
 * 下单后历史里最后一条常是订单卡片（没有文本），不能因此判定没人说话：
 * 往前找最近一条真正有文字的消息。最近一条文本是自己说的 → 已经回过了。
 * `notBefore` 用于忽略插件启动前的老消息，避免重启后重答历史问题。
 */
export function latestBuyerText(history, { self = '', notBefore = 0 } = {}) {
  const list = history || []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i]
    const text = textOf(m)
    if (!text) continue // 卡片 / 提示 / 图片
    if (digits(self) && digits(self) === digits(m.send_user_id)) return null
    const createdAt = Number(m.created_at)
    if (notBefore && createdAt && createdAt < notBefore) return null
    return {
      id: String(m.message_id || ''),
      text,
      userId: String(m.send_user_id || ''),
      nick: String(m.send_user_name || ''),
    }
  }
  return null
}
