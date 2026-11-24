// Host half of dsh-vyra-skill-mcp-manager.
// The UI reuses the data RPC of dsh-skill-mcp-market. The only thing added here is a route that
// registers the LobeHub market client. dsh-skill-mcp-market tries to do it itself, but its
// Windows command quoting splits `--name "DSH Market"` into two arguments, so the CLI rejects it.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { apply as applyMarketHost } from './vendor/dsh-skill-mcp-market/market-host.js'

const BASE_URL = 'https://market.lobehub.com'
const CREDENTIALS = join(homedir(), '.lobehub-market', 'credentials.json')

function quoteForCmd(value) {
  const text = String(value)
  return /[\s"&|<>^]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function runRegister() {
  const args = ['register', '--base-url', BASE_URL, '--name', 'DSH Market', '--source', 'dsh', '--output', 'json']
  const isWindows = process.platform === 'win32'
  const file = isWindows ? process.env.ComSpec || 'cmd.exe' : 'npx'
  const argv = isWindows
    ? ['/d', '/s', '/c', `"${['npx', '-y', '@lobehub/market-cli', ...args].map(quoteForCmd).join(' ')}"`]
    : ['-y', '@lobehub/market-cli', ...args]
  return new Promise((resolve, reject) => {
    execFile(
      file,
      argv,
      {
        timeout: 150000,
        windowsHide: true,
        windowsVerbatimArguments: isWindows,
        env: { ...process.env, NO_COLOR: '1', npm_config_yes: 'true' },
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(String(stderr || error.message).replace(/\s+/g, ' ').slice(0, 300)))
        else resolve(String(stdout || ''))
      },
    )
  })
}

let pending = null

async function ensureRegistered() {
  if (existsSync(CREDENTIALS)) return { registered: true, already: true }
  if (!pending) pending = runRegister().finally(() => { pending = null })
  await pending
  return { registered: existsSync(CREDENTIALS), already: false }
}

// ---- SKILL.md preview: fetch one file instead of installing a whole package ----
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const SLUG_RE = /^[A-Za-z0-9_.-]+$/
const PREVIEW_CAP = 200 * 1024
const previewCache = new Map()

function repoOf(item) {
  if (REPO_RE.test(String(item.repo || ''))) return item.repo
  if (item.source === 'skills.sh' && REPO_RE.test(String(item.owner || ''))) return item.owner
  const m = /github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?:[/#?].*)?$/.exec(String(item.upstreamUrl || item.homepage || ''))
  return m ? m[1] : null
}

async function fetchGitHubContent(repo, path, ms = 20000) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: { 'user-agent': 'skill-mcp-manager', accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(ms),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.type !== 'file' || !data.content) return null
    const decoded = Buffer.from(data.content, 'base64').toString('utf8')
    return decoded.slice(0, PREVIEW_CAP)
  } catch {
    return null
  }
}

