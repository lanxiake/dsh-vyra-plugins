/**
 * Answer "did the routes mount, and if not, why" from the outside.
 *
 * The panel can only say "HTTP 404"; it cannot say whether `apply()` ran at all,
 * whether the `webServer` service was visible, or whether the host refused the
 * registration. This module records what happened during mount into a small
 * JSON file, and exposes a CLI that prints it next to a live probe.
 *
 * It exists because a 404 has three very different causes and only one of them
 * is "the route is wrong":
 *
 *   1. `apply()` never ran — the bundle is not enabled in this profile;
 *   2. `apply()` ran but the web server was not reachable — this file says so;
 *   3. the routes mounted but something answers first — the probe shows it.
 *
 * @module open-design/diagnostics
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Where the last mount attempt is recorded, under `$DSH_HOME`. */
export function reportPath(dshHome) {
  return join(dshHome, 'open-design', 'last-mount.json')
}

/**
 * Record one mount attempt.
 *
 * Best effort: diagnostics must never be the reason a mount fails.
 */
export function recordMount(dshHome, entry) {
  try {
    const file = reportPath(dshHome)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry }, null, 2)}\n`)
  } catch {
    // A read-only home still gets a working plugin, just without the record.
  }
}

/** Read back the last mount record, or null when there is none. */
export function readMountRecord(dshHome) {
  try {
    const file = reportPath(dshHome)
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}