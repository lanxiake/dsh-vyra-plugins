/**
 * 跑这个插件全部的纯 node 测试。
 *
 *   node test/run.mjs
 *
 * 每个文件自己起、自己收尾，互不共享状态；任何一个失败，整体退出码非 0。
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = import.meta.dirname
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()

let failed = 0
for (const file of files) {
  const r = spawnSync(process.execPath, [join(dir, file)], { encoding: 'utf8' })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
  const ok = r.status === 0
  if (!ok) failed++
  console.log(`\n──── ${file} ${ok ? '✓' : '✗'}\n${out}`)
}

console.log(`\n${files.length - failed}/${files.length} 个测试文件通过`)
process.exit(failed ? 1 : 0)
