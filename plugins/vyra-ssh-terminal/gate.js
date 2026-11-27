/**
 * 风险分级与决策门。
 *
 * 两条入口都从这里过：
 *  - DSH 宿主自己的工具（`ssh_exec` 等）：挂在 `tools/pre-execute` 上，只对 `ssh_` 前缀生效；
 *  - 面板里的 AI：在引擎执行每一步之前问一次。
 *
 * 默认是「宽松」：只有不可撤销的破坏性操作才停下来等用户确认，只读命令和可改回的
 * 改动直接跑。这是 liteshell 的口径，也是这里要复刻的口径。
 *
 * 安全上的硬约束只有一条：**模型不能给自己的请求定级**。判定完全由下面的纯函数
 * 按命令文本决定，模型改不了。
 */

/** 只读工具：不碰远端状态，也没有跨设备的副作用。 */
const READ_TOOLS = new Set([
  'ssh_list_connections',
  'ssh_list_files',
  'ssh_read_file',
  'ssh_monitor',
  'ssh_read_output',
  // 面板 AI 的工具名
  'ls',
  'cat',
  'monitor',
  'read_output',
  'list_connections',
])

/** 跨设备边界：上传/下载会写到对面或本机，一律确认（不属于「命令分类器」的管辖）。 */
const TRANSFER_TOOLS = new Set(['ssh_write_file', 'ssh_upload', 'ssh_download', 'upload', 'download', 'write_file'])

/** 高危模式：不可撤销的破坏性操作。 */
const CRITICAL = [
  /\brm\s+(?:-\S+\s+)*-\S*[rR]\S*\s+(?:\/|~|\*|\.\.?\/?(?:\s|$))/,
  /\bmkfs(\.\w+)?\b/,
  /\bdd\b[^|;]*\bof=\/dev\//,
  /\b(shutdown|reboot|halt|poweroff)\b/,
  /\b(init|telinit)\s+0\b/,
  /\bchmod\s+(-\w+\s+)*777\s+\//,
  /:\s*\(\s*\)\s*\{.*\}\s*;\s*:/,
  /\b(curl|wget)\b[^|;]*\|\s*(sudo\s+)?\w*sh\b/,
  />>?\s*\/dev\/(sd|nvme|hd|vd)/,
  />>?\s*\/etc\/(passwd|shadow|sudoers|fstab|crontab)/,
  />>?\s*[^\s]*\.ssh\/authorized_keys/,
  /\bhistory\s+-c\b/,
  /\b(userdel|groupdel)\b/,
  /\bcrontab\s+-r\b/,
]

/** 会删改数据的操作：不可逆，属于「停下来问一句」的那一类。 */
const DESTRUCTIVE = [
  /\brm\b/,
  /\brmdir\b/,
  /\bunlink\b/,
  /\bshred\b/,
  /\btruncate\b/,
  /\bmv\b/,
  /\bdd\b/,
  /\b(kill|killall|pkill)\b/,
  /\bdocker\s+(rm|rmi|prune|down|compose\s+down|volume\s+rm|system\s+prune)/,
  /\bkubectl\s+(delete|drain|cordon)/,
  /\bgit\s+(reset\s+--hard|clean|push\s+--force|push\s+-f)/,
  /\b(apt|apt-get|yum|dnf|apk|pacman)\s+\S*(remove|purge|erase|autoremove)/,
  /\bpip\w*\s+uninstall/,
  /\b(npm|pnpm|yarn)\s+uninstall/,
  /\b(vgremove|lvremove|pvremove|swapoff)\b/,
  /\b(crontab|at)\s+-(r|d)\b/,
  // 单箭头重定向会把目标文件清空再写：这正是"覆盖数据"本身，无法退回。
  // 追加（>>）与 /dev/null 不在此列——它们不销毁已有的内容。
  /(?<![>\d&])>(?!>)\s*(?!\/dev\/null\b)\S/,
  /\btee\b/,
]

