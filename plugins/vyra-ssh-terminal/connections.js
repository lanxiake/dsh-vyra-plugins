/**
 * 连接管理器:连接档案的增删改查、凭据引用、主机密钥固定。
 *
 * 档案(host、用户名、认证方式)存本地 JSON 文件;密码和私钥口令只存进 DSH 的
 * credentials 服务,档案里没有任何秘密。
 */
import { randomBytes, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { homedir, networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { isDuplicate } from './import.js'

/** 档案文件位置:优先放进当前 profile 目录。 */
export function stateFile() {
  const base = process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh')
  return join(base, 'ssh-terminal', 'connections.json')
}

/** 档案里的字段必须是字符串:坏数据(例如旧版导入写入的对象)在这里被清洗,不能让界面崩溃。 */
const text = (v) => (v && typeof v === 'object' ? String((Array.isArray(v) ? v[0]?.val ?? v[0] : v.val) ?? '') : v == null ? '' : String(v))

function cleanConnection(c) {
  if (!c || typeof c !== 'object' || !c.id) return null
  return {
    ...c,
    name: text(c.name),
    host: text(c.host),
    username: text(c.username),
    privateKeyPath: c.privateKeyPath ? text(c.privateKeyPath) : undefined,
    // 本机出口:网卡名在连接时现查地址,VPN 换了租约也跟得上。
    localIface: c.localIface ? text(c.localIface) : undefined,
    localAddress: c.localAddress ? text(c.localAddress) : undefined,
  }
}

export function loadState(file = stateFile()) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return {
      connections: (Array.isArray(parsed.connections) ? parsed.connections : []).map(cleanConnection).filter(Boolean),
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    }
  } catch {
    return { connections: [], folders: [] }
  }
}

function saveState(state, file = stateFile()) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 })
  renameSync(tmp, file)
}

/** 凭据记录的 key。每个连接最多两条:密码、私钥口令。 */
export function credentialKeyFor(connectionId, kind) {
  return `ssh-terminal:${connectionId}:${kind}`
}

const newId = () => randomBytes(8).toString('hex')

export class ConnectionManager {
  /**
   * @param {{ credentials: any }} deps credentials 为 DSH 的 credentials 服务
   * @param {string} [file] 档案路径,测试时可覆盖
   */
  constructor(deps, file = stateFile()) {
    this.credentials = deps.credentials
    this.file = file
    this.connections = new Map()
    this.folders = new Map()
    const state = loadState(file)
    for (const c of state.connections) this.connections.set(c.id, c)
    for (const f of state.folders) this.folders.set(f.id, f)
  }

  persist() {
    saveState(
      { connections: [...this.connections.values()], folders: [...this.folders.values()] },
      this.file
    )
  }

  list() {
    return [...this.connections.values()]
  }

  get(id) {
    return this.connections.get(id)
  }

  /**
   * 按 id 或名称查找。名称重名时不猜,返回 ambiguous 让调用方改用 id。
   * @returns {{ conn: object } | { error: string, candidates?: object[] }}
   */
  resolve(key) {
    const byId = this.connections.get(key)
    if (byId) return { conn: byId }
    const hits = this.list().filter((c) => c.name === key)
    if (hits.length === 1) return { conn: hits[0] }
    if (hits.length === 0) {
      return { error: `没有叫「${key}」的连接`, candidates: this.list().map((c) => ({ id: c.id, name: c.name })) }
    }
    return {
      error: `有 ${hits.length} 个连接都叫「${key}」,请改用 id`,
      candidates: hits.map((c) => ({ id: c.id, host: c.host, username: c.username })),
    }
  }

  /** 脱敏视图:给工具和界面用,不含任何秘密。 */
  async listView() {
    const views = []
    for (const c of this.connections.values()) {
      const hasPassword =
        c.authType === 'password' &&
        !!(await this.credentials.readRecord(credentialKeyFor(c.id, 'password')))
      const hasKeyPassphrase =
        c.authType === 'key' &&
        !!(await this.credentials.readRecord(credentialKeyFor(c.id, 'key-passphrase')))
      views.push({
        id: c.id,
        name: c.name,
        host: c.host,
        port: c.port,
        username: c.username,
        authType: c.authType,
        hasPassword,
        hasKeyPassphrase,
        folderId: c.folderId ?? null,
        privateKeyPath: c.privateKeyPath ?? null,
        localIface: c.localIface ?? null,
        localAddress: c.localAddress ?? null,
        folder: c.folderId ? this.folders.get(c.folderId)?.name ?? null : null,
      })
    }
    return views
  }

