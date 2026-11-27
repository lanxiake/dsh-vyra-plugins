/**
 * 资源监控：一次 exec 取回 CPU / 内存 / 磁盘 / 网络 / 负载 / 进程 / GPU / NPU。
 *
 * 移植自 liteshell 的 monitor.ts（同一条脚本、同一套解析规则），纯函数，不依赖 ssh2：
 * 路由层把远端输出交给 parseMonitor，界面把结果画出来。
 *
 * 一次往返取完所有东西。中间那句 `sleep 1` 是 CPU% 和网速能当"速率"用的唯一原因——
 * 两次 /proc/stat 与 /proc/net/dev 的差才是这一秒的实际情况，而不是开机以来的平均。
 */

/**
 * 远端脚本。所有读取都是只读的，也不需要 sudo。
 *
 * 分节标记是 `@@名字` 独占一行：解析器只认这个，不认行号，所以缺工具（没有 GPU、
 * 没有 npu-smi）时对应的节就是空的，不会把后面的内容错位读进来。
 */
export const MONITOR_SCRIPT = [
  'export LC_ALL=C',
  'echo "@@A"',
  'head -1 /proc/stat',
  'cat /proc/net/dev',
  'cat /proc/diskstats 2>/dev/null',
  'echo "@@B"',
  'sleep 1',
  'head -1 /proc/stat',
  'cat /proc/net/dev',
  'cat /proc/diskstats 2>/dev/null',
  'echo "@@MEM"',
  'cat /proc/meminfo',
  'echo "@@DISK"',
  'df -kP 2>/dev/null',
  'echo "@@LOAD"',
  'cat /proc/loadavg 2>/dev/null',
  'cat /proc/uptime 2>/dev/null',
  'echo "@@PROC"',
  // 按 CPU 倒序取最忙的十个：这张表是用来找"谁在吃这台机器"的，不是完整列表。
  // `|` 是字段分隔符，命令行放最后，所以它里面出现什么都无所谓。
  'ps -ww -eo pid=,user=,pcpu=,pmem=,rss=,comm=,args= --sort=-pcpu 2>/dev/null | head -n 10 | while read -r pid user pcpu pmem rss comm args; do',
  '  rd=0; wr=0',
  '  while read -r k v; do case "$k" in read_bytes:) rd=$v;; write_bytes:) wr=$v;; esac; done < /proc/$pid/io 2>/dev/null',
  '  exe=$(readlink /proc/$pid/exe 2>/dev/null)',
  '  echo "$pid|$user|$pcpu|$pmem|$rss|$rd|$wr|$comm|$exe|$args"',
  'done',
  'echo "@@INFO"',
  // 每行都带标签，解析器就不依赖 `nproc` 存不存在，也不依赖行序。
  'echo "hostname=$(hostname 2>/dev/null)"',
  'echo "kernel=$(uname -sr 2>/dev/null)"',
  'echo "arch=$(uname -m 2>/dev/null)"',
  'echo "cores=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null)"',
  'echo "cpu=$(grep -m1 model.name /proc/cpuinfo 2>/dev/null | cut -d: -f2-)"',
  'echo "os=$(. /etc/os-release 2>/dev/null && echo \\"$PRETTY_NAME\\")"',
  'echo "@@GPU"',
  'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null',
  'echo "@@NPU"',
  // 昇腾那套（npu-smi 装在 /usr/local/sbin）。绝大多数机器上没有；不带 -i 的一次调用
  // 就能把全部卡读回来（约 0.6 秒）。
  'command -v npu-smi >/dev/null 2>&1 && npu-smi info 2>/dev/null',
  'echo "@@END"',
].join('\n')

const unquote = (value) => (value ?? '').trim().replace(/^"|"$/g, '')
const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** `cpu  user nice system idle iowait irq softirq steal guest guest_nice` */
function parseStat(line) {
  const parts = line.trim().split(/\s+/).slice(1).map(Number)
  if (parts.length < 4 || parts.some(Number.isNaN)) return null
  const total = parts.reduce((a, b) => a + b, 0)
  // idle 和 iowait 都算这一核没在干活。
  return { total, idle: parts[3] + (parts[4] ?? 0) }
}

