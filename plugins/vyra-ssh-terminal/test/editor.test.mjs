/**
 * 内置编辑器的读写与冲突处理。
 *
 * 编辑器最危险的时刻是「保存」：写错就是文件没了。这里用假的 SFTP 把三条路径跑一遍：
 *  1. 正常保存 → 临时文件 → 沿用权限 → rename；
 * 2. 别人改过 → 先拒绝，用户坚持才覆盖；
 *  3. 新文件（原来不存在）→ 直接写。
 */
import assert from 'node:assert/strict'
import { createRouter, BASE } from '../routes.js'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const results = []
const test = async (name, fn) => {
  try {
    await fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    results.push(`✗ ${name}\n  ${e instanceof Error ? e.stack : e}`)
    process.exitCode = 1
  }
}

const dir = mkdtempSync(join(tmpdir(), 'ssh-editor-'))
process.env.DSH_PROFILE_DIR = dir

/** 假 SFTP：内存里一个文件表。 */
function fakeSftp(initial = {}) {
  const files = new Map(Object.entries(initial))
  const chmods = []
  return {
    files,
    chmods,
    stat(path, cb) {
      if (!files.has(path)) return cb(Object.assign(new Error('No such file'), { code: 2 }))
      const f = files.get(path)
      // 与真实 sftp.js 的 stat 对齐：**秒 → 毫秒**
      cb(null, { mode: 0o100644, size: Buffer.byteLength(f.text), mtime: f.mtime })
    },
    readFile(path, cb) {
      const f = files.get(path)
      f ? cb(null, Buffer.from(f.text)) : cb(Object.assign(new Error('ENOENT'), { code: 2 }))
    },
    writeFile(path, data, cb) {
      files.set(path, { text: Buffer.from(data).toString('utf8'), mtime: 1000, mode: 0o644 })
      cb(null)
    },
    chmod(path, mode, cb) {
      chmods.push([path, mode])
      cb(null)
    },
    rename(a, b, cb) {
      if (!files.has(a)) return cb(Object.assign(new Error('ENOENT'), { code: 2 }))
      files.set(b, files.get(a))
      files.delete(a)
      cb(null)
    },
  }
}

function makeServer(sftp) {
  const connections = {
    connections: new Map([['c1', { id: 'c1', name: 'web-01', host: '1.2.3.4', port: 22, username: 'u', authType: 'agent' }]]),
    folders: new Map(),
    list: () => [{ id: 'c1', name: 'web-01', host: '1.2.3.4', port: 22, username: 'u', authType: 'agent' }],
    get: (id) => (id === 'c1' ? { id: 'c1', name: 'web-01', host: '1.2.3.4', port: 22, username: 'u', authType: 'agent' } : undefined),
    resolve: () => ({ conn: connections.get('c1') }),
    secretsFor: async () => ({ secrets: {}, keySecrets: {} }),
  }
  const session = { sftp: async () => sftp, exec: async () => ({ stdout: '', stderr: '', code: 0 }) }
  const pool = { acquire: async () => session }
  const router = createRouter({ connections, terminals: {}, pool, history: {} })
  const server = createServer((req, res) => {
    const route = decodeURIComponent(req.url.split('?')[0]).slice(BASE.length)
    router(route, req, res).catch((e) => {
      res.writeHead(500)
      res.end(String(e))
    })
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)))
}

/** 关服务器要等回调：立刻 process.exit 会在 Windows 上触发 libuv 的关闭断言。 */
const closeServer = (server) => new Promise((r) => server.close(() => r()))

