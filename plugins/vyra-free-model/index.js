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
import { spawn } from 'node:child_process'
import { KiloAdapter, ROUTE } from './src/adapter.js'
import { buildCatalog, fetchKiloListing, AUTO_ID } from './src/kilo.js'
import { probeAll } from './src/probe.js'
import { JsonStore } from './src/store.js'
import { USAGE_INITIAL, recordUsage, pruneDays, todayTotals } from './src/usage.js'
import { startGateway } from './src/gateway.js'
import { PRODUCTS, beginBuddyLogin, completeBuddyLogin } from './src/buddy-login.js'
import {
  buddyExpired, refreshBuddyCredential, fetchBuddyModels, buddyCatalog, streamBuddyTurn,
} from './src/buddy.js'
import { fetchCreditOverview as fetchBuddyCreditOverview, claimDailyCredit as claimBuddyCredit } from './src/buddy-credits.js'
import {
  sanitizeEndpoints, fetchEndpointModels, endpointModelId, streamEndpointTurn,
  isCallableBaseUrl, normalizeBaseUrl,
} from './src/endpoints.js'
import {
  TOOLS, configPathFor, planClaudeWrite, planCodexWrite, applyPlan, restoreFrom,
  listBackups, readStatus, scriptPathFor, starterScript,
} from './src/configure.js'

/** The prefix every route this plugin serves lives under. */
export const API_PATH = '/api/vyra-free-model'

/** Where the channel pack publishes its own RPC route, and its endpoint name. */
const CHANNEL_PACK_PATH = '/api/channel-pack'
const CHANNEL_ENDPOINT = 'channel-pack'

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
  'account.update',
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

/**
 * Sign-in providers the bundled channel pack implements and this machine can
 * actually reach. Gemini is deliberately absent: `accounts.google.com` and the
 * Code Assist endpoints time out from a normal connection here, and a login
 * button that cannot finish is worse than no button.
 */
const ACCOUNT_PROVIDERS = Object.freeze([
  { id: 'qodercn', label: 'Qoder 中国版' },
  { id: 'qoder', label: 'Qoder 国际版' },
  { id: 'trae', label: 'TRAE' },
  { id: 'zcode', label: 'ZCode' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'lobsterai', label: '有道 LobsterAI' },
  { id: 'loomy', label: '讯飞 Loomy' },
  { id: 'cline', label: 'Cline' },
  { id: 'raccoon', label: '商汤 Raccoon', more: true },
])

/** Providers whose daily check-in the pack implements. */
const CLAIMABLE_PROVIDERS = Object.freeze(['qodercn', 'qoder', 'trae', 'zcode', 'minimax', 'lobsterai', 'loomy'])

/** Where the models come from, stated on the page rather than implied. */
const LANE_SOURCE = Object.freeze({ name: 'Kilo AI 公共免费网关', url: 'https://kilo.ai' })

