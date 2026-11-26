/**
 * dsh-boot-duel — Host half.
 *
 * Deliberately tiny. The duel needs nothing from the Host beyond two knobs
 * (`enabled`, `difficulty`); the browser keeps the whole fight in memory so a
 * reload replays the opening animation and uninstalling leaves no residue.
 *
 * We write no files and register no tool. The one thing we do add is a
 * read-only route, because a bundle Client is a plain
 * `window.__ModuleLoader__.load` factory: it receives only `require`, so the
 * dynamic-run `host.call` RPC is not available to it. GET the route to read
 * the config; a missing route falls back to the same defaults.
 */
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-boot-duel'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = '/plugins/dsh-boot-duel/config'
const SFX_PREFIX = '/plugins/dsh-boot-duel/sfx/'
const SFX_DIR = path.join(ROOT, 'sfx')

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  difficulty: 'easy',
  /** Master switch for the synthesised/recorded sound. */
  sound: true,
})

const DIFFICULTIES = ['easy', 'normal']

/** Coerce whatever the Loader handed us into the two fields we actually use. */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_CONFIG.enabled,
    difficulty: DIFFICULTIES.includes(input.difficulty) ? input.difficulty : DEFAULT_CONFIG.difficulty,
    sound: typeof input.sound === 'boolean' ? input.sound : DEFAULT_CONFIG.sound,
  }
}

let resolved = { ...DEFAULT_CONFIG }

// `Config` is optional. schemastery is supplied by the host in installed
// profiles, but a bare workspace load must not crash on a missing module, so
// the schema is built only when the package resolves. Built synchronously at
// module scope: the Loader reads `Config` right after importing this module,
// so a lazily-added export would be missed.
function buildConfigSchema() {
  try {
    const schema = createRequire(import.meta.url)('@deepseek-ai/schemastery')
    const Schema = schema.default ?? schema.Schema ?? schema
    return Schema.object({
      enabled: Schema.boolean().default(DEFAULT_CONFIG.enabled),
      difficulty: Schema.union(DIFFICULTIES).default(DEFAULT_CONFIG.difficulty),
      sound: Schema.boolean().default(DEFAULT_CONFIG.sound),
    })
  } catch (error) {
    console.warn('[dsh-boot-duel] schemastery unavailable, using plain defaults:', String(error && error.message || error))
    return undefined
  }
}

export const Config = buildConfigSchema()

/**
 * `ctx.webServer` is present on the Web/desktop host; a headless or bare
 * profile simply has no route, and the Client keeps its defaults.
 */
function resolveWebServer(scope) {
  try {
    if (scope && scope.webServer && typeof scope.webServer.register === 'function') return scope.webServer
    if (scope && typeof scope.get === 'function') {
      const service = scope.get('webServer')
      if (service && typeof service.register === 'function') return service
    }
    if (scope && typeof scope.reflect?.get === 'function') {
      const service = scope.reflect.get('webServer')
      if (service && typeof service.register === 'function') return service
    }
  } catch { /* ignore */ }
  return null
}

function handleConfig(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end()
    return
  }
  const body = Buffer.from(JSON.stringify({ ...resolved }))
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  })
  if (req.method === 'HEAD') res.end()
  else res.end(body)
}

/**
 * Serve one of the bundled CC0 sound effects.
 *
 * The client fetches `/plugins/dsh-boot-duel/sfx/<file>.ogg`. Only a plain
 * basename that exists in `sfx/` is served — no traversal, no directories,
 * no MIME guessing beyond `.ogg` — and a missing sample is a 404 the client
 * already falls back from.
 */
async function handleSfx(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end()
    return
  }
  const name = decodeURIComponent((url?.pathname ?? '').slice(SFX_PREFIX.length))
  if (!/^[a-z0-9][a-z0-9.-]*\.ogg$/i.test(name) || name.includes('..')) {
    res.writeHead(404).end()
    return
  }
  try {
    const bytes = await readFile(path.join(SFX_DIR, name))
    res.writeHead(200, {
      'content-type': 'audio/ogg',
      'content-length': bytes.length,
      // Immutable content: the file name is the version.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    })
    if (req.method === 'HEAD') res.end()
    else res.end(bytes)
  } catch {
    res.writeHead(404).end()
  }
}

export function apply(ctx, config) {
  resolved = normalizeConfig(config)
  // Nothing to start on the Host: the duel runs entirely in the browser.
  // Keeping the resolved snapshot here means the Client reads the same values
  // the patch shipped, not its own guess.
  try {
    ctx.inject(['webServer'], (scope) => {
      const webServer = resolveWebServer(scope)
      if (webServer === null) return
      const effect = typeof scope.effect === 'function' ? scope.effect.bind(scope) : ctx.effect.bind(ctx)
      effect(() => webServer.register({
        kind: 'exact',
        path: CONFIG_PATH,
        handler: handleConfig,
      }), 'dsh-boot-duel: config route')
      effect(() => webServer.register({
        kind: 'prefix',
        path: SFX_PREFIX,
        handler: handleSfx,
      }), 'dsh-boot-duel: sfx route')
    })
  } catch (error) {
    console.warn('[dsh-boot-duel] routes not mounted:', String(error && error.message || error))
  }
  return resolved
}

/**
 * Package-private config read, kept for tests and for any Host caller that
 * wants the resolved snapshot without going through the route.
 */
export async function config() {
  return { ...resolved }
}

export const __test = { CONFIG_PATH, SFX_PREFIX, SFX_DIR, handleConfig, handleSfx, resolveWebServer }
