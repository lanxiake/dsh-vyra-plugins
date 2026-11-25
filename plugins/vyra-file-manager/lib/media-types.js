/**
 * File vocabulary shared by the workspace scan, the byte route and the text
 * preview. No DSH imports: this file is plain Node and is unit-tested on its own.
 *
 * Every file the scan sees gets a kind. Unknown extensions and extension-less
 * files fall into `other`, so the panel behaves like a file manager rather than
 * a media filter.
 */

import mime from 'mime-types'

/** @typedef {'video' | 'image' | 'audio' | 'document' | 'archive' | 'code' | 'other'} FileKind */

const VIDEO = [
  'mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'wmv', 'flv',
]
const IMAGE = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff',
]
const AUDIO = [
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'aif',
]
const DOCUMENT = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'markdown',
  'rtf', 'csv', 'tsv', 'odt', 'ods', 'odp', 'epub', 'log', 'tex', 'pages',
  'mdx', 'rst', 'adoc', 'srt', 'vtt', 'nfo',
  'numbers', 'key',
]
const ARCHIVE = [
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso',
]
const CODE = [
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'mts', 'cts', 'json', 'jsonc', 'yaml', 'yml',
  'toml', 'xml', 'html', 'htm', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'lua',
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'vue', 'svelte', 'astro',
  'ini', 'conf', 'env', 'gitignore', 'dockerfile', 'makefile',
  'hcl', 'tf', 'proto', 'graphql', 'gql', 'cmake', 'gradle', 'properties',
  'patch', 'diff',
]

/** Extension → kind. Built once so the scan, routes and verdicts never disagree. */
export const FILE_KINDS = new Map([
  ...VIDEO.map(extension => [extension, 'video']),
  ...IMAGE.map(extension => [extension, 'image']),
  ...AUDIO.map(extension => [extension, 'audio']),
  ...DOCUMENT.map(extension => [extension, 'document']),
  ...ARCHIVE.map(extension => [extension, 'archive']),
  ...CODE.map(extension => [extension, 'code']),
])

/** Every extension the scan classifies explicitly; anything else is `other`. */
export const KNOWN_EXTENSIONS = new Set(FILE_KINDS.keys())

/** Extensions whose bytes are safe to show as UTF-8 text in the panel. */
export const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'log', 'csv', 'tsv', 'rtf', 'tex',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'mts', 'cts', 'json', 'jsonc', 'yaml', 'yml',
  'toml', 'xml', 'html', 'htm', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'lua',
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'vue', 'svelte', 'astro',
  'ini', 'conf', 'env', 'gitignore', 'dockerfile', 'makefile',
])

/**
 * Lower-case extension of a path or URL pathname.
 * @param {string} value - file name, relative path or URL pathname.
 * @returns {string} extension without the dot, lower-case, or an empty string.
 */
export function extensionOf(value) {
  const clean = String(value).split(/[?#]/, 1)[0]
  const base = clean.slice(clean.lastIndexOf('/') + 1).slice(clean.lastIndexOf('\\') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

/**
 * @param {string} extension - extension without a dot.
 * @returns {FileKind} the file kind; unknown extensions are `other`.
 */
export function kindOf(extension) {
  return FILE_KINDS.get(String(extension).toLowerCase()) ?? 'other'
}

/**
 * @param {string} extension - extension without a dot.
 * @returns {boolean} whether the extension can be previewed as text.
 */
export function isTextExtension(extension) {
  const ext = String(extension).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) return true
  // Some script and config formats report a non-text MIME (`.cjs` is
  // `application/node`), so accept the structured-data and script types too.
  const mime = mimeOf(ext)
  return mime.startsWith('text/') || mime.endsWith('+xml') || mime === 'application/json'
    || mime === 'application/javascript' || mime === 'application/node'
    || mime === 'application/x-httpd-php'
}

/**
 * @param {string} extension - extension without a dot.
 * @returns {string} response media type.
 */
export function mimeOf(extension) {
  return mime.lookup(String(extension).toLowerCase()) || 'application/octet-stream'
}
