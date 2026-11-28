#!/usr/bin/env node
/**
 * Veyra plugin-market CLI for agents.
 *
 * Read-only commands (`search`, `info`, `sources`, `list`, `download`, and the
 * default output of install/update/uninstall) never touch a profile. The
 * mutating commands run the official `dsh plugin` CLI only when `--apply` is
 * passed; without it they print the exact target and the equivalent
 * `plugin_manager` tool call, so the agent can apply it through the host tool
 * instead. Index data is the same format-1 catalog the market UI reads.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// 默认源用「发布后即时生效」的那两个。jsDelivr 对 `@master` 这类分支引用会缓存
// 12 小时到 7 天，索引一更新，命令行反而报旧版本号——排查版本问题时最容易被它误导。
const VEYRA = {
  domestic: 'https://ghproxy.net/https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/master/docs/index.json',
  overseas: 'https://lanxiake.github.io/dsh-vyra-plugins/index-github.json',
}
const SOURCES = [
  { id: 'veyra', label: 'Veyra', url: (region) => VEYRA[region] },
  { id: 'dshmarket', label: 'dshmarket.com', url: () => 'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json' },
  { id: 'dshopen', label: 'DSH Open Market', url: () => 'https://dshopen.org/index.json' },
  { id: 'dshgo', label: 'DSH Go Market', url: () => 'https://go.dshtui.com/market/index.json' },
]
const CACHE_FILE = join(homedir(), '.dsh', 'vyra-market-cache.json')
const CACHE_MS = 10 * 60 * 1000
const DOWNLOAD_DIR = join(homedir(), '.dsh', 'market-downloads')

function usage() {
  return `vyra-market <command> [options]

Commands:
  search <words>           Search every built-in index (cross-source)
  info <name>              All versions and install targets of one plugin
  download <name>          Download the package tarball without installing
  install <name|spec>      Resolve (or apply with --apply) an installation
  update <name>            Resolve (or apply) remove+install for the latest
  uninstall <name>         Resolve (or apply) a removal
  list                     List the profile's installed bundles
  sources                  Show the built-in index sources

Options:
  --region=domestic|overseas   Veyra index edition (default: domestic)
  --source=<id|url>            Restrict to one source (repeatable)
  --limit=<n>                  Search result limit (default: 25)
  --version=<v>                Exact version for info/download/install
  --dest=<dir>                 Download directory (default: ~/.dsh/market-downloads)
  --profile=<name>             DSH profile (default: DSH_PROFILE or desktop)
  --dsh=<path>                 dsh executable (default: DSH_BIN or PATH)
  --spec                       Treat install's argument as a direct spec
  --apply                      Run the official dsh plugin command
  --refresh                    Ignore the 10-minute index cache
  --json                       Machine-readable output
  --lang=zh|en                 Display language (default: zh)
  --help`
}

function parseArgs(argv) {
  const options = {
    region: process.env.DSH_MARKET_REGION === 'overseas' ? 'overseas' : 'domestic',
    sources: [],
    limit: 25,
    dest: DOWNLOAD_DIR,
    profile: process.env.DSH_PROFILE || 'desktop',
    dsh: process.env.DSH_BIN || undefined,
    apply: false,
    spec: false,
    refresh: false,
    json: false,
    lang: 'zh',
    version: undefined,
  }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) { positional.push(arg); continue }
    const eq = arg.indexOf('=')
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
    let value = eq === -1 ? undefined : arg.slice(eq + 1)
    if (value === undefined && ['region', 'source', 'limit', 'dest', 'profile', 'dsh', 'lang', 'version'].includes(key)) {
      value = argv[i + 1]
      i += 1
    }
    switch (key) {
      case 'region': options.region = value === 'overseas' ? 'overseas' : 'domestic'; break
      case 'source': options.sources.push(value); break
      case 'limit': options.limit = Math.max(1, Math.min(100, Number(value) || 25)); break
      case 'dest': options.dest = value; break
      case 'profile': options.profile = value; break
      case 'dsh': options.dsh = value; break
      case 'version': options.version = value; break
      case 'lang': options.lang = value === 'en' ? 'en' : 'zh'; break
      case 'apply': options.apply = true; break
      case 'spec': options.spec = true; break
      case 'refresh': options.refresh = true; break
      case 'json': options.json = true; break
      case 'help': options.help = true; break
      default: throw new Error(`unknown option --${key}`)
    }
  }
  return { command: positional.shift(), args: positional, options }
}

function localized(value, lang) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return value[lang] ?? value[lang === 'zh' ? 'zh-CN' : 'en'] ?? value.en ?? Object.values(value).find((item) => typeof item === 'string') ?? ''
}

/** Every language variant of a localized field, for search. */
function variants(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).filter((item) => typeof item === 'string')
}

