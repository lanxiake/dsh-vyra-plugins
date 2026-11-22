/**
 * Vyra Free Model — the Host half.
 *
 * What this plugin is for: a user installs it and can chat. Nothing is
 * configured, no key is entered, no account exists. The model picker gains one
 * group called 免费模型 and it works.
 *
 * The lane behind that group is the Kilo public free pool. It needs no
 * credential at all, which is what makes the zero-configuration promise honest;
 * the trade it makes (its model cards state that prompts may be logged upstream)
 * is disclosed in the settings page copy and the README rather than hidden.
 *
 * Everything else the user might want is opt-in and lives behind one page with
 * three blocks: more models from a signed-in account, and a local port so other
 * tools on this machine can borrow the same models.
 *
 * @module index.js
 */

import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import net from 'node:net'
import crypto from 'node:crypto'
import { KiloAdapter, ROUTE } from './src/adapter.js'
import { buildCatalog, fetchKiloListing } from './src/kilo.js'
import { JsonStore } from './src/store.js'
import { USAGE_INITIAL, recordUsage, pruneDays, todayTotals } from './src/usage.js'
import { startGateway } from './src/gateway.js'

/** The prefix every route this plugin serves lives under. */
export const API_PATH = '/api/vyra-free-model'

/**
 * The channel calls the settings page is allowed to make.
 *
 * The pack behind them exposes far more — backup import/export, captcha carrier
 * relay, per-model blacklists — and none of that belongs behind a button on a
 * page for people who do not want to configure anything. The proxy refuses
 * everything outside this list, so a mistake in the page cannot reach a
 * destructive call.
 */
export const CHANNEL_METHODS = Object.freeze([
  'provider.status',
  'account.create',
  'account.list',
  'account.delete',
  'credits.claimAll',
  'credits.status',
])

/** Whether one channel call may pass the proxy. */
export function isChannelMethodAllowed(method) {
  return typeof method === 'string' && CHANNEL_METHODS.includes(method)
}

export const name = 'vyra-free-model'

/**
 * The only hard dependency.
 *
 * Everything optional is reached through a nested `ctx.inject` fiber or
 * `ctx.get`, so a headless composition still serves models and only loses the
 * settings page — the opposite trade would fail the plugin outright in a
 * composition that has no web server.
 */
export const inject = ['llm']

/** Where this plugin keeps its own state. Never the profile's config file. */
const DATA_DIR_NAME = 'vyra-free-model'

/** How stale a cached roster may be before a background refresh runs. */
const REFRESH_INTERVAL_MS = 30 * 60_000

/** `$DSH_HOME` else `~/.dsh` — the same resolution the harness uses. */
export function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim()
  return path.join(os.homedir(), '.dsh')
}