/** The two Tencent products with the same login protocol. */
const BUDDY_LABELS = Object.freeze({ buddy: 'CodeBuddy（腾讯）', workbuddy: 'WorkBuddy（腾讯国际版）' })

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
  /** The user's home, where the other tools keep their configuration. */
  const dshHome = os.homedir()
  const dataDir = path.resolve(resolveDshHome(), DATA_DIR_NAME)
  fs.mkdirSync(dataDir, { recursive: true })
  const cacheFile = path.join(dataDir, 'catalog.json')

  /** Settings the adapter and the routes read. */
  const settingsFile = path.join(dataDir, 'settings.json')
  const settingsStore = new JsonStore(settingsFile, { enabled: true, endpoints: [], autoSwitch: true }, { log: message => logger.warn?.(message) })
  settingsStore.edit(value => ({
    ...value,
    endpoints: sanitizeEndpoints(value.endpoints),
    autoSwitch: value.autoSwitch !== false,
  }))

  /** Last probe result per Kilo model id. */
  const probeStore = new JsonStore(
    path.join(dataDir, 'probes.json'),
    { at: 0, results: {} },
    { log: message => logger.warn?.(message) },
  )

  /** Which upstream the automatic router actually used last. */
  const autoStore = new JsonStore(
    path.join(dataDir, 'auto.json'),
    { id: '', name: '', contextWindow: 0, vision: false, at: 0 },
    { log: message => logger.warn?.(message) },
  )

  /** CodeBuddy / WorkBuddy accounts and their cached model catalogs. */
  const buddyStore = new JsonStore(
    path.join(dataDir, 'buddy.json'),
    { accounts: [], models: { buddy: [], workbuddy: [] }, modelsAt: {} },
    { log: message => logger.warn?.(message) },
  )

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
   * Rows the two extra lanes publish — one per Tencent product that has a
   * signed-in account, plus every model of every enabled keyed endpoint.
   *
   * @type {Array<object>}
   */
  let extraCatalog = []

  /** The catalog row the auto router last used, resolved for display. */
  function autoModel() {
    const routed = autoStore.get()
    if (typeof routed?.id !== 'string' || routed.id === '') return undefined
    return {
      id: routed.id,
      name: typeof routed.name === 'string' && routed.name !== '' ? routed.name : routed.id,
      contextWindow: Number(routed.contextWindow) > 0 ? Number(routed.contextWindow) : 131072,
      maxOutput: Number(routed.maxOutput) > 0 ? Number(routed.maxOutput) : 32768,
      vision: routed.vision === true,
    }
  }

  /** The picker label for the automatic row, naming the model it last used. */
  function autoLabel() {
    const routed = autoModel()
    if (routed === undefined) return '自动选择（推荐）'
    const context = formatWindow(routed.contextWindow)
    const tags = [context, routed.vision ? '看图' : ''].filter(tag => tag !== '')
    return `自动选择 · ${shortModelName(routed.name)}${tags.length === 0 ? '' : `（${tags.join(' · ')}）`}`
  }

  /** Remember which upstream answered, so the next frame can name it. */
  function noteRouted(id) {
    // One turn sends dozens of frames with the same routed id; only the first
    // one needs to be remembered, and only a change should refresh the picker.
    const current = autoStore.get()
    if (current?.id === id && Date.now() - (Number(current.at) || 0) < 60_000) return
    const entry = catalog.find(row => row.id === id)
    autoStore.update({
      id,
      name: entry?.name ?? id,
      contextWindow: entry?.contextWindow ?? 131072,
      maxOutput: entry?.maxOutput ?? 32768,
      vision: entry?.vision === true,
      at: Date.now(),
    })
    try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
  }

  /**
   * The channel pack's state: `pending` before its dynamic import settles,
   * `ready` once mounted, `failed` when it could not load, and
   * `owned-elsewhere` when another plugin already mounted it (Task 10).
   */
  let accountsState = 'pending'

  /** The account providers the pack publishes, once it is mounted. */
  const providers = []

  /** When the last automatic claim failed, for the card to mention. */
  let claimFailedAt

  /** The Tencent products as account rows, shaped like the channel providers. */
  function buddyProviderRows() {
    return Object.entries(BUDDY_LABELS).map(([id, label]) => ({
      id,
      label,
      kind: 'buddy',
      more: false,
      claimable: true,
      accounts: buddyAccounts()
        .filter(account => account.product === id)
        .map(account => ({
          id: account.id,
          nickname: account.nickname,
          enabled: account.enabled !== false,
          expiresAt: Number(account.expiresAt) || 0,
          refreshable: true,
        })),
    }))
  }

  /** Every account row the page renders — channel pack first, Tencent after. */
  function accountProviders() {
    return [...providers, ...buddyProviderRows()]
  }

  /**
   * Call one method on the channel pack.
   *
   * The pack publishes an in-process `channelPack` service (see the small patch
   * at the end of its `registerChannelPackRpc`). That is the path that works:
   * the HTTP route is fenced by browser auth, and the `connection.fetch` seam
   * is a route registry rather than a callable. The HTTP path stays as a
   * fallback for an older bundled pack that has not been rebuilt.
   */
  async function callChannel(method, payload) {
    let service
    try { service = ctx.get('channelPack') } catch { service = undefined }
    if (service !== undefined && typeof service.call === 'function') {
      const result = await service.call(method, payload ?? {})
      if (result?.ok !== true) throw new Error(result?.error?.message ?? 'the channel pack refused the call')
      return result.value
    }

    const connection = ctx.get('connection')
    if (connection === undefined || typeof connection.fetch !== 'function') {
      throw new Error('账号功能还没加载好，请重启 DSH 后再试')
    }
    const rpcId = crypto.randomUUID()
    const response = await connection.fetch(CHANNEL_PACK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId,
        method: CHANNEL_ENDPOINT,
        payload: { method, payload: payload ?? {} },
      }),
    })
    if (!response.ok) throw new Error(`channel pack answered HTTP ${response.status}`)
    const message = await response.json()
    if (message?.result?.ok !== true) {
      throw new Error(message?.result?.error?.message ?? 'the channel pack refused the call')
    }
    return message.result.value
  }

  const state = () => ({ catalog, settings: settingsStore.get() })

  const adapter = new KiloAdapter({
    state,
    onUsage: accountUsage,
    probes: () => probeStore.get().results ?? {},
    autoModel,
    autoLabel,
    onRouted: noteRouted,
    autoSwitch: () => settingsStore.get().autoSwitch !== false,
    fallbackModels: () => {
      const probes = probeStore.get().results ?? {}
      const usable = catalog.filter(entry => entry.id !== AUTO_ID && probes[entry.id]?.state !== 'unavailable')
      const working = usable.filter(entry => probes[entry.id]?.state === 'ok')
      const rest = usable.filter(entry => probes[entry.id]?.state !== 'ok')
      return [...working, ...rest].slice(0, 5).map(entry => entry.id)
    },
    extraCatalog: () => extraCatalog,
    extraStream: (entry, options) => streamExtra(entry, options),
  })

  ctx.llm.registerAdapter([ROUTE], adapter)

  // The picker should show a signed-in account's models on the first frame.
  rebuildExtras()

  // ── the extra lanes: Tencent accounts and keyed endpoints ───────────────

  /** The stored Tencent accounts, defensively shaped. */
  function buddyAccounts() {
    const value = buddyStore.get().accounts
    return Array.isArray(value) ? value.filter(account => account !== null && typeof account === 'object') : []
  }

  /** Recompute the rows the picker sees from both lanes. */
  function rebuildExtras() {
    const rows = []
    const store = buddyStore.get()
    for (const productId of Object.keys(BUDDY_LABELS)) {
      const accounts = buddyAccounts().filter(account => account.product === productId && account.enabled !== false)
      if (accounts.length === 0) continue
      const product = PRODUCTS[productId]
      if (product === undefined) continue
      const models = buddyCatalog(product, store.models?.[productId])
      for (const model of models) {
        rows.push({
          lane: 'buddy',
          product: productId,
          modelId: model.id,
          id: `buddy:${productId}/${model.id}`,
          name: `${BUDDY_LABELS[productId]} · ${model.name}`,
          contextWindow: Number(model.contextWindow) > 0 ? Number(model.contextWindow) : 131072,
          maxOutput: Number(model.maxOutputTokens ?? model.maxOutput) > 0
            ? Number(model.maxOutputTokens ?? model.maxOutput)
            : 32768,
          vision: model.vision === true,
          source: 'buddy',
        })
      }
    }
    for (const endpoint of sanitizeEndpoints(settingsStore.get().endpoints)) {
      if (endpoint.enabled !== true) continue
      for (const model of endpoint.models) {
        rows.push({
          lane: 'endpoint',
          endpointId: endpoint.id,
          modelId: model.id,
          id: endpointModelId(endpoint.id, model.id),
          name: `${endpoint.name} · ${model.name ?? model.id}`,
          contextWindow: Number(model.contextWindow) > 0 ? Number(model.contextWindow) : 131072,
          maxOutput: Number(model.maxOutput) > 0 ? Number(model.maxOutput) : 32768,
          vision: model.vision === true,
          source: 'endpoint',
        })
      }
    }
    extraCatalog = rows
    return rows
  }

  /** A credential that is present and, when possible, refreshed first. */
  async function usableBuddyCredential(product, account) {
    let credential = account.credential
    if (buddyExpired(credential) && typeof credential?.refresh_token === 'string' && credential.refresh_token !== '') {
      const fresh = await refreshBuddyCredential(product, credential)
      if (fresh !== undefined) {
        account.credential = fresh
        if (Number(fresh.expires_at) > 0) account.expiresAt = Number(fresh.expires_at)
        buddyStore.edit(value => value)
        credential = fresh
      }
    }
    return typeof credential?.access_token === 'string' && credential.access_token !== '' ? credential : undefined
  }

  /** Hand a turn from an extra lane to its own transport. */
  async function* streamExtra(entry, options) {
    if (entry.lane === 'endpoint') {
      const endpoint = sanitizeEndpoints(settingsStore.get().endpoints).find(row => row.id === entry.endpointId)
      if (endpoint === undefined) {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: '这个端点已被删除', code: 'CLIENT_ERROR' } } }
        return
      }
      yield* streamEndpointTurn({ endpoint, model: entry.modelId, options })
      return
    }

    const product = PRODUCTS[entry.product]
    const accounts = buddyAccounts().filter(row => row.product === entry.product && row.enabled !== false)
    if (product === undefined || accounts.length === 0) {
      yield { type: 'finish', reason: { kind: 'error', failure: { message: '没有已登录的账号，请先到设置页登录', code: 'INVALID_CREDENTIAL' } } }
      return
    }

    // Several accounts on one product is a quota strategy, so a refusal before
    // any content moves to the next account instead of failing the turn.
    for (let index = 0; index < accounts.length; index += 1) {
      const account = accounts[index]
      const credential = await usableBuddyCredential(product, account)
      if (credential === undefined) continue
      const chunks = []
      for await (const chunk of streamBuddyTurn({
        product,
        credential,
        ensureCredential: () => usableBuddyCredential(product, account),
        options,
      })) chunks.push(chunk)

      const errored = chunks.some(chunk => chunk.type === 'finish' && chunk.reason?.kind === 'error')
      const delivered = chunks.some(chunk => chunk.type !== 'usage' && chunk.type !== 'finish')
      if (errored && !delivered && index < accounts.length - 1) continue
      for (const chunk of chunks) yield chunk
      return
    }
    yield { type: 'finish', reason: { kind: 'error', failure: { message: '所有账号都不可用，请重新登录', code: 'INVALID_CREDENTIAL' } } }
  }

  /** Start a Tencent sign-in. The browser is opened here; the page gets the URL too. */
  async function startBuddyLogin(productId) {
    const product = PRODUCTS[productId]
    if (product === undefined) throw new Error(`不支持的账号类型：${String(productId)}`)
    const started = await beginBuddyLogin({ product })
    openExternal(started.loginUrl)
    void completeBuddyLogin(started.state, { product })
      .then(result => {
        if (disposed) return
        const accounts = [...buddyAccounts(), {
          id: `${productId}-${crypto.randomBytes(3).toString('hex')}`,
          product: productId,
          nickname: typeof result.nickname === 'string' && result.nickname !== '' ? result.nickname : (result.userId || productId),
          credential: result.credential,
          expiresAt: result.expiresAt,
          enabled: true,
          createdAt: Date.now(),
        }]
        buddyStore.edit(value => ({ ...value, accounts }))
        rebuildExtras()
        try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
        logger.info?.(`vyra-free-model: ${productId} signed in as ${result.nickname || result.userId || '?'}`)
        void refreshBuddyModels(productId)
      })
      .catch(error => {
        logger.warn?.(`vyra-free-model: ${productId} sign-in failed (${error?.message ?? error})`)
      })
    return { loginUrl: started.loginUrl, product: productId }
  }

  /** Forget one Tencent account (its tokens go with it). */
  function removeBuddyAccount(id) {
    const next = buddyAccounts().filter(account => account.id !== id)
    buddyStore.edit(value => ({ ...value, accounts: next }))
    rebuildExtras()
    try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
    return next.map(account => ({
      id: account.id,
      product: account.product,
      nickname: account.nickname,
      enabled: account.enabled !== false,
      expiresAt: Number(account.expiresAt) || 0,
    }))
  }

  /** Enable or disable one Tencent account without deleting its tokens. */
  function toggleBuddyAccount(id, enabled) {
    for (const account of buddyAccounts()) {
      if (account.id !== id) continue
      account.enabled = enabled === true
      buddyStore.edit(value => value)
      rebuildExtras()
      try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
      break
    }
    return buddyAccounts().map(account => ({
      id: account.id,
      product: account.product,
      nickname: account.nickname,
      enabled: account.enabled !== false,
      expiresAt: Number(account.expiresAt) || 0,
    }))
  }

  /**
   * Balance and check-in state for every signed-in account.
   *
   * The channel pack and the Tencent lane expose credits through different
   * shapes; this normalises both into one map the page can render next to each
   * account. A failure for one account is reported on that account, never as a
   * failed page.
   */
  async function readCredits() {
    const result = {}

    for (const row of providers) {
      if (row.accounts.length === 0) continue
      try {
        const value = await callChannel('credits.balances', { provider: row.id })
        const accounts = Array.isArray(value?.accounts) ? value.accounts : []
        result[row.id] = {
          accounts: accounts.map(entry => {
            const packages = Array.isArray(entry?.balance?.packages) ? entry.balance.packages : []
            const units = [...new Set(packages.map(item => (typeof item?.unit === 'string' ? item.unit : '')).filter(Boolean))]
            return {
              id: String(entry?.accountId ?? ''),
              credits: Number.isFinite(entry?.balance?.total) ? entry.balance.total : undefined,
              unit: typeof entry?.balance?.unit === 'string' && entry.balance.unit !== ''
                ? entry.balance.unit
                : (units.length === 1 ? units[0] : ''),
              error: typeof entry?.error === 'string' ? entry.error : '',
            }
          }),
        }
      } catch (error) {
        result[row.id] = { error: String(error?.message ?? error).slice(0, 160) }
      }
    }

    for (const productId of Object.keys(BUDDY_LABELS)) {
      const product = PRODUCTS[productId]
      const active = buddyAccounts().filter(account => account.product === productId)
      if (product === undefined || active.length === 0) continue
      const entries = []
      for (const account of active) {
        const credential = await usableBuddyCredential(product, account)
        if (credential === undefined) {
          entries.push({ id: account.id, error: '登录已过期，请重新登录' })
          continue
        }
        try {
          const overview = await fetchBuddyCreditOverview(product, credential)
          const balance = overview?.balance
          entries.push({
            id: account.id,
            credits: Number.isFinite(balance?.total) ? balance.total : undefined,
            unit: typeof balance?.unit === 'string' ? balance.unit : '积分',
            checkedIn: overview?.checkin?.checkedInToday === true,
            canClaim: overview?.checkin?.canClaim === true,
            error: typeof overview?.balanceError === 'string' ? overview.balanceError : '',
          })
        } catch (error) {
          entries.push({ id: account.id, error: String(error?.message ?? error).slice(0, 160) })
        }
      }
      result[productId] = { accounts: entries }
    }

    return result
  }

  /** Claim today's credits for one provider, on both lanes. */
  async function claimCreditsFor(providerId) {
    if (BUDDY_LABELS[providerId] !== undefined) {
      const product = PRODUCTS[providerId]
      if (product === undefined) return { error: '不支持的账号类型' }
      const outcomes = []
      for (const account of buddyAccounts().filter(row => row.product === providerId && row.enabled !== false)) {
        const credential = await usableBuddyCredential(product, account)
        if (credential === undefined) {
          outcomes.push({ id: account.id, status: 'failed', message: '登录已过期' })
          continue
        }
        const value = await claimBuddyCredit(product, credential)
        outcomes.push({ id: account.id, ...value })
      }
      return { outcomes }
    }
    if (!CLAIMABLE_PROVIDERS.includes(providerId)) return { error: '这个渠道不支持每日领取' }
    const value = await callChannel('credits.claimAll', { provider: providerId })
    return { value }
  }

  /** Refresh one product's model catalog from its gateway. */
  async function refreshBuddyModels(productId) {
    const product = PRODUCTS[productId]
    if (product === undefined) return []
    const account = buddyAccounts().find(row => row.product === productId && row.enabled !== false)
    if (account === undefined) return []
    const credential = await usableBuddyCredential(product, account)
    if (credential === undefined) return []
    const models = await fetchBuddyModels(product, credential)
    if (models.length === 0) return []
    buddyStore.edit(value => ({
      ...value,
      models: { ...(value.models ?? {}), [productId]: models },
      modelsAt: { ...(value.modelsAt ?? {}), [productId]: Date.now() },
    }))
    rebuildExtras()
    try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
    return models
  }

  /** The endpoint document the page may see. The key itself never leaves. */
  function publicEndpoint(row) {
    return {
      id: row.id,
      name: row.name,
      baseUrl: row.baseUrl,
      enabled: row.enabled !== false,
      hasKey: typeof row.apiKey === 'string' && row.apiKey !== '',
      models: Array.isArray(row.models) ? row.models : [],
      modelsAt: Number(row.modelsAt) || 0,
      lastError: typeof row.lastError === 'string' ? row.lastError : '',
    }
  }

  /** Create or update one keyed endpoint. */
  function saveEndpoint(input) {
    const rows = sanitizeEndpoints(settingsStore.get().endpoints)
    const id = typeof input?.id === 'string' && /^[a-z0-9-]{1,32}$/.test(input.id)
      ? input.id
      : `e${crypto.randomBytes(4).toString('hex')}`
    const candidate = sanitizeEndpoints([{ ...input, id }])[0]
    if (candidate === undefined || !isCallableBaseUrl(candidate.baseUrl)) {
      throw new Error('Base URL 必须是可用的 http(s) 地址')
    }
    const previous = rows.find(row => row.id === id)
    if (candidate.apiKey === '' && previous !== undefined) candidate.apiKey = previous.apiKey
    if (candidate.name === candidate.baseUrl && previous !== undefined) candidate.name = previous.name
    const next = [...rows.filter(row => row.id !== id), candidate]
    settingsStore.update({ endpoints: next })
    rebuildExtras()
    try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
    return publicEndpoint(candidate)
  }

  /** Remove one keyed endpoint and its models. */
  function removeEndpoint(id) {
    const next = sanitizeEndpoints(settingsStore.get().endpoints).filter(row => row.id !== id)
    settingsStore.update({ endpoints: next })
    rebuildExtras()
    try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
    return next.map(publicEndpoint)
  }

  /** Ask one endpoint for its model list, and remember what it said. */
  async function discoverEndpointModels(id) {
    const rows = sanitizeEndpoints(settingsStore.get().endpoints)
    const row = rows.find(candidate => candidate.id === id)
    if (row === undefined) throw new Error('找不到这个端点')
    let models = []
    let error = ''
    try {
      models = await fetchEndpointModels(row)
    } catch (cause) {
      error = String(cause?.message ?? cause).slice(0, 200)
    }
    const next = rows.map(candidate => candidate.id === id
      ? {
        ...candidate,
        baseUrl: normalizeBaseUrl(candidate.baseUrl),
        models: models.length > 0 ? models : candidate.models,
        modelsAt: Date.now(),
        lastError: models.length > 0 ? '' : error,
      }
      : candidate)
    settingsStore.update({ endpoints: next })
    rebuildExtras()
    try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels */ }
    const saved = next.find(candidate => candidate.id === id)
    if (models.length === 0 && error !== '') throw new Error(error)
    return { models: saved?.models ?? [], endpoint: saved === undefined ? undefined : publicEndpoint(saved) }
  }

  /**
   * One listing round. Never throws: a failure keeps the previous roster.
   *
   * `probe: true` (the page's 重新检测 button) also asks every model for one
   * token, because a listing that answers is not the same claim as a model that
   * answers. A background refresh never probes — that would spend the pool's
   * quota on a timer.
   */
  async function refreshCatalog({ log = false, probe = false } = {}) {
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
      if (probe) {
        const results = await probeAll(next.map(entry => entry.id).filter(id => id !== AUTO_ID))
        if (disposed) return catalog
        probeStore.update({ at: Date.now(), results: { ...probeStore.get().results, ...results } })
      }
      try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels have no such method */ }
      if (log) logger.info?.(`vyra-free-model: ${next.length} models available${probe ? ' (probed)' : ''}`)
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
      settingsStore.dispose()
      probeStore.dispose()
      autoStore.dispose()
      buddyStore.dispose()
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
    catalog: () => catalog,
    probes: () => probeStore.get().results ?? {},
    laneOk: () => laneOk,
    laneSource: LANE_SOURCE,
    auto: () => autoModel() ?? null,
    accounts: () => ({ state: accountsState, providers: accountProviders(), claimFailedAt }),
    usage: () => todayTotals(usageStore.get()),
    forward: () => forwardState,
    refreshCatalog: () => refreshCatalog({ log: true, probe: true }),
    setForward,
    channel: callChannel,
    isEnabled: () => settingsStore.get().enabled !== false,
    setEnabled: async enabled => {
      settingsStore.update({ enabled: enabled === true })
      return settingsStore.get().enabled === true
    },
    extras: () => rebuildExtras(),
    credits: () => readCredits(),
    claimCredits: providerId => claimCreditsFor(providerId),
    autoSwitch: () => settingsStore.get().autoSwitch !== false,
    setAutoSwitch: async enabled => {
      settingsStore.update({ autoSwitch: enabled === true })
      return settingsStore.get().autoSwitch !== false
    },
    buddyLogin: productId => startBuddyLogin(productId),
    buddyRemove: id => removeBuddyAccount(id),
    buddyToggle: (id, enabled) => toggleBuddyAccount(id, enabled),
    buddyRefresh: productId => refreshBuddyModels(productId),
    endpoints: () => sanitizeEndpoints(settingsStore.get().endpoints).map(publicEndpoint),
    saveEndpoint,
    removeEndpoint,
    discoverEndpointModels,
    openUrl: openExternal,
    diag: () => {
      let channelCallable = false
      try { channelCallable = typeof ctx.get('channelPack')?.call === 'function' } catch { channelCallable = false }
      return {
        version: VERSION,
        channelCallable,
        accountsState,
        providers: providers.map(row => ({ id: row.id, accounts: row.accounts.length })),
        buddyAccounts: buddyAccounts().length,
        endpoints: sanitizeEndpoints(settingsStore.get().endpoints).length,
        probesAt: Number(probeStore.get().at) || 0,
        models: catalog.length,
        extras: extraCatalog.length,
      }
    },
    configureStatus: () => TOOLS.map(tool => readStatus(tool, dshHome)),
    configure: async (tool, dryRun) => configureTool(tool, dryRun),
    restoreConfigure: async (tool, stamp) => restoreTool(tool, stamp),
  })

  /** Config status for one tool, or every tool. */
  function configureStatus() {
    return TOOLS.map(tool => readStatus(tool, dshHome))
  }

  /**
   * Write the local port into one tool's configuration.
   *
   * Refuses when the port is off: a config pointing at a closed port is worse
   * than no config, because the failure shows up in the other tool as an
   * unexplained connection error.
   */
  async function configureTool(tool, dryRun) {
    if (!TOOLS.includes(tool)) return { ok: false, reason: `不支持的工具：${String(tool)}` }
    if (forwardState.enabled !== true || forwardState.port === 0) {
      return { ok: false, reason: '请先打开「让别的工具也用上」的端口，再写入配置。' }
    }
    const file = configPathFor(tool, dshHome)
    let original = ''
    try {
      original = fs.readFileSync(file, 'utf8')
    } catch { /* a first-time write starts from nothing */ }

    // The plugin cannot see which model the user picked in the harness picker, so
    // the automatic one is baked in: it is always valid and always the safest choice.
    const selected = AUTO_ID
    const plan = tool === 'claude'
      ? planClaudeWrite(original, { port: forwardState.port, key: forwardState.key, model: selected, home: dshHome })
      : planCodexWrite(original, { port: forwardState.port, home: dshHome })

    if (dryRun === true) return plan
    const applied = applyPlan(plan)
    if (applied.ok !== true) return applied

    // The launcher is what makes the config usable without touching defaults.
    const scriptFile = scriptPathFor(tool, dshHome)
    try {
      fs.mkdirSync(path.dirname(scriptFile), { recursive: true })
      fs.writeFileSync(scriptFile, starterScript(tool, {
        port: forwardState.port, key: forwardState.key, model: selected,
      }), { mode: 0o755 })
    } catch (error) {
      logger.warn?.(`vyra-free-model: could not write the ${tool} launcher (${error?.message ?? error})`)
    }

    return {
      ...applied,
      tool,
      script: scriptFile,
      command: path.basename(scriptFile).replace(/\.cmd$/, ''),
      port: forwardState.port,
      model: selected,
    }
  }

  /** Put a configuration file back exactly as its backup holds it. */
  async function restoreTool(tool, stamp) {
    if (!TOOLS.includes(tool)) return { ok: false, reason: `不支持的工具：${String(tool)}` }
    const file = configPathFor(tool, dshHome)
    const backups = listBackups(file)
    if (backups.length === 0) return { ok: false, reason: '没有可用的备份。' }
    const chosen = typeof stamp === 'string' && stamp !== ''
      ? backups.find(entry => entry.stamp === stamp)
      : backups[0]
    if (chosen === undefined) return { ok: false, reason: '找不到这个备份。' }
    const restored = restoreFrom(chosen.path, file)
    return restored.ok === true ? { ...restored, tool, stamp: chosen.stamp } : { ...restored, tool }
  }

  // The routes are optional: a headless composition has no web server, and that
  // must cost the settings page, never the models.
  ctx.inject(['webServer'], scoped => {
    scoped.effect(() => scoped.webServer.register({
      kind: 'prefix',
      path: API_PATH,
      handler: api,
    }), 'vyra-free-model: api routes')
  })

  /**
   * Mount the account pack.
   *
   * Deferred and guarded on two axes. Deferred, because it is a 2.6 MB module
   * that this plugin's core does not need — a person who only wants to chat must
   * never pay for it at boot. Guarded, because the pack claims the `accountPool`
   * service globally: if another plugin already mounted it, a second mount would
   * be a duplicate registration, so the existing one is reported instead.
   */
  ctx.inject(['credentials', 'commands', 'llm'], scoped => {
    scoped.effect(() => {
      let cancelled = false
      void (async () => {
        try {
          const pack = await import('./vendor/channel-pack/pack.js')
          if (cancelled) return
          if (ctx.get('accountPool') !== undefined) {
            accountsState = 'owned-elsewhere'
            logger.info?.('vyra-free-model: another plugin already owns the account pool; leaving it alone')
            return
          }
          pack.apply(scoped, { disableOpencode: true })
          accountsState = 'ready'
          // Cordis publishes a service on the next tick; the first read would
          // otherwise miss it and the block would stay empty until the retry.
          await new Promise(resolve => setTimeout(resolve, 50))
          await readProviders()
          logger.info?.(`vyra-free-model: account pack mounted with ${providers.length} providers`)
        } catch (error) {
          accountsState = 'failed'
          logger.warn?.(`vyra-free-model: could not mount the account pack (${error?.message ?? error})`)
        }
      })()
      return () => { cancelled = true }
    }, 'vyra-free-model: account pack')
  })

  // A signed-in Tencent account's catalog is refreshed shortly after boot when
  // it is older than a day; the stored list keeps the picker populated meanwhile.
  const buddyRefresh = setTimeout(() => {
    if (disposed) return
    const store = buddyStore.get()
    for (const productId of Object.keys(BUDDY_LABELS)) {
      if (!buddyAccounts().some(account => account.product === productId && account.enabled !== false)) continue
      const at = Number(store.modelsAt?.[productId]) || 0
      if (Date.now() - at > 24 * 60 * 60_000) void refreshBuddyModels(productId)
    }
  }, 4_000)
  buddyRefresh.unref?.()

  // The account pack mounts asynchronously; a failed first read leaves the
  // block empty for the rest of the session. One retry costs nothing.
  const providersRetry = setTimeout(() => {
    if (disposed || accountsState !== 'ready' || providers.length > 0) return
    void readProviders()
  }, 6_000)
  providersRetry.unref?.()

  // Claim once shortly after boot, then daily. Both timers are unref'd: a
  // background courtesy must never be the reason the process stays alive.
  const firstClaim = setTimeout(() => { void autoClaim() }, 60_000)
  firstClaim.unref?.()
  const dailyClaim = setInterval(() => { void autoClaim() }, 24 * 60 * 60_000)
  dailyClaim.unref?.()

  ctx.effect(() => () => {
    clearTimeout(firstClaim)
    clearTimeout(buddyRefresh)
    clearTimeout(providersRetry)
    clearInterval(dailyClaim)
  }, 'vyra-free-model: credit claims')

  /**
   * The provider rows, read from the pack once it is up.
   *
   * A failed read is not a reason to show an error: the account block degrades
   * to "sign in later", which is still a usable page.
   */
  async function readProviders() {
    try {
      const ids = ACCOUNT_PROVIDERS.map(provider => provider.id)
      // The pack answers `provider.status` only when it is told which providers;
      // an empty call is a bad request, which is why this block used to render
      // an empty list forever.
      const status = await callChannel('provider.status', { providers: ids })
      const rows = []
      for (const meta of ACCOUNT_PROVIDERS) {
        let accounts = []
        try {
          const listed = await callChannel('account.list', { provider: meta.id })
          accounts = Array.isArray(listed?.accounts) ? listed.accounts.map(account => {
            const id = String(account?.id ?? '')
            const nickname = typeof account?.nickname === 'string' ? account.nickname : ''
            const expiresAt = Number(account?.expiresAt) || 0
            const refreshable = account?.refreshable === true
            // The pack writes a placeholder row the moment a sign-in starts and
            // fills it in (nickname / expiry / refresh) when the browser side
            // finishes. Nothing has landed while all three still say "empty".
            const pending = nickname === id && expiresAt <= 0 && !refreshable
            return {
              id,
              nickname,
              enabled: account?.enabled !== false,
              expiresAt,
              refreshable,
              pending,
            }
          }) : []
        } catch { /* one provider's list failing must not blank the others */ }
        rows.push({
          id: meta.id,
          label: meta.label,
          more: meta.more === true,
          claimable: CLAIMABLE_PROVIDERS.includes(meta.id),
          status: status?.statuses?.[meta.id] ?? null,
          accounts,
        })
      }
      providers.length = 0
      providers.push(...rows)
      return providers
    } catch (error) {
      logger.warn?.(`vyra-free-model: could not read the account providers (${error?.message ?? error})`)
      return []
    }
  }

  /**
   * Claim daily credits without being asked.
   *
   * Once shortly after boot, then once a day. A success says nothing — the
   * credits simply appear. A failure records when, so the card can say the
   * automatic claim did not work and offer one retry, instead of the user
   * discovering empty quota at the moment they need it.
   *
   * The pack requires a provider on every claim; claiming "all" is not a shape
   * it has, which is why the old single call never worked.
   */
  async function autoClaim() {
    if (accountsState !== 'ready') return
    const rows = await readProviders()
    const targets = rows.filter(row => row.claimable && row.accounts.length > 0).map(row => row.id)
    let failures = 0
    for (const provider of targets) {
      try {
        await callChannel('credits.claimAll', { provider })
      } catch (error) {
        failures += 1
        logger.warn?.(`vyra-free-model: automatic credit claim for ${provider} failed (${error?.message ?? error})`)
      }
    }
    // The Tencent lane keeps its own accounts; claim theirs too.
    for (const productId of Object.keys(BUDDY_LABELS)) {
      if (!buddyAccounts().some(account => account.product === productId && account.enabled !== false)) continue
      try {
        await claimCreditsFor(productId)
      } catch (error) {
        failures += 1
        logger.warn?.(`vyra-free-model: automatic credit claim for ${productId} failed (${error?.message ?? error})`)
      }
    }
    claimFailedAt = failures > 0 ? Date.now() : undefined
    if (targets.length > 0) await readProviders()
  }
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
 * Open a URL in the machine's default browser.
 *
 * The page also shows the URL and a copy button, so this is a convenience, not
 * the only way in: a browser popup opened after an await is blocked, and a
 * system browser is not.
 */
