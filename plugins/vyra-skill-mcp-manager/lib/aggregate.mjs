/**
 * Cross-source aggregation helpers: dedupe, classify, summarise.
 *
 * Applied to the rows `sources.js` returns, so the panel and the `vyra-skill`
 * CLI produce the same merged view instead of each inventing one.
 *
 * @module dsh-vyra-skill-mcp-manager/aggregate
 */

import { classify } from './classify.mjs'

function sourceOf(item) {
  const source = item?.source
  return typeof source === 'string' && source !== '' ? source : ''
}

function keyOf(item) {
  const slug = item?.slug
  return typeof slug === 'string' ? slug.trim().toLowerCase() : ''
}

/**
 * Merge rows from every source by slug.
 *
 * The installable row wins: a card whose only row came from a browse-only
 * source would otherwise render as "installed" while the install button does
 * nothing, because the panel resolves the install target from the row itself.
 * Source ids are collected so the card can still show every place it was
 * found.
 */
export function mergeItems(items) {
  const merged = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    if (item == null || typeof item !== 'object') continue
    const key = keyOf(item)
    if (key === '') continue
    const source = sourceOf(item)
    const current = merged.get(key)
    if (current === undefined) {
      merged.set(key, { ...item, sources: source === '' ? [] : [source] })
      continue
    }
    if (source !== '' && !current.sources.includes(source)) current.sources.push(source)
    if (item.installable === true && current.installable !== true) {
      merged.set(key, { ...item, sources: current.sources })
    }
  }
  return [...merged.values()]
}

/** Add `category` (id) and `categoryLabel` (Chinese) to each row. */
export function decorateSkills(items, query = '') {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item == null || typeof item !== 'object') return item
    const hit = classify({
      name: item.name || item.slug || query,
      description: item.description,
      whenToUse: item.whenToUse,
      category: item.category,
    })
    return { ...item, category: hit.id, categoryLabel: hit.label }
  })
}

/** Header numbers: how many rows, how many distinct sources, what failed. */
export function summarize(items, degraded = []) {
  const rows = Array.isArray(items) ? items : []
  const sources = new Set()
  for (const item of rows) {
    for (const source of Array.isArray(item?.sources) ? item.sources : []) sources.add(source)
  }
  const failures = Array.isArray(degraded) ? degraded : []
  return {
    total: rows.length,
    sources: sources.size,
    failed: failures.length,
    errors: failures.map((failure) => {
      const source = String(failure?.source ?? 'unknown')
      const error = String(failure?.error ?? '')
      return `${source}: ${error}`
    }),
  }
}
