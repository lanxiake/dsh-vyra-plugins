import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchSkillNet } from '../lib/skillnet.mjs'

const payload = {
  success: true,
  data: [
    {
      skill_name: 'pdf', skill_description: '处理 PDF 文件', stars: 301, author: 'x',
      repo_name: 'owner/repo', skill_dir: 'owner/repo/skills/pdf', category: 'Development',
      skill_url: 'https://github.com/owner/repo/blob/sha/skills/pdf',
    },
  ],
}

test('把 SkillNet 记录映射成统一 item 形状', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => payload })
  const out = await searchSkillNet({ query: 'pdf', fetchImpl })
  assert.equal(out.source, 'skillnet')
  assert.equal(out.items.length, 1)
  const item = out.items[0]
  assert.equal(item.slug, 'pdf')
  assert.equal(item.sourceLabel, 'SkillNet')
  assert.equal(item.stars, 301)
  assert.equal(item.owner, 'owner/repo')
  assert.equal(item.skillDir, 'skills/pdf')
  assert.equal(item.installable, true)
})

test('上游 success=false 视为失败而不是空结果', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ success: false, data: [] }) })
  await assert.rejects(() => searchSkillNet({ query: 'pdf', fetchImpl }), /success=false/)
})

test('HTTP 非 2xx 抛错（由调用方记入 degraded）', async () => {
  const fetchImpl = async () => ({ ok: false, status: 504 })
  await assert.rejects(() => searchSkillNet({ query: 'pdf', fetchImpl }), /504/)
})

test('中文分类名会换算成 SkillNet 原值再发请求', async () => {
  let seenUrl = ''
  const fetchImpl = async (url) => { seenUrl = url; return { ok: true, json: async () => payload } }
  await searchSkillNet({ query: 'pdf', category: '效率办公', fetchImpl })
  assert.match(seenUrl, /category=Productivity/)
})
