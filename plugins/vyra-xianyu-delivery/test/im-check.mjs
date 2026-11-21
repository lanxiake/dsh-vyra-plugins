// 常驻 IM 通道自检：起一个 serve 进程，连发 5 条 chats，确认复用连接且够快。
import { createIm } from '../lib/im.js'
import { defaultPrefix } from '../lib/cli.js'

const im = createIm({ command: 'uv', prefix: defaultPrefix(), logger: (m) => console.log('[im]', m) })

const started = Date.now()
await im.ensure()
console.log('ready after', Date.now() - started, 'ms')

const timings = []
for (let i = 0; i < 5; i += 1) {
  const t = Date.now()
  const data = await im.chats(10)
  timings.push(Date.now() - t)
  if (i === 0) console.log('sessions:', data.sessions.length, 'first:', data.sessions[0]?.session_id)
}

const avg = timings.reduce((a, b) => a + b, 0) / timings.length
console.log('chats ms:', timings.join(','), 'avg', Math.round(avg))
if (avg > 1500) throw new Error(`复用连接后仍然慢：平均 ${Math.round(avg)}ms`)

const history = await im.history('69360436252', 3)
console.log('history msgs:', history.length, 'last:', String(history.at(-1)?.message?.text?.text || '').slice(0, 20))
console.log('im-check ok')
im.dispose()
