/** Shared client constants, preferences and pure helpers. */

export const LIBRARY_ID = 'vyra-media-studio/library'
export const VIDEO_ID = 'vyra-media-studio/video'
export const AUDIO_ID = 'vyra-media-studio/audio'
export const LIBRARY_KIND = 'media'

export const VIDEO_EXT = new Set(['mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'wmv', 'flv'])
export const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'aif'])
export const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff'])
export const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'log', 'csv', 'tsv', 'rtf', 'tex',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'jsonc', 'yaml', 'yml',
  'toml', 'xml', 'html', 'htm', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'lua',
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'vue', 'svelte', 'astro',
  'ini', 'conf', 'env', 'gitignore', 'dockerfile', 'makefile',
  'hcl', 'tf', 'proto', 'graphql', 'gql', 'cmake', 'gradle', 'properties',
  'patch', 'diff', 'mdx', 'rst', 'adoc', 'srt', 'vtt', 'nfo',
])

export const TYPE_LABEL = {
  all: '全部', image: '图片', video: '视频', audio: '音频', document: '文档',
  archive: '压缩包', code: '代码', other: '其他', link: '链接',
}
export const TYPE_ORDER = {
  image: 0, video: 1, audio: 2, document: 3, archive: 4, code: 5, other: 6, link: 7,
}
export const TYPE_CHIPS = ['image', 'video', 'audio', 'document', 'archive', 'code', 'other', 'link']

export const COLLATOR = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
export const DAY = 86_400_000
export const PAGE_SIZE = 120
export const CARD_MIN = 96
export const CARD_MAX = 300
export const CARD_DEFAULT = 158

const COVERS = [
  ['#1d3f5c', '#081520'],
  ['#4a2a12', '#160a05'],
  ['#123f35', '#061a15'],
  ['#2a2148', '#0d0918'],
  ['#3c2f16', '#140f06'],
  ['#24343f', '#0a1015'],
]

const MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  ogv: 'video/ogg', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv', flv: 'video/x-flv',
}

export function extensionOf(value) {
  const clean = String(value ?? '').split(/[?#]/, 1)[0]
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  const base = clean.slice(slash + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

export function kindOfExtension(extension) {
  const ext = String(extension ?? '').toLowerCase()
  if (VIDEO_EXT.has(ext)) return 'video'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (AUDIO_EXT.has(ext)) return 'audio'
  return undefined
}

export function isTextExtension(extension) {
  return TEXT_EXT.has(String(extension ?? '').toLowerCase())
}

export function mimeOfExtension(extension) {
  return MIME[String(extension).toLowerCase()] ?? 'application/octet-stream'
}

export function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) return '—'
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function formatDate(ms) {
  if (!ms) return '—'
  const date = new Date(ms)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  if (ms >= start) return `今天 ${hh}:${mm}`
  if (ms >= start - DAY) return `昨天 ${hh}:${mm}`
  if (date.getFullYear() === today.getFullYear()) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function folderOf(item) {
  if (item.folder !== undefined) return item.folder
  const slash = item.relativePath.lastIndexOf('/')
  return slash === -1 ? '' : item.relativePath.slice(0, slash)
}

export function domainOf(item) {
  try { return new URL(item.url || item.src || '').hostname.replace(/^www\./, '') } catch { return '链接' }
}

export function typeLabel(kind) {
  return TYPE_LABEL[kind] ?? '文件'
}

export function coverOf(item, index) {
  const pair = COVERS[(index + String(item.id).length) % COVERS.length]
  return { '--vms-cover-a': pair[0], '--vms-cover-b': pair[1] }
}

export function waveBars(seed, count, min = 22, max = 92) {
  let state = 0
  for (const char of String(seed)) state = (state * 31 + char.charCodeAt(0)) | 0
  const random = () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: count }, (_, index) => ({
    height: Math.round(min + random() * (max - min)),
    delay: (random() * 0.8).toFixed(2),
    key: index,
  }))
}

export function parseFileAddress(address) {
  const clean = String(address).split(/[?#]/, 1)[0]
  const prefix = 'dsh-resource://file/session/'
  if (!clean.startsWith(prefix)) return undefined
  const rest = clean.slice(prefix.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return undefined
  try {
    const sessionId = decodeURIComponent(rest.slice(0, slash))
    const path = rest.slice(slash + 1).split('/').map(decodeURIComponent).join('/')
    return sessionId === '' || path === '' ? undefined : { sessionId, path }
  } catch {
    return undefined
  }
}

export function sessionFileAddress(sessionId, path) {
  const normalized = String(path).replaceAll('\\', '/').replace(/^(?:\.\/)+/, '')
  const encode = segment => encodeURIComponent(segment).replace(/%3A/gi, ':')
  return `dsh-resource://file/session/${encode(sessionId)}/${normalized.split('/').map(encode).join('/')}`
}

export function apiUrl(path, params) {
  const url = new URL(path, document.baseURI)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url.href
}

export function localFileUrl(sessionId, path, version) {
  return apiUrl('api/vyra-media/file', { sessionId, path, v: version })
}

export function mediaSrc(sessionId, item) {
  return item.source === 'url' ? item.url : localFileUrl(sessionId, item.relativePath)
}

/**
 * POST JSON to a plugin route and return the `ok: true` body.
 * @param {string} path - route path.
 * @param {object} body - JSON body.
 * @param {AbortSignal} [signal] - cancellation.
 * @returns {Promise<object>} the response body.
 */
export async function postJson(path, body, signal) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    signal,
  })
  let data
  try {
    data = await response.json()
  } catch {
    data = undefined
  }
  if (!response.ok || data?.ok !== true) {
    const code = data?.code ?? `http-${response.status}`
    const error = new Error(`${code}：${data?.error ?? `HTTP ${response.status}`}`)
    error.code = code
    error.canPermanent = data?.canPermanent === true
    error.status = response.status
    throw error
  }
  return data
}

/** `@path` mention token understood by the chat composer. */
export function mentionToken(path) {
  const slashed = String(path).trim().replace(/\\/gu, '/')
  return /\s/u.test(slashed) ? `@"${slashed}" ` : `@${slashed} `
}

export function detectLinkKind(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return kindOfExtension(extensionOf(parsed.pathname)) ?? 'link'
  } catch {
    return undefined
  }
}

export function makeLinkItem(url, title) {
  const parsed = new URL(url)
  const extension = extensionOf(parsed.pathname)
  const kind = kindOfExtension(extension) ?? 'link'
  const fileName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? parsed.hostname)
  return {
    id: `url:${url}`,
    kind,
    title: (title ?? '').trim()
      || (kind === 'link' ? parsed.hostname.replace(/^www\./, '') : fileName),
    fileName,
    folder: '链接',
    relativePath: '',
    size: undefined,
    mtimeMs: Date.now(),
    duration: 0,
    width: 0,
    height: 0,
    source: 'url',
    ext: extension || 'html',
    url,
  }
}

