// goofish-cli 的薄封装。所有命令都带 --format json，stdout 必须是单个 JSON。
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)

export function createCli({
  command = 'uvx',
  prefix = ['goofish-cli'],
  cwd,
  timeout = 60000,
} = {}) {
  async function run(args) {
    const argv = [...prefix, ...args, '--format', 'json']
    const { stdout } = await execFileP(command, argv, {
      cwd,
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1' },
    })
    const text = String(stdout).trim()
    if (!text) throw new Error(`goofish-cli 无输出：${args.join(' ')}`)
    return JSON.parse(text)
  }

  return {
    // order sold-list 的 page-number / query-code 是 option；confirm 的 order_no 是位置参数。
    soldList: (pageNumber = 1, queryCode = 'NOT_SHIP') =>
      run(['order', 'sold-list', '--page-number', String(pageNumber), '--query-code', queryCode]),

    confirm: (orderNo, tradeText = '') =>
      run(['order', 'confirm', String(orderNo), ...(tradeText ? ['--trade-text', tradeText] : [])]),

    // message send 的 cid / toid 是位置参数；传 item-id 时 cid 会被服务端新建会话覆盖。
    send: ({ cid = '0', toid, itemId = '', text }) =>
      run([
        'message', 'send', String(cid), String(toid),
        '--text', String(text),
        ...(itemId ? ['--item-id', String(itemId)] : []),
      ]),

    status: () => run(['auth', 'status']),
  }
}