async function previewRemote(item) {
  const repo = repoOf(item)
  const slug = String(item.slug || '')
  if (!repo || !SLUG_RE.test(slug)) return { ok: false, unsupported: true, error: '该来源暂不支持在线预览，请到详情页链接查看' }
  const key = `${repo}#${slug}`
  if (previewCache.has(key)) return previewCache.get(key)
  const dir = String(item.skillDir || '').replace(/^\/+|\/+$/g, '')
  const guesses = [
    ...(/^[A-Za-z0-9_./-]+$/.test(dir) && !dir.includes('..') && dir ? [`${dir}/SKILL.md`] : []),
    `skills/${slug}/SKILL.md`, `${slug}/SKILL.md`, `.claude/skills/${slug}/SKILL.md`, 'SKILL.md',
  ]
  let found = null
  for (const path of guesses) {
    const content = await fetchGitHubContent(repo, path)
    if (content) { found = { path, content }; break }
  }
  if (!found) {
    const tree = await fetch(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`, {
      headers: { 'user-agent': 'skill-mcp-manager', accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(20000),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    const hit = tree && Array.isArray(tree.tree) ? tree.tree.find((n) => n.path === `${slug}/SKILL.md` || n.path.endsWith(`/${slug}/SKILL.md`)) : null
    if (hit) {
      const content = await fetchGitHubContent(repo, hit.path)
      if (content) found = { path: hit.path, content }
    }
  }
  if (!found) return { ok: false, error: `在 ${repo} 中没有找到 ${slug} 的 SKILL.md` }
  const result = { ok: true, repo, path: found.path, content: found.content, url: `https://github.com/${repo}/blob/HEAD/${found.path}` }
  previewCache.set(key, result)
  if (previewCache.size > 200) previewCache.delete(previewCache.keys().next().value)
  return result
}

// Local SKILL.md of an installed skill; restricted to the two skill roots, read only.
const LOCAL_ROOTS = [join(homedir(), '.agents', 'skills'), join(homedir(), '.dsh', 'market', 'skills')]

async function previewLocal(path) {
  const { resolve, basename, sep } = await import('node:path')
  const { readFile, stat } = await import('node:fs/promises')
  const full = resolve(String(path || ''))
  const allowed = LOCAL_ROOTS.some((root) => full.toLowerCase().startsWith(resolve(root).toLowerCase() + sep))
  if (!allowed || basename(full) !== 'SKILL.md') return { ok: false, error: '只允许读取技能目录下的 SKILL.md' }
  const info = await stat(full)
  if (info.size > PREVIEW_CAP) return { ok: false, error: '文件过大' }
  return { ok: true, path: full, content: await readFile(full, 'utf8') }
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function route(webServer, ctx, path, label, work) {
  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path,
        handler: async (req, res) => {
          let payload
          try {
            payload = await work(await readJson(req))
          } catch (error) {
            payload = { ok: false, error: String(error && error.message ? error.message : error) }
          }
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify(payload))
        },
      }),
    label,
  )
}

// ---- user-configured markets: a JSON index fetched by the host (browsers hit CORS) ----
const marketCache = new Map()
const MAX_ITEMS = 3000
const str = (v) => (typeof v === 'string' ? v : '')

function pickRows(json) {
  if (Array.isArray(json)) return json
  for (const key of ['items', 'skills', 'servers', 'data', 'results']) {
    if (json && Array.isArray(json[key])) return json[key]
  }
  return []
}

function normalizeSkillRow(r) {
  if (!r || typeof r !== 'object') return null
  const slug = str(r.slug) || str(r.id) || str(r.name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  if (!slug) return null
  const repo = REPO_RE.test(str(r.repo)) ? r.repo : repoOf({ homepage: r.homepage }) || ''
  const url = /^https?:\/\//i.test(str(r.url)) ? r.url : ''
  const skillDir = str(r.skillDir) || str(r.dir)
  const install = url ? { source: 'url', reference: url } : repo ? { source: 'github', reference: repo, skillDir } : null
  return {
    id: `custom:${slug}`, slug, name: str(r.name) || slug, description: str(r.description), category: str(r.category),
    source: 'custom', sourceLabel: '自定义市场', owner: repo, repo, skillDir,
    homepage: str(r.homepage) || (repo ? `https://github.com/${repo}` : ''),
    installs: Number(r.installs || r.downloads) || 0, version: str(r.version), install, installable: Boolean(install),
  }
}

function normalizeMcpRow(r) {
  if (!r || typeof r !== 'object') return null
  const s = r.server && typeof r.server === 'object' ? r.server : r
  const slug = str(s.name) || str(s.slug)
  if (!slug) return null
  const packages = Array.isArray(s.packages) ? s.packages : []
  const remote = Array.isArray(s.remotes) ? s.remotes.find((x) => x && /^https?:\/\//i.test(str(x.url))) : null
  const npm = packages.find((p) => p && p.registryType === 'npm' && str(p.identifier))
  const pypi = packages.find((p) => p && p.registryType === 'pypi' && str(p.identifier))
  let transport = str(s.transport)
  let command = str(s.command)
  let args = Array.isArray(s.args) ? s.args.map(String) : []
  let url = str(s.url)
  let envRequired = Array.isArray(s.envRequired) ? s.envRequired.map(String) : []
  const envOf = (pkg) => (Array.isArray(pkg.environmentVariables) ? pkg.environmentVariables : []).filter((e) => e && e.isRequired && str(e.name)).map((e) => e.name)
  if (!command && !url) {
    if (remote) {
      transport = 'streamable-http'
      url = remote.url
    } else if (npm) {
      transport = 'stdio'
      command = 'npx'
      args = ['-y', npm.identifier]
      envRequired = envOf(npm)
    } else if (pypi) {
      transport = 'stdio'
      command = 'uvx'
      args = [pypi.identifier]
      envRequired = envOf(pypi)
    }
  }
  if (!transport) transport = url ? 'streamable-http' : 'stdio'
  const repository = s.repository && typeof s.repository === 'object' ? str(s.repository.url) : ''
  return {
    id: `custom:${slug}`, slug, name: str(s.title) || slug.split('/').pop(), description: str(s.description),
    category: str(r.category) || str(s.category), source: 'custom', sourceLabel: '自定义市场',
    transport, command, args, url, envRequired, homepage: str(s.websiteUrl) || str(s.homepage) || repository,
    installable: Boolean(url || command),
  }
}

async function loadCustomMarket(kind, url) {
  if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('市场地址必须以 http:// 或 https:// 开头')
  const key = `${kind}|${url}`
  const hit = marketCache.get(key)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.items
  const res = await fetch(url, { headers: { 'user-agent': 'skill-mcp-manager', accept: 'application/json' }, signal: AbortSignal.timeout(25000) })
  if (!res.ok) throw new Error(`读取市场失败：HTTP ${res.status}`)
  const text = await res.text()
  if (text.length > 8 * 1024 * 1024) throw new Error('市场文件超过 8MB')
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('该地址返回的不是 JSON')
  }
  const items = pickRows(json).map(kind === 'mcp' ? normalizeMcpRow : normalizeSkillRow).filter(Boolean).slice(0, MAX_ITEMS)
  if (items.length === 0) throw new Error('没有从该地址读到任何条目，请检查 JSON 格式')
  marketCache.set(key, { at: Date.now(), items })
  return items
}

// ---- usage counters: count real tool dispatches, persisted next to the profile ----
const USAGE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'skill-mcp-manager')
const USAGE_FILE = join(USAGE_DIR, 'usage.json')