const call = async (server, path) => {
  const res = await fetch(`http://127.0.0.1:${server.address().port}${BASE}${path}`)
  return { status: res.status, body: await res.json() }
}
const post = async (server, path, body) => {
  const res = await fetch(`http://127.0.0.1:${server.address().port}${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

await test('读：返回文本、大小与 mtime', async () => {
  const sftp = fakeSftp({ '/etc/x.conf': { text: 'a=1', mtime: 111 } })
  const server = await makeServer(sftp)
  const r = await call(server, 'files/read?connection=c1&path=%2Fetc%2Fx.conf')
  assert.equal(r.status, 200)
  assert.equal(r.body.text, 'a=1')
  // 真实 sftp.js 的 stat 会把秒 *1000；这里只断言「有 mtime 且前后一致」
  assert.equal(typeof r.body.mtime, 'number')
  await closeServer(server)
})

await test('读：非 UTF-8 明确拒绝（不让用户改完存回去变乱码）', async () => {
  const sftp = fakeSftp({ '/etc/x.conf': { text: 'x', mtime: 111 } })
  // 覆盖文件内容为 GBK 字节，但保留 stat 的元信息
  sftp.readFile = (p, cb) => cb(null, Buffer.from([0xd6, 0xd0, 0xce, 0xc4])) // "中文" 的 GBK
  const server = await makeServer(sftp)
  const r = await call(server, 'files/read?connection=c1&path=%2Fetc%2Fx.conf')
  assert.equal(r.status, 415)
  assert.equal(r.body.code, 'not_utf8')
  await closeServer(server)
})

await test('写：走临时文件 → 沿用原权限 → rename', async () => {
  const sftp = fakeSftp({ '/etc/x.conf': { text: 'a=1', mtime: 111 } })
  const server = await makeServer(sftp)
  // 先读一次拿真实的 mtime（编辑器就是这样做的），再用它去写
  const read = await call(server, 'files/read?connection=c1&path=%2Fetc%2Fx.conf')
  const r = await post(server, 'files/write', { connection: 'c1', path: '/etc/x.conf', text: 'a=2', mtime: read.body.mtime })
  assert.equal(r.status, 200)
  assert.equal(sftp.files.get('/etc/x.conf').text, 'a=2')
  assert.equal(sftp.chmods.length, 1, '必须沿用原权限')
  assert.equal(sftp.chmods[0][1], 0o644)
  assert.ok([...sftp.files.keys()].every((k) => !k.includes('.dsh-tmp-')), '临时文件不能留下')
  await closeServer(server)
})

await test('写：mtime 变了就拒绝，不让覆盖别人刚改的内容', async () => {
  const sftp = fakeSftp({ '/etc/x.conf': { text: 'a=1', mtime: 222 } })
  const server = await makeServer(sftp)
  // 带一个**过时**的 mtime：模拟「打开之后别人又改了一次」
  const r = await post(server, 'files/write', { connection: 'c1', path: '/etc/x.conf', text: 'a=2', mtime: 1 })
  assert.equal(r.status, 409)
  assert.equal(r.body.code, 'mtime_changed')
  assert.equal(sftp.files.get('/etc/x.conf').text, 'a=1', '被拒绝时原文件一个字都不能动')
  await closeServer(server)
})

await test('写：用户坚持覆盖（不带 mtime）时放行', async () => {
  const sftp = fakeSftp({ '/etc/x.conf': { text: 'a=1', mtime: 222 } })
  const server = await makeServer(sftp)
  const r = await post(server, 'files/write', { connection: 'c1', path: '/etc/x.conf', text: 'a=2' })
  assert.equal(r.status, 200)
  assert.equal(sftp.files.get('/etc/x.conf').text, 'a=2')
  await closeServer(server)
})

await test('写：新文件（原来不存在）直接创建', async () => {
  const sftp = fakeSftp({})
  const server = await makeServer(sftp)
  const r = await post(server, 'files/write', { connection: 'c1', path: '/tmp/new.txt', text: 'hi', mtime: null })
  assert.equal(r.status, 200)
  assert.equal(sftp.files.get('/tmp/new.txt').text, 'hi')
  assert.equal(sftp.chmods.length, 0, '新文件不该去沿用不存在的权限')
  await closeServer(server)
})

rmSync(dir, { recursive: true, force: true })
console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exitCode = process.exitCode ?? 0
