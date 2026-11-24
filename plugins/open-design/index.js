/**
 * open-design — the OpenDesign skill library as a DeepSeek Harness plugin.
 *
 * The upstream project (https://github.com/nexu-io/open-design) ships two skill
 * trees: `skills/<slug>/SKILL.md` (85 craft skills) and
 * `design-system-skills/<slug>/SKILL.md` (152 design-system contracts). Both are
 * bundled verbatim under `vendor/open-design/`.
 *
 * This plugin splits them into nine business domains and materialises only the
 * enabled ones on disk, so a user carries the skills they actually work with
 * rather than a 237-entry catalogue.
 *
 * The plugin body is deliberately thin: discovery and rendering live in
 * `skills.mjs`, the enabled list in `config.mjs`, agent presets in `agents.mjs`,
 * and the disk transaction in `sync.mjs`. This file only wires the host.
 *
 * @module open-design
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { sync } from './sync.mjs'
import { mountRoutes } from './routes.mjs'
import { DOMAINS } from './domains.mjs'

/** Plugin name, as the Loader row declares it. */
export const name = 'open-design'

/** Skill discovery and per-domain rendering live in their own module. */
export { BUNDLES, listBundledSkills, readFrontmatter, renderDomainSkill } from './skills.mjs'

/** The domain table and its ids. */
export { DEFAULT_ENABLED, DOMAIN_IDS, DOMAINS, ORCHESTRATOR, getDomain } from './domains.mjs'

/** The config file reader/writer. */
export { configPath, readConfig, writeConfig } from './config.mjs'

/** Agent preset builders. */
export { agentDirFiles, domainAgentSpec, orchestratorSpec } from './agents.mjs'

/** The disk synchroniser. */
export { sync } from './sync.mjs'

/** The settings page's state layer and HTTP surface. */
export { applyToggle, describe as describeDomains, regenerateAgents } from './state.mjs'
export { handle as handleRoute, mountRoutes } from './routes.mjs'

/**
 * Resolve `$DSH_HOME`, falling back to `~/.dsh`.
 *
 * Matches how the other vyra plugins locate the home: the env var first, then
 * the conventional directory.
 */
export function dshHome(env = process.env) {
  return env.DSH_HOME ? env.DSH_HOME : join(homedir(), '.dsh')
}

/** The skills root the harness scans: `<dshHome>/skills`. */
export function skillsRoot(home = dshHome()) {
  return join(home, 'skills')
}

/**
 * The plugin body, mounted once per host.
 *
 * Installation is best-effort and never throws out of `apply`: a read-only home
 * should leave the harness running, just without any domain skills.
 *
 * @returns {Promise<{ installed: number, error: string | null, report: ReturnType<typeof sync> | null }>}
 */
export async function apply(ctx, config = {}) {
  if (config.enabled === false) return { installed: 0, error: null, report: null }

  const logger = ctx?.logger?.('open-design')
  const home = config.dshHome ?? dshHome()

  const report = sync({
    dshHome: home,
    installAgents: config.installAgents !== false,
  })

  if (report.error !== null) {
    logger?.warn?.(`open-design: ${report.error}`)
    return { installed: 0, error: report.error, report }
  }

  // Registering the preset directories is the host's job: a bundle only becomes
  // selectable once the plugin manager installs it. Without that service the
  // files are still on disk, which is what the CLI and the tests use.
  if (config.installAgents !== false && report.agents.length > 0) {
    const pm = typeof ctx?.get === 'function' ? ctx.get('pluginManager') : undefined
    if (pm === undefined) {
      logger?.info?.('open-design: 未检测到 pluginManager，agent 预设仅写入磁盘，未注册')
    } else {
      const presetsRoot = join(home, 'agent-manager', 'presets')
      for (const id of report.agents) {
        try {
          const result = await pm.installBundle(join(presetsRoot, id), { enabled: true })
          if (result?.application === 'failed') {
            logger?.warn?.(`open-design: 注册 agent ${id} 失败`)
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          logger?.warn?.(`open-design: 注册 agent ${id} 出错：${detail}`)
        }
      }
    }
  }

  logger?.info?.(`open-design: ${String(report.enabled.length)} / ${String(DOMAINS.length)} 个领域已启用`)

  // The settings panel talks to these routes.
  //
  // `ctx.inject([...])` is what makes the service reachable: in Cordis a
  // service that was not declared as a dependency is not visible to `ctx.get()`,
  // so probing with `ctx.get('webServer')` silently yields undefined and the
  // routes never mount. The callback runs only when the service exists, which is
  // the correct degradation for a profile without a web server.
  if (typeof ctx?.inject === 'function') {
    ctx.inject(['webServer'], (hostContext) => {
      try {
        mountRoutes(hostContext.webServer, { dshHome: home })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        logger?.warn?.(`open-design: 注册设置路由失败：${detail}`)
      }
    })
  } else {
    logger?.info?.('open-design: 宿主不支持 ctx.inject，设置面板不可用（仍可用 odx）')
  }

  return { installed: report.skillsWritten.length, error: null, report }
}