// vendor/worker.py 的薄封装。
//
// worker 借 PyPI 版 goofish-cli 的登录态与 IM 能力，自带 sold-list / confirm
// 两个命令（上游 CLI 还没有）。默认用 `uv run --with goofish-cli`，首次会解析
// 依赖，之后有缓存。
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileP = promisify(execFile)
export const WORKER_PATH = fileURLToPath(new URL('../vendor/worker.py', import.meta.url))
export const defaultPrefix = () => ['run', '--with', 'goofish-cli', 'python', WORKER_PATH]

const DEFAULT_WORKER = WORKER_PATH

export function createCli({
  command = 'uv',
  prefix = ['run', '--with', 'goofish-cli', 'python', DEFAULT_WORKER],
  cwd,
  timeout = 120000,
} = {}) {
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
      if (!retried && /FAIL_SYS_TOKEN_EXOIRED|FAIL_SYS_TOKEN_EMPTY|FAIL_SYS_SESSION_EXPIRED|令牌过期/i.test(msg)) {
        try { await run('refresh', {}, true) } catch { /* 刷新失败就抛原错误 */ }
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
