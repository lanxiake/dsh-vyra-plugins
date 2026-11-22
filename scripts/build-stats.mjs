#!/usr/bin/env node
/**
 * Build `docs/stats.json`, the compact star/download overlay the market client
 * reads beside any format-1 index source.
 *
 * Format 1 does not define stars or downloads, and the Host drops members it
 * does not know. This file keeps only the numbers, keyed by npm name,
 * repository and display name, so a card can show them without fetching
 * GitHub or npm per entry (and without hitting their rate limits).
 *
 * Usage:
 *   node scripts/build-stats.mjs [plugins.json]
 *
 * With no argument it fetches https://awesome-dsh-plugin.com/plugins.json.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const SOURCE = 'https://awesome-dsh-plugin.com/plugins.json'
const OUT = resolve(import.meta.dirname, '..', 'docs', 'stats.json')

/** `https://github.com/o/r[/...]` -> `o/r`, lowercased. */
function repoOf(url) {
  const match = /github\.com\/([^/]+)\/([^/?#]+)/i.exec(String(url ?? ''))
  return match === null ? '' : `${match[1]}/${match[2].replace(/\.git$/i, '')}`.toLowerCase()
}

const input = process.argv[2]
const text = input === undefined
  ? await (async () => {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status} reading ${SOURCE}`)
    return response.text()
  })()
  : await readFile(resolve(input), 'utf8')

const catalog = JSON.parse(text)
if (!Array.isArray(catalog.plugins)) throw new Error('catalog has no plugins[]')

const rows = []
for (const plugin of catalog.plugins) {
  const stars = Number(plugin.stars)
  const downloads = Number(plugin.downloads)
  const hasStars = Number.isFinite(stars) && stars > 0
  const hasDownloads = Number.isFinite(downloads) && downloads > 0
  // A zero is not a metric worth carrying: it would double the file and
  // produce a "0 downloads" badge on plugins that have not been counted.
  if (!hasStars && !hasDownloads) continue
  const row = {
    name: typeof plugin.name === 'string' ? plugin.name : '',
    npm: typeof plugin.npm === 'string' && plugin.npm !== '' ? plugin.npm : null,
    repo: repoOf(plugin.url) || null,
    ...(hasStars ? { stars } : {}),
    ...(hasDownloads ? { downloads } : {}),
    ...(hasDownloads && typeof plugin.downloadsStart === 'string' ? { start: plugin.downloadsStart } : {}),
    ...(hasDownloads && typeof plugin.downloadsEnd === 'string' ? { end: plugin.downloadsEnd } : {}),
    checked: (hasDownloads ? plugin.downloadsCheckedAt : null) ?? plugin.starsCheckedAt ?? null,
  }
  if (row.name === '') continue
  rows.push(row)
}

rows.sort((left, right) => left.name.localeCompare(right.name))

const document = {
  updated: typeof catalog.updated === 'string' ? catalog.updated : '',
  source: catalog.source ?? SOURCE,
  count: rows.length,
  plugins: rows,
}

await writeFile(OUT, `${JSON.stringify(document)}\n`)
console.log(`build-stats: wrote ${rows.length} row(s) to docs/stats.json`)
