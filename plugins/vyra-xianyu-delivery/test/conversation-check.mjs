// 会话历史解析的边界：下单卡片没有文本、自己发过言、重启前的老消息。
import { findItemId, findOrderId, latestBuyerText } from '../lib/conversation.js'

const ME = '2221917494599'
const BUYER = '2441379382'
const now = Date.now()

const text = (id, uid, body, at = now) => ({
  message_id: id, send_user_id: uid, created_at: at, message: { contentType: 1, text: { text: body } },
})
const orderCard = (orderId) => ({
  message_id: `card-${orderId}`, send_user_id: BUYER, created_at: now,
  message: {
    contentType: 26,
    dxCard: { item: { main: { clickParam: { args: { orderId } }, exContent: { title: '我已拍下，待付款' } } } },
  },
})
const tip = (orderId) => ({
  message_id: `tip-${orderId}`, send_user_id: BUYER, created_at: now,
  message: { contentType: 14, tip: { argInfo: { args: { orderId } }, tip: '卖出获能量' } },
})

const assert = (cond, message) => {
  if (!cond) throw new Error(message)
}

// 1. 买家提问后面跟一张下单卡片：要能找回那句提问。
{
  const history = [text('m1', BUYER, '怎么安装呢'), orderCard('3316601714070077862')]
  const picked = latestBuyerText(history, { self: ME, notBefore: now - 60_000 })
  assert(picked?.text === '怎么安装呢', `应取到买家提问，实际 ${JSON.stringify(picked)}`)
}

// 2. 最近一条文本是自己发的：说明已经回过，不再回复。
{
  const history = [text('m1', BUYER, '在吗'), text('m2', ME, '在的～'), orderCard('1')]
  assert(latestBuyerText(history, { self: ME, notBefore: now - 60_000 }) === null, '自己发过言后不应再回')
}

// 3. 启动前的老消息不回复。
{
  const history = [text('m1', BUYER, '旧问题', now - 3_600_000)]
  assert(latestBuyerText(history, { self: ME, notBefore: now - 60_000 }) === null, '启动前消息不应回复')
}

// 4. 只有卡片和提示：没有可回复文本。
{
  const history = [orderCard('1'), tip('2')]
  assert(latestBuyerText(history, { self: ME, notBefore: now - 60_000 }) === null, '卡片不应被当成提问')
}

// 5. 多张订单卡片时取最新的一张。
{
  const history = [orderCard('111'), orderCard('222')]
  assert(findOrderId(history) === '222', `应取最新订单，实际 ${findOrderId(history)}`)
}

// 6. 商品 ID 的两种形态都能取。
{
  const viaField = [{ message: { text: { text: 'hi' }, custom: { data: 'x', itemId: '1095350203107' } } }]
  const viaUrl = [{ message: { dxCard: { item: { main: { targetUrl: 'fleamarket://x?itemId=1093470769887' } } } } }]
  assert(findItemId(viaField) === '1095350203107', '应能从字段取 itemId')
  assert(findItemId(viaUrl) === '1093470769887', '应能从 URL 取 itemId')
}

console.log('conversation-check ok')
