/**
 * 资源监控:一次 exec 取回 CPU/内存/磁盘/网络/负载/进程/GPU/NPU。
 * 移植自 liteshell 的 monitor.ts,纯函数,不依赖 ssh2。
 */
export const MONITOR_SCRIPT = [
  'export LC_ALL=C',
  'echo "@@A"', 'head -1 /proc/stat', 'cat /proc/net/dev',
  'echo "@@B"', 'sleep 1', 'head -1 /proc/stat', 'cat /proc/net/dev',
  'echo "@@MEM"', 'cat /proc/meminfo',
  'echo "@@DISK"', 'df -kP 2>/dev/null',
  'echo "@@LOAD"', 'cat /proc/loadavg 2>/dev/null', 'cat /proc/uptime 2>/dev/null',
  'echo "@@PROC"',
  'ps -ww -eo pid=,user=,pcpu=,pmem=,rss=,comm=,args= --sort=-pcpu 2>/dev/null | head -n 10 | while read -r pid user pcpu pmem rss comm args; do',
  '  echo "$pid|$user|$pcpu|$pmem|$rss|$comm|$args"',
  'done',
  'echo "@@INFO"',
  'echo "hostname=$(hostname 2>/dev/null)"',
  'echo "kernel=$(uname -sr 2>/dev/null)"',
  'echo "arch=$(uname -m 2>/dev/null)"',
  'echo "cores=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null)"',
  'echo "cpu=$(grep -m1 model.name /proc/cpuinfo 2>/dev/null | cut -d: -f2-)"',
  'echo "os=$(. /etc/os-release 2>/dev/null; echo $PRETTY_NAME)"',
  'echo "@@GPU"',
  'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null',
  'echo "@@END"',
].join('\n')

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const unquote = (v) => (v ?? '').trim().replace(/^"|"$/g, '')

function parseStat(line) {
  const p = line.trim().split(/\s+/).slice(1).map(Number)
  if (p.length < 4 || p.some(Number.isNaN)) return null
  return { total: p.reduce((a, b) => a + b, 0), idle: p[3] + (p[4] ?? 0) }
}

function parseNet(lines) {
  const out = new Map()
  for (const line of lines) {
    const m = /^\s*([^:]+):\s*(.*)$/.exec(line)
    if (!m) continue
    const c = m[2].trim().split(/\s+/).map(Number)
    if (c.length >= 16) out.set(m[1].trim(), { rx: c[0], tx: c[8] })
  }
  return out
}

function sections(text) {
  const out = {}
  let cur = ''
  for (const line of text.split('\n')) {
    const m = /^@@(\w+)\s*$/.exec(line.trim())
    if (m) { cur = m[1]; out[cur] = []; continue }
    if (cur) out[cur].push(line)
  }
  return out
}

export function parseMonitor(raw, at = Date.now()) {
  const s = sections(raw)
  const snap = {
    at, cpu: 0, cpuCores: 0, load: [0, 0, 0], memTotal: 0, memUsed: 0, swapTotal: 0, swapUsed: 0,
    netDown: 0, netUp: 0, net: [], disk: [], gpu: [], proc: [], uptime: 0,
    info: { hostname: '', os: '', kernel: '', arch: '', cpuModel: '' },
  }
  const a = parseStat(s.A?.[0] ?? '')
  const b = parseStat(s.B?.[0] ?? '')
  if (a && b) {
    const dt = b.total - a.total
    snap.cpu = dt > 0 ? Math.min(100, Math.max(0, ((dt - (b.idle - a.idle)) / dt) * 100)) : 0
  }
  const netLines = (k) => (s[k] ?? []).filter((l) => l.includes(':') && !l.includes('|'))
  const na = parseNet(netLines('A'))
  for (const [name, nb] of parseNet(netLines('B'))) {
    const p = na.get(name)
    if (!p) continue
    const rx = Math.max(0, nb.rx - p.rx)
    const tx = Math.max(0, nb.tx - p.tx)
    snap.net.push({ name, rx, tx })
    if (name !== 'lo') { snap.netDown += rx; snap.netUp += tx }
  }
  const mem = {}
  for (const line of s.MEM ?? []) {
    const m = /^(\w+):\s+(\d+)/.exec(line)
    if (m) mem[m[1]] = Number(m[2]) * 1024
  }
  snap.memTotal = mem.MemTotal ?? 0
  snap.memUsed = snap.memTotal - (mem.MemAvailable ?? mem.MemFree ?? 0)
  snap.swapTotal = mem.SwapTotal ?? 0
  snap.swapUsed = snap.swapTotal - (mem.SwapFree ?? 0)
  for (const line of (s.DISK ?? []).slice(1)) {
    const c = line.trim().split(/\s+/)
    if (c.length < 6) continue
    const [fs, , , , , mount] = c
    if (/^\/(proc|sys|dev)/.test(mount) || ['tmpfs', 'devtmpfs', 'overlay', 'shm'].includes(fs)) continue
    const size = Number(c[1]) * 1024
    const used = Number(c[2]) * 1024
    if (Number.isFinite(size) && size > 0) snap.disk.push({ fs, mount, size, used })
  }
  snap.disk.sort((x, y) => y.used / y.size - x.used / x.size)
  const load = (s.LOAD?.[0] ?? '').trim().split(/\s+/)
  if (load.length >= 3) snap.load = [num(load[0]), num(load[1]), num(load[2])]
  snap.uptime = num((s.LOAD?.[1] ?? '').trim().split(/\s+/)[0])
  const f = {}
  for (const line of s.INFO ?? []) {
    const i = line.indexOf('=')
    if (i > 0) f[line.slice(0, i).trim()] = unquote(line.slice(i + 1))
  }
  snap.cpuCores = num(f.cores)
  snap.info = { hostname: f.hostname ?? '', kernel: f.kernel ?? '', arch: f.arch ?? '', cpuModel: f.cpu ?? '', os: f.os || f.kernel || '' }
  for (const line of s.GPU ?? []) {
    const c = line.split(',').map((x) => x.trim())
    if (c.length >= 5 && /^[\d.]+$/.test(c[1])) {
      snap.gpu.push({ name: c[0], util: num(c[1]), memUsed: num(c[2]) * 1048576, memTotal: num(c[3]) * 1048576, temp: num(c[4]) })
    }
  }
  for (const line of s.PROC ?? []) {
    const [pid, user, pcpu, pmem, rss, comm, ...rest] = line.split('|')
    if (!/^\d+$/.test((pid ?? '').trim())) continue
    snap.proc.push({ pid: Number(pid), user: (user ?? '').trim() || '?', cpu: num(pcpu), mem: num(pmem), rss: num(rss) * 1024, name: (comm ?? '').trim(), cmd: rest.join('|').trim() })
  }
  return snap
}
