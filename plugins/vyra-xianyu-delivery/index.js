import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { spawn, execFile } from 'node:child_process'
import { readdir, readFile, copyFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { createStore } from './lib/db.js'
import { createCli, defaultPrefix } from './lib/cli.js'
import { createGuard } from './lib/guard.js'
import { createDispatcher } from './lib/dispatch.js'
import { createAi } from './lib/ai.js'
import { createDshAgent } from './lib/agent.js'
import { createXianyuTools } from './lib/tools.js'

export const name = 'vyra-xianyu-delivery'
export const inject = ['tools']

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
  const guard = createGuard({ minIntervalMs: cfg.sendIntervalMs })
  const account = () => String(authCache.unb || selfUserId || '')
  const dispatcher = createDispatcher({
    store, cli, guard, config: cfg, logger: log,
    getAccount: account,
  })
  // 把闲鱼能力注册成主 Agent 可调用的工具。
  const xianyuTools = createXianyuTools({ cli, store, dispatcher, getAccount: account })
  ctx.effect(() => {
    const disposers = xianyuTools.map((def) => ctx.tools.register(def))
    return () => { for (const dispose of disposers) dispose() }
  }, 'xianyu-delivery.tools')

  const agents = typeof ctx.get === 'function' ? ctx.get('agents') : undefined
  const sessionTitle = typeof ctx.get === 'function' ? ctx.get('sessionTitle') : undefined
  const dshAgent = createDshAgent({
    agents,
    sessionTitle,
    config: cfg,
    logger: log,
    getPreset: () => store.getSetting('ai.agentPreset') || String(cfg.ai?.agentPreset || ''),
  })
  const ai = createAi({
    config: cfg,
    store,
    agent: dshAgent,
    logger: log,
    toolNames: xianyuTools.map((tool) => tool.name),
  })
  let selfUserId = ''
  let authCache = { loading: true, unb: '', tracknick: '', valid: false, checkedAt: 0 }
  let watchProc = null
  let watchRetry = null
  let watchBackoff = 1000
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
    stopWatch()
    setTimeout(() => startWatch(), 600)
    return { ok: true, unb }
  }

  async function logout() {
    await rm(activeCookie, { force: true })
    await rm(join(cliHome, 'im_token.json'), { force: true })
    authCache = { loading: false, unb: '', tracknick: '', valid: false, checkedAt: 0, error: '已退出登录' }
    selfUserId = ''
    stopWatch()
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

  // ---- ImWatch：实时监听。轮询保留为兜底。 ----
  function findOrderId(messages) {
    for (const m of messages || []) {
      const tip = m?.message?.tip?.argInfo?.args
      if (tip && tip.orderId) return String(tip.orderId)
      const card = m?.message?.dxCard?.item?.main?.clickParam?.args
      if (card && card.orderId) return String(card.orderId)
    }
    return ''
  }

  // 会话里的商品卡片会带 itemId（字段或 targetUrl 两种形态），没下单也能定位商品。
  function findItemId(messages) {
    for (const m of messages || []) {
      const raw = JSON.stringify(m?.message || {})
      const direct = raw.match(/"itemId"\s*:\s*"?(\d{6,})"?/)
      if (direct) return direct[1]
      const fromUrl = raw.match(/itemId=(\d{6,})/)
      if (fromUrl) return fromUrl[1]
    }
    return ''
  }

  async function handleImEvent(evt) {
    if (!evt || evt.event === 'error' || !evt.cid) return
    const cid = String(evt.cid)
    const fromSelf =
      String(evt.send_user_id || '') !== '' && String(evt.send_user_id) === selfUserId
    const now = Date.now()

    const messageText = String(evt.send_message || '').trim()
    // 文本消息：contentType=1，或 101（custom 包装）但解析出了文字。
    // 只有真正的卡片/系统提示才走发货分支。
    const isText = Boolean(messageText) && (evt.content_type === 1 || evt.content_type === 101)

    // 卡片 / 系统提示：可能是付款通知，拉最近消息找订单号后立即发货。
    if (!isText) {
      if ((eventCooldown.get(cid) || 0) > now - 3000) return
      eventCooldown.set(cid, now)
      let history = []
      try {
        history = await cli.history(cid, 6)
      } catch (err) {
        log(`history failed: ${err?.message || err}`)
        return
      }
      const orderNo = findOrderId(history)
      if (orderNo) {
        const result = await dispatcher.reconcile(orderNo)
        recordEvent({ cid, kind: 'card', orderNo, action: result ? (result.state || result.skip) : 'no-result' })
        if (result) log(`realtime delivery ${orderNo}: ${result.state || result.skip}`)
      } else {
        recordEvent({ cid, kind: `card:${evt.content_type}`, orderNo: '', action: 'no-order' })
      }
      return
    }

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

    const question = messageText
    if (!question) return

    let history = []
    try {
      history = await cli.history(cid, 10)
    } catch {
      // 历史拿不到也能回，只是少了上下文
    }

    // 会话对应的商品：优先买家最近的订单，其次会话消息里的商品卡片。
    let itemId = ''
    try {
      itemId = store.lastItemForBuyer(String(evt.send_user_id || ''), account()) || ''
    } catch {
      itemId = ''
    }
    if (!itemId) itemId = findItemId(history)

    const result = await ai.reply({
      cid, itemId, text: question, history, selfUserId,
      accountId: account(), buyerNick: String(evt.send_user_name || ''),
    })
    const answer = result?.text || ''
    recordEvent({
      cid, kind: 'text', itemId,
      from: String(evt.send_user_name || evt.send_user_id || ''),
      text: question.slice(0, 40),
      action: answer ? 'replied' : `no-reply:${result?.reason || 'unknown'}`,
    })
    if (!answer) return

    try {
      await cli.send({ toid: String(evt.send_user_id), itemId, text: answer })
      guard.recordSuccess?.()
      log(`ai replied to ${evt.send_user_name || evt.send_user_id}`)
    } catch (err) {
      guard.recordFailure?.()
      log(`ai reply send failed: ${err?.message || err}`)
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

  // 插件重载后旧实例的 watch 进程会活下来，多开几个就会互相把 IM 连接踢掉。
  let staleSwept = false
  function sweepStaleWatchers() {
    if (staleSwept || process.platform !== 'win32') return
    staleSwept = true
    const script = "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*vyra-xianyu-delivery*worker.py watch*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    execFile('powershell', ['-NoProfile', '-Command', script], () => {})
  }

  function startWatch() {
    if (watchProc || watchRetry || cfg.watchEnabled === false) return
    sweepStaleWatchers()
    const prefix = cfg.cliPrefix ?? defaultPrefix()
    let child
    try {
      child = spawn(cfg.cliCommand, [...prefix, 'watch', '{}'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1', PYTHONIOENCODING: 'utf-8' },
      })
    } catch (err) {
      log(`watch spawn failed: ${err?.message || err}`)
      return
    }
    watchProc = child
    watchBackoff = 1000
    createInterface({ input: child.stdout }).on('line', (line) => {
      let evt
      try {
        evt = JSON.parse(line)
      } catch {
        return
      }
      handleImEvent(evt).catch((err) => log(`watch handler: ${err?.message || err}`))
    })
    child.on('exit', () => {
      watchProc = null
      if (cfg.watchEnabled === false) return
      watchRetry = setTimeout(() => {
        watchRetry = null
        startWatch()
      }, watchBackoff)
      watchBackoff = Math.min(watchBackoff * 2, 60000)
    })
  }

  function stopWatch() {
    if (watchRetry) {
      clearTimeout(watchRetry)
      watchRetry = null
    }
    if (watchProc) {
      killTree(watchProc)
      watchProc = null
    }
  }

  ctx.effect(() => {
    startWatch()
    return () => stopWatch()
  }, 'xianyu-delivery.watch')

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
    watch: Boolean(watchProc),
    recentOrders: store.recentOrders(20),
  })

  // 定时轮询。首次延迟一个周期，避免插件加载时把启动拖慢。
  ctx.effect(() => {
    let timer = null
    const arm = () => {
      timer = setTimeout(async () => {
        try {
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
              payload = { ok: false, error: String(err?.message || err) }
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
          }),
        }
      case 'tick':
        return dispatcher.tick()
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
        return { enabled: ai.enabled, model: cfg.ai?.model || '', watch: Boolean(watchProc) }
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
        return cli.chats(Number(body.fetchNum) || 200)
      case 'userInfo':
        return cli.userInfo(String(body.cid || ''), Boolean(body.owner))
      case 'itemDetail':
        return cli.itemDetail(String(body.itemId || ''))
      case 'orderDetail':
        return cli.orderDetail(String(body.orderId || ''))
      case 'history':
        return cli.history(String(body.cid || ''), Number(body.limit) || 20)
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
