// Host half of vyra-skill-mcp-manager.
// The UI reuses the data RPC of dsh-skill-mcp-market. The only thing added here is a route that
// registers the LobeHub market client. dsh-skill-mcp-market tries to do it itself, but its
// Windows command quoting splits `--name "DSH Market"` into two arguments, so the CLI rejects it.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

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

export const name = 'vyra-skill-mcp-manager'

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (!webServer || typeof webServer.register !== 'function') return
  route(webServer, ctx, '/api/skill-mcp-manager/skill-preview', 'skill-mcp-manager.skill-preview', async (body) =>
    body.path ? previewLocal(body.path) : previewRemote(body.item || {}))
  route(webServer, ctx, '/api/skill-mcp-manager/custom-market', 'skill-mcp-manager.custom-market', async (body) => ({
    ok: true,
    items: await loadCustomMarket(body.kind === 'mcp' ? 'mcp' : 'skill', body.url),
  }))
  route(webServer, ctx, '/api/skill-mcp-manager/import-zip', 'skill-mcp-manager.import-zip', async (body) =>
    importZip(body.zipBase64, body.name))
  route(webServer, ctx, '/api/skill-mcp-manager/usage', 'skill-mcp-manager.usage', async (body) => {
    if (body && body.reset) {
      usageState = emptyUsage()
      await flushUsage()
      return { ok: true, usage: usageState }
    }
    if (!usageState) usageState = await readUsage()
    return { ok: true, usage: usageState }
  })

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