export function openExternal(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
  // The offline suite must never launch a real browser.
  if (process.env.VYRA_NO_OPEN_BROWSER === '1') return false
  try {
    let child
    if (process.platform === 'win32') {
      child = spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' })
    } else {
      child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' })
    }
    child.on('error', () => {})
    child.unref()
    return true
  } catch {
    return false
  }
}

/**
 * `Baidu: ERNIE-5.5-Flash-Preview (free)` -> `ERNIE-5.5-Flash-Preview`.
 *
 * The picker row is one line; the vendor prefix and the `(free)` suffix repeat
 * what the group already says.
 */
export function shortModelName(name) {
  const value = String(name ?? '').trim()
  const afterColon = value.includes(': ') ? value.slice(value.indexOf(': ') + 2) : value
  return afterColon.replace(/\s*\(free\)\s*$/i, '').replace(/\s+/g, ' ').slice(0, 48)
}

/** `1024000` -> `1M`, `262144` -> `256K`, matching what the page shows. */
export function formatWindow(value) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1_000_000) {
    const millions = Math.round((value / 1_000_000) * 10) / 10
    return `${millions % 1 === 0 ? millions : millions.toFixed(1)}M`
  }
  if (value >= 1024) return `${Math.round(value / 1024)}K`
  return String(value)
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
export function createSummary({
  version, catalog, probes, laneOk, laneSource, auto, accounts, usage, forward, enabled,
  extras, endpoints, autoSwitch,
}) {
  const probed = probes !== null && typeof probes === 'object' ? probes : {}
  return {
    version,
    enabled: enabled !== false,
    autoSwitch: autoSwitch !== false,
    lane: {
      ok: laneOk === true,
      source: laneSource ?? null,
      auto: auto ?? null,
      models: (catalog ?? []).map(entry => ({
        id: entry.id,
        name: entry.name,
        contextWindow: entry.contextWindow,
        maxOutput: entry.maxOutput,
        vision: entry.vision === true,
        efforts: entry.efforts ?? null,
        probe: probed[entry.id] ?? null,
      })),
    },
    extras: {
      models: (extras ?? []).map(row => ({
        id: row.id,
        name: row.name,
        contextWindow: row.contextWindow,
        vision: row.vision === true,
        source: row.source ?? '',
        lane: row.lane ?? '',
      })),
      buddy: {
        products: [],
        accounts: [],
      },
      endpoints: endpoints ?? [],
    },
    accounts: {
      state: accounts?.state ?? 'pending',
      providers: accounts?.providers ?? [],
      ...(Number.isFinite(accounts?.claimFailedAt) ? { claimFailedAt: accounts.claimFailedAt } : {}),
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

      if (routePath === '/diag' && method === 'GET') {
        return send(200, typeof deps.diag === 'function' ? deps.diag() : { diag: 'unavailable' })
      }

      if (routePath === '/summary' || routePath === '/recheck' || routePath === '/forward'
        || routePath === '/forward/key' || routePath === '/channel' || routePath === '/enabled'
        || routePath === '/buddy' || routePath === '/endpoints' || routePath === '/auto-switch'
        || routePath === '/credits' || routePath === '/credits/claim'
        || routePath === '/configure' || routePath === '/configure/restore' || routePath === '/configure/status') {
        const wantsGet = routePath === '/summary' || routePath === '/configure/status' || routePath === '/credits'
        if (method !== 'POST' && !wantsGet) return send(405, { error: 'method-not-allowed' })
        if (wantsGet && method !== 'GET') return send(405, { error: 'method-not-allowed' })
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

      if (routePath === '/forward/key' && method === 'POST') {
        // The key exists so this machine's tools can authenticate to a loopback
        // port. Hiding it from the page that has to paste it protects nothing —
        // anything able to read this response is already running as this user,
        // and could read the file it lives in. It stays out of /summary because
        // that document is rendered into the page body; this route is asked for
        // only when a copy button is pressed.
        const forward = deps.forward?.() ?? {}
        if (forward.enabled !== true || typeof forward.key !== 'string' || forward.key === '') {
          return send(409, { error: 'forward-disabled' })
        }
        return send(200, { key: forward.key })
      }

      if (routePath === '/enabled' && method === 'POST') {
        const body = await readJson(req)
        const enabled = body?.enabled === true
        // The store belongs to the caller's composition, so the route reaches it
        // through the injected setter rather than a captured variable.
        if (typeof deps.setEnabled !== 'function') return send(503, { error: 'settings-unavailable' })
        const value = await deps.setEnabled(enabled)
        return send(200, { enabled: value === true })
      }

      if (routePath === '/auto-switch' && method === 'POST') {
        const body = await readJson(req)
        if (typeof deps.setAutoSwitch !== 'function') return send(503, { error: 'settings-unavailable' })
        const value = await deps.setAutoSwitch(body?.enabled === true)
        return send(200, { autoSwitch: value === true })
      }

      if (routePath === '/credits' && method === 'GET') {
        if (typeof deps.credits !== 'function') return send(503, { error: 'credits-unavailable' })
        try {
          return send(200, { providers: await deps.credits() })
        } catch (error) {
          return send(502, { error: String(error?.message ?? error).slice(0, 300) })
        }
      }

      if (routePath === '/credits/claim' && method === 'POST') {
        const body = await readJson(req)
        if (typeof deps.claimCredits !== 'function') return send(503, { error: 'credits-unavailable' })
        try {
          const value = await deps.claimCredits(body?.provider)
          return send(200, { value, providers: await deps.credits() })
        } catch (error) {
          return send(502, { error: String(error?.message ?? error).slice(0, 300) })
        }
      }

      if (routePath === '/configure/status' && method === 'GET') {
        return send(200, { tools: deps.configureStatus?.() ?? [] })
      }

      if (routePath === '/configure' && method === 'POST') {
        const body = await readJson(req)
        if (typeof deps.configure !== 'function') return send(503, { error: 'configure-unavailable' })
        const result = await deps.configure(body?.tool, body?.dryRun === true)
        return send(result?.ok === true ? 200 : 409, result ?? { ok: false, reason: 'no result' })
      }

      if (routePath === '/configure/restore' && method === 'POST') {
        const body = await readJson(req)
        if (typeof deps.restoreConfigure !== 'function') return send(503, { error: 'configure-unavailable' })
        const result = await deps.restoreConfigure(body?.tool, body?.stamp)
        return send(result?.ok === true ? 200 : 409, result ?? { ok: false, reason: 'no result' })
      }

      if (routePath === '/channel' && method === 'POST') {
        const body = await readJson(req)
        if (!isChannelMethodAllowed(body?.method)) return send(403, { error: 'method-not-allowed' })
        if (typeof deps.channel !== 'function') return send(503, { error: 'channels-unavailable' })
        try {
          const value = await deps.channel(body.method, body?.payload)
          // A browser popup opened after this await is blocked; a system browser
          // is not. The page still gets the URL as a copyable fallback.
          if (body.method === 'account.create' && typeof value?.loginUrl === 'string') {
            deps.openUrl?.(value.loginUrl)
          }
          return send(200, { value })
        } catch (error) {
          return send(502, { error: String(error?.message ?? error).slice(0, 300) })
        }
      }

      if (routePath === '/buddy' && method === 'POST') {
        const body = await readJson(req)
        try {
          if (body?.action === 'login') {
            if (typeof deps.buddyLogin !== 'function') return send(503, { error: 'buddy-unavailable' })
            const value = await deps.buddyLogin(body?.product)
            return send(200, { value, accounts: deps.buddyAccounts?.() ?? [] })
          }
          if (body?.action === 'remove') {
            if (typeof deps.buddyRemove !== 'function') return send(503, { error: 'buddy-unavailable' })
            const accounts = await deps.buddyRemove(body?.id)
            return send(200, { accounts })
          }
          if (body?.action === 'toggle') {
            if (typeof deps.buddyToggle !== 'function') return send(503, { error: 'buddy-unavailable' })
            const accounts = await deps.buddyToggle(body?.id, body?.enabled === true)
            return send(200, { accounts })
          }
          if (body?.action === 'refresh') {
            if (typeof deps.buddyRefresh !== 'function') return send(503, { error: 'buddy-unavailable' })
            const models = await deps.buddyRefresh(body?.product)
            return send(200, { models })
          }
          return send(400, { error: 'unknown action' })
        } catch (error) {
          return send(502, { error: String(error?.message ?? error).slice(0, 300) })
        }
      }

      if (routePath === '/endpoints' && method === 'POST') {
        const body = await readJson(req)
        try {
          if (body?.action === 'save') {
            if (typeof deps.saveEndpoint !== 'function') return send(503, { error: 'endpoints-unavailable' })
            const endpoint = await deps.saveEndpoint(body?.endpoint)
            return send(200, { endpoint, endpoints: deps.endpoints?.() ?? [] })
          }
          if (body?.action === 'remove') {
            if (typeof deps.removeEndpoint !== 'function') return send(503, { error: 'endpoints-unavailable' })
            const endpoints = await deps.removeEndpoint(body?.id)
            return send(200, { endpoints })
          }
          if (body?.action === 'models') {
            if (typeof deps.discoverEndpointModels !== 'function') return send(503, { error: 'endpoints-unavailable' })
            const value = await deps.discoverEndpointModels(body?.id)
            return send(200, { ...value, endpoints: deps.endpoints?.() ?? [] })
          }
          return send(400, { error: 'unknown action' })
        } catch (error) {
          return send(409, { error: String(error?.message ?? error).slice(0, 300) })
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
    probes: deps.probes?.() ?? {},
    laneOk: deps.laneOk?.() === true,
    laneSource: deps.laneSource,
    auto: deps.auto?.(),
    accounts: deps.accounts?.() ?? { state: 'pending', providers: [] },
    usage: deps.usage?.() ?? { input: 0, output: 0, total: 0 },
    forward: deps.forward?.() ?? { enabled: false, port: 0, key: '' },
    enabled: deps.isEnabled?.() !== false,
    autoSwitch: deps.autoSwitch?.() !== false,
    extras: deps.extras?.(),
    endpoints: deps.endpoints?.(),
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
