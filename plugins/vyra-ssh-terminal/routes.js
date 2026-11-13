/**
 * 界面用的 HTTP 接口。webServer 只有 exact / prefix 两种路由,这里每个接口注册成一条 exact,
 * 变量(连接、路径、终端 id)放在查询参数或请求体里。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { parseSshConfig, parseLiteshell, isDuplicate } from './import.js'
import * as sftpOps from './sftp.js'
import { MONITOR_SCRIPT, parseMonitor } from './monitor.js'
import { localInterfaces } from './localnet.js'
import { exportBundle, importBundle } from './backup.js'
import { parseFinalshell } from './finalshell.js'
import { setupPasswordless } from './passwordless.js'

export const BASE = '/api/ssh-terminal/'

export const ROUTES = [
  'tree', 'upsert', 'delete', 'duplicate', 'move',
  'folder/save', 'folder/delete',
  'import/ssh-config', 'import/liteshell', 'import/file',
  'export',
  'net/interfaces', 'passwordless',
  'terminal/open', 'terminal/events', 'terminal/input', 'terminal/resize', 'terminal/close',
  'monitor', 'history',
  'files/list', 'files/download', 'files/upload', 'files/mkdir', 'files/rename', 'files/delete',
  'xterm.js', 'xterm.css', 'addon-fit.js', 'addon-search.js',
]

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), 'vendor')
const MAX_BODY = 1 << 20
const ASSETS = {
  'xterm.js': 'application/javascript; charset=utf-8',
  'xterm.css': 'text/css; charset=utf-8',
  'addon-fit.js': 'application/javascript; charset=utf-8',
  'addon-search.js': 'application/javascript; charset=utf-8',
}

/** 界面自己的 SSH 连接池分区,和 Agent 工具的连接互不干扰。 */
const UI = { id: 'ui' }

/** 备份文件里的私钥解到这个目录下,和档案文件同一个数据目录。 */
const keysDir = () => join(dirname(stateFile()), 'ssh-terminal', 'keys')

const httpError = (status, message, code) => Object.assign(new Error(message), { status, code })

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw httpError(413, '请求体过大')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw httpError(400, '请求体不是有效的 JSON')
  }
}

