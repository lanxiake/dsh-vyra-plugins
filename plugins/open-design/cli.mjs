/**
 * `odx` — turn OpenDesign domains on and off.
 *
 * Every mutating command writes `domains.json` and then re-runs the same sync
 * the plugin uses on mount, so a change is live the moment the command returns.
 *
 * Kept free of process-level side effects (no `process.exit`, no `console`) so
 * the tests call `run()` directly; `bin/odx` is the thin wrapper that wires the
 * result to stdio.
 *
 * @module open-design/cli
 */

import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { DOMAINS, DOMAIN_IDS } from './domains.mjs'
import { readConfig, writeConfig } from './config.mjs'
import { listOwned, removeStalePresets, sync } from './sync.mjs'
import { readMountRecord } from './diagnostics.mjs'
import { readRoster } from './agents.mjs'
import { ORCHESTRATOR } from './domains.mjs'

const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url))

const USAGE = `odx — OpenDesign 领域开关

用法:
  odx domains list [--json]        列出九个领域与启用状态
  odx domains enable <id...>       启用一个或多个领域
  odx domains disable <id...>      关闭一个或多个领域
  odx domains enable-all           全部启用
  odx domains disable-all          全部关闭
  odx agents list                  列出已生成的领域 agent 与编排 agent
  odx presets prune                列出旧领域 Agent 的卸载步骤
  odx presets prune --delete-only  依赖卸载后删除残留目录
  odx sync                         按当前配置重新同步磁盘
  odx doctor                       查看设置页路由是否挂载成功

领域:
${DOMAINS.map((d) => `  ${d.id.padEnd(20)} ${d.name}`).join('\n')}
`

