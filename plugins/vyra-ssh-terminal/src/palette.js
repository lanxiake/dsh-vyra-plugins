/**
 * 命令补全与命令面板的**纯逻辑**。
 *
 * 界面只负责画，判断都在这里：给一行已经输入的内容，返回该补什么、为什么。
 * 拆出来的原因很直接——候选排序的规则（历史优先、前缀命中、每个命令自己的动作）
 * 是最容易悄悄坏掉的地方，而它坏了用户只会觉得"补全没用"，不会报错。
 *
 * 两条硬规则（与 liteshell 一致）：
 *  1. **候选永远是在已输入内容上追加**，绝不会拿一个裸命令名把用户打好的参数抹掉；
 *  2. **表里不能有工具上不存在的动词**——一个看着像的假选项比没有候选更坑。
 */

/** 命令 → 它的常用动作。表里只放真实存在的子命令。 */
export const SUBCOMMANDS = {
  systemctl: [
    ['status', '看服务状态'],
    ['restart', '重启服务'],
    ['reload', '重载配置'],
    ['start', '启动'],
    ['stop', '停止'],
    ['enable', '开机自启'],
    ['disable', '取消自启'],
    ['list-units --failed', '只看失败的单元'],
  ],
  journalctl: [
    ['-u', '按服务看日志'],
    ['-f', '实时跟随'],
    ['-xe', '最近错误'],
    ['--since "1 hour ago"', '最近一小时'],
    ['--disk-usage', '日志占用多少磁盘'],
  ],
  docker: [
    ['ps -a', '所有容器'],
    ['ps', '运行中的容器'],
    ['logs -f --tail 200', '跟踪日志'],
    ['stats', '实时资源占用'],
    ['images', '本地镜像'],
    ['exec -it', '进容器'],
    ['compose up -d', '拉起编排'],
    ['compose down', '停掉编排'],
    ['prune', '清理无用数据'],
  ],
  kubectl: [
    ['get pods', '所有 Pod'],
    ['get pods -A -o wide', '全命名空间'],
    ['logs -f', '跟日志'],
    ['describe pod', '看详情事件'],
    ['top pods', '实时资源'],
    ['get svc', '服务与端口'],
  ],
  git: [
    ['status', '工作区状态'],
    ['log --oneline -20', '最近提交'],
    ['stash', '暂存改动'],
    ['stash pop', '把暂存的改回来'],
    ['pull --rebase', '拉取并变基'],
    ['branch -a', '所有分支'],
  ],
  'apt': [
    ['update', '更新索引'],
    ['upgrade', '升级已装'],
    ['install', '安装'],
    ['list --installed', '已装列表'],
  ],
  yum: [
    ['list installed', '已装列表'],
    ['install', '安装'],
    ['update', '升级'],
  ],
  tar: [
    ['-czf', '打包成 .tar.gz'],
    ['-xzf', '解开 .tar.gz'],
    ['-tzf', '只看内容不接开'],
  ],
  find: [
    ['-name', '按名字找'],
    ['-mtime -1', '一天内改过的'],
    ['-size +100M', '超过 100MB 的'],
    ['-type f -delete', '删掉命中的文件'],
  ],
  grep: [
    ['-rn', '递归并给行号'],
    ['-i', '忽略大小写'],
    ['-v', '反向匹配'],
  ],
  sed: [
    ['-i', '就地修改'],
    ['-n p', '只打印匹配行'],
    ['s///g', '全局替换'],
  ],
  awk: [
    ["'{print $1}'", '打印第一列'],
    ["-F,", '按逗号分隔'],
  ],
  ps: [
    ['aux', '所有进程'],
    ['aux --sort=-%cpu', '按 CPU 排序'],
    ['-ef', '完整格式'],
  ],
  ls: [
    ['-la', '含隐藏文件'],
    ['-lh', '人类可读大小'],
    ['-lt', '按时间排序'],
  ],
  df: [
    ['-h', '人类可读'],
    ['-i', '看 inode'],
  ],
  du: [
    ['-sh *', '各目录合计'],
    ['-h --max-depth=1', '一层深度'],
  ],
  free: [
    ['-h', '人类可读'],
    ['-m', '按 MB'],
  ],
  ss: [
    ['-lntp', '监听中的 TCP'],
    ['-s', '汇总统计'],
  ],
  ip: [
    ['a', '看地址'],
    ['r', '看路由'],
  ],
  curl: [
    ['-I', '只看响应头'],
    ['-sS', '安静但显示错误'],
    ['-o', '存成文件'],
  ],
  ssh: [
    ['-p', '指定端口'],
    ['-i', '指定私钥'],
    ['-v', '调试输出'],
  ],
  scp: [
    ['-r', '递归拷目录'],
    ['-P', '指定端口（大写 P）'],
  ],
  rsync: [
    ['-avz --progress', '带进度同步'],
    ['-avz --delete', '镜像并删多余'],
  ],
  lsof: [
    ['-i :8080', '谁占着 8080'],
    ['+D', '谁占着某目录'],
  ],
  nginx: [
    ['-t', '检查配置'],
    ['-s reload', '重载配置'],
  ],
  mysql: [
    ['-u root -p', '登录'],
    ['-e', '执行一条 SQL'],
  ],
  'redis-cli': [
    ['ping', '连通性'],
    ['info', '状态信息'],
    ['keys *', '所有键（大库慎用）'],
  ],
  npm: [
    ['install', '安装依赖'],
    ['run build', '构建'],
    ['run dev', '开发模式'],
  ],
  pm2: [
    ['list', '进程列表'],
    ['logs', '日志'],
    ['restart all', '全部重启'],
  ],
  supervisorctl: [
    ['status', '状态'],
    ['restart all', '全部重启'],
    ['tail -f', '看日志'],
  ],
  'firewall-cmd': [
    ['--list-all', '当前生效规则'],
    ['--reload', '重载配置'],
    ['--add-port=8080/tcp --permanent', '永久放行端口（记得 reload）'],
  ],
}

