/**
 * Host route handlers and registration. Two exact Fetch routes:
 * ` /api/vyra-media/list` and `/api/vyra-media/file`.
 *
 * Every route resolves the Session workspace through `workspaceFiles.scopeOf`
 * and confines the result with `ctx.fs.contains`. The bridge supplies
 * authentication; direct callers must still target a live browser Peer.
 */
import { relative } from 'node:path'
import { SCAN_DEFAULTS, scanMedia } from './scan.js'
import { serveMediaFile } from './serve.js'

const LIST_PATH = '/api/vyra-media/list'
const FILE_PATH = '/api/vyra-media/file'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

/**
 * @param {unknown} body - JSON-compatible body.
 * @param {number} status - HTTP status.
 * @returns {Response} JSON response.
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

/**
 * @param {string | null} raw - query value.
 * @param {number} fallback - default.
 * @param {number} min - inclusive minimum.
 * @param {number} max - inclusive maximum.
 * @returns {number} clamped integer.
 */
function integer(raw, fallback, min, max) {
  if (raw === null || raw === '') return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * Resolve a Session's workspace root and scan target, enforcing containment.
 * @param {object} ctx - Host context.
 * @param {string} sessionId - Session identity.
 * @param {string} path - relative, absolute-inside-workspace, or empty for root.
 * @param {AbortSignal} signal - request cancellation.
 * @returns {Promise<{ workspaceRoot: string, scanRoot: string, relativeRoot: string }>} resolved paths.
 */
async function resolveScanRoot(ctx, sessionId, path, signal) {
  const scope = await ctx.workspaceFiles.scopeOf(sessionId, signal)
  if (scope === undefined) throw Object.assign(new Error('unknown session'), { status: 404, code: 'unknown-session' })
  const workspaceRoot = scope.workspaceRoot
  const rootTarget = await ctx.fs.resolve(workspaceRoot, { signal })
  const target = await ctx.fs.resolve(path === '' ? '.' : path, { cwd: workspaceRoot, signal })
  if (!ctx.fs.contains(rootTarget, target)) {
    throw Object.assign(new Error('outside workspace'), { status: 403, code: 'outside-workspace' })
  }
  const workspaceDir = ctx.fs.processPath(rootTarget)
  const scanDir = ctx.fs.processPath(target)
  return {
    workspaceRoot: workspaceDir,
    scanRoot: scanDir,
    relativeRoot: relative(workspaceDir, scanDir).split('\\').join('/'),
  }
}

/**
 * GET /api/vyra-media/list
 * @param {Request} request - fetch request.
 * @param {object} ctx - Host context.
 * @returns {Promise<Response>} workspace media index.
 */
async function handleList(request, ctx) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  if (sessionId === null || sessionId === '') return json({ ok: false, error: 'missing sessionId' }, 400)

  let resolved
  try {
    resolved = await resolveScanRoot(ctx, sessionId, url.searchParams.get('root') ?? '', request.signal)
  } catch (error) {
    return json({ ok: false, error: error.message, code: error.code }, error.status ?? 500)
  }

  try {
    const result = await scanMedia({
      root: resolved.scanRoot,
      workspaceRoot: resolved.workspaceRoot,
      maxEntries: integer(url.searchParams.get('maxEntries'), SCAN_DEFAULTS.maxEntries, 1, 10_000),
      maxDepth: integer(url.searchParams.get('maxDepth'), SCAN_DEFAULTS.maxDepth, 0, 32),
      budgetMs: integer(url.searchParams.get('budgetMs'), SCAN_DEFAULTS.budgetMs, 500, 30_000),
      includeHidden: ['1', 'true', 'yes'].includes((url.searchParams.get('includeHidden') ?? '').toLowerCase()),
      signal: request.signal,
    })
    return json({
      ok: true,
      sessionId,
      root: resolved.workspaceRoot,
      scanRoot: resolved.relativeRoot,
      ...result,
    })
  } catch (error) {
    return json({ ok: false, error: typeof error?.message === 'string' ? error.message : 'scan failed', code: 'scan-failed' }, 500)
  }
}

/**
 * GET/HEAD /api/vyra-media/file
 * @param {Request} request - fetch request.
 * @param {object} ctx - Host context.
 * @returns {Promise<Response>} media bytes or a reasoned failure.
 */
async function handleFile(request, ctx) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  if (sessionId === null || sessionId === '') {
    return new Response('missing sessionId', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  let workspaceRoot
  try {
    const scope = await ctx.workspaceFiles.scopeOf(sessionId, request.signal)
    if (scope === undefined) return new Response('unknown session', { status: 404, headers: { 'Cache-Control': 'no-store' } })
    workspaceRoot = scope.workspaceRoot
  } catch {
    return new Response('session lookup failed', { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  return serveMediaFile({ request, fs: ctx.fs, workspaceRoot })
}

/**
 * Register both routes on the Host connection Fetch registry.
 * @param {object} ctx - Host context.
 * @param {object} connection - `ctx.connection`.
 * @returns {boolean} true when the registry is present.
 */
export function registerMediaRoutes(ctx, connection) {
  if (connection?.fetch?.register === undefined) return false
  const disposers = [
    connection.fetch.register({
      path: LIST_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: request => handleList(request, ctx),
    }),
    connection.fetch.register({
      path: FILE_PATH,
      methods: ['GET', 'HEAD'],
      requestBody: 'buffered',
      fetch: request => handleFile(request, ctx),
    }),
  ]
  ctx.effect(() => () => { for (const dispose of disposers) void dispose() }, 'vyra-media-studio: routes')
  return true
}

export { LIST_PATH, FILE_PATH, handleFile, handleList }
