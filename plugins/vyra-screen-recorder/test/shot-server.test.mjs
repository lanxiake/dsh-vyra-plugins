import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const windows = process.platform === 'win32'
const timeout = 120000

/** 启动常驻截图服务，返回逐请求的 send()。 */
function startServer() {
  const child = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', path.join(here, '..', 'lib', 'shot-server.ps1'),
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  let buffer = ''
  const pending = []
  let ready = null
  child.stdout.on('data', chunk => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line === 'READY') {
        if (ready) ready()
      } else if (line) {
        const request = pending.shift()
        if (request) request(line)
      }
      index = buffer.indexOf('\n')
    }
  })
  const startedAt = Date.now()
  const waitReady = new Promise((resolve, reject) => {
    ready = resolve
    const timer = setTimeout(() => reject(new Error('截图服务启动超时')), 30000)
    child.once('exit', code => reject(new Error('截图服务提前退出：' + code)))
    child.once('error', reject)
    const original = ready
    ready = () => { clearTimeout(timer); original() }
  })
  return {
    child,
    startedAt,
    waitReady,
    send(request) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('截图请求超时')), 20000)
        pending.push(line => { clearTimeout(timer); resolve(line) })
        child.stdin.write(JSON.stringify(request) + '\n')
      })
    },
    async stop() {
      try { child.stdin.write('quit\n') } catch { /* ignore */ }
      await new Promise(resolve => {
        const timer = setTimeout(() => { try { child.kill() } catch { /* ignore */ } resolve() }, 3000)
        child.once('exit', () => { clearTimeout(timer); resolve() })
      })
    },
  }
}

test('shot-server.ps1 常驻截图：首张快、中文路径可用', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-shot-server-测试-'))
  const server = startServer()
  try {
    await server.waitReady
    const bootMs = Date.now() - server.startedAt
    assert.ok(bootMs < 30000, '启动太慢：' + bootMs)

    const timings = []
    for (let index = 0; index < 3; index++) {
      const file = path.join(dir, '截图-' + index + '.jpg')
      const startedAt = Date.now()
      const line = await server.send({ out: file, quality: 80, region: '0,0,320,240' })
      timings.push(Date.now() - startedAt)
      assert.match(line, /^OK hidden=\d+$/)
      const buffer = await readFile(file)
      assert.ok(buffer.length > 500, 'JPEG 太小：' + buffer.length)
      assert.deepEqual([...buffer.subarray(0, 3)], [0xff, 0xd8, 0xff])
    }
    // 常驻之后单张截图必须远快于每次冷启动的 2 秒以上。
    assert.ok(Math.max(...timings) < 1500, '截图太慢：' + timings.join(' / ') + ' ms')

    const bad = await server.send({ out: path.join(dir, 'bad.jpg'), region: '1,2,3' })
    assert.match(bad, /^ERR /)
  } finally {
    await server.stop()
    await rm(dir, { recursive: true, force: true })
  }
})
