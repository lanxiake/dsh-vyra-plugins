import { readFileSync } from 'node:fs'

const text = readFileSync('../../.inventory.txt', 'utf8')
const counts = new Map()
const buckets = new Map()

for (const line of text.split(/\r?\n/)) {
  const m = /^open-design-[a-z0-9-]+\t[^\t]+\t([\s\S]*)$/.exec(line)
  if (!m) continue
  const desc = m[1]
  const paren = /\(([^)]+)\)/.exec(desc)
  const category = paren ? paren[1] : '(none)'
  counts.set(category, (counts.get(category) ?? 0) + 1)
  if (!buckets.has(category)) buckets.set(category, [])
  const nameMatch = /^OpenDesign design system — (.*?)(?:\s+\(|$)/.exec(desc)
  buckets.get(category).push(nameMatch ? nameMatch[1].trim() : desc.slice(0, 30))
}

for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(v).padStart(3)}  ${k}`)
  console.log(`     ${(buckets.get(k) ?? []).join(' / ')}`)
}
console.log('total', [...counts.values()].reduce((a, b) => a + b, 0))