  /**
   * 新建或更新连接。password / keyPassphrase 只在这里经过,立即写入 credentials。
   */
  async upsert(input, password, keyPassphrase) {
    const id = input.id || newId()
    const prev = this.connections.get(id)
    const next = {
      id,
      name: input.name,
      host: input.host,
      port: input.port || 22,
      username: input.username,
      authType: input.authType || 'password',
      privateKeyPath: input.privateKeyPath || undefined,
      folderId: input.folderId || undefined,
      localIface: input.localIface || undefined,
      localAddress: input.localAddress || undefined,
      hostKeyFingerprint: prev?.hostKeyFingerprint,
    }
    this.connections.set(id, next)
    if (password) {
      await this.credentials.modifyRecord(credentialKeyFor(id, 'password'), async () => ({
        kind: 'api-key',
        key: password,
      }))
    }
    if (keyPassphrase) {
      await this.credentials.modifyRecord(credentialKeyFor(id, 'key-passphrase'), async () => ({
        kind: 'api-key',
        key: keyPassphrase,
      }))
    }
    this.persist()
    return next
  }

  /** 界面用的整棵树:文件夹和脱敏后的连接。 */
  async tree() {
    return { folders: [...this.folders.values()], connections: await this.listView() }
  }

  /** 文件夹不能放进自己或自己的子孙里面。 */
  canMove(id, intoFolderId) {
    if (id === intoFolderId) return false
    if (!this.folders.has(id)) return true
    for (let p = intoFolderId; p; p = this.folders.get(p)?.parentId ?? null) if (p === id) return false
    return true
  }

  saveFolder({ id, name, parentId }) {
    const clean = String(name ?? '').trim()
    if (!clean) throw new Error('文件夹名称不能为空')
    const parent = parentId || null
    if (parent && !this.folders.has(parent)) throw new Error('上级文件夹不存在')
    if (id && !this.canMove(id, parent)) throw new Error('不能把文件夹放进它自己里面')
    const fid = id || newId()
    this.folders.set(fid, { id: fid, name: clean, parentId: parent })
    this.persist()
    return this.folders.get(fid)
  }

