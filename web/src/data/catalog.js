import { CATEGORY_ORDER } from '../logic/categories.js'

/**
 * 站点数据入口。
 *
 * scripts/build-site-data.mjs 把目录切成：
 *   site/manifest.json   统计与分类（首屏）
 *   site/top.json        推荐位（前 300）
 *   site/featured.json   自有插件
 *   site/cat/<key>.json  按分类的紧凑行
 *   site/search.json     全局搜索
 *   site/lookup.json     name → 分类下标
 *
 * 紧凑行用数组 + 位置编码（字段名见 manifest.fields），比对象体积小一半以上。
 * 组件不接触文件路径，只调这里的函数。
 */
const DATA_BASE = import.meta.env.BASE_URL + 'site/'
const cache = new Map()

function loadJson(relative) {
  const hit = cache.get(relative)
  if (hit !== undefined) return hit

  const task = fetch(DATA_BASE + relative, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`site/${relative} → HTTP ${response.status}`)
      return response.json()
    })
    .catch((error) => {
      cache.delete(relative)
      throw error
    })

  cache.set(relative, task)
  return task
}

export const loadManifest = () => loadJson('manifest.json')
export const loadFeatured = () => loadJson('featured.json')
export const loadCategory = (key) => loadJson(`cat/${key}.json`)
export const loadSearchIndex = () => loadJson('search.json')
export const loadLookup = () => loadJson('lookup.json')

/** 紧凑行 → 领域对象。 */
export function decodeRow(row, sources) {
  const [
    id, name, titleZh, titleEn, descZh, descEn, catIdx, version,
    publishedAt, stars, repo, pkg, method, spec, bits, flags,
    homepage, license, tags, icon, installCommand,
  ] = row

  const picked = []
  for (let i = 0; i < sources.length; i++) if ((bits & (1 << i)) !== 0) picked.push(sources[i])

  return {
    id,
    name,
    title: { zh: titleZh, en: titleEn },
    description: { zh: descZh, en: descEn },
    category: CATEGORY_ORDER[catIdx] ?? 'other',
    version: version === '' ? null : version,
    publishedAt: publishedAt === '' ? null : publishedAt,
    stats: { stars: stars === 0 ? null : stars, downloads: null },
    repo: repo === '' ? null : repo,
    package: pkg === '' ? null : pkg,
    install:
      method === ''
        ? { method: 'unknown' }
        : { method, spec, command: installCommand === '' ? undefined : installCommand },
    sources: picked,
    featured: (flags & 1) === 1,
    verified: (flags & 2) === 2,
    homepage: homepage === '' ? null : homepage,
    license: license === '' ? null : license,
    tags: tags === '' ? [] : tags.split(' '),
    icon: icon === '' ? null : icon,
  }
}

export function decodeRows(rows, sources) {
  return rows.map((row) => decodeRow(row, sources))
}

/** search.json 行 → 领域对象（只够渲染结果，不含完整描述与仓库）。 */
export function searchEntryToPlugin(entry, sources) {
  const [name, titleZh, titleEn, catIdx, version, stars, tags, method] = entry
  return {
    id: `search:${name}`,
    name,
    title: { zh: titleZh, en: titleEn },
    description: { zh: '', en: '' },
    category: CATEGORY_ORDER[catIdx] ?? 'other',
    version: version === '' ? null : version,
    publishedAt: null,
    stats: { stars: stars === 0 ? null : stars, downloads: null },
    repo: null,
    package: null,
    install: method === '' ? { method: 'unknown' } : { method },
    sources,
    featured: false,
    verified: false,
    homepage: null,
    license: null,
    tags: tags === '' ? [] : tags.split(' '),
    icon: null,
  }
}

export function searchEntryMatches(entry, needle) {
  if (needle === '') return true
  return [entry[0], entry[1], entry[2], entry[6]].join(' ').toLowerCase().includes(needle)
}

/** lookup.json 是扁平数组 [name, catIdx, name, catIdx, ...]。 */
export function lookupMap(flat) {
  const map = new Map()
  for (let i = 0; i < flat.length; i += 2) map.set(flat[i], flat[i + 1])
  return map
}
