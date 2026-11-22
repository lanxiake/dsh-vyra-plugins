/**
 * Media extension vocabulary shared by the workspace scan and the byte route.
 * No DSH imports: this file is plain Node and is unit-tested on its own.
 */

import mime from 'mime-types'

/** @typedef {'video' | 'image' | 'audio'} MediaKind */

const VIDEO = [
  'mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'wmv', 'flv',
]
const IMAGE = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff',
]
const AUDIO = [
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'aif',
]

/** Extension → kind. Built once so the scan and the client never disagree. */
export const MEDIA_KINDS = new Map([
  ...VIDEO.map(extension => [extension, 'video']),
  ...IMAGE.map(extension => [extension, 'image']),
  ...AUDIO.map(extension => [extension, 'audio']),
])

/** Every media extension the scan accepts. */
export const MEDIA_EXTENSIONS = new Set(MEDIA_KINDS.keys())

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
 * @returns {MediaKind | undefined} media kind, or undefined for non-media files.
 */
export function kindOf(extension) {
  return MEDIA_KINDS.get(String(extension).toLowerCase())
}

/**
 * @param {string} extension - extension without a dot.
 * @returns {string} response media type.
 */
export function mimeOf(extension) {
  return mime.lookup(String(extension).toLowerCase()) || 'application/octet-stream'
}
