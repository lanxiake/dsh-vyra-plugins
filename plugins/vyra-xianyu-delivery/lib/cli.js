// vendor/worker.py 的薄封装。
//
// worker 借 PyPI 版 goofish-cli 的登录态与 IM 能力，自带 sold-list / confirm
// 两个命令（上游 CLI 还没有）。默认用 `uv run --with goofish-cli`，首次会解析
// 依赖，之后有缓存。
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const execFileP = promisify(execFile)
export const WORKER_PATH = fileURLToPath(new URL('../vendor/worker.py', import.meta.url))
export const defaultPrefix = () => ['run', '--with', 'goofish-cli', 'python', WORKER_PATH]

const DEFAULT_WORKER = WORKER_PATH
const COOKIE_PATH = join(homedir(), '.goofish-cli', 'cookies.json')
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000

/** 没登录时没有任何可刷新的东西：此时尝试刷新只会弹出浏览器要扫码。 */
function hasCookies() {
  try {
    return statSync(COOKIE_PATH).size > 2
  } catch {
    return false
  }
}

export function createCli({
  command = 'uv',
  prefix = ['run', '--with', 'goofish-cli', '--with', 'portalocker', 'python', DEFAULT_WORKER],
  cwd,
  timeout = 120000,
} = {}) {
  // 自动刷新失败后进入冷却，避免每轮轮询都重新拉起浏览器。
  let refreshBlockedUntil = 0

  async function run(op, args, retried = false) {
    const argv = [...prefix, op, JSON.stringify(args ?? {})]
    try {
      const { stdout } = await execFileP(command, argv, {
        cwd,
        timeout,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, NO_COLOR: '1', PYTHONIOENCODING: 'utf-8' },
      })
      const text = String(stdout).trim()
      if (!text) throw new Error(`worker 无输出：${op}`)
      // worker 只打印一行 JSON；前面的日志（如果有）会走 stderr。
      const line = text.split(/\r?\n/).filter(Boolean).pop()
      const json = JSON.parse(line)
      if (!json.ok) throw new Error(json.error || `worker ${op} failed`)
      return json.data
    } catch (err) {
      const msg = String(err?.message || err)
      // _m_h5_tk 只有约十分钟有效期；过期时先免密刷新一次再重试原命令。
      // 但没登录 / 刚刷新失败过就不再尝试：否则每次轮询都会弹一个扫码浏览器。
      if (!retried && /FAIL_SYS_TOKEN_EXOIRED|FAIL_SYS_TOKEN_EMPTY|FAIL_SYS_SESSION_EXPIRED|令牌过期/i.test(msg)) {
        if (!hasCookies()) throw err
        if (Date.now() < refreshBlockedUntil) throw err
        let refreshed = false
        try {
          await run('refresh', { headful: false }, true)
          refreshed = true
        } catch {
          // 刷新失败：冷却十分钟，期间直接用原始错误返回。
          refreshBlockedUntil = Date.now() + REFRESH_COOLDOWN_MS
        }
        if (!refreshed) throw err
        return run(op, args, true)
      }
      // uv 在 Windows 上偶发 "Failed to update Windows PE resources"（杀毒/权限），
      // 稍等重试一次通常就好。
      if (!retried && /Failed to update Windows PE resources/i.test(msg)) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        return run(op, args, true)
      }
      throw err
    }
  }

  return {
    soldList: (pageNumber = 1, queryCode = 'NOT_SHIP') =>
      run('sold-list', { pageNumber, queryCode }),

    confirm: (orderId, tradeText = '') =>
      run('confirm', { orderId, tradeText }),

    send: ({ cid = '0', toid, itemId = '', text }) =>
      run('send', { cid, toid, itemId, text }),

    status: () => run('status', {}),

    history: (cid, limit = 10) => run('history', { cid, limit }),
    items: (limit = 50) => run('items', { limit }),
    chats: (fetchNum = 200) => run('chats', { fetchNum }),
    userInfo: (cid, owner = false) => run('user-info', { cid, owner }),
    itemDetail: (itemId) => run('item-detail', { itemId }),
    orderDetail: (orderId) => run('order-detail', { orderId }),
  }
}
