#!/usr/bin/env node
/**
 * vyra-skill — the agent-facing CLI for this manager's skill and MCP market.
 *
 * Every command is read-only by default: it resolves what would happen and prints
 * either a human line or a stable JSON payload. Only `--apply` touches the disk, and
 * `--apply` runs the same vendor functions the panel uses, so the CLI is never a
 * second install path with its own rules.
 *
 * There is deliberately no upgrade command: skills and MCP servers are reinstalled,
 * not upgraded in place, and offering an "upgrade" that silently reinstalls would
 * misreport what happened.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { CATEGORIES, categoryId, classify } from './lib/classify.mjs'
import { mergeItems, decorateSkills, summarize } from './lib/aggregate.mjs'
import { searchSkillNet } from './lib/skillnet.mjs'
import { searchSkills } from './vendor/dsh-skill-mcp-market/src/sources.js'
import {
  installSkill,
  listInstalledSkills,
  toggleSkillFile,
  uninstallSkill,
} from './vendor/dsh-skill-mcp-market/src/skills.js'
import { skillMetaFromText } from './vendor/dsh-skill-mcp-market/src/frontmatter.js'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const AGENTS_HOME = process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')

function defaultSkillDirs() {
  return [join(AGENTS_HOME, 'skills'), join(DSH_HOME, 'market', 'skills')]
}

function defaultMcpDir() {
  return join(DSH_HOME, 'market', 'mcp')
}

function usage() {
  return `vyra-skill <command> [options]

Commands:
  search <words>            Search every skill source at once (cross-source)
  info <slug>               One skill: description, source, category, install target
  list                      Installed skills, with category
  categories                The SkillNet category table
  open-dir <slug>           Print the directory of an installed skill
  install <slug|url>        Resolve (or apply with --apply) an install
  uninstall <slug>          Resolve (or apply) a removal
  enable <slug>             Resolve (or apply) re-enabling a disabled skill
  disable <slug>            Resolve (or apply) hiding a skill from the catalog

  mcp search <words>        Search the MCP catalogues at once
  mcp list                  Installed MCP servers, with category
  mcp open-dir <name>       Print the file of an installed MCP definition
  mcp install <name>        Resolve (or apply) an install from the registry
  mcp uninstall <name>      Resolve (or apply) a removal
  mcp enable <name>         Resolve (or apply) re-enabling a server
  mcp disable <name>        Resolve (or apply) disabling a server

Options:
  --category=<name|value>   Filter by SkillNet category (Chinese name or id)
  --limit=<n>               Search result limit (default 25)
  --source=<id>             Search only one source
  --skillnet                Include SkillNet in this search
  --skills-dir=<dir>        Override the skill directories (repeatable)
  --mcp-dir=<dir>           Override the MCP definition directory
  --apply                   Perform the change (default: print the plan)
  --json                    Machine-readable output
  --help`
}

function parseArgs(argv) {
  const options = {
    category: '',
    limit: 25,
    source: 'all',
    skillnet: false,
    skillDirs: [],
    mcpDir: '',
    apply: false,
    json: false,
    help: false,
  }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) { positional.push(arg); continue }
    const eq = arg.indexOf('=')
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
    let value = eq === -1 ? undefined : arg.slice(eq + 1)
    const takesValue = ['category', 'limit', 'source', 'skills-dir', 'mcp-dir'].includes(key)
    if (value === undefined && takesValue && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      value = argv[i + 1]
      i += 1
    }
    switch (key) {
      case 'category': options.category = value || ''; break
      case 'limit': options.limit = Math.max(1, Math.min(100, Number(value) || 25)); break
      case 'source': options.source = value || 'all'; break
      case 'skills-dir': if (value) options.skillDirs.push(resolve(value)); break
      case 'mcp-dir': options.mcpDir = resolve(value); break
      case 'skillnet': options.skillnet = true; break
      case 'apply': options.apply = true; break
      case 'json': options.json = true; break
      case 'help': options.help = true; break
      default: throw new Error(`unknown option --${key}`)
    }
  }
  return { command: positional.shift(), args: positional, options }
}

function output(payload, options, human) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    return
  }
  if (typeof human === 'string' && human !== '') process.stdout.write(`${human.trimEnd()}\n`)
}

function skillDirsOf(options) {
  return options.skillDirs.length > 0 ? options.skillDirs : defaultSkillDirs()
}

function mcpDirOf(options) {
  return options.mcpDir || defaultMcpDir()
}

// ---- skills ----

async function collectInstalled(options) {
  const dirs = skillDirsOf(options)
  const items = await listInstalledSkills(dirs)
  return items.map((item) => {
    const hit = classify({ name: item.name, description: item.description, whenToUse: item.whenToUse })
    return { ...item, category: hit.id, categoryLabel: hit.label, matched: hit.matched }
  })
}

async function searchAll(query, options) {
  const result = await searchSkills({ query, source: options.source, page: 1, pageSize: options.limit })
  const degraded = Array.isArray(result.degraded) ? [...result.degraded] : []
  let rows = Array.isArray(result.items) ? result.items : []
  if (options.skillnet) {
    try {
      const extra = await searchSkillNet({ query, category: options.category, pageSize: options.limit })
      rows = rows.concat(extra.items)
    } catch (error) {
      degraded.push({ source: 'skillnet', error: String(error?.message ?? error) })
    }
  }
  let merged = decorateSkills(mergeItems(rows), query)
  const wanted = categoryId(options.category)
  if (wanted !== null) merged = merged.filter((item) => item.category === wanted.id)
  const installed = await collectInstalled(options)
  const taken = new Set(installed.map((item) => item.slug))
  const items = merged
    .map((item) => ({ ...item, installed: taken.has(item.slug) }))
    .slice(0, options.limit);
  return { query, items, degraded, summary: summarize(items, degraded) }
}

/** An installed skill's install target, so `info` can explain how to repeat it. */
async function readSkillMeta(skill) {
  const file = existsSync(join(skill.dir, skill.slug, 'SKILL.md'))
    ? join(skill.dir, skill.slug, 'SKILL.md')
    : join(skill.dir, `${skill.slug}.md`)
  try {
    return skillMetaFromText(await readFile(file, 'utf8'), skill.slug)
  } catch {
    return null
  }
}

