// 发货主流程：轮询待发货订单 → 幂等 → 匹配卡券/规格 → 取卡 → 发送 → 确认发货。
//
// 默认顺序 send_then_confirm：消息发不出去时不占用平台发货状态；
// 卡密发送成功后确认失败，订单进 confirm_failed，后续只重试确认，不重发卡密。

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

export function createDispatcher({ store, cli, guard, config = {}, logger = () => {}, getAccount = () => '' }) {
  const account = () => String(getAccount() || '')
  const blockRefund = config.blockRefund !== false
  const blockZeroAmount = config.blockZeroAmount !== false
  const confirmFirst = config.mode === 'confirm_then_send'
  const multiMessageDelayMs = Number(config.multiMessageDelayMs ?? 500)
  let ticking = false

  const fail = (orderNo, reason, delivered = 0) => {
    store.finishOrder(orderNo, 'blocked', { failReason: reason, delivered })
    return { order: orderNo, state: 'blocked', reason }
  }

  async function sendAll({ toid, itemId, text }) {
    const parts = splitMessages(text)
    for (let i = 0; i < parts.length; i += 1) {
      await guard.wait()
      await cli.send({ toid, itemId, text: parts[i] })
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
      logger(`confirm retry failed ${orderNo}: ${err.message}`)
      return { order: orderNo, state: 'confirm_failed' }
    }
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

    // 商品绑定了客服时，发货行为跟随客服配置（可以关掉自动发货、换文案模板）。
    const item = order.item_id ? store.getItem(order.item_id, account()) : null
    const service = item && item.service_id ? store.getService(item.service_id) : null
    if (service && service.enabled === 1 && service.auto_deliver === 0) {
      return fail(order.order_no, 'service_auto_deliver_off')
    }

    const card = store.matchCard(order.item_id, order.spec_name, order.spec_value, account())
    if (card.error) {
      logger(`order ${order.order_no}: ${card.error} (item ${order.item_id} spec ${order.spec_value})`)
      return fail(order.order_no, card.error)
    }

    // 先按卡券配置做敏感词检查，命中就在消费卡密之前拦下。
    const verdict = guard.check(card.template || card.content)
    if (!verdict.ok) {
      logger(`order ${order.order_no}: sensitive word "${verdict.hit}"`)
      return fail(order.order_no, `sensitive:${verdict.hit}`)
    }

    // 只有批量数据卡券支持多数量；text/image 重复发同样的内容是噪音。
    const qty = card.type === 'data' ? Math.max(1, Number(order.quantity) || 1) : 1

    if (confirmFirst) {
      const confirmed = await cli.confirm(order.order_no)
      if (!confirmed?.ok) {
        guard.recordFailure?.()
        return fail(order.order_no, `confirm:${confirmed?.message || 'rejected'}`)
      }
      guard.recordSuccess?.()
    }

    let delivered = 0
    let lastError = null
    for (let seq = 1; seq <= qty; seq += 1) {
      const content = store.consumeCard(card.id)
      if (content == null) {
        lastError = 'card_exhausted'
        break
      }

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
        // 卡密已消费但没发出去：内容留在 deliveries 里供人工补发。
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
      store.finishOrder(order.order_no, 'send_failed', { failReason: lastError || 'no_card', delivered })
      return { order: order.order_no, state: 'send_failed', reason: lastError }
    }

    if (delivered < qty) {
      store.finishOrder(order.order_no, 'partial', { failReason: lastError, delivered })
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
