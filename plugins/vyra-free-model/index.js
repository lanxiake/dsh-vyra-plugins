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
import { buildCatalog, fetchKiloListing } from './src/kilo.js'

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

/** How stale a cached roster may be before a background refresh runs. */
const REFRESH_INTERVAL_MS = 30 * 60_000

/** `$DSH_HOME` else `~/.dsh` — the same resolution the harness uses. */
export function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim()
  return path.join(os.homedir(), '.dsh')
}

export function apply(ctx, _config) {
  const logger = ctx.logger ?? console
  const dataDir = path.resolve(resolveDshHome(), DATA_DIR_NAME)
  fs.mkdirSync(dataDir, { recursive: true })
  const cacheFile = path.join(dataDir, 'catalog.json')

  /** Settings the adapter and the routes read. Task 6 owns the durable store. */
  const settings = { enabled: true }

  /**
   * The live catalog. It starts from last run's cache so the picker is populated
   * on the first frame instead of waiting for a network round trip — a settings
   * page that says "no models" for two seconds reads as broken.
   *
   * @type {ReturnType<typeof buildCatalog>}
   */
  let catalog = readCachedCatalog(cacheFile)

  /** What the settings page reports when the last refresh failed. */
  let laneOk = true
  let disposed = false

  const state = () => ({ catalog, settings })

  const adapter = new KiloAdapter({ state })

  ctx.llm.registerAdapter([ROUTE], adapter)

  /** One listing round. Never throws: a failure keeps the previous roster. */
  async function refreshCatalog({ log = false } = {}) {
    try {
      const raw = await fetchKiloListing()
      if (disposed) return catalog
      const next = buildCatalog(raw)
      if (next.length === 0) {
        // An empty answer is a gateway problem, not "there are no free models".
        // Keeping the old roster is the difference between a stale list and none.
        laneOk = false
        if (log) logger.warn?.('vyra-free-model: the listing came back empty; keeping the cached roster')
        return catalog
      }
      catalog = next
      laneOk = true
      writeCachedCatalog(cacheFile, next, logger)
      try { ctx.llm?.emitAdaptersUpdated?.() } catch { /* older kernels have no such method */ }
      if (log) logger.info?.(`vyra-free-model: ${next.length} models available`)
      return catalog
    } catch (error) {
      if (disposed) return catalog
      laneOk = false
      if (log) logger.warn?.(`vyra-free-model: listing refresh failed (${error?.message ?? error}); keeping the cached roster`)
      return catalog
    }
  }

  /** Background loop: shortly after boot, then on the configured cadence. */
  let timer
  const schedule = () => {
    timer = setTimeout(async () => {
      if (disposed) return
      await refreshCatalog()
      if (!disposed) schedule()
    }, REFRESH_INTERVAL_MS)
    timer.unref?.()
  }

  ctx.effect(() => {
    const boot = setTimeout(() => {
      if (disposed) return
      void refreshCatalog({ log: true }).then(() => { if (!disposed) schedule() })
    }, 1500)
    boot.unref?.()
    return () => {
      disposed = true
      clearTimeout(boot)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, 'vyra-free-model: catalog refresh')

  logger.info?.(`vyra-free-model: mounted, route "${ROUTE}" with ${catalog.length} cached models`)
}

/** Last run's roster, or an empty list when there is none or it is damaged. */
function readCachedCatalog(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(parsed?.models)) return []
    return parsed.models.filter(row => row !== null && typeof row === 'object' && typeof row.id === 'string')
  } catch {
    return []
  }
}

/** Persist the roster so the next boot has something to show immediately. */
function writeCachedCatalog(file, models, logger) {
  try {
    const temp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(temp, JSON.stringify({ at: Date.now(), models }, undefined, 2), { mode: 0o600 })
    fs.renameSync(temp, file)
  } catch (error) {
    logger.warn?.(`vyra-free-model: could not cache the model roster (${error?.message ?? error})`)
  }
}
