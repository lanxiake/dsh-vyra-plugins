// Fake sidecar for the protocol test: same frames as vendor/wechat/sidecar.py, no Python.
import { createInterface } from 'node:readline'

function send(frame) {
  process.stdout.write(`${JSON.stringify(frame)}\n`)
}

createInterface({ input: process.stdin }).on('line', (line) => {
  const text = line.trim()
  if (!text) return
  const req = JSON.parse(text)
  if (req.method === 'initialize') {
    send({
      id: req.id,
      ok: true,
      data: { version: 'test', tools: [{ name: 'list_sessions', inputSchema: { type: 'object', properties: {} } }] },
    })
    return
  }
  if (req.method === 'call') {
    send({ id: req.id, type: 'progress', message: 'working', progress: 1, total: 2 })
    if (req.tool === 'boom') {
      send({ id: req.id, ok: false, isError: true, content: [{ type: 'text', text: 'ERROR: env_not_ready' }] })
    } else {
      send({ id: req.id, ok: true, content: [{ type: 'text', text: JSON.stringify(req.args) }] })
    }
    return
  }
  if (req.method === 'shutdown') {
    send({ id: req.id, ok: true, data: {} })
    process.exit(0)
  }
})