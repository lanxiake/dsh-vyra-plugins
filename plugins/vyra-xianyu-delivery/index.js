import { join } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { createStore } from './lib/db.js'
import { createCli, defaultPrefix } from './lib/cli.js'
import { createGuard } from './lib/guard.js'
import { createDispatcher } from './lib/dispatch.js'
import { createAi } from './lib/ai.js'

export const name = 'vyra-xianyu-delivery'
export const inject = []

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
  const dispatcher = createDispatcher({ store, cli, guard, config: cfg, logger: log })
  const ai = createAi({ config: cfg, store, logger: log })
  let selfUserId = ''
  let watchProc = null
  let watchRetry = null
  let watchBackoff = 1000
  const eventCooldown = new Map()

  // 自己的 unb 用来区分"买家发的"和"自己发的"。
  cli.status().then((s) => { selfUserId = String(s?.unb || '') }).catch(() => {})

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
        else if (msg.event === 'done') loginState = { state: 'done', unb: msg.unb }
        else if (msg.event === 'error') loginState = { state: 'error', message: msg.message }
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

  async function handleImEvent(evt) {
    if (!evt || evt.event === 'error' || !evt.cid) return
    const cid = String(evt.cid)
    const fromSelf =
      String(evt.send_user_id || '') !== '' && String(evt.send_user_id) === selfUserId
    const now = Date.now()

    // 卡片 / 系统提示：可能是付款通知，拉最近消息找订单号后立即发货。
    if (evt.content_type !== 1) {
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
        if (result) log(`realtime delivery ${orderNo}: ${result.state || result.skip}`)
      }
      return
    }

    if (fromSelf) return
    if (!ai.enabled) return
    if ((eventCooldown.get(cid) || 0) > now - 3000) return
    eventCooldown.set(cid, now)

    const question = String(evt.send_message || '').trim()
    if (!question) return

    let history = []
    try {
      history = await cli.history(cid, 10)
    } catch {
      // 历史拿不到也能回，只是少了上下文
    }

    // 会话对应的商品：优先买家最近的订单，其次历史里出现的订单。
    let itemId = ''
    try {
      itemId = store.lastItemForBuyer(String(evt.send_user_id || '')) || ''
    } catch {
      itemId = ''
    }

    const answer = await ai.reply({ cid, itemId, text: question, history, selfUserId })
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

  function startWatch() {
    if (watchProc || watchRetry || cfg.watchEnabled === false) return
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
      watchProc.kill()
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
        return store.recentOrders(Number(body.limit) || 50)
      case 'deliveries':
        return store.recentDeliveries(Number(body.limit) || 100)
      case 'cards':
        return store.listCards()
      case 'addCard':
        return {
          id: store.addCard({
            accountId: String(body.accountId || ''),
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
      case 'items':
        return store.listItems()
      case 'setItem':
        store.setItem({
          itemId: String(body.itemId || ''),
          title: String(body.title || ''),
          knowledge: String(body.knowledge || ''),
          skills: String(body.skills || ''),
        })
        return { ok: true }
      case 'ai-status':
        return { enabled: ai.enabled, model: cfg.ai?.model || '', watch: Boolean(watchProc) }
      default:
        throw new Error(`unknown operation "${body.op}"`)
    }
  }
}
