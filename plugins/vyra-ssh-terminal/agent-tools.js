/**
 * AI 面板的工具实现：把引擎的四条不变量落到真实的 SSH 能力上。
 *
 * 引擎（agent.js）只管对话与审批，**不知道**怎么连服务器；这里负责把每一种工具
 * 翻译成一次真实的动作，并统一成引擎要的返回值。
 *
 * 两道执行通道：
 *  - `exec`：打在**用户看得见的终端**里（复用 cd / 环境变量，用户能看着它跑）；
 *  - `exec_detached`：走独立 SSH 通道，不碰用户的终端。
 */
import { readFileSync, existsSync, mkdirSync, createReadStream, createWriteStream, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import * as sftpOps from './sftp.js'

const MAX_READ = 200_000

/** 把一份监控快照压成模型看得懂的几行（比裸 JSON 省 token 也更好读）。 */
function summary(snapshot) {
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)
  const lines = [
    `主机 ${snapshot.info.hostname || '?'} · ${snapshot.info.os || ''} · ${snapshot.info.kernel || ''}`,
    `CPU ${snapshot.cpu.toFixed(1)}% (${snapshot.cpuCores} 核) · 负载 ${snapshot.load.map((x) => x.toFixed(2)).join(' / ')}`,
    `内存 ${pct(snapshot.memUsed, snapshot.memTotal)}% (${snapshot.memUsed} / ${snapshot.memTotal} B)`,
  ]
  if (snapshot.swapTotal) lines.push(`Swap ${pct(snapshot.swapUsed, snapshot.swapTotal)}%`)
  for (const d of snapshot.disk.slice(0, 6)) lines.push(`磁盘 ${d.mount} ${pct(d.used, d.size)}% (${d.size} B)`)
  if (snapshot.gpu.length) for (const g of snapshot.gpu) lines.push(`GPU ${g.name} ${g.util}% ${g.temp}℃`)
  if (snapshot.proc.length) {
    lines.push('进程（按 CPU）:')
    for (const p of snapshot.proc.slice(0, 5)) lines.push(`  ${p.pid} ${p.name} cpu=${p.cpu}% mem=${p.mem}%`)
  }
  return lines.join('\n')
}

/**
 * 建一套工具执行器。
 *
 * @param {object} deps
 * @param {object} deps.connection 当前连接档案
 * @param {() => Promise<object>} deps.session 取一个可用的会话（复用池）
 * @param {() => object|null} deps.terminal 当前界面的终端（`{ id }`），没有就是 null
 * @param {(terminalId: string, command: string, opts?: object) => Promise<{stdout: string, code: number}>} [deps.runInShell]
 * @param {(key: string) => Array<object>} deps.listConnections 列出其它连接（只读）
 * @param {(chunk: string) => Promise<string>} deps.spill 把超长输出落盘并返回 handle
 * @param {(handle: string, offset: number, limit: number) => Promise<string>} deps.readOutput 按 handle 读回
 * @param {(remote: string, local?: string) => Promise<string>} deps.download 目录下载 helper
 * @param {string} [deps.downloadDir] 本机下载落点（默认 ~/Downloads/dsh-ssh）
 */
