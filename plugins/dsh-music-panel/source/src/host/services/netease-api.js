/**
 * NetEase upstream service: `@neteasecloudmusicapienhanced/api` in a worker thread.
 *
 * The package is a complete Express app, not a request library — the same shape
 * Folia runs inside an Electron worker (`electron/netease/neteaseApiWorker.cjs`).
 * We keep the isolation and drop Electron: a `worker_threads` worker loads the
 * package, binds a port **we** allocated (upstream turns `port: 0` into 3000), and
 * reports the bound port back.
 *
 * The worker source is inline so the plugin still ships as plain files with no
 * extra runtime asset to forget in `files`.
 *
 * @module dsh-music-panel/services/netease-api
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { MusicError, toMusicError } from './core/errors.js'
import { allocateFreePort } from './core/ports.js'

const READY_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 20_000

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { createRequire } = require('node:module')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const request = createRequire(workerData.base)

;(async () => {
  try {
    // util/request reads os.tmpdir()/anonymous_token the moment it loads and throws
    // ENOENT when the file is missing. The package's own boot creates it, but the
    // client-IP patch below loads that module first, so create it here.
    try {
      const tokenPath = path.resolve(os.tmpdir(), 'anonymous_token')
      if (!fs.existsSync(tokenPath)) fs.writeFileSync(tokenPath, '', 'utf-8')
    } catch (_) {
      // A read-only tmpdir costs the anonymous fallback, not the service.
    }

    // Folia's client-IP policy: the package stamps X-Real-IP from the caller socket,
    // which is 127.0.0.1 here. Install the patch before server.js loads the module.
    const upstream = await import(workerData.patchUrl)
    const policies = upstream.installUpstreamPolicies(request, workerData)

    // Upstream's app.js refreshes the anonymous token and the xeapi key at boot.
    // Both need the network, so they must not delay the port becoming available.
    try {
      const generateConfig = request(workerData.generateConfigPath)
      Promise.resolve(generateConfig()).catch(() => {})
    } catch (_) {
      // A failed token refresh is not fatal: anonymous requests still work.
    }

    const { serveNcmApi } = request(workerData.serverPath)
    const app = await serveNcmApi({ port: workerData.port, host: '127.0.0.1', checkVersion: false })

    // serveNcmApi resolves as soon as listen() is called, not once the socket is
    // bound, so address() is still null here. Wait for the event instead.
    const server = app.server
    await new Promise((resolve, reject) => {
      if (server.listening) return resolve()
      server.once('listening', resolve)
      server.once('error', reject)
      setTimeout(() => reject(new Error('listen() timed out')), 15000)
    })

    // The policies live in this worker's module cache: the ready line is where a test
    // can see that they were really installed.
    parentPort.postMessage({ type: 'ready', port: server.address().port, policies })
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: String((error && error.stack) || error) })
  }
})()
`

/** @type {Promise<{ port: number, policies: { clientIpPolicy: boolean, loginQrCheck: boolean } | null }> | null} */
let pending = null
let lastStartError = null

/**
 * Test seam. Tests that exercise routes with a stubbed `fetch` must not spawn a
 * real local service, so they can replace the upstream call wholesale.
 * @type {null | ((route: string, params: object, options: object) => Promise<unknown>)}
 */
let upstreamOverride = null

/** Tests only: route every upstream call through `fn`. */
export function setUpstreamOverride(fn) {
  upstreamOverride = fn
}

/** Tests only: restore the real service. */
export function resetUpstreamOverride() {
  upstreamOverride = null
}

function resolvePackagePaths() {
  const base = fileURLToPath(import.meta.url)
  const require = createRequire(base)
  try {
    return {
      base,
      serverPath: require.resolve('@neteasecloudmusicapienhanced/api/server.js'),
      generateConfigPath: require.resolve('@neteasecloudmusicapienhanced/api/generateConfig.js'),
      requestPath: require.resolve('@neteasecloudmusicapienhanced/api/util/request.js'),
      qrCheckPath: require.resolve('@neteasecloudmusicapienhanced/api/module/login_qr_check.js'),
      optionPath: require.resolve('@neteasecloudmusicapienhanced/api/util/option.js'),
      patchUrl: new URL('./netease-upstream.js', import.meta.url).href,
    }
  } catch (error) {
    throw new MusicError('the NetEase API package is not installed', {
      code: 'not-configured',
      sourceId: 'netease',
      cause: error,
    })
  }
}

