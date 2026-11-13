import { ConnectionManager } from './connections.js'
import { SshSessionPool } from './ssh-session.js'
import { TerminalManager } from './terminals.js'
import { History } from './history.js'
import { gate, sanitizeOutput } from './gate.js'
import { audit } from './audit.js'
import * as sftpOps from './sftp.js'
import { parseSshConfig, parseLiteshell, isDuplicate } from './import.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRouter, BASE, ROUTES } from './routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const inject = ['tools', 'credentials', 'webServer']

/** 读文件时给模型的上限。再大应该下载到本地处理,而不是塞进上下文。 */
const MAX_READ_BYTES = 200_000
const DEFAULT_TIMEOUT_S = 120
const MAX_TIMEOUT_S = 3600

const text = (s) => [{ type: 'text', text: s }]
const renderJson = (_args, value) => text(JSON.stringify(value, null, 2))
const anySchema = { type: 'object' }

function failure(code, detail, suggestion, extra = {}) {
  return { ok: false, error_code: code, detail, suggestion, ...extra }
}

export function apply(ctx) {
  const connections = new ConnectionManager({ credentials: ctx.credentials })
  const pool = new SshSessionPool(connections)
  const terminals = new TerminalManager()
  const history = new History()

  /** 找连接并取得会话。失败时返回结构化错误而不是抛出,让模型看到 suggestion。 */
  async function open(exec, key) {
    const found = connections.resolve(key)
    if ('error' in found) {
      return { err: failure('unknown_connection', found.error, '先调用 ssh_list_connections 查看可用连接', { candidates: found.candidates }) }
    }
    const conn = found.conn
    if (conn.authType === 'password' && !(await connections.secretFor(conn))) {
      return { err: failure('needs_password', `${conn.name} 用密码认证,但还没有保存密码`, '请用户在 SSH 面板里编辑该连接并保存密码') }
    }
    try {
      const session = await pool.acquire(exec.agent, conn.id, undefined, () => {})
      return { conn, session }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (e && e.hostKeyChanged) {
        return { err: failure('host_key_changed', `${conn.name} 的主机密钥和已记录的不一致,已拒绝连接`, '请用户先确认服务器是否被重装或遭到中间人攻击') }
      }
      return { err: failure('connect_failed', `连不上 ${conn.name}: ${msg}`, '确认服务器可达、凭据有效') }
    }
  }

  const connectionParam = {
    type: 'string',
    description: '连接名(或 id)。用 ssh_list_connections 查看。',
  }

  const tools = [
    {
      name: 'ssh_list_connections',
      description: '列出用户已配置的 SSH 服务器连接。只返回名称、主机、用户名、认证方式,不含任何密码。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: { schema: anySchema, render: renderJson },
      async execute() {
        return { ok: true, connections: await connections.listView() }
      },
    },
    {
      name: 'ssh_exec',
      description:
        '在远程服务器上执行一条 shell 命令,返回 stdout、stderr 和退出码。命令走独立 SSH 通道,不影响用户打开的终端。' +
        '只读命令直接运行;会删除或覆盖数据的命令需要用户确认。长任务请用 nohup/setsid 放到后台。',
      parameters: {
        type: 'object',
        properties: {
          connection: connectionParam,
          command: { type: 'string', description: '要执行的命令。' },
          timeout_seconds: { type: 'number', description: `超时秒数,默认 ${DEFAULT_TIMEOUT_S},最大 ${MAX_TIMEOUT_S}。` },
        },
        required: ['connection', 'command'],
        additionalProperties: false,
      },
      output: { schema: anySchema, render: renderJson },
      async execute(args, exec) {
        const { connection, command } = args
        if (!command || !String(command).trim()) return failure('bad_args', '命令为空', '提供要执行的命令')
        const opened = await open(exec, connection)
        if (opened.err) return opened.err
        const secs = Math.min(Math.max(Number(args.timeout_seconds) || DEFAULT_TIMEOUT_S, 1), MAX_TIMEOUT_S)
        const t0 = Date.now()
        const r = await opened.session.exec(command, secs * 1000)
        const ms = Date.now() - t0
        audit(opened.conn.name, 'exec', command, r.timedOut ? 'timeout' : r.code, ms)
        if (r.timedOut) {
          return failure('timeout', `命令运行 ${secs} 秒仍未结束,已关闭通道`, '远端进程可能还在运行;长任务用 nohup/setsid 放后台,或调大 timeout_seconds', {
            partial_stdout: sanitizeOutput(command, r.stdout),
            partial_stderr: sanitizeOutput(command, r.stderr),
          })
        }
        return {
          ok: true,
          stdout: sanitizeOutput(command, r.stdout),
          stderr: sanitizeOutput(command, r.stderr),
          code: r.code,
          ms,
        }
      },
    },
    {
      name: 'ssh_list_files',
      description: '通过 SFTP 列出远程目录。',
      parameters: {
        type: 'object',
        properties: { connection: connectionParam, path: { type: 'string', description: '远程目录路径,默认 "."。' } },
        required: ['connection'],
        additionalProperties: false,
      },
      output: { schema: anySchema, render: renderJson },
      async execute(args, exec) {
        const opened = await open(exec, args.connection)
        if (opened.err) return opened.err
        const path = args.path || '.'
        try {
          const sftp = await opened.session.sftp()
          const entries = await sftpOps.listDir(sftp, path)
          audit(opened.conn.name, 'ls', path, 0, 0)
          return { ok: true, path, entries }
        } catch (e) {
          return failure('sftp_error', e instanceof Error ? e.message : String(e), '检查路径是否存在、权限是否足够')
        }
      },
    },
    {
      name: 'ssh_read_file',
      description: `通过 SFTP 读取远程文本文件,最多 ${MAX_READ_BYTES} 字节。更大的文件请用 ssh_exec 配合 head/tail/grep。`,
      parameters: {
        type: 'object',
        properties: { connection: connectionParam, path: { type: 'string', description: '远程文件路径。' } },
        required: ['connection', 'path'],
        additionalProperties: false,
      },
      output: { schema: anySchema, render: renderJson },
      async execute(args, exec) {
        const opened = await open(exec, args.connection)
        if (opened.err) return opened.err
        try {
          const sftp = await opened.session.sftp()
          const st = await sftpOps.stat(sftp, args.path)
          if (st.isDir) return failure('is_directory', `${args.path} 是目录`, '改用 ssh_list_files')
          if (st.size > MAX_READ_BYTES) {
            return failure('too_large', `${args.path} 有 ${st.size} 字节,超过 ${MAX_READ_BYTES}`, '用 ssh_exec 执行 head/tail/grep 读取需要的部分')
          }
          const buf = await sftpOps.readFile(sftp, args.path)
          if (buf.includes(0)) return failure('binary_file', `${args.path} 看起来是二进制文件`, '不要读取二进制内容')
          audit(opened.conn.name, 'read_file', args.path, 0, 0)
          return { ok: true, path: args.path, size: buf.length, text: buf.toString('utf8') }
        } catch (e) {
          return failure('sftp_error', e instanceof Error ? e.message : String(e), '检查路径是否存在、权限是否足够')
        }
      },
    },
    {
      name: 'ssh_write_file',
      description: '通过 SFTP 写入远程文本文件。会覆盖同名文件,每次都需要用户确认。先写临时文件再改名,中途断线不会截断原文件。',
      parameters: {
        type: 'object',
        properties: {
          connection: connectionParam,
          path: { type: 'string', description: '远程文件路径。' },
          content: { type: 'string', description: '完整的新文件内容。' },
        },
        required: ['connection', 'path', 'content'],
        additionalProperties: false,
      },
      output: { schema: anySchema, render: renderJson },
      async execute(args, exec) {
        const opened = await open(exec, args.connection)
        if (opened.err) return opened.err
        try {
          const sftp = await opened.session.sftp()
          const tmp = `${args.path}.dsh-ssh.tmp`
          await sftpOps.writeFile(sftp, tmp, Buffer.from(args.content, 'utf8'))
          try {
            const old = await sftpOps.stat(sftp, args.path)
            await new Promise((res, rej) => sftp.chmod(tmp, old.mode, (e) => (e ? rej(e) : res())))
          } catch {
            // 目标不存在:新文件用默认权限
          }
          await sftpOps.rename(sftp, tmp, args.path).catch(async () => {
            // 部分服务器的 rename 不允许覆盖已存在文件:先删后改
            await sftpOps.unlink(sftp, args.path)
            await sftpOps.rename(sftp, tmp, args.path)
          })
          audit(opened.conn.name, 'write_file', args.path, 0, 0)
          return { ok: true, path: args.path, bytes: Buffer.byteLength(args.content, 'utf8') }
        } catch (e) {
          return failure('sftp_error', e instanceof Error ? e.message : String(e), '检查目录是否存在、权限是否足够')
        }
      },
    },
  ]

  for (const def of tools) {
    ctx.effect(() => ctx.tools.register(def))
  }

  // 审批:只读自动通过,删改数据和高危命令要用户确认。
  // 判定完全由 gate.js 的纯函数决定,模型没有办法给自己的请求定级。
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!exec.name.startsWith('ssh_')) return next()
    const command = exec.name === 'ssh_exec' ? String(exec.arguments?.command ?? '') : ''
    const verdict = gate(exec.name, command)
    if (verdict.auto) return next()
    return {
      kind: 'ask',
      reason: `[${verdict.risk}] ${verdict.reason}`,
      displayReason: { en: `SSH: ${verdict.reason} (${verdict.risk})`, zh: `SSH:${verdict.reason}(${verdict.risk})` },
    }
  })

  // 插件卸载或重载时,关闭所有 SSH 连接和终端
  ctx.effect(() => () => {
    terminals.closeAll()
    pool.closeAll()
  })

  // HTTP 路由:每个接口单独注册为 exact 路由(webServer 只有 exact / prefix 两种)
  ctx.inject(['webServer'], (owner) => {
    const handle = createRouter({ connections, terminals, pool, history })
    for (const route of ROUTES) {
      owner.effect(() =>
        owner.webServer.register({
          kind: 'exact',
          path: BASE + route,
          handler: (req, res) => handle(route, req, res),
        })
      )
    }
  })
}
