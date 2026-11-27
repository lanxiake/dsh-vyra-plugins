/**
 * SkillNet (https://github.com/zjunlp/SkillNet) as an optional skill source.
 *
 * The public API is a single {@code /v1/search} endpoint on plain HTTP; there is
 * no HTTPS listener, so this module talks HTTP on purpose rather than falling
 * back silently. It is off by default because the endpoint is frequently slow
 * or returning 504 — measured roughly half the time while building this — and
 * a flaky ninth source must not be allowed to slow down the first screen.
 *
 * @module dsh-vyra-skill-mcp-manager/skillnet
 */

import { categoryId } from './classify.mjs'

export const SKILLNET_ENDPOINT = 'http://api-skillnet.openkg.cn/v1/search'
const TIMEOUT_MS = 20000

function stripRepoPrefix(skillDir, repo) {
  const dir = String(skillDir ?? '').replace(/^\/+|\/+$/g, '')
  if (dir === '' || repo === '') return dir
  const prefix = `${repo}/`
  return dir.startsWith(prefix) ? dir.slice(prefix.length) : dir
}

function toItem(row) {
  const repo = String(row?.repo_name ?? '').trim()
  const slug = String(row?.skill_name ?? '').trim()
  if (slug === '') return null
  const skillDir = stripRepoPrefix(row?.skill_dir, repo)
  const author = String(row?.author ?? '').trim()
  return {
    id: `skillnet:${repo || author}/${skillDir || slug}`,
    slug,
    name: slug,
    description: String(row?.skill_description ?? '').trim(),
    source: 'skillnet',
    sourceLabel: 'SkillNet',
    owner: repo || author,
    stars: Number(row?.stars) || 0,
    homepage: repo === '' ? '' : `https://github.com/${repo}`,
    upstreamUrl: repo,
    skillDir,
    category: String(row?.category ?? '').trim(),
    installable: repo !== '',
  }
}

/**
 * Search SkillNet.
 *
 * @param {{ query?: string, category?: string, page?: number, pageSize?: number,
 *           fetchImpl?: typeof fetch, signal?: AbortSignal }} options
 * @returns {Promise<{ source: 'skillnet', items: object[], total: number, hasMore: boolean }>}
 */
export async function searchSkillNet({ query = '', category = '', page = 1, pageSize = 24, fetchImpl, signal } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const size = Math.max(1, Math.min(50, Number(pageSize) || 24))
  const url = new URL(SKILLNET_ENDPOINT)
  url.searchParams.set('q', String(query ?? ''))
  url.searchParams.set('mode', 'keyword')
  url.searchParams.set('limit', String(size))
  url.searchParams.set('page', String(p))
  url.searchParams.set('min_stars', '0')
  url.searchParams.set('sort_by', 'relevance')
  const wanted = categoryId(category)
  if (wanted !== null && wanted.skillnet !== 'Other') url.searchParams.set('category', wanted.skillnet)

  const doFetch = fetchImpl ?? globalThis.fetch
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const response = await doFetch(url.toString(), {
    signal: signal ?? timeout,
    headers: { accept: 'application/json', 'user-agent': 'vyra-skill-mcp-manager' },
  })
  if (!response.ok) throw new Error(`SkillNet HTTP ${response.status}`)
  const body = await response.json()
  if (body?.success === false) {
    throw new Error('SkillNet returned success=false')
  }
  const rows = Array.isArray(body?.data) ? body.data : []
  const items = rows.map(toItem).filter((item) => item !== null)
  return { source: 'skillnet', items, total: items.length, hasMore: rows.length >= size }
}
