// Real-time WeChat watch loop.
//
// Every `pollSeconds` it asks the sidecar for messages newer than the per-account
// cursor, applies the per-peer policy from the settings page, and hands eligible
// batches to a DSH session with the WeChat tools available. The batch scheduler
// owns the 20-second merge window and the post-reply cooldown (see batch.js).
//
// `notify` peers never wake the model: they are recorded in a local reminder list
// that the settings page shows. `ignore` / non-matching peers are dropped.
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createBatchScheduler } from './batch.js'

const STATE_VERSION = 1
const MAX_NOTIFICATIONS = 100

function stateFile() {
  return join(homedir(), '.dsh', 'wechat-local', 'watch.json')
}

function readState(file) {
  try {
    const raw = readFileSync(file, 'utf8')
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return {}
    return data
  } catch {
    return {}
  }
}

function writeState(file, data) {
  try {
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2))
    renameSync(tmp, file)
  } catch {
    // A failed state write must not stop the watcher; cursors advance on the next tick.
  }
}

const lower = (value) => String(value ?? '').trim().toLowerCase()
const isGroup = (talker) => lower(talker).endsWith('@chatroom')

/** Same matching rule as the sidecar: id or display label, first entry wins. */
function matchPeer(peers, talker, name) {
  const candidates = new Set([lower(talker), lower(name)])
  return (Array.isArray(peers) ? peers : []).find((peer) => {
    const keys = [lower(peer.id), lower(peer.label)]
    return keys.some((key) => key && candidates.has(key))
  })
}

/** Same trigger rule as the sidecar's `_trigger_reason`. */
function triggerAllows(peer, group, atMe, text) {
  const trigger = lower(peer.trigger) || 'all'
  if (trigger === 'all') return true
  if (trigger === 'mention') return !group || atMe
  const keywords = (Array.isArray(peer.keywords) ? peer.keywords : []).map(lower).filter(Boolean)
  const hit = keywords.length > 0 && keywords.some((word) => text.toLowerCase().includes(word))
  if (trigger === 'keyword') return hit
  return !group || atMe || hit
}

function minutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(String(value ?? '').trim())
  if (match === null) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

function inQuietHours(quiet, now = new Date()) {
  if (!quiet?.enabled) return false
  const current = now.getHours() * 60 + now.getMinutes()
  const start = minutes(quiet.start)
  const end = minutes(quiet.end)
  if (start === end) return true
  return start < end ? current >= start && current < end : current >= start || current < end
}

/**
 * One incoming message against one account's rules.
 * Mirrors the v2 branch of the sidecar's `autoreply.check` without its cooldown
 * side effect (the scheduler owns cooldown timing here).
 * @returns {{action: 'auto'|'draft'|'notify'|'drop', mode?: string, cooldownMs?: number, reason: string}}
 */
export function decideMessage(rules, message) {
  if (!rules || rules.enabled !== true) return { action: 'drop', reason: 'disabled' }
  if (Number(rules.version ?? 1) < 2) return { action: 'drop', reason: 'legacy_rules' }
  if (lower(message.talker) === 'filehelper' && !rules.reply_self) return { action: 'drop', reason: 'self_skip' }

  const peer = matchPeer(rules.peers, message.talker, message.name)
  if (peer === undefined) {
    return rules.default_mode === 'notify'
      ? { action: 'notify', reason: 'not_whitelisted' }
      : { action: 'drop', reason: 'not_whitelisted' }
  }
  if (peer.mode === 'ignore') return { action: 'drop', reason: 'blacklisted' }
  if (peer.mode === 'notify') return { action: 'notify', reason: 'notify_only' }

  const group = isGroup(message.talker)
  if (!group && rules.private === false) return { action: 'drop', reason: 'private_off' }
  if (!triggerAllows(peer, group, message.at_me === true, message.text ?? '')) {
    return { action: 'drop', reason: 'trigger_miss' }
  }
  if (inQuietHours(rules.quiet_hours)) return { action: 'drop', reason: 'quiet_hours' }

  return {
    action: peer.mode === 'auto' ? 'auto' : 'draft',
    mode: peer.mode === 'auto' ? 'auto' : 'draft',
    cooldownMs: (Number.isFinite(peer.cooldown_seconds) ? peer.cooldown_seconds : 60) * 1000,
    reason: '',
  }
}