/** 交错格式 `iface: rx... tx...` → 每个网卡的收发字节数 */
function parseNet(lines) {
  const out = new Map()
  for (const line of lines) {
    const m = /^\s*([^:]+):\s*(.*)$/.exec(line)
    if (!m) continue
    const cols = m[2].trim().split(/\s+/).map(Number)
    if (cols.length < 16) continue
    out.set(m[1].trim(), { rx: cols[0], tx: cols[8] })
  }
  return out
}

/**
 * `df` 的来源列 → 块设备名。`/dev/sda1` → `sda1`，`/dev/mapper/vg-root` 这种映射
 * 名在 diskstats 里没有对应行，就返回空串（面板上那一行的 I/O 显示为 0）。
 */
function deviceOf(source) {
  const m = /^\/dev\/(.+)$/.exec(String(source ?? ''))
  return m ? m[1] : ''
}

/**
 * `/proc/diskstats` → 每个块设备的读写扇区数。
 *
 * 固定列：`major minor name reads_completed reads_merged sectors_read ms_reading
 * writes_completed writes_merged sectors_written ...`。第 6 列是读扇区，第 10 列是
 * 写扇区（1-based），扇区一律按 512 字节算——内核这个接口从 Linux 2.6 起就是 512，
 * 与磁盘自己的物理扇区大小无关。
 *
 * 只留整盘设备（sda / vda / nvme0n1 / mmcblk0），分区（sda1、nvme0n1p2）单独计数会
 * 和整盘的数重复，加起来变成两倍。
 */
function parseDiskstats(lines) {
  const out = new Map()
  for (const line of lines ?? []) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 10) continue
    const name = cols[2]
    // 只要整盘，不要分区：分区和整盘统计的是同一批 I/O，两边都算会翻倍。
    //   整盘：sda / vda / xvda / hda / mmcblk0 / nvme0n1
    //   分区：sda1 / vda2 / mmcblk0p1 / nvme0n1p2
    const whole = /^(?:[shvx]d[a-z]+|mmcblk\d+|nvme\d+n\d+)$/.test(name)
    if (!whole) continue
    out.set(name, { readSectors: num(cols[5]), writeSectors: num(cols[9]) })
  }
  return out
}

function splitSections(text) {
  const out = {}
  let current = ''
  for (const line of String(text ?? '').split('\n')) {
    const marker = /^@@(\w+)\s*$/.exec(line.trim())
    if (marker) {
      current = marker[1]
      out[current] = []
      continue
    }
    if (current) out[current].push(line)
  }
  return out
}

/**
 * `npu-smi info` 每张卡打一个框、两行：
 *
 *   | 2     910ProB             | OK            | 99.3        81                0    / 0             |
 *   | 0                         | 0000:01:00.0  | 0           2370 / 15034      0    / 32768         |
 *
 * 卡那一行带 id/型号/健康/功率/温度，下面的芯片行带 AI Core%、DDR 和 HBM。卡号不是
 * 行号（有的机器上是 2 和 5），所以从表格里读，不按顺序数。
 */
