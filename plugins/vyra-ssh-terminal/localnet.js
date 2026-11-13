/**
 * 本机网卡:连接从哪个本地地址出去。
 *
 * 固定地址在 VPN 重拨后就会指向一个已经不存在的租约;网卡名在每次连接时现查地址,
 * 所以两者都设时网卡优先。两者都取不到时返回 undefined(交给操作系统选路),
 * 而不是报错——绑定地址本来只是给 socket 的一个提示。
 */
import { networkInterfaces } from 'node:os'

const addrOf = (addrs) => {
  if (!Array.isArray(addrs)) return undefined
  // IPv4 优先:VPN 隧道上的 v6 地址多半是链路本地地址,绑了也没用。
  return (addrs.find((a) => a.family === 'IPv4' && !a.internal) ?? addrs.find((a) => !a.internal))?.address
}

/** @param {Record<string, any[]>} [interfaces] 测试时注入,生产用真的网卡表。 */
export function bindAddress(conn, interfaces = networkInterfaces()) {
  const iface = String(conn?.localIface ?? '').trim()
  if (iface) {
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (name !== iface) continue
      const address = addrOf(addrs)
      if (address) return address
    }
  }
  return String(conn?.localAddress ?? '').trim() || undefined
}

/** 连接对话框的下拉项:只有非内部 IPv4 地址——VPN 隧道正好在这个集合里。 */
export function localInterfaces(interfaces = networkInterfaces()) {
  const out = []
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const a of addrs ?? []) if (!a.internal && a.family === 'IPv4') out.push({ name, address: a.address })
  }
  return out
}