async function start() {
  const paths = resolvePackagePaths()
  const port = await allocateFreePort()

  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { ...paths, port },
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
      fail(new MusicError('the NetEase API service did not start in time', {
        code: 'timeout',
        sourceId: 'netease',
        retryable: true,
      }))
    }, READY_TIMEOUT_MS)

    worker.on('message', (message) => {
      if (message === null || typeof message !== 'object') return
      if (message.type === 'ready' && typeof message.port === 'number') {
        if (settled) return
        settled = true
        clearTimeout(timer)
        // Upstream prints a banner to stdout; keep the host log clean.
        worker.stdout?.resume()
        worker.stderr?.resume()
        resolve({ port: message.port, policies: message.policies || null, stop })
      } else if (message.type === 'error') {
        fail(new MusicError(message.message ?? 'the NetEase API service failed to start', {
          code: 'protocol',
          sourceId: 'netease',
        }))
      }
    })

    worker.on('error', (error) => {
      fail(new MusicError(error.message, { code: 'protocol', sourceId: 'netease', cause: error }))
    })

    worker.on('exit', (code) => {
      if (!settled) {
        fail(new MusicError(`the NetEase API worker exited with code ${code}`, {
          code: 'protocol',
          sourceId: 'netease',
        }))
      } else {
        pending = null
      }
    })

    worker.unref()
  })
}

/** Start (or reuse) the local service. */
export function ensureNeteaseService() {
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

/** Whether the local NetEase service is running, starting, or failed. */
export async function neteaseServiceStatus() {
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

/** Stop and start the local NetEase service; the next call gets a fresh worker. */
export async function restartNeteaseService() {
  lastStartError = null
  await stopNeteaseService()
  try {
    await ensureNeteaseService()
  } catch {
    // The status below reports the failure to the caller.
  }
  return await neteaseServiceStatus()
}

/** Terminate the worker; the next call starts a fresh one. */
export async function stopNeteaseService() {
  const current = pending
  pending = null
  if (current === null) return
  try {
    const handle = await current
    await handle.stop()
  } catch {
    // A handle that never became ready has already cleaned itself up.
  }
}

/**
 * Call one upstream route. Response shape is upstream's own; callers adapt it.
 *
 * `skipCodeCheck` is for routes whose `code` is *content* instead of an outcome.
 * The QR login poll answers 800/801/802/803 for expiry / waiting / scanned /
 * signed-in; the generic "only 200 means success" gate would turn every waiting
 * answer into an error, so the caller has to opt out of it explicitly.
 *
 * @param {string} route e.g. `/cloudsearch`
 * @param {Record<string, string|number|boolean|undefined>} params
 * @param {{ cookie?: string, timeoutMs?: number, skipCodeCheck?: boolean }} [options]
 */
export async function callUpstream(route, params = {}, options = {}) {
  if (upstreamOverride !== null) return upstreamOverride(route, params, options)
  const handle = await ensureNeteaseService()
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    query.set(key, String(value))
  }
  // Upstream memoises per module; `timestamp` is its documented cache buster.
  query.set('timestamp', String(Date.now()))
  if (typeof options.cookie === 'string' && options.cookie !== '') query.set('cookie', options.cookie)

  const url = `http://127.0.0.1:${handle.port}${route}?${query.toString()}`
  let response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS) })
  } catch (error) {
    throw toMusicError(error, 'netease')
  }

  if (!response.ok) {
    throw new MusicError(`NetEase API answered HTTP ${response.status} for ${route}`, {
      code: 'protocol',
      sourceId: 'netease',
      status: response.status,
      retryable: response.status >= 500,
    })
  }

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new MusicError(`NetEase API returned non-JSON for ${route}`, {
      code: 'invalid-response',
      sourceId: 'netease',
    })
  }
  return assertOk(json, route, options)
}

/**
 * Upstream answers 200 for success and carries the real outcome in `code`.
 * QR-login routes carry a scan state there instead; `skipCodeCheck` keeps it.
 */
export function assertOk(json, route, options = {}) {
  if (options.skipCodeCheck === true) return json
  const code = Number(json?.code)
  if (code === 200) return json
  const message = json?.message ?? json?.msg ?? `NetEase API code ${code}`
  throw new MusicError(`${message} (${route})`, {
    code: code === 301 ? 'auth-required' : code === 404 ? 'not-playable' : 'protocol',
    sourceId: 'netease',
    status: Number.isFinite(code) ? code : 0,
  })
}
