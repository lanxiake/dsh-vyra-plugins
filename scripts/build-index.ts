/**
 * Project `scripts/market-manifest.ts` into `index/index.json`.
 *
 * The output is the format-1 document `dsh-plugin-market` fetches. Localization
 * maps collapse to a plain string when only English is present, matching the
 * `LocalizedText` union. `publishTimestamp` comes from each version's entry in
 * the manifest, so a rebuild never rewrites a published version's timestamp.
 *
 * @module vyra-plugins/build-index
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { manifest, type LocalizedText, type LocaleMap, type MarketPluginSource, type MarketVersionSource } from './market-manifest.ts'

/** Collapse a locale map to the `LocalizedText` union. */
function localized(text: LocaleMap): LocalizedText {
  return text.zh === undefined ? text.en : { en: text.en, zh: text.zh }
}

/** Project one version's install source. */
function source(version: MarketVersionSource): Record<string, unknown> {
  return version.type === 'npm'
    ? { type: 'npm', ...(version.registry === undefined ? {} : { registry: version.registry }) }
    : {
      type: 'git',
      url: version.url,
      commit: version.commit,
      ...(version.path === undefined ? {} : { path: version.path }),
    }
}

/** Project one plugin, preserving published timestamps. */
function plugin(entry: MarketPluginSource, publishedAt: Readonly<Record<string, number>>): Record<string, unknown> {
  return {
    name: entry.name,
    title: localized(entry.title),
    description: localized(entry.description),
    ...(entry.icon === undefined ? {} : { icon: entry.icon }),
    ...(entry.author === undefined ? {} : { author: entry.author }),
    ...(entry.homepage === undefined ? {} : { homepage: entry.homepage }),
    ...(entry.repository === undefined ? {} : { repository: entry.repository }),
    metadata: {
      ...(entry.metadata?.category === undefined ? {} : { category: entry.metadata.category }),
      keywords: entry.metadata?.keywords ?? [],
      labels: entry.metadata?.labels ?? [],
      sortKeys: {},
    },
    versions: Object.keys(entry.versions)
      .map(version => ({
        version,
        publishTimestamp: publishedAt[`${entry.name}@${version}`] ?? 0,
        source: source(entry.versions[version]!),
        engines: {},
      }))
      .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true })),
  }
}

const root = resolve(import.meta.dirname, '..')
const publishedPath = resolve(root, 'index/published.json')

let publishedAt: Record<string, number> = {}
try {
  publishedAt = JSON.parse(readFileSync(publishedPath, 'utf8')) as Record<string, number>
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

const document = {
  format: 1,
  title: localized(manifest.title),
  ...(manifest.description === undefined ? {} : { description: localized(manifest.description) }),
  metadata: {
    categories: manifest.declarations?.categories ?? {},
    labels: manifest.declarations?.labels ?? {},
    sortKeys: {},
  },
  plugins: manifest.plugins.map(entry => plugin(entry, publishedAt)),
}

writeFileSync(resolve(root, 'index/index.json'), `${JSON.stringify(document, undefined, 2)}\n`)
console.log(`build-index: wrote ${document.plugins.length} plugin(s) to index/index.json`)
