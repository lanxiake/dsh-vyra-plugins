// Report the shape of the stylesheet this bundle mounts, so a broken template
// literal is caught without opening a browser.
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const start = source.indexOf('const CSS = `')
if (start === -1) {
  console.log('CSS-FAIL: no CSS template literal found')
  process.exit(1)
}
const open = source.indexOf('`', start + 'const CSS = '.length) + 1
const close = source.indexOf('\n`', open)
if (close === -1) {
  console.log('CSS-FAIL: the template literal is not closed')
  process.exit(1)
}
const css = source.slice(open, close)

const opens = (css.match(/\{/g) ?? []).length
const closes = (css.match(/\}/g) ?? []).length
const classes = new Set((css.match(/\.vfm_[a-z]+/g) ?? []))
const vars = new Set((css.match(/var\(--dsw-[a-z0-9-]+/g) ?? []).map(v => v.slice(4)))

console.log(`css bytes     : ${css.length}`)
console.log(`rules         : ${closes}`)
console.log(`braces        : ${opens} open / ${closes} close ${opens === closes ? '(balanced)' : '(UNBALANCED)'}`)
console.log(`classes used  : ${classes.size}`)
console.log(`theme vars    : ${vars.size}`)

// Every token must exist in the shell's published list, or the rule silently
// falls back to nothing and the page looks unstyled again.
const VALID = new Set([
  '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3', '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1', '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary', '--dsw-alias-brand-text',
  '--dsw-alias-button-primary-fill', '--dsw-alias-button-primary-hover',
  '--dsw-alias-interactive-bg-hover', '--dsw-alias-interactive-bg-active',
  '--dsw-alias-label-primary', '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary', '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary', '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
])
const unknown = [...vars].filter(name => !VALID.has(name))
if (unknown.length > 0) {
  console.log(`INVALID TOKENS: ${unknown.join(', ')}`)
  process.exit(1)
}
console.log('tokens        : all published')
if (opens !== closes) process.exit(1)

// A background token and the label drawn on it must come from the same theme
// pair; a hard-coded colour is what made the light theme unreadable in the past.
const literals = [...css.matchAll(/(?:color|background)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)].map(m => m[1])
if (literals.length > 0) {
  console.log(`HARD-CODED COLOURS: ${literals.join(', ')}`)
  process.exit(1)
}
console.log('colours       : all from theme tokens')