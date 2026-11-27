/**
 * 导出 / 导入的回归测试：纯 node，不需要真的 SSH。
 *
 * 覆盖三件曾经坏过的事：
 *  1. 导出接口只认 POST，界面上「不带密码导出」走 GET 于是 405；
 *  2. 带口令导出后，密码在导入端拿不到（导出的 id 和导入的新 id 对不上）；
 *  3. 密钥连接的 privateKeyPath 被改写成备份包内的 blob 名，导入后指向不存在的路径。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, isAbsolute } from 'node:path'
import { exportBundle, importBundle } from '../backup.js'
import { resolveExportDir, revealInFileManager } from '../routes.js'

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

const dir = mkdtempSync(join(tmpdir(), 'ssh-term-export-'))
const keyPath = join(dir, 'id_ed25519')
writeFileSync(keyPath, '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----\n', { mode: 0o600 })

const state = {
  folders: [
    { id: 'f1', name: '生产', parentId: null },
    { id: 'f2', name: '内网', parentId: 'f1' },
  ],
  connections: [
    { id: 'c1', name: 'web-01', host: '10.0.0.1', port: 22, username: 'root', authType: 'password', folderId: 'f1' },
    { id: 'c2', name: 'db-01', host: '10.0.0.2', port: 2222, username: 'dba', authType: 'key', privateKeyPath: keyPath, folderId: 'f2' },
    { id: 'c3', name: 'bastion', host: '203.0.113.9', port: 22, username: 'ops', authType: 'agent' },
  ],
}

await test('整份导出保留每条连接、每个文件夹、每个密钥文件', () => {
  const { bundle, missing } = exportBundle(state, { secrets: { c1: 'hunter2' }, keySecrets: { [keyPath]: 'keypass' }, passphrase: 'pw' })
  assert.equal(bundle.kind, 'liteshell-backup')
  assert.equal(bundle.connections.length, 3)
  assert.equal(bundle.folders.length, 2)
  assert.equal(bundle.keys.length, 1)
  assert.equal(missing.length, 0)
  assert.ok(bundle.secrets, '带口令时必须产出密文块')
})

await test('密钥连接的 privateKeyPath 不再被改写成包内的 blob 名', () => {
  const { bundle } = exportBundle(state, {})
  const db = bundle.connections.find((c) => c.id === 'c2')
  assert.equal(db.privateKeyPath, keyPath, '原路径要原样保留')
  assert.match(db.keyFile, /id_ed25519$/, '包内那一份用单独的字段指向')
})

await test('导出 → 导入：密码对得上（导出的 id 就是导入端取密码的 id）', () => {
  const { bundle } = exportBundle(state, { secrets: { c1: 'hunter2' }, passphrase: 'pw' })
  const back = importBundle(bundle, join(dir, 'keys'), 'pw')
  const web = back.connections.find((c) => c.name === 'web-01')
  assert.equal(back.passwords[web.ref], 'hunter2', 'web-01 的密码必须跟着回来')
})

await test('导出 → 导入：密钥路径落到本机 keys 目录，且口令跟着走', () => {
  const { bundle } = exportBundle(state, { keySecrets: { [keyPath]: 'keypass' }, passphrase: 'pw' })
  mkdirSync(join(dir, 'keys'), { recursive: true })
  const back = importBundle(bundle, join(dir, 'keys'), 'pw')
  const db = back.connections.find((c) => c.name === 'db-01')
  assert.ok(db.keyPath, 'db-01 必须重新指到落地的私钥')
  assert.match(db.keyPath, /keys[\\/]/)
  assert.equal(back.keyPasswords[db.keyRef], 'keypass')
  assert.equal(back.missingKeys, 0)
})

await test('旧格式备份（privateKeyPath 里是 blob 名）仍然能导入', () => {
  const legacy = {
    kind: 'liteshell-backup',
    version: 1,
    folders: [{ id: 'f1', name: '生产', parentId: null }],
    connections: [{ id: 'x', name: 'old', host: '1.2.3.4', port: 22, username: 'u', authType: 'key', privateKeyPath: '1-id_rsa', folderId: 'f1' }],
    keys: [{ name: '1-id_rsa', data: Buffer.from('KEY').toString('base64') }],
  }
  const back = importBundle(legacy, join(dir, 'legacy-keys'))
  const old = back.connections[0]
  assert.ok(old.keyPath, '旧备份的 blob 名要认成包内文件')
  assert.equal(back.missingKeys, 0)
})

await test('口令不对时在写任何东西之前就抛错', () => {
  const { bundle } = exportBundle(state, { secrets: { c1: 'x' }, passphrase: 'right' })
  assert.throws(() => importBundle(bundle, join(dir, 'bad-keys'), 'wrong'), /口令不对/)
})

await test('只导出单个文件夹时，它的子文件夹和里面的连接一起走', () => {
  const { bundle } = exportBundle(state, { folderRoot: 'f1' })
  assert.deepEqual(bundle.connections.map((c) => c.name).sort(), ['db-01', 'web-01'])
  assert.equal(bundle.folders.find((f) => f.id === 'f1').parentId, null, '被导出的根不能挂着一个不存在的父级')
})

await test('只导出单条连接', () => {
  const { bundle } = exportBundle(state, { onlyIds: ['c2'] })
  assert.equal(bundle.connections.length, 1)
  assert.equal(bundle.connections[0].name, 'db-01')
  assert.equal(bundle.keys.length, 1)
})

await test('不带口令时不产出 secrets 块（不写空锁）', () => {
  const { bundle, passwords } = exportBundle(state, { secrets: { c1: 'x' } })
  assert.equal(bundle.secrets, undefined)
  assert.equal(passwords, 0, '没有口令就没有密码可算')
})

// ── 落点：导出必须由 Host 写盘并回绝对路径（用户「不知道文件放哪了」的根因） ──
await test('resolveExportDir：给绝对路径就原样用', () => {
  const target = join(dir, 'backups', 'deep')
  assert.equal(resolveExportDir(target), resolve(target))
})

await test('resolveExportDir：不传就落到「下载」目录，始终是绝对路径', () => {
  const d = resolveExportDir()
  assert.ok(isAbsolute(d), `默认落点必须是绝对路径，实际是 ${d}`)
  assert.match(d, /Downloads|下载|[\\/]Users[\\/]/i)
})

await test('resolveExportDir：相对路径直接拒绝（会跟着工作目录漂移）', () => {
  assert.throws(() => resolveExportDir('backups'), /绝对路径/)
})

await test('revealInFileManager：路径不存在也不抛，只是打不开', () => {
  const r = revealInFileManager(join(dir, 'nope', 'x.json'))
  assert.equal(typeof r.ok, 'boolean')
  assert.ok(r.dir, '无论如何都要回一个可读的目录')
})

rmSync(dir, { recursive: true, force: true })
console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
