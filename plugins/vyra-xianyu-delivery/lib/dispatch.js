// 发货主流程：轮询待发货订单 → 幂等 → 匹配卡券/规格 → 生成内容 → 闸门 → 发送 → 确认发货。
//
// 两条铁律：
//   1. 内容没过 validateDelivery 就绝不发送、绝不确认发货、绝不记 completed。
//   2. 任何「什么都没发出去」的失败都要进 pending_tasks 并通知卖家，不能只落一个库内状态。
//
// 默认顺序 send_then_confirm；卡密已发、确认失败时进 confirm_failed，之后只重试确认。
import { validateDelivery, validationModeFor } from './validate.js'

const MULTI_MESSAGE_SEP = '######'

function renderText(template, card, order) {
  if (!template) return card
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const vars = {
      card,
      order_no: order.order_no,
      item_id: order.item_id,
      buyer_nick: order.buyer_nick || '',
      spec: order.spec_value || '',
      quantity: String(order.quantity || 1),
    }
    return vars[key] ?? ''
  })
}

function splitMessages(text) {
  if (!String(text).includes(MULTI_MESSAGE_SEP)) return [String(text)]
  return String(text).split(MULTI_MESSAGE_SEP).map((s) => s.trim()).filter(Boolean)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 这些失败没有发出任何东西，补好配置后应当允许重试。
const RETRYABLE = /^(no_card|card_exhausted|ambiguous_card|generate_|invalid_content|verify_|path_|auth_)/
// 所有「没发出去」的失败都要提醒卖家，否则它只是库里一个状态，没人会看到。
// 匹配顺序很重要：'generate_failed' 必须排在 'generate_unavailable' 之前，
// 且失败原因可能是复合的（generate_failed:path_not_found:...），只能用前缀匹配。
const NOTIFY_KINDS = [
  ['invalid_content', 'invalid_content'],
  ['verify_failed', 'verify_failed'],
  ['card_exhausted', 'card_exhausted'],
  ['no_card', 'card_exhausted'],
  ['ambiguous_card', 'card_exhausted'],
  ['generate_failed', 'generate_failed'],
  ['generate_unavailable', 'generate_failed'],
  ['generate_empty', 'generate_failed'],
  ['path_', 'generate_failed'],
  ['share_failed', 'generate_failed'],
  ['auth_', 'generate_failed'],
  ['send_failed', 'send_failed'],
]
// 含敏感词/0 元/退款/客服关闭自动发货等「策略性拦截」只入队，不刷屏。
const QUIET_PREFIXES = ['service_auto_deliver_off', 'zero_amount', 'refund', 'sensitive']

function notifyKindFor(reason) {
  const text = String(reason || '')
  if (QUIET_PREFIXES.some((q) => text.startsWith(q))) return ''
  const hit = NOTIFY_KINDS.find(([prefix]) => text.startsWith(prefix))
  return hit ? hit[1] : ''
}

export function createDispatcher({
  store, cli, im, guard, config = {}, logger = () => {}, getAccount = () => '',
  links = null, notify = () => {},
}) {
  const account = () => String(getAccount() || '')
  const blockRefund = config.blockRefund !== false
  const blockZeroAmount = config.blockZeroAmount !== false
  const confirmFirst = config.mode === 'confirm_then_send'
  const multiMessageDelayMs = Number(config.multiMessageDelayMs ?? 500)
  let ticking = false

  const fail = (order, reason, delivered = 0, extra = {}) => {
    const orderNo = order.order_no
    store.finishOrder(orderNo, 'blocked', { failReason: reason, delivered })
    store.addPendingTask({
      kind: extra.pendingKind || 'generate_failed',
      orderNo,
      itemId: order.item_id || '',
      buyerNick: order.buyer_nick || '',
      detail: reason,
      accountId: account(),
    })
    const kind = extra.notifyKind || notifyKindFor(reason)
    if (kind) {
      notify(kind, {
        orderNo,
        itemTitle: extra.itemTitle || order.item_id || '',
        buyerNick: order.buyer_nick || '',
        detail: reason,
      })
    }
    logger(`order ${orderNo} blocked: ${reason}`)
    return { order: orderNo, state: 'blocked', reason }
  }

  async function sendAll({ toid, itemId, text }) {
    const parts = splitMessages(text)
    for (let i = 0; i < parts.length; i += 1) {
      await guard.wait()
      await (im ? im.sendRich({ toid, itemId, text: parts[i] }) : cli.send({ toid, itemId, text: parts[i] }))
      if (i < parts.length - 1) await sleep(multiMessageDelayMs)
    }
    return parts
  }

  async function retryConfirm(orderNo, delivered) {
    try {
      const result = await cli.confirm(orderNo)
      if (result?.ok) {
        guard.recordSuccess?.()
        store.finishOrder(orderNo, 'completed', { delivered })
        return { order: orderNo, state: 'completed' }
      }
      store.finishOrder(orderNo, 'confirm_failed', { failReason: result?.message || 'confirm rejected', delivered })
      return { order: orderNo, state: 'confirm_failed' }
    } catch (err) {
      guard.recordFailure?.()
      logger(`confirm retry failed ${orderNo}: ${err?.message || err}`)
      return { order: orderNo, state: 'confirm_failed' }
    }
  }

  /**
   * 生成这一次要发的内容（不含模板渲染）。
   * 生成型：必须由 links 从网盘路径生成，失败抛带 code 的 Error。
   */
  async function generateContent(card, order) {
    if (card.mode !== 'generate') {
      const content = store.consumeCard(card.id)
      if (content == null) throw Object.assign(new Error('card_exhausted'), { code: 'card_exhausted' })
      return content
    }
    if (!links) throw Object.assign(new Error('generate_unavailable'), { code: 'generate_unavailable' })
    const source = card.source_id ? store.getCardSourceById?.(card.source_id) : null
    const path = String(card.source_path || source?.path || '').trim()
    if (!path) throw Object.assign(new Error('path_required'), { code: 'path_required' })
    const out = await links.obtain({
      itemId: order.item_id,
      specValue: order.spec_value || '',
      path,
      strategy: card.strategy || source?.strategy || 'reuse',
      expireDays: Number(card.expire_days || source?.expire_days || 7),
      orderNo: order.order_no,
    })
    return out.text
  }

  async function handleOrder(order) {
    if (!order?.order_no) return null
    if (blockRefund && order.in_refund) return { order: order.order_no, skip: 'refund' }
    if (blockZeroAmount && Number(order.amount) === 0) return { order: order.order_no, skip: 'zero_amount' }

    const { created } = store.beginOrder({
      order_no: order.order_no,
      account_id: account(),
      item_id: order.item_id,
      spec_name: order.spec_name,
      spec_value: order.spec_value,
      buyer_id: order.buyer_id,
      quantity: order.quantity,
      amount: order.amount,
    })
    if (!created) return { order: order.order_no, skip: 'duplicate' }

    const item = order.item_id ? store.getItem(order.item_id, account()) : null
    const service = item && item.service_id ? store.getService(item.service_id) : null
    if (service && service.enabled === 1 && service.auto_deliver === 0) {
      return fail(order, 'service_auto_deliver_off', 0, {
        pendingKind: 'generate_failed', notifyKind: 'invalid_content', itemTitle: item?.title,
      })
    }

    const card = store.matchCard(order.item_id, order.spec_name, order.spec_value, account())
    if (card.error) {
      logger(`order ${order.order_no}: ${card.error} (item ${order.item_id} spec ${order.spec_value})`)
      return fail(order, card.error, 0, { itemTitle: item?.title })
    }

    // 先按卡券配置做敏感词检查，命中就在消费卡密之前拦下。
    const verdict = guard.check(card.template || card.content)
    if (!verdict.ok) {
      logger(`order ${order.order_no}: sensitive word "${verdict.hit}"`)
      return fail(order, `sensitive:${verdict.hit}`, 0, { itemTitle: item?.title })
    }

    const expireDays = Number(card.expire_days || 7)
    const provider = card.provider || 'quark'

    if (confirmFirst) {
      const confirmed = await cli.confirm(order.order_no)
      if (!confirmed?.ok) {
        guard.recordFailure?.()
        return fail(order, `confirm:${confirmed?.message || 'rejected'}`, 0, {
          pendingKind: 'generate_failed', notifyKind: 'send_failed', itemTitle: item?.title,
        })
      }
      guard.recordSuccess?.()
    }

    let content
    try {
      content = await generateContent(card, order)
    } catch (err) {
      const code = err?.code || 'generate_failed'
      const reason = code === 'card_exhausted'
        ? 'card_exhausted'
        : `${RETRYABLE.test(code) ? code : 'generate_failed'}:${err?.message || err}`
      return fail(order, reason, 0, { itemTitle: item?.title })
    }

    // 闸门：卡券原文与最终文案都要过一遍。这是 2026-11-27 事故的直接防线。
    // 网盘类走 link 校验（必须有链接+提取码），卡密类走 code 校验（占位词/广告照样拦）。
    const rawCheck = validateDelivery(content, { provider, expireDays, mode: validationModeFor(card) })
    if (!rawCheck.ok) {
      return fail(order, `invalid_content:${rawCheck.errors.join('|')}`, 0, { itemTitle: item?.title })
    }

    // 只有批量数据卡券支持多数量；text/image 重复发同样的内容是噪音。
    const qty = card.type === 'data' ? Math.max(1, Number(order.quantity) || 1) : 1

    let delivered = 0
    let lastError = null
    for (let seq = 1; seq <= qty; seq += 1) {
      const text = renderText(card.template || service?.deliver_template || '', content, order)
      const textVerdict = guard.check(text)
      if (!textVerdict.ok) {
        lastError = `sensitive:${textVerdict.hit}`
        store.addDelivery({
          orderNo: order.order_no, accountId: account(), cardId: card.id, seq,
          content, state: 'failed', error: lastError,
        })
        break
      }

      try {
        await sendAll({ toid: order.buyer_id, itemId: order.item_id, text })
        guard.recordSuccess?.()
      } catch (err) {
        guard.recordFailure?.()
        lastError = err.message
        // 内容已生成但没发出去：留在 deliveries 里供人工补发。
        store.addDelivery({
          orderNo: order.order_no, accountId: account(), cardId: card.id, seq,
          content, state: 'failed', error: err.message,
        })
        break
      }

      store.addDelivery({
        orderNo: order.order_no, accountId: account(), cardId: card.id, seq, content, state: 'success',
      })
      delivered += 1
    }

    if (!delivered) {
      const reason = lastError || 'send_failed'
      if (RETRYABLE.test(reason)) {
        return fail(order, reason, 0, { itemTitle: item?.title })
      }
      store.finishOrder(order.order_no, 'send_failed', { failReason: reason, delivered: 0 })
      store.addPendingTask({
        kind: 'resend', orderNo: order.order_no, itemId: order.item_id || '',
        buyerNick: order.buyer_nick || '', detail: reason, accountId: account(),
      })
      notify('send_failed', {
        orderNo: order.order_no, itemTitle: item?.title || order.item_id || '',
        buyerNick: order.buyer_nick || '', detail: reason,
      })
      logger(`order ${order.order_no} send_failed: ${reason}`)
      return { order: order.order_no, state: 'send_failed', reason }
    }

    if (delivered < qty) {
      store.finishOrder(order.order_no, 'partial', { failReason: lastError, delivered })
      store.addPendingTask({
        kind: 'resend', orderNo: order.order_no, itemId: order.item_id || '',
        buyerNick: order.buyer_nick || '', detail: `partial ${delivered}/${qty} ${lastError || ''}`.trim(),
        accountId: account(),
      })
      notify('send_failed', {
        orderNo: order.order_no, itemTitle: item?.title || order.item_id || '',
        buyerNick: order.buyer_nick || '', detail: `部分发出 ${delivered}/${qty}`,
      })
      return { order: order.order_no, state: 'partial', delivered }
    }

    if (confirmFirst) {
      store.finishOrder(order.order_no, 'completed', { delivered })
      return { order: order.order_no, state: 'completed', delivered }
    }

    store.finishOrder(order.order_no, 'sent', { delivered })
    return retryConfirm(order.order_no, delivered)
  }

  return {
    // 实时监听命中订单号后调用：从待发货列表里取出这一单并处理。
    async reconcile(orderNo) {
      if (!orderNo || guard.isPaused?.()) return null
      const page = await cli.soldList(1, 'NOT_SHIP')
      const order = (page.orders ?? []).find((o) => o.order_no === String(orderNo))
      if (!order) return { order: String(orderNo), skip: 'not_pending' }
      // IM 推送与轮询可能同时命中：同一订单只处理一次。
      const key = `order:${order.order_no}`
      if (store.isHandled?.('delivery', key)) return { order: String(orderNo), skip: 'already-handled' }
      store.markHandled?.('delivery', key, { action: 'started' })
      return handleOrder(order)
    },

    async tick() {
      if (ticking) return { skipped: true }
      if (guard.isPaused?.()) return { paused: true }
      ticking = true
      try {
        // 先补上「卡密已发、确认失败」的订单，再拉新单。
        for (const row of store.pendingConfirm(account())) {
          await retryConfirm(row.order_no, row.delivered)
        }

        const page = await cli.soldList(1, 'NOT_SHIP')
        const results = []
        for (const order of page.orders ?? []) {
          if (guard.isPaused?.()) break
          const outcome = await handleOrder(order)
          if (outcome) results.push(outcome)
        }
        return { results }
      } finally {
        ticking = false
      }
    },
  }
}