export function apply(ctx, _config) {
  const logger = ctx.logger ?? console
  const dataDir = path.resolve(resolveDshHome(), DATA_DIR_NAME)
  fs.mkdirSync(dataDir, { recursive: true })
  const cacheFile = path.join(dataDir, 'catalog.json')

  /** Settings the adapter and the routes read. Task 7 owns the durable store. */
  const settings = { enabled: true }

  /** Today's token counts, and the durable file behind them. */
  const usageFile = path.join(dataDir, 'usage.json')
  const usageStore = new JsonStore(usageFile, USAGE_INITIAL, { log: message => logger.warn?.(message) })

  /** Add one turn and keep the file to a sane size. */
  function accountUsage({ model, usage }) {
    usageStore.edit(value => pruneDays(recordUsage(value, { model, usage })))
  }

  /**
   * The live catalog. It starts from last run's cache so the picker is populated
   * on the first frame instead of waiting for a network round trip — a settings
   * page that says "no models" for two seconds reads as broken.
   *
   * @type {ReturnType<typeof buildCatalog>}
   */
  let catalog = readCachedCatalog(cacheFile)

  /** What the settings page reports when the last refresh failed. */
  let laneOk = true
  let disposed = false

  /**
   * The channel pack's state: `pending` before its dynamic import settles,
   * `ready` once mounted, `failed` when it could not load, and
   * `owned-elsewhere` when another plugin already mounted it (Task 10).
   */
  let accountsState = 'pending'

  /** Provider rows the account block renders. Task 10 fills this. */
  function accountProviders() {
    return []
  }

  const state = () => ({ catalog, settings })

  const adapter = new KiloAdapter({
    state,
    onUsage: accountUsage,
  })

  ctx.llm.registerAdapter([ROUTE], adapter)

  /** One listing round. Never throws: a failure keeps the previous roster. */
  async function refreshCatalog({ log = false } = {}) {
    try {
      const raw = await fetchKiloListing()
      if (disposed) return catalog
      const next = buildCatalog(raw)
      if (next.length === 0) {
        // An empty answer is a gateway problem, not "there are no free models".
        // Keeping the old roster is the difference between a stale list and none.
        laneOk = false
        if (log) logger.warn?.('vyra-free-model: the listing came back empty; keeping the cached roster')
        return catalog
      }
      catalog = next
      laneOk = true
      writeCachedCatalog(cacheFile, next, logger)
      try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels have no such method */ }
      if (log) logger.info?.(`vyra-free-model: ${next.length} models available`)
      return catalog
    } catch (error) {
      if (disposed) return catalog
      laneOk = false
      if (log) logger.warn?.(`vyra-free-model: listing refresh failed (${error?.message ?? error}); keeping the cached roster`)
      return catalog
    }
  }

  /** Background loop: shortly after boot, then on the configured cadence. */
  let timer
  const schedule = () => {
    timer = setTimeout(async () => {
      if (disposed) return
      await refreshCatalog()
      if (!disposed) schedule()
    }, REFRESH_INTERVAL_MS)
    timer.unref?.()
  }

  ctx.effect(() => {
    const boot = setTimeout(() => {
      if (disposed) return
      void refreshCatalog({ log: true }).then(() => { if (!disposed) schedule() })
    }, 1500)
    boot.unref?.()
    return () => {
      disposed = true
      clearTimeout(boot)
      if (timer !== undefined) clearTimeout(timer)
      if (forwardServer !== null) {
        void forwardServer.close().catch(() => {})
        forwardServer = null
      }
      usageStore.dispose()
    }
  }, 'vyra-free-model: catalog refresh')

  logger.info?.(`vyra-free-model: mounted, route "${ROUTE}" with ${catalog.length} cached models`)

  /** Whatever the forward switch currently holds. */
  const forwardState = { enabled: false, port: 0, key: '' }
  /** The live listener, when the switch is on. */
  let forwardServer = null

  /** Is a loopback port free to bind? */
  const canBind = port => new Promise(resolve => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, '127.0.0.1')
  })

  /**
   * Turn the port on or off.
   *
   * A busy port walks forward rather than failing: the user did not choose the
   * number, so the plugin picks the next one and the page shows what it got.
   */
  async function setForward(enabled) {
    if (enabled !== true) {
      if (forwardServer !== null) {
        const closing = forwardServer
        forwardServer = null
        await closing.close()
      }
      forwardState.enabled = false
      forwardState.port = 0
      return forwardState
    }
    if (forwardServer !== null) return forwardState

    forwardState.key = forwardState.key === '' ? mintKey() : forwardState.key
    let port = 8899
    for (let attempt = 0; attempt < 10; attempt += 1, port += 1) {
      if (!(await canBind(port))) continue
      try {
        forwardServer = await startGateway({
          port,
          key: forwardState.key,
          models: catalog,
          complete: (request, onChunk, signal) => forwardComplete(request, onChunk, signal),
          log: message => logger.warn?.(message),
        })
        forwardState.enabled = true
        forwardState.port = forwardServer.port
        logger.info?.(`vyra-free-model: forward port listening on 127.0.0.1:${forwardState.port}`)
        return forwardState
      } catch (error) {
        if (error?.code !== 'EADDRINUSE') throw error
      }
    }
    throw new Error('no free loopback port was available for the forward listener')
  }

  /** Run one turn through the adapter for a forwarded request. */
  async function forwardComplete(request, onChunk, signal) {
    let usage
    let finish = 'stop'
    for await (const chunk of adapter.stream({
      provider: ROUTE,
      model: request.model,
      messages: (request.messages ?? []).map(toHarnessMessage),
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      signal,
    })) {
      if (chunk.type === 'text-delta') onChunk({ text: chunk.text })
      else if (chunk.type === 'reasoning-delta') onChunk({ reasoning: chunk.text })
      else if (chunk.type === 'usage') usage = chunk.usage
      else if (chunk.type === 'finish') {
        if (chunk.reason?.kind === 'max-tokens') finish = 'max-tokens'
        if (chunk.reason?.kind === 'error') throw new Error(chunk.reason.failure?.message ?? 'upstream error')
      }
    }
    return { usage, finish }
  }

  const api = createApiRoutes({
    version: VERSION,
    settings,
    catalog: () => catalog,
    laneOk: () => laneOk,
    accounts: () => ({ state: accountsState, providers: accountProviders() }),
    usage: () => todayTotals(usageStore.get()),
    forward: () => forwardState,
    refreshCatalog: () => refreshCatalog({ log: true }),
    setForward,
    channel: undefined,
  })

  // The routes are optional: a headless composition has no web server, and that
  // must cost the settings page, never the models.
  ctx.inject(['webServer'], scoped => {
    scoped.effect(() => scoped.webServer.register({
      kind: 'prefix',
      path: API_PATH,
      handler: api,
    }), 'vyra-free-model: api routes')
  })
}

