/**
 * Append the contact block to every plugin README.
 *
 * A separate step rather than part of `import-plugin.mjs`, because the two have opposite
 * rules about the README. An import treats the source as authoritative — a plugin's own
 * documentation should follow its upstream — while the contact block exists only here and no
 * source has reason to carry it. Trying to do both in one pass means one of them wins, and the
 * one that loses is always the local addition.
 *
 * Idempotent: a README that already ends with the block is left byte-identical, so this is safe
 * in a publish loop and safe to re-run after a failed one.
 *
 * Usage: node scripts/add-contact-block.mjs
 *
 * @module dsh-vyra-plugins/add-contact-block
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** The group the block invites people to. Kept here so the number has one home. */
const GROUP = '1121362543'

/**
 * The block, as markdown.
 *
 * `<picture>` with a dark-mode source, matching how the rest of these READMEs handle images: the
 * harness renders a plugin's README on its detail page, and a QR code is white-on-white in the
 * dark theme without it. The path is relative because the detail page resolves images against the
 * README's own directory (`detailImage` normalizes from the document's location).
 */
const BLOCK = `
## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 ${GROUP}）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 ${GROUP}" src="./assets/qq-group.png" width="220" />
</picture>
`

/** The heading the block announces itself by. */
const MARKER = '## 交流群'

const root = resolve(import.meta.dirname, '..')
let added = 0
const skipped = []

for (const dir of readdirSync(join(root, 'plugins'))) {
  const pluginRoot = join(root, 'plugins', dir)
  const readme = join(pluginRoot, 'README.md')
  if (!existsSync(readme)) {
    skipped.push(`${dir} (no README)`)
    continue
  }
  // The picture only resolves if it ships, so a README without one beside it would render a
  // broken image on the detail page. Better to leave that plugin alone and say so.
  if (!existsSync(join(pluginRoot, 'assets', 'qq-group.png'))) {
    skipped.push(`${dir} (no assets/qq-group.png)`)
    continue
  }
  const text = readFileSync(readme, 'utf8')
  if (text.includes(MARKER)) continue
  writeFileSync(readme, `${text.trimEnd()}\n${BLOCK}`)
  added += 1
}

console.log(`add-contact-block: ${String(added)} README(s) updated`)
for (const entry of skipped) console.log(`  skipped ${entry}`)
