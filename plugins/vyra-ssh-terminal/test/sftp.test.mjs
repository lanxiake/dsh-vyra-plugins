/**
 * SFTP 封装的测试，重点是「权限」这条线。
 *
 * 两件容易错的事：
 *  1. `stat` 若只取低 9 位，setuid 文件（4755）会被报成 755，用户改完权限发现特殊位丢了；
 *  2. `chmod` 若不校验范围，一个越界的数字会把文件的类型位一起改掉，变成谁都打不开。
 *
 * 用假 sftp 对象驱动，不需要真的连服务器。
 */
import assert from 'node:assert/strict'
import * as sftpOps from '../sftp.js'

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

/** 最小 sftp 替身：只实现被测到的那几个方法。 */
function fakeSftp({ mode = 0o100644, fail } = {}) {
  const calls = []
  return {
    calls,
    stat(_p, cb) {
      if (fail === 'stat') return cb(new Error('no such file'))
      cb(null, { mode, size: 12, mtime: 1700000000 })
    },
    chmod(p, m, cb) {
      calls.push({ p, m })
      if (fail === 'chmod') return cb(new Error('permission denied'))
      cb(null)
    },
  }
}

await test('stat 连特殊权限位一起报（4755 不能被压成 755）', async () => {
  const s = await sftpOps.stat(fakeSftp({ mode: 0o104755 }), '/x')
  assert.equal(s.mode, 0o4755, 'setuid 位必须在 mode 里')
  assert.equal(s.isDir, false)
  assert.equal(s.mtime, 1700000000 * 1000, 'mtime 要换算成毫秒')
})

await test('stat 认得目录', async () => {
  const s = await sftpOps.stat(fakeSftp({ mode: 0o040755 }), '/x')
  assert.equal(s.isDir, true)
  assert.equal(s.mode, 0o755)
})

await test('chmod 把八进制值原样交给 sftp', async () => {
  const s = fakeSftp()
  await sftpOps.chmod(s, '/etc/app.conf', 0o640)
  assert.deepEqual(s.calls, [{ p: '/etc/app.conf', m: 0o640 }])
})

await test('chmod 拒绝越界值（会把文件类型位一起改掉）', async () => {
  const s = fakeSftp()
  await assert.rejects(() => sftpOps.chmod(s, '/x', 0o100644), /不合法/)
  await assert.rejects(() => sftpOps.chmod(s, '/x', -1), /不合法/)
  await assert.rejects(() => sftpOps.chmod(s, '/x', 1.5), /不合法/)
  await assert.rejects(() => sftpOps.chmod(s, '/x', NaN), /不合法/)
  assert.equal(s.calls.length, 0, '不合法的值一个都不该发出去')
})

await test('chmod 接受 0..07777 的边界值', async () => {
  const s = fakeSftp()
  await sftpOps.chmod(s, '/x', 0)
  await sftpOps.chmod(s, '/x', 0o7777)
  assert.deepEqual(s.calls.map((c) => c.m), [0, 0o7777])
})

await test('底层报错时原样抛出来，不吞掉', async () => {
  await assert.rejects(() => sftpOps.chmod(fakeSftp({ fail: 'chmod' }), '/x', 0o644), /permission denied/)
  await assert.rejects(() => sftpOps.stat(fakeSftp({ fail: 'stat' }), '/x'), /no such file/)
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
