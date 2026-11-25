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
  // Declared between the two constants above and below it in the manifest, and
  // inside the block this script owns. Left out of the map, it sat in the
  // replaced span with no owner: a run deleted it along with the entries that
  // follow — see the guard below.
  'vyra-free-theme': 'FREE_THEME_ICON',
  'vyra-agent-cli-manager': 'AGENT_CLI_MANAGER_ICON',
  'vyra-plugin-market': 'PLUGIN_MARKET_ICON',
  'vyra-file-manager': 'FILE_MANAGER_ICON',
  'vyra-dsh-console': 'DSH_CONSOLE_ICON',
  // These two were dropped from this map while the icon block was rewritten, and
  // the manifest kept referencing their constants: it no longer compiled, so the
  // index could not be rebuilt at all. Both plugins ship an `icon.svg`, and the
  // payload the manifest carried before the drop is byte-identical to what this
  // generator reads back off it, so listing them here restores them exactly.
  'vyra-wechat-local': 'WECHAT_LOCAL_ICON',
  'vyra-xianyu-delivery': 'XIANYU_DELIVERY_ICON',
  // Ships an `icon.svg` but was missing from this map, so its constant held the
  // placeholder `'undefined'` instead of an icon — and that reached the published
  // index, because nothing fails on an icon that is merely the wrong string.
  // Listing it here makes the generated block authoritative for this plugin too.
  'vyra-screen-recorder': 'VYRA_SCREEN_RECORDER_ICON',
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
// The removal is done as ONE span rather than one constant at a time, which
// removes an ambiguity rather than repairing observed damage. The old pattern
// was `…/\*\* Inline icon for \`[^\`]+\`… const X = … '[^']*'…`: both the plugin
// name and the body could cross newlines, so a matcher for one constant could
// legally begin at an EARLIER constant's comment, run through that constant's
// encoded body, and end at its own declaration — eight kilobytes later. With
// `g`, the leftmost such match wins. Nothing in this repository's history
// exercised it (198 revisions checked: the committed manifest was intact at
// every one, and no two constants ever resolved to the same span), so this was
// a LATENT hazard, not a live corruption: reachable from any manifest whose icon
// block was spaced one declaration differently, and silent when it fired.
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

// The block does not necessarily START at the first constant this map owns: the
// manifest also carries hand-written icons above it (a multi-line prose comment,
// constants with no generated comment at all). Opening the span at
// `firstComment` therefore BEGINS INSIDE that hand-written region, and the
// wholesale replace below would delete every constant and entry between that
// point and the marker — which is how a run once swallowed two whole plugin
// entries. Refuse rather than destroy: the region about to be replaced must
// contain only declarations this map owns.
const owned = new Set(Object.values(ICONS))
const span = source.slice(firstComment, marker)
const strays = [...span.matchAll(/^const ([A-Z_]+_ICON) =$/gmu)]
  .map((m) => m[1])
  .filter((constant) => !owned.has(constant))
if (strays.length > 0) {
  throw new Error(
    `the icon block would replace ${strays.join(', ')}, which the ICONS map does not own; ` +
      'add them to ICONS (so they are regenerated) or move them above the block. ' +
      'Refusing rather than deleting them.',
  )
}

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
