import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { spawn, execFile, execFileSync } from 'node:child_process'
import { readdir, readFile, copyFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { createStore } from './lib/db.js'
import { createCli, defaultPrefix } from './lib/cli.js'
 import { createIm } from './lib/im.js'
import { findItemId, findOrderId, latestBuyerText } from './lib/conversation.js'
import { createGuard } from './lib/guard.js'
import { createDispatcher } from './lib/dispatch.js'
import { createAi, stripFrontmatter } from './lib/ai.js'
import { createDshAgent } from './lib/agent.js'
import { createXianyuTools } from './lib/tools.js'

export const name = 'vyra-xianyu-delivery'
export const inject = ['tools', 'agents']

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

export function apply(ctx, config = {}) {
  const cfg = {
    pollSeconds: 60,
    mode: 'send_then_confirm',
    blockRefund: true,
    blockZeroAmount: true,
    sendIntervalMs: 60000,
    chatPollSeconds: 15,
    dataFile: join(homedir(), '.dsh', 'xianyu-delivery', 'data.sqlite'),
    cliCommand: 'uv',
    cliPrefix: undefined, // 默认用 lib/cli.js 里的 worker 路径
    ...config,
  }

  const log = (msg) => {
    try {
      if (ctx.logger?.info) ctx.logger.info(`xianyu-delivery: ${msg}`)
      else console.log(`xianyu-delivery: ${msg}`)
    } catch {
      // 日志失败不影响发货
    }
  }

  const store = createStore(cfg.dataFile)
  const cli = createCli({ command: cfg.cliCommand, prefix: cfg.cliPrefix })
  // 常驻 IM 通道：chats/history/send 复用一条连接，不再每条命令起一个新进程。
  const im = createIm({ command: cfg.cliCommand || 'uv', prefix: cfg.cliPrefix ?? defaultPrefix(), logger: log })

  // 切账号后 cookie 变了，必须重建 IM 连接。
  async function restartIm() {
    try {
      await im.restart()
    } catch (err) {
      log(`IM 重启失败：${err?.message || err}`)
    }
  }
  const guard = createGuard({ minIntervalMs: cfg.sendIntervalMs })
  const account = () => String(authCache.unb || selfUserId || '')
  // 生成型卡券的实现在 dshAgent 之后才能确定，这里先留一个间接调用。
  let generateLinkImpl = null
  const dispatcher = createDispatcher({
    store, cli, im, guard, config: cfg, logger: log,
    getAccount: account,
    generateLink: (args) => generateLinkImpl(args),
  })
  // 把闲鱼能力注册成主 Agent 可调用的工具。
  const xianyuTools = createXianyuTools({ cli, im, store, dispatcher, getAccount: account })
  ctx.effect(() => {
    const disposers = xianyuTools.map((def) => ctx.tools.register(def))
    return () => { for (const dispose of disposers) dispose() }
  }, 'xianyu-delivery.tools')

  // 服务按需现取：apply 时 agents 可能还没注册。
  const getService = (name) => (typeof ctx.get === 'function' ? ctx.get(name) : undefined)
  // 闲鱼客服会话统一落在这个目录：DSH 侧栏按工作区分组，于是有了独立分组。
  const csWorkspace = join(homedir(), '.dsh', '闲鱼客服')
  mkdir(csWorkspace, { recursive: true }).catch(() => {})

  // DSH 侧栏的分组来自 workspaceRegistry：只放 meta.cwd 不注册工作区，
  // 会话会先出现在「未分组」再消失。这里注册一个「闲鱼客服」工作区并挂会话。
  let csWorkspaceHandle = null
  let csWorkspacePromise = null
  function ensureCsWorkspace() {
    if (csWorkspaceHandle) return Promise.resolve(csWorkspaceHandle)
    if (!csWorkspacePromise) {
      csWorkspacePromise = (async () => {
        const registry = getService('workspaceRegistry')
        if (!registry?.create) throw new Error('workspaceRegistry 不可用')
        const handle = await registry.create(csWorkspace, '闲鱼客服')
        csWorkspaceHandle = handle
        log('闲鱼客服工作区已注册')
        return handle
      })().catch((err) => {
        csWorkspacePromise = null
        throw err
      })
    }
    return csWorkspacePromise
  }

  // 工作区随服务就绪再注册，失败就等下一轮。
  ctx.effect(() => {
    let stopped = false
    let timer = null
    const tryCreate = async () => {
      if (stopped) return
      try {
        await ensureCsWorkspace()
        if (timer) clearInterval(timer)
        timer = null
      } catch {
        // 服务还没注册好，继续等
      }
    }
    timer = setInterval(() => { void tryCreate() }, 1000)
    void tryCreate()
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
    }
  }, 'xianyu-delivery.workspace')
  const dshAgent = createDshAgent({
    getAgents: () => getService('agents'),
    sessionTitle: getService('sessionTitle'),
    config: cfg,
    logger: log,
    getPreset: () => store.getSetting('ai.agentPreset') || String(cfg.ai?.agentPreset || ''),
    workspaceCwd: csWorkspace,
    // 插件建的会话不会继承默认模型，从 DSH 的默认选择里取。
    getDefaultModel: () => {
      try {
        return getService('agentDefaultModel')?.currentSelection?.()
      } catch {
        return null
      }
    },
    // 建完/续写完把会话挂到「闲鱼客服」工作区，侧栏才会分组显示。
    attachSession: async (sessionId) => {
      const ws = await ensureCsWorkspace().catch(() => null)
      if (ws?.attachSession) await ws.attachSession(sessionId)
    },
    // 官方改名接口：sessionController.rename({ sessionId, title })。
    renameSession: async (sessionId, title) => {
      const controller = getService('sessionController')
      if (!controller?.rename) return false
      return await controller.rename({ sessionId, title })
    },
  })

  // 生成型卡券：让 Agent 按网盘技能当场做一条新分享链接。
  const QUARK_SKILL = join(fileURLToPath(new URL('.', import.meta.url)), 'builtin-skills', 'quarkclouddrive', 'SKILL.md')
  generateLinkImpl = async ({ orderNo, buyerNick, card }) => {
    let skill = ''
    try {
      skill = stripFrontmatter(await readFile(QUARK_SKILL, 'utf8'))
    } catch {
      skill = ''
    }
    const prompt = [
      skill,
      `买家下单了（订单 ${orderNo}${buyerNick ? `，买家 ${buyerNick}` : ''}）。`,
      '请按上面的网盘技能生成一条新的分享链接：有效期 7 天、仅一次有效。',
      '把最终结果整理成两行：链接：<url> 和 提取码：<code>（没有提取码就只输出链接）。',
      '调用 send_buyer_reply 交出来，不要解释过程。',
    ].filter(Boolean).join('\n\n')
    const result = await dshAgent.ask({
      prompt,
      sessionKey: 'gen',
      title: `[网盘] ${orderNo}`,
      model: null,
    })
    const text = String(result?.text || '')
    if (!text) throw new Error(result?.error || 'generate empty')
    return text.trim()
  }
  const ai = createAi({
    config: cfg,
    store,
    agent: dshAgent,
    logger: log,
    toolNames: xianyuTools.map((tool) => tool.name),
    // 和技能列表用同一组目录，避免「面板里能选、Agent 读不到」。
    skillRoots: [
      String(cfg.ai?.skillsDir || join(homedir(), '.dsh', 'skills')),
      join(homedir(), '.dsh', 'market', 'skills'),
      join(homedir(), '.agents', 'skills'),
      join(homedir(), '.claude', 'skills'),
      fileURLToPath(new URL('./builtin-skills', import.meta.url)),
    ],
  })
  let selfUserId = ''
  let authCache = { loading: true, unb: '', tracknick: '', valid: false, checkedAt: 0 }
  const eventCooldown = new Map()
  // 最近的消息处理记录，面板用它诊断「发了消息为什么没回」。
  const eventLog = []
  function recordEvent(entry) {
    eventLog.unshift({ at: new Date().toLocaleTimeString(), ...entry })
    if (eventLog.length > 60) eventLog.pop()
  }

  // 自己的 unb 用来区分"买家发的"和"自己发的"。
  cli.status().then((s) => { selfUserId = String(s?.unb || '') }).catch(() => {})
  // 启动时就填好登录态缓存，tick 才不会在拿到账号前写共享数据。
  void authSnapshot()

  function firstLine(md) {
    const text = String(md || '')
    const fm = text.match(/^---\s*\n([\s\S]*?)\n---/m)
    if (fm) {
      const line = fm[1].match(/description:\s*(.+)/)
      if (line) return line[1].trim().replace(/^['"]|['"]$/g, '')
    }
    const plain = text.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith('#'))
    return plain ? plain.trim().slice(0, 120) : ''
  }

  async function listSkills() {
    const roots = [
      String(cfg.ai?.skillsDir || join(homedir(), '.dsh', 'skills')),
      join(homedir(), '.dsh', 'market', 'skills'),
      join(homedir(), '.agents', 'skills'),
      join(homedir(), '.claude', 'skills'),
      // 插件自带的技能（网盘、客服流程），随包分发。
      fileURLToPath(new URL('./builtin-skills', import.meta.url)),
    ]
    const out = []
    const seen = new Set()
    for (const root of roots) {
      let entries = []
      try {
        entries = await readdir(root, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (seen.has(entry.name)) continue
        try {
          if (entry.isDirectory()) {
            const dir = join(root, entry.name)
            const md = await readFile(join(dir, 'SKILL.md'), 'utf8')
            seen.add(entry.name)
            out.push({ name: entry.name, root, path: dir, description: firstLine(md) })
          } else if (entry.name.endsWith('.md')) {
            const name = entry.name.replace(/\.md$/, '')
            const file = join(root, entry.name)
            const md = await readFile(file, 'utf8')
            seen.add(entry.name)
            out.push({ name, root, path: file, description: firstLine(md) })
          }
        } catch {
          // 不是技能，跳过
        }
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }

  async function listAgents() {
    const root = join(homedir(), '.dsh', 'agent-manager', 'presets')
    let entries = []
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      return []
    }
    const out = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      try {
        const json = JSON.parse(await readFile(join(root, entry.name, 'agent.json'), 'utf8'))
        out.push({
          id: String(json.id || entry.name),
          name: String(json.name || entry.name),
          description: String(json.description || ''),
        })
      } catch {
        out.push({ id: entry.name, name: entry.name, description: '' })
      }
    }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }

  // ---- 多账号：每个账号一份 cookie，切换时覆盖 goofish-cli 的默认文件。 ----
  const cliHome = join(homedir(), '.goofish-cli')
  const accountsDir = join(cliHome, 'accounts')
  const activeCookie = join(cliHome, 'cookies.json')

  async function accountList() {
    let entries = []
    try {
      entries = await readdir(accountsDir, { withFileTypes: true })
    } catch {
      return []
    }
    const out = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.meta.json')) continue
      const unb = entry.name.replace(/\.json$/i, '')
      let nick = ''
      try {
        const meta = JSON.parse(await readFile(join(accountsDir, `${unb}.meta.json`), 'utf8'))
        nick = String(meta.tracknick || '')
      } catch {
        // 没有 meta 时只显示 unb
      }
      out.push({ unb, tracknick: nick })
    }
    return out.sort((a, b) => a.unb.localeCompare(b.unb))
  }

  async function archiveCurrent(unb, tracknick) {
    if (!unb) return
    await mkdir(accountsDir, { recursive: true })
    try {
      await copyFile(activeCookie, join(accountsDir, `${unb}.json`))
      await writeFile(
        join(accountsDir, `${unb}.meta.json`),
        JSON.stringify({ unb, tracknick: tracknick || '', savedAt: Date.now() }, null, 2),
        'utf8',
      )
    } catch (err) {
      log(`archive account failed: ${err?.message || err}`)
    }
  }

  async function switchAccount(unb) {
    if (!unb) throw new Error('缺少账号 unb')
    await copyFile(join(accountsDir, `${unb}.json`), activeCookie)
    // IM token 是按账号缓存的，换账号后必须丢掉，否则会拿旧账号的 token。
    await rm(join(cliHome, 'im_token.json'), { force: true })
    authCache = { loading: true, unb: '', tracknick: '', valid: false, checkedAt: 0 }
    handledMsg.clear()
    handledOrders.clear()
    await dshAgent.disposeAll()
    void restartIm()
    return { ok: true, unb }
  }

  async function logout() {
    await rm(activeCookie, { force: true })
    await rm(join(cliHome, 'im_token.json'), { force: true })
    authCache = { loading: false, unb: '', tracknick: '', valid: false, checkedAt: 0, error: '已退出登录' }
    selfUserId = ''
    await dshAgent.disposeAll()
    void restartIm()
    return { ok: true }
  }

  // 登录态缓存 30 秒：面板每 5 秒刷新一次，不能每次都拉起 worker。
  async function authSnapshot() {
    if (!authCache.loading && Date.now() - authCache.checkedAt < 30000) return authCache
    authCache = { ...authCache, loading: true }
    try {
      const s = await cli.status()
      selfUserId = String(s?.unb || selfUserId)
      authCache = {
        loading: false, valid: Boolean(s?.valid), unb: String(s?.unb || ''),
        tracknick: String(s?.tracknick || ''), checkedAt: Date.now(),
      }
    } catch (err) {
      authCache = {
        loading: false, valid: false, unb: '', tracknick: '',
        error: String(err?.message || err), checkedAt: Date.now(),
      }
    }
    return authCache
  }

  // 扫码登录：worker 是长进程，二维码和最终结果都以一行 JSON 流式输出。
  let loginProc = null
  let loginState = { state: 'idle' }

  function startLogin(timeoutSeconds = 180) {
    if (loginProc) return loginState
    loginState = { state: 'starting' }
    const prefix = cfg.cliPrefix ?? defaultPrefix()
    let child
    try {
      child = spawn(cfg.cliCommand, [...prefix, 'login-qr', JSON.stringify({ timeout: timeoutSeconds })], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1', PYTHONIOENCODING: 'utf-8' },
      })
    } catch (err) {
      loginState = { state: 'error', message: String(err?.message || err) }
      return loginState
    }

    loginProc = child
    let stderr = ''
    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const msg = JSON.parse(line)
        if (msg.event === 'qr') loginState = { state: 'waiting', qr: msg.image }
        else if (msg.event === 'done') {
          loginState = { state: 'done', unb: msg.unb }
          // 扫码成功后把这个账号归档，之后可以在面板里直接切换回来。
          void authSnapshot().then((a) => archiveCurrent(msg.unb, a.tracknick))
        } else if (msg.event === 'error') loginState = { state: 'error', message: msg.message }
      } catch {
        // 非 JSON 行（uv 的提示）忽略
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + String(chunk)).slice(-2000)
    })
    child.on('exit', () => {
      if (!['done', 'error'].includes(loginState.state)) {
        loginState = { state: 'error', message: stderr.trim() || '登录进程意外退出' }
      }
      loginProc = null
    })
    return loginState
  }

  function cancelLogin() {
    if (loginProc) {
      loginProc.kill()
      loginProc = null
    }
    loginState = { state: 'idle' }
    return loginState
  }

  ctx.effect(() => () => cancelLogin(), 'xianyu-delivery.login')

  // 历史解析用纯函数，见 lib/conversation.js（可脱离 DSH 单测）。
  // 已经处理过的最新买家消息 id（每个会话），避免 new_msg 通知反复触发同一条。
  const handledMsg = new Map()
  // 插件启动时刻：比它早的消息只当作上下文，不触发自动回复。
  const pluginStartedAt = Date.now()

  async function replyToBuyer(cid, question, history, meta = {}) {
    // 会话对应的商品：会话自带的 itemId 最准，其次买家最近的订单，最后看历史卡片。
    let itemId = String(meta.itemId || '').trim()
    if (!itemId) {
      try {
        itemId = store.lastItemForBuyer(String(meta.send_user_id || ''), account()) || ''
      } catch {
        itemId = ''
      }
    }
    if (!itemId) itemId = findItemId(history)

    // 闲鱼 IM 要求首次发消息必须带 itemId，否则拒绝建立会话。
    // 没商品上下文的会话（买家从聊天列表而不是商品页发起）无法回复。
    if (!itemId) {
      recordEvent({
        cid, kind: 'text', itemId: '',
        from: String(meta.send_user_name || meta.send_user_id || ''),
        text: question.slice(0, 40),
        action: 'no-reply:no-item-context',
      })
      return false
    }

    const result = await ai.reply({
      cid, itemId, text: question, history, selfUserId,
      accountId: account(), buyerNick: String(meta.send_user_name || ''),
    })
    const answer = result?.text || ''
    if (!answer) {
      recordEvent({
        cid, kind: 'text', itemId,
        from: String(meta.send_user_name || meta.send_user_id || ''),
        text: question.slice(0, 40),
        action: `no-reply:${result?.reason || 'unknown'}`,
      })
      return false
    }

    try {
      await im.send({ toid: String(meta.send_user_id), itemId, text: answer })
      guard.recordSuccess?.()
      log(`ai replied to ${meta.send_user_name || meta.send_user_id}`)
      recordEvent({
        cid, kind: 'text', itemId,
        from: String(meta.send_user_name || meta.send_user_id || ''),
        text: question.slice(0, 40),
        action: 'replied',
      })
      return true
    } catch (err) {
      guard.recordFailure?.()
      log(`ai reply send failed: ${err?.message || err}`)
      recordEvent({
        cid, kind: 'text', itemId,
        from: String(meta.send_user_name || meta.send_user_id || ''),
        text: question.slice(0, 40),
        action: `send-failed:${err?.message || err}`,
      })
      return false
    }
  }

  async function handleImEvent(evt) {
    if (!evt || evt.event === 'error' || evt.event === 'read' || !evt.cid) return
    const cid = String(evt.cid)
    const now = Date.now()

    const messageText = String(evt.send_message || '').trim()
    // 文本消息：contentType=1，或 101（custom 包装）但解析出了文字。
    const isText = Boolean(messageText) && (evt.content_type === 1 || evt.content_type === 101)

    if (isText) {
      const fromSelf =
        String(evt.send_user_id || '') !== '' && String(evt.send_user_id) === selfUserId
      if (fromSelf) {
        recordEvent({ cid, kind: 'text', action: 'skip-self', text: messageText.slice(0, 40) })
        return
      }
      if (!ai.enabled) {
        recordEvent({ cid, kind: 'text', action: 'skip-ai-disabled', text: messageText.slice(0, 40) })
        return
      }
      if ((eventCooldown.get(cid) || 0) > now - 3000) {
        recordEvent({ cid, kind: 'text', action: 'skip-cooldown', text: messageText.slice(0, 40) })
        return
      }
      eventCooldown.set(cid, now)

      let history = []
      try {
        history = await im.history(cid, 10)
      } catch {
        // 历史拿不到也能回，只是少了上下文
      }
      await replyToBuyer(cid, messageText, history, evt)
      return
    }

    // 无正文事件：new_msg 轻量通知（只有 msg_id）、卡片、系统提示。
    if ((eventCooldown.get(cid) || 0) > now - 3000) return
    eventCooldown.set(cid, now)

    let history = []
    try {
      history = await im.history(cid, 6)
    } catch (err) {
      log(`history failed: ${err?.message || err}`)
      return
    }
    await handleConversation(cid, history, evt)
  }

  // 拉到的历史统一处理：有订单号就发货，否则回复最新一条买家提问。
  // 轮询和 watch 都走这里，保证两条路径行为一致。
  // 每个会话最近处理过的订单号：历史里那张下单卡片会一直留在后面，
  // 只要还是同一单就不再重复发货，把后面的买家消息交给 Agent。
  const handledOrders = new Map()

  async function handleConversation(cid, history, meta = {}) {
    const orderNo = findOrderId(history)
    const lastOrder = handledOrders.get(cid) || ''
    if (orderNo && orderNo !== lastOrder) {
      handledOrders.set(cid, orderNo)
      const result = await dispatcher.reconcile(orderNo)
      recordEvent({ cid, kind: 'card', orderNo, action: result ? (result.state || result.skip) : 'no-result' })
      if (result) log(`realtime delivery ${orderNo}: ${result.state || result.skip}`)
      // 不 return：同一轮里买家可能还问了话，下面继续走回复。
    }

    const latest = latestBuyerText(history, { self: selfUserId, notBefore: pluginStartedAt })
    if (!latest || !latest.text || latest.id === handledMsg.get(cid)) return
    if (!ai.enabled) {
      recordEvent({ cid, kind: 'text', action: 'skip-ai-disabled', text: latest.text.slice(0, 40) })
      return
    }
    handledMsg.set(cid, latest.id)
    await replyToBuyer(cid, latest.text, history, {
      ...meta, send_user_id: latest.userId, send_user_name: latest.nick,
    })
  }

  // 轮询会话列表：每个 CLI 调用都会新开一条 IM 连接，常驻 watch 会被踢下线，
  // 所以主路径靠轮询（watch 只是低延迟补充）。
  const lastChatTs = new Map()
  let chatPollBaseline = false

  async function pollChats() {
    // 未登录时不轮询：没有 cookie 时任何 IM 调用都只会报错。
    if (authCache.loading === false && authCache.valid === false) return
    let data
    try {
      data = await im.chats(60)
    } catch (err) {
      log(`chat poll failed: ${err?.message || err}`)
      return
    }
    const sessions = (data && data.sessions) || []
    const first = !chatPollBaseline
    chatPollBaseline = true

    for (const s of sessions) {
      const cid = String(s.session_id || '')
      if (!cid) continue
      const ts = Number(s.ts) || 0
      const seen = lastChatTs.get(cid) || 0
      if (ts && ts <= seen) continue
      lastChatTs.set(cid, ts || Date.now())
      // 启动时只记基线，避免把历史里的旧消息全部回一遍。
      if (first) continue
      let history = []
      try {
        history = await im.history(cid, 6)
      } catch (err) {
        log(`chat poll history failed: ${err?.message || err}`)
        continue
      }
      await handleConversation(cid, history, {
        itemId: String(s.item_id || ''),
        send_user_id: String(s.peer_user_id || ''),
        send_user_name: String(s.peer_nick || ''),
      })
    }
  }

  // Windows: uv 启动的 python 是子进程，只 kill 父 PID 会留下孤儿继续占着
  // 同一个 IM 连接。taskkill /T 连进程树一起结束。
  function killTree(child) {
    if (!child || child.exitCode !== null) return
    try {
      if (process.platform === 'win32') {
        execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {})
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      try { child.kill() } catch { /* 已退出 */ }
    }
  }

