/**
 * 备份文件(liteshell-backup)的打包与解包,格式与 liteshell 的 store.ts 一致,
 * 两边的备份文件可以互相导入:
 *
 *   { kind:'liteshell-backup', version:1, exportedAt, folders, connections, keys, secrets? }
 *
 * 私钥以 base64 内联在 `keys` 里;密码和私钥口令不落明文,只在用户给了口令时用
 * sealed.js 的 AES-256-GCM 密文装进 `secrets`。没有口令就不带密码——不带走是明确的,
 * 泄漏不是。
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openSecrets, sealSecrets } from './sealed.js'

/** 范围内要导出的文件夹子树。文件夹自己变成根,免得在别处导入时挂着一个不存在的父级。 */
function collectFolders(folders, rootId) {
  const ids = new Set()
  const walk = (id) => {
    if (ids.has(id)) return
    ids.add(id)
    for (const f of folders) if (f.parentId === id) walk(f.id)
  }
  walk(rootId)
  return ids
}

/**
 * @param {{connections: object[], folders: object[]}} state
 * @param {{onlyIds?: string[], folderRoot?: string, secrets?: Record<string,string>, keySecrets?: Record<string,string>, passphrase?: string}} [opts]
 *   secrets 按连接 id、keySecrets 按私钥文件的绝对路径给明文,由调用方从凭据服务取出。
 * @returns {{bundle: object, missing: string[], passwords: number}}
 */
export function exportBundle(state, opts = {}) {
  const { onlyIds, folderRoot, secrets = {}, keySecrets = {}, passphrase = '' } = opts
  const folderIds = folderRoot ? collectFolders(state.folders, folderRoot) : null
  const scope = onlyIds
    ? new Set(onlyIds)
    : folderIds
      ? new Set(state.connections.filter((c) => c.folderId && folderIds.has(c.folderId)).map((c) => c.id))
      : null
  const picked = scope ? state.connections.filter((c) => scope.has(c.id)) : state.connections

  const missing = []
  const keys = []
  const seen = new Map() // 路径 -> blob 名,同一个私钥文件只存一份
  const keySecretByName = {}
  const addKey = (path) => {
    if (seen.has(path)) return seen.get(path)
    if (!existsSync(path)) return null
    const name = `${seen.size + 1}-${path.split(/[\\/]/).pop()}`
    keys.push({ name, data: readFileSync(path).toString('base64') })
    seen.set(path, name)
    const secret = keySecrets[path]
    if (secret) keySecretByName[name] = secret
    return name
  }

  const connections = picked.map((c) => {
    const { keyFingerprint: _drop, ...rest } = c
    if (c.authType !== 'key' || !c.privateKeyPath) return rest
    const name = addKey(c.privateKeyPath)
    if (!name) {
      missing.push(c.name)
      return { ...rest, privateKeyPath: undefined }
    }
    return { ...rest, privateKeyPath: name }
  })

  const byId = {}
  for (const c of picked) if (secrets[c.id]) byId[c.id] = secrets[c.id]
  const payload = { connections: byId, ...(Object.keys(keySecretByName).length ? { keys: keySecretByName } : {}) }
  const passwords = Object.keys(byId).length + Object.keys(keySecretByName).length

  const folders = folderIds
    ? state.folders.filter((f) => folderIds.has(f.id)).map((f) => (f.id === folderRoot ? { ...f, parentId: null } : f))
    : scope
      ? []
      : state.folders

  const bundle = {
    kind: 'liteshell-backup',
    version: 1,
    exportedAt: Date.now(),
    folders,
    connections,
    keys,
    // 没有秘密可藏时不留一个空的口令锁:那种文件只会白白让对面找口令。
    ...(passphrase && passwords ? { secrets: sealSecrets(payload, passphrase) } : {}),
  }
  return { bundle, missing, passwords: bundle.secrets ? passwords : 0 }
}

/**
 * 解包。口令不对、文件被改过都在写任何东西之前抛错,不会留下半截导入。
 *
 * @param {object} bundle
 * @param {string} keyDir 私钥解到这个目录下
 * @param {string} [passphrase]
 * @returns {{folders: object[], connections: object[], keys: object[], passwords: Record<string,string>, keyPasswords: Record<string,string>, missingKeys: number}}
 *   folders / connections / keys 用 ref 互相引用(ref 就是备份文件里的 id / 私钥名)。
 */
export function importBundle(bundle, keyDir, passphrase = '') {
  if (bundle?.kind !== 'liteshell-backup') throw new Error('不是 liteshell 的备份文件')

  let secrets = {}
  if (bundle.secrets) {
    if (!passphrase) throw new Error('这个备份带着加密的密码,需要导出时设的口令')
    try {
      secrets = openSecrets(bundle.secrets, passphrase)
    } catch {
      throw new Error('口令不对,或者备份文件已损坏')
    }
  }

  const keyPaths = new Map()
  const keys = []
  const keyPasswords = {}
  if ((bundle.keys ?? []).length) mkdirSync(keyDir, { recursive: true })
  for (const key of bundle.keys ?? []) {
    const target = join(keyDir, key.name)
    writeFileSync(target, Buffer.from(key.data, 'base64'), { mode: 0o600 })
    try {
      chmodSync(target, 0o600)
    } catch {
      // Windows 下用户目录的 ACL 本来就够紧。
    }
    keyPaths.set(key.name, target)
    keys.push({ ref: key.name, name: key.name, label: key.label, path: target })
    const pass = secrets.keys?.[key.name]
    if (pass) keyPasswords[key.name] = pass
  }

  let missingKeys = 0
  const passwords = {}
  const connections = (bundle.connections ?? [])
    .filter((c) => c && c.host)
    .map((c) => {
      const { secret: _drop, hasSecret: _drop2, hasKeyPassphrase: _drop3, folder: _drop4, ...rest } = c
      let keyRef
      if (rest.privateKeyPath) {
        const target = keyPaths.get(rest.privateKeyPath)
        if (target) keyRef = rest.privateKeyPath
        else missingKeys++
      }
      const plain = secrets.connections?.[c.id]
      if (plain) passwords[c.id] = plain
      return {
        ref: c.id,
        name: c.name || `${c.username}@${c.host}`,
        host: String(c.host),
        port: c.port || 22,
        username: c.username ?? '',
        authType: ['password', 'key', 'agent'].includes(c.authType) ? c.authType : 'password',
        keyRef,
        keyPath: keyRef ? keyPaths.get(keyRef) : undefined,
        folderRef: c.folderId ?? null,
        localIface: c.localIface,
        localAddress: c.localAddress,
      }
    })

  return {
    folders: (bundle.folders ?? []).map((f) => ({ ref: f.id, name: f.name, parentRef: f.parentId ?? null })),
    connections,
    keys,
    passwords,
    keyPasswords,
    missingKeys,
  }
}