function emptyUsage() {
  return { updatedAt: 0, since: Date.now(), tools: {}, skills: {}, mcp: {} }
}

async function readUsage() {
  try {
    const { readFile } = await import('node:fs/promises')
    const parsed = JSON.parse(await readFile(USAGE_FILE, 'utf8'))
    return { ...emptyUsage(), ...parsed }
  } catch {
    return emptyUsage()
  }
}

let usageState = null
let usageTimer = null

async function flushUsage() {
  usageTimer = null
  if (!usageState) return
  try {
    const { mkdir, writeFile } = await import('node:fs/promises')
    usageState.updatedAt = Date.now()
    await mkdir(USAGE_DIR, { recursive: true })
    await writeFile(USAGE_FILE, JSON.stringify(usageState), 'utf8')
  } catch {
    /* counters are best-effort */
  }
}

function tallyUsage(exec) {
  const name = String(exec && exec.name ? exec.name : '')
  if (!name) return
  if (!usageState) usageState = emptyUsage()
  const args = exec.arguments && typeof exec.arguments === 'object' ? exec.arguments : {}
  usageState.tools[name] = (usageState.tools[name] || 0) + 1
  if (name === 'skill') {
    const slug = String(args.name || args.skill || '').trim()
    if (slug) usageState.skills[slug] = (usageState.skills[slug] || 0) + 1
  } else if (name.startsWith('mcp__')) {
    const rest = name.slice(5)
    const cut = rest.indexOf('__')
    const server = cut > 0 ? rest.slice(0, cut) : rest
    const tool = cut > 0 ? rest.slice(cut + 2) : ''
    const entry = usageState.mcp[server] || { total: 0, tools: {} }
    entry.total += 1
    if (tool) entry.tools[tool] = (entry.tools[tool] || 0) + 1
    usageState.mcp[server] = entry
  }
  if (!usageTimer) usageTimer = setTimeout(flushUsage, 2000)
  if (usageTimer.unref) usageTimer.unref()
}

// Import a dropped .zip: the browser cannot hand us a path, so bytes come in as base64.
async function loadMarketSkills() {
  const candidates = ['dsh-skill-mcp-market/src/skills.js']
  const profileDir = process.env.DSH_PROFILE_DIR
  if (profileDir) {
    const { pathToFileURL } = await import('node:url')
    candidates.push(pathToFileURL(join(profileDir, 'node_modules', 'dsh-skill-mcp-market', 'src', 'skills.js')).href)
  }
  let last
  for (const spec of candidates) {
    try {
      return await import(spec)
    } catch (error) {
      last = error
    }
  }
  throw new Error(`找不到 dsh-skill-mcp-market 的安装模块：${String(last && last.message ? last.message : last)}`)
}

