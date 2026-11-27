// 夸克网盘适配器。
//
// 只做一件事：把「网盘里的一个路径」变成「一条可用的分享链接」。
// 这里不经过大模型：发货内容是确定性的，出任何问题都抛带分类的 Error，
// 由 dispatch 映射成 blocked + 待人工 + 通知卖家。
//
// 真实 CLI（官方 quarkclouddrive skill 自带）：
//   node scripts/quark-drive.cjs login --token <授权码> --session-id <id>
//   node scripts/quark-drive.cjs browse --parent-fid <fid|0> [--page-size N]
//       → 结构化结果写到 <cwd>/browse/*.jsonl（stdout 只有摘要）
//   node scripts/quark-drive.cjs share <fid> --title <t> --url-type 2 --expired-type N
//       → stdout 一行 JSON：{ code, msg, data: { share_url, passcode } }
//
// expireDays → --expired-type：1=永久 2=1天 3=7天 4=30天 5=60天 6=100天 7=180天
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { findQuarkCli, credentialLocations } from './locate.js'

const execFileP = promisify(execFile)

export const DEFAULT_ROOT = join(homedir(), '.quarkcd')
export const SESSION_ID = 'xianyu-delivery'

const EXPIRED_TYPES = { 1: 2, 7: 3, 30: 4, 60: 5, 100: 6, 180: 7 }

/** 天数 → --expired-type。没有精确匹配时取不小于该天数的最小档。 */
export function expiredTypeFor(expireDays) {
  const days = Number(expireDays) || 7
  if (EXPIRED_TYPES[days]) return EXPIRED_TYPES[days]
  const candidates = Object.keys(EXPIRED_TYPES).map(Number).sort((a, b) => a - b)
  const hit = candidates.find((d) => d >= days) ?? 180
  return EXPIRED_TYPES[hit]
}

/**
 * 用哪个解释器跑 CLI。
 * 宿主是 Electron（DSH 桌面版）时 process.execPath 指向应用本体，不能当 node 用；
 * 这时优先找 ELECTRON_RUN_AS_NODE 或 PATH 里的 node。
 */
export function resolveNodeBinary(env = process.env) {
  const fromEnv = String(env.DSH_NODE_BINARY || env.NODE_BINARY || '').trim()
  if (fromEnv) return fromEnv
  // 普通 Node 进程：自己就能当解释器。
  if (!process.versions?.electron) return process.execPath
  // Electron 宿主（DSH 桌面版）的 process.execPath 是应用本体，不能当 node 用。
  return process.platform === 'win32' ? 'node.exe' : 'node'
}

/** 用系统 node 跑 CLI；timeout 到了就杀，避免拖住整轮发货。 */
function defaultRunner(root, { timeoutMs = 60000, cwd, script: scriptOption } = {}) {
  const script = scriptOption || join(root, 'scripts', 'quark-drive.cjs')
  const bin = resolveNodeBinary()
  return async (argv, options = {}) => {
    const { stdout } = await execFileP(bin, [script, ...argv], {
      cwd: options.cwd ?? cwd ?? root,
      timeout: options.timeoutMs ?? timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        NO_COLOR: '1',
        // 夸克 CLI 用 DSH_HOME 辨认运行环境，缺了会报「无法识别当前 Agent 环境」。
        DSH_HOME: process.env.DSH_HOME || join(homedir(), '.dsh'),
        DSH_SESSION_ID: process.env.DSH_SESSION_ID || SESSION_ID,
      },
    })
    return { stdout: String(stdout || '') }
  }
}

/** CLI 的 stdout 末尾一行是结构化 JSON，前面可能有进度日志。 */
export function parseCliJson(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].startsWith('{')) continue
    try {
      return JSON.parse(lines[i])
    } catch {
      // 继续往前找
    }
  }
  return null
}

/** browse 把结果写到 browse/*.jsonl，取最新一份。 */
export function readLatestBrowse(cwd) {
  const dir = join(cwd, 'browse')
  let files = []
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
  } catch {
    return []
  }
  if (!files.length) return []
  files.sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs)
  const body = readFileSync(join(dir, files[0]), 'utf8')
  const rows = []
  for (const line of body.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    try {
      rows.push(JSON.parse(text))
    } catch {
      // 跳过坏行
    }
  }
  return rows
}

function netdiskError(code, message) {
  const err = new Error(`${code}${message ? `:${message}` : ''}`)
  err.code = code
  return err
}