function linksKey(root) {
  return `vyra-media-studio.links.v1:${root}`
}

export function readLinks(root) {
  if (!root) return []
  try {
    const parsed = JSON.parse(localStorage.getItem(linksKey(root)) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter(item => item && typeof item.url === 'string' && typeof item.id === 'string')
      : []
  } catch {
    return []
  }
}

export function writeLinks(root, links) {
  if (!root) return
  try { localStorage.setItem(linksKey(root), JSON.stringify(links)) } catch { /* storage may be unavailable */ }
}

const PREFS_KEY = 'vyra-media-studio.prefs.v1'
const PREF_DEFAULTS = {
  view: 'grid',
  listMode: 'timeline',
  cardSize: CARD_DEFAULT,
  detail: 'compact',
  sort: 'name',
  dir: 'asc',
  showHidden: false,
  includeBuild: false,
  sessionOnly: true,
}

export function readPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')
    if (parsed === null || typeof parsed !== 'object') return { ...PREF_DEFAULTS }
    const merged = { ...PREF_DEFAULTS, ...parsed }
    return {
      view: merged.view === 'list' ? 'list' : 'grid',
      listMode: merged.listMode === 'flat' || merged.listMode === 'tree' ? merged.listMode : 'timeline',
      cardSize: Number.isFinite(merged.cardSize)
        ? Math.min(CARD_MAX, Math.max(CARD_MIN, merged.cardSize))
        : CARD_DEFAULT,
      detail: merged.detail === 'detailed' ? 'detailed' : 'compact',
      sort: ['name', 'time', 'size', 'type'].includes(merged.sort) ? merged.sort : 'name',
      dir: merged.dir === 'desc' ? 'desc' : 'asc',
      showHidden: merged.showHidden === true,
      includeBuild: merged.includeBuild === true,
      sessionOnly: merged.sessionOnly !== false,
    }
  } catch {
    return { ...PREF_DEFAULTS }
  }
}

export function writePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* storage may be unavailable */ }
}

export function compareItems(left, right, sort, dir, meta) {
  const factor = dir === 'asc' ? 1 : -1
  const sizeOf = item => meta?.[item.id]?.size ?? item.size ?? -1
  const timeOf = item => meta?.[item.id]?.mtimeMs ?? item.mtimeMs ?? 0
  let result = 0
  if (sort === 'name') result = COLLATOR.compare(left.title, right.title)
  else if (sort === 'size') result = sizeOf(left) - sizeOf(right)
  else if (sort === 'type') result = (TYPE_ORDER[left.kind] - TYPE_ORDER[right.kind]) || COLLATOR.compare(left.title, right.title)
  else result = timeOf(left) - timeOf(right)
  if (result === 0) result = COLLATOR.compare(left.title, right.title)
  return result * factor
}

export function folderSegments(folder) {
  return String(folder ?? '').split('/').filter(Boolean)
}

export function slideFor(item, index, sessionId) {
  const src = mediaSrc(sessionId, item)
  if (item.kind === 'image') {
    return {
      type: 'image', src, alt: item.title, thumbnail: src,
      width: item.width || undefined, height: item.height || undefined,
    }
  }
  if (item.kind === 'video') {
    return {
      type: 'video',
      sources: [{ src, type: mimeOfExtension(item.ext) }],
      width: item.width || undefined, height: item.height || undefined,
      poster: item.poster || undefined,
    }
  }
  if (item.kind === 'audio') {
    return {
      type: 'vms-audio', src, title: item.title,
      ext: item.ext.toUpperCase(), size: item.size, folder: folderOf(item) || '根目录',
      ...coverOf(item, index),
    }
  }
  return { type: 'vms-link', url: item.url, title: item.title, domain: domainOf(item) }
}
