/**
 * FinalShell 连接树的导入。两种落盘形态都认:
 *
 * 1. 安装目录 —— `<安装>/conn/` 下每个文件夹一个目录(名称为文件夹 id),里面有
 *    `folder.json`,连接是 `<id>_connect_config.json`;私钥在 `<安装>/config.json` 里 base64。
 * 2. 导出目录 —— 右键「导出」的产物:同样一批 `*_connect_config.json`,但没有
 *    `folder.json`,文件夹名就是目录名、层级就是目录层级,配置里的 `parent_id` 指向
 *    源机器的文件夹 id,在这里没用。
 *
 * 单个 `*_connect_config.json` 也收(导出单条连接就是这个),密码就是靠它带过来的。
 *
 * 密码用的是「密文自己派生密钥」的 DES(移植自 FinalShell 的 ranDomKey),所以解开不需要
 * 本机装 FinalShell;恢复出的明文交给调用方存进 DSH 凭据库。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createDecipheriv, createHash } from 'node:crypto'
import { basename, join } from 'node:path'

const SSH_TRANSPORT = 100
const ROOT_ID = 'root'

/* ---------- 密码解密(Java java.util.Random + DES) ---------- */

const RANDOM_MULT = 0x5deece66dn
const RANDOM_ADD = 0xbn
const RANDOM_MASK = (1n << 48n) - 1n

/** 逐位对上 `java.util.Random`:种子 48 位,nextLong 拼两个有符号 32 位,溢出按 Java 的 long 回绕。 */
class JavaRandom {
  constructor(seed) {
    this.seed = (BigInt.asUintN(64, seed) ^ RANDOM_MULT) & RANDOM_MASK
  }

  #next(bits) {
    this.seed = (this.seed * RANDOM_MULT + RANDOM_ADD) & RANDOM_MASK
    let value = Number(this.seed >> BigInt(48 - bits))
    if (bits >= 32 && value >= 0x80000000) value -= 0x100000000
    return value
  }

  nextInt(bound) {
    const bits = this.#next(31)
    const mask = bound - 1
    if ((bound & mask) === 0) return (bound * bits) >> 31
    let value = bits
    let remainder = value % bound
    while (value - remainder + mask < 0) {
      value = this.#next(31)
      remainder = value % bound
    }
    return remainder
  }

  nextLong() {
    const hi = BigInt(this.#next(32))
    const lo = BigInt(this.#next(32))
    return BigInt.asIntN(64, (hi << 32n) + lo)
  }
}

const signed = (byte) => (byte >= 128 ? byte - 256 : byte)

/** 前 8 个字节种出一段确定的伪随机序列,再把它的 long 哈希成 DES 密钥。 */
function randomKey(head) {
  const divisor = new JavaRandom(BigInt(signed(head[5]))).nextInt(127) || 1
  const ks = 3680984568597093857n / BigInt(divisor)
  const random = new JavaRandom(ks)
  const skip = signed(head[0])
  for (let i = 0; i < skip; i++) random.nextLong()
  const n = random.nextLong()
  const r2 = new JavaRandom(n)
  const longs = [
    BigInt(signed(head[4])),
    r2.nextLong(),
    BigInt(signed(head[7])),
    BigInt(signed(head[3])),
    r2.nextLong(),
    BigInt(signed(head[1])),
    random.nextLong(),
    BigInt(signed(head[2])),
  ]
  const seed = Buffer.alloc(64)
  longs.forEach((value, i) => seed.writeBigInt64BE(value, i * 8))
  return createHash('md5').update(seed).digest()
}

/** 解一条 `password` 字段。密文不合法时抛错。 */
export function decodeFinalShellPassword(encoded) {
  const text = String(encoded ?? '').trim()
  if (!text) return ''
  const buf = Buffer.from(text, 'base64')
  if (buf.length <= 8 || (buf.length - 8) % 8 !== 0) throw new Error('不是有效的 FinalShell 密码密文')
  // 单 DES 的 ECB:三份相同密钥的 3DES 与它逐字节等价(node 的 openssl 不提供裸 DES)。
  const key = randomKey(buf.subarray(0, 8)).subarray(0, 8)
  const d = createDecipheriv('des-ede3-ecb', Buffer.concat([key, key, key]), null)
  d.setAutoPadding(false)
  let plain = Buffer.concat([d.update(buf.subarray(8)), d.final()])
  // PKCS#5:最后一个字节是填充长度,重复那么多次。
  const pad = plain[plain.length - 1]
  if (pad >= 1 && pad <= 8 && plain.subarray(-pad).every((b) => b === pad)) plain = plain.subarray(0, -pad)
  return new TextDecoder('utf-8', { fatal: true }).decode(plain)
}

/* ---------- 导入(只读文件,不写盘) ---------- */

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''))

function decryptPassword(cfg, warnings) {
  if (!cfg.password) return ''
  try {
    return decodeFinalShellPassword(cfg.password)
  } catch (err) {
    warnings.push(`连接「${cfg.name || cfg.host || cfg.id}」的密码解不开,需要手动补录:${err.message}`)
    return ''
  }
}