/**
 * Run one command.
 *
 * @param {string[]} argv
 * @param {{ dshHome?: string, root?: string, installAgents?: boolean }} [options]
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
export function run(argv, options = {}) {
  const root = options.root ?? PACKAGE_ROOT
  const dshHome = options.dshHome
  const installAgents = options.installAgents !== false
  const out = []
  const err = []

  const emit = (exitCode) => ({
    exitCode,
    stdout: out.length > 0 ? `${out.join('\n')}\n` : '',
    stderr: err.length > 0 ? `${err.join('\n')}\n` : '',
  })

  /** Re-sync after a config change and describe what happened. */
  const applyAndReport = () => {
    const report = sync({ dshHome, root, installAgents })
    for (const warning of report.warnings) err.push(`提示：${warning}`)
    if (report.error !== null) {
      err.push(`同步失败：${report.error}`)
      return 1
    }
    out.push(`已启用 ${String(report.enabled.length)} / ${String(DOMAINS.length)} 个领域：${report.enabled.join(', ') || '（无）'}`)
    if (report.skillsWritten.length > 0) out.push(`写入技能：${report.skillsWritten.join(', ')}`)
    if (report.agentsWritten.length > 0) out.push(`写入 Agent：${report.agentsWritten.join(', ')}`)
    if (report.stale.length > 0) {
      out.push(`待清理的旧领域 Agent：${report.stale.join(', ')}（重启 DSH 后自动卸载；这里没有 pluginManager，只报告不删）`)
    }
    if (report.removed.length > 0) out.push(`清理：${report.removed.join(', ')}`)
    return 0
  }

  const [group, action, ...rest] = argv

  if (group === undefined || group === '--help' || group === '-h' || group === 'help') {
    out.push(USAGE)
    return emit(0)
  }

  if (group === 'domains' || group === 'domain') {
    const json = rest.includes('--json')
    const ids = rest.filter((value) => !value.startsWith('--'))

    if (action === 'list' || action === undefined) {
      const { enabled } = readConfig(dshHome)
      if (json) {
        const rows = DOMAINS.map((domain) => ({
          id: domain.id,
          name: domain.name,
          enabled: enabled.includes(domain.id),
          skills: domain.skills.length,
          designSystems: domain.designSystems === true,
        }))
        return { exitCode: 0, stdout: `${JSON.stringify(rows, null, 2)}\n`, stderr: '' }
      }
      out.push('领域                 状态      技能数')
      for (const domain of DOMAINS) {
        const on = enabled.includes(domain.id)
        const skills = domain.designSystems === true ? `${String(domain.skills.length)}+152` : String(domain.skills.length)
        out.push(`${domain.id.padEnd(20)} ${on ? '✅ 开' : '  关 '}  ${skills.padStart(6)}  ${domain.name}`)
      }
      return emit(0)
    }

    if (action === 'enable' || action === 'disable') {
      if (ids.length === 0) {
        err.push(`用法：odx domains ${action} <id...>`)
        return emit(1)
      }
      const unknown = ids.filter((id) => !DOMAIN_IDS.includes(id))
      if (unknown.length > 0) {
        for (const id of unknown) err.push(`未知领域「${id}」。可用：${DOMAIN_IDS.join(', ')}`)
        return emit(1)
      }
      const current = readConfig(dshHome).enabled
      const next =
        action === 'enable' ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))
      writeConfig(next, dshHome)
      return emit(applyAndReport())
    }

    if (action === 'enable-all' || action === 'disable-all') {
      writeConfig(action === 'enable-all' ? [...DOMAIN_IDS] : [], dshHome)
      return emit(applyAndReport())
    }
  }

  if (group === 'presets' && action === 'prune' && !rest.includes('--delete-only')) {
    // Uninstalling a bundle runs `pnpm remove` and reloads the profile, so it
    // must happen from outside the boot path — and outside this process, whose
    // caller `bin/odx` reads a synchronous return value. This prints the exact
    // commands; running them while DSH is closed is the safe order.
    const presetsRoot = join(dshHome ?? (process.env.DSH_HOME || join(homedir(), '.dsh')), 'agent-manager', 'presets')
    const stale = listOwned(presetsRoot, [ORCHESTRATOR.id])
    if (stale.length === 0) {
      out.push('没有待清理的旧领域 Agent。')
      return emit(0)
    }
    out.push(`发现 ${String(stale.length)} 个旧领域 Agent（关闭 DSH 后按顺序执行）：`)
    out.push('')
    for (const id of stale) {
      out.push(`  pnpm remove @local/agent-preset-${id}`)
    }
    out.push('')
    out.push('依赖卸载完成后删除目录：')
    out.push('  odx presets prune --delete-only')
    return emit(0)
  }

  if (group === 'presets' && action === 'prune' && rest.includes('--delete-only')) {
    const presetsRoot = join(dshHome ?? (process.env.DSH_HOME || join(homedir(), '.dsh')), 'agent-manager', 'presets')
    const purged = removeStalePresets(presetsRoot, listOwned(presetsRoot, [ORCHESTRATOR.id]))
    out.push(purged.length === 0 ? '没有可删除的目录。' : `已删除：${purged.join(', ')}`)
    return emit(0)
  }

  if (group === 'agents' && (action === 'list' || action === undefined)) {    const { enabled } = readConfig(dshHome)
    const roster = readRoster(join(dshHome ?? (process.env.DSH_HOME || join(homedir(), '.dsh')), 'agent-manager', 'presets'))
    out.push(`编排 Agent：od-director（可委派 ${String(roster.length)} 个已安装 Agent，${String(enabled.length)} 个领域技能）`)
    out.push('')
    out.push('可委派的 Agent 花名册：')
    if (roster.length === 0) out.push('  （空——先安装或新建 Agent 预设）')
    for (const row of roster) out.push(`  ${row.id.padEnd(24)} ${row.name}`)
    return emit(0)
  }

  if (group === 'sync') {
    return emit(applyAndReport())
  }

  if (group === 'doctor') {
    // The panel can only report a bare 404; this says which of the three
    // causes produced it.
    const record = readMountRecord(dshHome)
    if (record === null) {
      err.push('没有找到挂载记录。插件要么尚未在本 profile 加载过，要么安装的是没有诊断的旧版本。')
    } else {
      out.push(`最近一次挂载：${record.at}`)
      out.push(`  插件版本：${record.version ?? '未知'}`)
      out.push(`  路径    ：${record.via}`)
      if (record.ok === true) {
        out.push(`  结果    ：成功，已挂载 ${(record.routes ?? []).join('、')}`)
      } else if (record.pending === true) {
        out.push('  结果    ：等待 webServer 注入 —— 若设置页仍 404，说明注入从未触发，是宿主组成问题')
      } else {
        out.push(`  结果    ：失败 —— ${record.error ?? '未知原因'}`)
      }
    }
    return emit(record?.ok === true ? 0 : 1)
  }

  err.push(`未知命令「${[group, action].filter(Boolean).join(' ')}」`)
  out.push(USAGE)
  return emit(1)
}