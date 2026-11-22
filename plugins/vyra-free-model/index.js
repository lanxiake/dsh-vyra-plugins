/**
 * Vyra Free Model — the Host half.
 *
 * What this plugin is for: a user installs it and can chat. Nothing is
 * configured, no key is entered, no account exists. The model picker gains one
 * group called 免费模型 and it works.
 *
 * The lane behind that group is the Kilo public free pool. It needs no
 * credential at all, which is what makes the zero-configuration promise honest;
 * the trade it makes (its model cards state that prompts may be logged upstream)
 * is disclosed in the settings page copy and the README rather than hidden.
 *
 * Everything else the user might want is opt-in and lives behind one page with
 * three blocks: more models from a signed-in account, and a local port so other
 * tools on this machine can borrow the same models.
 *
 * @module index.js
 */

import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { KiloAdapter, ROUTE } from './src/adapter.js'

export const name = 'vyra-free-model'

/**
 * The only hard dependency.
 *
 * Everything optional is reached through a nested `ctx.inject` fiber or
 * `ctx.get`, so a headless composition still serves models and only loses the
 * settings page — the opposite trade would fail the plugin outright in a
 * composition that has no web server.
 */
export const inject = ['llm']

/** Where this plugin keeps its own state. Never the profile's config file. */
const DATA_DIR_NAME = 'vyra-free-model'

/** `$DSH_HOME` else `~/.dsh` — the same resolution the harness uses. */
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim()
  return path.join(os.homedir(), '.dsh')
}

export function apply(ctx, _config) {
  const logger = ctx.logger ?? console
  const dataDir = path.resolve(resolveDshHome(), DATA_DIR_NAME)
  fs.mkdirSync(dataDir, { recursive: true })

  /**
   * The live catalog. Task 2 fills it from the upstream listing; until then the
   * group exists and is empty, which is the honest state before any fetch.
   *
   * @type {import('./src/adapter.js').CatalogEntry[]}
   */
  let catalog = []

  /** Settings the adapter and the routes read. Task 6 owns the store behind it. */
  const settings = { enabled: true }

  const state = () => ({ catalog, settings })

  const adapter = new KiloAdapter({
    state,
    resolveImage: undefined,
  })

  ctx.llm.registerAdapter([ROUTE], adapter)

  logger.info?.(`vyra-free-model: mounted, route "${ROUTE}"`)
}
