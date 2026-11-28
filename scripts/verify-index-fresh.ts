/**
 * 检查每个可发布插件的「源码版本」是否已登记进市场索引。
 *
 * ## 为什么需要这个
 *
 * 索引是**手工维护**的：`market-manifest.ts` 里每个版本写一条
 * `{ version, publishTimestamp, source: { commit } }`。改完插件、bump 了
 * package.json 却忘了登记，索引就停在旧版本——市场里显示旧版本号，用户点安装
 * 装到的还是旧代码。这种漏法不会有任何报错，只能靠人去比对。
 *
 * 2026-11 一次复查就查出 4 个插件落后（dsh-im 5.13→6.0.0、plugin-market
 * 0.7.4→0.7.5、skill-mcp-manager 1.3.2→1.4.1、xianyu-delivery 0.9.2→0.10.0）。
 *
 * `verify-index` 不覆盖这件事：它校验的是「索引里 pin 的那个提交，其 package.json
 * 声明的 engines.dsh 是否与索引一致」，不比对版本号本身有没有跟上当前源码。
 *
 * ## 判定
 *
 * 逐条比对 `plugins/<dir>/package.json` 的 version 与索引里该插件的最新版本：
 *
 *  - 相等 → OK
 *  - 源码更新 → **落后**（本条要抓的）
 *  - 源码更旧 → 也报出来：通常意味着有人改了索引却没改源码，或者版本回退了
 *  - 插件不在索引里 → 未收录
 *
 * 另外校验索引 pin 的提交里那个 package.json 的版本**确实等于**登记的版本——
 * 防止「登记了 0.7.5，却指向一个还是 0.7.4 的提交」。
 *
 * 用法：
 *   node scripts/verify-index-fresh.ts          # 有落后就非 0 退出
 *   node scripts/verify-index-fresh.ts --list   # 打印全部，不因落后而失败（自查用）
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pluginsDir = join(root, 'plugins')
const listOnly = process.argv.includes('--list')

interface IndexVersion {
  version: string
  source?: { commit?: string; path?: string }
}
interface IndexPlugin {
  name: string
  versions: IndexVersion[]
}

const index = JSON.parse(readFileSync(join(root, 'docs', 'index.json'), 'utf8')) as {
  plugins?: IndexPlugin[]
}
const byName = new Map((index.plugins ?? []).map((p) => [p.name, p]))

const gitShow = (spec: string): string | null => {
  const r = spawnSync('git', ['show', spec], { cwd: root, encoding: 'utf8', maxBuffer: 8 << 20 })
  return r.status === 0 ? r.stdout : null
}

const rows: { dir: string; name: string; local: string; indexed: string | null; status: string; note: string }[] = []

for (const dir of readdirSync(pluginsDir).sort()) {
  const pkgPath = join(pluginsDir, dir, 'package.json')
  if (!existsSync(pkgPath)) continue
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string; private?: boolean }
  if (pkg.private === true || !pkg.name || !pkg.version) continue

  const entry = byName.get(pkg.name)
  const top = entry?.versions?.[0]
  let status = 'OK'
  let note = ''

  if (!entry || !top) {
    status = '未收录'
  } else if (top.version !== pkg.version) {
    status = '落后'
    note = `源码 ${pkg.version}，索引 ${top.version}`
  } else {
    // 版本号对上了，再确认 pin 的提交里真的是这个版本
    const commit = top.source?.commit
    const path = top.source?.path
    if (commit && path) {
      const raw = gitShow(`${commit}:${path}/package.json`)
      if (raw === null) {
        status = '提交读不到'
        note = 'pin 的提交不在本地（可能还没推送）'
      } else {
        const pinnedVersion = (JSON.parse(raw) as { version?: string }).version
        if (pinnedVersion !== pkg.version) {
          status = '提交版本不符'
          note = `索引登记 ${pkg.version}，但该提交里是 ${pinnedVersion}`
        } else {
          note = commit.slice(0, 7)
        }
      }
    }
  }

  rows.push({ dir, name: pkg.name, local: pkg.version, indexed: top?.version ?? null, status, note })
}

const width = Math.max(...rows.map((r) => r.dir.length), 8) + 2
const pad = (s: string, n: number) => s.padEnd(n)

if (listOnly) {
  console.log(`${pad('插件目录', width)}${pad('源码', 10)}${pad('索引', 10)}${pad('状态', 14)}说明`)
  for (const r of rows) {
    console.log(`${pad(r.dir, width)}${pad(r.local, 10)}${pad(r.indexed ?? '-', 10)}${pad(r.status, 14)}${r.note}`)
  }
}

const bad = rows.filter((r) => r.status !== 'OK')

if (bad.length === 0) {
  console.log(`verify-index-fresh: ${rows.length} 个可发布插件的索引都是最新的`)
  process.exit(0)
}

console.error(`verify-index-fresh failed: ${bad.length}/${rows.length} 个插件的索引需要更新`)
for (const r of bad) {
  console.error(`  ${r.dir}: ${r.status}${r.note ? ` — ${r.note}` : ''}`)
}
console.error('')
console.error('  改完插件并 bump 版本后，请在 scripts/market-manifest.ts 里给该插件')
console.error('  的 versions 加一条 { version, publishTimestamp, source: { commit, path } }，')
console.error('  其中 commit 是**装着该版本文件的提交**（先提交插件文件，再提交清单——')
console.error('  一个 SHA 不能命名包含它自己的那次提交），然后跑 pnpm run build:index。')

if (listOnly) process.exit(0)
process.exit(1)