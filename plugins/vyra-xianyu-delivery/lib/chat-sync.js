// 会话同步：把闲鱼会话列表与消息落到本地库。
//
// 现场教训（2026-11-27 晚）：
//   * --fetch-num 拉得越大，闲鱼越容易判定异常抓取，直接回「flow controled」；
//   * 被流控时只回几条，若不识别就会把这几条当成全量写库、还标记「全量完成」，
//     之后真实买家永远补不回来。
//
// 所以这里的三条铁律：
//   1. 分页大小保持保守（默认 60），全量靠「多轮累积」，不靠一次拉完；
//   2. 任何一次被流控 / 报错，本轮算「不完整」：不推进水位、不标记全量完成；
//   3. 平台说到底了（返回条数 < 请求数）才算完整。
//
// 面板只读库（lib/db.js 的 chats/messages），不再为每次切页去开 IM 连接。

const NOISE_SESSION_TYPES = new Set([6, 23, 25, 62]) // 互动消息/热门活动/精选/交易消息
const DAY = 86400000

/** 闲鱼流控 / 限流的表现（可能出现在 message 里，也可能只在 stderr 里）。 */
const FLOW_CONTROL = /flow\s*control|流控|too\s*many\s*request|请求过于频繁|rate\s*limit/i

export function isFlowControlError(err) {
  const text = `${err?.message || err} ${err?.stderr || ''}`
  return FLOW_CONTROL.test(text)
}

/** 系统会话（公众号、活动、通知）不参与「未读补扫」，否则会淹没真实买家。 */
export function isNoiseSession(session) {
  if (!session) return true
  const type = Number(session.session_type)
  if (NOISE_SESSION_TYPES.has(type)) return true
  const nick = String(session.peer_nick || '')
  return /通知消息|闲鱼精选|卖家小助手|热门活动|互动消息|交易消息/.test(nick)
}