/** Short, lossless-enough summary kept in the scheduler and prompt. */
export function summarize(message) {
  // `text` is capped at 400 by the sidecar; `text_more` carries the next slice.
  const text = String(message.text ?? '') + String(message.text_more ?? '')
  return {
    ts: Number(message.ts) || 0,
    time: message.time ?? '',
    type: Number(message.type) || 0,
    text: text.length > 1000 ? `${text.slice(0, 1000)}…` : text,
    at_me: message.at_me === true,
    local_id: message.local_id,
    image_name: message.image_name,
    sender: message.sender,
    name: message.name,
    talker: message.talker,
  }
}

function promptFor(peer, batch, decision) {
  const lines = batch.map((message, index) => {
    const parts = [`${index + 1}. [${message.time || message.ts}] ${message.text || '(无文字内容)'}`]
    if (message.type === 3) {
      parts.push(`（图片${message.local_id === undefined ? '' : ` local_id=${message.local_id} ts=${message.ts}`}，可用 read_image 查看）`)
    } else if (message.type === 34) {
      parts.push('（语音；本机未打包转写模型，听不到内容）')
    } else if (message.type === 43) {
      parts.push('（视频）')
    }
    if (message.at_me) parts.push('（@了我）')
    return parts.join(' ')
  })
  const first = batch[0]?.time ?? ''
  const last = batch[batch.length - 1]?.time ?? ''
  const mode = decision.mode === 'auto' ? '直接代回' : '起草给我确认'
  const sendArgs = [`talker="${peer.talker}"`, ...(peer.account ? [`account="${peer.account}"`] : []), 'dry_run=false', 'text="<回复正文>"'].join(', ')
  const instruction = decision.mode === 'auto'
    ? [
        '请以用户本人的口吻直接回复，并调用工具发送：',
        `send_text(${sendArgs})`,
        '必须真正调用该工具，不要只在回复里说“已发送”；不要向对方暴露你是 AI，也不要提及工具。',
      ].join('\n')
    : [
        '当前策略是「起草给我确认」：只起草一条回复，不要调用任何发送工具。',
        '把草稿正文直接作为你的回复输出，等用户确认。',
        '信息不足以回复时，直接说明需要确认什么。',
      ].join('\n')
  return [
    `你是用户的微信助理，正在代表用户本人处理「${peer.name || peer.talker}」${isGroup(peer.talker) ? '（群聊）' : '（私聊）'}的新消息。`,
    `本批合并了 ${batch.length} 条消息（${first} ~ ${last}），当前策略：${mode}。`,
    '',
    ...lines,
    '',
    instruction,
  ].join('\n')
}

/**
 * @param {object} options
 * @param {(tool: string, args?: object) => Promise<any>} options.callJson
 * @param {(account: string) => Promise<any>} options.readPolicy
 * @param {(account: string) => Promise<void>} options.restoreAccount
 * @param {() => any} options.getController
 * @param {object} [options.config]
 * @param {(line: string) => void} [options.log]
 */
