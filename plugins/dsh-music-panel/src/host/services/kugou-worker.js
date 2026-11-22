/**
 * The KuGou upstream package, inside its own worker.
 *
 * `kugoumusicapi` is a flat object of module functions (`main.js` scans `module/`); it
 * starts no server. Folia calls it straight from the Electron main process
 * (electron/kugou/kugouApiBridge.cjs); the plugin hosts it in a worker so a 171-module
 * require and the signing work never block the Host's event loop.
 *
 * The package reads `process.env.platform` at require time (appid, clientver, Android
 * salt), so one worker serves one platform: a worker gets its own copy of the env.
 *
 * Protocol: { id, operation, params } → { id, ok, status, body, cookie } | { id, ok:false, ... }
 */

import { parentPort, workerData } from 'node:worker_threads'
import { createRequire } from 'node:module'

const request = createRequire(workerData.base)

// Read by util/index.js and util/helper.js when they load.
process.env.platform = workerData.platform

/** @type {Record<string, Function> | null} */
let api = null

function load() {
  if (api === null) {
    // The package's generate_simulate.js calls generateWebGLHash without importing it
    // (Node falls back to a random fingerprint). Install it before loading the API.
    const util = request('../vendor/kugoumusicapi/util/util')
    globalThis.generateWebGLHash = util.generateWebGLHash
    api = request('../vendor/kugoumusicapi')
  }
  return api
}

parentPort.on('message', (message) => {
  if (message === null || typeof message !== 'object') return
  const { id, operation, params } = message
  let reply
  try {
    const loaded = load()
    const fn = loaded[operation]
    if (typeof fn !== 'function') throw new Error('unknown KuGou operation: ' + operation)
    Promise.resolve(fn(params ?? {})).then(
      (result) => {
        parentPort.postMessage({
          id,
          ok: true,
          status: Number(result?.status) || 0,
          body: result?.body ?? null,
          cookie: Array.isArray(result?.cookie) ? result.cookie : [],
        })
      },
      (error) => {
        // The package rejects with the same `{ status, body, cookie }` answer it would have returned.
        parentPort.postMessage({
          id,
          ok: false,
          status: Number(error?.status) || 0,
          body: error?.body ?? null,
          cookie: Array.isArray(error?.cookie) ? error.cookie : [],
          message: String(error?.message ?? error?.body?.msg ?? error?.body?.error ?? 'KuGou request failed'),
        })
      },
    )
  } catch (error) {
    reply = { id, ok: false, status: 0, body: null, cookie: [], message: String(error?.message ?? error) }
    parentPort.postMessage(reply)
  }
})

parentPort.postMessage({ type: 'ready', operations: (() => {
  try {
    return Object.keys(load()).length
  } catch {
    return 0
  }
})() })