/** 命令名 → 一句话说明（补全时显示在右侧）。 */
export const COMMON = [
  ['ls', '列目录'],
  ['cd', '切换目录'],
  ['cat', '查看文件'],
  ['tail', '看文件末尾，常用 -f 跟踪日志'],
  ['head', '看文件开头'],
  ['grep', '按内容搜索文本'],
  ['awk', '按列处理文本'],
  ['sed', '流式替换'],
  ['find', '按条件找文件'],
  ['ps', '查看进程'],
  ['top', '实时进程与负载'],
  ['htop', '更好看的 top'],
  ['kill', '结束进程'],
  ['systemctl', '管理 systemd 服务'],
  ['journalctl', '查看 systemd 日志'],
  ['df', '磁盘使用率'],
  ['du', '目录占用统计'],
  ['free', '内存使用'],
  ['tar', '打包解包'],
  ['curl', '发 HTTP 请求'],
  ['wget', '下载文件'],
  ['ssh', '远程登录'],
  ['scp', '远程拷贝'],
  ['rsync', '增量同步'],
  ['lsof', '谁占着文件或端口'],
  ['ss', '套接字与端口'],
  ['ip', '网络地址与路由'],
  ['ping', '连通性测试'],
  ['docker', '容器管理'],
  ['kubectl', 'K8s 集群操作'],
  ['git', '版本控制'],
  ['nginx', 'Nginx 控制'],
  ['mysql', 'MySQL 客户端'],
  ['redis-cli', 'Redis 客户端'],
  ['npm', 'Node 包管理'],
  ['pm2', 'Node 进程守护'],
  ['supervisorctl', 'Supervisor 控制'],
  ['firewall-cmd', '防火墙规则'],
  ['uname', '内核与架构'],
  ['uptime', '运行时长与负载'],
  ['whoami', '当前用户'],
  ['history', '命令历史'],
  ['vim', '编辑文件'],
  ['nano', '简单编辑器'],
  ['less', '分页查看'],
  ['chmod', '改权限'],
  ['chown', '改属主'],
]

const MAX_HINTS = 40

/**
 * 给一行输入算出候选。
 *
 * @param {string} line 已经输入的内容
 * @param {string[]} history 这个连接的历史命令（旧的在前）
 * @param {number} [limit]
 * @returns {{cmd: string, hint?: string, from?: 'history' | 'command' | 'sub' }[]}
 */
export function suggest(line, history = [], limit = 6) {
  const raw = String(line ?? '')
  if (!raw.trim() || limit <= 0) return []
  // 头尾空白不影响匹配，但**追加时的基准**要用去掉左侧空白的那份
  const prefix = raw.replace(/^\s+/, '')
  const out = []
  const seen = new Set([prefix])
  const add = (cmd, hint, from) => {
    if (out.length >= limit || seen.has(cmd)) return
    // 硬规则 1：候选必须是在已输入内容上追加的
    if (!cmd.startsWith(prefix)) return
    seen.add(cmd)
    out.push({ cmd, ...(hint ? { hint } : {}), from })
  }

  // 1. 历史优先：最近用过的排前面
  for (let i = history.length - 1; i >= 0; i--) {
    if (out.length >= limit) break
    add(history[i], undefined, 'history')
  }

  // 2. 已经打了空格：补这个命令自己的动作
  const space = prefix.indexOf(' ')
  if (space > 0) {
    const head = prefix.slice(0, space)
    for (const [sub, hint] of SUBCOMMANDS[head] ?? []) {
      if (out.length >= limit) break
      add(`${head} ${sub}`, hint, 'sub')
    }
    return out
  }

  // 3. 还在打命令名：补常见命令
  for (const [cmd, hint] of COMMON) {
    if (out.length >= limit) break
    add(cmd, hint, 'command')
  }
  return out
}

