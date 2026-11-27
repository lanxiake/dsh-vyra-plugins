import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dispatchForTest } from '../vendor/dsh-skill-mcp-market/market-host.js'

test('skills.aggregate 合并多源并标出分类', async () => {
  const out = await dispatchForTest('skills.aggregate', { query: '' }, {
    searchSkills: async () => ({
      items: [
        { slug: 'pdf', source: 'clawhub', name: 'pdf', description: '处理 PDF', installable: true },
        { slug: 'pdf', source: 'skills.sh', name: 'pdf', description: '', installable: false },
      ],
      degraded: [], hints: [], hasMore: false,
    }),
  })
  assert.equal(out.items.length, 1)
  assert.deepEqual([...out.items[0].sources].sort(), ['clawhub', 'skills.sh'])
  assert.equal(out.items[0].categoryLabel, '效率办公')
})

test('全部源不可达时返回错误明细而不是空列表', async () => {
  const out = await dispatchForTest('skills.aggregate', {}, {
    searchSkills: async () => ({ items: [], degraded: [{ source: 'clawhub', error: 'timeout' }], hints: [], hasMore: false }),
  })
  assert.equal(out.items.length, 0)
  assert.equal(out.summary.failed, 1)
  assert.match(out.summary.errors.join(' '), /timeout/)
})

test('mcp.search 传 all 时并行查两个源并去重', async () => {
  const out = await dispatchForTest('mcp.search', { source: 'all' }, {
    loadMcpCatalog: async (_cache, _q, source) => ({
      live: true,
      items: source === 'registry'
        ? [{ slug: 'github', name: 'GitHub', description: 'repo access', category: 'Development' }]
        : [{ slug: 'github', name: 'GitHub MCP', description: 'repo access' }, { slug: 'slack', name: 'Slack', description: 'chat' }],
    }),
  })
  assert.deepEqual(out.items.map((i) => i.slug).sort(), ['github', 'slack'])
  assert.equal(out.items.find((i) => i.slug === 'slack').categoryLabel, '效率办公')
})

test('SkillNet 未开启时不会被调用', async () => {
  let called = 0
  await dispatchForTest('skills.aggregate', {}, {
    searchSkills: async () => ({ items: [], degraded: [], hints: [], hasMore: false }),
    skillnetEnabled: () => false,
    searchSkillNet: async () => { called += 1; return { items: [] } },
  })
  assert.equal(called, 0)
})

test('SkillNet 开启后参与聚合，失败只记入 degraded', async () => {
  const out = await dispatchForTest('skills.aggregate', {}, {
    searchSkills: async () => ({ items: [
      { slug: 'pdf', source: 'clawhub', name: 'pdf', description: '处理 PDF', installable: true },
    ], degraded: [], hints: [], hasMore: false }),
    skillnetEnabled: () => true,
    searchSkillNet: async () => { throw new Error('SkillNet HTTP 504') },
  })
  assert.equal(out.items.length, 1)
  assert.equal(out.summary.failed, 1)
  assert.match(out.summary.errors.join(' '), /504/)
})
