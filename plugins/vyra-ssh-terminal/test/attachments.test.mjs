/**
 * AI 附件与上下文压缩。
 *
 * 附件这件事错了，用户会得到一句看不懂的 400（或者一整轮对话被一张 12MB 的图顶爆）；
 * 压缩这件事错了，模型会「忘记」刚才跑过的命令，然后重复执行。
 */
import assert from 'node:assert/strict'
import {
  classifyAttachment,
  attachmentBlocks,
  shouldCompact,
  keepRecent,
  compactInput,
  COMPACT_PROMPT,
  MAX_ATTACH_BYTES,
} from '../src/attachments.js'

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

test('图片按类型放行，认得出常见格式', () => {
  for (const [n, mime] of [['a.png', 'image/png'], ['b.JPG', 'image/jpeg'], ['c.webp', 'image/webp']]) {
    assert.deepEqual(classifyAttachment({ name: n, size: 1000 }), { kind: 'image', mime }, n)
  }
})

test('文本类附件可以带内容', () => {
  for (const n of ['nginx.conf', 'app.log', 'deploy.sh', 'x.yaml', 'README']) {
    assert.equal(classifyAttachment({ name: n, size: 1000 }).kind, 'text', n)
  }
})

test('其它格式只给路径，不读内容', () => {
  for (const n of ['a.pdf', 'b.zip', 'c.xlsx']) {
    assert.equal(classifyAttachment({ name: n, size: 1000 }).kind, 'link-only', n)
  }
})

test('超过上限的附件直接拒绝，并说清多大', () => {
  const r = classifyAttachment({ name: 'big.png', size: MAX_ATTACH_BYTES + 1 })
  assert.equal(r.kind, 'reject')
  assert.match(r.reason, /超过上限/)
})

test('没有文件名的拒绝', () => {
  assert.equal(classifyAttachment({ name: '', size: 1 }).kind, 'reject')
})

test('文本附件按代码块包起来', () => {
  const text = attachmentBlocks({ kind: 'text', name: 'a.conf', text: 'x=1' })[0]
  assert.match(text.text, /```/)
  assert.match(text.text, /x=1/)
})

test('图片附件带上真实字节，走宿主的 image 块', () => {
  const blocks = attachmentBlocks({ kind: 'image', name: 'shot.png', mime: 'image/png', data: 'QUJD' })
  const img = blocks.find((b) => b.type === 'image')
  assert.ok(img, '必须有 image 块：只说一句"[附件图片]"等于让模型看图盲猜')
  assert.equal(img.source.type, 'base64')
  assert.equal(img.source.media_type, 'image/png')
  assert.equal(img.source.data, 'QUJD')
  // 前面还要有一行文字说明，否则对话里看不出这张图是谁
  assert.match(blocks[0].text, /shot\.png/)
})

test('图片读不到字节时如实说明，不假装图在上下文里', () => {
  const blocks = attachmentBlocks({ kind: 'image', name: 'a.png', mime: 'image/png', data: '' })
  assert.equal(blocks.some((b) => b.type === 'image'), false)
  assert.match(blocks[0].text, /没能读取/)
})

test('只给路径的附件必须写明「未展开」，否则模型会以为内容已在上下文', () => {
  const b = attachmentBlocks({ kind: 'link-only', name: 'a.pdf', path: '/data/a.pdf' })[0]
  assert.match(b.text, /未展开/)
  assert.match(b.text, /\/data\/a\.pdf/)
})

test('压缩判断：没有上下文窗口信息就不压缩', () => {
  assert.equal(shouldCompact(999999, 0), false)
  assert.equal(shouldCompact(999999, undefined), false)
})

test('压缩判断：占满 90% 才压', () => {
  assert.equal(shouldCompact(89_000, 100_000), false)
  assert.equal(shouldCompact(90_000, 100_000), true)
  assert.equal(shouldCompact(95_000, 100_000), true)
})

test('压缩后保留约 20% 的最近消息，至少 4 条', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ role: 'user', content: [{ type: 'text', text: `m${i}` }] }))
  const kept = keepRecent(many)
  assert.equal(kept.length, 8)
  assert.equal(kept.at(-1).content[0].text, 'm39', '保留的是最近那段')
  // 少于一页时也至少留 4 条
  assert.equal(keepRecent(many.slice(0, 5)).length, 4)
})

test('压缩输入里带着命令原文与被拒绝的尝试', () => {
  const input = compactInput([
    { role: 'user', content: [{ type: 'text', text: '清一下 /data' }] },
    { role: 'assistant', content: [{ type: 'tool-call', name: 'exec', arguments: '{"command":"rm -rf /data"}' }] },
    { role: 'tool', content: [{ type: 'text', text: '用户拒绝了这一步' }] },
  ])
  assert.match(input, /rm -rf \/data/, '命令原文必须带上')
  assert.match(input, /用户拒绝了这一步/, '被拒绝的尝试必须带上，免得重试')
})

test('压缩提示词要求保留命令原文与未解决问题', () => {
  assert.match(COMPACT_PROMPT, /原文/)
  assert.match(COMPACT_PROMPT, /拒绝/)
  assert.match(COMPACT_PROMPT, /下一步/)
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exit(process.exitCode ?? 0)
