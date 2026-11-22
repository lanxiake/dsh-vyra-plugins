/**
 * Stable device identity for the Bodian source.
 *
 * Upstream requires a 32-character lowercase hex id that stays stable across
 * restarts (it is part of every signed request). It is generated once and kept in
 * the plugin data directory, 0600.
 *
 * @module dsh-music-panel/sources/bodian/device
 */

import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Matches upstream's accepted shape exactly. */
const DEVICE_PATTERN = /^[a-f0-9]{32}$/

/**
 * Read the stored device id, creating it on first use.
 *
 * Synchronous on purpose: the source is registered during plugin startup, and an
 * async effect would leave the platform missing for the first requests.
 *
 * @param {string} dir plugin data directory
 * @returns {string}
 */
export function ensureDeviceId(dir) {
  const file = join(dir, 'bodian-device.json')

  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    const stored = String(parsed?.deviceId ?? '')
    if (DEVICE_PATTERN.test(stored)) return stored
  } catch {
    // Missing or unreadable: fall through and mint a new one.
  }

  const deviceId = randomBytes(16).toString('hex')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ deviceId }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return deviceId
}
