/**
 * 每个连接的命令历史,供终端的命令提示使用。只存命令文本,每个连接最多 300 条。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const MAX = 300

export class History {
  constructor(file = join(process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh'), 'ssh-terminal', 'history.json')) {
    this.file = file
    try { this.data = JSON.parse(readFileSync(file, 'utf8')) } catch { this.data = {} }
  }

  get(connectionId) {
    return Array.isArray(this.data[connectionId]) ? this.data[connectionId] : []
  }

  add(connectionId, command) {
    const cmd = String(command).trim()
    if (!cmd || cmd.length > 500) return
    const list = this.get(connectionId).filter((c) => c !== cmd)
    list.push(cmd)
    this.data[connectionId] = list.slice(-MAX)
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 })
    renameSync(tmp, this.file)
  }
}
