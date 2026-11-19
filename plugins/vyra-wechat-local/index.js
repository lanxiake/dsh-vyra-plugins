// vyra-wechat-local — 本机微信（用户本人账号）的 DSH 工具。
//
// Host 只做协议转发：spawn lumii 的 Python 侧车（vendor/wechat/sidecar.py），
// 按行写 JSON、按行读 JSON；解密、内存扫描、窗口自动化全在 Python 里。
// 设计见 DESIGN.md；工具白名单见 lib/tools.js。
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createSidecar } from './lib/sidecar.js'
import { resolveRuntime } from './lib/runtime.js'
import { createToolRegistrar, TOOL_WHITELIST } from './lib/tools.js'
import { createWatcher } from './lib/watch.js'

export const name = 'vyra-wechat-local'
export const inject = ['tools']

const RPC_PATH = '/api/wechat-local/rpc'
const AVATAR_PATH = '/api/wechat-local/avatar'

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

export function apply(ctx, config = {}) {
  const vendorDir = join(dirname(fileURLToPath(import.meta.url)), 'vendor', 'wechat')
  const log = (line) => {
    try {
      if (ctx.logger?.info) ctx.logger.info(`wechat-local: ${line}`)
      else console.log(`wechat-local: ${line}`)
    } catch {
      // 日志失败不影响工具
    }
  }

  const pythonConfig = { pythonPath: config.pythonPath ?? '', pythonArgs: config.pythonArgs ?? [] }
  const runtime = () => resolveRuntime(pythonConfig)

  let attachments
  ctx.inject(['attachments'], (owner) => {
    attachments = owner.attachments
  })

  let sessionController
  ctx.inject(['sessionController'], (owner) => {
    sessionController = owner.sessionController
  })

  const sidecar = createSidecar({ runtime, vendorDir, log })
  const avatarCache = new Map()
  let watcher = null
  const tools = createToolRegistrar({
    ctx,
    sidecar,
    getAttachments: () => attachments,
    whitelist: Array.isArray(config.whitelist) && config.whitelist.length > 0 ? config.whitelist : TOOL_WHITELIST,
    onResult: (tool, args, blocks) => {
      try {
        watcher?.onToolResult(tool, args, blocks)
      } catch (err) {
        log(`watch callback failed: ${err?.message ?? err}`)
      }
    },
    log,
  })

  let disposed = false
  let startPromise = null

  function start() {
    if (disposed) return Promise.reject(new Error('插件已卸载'))
    if (!startPromise) {
      startPromise = sidecar
        .start()
        .then((info) => {
          if (!disposed) tools.registerFrom(info.tools)
          return info
        })
        .catch((err) => {
          startPromise = null
          throw err
        })
    }
    return startPromise
  }

  // 首次加载就起侧车；失败不阻塞插件，设置页会显示原因。
  void start().catch((err) => log(`start failed: ${err?.message ?? err}`))

  ctx.effect(
    () => () => {
      disposed = true
      watcher?.stop()
      tools.dispose()
      void sidecar.stop()
    },
    'wechat-local.lifecycle',
  )

  function status() {
    let runtimeInfo
    try {
      const resolved = resolveRuntime(pythonConfig)
      runtimeInfo = { command: resolved.command, source: resolved.source }
    } catch (err) {
      runtimeInfo = { command: null, source: 'missing', error: String(err?.message ?? err) }
    }
    return {
      ...sidecar.status(),
      whitelist: Array.isArray(config.whitelist) && config.whitelist.length > 0 ? config.whitelist : TOOL_WHITELIST,
      registered: tools.registered(),
      runtime: runtimeInfo,
      watch: watcher?.status() ?? { enabled: false, running: false, pending: [], notifications: [] },
    }
  }

  /** Sidecar tools answer with content blocks; these settings calls answer with JSON text. */
  async function callJson(tool, args = {}) {
    const blocks = await sidecar.rawCall(tool, args)
    const text = blocks
      .filter((block) => block?.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n')
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }

  function diagnose() {
    return callJson('check_env')
  }

  /** Restore the window, normalize its size and re-probe the data directory, then re-check. */
  async function repair() {
    const result = await callJson('repair_env')
    return { repair: result, env: await diagnose(), status: status() }
  }

  /**
   * The reply policy lives in the sidecar's per-account `rules.json`, the same store its
   * `autoreply_rules` gate reads. The settings page reads and writes it through that tool
   * instead of inventing a second file.
   */
  /**
   * The sidecar binds the process-wide account on any call that names one, so reading
   * each account's policy would silently leave the last one selected — and a later
   * send without `account` would go out from the wrong identity. Restore the account
   * that was selected before a settings call.
   */
  async function keepAccount(account, operation) {
    if (!account) return operation()
    let before = ''
    try {
      before = (await callJson('list_accounts'))?.active || ''
    } catch {
      before = ''
    }
    try {
      return await operation()
    } finally {
      if (before && before.toLowerCase() !== account.toLowerCase()) {
        await callJson('autoreply_rules', { action: 'get', account: before }).catch(() => {})
      }
    }
  }

  function readPolicy(account) {
    return keepAccount(account, () =>
      callJson('autoreply_rules', { action: 'get', ...(account ? { account } : {}) }),
    )
  }

  async function writePolicy(account, rules) {
    return keepAccount(account, async () => {
      const current = await callJson('autoreply_rules', {
        action: 'get',
        ...(account ? { account } : {}),
      })
      const existing = current.rules ?? {}
      const patch = {
        action: 'set',
        ...(account ? { account } : {}),
        version: 2,
        // Configuring a list is the user saying they want it in force; the gate reads this flag.
        enabled: true,
        mode: existing.mode ?? 'draft',
        private: existing.private ?? true,
        reply_self: existing.reply_self ?? false,
        groups: existing.groups ?? 'at_me',
        default_mode: rules?.defaultMode === 'ignore' ? 'ignore' : 'notify',
        peers: (Array.isArray(rules?.peers) ? rules.peers : []).map((peer) => ({
          id: String(peer.id ?? ''),
          label: String(peer.label ?? ''),
          mode: String(peer.mode ?? 'draft'),
          trigger: String(peer.trigger ?? 'all'),
          keywords: Array.isArray(peer.keywords) ? peer.keywords.map(String) : [],
          cooldown_seconds:
            Number.isInteger(peer.cooldownSeconds) && peer.cooldownSeconds >= 0
              ? peer.cooldownSeconds
              : null,
        })),
      }
      const result = await callJson('autoreply_rules', patch)
      if (result && result.ok === false) {
        throw new Error(result.detail || result.error_code || '保存回复策略失败')
      }
      return callJson('autoreply_rules', {
        action: 'get',
        ...(account ? { account } : {}),
      })
    })
  }

  /** Bind the sidecar's process-wide account without restoring it. */
  async function bindAccount(account) {
    if (!account) return
    await callJson('autoreply_rules', { action: 'get', account }).catch(() => {})
  }

  watcher = createWatcher({
    callJson,
    readPolicy,
    restoreAccount: bindAccount,
    getController: () => sessionController,
    config: {
      watch: config.watch !== false,
      watchSeconds: config.watchSeconds ?? 2,
      mergeWindowSeconds: config.mergeWindowSeconds ?? 20,
      replyTimeoutSeconds: config.replyTimeoutSeconds ?? 120,
      backlogSeconds: config.backlogSeconds ?? 300,
    },
    log,
  })
  watcher.start()

  /** Contact avatars, cached as bytes for the settings page's `<img>` tags. */
  async function avatarOf(account, talker) {
    if (!talker) return { ok: false }
    const key = `${account}|${talker}`
    const cached = avatarCache.get(key)
    if (cached && Date.now() - cached.at < (cached.ok ? 10 * 60_000 : 2 * 60_000)) return cached
    let entry
    try {
      const answer = await callJson('wechat_avatar', { talker, ...(account ? { account } : {}) })
      entry = answer?.ok === true && typeof answer.data === 'string'
        ? { ok: true, at: Date.now(), mime: answer.mime || 'image/png', data: Buffer.from(answer.data, 'base64') }
        : { ok: false, at: Date.now() }
    } catch {
      entry = { ok: false, at: Date.now() }
    }
    avatarCache.set(key, entry)
    return entry
  }

  async function dispatch(body) {
    switch (String(body.op || '')) {
      case 'status':
        return status()
      case 'start':
        await start()
        return status()
      case 'restart': {
        const info = await sidecar.restart()
        startPromise = Promise.resolve(info)
        tools.registerFrom(info.tools)
        return status()
      }
      case 'diagnose':
        return { env: await diagnose(), status: status() }
      case 'repair':
        return repair()
      case 'accounts':
        return callJson('list_accounts')
      case 'contacts':
        return keepAccount(body.account, () =>
          callJson('list_contacts', {
            query: body.query ?? '',
            ...(body.account ? { account: body.account } : {}),
          }),
        )
      case 'policy':
        return readPolicy(body.account)
      case 'policy.save':
        return writePolicy(body.account, body.rules)
      case 'watch.status':
        return watcher.status()
      case 'watch.start':
        watcher.start()
        return watcher.status()
      case 'watch.stop':
        watcher.stop()
        return watcher.status()
      case 'watch.tick':
        await watcher.tickNow()
        return watcher.status()
      default:
        throw new Error(`unknown operation "${body.op}"`)
    }
  }

  ctx.inject(['webServer'], (owner) => {
    owner.effect(() => {
      const disposeRpc = owner.webServer.register({
        kind: 'exact',
        path: RPC_PATH,
        handler: async (req, res) => {
          let payload
          try {
            payload = { ok: true, data: await dispatch(await readJson(req)) }
          } catch (err) {
            payload = { ok: false, error: String(err?.message ?? err) }
          }
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify(payload))
        },
      })
      const disposeAvatar = owner.webServer.register({
        kind: 'exact',
        path: AVATAR_PATH,
        handler: async (req, res) => {
          const url = new URL(req.url || '/', 'http://dsh.invalid')
          const talker = url.searchParams.get('talker') || ''
          const account = url.searchParams.get('account') || ''
          const entry = talker ? await avatarOf(account, talker) : { ok: false }
          if (!entry.ok) {
            res.writeHead(404, { 'cache-control': 'no-store' })
            res.end()
            return
          }
          res.writeHead(200, {
            'content-type': entry.mime,
            'cache-control': 'private, max-age=600',
          })
          res.end(entry.data)
        },
      })
      return () => {
        disposeRpc()
        disposeAvatar()
      }
    }, 'wechat-local.routes')
  })
}