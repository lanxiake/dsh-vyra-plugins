// 找出「import './x.js' 但仓库里只有 x.ts」的地方。
// esbuild 靠 resolveExtensions 能容忍，纯 node 的 ESM 不能——这类错误只在
// 某些测试里才会炸出来，属于最难查的一类构建隐患。
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = new URL('../src/', import.meta.url)
const files = readdirSync(dir).filter((f) => /\.(js|jsx)$/.test(f))

let found = 0
for (const f of files) {
  const src = readFileSync(new URL(f, dir), 'utf8')
  for (const m of src.matchAll(/from\s+['"]\.\/([\w-]+)\.js['"]/g)) {
    const base = m[1]
    const asJs = join(dir.pathname.replace(/^\//, ''), `${base}.js`)
    const asTs = join(dir.pathname.replace(/^\//, ''), `${base}.ts`)
    if (!existsSync(asJs) && existsSync(asTs)) {
      console.log(`  ${f}: 导入 ./${base}.js，但文件是 ${base}.ts`)
      found++
    }
  }
}
console.log(found ? `\n共 ${found} 处` : 'OK: 没有指错扩展名的导入')
process.exit(found ? 1 : 0)
