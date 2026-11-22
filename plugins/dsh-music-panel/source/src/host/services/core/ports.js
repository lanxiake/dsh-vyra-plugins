/**
 * Port allocation and local-service lifecycle.
 *
 * Both behaviours here were discovered the hard way in `test/manual/upstream-spike.mjs`:
 *
 *   - NetEase turns `port: 0` into 3000 (`options.port || process.env.PORT`), and
 *     QQ's config schema rejects `port <= 0`. Neither may pick its own port, so the
 *     adapter must reserve one first.
 *   - `listen()` callbacks and `address()` are not synchronous: reading the port
 *     right after `serve()` returns gives `null`.
 *
 * @module dsh-music-panel/core/ports
 */

import { createServer } from 'node:net'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_LISTEN_TIMEOUT_MS = 20_000

/**
 * Reserve a free TCP port and release it again, so a server can bind it.
 * There is an unavoidable race after release; on a loopback port this is fine.
 *
 * @param {string} [host]
 * @returns {Promise<number>}
 */
export function allocateFreePort(host = DEFAULT_HOST) {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, host, () => {
      const address = probe.address()
      const port = address !== null && typeof address === 'object' ? address.port : 0
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('no free port was assigned'))))
    })
  })
}

/**
 * Resolve once the server is accepting connections, and return its real port.
 *
 * @param {import('node:http').Server} server
 * @param {{ label?: string, timeoutMs?: number }} [options]
 * @returns {Promise<number>}
 */
export function waitForListening(server, options = {}) {
  const label = options.label ?? 'local service'
  const timeoutMs = options.timeoutMs ?? DEFAULT_LISTEN_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    if (server.listening) {
      const address = server.address()
      return resolve(address !== null && typeof address === 'object' ? address.port : 0)
    }
    const timer = setTimeout(() => {
      server.off('listening', onListening)
      server.off('error', onError)
      reject(new Error(`${label} did not start within ${timeoutMs}ms`))
    }, timeoutMs)

    function onListening() {
      clearTimeout(timer)
      server.off('error', onError)
      const address = server.address()
      resolve(address !== null && typeof address === 'object' ? address.port : 0)
    }
    function onError(error) {
      clearTimeout(timer)
      server.off('listening', onListening)
      reject(error)
    }

    server.once('listening', onListening)
    server.once('error', onError)
  })
}

/**
 * Close a server and resolve once it stops listening. Never throws: shutdown must
 * not mask the reason we are shutting down.
 *
 * @param {import('node:http').Server | null | undefined} server
 */
export function closeServer(server) {
  return new Promise((resolve) => {
    if (server === null || server === undefined || typeof server.close !== 'function') return resolve()
    if (!server.listening) return resolve()
    server.close(() => resolve())
  })
}

/**
 * Poll a URL until it answers, used as a readiness check for services whose
 * `listen` callback is buried inside a third-party package.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number, intervalMs?: number, accept?: (status: number) => boolean }} [options]
 * @returns {Promise<number>} the first status accepted
 */
export async function waitForHttp(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15_000
  const intervalMs = options.intervalMs ?? 150
  const accept = options.accept ?? ((status) => status > 0)
  const deadline = Date.now() + timeoutMs
  let lastError = null

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (accept(response.status)) return response.status
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw lastError ?? new Error(`no response from ${url} within ${timeoutMs}ms`)
}
