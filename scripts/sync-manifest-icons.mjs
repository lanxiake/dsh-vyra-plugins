/**
 * Regenerate the inline icon constants and the pinned-commit placeholder in
 * `scripts/market-manifest.ts`.
 *
 * The market card renders an icon out of the index document itself, so each
 * one has to be a `data:` URL embedded in the manifest source — a referenced
 * file has no URL from the client's position. Hand-maintaining five base64
 * blobs is how one of them silently ends up stale, so they are generated.
 *
 * The pinned commit is the same for every plugin in a release: this repository
 * publishes plugins one commit at a time, and the manifest cannot name a commit
 * that does not exist yet. `PLACEHOLDER_COMMIT` is replaced with the real SHA
 * by the publish step, which is the only point the SHA is knowable.
 *
 * Usage: node scripts/sync-manifest-icons.mjs
 *
 * @module dsh-vyra-plugins/sync-manifest-icons
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

/** Plugin directory to the constant name `market-manifest.ts` reads it through. */
const ICONS = {
  'vyra-agent-manager': 'AGENT_MANAGER_ICON',
  'vyra-smart-compaction': 'SMART_COMPACTION_ICON',
  'vyra-skill-mcp-manager': 'SKILL_MCP_ICON',
  'vyra-page-translator': 'PAGE_TRANSLATOR_ICON',
  'vyra-ssh-terminal': 'SSH_TERMINAL_ICON',
}

const lines = []
for (const [plugin, constant] of Object.entries(ICONS)) {
  // A hand-written SVG can carry a BOM (`vyra-agent-manager`'s does); left in,
  // it lands before the `<svg` root and some renderers reject the image.
  const svg = readFileSync(join(root, 'plugins', plugin, 'icon.svg'), 'utf8').replace(/^﻿/u, '')
  const encoded = Buffer.from(svg, 'utf8').toString('base64')
  lines.push(
    `/** Inline icon for \`${plugin}\`. */`,
    `const ${constant} =`,
    `  'data:image/svg+xml;base64,${encoded}'`,
    '',
  )
}

const file = join(root, 'scripts', 'market-manifest.ts')
const source = readFileSync(file, 'utf8')
const START = "\n/** The validated index's localized-text union. */"
const END = "/** The validated index's localized-text union. */"
const start = source.indexOf(START)
const end = source.indexOf(END)
if (start === -1 || end === -1 || end < start) throw new Error('icon block markers not found in market-manifest.ts')

const block = `\n${lines.join('\n').trimEnd()}\n\n`
writeFileSync(file, `${source.slice(0, start)}${block}${source.slice(end)}`)
console.log(`sync-manifest-icons: wrote ${Object.keys(ICONS).length} icon(s)`)
