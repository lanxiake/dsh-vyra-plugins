/**
 * SSH 会话管理器:基于 ssh2,提供 exec、SFTP 操作,复用连接。
 */
import { Client } from 'ssh2'
import { readFileSync, existsSync } from 'node:fs'
import { bindAddress } from './localnet.js'

const MAX_OUTPUT = 200_000 // 输出截断阈值

export class SshSession {
  /**
   * @param {object} conn 连接档案
   * @param {string} secret 密码或私钥口令
   * @param {(keyBuf: Buffer) => { ok: boolean, fingerprint: string, changed: boolean }} verifyHostKey
   * @param {(level: string, text: string) => void} log
   */
  constructor(conn, secret, verifyHostKey, log = () => {}) {
    this.conn = conn
    this.secret = secret
    this.verifyHostKey = verifyHostKey
    this.log = log
    this.client = new Client()
    this.ready = false
    this.error = null
    this.sftpWrapper = null
  }

  /** 连接选项:认证 + 主机验证 + 本机出口 */
  #opts() {
    const c = this.conn
    // 每次连接现查:VPN 重拨换了地址也跟得上。取不到就只警告,不绑定、不失败。
    const source = bindAddress(c)
    const opts = {
      host: c.host,
      port: c.port || 22,
      username: c.username,
      readyTimeout: 20_000,
      keepaliveInterval: 30_000,
      ...(source ? { localAddress: source } : {}),
      hostVerifier: (keyBuf) => {
        const check = this.verifyHostKey(keyBuf)
        if (!check.ok) {
          this.hostKeyChanged = true
          this.log('error', `主机密钥已变: ${check.fingerprint}`)
        } else if (check.first) {
          this.log('info', `首次连接,信任指纹: ${check.fingerprint}`)
        }
        return check.ok
      },
      debug: (msg) => this.log('debug', msg),
    }
    if (c.localIface && !source) {
      this.log('warn', `本机网卡 ${c.localIface} 现在没有地址(VPN 断了?),这次不绑定出口`)
    }

    const pass = this.secret
    if (c.authType === 'password') {
      opts.password = pass
      if (!pass) this.log('warn', '密码为空,尝试空密码认证')
    } else if (c.authType === 'key') {
      const path = c.privateKeyPath
      if (!path || !existsSync(path)) throw new Error(`私钥文件不存在: ${path ?? '(未设置)'}`)
      opts.privateKey = readFileSync(path)
      if (pass) opts.passphrase = pass
    } else if (c.authType === 'agent') {
      opts.agent = process.env.SSH_AUTH_SOCK
    }
    return opts
  }

  /** 建立连接,返回 Promise,resolve 表示 ready */
  connect() {
    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        this.ready = true
        this.log('info', '连接就绪')
        resolve()
      })
      this.client.on('error', (err) => {
        if (this.hostKeyChanged) err.hostKeyChanged = true
        this.error = err.message
        this.log('error', err.message)
        reject(err)
      })
      this.client.on('close', () => {
        this.ready = false
        this.log('info', '连接关闭')
      })

      try {
        this.client.connect(this.#opts())
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * 独立通道执行命令(不碰用户的 shell)
   * @param {string} command
   * @param {number} timeoutMs 0 = 无限等待
   * @returns {Promise<{ stdout: string, stderr: string, code: number, timedOut: boolean }>}
   */
  exec(command, timeoutMs = 120_000, stdin) {
    return new Promise((resolve, reject) => {
      if (!this.ready) return reject(new Error('连接未就绪'))
      this.client.exec(command, (err, stream) => {
        if (err) return reject(err)
        if (stdin !== undefined) stream.end(stdin)
        let stdout = ''
        let stderr = ''
        let code = -1
        let done = false
        let timer

        const finish = (timedOut) => {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve({
            stdout: stdout.length > MAX_OUTPUT ? stdout.slice(-MAX_OUTPUT) : stdout,
            stderr: stderr.length > MAX_OUTPUT ? stderr.slice(-MAX_OUTPUT) : stderr,
            code,
            timedOut,
          })
        }

        stream.on('data', (chunk) => (stdout += chunk.toString('utf8')))
        stream.stderr.on('data', (chunk) => (stderr += chunk.toString('utf8')))
        stream.on('exit', (c) => {
          if (typeof c === 'number') code = c
        })
        stream.on('close', () => finish(false))

        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            try {
              stream.close()
            } catch {}
            finish(true)
          }, timeoutMs)
        }
      })
    })
  }

  /** 打开交互式 shell 通道(给界面里的终端用) */
  shell(cols, rows) {
    return new Promise((resolve, reject) => {
      if (!this.ready) return reject(new Error('连接未就绪'))
      this.client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => (err ? reject(err) : resolve(stream)))
    })
  }

  /** 获取 SFTP 会话(复用) */
  sftp() {
    if (this.sftpWrapper) return Promise.resolve(this.sftpWrapper)
    return new Promise((resolve, reject) => {
      this.client.sftp((err, wrapper) => {
        if (err) return reject(err)
        this.sftpWrapper = wrapper
        resolve(wrapper)
      })
    })
  }

  close() {
    try {
      this.client.end()
    } catch {}
  }
}

/**
 * 会话池:按 Agent + Connection 复用
 */
export class SshSessionPool {
  constructor(connectionManager) {
    this.connectionManager = connectionManager
    /** Map<agentId, Map<connectionId, SshSession>> */
    this.pool = new Map()
  }

  /**
   * 获取或创建会话
   * @param {object} agent Agent 对象 { id: ... }
   * @param {string} connId 连接 id
   * @param {string} [oneTimeSecret] 一次性密码(覆盖存储的凭据)
   * @param {(level: string, text: string) => void} log
   */
  async acquire(agent, connId, oneTimeSecret, log) {
    const agentMap = this.pool.get(agent.id) || new Map()
    this.pool.set(agent.id, agentMap)

    const existing = agentMap.get(connId)
    if (existing && existing.ready) return existing

    // 同一个连接同时来了几个请求(终端、监控、文件面板)时,共用一次握手
    this.inflight ??= new Map()
    const key = `${agent.id}\0${connId}`
    if (this.inflight.has(key)) return this.inflight.get(key)

    const job = (async () => {
      // 每次现取连接:界面上刚改过本机网卡,不该等重连才生效。
      const conn = this.connectionManager.get(connId)
      if (!conn) throw new Error(`连接不存在: ${connId}`)
      const secret = await this.connectionManager.secretFor(conn, oneTimeSecret)
      const session = new SshSession(
        conn,
        secret,
        (keyBuf) => this.connectionManager.checkHostKey(conn, keyBuf),
        log
      )
      await session.connect()
      agentMap.set(connId, session)
      return session
    })().finally(() => this.inflight.delete(key))
    this.inflight.set(key, job)
    return job
  }

  /** 关闭全部会话(插件卸载时调用) */
  closeAll() {
    for (const agentId of [...this.pool.keys()]) this.closeAgent(agentId)
  }

  /** 关闭 Agent 的所有会话 */
  closeAgent(agentId) {
    const agentMap = this.pool.get(agentId)
    if (!agentMap) return
    for (const session of agentMap.values()) session.close()
    this.pool.delete(agentId)
  }

  /** 关闭指定会话 */
  close(agentId, connId) {
    const agentMap = this.pool.get(agentId)
    if (!agentMap) return
    const session = agentMap.get(connId)
    if (session) {
      session.close()
      agentMap.delete(connId)
    }
  }
}