  /** 删除文件夹时,里面的子文件夹和连接一并删除(连同它们的凭据)。 */
  async removeFolder(id) {
    if (!this.folders.has(id)) return false
    const doomed = new Set([id])
    for (let grew = true; grew; ) {
      grew = false
      for (const f of this.folders.values()) {
        if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) {
          doomed.add(f.id)
          grew = true
        }
      }
    }
    for (const c of this.list()) if (c.folderId && doomed.has(c.folderId)) await this.remove(c.id)
    for (const fid of doomed) this.folders.delete(fid)
    this.persist()
    return true
  }

  /** 把连接或文件夹移进某个文件夹(null = 根)。 */
  move(id, folderId) {
    const target = folderId || null
    if (target && !this.folders.has(target)) throw new Error('目标文件夹不存在')
    const conn = this.connections.get(id)
    if (conn) {
      conn.folderId = target || undefined
    } else {
      const f = this.folders.get(id)
      if (!f) throw new Error('找不到要移动的项目')
      if (!this.canMove(id, target)) throw new Error('不能把文件夹放进它自己里面')
      f.parentId = target
    }
    this.persist()
  }

  /** 复制连接,凭据也一并复制到新连接名下。 */
  async duplicate(id) {
    const src = this.connections.get(id)
    if (!src) throw new Error('连接不存在')
    const copy = await this.upsert({ ...src, id: undefined, name: `${src.name} 副本` })
    for (const kind of ['password', 'key-passphrase']) {
      const rec = await this.credentials.readRecord(credentialKeyFor(src.id, kind))
      if (rec) await this.credentials.modifyRecord(credentialKeyFor(copy.id, kind), async () => rec)
    }
    return copy
  }

  /** 连接成功后,按用户的选择记住临时输入的密码或私钥口令。 */
  async rememberSecret(conn, secret) {
    const kind = conn.authType === 'password' ? 'password' : conn.authType === 'key' ? 'key-passphrase' : null
    if (!kind || !secret) return
    await this.credentials.modifyRecord(credentialKeyFor(conn.id, kind), async () => ({ kind: 'api-key', key: secret }))
  }

  /** 按名称取得文件夹 id,不存在就新建。 */
  ensureFolder(name) {
    if (!name) return undefined
    for (const f of this.folders.values()) if (f.name === name) return f.id
    const id = newId()
    this.folders.set(id, { id, name, parentId: null })
    return id
  }

  /**
   * 把一份「引用式」导入数据(ref 互指,还没有本机 id)落盘:先建文件夹、再建连接,
   * 密码写进凭据库。密码先于档案写入,中途失败不会留下一条连不上的连接。
   *
   * 重复判定沿用 isDuplicate(同名同地址同端口同用户),已存在的跳过——和现有两个导入入口
   * 同一口径。
   *
   * @param {{folders: object[], connections: object[], secrets?: Record<string,string>}} data
   * @returns {Promise<{folders: number, connections: number, skipped: number}>}
   */
  importInto(data, { parentId = null } = {}) {
    // 串行化:两个导入同时改 folders/connections 会把父子关系写乱。
    this.pendingImport = (this.pendingImport ?? Promise.resolve()).then(
      () => this.#importInto(data, parentId),
      () => this.#importInto(data, parentId)
    )
    return this.pendingImport
  }

  async #importInto(data, parentId) {
    const idByRef = new Map()
    for (const f of data.folders ?? []) idByRef.set(f.ref, newId())
    const folderName = (f) => String(f.name || '未命名文件夹').trim() || '未命名文件夹'
    // 父级先建:深层文件夹的 parentId 得是已经存在的 id。
    let pending = [...(data.folders ?? [])]
    for (let guard = 0; pending.length && guard <= pending.length; guard++) {
      const rest = []
      for (const f of pending) {
        const parent = f.parentRef ? idByRef.get(f.parentRef) : parentId
        if (!parent && f.parentRef) {
          rest.push(f)
          continue
        }
        const id = idByRef.get(f.ref)
        this.folders.set(id, { id, name: folderName(f), parentId: parent ?? null })
      }
      if (rest.length === pending.length) break // 父级缺失(来源已经坏掉),剩下的当根处理
      pending = rest
    }
    for (const f of pending) {
      const id = idByRef.get(f.ref)
      this.folders.set(id, { id, name: folderName(f), parentId: parentId ?? null })
    }

    let connections = 0
    let skipped = 0
    for (const c of data.connections ?? []) {
      const id = newId()
      const folderId = (c.folderRef && idByRef.get(c.folderRef)) || parentId || undefined
      const name = String(c.name || `${c.username}@${c.host}`).trim()
      if (isDuplicate(this.list(), { name, host: c.host, port: c.port, username: c.username })) {
        skipped++
        continue
      }
      const secret = data.secrets?.[c.ref]
      if (secret) await this.credentials.modifyRecord(credentialKeyFor(id, 'password'), async () => ({ kind: 'api-key', key: secret }))
      if (c.keySecret) await this.credentials.modifyRecord(credentialKeyFor(id, 'key-passphrase'), async () => ({ kind: 'api-key', key: c.keySecret }))
      this.connections.set(id, {
        id,
        name,
        host: String(c.host ?? ''),
        port: Number(c.port) || 22,
        username: String(c.username ?? ''),
        authType: ['password', 'key', 'agent'].includes(c.authType) ? c.authType : 'password',
        privateKeyPath: c.keyPath || undefined,
        folderId,
        localIface: this.#iface(c.localIface),
        localAddress: c.localAddress ? String(c.localAddress) : undefined,
      })
      connections++
    }
    this.persist()
    return { folders: idByRef.size, connections, skipped }
  }

  /** 网卡名必须真的存在:导入一份别人机器上的备份时,写进一个不存在的网卡只会让连接绑不上。 */
  #iface(name) {
    const wanted = String(name ?? '').trim()
    if (!wanted) return undefined
    return Object.keys(networkInterfaces()).includes(wanted) ? wanted : undefined
  }

  /** 导出用:取一个连接要带走的全部凭据。明文只在本进程内存里过一下,不进任何文件。 */
  async secretsFor(ids) {
    const out = {}
    const keySecrets = {}
    for (const id of ids) {
      const conn = this.connections.get(id)
      if (!conn) continue
      const kind = conn.authType === 'password' ? 'password' : conn.authType === 'key' ? 'key-passphrase' : null
      if (!kind) continue
      const rec = await this.credentials.readRecord(credentialKeyFor(id, kind))
      const plain = rec && rec.kind === 'api-key' ? rec.key || '' : ''
      if (!plain) continue
      if (kind === 'password') out[id] = plain
      else if (conn.privateKeyPath) keySecrets[conn.privateKeyPath] = plain
    }
    return { secrets: out, keySecrets }
  }

  async remove(id) {
    if (!this.connections.delete(id)) return false
    await this.credentials.deleteRecord(credentialKeyFor(id, 'password'))
    await this.credentials.deleteRecord(credentialKeyFor(id, 'key-passphrase'))
    this.persist()
    return true
  }

  /**
   * 首次信任、之后固定。指纹变了就拒绝,不覆盖旧值。
   * @returns {{ ok: boolean, fingerprint: string, changed: boolean, first: boolean }}
   */
  checkHostKey(conn, keyBuf) {
    const fingerprint = 'SHA256:' + createHash('sha256').update(keyBuf).digest('base64').replace(/=+$/, '')
    const known = this.connections.get(conn.id)?.hostKeyFingerprint
    if (known) {
      return known === fingerprint
        ? { ok: true, fingerprint, changed: false, first: false }
        : { ok: false, fingerprint, changed: true, first: false }
    }
    const live = this.connections.get(conn.id)
    if (live) {
      live.hostKeyFingerprint = fingerprint
      this.persist()
    }
    return { ok: true, fingerprint, changed: false, first: true }
  }

  /** 读取连接所需的秘密(密码或私钥口令)。只在 Host 内部使用。 */
  async secretFor(conn, oneShot) {
    if (oneShot) return oneShot
    const kind = conn.authType === 'password' ? 'password' : conn.authType === 'key' ? 'key-passphrase' : null
    if (!kind) return ''
    const rec = await this.credentials.readRecord(credentialKeyFor(conn.id, kind))
    return rec && rec.kind === 'api-key' ? rec.key || '' : ''
  }
}

export { existsSync }
