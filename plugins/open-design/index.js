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

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sync } from './sync.mjs'
import { mountRoutes } from './routes.mjs'
import { recordMount } from './diagnostics.mjs'
import { DOMAINS } from './domains.mjs'

/** Plugin name, as the Loader row declares it. */
export const name = 'open-design'

/** The directory this module lives in, used to read the build version. */
const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url))

/** The build that mounted, recorded alongside the mount outcome. */
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version
  } catch {
    return 'unknown'
  }
})()

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
  // Two ways reach the web server, and the host decides which one works:
  //
  //   ctx.get('webServer')        when the service is already mounted and
  //                               visible on this context;
  //   ctx.inject(['webServer'], …) when it is not — in Cordis a service the
  //                               plugin never declared is not visible to
  //                               ctx.get(), and the callback fires once the
  //                               service becomes available.
  //
  // Trying the direct read first matters: if the service is already there, it
  // mounts immediately instead of waiting for an injection that may never fire.
  // Whichever path succeeds claims the routes; the other is skipped.
  const mountedPaths = []
  const mount = (server, via) => {
    if (mountedPaths.length > 0) return
    try {
      const disposers = mountRoutes(server, { dshHome: home })
      if (disposers.length > 0) {
        mountedPaths.push(via)
        logger?.info?.(`open-design: 设置路由已挂载（经 ${via}）`)
        recordMount(home, { ok: true, via, routes: ['/open-design/config', '/open-design/agents'], version: VERSION })
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger?.warn?.(`open-design: 注册设置路由失败（经 ${via}）：${detail}`)
      recordMount(home, { ok: false, via, error: detail, version: VERSION })
    }
  }

  const direct = typeof ctx?.get === 'function' ? ctx.get('webServer') : undefined
  if (direct !== undefined) {
    mount(direct, 'ctx.get')
  } else if (typeof ctx?.inject === 'function') {
    // Record that we are waiting: a 404 with this record means the injection
    // never fired, which is a host-composition problem, not a route problem.
    recordMount(home, { ok: false, via: 'ctx.inject', pending: true, version: VERSION })
    ctx.inject(['webServer'], (hostContext) => {
      mount(hostContext?.webServer, 'ctx.inject')
    })
  } else {
    logger?.info?.('open-design: 宿主没有 webServer，设置面板不可用（仍可用 odx）')
    recordMount(home, { ok: false, via: 'none', error: '宿主没有 ctx.get / ctx.inject', version: VERSION })
  }

  return { installed: report.skillsWritten.length, error: null, report }
}