/**
 * 延迟探测：连上之后，从本机量一次到服务器的往返时间。
 *
 * 走的是本机 TCP 握手（连一下 **ssh 端口** 再关掉），不是 SSH 通道里的 exec——
 * 后者量到的是"经通道跑一条命令"的时间，跟用户抱怨"敲字有延迟"时说的不是一回事。
 *
 * 代价是 sshd 会为此在认证日志里留一条 `Connection closed by ... [preauth]`。所以
 * 结果按「主机:端口」缓存 30 秒：面板每 2 秒刷新一次，不缓存就会把日志刷满。
 */
import { connect } from 'node:net'
import { performance } from 'node:perf_hooks'

const TTL_MS = 30_000
const TIMEOUT_MS = 3_000

/** @type {Map<string, { at: number, ms: number | null }>} */
const cache = new Map()

/** @type {Map<string, Promise<number | null>>} */
const inflight = new Map()

/**
 * @param {{host: string, port?: number, localAddress?: string}} conn
 * @param {{timeoutMs?: number, ttlMs?: number}} [opts] 测试时可注入
 * @returns {Promise<number | null>} 毫秒；连不上就是 null（不是 0，"没有延迟"和"量不到"是两回事）
 */
export async function probeLatency(conn, opts = {}) {
  const host = String(conn?.host ?? '').trim()
  if (!host) return null
  const port = Number(conn?.port) || 22
  const key = `${host}:${port}`
  const ttl = opts.ttlMs ?? TTL_MS
  const now = Date.now()

  const hit = cache.get(key)
  if (hit && now - hit.at < ttl) return hit.ms

  const running = inflight.get(key)
  if (running) return running

  const job = new Promise((resolve) => {
    const started = performance.now()
    const socket = connect({ host, port, ...(conn.localAddress ? { localAddress: conn.localAddress } : {}) })
    let settled = false
    const done = (ms) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      cache.set(key, { at: Date.now(), ms })
      resolve(ms)
    }
    const timer = setTimeout(() => done(null), opts.timeoutMs ?? TIMEOUT_MS)
    socket.once('connect', () => done(Math.round(performance.now() - started)))
    // 连不上（端口没开、被防火墙丢包）就是量不到，不是"0 毫秒"。
    socket.once('error', () => done(null))
  }).finally(() => inflight.delete(key))

  inflight.set(key, job)
  return job
}

/** 测试用：清掉缓存，让下一次真的去连。 */
export function clearLatencyCache() {
  cache.clear()
  inflight.clear()
}
