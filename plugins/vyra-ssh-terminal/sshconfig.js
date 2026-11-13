/**
 * 让配好免密登录之后 `ssh <别名>` 直接能用。纯字符串拼接和配置合并,不碰文件系统,
 * 这样引号和「保留文件里其它配置」的行为可以用 node 断言验证。
 *
 * 结构照搬 liteshell 的 sshconfig.ts:块用注释标记包起来,重写时按标记整块替换,
 * 其它字节原样保留。
 */

const shellQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/** 幂等:公钥已经在文件里就只回一个 present,不会写成两行。 */
export function installCommand(publicKey) {
  const key = shellQuote(publicKey)
  return [
    'umask 077',
    'mkdir -p ~/.ssh',
    'touch ~/.ssh/authorized_keys',
    `if grep -qxF ${key} ~/.ssh/authorized_keys; then echo present; ` +
      `else printf '%s\\n' ${key} >> ~/.ssh/authorized_keys; echo added; fi`,
    'chmod 700 ~/.ssh',
    'chmod 600 ~/.ssh/authorized_keys',
  ].join('; ')
}

/** 别名默认取地址;同一地址上的第二条连接用字母后缀区分。 */
export function sshAlias(host, taken = []) {
  const used = new Set(taken)
  const base = String(host ?? '').trim()
  if (!used.has(base)) return base
  for (const suffix of 'abcdefghijklmnopqrstuvwxyz') {
    const candidate = `${base}-${suffix}`
    if (!used.has(candidate)) return candidate
  }
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`
}

const blockStart = (key) => `# >>> SSH Terminal: ${key} >>>`
const blockEnd = (key) => `# <<< SSH Terminal: ${key} <<<`

/**
 * 生成写进 ~/.ssh/config 的那一块。只有固定的 localAddress 会进去:网卡的地址是
 * 今天的租约,普通 ssh 没有地方再解析一次,写死之后重拨一次就再也登不上。
 *
 * @param {string} old 现有配置全文
 * @param {{id: string, host: string, port?: number, username: string, localAddress?: string, alias?: string, identityFile?: string}} conn
 */
export function sshConfigWith(old, conn) {
  const key = conn.alias ?? conn.host
  const stale = new Set([key, `ssh-terminal-${conn.id}`])
  const kept = []
  let skipping = null
  let at = -1
  for (const line of String(old ?? '').split(/\r?\n/)) {
    const t = line.trim()
    const start = [...stale].find((k) => t === blockStart(k))
    if (start) {
      if (at < 0) at = kept.length
      skipping = start
      continue
    }
    if (skipping) {
      if (t === blockEnd(skipping)) skipping = null
      continue
    }
    kept.push(line)
  }

  const bind = String(conn.localAddress ?? '').trim()
  const block = [
    blockStart(key),
    `Host ${key}`,
    `    HostName ${conn.host}`,
    `    User ${conn.username}`,
    ...(Number(conn.port) && Number(conn.port) !== 22 ? [`    Port ${conn.port}`] : []),
    ...(bind ? [`    BindAddress ${bind}`] : []),
    `    IdentityFile ${conn.identityFile ?? '~/.ssh/dsh_ed25519'}`,
    '    IdentitiesOnly yes',
    blockEnd(key),
  ].join('\n')

  // 第一次写放最顶:vim 之外的读者(以及 ssh 自己)是按顺序取第一个匹配的 Host。
  const cut = at < 0 ? 0 : at
  const before = kept.slice(0, cut).join('\n').replace(/\n+$/, '')
  const after = kept.slice(cut).join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  return [before, block, after].filter(Boolean).join('\n\n')
}

/** 配置文件里已经用掉的别名(只认我们自己写的块)。 */
export function aliasOwners(old) {
  const out = new Set()
  for (const line of String(old ?? '').split(/\r?\n/)) {
    const m = line.trim().match(/^# >>> SSH Terminal: (.+) >>>$/)
    if (m) out.add(m[1])
  }
  return out
}
