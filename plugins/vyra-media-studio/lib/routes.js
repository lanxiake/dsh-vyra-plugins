/**
 * Host route handlers and registration. Two exact Fetch routes:
 * `/api/vyra-media/list` and `/api/vyra-media/file`.
 *
 * Every route resolves the Session workspace through `workspaceFiles.scopeOf`
 * and confines the result to that root. The bridge supplies authentication;
 * direct callers must still target a live browser Peer.
 */
import { SCAN_DEFAULTS, scanMedia } from './scan.js'
import { containsTarget, joinWorkspacePath, targetPathOf } from './paths.js'
import { serveMediaFile } from './serve.js'

const LIST_PATH = '/api/vyra-media/list'
const FILE_PATH = '/api/vyra-media/file'
const DIAGNOSE_PATH = '/api/vyra-media/diagnose'

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
 * A request failure the route reports to the client as a code plus message.
 * @param {number} status - HTTP status.
 * @param {string} code - stable machine-readable code.
 * @param {string} message - human-readable reason.
 * @returns {Error} the tagged error.
 */
function requestFailure(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

/**
 * Resolve a Session's workspace root in this Host process, then the scan root
 * inside it. Containment is checked on the resolved targets, so `.` and `..`
 * cannot escape the workspace.
 * @param {object} ctx - Host context.
 * @param {string} sessionId - Session identity.
 * @param {string} path - relative, absolute-inside-workspace, or empty for root.
 * @param {AbortSignal} signal - request cancellation.
 * @returns {Promise<{ workspaceRoot: string, scanRoot: string, relativeRoot: string }>} resolved paths.
 */
async function resolveScanRoot(ctx, sessionId, path, signal) {
  const workspaceFiles = ctx.workspaceFiles
  if (workspaceFiles === undefined || typeof workspaceFiles.scopeOf !== 'function') {
    throw requestFailure(503, 'workspace-service-missing', 'ctx.workspaceFiles.scopeOf is unavailable on this Host')
  }
  const scope = await workspaceFiles.scopeOf(sessionId, signal)
  if (scope === undefined) throw requestFailure(404, 'unknown-session', `no Session "${sessionId}"`)
  const workspaceRoot = scope.workspaceRoot
  if (typeof workspaceRoot !== 'string' || workspaceRoot === '') {
    throw requestFailure(409, 'no-workspace-root', 'this Session has no workspace directory')
  }

  const rootTarget = await ctx.fs.resolve(workspaceRoot, { signal })
  const candidate = path === '' ? workspaceRoot : joinWorkspacePath(workspaceRoot, path)
  const target = await ctx.fs.resolve(candidate, { signal })
  if (!containsTarget(ctx.fs, rootTarget, target)) {
    throw requestFailure(403, 'outside-workspace', `"${path}" is outside the workspace`)
  }
  const workspaceDir = targetPathOf(ctx.fs, rootTarget)
  const scanDir = targetPathOf(ctx.fs, target)
  return { workspaceRoot: workspaceDir, scanRoot: scanDir, relativeRoot: path }
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
  if (sessionId === null || sessionId === '') return json({ ok: false, error: 'missing sessionId', code: 'bad-request' }, 400)

  let resolved
  try {
    resolved = await resolveScanRoot(ctx, sessionId, url.searchParams.get('root') ?? '', request.signal)
  } catch (error) {
    return json({
      ok: false,
      code: error.code ?? 'resolve-failed',
      error: error.message ?? 'cannot resolve workspace',
    }, error.status ?? 500)
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
    return json({
      ok: false,
      code: 'scan-failed',
      error: typeof error?.message === 'string' ? error.message : 'scan failed',
    }, 500)
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

  const workspaceFiles = ctx.workspaceFiles
  if (workspaceFiles === undefined || typeof workspaceFiles.scopeOf !== 'function') {
    return new Response('ctx.workspaceFiles.scopeOf is unavailable on this Host', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  let workspaceRoot
  try {
    const scope = await workspaceFiles.scopeOf(sessionId, request.signal)
    if (scope === undefined) return new Response('unknown session', { status: 404, headers: { 'Cache-Control': 'no-store' } })
    workspaceRoot = scope.workspaceRoot
    if (typeof workspaceRoot !== 'string' || workspaceRoot === '') {
      return new Response('this Session has no workspace directory', { status: 409, headers: { 'Cache-Control': 'no-store' } })
    }
  } catch (error) {
    return new Response(`session lookup failed: ${error?.message ?? error}`, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  return serveMediaFile({ request, fs: ctx.fs, workspaceRoot })
}

/**
 * GET /api/vyra-media/diagnose
 *
 * Reports what the media routes can actually see, so a failed scan or playback
 * names its cause instead of returning a bare 500. It exposes only paths and
 * capability facts for the caller's own Session — no file content.
 * @param {Request} request - fetch request.
 * @param {object} ctx - Host context.
 * @returns {Promise<Response>} capability and resolution facts.
 */
async function handleDiagnose(request, ctx) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  const fs = ctx.fs
  const report = {
    ok: true,
    sessionId,
    fs: fs === undefined ? null : {
      resolve: typeof fs.resolve === 'function',
      stat: typeof fs.stat === 'function',
      processPath: typeof fs.processPath === 'function',
      contains: typeof fs.contains === 'function',
      readByteRange: typeof fs.readByteRange === 'function',
      readBytes: typeof fs.readBytes === 'function',
    },
    workspaceFiles: ctx.workspaceFiles === undefined ? null : {
      scopeOf: typeof ctx.workspaceFiles.scopeOf === 'function',
    },
    rangeParser: typeof (await import('./range.js')).parseRange === 'function',
  }
  if (sessionId === null || sessionId === '') return json({ ...report, ok: false, error: 'missing sessionId' }, 400)
  if (fs === undefined) return json({ ...report, ok: false, error: 'ctx.fs is unavailable' }, 503)

  try {
    const scope = await ctx.workspaceFiles?.scopeOf?.(sessionId, request.signal)
    report.workspaceRoot = scope?.workspaceRoot ?? null
    if (scope !== undefined) {
      const target = await fs.resolve(scope.workspaceRoot, { signal: request.signal })
      report.workspacePath = targetPathOf(fs, target)
      report.workspaceStat = await fs.stat(target, request.signal) ?? null
    }
  } catch (error) {
    report.ok = false
    report.error = `${error?.code ?? 'error'}：${error?.message ?? error}`
  }
  return json(report, report.ok ? 200 : 500)
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
    connection.fetch.register({
      path: DIAGNOSE_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: request => handleDiagnose(request, ctx),
    }),
  ]
  ctx.effect(() => () => { for (const dispose of disposers) void dispose() }, 'vyra-media-studio: routes')
  return true
}

export { LIST_PATH, FILE_PATH, DIAGNOSE_PATH, handleDiagnose, handleFile, handleList }
