/**
 * 检查最近 N 天改动过的插件，是否都发过版（索引里有对应的新版本）。
 *
 * ## 为什么需要
 *
 * `verify-index-fresh` 只比对「源码版本号 == 索引版本号」。如果改了代码却没 bump
 * 版本号，两边都是同一个数字，检查就放过了——但那批改动**任何安装都拿不到**，
 * 因为索引 pin 的还是旧提交。2026-11 的文件管理器就是这样：0.5.0 之后进了三个
 * 功能（时间线缩略图、类型筛选、音视频拖动进度条），版本号没动，全都没发出去。
 *
 * ## 判据：看**产物的内容**变没变，而不是看改了哪些文件
 *
 * 最初按「改了 .js/.css 就算功能改动」来判断，结果误报了：某次提交只改构建脚本
 * 和 README（`client.js` 一个字节没动），却被当成需要发版。
 *
 * 现在改成比对「索引 pin 的提交里该插件的可发布内容」与「HEAD 里的」：
 * 把该插件目录下除文档/测试外的文件做内容摘要，两边一样就是没变。
 * 这样无论中间改了多少次构建脚本、README，只要装到用户机器上的东西一模一样，
 * 就不该要求发版。
 *
 * 用法：
 *   node scripts/verify-recent-releases.ts [天数，默认 3]
 *   node scripts/verify-recent-releases.ts 7 --list
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const listOnly = args.includes('--list')
const days = Number(args.find((a) => /^\d+$/.test(a)) ?? 3)

const git = (argv: string[]): string =>
  execFileSync('git', argv, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/**
 * 不计入"可发布内容"的路径。
 *
 * 判据是「装到用户机器上的东西变没变」，所以凡是**不发货**的文件都要排除：
 * 文档、测试、构建脚本、lockfile、git 配置……它们变了但产物没变，不该要求发版。
 * 漏掉任何一条都会造成误报（`package-lock.json` 就踩过：只重装依赖也会被当成
 * "改了没发版"）。
 */
const NOT_SHIPPED = new RegExp(
  [
    String.raw`(^|/)(README|CHANGELOG|THIRD_PARTY_NOTICES|LICENSE)\.(md|txt)$`,
    String.raw`(^|/)docs/`,
    String.raw`(^|/)(test[^/]*|tests?)/`,
    String.raw`(^|/)scripts/`,
    String.raw`(^|/)package-lock\.json$`,
    String.raw`(^|/)\.git`,
    String.raw`(^|/)\.github/`,
    String.raw`\.md$`,
  ].join('|'),
  'i'
)

/**
 * 一个插件在某个提交下的「可发布内容」摘要。
 * 用 `git ls-tree -r` 列出该提交里该目录的全部 blob 与它们的 SHA，
 * 过滤掉不发货的文件后拼起来再摘要——内容完全一致就是同一份产物。
 */
function contentHash(commit: string, dir: string): string | null {
  try {
    const out = git(['ls-tree', '-r', commit, '--', `plugins/${dir}`])
    const lines = out
      .split('\n')
      .filter(Boolean)
      // 每行形如：<mode> blob <sha>\t<path>
      .map((l) => {
        const tab = l.indexOf('\t')
        const left = l.slice(0, tab).split(/\s+/)
        return { sha: left[2], path: l.slice(tab + 1) }
      })
      .filter((e) => !NOT_SHIPPED.test(e.path))
      .sort((a, b) => a.path.localeCompare(b.path))
    if (lines.length === 0) return null
    return createHash('sha256').update(lines.map((e) => `${e.path}:${e.sha}`).join('\n')).digest('hex').slice(0, 16)
  } catch {
    return null
  }
}

interface Row {
  dir: string
  name: string
  local: string
  indexed: string | null
  commits: number
  status: string
  detail: string
}

const index = JSON.parse(readFileSync(join(root, 'docs', 'index.json'), 'utf8')) as {
  plugins?: { name: string; versions: { version: string; source?: { commit?: string } }[] }[]
}
const byName = new Map((index.plugins ?? []).map((p) => [p.name, p]))

const since = new Date(Date.now() - days * 86400_000).toISOString()
const rows: Row[] = []

for (const dir of readdirSync(join(root, 'plugins')).sort()) {
  const pkgPath = join(root, 'plugins', dir, 'package.json')
  if (!existsSync(pkgPath)) continue
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string; private?: boolean }
  if (pkg.private === true || !pkg.name || !pkg.version) continue

  const commits = git(['log', `--since=${since}`, '--format=%H', '--', `plugins/${dir}`]).split('\n').filter(Boolean)

  const entry = byName.get(pkg.name)
  const top = entry?.versions?.[0]
  const indexed = top?.version ?? null
  let status = '未改动'
  let detail = ''

  if (commits.length > 0) {
    if (!entry || !top) {
      status = '未收录'
    } else if (top.version !== pkg.version) {
      status = '未登记新版本'
      detail = `源码 ${pkg.version} / 索引 ${top.version}`
    } else {
      const pinned = top.source?.commit
      const a = pinned ? contentHash(pinned, dir) : null
      const b = contentHash('HEAD', dir)
      if (a === null || b === null) {
        status = '无法比对'
        detail = '读不到 pin 的提交或当前内容'
      } else if (a !== b) {
        status = '改了没发版'
        detail = `版本仍为 ${pkg.version}，但产物内容与索引 pin 的提交不同`
      } else {
        status = 'OK'
        detail = `${pkg.version} · ${commits.length} 个提交（产物未变）`
      }
    }
  }

  rows.push({ dir, name: pkg.name, local: pkg.version, indexed, commits: commits.length, status, detail })
}

const touched = rows.filter((r) => r.commits > 0)
const bad = touched.filter((r) => r.status !== 'OK')

const width = Math.max(...rows.map((r) => r.dir.length), 8) + 2
const pad = (s: string, n: number) => s.padEnd(n)

if (listOnly) {
  console.log(`最近 ${days} 天有提交的插件：${touched.length} 个\n`)
  console.log(`${pad('插件目录', width)}${pad('版本', 10)}${pad('状态', 16)}说明`)
  for (const r of touched) console.log(`${pad(r.dir, width)}${pad(r.local, 10)}${pad(r.status, 16)}${r.detail}`)
}

if (bad.length === 0) {
  console.log(`verify-recent-releases: 最近 ${days} 天有提交的 ${touched.length} 个插件，产物都已发版`)
  process.exit(0)
}

console.error(`verify-recent-releases failed: ${bad.length}/${touched.length} 个插件的改动还没发出去`)
for (const r of bad) console.error(`  ${r.dir}: ${r.status} — ${r.detail}`)
console.error('')
console.error('  改了要发布的内容就要 bump plugins/<dir>/package.json 的 version，')
console.error('  并在 scripts/market-manifest.ts 里加一条，然后 pnpm run build:index。')
console.error('  否则市场里装的还是旧版本，这些改动谁都拿不到。')
process.exit(1)