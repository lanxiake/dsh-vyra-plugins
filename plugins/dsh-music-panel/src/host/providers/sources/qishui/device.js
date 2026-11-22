/**
 * Stable device identity for the Qishui source.
 *
 * The upstream car protocol requires the same device id for every signed
 * request; it is generated once and kept in the plugin data directory, 0600.
 *
 * @module dsh-music-panel/sources/qishui/device
 */

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

function protocol() {
  try {
    return require('qishui-music-api')
  } catch {
    return null
  }
}

/**
 * @param {string} dir plugin data directory
 * @returns {string}
 */
export function ensureQishuiDeviceId(dir) {
  const sdk = protocol()
  if (sdk === null) throw new Error('the Qishui API package is not installed')
  const file = join(dir, 'qishui-device.json')
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    const stored = String(parsed?.deviceId ?? '')
    if (sdk.isQishuiDeviceId(stored)) return stored
  } catch {
    // Missing or unreadable: mint a new one.
  }
  const deviceId = sdk.createQishuiDeviceId()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ deviceId }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return deviceId
}
