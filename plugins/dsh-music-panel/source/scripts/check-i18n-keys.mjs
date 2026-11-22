// Verify every online.navidrome* key exists in both the zh and en dictionaries.
import { readFileSync } from 'node:fs'

const src = readFileSync('src/client/i18n/i18n.js', 'utf8')
const keys = [...new Set([...src.matchAll(/'(online\.navidrome[A-Za-z]*)'/g)].map((m) => m[1]))]

console.log(`navidrome keys: ${keys.length}\n`)
let bad = 0
for (const key of keys) {
  const needle = `'${key}'`
  let count = 0
  let at = src.indexOf(needle)
  while (at !== -1) {
    count += 1
    at = src.indexOf(needle, at + 1)
  }
  const ok = count >= 2
  if (!ok) bad += 1
  console.log(`${ok ? 'OK  ' : 'MISS'} ${key.padEnd(34)} ${count} def(s)`)
}

// Also confirm the keys the component actually calls are all defined.
const ui = readFileSync('src/client/components/ui/settings.js', 'utf8') + readFileSync('src/client/components/online/online.js', 'utf8')
const used = [...new Set([...ui.matchAll(/t\('(online\.navidrome[A-Za-z]*)'/g)].map((m) => m[1]))]
console.log('\nkeys used by code:')
for (const key of used) {
  const ok = src.includes(`'${key}'`)
  if (!ok) bad += 1
  console.log(`${ok ? 'OK  ' : 'MISS'} ${key}`)
}

console.log(bad === 0 ? '\nall good' : `\n${bad} problem(s)`)
process.exit(bad === 0 ? 0 : 1)


