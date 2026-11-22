/**
 * Durable settings for dsh-music-panel.
 *
 * The music roots live outside the Cordis patch because a user picks them from
 * the settings page, not from a YAML file. They are stored as one small JSON
 * file under `<DSH_HOME>/music/settings.json`; the patch config stays the seed
 * used when that file does not exist yet.
 *
 * @module dsh-music-panel/settings
 */

import { readJsonWithBackup, writeJsonAtomic } from './json-store.js'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { normalizeConfig } from './config.js'

/** Expand a leading `~`/`~/` against the OS home; anything else passes through. */
export function expandHome(value) {
  if (typeof value !== 'string' || value === '') return value
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2))
  return value
}

/**
 * Resolve the harness home with the same precedence the Harness uses:
 * explicit config > non-blank `$DSH_HOME` > `~/.dsh`.
 */
export function resolveDshHome(configured, env = process.env) {
  const fromEnv = typeof env.DSH_HOME === 'string' && env.DSH_HOME.trim() !== '' ? env.DSH_HOME : undefined
  return resolve(expandHome(configured ?? fromEnv ?? join(homedir(), '.dsh')))
}

/**
 * @param {{ dshHome?: string, seed?: unknown }} options
 */
export function createSettings({ dshHome, seed } = {}) {
  const home = resolveDshHome(dshHome)
  const dir = join(home, 'music')
  const file = join(dir, 'settings.json')
  const base = normalizeConfig(seed)
  let cached

  /** The cache directory is a path: expand a leading ~ once, at the store boundary. */
  function resolved(config) {
    const cacheDir = config.cacheDir === '' ? '' : resolve(expandHome(config.cacheDir))
    return { ...config, cacheDir }
  }

  async function read() {
    if (cached !== undefined) return cached
    let saved = {}
    const parsed = await readJsonWithBackup(file)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed
    cached = resolved(normalizeConfig({ ...base, ...saved }))
    return cached
  }

  async function write(patch) {
    const next = resolved(normalizeConfig({ ...base, ...(await read()), ...(patch ?? {}) }))
    await writeJsonAtomic(file, next)
    cached = next
    return next
  }

  /**
   * Fresh-install reset: keep the install-time depth/extensions defaults, but
   * force the library roots empty. The configured seed must not bring old roots
   * back after "clear all data" (the user explicitly chose an empty library).
   */
  async function reset() {
    const next = resolved(normalizeConfig({ ...base, roots: [], hiddenRoots: [], cacheDir: '', watchFolders: false }))
    await writeJsonAtomic(file, next)
    cached = next
    return next
  }

  return {
    home,
    dir,
    file,
    seed: base,
    read,
    write,
    reset,
    /** Forget the memoized value; the next read re-reads the file. */
    invalidate() {
      cached = undefined
    },
  }
}
