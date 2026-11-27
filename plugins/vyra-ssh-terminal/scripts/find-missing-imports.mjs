/**
 * 找出 entry.jsx 里"用了但没导入、也不是本文件定义"的标识符。
 *
 * 渲染检查每次只报第一个 ReferenceError，一个个跑太慢；这里一次把全部缺口列出来。
 * 做法：把 src 下所有模块的导出名收集起来，再看 entry.jsx 里出现、但不是本地
 * 声明、也不是导入名、又确实有模块导出的那些名字。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = new URL('../src/', import.meta.url)
const files = readdirSync(dir).filter((f) => /\.(js|jsx)$/.test(f))

/** name -> [module] */
const exported = new Map()
for (const f of files) {
  const src = readFileSync(join(dir.href.replace('file:///', ''), f), 'utf8')
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)) {
    if (!exported.has(m[1])) exported.set(m[1], [])
    exported.get(m[1]).push(f)
  }
}

const entryPath = join(dir.href.replace('file:///', ''), 'entry.jsx')
const entry = readFileSync(entryPath, 'utf8')

// 本文件里导入的名字
const imported = new Set()
for (const m of entry.matchAll(/import\s*(?:\*\s*as\s+(\w+)|\{([^}]*)\}|(\w+))?\s*from/g)) {
  if (m[1]) imported.add(m[1])
  if (m[3]) imported.add(m[3])
  if (m[2]) for (const part of m[2].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop()?.trim()
    if (name) imported.add(name)
  }
}

// 本文件里声明的名字（function / const / let / class / var，含解构与箭头）
const declared = new Set()
for (const m of entry.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1])
for (const m of entry.matchAll(/(?:^|\n)\s*(?:const|let|var)\s*[\[{]([^\]}]*)[\]}]\s*=/g)) {
  for (const part of m[1].split(',')) {
    const name = part.trim().split(':').pop()?.trim().split('=')[0].trim()
    if (name) declared.add(name)
  }
}

// 用作调用的标识符：word( ，排除关键字与成员访问
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'await', 'new', 'function', 'else', 'do', 'delete', 'in', 'of', 'instanceof', 'void', 'yield', 'super', 'this'])
const used = new Map()
for (const m of entry.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) used.set(m[1], m.index)

const missing = []
for (const [name] of used) {
  if (KEYWORDS.has(name) || imported.has(name) || declared.has(name)) continue
  if (!exported.has(name)) continue // 不是任何模块的导出，可能是全局或属性
  missing.push({ name, from: exported.get(name) })
}

if (!missing.length) console.log('OK: entry.jsx 没有缺失的导入')
else {
  console.log(`缺失 ${missing.length} 个：`)
  for (const m of missing) console.log(`  ${m.name}  ← ${m.from.join(', ')}`)
  process.exit(1)
}