export function createWatcher({ callJson, readPolicy, restoreAccount, getController, config = {}, log = () => {}, statePath = stateFile() }) {
  const pollSeconds = Math.max(0.01, Number(config.watchSeconds) || 2)
  const mergeWindowMs = Math.max(1, Number(config.mergeWindowSeconds) * 1000 || 20_000)
  const replyTimeoutMs = Math.max(1, Number(config.replyTimeoutSeconds) * 1000 || 120_000)
  const backlogSeconds = Math.max(0, Number(config.backlogSeconds) || 300)
  const enabled = config.watch !== false

  const state = readState(statePath)
  state.version = STATE_VERSION
  state.cursors = state.cursors ?? {}
  state.sessions = state.sessions ?? {}
  state.notifications = Array.isArray(state.notifications) ? state.notifications : []

  const scheduler = createBatchScheduler({
    mergeWindowMs,
    replyTimeoutMs,
    onFlush: (key, batch, decision) => {
      void deliver(key, batch, decision)
    },
  })
  scheduler.restore(state.peers)

  let running = false
  let timer = null
  let ticking = false
  let lastTickAt = 0
  let lastError = ''

  function save() {
    state.peers = scheduler.snapshot()
    writeState(statePath, state)
  }

  function peerOf(key) {
    const cut = key.indexOf('|')
    const account = cut < 0 ? '' : key.slice(0, cut)
    const talker = cut < 0 ? key : key.slice(cut + 1)
    const notification = state.notifications.find((item) => item.talker === talker)
    return { account, talker, name: notification?.name || talker }
  }

  function notify(account, message) {
    state.notifications.unshift({
      ts: Math.floor(Date.now() / 1000),
      account,
      talker: message.talker,
      name: message.name || message.talker,
      text: String(message.text ?? '').slice(0, 200),
    })
    state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS)
    save()
  }

  async function ensureSession(key, peer) {
    const existing = state.sessions[key]
    if (existing) return existing
    const controller = getController()
    if (!controller) throw new Error('DSH 会话服务不可用')
    const created = await controller.create({})
    state.sessions[key] = created.sessionId
    save()
    try {
      await controller.rename({ sessionId: created.sessionId, title: `PC微信 · ${peer.name || peer.talker}` })
    } catch {
      // A deployment without the title service still gets a working session.
    }
    return created.sessionId
  }

  async function deliver(key, batch, decision) {
    const peer = peerOf(key)
    const first = batch[0]
    peer.name = first?.name || peer.name
    const controller = getController()
    if (!controller) {
      log(`watch: no session controller; ${batch.length} message(s) for ${peer.talker} stay queued`)
      state.lastError = 'DSH 会话服务不可用'
      scheduler.retry(key, batch, decision)
      save()
      return
    }
    try {
      const sessionId = await ensureSession(key, peer)
      await controller.prompt({
        requestId: randomUUID(),
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: promptFor(peer, batch, decision) }],
      }, new AbortController().signal)
      // A draft is already the response the user reviews, so its cooldown starts at
      // delivery. An auto reply starts it when send_text actually succeeds.
      if (decision.mode === 'draft') scheduler.reply(key)
      lastError = ''
      log(`watch: delivered ${batch.length} message(s) from ${peer.name || peer.talker} to ${sessionId}`)
    } catch (error) {
      // A deleted session is re-created on the next batch; keep the messages queued.
      if (String(error?.message ?? error).includes('not-found')) delete state.sessions[key]
      state.lastError = String(error?.message ?? error)
      log(`watch: delivery failed for ${peer.talker}: ${state.lastError}`)
      scheduler.retry(key, batch, decision)
    } finally {
      save()
    }
  }

  async function processAccount(account, activeBefore) {
    try {
      const cursor = Number(state.cursors[account])
    const nowSeconds = Math.floor(Date.now() / 1000)
    // First run starts at "now": watching is not replaying days of history.
    const floor = cursor > 0 && nowSeconds - cursor <= backlogSeconds ? cursor : nowSeconds
    let answered
    try {
      answered = await callJson('poll_new', { since_ts: floor, account })
    } catch (error) {
      lastError = String(error?.message ?? error)
      return
    }
    const messages = Array.isArray(answered?.messages) ? answered.messages : []
    if (messages.length === 0) {
      state.cursors[account] = Number(answered?.next_since_ts) || floor
      return
    }

    let rules
    try {
      rules = (await readPolicy(account))?.rules
    } catch (error) {
      lastError = String(error?.message ?? error)
      return
    }

    let changed = false
    for (const message of messages) {
      const talker = message.talker
      if (!talker) continue
      const key = `${account}|${talker}`
      if (message.agent_sent === true) continue
      if (message.from_me === true) {
        // The user answered from their own phone: cancel the pending auto-reply.
        scheduler.userSpoke(key)
        changed = true
        continue
      }
      const decision = decideMessage(rules, message)
      if (decision.action === 'notify') {
        notify(account, message)
        changed = true
        continue
      }
      if (decision.action === 'drop') continue
      scheduler.push(key, summarize(message), decision)
      changed = true
    }

      state.cursors[account] = Number(answered?.next_since_ts) || floor
      if (changed) save()
    } finally {
      // Each poll binds the sidecar to this account; put the user's selection back
      // immediately so a tool call written in between cannot inherit it.
      if (activeBefore) await restoreAccount(activeBefore).catch(() => {})
    }
  }

  async function tick(force = false) {
    if ((!running && !force) || ticking) return
    ticking = true
    lastTickAt = Date.now()
    try {
      let accounts = []
      let activeBefore = ''
      try {
        const answer = await callJson('list_accounts')
        activeBefore = answer?.active || ''
        accounts = (Array.isArray(answer?.accounts) ? answer.accounts : [])
          .filter((account) => account && account.running !== false)
          .map((account) => account.wxid)
          .filter(Boolean)
      } catch (error) {
        lastError = String(error?.message ?? error)
        return
      }
      for (const account of accounts) {
        await processAccount(account, activeBefore)
      }
      if (lastError && accounts.length > 0) lastError = ''
    } finally {
      save()
      ticking = false
    }
  }

  return {
    start() {
      if (!enabled || running) return
      running = true
      lastError = ''
      void tick()
      timer = setInterval(() => void tick(), pollSeconds * 1000)
    },
    stop() {
      running = false
      if (timer !== null) clearInterval(timer)
      timer = null
      scheduler.stop()
      save()
    },
    /** One manual poll, for the settings page's "立即检查" (works while paused). */
    tickNow() {
      return tick(true)
    },
    /** Observe a successful real send so the peer's cooldown starts. */
    onToolResult(tool, args, blocks) {
      if (!['send_text', 'send_file', 'reply_to', 'send_batch'].includes(tool)) return
      let result
      try {
        const text = (Array.isArray(blocks) ? blocks : [])
          .filter((block) => block?.type === 'text')
          .map((block) => String(block.text ?? ''))
          .join('\n')
        result = JSON.parse(text)
      } catch {
        return
      }
      if (result?.dry_run !== false) return
      const reply = (account, talker) => {
        if (!talker) return
        const exact = account ? `${account}|${talker}` : ''
        const keys = [
          ...Object.keys(state.sessions),
          ...(Array.isArray(state.peers) ? state.peers.map((peer) => peer.key) : []),
        ]
        const key = exact || keys.find((candidate) => candidate.endsWith(`|${talker}`))
        if (!key) return
        scheduler.reply(key)
        save()
        log(`watch: reply sent to ${talker}; cooldown started`)
      }
      if (tool === 'send_batch') {
        for (const item of Array.isArray(result.results) ? result.results : []) {
          if (item?.ok === true) {
            reply(item.target_account ?? item.account ?? args?.account ?? '', item.talker)
          }
        }
        return
      }
      if (result?.ok === true) {
        reply(result.target_account ?? result.account ?? args?.account ?? '', args?.talker ?? result?.talker)
      }
    },
    status() {
      return {
        enabled,
        running,
        pollSeconds,
        mergeWindowSeconds: mergeWindowMs / 1000,
        replyTimeoutSeconds: replyTimeoutMs / 1000,
        lastTickAt,
        lastError,
        pending: scheduler.snapshot().map((peer) => ({ key: peer.key, count: peer.messages.length })),
        notifications: state.notifications.slice(0, 20),
      }
    },
  }
}