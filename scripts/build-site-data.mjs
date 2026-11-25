#!/usr/bin/env node
/**
 * 站点数据管线：多源插件索引 → 归一化 → 去重 → 分类 → web/public/site.json
 *
 * 用法：
 *   node scripts/build-site-data.mjs                       # 全部源（CI 默认）
 *   node scripts/build-site-data.mjs --only=own            # 只用自己的索引（离线可用）
 *   node scripts/build-site-data.mjs --source=market       # 只跑指定源，可重复
 *   node scripts/build-site-data.mjs --cache=.cache/sources # 原始响应缓存目录
 *   node scripts/build-site-data.mjs --strict              # 任一源失败即退出
 *
 * 去重模块复制自 losebird/dsh-plugin-market（MIT），见 THIRD_PARTY_NOTICES.md。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collapsePackageOwnerDuplicates } from './collapse-package-owner.mjs'
import { CATEGORY_ORDER, normalizeCategory } from '../web/src/logic/categories.js'
import { compareVersions } from '../web/src/logic/versions.js'
import { SITE } from '../web/src/logic/site.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OWN_INDEX = join(ROOT, 'docs', 'index.json')
const OUT_DIR = join(ROOT, 'web', 'public', 'site')

/**
 * 源清单。kind=own 读本地索引；kind=format1 从 {plugins:[...]} 或 {items:[...]} 解析。
 * 顺序即优先级：靠前的源在合并时保留身份字段（名称、描述、分类）。
 */
const SOURCES = [
  { id: 'vyra', kind: 'own', label: 'Vyra' },
  {
    id: 'market',
    kind: 'format1',
    label: 'DSH Plugin Market',
    url: 'https://www.dsh-plugin.shop/registry/all.json',
  },
  {
    id: 'dshmarket',
    kind: 'format1',
    label: 'dshmarket.com',
    url: 'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json',
  },
  {
    id: 'dshopen',
    kind: 'format1',
    label: 'DSH Open Market',
    url: 'https://dshopen.org/index.json',
  },
  {
    id: 'dshtui',
    kind: 'format1',
    label: 'DSH Go Market',
    url: 'https://go.dshtui.com/market/index.json',
  },
  // dsh.so 是自有格式（约 11MB，非 format 1），后续补一个 adapter 再接。
]

const RANK = new Map(SOURCES.map((s, i) => [s.id, i]))
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 45_000

// ── 参数 ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit === undefined ? null : hit.slice(name.length + 3)
}
const onlyOwn = opt('only') === 'own'
const wanted = argv.filter((a) => a.startsWith('--source=')).map((a) => a.slice('--source='.length))
const cacheDir = opt('cache')
const strict = flag('strict')

// ── 工具 ────────────────────────────────────────────────────────────────────
function pluginsOf(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.plugins)) return parsed.plugins
  if (parsed && Array.isArray(parsed.items)) return parsed.items
  return []
}

function repoFromUrl(url) {
  if (typeof url !== 'string') return null
  const m = url.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i)
  return m === null ? null : `${m[1]}/${m[2].replace(/\.git$/, '')}`
}

function ownerOf(repo) {
  return typeof repo === 'string' && repo.includes('/') ? repo.split('/')[0].toLowerCase() : ''
}

function latestVersion(versions) {
  if (!Array.isArray(versions) || versions.length === 0) return null
  let best = null
  for (const v of versions) {
    if (v === null || typeof v !== 'object' || typeof v.version !== 'string') continue
    if (best === null || compareVersions(v.version, best.version) > 0) best = v
  }
  return best
}

function isoFromSeconds(sec) {
  return typeof sec === 'number' && Number.isFinite(sec) ? new Date(sec * 1000).toISOString() : null
}

/** format 1 里 title / description 既可能是字符串，也可能是 {en, zh}。 */
function localizedOf(value, fallback = '') {
  if (typeof value === 'string') return { zh: value, en: value }
  if (value !== null && typeof value === 'object') {
    const en = typeof value.en === 'string' ? value.en : undefined
    const zh = typeof value.zh === 'string' ? value.zh : undefined
    if (en !== undefined || zh !== undefined) {
      return { zh: zh ?? en ?? fallback, en: en ?? zh ?? fallback }
    }
  }
  return { zh: fallback, en: fallback }
}

