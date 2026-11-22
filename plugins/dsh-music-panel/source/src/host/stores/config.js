/**
 * Pure configuration and media helpers for dsh-music-panel.
 *
 * No Node or Cordis imports: the browser half and the tests reuse this module,
 * so everything here is a pure function over plain values.
 *
 * @module dsh-music-panel/config
 */

/** The shape every reader sees once a config has been normalized. */
export const DEFAULTS = Object.freeze({
  roots: [],
  hiddenRoots: [],
  depth: 4,
  extensions: ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'aac', 'mp4'],
  onlineQuality: 'standard',
  /** Media cache directory; '' means the plugin's own data directory. */
  cacheDir: '',
  /** Folia's 自动扫描已导入文件夹: rescan when a watched folder changes. */
  watchFolders: false,
})

/** Extensions the scanner may emit; anything else is ignored on disk. */
export const SUPPORTED_EXTENSIONS = Object.freeze([
  'mp3', 'flac', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'aac', 'mp4', 'm4b',
])

/** Content type per extension; the stream route is the only consumer. */
export const MIME = Object.freeze({
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  m4b: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
})

/** Upper bounds that keep a malformed patch from making the scanner explode. */
const MAX_ROOTS = 32
const MAX_DEPTH = 8
const MAX_EXTENSIONS = 24
const MAX_ROOT_LENGTH = 4096

function strOf(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function clampInt(value, fallback, min, max) {
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n), min), max)
}

/**
 * Normalize the raw patch/local config into the shape the rest of the plugin
 * reads. Unknown keys are dropped, arrays are bounded, and a missing or empty
 * extension list means "everything supported".
 *
 * @param {unknown} raw
 * @returns {{ roots: string[], depth: number, extensions: string[] }}
 */
export function normalizeConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const roots = Array.isArray(input.roots)
    ? input.roots
        .map(strOf)
        .filter((root) => root !== '' && root.length <= MAX_ROOT_LENGTH)
        .slice(0, MAX_ROOTS)
    : []

  const hiddenRoots = Array.isArray(input.hiddenRoots)
    ? input.hiddenRoots
        .map(strOf)
        .filter((root) => root !== '' && roots.includes(root))
        .slice(0, MAX_ROOTS)
    : []

  const depth = clampInt(input.depth, DEFAULTS.depth, 0, MAX_DEPTH)

  const listed = Array.isArray(input.extensions)
    ? input.extensions
        .map((value) => strOf(value).toLowerCase().replace(/^\./, ''))
        .filter((value) => SUPPORTED_EXTENSIONS.includes(value))
    : []
  const extensions = listed.length > 0
    ? Array.from(new Set(listed)).slice(0, MAX_EXTENSIONS)
    : [...DEFAULTS.extensions]

  // Online playback is standard quality only (no user-facing quality choice).
  const onlineQuality = 'standard'

  const cacheDir = strOf(input.cacheDir).slice(0, MAX_ROOT_LENGTH)
  const watchFolders = input.watchFolders === true

  return { roots, hiddenRoots, depth, extensions, onlineQuality, cacheDir, watchFolders }
}

/**
 * Lowercased extension without the dot, or '' when the name has none.
 *
 * @param {string} name
 */
export function extensionOf(name) {
  const base = String(name ?? '')
  const dot = base.lastIndexOf('.')
  if (dot < 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

/**
 * Content type for a stream response; falls back to octet-stream so an odd
 * extension can never make the browser guess wrong.
 *
 * @param {string} name
 */
export function mimeOf(name) {
  return MIME[extensionOf(name)] ?? 'application/octet-stream'
}

/**
 * Whether a file name may be scanned/streamed at all.
 *
 * @param {string} name
 * @param {readonly string[]} extensions
 */
export function isAllowedName(name, extensions) {
  return extensions.includes(extensionOf(name))
}