function toConnection(cfg, ref, folderRef) {
  const isKeyAuth = cfg.authentication_type === 2
  return {
    ref,
    name: cfg.name || cfg.host,
    host: cfg.host,
    port: cfg.port || 22,
    username: cfg.user_name || 'root',
    authType: isKeyAuth ? 'key' : 'password',
    keyRef: isKeyAuth && cfg.secret_key_id ? cfg.secret_key_id : undefined,
    folderRef,
  }
}

/**
 * @param {string} source FinalShell 安装/导出目录,或单个 `*_connect_config.json`
 * @param {string|null} parentRef 整个来源挂到哪个文件夹下面(我们的中间表示用 ref 标识)
 * @returns {{folders: {ref,name,parentRef}[], connections: object[], keys: {ref,name,data}[], passwords: Record<string,string>, warnings: string[], skipped: number, needsPassword: number}}
 */
export function parseFinalshell(source, parentRef = null) {
  if (!source || !existsSync(source)) throw new Error(`找不到 FinalShell 路径:${source ?? '(未提供)'}`)
  const warnings = []

  if (statSync(source).isFile()) {
    const cfg = readJson(source)
    if (cfg.conection_type !== undefined && cfg.conection_type !== SSH_TRANSPORT) throw new Error('这个文件不是 SSH 连接配置')
    if (!cfg.host) throw new Error('连接配置里没有主机地址')
    const ref = `fs-${cfg.id || basename(source).replace(/_connect_config\.json$/i, '')}`
    const conn = toConnection(cfg, ref, parentRef)
    const passwords = {}
    let needsPassword = 0
    if (conn.authType === 'key') {
      if (cfg.secret_key_id) warnings.push(`连接「${conn.name}」引用了私钥 ${cfg.secret_key_id},但单个连接文件不带私钥,需要手动选择`)
    } else {
      const plain = decryptPassword(cfg, warnings)
      if (plain) passwords[ref] = plain
      else needsPassword++
    }
    return { folders: [], connections: [conn], keys: [], passwords, warnings, skipped: 0, needsPassword }
  }

  const nested = join(source, 'conn')
  const connDir = existsSync(nested) && statSync(nested).isDirectory() ? nested : source

  const keys = []
  const configPath = join(source, 'config.json')
  if (existsSync(configPath)) {
    const config = readJson(configPath)
    for (const key of config.secret_key_list ?? []) keys.push({ ref: key.id, name: key.name || `${key.id}.pem`, data: key.key_data })
  }
  const keyRefs = new Set(keys.map((k) => k.ref))

  const folders = []
  const raw = []
  const walk = (dir, rel, parentId) => {
    const folderFile = join(dir, 'folder.json')
    let selfId = parentId
    if (existsSync(folderFile)) {
      const folder = readJson(folderFile)
      if (folder.id) {
        selfId = `fs-${folder.id}`
        folders.push({ ref: selfId, name: folder.name || '(未命名文件夹)', parentRef: !folder.parent_id || folder.parent_id === ROOT_ID ? null : `fs-${folder.parent_id}` })
      }
    } else if (rel.length) {
      // 没有元数据文件:目录名就是文件夹名,相对路径就是它的身份。
      selfId = `fs-dir:${rel.join('/')}`
      folders.push({ ref: selfId, name: rel[rel.length - 1], parentRef: parentId })
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, [...rel, entry.name], selfId)
      else if (entry.name === 'folder.json') continue
      else if (entry.name.endsWith('_connect_config.json')) raw.push({ cfg: readJson(full), fallback: selfId })
    }
  }
  walk(connDir, [], null)

  const connections = []
  const passwords = {}
  let skipped = 0
  let needsPassword = 0
  const known = new Set(folders.map((f) => f.ref))
  for (const { cfg, fallback } of raw) {
    if (cfg.conection_type !== undefined && cfg.conection_type !== SSH_TRANSPORT) {
      skipped++
      continue
    }
    if (!cfg.host) {
      skipped++
      continue
    }
    // 安装目录里 parent_id 能对上;导出目录里它指向源机器的文件夹,所以以文件实际位置为准。
    const folderRef = cfg.parent_id && known.has(`fs-${cfg.parent_id}`) ? `fs-${cfg.parent_id}` : fallback
    const conn = toConnection(cfg, `fs-${cfg.id}`, folderRef)
    if (conn.keyRef && !keyRefs.has(conn.keyRef)) warnings.push(`连接「${conn.name}」引用的私钥 ${conn.keyRef} 不在 config.json 里,需要手动选择`)
    if (conn.authType !== 'key') {
      const plain = decryptPassword(cfg, warnings)
      if (plain) passwords[conn.ref] = plain
      else needsPassword++
    }
    connections.push(conn)
  }

  for (const key of keys) if (!key.data) warnings.push(`私钥 ${key.name} 在 config.json 里没有数据,已跳过`)

  // 导入到某个文件夹下面:原本在来源根上的东西挪到它里面。
  if (parentRef) {
    for (const f of folders) if (f.parentRef === null) f.parentRef = parentRef
    for (const c of connections) if (!c.folderRef) c.folderRef = parentRef
  }

  return { folders, connections, keys: keys.filter((k) => k.data), passwords, warnings, skipped, needsPassword }
}