export function createRouter({ connections, terminals, pool, history }) {
  const json = (res, code, value) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(value))
  }

  const find = (key) => {
    const found = connections.resolve(String(key ?? ''))
    if ('error' in found) throw httpError(404, found.error, 'unknown_connection')
    return found.conn
  }

  /**
   * 取得连接会话。缺密码或口令、认证失败时返回 428,界面据此弹出输入框。
   * 临时输入的秘密只在连接成功之后才按用户选择保存。
   */
  async function session(conn, secret, remember) {
    if (conn.authType === 'password' && !(await connections.secretFor(conn, secret))) {
      throw httpError(428, `「${conn.name}」还没有保存密码`, 'needs_secret')
    }
    let s
    try {
      s = await pool.acquire(UI, conn.id, secret || undefined, () => {})
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (e && e.hostKeyChanged) {
        throw httpError(409, `「${conn.name}」的主机密钥与已记录的不一致,已拒绝连接。若服务器确实重装过,请先删除再重新添加这条连接`, 'host_key_changed')
      }
      if (conn.authType === 'key' && /passphrase|encrypted/i.test(msg)) {
        throw httpError(428, `「${conn.name}」的私钥有口令`, 'needs_secret')
      }
      if (e && e.level === 'client-authentication' && conn.authType !== 'agent') {
        throw httpError(428, `「${conn.name}」认证失败,请重新输入`, 'auth_failed')
      }
      throw httpError(502, `连不上「${conn.name}」:${msg}`, 'connect_failed')
    }
    if (secret && remember) await connections.rememberSecret(conn, secret)
    return s
  }

  async function importFrom(parse, req, res) {
    if (req.method === 'GET') {
      const existing = connections.list()
      return json(res, 200, parse().map((it) => ({ ...it, exists: isDuplicate(existing, it) })))
    }
    const body = await readBody(req)
    let imported = 0
    for (const it of parse()) {
      if (Array.isArray(body.names) && !body.names.includes(it.name)) continue
      if (isDuplicate(connections.list(), it)) continue
      const { folder, ...fields } = it
      await connections.upsert({ ...fields, folderId: connections.ensureFolder(folder) })
      imported++
    }
    connections.persist()
    return json(res, 200, { imported })
  }

  return async function handle(route, req, res) {
    try {
      const q = new URL(req.url, 'http://localhost').searchParams
      const post = req.method === 'POST'
      if (post && req.headers['sec-fetch-site'] === 'cross-site') throw httpError(403, '来源无效')

      if (route in ASSETS) {
        if (req.method !== 'GET') throw httpError(405, '请求方法无效')
        res.writeHead(200, { 'content-type': ASSETS[route], 'cache-control': 'public, max-age=3600' })
        return res.end(readFileSync(join(VENDOR, route)))
      }

      if (route === 'tree' && req.method === 'GET') return json(res, 200, await connections.tree())

      if (route === 'upsert' && post) {
        const body = await readBody(req)
        const c = body.connection
        if (!c || !String(c.host ?? '').trim() || !String(c.username ?? '').trim()) {
          throw httpError(400, '主机和用户名不能为空')
        }
        if (!String(c.name ?? '').trim()) c.name = `${c.username}@${c.host}`
        const saved = await connections.upsert(c, body.password, body.keyPassphrase)
        return json(res, 200, { id: saved.id })
      }
      if (route === 'delete' && post) {
        const { id } = await readBody(req)
        return json(res, 200, { ok: await connections.remove(id) })
      }
      if (route === 'duplicate' && post) {
        const { id } = await readBody(req)
        return json(res, 200, { id: (await connections.duplicate(id)).id })
      }
      if (route === 'move' && post) {
        const { id, folderId } = await readBody(req)
        connections.move(id, folderId)
        return json(res, 200, { ok: true })
      }
      if (route === 'folder/save' && post) {
        return json(res, 200, connections.saveFolder(await readBody(req)))
      }
      if (route === 'folder/delete' && post) {
        const { id } = await readBody(req)
        return json(res, 200, { ok: await connections.removeFolder(id) })
      }
      if (route === 'import/ssh-config') return await importFrom(parseSshConfig, req, res)
      if (route === 'import/liteshell') return await importFrom(parseLiteshell, req, res)

      // 导入文件:liteshell 备份 / FinalShell。路径来自浏览器里的文件选择,只在 Host 侧读。
      if (route === 'import/file' && post) {
        const body = await readBody(req)
        let parsed
        let kind = body.kind
        if (!kind) {
          try {
            kind = JSON.parse(readFileSync(body.path, 'utf8')).kind === 'liteshell-backup' ? 'liteshell' : 'finalshell'
          } catch (e) {
            throw httpError(400, `读不了这个文件:${e.message}`)
          }
        }
        if (kind === 'liteshell') {
          // 口令不对会在写任何数据之前抛错,这里不会留下半截导入。
          const unpacked = importBundle(JSON.parse(readFileSync(body.path, 'utf8')), keysDir(), body.passphrase || '')
          parsed = {
            folders: unpacked.folders,
            connections: unpacked.connections.map((c) => ({ ...c, keySecret: c.keyRef ? unpacked.keyPasswords[c.keyRef] : undefined })),
            secrets: unpacked.passwords,
            missingKeys: unpacked.missingKeys,
            kind: 'liteshell',
          }
        } else {
          parsed = { ...parseFinalshell(body.path, body.folderId || null), kind: 'finalshell' }
        }
        const r = await connections.importInto(parsed, { parentId: body.folderId || null })
        return json(res, 200, {
          kind: parsed.kind,
          imported: r.connections,
          folders: r.folders,
          skipped: r.skipped,
          missingKeys: parsed.missingKeys ?? 0,
          warnings: parsed.warnings ?? [],
          needsPassword: parsed.needsPassword ?? 0,
        })
      }

      // 导出:产出与 liteshell 同结构的备份 JSON,直接作为下载响应体交给浏览器。
      if (route === 'export' && post) {
        const body = await readBody(req)
        const scope = body.scope || 'all'
        if (scope !== 'all' && !body.id) throw httpError(400, '缺少导出对象')
        const onlyIds = scope === 'connection' ? [body.id] : undefined
        if (scope === 'connection' && !connections.get(body.id)) throw httpError(404, '连接不存在', 'unknown_connection')
        if (scope === 'folder' && !connections.folders.has(body.id)) throw httpError(404, '文件夹不存在')
        const passphrase = String(body.passphrase ?? '')
        const state = { connections: connections.list(), folders: [...connections.folders.values()] }
        const { secrets, keySecrets } = passphrase
          ? await connections.secretsFor(onlyIds ?? state.connections.map((c) => c.id))
          : { secrets: {}, keySecrets: {} }
        const { bundle, missing, passwords } = exportBundle(state, {
          onlyIds,
          folderRoot: scope === 'folder' ? body.id : undefined,
          secrets,
          keySecrets,
          passphrase,
        })
        const name = scope === 'all' ? 'ssh-terminal-backup' : scope === 'folder' ? `folder-${body.id}` : `conn-${body.id}`
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${name}.json`)}`,
          'cache-control': 'no-store',
        })
        return res.end(JSON.stringify(bundle, null, 2))
      }

      // 本机网卡列表:连接编辑对话框的下拉项。
      if (route === 'net/interfaces' && req.method === 'GET') {
        return json(res, 200, { interfaces: localInterfaces() })
      }

      // 配置本机免密登录。浏览器里用户主动点的,不经 Agent 工具;密码不返回给页面。
      if (route === 'passwordless' && post) {
        const body = await readBody(req)
        const conn = find(body.connection)
        // 服务器可能还在常见端口上,别名冲突由 Host 侧看本机 config 决定
        const oneShot = body.secret || (await connections.secretFor(conn))
        if (conn.authType === 'password' && !oneShot) throw httpError(428, `「${conn.name}」还没有保存密码`, 'needs_secret')
        let r
        try {
          r = await setupPasswordless(conn, oneShot)
        } catch (e) {
          throw httpError(502, `配置免密登录失败:${e instanceof Error ? e.message : String(e)}`, 'passwordless_failed')
        }
        // 刚证明这个密码是对的,用户可以顺手存下来
        if (body.secret && body.remember) await connections.rememberSecret(conn, body.secret)
        return json(res, 200, r)
      }

      // 终端
      if (route === 'terminal/open' && post) {
        const body = await readBody(req)
        const conn = find(body.connection)
        const s = await session(conn, body.secret, body.remember)
        const id = await terminals.open(s, conn.id, clampInt(body.cols, 80, 20, 500), clampInt(body.rows, 24, 5, 200))
        return json(res, 200, { id })
      }
      if (route === 'terminal/events' && req.method === 'GET') return terminals.subscribe(res)
      if (route === 'terminal/input' && post) {
        const { id, data } = await readBody(req)
        if (!terminals.input(id, Buffer.from(String(data ?? ''), 'base64'))) throw httpError(404, '终端已关闭', 'terminal_gone')
        return json(res, 200, { ok: true })
      }
      if (route === 'terminal/resize' && post) {
        const { id, cols, rows } = await readBody(req)
        terminals.resize(id, clampInt(cols, 80, 2, 500), clampInt(rows, 24, 1, 200))
        return json(res, 200, { ok: true })
      }
      if (route === 'terminal/close' && post) {
        const { id } = await readBody(req)
        terminals.close(id)
        return json(res, 200, { ok: true })
      }

      // 监控
      if (route === 'monitor' && post) {
        const body = await readBody(req)
        const s = await session(find(body.connection))
        const r = await s.exec('sh -s', 30_000, MONITOR_SCRIPT)
        if (r.timedOut) throw httpError(504, '监控脚本超时')
        return json(res, 200, parseMonitor(r.stdout))
      }

      // 命令历史
      if (route === 'history') {
        if (req.method === 'GET') return json(res, 200, { commands: history.get(find(q.get('connection')).id) })
        if (post) {
          const body = await readBody(req)
          history.add(find(body.connection).id, body.command)
          return json(res, 200, { ok: true })
        }
      }

      // 文件
      if (route.startsWith('files/')) {
        const body = post && route !== 'files/upload' ? await readBody(req) : {}
        const conn = find(post && route !== 'files/upload' ? body.connection : q.get('connection'))
        const sftp = await (await session(conn)).sftp()

        if (route === 'files/list' && req.method === 'GET') {
          const path = await sftpOps.realpath(sftp, q.get('path') || '.')
          const entries = await sftpOps.listDir(sftp, path)
          entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
          return json(res, 200, { path, entries })
        }
        if (route === 'files/download' && req.method === 'GET') {
          const path = q.get('path') || ''
          const st = await sftpOps.stat(sftp, path)
          if (st.isDir) throw httpError(400, '不能下载目录')
          const name = path.split('/').pop() || 'download'
          res.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-length': st.size,
            'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
            'cache-control': 'no-store',
          })
          return await pipeline(sftp.createReadStream(path), res)
        }
        if (route === 'files/upload' && post) {
          const path = q.get('path') || ''
          if (!path || path.endsWith('/')) throw httpError(400, '缺少目标路径')
          await pipeline(req, sftp.createWriteStream(path))
          return json(res, 200, { ok: true })
        }
        if (route === 'files/mkdir' && post) {
          await sftpOps.mkdir(sftp, body.path)
          return json(res, 200, { ok: true })
        }
        if (route === 'files/rename' && post) {
          await sftpOps.rename(sftp, body.from, body.to)
          return json(res, 200, { ok: true })
        }
        if (route === 'files/delete' && post) {
          if (!body.path || body.path === '/') throw httpError(400, '拒绝删除根目录')
          if (body.dir) await sftpOps.removeRecursive(sftp, body.path)
          else await sftpOps.unlink(sftp, body.path)
          return json(res, 200, { ok: true })
        }
      }

      throw httpError(405, '请求方法无效')
    } catch (e) {
      if (!res.headersSent) {
        json(res, e.status || 500, { error: e instanceof Error ? e.message : String(e), code: e.code })
      } else {
        res.destroy?.()
      }
    }
  }
}

function clampInt(v, def, min, max) {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}
