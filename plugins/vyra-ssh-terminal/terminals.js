/**
 * 界面终端:每个终端是一条 ssh2 shell 通道。所有终端的输出合并在一条 SSE 流里推给页面
 * (浏览器对同一来源的并发连接有上限,每个终端一条流会很快用完)。
 * 每段输出带字节偏移,页面断线重连后可以据此去重。凭据不经过这里。
 */
import { randomBytes } from 'node:crypto'

const MAX_BUFFER = 256 * 1024
const IDLE_MS = 10 * 60 * 1000

export class TerminalManager {
  constructor() {
    /** @type {Map<string, any>} */
    this.terms = new Map()
    this.subs = new Set()
    this.idleTimer = null
  }

  #send(obj) {
    const line = `data: ${JSON.stringify(obj)}\n\n`
    for (const res of this.subs) res.write(line)
  }

  async open(session, connectionId, cols, rows) {
    const stream = await session.shell(cols, rows)
    const id = randomBytes(8).toString('hex')
    const t = { id, connectionId, stream, chunks: [], size: 0, total: 0, closed: false }
    const onData = (b) => {
      const o = t.total
      t.total += b.length
      t.chunks.push(b)
      t.size += b.length
      while (t.size > MAX_BUFFER && t.chunks.length > 1) t.size -= t.chunks.shift().length
      this.#send({ id, o, d: b.toString('base64') })
    }
    stream.on('data', onData)
    stream.stderr?.on('data', onData)
    stream.on('close', () => this.#end(t))
    this.terms.set(id, t)
    return id
  }

  #end(t) {
    if (t.closed) return
    t.closed = true
    this.#send({ id: t.id, closed: true })
    // 留一会儿,让刚重连的页面还能读到最后的输出和关闭通知
    const timer = setTimeout(() => this.terms.delete(t.id), 60_000)
    timer.unref?.()
  }

  /** 把一个 HTTP 响应挂成订阅者,先回放每个终端缓存的输出。 */
  subscribe(res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.write(':ok\n\n')
    for (const t of this.terms.values()) {
      if (t.chunks.length) {
        const d = Buffer.concat(t.chunks).toString('base64')
        res.write(`data: ${JSON.stringify({ id: t.id, o: t.total - t.size, d })}\n\n`)
      }
      if (t.closed) res.write(`data: ${JSON.stringify({ id: t.id, closed: true })}\n\n`)
    }
    clearTimeout(this.idleTimer)
    this.subs.add(res)
    const beat = setInterval(() => res.write(':hb\n\n'), 20_000)
    res.on('close', () => {
      clearInterval(beat)
      this.subs.delete(res)
      // 页面关掉后没人回来,就把终端收掉,不留孤儿 shell
      if (!this.subs.size) {
        this.idleTimer = setTimeout(() => this.closeAll(), IDLE_MS)
        this.idleTimer.unref?.()
      }
    })
  }

  input(id, data) {
    const t = this.terms.get(id)
    if (!t || t.closed) return false
    t.stream.write(data)
    return true
  }

  resize(id, cols, rows) {
    const t = this.terms.get(id)
    if (!t || t.closed) return false
    t.stream.setWindow(rows, cols, 0, 0)
    return true
  }

  close(id) {
    const t = this.terms.get(id)
    if (!t) return false
    try {
      t.stream.close()
    } catch {}
    this.#end(t)
    this.terms.delete(id)
    return true
  }

  closeAll() {
    for (const id of [...this.terms.keys()]) this.close(id)
  }
}
