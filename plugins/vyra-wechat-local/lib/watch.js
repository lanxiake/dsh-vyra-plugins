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

const STATE_VERSION = 4
const MAX_NOTIFICATIONS = 100
const MAX_SKIPS = 30

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const lower = (value) => String(value ?? '').trim().toLowerCase()
const isGroup = (talker) => lower(talker).endsWith('@chatroom')

/**
 * The only channels a third party cannot write into: messages you send to
 * yourself or to 文件传输助手. They are the trusted control channel for the
 * assistant; every other talker is another person and must stay out of the
 * agent unless explicitly configured.
 */
export function isTrustedChannel(talker, account) {
  const name = lower(talker)
  if (!name) return false
  if (name === 'filehelper') return true
  return Boolean(account) && name === lower(account)
}

/** Collapse a note that a failed delivery appended repeatedly, e.g. `（attach 1）` × 100. */
function collapseRepeats(text) {
  return String(text ?? '').replace(/(（[^（）]{1,40}）)\1+/gu, '$1')
}

/** Reject instead of leaving a delivery half-done when a service never answers. */
function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}超时`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

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
  // Self-chat and 文件传输助手 are the trusted control channel: only the account
  // owner can write there. They are allowed by default, even with no rules file;
  // every other talker needs an explicit entry.
  const trusted = isTrustedChannel(message.talker, message.account)
  const trustedDefault = {
    action: 'auto',
    mode: 'auto',
    cooldownMs: 60_000,
    reason: '',
  }
  if (!rules || rules.enabled !== true) {
    return trusted ? trustedDefault : { action: 'drop', reason: 'disabled' }
  }
  if (Number(rules.version ?? 1) < 2) {
    return trusted ? trustedDefault : { action: 'drop', reason: 'legacy_rules' }
  }

  const peer = matchPeer(rules.peers, message.talker, message.name)
  if (peer === undefined) {
    if (trusted) {
      if (!isGroup(message.talker) && rules.private === false) return { action: 'drop', reason: 'private_off' }
      if (inQuietHours(rules.quiet_hours)) return { action: 'drop', reason: 'quiet_hours' }
      return trustedDefault
    }
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
    image_path: message.image_path,
    voice_path: message.voice_path,
    sender: message.sender,
    name: message.name,
    talker: message.talker,
    account: message.account,
  }
}

/** Image media type from the decrypted file's first bytes. */
function imageMediaType(buffer) {
  if (buffer.length < 4) return ''
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp'
  return ''
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
export function createWatcher({ callJson, readPolicy, restoreAccount, getController, createSession, ensureSession, readImage, retireSession = async () => {}, prepareSession = async () => {}, isAutoDistill = () => false, config = {}, log = () => {}, statePath = stateFile() }) {
  const pollSeconds = Math.max(0.01, Number(config.watchSeconds) || 2)
  const mergeWindowMs = Math.max(1, Number(config.mergeWindowSeconds) * 1000 || 20_000)
  const replyTimeoutMs = Math.max(1, Number(config.replyTimeoutSeconds) * 1000 || 120_000)
  const backlogSeconds = Math.max(0, Number(config.backlogSeconds) || 300)
  const voiceAutoDownload = config.voiceAutoDownload !== false
  const maxImages = Math.max(0, Number(config.maxImagesPerBatch) || 4)
  const maxImageBytes = Math.max(0, Number(config.maxImageBytes) || 8_000_000)
  const enabled = config.watch !== false

  const state = readState(statePath)
  // Version 4 moves the 代聊 persona from a global preset to a scoped prompt
  // section; old peer sessions are archived and start fresh with it.
  if (Number(state.version) < 4) {
    for (const sessionId of Object.values(state.sessions ?? {})) {
      try {
        Promise.resolve(retireSession(sessionId)).catch(() => {})
      } catch {
        // Best-effort cleanup; the new session is unaffected.
      }
    }
    state.sessions = {}
    state.lastDelivery = null
  }
  state.version = STATE_VERSION
  state.cursors = state.cursors ?? {}
  state.sessions = state.sessions ?? {}
  state.notifications = Array.isArray(state.notifications) ? state.notifications : []
  state.skips = Array.isArray(state.skips) ? state.skips : []

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
  // Delivery failures are separate from poll failures: a successful poll must
  // not erase "the agent session is unavailable" from the settings card.
  let lastDeliveryError = String(state.lastError ?? '')
  let lastDelivery = state.lastDelivery ?? null
  let connection = { at: 0, ok: true }

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

  /**
   * Remember a message the watcher saw but did not hand to the agent. Without
   * this, a policy that silently drops (keyword miss, blacklist) looks exactly
   * like "the watcher never saw my message" in the settings page.
   */
  function skip(account, message, reason) {
    state.skips.unshift({
      ts: Number(message.ts) || Math.floor(Date.now() / 1000),
      time: message.time || '',
      account,
      talker: message.talker,
      name: message.name || message.talker,
      text: String(message.text ?? '').slice(0, 120),
      reason,
    })
    state.skips = state.skips.slice(0, MAX_SKIPS)
  }

  async function openSession(key, peer) {
    const existing = state.sessions[key]
    if (existing) {
      await ensureSession(existing, peer)
      return existing
    }
    const sessionId = await createSession(peer.name || peer.talker, peer)
    state.sessions[key] = sessionId
    save()
    const controller = getController()
    try {
      await controller?.rename({ sessionId, title: `PC微信 · ${peer.name || peer.talker}` })
    } catch {
      // A deployment without the title service still gets a working session.
    }
    return sessionId
  }

  /** Transcribe one voice message, downloading the model once when it is missing. */
  async function transcribeVoice(message, account) {
    if (!message.voice_path) {
      return { ok: false, error_code: 'voice_unavailable', detail: '语音文件不在本地' }
    }
    const request = {
      talker: message.talker,
      local_id: message.local_id,
      ts: message.ts,
      ...(account ? { account } : {}),
    }
    try {
      let answer = await callJson('transcribe_voice', request)
      if (answer?.ok !== false && typeof answer?.text === 'string') return answer
      if (voiceAutoDownload && answer?.error_code === 'asr_unavailable') {
        log('watch: downloading the local voice model')
        await callJson('wechat_voice_model', { action: 'download' })
        // The download runs in the sidecar's background thread; wait for it here
        // instead of blocking the sidecar's request loop.
        for (let attempt = 0; attempt < 40; attempt += 1) {
          await sleep(3_000)
          const status = await callJson('wechat_voice_model', { action: 'status' })
          if (status?.download?.error) {
            return { ok: false, detail: `语音模型下载失败：${status.download.error}` }
          }
          if (status?.ok === true) {
            answer = await callJson('transcribe_voice', request)
            break
          }
        }
      }
      return answer
    } catch (error) {
      return { ok: false, detail: String(error?.message ?? error) }
    }
  }

  /**
   * Turn a batch into the compact user message the agent sees: one header line
   * with the peer and policy, then the raw message lines. Voice is transcribed
   * and images are attached as native image parts, so the agent does not need
   * extra tool calls to understand them.
   */
  async function prepareBatch(peer, batch, decision) {
    const images = []
    let imageBytes = 0
    for (const message of batch) {
      // Deliveries retry the same batch; always rebuild the line from the
      // original text so a failure cannot append the same note again.
      if (message.base_text === undefined) message.base_text = message.text ?? ''
      const base = collapseRepeats(message.base_text)
      message.text = base
      if (message.type === 34) {
        const answer = await transcribeVoice(message, message.account || peer.account)
        message.text = answer?.ok !== false && typeof answer?.text === 'string' && answer.text
          ? `[语音] ${answer.text}`
          : `[语音，未能转写：${answer?.detail || answer?.hint || answer?.reason || '未知原因'}]`
      }
      if (message.type === 3) {
        if (images.length >= maxImages) {
          message.text = `${base || '[图片]'}（图片未附加：单批最多 ${maxImages} 张）`
          continue
        }
        let buffer = null
        let mediaType = ''
        if (message.image_path) {
          try {
            const candidate = readFileSync(message.image_path)
            if (candidate.length > 0) {
              buffer = candidate
              mediaType = imageMediaType(candidate)
            }
          } catch {
            // fall through to read_image
          }
        }
        if (buffer === null && typeof readImage === 'function') {
          // poll_new only adds image_path when the decrypted file is already on
          // disk; read_image resolves the message's local_id directly.
          const answer = await readImage(
            peer.account,
            message.talker,
            message.local_id,
            message.ts,
          ).catch(() => ({ image: null, text: '' }))
          if (answer?.image) {
            buffer = Buffer.from(answer.image.data, 'base64')
            mediaType = answer.image.mediaType || imageMediaType(buffer)
            if (answer.text) message.text = `${base || '[图片]'}（${answer.text}）`
          }
        }
        if (buffer === null || buffer.length === 0) {
          message.text = `${base || '[图片]'}（图片未能读取）`
          continue
        }
        if (!mediaType) {
          message.text = `${base || '[图片]'}（图片格式不支持）`
          continue
        }
        if (imageBytes + buffer.length > maxImageBytes) {
          message.text = `${base || '[图片]'}（图片未附加：单批图片体积上限）`
          continue
        }
        images.push({
          type: 'image',
          mediaType,
          data: buffer.toString('base64'),
          name: message.image_name || 'wechat-image',
        })
        imageBytes += buffer.length
      }
      if (message.type === 43) {
        message.text = message.text === '[视频]' ? '[视频]' : `${message.text || '[视频]'}`
      }
    }
    const mode = decision.mode === 'auto' ? '直接代回' : '起草'
    const autoDistill = decision.mode === 'auto'
      && !isTrustedChannel(peer.talker, peer.account)
      && isAutoDistill()
    const who = peer.name && peer.name !== peer.talker ? `${peer.name}（${peer.talker}）` : peer.talker
    const header = `[${who}${peer.account ? ` · 账号 ${peer.account}` : ''} · ${mode}${autoDistill ? ' · 自动蒸馏' : ''}]`
    const lines = batch.map((message) => {
      const at = message.at_me ? '（@我）' : ''
      return `${message.time || message.ts} ${message.text || '(无文字内容)'}${at}`
    })
    return { text: [header, ...lines].join('\n'), images }
  }

  async function deliver(key, batch, decision) {
    const peer = peerOf(key)
    const first = batch[0]
    peer.name = first?.name || peer.name
    const controller = getController()
    if (!controller) {
      log(`watch: no session controller; ${batch.length} message(s) for ${peer.talker} stay queued`)
      lastDeliveryError = 'DSH 会话服务不可用'
      state.lastError = lastDeliveryError
      scheduler.retry(key, batch, decision)
      save()
      return
    }
    try {
      const prepared = await prepareBatch(peer, batch, decision)
      // Both calls should answer quickly (create a session, enqueue a prompt);
      // a hung service must fail this delivery so the batch is retried instead
      // of disappearing once the awaiting window expires.
      const sessionId = await withTimeout(openSession(key, peer), 30_000, '建立会话')
      // The bound reply tool only sends when the batch explicitly allows it,
      // and the session prompt is refreshed with the latest distilled profiles.
      await prepareSession(sessionId, decision.mode === 'auto' ? 'auto' : 'draft', peer)
      await withTimeout(controller.prompt({
        requestId: randomUUID(),
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: prepared.text }, ...prepared.images],
      }, new AbortController().signal), 30_000, '交付消息')
      // A draft is already the response the user reviews, so its cooldown starts at
      // delivery. An auto reply starts it when send_text actually succeeds.
      if (decision.mode === 'draft') scheduler.reply(key)
      lastError = ''
      lastDeliveryError = ''
      state.lastError = ''
      lastDelivery = {
        at: Date.now(),
        sessionId,
        name: peer.name || peer.talker,
        talker: peer.talker,
        count: batch.length,
        mode: decision.mode,
      }
      state.lastDelivery = lastDelivery
      log(`watch: delivered ${batch.length} message(s) from ${peer.name || peer.talker} to ${sessionId}`)
    } catch (error) {
      // A deleted session is re-created on the next batch; keep the messages queued.
      if (String(error?.message ?? error).includes('not-found')) delete state.sessions[key]
      lastDeliveryError = String(error?.message ?? error)
      state.lastError = lastDeliveryError
      log(`watch: delivery failed for ${peer.talker}: ${lastDeliveryError}`)
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
      // `poll_new` normally tags every message with its account; keep the
      // trusted-channel check working if an older sidecar omits it.
      if (!message.account) message.account = account
      const key = `${account}|${talker}`
      if (message.agent_sent === true) continue
      // Writing to yourself or 文件传输助手 is how the owner talks to the
      // assistant; from_me there is the input, not an answer to someone else.
      if (message.from_me === true && !isTrustedChannel(talker, account)) {
        // The user answered from their own phone: cancel the pending auto-reply.
        scheduler.userSpoke(key)
        skip(account, message, 'from_me')
        changed = true
        continue
      }
      const decision = decideMessage(rules, message)
      if (decision.action === 'notify') {
        notify(account, message)
        changed = true
        continue
      }
      if (decision.action === 'drop') {
        skip(account, message, decision.reason)
        changed = true
        continue
      }
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

  /**
   * Watch the WeChat connection itself, not just messages: a closed WeChat or a
   * missing data directory is a user-actionable error, not a silent empty poll.
   */
  async function checkConnection(force = false) {
    const ttl = connection.ok ? 60_000 : 10_000
    if (!force && Date.now() - connection.at < ttl) return connection.ok
    connection = { at: Date.now(), ok: true }
    try {
      const env = await callJson('check_env')
      if (env?.weixin_running !== true) {
        connection.ok = false
        lastError = '微信未运行：请打开并登录微信'
      } else if (env?.db_ok !== true) {
        connection.ok = false
        lastError = '找不到微信数据目录：确认微信已登录'
      } else if (env?.deps?.ok !== true) {
        connection.ok = false
        lastError = '缺少依赖：需要 pycryptodome 与 zstandard'
      } else if (/微信未运行|数据目录|缺少依赖/.test(lastError)) {
        lastError = ''
      }
    } catch (error) {
      connection.ok = false
      lastError = `读取微信环境失败：${String(error?.message ?? error)}`
    }
    return connection.ok
  }

  async function tick(force = false) {
    if ((!running && !force) || ticking) return
    ticking = true
    lastTickAt = Date.now()
    try {
      if (!(await checkConnection())) {
        save()
        return
      }
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
        lastError: lastError || lastDeliveryError,
        lastDeliveryError,
        connection,
        lastDelivery,
        pending: scheduler.snapshot().map((peer) => ({
          key: peer.key,
          count: peer.messages.length,
          cooldownUntil: peer.cooldownUntil,
          awaitingUntil: peer.awaitingUntil,
          cooldownMs: peer.cooldownMs,
        })),
        notifications: state.notifications.slice(0, 20),
        skips: state.skips.slice(0, 10),
      }
    },
  }
}