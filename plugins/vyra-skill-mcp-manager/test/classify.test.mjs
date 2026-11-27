import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, categoryId, classify } from '../lib/classify.mjs'

test('分类表是 SkillNet 的 10 类，中文名逐字对应', () => {
  assert.equal(CATEGORIES.length, 10)
  assert.deepEqual(
    CATEGORIES.map((c) => c.label),
    ['软件开发', '测试质量', 'AI 与生成', '效率办公', '商业运营', '学术研究', '科学计算', '安全合规', '生活娱乐', '其他'],
  )
  assert.deepEqual(
    CATEGORIES.map((c) => c.skillnet),
    ['Development', 'Testing', 'AIGC', 'Productivity', 'Business', 'Research', 'Science', 'Security', 'Lifestyle', 'Other'],
  )
})

test('领域词优先于工具词：pdf 落效率办公而不是软件开发', () => {
  assert.equal(classify({ name: 'pdf', description: '处理 PDF；可用 python 和 pdftotext' }).label, '效率办公')
})

test('frontmatter 声明的分类优先，不被关键词覆盖', () => {
  const hit = classify({ name: 'pdf-tools', description: 'python 脚本', category: 'Development' })
  assert.equal(hit.label, '软件开发')
  assert.equal(hit.matched, 'declared')
})

test('只有工具词时落软件开发', () => {
  assert.equal(classify({ name: 'git-helper', description: 'runs git commands' }).matched, 'tool')
})

test('什么都没命中落其他', () => {
  const hit = classify({ name: 'zzz', description: '' })
  assert.equal(hit.label, '其他')
  assert.equal(hit.matched, 'fallback')
})

test('空输入不抛错：返回其他', () => {
  assert.equal(classify({}).label, '其他')
  assert.equal(classify({ name: '', description: undefined, args: undefined }).label, '其他')
})

test('categoryId 接受中文名、SkillNet 原值与小写 id', () => {
  assert.equal(categoryId('效率办公').id, 'productivity')
  assert.equal(categoryId('Productivity').id, 'productivity')
  assert.equal(categoryId('productivity').id, 'productivity')
  assert.equal(categoryId('不存在的分类'), null)
})

test('关键词按词边界匹配：@latest 里的 test 不算测试', () => {
  const hit = classify({ name: 'comfyui', command: 'npx', args: ['-y', 'comfyui-mcp@latest'] })
  assert.equal(hit.label, 'AI 与生成')
})

test('关键词按词边界匹配：latest 单词不会命中 test', () => {
  assert.equal(classify({ name: 'x', description: 'the latest of everything' }).matched, 'fallback')
})

test('测试类关键词仍要求完整词', () => {
  assert.equal(classify({ name: 'x', description: 'pytest fixtures' }).label, '测试质量')
  assert.equal(classify({ name: 'x', description: 'our test suite' }).label, '测试质量')
})
