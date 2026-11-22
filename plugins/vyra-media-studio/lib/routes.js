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

/** A string property, ignoring getters that throw. */
function safeString(value, key) {
  try {
    const inner = Reflect.get(value, key)
    return typeof inner === 'string' && inner !== '' ? inner : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve a Session's workspace root without depending on `workspaceFiles.scopeOf`.
 *
 * Older hosts expose `workspaceFiles` without that method, so this mirrors the
 * Host's own resolution order: the sandbox policy's root for a live Session,
 * then the session header's `cwd`, then a stored Session's header `cwd`. The
 * projection cache's `workingDirectory` wins over the header, matching the
 * workspace-files service.
 * @param {object} ctx - Host context.
 * @param {string} sessionId - Session identity.
 * @param {AbortSignal} signal - request cancellation.
 * @returns {Promise<string | undefined>} the workspace root, when known.
 */
async function workspaceRootOf(ctx, sessionId, signal) {
  const scopeOf = ctx.workspaceFiles?.scopeOf
  if (typeof scopeOf === 'function') {
    try {
      const scope = await scopeOf.call(ctx.workspaceFiles, sessionId, signal)
      if (scope === undefined) throw requestFailure(404, 'unknown-session', `no Session "${sessionId}"`)
      if (typeof scope.workspaceRoot === 'string' && scope.workspaceRoot !== '') return scope.workspaceRoot
      return undefined
    } catch (error) {
      if (error?.code === 'unknown-session') throw error
      /* fall through to the Host-side resolution */
    }
  }

  const live = ctx.get?.('sessions')?.get?.(sessionId)
  if (live !== undefined) {
    const policy = ctx.get?.('sandboxPolicy')
    if (typeof policy?.resolve === 'function') {
      try {
        const resolved = policy.resolve({ session: live })
        if (typeof resolved?.workspaceRoot === 'string' && resolved.workspaceRoot !== '') return resolved.workspaceRoot
      } catch { /* fall through to the header */ }
    }
    const headerCwd = safeString(live.header, 'cwd')
    if (headerCwd !== undefined) return headerCwd
    const liveCwd = safeString(live, 'cwd')
    if (liveCwd !== undefined) return liveCwd
    return undefined
  }

  const persistence = ctx.get?.('sessionPersistence')
  if (typeof persistence?.stat === 'function') {
    try {
      const stored = await persistence.stat(sessionId, signal === undefined ? undefined : { signal })
      if (stored === undefined) throw requestFailure(404, 'unknown-session', `no Session "${sessionId}"`)
      const cache = ctx.get?.('sessionProjectionCache')
      const cached = typeof cache?.cachedSnapshot === 'function'
        ? safeString(cache.cachedSnapshot(stored.header, ['workingDirectory'])?.values, 'workingDirectory')
        : undefined
      if (cached !== undefined) return cached
      const headerCwd = safeString(stored.header, 'cwd')
      if (headerCwd !== undefined) return headerCwd
      return undefined
    } catch (error) {
      if (error?.code === 'unknown-session') throw error
      /* fall through to the final failure */
    }
  }
  throw requestFailure(404, 'unknown-session', `no Session "${sessionId}"`)
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
  if (typeof ctx.fs?.resolve !== 'function') {
    throw requestFailure(503, 'fs-unavailable', 'ctx.fs is unavailable on this Host')
  }
  const workspaceRoot = await workspaceRootOf(ctx, sessionId, signal)
  if (workspaceRoot === undefined) {
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

  let workspaceRoot
  try {
    workspaceRoot = await workspaceRootOf(ctx, sessionId, request.signal)
  } catch (error) {
    return new Response(`session lookup failed: ${error?.message ?? error}`, {
      status: error?.status ?? 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  if (workspaceRoot === undefined) {
    return new Response('this Session has no workspace directory', { status: 409, headers: { 'Cache-Control': 'no-store' } })
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
    const root = await workspaceRootOf(ctx, sessionId, request.signal)
    report.workspaceRoot = root ?? null
    report.resolution = root === undefined ? 'unresolved' : 'available'
    if (root !== undefined) {
      const target = await fs.resolve(root, { signal: request.signal })
      report.workspacePath = targetPathOf(fs, target)
      report.workspaceStat = await fs.stat(target, request.signal) ?? null
    } else {
      report.ok = false
      report.error = 'no live or stored Session exposes a workspace root'
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
