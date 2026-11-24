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
import { DOMAINS, DOMAIN_IDS } from './domains.mjs'
import { readConfig, writeConfig } from './config.mjs'
import { sync } from './sync.mjs'

const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url))

const USAGE = `odx — OpenDesign 领域开关

用法:
  odx domains list [--json]        列出九个领域与启用状态
  odx domains enable <id...>       启用一个或多个领域
  odx domains disable <id...>      关闭一个或多个领域
  odx domains enable-all           全部启用
  odx domains disable-all          全部关闭
  odx agents list                  列出已生成的领域 agent 与编排 agent
  odx sync                         按当前配置重新同步磁盘

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

  if (group === 'agents' && (action === 'list' || action === undefined)) {
    const { enabled } = readConfig(dshHome)
    out.push(`编排 Agent：od-director（可调度 ${String(enabled.length)} 个领域）`)
    for (const domain of DOMAINS) {
      out.push(`${enabled.includes(domain.id) ? '✅' : '  '} ${domain.id.padEnd(20)} ${domain.name}`)
    }
    return emit(0)
  }

  if (group === 'sync') {
    return emit(applyAndReport())
  }

  err.push(`未知命令「${[group, action].filter(Boolean).join(' ')}」`)
  out.push(USAGE)
  return emit(1)
}