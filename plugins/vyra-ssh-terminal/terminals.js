/**
 * 界面终端：每个终端是一条 ssh2 shell 通道。所有终端的输出合并在一条 SSE 流里推给页面
 * （浏览器对同一来源的并发连接有上限，每个终端一条流会很快用完）。每段输出带字节偏移，
 * 页面断线重连后可以据此去重。凭据不经过这里。
 *
 * 这里还有一件事：**在用户终端里代跑一条命令并读回输出**（`runInShell`）。
 *
 * ## 为什么要用标记，以及为什么这样写
 *
 * 命令必须打在用户看得见的那个 shell 里（这样 `cd`、环境变量都能延续，用户也能看着它
 * 跑）。可终端是一条共享的字节流：命令的输出和提示符、回显混在一起。liteshell 的解法是
 * 在命令前后各打一个私有 OSC 标记，把两者之间的字节当成输出——这里沿用同一个思路，但
 * 把它写得简单到不用猜：
 *
 *   写入：`{ printf '<开>%s<nonce>'; <cmd>; printf '<关>%s %s' <nonce> "$?"; }`
 *
 * 要塞进一行的原因：终端一次只读一行，多行脚本会切碎中间那几个字符。
 *
 * 读回时按这个顺序：
 *   1. **先丢掉回显**——shell 会把我们写进去的那一行原样回显（可能带颜色、可能被拆成
 *      几段 data）。回显里就有标记的写法，不丢掉它，第一个"标记"永远是假的。
 *      丢法是按「我们写进去的那一行」逐字符匹配：每一段都以它开头（越过可能的前导
 *      空白/提示符/回车），匹配到哪就算丢到哪。
 *   2. 再找开始标记 → 命令输出 → 收尾标记 + 退出码。
 *
 * 所有控制字符、标记字节都用 `String.fromCharCode` 拼，**不在源码里写任何行内转义**：
 * 这个仓库的编辑链路会把 `\u001b` 这类转义折叠成一个看不见的字符，代码读起来是对的，
 * 跑起来却永远匹配不上（踩过）。
 */
import { randomBytes } from 'node:crypto'

const MAX_BUFFER = 256 * 1024
const IDLE_MS = 10 * 60 * 1000

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const CTRL_U = String.fromCharCode(21)
const CTRL_C = String.fromCharCode(3)
const CR = String.fromCharCode(13)
const LF = String.fromCharCode(10)

/** OSC 1338 / 1339：私有用途，xterm 会整段吞掉，不影响显示。 */
const MARK_OPEN = ESC + ']1338;'
const MARK_CLOSE = ESC + ']1339;'

/** 回显开头可能带的字符：回车换行、提示符、我们自己的 Ctrl-U。 */
const LEADING = new Set([CR, LF, '$', ' ', '#', CTRL_U])

/**
 * 从 `text` 里丢掉 `echo` 的回显（`echo` 可能只是它的一段前缀）。
 *
 * @returns {{rest: string, pending: boolean}} `pending` = 这段还都在回显里，等下一段再说
 */
export function stripEcho(text, echo) {
  let i = 0
  while (i < text.length && LEADING.has(text[i])) i++
  let j = 0
  while (i + j < text.length && j < echo.length && text[i + j] === echo[j]) j++
  if (j === echo.length) return { rest: text.slice(i + j), pending: false }
  if (i + j === text.length) {
    // 只匹配到一半：这一段全是回显，下一段接着比
    return { rest: '', pending: true, matched: i + j }
  }
  // 走到这里说明回显已经结束（内容对不上），剩下的都是后续输出
  return { rest: text.slice(i + j), pending: false }
}

/**
 * 从「命令输出 + 退出码」里把退出码摘出来。
 *
 * 分界 printf 的输出永远是结尾那一小段数字，但它前面**不一定有换行**——命令最后一行
 * 自己没打换行时，退出码就直接粘在它后面（`…621`）。命令自己的输出也常以数字结尾
 * （`wc -l`、`pidof x`），所以只认**最末尾**那一段数字，并且把它从输出里切掉。
 *
 * @param {string} raw 标记之间的原始文本（已去掉回车）
 * @returns {{stdout: string, code: number}}
 */
