/**
 * KuGou upstream service: `kugoumusicapi` in a worker thread.
 *
 * The package is a flat object of module functions (`main.js` scans `module/`, no HTTP
 * server); Folia calls it directly from the Electron main process. The plugin keeps the
 * same call shape but hosts it in a worker, for the same reasons the NetEase and QQ
 * services do: 171 modules to load, and signing work that should not block the Host.
 *
 * The package reads `process.env.platform` when it loads (appid, clientver, the Android
 * salt), so one worker serves one platform and each gets its own env copy:
 *
 *   standard — the KuGou app the plugin has always signed in as
 *   lite     — 酷狗概念版 (the concept build Folia runs)
 *
 * @module dsh-music-panel/services/kugou-api
 */

import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { MusicError } from './core/errors.js'

const READY_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 20_000
const WORKER_URL = new URL('./kugou-worker.js', import.meta.url)

/** @type {Map<string, Promise<object>>} */
const services = new Map()

/** Tests only: route every call through `fn` instead of the worker. */
let upstreamOverride = null

export function setUpstreamOverride(fn) {
  upstreamOverride = fn
}

export function resetUpstreamOverride() {
  upstreamOverride = null
}

/** `lite` is the package's concept build; anything else is the standard one. */
export function kugouPlatformOf(value) {
  return value === 'lite' ? 'lite' : 'standard'
}

async function start(platform) {
  const worker = new Worker(WORKER_URL, {
    workerData: { base: fileURLToPath(import.meta.url), platform },
    // A worker gets its own copy of the env; the package reads `platform` from it.
    env: { ...process.env, platform },
    stdout: true,
    stderr: true,
  })

  let settled = false
  const pending = new Map()
  let nextId = 1

  const rejectAll = (error) => {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
  }

  const stop = async () => {
    services.delete(platform)
    rejectAll(new MusicError('the KuGou API worker stopped', { code: 'unavailable', sourceId: 'kugou' }))
    try {
      await worker.terminate()
    } catch {
      // Already gone.
    }
  }

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      void stop()
      reject(new MusicError('the KuGou API service did not start in time', { code: 'timeout', sourceId: 'kugou', retryable: true }))
    }, READY_TIMEOUT_MS)

    worker.on('message', (message) => {
      if (message === null || typeof message !== 'object') return
      if (message.type === 'ready') {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.stdout?.resume()
        worker.stderr?.resume()
        resolve({ operations: Number(message.operations) || 0 })
        return
      }
      const entry = pending.get(message.id)
      if (entry === undefined) return
      pending.delete(message.id)
      clearTimeout(entry.timer)
      entry.resolve(message)
    })

    worker.on('error', (error) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        void stop()
        reject(new MusicError(error.message, { code: 'protocol', sourceId: 'kugou', cause: error }))
        return
      }
      rejectAll(new MusicError(error.message, { code: 'protocol', sourceId: 'kugou', cause: error }))
    })

    worker.on('exit', (code) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new MusicError('the KuGou API worker exited with code ' + code, { code: 'protocol', sourceId: 'kugou' }))
      }
      rejectAll(new MusicError('the KuGou API worker exited', { code: 'protocol', sourceId: 'kugou' }))
      services.delete(platform)
    })
  })

  const info = await ready

  return {
    platform,
    operations: info.operations,

    /**
     * One package operation. Answers `{ status, body, cookie }`; a refusal keeps the
     * package's status and body in the MusicError so callers can tell what it was.
     */
    call(operation, params = {}, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
      const id = nextId
      nextId += 1
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new MusicError('the KuGou API service did not answer in time', { code: 'timeout', sourceId: 'kugou', retryable: true }))
        }, timeoutMs)
        pending.set(id, {
          timer,
          resolve: (message) => {
            if (message.ok === true) {
              resolve({
                status: Number(message.status) || 0,
                body: message.body ?? null,
                cookie: Array.isArray(message.cookie) ? message.cookie : [],
              })
              return
            }
            const status = Number(message.status) || 0
            const errorCode = Number(message.body?.error_code ?? message.body?.errcode) || 0
            reject(new MusicError(String(message.message ?? 'KuGou request failed'), {
              code: status === 401 || errorCode === 20017 ? 'auth-required' : 'protocol',
              sourceId: 'kugou',
              status,
            }))
          },
          reject,
        })
        worker.postMessage({ id, operation, params })
      })
    },

    stop,
  }
}

/** Start (or reuse) the worker for one platform. */
export function ensureKugouService(platform = 'standard') {
  const flavor = kugouPlatformOf(platform)
  if (!services.has(flavor)) {
    services.set(flavor, start(flavor).catch((error) => {
      services.delete(flavor)
      throw error
    }))
  }
  return services.get(flavor)
}

/** Call one package operation on the worker for `platform`. */
export async function callKugou(platform, operation, params = {}, options = {}) {
  if (upstreamOverride !== null) return upstreamOverride(operation, params, options)
  const service = await ensureKugouService(platform)
  return service.call(operation, params, options)
}

/** Stop one platform's worker (tests and shutdown). */
export async function stopKugouService(platform = 'standard') {
  const flavor = kugouPlatformOf(platform)
  const current = services.get(flavor)
  services.delete(flavor)
  if (current === undefined) return
  try {
    const handle = await current
    await handle.stop()
  } catch {
    // A handle that never became ready cleaned itself up.
  }
}

/** Whether a platform's KuGou worker is running. */
export async function kugouServiceStatus(platform = 'standard') {
  const flavor = kugouPlatformOf(platform)
  const current = services.get(flavor)
  if (current === undefined) return { running: false, starting: false, error: null }
  try {
    await current
    return { running: true, starting: false, error: null }
  } catch (error) {
    return { running: false, starting: false, error: error?.message ?? String(error) }
  }
}

/** Stop and start one platform's KuGou worker. */
export async function restartKugouService(platform = 'standard') {
  await stopKugouService(platform)
  try {
    await ensureKugouService(platform)
  } catch {
    // The status below reports the failure to the caller.
  }
  return await kugouServiceStatus(platform)
}

/** Stop every worker; the next call starts fresh ones. */
export async function stopAllKugouServices() {
  await Promise.all([...services.keys()].map((platform) => stopKugouService(platform)))
}
