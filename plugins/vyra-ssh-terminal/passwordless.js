/**
 * 配置本机免密登录:在本机生成(一次)一把 ed25519 密钥,用现有凭据登录目标服务器写进
 * authorized_keys,再用这把新密钥单独登录验证一次,最后才把它写进本机 ~/.ssh/config。
 *
 * 顺序是有意的——服务器没有接受这把钥匙之前,config 里就不该出现它。任何一步抛错,
 * 前面写的步骤也不会留在 config 里。
 *
 * 网络部分没有真机验证过(见交付说明),纯字符串部分在 test/sshconfig.test.mjs 里断言。
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import ssh2 from 'ssh2'
import { bindAddress } from './localnet.js'
import { aliasOwners, installCommand, sshAlias, sshConfigWith } from './sshconfig.js'

// ssh2 是 CJS:命名导出在 ESM 里认不全,只能从默认导出上取。
const { Client, utils } = ssh2

export const localKeyPath = () => join(homedir(), '.ssh', 'dsh_ed25519')
export const sshConfigPath = () => join(homedir(), '.ssh', 'config')
const KEY_COMMENT = 'dsh-ssh-terminal'

/** 一次性生成,之后复用:重复配置只是再写一次 authorized_keys。 */
export function ensureKey() {
  const path = localKeyPath()
  const pubPath = `${path}.pub`
  if (existsSync(path) && existsSync(pubPath)) return { path, publicKey: readFileSync(pubPath, 'utf8').trim() }
  mkdirSync(join(homedir(), '.ssh'), { recursive: true })
  const pair = utils.generateKeyPairSync('ed25519')
  // 不设口令:普通的 `ssh <别名>` 要能直接跑,不能停下来问密码。
  writeFileSync(path, pair.private, { mode: 0o600 })
  const publicKey = `${pair.public.trim()} ${KEY_COMMENT}`
  writeFileSync(pubPath, `${publicKey}\n`, { mode: 0o644 })
  try {
    chmodSync(path, 0o600)
  } catch {
    // Windows 下靠下面的 icacls。
  }
  if (process.platform === 'win32') {
    // Windows 的 OpenSSH 拒绝「别人也能读」的私钥。node 建的文件继承用户目录的 ACL,显式收紧。
    spawnSync('icacls', [path, '/inheritance:r', '/grant:r', `${process.env.USERNAME ?? ''}:F`], { stdio: 'ignore' })
  }
  return { path, publicKey }
}

/** 一次性连接,认证规则与正常会话一致;identity 是刚装好的那把钥匙,用来证明它真的能用。 */
function connectOnce(conn, secret, identity) {
  const opts = {
    host: conn.host,
    port: conn.port || 22,
    username: conn.username,
    readyTimeout: 20_000,
    ...(bindAddress(conn) ? { localAddress: bindAddress(conn) } : {}),
    hostVerifier: () => true,
  }
  if (identity) {
    opts.privateKey = identity
  } else if (conn.authType === 'password') {
    opts.password = secret || ''
  } else if (conn.authType === 'key') {
    if (!conn.privateKeyPath || !existsSync(conn.privateKeyPath)) throw new Error(`私钥文件不存在:${conn.privateKeyPath ?? '(未设置)'}`)
    opts.privateKey = readFileSync(conn.privateKeyPath)
    if (secret) opts.passphrase = secret
  } else {
    opts.agent = process.env.SSH_AUTH_SOCK
  }

  return new Promise((resolve, reject) => {
    const client = new Client()
    let done = false
    client.on('error', (err) => {
      if (!done) {
        done = true
        reject(err)
      }
    })
    client.once('ready', () => {
      done = true
      resolve(client)
    })
    client.connect(opts)
  })
}

function execOnce(client, command, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err)
      let stdout = ''
      let stderr = ''
      let code = -1
      let done = false
      const finish = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve({ stdout, stderr, code })
      }
      stream.on('data', (b) => (stdout += b.toString('utf8')))
      stream.stderr.on('data', (b) => (stderr += b.toString('utf8')))
      stream.on('exit', (c) => typeof c === 'number' && (code = c))
      stream.on('close', (c) => {
        if (typeof c === 'number') code = c
        finish()
      })
      const timer = setTimeout(() => {
        try {
          stream.close()
        } catch {}
        finish()
      }, timeoutMs)
    })
  })
}

/** 只有固定的 localAddress 进配置文件:网卡地址是今天的租约,普通 ssh 没法现查。 */
function writeSshConfig(conn, alias) {
  const file = sshConfigPath()
  mkdirSync(join(homedir(), '.ssh'), { recursive: true })
  const old = existsSync(file) ? readFileSync(file, 'utf8') : ''
  writeFileSync(file, sshConfigWith(old, { ...conn, alias }), { mode: 0o600 })
  try {
    chmodSync(file, 0o600)
  } catch {
    // Windows 下用户目录的 ACL 本来就够紧。
  }
  return file
}

/** 别名默认取主机地址;本机 config 里已经被别人占掉的别名往后排一个字母。 */
export function aliasFor(conn, oldConfig = '') {
  const used = aliasOwners(oldConfig)
  used.delete(conn.sshAlias || '')
  const keep = String(conn.sshAlias ?? '').trim()
  if (keep && keep.startsWith(String(conn.host).trim())) {
    const others = new Set([...used].filter((a) => a !== keep))
    if (!others.has(keep)) return keep
  }
  return sshAlias(conn.host, used)
}

/**
 * @param {object} conn 连接档案
 * @param {string} secret 这次用的密码/私钥口令(可能来自界面刚输入的)
 * @returns {Promise<{alias, host, port, username, keyPath, configPath, added}>}
 */
export async function setupPasswordless(conn, secret) {
  const key = ensureKey()
  const configPath = sshConfigPath()
  const alias = aliasFor(conn, existsSync(configPath) ? readFileSync(configPath, 'utf8') : '')

  const first = await connectOnce(conn, secret)
  let added = false
  try {
    const r = await execOnce(first, installCommand(key.publicKey))
    if (r.code !== 0) throw new Error(r.stderr.trim() || r.stdout.trim() || `写入 authorized_keys 失败(退出码 ${r.code})`)
    added = r.stdout.includes('added')
  } finally {
    first.end()
  }

  // 装上钥匙不等于允许用:服务器可能 `PubkeyAuthentication no`。先用这把钥匙登录成功了再宣布成功。
  const check = await connectOnce(conn, undefined, readFileSync(key.path))
  try {
    const r = await execOnce(check, 'true')
    if (r.code !== 0) throw new Error('公钥已经写入服务器,但用新密钥登录失败(服务器可能禁用了 PubkeyAuthentication)')
  } finally {
    check.end()
  }

  writeSshConfig(conn, alias)
  return { alias, host: conn.host, port: conn.port || 22, username: conn.username, keyPath: key.path, configPath, added }
}
