// 用真实账号数据验证轮询判定：是不是买家、有没有文本、有没有 itemId。
import { createCli, defaultPrefix } from '../lib/cli.js'
const cli = createCli({ command: 'uv', prefix: defaultPrefix() })
const data = await cli.chats(20)
const self = process.argv[2] || ''
for (const s of data.sessions.slice(0, 5)) {
  const h = await cli.history(s.session_id, 4)
  const last = h[h.length - 1]
  const isSelf = String(last?.send_user_id) === self
  const text = String(last?.message?.text?.text || '').trim()
  console.log(`${s.session_id} item=${s.item_id || '-'} last=${isSelf ? 'self' : 'buyer'}:${text.slice(0, 20)} reply=${!isSelf && !!text && !!s.item_id}`)
}
