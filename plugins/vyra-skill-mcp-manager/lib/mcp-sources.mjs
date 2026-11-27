/**
 * MCP market sources beyond the official registry.
 *
 * Every entry here was probed from a mainland-China connection before it was
 * added. The ones that answered poorly — LobeHub returning zero rows, Smithery's
 * `q=` endpoint returning 500, mcp.so 403, glama 401, ModelScope and 百炼 404 —
 * are deliberately absent; an empty market is worse than a shorter one.
 *
 * @module dsh-vyra-skill-mcp-manager/mcp-sources
 */

const TIMEOUT_MS = 20000

function clip(value, size = 400) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > size ? `${text.slice(0, size)}…` : text
}

function row({ slug, name, description, source, homepage = '', installCommand = '', tools = 0 }) {
  return {
    id: `mcp:${source}:${slug}`,
    slug,
    name: name || slug,
    description: clip(description),
    source,
    sourceLabel: source,
    homepage,
    installable: Boolean(installCommand),
    installCommand,
    tools,
  }
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', 'user-agent': 'vyra-skill-mcp-manager' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

/**
 * Smithery: 20k+ servers, real server-side pagination.
 *
 * Its `q=` endpoint answers 500, so a query has to be filtered locally. Filtering
 * one upstream page returns almost nothing for a specific word, so a query walks
 * several upstream pages and keeps the first `pageSize` matches.
 */
const SMITHERY_SCAN_PAGES = 8

async function searchSmithery({ query, page, pageSize, fetchImpl }) {
  const needle = String(query || '').trim().toLowerCase()
  const wanted = needle === ''
    ? [{ page, pageSize }]
    : Array.from({ length: SMITHERY_SCAN_PAGES }, (_, index) => ({ page: index + 1, pageSize: 50 }))

  const items = []
  const seen = new Set()
  let hasMore = false
  let total = 0
  for (const request of wanted) {
    const url = `https://registry.smithery.ai/servers?pageSize=${request.pageSize}&page=${request.page}`
    const body = await fetchJson(url, fetchImpl)
    const rows = Array.isArray(body?.servers) ? body.servers : []
    total = Number(body?.pagination?.totalCount) || total
    const totalPages = Number(body?.pagination?.totalPages) || 1
    if (request.page < totalPages) hasMore = true
    for (const server of rows) {
      const slug = String(server.qualifiedName || server.id || '')
      if (slug === '' || seen.has(slug)) continue
      const haystack = `${slug} ${server.displayName} ${server.description}`.toLowerCase()
      if (needle !== '' && !haystack.includes(needle)) continue
      seen.add(slug)
      items.push(row({
        slug,
        name: server.displayName,
        description: server.description,
        source: 'smithery',
        homepage: server.homepage || '',
        installCommand: server.remote ? 'remote' : 'npx',
      }))
      if (items.length >= pageSize) break
    }
    if (items.length >= pageSize) break
    if (rows.length === 0) break
  }
  return { source: 'smithery', items, hasMore, total }
}

/** npm: every package that declares `keywords:mcp-server`, ranked by npm's own search. */
async function searchNpm({ query, page, pageSize, fetchImpl }) {
  const from = (page - 1) * pageSize
  const text = String(query || '').trim() === '' ? 'keywords:mcp-server' : `keywords:mcp-server ${String(query).trim()}`
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}&size=${pageSize}&from=${from}`
  const body = await fetchJson(url, fetchImpl)
  const objects = Array.isArray(body?.objects) ? body.objects : []
  const items = objects
    .map((entry) => entry?.package)
    .filter((pkg) => pkg && pkg.name)
    .map((pkg) => row({
      slug: String(pkg.name),
      name: String(pkg.name),
      description: pkg.description,
      source: 'npm',
      homepage: pkg.links?.npm || pkg.links?.homepage || '',
      installCommand: 'npx',
    }))
  const total = Number(body?.total) || 0
  return { source: 'npm', items, hasMore: from + items.length < total, total }
}

// The awesome list is one static README (~1.8 MB); parse it once per process and
// page locally. It is served through mirrors because raw.githubusercontent.com
// resets connections from mainland China often enough to fail every other attempt.
const AWESOME_URLS = [
  'https://gcore.jsdelivr.net/gh/punkpeye/awesome-mcp-servers@main/README.md',
  'https://fastly.jsdelivr.net/gh/punkpeye/awesome-mcp-servers@main/README.md',
  'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md',
]

let awesomeCache = null

async function loadAwesome(fetchImpl) {
  if (awesomeCache !== null) return awesomeCache
  let text = null
  const problems = []
  for (const url of AWESOME_URLS) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'vyra-skill-mcp-manager' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      text = await response.text()
      break
    } catch (error) {
      problems.push(String(error?.message ?? error))
    }
  }
  if (text === null) throw new Error(`awesome-mcp-servers unavailable (${problems.join('; ')})`)
  const rows = []
  const seen = new Set()
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^\s*[-*]\s*\[([^\]/]+\/[^\]/]+)\]\((https:\/\/github\.com\/[^)]+)\)\s*-?\s*(.*)$/.exec(line)
    if (!match) continue
    const slug = match[1].trim()
    if (seen.has(slug)) continue
    seen.add(slug)
    rows.push(row({
      slug,
      name: slug,
      description: match[3],
      source: 'awesome',
      homepage: match[2],
      installCommand: 'github',
    }))
  }
  awesomeCache = rows
  return rows
}

async function searchAwesome({ query, page, pageSize, fetchImpl }) {
  const all = await loadAwesome(fetchImpl)
  const needle = String(query || '').trim().toLowerCase()
  const matched = needle === ''
    ? all
    : all.filter((item) => `${item.slug} ${item.description}`.toLowerCase().includes(needle))
  const start = (page - 1) * pageSize
  const items = matched.slice(start, start + pageSize)
  return { source: 'awesome', items, hasMore: start + items.length < matched.length, total: matched.length }
}

const HANDLERS = {
  smithery: searchSmithery,
  npm: searchNpm,
  awesome: searchAwesome,
}

/**
 * The extra catalogues, in display order. `registry` is served by the vendored
 * loader rather than here, and is listed so callers can render the full row.
 */
export const EXTRA_MCP_SOURCES = [
  { id: 'registry', label: 'MCP 官方注册表', fetch: null },
  { id: 'smithery', label: 'Smithery', fetch: searchSmithery },
  { id: 'npm', label: 'npm（mcp-server）', fetch: searchNpm },
  { id: 'awesome', label: 'awesome-mcp-servers', fetch: searchAwesome },
]

/**
 * Search one extra catalogue.
 *
 * @returns {Promise<{ source: string, items: object[], hasMore: boolean, total: number }>}
 */
export async function searchExtraMcpSource(source, { query = '', page = 1, pageSize = 10, fetchImpl } = {}) {
  const handler = HANDLERS[source]
  if (handler === undefined) throw new Error(`unknown MCP source ${source}`)
  return handler({ query, page, pageSize, fetchImpl: fetchImpl ?? globalThis.fetch })
}
