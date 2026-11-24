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
import { agentDirFiles, domainAgentSpec, orchestratorSpec } from './agents.mjs'

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
 * @typedef {{ enabled: string[], skillsWritten: string[], agentsWritten: string[], agents: string[], removed: string[], warnings: string[], error: string | null }} SyncReport
 */

/**
 * @param {{ dshHome?: string, root?: string, installAgents?: boolean }} [options]
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

    // 3. Agents: one per enabled domain, plus the orchestrator.
    if (installAgents) {
      const keep = []
      for (const domain of DOMAINS) {
        if (!config.enabled.includes(domain.id)) continue
        keep.push(domain.id)
        report.agents.push(domain.id)
        if (writeAgent(presetsRoot, domainAgentSpec(domain))) report.agentsWritten.push(domain.id)
      }
      keep.push(ORCHESTRATOR.id)
      report.agents.push(ORCHESTRATOR.id)
      // The director is rewritten whenever the enabled set changes, because both
      // its `team` and its prompt carry that set.
      if (writeAgent(presetsRoot, orchestratorSpec(config.enabled))) {
        report.agentsWritten.push(ORCHESTRATOR.id)
      }
      report.removed.push(...pruneOwned(presetsRoot, keep))
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
  }

  return report
}