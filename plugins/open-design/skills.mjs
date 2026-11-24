/**
 * Bundled-skill discovery and per-domain `SKILL.md` rendering.
 *
 * The two upstream trees (`skills/`, `design-system-skills/`) are bundled
 * verbatim under `vendor/open-design/`. The harness's skill provider scans only
 * one level deep (`<root>/<name>/SKILL.md`), so this module turns them into the
 * per-domain index pages the harness can actually read.
 *
 * @module open-design/skills
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Packaged skill trees, relative to the plugin root. */
export const BUNDLES = ['skills', 'design-system-skills']

/**
 * Read the YAML frontmatter of a `SKILL.md` just far enough to get `name` and
 * `description`.
 *
 * No YAML dependency: the fields needed are either a single line or a `|` / `>`
 * block scalar, which is what the whole upstream catalogue uses. A folded
 * description is joined with spaces; a literal one keeps its line breaks.
 *
 * @returns {{ name: string, description: string }}
 */
export function readFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (match === null) return { name: '', description: '' }
  const lines = match[1].split(/\r?\n/)

  const field = (key) => {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const head = new RegExp(`^${key}:\\s*(.*)$`, 'u').exec(line)
      if (head === null) continue
      const rest = head[1].trim()

      // `description: |` or `description: >` — consume the indented block.
      if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
        const body = []
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
          const inner = lines[cursor]
          if (inner.trim() === '') {
            body.push('')
            continue
          }
          if (!/^\s/u.test(inner)) break
          body.push(inner.trim())
        }
        const joined = rest.startsWith('|') ? body.join('\n') : body.join(' ')
        return joined.trim()
      }

      // A quoted scalar: strip the quotes, and unescape `\n` when double-quoted.
      const quote = rest[0]
      if (quote === '"' || quote === "'") {
        const unterminated = rest.length < 2 || !rest.endsWith(quote)
        const inner = rest.slice(1, unterminated ? undefined : -1)
        return (quote === '"' ? inner.replace(/\\n/gu, '\n') : inner).trim()
      }

      return rest
    }
    return ''
  }

  return { name: field('name'), description: field('description') }
}

/**
 * Enumerate every bundled skill.
 *
 * A skill is a directory carrying `SKILL.md`. The **frontmatter `name`** is the
 * identity (several directories are named differently, e.g.
 * `minimalist-skill` → `minimalist-ui`), and it was verified unique across both
 * trees — 237 skills, no collisions.
 *
 * @returns {Array<{ name: string, description: string, bundle: string, dir: string, file: string }>}
 */
export function listBundledSkills(root) {
  const found = []
  for (const bundle of BUNDLES) {
    const bundleRoot = join(root, 'vendor', 'open-design', bundle)
    if (!existsSync(bundleRoot)) continue
    for (const entry of readdirSync(bundleRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const dir = join(bundleRoot, entry.name)
      const file = join(dir, 'SKILL.md')
      if (!existsSync(file)) continue
      const { name: declared, description } = readFrontmatter(readFileSync(file, 'utf8'))
      found.push({
        name: declared === '' ? entry.name : declared,
        description: description === '' ? '(no description)' : description,
        bundle,
        dir,
        file,
      })
    }
  }
  // Stable order: craft skills first, then design systems; alphabetical inside.
  return found.sort(
    (a, b) => BUNDLES.indexOf(a.bundle) - BUNDLES.indexOf(b.bundle) || a.name.localeCompare(b.name),
  )
}

/**
 * Render one domain's index page.
 *
 * Two table sections when the domain owns the design systems, one otherwise:
 * craft skills are the working guidance, design systems are the visual contract.
 *
 * @param {{ id: string, name: string, description: string, summary: string, skills: readonly string[], designSystems?: true }} domain
 * @param {Array<{ name: string, description: string, bundle: string }>} skills
 * @param {{ root: string }} options
 * @returns {string}
 */
export function renderDomainSkill(domain, skills, { root }) {
  const wanted = new Set(domain.skills)
  const craft = skills.filter((skill) => skill.bundle === 'skills' && wanted.has(skill.name))
  const systems =
    domain.designSystems === true ? skills.filter((skill) => skill.bundle === 'design-system-skills') : []

  const bundlePath = join(root, 'vendor', 'open-design')
  // A table cell cannot carry a newline: a literal YAML block keeps its line
  // breaks and would split the row. Fold to one line and escape the pipe.
  const cell = (text) => text.replace(/\s+/gu, ' ').trim().replace(/\|/gu, '\\|')
  const row = (skill) => `| \`${skill.name}\` | ${cell(skill.description)} |`
  const table = (list) => ['| 技能 | 何时使用 |', '| --- | --- |', ...list.map(row)].join('\n')

  const systemsSection =
    systems.length === 0
      ? ''
      : `
## 设计系统契约（${String(systems.length)}）

这些是**视觉契约**：每套提供完整的色板、字体、间距与组件规范。按任务挑一套，不要混用两套的令牌。

${table(systems)}
`

  return `---
name: ${domain.id}
description: ${domain.name}领域技能包。${domain.description}
---

# ${domain.name}

本技能是本领域的技能索引。先按「何时使用」找到对应技能，再读它的 \`SKILL.md\`。

## 你负责什么

${domain.summary}

## 怎么用

技能文件位于：

- 工艺技能：\`${join(bundlePath, 'skills')}/<目录>/SKILL.md\`
- 设计系统：\`${join(bundlePath, 'design-system-skills')}/<目录>/SKILL.md\`

「技能」列是 frontmatter 里的 \`name\`；目录名多数与之相同，个别不同（如 \`minimalist-skill\` → \`minimalist-ui\`），以目录为准定位。

定位后：完整读该 \`SKILL.md\`，带 \`references/\` 或模板的按需一并读取，然后按它写的流程执行。

## 硬性要求

- 一个任务只用一个主风格技能，避免风格互相抵消。
- 反 AI 味：禁止紫蓝渐变堆砌、无意义毛玻璃、千篇一律的 SaaS 布局。
- 不出现 \`TODO\` 或省略号代替实现。

## 技能清单（${String(craft.length)}）

${table(craft)}
${systemsSection}`
}