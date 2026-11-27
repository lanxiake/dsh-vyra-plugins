/**
 * 「哪些文件能进编辑器」的三道闸门。
 *
 * 这里每一条错了，后果都是**文件被存坏**——不是界面难看，是数据没了。所以：
 *  - 扩展名黑名单要真的挡住二进制/归档；
 *  - 0 字节嗅探要挡住伪装成 .conf 的二进制；
 *  - 严格 UTF-8 要挡住 GBK，否则存回去就是一堆 U+FFFD。
 */
import assert from 'node:assert/strict'
import { canEdit, sniffText, decideEdit, extensionOf, MAX_EDIT_BYTES } from '../src/edit-gate.js'

const results = []
const test = (name, fn) => {
  try {
    fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    results.push(`✗ ${name}\n  ${e instanceof Error ? e.stack : e}`)
    process.exitCode = 1
  }
}

const bytes = (s) => new TextEncoder().encode(s)
const gbk = (arr) => new Uint8Array(arr)

test('扩展名解析：只看最后一段，且必须像扩展名', () => {
  assert.equal(extensionOf('a/b/c.conf'), 'conf')
  assert.equal(extensionOf('nginx.conf'), 'conf')
  assert.equal(extensionOf('archive.tar.gz'), 'gz')
  assert.equal(extensionOf('noext'), '')
  assert.equal(extensionOf('a.verylongextensionname'), '', '太长的不是扩展名')
  assert.equal(extensionOf('.bashrc'), 'bashrc')
})

test('常见文本文件可以编辑', () => {
  for (const n of ['nginx.conf', 'app.log', 'deploy.sh', 'notes.md', 'config.yaml', 'hosts']) {
    assert.equal(canEdit({ name: n, size: 1000 }).ok, true, n)
  }
})

test('二进制 / 归档 / 图片一律挡下', () => {
  for (const n of ['a.zip', 'a.tar.gz', 'a.exe', 'a.so', 'a.db', 'a.png', 'a.mp4', 'a.pdf', 'a.ttf']) {
    const r = canEdit({ name: n, size: 10 })
    assert.equal(r.ok, false, n)
    assert.match(r.reason, /二进制|归档|格式/)
  }
})

test('超过 2MB 直接劝退', () => {
  const r = canEdit({ name: 'big.log', size: MAX_EDIT_BYTES + 1 })
  assert.equal(r.ok, false)
  assert.match(r.reason, /2 MB|MB/)
  assert.equal(canEdit({ name: 'ok.log', size: MAX_EDIT_BYTES }).ok, true)
})

test('嗅探：含 0 字节就是二进制（哪怕扩展名是 .conf）', () => {
  const r = sniffText(new Uint8Array([104, 105, 0, 106]))
  assert.equal(r.ok, false)
  assert.match(r.reason, /0 字节/)
})

test('嗅探：控制字符超过 5% 按二进制处理', () => {
  const mostlyBinary = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 65])
  const r = sniffText(mostlyBinary)
  assert.equal(r.ok, false)
  assert.match(r.reason, /控制字符/)
})

test('嗅探：正常文本（含制表/换行/中文）通过', () => {
  const r = sniffText(bytes('server {\n\tlisten 80;  # 中文注释\n}\n'))
  assert.equal(r.ok, true)
  assert.match(r.text, /listen 80/)
})

test('嗅探：GBK 中文字节被严格 UTF-8 拒绝', () => {
  // "中文" 的 GBK 编码
  const r = sniffText(gbk([0xd6, 0xd0, 0xce, 0xc4]))
  assert.equal(r.ok, false)
  assert.match(r.reason, /UTF-8/)
})

test('空文件可以编辑', () => {
  const r = sniffText(new Uint8Array([]))
  assert.equal(r.ok, true)
  assert.equal(r.text, '')
})

test('三道闸门串起来：扩展名先挡，再嗅探', () => {
  assert.equal(decideEdit({ name: 'x.zip', size: 10 }, bytes('abc')).ok, false)
  assert.equal(decideEdit({ name: 'x.conf', size: 10 }, bytes('abc')).ok, true)
  assert.equal(decideEdit({ name: 'x.conf', size: 10 }, new Uint8Array([0, 1, 2])).ok, false)
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exit(process.exitCode ?? 0)
