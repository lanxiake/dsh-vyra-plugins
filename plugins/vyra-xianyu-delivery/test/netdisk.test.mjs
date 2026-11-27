import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuark, expiredTypeFor, parseCliJson } from '../lib/netdisk/quark.js'

// runner 收到的是 argv（不含 node 与脚本路径），返回 { stdout }。
const fakeRunner = (answers) => async (argv) => {
  const key = argv[0]
  const value = typeof answers[key] === 'function' ? answers[key](argv) : answers[key]
  if (value === undefined) throw new Error(`unexpected command ${key}`)
  return { stdout: JSON.stringify(value) }
}

const tree = {
  '0': [
    { filename: '开源项目资源', fid: 'F-ROOT', file_type: '0', size: 0 },
    { filename: '其它', fid: 'F-X', file_type: '0', size: 0 },
  ],
  'F-ROOT': [{ filename: '产品', fid: 'F-PROD', file_type: '0', size: 0 }],
  'F-PROD': [{ filename: 'wechat', fid: 'F-WX', file_type: '0', size: 0 }],
  'F-WX': [{ filename: 'weflow.zip', fid: 'F-ZIP', file_type: '1', size: 269634560 }],
}

const withTree = () => {
  const q = createQuark({ runner: fakeRunner({}) })
  q.setFakeBrowse((parent) => tree[parent])
  return q
}

test('resolve walks directories to a file fid', async () => {
  const q = withTree()
  const hit = await q.resolve('开源项目资源/产品/wechat/weflow.zip')
  assert.deepEqual(hit, { fid: 'F-ZIP', filename: 'weflow.zip', size: 269634560 })
})

test('resolve throws path_not_found with the missing segment', async () => {
  const q = withTree()
  await assert.rejects(() => q.resolve('不存在的目录/weflow.zip'), /path_not_found:不存在的目录/)
})

test('resolve refuses to walk through a file', async () => {
  const q = withTree()
  await assert.rejects(() => q.resolve('开源项目资源/产品/wechat/weflow.zip/inner'), /path_not_dir:weflow.zip/)
})

test('share rejects when the CLI returns non-zero code', async () => {
  const q = createQuark({
    runner: fakeRunner({ share: { code: -104, msg: '无法识别当前 Agent 环境' } }),
  })
  q.setFakeBrowse(() => [])
  await assert.rejects(() => q.share({ fid: 'F1', title: 't', expireDays: 7 }), /share_failed:.*Agent/)
})

test('share returns url and passcode, and maps 7 days to expired-type 3', async () => {
  const seen = []
  const q = createQuark({
    runner: fakeRunner({
      share: (argv) => { seen.push(argv.join(' ')); return { code: 0, data: { share_url: 'https://pan.quark.cn/s/abc12345', passcode: 'GT3Q' } } },
    }),
  })
  const out = await q.share({ fid: 'F1', title: 'weflow', expireDays: 7 })
  assert.equal(out.passcode, 'GT3Q')
  assert.match(seen[0], /--url-type 2/)
  assert.match(seen[0], /--expired-type 3/)
})

test('expiredTypeFor covers the documented ladder', () => {
  assert.equal(expiredTypeFor(1), 2)
  assert.equal(expiredTypeFor(7), 3)
  assert.equal(expiredTypeFor(30), 4)
  // 没有精确档位时取不小于它的最近一档
  assert.equal(expiredTypeFor(15), 4)
  assert.equal(expiredTypeFor(400), 7)
})

test('parseCliJson skips progress lines before the result', () => {
  const out = parseCliJson('progress 10%\n{"code":0,"data":{"share_url":"u"}}\n')
  assert.equal(out.code, 0)
})

test('timeout surfaces as netdisk_timeout', async () => {
  const err = Object.assign(new Error('Command failed: killed'), { killed: true })
  const q = createQuark({ runner: async () => { throw err } })
  await assert.rejects(() => q.resolve('weflow.zip'), /netdisk_timeout/)
})

test('baidu is a declared placeholder', async () => {
  const { createNetdisk } = await import('../lib/netdisk/index.js')
  const b = createNetdisk({ provider: 'baidu' })
  assert.equal(b.unsupported, true)
  await assert.rejects(() => b.resolve('x'), /not_configured/)
})

// 内置技能必须和真实 CLI 一致：以前写着 `quark share`，Agent 照着调只会到处找命令。
test('builtin quark skill documents the real CLI', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const path = fileURLToPath(new URL('../builtin-skills/quarkclouddrive/SKILL.md', import.meta.url))
  const body = readFileSync(path, 'utf8')
  assert.match(body, /quark-drive\.cjs/)
  assert.match(body, /--parent-fid/)
  // 不许再出现裸命令写法
  assert.doesNotMatch(body, /^\s*quark (ls|share|upload|login)\b/m)
})

test('builtin skill tells the agent not to send links itself', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const path = fileURLToPath(new URL('../builtin-skills/quarkclouddrive/SKILL.md', import.meta.url))
  const body = readFileSync(path, 'utf8')
  assert.match(body, /不要自己(调用|生成)/)
  assert.match(body, /SVIP/)
})
