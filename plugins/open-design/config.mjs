/**
 * The enabled-domain list, stored at `$DSH_HOME/open-design/domains.json`.
 *
 * One file, human-editable, tolerant of every way it can go wrong: missing
 * (defaults), corrupt (defaults plus a `.bak` and a warning), carrying unknown
 * domain ids (dropped with a warning), carrying duplicates (collapsed). Nothing
 * here throws — a bad config must not stop the plugin from loading.
 *
 * An **empty** list is preserved rather than healed: turning every domain off is
 * a legitimate choice, not a missing file.
 *
 * @module open-design/config
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DEFAULT_ENABLED, DOMAIN_IDS } from './domains.mjs'

/** `$DSH_HOME/open-design/domains.json`. */
export function configPath(dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')) {
  return join(dshHome, 'open-design', 'domains.json')
}

/**
 * Read the enabled list, healing anything unusable.
 *
 * @returns {{ enabled: string[], warnings: string[] }}
 */
export function readConfig(dshHome) {
  const file = configPath(dshHome)
  const warnings = []

  if (!existsSync(file)) {
    warnings.push(`未找到配置 ${file}，已按默认领域初始化`)
    writeConfig([...DEFAULT_ENABLED], dshHome)
    return { enabled: [...DEFAULT_ENABLED], warnings }
  }

  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    // Keep the broken file for inspection, then start over from defaults.
    try {
      copyFileSync(file, `${file}.bak`)
    } catch {
      // A failed backup must not stop recovery.
    }
    const detail = error instanceof Error ? error.message : String(error)
    warnings.push(`配置无法解析（${detail}），已备份为 .bak 并回退默认`)
    writeConfig([...DEFAULT_ENABLED], dshHome)
    return { enabled: [...DEFAULT_ENABLED], warnings }
  }

  const raw = Array.isArray(parsed?.enabled) ? parsed.enabled : []
  const enabled = []
  for (const value of raw) {
    const id = String(value)
    if (!DOMAIN_IDS.includes(id)) {
      warnings.push(`忽略未知领域「${id}」`)
      continue
    }
    if (enabled.includes(id)) continue
    enabled.push(id)
  }

  return { enabled, warnings }
}

/**
 * Write the enabled list, in domain display order.
 *
 * @returns {{ written: boolean }} whether the file's bytes actually changed.
 */
export function writeConfig(enabled, dshHome) {
  const file = configPath(dshHome)
  const ordered = DOMAIN_IDS.filter((id) => enabled.includes(id))
  const text = `${JSON.stringify({ version: 1, enabled: ordered }, null, 2)}\n`
  try {
    if (existsSync(file) && readFileSync(file, 'utf8') === text) return { written: false }
  } catch {
    // Unreadable existing file: fall through and rewrite it.
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
  return { written: true }
}