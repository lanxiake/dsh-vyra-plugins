import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeItems, decorateSkills, summarize } from '../lib/aggregate.mjs'

test('同 slug 多源合并，保留可安装的那条', () => {
  const merged = mergeItems([
    { slug: 'pdf', source: 'skills.sh', name: 'pdf', installable: false, description: '' },
    { slug: 'pdf', source: 'clawhub', name: 'pdf-pro', installable: true, description: 'PDF 处理' },
  ])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].name, 'pdf-pro')
  assert.equal(merged[0].installable, true)
  assert.deepEqual(merged[0].sources, ['skills.sh', 'clawhub'])
})

test('不可安装的条目先出现时也会被后来的可安装条目替换', () => {
  const merged = mergeItems([
    { slug: 'a', source: 'x', installable: false },
    { slug: 'a', source: 'y', installable: true },
  ])
  assert.equal(merged[0].installable, true)
  assert.deepEqual([...merged[0].sources].sort(), ['x', 'y'])
})

test('slug 大小写不同视为同一条', () => {
  assert.equal(mergeItems([{ slug: 'Pdf', source: 'x' }, { slug: 'pdf', source: 'y' }]).length, 1)
})

test('缺 slug 的条目被丢弃', () => {
  assert.deepEqual(mergeItems([{ source: 'x' }, null, undefined]), [])
})

test('decorateSkills 给每条补 category 与中文 categoryLabel', () => {
  const out = decorateSkills([{ slug: 'pdf', name: 'pdf', description: '处理 PDF' }], 'pdf')
  assert.equal(out[0].category, 'productivity')
  assert.equal(out[0].categoryLabel, '效率办公')
})

test('summarize 报出源数量与失败明细', () => {
  const summary = summarize([{ slug: 'a', sources: ['x'] }, { slug: 'b', sources: ['x', 'y'] }], [{ source: 'z', error: 'timeout' }])
  assert.equal(summary.total, 2)
  assert.equal(summary.sources, 2)
  assert.equal(summary.failed, 1)
  assert.equal(summary.errors.length, 1)
})
