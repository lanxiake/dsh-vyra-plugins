import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchExtraMcpSource, EXTRA_MCP_SOURCES } from '../lib/mcp-sources.mjs'

const jsonResponse = (body) => async () => ({ ok: true, json: async () => body })

test('内置四个 MCP 源，且不含返回 0 条的 LobeHub', () => {
  const ids = EXTRA_MCP_SOURCES.map((s) => s.id)
  assert.deepEqual(ids, ['registry', 'smithery', 'npm', 'awesome'])
  assert.ok(!ids.includes('lobehub'))
})

test('Smithery：映射成统一行并翻页', async () => {
  const fetchImpl = jsonResponse({
    servers: [
      { qualifiedName: 'brave', displayName: 'Brave Search', description: 'web search', useCount: 87579, remote: true, homepage: 'https://brave.com' },
    ],
    pagination: { currentPage: 1, pageSize: 10, totalPages: 167 },
  })
  const out = await searchExtraMcpSource('smithery', { query: '', page: 1, pageSize: 10, fetchImpl })
  assert.equal(out.source, 'smithery')
  assert.equal(out.items.length, 1)
  assert.equal(out.items[0].slug, 'brave')
  assert.equal(out.items[0].name, 'Brave Search')
  assert.equal(out.items[0].source, 'smithery')
  assert.equal(out.hasMore, true)
})

test('npm：按 keywords:mcp-server 搜索并映射', async () => {
  const fetchImpl = jsonResponse({
    total: 12792,
    objects: [{ package: { name: 'agent-device', version: '0.21.44', description: 'MCP server', links: { npm: 'https://www.npmjs.com/package/agent-device' } } }],
  })
  const out = await searchExtraMcpSource('npm', { query: 'device', page: 1, pageSize: 10, fetchImpl })
  assert.equal(out.items[0].slug, 'agent-device')
  assert.equal(out.items[0].source, 'npm')
  assert.equal(out.items[0].installable, true)
  assert.equal(out.items[0].installCommand, 'npx')
})

test('awesome：从 README 里解析 owner/repo 列表', async () => {
  const readme = [
    '- [actimod/onaa-protocol](https://github.com/actimod/onaa-protocol) - a protocol.',
    '- [punkpeye/fastmcp](https://github.com/punkpeye/fastmcp) - build servers.',
  ].join('\n')
  const fetchImpl = async () => ({ ok: true, text: async () => readme })
  const out = await searchExtraMcpSource('awesome', { query: 'fastmcp', page: 1, pageSize: 10, fetchImpl })
  assert.equal(out.items.length, 1)
  assert.equal(out.items[0].slug, 'punkpeye/fastmcp')
  assert.match(out.items[0].homepage, /github\.com\/punkpeye\/fastmcp/)
})

test('某源失败抛错，由聚合层记入 degraded 而不是静默空', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 })
  await assert.rejects(() => searchExtraMcpSource('smithery', { query: '', fetchImpl }), /500/)
})

test('未知源名明确报错', async () => {
  await assert.rejects(() => searchExtraMcpSource('nope', { query: '' }), /unknown MCP source/)
})