export function splitExitCode(raw) {
  const text = String(raw ?? '').trimEnd()
  // 结尾那一小段数字：命令没有任何输出时它就直接贴着标记（`0`）
  const atEnd = /^(.*?)[ \t]*(\d+)$/s.exec(text)
  if (atEnd) {
    const head = atEnd[1]
    // 只有当分隔处是行首、空白，或者前面根本没有内容时才算退出码——
    // 否则 `abc123` 里的 123 会被误当成退出码吃掉。
    if (head === '' || /[\n\s]$/.test(head)) {
      return { stdout: head.trim(), code: Number(atEnd[2]) }
    }
  }
  return { stdout: text.trim(), code: -1 }
}

export class TerminalManager {
  constructor() {
    /** @type {Map<string, any>} */
    this.terms = new Map()
    this.subs = new Set()
    this.idleTimer = null
    /** 同一时刻只让一条代执行命令占用 shell：两边同时写会把命令行搅乱。 */
    this.shellLock = Promise.resolve()
  }

  #send(obj) {
    const line = `data: ${JSON.stringify(obj)}\n\n`
    for (const res of this.subs) res.write(line)
  }

  async open(session, connectionId, cols, rows) {
    const stream = await session.shell(cols, rows)
    const id = randomBytes(8).toString('hex')
    const t = {
      id,
      connectionId,
      stream,
      chunks: [],
      size: 0,
      total: 0,
      closed: false,
      /** 正在跑的一条代执行命令（同一时刻最多一条） */
      pending: null,
    }
    const onData = (b) => {
      const o = t.total
      t.total += b.length
      t.chunks.push(b)
      t.size += b.length
      while (t.size > MAX_BUFFER && t.chunks.length > 1) t.size -= t.chunks.shift().length
      this.#publish(t, b, o)
    }
    stream.on('data', onData)
    stream.stderr?.on('data', onData)
    stream.on('close', () => {
      // 链路断了：代执行的那条立刻以失败收场，别让调用方一直等下去。
      if (t.pending) t.pending.fail(new Error('终端连接已断开'))
      this.#end(t)
    })
    this.terms.set(id, t)
    return id
  }

  #publish(t, buf, offset) {
    const p = t.pending
    if (!p) {
      this.#send({ id: t.id, o: offset, d: buf.toString('base64') })
      return
    }
    const visible = (chunk) => {
      if (chunk) this.#send({ id: t.id, o: offset, d: Buffer.from(chunk, 'utf8').toString('base64') })
    }
    let rest = p.tail + buf.toString('utf8')
    p.tail = ''

    // 1. 回显：最多跨两段
    if (p.echoAt < p.echo.length) {
      const r = stripEcho(rest, p.echo.slice(p.echoAt))
      p.echoAt += r.matched ?? (r.pending ? rest.length : (r.matched ?? 0))
      rest = r.rest
      if (r.pending) {
        p.tail = ''
        return
      }
      p.echoAt = p.echo.length
    }

    // 2. 标记
    const openSeq = MARK_OPEN + p.nonce + BEL
    const closeSeq = MARK_CLOSE + p.nonce
    for (let guard = 0; guard < 4; guard++) {
      if (!p.inOutput) {
        const at = rest.indexOf(openSeq)
        if (at < 0) {
          const keep = Math.min(openSeq.length, rest.length)
          visible(rest.slice(0, rest.length - keep))
          p.tail = rest.slice(rest.length - keep)
          return
        }
        visible(rest.slice(0, at))
        p.inOutput = true
        rest = rest.slice(at + openSeq.length)
        continue
      }
      const at = rest.indexOf(closeSeq)
      if (at < 0) {
        const keep = Math.min(Math.max(closeSeq.length - 1, 0), rest.length)
        p.capture += rest.slice(0, rest.length - keep)
        p.tail = rest.slice(rest.length - keep)
        return
      }
      p.capture += rest.slice(0, at)
      // 收尾标记之后通常还跟着 ` <退出码>` + BEL，再后面才是提示符。把「数字 + BEL」
      // 一起交给 splitExitCode；BEL 之后的字节（提示符之类）照常送给页面。
      const after = rest.slice(at + closeSeq.length)
      const endOfRun = after.indexOf(BEL)
      if (endOfRun >= 0) {
        p.capture += after.slice(0, endOfRun)
        this.#finish(t, p, after.slice(endOfRun + 1))
      } else {
        p.capture += after
        this.#finish(t, p, '')
      }
      return
    }
  }

  #finish(t, p, after) {
    t.pending = null
    const raw = (p.capture + p.tail).replace(new RegExp(CR, 'g'), '')
    const { stdout, code } = splitExitCode(raw)
    p.resolve({ stdout, code })
    // 收尾标记之后的字节（提示符之类）照常显示
    if (after) this.#send({ id: t.id, o: t.total - Buffer.byteLength(after, 'utf8'), d: Buffer.from(after, 'utf8').toString('base64') })
  }

  #end(t) {
    if (t.closed) return
    t.closed = true
    this.#send({ id: t.id, closed: true })
    const timer = setTimeout(() => this.terms.delete(t.id), 60_000)
    timer.unref?.()
  }

  /** 把一个 HTTP 响应挂成订阅者，先回放每个终端缓存的输出。 */
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
      // 页面关掉后没人回来，就把终端收掉，不留孤儿 shell
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

  /** 终端当前是不是全屏程序（vim/top 之类）？是的话不能往里塞命令。 */
  #altScreen(t) {
    try {
      const tail = Buffer.concat(t.chunks).toString('latin1')
      const enter = tail.lastIndexOf(ESC + '[?1049h')
      const exit = tail.lastIndexOf(ESC + '[?1049l')
      const top = tail.lastIndexOf(ESC + '[?47h')
      const topExit = tail.lastIndexOf(ESC + '[?47l')
      return Math.max(enter, top) > Math.max(exit, topExit)
    } catch {
      return false
    }
  }

  #serial(fn) {
    const run = this.shellLock.then(fn, fn)
    this.shellLock = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  /**
   * 在用户的终端里跑一条命令，读回它的 stdout 与退出码。
   *
   * @param {string} id 终端 id
   * @param {string} command 单行命令
   * @param {{timeoutMs?: number}} [opts]
   * @returns {Promise<{stdout: string, code: number}>}
   */
  runInShell(id, command, opts = {}) {
    const cmd = String(command ?? '')
    if (cmd.includes(CR) || cmd.includes(LF)) {
      return Promise.reject(new Error("命令里不能有换行：终端一次只读一行，多行请用 bash -c '...'"))
    }
    if (!cmd.trim()) return Promise.reject(new Error('命令为空'))
    const timeoutMs = opts.timeoutMs ?? 120_000

    return this.#serial(
      () =>
        new Promise((resolve, reject) => {
          const t = this.terms.get(id)
          if (!t || t.closed) return reject(new Error('终端未打开或已关闭'))
          if (this.#altScreen(t)) {
            return reject(new Error('终端里正开着全屏程序（vim/top 之类），先在终端里退出它再执行命令'))
          }
          const nonce = randomBytes(6).toString('hex')
          const openMark = `printf '${MARK_OPEN}${nonce}${BEL}'`
          const closeMark = `printf '${MARK_CLOSE}${nonce} %s${BEL}' "$?"`
          const echo = `{ ${openMark}; ${cmd}; ${closeMark}; }`

          const pending = {
            nonce,
            echo,
            echoAt: 0,
            inOutput: false,
            capture: '',
            tail: '',
            resolve,
            reject,
            fail: null,
            timer: null,
          }
          const finish = pending.resolve
          pending.resolve = (v) => {
            clearTimeout(pending.timer)
            finish(v)
          }
          pending.fail = (err) => {
            if (t.pending !== pending) return
            t.pending = null
            clearTimeout(pending.timer)
            reject(err)
          }
          t.pending = pending
          // 先 Ctrl-U 清掉用户敲了半行的那一行，再把整行脚本写进去。
          t.stream.write(CTRL_U + echo + CR)

          pending.timer = setTimeout(() => {
            if (t.pending !== pending) return
            t.pending = null
            // 停止不是只放弃等待：把命令本身也掐掉，别让它继续在用户眼前跑。
            try {
              t.stream.write(CTRL_C)
            } catch {}
            reject(Object.assign(new Error(`命令运行 ${Math.round(timeoutMs / 1000)} 秒仍未结束，已发送 Ctrl-C`), { timedOut: true }))
          }, timeoutMs)
        })
    )
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
