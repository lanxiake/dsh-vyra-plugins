/**
 * 导入连接档案。只读取 host / 端口 / 用户 / 认证方式 / 私钥路径 / 文件夹名。
 * 不读取、不转存任何密码、口令、命令历史。
 */
import SSHConfig from 'ssh-config'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const expandHome = (p) => (typeof p === 'string' ? p.replace(/^~(?=$|[\\/])/, homedir()) : p)
/** ssh-config 的值可能是字符串,也可能是 {val, separator, quoted} 对象(或其数组),统一取成字符串。 */
const str = (v) => (v && typeof v === 'object' ? String(v.val ?? '') : v == null ? '' : String(v))
const first = (v) => str(Array.isArray(v) ? v[0] : v)

/** 去掉 BOM 后按 UTF-8 解析 JSON。 */
function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}

/** ~/.ssh/config 里的具体 Host(跳过通配符和否定模式)。 */
export function parseSshConfig(file = join(homedir(), '.ssh', 'config')) {
  if (!existsSync(file)) return []
  const config = SSHConfig.parse(readFileSync(file, 'utf8'))
  const items = []
  for (const line of config) {
    if (line.type !== SSHConfig.DIRECTIVE || line.param !== 'Host') continue
    const patterns = (Array.isArray(line.value) ? line.value : [line.value]).map(str).filter(Boolean)
    for (const alias of patterns) {
      if (/[*?!]/.test(alias)) continue
      const c = config.compute(alias)
      const key = first(c.IdentityFile)
      const user = first(c.User)
      items.push({
        ...profile({ host: first(c.HostName) || alias, username: user }, null),
        name: alias,
        port: parseInt(first(c.Port) || '22', 10) || 22,
        authType: key ? 'key' : 'password',
        privateKeyPath: key ? expandHome(key) : undefined,
      })
    }
  }
  return items
}

/** liteshell 的数据文件候选位置。 */
export function liteshellFile() {
  const roots = [process.env.APPDATA, join(homedir(), '.config')].filter(Boolean)
  for (const r of roots) {
    for (const dir of ['liteshell', 'LiteShell']) {
      const f = join(r, dir, 'liteshell.json')
      if (existsSync(f)) return f
    }
  }
  return null
}

/** 只导入档案字段:密码/口令/命令历史一概不读——它们在备份文件里也只以密文出现。 */
const profile = (c, folder) => ({
  name: c.name || `${c.username || ''}@${c.host || ''}`,
  host: c.host,
  port: c.port || 22,
  username: c.username,
  authType: ['password', 'key', 'agent'].includes(c.authType) ? c.authType : 'password',
  privateKeyPath: c.privateKeyPath || undefined,
  localIface: c.localIface || undefined,
  localAddress: c.localAddress || undefined,
  folder: folder ?? null,
})

export function parseLiteshell(file = liteshellFile()) {
  if (!file || !existsSync(file)) return []
  const store = readJson(file)
  const folders = new Map((store.folders || []).map((f) => [f.id, f.name]))
  return (store.connections || [])
    .filter((c) => c && c.host && c.username)
    .map((c) => profile(c, c.folderId ? folders.get(c.folderId) || null : null))
}

/** 已存在的判定:同名且同 host/端口/用户。 */
export function isDuplicate(existing, item) {
  return existing.some(
    (c) => c.name === item.name && c.host === item.host && (c.port || 22) === item.port && c.username === item.username
  )
}