/** The plugin version, read once for the summary document. */
function readVersion() {  try {
    const manifest = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
    return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const VERSION = readVersion()

/** A fresh bearer token for the forward port. */
function mintKey() {
  return `sk-${crypto.randomBytes(24).toString('base64url')}`
}

/**
 * One OpenAI chat message as a harness message.
 *
 * The forwarded shape is the flat chat shape: role, a string or parts, and
 * optional `tool_calls`. Anything this plugin does not understand becomes plain
 * text rather than an error, because a caller's extra field is not a reason to
 * refuse their turn.
 */
function toHarnessMessage(message) {
  const role = message?.role === 'assistant' || message?.role === 'tool' || message?.role === 'system'
    ? message.role
    : 'user'
  const content = []
  if (typeof message?.content === 'string' && message.content !== '') {
    content.push({ type: 'text', text: message.content })
  } else if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (part?.type === 'text' && typeof part.text === 'string') content.push({ type: 'text', text: part.text })
    }
  }
  const toolCallId = typeof message?.tool_call_id === 'string' ? message.tool_call_id : undefined
  return { ...(toolCallId === undefined ? {} : { toolCallId }), role, content }
}

/** Last run's roster, or an empty list when there is none or it is damaged. */
function readCachedCatalog(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(parsed?.models)) return []
    return parsed.models.filter(row => row !== null && typeof row === 'object' && typeof row.id === 'string')
  } catch {
    return []
  }
}

/** Persist the roster so the next boot has something to show immediately. */
function writeCachedCatalog(file, models, logger) {
  try {
    const temp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(temp, JSON.stringify({ at: Date.now(), models }, undefined, 2), { mode: 0o600 })
    fs.renameSync(temp, file)
  } catch (error) {
    logger.warn?.(`vyra-free-model: could not cache the model roster (${error?.message ?? error})`)
  }
}

/**
 * Everything the settings page needs, in one read.
 *
 * One document rather than four endpoints: the page renders three blocks at once,
 * and four round trips would let the user see a half-loaded page for a moment.
 *
 * The forward key never appears here. The page shows a mask and asks the user to
 * copy from the response of the call that creates it, which is the only moment
 * the value is legitimately on the wire.
 */
