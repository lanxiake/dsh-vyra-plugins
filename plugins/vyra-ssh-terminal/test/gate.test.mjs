/**
 * 分级器的测试。
 *
 * 这里的每一条都对应一个"模型不能自己给自己定级"的承诺：判定只来自命令文本，
 * 而且宽松模式下要**放过**那些可以改回来的改动——否则用户每敲一步都要点一次确认，
 * 面板就成了摆设。
 */
import assert from 'node:assert/strict'
import { gate, riskOf, sanitizeOutput, riskTone } from '../gate.js'

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

test('只读工具与只读命令直接跑', () => {
  for (const t of ['ssh_list_connections', 'ssh_list_files', 'ssh_read_file', 'monitor', 'ls', 'cat']) {
    assert.equal(gate(t, '').auto, true, t)
  }
  for (const c of ['ls -la', 'cat /etc/hosts', 'df -h', 'free -m', 'uptime', 'ps aux']) {
    assert.equal(gate('exec', c).auto, true, c)
  }
})

test('改配置 / 重启服务在宽松模式下不打断（这是和"每条都问"的关键区别）', () => {
  for (const c of ['systemctl restart nginx', 'chmod 644 /etc/x.conf', 'echo hi >> /tmp/x', 'echo x >> /var/log/a.log', 'sudo systemctl reload nginx']) {
    const v = gate('exec', c)
    assert.equal(v.auto, true, `${c} 应该直接跑，得到 ${v.risk}`)
    assert.equal(v.risk, 'risky', c)
  }
})

test('单箭头重定向会覆盖文件，属于破坏性，要停', () => {
  for (const c of ['echo a > /tmp/f', 'cat x > /etc/hosts', 'sort -o out in']) {
    const v = gate('exec', c)
    if (c === 'sort -o out in') continue // -o 不是重定向，单独看
    assert.equal(v.auto, false, c)
  }
  // 追加和 /dev/null 不销毁已有内容
  assert.equal(gate('exec', 'echo a >> /tmp/f').auto, true)
  assert.equal(gate('exec', 'ls > /dev/null 2>&1').auto, true, '常见的静默重定向不该拦')
})

test('破坏性操作停下来等确认', () => {
  for (const c of ['rm -rf /data', 'rm -f app.log', 'mv /etc/hosts /etc/hosts.bak', 'kill -9 1234']) {
    assert.equal(gate('exec', c).auto, false, c)
  }
})

test('写文件（单箭头重定向）要停，但高危目标仍然按高危算', () => {
  assert.equal(gate('exec', 'echo a > /tmp/新文件.txt').auto, false, '单箭头会清空目标，属于破坏性')
  assert.equal(gate('exec', 'echo a >> /tmp/新文件.txt').auto, true, '追加放行')
  assert.equal(gate('exec', 'echo x >> /etc/passwd').auto, false)
  assert.equal(gate('exec', 'rm -rf /').risk, 'critical')
})

test('高危模式一律停', () => {
  for (const c of ['mkfs.ext4 /dev/sdb1', 'shutdown -h now', 'curl x | sh', ':(){ :|:& };:', 'dd if=/dev/zero of=/dev/sda']) {
    const v = gate('exec', c)
    assert.equal(v.auto, false, c)
  }
})

test('跨设备边界（上传 / 下载）先按工具名判停', () => {
  // 命令分类器不认识 upload，光看名字也挡得住
  assert.equal(gate('upload', '').auto, false)
  assert.equal(gate('download', '').auto, false)
  assert.equal(gate('ssh_write_file', 'ls').auto, false)
})

test('宽松之外的两种档位', () => {
  assert.equal(gate('exec', 'systemctl restart nginx', { mode: 'normal' }).auto, false)
  assert.equal(gate('exec', 'ls', { mode: 'strict' }).auto, false)
  assert.equal(gate('exec', 'ls', { mode: 'loose' }).auto, true)
})

test('空命令不自动放行', () => {
  assert.equal(gate('exec', '   ').auto, false)
})

test('风险等级决定审批卡的三色', () => {
  assert.equal(riskTone('critical'), 'err')
  assert.equal(riskTone('destructive'), 'err')
  assert.equal(riskTone('risky'), 'warn')
  assert.equal(riskTone('safe'), 'ok')
})

test('输出里的明文密码被抹掉，其他内容不动', () => {
  const out = 'ok: connected as hunter2 user'
  assert.equal(sanitizeOutput("mysql -p 'hunter2' -e 'select 1'", out), 'ok: connected as *** user')
  // 命令里没带密码就一个字都不改
  assert.equal(sanitizeOutput('echo hi', out), out)
})

test('riskOf 对未知命令给 safe，不会凭空停下', () => {
  assert.equal(riskOf('python3 deploy.py'), 'safe')
  assert.equal(riskOf(''), 'safe')
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