// 常驻 IM 通道负责收消息：serve 进程本身就是监听，推送事件直接进 handleImEvent。
  // 「实时」开关只决定要不要处理这些事件，通道本身始终保留（列表和发送都要用）。
  let watchEnabled = (store.getSetting('watch.enabled') ?? '1') !== '0'

  // 旧版本会另外起 worker.py watch 进程；升级后统一清扫一次，避免两条连接互踢。
  let legacySwept = false
  function sweepLegacyWatchers() {
    if (legacySwept || process.platform !== 'win32') return
    legacySwept = true
    const script = "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*worker.py watch*' -or $_.CommandLine -like '*worker.py serve*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    try {
      execFileSync('powershell', ['-NoProfile', '-Command', script], { timeout: 8000, windowsHide: true })
    } catch {
      // 清扫失败不影响使用
    }
  }

  ctx.effect(() => {
    sweepLegacyWatchers()
    const offEvent = im.onEvent((evt) => {
      if (!watchEnabled) return
      if (evt.event === 'read' || evt.event === 'ready') return
      handleImEvent(evt).catch((err) => log(`im event: ${err?.message || err}`))
    })
    const offDown = im.onDown(() => log('IM 通道断开，等待自动重连'))
    void im.ensure().catch((err) => log(`IM 启动失败：${err?.message || err}`))
    return () => {
      offEvent()
      offDown()
      void dshAgent.disposeAll()
      im.dispose()
    }
  }, 'xianyu-delivery.im')

  // 会话轮询：不依赖长连接，watch 被踢也能在一轮内补上。
  ctx.effect(() => {
    let timer = null
    let stopped = false
    const arm = () => {
      timer = setTimeout(async () => {
        if (stopped) return
        try {
          await pollChats()
        } catch (err) {
          log(`chat poll failed: ${err?.message || err}`)
        }
        arm()
      }, cfg.chatPollSeconds * 1000)
    }
    arm()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, 'xianyu-delivery.chat-poll')

  const status = () => ({
    config: {
      pollSeconds: cfg.pollSeconds,
      mode: cfg.mode,
      blockRefund: cfg.blockRefund,
      blockZeroAmount: cfg.blockZeroAmount,
      sendIntervalMs: cfg.sendIntervalMs,
    },
    cards: store.availableCards(),
    ai: ai.enabled,
    watch: Boolean(im.ready) && watchEnabled,
    watchEnabled,
    recentOrders: store.recentOrders(20),
  })

  // 定时轮询。首次延迟一个周期，避免插件加载时把启动拖慢。
  ctx.effect(() => {
    let timer = null
    const arm = () => {
      timer = setTimeout(async () => {
        try {
          if (authCache.loading === false && authCache.valid === false) {
            arm()
            return
          }
          await dispatcher.tick()
        } catch (err) {
          log(`xianyu-delivery tick failed: ${err?.message || err}`)
        }
        arm()
      }, cfg.pollSeconds * 1000)
    }
    arm()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, 'xianyu-delivery.poll')

  ctx.inject(['webServer'], (owner) => {
    owner.effect(
      () =>
        owner.webServer.register({
          kind: 'exact',
          path: '/api/xianyu-delivery/rpc',
          handler: async (req, res) => {
            let payload
            try {
              const body = await readJson(req)
              payload = { ok: true, data: await dispatch(body) }
            } catch (err) {
              payload = { ok: false, error: friendlyError(err) }
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            })
            res.end(JSON.stringify(payload))
          },
        }),
      'xianyu-delivery.route',
    )
  })

  // 把底层的英文/错误码翻成面板能照着做的提示。
  function friendlyError(err) {
    const raw = String(err?.message || err || '')
    if (/FAIL_SYS_TOKEN_EXOIRED|FAIL_SYS_TOKEN_EMPTY|令牌过期/i.test(raw)) {
      return '登录已过期：令牌失效，请点顶部的「扫码登录」重新授权'
    }
    if (/FAIL_SYS_SESSION_EXPIRED|未登录|AuthRequired|请先登录/i.test(raw)) {
      return '未登录：请点顶部的「扫码登录」'
    }
    if (/has no provider\/model/i.test(raw)) {
      return '没有可用模型：请在 DSH 设置里选择一个默认模型，或在客服配置里指定 provider:model'
    }
    if (/generate|网盘/i.test(raw) && /empty-reply|agent-unavailable/.test(raw)) {
      return `生成失败：${raw}`
    }
    return raw
  }

  async function dispatch(body) {
    switch (String(body.op || '')) {
      case 'status':
        return status()
      case 'orders':
        return store.recentOrders(Number(body.limit) || 50, account())
      case 'deliveries':
        return store.recentDeliveries(Number(body.limit) || 100, account())
      case 'cards':
        return store.listCards(account())
      case 'updateCard':
        store.updateCard(Number(body.id), {
          name: body.name,
          content: body.content,
          template: body.template,
          specName: body.specName,
          specValue: body.specValue,
          enabled: body.enabled,
          mode: body.mode,
        })
        return { ok: true }
      case 'deleteCard':
        store.deleteCard(Number(body.id))
        return { ok: true }
      case 'addCard':
        return {
          id: store.addCard({
            accountId: account(),
            itemId: String(body.itemId || ''),
            specName: String(body.specName || ''),
            specValue: String(body.specValue || ''),
            name: String(body.name || 'default'),
            type: String(body.type || 'data'),
            content: String(body.content || ''),
            template: String(body.template || ''),
            delaySeconds: Number(body.delaySeconds) || 0,
            mode: ['pool', 'reuse', 'generate'].includes(String(body.mode)) ? String(body.mode) : 'pool',
          }),
        }
      case 'tick':
        return dispatcher.tick()
      case 'setWatch': {
        watchEnabled = Boolean(body.enabled)
        store.setSetting('watch.enabled', watchEnabled ? '1' : '0')
        if (watchEnabled) void im.ensure().catch((err) => log(`IM 启动失败：${err?.message || err}`))
        return { watch: Boolean(im.ready) && watchEnabled, watchEnabled }
      }
      case 'login-start':
        return startLogin(Number(body.timeout) || 180)
      case 'login-status':
        return loginState
      case 'login-cancel':
        return cancelLogin()
      case 'itemLinks':
        return store.listItems(account())
      case 'setItem':
        store.setItem({
          accountId: account(),
          itemId: String(body.itemId || ''),
          title: String(body.title || ''),
          knowledge: String(body.knowledge || ''),
          skills: String(body.skills || ''),
          aiEnabled: body.aiEnabled ? 1 : 0,
        })
        return { ok: true }
      case 'ai-status':
        return { enabled: ai.enabled, model: cfg.ai?.model || '', watch: Boolean(im.ready) && watchEnabled }
      case 'auth':
        return authSnapshot()
      case 'accounts':
        return accountList()
      case 'switchAccount':
        return switchAccount(String(body.unb || ''))
      case 'logout':
        return logout()
      case 'shopItems':
        return cli.items(Number(body.limit) || 50)
      case 'remoteOrders': {
        const page = await cli.soldList(1, String(body.queryCode || 'ALL'))
        const local = new Map(store.recentOrders(500, account()).map((o) => [o.order_no, o]))
        return {
          total: page.total,
          orders: (page.orders || []).map((o) => {
            const l = local.get(o.order_no)
            return {
              ...o,
              local_state: l ? l.state : '',
              delivered: l ? l.delivered : 0,
              fail_reason: l ? l.fail_reason : '',
              updated_at: l ? l.updated_at : '',
            }
          }),
        }
      }
      case 'chats':
        return im.chats(Number(body.fetchNum) || 200)
      case 'userInfo':
        return cli.userInfo(String(body.cid || ''), Boolean(body.owner))
      case 'itemDetail':
        return cli.itemDetail(String(body.itemId || ''))
      case 'orderDetail':
        return cli.orderDetail(String(body.orderId || ''))
      case 'history':
        return im.history(String(body.cid || ''), Number(body.limit) || 20)
      case 'sendMessage':
        await cli.send({
          cid: String(body.cid || '0'),
          toid: String(body.toid || ''),
          itemId: String(body.itemId || ''),
          text: String(body.text || ''),
        })
        return { ok: true }
      case 'skills':
        return listSkills()
      case 'agents':
        return listAgents()
      case 'openSkillDir': {
        const name = String(body.name || '')
        const hit = (await listSkills()).find((s) => s.name === name)
        if (!hit || !hit.path) throw new Error('技能不存在')
        // explorer 直接 spawn 在部分环境里不会弹窗；md 文件用 /select 定位，
        // 目录用 cmd start 打开，两者都经过 shell 解析。
        if (hit.path.endsWith('.md')) {
          spawn('explorer', [`/select,${hit.path}`], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
        } else {
          spawn('cmd', ['/c', 'start', '', hit.path], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
        }
        return { ok: true }
      }
      case 'services':
        return store.listServices()
      case 'saveService':
        return { id: store.saveService({
          id: Number(body.id) || 0,
          name: String(body.name || '未命名客服'),
          systemPrompt: String(body.systemPrompt || ''),
          skills: String(body.skills || ''),
          model: String(body.model || ''),
          autoDeliver: body.autoDeliver !== false,
          deliverTemplate: String(body.deliverTemplate || ''),
          tools: String(body.tools || ''),
          enabled: body.enabled !== false,
        }) }
      case 'deleteService':
        store.deleteService(Number(body.id))
        return { ok: true }
      case 'setItemService':
        store.setItemService(String(body.itemId || ''), Number(body.serviceId) || 0, account())
        return { ok: true }
      case 'models': {
        const llm = typeof ctx.get === 'function' ? ctx.get('llm') : undefined
        if (!llm?.listProviders) return []
        const out = []
        for (const providerInfo of llm.listProviders()) {
          try {
            const models = await llm.listModels(providerInfo.id)
            for (const model of models) {
              out.push({
                provider: providerInfo.id,
                id: model.id,
                name: model.name || model.id,
                description: model.description || '',
              })
            }
          } catch {
            // 单个 provider 读不到就跳过
          }
        }
        return out
      }
      case 'events':
        return eventLog
      case 'settings':
        return {
          agentPreset: store.getSetting('ai.agentPreset') || String(cfg.ai?.agentPreset || '') || 'builtin',
          aiEnabled: ai.enabled,
          aiMode: String(cfg.ai?.mode || (dshAgent.available ? 'dsh' : 'api')),
          agentAvailable: dshAgent.available,
          builtin: dshAgent.builtin,
          tools: xianyuTools.map((tool) => ({ name: tool.name, description: tool.description })),
        }
      case 'setSetting':
        store.setSetting(String(body.key || ''), String(body.value ?? ''))
        return { ok: true }
      default:
        throw new Error(`unknown operation "${body.op}"`)
    }
  }
}