/**
 * 命令面板的条目：常用且专业的运维命令，按分组。
 * 与上面的 COMMON 是两个用途——那个是"补全速度"，这个是"不知道敲什么时翻一翻"。
 */
export const PALETTE = [
  { group: '系统信息', items: [
    ['uname -a', '内核、架构、主机名'],
    ['cat /etc/os-release', '发行版版本'],
    ['uptime', '运行时长与平均负载'],
    ['hostnamectl', '主机名与虚拟化信息'],
    ['lscpu', 'CPU 型号、核数、缓存'],
    ['free -h', '内存与 Swap'],
  ] },
  { group: 'CPU / 负载', items: [
    ['top -b -n1 | head -20', '一次性看负载最高的进程'],
    ['ps -eo pid,ppid,pcpu,pmem,comm --sort=-pcpu | head -15', '按 CPU 排序的进程表'],
    ['mpstat -P ALL 1 3', '每核使用率（sysstat）'],
    ['pidstat -u 1 3', '每进程 CPU（sysstat）'],
  ] },
  { group: '磁盘 / IO', items: [
    ['df -hT', '挂载点、文件系统与使用率'],
    ['df -i', 'inode 是否用完'],
    ['du -sh * | sort -hr | head -20', '当前目录谁最占空间'],
    ['iostat -dx 1 3', '每块盘的 IO（sysstat）'],
    ['lsblk -f', '块设备与文件系统'],
  ] },
  { group: '网络', items: [
    ['ss -lntp', '监听中的端口与进程'],
    ['ip -br a', '所有网卡地址一览'],
    ['ip route', '路由表'],
    ['curl -sS -I https://example.com', '看响应头（排查连通）'],
    ['dig +short example.com', '解析结果（dig）'],
    ['tcpdump -i any -n port 80 -c 20', '抓 20 个包'],
  ] },
  { group: '进程 / 服务', items: [
    ['systemctl list-units --failed', '失败的单元'],
    ['systemctl status nginx', '某服务状态'],
    ['journalctl -xe -n 100', '最近 100 条错误日志'],
    ['journalctl -u nginx --since "1 hour ago"', '某服务最近一小时'],
    ['ps aux --sort=-%mem | head', '最吃内存的进程'],
  ] },
  { group: '文件 / 文本', items: [
    ['find /var/log -name "*.log" -mtime -1', '一天内改过的日志'],
    ['grep -rn "ERROR" /var/log --include=*.log | tail -50', '最近 50 条报错'],
    ['tail -F /var/log/syslog', '跟踪日志'],
    ['tar -czf backup.tar.gz ./dirname', '打包成 tar.gz'],
    ['du -xhd1 / | sort -hr | head', '根目录一级谁最占'],
  ] },
  { group: 'Docker', items: [
    ['docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"', '容器一览'],
    ['docker logs -f --tail 200 $(docker ps -lq)', '看最新容器的日志'],
    ['docker stats --no-stream', '各容器资源占用'],
    ['docker system df', '镜像/容器/卷占多少磁盘'],
    ['docker compose up -d', '拉起编排'],
  ] },
  { group: '安全 / 审计', items: [
    ['last -n 20', '最近登录记录'],
    ['who', '当前在线用户'],
    ['ss -tnp state established', '已建立的连接'],
    ['sudo grep -i "Failed password" /var/log/auth.log | tail', '登录失败尝试'],
  ] },
]

/**
 * 面板搜索：命令、说明、分组名一起搜；多个词是**收窄**（必须全部命中）。
 *
 * @param {string} query
 * @returns {{group: string, cmd: string, hint: string}[]}
 */
export function searchPalette(query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const rows = []
  for (const group of PALETTE) {
    for (const [cmd, hint] of group.items) {
      const hay = `${cmd} ${hint} ${group.group}`.toLowerCase()
      if (words.length && !words.every((w) => hay.includes(w))) continue
      rows.push({ group: group.group, cmd, hint })
    }
  }
  return rows.slice(0, MAX_HINTS)
}
