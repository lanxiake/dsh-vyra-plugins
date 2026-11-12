/**
 * Project `scripts/market-manifest.ts` into `docs/index.json`.
 *
 * The output is the format-1 document `dsh-plugin-market` fetches. Localization
 * maps collapse to a plain string when only English is present, matching the
 * `LocalizedText` union. Everything the output needs lives in the manifest, so
 * rebuilding produces a byte-identical file — a published version's timestamp
 * and commit cannot drift.
 *
 * @module dsh-vyra-plugins/build-index
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { manifest, type LocalizedText, type LocaleMap, type MarketInstallSource, type MarketPluginSource, type MarketVersionSource } from './market-manifest.ts'

/** Collapse a locale map to the `LocalizedText` union. */
function localized(text: LocaleMap): LocalizedText {
  return text.zh === undefined ? text.en : { en: text.en, zh: text.zh }
}

/** Project one version's install source. */
function source(install: MarketInstallSource): Record<string, unknown> {
  return install.type === 'npm'
    ? { type: 'npm', ...(install.registry === undefined ? {} : { registry: install.registry }) }
    : {
      type: 'git',
      url: install.url,
      commit: install.commit,
      ...(install.path === undefined ? {} : { path: install.path }),
    }
}

/** Project one plugin. */
function plugin(entry: MarketPluginSource): Record<string, unknown> {
  // `metadata` is omitted entirely when it carries nothing, matching how
  // published indexes write it: an empty object or empty arrays would be
  // noise the Discover filters then have to ignore.
  const hasMetadata = entry.metadata !== undefined && (
    entry.metadata.category !== undefined
    || (entry.metadata.keywords?.length ?? 0) > 0
    || (entry.metadata.labels?.length ?? 0) > 0
  )

  return {
    name: entry.name,
    title: localized(entry.title),
    description: localized(entry.description),
    ...(entry.icon === undefined ? {} : { icon: entry.icon }),
    ...(entry.author === undefined ? {} : { author: entry.author }),
    ...(entry.homepage === undefined ? {} : { homepage: entry.homepage }),
    ...(entry.repository === undefined ? {} : { repository: entry.repository }),
    versions: Object.entries(entry.versions)
      .map(([version, published]: [string, MarketVersionSource]) => ({
        version,
        publishTimestamp: published.publishTimestamp,
        source: source(published.source),
        // An empty object here means "any DSH", which is the same as omitting
        // the field, so it is omitted rather than written empty.
        ...(entry.engines?.dsh === undefined ? {} : { engines: { dsh: entry.engines.dsh } }),
      }))
      .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true })),
    ...(hasMetadata
      ? {
        metadata: {
          ...(entry.metadata?.category === undefined ? {} : { category: entry.metadata.category }),
          ...((entry.metadata?.keywords?.length ?? 0) > 0 ? { keywords: entry.metadata?.keywords } : {}),
          ...((entry.metadata?.labels?.length ?? 0) > 0 ? { labels: entry.metadata?.labels } : {}),
        },
      }
      : {}),
  }
}

const root = resolve(import.meta.dirname, '..')

const document = {
  format: 1,
  title: localized(manifest.title),
  ...(manifest.description === undefined ? {} : { description: localized(manifest.description) }),
  metadata: {
    categories: manifest.declarations?.categories ?? {},
    labels: manifest.declarations?.labels ?? {},
    sortKeys: {},
  },
  plugins: manifest.plugins.map(plugin),
}

writeFileSync(resolve(root, 'docs/index.json'), `${JSON.stringify(document, undefined, 2)}\n`)
console.log(`build-index: wrote ${document.plugins.length} plugin(s) to docs/index.json`)
