/**
 * 监控解析器的测试。喂的是照 MONITOR_SCRIPT 的真实输出形状手写的样本，
 * 覆盖几件容易错的事：速率是两次采样之差而不是开机平均、回环不计入总量、
 * tmpfs 被滤掉、读不到 exe 的进程退回命令行、缺工具时对应节为空。
 */
import assert from 'node:assert/strict'
import { parseMonitor, MONITOR_SCRIPT } from '../monitor.js'

const results = []
const test = (name, fn) => {
  try {
    fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    results.push(`✗ ${name}\n  ${e instanceof Error ? e.stack : e}`)
    process.exitCode = 1
  }
}

// CPU：第一次 100% 忙 → 第二次多了 100 tick，其中 50 空闲，所以这一秒用掉 50%。
const HEALTHY = `@@A
cpu  1000 0 1000 8000 0 0 0 0 0 0
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 5000       50    0    0    0     0          0         0     5000       50    0    0    0     0       0          0
  eth0: 10000     100    0    0    0     0          0         0     20000     200    0    0    0     0       0          0
@@B
cpu  1050 0 1050 8050 0 0 0 0 0 0
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 9000       90    0    0    0     0          0         0     9000       90    0    0    0     0       0          0
  eth0: 11024     110    0    0    0     0          0         0     20480     210    0    0    0     0       0          0
@@MEM
MemTotal:       16000000 kB
MemFree:         2000000 kB
MemAvailable:    4000000 kB
SwapTotal:       2000000 kB
SwapFree:        1500000 kB
@@DISK
Filesystem     1024-blocks     Used Available Capacity Mounted on
/dev/sda1        104857600 52428800  52428800      50% /
tmpfs              8000000        0   8000000       0% /dev/shm
overlay          104857600 10485760  94371840      10% /
/dev/sdb1        209715200 188743680  20971520      90% /data
tmpfs               100000        0    100000       0% /run/user/0
@@LOAD
0.52 0.41 0.38 2/345 12345
123456.78 987654.32
@@PROC
1234|root|42.5|3.1|524288|1048576|524288|java|/usr/lib/jvm/bin/java|java -Xmx2g -jar app.jar
5678|www-data|12.0|1.2|262144|0|4096|nginx||nginx: worker process
@@INFO
hostname=web-01
kernel=Linux 6.1.0-13-amd64
arch=x86_64
cores=8
cpu= AMD EPYC 7R13 Processor
os=Debian GNU/Linux 12 (bookworm)
@@GPU
NVIDIA A100-SXM4-40GB, 87, 20000, 40960, 72
@@NPU
+------------------------------------------------------------------------------------------------+
| npu-smi 23.0.3                   Version: 23.0.3                                               |
+-------------------+-----------------+----------------------------------------------------------+
| NPU     Name      | Health          | Power(W)     Temp(C)           Hugepages-Usage(page)     |
| Chip    Device    | Bus-Id          | AICore(%)    Memory-Usage(MB)                            |
+===================+=================+==========================================================+
| 2       910ProB   | OK            | 99.3        81                0    / 0                   |
| 0                 | 0000:01:00.0  | 0           2370 / 15034      0    / 32768                |
+===================+=================+==========================================================+
| 5       910ProB   | OK            | 88.1        74                0    / 0                   |
| 0                 | 0000:02:00.0  | 71          5120 / 15034      0    / 32768                |
+===================+=================+==========================================================+
| Process id  Process name        Process memory(MB)      AICore usage rate(%)                 |
@@END`

test('CPU 是两次采样之差，不是开机以来的平均', () => {
  const s = parseMonitor(HEALTHY)
  // dTotal = (1050+1050+8050) - (1000+1000+8000) = 150；dIdle = 50；忙 100/150 = 66.7%
  assert.ok(Math.abs(s.cpu - 66.666) < 0.1, `cpu=${s.cpu}`)
})

test('网速按一秒内的差算，回环不计入总量', () => {
  const s = parseMonitor(HEALTHY)
  const eth = s.net.find((n) => n.name === 'eth0')
  assert.deepEqual(eth, { name: 'eth0', rx: 1024, tx: 480 })
  assert.equal(s.netDown, 1024, 'lo 的 4000 字节不能进总量')
  assert.equal(s.netUp, 480)
})

test('累计流量是计数而不是差，按总量排序', () => {
  const s = parseMonitor(HEALTHY)
  assert.equal(s.netTotals.length, 1, 'lo 不进累计')
  assert.deepEqual(s.netTotals[0], { name: 'eth0', rxBytes: 11024, txBytes: 20480 })
})

test('内存用 MemAvailable 算已用，Swap 单独算', () => {
  const s = parseMonitor(HEALTHY)
  assert.equal(s.memTotal, 16000000 * 1024)
  assert.equal(s.memUsed, (16000000 - 4000000) * 1024)
  assert.equal(s.swapTotal, 2000000 * 1024)
  assert.equal(s.swapUsed, 500000 * 1024)
})

test('磁盘滤掉 tmpfs / overlay，按使用率倒序', () => {
  const s = parseMonitor(HEALTHY)
  assert.deepEqual(s.disk.map((d) => d.mount), ['/data', '/'])
  assert.equal(s.disk[0].used / s.disk[0].size, 0.9)
})

test('负载、运行时长、主机信息', () => {
  const s = parseMonitor(HEALTHY)
  assert.deepEqual(s.load, [0.52, 0.41, 0.38])
  assert.equal(s.uptime, 123456.78)
  assert.equal(s.cpuCores, 8)
  assert.equal(s.info.hostname, 'web-01')
  assert.equal(s.info.cpuModel, 'AMD EPYC 7R13 Processor')
})

