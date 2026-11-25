import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return {}
  const lines = m[1].split(/\r?\n/)
  const out = {}
  for (let i = 0; i < lines.length; i++) {
    const h = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i])
    if (!h) continue
    const key = h[1]
    const rest = h[2].trim()
    if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
      const body = []
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '') { body.push(''); continue }
        if (!/^\s/.test(lines[j])) break
        body.push(lines[j].trim())
      }
      out[key] = body.join(' ').trim()
      continue
    }
    if (rest.length > 0 && (rest[0] === '"' || rest[0] === "'")) {
      const q = rest[0]
      const closed = rest.length > 1 && rest.endsWith(q)
      out[key] = rest.slice(1, closed ? -1 : undefined).trim()
      continue
    }
    out[key] = rest
  }
  return out
}

const root = join('vendor', 'open-design')
for (const bundle of ['skills', 'design-system-skills']) {
  const dir = join(root, bundle)
  if (!existsSync(dir)) continue
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
  console.log(`##### ${bundle} (${names.length})`)
  for (const name of names) {
    const file = join(dir, name, 'SKILL.md')
    if (!existsSync(file)) continue
    const meta = frontmatter(readFileSync(file, 'utf8'))
    const desc = String(meta.description ?? '').replace(/\s+/g, ' ').trim()
    console.log(`${meta.name || name}\t${name}\t${desc}`)
  }
}