export function createSummary({ version, catalog, laneOk, accounts, usage, forward }) {
  return {
    version,
    lane: {
      ok: laneOk === true,
      models: (catalog ?? []).map(entry => ({
        id: entry.id,
        name: entry.name,
        contextWindow: entry.contextWindow,
        maxOutput: entry.maxOutput,
        vision: entry.vision === true,
        efforts: entry.efforts ?? null,
      })),
    },
    accounts: {
      state: accounts?.state ?? 'pending',
      providers: accounts?.providers ?? [],
    },
    usage: {
      input: usage?.input ?? 0,
      output: usage?.output ?? 0,
      total: usage?.total ?? 0,
    },
    forward: {
      enabled: forward?.enabled === true,
      port: forward?.port ?? 0,
      hasKey: typeof forward?.key === 'string' && forward.key !== '',
    },
  }
}

/**
 * The HTTP surface.
 *
 * Every route is same-origin only. A request that arrived through a proxy carries
 * `x-forwarded-for`, which means something outside this machine reached it, and
 * that is refused: these routes can create accounts and mint a port key.
 *
 * @param {object} deps
 */
export function createApiRoutes(deps) {
  return async function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const routePath = url.pathname.startsWith(API_PATH)
      ? url.pathname.slice(API_PATH.length).replace(/\/+$/, '') || '/'
      : url.pathname
    const method = String(req.method ?? 'GET').toUpperCase()

    const send = (status, payload) => {
      const body = JSON.stringify(payload)
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(body)
    }

    // A proxied request means something outside this machine reached a route
    // that can create accounts and mint a port key. Refuse it outright rather
    // than trying to recover the peer address.
    if (isProxied(req)) return send(403, { error: 'forbidden' })

    try {
      if (routePath === '/summary' && method === 'GET') {
        return send(200, assemble(deps))
      }

      if (routePath === '/summary' || routePath === '/recheck' || routePath === '/forward' || routePath === '/channel') {
        if (method !== 'POST' && routePath !== '/summary') return send(405, { error: 'method-not-allowed' })
        if (routePath === '/summary') return send(405, { error: 'method-not-allowed' })
      }

      if (routePath === '/recheck' && method === 'POST') {
        const models = await deps.refreshCatalog()
        return send(200, { count: Array.isArray(models) ? models.length : 0, summary: assemble(deps) })
      }

      if (routePath === '/forward' && method === 'POST') {
        const body = await readJson(req)
        const forward = await deps.setForward(body?.enabled === true)
        return send(200, { forward: { enabled: forward.enabled === true, port: forward.port ?? 0, hasKey: typeof forward.key === 'string' && forward.key !== '' } })
      }

      if (routePath === '/channel' && method === 'POST') {
        const body = await readJson(req)
        if (!isChannelMethodAllowed(body?.method)) return send(403, { error: 'method-not-allowed' })
        if (typeof deps.channel !== 'function') return send(503, { error: 'channels-unavailable' })
        try {
          const value = await deps.channel(body.method, body?.payload)
          return send(200, { value })
        } catch (error) {
          return send(502, { error: String(error?.message ?? error).slice(0, 300) })
        }
      }

      return send(404, { error: 'not-found' })
    } catch (error) {
      return send(500, { error: String(error?.message ?? error).slice(0, 300) })
    }
  }
}

/** Read the assembled summary out of the dependency bag. */
function assemble(deps) {
  return createSummary({
    version: deps.version ?? '0.0.0',
    catalog: deps.catalog?.() ?? [],
    laneOk: deps.laneOk?.() === true,
    accounts: deps.accounts?.() ?? { state: 'pending', providers: [] },
    usage: deps.usage?.() ?? { input: 0, output: 0, total: 0 },
    forward: deps.forward?.() ?? { enabled: false, port: 0, key: '' },
  })
}

/** Did this request arrive through a proxy rather than straight from the shell? */
function isProxied(req) {
  const forwarded = req?.headers?.['x-forwarded-for']
  return typeof forwarded === 'string' && forwarded.trim() !== ''
}

/** Read a JSON body, tolerating an empty one. */
function readJson(req) {
  return new Promise(resolve => {
    const chunks = []
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') return resolve(undefined)
      try { resolve(JSON.parse(text)) } catch { resolve(undefined) }
    }
    req.on('data', chunk => chunks.push(Buffer.from(chunk)))
    req.on('end', finish)
    req.on('error', finish)
  })
}