function readCache() {
  try {
    const value = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function writeCache(cache) {
  try { mkdirSync(join(homedir(), '.dsh'), { recursive: true }); writeFileSync(CACHE_FILE, JSON.stringify(cache)) } catch { /* cache is optional */ }
}

async function fetchIndex(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { accept: 'application/json', 'user-agent': 'vyra-market-cli' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (data?.format !== 1 || !Array.isArray(data.plugins)) throw new Error('not a format-1 index')
  return data
}

function selectedSources(options) {
  if (options.sources.length === 0) return SOURCES.map((source) => ({ id: source.id, label: source.label, url: source.url(options.region) }))
  return options.sources.map((value) => {
    const known = SOURCES.find((source) => source.id === value)
    return known
      ? { id: known.id, label: known.label, url: known.url(options.region) }
      : { id: value, label: value, url: value }
  })
}

async function loadIndexes(options) {
  const cache = readCache()
  const list = selectedSources(options)
  const results = await Promise.all(list.map(async (source) => {
    const cached = cache[source.url]
    if (!options.refresh && cached && Date.now() - cached.at < CACHE_MS) {
      return { source, index: cached.index }
    }
    try {
      const index = await fetchIndex(source.url)
      cache[source.url] = { at: Date.now(), index }
      return { source, index }
    } catch (error) {
      return { source, error: String(error?.message ?? error) }
    }
  }))
  writeCache(cache)
  const failures = results.filter((result) => result.error !== undefined)
  if (failures.length === results.length) throw new Error(failures[0].error)
  return { indexes: results.filter((result) => result.index !== undefined), failures }
}

function installSpec(name, version) {
  if (version?.install?.spec !== undefined) return version.install.spec
  if (version?.source?.type === 'git') {
    const url = String(version.source.url).replace(/^git\+/i, '')
    return `git+${url}#${version.source.commit}${version.source.path ? `&path:/${version.source.path}` : ''}`
  }
  return `${name}@${version?.version ?? ''}`.replace(/@$/, '')
}

function versionFor(entry, exact) {
  const versions = Array.isArray(entry?.versions) ? entry.versions : []
  if (exact !== undefined) return versions.find((version) => version.version === exact) ?? null
  return versions[0] ?? null
}

function score(entry, words) {
  if (words.length === 0) return 0
  const name = String(entry.name ?? '').toLowerCase()
  const title = variants(entry.title).join(' ').toLowerCase()
  const description = variants(entry.description).join(' ').toLowerCase()
  const keywords = [
    ...(Array.isArray(entry.metadata?.keywords) ? entry.metadata.keywords : []),
    entry.metadata?.category,
  ].filter((item) => typeof item === 'string').join(' ').toLowerCase()
  let total = 0
  for (const word of words) {
    if (name === word) total += 12
    else if (name.startsWith(word)) total += 8
    else if (name.includes(word)) total += 5
    else if (title.includes(word)) total += 4
    else if (keywords.includes(word)) total += 3
    else if (description.includes(word)) total += 2
    else return -1
  }
  return total
}

function flattened(indexes, exact, lang = 'zh') {
  const entries = []
  for (const { source, index } of indexes) {
    for (const entry of index.plugins) {
      const version = versionFor(entry, exact)
      if (version === null) continue
      entries.push({
        entry,
        source,
        version,
        name: String(entry.name),
        title: localized(entry.title, lang) || String(entry.name),
        description: localized(entry.description, lang),
        installSpec: installSpec(entry.name, version),
      })
    }
  }
  return entries
}

function findEntry(indexes, name, exact, lang = 'zh') {
  const wanted = name.toLowerCase()
  const all = flattened(indexes, exact, lang)
  return all.find((row) => row.name.toLowerCase() === wanted)
    ?? all.find((row) => row.name.toLowerCase().split('/').at(-1) === wanted)
    ?? null
}

function output(value, options, human) {
  if (options.json) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); return }
  if (human !== '') process.stdout.write(`${human.trimEnd()}\n`)
}

function installedBundles(profile) {
  const dir = join(homedir(), '.dsh', 'profiles', profile)
  const manifest = join(dir, 'package.json')
  if (!existsSync(manifest)) return []
  let dependencies = {}
  try { dependencies = JSON.parse(readFileSync(manifest, 'utf8')).dependencies ?? {} } catch { return [] }
  return Object.keys(dependencies).map((name) => {
    let version = String(dependencies[name])
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8'))
      version = String(pkg.version ?? version)
    } catch { /* keep the declared range */ }
    return { name, version, spec: String(dependencies[name]) }
  })
}

