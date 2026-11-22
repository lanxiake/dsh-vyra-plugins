/**
 * HTTP plumbing shared by the dsh-music-panel routes.
 *
 * @module dsh-music-panel/http
 */

/** JSON bodies are tiny (a folder list); anything larger is a client bug. */
const MAX_BODY_BYTES = 64 * 1024

export function isLoopback(req) {
  const address = req.socket?.remoteAddress
  if (address === undefined) return true
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address.startsWith('127.')
}

/**
 * Same-origin guard for mutations. A missing Origin is allowed (the Desktop
 * shell strips it); a present Origin must match the Host header.
 */
export function isSameOrigin(req) {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '') return true
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function sendJson(res, status, payload) {
  if (res.writableEnded || res.destroyed) return
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

export function fail(res, status, code, message, extra = {}) {
  sendJson(res, status, { ok: false, error: { code, ...(message === undefined ? {} : { message }), ...extra } })
}

export function readJson(req, cap = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > cap) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

export function queryOf(req) {
  try {
    return new URL(req.url ?? '/', 'http://localhost').searchParams
  } catch {
    return new URLSearchParams()
  }
}
