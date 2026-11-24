/**
 * 给 PowerShell 脚本补 UTF-8 BOM。
 *
 * Windows PowerShell 5.1 在无 BOM 时按系统 ANSI 代码页读脚本，脚本里的中文
 * 会被读成乱码，甚至把语法搞坏（注释里的中文引号会吞掉后续代码）。仓库里既有的
 * .ps1 都带 BOM；新增或编辑脚本后跑一次本脚本兜底。
 *
 *   node scripts/fix-bom.mjs        # 补 BOM
 *   node scripts/fix-bom.mjs --check  # 只检查，缺 BOM 时退出码 1
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const plugin = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BOM = '\uFEFF'
const check = process.argv.includes('--check')

function collect(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collect(full))
    else if (entry.name.toLowerCase().endsWith('.ps1')) out.push(full)
  }
  return out
}

const roots = [path.join(plugin, 'lib')]
const missing = []
for (const file of roots.flatMap(collect)) {
  const text = readFileSync(file, 'utf8')
  if (text.startsWith(BOM)) continue
  const relative = path.relative(plugin, file)
  if (check) { missing.push(relative); continue }
  writeFileSync(file, BOM + text, 'utf8')
  console.log('已补 BOM：' + relative)
}

if (missing.length > 0) {
  console.error('缺少 UTF-8 BOM：' + missing.join(', '))
  process.exit(1)
}
console.log(check ? 'BOM ok' : 'BOM ok (' + roots.flatMap(collect).length + ' 个脚本)')