function firstNumber(...values) {
  for (const value of values) if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

// ── 归一化：每个源一个 adapter，输出统一形状 ────────────────────────────────
function fromOwn(item) {
  const v = latestVersion(item.versions)
  const owner = typeof item.author === 'string' ? item.author : item.author?.name ?? null
  // format 1 把分类 / 关键词 / 星标放在 metadata 里（见 scripts/build-index.ts）
  const meta = item.metadata ?? {}
  const sortKeys = meta.sortKeys ?? {}
  return {
    id: `vyra:${item.name}`,
    name: item.name,
    title: item.title ?? { zh: item.name, en: item.name },
    description: item.description ?? {},
    repo: repoFromUrl(item.repository?.url),
    repoDirectory: item.repository?.directory ?? null,
    package: item.name,
    version: v?.version ?? null,
    publishedAt: isoFromSeconds(v?.publishTimestamp),
    author: owner,
    license: item.license ?? null,
    homepage: item.homepage ?? null,
    icon: item.icon ?? null,
    category: normalizeCategory(meta.category),
    tags: Array.isArray(meta.keywords) ? meta.keywords : [],
    stats: {
      stars: typeof sortKeys.stars === 'number' ? sortKeys.stars : null,
      downloads: typeof sortKeys.downloads === 'number' ? sortKeys.downloads : null,
    },
    install: { method: 'dsh-plugin-add', spec: item.name },
    sources: ['vyra'],
    verified: true,
    // 自有插件 = 作者是本站 owner；第三方快照保持原名收录，不算「出品」
    featured: owner === SITE.owner,
  }
}

function fromFormat1(item, sourceId) {
  const name = item.package ?? item.name ?? item.id ?? ''
  const latest = latestVersion(item.versions)
  // 仓库位置各源写法不同：market 用 repo，format 1 用 repository.url，dshtui 只有 homepage
  const repo =
    (typeof item.repo === 'string' ? item.repo : null) ??
    repoFromUrl(item.repository?.url) ??
    repoFromUrl(item.homepage)
  const meta = item.metadata ?? {}
  const titleSource = item.title ?? item.displayName ?? item.name ?? name
  const publishedAt =
    item.releasedAt ?? item.releaseCheckedAt ?? isoFromSeconds(latest?.publishTimestamp) ?? null

  return {
    id: `${sourceId}:${item.id ?? repo ?? name}`,
    name,
    title: localizedOf(titleSource, name),
    description: localizedOf(item.description, ''),
    repo,
    repoDirectory: item.repository?.directory ?? null,
    package: item.package ?? item.name ?? null,
    version: item.version ?? latest?.version ?? null,
    publishedAt,
    author: typeof item.author === 'string' ? item.author : item.author?.name ?? null,
    license: item.license ?? null,
    homepage: item.homepage ?? null,
    icon: item.icon ?? null,
    category: normalizeCategory(item.category ?? meta.category),
    tags: Array.isArray(item.tags)
      ? item.tags
      : Array.isArray(meta.keywords)
        ? meta.keywords
        : [],
    stats: {
      stars: firstNumber(item.stars, meta.sortKeys?.stars),
      downloads: firstNumber(item.downloads, meta.sortKeys?.downloads),
    },
    // format 1 的条目都能用 `dsh plugin add <name>` 装；market 自带的 install 覆盖它
    install: item.install ?? (name === '' ? { method: 'unknown' } : { method: 'dsh-plugin-add', spec: name }),
    sources: [sourceId],
    verified: item.verified === true,
    featured: false,
  }
}

// ── 跨源合并 ────────────────────────────────────────────────────────────────
/**
 * 包名 + 仓库所有者：同名 fork 必须分开，这是最可靠的一类键。
 * 没有 owner 的条目不生成此键，避免把不同 owner 的同名包合并。
 */
function pkgOwnerKey(p) {
  if (!p.package) return null
  const owner = ownerOf(p.repo)
  return owner === '' ? null : `pkg:${String(p.package).toLowerCase()}@${owner}`
}

/** 仓库键；monorepo 用 repository.directory 区分同一仓库下的不同插件。 */
function repoKey(p) {
  if (!p.repo) return null
  const base = String(p.repo).toLowerCase().replace(/\.git$/, '')
  const dir = p.repoDirectory ? '#' + String(p.repoDirectory).toLowerCase() : ''
  return `repo:${base}${dir}`
}

function mergeInto(target, incoming) {
  target.sources = [...new Set([...target.sources, ...incoming.sources])]
  target.tags = [...new Set([...(target.tags ?? []), ...(incoming.tags ?? [])])]
  if (!hasText(target.title?.zh) && !hasText(target.title?.en)) target.title = incoming.title
  if (!hasText(target.description?.zh) && !hasText(target.description?.en)) target.description = incoming.description
  for (const key of ['repo', 'repoDirectory', 'package', 'author', 'license', 'homepage', 'icon', 'publishedAt']) {
    if (!target[key] && incoming[key]) target[key] = incoming[key]
  }
  if (!target.version || compareVersions(incoming.version, target.version) > 0) {
    target.version = incoming.version ?? target.version
  }
  target.stats = {
    stars: maxOrNull(target.stats?.stars, incoming.stats?.stars),
    downloads: maxOrNull(target.stats?.downloads, incoming.stats?.downloads),
  }
  if (!target.install || target.install.method === 'unknown') {
    if (incoming.install && incoming.install.method !== 'unknown') target.install = incoming.install
  }
  if (incoming.verified === true) target.verified = true
}

function hasText(v) {
  return typeof v === 'string' && v.trim() !== ''
}

function maxOrNull(a, b) {
  const x = typeof a === 'number' ? a : null
  const y = typeof b === 'number' ? b : null
  if (x === null) return y
  if (y === null) return x
  return Math.max(x, y)
}

// ── 拉取 ────────────────────────────────────────────────────────────────────
async function fetchCached(url) {
  const file = cacheDir ? join(cacheDir, encodeURIComponent(url) + '.cache') : null
  if (file && existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_TTL_MS) {
    return readFileSync(file, 'utf8')
  }
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'vyra-site-builder' },
  })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const text = await res.text()
  if (file) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
  return text
}