function cmdOf(options, action, spec) {
  const quote = (value) => `"${String(value).replace(/"/g, '""')}"`
  return process.platform === 'win32'
    ? `${quote(options.dsh || 'dsh')} plugin --profile ${quote(options.profile)} ${action} ${quote(spec)}`
    : `${options.dsh || 'dsh'} plugin --profile ${options.profile} ${action} ${spec}`
}

function applyDsh(options, action, spec) {
  const dsh = options.dsh ?? (process.platform === 'win32' ? 'dsh' : 'dsh')
  const args = ['plugin', '--profile', options.profile, action, spec]
  const command = process.platform === 'win32'
    ? `${cmdOf(options, action, spec)}`
    : dsh
  const result = process.platform === 'win32'
    ? spawnSync(command, { stdio: 'inherit', shell: true })
    : spawnSync(dsh, args, { stdio: 'inherit' })
  if (result.error) throw new Error(result.error.message)
  if ((result.status ?? 1) !== 0) throw new Error(`dsh plugin exited with ${result.status}`)
}

async function main() {
  const { command, args, options } = parseArgs(process.argv.slice(2))
  if (command === undefined || command === 'help' || command === '--help' || options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }

  if (command === 'sources') {
    const sources = selectedSources(options)
    output({ region: options.region, sources }, options, sources.map((source) => `${source.id}\t${source.label}\t${source.url}`).join('\n'))
    return
  }

  if (command === 'list') {
    const bundles = installedBundles(options.profile)
    output({ profile: options.profile, bundles }, options, bundles.map((bundle) => `${bundle.name}\t${bundle.version}\t${bundle.spec}`).join('\n'))
    return
  }

  if (command === 'search') {
    const query = args.join(' ').trim()
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const { indexes, failures } = await loadIndexes(options)
    const rows = flattened(indexes, undefined, options.lang)
      .map((row) => ({ ...row, score: score(row.entry, words) }))
      .filter((row) => row.score >= 0)
      .sort((left, right) => right.score - left.score || right.version.publishTimestamp - left.version.publishTimestamp || left.name.localeCompare(right.name))
      .slice(0, options.limit)
    const payload = {
      query,
      region: options.region,
      failures: failures.map((failure) => `${failure.source.label}: ${failure.error}`),
      entries: rows.map((row) => ({
        name: row.name,
        title: row.title,
        description: row.description,
        source: row.source.label,
        sourceUrl: row.source.url,
        version: row.version.version,
        installSpec: row.installSpec,
        engines: row.version.engines ?? {},
      })),
    }
    output(payload, options, rows.map((row) => `${row.name}\t${row.version.version}\t${row.source.label}\t${row.installSpec}`).join('\n'))
    return
  }

  const { indexes } = await loadIndexes(options)

  if (command === 'info') {
    const name = args[0]
    if (name === undefined) throw new Error('info requires a plugin name')
    const row = findEntry(indexes, name, undefined, options.lang)
    if (row === null) throw new Error(`no index lists ${name}`)
    const versions = row.entry.versions.map((version) => ({
      version: version.version,
      published: version.publishTimestamp,
      engines: version.engines ?? {},
      installSpec: installSpec(row.name, version),
      source: row.source.label,
    }))
    output({ name: row.name, title: row.title, description: row.description, versions }, options, versions.map((version) => `${version.version}\t${version.installSpec}`).join('\n'))
    return
  }

  const name = args[0]

  if (command === 'download') {
    if (name === undefined) throw new Error('download requires a plugin name')
    const row = findEntry(indexes, name, options.version, options.lang)
    if (row === null) throw new Error(`no index lists ${name}${options.version ? `@${options.version}` : ''}`)
    mkdirSync(options.dest, { recursive: true })
    const source = row.version.source
    let url
    if (source.type === 'npm') {
      const registry = String(source.registry ?? 'https://registry.npmjs.org').replace(/\/+$/, '')
      const meta = await (await fetch(`${registry}/${encodeURIComponent(row.name)}/${row.version.version}`, { signal: AbortSignal.timeout(30000) })).json()
      url = meta?.dist?.tarball
      if (typeof url !== 'string') throw new Error('registry named no tarball')
    } else {
      const repo = String(source.url).replace(/^git\+/i, '').replace(/\.git$/i, '')
      url = repo.includes('github.com')
        ? `https://codeload.github.com/${repo.split('github.com/')[1]}/tar.gz/${source.commit}`
        : `${repo}/archive/${source.commit}.tar.gz`
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) })
    if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const ext = source.type === 'npm' ? '.tgz' : '.tar.gz'
    const file = join(options.dest, `${row.name.replace(/[@/]/g, '-')}-${row.version.version}${ext}`)
    writeFileSync(file, bytes)
    output({ name: row.name, version: row.version.version, source: row.source.label, url, file, bytes: bytes.length }, options, file)
    return
  }

  if (command === 'install') {
    if (name === undefined) throw new Error('install requires a name or spec')
    const direct = options.spec
      || /^(?:github:|git\+|https?:|file:|link:)/i.test(name)
      || /@\d/.test(name)
    let spec = name
    let resolved = null
    if (!direct) {
      resolved = findEntry(indexes, name, options.version, options.lang)
      if (resolved === null) throw new Error(`no index lists ${name}; pass an explicit spec for a direct install`)
      spec = resolved.installSpec
    }
    const plan = {
      action: 'install',
      name: resolved?.name ?? name,
      version: resolved?.version.version ?? null,
      installSpec: spec,
      source: resolved?.source.label ?? 'explicit spec',
      command: cmdOf(options, 'add', spec),
      tool: { name: 'plugin_manager', action: 'install_bundle', target: spec },
    }
    if (!options.apply) { output(plan, options, `${plan.installSpec}\n${plan.command}`); return }
    applyDsh(options, 'add', spec)
    output({ ...plan, applied: true }, options, `installed ${plan.installSpec}`)
    return
  }

  if (command === 'update') {
    if (name === undefined) throw new Error('update requires a plugin name')
    const resolved = findEntry(indexes, name, options.version, options.lang)
    if (resolved === null) throw new Error(`no index lists ${name}`)
    const installed = installedBundles(options.profile).find((bundle) => bundle.name.toLowerCase() === resolved.name.toLowerCase())
    const plan = {
      action: 'update',
      name: resolved.name,
      installed: installed?.version ?? null,
      version: resolved.version.version,
      installSpec: resolved.installSpec,
      source: resolved.source.label,
      remove: cmdOf(options, 'remove', resolved.name),
      add: cmdOf(options, 'add', resolved.installSpec),
      note: 'The official CLI has no in-place update; this removes and re-adds. The market UI’s update keeps the installed source. Configuration may reset.',
      tools: [
        { name: 'plugin_manager', action: 'remove_bundle', target: resolved.name },
        { name: 'plugin_manager', action: 'install_bundle', target: resolved.installSpec },
      ],
    }
    if (!options.apply) { output(plan, options, `${plan.remove}\n${plan.add}\n${plan.note}`); return }
    applyDsh(options, 'remove', resolved.name)
    applyDsh(options, 'add', resolved.installSpec)
    output({ ...plan, applied: true }, options, `updated ${plan.name} to ${plan.version}`)
    return
  }

  if (command === 'uninstall') {
    if (name === undefined) throw new Error('uninstall requires a plugin name')
    const plan = {
      action: 'uninstall',
      name,
      command: cmdOf(options, 'remove', name),
      tool: { name: 'plugin_manager', action: 'remove_bundle', target: name },
    }
    if (!options.apply) { output(plan, options, plan.command); return }
    applyDsh(options, 'remove', name)
    output({ ...plan, applied: true }, options, `uninstalled ${name}`)
    return
  }

  throw new Error(`unknown command ${command}; see --help`)
}

main().catch((error) => {
  process.stderr.write(`vyra-market: ${String(error?.message ?? error)}\n`)
  process.exitCode = 1
})
