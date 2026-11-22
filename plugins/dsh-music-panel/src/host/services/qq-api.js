/**
 * QQ upstream service: `@yakult-green-tea/qq-music-api` in a worker thread.
 *
 * That package starts a Koa server **at require time**, reading `PORT` then. Its
 * config schema rejects `port <= 0`, so the adapter must allocate a free port and
 * set it before the module is loaded — both handled inside the worker.
 *
 * @module dsh-music-panel/services/qq-api
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { MusicError, toMusicError } from './core/errors.js'
import { allocateFreePort } from './core/ports.js'

const READY_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 20_000

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const request = createRequire(workerData.base)

;(async () => {
  try {
    // The package listens on require; PORT must already be valid (> 0).
    process.env.PORT = String(workerData.port)
    process.env.HOST = '127.0.0.1'

    const mod = request(workerData.entryPath)
    // The package keeps its server-side auth sessions in memory unless a
    // repository is installed. Folia installs its encrypted one; this plugin
    // keeps the same session list in the plugin data directory.
    const configure = mod.configureAuthSessionRepository ||
      (mod.default && mod.default.configureAuthSessionRepository)
    if (typeof configure === 'function') {
      configure({
        kind: 'json-file',
        load() {
          try {
            const parsed = JSON.parse(fs.readFileSync(workerData.authSessionFile, 'utf8'))
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        },
        save(sessions) {
          if (!Array.isArray(sessions)) throw new TypeError('QQ auth sessions must be an array')
          fs.mkdirSync(path.dirname(workerData.authSessionFile), { recursive: true })
          fs.writeFileSync(workerData.authSessionFile, JSON.stringify(sessions), 'utf8')
        },
      })
    }
    const server = mod.server
    if (!server) throw new Error('QQ upstream did not expose a server')

    await new Promise((resolve, reject) => {
      if (server.listening) return resolve()
      server.once('listening', resolve)
      server.once('error', reject)
      setTimeout(() => reject(new Error('listen() timed out')), 15000)
    })

    const address = server.address()
    parentPort.postMessage({ type: 'ready', port: address && address.port })
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: String((error && error.stack) || error) })
  }
})()
`

/** @type {Promise<{ port: number }> | null} */
let pending = null
let lastStartError = null

/** Test seam: replaces the whole transport. */
let upstreamOverride = null

export function setUpstreamOverride(fn) {
  upstreamOverride = fn
}

export function resetUpstreamOverride() {
  upstreamOverride = null
}

function resolveEntry() {
  const base = fileURLToPath(import.meta.url)
  const require = createRequire(base)
  try {
    return {
      base,
      entryPath: require.resolve('@yakult-green-tea/qq-music-api'),
      authSessionFile: join(homedir(), '.dsh', 'music', 'qq-auth-sessions.json'),
    }
  } catch (error) {
    throw new MusicError('the QQ Music API package is not installed', {
      code: 'not-configured',
      sourceId: 'qq',
      cause: error,
    })
  }
}

async function start() {
  const entry = resolveEntry()
  const port = await allocateFreePort()

  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { ...entry, port },
      stdout: true,
      stderr: true,
    })

    let settled = false
    const stop = async () => {
      pending = null
      try {
        await worker.terminate()
      } catch {
        // Already gone.
      }
    }
    const fail = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void stop()
      reject(error)
    }
    const timer = setTimeout(() => {
      fail(new MusicError('the QQ Music API service did not start in time', {
        code: 'timeout',
        sourceId: 'qq',
        retryable: true,
      }))
    }, READY_TIMEOUT_MS)

    worker.on('message', (message) => {
      if (message === null || typeof message !== 'object') return
      if (message.type === 'ready' && typeof message.port === 'number') {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.stdout?.resume()
        worker.stderr?.resume()
        resolve({ port: message.port, stop })
      } else if (message.type === 'error') {
        fail(new MusicError(message.message ?? 'the QQ Music API service failed to start', {
          code: 'protocol',
          sourceId: 'qq',
        }))
      }
    })
    worker.on('error', (error) => {
      fail(new MusicError(error.message, { code: 'protocol', sourceId: 'qq', cause: error }))
    })
    worker.on('exit', (code) => {
      if (!settled) {
        fail(new MusicError(`the QQ Music API worker exited with code ${code}`, { code: 'protocol', sourceId: 'qq' }))
      } else {
        pending = null
      }
    })
    worker.unref()
  })
}

