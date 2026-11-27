/**
 * Paged, cross-source merging for the skill and MCP markets.
 *
 * Every source is asked for the same small page (ten rows), the batch that comes
 * back is merged immediately, and the next page asks each source for its next ten.
 * That is what keeps the first screen fast: the page no longer waits for the
 * slowest source before rendering anything, and the slowest source is the one
 * (skills.sh, cold catalogue) that used to make opening the market feel frozen.
 *
 * @module dsh-vyra-skill-mcp-manager/paging
 */

import { mergeItems, summarize } from './aggregate.mjs'

const DEFAULT_PAGE_SIZE = 10

function keyOf(item) {
  const slug = item?.slug
  return typeof slug === 'string' ? slug.trim().toLowerCase() : ''
}

/**
 * Merge one page of per-source batches into the rows the page should render.
 *
 * @param {{
 *   page?: number,
 *   pageSize?: number,
 *   batches?: Array<{ source: string, items?: object[], hasMore?: boolean }>,
 *   failures?: Array<{ source: string, error: string }>,
 *   seen?: string[],
 * }} options `seen` is the list of slugs already rendered on earlier pages.
 * @returns {{ items: object[], hasMore: boolean, page: number, pageSize: number, summary: object }}
 */
export function pagedMerge({ page = 1, pageSize = DEFAULT_PAGE_SIZE, batches = [], failures = [], seen = [] } = {}) {
  const already = new Set((Array.isArray(seen) ? seen : []).map((value) => String(value).trim().toLowerCase()))
  const rows = []
  let hasMore = false

  for (const batch of Array.isArray(batches) ? batches : []) {
    if (batch === null || typeof batch !== 'object') continue
    if (batch.hasMore) hasMore = true
    for (const item of Array.isArray(batch.items) ? batch.items : []) {
      if (item === null || typeof item !== 'object') continue
      const key = keyOf(item)
      if (key === '' || already.has(key)) continue
      rows.push({ ...item, source: item.source || batch.source })
    }
  }

  const merged = mergeItems(rows)
  return {
    items: merged,
    hasMore,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || DEFAULT_PAGE_SIZE,
    summary: summarize(merged, Array.isArray(failures) ? failures : []),
  }
}