test('进程表带磁盘读写；读不到 exe 时 path 为空而不留坑', () => {
  const s = parseMonitor(HEALTHY)
  const java = s.proc[0]
  assert.equal(java.pid, 1234)
  assert.equal(java.cpu, 42.5)
  assert.equal(java.diskRead, 1048576 * 1024)
  assert.equal(java.diskWrite, 524288 * 1024)
  assert.equal(java.path, '/usr/lib/jvm/bin/java')
  const nginx = s.proc[1]
  assert.equal(nginx.path, undefined, '读不到 exe 就不给 path')
  assert.equal(nginx.cmd, 'nginx: worker process', '退回命令行')
})

test('GPU 一张卡一行', () => {
  const s = parseMonitor(HEALTHY)
  assert.equal(s.gpu.length, 1)
  assert.equal(s.gpu[0].util, 87)
  assert.equal(s.gpu[0].memTotal, 40960 * 1024 * 1024)
  assert.equal(s.gpu[0].temp, 72)
})

test('NPU 卡号从表格里读，不按行号数；进程表之前就停', () => {
  const s = parseMonitor(HEALTHY)
  assert.equal(s.npu.length, 2, '进程表那一行不能当成第三张卡')
  assert.deepEqual(s.npu.map((n) => n.id), [2, 5], '卡号是 2 和 5，不是 1 和 2')
  assert.equal(s.npu[0].temp, 81)
  assert.equal(s.npu[1].util, 71)
  assert.equal(s.npu[1].ddrTotal, 15034 * 1024 * 1024)
})

test('缺工具的机器：GPU / NPU 节为空，其他照常', () => {
  const bare = MONITOR_SCRIPT && HEALTHY.replace(/@@GPU\n[\s\S]*@@END/, '@@END')
  const s = parseMonitor(bare)
  assert.deepEqual(s.gpu, [])
  assert.deepEqual(s.npu, [])
  assert.ok(s.cpu > 0, '缺工具不影响前面的节')
})

test('完全没有输出时给出空快照而不是抛错', () => {
  const s = parseMonitor('')
  assert.equal(s.cpu, 0)
  assert.deepEqual(s.proc, [])
  assert.deepEqual(s.disk, [])
})

test('两次解析不共享数组（上一轮的进程行不会漏进下一轮）', () => {
  const a = parseMonitor(HEALTHY)
  const b = parseMonitor('@@END')
  assert.equal(a.proc.length, 2)
  assert.equal(b.proc.length, 0)
})

test('脚本本身带上 NPU 与进程 IO', () => {
  assert.match(MONITOR_SCRIPT, /@@NPU/)
  assert.match(MONITOR_SCRIPT, /read_bytes/)
  assert.match(MONITOR_SCRIPT, /readlink \/proc\/\$pid\/exe/)
  assert.ok(MONITOR_SCRIPT.indexOf('sleep 1') < MONITOR_SCRIPT.indexOf('@@MEM'))
})

// 磁盘 I/O：两列扇区在一秒里的差 × 512；分区不重复计数，否则总量翻倍。
const DISKIO = `@@A
cpu  100 0 100 800 0 0 0 0 0 0
    lo: 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0
  eth0: 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0
   8       0 sda 100 0 2048 0 50 0 1024 0 0 0 0
   8       1 sda1 100 0 2048 0 50 0 1024 0 0 0 0
 259       0 nvme0n1 500 0 40960 0 300 0 20480 0 0 0 0
 259       1 nvme0n1p1 500 0 40960 0 300 0 20480 0 0 0 0
   7       0 loop0 9 0 72 0 0 0 0 0 0 0 0
@@B
cpu  150 0 150 800 0 0 0 0 0 0
    lo: 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0
  eth0: 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0
   8       0 sda 110 0 4096 0 60 0 2048 0 0 0 0
   8       1 sda1 110 0 4096 0 60 0 2048 0 0 0 0
 259       0 nvme0n1 520 0 61440 0 340 0 40960 0 0 0 0
 259       1 nvme0n1p1 520 0 61440 0 340 0 40960 0 0 0 0
   7       0 loop0 9 0 72 0 0 0 0 0 0 0 0
@@END`

test('磁盘 I/O：扇区差 × 512，整盘计入、分区不重复计数', () => {
  const s = parseMonitor(DISKIO)
  // sda: 读 4096-2048=2048 扇区=1048576 B；写 2048-1024=1024 扇区=524288 B
  const sda = s.diskIo.find((d) => d.name === 'sda')
  assert.equal(sda.read, 1048576)
  assert.equal(sda.write, 524288)
  // nvme：读 20480 扇区 = 10485760 B；写 20480 扇区 = 10485760 B
  const nvme = s.diskIo.find((d) => d.name === 'nvme0n1')
  assert.equal(nvme.read, 10485760)
  assert.equal(nvme.write, 10485760)
  // 分区和 loop 设备都不能出现，否则总量会翻倍 / 掺进噪音
  assert.equal(s.diskIo.some((d) => /sda1|nvme0n1p1|loop0/.test(d.name)), false)
  assert.equal(s.diskRead, 1048576 + 10485760)
  assert.equal(s.diskWrite, 524288 + 10485760)
})

test('脚本在两段采样里都取 /proc/diskstats', () => {
  const marks = [...MONITOR_SCRIPT.matchAll(/cat \/proc\/diskstats/g)]
  assert.equal(marks.length, 2, '两次采样各要一次，否则算不出速率')
  assert.ok(MONITOR_SCRIPT.indexOf('@@A') < MONITOR_SCRIPT.indexOf('cat /proc/diskstats'))
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
