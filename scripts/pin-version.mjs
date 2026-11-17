// Pin a plugin version's install source to the commit that holds its files.
//
//   node scripts/pin-version.mjs <plugin-name> <sha>
//
// `scripts/market-manifest.ts` carries a placeholder commit for a version whose
// files are already committed but whose SHA cannot be known until after that
// commit exists. This replaces the placeholder inside the named plugin's block
// only, so a second plugin's placeholder is left for its own run.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [name, sha] = process.argv.slice(2)
if (name === undefined || sha === undefined) {
  console.error('usage: node scripts/pin-version.mjs <plugin-name> <sha>')
  process.exit(1)
}
if (!/^[0-9a-f]{40}$/u.test(sha)) {
  console.error(`pin-version: ${sha} is not a 40-hex-digit commit SHA`)
  process.exit(1)
}

const PLACEHOLDER = `'${'0'.repeat(40)}'`
const file = resolve(import.meta.dirname, 'market-manifest.ts')
const source = readFileSync(file, 'utf8')

const start = source.indexOf(`name: '${name}'`)
if (start < 0) {
  console.error(`pin-version: no manifest entry for ${name}`)
  process.exit(1)
}
// A plugin entry ends at the next entry/closing brace at its own indent level.
const end = source.indexOf('\n    },', start)
const block = source.slice(start, end)

const at = block.indexOf(PLACEHOLDER)
if (at < 0) {
  console.error(`pin-version: ${name} has no placeholder commit to replace`)
  process.exit(1)
}

const pinned = `${block.slice(0, at)}'${sha}'${block.slice(at + PLACEHOLDER.length)}`
writeFileSync(file, `${source.slice(0, start)}${pinned}${source.slice(end)}`)
console.log(`pin-version: pinned ${name} at ${sha}`)
