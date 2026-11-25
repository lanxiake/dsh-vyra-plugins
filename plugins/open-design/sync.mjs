/**
 * Materialise the enabled domains on disk: one skill directory per domain, plus
 * the agent presets that pair with them.
 *
 * The contract is that a closed domain leaves nothing behind, and that running
 * twice in a row changes nothing the second time (same bytes, so mtimes stay
 * put). Both are tested.
 *
 * Only directories this plugin owns are ever removed — those carrying its `od-`
 * prefix, plus the pre-domain `opendesign/` aggregator. Everything else in the
 * user's skills root is left alone.
 *
 * @module open-design/sync
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { DOMAINS, ORCHESTRATOR } from './domains.mjs'
import { readConfig } from './config.mjs'
import { listBundledSkills, renderDomainSkill } from './skills.mjs'
import { agentDirFiles, orchestratorSpec, readRoster } from './agents.mjs'

/** The prefix every directory this plugin owns carries. */
const OWNED_PREFIX = 'od-'

/** The pre-domain single aggregator, removed on sight. */
const LEGACY = 'opendesign'

/** The directory this module lives in, used as the bundle root by default. */
const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url))

/** `$DSH_HOME`, falling back to `~/.dsh` — same rule the other vyra plugins use. */
function defaultDshHome() {
  return process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? homedir(), '.dsh')
}

/**
 * Write only when the bytes differ, so a restart does not churn mtimes.
 *
 * @returns {boolean} whether the file changed.
 */
function writeIfChanged(file, content) {
  try {
    if (existsSync(file) && readFileSync(file, 'utf8') === content) return false
  } catch {
    // Unreadable: rewrite it.
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
  return true
}

/**
 * List every owned directory under `root` that is not in `keep`, without
 * removing it.
 *
 * Removal has to go through the plugin manager, so it cannot live here: this
 * module runs in the CLI too, where there is no host. The caller reads this list,
 * uninstalls those bundles, then re-runs `sync` to finish the cleanup.
 *
 * @returns {string[]}
 */
export function listOwned(root, keep = []) {
  const found = []
  if (!existsSync(root)) return found
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(OWNED_PREFIX)) continue
    if (keep.includes(entry.name)) continue
    found.push(entry.name)
  }
  return found
}

/**
 * Delete the preset directories a caller has already uninstalled.
 *
 * Split from `sync` on purpose: the bundle has to leave the profile *before*
 * its directory disappears, otherwise the profile keeps a dependency pointing at
 * nothing. Only ids the host itself reported as removed are passed in.
 *
 * @param {string} presetsRoot
 * @param {string[]} ids
 * @returns {string[]} the directories that are gone.
 */
export function removeStalePresets(presetsRoot, ids) {
  const removed = []
  for (const id of ids) {
    const dir = join(presetsRoot, id)
    if (!existsSync(dir)) continue
    rmSync(dir, { recursive: true, force: true })
    removed.push(id)
  }
  return removed
}

/**
 * Remove every owned directory under `root` that is not in `keep`.
 *
 * @returns {string[]} the directory names removed.
 */
function pruneOwned(root, keep) {
  const removed = []
  if (!existsSync(root)) return removed
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(OWNED_PREFIX)) continue
    if (keep.includes(entry.name)) continue
    rmSync(join(root, entry.name), { recursive: true, force: true })
    removed.push(entry.name)
  }
  return removed
}

/**
 * Write one preset directory.
 *
 * @returns {boolean} whether anything under it changed.
 */
function writeAgent(presetsRoot, spec) {
  const dir = join(presetsRoot, spec.id)
  let changed = false
  for (const [name, content] of Object.entries(agentDirFiles(spec))) {
    if (writeIfChanged(join(dir, name), content)) changed = true
  }
  return changed
}

