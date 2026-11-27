// 找到本机真实的夸克网盘 CLI（由官方 quarkclouddrive Skill 安装，带 scripts/quark-drive.cjs）。
//
// 两个坑，都是 2026-11-27 现场踩出来的：
//   1. 安装位置不固定：可能在 skill 目录、`<workspace>/.quark-install`、`~/.lumii/...`。
//      写死 ~/.quarkcd 会误报「没装」。
//   2. 凭证路径是按「CLI 进程的 cwd」解析的：`<cwd>/<agentId>/config.json`。
//      换目录就「未登录」。所以调用时必须把 cwd 固定到用户确认过的那个目录。
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CLI_REL = join('scripts', 'quark-drive.cjs')

function candidateRoots(extra = []) {
  const home = homedir()
  const list = [
    ...extra,
    join(home, '.quarkcd'),
    join(home, '.quarkclouddrive'),
    join(home, 'Documents', 'deepseek-harness', 'default-workspace', '.quark-install'),
  ]
  // 扫描一级目录里的 `.quark-install` / `quark-skill/pkg`：用户可能在任何项目下装过。
  for (const base of [join(home, 'Documents'), join(home, '.lumii', 'workspace', 'temp')]) {
    try {
      for (const name of readdirSync(base)) {
        list.push(join(base, name, '.quark-install'))
        list.push(join(base, name, 'quark-skill', 'pkg'))
        list.push(join(base, name, '.quark-install', 'pkg'))
      }
    } catch {
      // 目录不存在就跳过
    }
  }
  return [...new Set(list)]
}

/**
 * @returns {{ root: string, script: string } | null}
 */
export function findQuarkCli(extraRoots = []) {
  for (const root of candidateRoots(extraRoots)) {
    const script = join(root, CLI_REL)
    try {
      if (existsSync(script) && statSync(script).isFile()) return { root, script }
    } catch {
      // 权限/竞态：换下一个
    }
  }
  return null
}

/** 列出某个 CLI 根目录下所有可能的 cwd（各自带 config.json 的目录）。 */
export function credentialLocations(root) {
  const home = homedir()
  const extra = [
    join(home, 'Documents', 'deepseek-harness', 'default-workspace'),
    process.cwd(),
  ]
  const out = []
  const probe = (dir) => {
    // 每个 cwd 下对应 <cwd>/<agentId>/config.json，agentId 可能是 deepseek / wild 等。
    for (const agent of ['deepseek', 'wild', 'claude', 'codex', 'cursor', 'trae', 'agents']) {
      const file = join(dir, agent, 'config.json')
      if (existsSync(file)) {
        let size = 0
        try { size = statSync(file).size } catch { /* ignore */ }
        out.push({ cwd: dir, agent, file, size, inSkillRoot: dir.startsWith(root) })
      }
    }
  }
  probe(root)
  for (const dir of extra) probe(dir)
  return out
}
