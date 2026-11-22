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

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { manifest, type LocalizedText, type LocaleMap, type MarketInstallSource, type MarketPluginSource, type MarketVersionSource } from './market-manifest.ts'

/**
 * Star/download numbers from `docs/stats.json`, if it has been generated.
 *
 * Format 1 has no stars/downloads members, but it does have market-defined
 * numeric sort keys, and the Host carries them through to the client. Writing
 * the same numbers there gives our own index native popularity sorting without
 * inventing a field the format rejects.
 */
interface StatRow {
  readonly name?: string
  readonly npm?: string | null
  readonly repo?: string | null
  readonly stars?: number
  readonly downloads?: number
  readonly checked?: string | null
}

function loadStats(): { byNpm: Map<string, StatRow>, byRepo: Map<string, StatRow>, byName: Map<string, StatRow> } {
  const file = resolve(import.meta.dirname, '..', 'docs', 'stats.json')
  if (!existsSync(file)) return { byNpm: new Map(), byRepo: new Map(), byName: new Map() }
  const document = JSON.parse(readFileSync(file, 'utf8')) as { plugins?: StatRow[] }
  const byNpm = new Map<string, StatRow>()
  const byRepo = new Map<string, StatRow>()
  const byName = new Map<string, StatRow>()
  for (const row of document.plugins ?? []) {
    if (typeof row.npm === 'string' && row.npm !== '') byNpm.set(row.npm.toLowerCase(), row)
    if (typeof row.repo === 'string' && row.repo !== '') byRepo.set(row.repo.toLowerCase(), row)
    if (typeof row.name === 'string' && row.name !== '') byName.set(row.name.toLowerCase(), row)
  }
  return { byNpm, byRepo, byName }
}

const STATS = loadStats()

/** The repository `owner/name` in an index entry, lowercased. */
function repoOf(entry: MarketPluginSource): string {
  const url = entry.repository?.url ?? ''
  const match = /github\.com\/([^/]+)\/([^/?#]+)/i.exec(url)
  return match === null ? '' : `${match[1]}/${match[2].replace(/\.git$/i, '')}`.toLowerCase()
}

/** The two numeric sort keys an entry can carry. */
function popularity(entry: MarketPluginSource): Record<string, number> | undefined {
  const repo = repoOf(entry)
  const row = STATS.byNpm.get(entry.name.toLowerCase())
    ?? (repo === '' ? undefined : STATS.byRepo.get(repo))
    ?? STATS.byName.get(entry.name.toLowerCase())
  if (row === undefined) return undefined
  const values: Record<string, number> = {}
  if (typeof row.stars === 'number' && row.stars > 0) values.stars = row.stars
  if (typeof row.downloads === 'number' && row.downloads > 0) values.downloads = row.downloads
  return Object.keys(values).length === 0 ? undefined : values
}

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
  const sortKeys = popularity(entry)
  const hasMetadata = (entry.metadata !== undefined && (
    entry.metadata.category !== undefined
    || (entry.metadata.keywords?.length ?? 0) > 0
    || (entry.metadata.labels?.length ?? 0) > 0
  )) || sortKeys !== undefined

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
          ...(sortKeys === undefined ? {} : { sortKeys }),
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
    // Market-defined numeric keys survive format-1 validation, unlike any
    // top-level `stars` member. Values are written per plugin by `popularity`.
    sortKeys: {
      stars: { title: { en: 'Stars', zh: '星标' }, order: 'desc' },
      downloads: { title: { en: 'Downloads', zh: '下载量' }, order: 'desc' },
    },
  },
  plugins: manifest.plugins.map(plugin),
}

const GITHUB_REMOTE = 'https://github.com/lanxiake/dsh-vyra-plugins.git'
const GITCODE_REMOTE = 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git'
const ATOM_GIT_REMOTE = 'https://atomgit.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git'
/** 同一批 commit 推到了三个远端，任何一个都能按 SHA 安装。 */
const OUR_REMOTES = [GITHUB_REMOTE, GITCODE_REMOTE, ATOM_GIT_REMOTE]

/**
 * Rewrite every git install source to one remote.
 *
 * The same commits are pushed to GitHub and GitCode, so a commit SHA installs
 * from either. Domestic users read `docs/index.json` (GitCode, fast inside
 * China); users outside China read `docs/index-github.json` (GitHub).
 */
function retarget(input: Record<string, unknown>, to: string) {
  const copy = structuredClone(input) as {
    plugins: Array<{ versions: Array<{ source: { type?: string; url?: string } }> }>
  }
  for (const entry of copy.plugins) {
    for (const version of entry.versions) {
      if (version.source?.type === 'git' && OUR_REMOTES.includes(version.source.url ?? '')) {
        version.source.url = to
      }
    }
  }
  return copy
}

const domestic = retarget(document, GITCODE_REMOTE)
const overseas = retarget(document, GITHUB_REMOTE)

writeFileSync(resolve(root, 'docs/index.json'), `${JSON.stringify(domestic, undefined, 2)}\n`)
writeFileSync(resolve(root, 'docs/index-github.json'), `${JSON.stringify(overseas, undefined, 2)}\n`)
console.log(`build-index: wrote ${document.plugins.length} plugin(s) to docs/index.json (gitcode) and docs/index-github.json (github)`)