function parseNpu(lines) {
  const out = []
  let pending = null
  for (const line of lines ?? []) {
    // 只要设备表；下面的进程表是另一种排版。
    if (/Process id/i.test(line)) break
    if (pending) {
      const chip = /^\|.*\|\s*([0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.\d)\s*\|\s*([\d.]+)\s+(\d+)\s*\/\s*(\d+)\s+(\d+)\s*\/\s*(\d+)/i.exec(line)
      if (chip) {
        pending.util = num(chip[2])
        pending.ddrUsed = num(chip[3]) * 1024 * 1024
        pending.ddrTotal = num(chip[4]) * 1024 * 1024
        pending.hbmUsed = num(chip[5]) * 1024 * 1024
        pending.hbmTotal = num(chip[6]) * 1024 * 1024
        out.push(pending)
      }
      pending = null
      continue
    }
    const card = /^\|\s*(\d+)\s+(\S+)\s*\|\s*([A-Za-z]+)\s*\|\s*([\d.]+)\s+(\d+)\s+\d+\s*\/\s*\d+/.exec(line)
    if (!card) continue
    pending = {
      id: Number(card[1]),
      name: card[2],
      health: card[3],
      power: num(card[4]),
      temp: num(card[5]),
      util: 0,
      ddrUsed: 0,
      ddrTotal: 0,
      hbmUsed: 0,
      hbmTotal: 0,
    }
  }
  return out
}

/**
 * 解析 MONITOR_SCRIPT 的输出。
 *
 * 每次都重新建每一条数组——浅拷贝 EMPTY 会让两次刷新共用同一个 list，上一轮的
 * 进程行会漏进下一轮。
 *
 * @param {string} raw 远端脚本的 stdout
 * @param {number} [at] 采样时间（毫秒）
 */
export function parseMonitor(raw, at = Date.now()) {
  const sections = splitSections(raw)
  /** @type {any} */
  const snapshot = {
    at,
    cpu: 0,
    cpuCores: 0,
    load: [0, 0, 0],
    memTotal: 0,
    memUsed: 0,
    swapTotal: 0,
    swapUsed: 0,
    netDown: 0,
    netUp: 0,
    net: [],
    netTotals: [],
    disk: [],
    diskIo: [],
    diskRead: 0,
    diskWrite: 0,
    gpu: [],
    npu: [],
    proc: [],
    uptime: 0,
    info: { hostname: '', os: '', kernel: '', arch: '', cpuModel: '' },
  }

  /* --- CPU：相隔一秒的两次采样 --- */
  const cpuA = parseStat(sections.A?.[0] ?? '')
  const cpuB = parseStat(sections.B?.[0] ?? '')
  if (cpuA && cpuB) {
    const dTotal = cpuB.total - cpuA.total
    const dIdle = cpuB.idle - cpuA.idle
    snapshot.cpu = dTotal > 0 ? Math.min(100, Math.max(0, ((dTotal - dIdle) / dTotal) * 100)) : 0
  }

  /* --- 网络：同样那两次采样 --- */
  // 两行 `Inter-|` / ` face |` 表头没有冒号，会在这里被自然滤掉。
  const netLines = (section) => (sections[section] ?? []).filter((l) => l.includes(':') && !l.includes('|'))
  const netA = parseNet(netLines('A'))
  const netB = parseNet(netLines('B'))
  // 脚本在两次采样之间正好睡了一秒，所以字节差就是字节/秒。
  for (const [name, b] of netB) {
    const a = netA.get(name)
    if (!a) continue
    const rx = Math.max(0, b.rx - a.rx)
    const tx = Math.max(0, b.tx - a.tx)
    snapshot.net.push({ name, rx, tx })
    if (name === 'lo') continue // 回环会把本机流量算两遍
    snapshot.netDown += rx
    snapshot.netUp += tx
  }
  // 同一份采样，换个读法：开机以来累计走了多少，重启会归零。
  if (netB.size) {
    const totals = []
    for (const [name, b] of netB) {
      if (name === 'lo') continue
      totals.push({ name, rxBytes: b.rx, txBytes: b.tx })
    }
    snapshot.netTotals = totals.sort((x, y) => y.rxBytes + y.txBytes - (x.rxBytes + x.txBytes))
  }

  /* --- 内存 --- */
  const mem = {}
  for (const line of sections.MEM ?? []) {
    const m = /^(\w+):\s+(\d+)/.exec(line)
    if (m) mem[m[1]] = Number(m[2]) * 1024
  }
  snapshot.memTotal = mem.MemTotal ?? 0
  // MemAvailable 才是 `free` 说的可用；老内核没有就退回 MemFree。
  snapshot.memUsed = snapshot.memTotal - (mem.MemAvailable ?? mem.MemFree ?? 0)
  snapshot.swapTotal = mem.SwapTotal ?? 0
  snapshot.swapUsed = snapshot.swapTotal - (mem.SwapFree ?? 0)

  /* --- 磁盘：滤掉伪文件系统，它们只是噪音 --- */
  for (const line of (sections.DISK ?? []).slice(1)) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 6) continue
    const fs = cols[0]
    const mount = cols[5]
    if (mount.startsWith('/proc') || mount.startsWith('/sys') || mount.startsWith('/dev')) continue
    if (fs === 'tmpfs' || fs === 'devtmpfs' || fs === 'overlay' || fs === 'shm') continue
    const size = Number(cols[1]) * 1024
    const used = Number(cols[2]) * 1024
    if (!Number.isFinite(size) || size === 0) continue
    // df 只给了挂载点，没给设备名；把 `/dev/sda1` 这种来源记下来，好和 diskstats 对上。
    snapshot.disk.push({ fs, mount, size, used, device: deviceOf(fs) })
  }
  snapshot.disk.sort((a, b) => b.used / b.size - a.used / b.size)

  /* --- 磁盘 I/O：和 CPU/网络同一套两次采样的差 --- */
  const diskA = parseDiskstats(sections.A ?? [])
  const diskB = parseDiskstats(sections.B ?? [])
  // 脚本在两次采样之间睡了一秒，扇区差 × 512 就是这一秒的字节/秒。
  for (const [name, b] of diskB) {
    const a = diskA.get(name)
    if (!a) continue
    const readBytes = Math.max(0, b.readSectors - a.readSectors) * 512
    const writeBytes = Math.max(0, b.writeSectors - a.writeSectors) * 512
    snapshot.diskIo.push({ name, read: readBytes, write: writeBytes })
    snapshot.diskRead += readBytes
    snapshot.diskWrite += writeBytes
  }
  // 挂到某个分区上的那一行也带上自己的速率；对不上的（LVM、overlay、网络盘）就是 0。
  for (const d of snapshot.disk) {
    const base = d.device?.replace(/\d+$/, '') ?? ''
    const io = snapshot.diskIo.find((x) => x.name === d.device || x.name === base)
    d.read = io?.read ?? 0
    d.write = io?.write ?? 0
  }

  /* --- 负载 + 运行时长 --- */
  const load = (sections.LOAD?.[0] ?? '').trim().split(/\s+/)
  if (load.length >= 3) snapshot.load = [num(load[0]), num(load[1]), num(load[2])]
  snapshot.uptime = num((sections.LOAD?.[1] ?? '').trim().split(/\s+/)[0])

  /* --- 主机信息：key=value 行，所以行序和缺工具都不影响 --- */
  const fields = {}
  for (const line of sections.INFO ?? []) {
    const eq = line.indexOf('=')
    if (eq < 0) continue
    fields[line.slice(0, eq).trim()] = unquote(line.slice(eq + 1))
  }
  snapshot.cpuCores = num(fields.cores)
  snapshot.info = {
    hostname: fields.hostname ?? '',
    kernel: fields.kernel ?? '',
    arch: fields.arch ?? '',
    cpuModel: fields.cpu ?? '',
    os: fields.os || fields.kernel || '',
  }

  /* --- GPU：一张卡一行；没有 nvidia-smi 时这一节是空的 --- */
  for (const line of sections.GPU ?? []) {
    const cols = line.split(',').map((c) => c.trim())
    if (cols.length < 5 || !/^[\d.]+$/.test(cols[1])) continue
    snapshot.gpu.push({
      name: cols[0],
      util: num(cols[1]),
      memUsed: num(cols[2]) * 1024 * 1024,
      memTotal: num(cols[3]) * 1024 * 1024,
      temp: num(cols[4]),
    })
  }

  /* --- NPU：同样的表格形状，逐字段读；没有 npu-smi 时为空 --- */
  snapshot.npu = parseNpu(sections.NPU ?? [])

  /* --- 进程：`pid|user|cpu|mem|rss|read|write|comm|exe|args` ---
     别人的进程在没有 CAP_SYS_PTRACE 时 exe 是空的，那时命令行就是诚实的退路。 */
  for (const line of sections.PROC ?? []) {
    const [pid, user, pcpu, pmem, rss, rd, wr, comm, exe, ...rest] = line.split('|')
    if (!/^\d+$/.test((pid ?? '').trim())) continue
    const args = rest.join('|').trim()
    snapshot.proc.push({
      pid: Number(pid),
      user: (user ?? '').trim() || '?',
      cpu: num(pcpu),
      mem: num(pmem),
      rss: num(rss) * 1024,
      diskRead: num(rd) * 1024,
      diskWrite: num(wr) * 1024,
      name: (comm ?? '').trim() || args.split(/\s+/)[0] || `pid ${pid}`,
      cmd: args || (comm ?? '').trim(),
      path: (exe ?? '').trim() || undefined,
    })
  }

  return snapshot
}
