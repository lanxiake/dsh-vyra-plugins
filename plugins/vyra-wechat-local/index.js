// vyra-wechat-local — 本机微信（用户本人账号）的 DSH 工具。
//
// Host 只做协议转发：spawn lumii 的 Python 侧车（vendor/wechat/sidecar.py），
// 按行写 JSON、按行读 JSON；解密、内存扫描、窗口自动化全在 Python 里。
// 设计见 DESIGN.md；工具白名单见 lib/tools.js。
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
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
  let workspaceRegistry
  ctx.inject(['workspaceRegistry'], (owner) => {
    workspaceRegistry = owner.workspaceRegistry
  })
  let workspace = null
  let workspacePromise = null

  /** Sessions created by the watch loop live in one "PC微信" workspace. */
  function ensureWorkspace() {
    if (workspace !== null) return Promise.resolve(workspace)
    if (workspaceRegistry === undefined) return Promise.resolve(null)
    if (workspacePromise === null) {
      workspacePromise = (async () => {
        const dir = join(homedir(), '.dsh', 'wechat-local', 'workspace')
        mkdirSync(dir, { recursive: true })
        workspace = await workspaceRegistry.create(dir, 'PC微信')
        return workspace
      })().catch((err) => {
        workspacePromise = null
        log(`workspace unavailable: ${err?.message ?? err}`)
        return null
      })
    }
    return workspacePromise
  }

  const WECHAT_PROXY_PROMPT = `你是「代聊模式」，用用户本人的身份回复微信。

用户消息是合并后的微信消息批次：
- 第一行是 "[对方（talker）· 账号 · 直接代回|起草]"；
- 后面每条是 "时间 内容"；图片会以图片块附在消息里，语音已经转写成 [语音] 文字。

回复规则：
- 直接代回：必须调用 send_text(talker=<第一行的 talker>, account=<账号>, dry_run=false, text=<回复正文>) 发送。
  不要只在回复里说“已发送”，不要向对方暴露你是 AI，也不要提及工具。
- 起草：只起草一条回复，不要调用任何发送工具；把草稿正文直接输出，等用户确认。
- 用用户平时的口吻；微信里不要用 Markdown，不要长篇；不确定就简短确认。
- 需要更多上下文时可以用 read_history / search_messages / list_sessions。
  图片和语音已经随消息提供，不要再调用 read_image 或转写工具。`

  /**
   * The watch sessions are scoped, not a global preset: each agent gets this
   * persona-prefix section in its own context, so normal conversations never
   * see or select 代聊模式.
   */
  const promptScopes = new WeakSet()

  function installProxyPrompt(agentCtx) {
    if (promptScopes.has(agentCtx)) return
    promptScopes.add(agentCtx)
    try {
      agentCtx.systemPrompt.section({
        // Unique name: a preset's own persona section must not shadow this one.
        name: 'vyra-wechat-proxy',
        order: 1,
        text: WECHAT_PROXY_PROMPT,
      })
    } catch (err) {
      log(`proxy prompt section failed: ${err?.message ?? err}`)
    }
  }

  function defaultAgentOptions() {
    try {
      const selection = ctx.agentDefaultModel?.currentSelection?.()
      if (!selection?.provider || !selection?.model) return undefined
      return {
        provider: selection.provider,
        model: selection.model,
        ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
      }
    } catch {
      return undefined
    }
  }

  const watchHandles = new Map()

  /** Create one watch session in the PC微信 workspace with the scoped persona. */
  async function createWatchSession() {
    const ws = await ensureWorkspace()
    const sessionId = randomUUID()
    const selection = defaultAgentOptions()
    const handle = await ctx.agents.create({
      sessionId,
      meta: { cwd: ws?.path ?? process.cwd() },
      ...(selection === undefined ? {} : { agentOptions: selection }),
      setup: (agentCtx) => installProxyPrompt(agentCtx),
    })
    watchHandles.set(sessionId, handle)
    if (ws) {
      try {
        await ws.attachSession(sessionId)
      } catch (err) {
        log(`attach watch session failed: ${err?.message ?? err}`)
      }
    }
    return sessionId
  }

  /** A cold watch session is resumed with the same scoped persona. */
  async function ensureWatchSession(sessionId) {
    const live = ctx.agents.get(sessionId)
    if (live !== undefined) {
      // The session controller may have resumed it on its own; add the persona
      // to that live scope before the next step.
      if (live.ctx?.systemPrompt !== undefined) installProxyPrompt(live.ctx)
      return
    }
    const selection = defaultAgentOptions()
    const handle = await ctx.agents.resume({
      resumeSessionId: sessionId,
      ...(selection === undefined ? {} : { agentOptions: selection }),
      setup: (agentCtx) => installProxyPrompt(agentCtx),
    })
    watchHandles.set(sessionId, handle)
  }

  /** Retire a pre-0.6 watch session: stop it if live and hide it from the list. */
  async function retireWatchSession(sessionId) {
    const handle = watchHandles.get(sessionId)
    if (handle !== undefined) {
      watchHandles.delete(sessionId)
      await handle.dispose().catch(() => {})
    }
    try {
      await workspaceRegistry?.archiveSession(sessionId, { stopActivity: true })
    } catch (err) {
      log(`retire watch session ${sessionId} failed: ${err?.message ?? err}`)
    }
  }

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
      for (const handle of watchHandles.values()) void handle.dispose()
      watchHandles.clear()
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
    createSession: createWatchSession,
    ensureSession: ensureWatchSession,
    readImage,
    retireSession: retireWatchSession,
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

  /** Fetch one image message through the sidecar so the prompt can attach it. */
  async function readImage(account, talker, local_id, ts) {
    const args = {
      talker,
      ...(local_id === undefined ? {} : { local_id }),
      ...(ts === undefined ? {} : { ts }),
      ...(account ? { account } : {}),
    }
    try {
      // Our tool reads the decoded display cache first, which handles WXGF
      // originals the vendored read_image cannot return.
      const answer = await callJson('wechat_image_fetch', args)
      if (answer?.ok === true && typeof answer.data === 'string') {
        return {
          image: { mediaType: answer.mime || 'image/png', data: answer.data },
          text: `${answer.source || 'image'} ${answer.bytes || ''}`.trim(),
        }
      }
      // Fallback: the upstream reader for any layout our cache lookup missed.
      const blocks = await sidecar.rawCall('read_image', args)
      const image = blocks.find((block) => block?.type === 'image' && typeof block.data === 'string')
      const text = blocks
        .filter((block) => block?.type === 'text')
        .map((block) => String(block.text ?? ''))
        .join('\n')
      return image
        ? { image: { mediaType: image.mimeType || 'image/png', data: image.data }, text }
        : { image: null, text: answer?.detail || text }
    } catch (err) {
      return { image: null, text: String(err?.message ?? err) }
    }
  }

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