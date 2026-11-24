/**
 * The read/write surface the settings page talks to.
 *
 * Kept separate from the HTTP route so it can be tested without a server: given
 * a home directory it answers what the panel shows, and applies a toggle the
 * same way the CLI does — write the config, then run the same `sync`.
 *
 * Nothing here decides what "enabled" means; that stays in `config.mjs`. This
 * module only joins it to the domain table and the sync report.
 *
 * @module open-design/state
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMAINS, DOMAIN_IDS, DEFAULT_ENABLED, ORCHESTRATOR } from './domains.mjs'
import { readConfig, writeConfig } from './config.mjs'
import { sync } from './sync.mjs'
import { listBundledSkills } from './skills.mjs'

/**
 * What the settings page renders.
 *
 * @param {{ dshHome?: string, root?: string }} [options]
 * @returns {{
 *   domains: Array<{ id: string, name: string, description: string, enabled: boolean,
 *                    skills: string[], designSystems: boolean }>,
 *   agents: Array<{ id: string, name: string, present: boolean }>,
 *   warnings: string[],
 * }}
 */
export function describe(options = {}) {
  const { enabled, warnings } = readConfig(options.dshHome)
  const home = options.dshHome ?? process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.dsh')
  const presetsRoot = join(home, 'agent-manager', 'presets')

  const domains = DOMAINS.map((domain) => ({
    id: domain.id,
    name: domain.name,
    description: domain.description,
    enabled: enabled.includes(domain.id),
    skills: [...domain.skills],
    designSystems: domain.designSystems === true,
  }))

  // The orchestrator plus every domain agent that is currently on disk.
  const agents = [
    { id: ORCHESTRATOR.id, name: ORCHESTRATOR.name, present: existsSync(join(presetsRoot, ORCHESTRATOR.id, 'agent.json')) },
    ...DOMAINS.filter((domain) => enabled.includes(domain.id)).map((domain) => ({
      id: domain.id,
      name: domain.name,
      present: existsSync(join(presetsRoot, domain.id, 'agent.json')),
    })),
  ]

  return { domains, agents, warnings }
}

/**
 * Apply a new enabled set.
 *
 * An unknown id is a caller error and is rejected whole — applying half a
 * request would leave the panel showing something the user never asked for.
 *
 * @param {{ enabled: string[], dshHome?: string, root?: string, installAgents?: boolean }} request
 * @returns {{ ok: true, report: ReturnType<typeof sync> } | { ok: false, error: string, unknown?: string[] }}
 */
export function applyToggle(request) {
  const requested = Array.isArray(request.enabled) ? request.enabled.map(String) : null
  if (requested === null) return { ok: false, error: 'enabled 必须是领域 id 数组' }

  const unknown = requested.filter((id) => !DOMAIN_IDS.includes(id))
  if (unknown.length > 0) {
    return { ok: false, error: `未知领域：${unknown.join(', ')}`, unknown }
  }

  writeConfig([...new Set(requested)], request.dshHome)
  const report = sync({
    dshHome: request.dshHome,
    root: request.root,
    installAgents: request.installAgents !== false,
  })
  if (report.error !== null) return { ok: false, error: report.error }
  return { ok: true, report }
}

/**
 * Rebuild the agent presets from the current config without changing which
 * domains are enabled. This is the panel's "重新生成 Agent" action.
 *
 * @param {{ dshHome?: string, root?: string }} [options]
 * @returns {{ ok: true, report: ReturnType<typeof sync> } | { ok: false, error: string }}
 */
export function regenerateAgents(options = {}) {
  const report = sync({ ...options, installAgents: true })
  if (report.error !== null) return { ok: false, error: report.error }
  return { ok: true, report }
}

/** The skill count per domain, for a summary line the panel can show. */
export function skillCounts(root) {
  const all = listBundledSkills(root)
  const craft = all.filter((skill) => skill.bundle === 'skills').length
  const systems = all.filter((skill) => skill.bundle === 'design-system-skills').length
  return { craft, systems, total: all.length }
}

export { DEFAULT_ENABLED }