export function createChatSync({ store, im, cli, account = () => '', log = () => {}, handleConversation = null }) {
  const accountId = () => String(account() || '')
  // 流控后的冷却：指数退避 5 → 10 → 20 → 30 分钟（上限），成功一次后归零。
  // 撞得越狠退得越久——之前固定 3 分钟不够，冷却一结束马上又撞，等于持续施压。
  let cooldownUntil = 0
  let backoffLevel = 0
  let lastRequestAt = 0
  let lastComplete = null
  const BACKOFF_MS = [5, 10, 20, 30].map((m) => m * 60 * 1000)
  // 同类请求的最小间隔：会话列表 30 秒内不重复拉。
  const MIN_LIST_INTERVAL = 30 * 1000

  function enterCooldown(reason) {
    const waitMs = BACKOFF_MS[Math.min(backoffLevel, BACKOFF_MS.length - 1)]
    backoffLevel += 1
    cooldownUntil = Date.now() + waitMs
    log(`${reason}，冷却 ${Math.round(waitMs / 60000)} 分钟（第 ${backoffLevel} 次退避）`)
  }

  function noteSuccess() {
    if (backoffLevel > 0) log('流控已解除，退避归零')
    backoffLevel = 0
    cooldownUntil = 0
  }

  /** 所有打闲鱼的请求都从这里过：最小间隔 1.5 秒，避免密集连发被判定为脚本。 */
  async function throttle() {
    const gap = Date.now() - lastRequestAt
    if (gap < 1500) await new Promise((r) => setTimeout(r, 1500 - gap))
    lastRequestAt = Date.now()
  }

  /** 是否还没成功做过一次完整同步。 */
  function needsFullSync() {
    return store.getSetting('chats.fullSyncAt') === ''
  }

  /**
   * 拉一页会话列表。
   * 返回 { sessions, complete, flowControlled }；complete=false 表示这次可能被截断。
   * 不做翻页：fetch-num 越大越容易触发流控。
   * worker 现在会把 flow_controlled / im_error 一并带回来，优先采信它。
   */
  async function fetchSessions({ limit = 60 } = {}) {
    const fetchNum = Math.max(10, Math.min(Number(limit) || 60, 100))
    const read = (data) => {
      const got = (data && data.sessions) || []
      const flagged = Boolean(data && data.flow_controlled)
      return {
        sessions: got,
        // 空列表 + 被标记流控 = 不完整；否则按「返回数 < 请求数」判断是否到底。
        complete: got.length < fetchNum && !flagged,
        flowControlled: flagged,
        imError: String((data && data.im_error) || ''),
      }
    }
    try {
      await throttle()
      const out = read(await im.chats(fetchNum))
      if (out.sessions.length) noteSuccess()
      return out
    } catch (err) {
      if (isFlowControlError(err)) {
        enterCooldown('会话列表被流控')
        return { sessions: [], complete: false, flowControlled: true }
      }
      log(`im.chats failed (${fetchNum}), fallback to cli: ${err?.message || err}`)
    }
    // 长连接失败再退回短命令；短命令同样可能被流控。
    try {
      await throttle()
      const out = read(await cli.chats(fetchNum))
      if (out.sessions.length) noteSuccess()
      return out
    } catch (err) {
      if (isFlowControlError(err)) enterCooldown('会话列表短命令也被流控')
      else log(`cli.chats failed: ${err?.message || err}`)
      return { sessions: [], complete: false, flowControlled: isFlowControlError(err) }
    }
  }

  /** 把会话列表写进库（只更新元信息，消息另行同步）。 */
  function saveSessions(sessions) {
    for (const s of sessions) {
      const cid = String(s.session_id || '')
      if (!cid) continue
      store.upsertChatMeta({
        cid,
        accountId: accountId(),
        peerNick: String(s.peer_nick || ''),
        peerUserId: String(s.peer_user_id || ''),
        itemId: String(s.item_id || ''),
        itemTitle: String(s.item_title || ''),
        sessionType: Number(s.session_type) || 0,
        unread: Number(s.unread) || 0,
        ts: Number(s.ts) || 0,
        lastMsg: String(s.last_msg || ''),
      })
    }
  }

  /** 把一次 history 调用结果写进消息镜像。 */
  function saveMessages(cid, history) {
    let changed = false
    for (const m of history || []) {
      const messageId = String(m.message_id || '')
      if (!messageId) continue
      if (store.hasMessage(cid, messageId)) continue
      changed = true
      store.upsertMessage({
        cid,
        messageId,
        accountId: accountId(),
        sendUserId: String(m.send_user_id || ''),
        sendUserName: String(m.send_user_name || ''),
        contentType: Number(m?.message?.contentType ?? 0),
        text: String(m?.message?.text?.text || ''),
        createdAt: Number(m.created_at) || 0,
        raw: JSON.stringify(m?.message || {}),
      })
    }
    return changed
  }

  /**
   * 后台增量同步：必须同步的会话逐条拉消息；可选地交给 handleConversation 回复。
   * 只有本轮「完整」（没被流控、拿到了列表）时才推进水位与全量标记。
   */
  async function sync({ limit = 60, historyLimit = 30, reply = false, force = false } = {}) {
    if (!force && Date.now() < cooldownUntil) {
      return {
        total: 0, scanned: 0, messages: 0, replied: 0,
        cooling: true, complete: false,
        cooldownSeconds: Math.round((cooldownUntil - Date.now()) / 1000),
      }
    }

    const { sessions, complete, flowControlled } = await fetchSessions({ limit })
    const stats = {
      total: sessions.length, scanned: 0, messages: 0, replied: 0,
      full: needsFullSync(), complete: Boolean(complete), flowControlled: Boolean(flowControlled),
    }
    if (!sessions.length) {
      // 什么都没拿到：只有明确「平台说到底了但确实是空」才记完成，否则保持原状。
      store.setSetting('chats.lastSync', JSON.stringify({ at: new Date().toISOString(), ...stats }))
      return stats
    }

    saveSessions(sessions)

    const targets = []
    for (const s of sessions) {
      const cid = String(s.session_id || '')
      if (!cid) continue
      const state = store.getChatState(cid)
      const ts = Number(s.ts) || 0
      const seen = Number(state?.last_ts || 0)
      const isNew = !seen || (ts && ts > seen)
      const hasUnread = Number(s.unread) > 0
      if (!force && !isNew && !hasUnread) continue
      if (isNoiseSession(s) && !reply) continue
      targets.push(s)
    }

    // 订单兜底：把待发货 / 近 24h 订单的买家会话强制纳入，避免被公众号挤出列表。
    if (reply) {
      try {
        const page = await cli.soldList(1, 'NOT_SHIP')
        const recent = (store.recentOrders(50) || []).filter((o) => {
          const at = Date.parse(String(o.created_at || '').replace(' ', 'T'))
          return Number.isFinite(at) && Date.now() - at < DAY
        })
        const buyerIds = new Set([
          ...((page && page.orders) || []).map((o) => String(o.buyer_id || '')),
          ...recent.map((o) => String(o.buyer_id || '')),
        ])
        for (const s of sessions) {
          if (buyerIds.has(String(s.peer_user_id || '')) && !targets.includes(s)) targets.push(s)
        }
      } catch (err) {
        log(`order-based chat fallback failed: ${err?.message || err}`)
      }
    }

    for (const s of targets) {
      const cid = String(s.session_id || '')
      stats.scanned += 1
      let history = []
      try {
        await throttle()
        history = await im.history(cid, historyLimit)
      } catch (err) {
        // 拉历史被流控：本轮到此为止，水位不动，下一轮再来。
        if (isFlowControlError(err)) {
          enterCooldown('拉取历史被流控')
          stats.complete = false
          log('拉取历史被流控，本轮中止')
          break
        }
        log(`history ${cid} failed: ${err?.message || err}`)
        continue
      }
      if (saveMessages(cid, history)) stats.messages += 1
      // 只有真的拿到历史才推进这条会话的水位。
      store.setChatState(cid, {
        accountId: accountId(),
        lastTs: Number(s.ts) || Date.now(),
        lastMessageId: String(s.message_id || ''),
      })
      if (reply && typeof handleConversation === 'function' && !isNoiseSession(s)) {
        try {
          await handleConversation(cid, history, s)
          stats.replied += 1
        } catch (err) {
          log(`handle conversation ${cid} failed: ${err?.message || err}`)
        }
      }
    }

    // 只有本轮完整（列表没被截断、没中途流控）才标记全量完成。
    if (stats.complete && needsFullSync()) {
      store.setSetting('chats.fullSyncAt', new Date().toISOString())
    }
    if (stats.complete) lastComplete = new Date().toISOString()
    store.setSetting('chats.lastSync', JSON.stringify({ at: new Date().toISOString(), ...stats }))
    return stats
  }

  return {
    sync,
    fetchSessions,
    saveSessions,
    saveMessages,
    needsFullSync,
    isCooling: () => Date.now() < cooldownUntil,
    cooldownUntil: () => cooldownUntil,
    lastComplete: () => lastComplete,
  }
}