/**
 * Merge the host's preset registry into the on-disk roster.
 *
 * The Agent manager writes its presets under `presetsRoot`, but the host's own
 * shipped presets (`standard`, `ptc`, `minimal`, `cordis`) live only in the
 * registry, which has no on-disk spec to read. Whatever the caller read from
 * `ctx.agentPresets.list()` goes in first; a disk row with the same id wins,
 * because that one carries the fuller `summary`.
 */
function mergeRoster(system, fromDisk) {
  const rows = new Map()
  for (const row of system ?? []) {
    if (typeof row?.id !== 'string' || row.id === '' || row.id === ORCHESTRATOR.id) continue
    rows.set(row.id, {
      id: row.id,
      name: typeof row.name === 'string' && row.name !== '' ? row.name : row.id,
      description: typeof row.description === 'string' ? row.description : '',
    })
  }
  for (const row of fromDisk) rows.set(row.id, row)
  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * @typedef {{ enabled: string[], skillsWritten: string[], agentsWritten: string[], agents: string[], roster: Array<{ id: string, name: string, description: string }>, stale: string[], removed: string[], warnings: string[], error: string | null }} SyncReport
 */

/**
 * @param {{ dshHome?: string, root?: string, installAgents?: boolean, systemPresets?: Array<{ id: string, name?: string, description?: string }> }} [options]
 * @returns {SyncReport}
 */
export function sync(options = {}) {
  const root = options.root ?? PACKAGE_ROOT
  const dshHome = options.dshHome ?? defaultDshHome()
  const installAgents = options.installAgents !== false

  /** @type {SyncReport} */
  const report = {
    enabled: [],
    skillsWritten: [],
    agentsWritten: [],
    agents: [],
    roster: [],
    stale: [],
    removed: [],
    warnings: [],
    error: null,
  }

  try {
    const config = readConfig(dshHome)
    report.enabled = config.enabled
    report.warnings.push(...config.warnings)

    const skillsRoot = join(dshHome, 'skills')
    const presetsRoot = join(dshHome, 'agent-manager', 'presets')
    const allSkills = listBundledSkills(root)

    // 1. Skill directories, one per enabled domain.
    for (const domain of DOMAINS) {
      if (!config.enabled.includes(domain.id)) continue
      const text = renderDomainSkill(domain, allSkills, { root })
      if (writeIfChanged(join(skillsRoot, domain.id, 'SKILL.md'), text)) {
        report.skillsWritten.push(domain.id)
      }
    }
    report.removed.push(...pruneOwned(skillsRoot, config.enabled))

    // 2. The legacy aggregator, which sits outside the `od-` prefix.
    const legacy = join(skillsRoot, LEGACY)
    if (existsSync(legacy)) {
      rmSync(legacy, { recursive: true, force: true })
      report.removed.push(LEGACY)
    }

    // 3. The director, and only the director.
    //
    // Domain agents are gone: a preset without `delegation` cannot hand work on,
    // so nine of them produced nine dead ends. What a preset can do now comes
    // from skills, which the director loads itself or scopes into a child.
    //
    // `team` is the whole roster — every preset on disk plus whatever the caller
    // could read from the host registry. `subagent`'s `agent_preset` accepts only
    // ids from this static whitelist, so a preset missing here is invisible to
    // the director no matter what its prompt says.
    if (installAgents) {
      // Anything left over from the domain-agent era is about to be uninstalled,
      // so it must not appear in the roster: telling the director it can delegate
      // to an agent that is being deleted is worse than an empty roster. The
      // host uninstalls those bundles (its profile still lists them as
      // dependencies) and then calls `removeStalePresets` to delete the dirs.
      const stale = listOwned(presetsRoot, [ORCHESTRATOR.id])
      report.stale = stale
      const roster = mergeRoster(options.systemPresets, readRoster(presetsRoot))
        .filter((row) => !stale.includes(row.id))
      const spec = orchestratorSpec({ roster, enabledIds: config.enabled })
      report.agents.push(ORCHESTRATOR.id)
      if (writeAgent(presetsRoot, spec)) report.agentsWritten.push(ORCHESTRATOR.id)
      report.roster = roster
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
  }

  return report
}