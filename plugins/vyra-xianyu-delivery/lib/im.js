// 常驻 IM 通道。
//
// 每条短命令都要 `uv run` 起一个新 Python（1~2 秒），而 chats/history/send
// 每次还会新开一条 IM 连接、把收消息的连接踢下线。这里只保留一个
// `worker.py serve` 进程：stdin 发命令，stdout 收结果和推送事件，全部复用
// 同一条连接。
//
// 进程挂了会自动重启（指数退避），重启期间请求直接报错，由调用方决定重试。
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { EventEmitter } from 'node:events'

export function createIm({
  command = 'uv',
  prefix,
  logger = () => {},
  requestTimeout = 25000,
} = {}) {
  const emitter = new EventEmitter()
  let child = null
  let starting = null
  let ready = false
  let stopped = false
  let nextId = 1
  let backoff = 500
  let retryTimer = null
  const pending = new Map()

  function failAll(reason) {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer)
      entry.reject(new Error(reason))
    }
    pending.clear()
  }

  function handleLine(line) {
    let frame
    try {
      frame = JSON.parse(line)
    } catch {
      return
    }
    if (frame.event) {
      if (frame.event === 'ready') {
        ready = true
        backoff = 500
        logger(`im ready (unb ${frame.unb || ''})`)
        emitter.emit('ready', frame)
      } else if (frame.event !== 'error') {
        emitter.emit('event', frame)
      } else {
        logger(`im error: ${frame.message || ''}`)
      }
      return
    }
    const entry = pending.get(frame.id)
    if (!entry) return
    pending.delete(frame.id)
    clearTimeout(entry.timer)
    if (frame.ok) entry.resolve(frame.data)
    else entry.reject(new Error(String(frame.error || 'im command failed')))
  }

  function start() {
    if (stopped) return Promise.resolve()
    child = spawn(command, [...prefix, 'serve'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', PYTHONIOENCODING: 'utf-8', GOOFISH_AUTO_REFRESH_TOKEN: '0' },
    })
    createInterface({ input: child.stdout }).on('line', handleLine)
    child.stderr.on('data', (chunk) => {
      const text = String(chunk || '').trim()
      if (text) logger(`im stderr: ${text.slice(0, 300)}`)
    })
    child.on('error', (err) => {
      logger(`im spawn failed: ${err?.message || err}`)
      ready = false
    })
    child.on('exit', () => {
      ready = false
      child = null
      failAll('im process exited')
      emitter.emit('down')
      if (stopped) return
      retryTimer = setTimeout(() => {
        retryTimer = null
        starting = null
        logger('im restarting…')
        void ensure().catch(() => {})
      }, backoff)
      backoff = Math.min(backoff * 2, 15000)
    })
    return new Promise((resolve) => {
      const onReady = () => {
        emitter.off('ready', onReady)
        resolve()
      }
      emitter.on('ready', onReady)
      // 进程可能还没输出 ready，请求会自己排队等待；这里不阻塞调用方太久。
      setTimeout(() => {
        emitter.off('ready', onReady)
        resolve()
      }, 15000).unref?.()
    })
  }

  function ensure() {
    if (ready) return Promise.resolve()
    if (!starting) starting = start()
    return starting
  }

  function request(op, args = {}, timeout = requestTimeout) {
    return ensure().then(() => new Promise((resolve, reject) => {
      if (!child || !child.stdin.writable) {
        reject(new Error('IM 通道未就绪'))
        return
      }
      const id = nextId++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`IM ${op} 超时`))
      }, timeout)
      timer.unref?.()
      pending.set(id, { resolve, reject, timer })
      child.stdin.write(`${JSON.stringify({ id, op, args })}\n`)
    }))
  }

  return {
    get ready() {
      return ready
    },
    onEvent(handler) {
      emitter.on('event', handler)
      return () => emitter.off('event', handler)
    },
    onDown(handler) {
      emitter.on('down', handler)
      return () => emitter.off('down', handler)
    },
    ensure,
    chats: (limit = 60) => request('chats', { limit }, 30000),
    history: (cid, limit = 30) => request('history', { cid, limit }, 30000),
    send: ({ cid = '', toid, itemId = '', text }) => request('send', { cid, toid, itemId, text }, 30000),
    // 切账号等场景：关掉当前进程再重新拉起（dispose 之后不能直接 ensure）。
    async restart() {
      this.dispose()
      stopped = false
      starting = null
      backoff = 500
      await ensure()
    },
    dispose() {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      failAll('im disposed')
      if (child) {
        try {
          child.stdin.end()
          child.kill()
        } catch {
          // 已退出
        }
        child = null
      }
      ready = false
    },
  }
}
