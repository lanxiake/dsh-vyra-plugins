/**
 * Authenticated media file response: workspace containment, ETag, and one
 * bounded Range window. The complete file is read through the filesystem seam
 * in chunks so a large video never lands in memory at once.
 */
import { extensionOf, mimeOf } from './media-types.js'
import { entityTagOf, parseRange } from './range.js'
import { containsTarget, isAbsolutePath, joinWorkspacePath } from './paths.js'

/** Hard cap on one file request; larger files are refused, never truncated. */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024 * 1024
const CHUNK_BYTES = 1024 * 1024

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'",
}

/**
 * @param {number} status - HTTP status.
 * @param {string} code - stable diagnostic code, never file content.
 * @param {string} [detail] - extra diagnostic text.
 * @returns {Response} a non-cacheable text response.
 */
function failure(status, code, detail) {
  return new Response(detail === undefined ? code : `${code}: ${detail}`, {
    status,
    headers: {
      ...BASE_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Vyra-Media-Error': code,
    },
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
  let finished = false
  return new ReadableStream({
    async pull(controller) {
      if (finished) return
      if (signal.aborted) { finished = true; controller.close(); return }
      if (sent >= length) { finished = true; controller.close(); return }
      const window = Math.min(CHUNK_BYTES, length - sent)
      let bytes
      try {
        bytes = await fs.readByteRange(target, { offset: offset + sent, length: window }, signal)
      } catch (error) {
        finished = true
        controller.error(error)
        return
      }
      if (bytes === undefined || bytes.byteLength === 0) { finished = true; controller.close(); return }
      controller.enqueue(bytes)
      sent += bytes.byteLength
    },
    cancel() { finished = true },
  })
}

/**
 * Build the GET/HEAD response for one workspace file.
 *
 * A workspace-relative path is resolved against the Session root and must stay
 * inside it. An absolute path is served wherever the filesystem backend grants
 * read authority — the same rule the platform's own file route follows, so a
 * delivered file outside the workspace still plays.
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
    return failure(400, 'missing-path')
  }

  const absolute = isAbsolutePath(requestedPath)
  let target
  let info
  try {
    if (absolute) {
      if (typeof fs.resolve !== 'function') return failure(503, 'fs-unavailable')
      target = await fs.resolve(requestedPath, { signal: request.signal })
    } else {
      target = await resolveInsideWorkspace(fs, workspaceRoot, requestedPath, request.signal)
    }
    info = await fs.stat(target, request.signal)
  } catch (error) {
    if (error?.code === 'outside-workspace') return failure(403, 'outside-workspace', error.message)
    return fileSystemFailure(error)
  }
  if (info === undefined) return failure(404, 'not-found')
  if (info.type !== 'file') return failure(403, 'not-regular-file')
  if (typeof info.size === 'number' && info.size > maxBytes) return failure(413, 'too-large')

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
 * Resolve a workspace-relative path and prove it stays inside the workspace.
 * @param {object} fs - `ctx.fs`.
 * @param {string} workspaceRoot - Session workspace root.
 * @param {string} relativePath - the relative path from the request.
 * @param {AbortSignal} signal - request cancellation.
 * @returns {Promise<object>} the resolved target.
 */
async function resolveInsideWorkspace(fs, workspaceRoot, relativePath, signal) {
  const workspaceTarget = await fs.resolve(workspaceRoot, { signal })
  const target = await fs.resolve(joinWorkspacePath(workspaceRoot, relativePath), { signal })
  if (!containsTarget(fs, workspaceTarget, target)) {
    throw Object.assign(new Error(`"${relativePath}" is outside the workspace`), { code: 'outside-workspace' })
  }
  return target
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
  const detail = typeof error?.message === 'string' ? error.message : undefined
  return failure(statuses[code] ?? 500, typeof code === 'string' ? code : 'filesystem-error', detail)
}