function planPayload(action, name, tool, toolArgs, extra = {}) {
  return {
    action,
    name,
    actions: [{ tool, args: toolArgs }],
    ...extra,
  }
}

async function applySkill(action, tool, toolArgs, run) {
  await run()
  return { action, ...toolArgs, applied: true }
}

// ---- MCP ----

async function listMcp(options) {
  const dir = mcpDirOf(options)
  if (!existsSync(dir)) return []
  const names = await readdir(dir)
  const out = []
  for (const file of names) {
    if (!file.endsWith('.json') || file.startsWith('.')) continue
    try {
      const def = JSON.parse(await readFile(join(dir, file), 'utf8'))
      const serverName = String(def.serverName || file.replace(/\.json$/, ''))
      const hit = classify({
        name: def.title || serverName,
        description: def.description,
        command: def.command,
        args: def.args,
        category: def.category,
      })
      const tools = Array.isArray(def.tools) ? def.tools : []
      out.push({
        serverName,
        name: def.title || serverName,
        description: def.description || '',
        transport: def.transport || (def.url ? 'streamable-http' : 'stdio'),
        command: def.command || '',
        args: def.args || [],
        url: def.url || '',
        enabled: def.enabled !== false,
        tools,
        path: join(dir, file),
        category: hit.id,
        categoryLabel: hit.label,
      })
    } catch {
      // malformed definition: skip it, keep the rest
    }
  }
  return out.sort((left, right) => left.serverName.localeCompare(right.serverName))
}

