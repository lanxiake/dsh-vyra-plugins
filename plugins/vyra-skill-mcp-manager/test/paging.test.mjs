import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pagedMerge } from '../lib/paging.mjs'

const row = (slug, source, installable = true) => ({ slug, source, name: slug, installable })

test('每源只取 pageSize 条，去重后合并', () => {
  const out = pagedMerge({
    page: 1,
    pageSize: 10,
    batches: [
      { source: 'a', items: [row('x', 'a'), row('y', 'a')] },
      { source: 'b', items: [row('y', 'b'), row('z', 'b')] },
    ],
  })
  assert.deepEqual(out.items.map((i) => i.slug), ['x', 'y', 'z'])
  assert.deepEqual(out.items.find((i) => i.slug === 'y').sources.sort(), ['a', 'b'])
})

test('翻页时带上已见过的 slug，避免重复渲染', () => {
  const out = pagedMerge({
    page: 2,
    pageSize: 10,
    seen: ['x', 'y'],
    batches: [{ source: 'a', items: [row('y', 'a'), row('n', 'a')] }],
  })
  assert.deepEqual(out.items.map((i) => i.slug), ['n'])
})

test('任一源还有下一页，整体就还能加载更多', () => {
  const more = pagedMerge({
    page: 1,
    pageSize: 10,
    batches: [{ source: 'a', items: [row('x', 'a')], hasMore: true }, { source: 'b', items: [], hasMore: false }],
  })
  assert.equal(more.hasMore, true)

  const done = pagedMerge({
    page: 1,
    pageSize: 10,
    batches: [{ source: 'a', items: [row('x', 'a')], hasMore: false }, { source: 'b', items: [], hasMore: false }],
  })
  assert.equal(done.hasMore, false)
})

test('失败的源计入 degraded，不影响其他源', () => {
  const out = pagedMerge({
    page: 1,
    pageSize: 10,
    batches: [{ source: 'a', items: [row('x', 'a')] }],
    failures: [{ source: 'b', error: 'timeout' }],
  })
  assert.equal(out.items.length, 1)
  assert.equal(out.summary.failed, 1)
})

test('空批次不抛错', () => {
  const out = pagedMerge({ page: 1, pageSize: 10, batches: [] })
  assert.deepEqual(out.items, [])
  assert.equal(out.hasMore, false)
})
