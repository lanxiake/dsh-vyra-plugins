/**
 * 审计日志:记录 Agent 执行的每条命令
 */
import { appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

function auditFile() {
  const base = process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh')
  return join(base, 'ssh-terminal', 'audit.log')
}

/**
 * 写一条审计记录
 * @param {string} connectionName
 * @param {string} operation 'exec' | 'read_file' | 'write_file' | ...
 * @param {string} detail 命令或路径
 * @param {number|string} code 退出码或状态
 * @param {number} ms 耗时
 */
export function audit(connectionName, operation, detail, code, ms) {
  const line = `${new Date().toISOString()}\t${connectionName}\t${operation}\tcode=${code}\t${ms}ms\t${detail.slice(0, 500)}\n`
  try {
    const file = auditFile()
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, line, { mode: 0o600 })
  } catch {
    // 日志写入失败不阻塞命令执行
  }
}
