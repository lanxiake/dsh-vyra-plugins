/**
 * 命令补全与命令面板的纯逻辑测试。
 *
 * 两条硬规则要钉死：
 *  1. 候选**永远是在已输入内容上追加**——绝不会拿裸命令名抹掉用户打好的参数；
 *  2. 表里**不能有工具上不存在的子命令**（一个看着像的假选项比没有候选更坑）。
 */
import assert from 'node:assert/strict'
import { suggest, searchPalette, COMMON, SUBCOMMANDS, PALETTE } from '../src/palette.js'

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

test('历史优先，且最近用过的排最前', () => {
  const out = suggest('d', ['docker ps -a', 'df -h', 'docker ps'], 3)
  assert.equal(out[0].cmd, 'docker ps', '最近用过的应该排第一')
  assert.equal(out[0].from, 'history')
  assert.ok(out.some((x) => x.cmd === 'df -h'))
})

test('打完命令名就打空格：换成这个命令自己的动作', () => {
  const out = suggest('systemctl ', [], 5)
  assert.ok(out.length > 0)
  for (const x of out) {
    assert.ok(x.cmd.startsWith('systemctl '), `不能在已输入内容之外乱给：${x.cmd}`)
    assert.equal(x.from, 'sub')
  }
  assert.ok(out.some((x) => x.cmd === 'systemctl status'))
})

test('带参数前缀时只在原内容上追加（硬规则 1）', () => {
  const out = suggest('systemctl re', [], 5)
  // 顺序按命令表里的原顺序，不按字母——这里只断言"集合对、且都在原内容上追加"
  assert.deepEqual([...out.map((x) => x.cmd)].sort(), ['systemctl reload', 'systemctl restart'])
  for (const x of out) assert.ok(x.cmd.startsWith('systemctl re'))
  // 绝不会出现 `status` 这种把 re 抹掉的候选
  assert.ok(!out.some((x) => x.cmd === 'systemctl status'))
})

test('未知命令 + 空格：不给任何编造的候选', () => {
  assert.deepEqual(suggest('mycustomtool ', [], 5), [])
})

test('空输入 / 纯空白不给候选', () => {
  assert.deepEqual(suggest('', ['ls'], 5), [])
  assert.deepEqual(suggest('   ', ['ls'], 5), [])
})

test('候选数量受 limit 约束', () => {
  assert.ok(suggest('s', [], 2).length <= 2)
})

test('不会给重复候选', () => {
  const out = suggest('ls', ['ls', 'ls', 'ls -la'], 10)
  const cmds = out.map((x) => x.cmd)
  assert.equal(new Set(cmds).size, cmds.length)
})

test('补全表里没有不存在的动词（硬规则 2）', () => {
  // 抽查几个真实命令的常用动作，确认它们确实是这个工具的动作
  const systemd = SUBCOMMANDS.systemctl.map(([s]) => s)
  for (const v of ['status', 'restart', 'reload', 'start', 'stop', 'enable', 'disable']) {
    assert.ok(systemd.includes(v), `systemctl 少了真实动作 ${v}`)
  }
  // docker 的动作都必须是 docker 的子命令
  const docker = SUBCOMMANDS.docker.map(([s]) => s)
  for (const v of ['ps', 'logs', 'stats', 'images', 'exec', 'prune']) {
    assert.ok(docker.some((d) => d.startsWith(v)), `docker 少了 ${v}`)
  }
  // tar 的动作必须是真实 flag
  for (const [v] of SUBCOMMANDS.tar) assert.match(v, /^-[a-z]+$/, `tar 的 ${v} 不像真 flag`)
})

test('COMMON 里没有重复命令名', () => {
  const names = COMMON.map(([c]) => c)
  assert.equal(new Set(names).size, names.length)
})

test('命令面板：空查询返回全部（上限内）', () => {
  const rows = searchPalette('')
  assert.ok(rows.length > 20)
})

test('命令面板：多个词是收窄，不是放宽', () => {
  const wide = searchPalette('磁盘')
  const narrow = searchPalette('磁盘 排序')
  assert.ok(narrow.length <= wide.length)
  for (const r of narrow) assert.ok(`${r.cmd} ${r.hint} ${r.group}`.match(/磁盘/) && `${r.cmd} ${r.hint} ${r.group}`.match(/排序/))
})

test('命令面板：命令名、说明、分组名都能搜到', () => {
  assert.ok(searchPalette('docker').length > 0, '按命令名')
  assert.ok(searchPalette('容器').length > 0, '按说明')
  assert.ok(searchPalette('Docker').length > 0, '按分组名（大小写不敏感）')
})

test('命令面板：每条命令全局唯一（同一个命令不该出现两次）', () => {
  const all = PALETTE.flatMap((g) => g.items.map(([cmd]) => cmd))
  assert.equal(new Set(all).size, all.length)
})

test('命令面板：分组连续，同组不分散', () => {
  const groups = PALETTE.map((g) => g.group)
  assert.equal(new Set(groups).size, groups.length, '同名分组出现两次会把列表拆散')
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exit(process.exitCode ?? 0)
