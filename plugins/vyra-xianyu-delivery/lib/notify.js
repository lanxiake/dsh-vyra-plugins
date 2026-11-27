// 卖家通知：发货失败、待人工、登录失效，都推送到已勾选的 dsh-im 出口。
//
// 出口来自 dsh-im 提供的 ctx.get('dshIm')；插件不自己起 IM 进程。
// 三条硬约束：
//   1. 正文不含收货地址/手机号等隐私字段；
//   2. 同一事件 10 分钟内只推一次，避免一单失败刷屏；
//   3. 发送失败也要落库（state=failed），面板顶部显示未送达计数，不能静默丢失。

export const DEFAULT_RULES = {
  generate_failed: true,
  invalid_content: true,
  verify_failed: true,
  send_failed: true,
  card_exhausted: true,
  login_expired: true,
  pending_new: true,
  daily_digest: false,
  test: true,
}

export const KIND_TEXT = {
  generate_failed: '发货内容生成失败',
  invalid_content: '发货内容被拦截',
  verify_failed: '分享链接校验失败',
  send_failed: '内容已发出但发送失败',
  card_exhausted: '卡密/库存耗尽',
  login_expired: '闲鱼登录失效',
  pending_new: '有待人工处理的订单',
  daily_digest: '每日汇总',
  test: '通知通道测试',
}

const COALESCE_MS = 10 * 60 * 1000

function compose(kind, payload = {}) {
  const head = `【闲鱼】${KIND_TEXT[kind] || kind}`
  const lines = [head]
  if (payload.orderNo) lines.push(`订单：${payload.orderNo}`)
  if (payload.itemTitle) lines.push(`商品：${payload.itemTitle}`)
  if (payload.buyerNick) lines.push(`买家：${payload.buyerNick}`)
  if (payload.detail) lines.push(`原因：${String(payload.detail).slice(0, 300)}`)
  if (kind !== 'test' && kind !== 'daily_digest') {
    lines.push('处理：插件已停在待人工队列，打开「闲鱼客服 → 待人工」处理。')
  }
  return lines.join('\n')
}

export function createNotifier({ store, getDshIm, logger = () => {}, rules = null, now = () => Date.now() } = {}) {
  const merged = { ...DEFAULT_RULES, ...(rules || {}) }
  const suppressed = new Map()

  function recentlySent(kind) {
    const at = suppressed.get(kind)
    if (at && now() - at < COALESCE_MS) return true
    // 进程重启后内存表是空的，用库里的最后一条 sent 兜底。
    const last = store.lastSentAtOfKind?.(kind)
    if (!last) return false
    const ts = Date.parse(`${last.replace(' ', 'T')}+08:00`)
    return Number.isFinite(ts) && now() - ts < COALESCE_MS
  }

  async function emit(kind, payload = {}) {
    const text = compose(kind, payload)
    if (merged[kind] === false) {
      store.recordNotify({ kind, ref: payload.orderNo || '', text, state: 'suppressed' })
      return { state: 'suppressed', sent: 0, suppressed: true }
    }
    if (kind !== 'daily_digest' && recentlySent(kind)) {
      store.recordNotify({ kind, ref: payload.orderNo || '', text, state: 'suppressed' })
      return { state: 'suppressed', sent: 0, suppressed: true }
    }

    const channels = (store.listChannels?.() || []).filter((c) => c.enabled === 1)
    if (!channels.length) {
      // 没配出口也必须留痕：面板要能看到「有 N 条没送出去」。
      store.recordNotify({ kind, ref: payload.orderNo || '', text, state: 'failed', error: 'no_channel' })
      suppressed.set(kind, now())
      logger(`notify ${kind} skipped: no enabled channel`)
      return { state: 'failed', sent: 0, suppressed: false, error: 'no_channel' }
    }

    const api = typeof getDshIm === 'function' ? getDshIm() : null
    if (!api?.send) {
      store.recordNotify({ kind, ref: payload.orderNo || '', text, state: 'failed', error: 'dsh_im_unavailable' })
      suppressed.set(kind, now())
      logger(`notify ${kind} skipped: dshIm unavailable`)
      return { state: 'failed', sent: 0, suppressed: false, error: 'dsh_im_unavailable' }
    }

    let sent = 0
    let lastError = ''
    for (const channel of channels) {
      try {
        await api.send(channel.bot_id, channel.target_id, text, { format: 'plain' })
        store.markChannelOk?.(channel.id)
        sent += 1
      } catch (err) {
        lastError = String(err?.message || err)
        store.markChannelError?.(channel.id, lastError)
        logger(`notify ${kind} -> ${channel.bot_id}/${channel.target_id} failed: ${lastError}`)
      }
    }

    const state = sent > 0 ? 'sent' : 'failed'
    store.recordNotify({ kind, ref: payload.orderNo || '', text, state, error: sent > 0 ? '' : lastError })
    suppressed.set(kind, now())
    return { state, sent, suppressed: false, error: state === 'sent' ? '' : lastError }
  }

  return {
    emit,
    rules: merged,
    setRule(kind, enabled) {
      merged[kind] = Boolean(enabled)
    },
    /** 通知页「发送测试」用：不走节流。 */
    async test() {
      const before = suppressed.get('test')
      suppressed.delete('test')
      const out = await emit('test', { detail: '这是一条测试通知，收到即说明通道可用。' })
      if (before) suppressed.set('test', before)
      return out
    },
  }
}