export function ensureQqService() {
  if (pending === null) {
    pending = start().then(
      (handle) => {
        lastStartError = null
        return handle
      },
      (error) => {
        lastStartError = error?.message ?? String(error)
        pending = null
        throw error
      },
    )
  }
  return pending
}

/** Whether the local QQ service is running, starting, or failed. */
export async function qqServiceStatus() {
  if (pending === null) {
    return { running: false, starting: false, error: lastStartError, port: null }
  }
  try {
    const handle = await pending
    return { running: true, starting: false, error: null, port: handle.port }
  } catch (error) {
    return { running: false, starting: false, error: error?.message ?? String(error), port: null }
  }
}

/** Stop and start the local QQ service; the next call gets a fresh worker. */
export async function restartQqService() {
  lastStartError = null
  await stopQqService()
  try {
    await ensureQqService()
  } catch {
    // The status below reports the failure to the caller.
  }
  return await qqServiceStatus()
}

export async function stopQqService() {
  const current = pending
  pending = null
  if (current === null) return
  try {
    const handle = await current
    await handle.stop()
  } catch {
    // Never-ready handles clean themselves up.
  }
}

/**
 * Call one upstream route.
 *
 * `skipCodeCheck` is for routes whose `code` is *content* instead of an outcome.
 * The QR login poll answers 801/802/803 for waiting / scanned / signed-in (and
 * 800 for a dead code); the generic "code must be 200 or 0" gate would turn every
 * waiting answer into an error, so the caller has to opt out of it explicitly.
 *
 * @param {string} route
 * @param {Record<string, string|number|boolean|undefined>} [params]
 * @param {{ cookie?: string, timeoutMs?: number, skipCodeCheck?: boolean, includeHeaders?: boolean, method?: 'GET'|'POST', body?: object }} [options]
 */
export async function callUpstream(route, params = {}, options = {}) {
  if (upstreamOverride !== null) return upstreamOverride(route, params, options)
  const handle = await ensureQqService()

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    query.set(key, String(value))
  }
  if (typeof options.cookie === 'string' && options.cookie !== '') query.set('cookie', options.cookie)
  const suffix = query.toString() === '' ? '' : `?${query.toString()}`
  const url = `http://127.0.0.1:${handle.port}${route}${suffix}`
  const headers = { accept: 'application/json' }
  if (typeof options.cookie === 'string' && options.cookie !== '') headers.cookie = options.cookie
  if (options.method === 'POST') headers['content-type'] = 'application/json'

  let response
  try {
    response = await fetch(url, {
      method: options.method === 'POST' ? 'POST' : 'GET',
      headers,
      ...(options.method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}),
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw toMusicError(error, 'qq')
  }

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new MusicError(`QQ API returned non-JSON for ${route}`, { code: 'invalid-response', sourceId: 'qq' })
  }
  if (!response.ok) {
    throw new MusicError(json?.message ?? `QQ API answered HTTP ${response.status}`, {
      code: response.status === 401 ? 'auth-required' : 'protocol',
      sourceId: 'qq',
      status: response.status,
    })
  }
  if (options.includeHeaders === true && typeof json === 'object' && json !== null) {
    Object.defineProperty(json, '__setCookie', {
      value: typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [],
      enumerable: false,
    })
  }
  return assertOk(json, route, options)
}

/**
 * Upstream answers 200 (Koa) or 0 (its own routes) for success and carries a real
 * failure in `code`. QR-login routes carry a scan state there instead;
 * `skipCodeCheck` hands that state back untouched.
 */
export function assertOk(json, route, options = {}) {
  if (options.skipCodeCheck === true) return json
  const code = Number(json?.code)
  if (Number.isFinite(code) && code !== 200 && code !== 0) {
    throw new MusicError(json?.message ?? `QQ API code ${code} (${route})`, {
      code: code === 301 ? 'auth-required' : 'protocol',
      sourceId: 'qq',
      status: code,
    })
  }
  return json
}
