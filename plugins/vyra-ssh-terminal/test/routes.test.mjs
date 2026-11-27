/**
 * 路由层的回归测试：真的起一个 http 服务器，真的发请求。
 *
 * 只覆盖不需要 SSH 的那几条（导出 / 预览 / 网卡列表），重点是把两条曾经坏掉的
 * 行为钉住：GET 导出要能用（早先只认 POST，界面上那条路一直 405），POST 导出
 * 要回够界面报告用的头。
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRouter, BASE } from '../routes.js'

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

const dir = mkdtempSync(join(tmpdir(), 'ssh-term-routes-'))
process.env.DSH_PROFILE_DIR = dir
const keyPath = join(dir, 'id_rsa')
writeFileSync(keyPath, 'KEY')

/** 最小的 ConnectionManager 替身：只实现路由用到的那几个成员。 */
function fakeConnections() {
  const connections = new Map([
    ['c1', { id: 'c1', name: 'web-01', host: '10.0.0.1', port: 22, username: 'root', authType: 'password', folderId: 'f1' }],
    ['c2', { id: 'c2', name: 'db-01', host: '10.0.0.2', port: 22, username: 'dba', authType: 'key', privateKeyPath: keyPath }],
  ])
  const folders = new Map([['f1', { id: 'f1', name: '生产', parentId: null }]])
  return {
    connections,
    folders,
    list: () => [...connections.values()],
    get: (id) => connections.get(id),
    resolve: (key) => (connections.has(key) ? { conn: connections.get(key) } : { error: `没有叫「${key}」的连接` }),
    secretsFor: async (ids) => ({ secrets: Object.fromEntries(ids.filter((id) => id === 'c1').map((id) => [id, 'hunter2'])), keySecrets: {} }),
  }
}

const router = createRouter({ connections: fakeConnections(), terminals: {}, pool: {}, history: {} })
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0])
  const route = path.slice(BASE.length)
  router(route, req, res).catch((e) => {
    res.writeHead(500)
    res.end(String(e))
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${server.address().port}${BASE}`

await test('GET 导出（不带密码）不再 405', async () => {
  const res = await fetch(`${origin}export?scope=all`)
  assert.equal(res.status, 200, 'GET 导出必须能用——界面上「不带密码」走的正是这条路')
  const body = await res.json()
  assert.equal(body.kind, 'liteshell-backup')
  assert.equal(body.connections.length, 2)
  assert.equal(body.secrets, undefined, '不带口令时不能有密文块')
})

await test('GET 导出的响应头够界面写报告', async () => {
  const res = await fetch(`${origin}export?scope=all`)
  assert.match(decodeURIComponent(res.headers.get('x-export-name')), /^ssh-terminal-backup-\d{8}-\d{4}\.json$/)
  assert.equal(res.headers.get('x-export-connections'), '2')
  assert.equal(res.headers.get('x-export-passwords'), '0', '不带口令时密码数是 0')
  assert.match(res.headers.get('content-disposition'), /attachment/)
})

await test('POST 导出带口令：密码进密文，队列头报出数量', async () => {
  const res = await fetch(`${origin}export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'all', passphrase: 'pw' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.secrets, '带口令必须有密文块')
  assert.equal(res.headers.get('x-export-passwords'), '1', '只有 c1 存过密码')
})

await test('导出文件名用对象自己的名字（单条连接）', async () => {
  const res = await fetch(`${origin}export?scope=connection&id=c1`)
  assert.equal(res.status, 200)
  assert.match(decodeURIComponent(res.headers.get('x-export-name')), /^web-01-\d{8}-\d{4}\.json$/)
})

await test('导出不存在的连接回 404 而不是 500', async () => {
  const res = await fetch(`${origin}export?scope=connection&id=nope`)
  assert.equal(res.status, 404)
  assert.equal((await res.json()).code, 'unknown_connection')
})

await test('预览接口说清规模', async () => {
  const res = await fetch(`${origin}export/preview?scope=all`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(
    { connections: body.connections, folders: body.folders, keys: body.keys, passwords: body.passwords },
    { connections: 2, folders: 1, keys: 1, passwords: 1 }
  )
})

await test('导出正文就是纯备份 JSON，可以原样再导入', async () => {
  const res = await fetch(`${origin}export?scope=all`)
  const text = await res.text()
  const parsed = JSON.parse(text)
  assert.equal(parsed.kind, 'liteshell-backup')
  assert.ok(!('text' in parsed), '正文不能被包一层信封——它就是文件本身')
})

await test('网卡列表接口仍然正常', async () => {
  const res = await fetch(`${origin}net/interfaces`)
  assert.equal(res.status, 200)
  assert.ok(Array.isArray((await res.json()).interfaces))
})

// ── 导出落盘：用户「不知道文件放哪了」的根因就在这里 ──────────────────────
await test('export/save 真的把文件写到指定目录，并回报绝对路径', async () => {
  const target = join(dir, 'backups')
  const res = await fetch(`${origin}export/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'all', dir: target }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dir, resolve(target))
  assert.equal(body.path, join(resolve(target), body.name), '回报的路径必须是真实落点')
  assert.match(body.name, /^ssh-terminal-backup-\d{8}-\d{4}\.json$/)
  // 文件真的在磁盘上，且内容能原样当备份用
  const written = JSON.parse(readFileSync(body.path, 'utf8'))
  assert.equal(written.kind, 'liteshell-backup')
  assert.equal(written.connections.length, 2)
  assert.ok(body.bytes > 0)
})

await test('export/save 拒绝相对路径，不跟着工作目录漂移', async () => {
  const res = await fetch(`${origin}export/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'all', dir: 'backups' }),
  })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).code, 'bad_dir')
})

await test('export/save 导出不存在的连接回 404', async () => {
  const res = await fetch(`${origin}export/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'connection', id: 'nope', dir: join(dir, 'x') }),
  })
  assert.equal(res.status, 404)
})

await test('export/reveal 对不存在的路径也不炸，照样回一个目录', async () => {
  const res = await fetch(`${origin}export/reveal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: join(dir, 'nope', 'a.json') }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(typeof body.ok, 'boolean')
  assert.ok(body.dir, '无论如何都要回一个可读的目录')
})

server.close()
rmSync(dir, { recursive: true, force: true })
console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