async function loadSource(source) {
  if (source.kind === 'own') {
    const parsed = JSON.parse(readFileSync(OWN_INDEX, 'utf8'))
    return pluginsOf(parsed).map(fromOwn)
  }
  const parsed = JSON.parse(await fetchCached(source.url))
  return pluginsOf(parsed).map((item) => fromFormat1(item, source.id))
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  const active = onlyOwn
    ? SOURCES.filter((s) => s.kind === 'own')
    : wanted.length > 0
      ? SOURCES.filter((s) => wanted.includes(s.id))
      : SOURCES

  const collected = []
  const sourceStats = {}

  for (const source of active) {
    try {
      const items = await loadSource(source)
      sourceStats[source.id] = items.length
      collected.push(...items)
      console.log(`[site] ${source.id.padEnd(10)} ${String(items.length).padStart(6)} 条`)
    } catch (error) {
      sourceStats[source.id] = 0
      const message = error instanceof Error ? error.message : String(error)
      if (strict) throw new Error(`源 ${source.id} 拉取失败：${message}`)
      console.warn(`[site] ${source.id.padEnd(10)} 跳过：${message}`)
    }
  }

  // 先按源优先级排序，保证合并时靠前的源保留身份字段
  collected.sort((a, b) => (RANK.get(a.sources[0]) ?? 99) - (RANK.get(b.sources[0]) ?? 99))

  // 双索引合并：包名+owner 优先；没有包名时退回仓库键。
  // 同一仓库下包名不同 = monorepo 里的不同插件，不能合并。
  const byPkgOwner = new Map()
  const byRepo = new Map()
  const mergedList = []

  for (const item of collected) {
    const pk = pkgOwnerKey(item)
    const rk = repoKey(item)
    let target = pk === null ? undefined : byPkgOwner.get(pk)

    if (target === undefined && rk !== null) {
      const candidate = byRepo.get(rk)
      if (candidate !== undefined) {
        const a = candidate.package ? String(candidate.package).toLowerCase() : ''
        const b = item.package ? String(item.package).toLowerCase() : ''
        if (a === '' || b === '' || a === b) target = candidate
      }
    }

    if (target === undefined) {
      mergedList.push(item)
      target = item
    } else {
      mergeInto(target, item)
    }

    // 合并后补齐的键也要登记，保证后续条目能命中
    for (const record of [item, target]) {
      const p = pkgOwnerKey(record)
      const r = repoKey(record)
      if (p !== null) byPkgOwner.set(p, target)
      if (r !== null) byRepo.set(r, target)
    }
  }

  // 第二道保险：同 owner 下被改名的仓库（同包名）合并成一行
  let plugins = collapsePackageOwnerDuplicates(mergedList, { preferCurated: true })

  // star 统一使用索引源里的真实 GitHub star（由 market 等源每日采集）。
  // 不再为 Vyra 插件注入构建期伪推荐分：伪分（60–99）与真实 star（数万）量级差几千倍，
  // 混排时会让排序与卡片数字都失去意义。自有源未收录 star 的插件保持 null。

  // 展示排序：真实 star 降序，其次按名称
  plugins.sort((a, b) => {
    const s = (b.stats?.stars ?? 0) - (a.stats?.stars ?? 0)
    if (s !== 0) return s
    return String(a.name).localeCompare(String(b.name))
  })

  const byCategory = {}
  for (const p of plugins) byCategory[p.category] = (byCategory[p.category] ?? 0) + 1

  const sourceIds = active.map((s) => s.id)
  const sourceBit = new Map(sourceIds.map((id, i) => [id, i]))
  const catIndex = new Map(CATEGORY_ORDER.map((key, i) => [key, i]))
  const fallbackCat = CATEGORY_ORDER.length - 1

  /** 紧凑行：位置即字段，字段名见 manifest.fields。 */
  const toRow = (p) => [
    p.id,
    p.name,
    p.title?.zh ?? '',
    p.title?.en ?? '',
    String(p.description?.zh ?? '').slice(0, 240),
    String(p.description?.en ?? '').slice(0, 240),
    catIndex.get(p.category) ?? fallbackCat,
    p.version ?? '',
    p.publishedAt ?? '',
    p.stats?.stars ?? 0,
    p.repo ?? '',
    p.package ?? '',
    p.install?.method ?? '',
    p.install?.spec ?? '',
    p.sources.reduce((bits, id) => bits | (1 << (sourceBit.get(id) ?? 0)), 0),
    (p.featured ? 1 : 0) | (p.verified ? 2 : 0),
    p.homepage ?? '',
    p.license ?? '',
    (p.tags ?? []).join(' '),
    p.icon ?? '',
    p.install?.command ?? '',
  ]

  const ROW_FIELDS = [
    'id', 'name', 'titleZh', 'titleEn', 'descZh', 'descEn', 'category', 'version',
    'publishedAt', 'stars', 'repo', 'package', 'installMethod', 'installSpec',
    'sourceBits', 'flags', 'homepage', 'license', 'tags', 'icon', 'installCommand',
  ]

  // 精确清理上一轮生成的 json：只删除输出目录下的 .json 文件，
  // 不用递归删整个目录（避免误删同目录下的其它资源，也兼容受限文件系统）。
  const clearJsonFiles = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) clearJsonFiles(full)
      else if (entry.endsWith('.json')) rmSync(full, { force: true })
    }
  }
  clearJsonFiles(OUT_DIR)
  mkdirSync(join(OUT_DIR, 'cat'), { recursive: true })

  const sizes = {}
  const writeFile = (rel, value) => {
    const file = join(OUT_DIR, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(value) + '\n')
    sizes[rel] = statSync(file).size
  }

  writeFile('manifest.json', {
    schema: 1,
    generatedAt: new Date().toISOString(),
    fields: ROW_FIELDS,
    sources: sourceIds,
    stats: {
      total: plugins.length,
      installable: plugins.filter((p) => p.install && p.install.method !== 'unknown').length,
      featured: plugins.filter((p) => p.featured).length,
      sources: sourceStats,
      categories: byCategory,
    },
    categories: CATEGORY_ORDER.map((key) => ({ key, count: byCategory[key] ?? 0 })),
  })

  for (const key of CATEGORY_ORDER) {
    const rows = plugins.filter((p) => p.category === key)
    if (rows.length === 0) continue
    writeFile(`cat/${key}.json`, rows.map(toRow))
  }

  // 自有插件：首页「Vyra 出品」与「推荐」标签共用
  writeFile('featured.json', plugins.filter((p) => p.featured).map(toRow))
  // 首页「编辑精选」：全站按真实 star 降序的 top，排除已在 Vyra 出品展示的自研插件，
  // 让这个区块真正来自多个索引源（与它的文案一致）。
  writeFile(
    'top.json',
    plugins
      .filter((p) => !p.featured && (p.stats?.stars ?? 0) > 0)
      .slice(0, 12)
      .map(toRow),
  )
  // 全局搜索：只放搜索和简单结果需要的字段
  writeFile(
    'search.json',
    plugins.map((p) => [
      p.name,
      p.title?.zh ?? '',
      p.title?.en ?? '',
      catIndex.get(p.category) ?? fallbackCat,
      p.version ?? '',
      p.stats?.stars ?? 0,
      (p.tags ?? []).join(' '),
      p.install?.method ?? '',
    ]),
  )
  // 名称 → 分类下标：详情页据此只加载一个分类文件
  const lookup = []
  for (const p of plugins) lookup.push(p.name, catIndex.get(p.category) ?? fallbackCat)
  writeFile('lookup.json', lookup)

  const totalBytes = Object.values(sizes).reduce((sum, n) => sum + n, 0)
  const biggest = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 4)
  console.log(
    `[site] 合并 ${plugins.length} 条（可安装 ${plugins.filter((p) => p.install && p.install.method !== 'unknown').length}），` +
      `输出 ${Object.keys(sizes).length} 个文件 ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
  )
  console.log(
    '[site] 最大文件：' + biggest.map(([name, n]) => `${name} ${(n / 1024 / 1024).toFixed(2)}MB`).join('，'),
  )
}

main().catch((error) => {
  console.error('[site] 失败：', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