export function createQuark({
  root = null,
  cwd: cwdOption = null,
  runner,
  timeoutMs = 60000,
  fetchImpl = globalThis.fetch,
} = {}) {
  // 有注入的 runner（测试）时不需要真 CLI；否则现找。
  const located = runner ? { root: root || DEFAULT_ROOT, script: null } : findQuarkCli(root ? [root] : [])
  if (!runner && !located) {
    return {
      id: 'quark',
      label: '夸克网盘',
      async probe() { return { ok: false, error: `cli_not_installed:${root || DEFAULT_ROOT}` } },
      async authState() { return { state: 'unauthorized', hint: 'cli_not_installed' } },
      async login() { throw netdiskError('cli_not_installed', root || DEFAULT_ROOT) },
      async list() { return [] },
      async resolve() { throw netdiskError('cli_not_installed', root || DEFAULT_ROOT) },
      async share() { throw netdiskError('cli_not_installed', root || DEFAULT_ROOT) },
      async verify() { return { ok: false, status: 0, error: 'cli_not_installed' } },
      credentialLocations: () => [],
      setFakeBrowse() {},
    }
  }
  const cliRoot = located.root
  // 凭证按 CLI 进程的 cwd 解析（<cwd>/<agentId>/config.json），所以 cwd 必须固定。
  const workDir = cwdOption || cliRoot
  const run = runner ?? defaultRunner(workDir, { timeoutMs, cwd: workDir, script: located.script })
  // 测试用：直接给出某一层目录的内容，绕过真实文件系统。
  let fakeBrowse = null

  /** 未登录时 CLI 会以非零码退出，所以 authState 需要拿到 stdout 而不是抛错。 */
  async function callAllowFailure(argv, options = {}) {
    const bin = resolveNodeBinary()
    try {
      const { stdout } = await execFileP(bin, [located.script, ...argv], {
        cwd: options.cwd ?? workDir,
        timeout: options.timeoutMs ?? timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          NO_COLOR: '1',
          DSH_HOME: process.env.DSH_HOME || join(homedir(), '.dsh'),
          DSH_SESSION_ID: process.env.DSH_SESSION_ID || SESSION_ID,
        },
      })
      return String(stdout || '')
    } catch (err) {
      // execFile 失败时 stdout 在 error.stdout 上
      return String(err?.stdout || '')
    }
  }

  async function call(argv, options = {}) {
    try {
      return await run(argv, options)
    } catch (err) {
      const text = `${err?.message || err} ${err?.stderr || ''}`.trim()
      if (/ETIMEDOUT|timed out|killed/i.test(text) || err?.killed) {
        throw netdiskError('netdisk_timeout', argv[0])
      }
      if (/ENOENT/.test(text)) {
        // 区分「没有 node」和「没有夸克 CLI 脚本」，面板上的处理方式不同。
        if (/spawn .*node/i.test(text) || /node(\.exe)?'?\s*ENOENT/i.test(text)) {
          throw netdiskError('node_not_found', '找不到 node，可在环境变量 DSH_NODE_BINARY 指定路径')
        }
        throw netdiskError('cli_not_installed', root)
      }
      // node 能找到但脚本不在：同样是「没装 Skill」，要给出可操作的提示。
      if (/Cannot find module/i.test(text)) throw netdiskError('cli_not_installed', root)
      // CLI 的退出码错误信息在 stdout 里（错误原因也写在 message 上），要把它带出来。
      const errJson = parseCliJson(text) || parseCliJson(String(err?.stdout || ''))
      if (errJson?.msg) throw netdiskError(`cli_${argv[0]}_failed`, errJson.msg)
      throw netdiskError('cli_failed', text.slice(0, 300))
    }
  }

  async function json(argv) {
    const { stdout } = await call(argv)
    const data = parseCliJson(stdout)
    if (!data) throw netdiskError('cli_bad_output', String(stdout).slice(-200))
    return data
  }

  async function browse(parentFid) {
    if (fakeBrowse) return fakeBrowse(parentFid) ?? []
    try {
      mkdirSync(join(workDir, 'browse'), { recursive: true })
    } catch {
      // 目录已存在
    }
    // --page-size 上限是 100（传 200 会返回 -703）；要取全目录用 --all。
    const { stdout } = await call([
      'browse', '--parent-fid', String(parentFid), '--page-size', '100', '--all',
    ])
    const res = parseCliJson(stdout)
    if (res?.code !== undefined && res.code !== 0) {
      throw netdiskError('cli_browse_failed', res.msg || `code=${res.code}`)
    }
    // CLI 会把结果写进 <cwd>/browse/*.jsonl，但 stdout 里也带着同一份，优先用 stdout。
    if (Array.isArray(res?.data?.file_list)) return res.data.file_list
    return readLatestBrowse(workDir)
  }

  return {
    id: 'quark',
    label: '夸克网盘',

    /** 当前使用的 CLI 根目录与凭证搜索位置，面板上要能看到。 */
    info() {
      return { root: cliRoot, cwd: workDir, credentials: credentialLocations(cliRoot) }
    },

    async probe() {
      try {
        const { stdout } = await call(['--version'])
        return { ok: true, version: String(stdout).trim(), root: cliRoot, cwd: workDir }
      } catch (err) {
        return { ok: false, error: String(err?.message || err) }
      }
    },

    /** 授权码登录。成功返回 { ok, account }。 */
    async login({ authCode }) {
      if (!String(authCode || '').trim()) throw netdiskError('auth_code_required')
      const res = await json(['login', '--token', String(authCode).trim(), '--session-id', SESSION_ID])
      if (res.code !== 0) throw netdiskError('login_failed', res.msg || `code=${res.code}`)
      return { ok: true, status: res.data?.status ?? 'ok', account: 'quark' }
    },

    /** 能不能列目录 = 是否已授权。 */
    async authState() {
      try {
        const stdout = runner ? (await run(['get-user-info'])).stdout : await callAllowFailure(['get-user-info'])
        const res = parseCliJson(stdout)
        if (!res) return { state: 'unknown', hint: 'cli_bad_output' }
        if (res.code === 0) {
          const data = res.data || {}
          return { state: 'authorized', hint: '', account: data.nickname || data.userName || data.userId || '' }
        }
        // -103 = 未登录；其余（授权失效等）按未授权处理，让面板提示重新贴授权码。
        return { state: 'unauthorized', hint: res.msg || `code=${res.code}` }
      } catch (err) {
        const message = String(err?.message || err)
        if (/unauthor|未授权|未登录|login/i.test(message)) return { state: 'unauthorized', hint: message }
        return { state: 'unknown', hint: message }
      }
    },

    /** 列一层目录：返回 [{ filename, fid, is_dir, size }]。 */
    async list(parentFid = '0') {
      const rows = await browse(parentFid)
      return rows.map((row) => ({
        filename: String(row.filename || ''),
        fid: String(row.fid || ''),
        is_dir: String(row.file_type ?? '0') === '0',
        size: Number(row.size) || 0,
      }))
    },

    /**
     * 「A/B/C.zip」→ { fid, filename, size }。
     * 逐段目录直查；任何一段找不到就抛 path_not_found:<段>，绝不退回关键词搜索。
     */
    async resolve(path) {
      const segments = String(path || '')
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
      if (!segments.length) throw netdiskError('path_required')

      let parent = '0'
      let hit = null
      for (let i = 0; i < segments.length; i += 1) {
        const want = segments[i]
        const entries = await this.list(parent)
        hit = entries.find((entry) => entry.filename === want)
        if (!hit) throw netdiskError('path_not_found', want)
        if (i < segments.length - 1) {
          if (!hit.is_dir) throw netdiskError('path_not_dir', want)
          parent = hit.fid
        }
      }
      return { fid: hit.fid, filename: hit.filename, size: hit.size }
    },

    /** 创建分享。返回 { share_url, passcode, url_type }。 */
    async share({ fid, title = '', expireDays = 7, urlType = 2 }) {
      if (!fid) throw netdiskError('fid_required')
      const res = await json([
        'share', String(fid),
        '--title', String(title || 'Xianyu'),
        '--url-type', String(urlType),
        '--expired-type', String(expiredTypeFor(expireDays)),
        '--session-id', SESSION_ID,
      ])
      if (res.code !== 0) throw netdiskError('share_failed', res.msg || `code=${res.code}`)
      const url = String(res.data?.share_url || '')
      if (!url) throw netdiskError('share_failed', 'empty share_url')
      return {
        share_url: url,
        passcode: String(res.data?.passcode || ''),
        url_type: Number(res.data?.url_type ?? urlType),
      }
    },

    /** 分享链接可访问性校验：能拿到 2xx/3xx 就算通。 */
    async verify({ shareUrl }) {
      if (typeof fetchImpl !== 'function') return { ok: false, status: 0, error: 'fetch_unavailable' }
      try {
        const res = await fetchImpl(shareUrl, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000) })
        const status = Number(res.status)
        if (status >= 200 && status < 400) return { ok: true, status }
        return { ok: false, status, error: `status_${status}` }
      } catch (err) {
        return { ok: false, status: 0, error: String(err?.message || err) }
      }
    },

    // ---- 仅测试使用 ----
    setFakeBrowse(fn) {
      fakeBrowse = fn
    },
  }
}
