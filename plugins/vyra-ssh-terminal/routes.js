/**
 * 界面用的 HTTP 接口。WebServer 只有 exact / prefix 两种路由，这里每个接口注册成一条
 * exact，变量（连接、路径、终端 id）放在查询参数或请求体里。
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { parseSshConfig, parseLiteshell, isDuplicate } from './import.js'
import * as sftpOps from './sftp.js'
import { MONITOR_SCRIPT, parseMonitor } from './monitor.js'
import { probeLatency } from './latency.js'
import { localInterfaces } from './localnet.js'
import { exportBundle, importBundle } from './backup.js'
import { parseFinalshell } from './finalshell.js'
import { setupPasswordless } from './passwordless.js'
import { AiSession, pickModel, listModels, readHistory as readAiHistory, writeAiHistory, createSpill, createReadOutput } from './ai.js'
import { createTools } from './agent-tools.js'

export const BASE = '/api/ssh-terminal/'

export const ROUTES = [
  'tree', 'upsert', 'delete', 'duplicate', 'move',
  'folder/save', 'folder/delete',
  'import/ssh-config', 'import/liteshell', 'import/file',
  'export', 'export/preview', 'export/save', 'export/reveal',
  'net/interfaces', 'passwordless',
  'terminal/open', 'terminal/events', 'terminal/input', 'terminal/resize', 'terminal/close', 'terminal/run',
  'monitor', 'history',
  'files/list', 'files/download', 'files/upload', 'files/mkdir', 'files/rename', 'files/delete', 'files/read', 'files/write', 'files/chmod',
  'ai/models', 'ai/send', 'ai/stop', 'ai/approve', 'ai/history', 'ai/events', 'ai/new', 'ai/restore', 'ai/delete',
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

export function createRouter({ connections, terminals, pool, history, ctx: harness }) {
  const json = (res, code, value) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(value))
  }

  /** 宿主的模型服务与"当前选择"：都可能在、也可能不在（老版本宿主）。 */
  const ctxOf = () => harness ?? null

  /** AI 会话：一个连接一条，界面上关掉面板就丢。 */
  const aiSessions = new Map()
  /** SSE 订阅者：所有 AI 事件从这里出去（一条流，和终端输出同一个思路）。 */
  const aiSubs = new Set()
  const aiSpill = createSpill()
  const aiReadOutput = createReadOutput()

  const sendAi = (obj) => {
    const line = `data: ${JSON.stringify(obj)}\n\n`
    for (const res of aiSubs) res.write(line)
  }

  function subscribeAiEvents(res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.write(':ok\n\n')
    aiSubs.add(res)
    const beat = setInterval(() => res.write(':hb\n\n'), 20_000)
    res.on('close', () => {
      clearInterval(beat)
      aiSubs.delete(res)
    })
  }

  /** 取（必要时新建）某个连接的 AI 会话。 */
  async function aiSessionFor(connectionId) {
    const existing = aiSessions.get(connectionId)
    if (existing) return existing
    const conn = find(connectionId)
    const model = await pickModel(ctxOf()?.llm, ctxOf()?.currentModel?.())
    if (!model) throw httpError(409, 'DSH 里还没有可用的模型：先在「设置 → 模型」里选一个，再回来用 AI', 'no_model')
    const tools = createTools({
      connection: conn,
      session: () => session(conn),
      terminal: () => {
        // 找到这个连接的界面终端（AI 的 exec 打在用户看得见的那个终端里）
        const list = [...(terminals.terms?.values?.() ?? [])]
        return list.find((t) => t.connectionId === conn.id && !t.closed) ?? null
      },
      runInShell: (id, command, opts) => terminals.runInShell(id, command, opts),
      listConnections: () => connections.list().map((c) => `${c.name} · ${c.username}@${c.host}:${c.port || 22}`),
      spill: aiSpill,
      readOutput: aiReadOutput,
    })
    const session_ = new AiSession({
      id: connectionId,
      connectionId,
      llm: ctxOf()?.llm,
      model,
      tools,
      emit: sendAi,
      spill: aiSpill,
    })
    aiSessions.set(connectionId, session_)
    return session_
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

      // 导出:产出与 liteshell 同结构的备份 JSON。
      //
      // 同时接受 GET 与 POST:带口令的一律 POST(口令不进 URL / 历史 / 访问日志),
      // 不带口令的 GET 也照做——早先只认 POST,而界面上的「不带密码导出」恰恰用的是
      // GET,于是那条路一直是 405。响应体之外还回 x-export-name / x-export-scope /
      // x-export-passwords 三个头,界面据此报告「导了什么、落在哪」。
      if (route === 'export' && (post || req.method === 'GET')) {
        const body = post ? await readBody(req) : {}
        const scope = String(body.scope ?? q.get('scope') ?? 'all')
        const id = String(body.id ?? q.get('id') ?? '')
        const passphrase = String(body.passphrase ?? q.get('passphrase') ?? '')
        if (scope !== 'all' && !id) throw httpError(400, '缺少导出对象', 'bad_args')
        const onlyIds = scope === 'connection' ? [id] : undefined
        const target = scope === 'connection' ? connections.get(id) : scope === 'folder' ? connections.folders.get(id) : null
        if (scope === 'connection' && !target) throw httpError(404, '连接不存在', 'unknown_connection')
        if (scope === 'folder' && !target) throw httpError(404, '文件夹不存在', 'unknown_folder')

        const state = { connections: connections.list(), folders: [...connections.folders.values()] }
        const { secrets, keySecrets } = passphrase
          ? await connections.secretsFor(onlyIds ?? state.connections.map((c) => c.id))
          : { secrets: {}, keySecrets: {} }
        const { bundle, missing, passwords } = exportBundle(state, {
          onlyIds,
          folderRoot: scope === 'folder' ? id : undefined,
          secrets,
          keySecrets,
          passphrase,
        })
        // 文件名用用户认得的东西:整份是备份名,单条 / 单个文件夹用它们自己的名字,
        // 落盘之后光看文件名就知道是哪一份。
        const base = scope === 'all' ? 'ssh-terminal-backup' : String(target?.name ?? 'export')
        const name = `${safeFileName(base)}-${stamp()}.json`
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
          'cache-control': 'no-store',
          'x-export-name': encodeURIComponent(name),
          'x-export-scope': scope,
          'x-export-connections': String(bundle.connections?.length ?? 0),
          'x-export-keys': String(bundle.keys?.length ?? 0),
          'x-export-passwords': String(passwords),
          'x-export-missing': String(missing.length),
        })
        // 正文仍然是纯备份 JSON（与 liteshell 的一份文件逐字段兼容），上面那几个头是给
        // 界面的附加信息。界面的 fetch 自己认头，正文不需要再包一层信封。
        return res.end(JSON.stringify(bundle, null, 2))
      }

      // 导出前的规模预览:界面上先说清「会导出几条、几个私钥、带不带密码」,
      // 而不是等文件下完了再猜它是不是导多了。
      if (route === 'export/preview' && req.method === 'GET') {
        const scope = String(q.get('scope') ?? 'all')
        const id = String(q.get('id') ?? '')
        const state = { connections: connections.list(), folders: [...connections.folders.values()] }
        const target = scope === 'connection' ? connections.get(id) : scope === 'folder' ? connections.folders.get(id) : null
        if (scope !== 'all' && !target) throw httpError(404, '导出对象不存在')
        const onlyIds = scope === 'connection' ? [id] : undefined
        const { bundle } = exportBundle(state, {
          onlyIds,
          folderRoot: scope === 'folder' ? id : undefined,
        })
        // 数一数「导出带上口令之后,有几条连接会带着密码走」——这正是用户选口令时
        // 真正想知道的那个数,不是私钥文件的个数。
        const scopeIds = bundle.connections
          .map((c) => state.connections.find((x) => x.name === c.name && x.host === c.host)?.id)
          .filter(Boolean)
        const { secrets } = await connections.secretsFor(scopeIds)
        return json(res, 200, {
          scope,
          name: String(target?.name ?? '全部连接'),
          connections: bundle.connections.length,
          folders: bundle.folders.length,
          keys: bundle.keys.length,
          passwords: Object.keys(secrets).length,
        })
      }

      // 导出「直接落到磁盘」：浏览器只能把文件塞进默认下载目录并默默结束，用户不知道
      // 东西去了哪。这里由 Host 写到你指定的目录（默认「下载」文件夹），再把绝对路径
      // 回给界面，界面据此明确告诉用户落点，并可一键打开所在文件夹。
      if (route === 'export/save' && post) {
        const body = await readBody(req)
        const scope = String(body.scope ?? 'all')
        const id = String(body.id ?? '')
        const passphrase = String(body.passphrase ?? '')
        if (scope !== 'all' && !id) throw httpError(400, '缺少导出对象', 'bad_args')
        const onlyIds = scope === 'connection' ? [id] : undefined
        const target = scope === 'connection' ? connections.get(id) : scope === 'folder' ? connections.folders.get(id) : null
        if (scope === 'connection' && !target) throw httpError(404, '连接不存在', 'unknown_connection')
        if (scope === 'folder' && !target) throw httpError(404, '文件夹不存在', 'unknown_folder')

        const state = { connections: connections.list(), folders: [...connections.folders.values()] }
        const { secrets, keySecrets } = passphrase
          ? await connections.secretsFor(onlyIds ?? state.connections.map((c) => c.id))
          : { secrets: {}, keySecrets: {} }
        const { bundle, missing, passwords } = exportBundle(state, {
          onlyIds,
          folderRoot: scope === 'folder' ? id : undefined,
          secrets,
          keySecrets,
          passphrase,
        })

        const dir = resolveExportDir(body.dir)
        mkdirSync(dir, { recursive: true })
        const base = scope === 'all' ? 'ssh-terminal-backup' : String(target?.name ?? 'export')
        const name = `${safeFileName(base)}-${stamp()}.json`
        const full = join(dir, name)
        // 正文就是纯备份 JSON：写下去的文件可以直接再导入回来。
        writeFileSync(full, JSON.stringify(bundle, null, 2), 'utf8')
        return json(res, 200, {
          path: full,
          dir,
          name,
          bytes: Buffer.byteLength(JSON.stringify(bundle, null, 2), 'utf8'),
          connections: bundle.connections?.length ?? 0,
          folders: bundle.folders?.length ?? 0,
          keys: bundle.keys?.length ?? 0,
          passwords,
          missing: missing.length,
        })
      }

      // 在系统文件管理器里打开导出所在目录并选中那个文件。
      // 不传 path 就打开默认导出目录——「东西放哪了」这个问题的兜底答案。
      if (route === 'export/reveal' && post) {
        const body = await readBody(req)
        const p = body.path ? String(body.path) : resolveExportDir(body.dir)
        const shown = revealInFileManager(p)
        return json(res, 200, { ok: shown.ok, dir: shown.dir, reason: shown.reason })
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
      // 在用户的终端里代跑一条命令并读回输出（AI 面板的 exec 走这里）。
      // 命令打在看得见的终端里，用户能看着它下命令、看着输出，也能 Ctrl-C 掐掉。
      if (route === 'terminal/run' && post) {
        const body = await readBody(req)
        const timeoutMs = clampInt(body.timeout, 120_000, 1_000, 600_000)
        const r = await terminals.runInShell(String(body.id ?? ''), String(body.command ?? ''), { timeoutMs })
        return json(res, 200, r)
      }

      // 监控
      if (route === 'monitor' && post) {
        const body = await readBody(req)
        const conn = find(body.connection)
        const s = await session(conn)
        const r = await s.exec('sh -s', 30_000, MONITOR_SCRIPT)
        if (r.timedOut) throw httpError(504, '监控脚本超时')
        const snap = parseMonitor(r.stdout)
        // 延迟是独立量出来的一件事：走本机 TCP 握手，不进 SSH 通道，也在失败时返回
        // null 而不是 0——"量不到"和"没有延迟"在面板上必须分得开。
        snap.latencyMs = await probeLatency(conn)
        return json(res, 200, snap)
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
        if (route === 'files/delete' && post) {          if (!body.path || body.path === '/') throw httpError(400, '拒绝删除根目录')
          if (body.dir) await sftpOps.removeRecursive(sftp, body.path)
          else await sftpOps.unlink(sftp, body.path)
          return json(res, 200, { ok: true })
        }

        // 改权限：mode 传八进制数字（0o755）或字符串「755」都认。
        if (route === 'files/chmod' && post) {
          const path = String(body.path ?? '')
          if (!path) throw httpError(400, '缺少 path', 'bad_args')
          const raw = body.mode
          const mode = typeof raw === 'string' ? parseInt(raw, 8) : Number(raw)
          if (!Number.isInteger(mode) || mode < 0 || mode > 0o7777) {
            throw httpError(400, '权限要写成 644 / 755 / 4755 这样的八进制', 'bad_mode')
          }
          await sftpOps.chmod(sftp, path, mode)
          const st = await sftpOps.stat(sftp, path)
          return json(res, 200, { ok: true, mode: st.mode })
        }

        // 内置编辑器的读：返回文本 + mtime，mtime 用来在保存时发现「别人也改了」。
        if (route === 'files/read' && req.method === 'GET') {
          const path = q.get('path') || ''
          if (!path) throw httpError(400, '缺少 path', 'bad_args')
          const st = await sftpOps.stat(sftp, path)
          if (st.isDir) throw httpError(400, '这是一个目录', 'is_directory')
          if (st.size > 2 * 1024 * 1024) throw httpError(413, `文件有 ${(st.size / 1048576).toFixed(1)} MB，超过 2 MB`, 'too_large')
          const buf = await sftpOps.readFile(sftp, path)
          if (buf.includes(0)) throw httpError(415, '文件里有 0 字节，是二进制', 'binary')
          let text
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
          } catch {
            throw httpError(415, '不是 UTF-8 编码（可能是 GBK），改完存回去会把文件搞坏', 'not_utf8')
          }
          return json(res, 200, { path, text, size: buf.length, mtime: st.mtime ?? null, mode: st.mode ?? null })
        }

        // 内置编辑器的写：临时文件 → 沿用原权限 → rename。
        // 中途断线也不会把原文件截成半截；rename 前比对 mtime，避免覆盖别人刚改的内容。
        if (route === 'files/write' && post) {
          const path = String(body.path ?? '')
          if (!path) throw httpError(400, '缺少 path', 'bad_args')
          const next = Buffer.from(String(body.text ?? ''), 'utf8')
          let old = null
          try {
            old = await sftpOps.stat(sftp, path)
          } catch {
            old = null // 新文件
          }
          if (old && body.mtime != null && old.mtime != null && String(old.mtime) !== String(body.mtime)) {
            throw httpError(409, '这个文件在你编辑期间被改过了。要覆盖就再点一次保存', 'mtime_changed')
          }
          const tmp = `${path}.dsh-tmp-${Date.now()}`
          await sftpOps.writeFile(sftp, tmp, next)
          if (old?.mode != null) {
            await new Promise((res2) => sftp.chmod(tmp, old.mode, () => res2()))
          }
          await sftpOps.rename(sftp, tmp, path)
          const st = await sftpOps.stat(sftp, path)
          return json(res, 200, { ok: true, size: next.length, mtime: st.mtime ?? null })
        }
      }

      // ── AI 面板 ────────────────────────────────────────────────────────────
      //
      // 模型**默认就用 DSH 已经配好的**：先问 `agentDefaultModel`，再退到 llm 目录里的
      // 第一个。用户不需要在插件里再填一遍地址和密钥。
      if (route === 'ai/models' && req.method === 'GET') {
        const llm = ctxOf?.()?.llm ?? null
        const current = ctxOf?.()?.currentModel?.() ?? null
        return json(res, 200, await listModels(llm, current))
      }

      if (route === 'ai/send' && post) {
        const body = await readBody(req)
        const aiStream = await aiSessionFor(String(body.connection ?? ''))
        // 附件内容块由界面组装好一起送来：文本已经展开，图片带 base64 字节。
        // 拼在文字前面，模型读到的是「先看附件、再看要求」。
        //
        // 这里必须放行 image 块——早先的过滤只认 text，图片就被悄悄丢掉了，
        // 用户拖截图进来问问题，模型手上其实什么都没有。
        const blocks = Array.isArray(body.blocks)
          ? body.blocks.filter(
              (b) =>
                b &&
                ((b.type === 'text' && typeof b.text === 'string') ||
                  (b.type === 'image' && b.source && typeof b.source.data === 'string' && b.source.data.length > 0))
            )
          : []
        const text = String(body.text ?? '')
        const content = [...blocks, ...(text ? [{ type: 'text', text }] : [])]
        if (!content.length) throw httpError(400, '消息为空', 'empty')
        // 先把请求确认收下，再把回合跑起来：长回合不能把 HTTP 请求挂在那里。
        aiStream.send(content).catch(() => {})
        return json(res, 200, { ok: true, id: aiStream.id })
      }

      if (route === 'ai/stop' && post) {
        const { id } = await readBody(req)
        aiSessions.get(String(id ?? ''))?.stop()
        return json(res, 200, { ok: true })
      }

      if (route === 'ai/approve' && post) {
        const { id, step, approved } = await readBody(req)
        const ok = aiSessions.get(String(id ?? ''))?.approve(String(step ?? ''), Boolean(approved)) ?? false
        return json(res, 200, { ok })
      }

      if (route === 'ai/history' && req.method === 'GET') {
        const all = readAiHistory()
        const connId = String(q.get('connection') ?? '')
        return json(res, 200, { items: connId ? all[connId] ?? [] : all })
      }

      if (route === 'ai/events' && req.method === 'GET') return subscribeAiEvents(res)

      // 开一段新对话：清空上下文，旧的那段已经落盘，随时能从历史里捡回来。
      if (route === 'ai/new' && post) {
        const body = await readBody(req)
        const s = await aiSessionFor(String(body.connection ?? ''))
        const started = s.newConversation()
        return json(res, 200, { ok: true, conversationId: started })
      }

      // 从历史恢复一段对话，接着聊。
      if (route === 'ai/restore' && post) {
        const body = await readBody(req)
        const connId = String(body.connection ?? '')
        const entryId = String(body.id ?? '')
        if (!entryId) throw httpError(400, '缺少历史 id', 'bad_args')
        const list = readAiHistory()[connId] ?? []
        const entry = list.find((x) => x.id === entryId)
        if (!entry) throw httpError(404, '这条历史不在了（可能已被删除）', 'unknown_history')
        const s = await aiSessionFor(connId)
        const n = s.restore(entry)
        return json(res, 200, { ok: true, conversationId: s.conversationId, messages: entry.messages ?? [], count: n })
      }

      // 删除一条历史。
      if (route === 'ai/delete' && post) {
        const body = await readBody(req)
        const connId = String(body.connection ?? '')
        const entryId = String(body.id ?? '')
        if (!entryId) throw httpError(400, '缺少历史 id', 'bad_args')
        const all = readAiHistory()
        const list = all[connId] ?? []
        const at = list.findIndex((x) => x.id === entryId)
        if (at < 0) throw httpError(404, '这条历史不在了', 'unknown_history')
        list.splice(at, 1)
        all[connId] = list
        writeAiHistory(all)
        return json(res, 200, { ok: true, removed: entryId })
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

/** 落到磁盘上的名字不能带路径分隔符或控制字符——连接名是用户随手起的。 */
function safeFileName(name) {
  return String(name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 80) || 'export'
}

/** 本地时间戳，`20261127-1530`：文件名里一眼看出是哪一次导出。 */
function stamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/**
 * 导出默认落在哪里：用户给的目录优先，否则「下载」文件夹（没有就用户主目录）。
 *
 * 只接受绝对路径——相对路径会随进程工作目录漂移，写到一个用户完全想不到的地方，
 * 那正是「导出后不知道放哪了」的成因本身。
 */
export function resolveExportDir(requested) {
  const raw = typeof requested === 'string' ? requested.trim() : ''
  if (raw) {
    if (!isAbsolute(raw)) throw httpError(400, '导出目录要写绝对路径（例如 D:\\备份）', 'bad_dir')
    return resolve(raw)
  }
  const home = homedir()
  for (const candidate of [join(home, 'Downloads'), join(home, '下载'), home]) {
    try {
      return resolve(candidate)
    } catch {
      // 继续试下一个
    }
  }
  return resolve(home)
}

/**
 * 在系统文件管理器里显示一个路径（Windows 用 `/select,` 直接选中文件）。
 *
 * 打开失败不算错误：无头环境、没有文件管理器都会走这里，界面据此退回一句「文件在
 * 某某目录」的提示，而不是报错——文件已经写好了，打开资源管理器只是锦上添花。
 */
export function revealInFileManager(target) {
  let dir = target
  let isFile = false
  try {
    isFile = statSync(target).isFile()
    if (isFile) dir = dirname(target)
  } catch {
    // 路径可能只是目录，或者已经不存在：按目录处理
  }
  const args =
    process.platform === 'win32'
      ? isFile
        ? ['/select,', target]
        : [dir]
      : process.platform === 'darwin'
        ? ['-R', isFile ? target : dir]
        : [dir]
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
    return { ok: true, dir }
  } catch (e) {
    return { ok: false, dir, reason: e instanceof Error ? e.message : String(e) }
  }
}