/** 改了服务器但能改回来的东西。宽松模式下这些直接跑，不打断用户。 */
const RISKY = [
  /\brm\b/,
  /\bmv\b/,
  /\bdd\b/,
  /\btruncate\b/,
  /\b(kill|killall|pkill)\b/,
  /\bsystemctl\s+(stop|disable|mask|restart|reload)/,
  /\bservice\s+\S+\s+(stop|restart)/,
  /\bdocker\s+(rm|rmi|stop|kill|prune|down|compose\s+down)/,
  /\bkubectl\s+(delete|drain|cordon|scale|apply|patch)/,
  /\bgit\s+(reset|clean|checkout|push|rebase)/,
  /\b(useradd|usermod|groupadd|chpasswd|passwd)\b/,
  /\b(apt|apt-get|yum|dnf|apk|pacman)\s+\S*(install|remove|purge|erase|autoremove|upgrade)/,
  /\bpip\w*\s+(install|uninstall)/,
  /\b(npm|pnpm|yarn)\s+(install|uninstall|publish|ci)/,
  /\bchmod\b/,
  /\bchown\b/,
  /\b(insmod|rmmod|modprobe)\b/,
  /\b(mount|umount)\b/,
  /\bmkfs\b/,
  /\btee\b/,
  /(?<![>\d&])>(?!>)\s*(?!\/dev\/null\b)\S/,
  />>\s*(?!\/dev\/null\b)\S/,
  /\bsudo\b/,
  /\bsu\s/,
  /\beval\b/,
  /\bexec\b/,
  /`/,
  /\$\(/,
  /\|\s*(ba|z|k|c|da)?sh\b/,
]

/** 严格的三种模式。宽松是默认，另外两档留给喜欢更紧边界的人。 */
export const MODES = {
  // 只停不可撤销的破坏性操作（= liteshell）
  loose: ['critical', 'destructive'],
  // 再加上「改了配置 / 重启服务」这一类
  normal: ['critical', 'destructive', 'risky'],
  // 每条命令都停
  strict: ['critical', 'destructive', 'risky', 'safe'],
}

export function riskOf(command) {
  const c = String(command ?? '').trim()
  if (!c) return 'safe'
  if (CRITICAL.some((r) => r.test(c))) return 'critical'
  if (DESTRUCTIVE.some((r) => r.test(c))) return 'destructive'
  if (RISKY.some((r) => r.test(c))) return 'risky'
  return 'safe'
}

const REASON = {
  critical: '命中高危模式：这类命令无法撤销',
  destructive: '会删除或覆盖数据，无法退回',
  risky: '会改动服务器，但能改回来',
  safe: '只读命令',
}

/**
 * 决策门。
 *
 * @param {string} tool 工具名
 * @param {string} [command] 要执行的命令（只有 exec 类工具有）
 * @param {{mode?: 'loose'|'normal'|'strict'}} [opts] 严格度，默认宽松
 * @returns {{auto: boolean, risk: 'safe'|'risky'|'destructive'|'critical', reason: string}}
 */
export function gate(tool, command = '', opts = {}) {
  // 跨设备边界先判，命令分类器没见过它们。
  if (READ_TOOLS.has(tool)) return { auto: true, risk: 'safe', reason: '只读操作' }
  if (TRANSFER_TOOLS.has(tool)) {
    return { auto: false, risk: 'destructive', reason: '文件传输：会写到对面或本机，可能覆盖同名文件' }
  }
  if (!String(command ?? '').trim()) return { auto: false, risk: 'safe', reason: '空命令' }

  const risk = riskOf(command)
  const stopOn = MODES[opts.mode] ?? MODES.loose
  const auto = !stopOn.includes(risk)
  return { auto, risk, reason: REASON[risk] }
}

/** 给审批卡用的三色。 */
export function riskTone(risk) {
  return risk === 'critical' || risk === 'destructive' ? 'err' : risk === 'risky' ? 'warn' : 'ok'
}

/**
 * 输出脱敏：防止密码回显进上下文。
 *
 * 只处理命令里明确带了密码的情况（`-p 'secret'` / `--password secret`），
 * 不去猜任何别的形状——猜错的代价是把正常输出也改写掉。
 */
export function sanitizeOutput(command, stdout) {
  const m = /(?:-p|--password)\s+['"]?([^\s'"]+)['"]?/.exec(String(command ?? ''))
  if (!m || !m[1]) return stdout
  const esc = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return String(stdout ?? '').replace(new RegExp(esc, 'g'), '***')
}
