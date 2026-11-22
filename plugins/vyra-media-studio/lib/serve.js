/**
 * Authenticated media file response: workspace containment, ETag, and one
 * bounded Range window streamed in 1 MiB chunks. Pure enough to unit-test with
 * a fake `ctx.fs`.
 */
import { extensionOf, mimeOf } from './media-types.js'
import { entityTagOf, parseRange } from './range.js'

/** Hard cap on one file request; larger files are refused, never truncated. */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024 * 1024
const CHUNK_BYTES = 1024 * 1024

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'",
}

/**
 * @param {number} status - HTTP status.
 * @param {string} message - plain diagnostic, never file content.
 * @returns {Response} a non-cacheable text response.
 */
function failure(status, message) {
  return new Response(message, {
    status,
    headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
  })
}

/** RFC 5987 filename encoding for Content-Disposition. */
function fileNameStar(name) {
  return encodeURIComponent(name).replace(/['()*]/g, char =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * Stream `length` bytes from `offset` through the filesystem seam.
 * @param {object} fs - `ctx.fs`.
 * @param {object} target - resolved target.
 * @param {number} offset - 0-based first byte.
 * @param {number} length - exact number of bytes to send.
 * @param {AbortSignal} signal - request cancellation.
 * @returns {ReadableStream<Uint8Array>} backpressured body.
 */
function rangeStream(fs, target, offset, length, signal) {
  let sent = 0
  return new ReadableStream({
    async pull(controller) {
      if (signal.aborted) { controller.close(); return }
      if (sent >= length) { controller.close(); return }
      const window = Math.min(CHUNK_BYTES, length - sent)
      const bytes = await fs.readByteRange(target, { offset: offset + sent, length: window }, signal)
      if (bytes.byteLength === 0) { controller.close(); return }
      controller.enqueue(bytes)
      sent += bytes.byteLength
    },
  })
}

/**
 * Build the GET/HEAD response for one workspace file.
 * @param {object} options - request inputs.
 * @param {Request} options.request - admitted fetch request.
 * @param {object} options.fs - `ctx.fs`.
 * @param {string} options.workspaceRoot - Session workspace root.
 * @param {number} [options.maxBytes] - complete-file cap.
 * @returns {Promise<Response>} the media response.
 */
export async function serveMediaFile({ request, fs, workspaceRoot, maxBytes = MAX_MEDIA_BYTES }) {
  const url = new URL(request.url)
  const requestedPath = url.searchParams.get('path')
  if (requestedPath === null || requestedPath.length === 0 || requestedPath.includes('\0')) {
    return failure(400, 'missing path')
  }

  let rootTarget
  let target
  let info
  try {
    rootTarget = await fs.resolve(workspaceRoot, { signal: request.signal })
    target = await fs.resolve(requestedPath, { cwd: workspaceRoot, signal: request.signal })
    if (!fs.contains(rootTarget, target)) return failure(403, 'outside workspace')
    info = await fs.stat(target, request.signal)
  } catch (error) {
    return fileSystemFailure(error)
  }
  if (info === undefined) return failure(404, 'not found')
  if (info.type !== 'file') return failure(403, 'not a regular file')
  if (typeof info.size === 'number' && info.size > maxBytes) return failure(413, 'file exceeds byte limit')

  const knownSize = typeof info.size === 'number' && Number.isFinite(info.size) && info.size >= 0
    ? info.size
    : undefined
  const extension = extensionOf(target.displayPath)
  const etag = entityTagOf(info.version)
  const headers = {
    ...BASE_HEADERS,
    'Accept-Ranges': 'bytes',
    'Content-Type': mimeOf(extension),
    'Cache-Control': 'private, max-age=0, must-revalidate',
    'Content-Disposition': `inline; filename*=UTF-8''${fileNameStar(String(target.displayPath).split(/[\\/]/).pop() ?? 'media')}`,
    ETag: etag,
  }

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers })
  }

  const rangeHeader = request.headers.get('range')
  const ifRange = request.headers.get('if-range')
  const rangeAllowed = ifRange === null || ifRange === etag
  const plan = rangeAllowed && knownSize !== undefined
    ? parseRange(rangeHeader, knownSize)
    : { kind: 'none' }

  if (plan.kind === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${knownSize}`, 'Content-Length': '0' },
    })
  }

  if (plan.kind === 'partial') {
    const length = plan.end - plan.start + 1
    headers['Content-Range'] = `bytes ${plan.start}-${plan.end}/${knownSize}`
    headers['Content-Length'] = String(length)
    if (request.method === 'HEAD') return new Response(null, { status: 206, headers })
    return new Response(rangeStream(fs, target, plan.start, length, request.signal), { status: 206, headers })
  }

  if (knownSize !== undefined) headers['Content-Length'] = String(knownSize)
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  const length = knownSize ?? Number.MAX_SAFE_INTEGER
  return new Response(rangeStream(fs, target, 0, length, request.signal), { status: 200, headers })
}

/**
 * @param {unknown} error - thrown filesystem failure.
 * @returns {Response} status mapped from the stable `FsError` code.
 */
function fileSystemFailure(error) {
  const code = typeof error === 'object' && error !== null ? error.code : undefined
  const statuses = {
    FS_NOT_FOUND: 404,
    FS_NOT_REGULAR_FILE: 403,
    FS_PERMISSION_DENIED: 403,
    FS_SANDBOX_DENIED: 403,
    FS_TOO_LARGE: 413,
    FS_ABORTED: 499,
  }
  return failure(statuses[code] ?? 500, typeof code === 'string' ? code : 'filesystem error')
}