async function importZip(base64, name) {
  const { writeFile, mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const raw = String(base64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!raw) throw new Error('没有收到文件内容')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length === 0) throw new Error('文件是空的')
  if (buf.length > 40 * 1024 * 1024) throw new Error('压缩包超过 40MB')
  const dir = await mkdtemp(join(tmpdir(), 'skill-zip-'))
  const zipPath = join(dir, 'upload.zip')
  await writeFile(zipPath, buf)
  try {
    const market = await loadMarketSkills()
    const skillDirs = [join(homedir(), '.agents', 'skills'), join(homedir(), '.dsh', 'market', 'skills')]
    const result = await market.installSkill({ source: 'zip', reference: zipPath, name: name || '', force: true, skillDirs })
    return { ok: true, slug: result.slug, files: result.files }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// ---- tool-level switches + context-estimate + raw MCP config file ----
const TOOL_PREFS_FILE = join(USAGE_DIR, 'tools.json')
const MCP_CONFIG_ROOTS = [
  join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'market', 'mcp'),
  join(homedir(), '.dsh', 'market', 'mcp'),
]

let disabledTools = []
let prefsTouched = false
let lastRestrictError = ''
/** agent.id -> { deny, disposer }. Restriction must be applied per agent (agent.ctx). */
const agentRestrictions = new Map()
const applyingRestrictions = new Set()

async function readToolPrefs() {
  try {
    const { readFile } = await import('node:fs/promises')
    const parsed = JSON.parse(await readFile(TOOL_PREFS_FILE, 'utf8'))
    return Array.isArray(parsed.disabled) ? parsed.disabled.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function writeToolPrefs() {
  try {
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(USAGE_DIR, { recursive: true })
    await writeFile(TOOL_PREFS_FILE, JSON.stringify({ disabled: disabledTools, updatedAt: Date.now() }), 'utf8')
  } catch {
    /* best effort */
  }
}

// Rough model-facing size of one tool: name + description + JSON parameters.
// 3.5 chars/token matches mixed Chinese/English tool text well enough for a ranking.
function catalogOf(ctx) {
  const tools = ctx.get('tools')
  if (!tools || typeof tools.schemas !== 'function') return null
  let schemas = []
  try {
    schemas = tools.schemas() || []
  } catch {
    return null
  }
  const rows = []
  for (const schema of schemas) {
    const name = String(schema && schema.name ? schema.name : '')
    if (!name.startsWith('mcp__')) continue
    const rest = name.slice(5)
    const cut = rest.indexOf('__')
    const server = cut > 0 ? rest.slice(0, cut) : rest
    const json = JSON.stringify({ name, description: schema.description || '', parameters: schema.parameters || {} })
    rows.push({
      name,
      server,
      label: cut > 0 ? rest.slice(cut + 2) : name,
      description: String(schema.description || '').slice(0, 240),
      chars: json.length,
      tokens: Math.max(1, Math.ceil(json.length / 3.5)),
      disabled: disabledTools.includes(name),
    })
  }
  rows.sort((a, b) => a.server.localeCompare(b.server) || a.label.localeCompare(b.label))
  return rows
}

function knownToolNames(ctx) {
  try {
    const tools = ctx.get('tools')
    return tools && typeof tools.schemas === 'function' ? (tools.schemas() || []).map((s) => String(s && s.name ? s.name : '')) : []
  } catch {
    return []
  }
}

function applyAgentRestriction(ctx, agent) {
  const id = agent && agent.id
  if (!id || typeof id !== 'string') return
  // restrict() emits tools/change SYNCHRONOUSLY and our listener re-enters here;
  // without this guard the same deny set would be recomputed recursively.
  if (applyingRestrictions.has(id)) return
  applyingRestrictions.add(id)
  try {
    const deny = disabledTools.filter((name) => knownToolNames(ctx).includes(name))
    const current = agentRestrictions.get(id)
    if (current !== undefined && current.deny.join('\u0000') === deny.join('\u0000')) return
    if (current !== undefined) {
      // Drop the map entry BEFORE disposing: the disposer also emits tools/change.
      agentRestrictions.delete(id)
      try {
        current.disposer()
      } catch {
        /* already lifted */
      }
    }
    if (deny.length === 0) return
    const tools = agent.ctx && typeof agent.ctx.get === 'function' ? agent.ctx.get('tools') : undefined
    if (tools === undefined || typeof tools.restrict !== 'function') return
    const disposer = tools.restrict({ deny })
    agentRestrictions.set(id, { deny, disposer })
    lastRestrictError = ''
  } catch (error) {
    lastRestrictError = String(error && error.message ? error.message : error)
  } finally {
    applyingRestrictions.delete(id)
  }
}

function agentsOf(ctx) {
  // `ctx.get('agents')` only: reading `ctx.agents` as a property throws when the
  // plugin does not declare `agents` in its `inject` list (cordis reflect.ts
  // "cannot get property … without inject"), and a `typeof` guard cannot catch
  // that because the throw happens while the operand is evaluated. This runs
  // from a top-level promise and an `agent/created` listener, so the throw
  // escapes every try/catch in this file and fails the whole host load.
  const service = typeof ctx.get === 'function' ? ctx.get('agents') : undefined
  if (!service || typeof service.list !== 'function') return []
  try {
    return service.list() || []
  } catch {
    return []
  }
}

function refreshAgentRestrictions(ctx) {
  const agents = agentsOf(ctx)
  for (const agent of agents) applyAgentRestriction(ctx, agent)
  return agents.length
}

function safeMcpConfigPath(raw) {
  const target = join(String(raw || ''))
  const resolved = target
  const ok = MCP_CONFIG_ROOTS.some((root) => resolved.toLowerCase().startsWith(join(root).toLowerCase()))
  if (!ok) throw new Error('只允许编辑 MCP 配置目录下的 JSON 文件')
  if (!/\.json$/i.test(resolved)) throw new Error('只允许编辑 .json 文件')
  return resolved
}

async function readMcpConfig(raw) {
  const { readFile } = await import('node:fs/promises')
  const file = safeMcpConfigPath(raw)
  const text = await readFile(file, 'utf8')
  return { ok: true, path: file, content: text }
}

async function writeMcpConfig(raw, content) {
  const { writeFile } = await import('node:fs/promises')
  const file = safeMcpConfigPath(raw)
  const text = String(content || '')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('内容不是合法 JSON，未写入')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON 顶层必须是对象')
  await writeFile(file, text, 'utf8')
  return { ok: true, path: file }
}

export const name = 'dsh-vyra-skill-mcp-manager'

/**
 * Services this plugin needs before `apply` runs.
 *
 * `tools` is not read by this file — it is what the vendored data half needs to
 * register its twelve `skill_market_*` / `mcp_market_*` tools, and declaring it
 * here is what lets that half run at all. `webServer` and `skills` are still
 * read through `ctx.get`, because their providers activate at a different time
 * and a hard injection would fail the whole plugin on a slow boot.
 */
export const inject = ['tools']

export function apply(ctx) {
  // The vendored half owns the data: it mounts the skill provider that makes
  // installed skills visible, serves the panel's RPC at `/api/dsh-market/rpc`,
  // and registers the agent-facing tools. This half owns the panel routes the
  // UI calls beyond that RPC. They are one plugin because the panel is useless
  // without the provider behind it, and shipping them separately is what left
  // this plugin reading from an endpoint nobody served.
  applyMarketHost(ctx)
  applyPanel(ctx)
}

function applyPanel(ctx) {
  let registered = false
  // webServer may not exist yet when this plugin is applied (load order varies), and the
  // service announce arrives later. Registering once, and retrying on the announce, is the
  // difference between "routes exist" and every request falling through to a 401/404.
  const registerRoutes = () => {
    if (registered) return
    const webServer = ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') return
    registered = true
    route(webServer, ctx, '/api/skill-mcp-manager/skill-preview', 'skill-mcp-manager.skill-preview', async (body) =>
      body.path ? previewLocal(body.path) : previewRemote(body.item || {}))
    route(webServer, ctx, '/api/skill-mcp-manager/custom-market', 'skill-mcp-manager.custom-market', async (body) => ({
      ok: true,
      items: await loadCustomMarket(body.kind === 'mcp' ? 'mcp' : 'skill', body.url),
    }))
    route(webServer, ctx, '/api/skill-mcp-manager/import-zip', 'skill-mcp-manager.import-zip', async (body) =>
      importZip(body.zipBase64, body.name))
    route(webServer, ctx, '/api/skill-mcp-manager/health', 'skill-mcp-manager.health', async () => ({ ok: true, plugin: name }))
    route(webServer, ctx, '/api/skill-mcp-manager/usage', 'skill-mcp-manager.usage', async (body) => {
      if (body && body.reset) {
        usageState = emptyUsage()
        await flushUsage()
        return { ok: true, usage: usageState }
      }
      if (!usageState) usageState = await readUsage()
      return { ok: true, usage: usageState }
    })
    route(webServer, ctx, '/api/skill-mcp-manager/tools', 'skill-mcp-manager.tools', async () => {
      const rows = catalogOf(ctx)
      if (rows === null) return { ok: false, error: 'tools 服务不可用，暂时读不到工具列表' }
      const servers = {}
      for (const row of rows) {
        const bucket = servers[row.server] || { count: 0, tokens: 0, disabled: 0 }
        bucket.count += 1
        bucket.tokens += row.tokens
        if (row.disabled) bucket.disabled += 1
        servers[row.server] = bucket
      }
      return { ok: true, tools: rows, servers, disabled: disabledTools }
    })
    route(webServer, ctx, '/api/skill-mcp-manager/tools/toggle', 'skill-mcp-manager.tools-toggle', async (body) => {
      const name = String(body.name || '')
      if (!name.startsWith('mcp__')) throw new Error('只能切换 MCP 工具')
      const wantEnabled = Boolean(body.enabled)
      prefsTouched = true
      disabledTools = wantEnabled
        ? disabledTools.filter((x) => x !== name)
        : [...new Set([...disabledTools, name])]
      await writeToolPrefs()
      const agents = refreshAgentRestrictions(ctx)
      return { ok: true, applied: agents > 0 && !lastRestrictError, agents, disabled: disabledTools, tools: catalogOf(ctx), restrictError: lastRestrictError || undefined }
    })
    route(webServer, ctx, '/api/skill-mcp-manager/mcp-config', 'skill-mcp-manager.mcp-config', async (body) => {
      if (body.action === 'write') return writeMcpConfig(body.path, body.content)
      return readMcpConfig(body.path)
    })
    ctx.effect(
      () =>
        webServer.register({
          kind: 'exact',
          path: '/api/skill-mcp-manager/lobehub-register',
          handler: async (_req, res) => {
            let status = 200
            let payload
            try {
              payload = { ok: true, ...(await ensureRegistered()) }
            } catch (error) {
              status = 500
              payload = { ok: false, error: String(error && error.message ? error.message : error) }
            }
            res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
            res.end(JSON.stringify(payload))
          },
        }),
      'skill-mcp-manager.lobehub-register',
    )
  }

  registerRoutes()
  if (!registered) {
    ctx.on('internal/service', (serviceName) => {
      if (serviceName === 'webServer' || serviceName === 'httpServer') registerRoutes()
    })
  }

  // Count every dispatched tool call so the panel can show what is actually used.
  readUsage().then((loaded) => {
    if (!usageState) usageState = loaded
  })
  ctx.on('tools/result', (exec) => {
    try {
      tallyUsage(exec)
    } catch {
      /* never break a tool call for a counter */
    }
  })

  // Restore persisted tool-level switches once agents exist, and keep them applied as
  // agents come and go (restriction lives on agent.ctx, so every agent needs its own).
  const restoreToolSwitches = () => refreshAgentRestrictions(ctx)
  readToolPrefs().then((saved) => {
    // A toggle may arrive before the disk read settles; never clobber that newer state.
    if (prefsTouched) return
    disabledTools = saved
    restoreToolSwitches()
  })
  ctx.on('agent/created', () => restoreToolSwitches())
  ctx.on('tools/change', () => restoreToolSwitches())
  ctx.on('agent/disposed', ({ agent }) => {
    const id = agent && agent.id
    if (!id) return
    const current = agentRestrictions.get(id)
    agentRestrictions.delete(id)
    if (current) {
      try {
        current.disposer()
      } catch {
        /* fiber already gone */
      }
    }
  })
  ctx.effect(() => () => {
    for (const { disposer } of agentRestrictions.values()) {
      try {
        disposer()
      } catch {
        /* ignore */
      }
    }
    agentRestrictions.clear()
  }, 'skill-mcp-manager.tool-restrictions')
}
