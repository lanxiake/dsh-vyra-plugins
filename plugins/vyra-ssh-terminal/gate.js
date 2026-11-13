/**
 * 风险分级器,移植自 liteshell gate.ts
 * 纯函数,模型无法给自己的请求定级
 */

const READ_TOOLS = new Set(['ssh_list_connections', 'ssh_list_files', 'ssh_read_file']);

// 写远程文件会覆盖同名文件,不分命令内容,一律确认
const TRANSFER_TOOLS = new Set(['ssh_write_file']);

// 高危模式:不可撤销的破坏性操作
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
];

// 有风险但可恢复
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
  /\b(apt|apt-get|yum|dnf|apk|pacman)\s+\S*(remove|purge|erase|autoremove)/,
  /\bpip\w*\s+uninstall/,
  /\b(npm|pnpm|yarn)\s+(uninstall|publish|ci\s+--production)/,
  /\bchmod\b/,
  /\bchown\b/,
  /\b(insmod|rmmod|modprobe)\b/,
  /\b(mount|umount)\b/,
  /\bmkfs\b/,
  /\btee\b/,
  />>?\s*(?!\/dev\/null\b)[^\s&|]/,
  /\bsudo\b/,
  /\bsu\s/,
  /\beval\b/,
  /\bexec\b/,
  /`/,
  /\$\(/,
  /\|\s*(ba|z|k|c|da)?sh\b/,
];

// 不可逆操作:删除或覆盖数据
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
  />>?\s*(?!\/dev\/null\b)[^\s&|]/,
  /\btee\b/,
];

function riskOf(command) {
  const c = command.trim();
  if (!c) return 'safe';
  if (CRITICAL.some(r => r.test(c))) return 'critical';
  if (RISKY.some(r => r.test(c))) return 'risky';
  return 'safe';
}

/**
 * 决策门:返回是否自动执行、风险等级、原因
 */
export function gate(tool, command = '') {
  if (READ_TOOLS.has(tool)) {
    return { auto: true, risk: 'safe', reason: '只读操作' };
  }
  if (TRANSFER_TOOLS.has(tool)) {
    return { auto: false, risk: 'risky', reason: '文件传输:远端同名文件会被覆盖或写入本地' };
  }
  if (!command.trim()) {
    return { auto: false, risk: 'safe', reason: '空命令' };
  }
  const risk = riskOf(command);
  if (risk === 'critical') {
    return { auto: false, risk, reason: '命中高危模式:此类命令无法撤销' };
  }
  if (DESTRUCTIVE.some(r => r.test(command))) {
    return { auto: false, risk, reason: '会删除或覆盖数据,无法退回' };
  }
  return { auto: true, risk, reason: risk === 'safe' ? '只读命令' : '改了服务器但可改回' };
}

/**
 * 输出脱敏:防止密码回显进上下文
 */
export function sanitizeOutput(command, stdout) {
  // 简单实现:如果命令包含明文密码参数(如 -p 'password'),替换输出中的匹配文本
  const passwordMatch = command.match(/(?:-p|--password)\s+['"]?([^\s'"]+)['"]?/);
  if (passwordMatch && passwordMatch[1]) {
    const pwd = passwordMatch[1];
    return stdout.replace(new RegExp(pwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
  }
  return stdout;
}
