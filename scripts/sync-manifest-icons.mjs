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
  'vyra-ssh-terminal': 'SSH_TERMINAL_ICON',
  'vyra-system-selection': 'SYSTEM_SELECTION_ICON',
  'vyra-theme-styles': 'THEME_STYLES_ICON',
  'vyra-agent-cli-manager': 'AGENT_CLI_MANAGER_ICON',
  'vyra-plugin-market': 'PLUGIN_MARKET_ICON',
  'vyra-media-studio': 'MEDIA_STUDIO_ICON',
  'vyra-dsh-console': 'DSH_CONSOLE_ICON',
}

const lines = []
const COMMENT = (plugin) => `/** Inline icon for \`${plugin}\`. */`
for (const [plugin, constant] of Object.entries(ICONS)) {
  // A hand-written SVG can carry a BOM (`vyra-agent-manager`'s does); left in,
  // it lands before the `<svg` root and some renderers reject the image.
  const svg = readFileSync(join(root, 'plugins', plugin, 'icon.svg'), 'utf8').replace(/^﻿/u, '')
  const encoded = Buffer.from(svg, 'utf8').toString('base64')
  lines.push(COMMENT(plugin), `const ${constant} =`, `  'data:image/svg+xml;base64,${encoded}'`)
}

const file = join(root, 'scripts', 'market-manifest.ts')
let source = readFileSync(file, 'utf8')

// The line ending the manifest itself uses. Read rather than assumed, so this
// script is safe on a checkout with `core.autocrlf=false` too — where the whole
// file is LF, and writing CRLF into it would show up as every line changed.
const EOL = source.includes('\r\n') ? '\r\n' : '\n'

// Remove the constants this script owns before writing fresh ones. It used to
// insert before the marker only, so a second run left the first copy in place
// and the manifest stopped compiling on a duplicate declaration.
//
// The removal is done as ONE span rather than one constant at a time, and that
// is the fix for the defect this script actually had. Matching each constant
// separately let a matcher for `SMART_COMPACTION_ICON` begin at
// `vyra-agent-manager`'s comment and run through agent-manager's encoded body
// to its own declaration; with `g`, that leftmost match wins over the intended
// one eight kilobytes later, so six of the ten constants resolved to the SAME
// span and each deleted the whole intervening block. Measured: one run moved the
// `LocalizedText` marker from 12903 to 5885, matched `DSH_CONSOLE_ICON` zero
// times, and every run after that chewed further.
//
// Taking the span from the first owned comment to the marker makes the
// ambiguity impossible: there is exactly one match, it is exactly the region
// this script writes, and the surrounding file is untouched by construction.
const END = "/** The validated index's localized-text union. */"
const marker = source.indexOf(END)
if (marker === -1) throw new Error('icon block marker not found in market-manifest.ts')

const firstConstant = Object.values(ICONS)[0]
const firstDeclaration = source.indexOf(`const ${firstConstant} =`)
if (firstDeclaration === -1) throw new Error(`the first owned constant ${firstConstant} is missing`)
const firstComment = source.lastIndexOf('/** Inline icon for ', firstDeclaration)
if (firstComment === -1) throw new Error(`the comment above ${firstConstant} is missing`)

// Everything from the first owned comment to the marker is this script's own
// output, so it is replaced wholesale. The head is trimmed of its trailing blank
// lines so the block below supplies the only separator, and the marker's own
// leading blank lines are trimmed for the same reason — both are what the old
// implementation accumulated by a line per run.
const head = source.slice(0, firstComment).replace(/(?:\r?\n)+$/u, '')
const tail = source.slice(marker).replace(/^(?:\r?\n)+/u, '')
const block = `${lines.join(EOL)}${EOL}`
writeFileSync(file, `${head}${EOL}${EOL}${block}${EOL}${tail}`)
console.log(`sync-manifest-icons: wrote ${Object.keys(ICONS).length} icon(s)`)