export function createTools(deps) {
  const timeoutOf = (args) => Math.min(Math.max(Number(args?.timeout_seconds) || 120, 1), 3600) * 1000

  /** 独立通道执行：与宿主的 ssh_exec 工具同一条路。 */
  const detached = async (command, timeoutMs) => {
    const s = await deps.session()
    const r = await s.exec(command, timeoutMs)
    if (r.timedOut) throw Object.assign(new Error(`命令运行 ${timeoutMs / 1000} 秒仍未结束`), { partial: r.stdout })
    return `exit=${r.code}\n${r.stdout}${r.stderr ? `\n[stderr]\n${r.stderr}` : ''}`
  }

  return {
    exec: async (args) => {
      const command = String(args?.command ?? '')
      if (!command.trim()) throw new Error('命令为空')
      const term = deps.terminal?.()
      if (!term?.id) {
        // 没有打开的终端（比如用户关掉了标签）就退回独立通道，而不是干等着。
        return `（没有打开的终端，已改用独立通道执行）\n${await detached(command, timeoutOf(args))}`
      }
      const r = await deps.runInShell(term.id, command, { timeoutMs: timeoutOf(args) })
      return r.stdout || `(无输出) exit=${r.code}`
    },

    exec_detached: async (args) => detached(String(args?.command ?? ''), timeoutOf(args)),

    ls: async (args) => {
      const s = await deps.session()
      const sftp = await s.sftp()
      const path = args?.path || '.'
      const full = await sftpOps.realpath(sftp, path)
      const entries = await sftpOps.listDir(sftp, full)
      entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
      const rows = entries.map((e) => `${e.isDir ? 'd' : '-'} ${String(e.size ?? 0).padStart(10)} ${e.name}${e.isDir ? '/' : ''}`)
      return `${full}\n${rows.join('\n') || '(空目录)'}`
    },

    cat: async (args) => {
      const s = await deps.session()
      const sftp = await s.sftp()
      const path = String(args?.path ?? '')
      if (!path) throw new Error('缺少 path')
      const st = await sftpOps.stat(sftp, path)
      if (st.isDir) throw new Error(`${path} 是目录，用 ls 看目录`)
      if (st.size > MAX_READ) throw new Error(`${path} 有 ${st.size} 字节，超过 ${MAX_READ}，用 exec 里 head/tail/grep 读`)
      const buf = await sftpOps.readFile(sftp, path)
      if (buf.includes(0)) throw new Error(`${path} 看起来是二进制文件`)
      return buf.toString('utf8')
    },

    monitor: async () => {
      const { MONITOR_SCRIPT, parseMonitor } = await import('./monitor.js')
      const s = await deps.session()
      const r = await s.exec('sh -s', 30_000, MONITOR_SCRIPT)
      return summary(parseMonitor(r.stdout))
    },

    mkdir: async (args) => {
      const s = await deps.session()
      await sftpOps.mkdir(await s.sftp(), String(args?.path ?? ''))
      return `已创建 ${args?.path}`
    },

    rm: async (args) => {
      const s = await deps.session()
      const sftp = await s.sftp()
      const path = String(args?.path ?? '')
      if (!path || path === '/') throw new Error('拒绝删除根目录')
      if (args?.recursive) await sftpOps.removeRecursive(sftp, path)
      else await sftpOps.unlink(sftp, path)
      return `已删除 ${path}`
    },

    mv: async (args) => {
      const s = await deps.session()
      await sftpOps.rename(await s.sftp(), String(args?.from ?? ''), String(args?.to ?? ''))
      return `已移动 ${args?.from} → ${args?.to}`
    },

    upload: async (args) => {
      const local = String(args?.local ?? '')
      const remote = String(args?.remote ?? '')
      if (!local || !remote) throw new Error('缺少 local 或 remote')
      if (!existsSync(local)) throw new Error(`本机没有这个文件：${local}`)
      const s = await deps.session()
      const sftp = await s.sftp()
      await pipeline(createReadStream(local), sftp.createWriteStream(remote))
      // 用 stat 拿大小，不要 readFileSync：几百 MB 的包读进内存只为数字节是没有必要的。
      return `已上传 ${local} → ${remote}（${statSync(local).size} 字节）`
    },

    download: async (args) => {
      const remote = String(args?.remote ?? '')
      if (!remote) throw new Error('缺少 remote')
      const dir = deps.downloadDir ?? join(homedir(), 'Downloads', 'dsh-ssh')
      mkdirSync(dir, { recursive: true })
      const s = await deps.session()
      const sftp = await s.sftp()
      const st = await sftpOps.stat(sftp, remote)
      if (st.isDir) {
        // 服务器上先打包再拉回来：远端有 tar 的概率远高于本地有 zip 库。
        const tmp = `/tmp/dsh-ssh-${Date.now()}.tar.gz`
        await detached(`tar czf ${tmp} -C ${shellQuote(remote)} .`, 120_000)
        const target = join(dir, `${basename(remote) || 'download'}.tar.gz`)
        await pipeline(sftp.createReadStream(tmp), createWriteStream(target))
        await detached(`rm -f ${tmp}`, 10_000)
        return `已下载目录 ${remote} → ${target}`
      }
      const target = join(dir, basename(remote) || 'download')
      await pipeline(sftp.createReadStream(remote), createWriteStream(target))
      return `已下载 ${remote} → ${target}`
    },

    read_output: async (args) => deps.readOutput(String(args?.handle ?? ''), Number(args?.offset) || 0, Number(args?.limit) || 8000),

    list_connections: async () => deps.listConnections(),
  }
}

/** 单引号转义：`a b` → `'a b'`，`it's` → `'it'\''s'`。 */
export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}
