// 侧车协议客户端：每行一个 UTF-8 JSON，见 vendor/wechat/sidecar.py 顶部注释。
//
// 这里只做四件事：spawn、按行写、按行读、按 id 配对。业务逻辑全在 Python 里。
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const INIT_TIMEOUT_MS = 300_000 // 首次 uv run 可能要下载解释器与依赖
const SHUTDOWN_GRACE_MS = 2_000

export class SidecarError extends Error {
  constructor(message, { code = 'sidecar_error', cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'SidecarError'
    this.code = code
  }
}

function responseText(content) {
  if (!Array.isArray(content)) return JSON.stringify(content ?? '')
  const text = content
    .filter((block) => block && block.type === 'text')
    .map((block) => String(block.text ?? ''))
    .join('\n')
  return text || JSON.stringify(content)
}

/**
 * @param {object} options
 * @param {(config?: object) => {command: string, args: string[], source: string}} options.runtime
 * @param {string} options.vendorDir
 * @param {(line: string) => void} [options.log]
 */
export function createSidecar({ runtime, vendorDir, log = () => {} }) {
  let child = null
  let reader = null
  let state = 'idle' // idle | starting | ready | failed | stopped
  let info = null
  let error = ''
  let startPromise = null
  let nextId = 1
  let stopping = false
  let generation = 0
  const pending = new Map()
  const stderrTail = []

  function remember(line) {
    stderrTail.push(line)
    if (stderrTail.length > 40) stderrTail.shift()
  }

  function settle(id, ok, value) {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    if (entry.timer) clearTimeout(entry.timer)
    if (entry.signal && entry.onAbort) entry.signal.removeEventListener('abort', entry.onAbort)
    if (ok) entry.resolve(value)
    else entry.reject(value)
  }

  function failAll(reason) {
    for (const [id, entry] of pending) {
      pending.delete(id)
      if (entry.timer) clearTimeout(entry.timer)
      if (entry.signal && entry.onAbort) entry.signal.removeEventListener('abort', entry.onAbort)
      entry.reject(reason)
    }
  }

  function onFrame(frame) {
    if (!frame || typeof frame !== 'object') return
    if (frame.type === 'progress') {
      log(`progress: ${frame.message ?? ''} ${frame.progress ?? ''}${frame.total ? `/${frame.total}` : ''}`)
      return
    }
    const entry = pending.get(frame.id)
    if (!entry) return
    if (frame.ok === true) {
      settle(frame.id, true, frame)
    } else {
      settle(frame.id, false, new SidecarError(responseText(frame.content), { code: 'tool_error' }))
    }
  }

  function wire(childProcess) {
    reader = createInterface({ input: childProcess.stdout, crlfDelay: Infinity })
    reader.on('line', (line) => {
      const text = line.trim()
      if (!text) return
      try {
        onFrame(JSON.parse(text))
      } catch {
        log(`sidecar stdout is not JSON: ${text.slice(0, 200)}`)
      }
    })
    childProcess.stderr.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) {
          remember(line)
          log(line)
        }
      }
    })
    childProcess.on('error', (err) => {
      const message = `侧车启动失败：${err.message}`
      child = null
      if (state === 'starting' || state === 'ready') state = 'failed'
      error = message
      failAll(new SidecarError(message, { code: 'spawn_failed', cause: err }))
    })
    childProcess.on('exit', (code, signal) => {
      child = null
      if (reader) reader.close()
      reader = null
      if (stopping) {
        state = 'stopped'
        failAll(new SidecarError('侧车已停止', { code: 'stopped' }))
        return
      }
      state = 'failed'
      error = `侧车进程退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）`
      failAll(new SidecarError(error, { code: 'exited' }))
      log(error)
    })
  }

  function send(frame) {
    if (!child || child.stdin.destroyed) {
      throw new SidecarError('侧车未运行', { code: 'not_running' })
    }
    child.stdin.write(`${JSON.stringify(frame)}\n`)
  }

  function request(method, extra = {}, { signal, timeoutMs } = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++
      if (signal?.aborted) {
        reject(new SidecarError('调用已取消', { code: 'aborted' }))
        return
      }
      const entry = { resolve, reject, signal }
      if (signal) {
        entry.onAbort = () => settle(id, false, new SidecarError('调用已取消', { code: 'aborted' }))
        signal.addEventListener('abort', entry.onAbort, { once: true })
      }
      if (timeoutMs) {
        entry.timer = setTimeout(
          () => settle(id, false, new SidecarError(`侧车在 ${timeoutMs}ms 内没有回应`, { code: 'timeout' })),
          timeoutMs,
        )
      }
      pending.set(id, entry)
      try {
        send({ id, method, ...extra })
      } catch (err) {
        settle(id, false, err)
      }
    })
  }

  async function start() {
    if (state === 'ready') return info
    if (startPromise) return startPromise
    if (state === 'failed' || state === 'stopped') {
      throw new SidecarError(error || '侧车已退出，请在设置页重启', { code: 'not_running' })
    }

    state = 'starting'
    error = ''
    generation += 1
    const startedIn = generation
    startPromise = (async () => {
      const resolved = await runtime()
      log(`starting sidecar: ${resolved.command} (${resolved.source})`)
      const childProcess = spawn(resolved.command, resolved.args, {
        cwd: vendorDir,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      })
      child = childProcess
      wire(childProcess)

      const reply = await request('initialize', {}, { timeoutMs: INIT_TIMEOUT_MS })
      if (!reply.ok || !reply.data) throw new SidecarError('initialize 未返回工具清单', { code: 'bad_initialize' })
      info = reply.data
      state = 'ready'
      log(`sidecar ready v${info.version ?? '?'} with ${(info.tools ?? []).length} tools`)
      return info
    })()
      .catch((err) => {
        if (startedIn === generation) {
          state = 'failed'
          error = err.message
          startPromise = null
        }
        if (startedIn === generation && child) child.kill()
        throw err instanceof SidecarError ? err : new SidecarError(String(err?.message ?? err), { code: 'start_failed', cause: err })
      })

    return startPromise
  }

  async function call(name, args, signal) {
    await start()
    const reply = await request('call', { tool: name, args: args ?? {} }, { signal })
    return Array.isArray(reply.content) ? reply.content : []
  }

  /** 只用于设置页：调用任意已实现但可能不在白名单里的工具（例如 check_env）。 */
  async function rawCall(name, args, signal) {
    await start()
    const reply = await request('call', { tool: name, args: args ?? {} }, { signal })
    return reply.content ?? []
  }

  async function stop() {
    generation += 1
    if (!child) {
      state = state === 'failed' ? 'failed' : 'stopped'
      return
    }
    stopping = true
    try {
      send({ id: nextId++, method: 'shutdown' })
    } catch {
      // 已经不可写就直接进入 kill
    }
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (child) child.kill()
        resolve()
      }, SHUTDOWN_GRACE_MS)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    stopping = false
    state = 'stopped'
  }

  async function restart() {
    await stop()
    startPromise = null
    info = null
    state = 'idle'
    return start()
  }

  function status() {
    return {
      state,
      version: info?.version ?? null,
      tools: (info?.tools ?? []).map((tool) => tool.name),
      error: error || null,
      stderrTail: stderrTail.slice(-10),
    }
  }

  return { start, call, rawCall, stop, restart, status }
}