async function writeMcpDefinition(options, serverName, patch) {
  const dir = mcpDirOf(options)
  const file = join(dir, `${serverName}.json`)
  if (!existsSync(file)) throw new Error(`no MCP definition named ${serverName} in ${dir}`)
  const def = JSON.parse(await readFile(file, 'utf8'))
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify({ ...def, ...patch }, null, 2)}\n`, 'utf8')
  return file
}

// ---- commands ----

async function main() {
  const { command, args, options } = parseArgs(process.argv.slice(2))
  if (command === undefined || command === 'help' || options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }

  if (command === 'categories') {
    const rows = CATEGORIES.map((entry) => ({ id: entry.id, label: entry.label, skillnet: entry.skillnet, domain: entry.domain }))
    output({ categories: rows }, options, rows.map((row) => `${row.label}\t${row.skillnet}\t${row.id}`).join('\n'))
    return
  }

  if (command === 'search') {
    const query = args.join(' ').trim()
    const result = await searchAll(query, options)
    const human = result.items
      .map((item) => `${item.slug}\t${item.categoryLabel}\t${item.installed ? '已装' : '未装'}\t${item.sourceLabel || item.source}\t${item.description || ''}`)
      .join('\n')
    output(result, options, human)
    return
  }

  if (command === 'list') {
    const items = await collectInstalled(options)
    const wanted = categoryId(options.category)
    const rows = wanted === null ? items : items.filter((item) => item.category === wanted.id)
    output({ items: rows }, options, rows.map((row) => `${row.slug}\t${row.categoryLabel}\t${join(row.dir, row.slug)}`).join('\n'))
    return
  }

  if (command === 'info') {
    const slug = args[0]
    if (!slug) throw new Error('info requires a skill slug')
    const installed = (await collectInstalled(options)).find((item) => item.slug === slug)
    if (installed) {
      const meta = await readSkillMeta(installed)
      const payload = { ...installed, meta }
      output(payload, options, `${installed.slug}\t${installed.categoryLabel}\t${join(installed.dir, installed.slug)}`)
      return
    }
    const found = await searchAll(slug, { ...options, category: '' })
    const item = found.items.find((entry) => entry.slug === slug) ?? null
    if (item === null) throw new Error(`no source lists ${slug}`)
    output(item, options, `${item.slug}\t${item.categoryLabel}\t${item.sourceLabel || item.source}`)
    return
  }

  if (command === 'open-dir') {
    const slug = args[0]
    if (!slug) throw new Error('open-dir requires a skill slug')
    const installed = (await collectInstalled(options)).find((item) => item.slug === slug)
    if (!installed) throw new Error(`skill ${slug} is not installed`)
    const dir = join(installed.dir, installed.slug)
    output({ slug, dir }, options, dir)
    return
  }

  if (command === 'install') {
    const reference = args[0]
    if (!reference) throw new Error('install requires a slug or url')
    const plan = planPayload('install', reference, 'skill_market_install', { reference }, {
      note: 'Resolve from the market first (vyra-skill search) so the install source is known; pass --apply to install.',
    })
    if (!options.apply) { output(plan, options, `${plan.actions[0].tool} ${reference}`); return }
    const result = await applySkill('install', 'skill_market_install', { reference }, () =>
      installSkill({ source: /^https?:|^git@|^[^/]+\/[^/]+$/.test(reference) ? 'github' : 'url', reference, skillDirs: skillDirsOf(options), force: false }))
    output({ ...result, slug: result.slug }, options, `installed ${reference}`)
    return
  }

  if (command === 'uninstall') {
    const slug = args[0]
    if (!slug) throw new Error('uninstall requires a skill slug')
    const plan = planPayload('uninstall', slug, 'skill_market_uninstall', { slug }, {
      note: 'Removal moves the skill into the trash directory, so it can be restored.',
    })
    if (!options.apply) { output(plan, options, `${plan.actions[0].tool} ${slug}`); return }
    const result = await applySkill('uninstall', 'skill_market_uninstall', { slug }, () =>
      uninstallSkill({ slug, dirs: skillDirsOf(options), agentsHomeSkillsDir: join(AGENTS_HOME, 'skills') }))
    output(result, options, `uninstalled ${slug}`)
    return
  }

  if (command === 'enable' || command === 'disable') {
    const slug = args[0]
    if (!slug) throw new Error(`${command} requires a skill slug`)
    const enabled = command === 'enable'
    const plan = planPayload(command, slug, 'skill_market_list', { slug, enabled }, {
      note: 'Enabling/disabling edits the SKILL.md frontmatter flag; it does not move files.',
    })
    if (!options.apply) { output(plan, options, `${command} ${slug} (files stay on disk)`); return }
    const result = await applySkill(command, 'skill_market_list', { slug, enabled }, () =>
      toggleSkillFile({ dirs: skillDirsOf(options), slug, enabled }))
    output(result, options, `${command}d ${slug}`)
    return
  }

  if (command === 'mcp') {
    const sub = args.shift()
    if (sub === undefined || sub === 'help') { process.stdout.write(`${usage()}\n`); return }

    if (sub === 'list') {
      const items = await listMcp(options)
      const wanted = categoryId(options.category)
      const rows = wanted === null ? items : items.filter((item) => item.category === wanted.id)
      output({ items: rows }, options, rows.map((row) => `${row.serverName}\t${row.categoryLabel}\t${row.enabled ? '启用' : '停用'}`).join('\n'))
      return
    }

    if (sub === 'search') {
      const query = args.join(' ').trim()
      // The panel and the CLI share the host's catalogue loader; here we only need the
      // registry, which is the one catalogue a headless run can query cheaply.
      const { searchMcpRegistryPage } = await import('./vendor/dsh-skill-mcp-market/src/mcp-registry.js')
      const { makeCache } = await import('./vendor/dsh-skill-mcp-market/src/sources.js')
      const cache = makeCache(join(DSH_HOME, 'market', '.cli-cache'))
      const result = await searchMcpRegistryPage({ query, page: 1, pageSize: options.limit, category: '', cache })
      const wanted = categoryId(options.category)
      const items = result.items
        .map((item) => {
          const hit = classify({ name: item.name, description: item.description, category: item.category })
          return { ...item, category: hit.id, categoryLabel: hit.label }
        })
        .filter((item) => wanted === null || item.category === wanted.id)
      output({ query, items }, options, items.map((item) => `${item.slug}\t${item.categoryLabel}\t${item.description || ''}`).join('\n'))
      return
    }

    if (sub === 'open-dir') {
      const name = args[0]
      if (!name) throw new Error('mcp open-dir requires a server name')
      const item = (await listMcp(options)).find((entry) => entry.serverName === name)
      if (!item) throw new Error(`MCP ${name} is not installed`)
      output({ serverName: name, path: item.path, dir: dirname(item.path) }, options, dirname(item.path))
      return
    }

    if (sub === 'install') {
      const name = args[0]
      if (!name) throw new Error('mcp install requires a server name')
      const plan = planPayload('install', name, 'mcp_market_install', { slug: name }, {
        note: 'The server is written as <name>.json in the MCP directory and mounted on the next reconcile.',
      })
      if (!options.apply) { output(plan, options, `${plan.actions[0].tool} ${name}`); return }
      const { registryDefinitionByName } = await import('./vendor/dsh-skill-mcp-market/src/mcp-registry.js')
      const { makeCache } = await import('./vendor/dsh-skill-mcp-market/src/sources.js')
      const cache = makeCache(join(DSH_HOME, 'market', '.cli-cache'))
      const definition = await registryDefinitionByName(name, cache)
      if (!definition) throw new Error(`the registry has no server named ${name}`)
      const dir = mcpDirOf(options)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, `${definition.serverName}.json`), `${JSON.stringify(definition, null, 2)}\n`, 'utf8')
      output({ action: 'install', serverName: definition.serverName, applied: true }, options, `installed ${definition.serverName}`)
      return
    }

    if (sub === 'uninstall') {
      const name = args[0]
      if (!name) throw new Error('mcp uninstall requires a server name')
      const plan = planPayload('uninstall', name, 'mcp_market_uninstall', { serverName: name })
      if (!options.apply) { output(plan, options, `${plan.actions[0].tool} ${name}`); return }
      const file = join(mcpDirOf(options), `${name}.json`)
      if (!existsSync(file)) throw new Error(`no MCP definition named ${name}`)
      await rm(file, { force: true })
      output({ action: 'uninstall', serverName: name, applied: true }, options, `uninstalled ${name}`)
      return
    }

    if (sub === 'enable' || sub === 'disable') {
      const name = args[0]
      if (!name) throw new Error(`mcp ${sub} requires a server name`)
      const enabled = sub === 'enable'
      const plan = planPayload(sub, name, 'mcp_market_set_enabled', { serverName: name, enabled })
      if (!options.apply) { output(plan, options, `${sub} ${name}`); return }
      const file = await writeMcpDefinition(options, name, { enabled })
      output({ action: sub, serverName: name, enabled, file, applied: true }, options, `${sub}d ${name}`)
      return
    }

    throw new Error(`unknown mcp command ${sub}; see --help`)
  }

  throw new Error(`unknown command ${command}; see --help`)
}

main().catch((error) => {
  process.stderr.write(`vyra-skill: ${String(error?.message ?? error)}\n`)
  process.exitCode = 1
})
