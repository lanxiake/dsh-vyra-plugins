/**
 * 传输台账的测试。
 *
 * 盯的是"进度条会不会骗人"这件事：
 *  1. 百分比算得对，且总大小未知时不会算出 NaN/Infinity；
 *  2. 传输一旦结束（成功或失败）就不再接受进度更新；
 *  3. 失败要留住原因——用户过一会儿回来还得知道为什么失败；
 *  4. 状态存在模块里，组件卸载后（相当于切走标签）记录还在。
 */
import assert from 'node:assert/strict'
import {
  transfers, transferPct, transferBusy, startTransfer, progressTransfer,
  finishTransfer, clearFinished, resetTransfers, formatBytes, onTransferChange,
} from '../src/transfer.js'

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

const reset = () => resetTransfers()

test('百分比按已传/总量算，四舍五入', () => {
  const t = startTransfer({ name: 'a.bin', direction: 'up', size: 1000, from: 'a', to: '/a' })
  progressTransfer(t, 250)
  assert.equal(transferPct(t), 25)
  progressTransfer(t, 1000)
  assert.equal(transferPct(t), 100)
  reset()
})

test('总大小未知时不崩，返回 0（界面显示不确定态而不是 NaN%）', () => {
  const t = startTransfer({ name: 'a.bin', direction: 'down', size: 0, from: '/a', to: 'a' })
  progressTransfer(t, 500)
  assert.equal(transferPct(t), 0)
  assert.ok(!Number.isNaN(transferPct(t)))
  reset()
})

test('百分比被夹在 0..100，服务器多报字节也不会画出 120%', () => {
  const t = startTransfer({ name: 'a', direction: 'up', size: 100, from: 'a', to: '/a' })
  progressTransfer(t, 250)
  assert.equal(transferPct(t), 100)
  progressTransfer(t, -50)
  assert.equal(transferPct(t), 0)
  reset()
})

test('成功后记为 done，并把已传补足到总量', () => {
  const t = startTransfer({ name: 'a', direction: 'up', size: 100, from: 'a', to: '/a' })
  progressTransfer(t, 60)
  finishTransfer(t)
  assert.equal(t.state, 'done')
  assert.equal(t.loaded, 100)
  assert.equal(transferPct(t), 100)
  reset()
})

test('失败要留住原因，之后不再接受进度更新', () => {
  const t = startTransfer({ name: 'a', direction: 'up', size: 100, from: 'a', to: '/a' })
  finishTransfer(t, new Error('连接被重置'))
  assert.equal(t.state, 'failed')
  assert.equal(t.error, '连接被重置')
  progressTransfer(t, 90)
  assert.equal(t.loaded, 0, '已经结束的传输不该再动')
  reset()
})

test('结束了的传输再调 finish 不会把它从失败改回成功', () => {
  const t = startTransfer({ name: 'a', direction: 'up', size: 100, from: 'a', to: '/a' })
  finishTransfer(t, new Error('x'))
  finishTransfer(t)
  assert.equal(t.state, 'failed')
  reset()
})

test('transferBusy 只在有进行中的传输时为真', () => {
  const a = startTransfer({ name: 'a', direction: 'up', size: 10, from: 'a', to: '/a' })
  assert.equal(transferBusy(), true)
  finishTransfer(a)
  assert.equal(transferBusy(), false)
  reset()
})

test('记录按最新在前排列', () => {
  const a = startTransfer({ name: 'first', direction: 'up', size: 1, from: 'a', to: '/a' })
  const b = startTransfer({ name: 'second', direction: 'up', size: 1, from: 'b', to: '/b' })
  assert.equal(transfers()[0].name, 'second')
  finishTransfer(a)
  finishTransfer(b)
  reset()
})

test('clearFinished 只清已结束的，进行中的留着', () => {
  const a = startTransfer({ name: 'done-one', direction: 'up', size: 1, from: 'a', to: '/a' })
  finishTransfer(a)
  const b = startTransfer({ name: 'running-one', direction: 'up', size: 1, from: 'b', to: '/b' })
  clearFinished()
  const names = transfers().map((t) => t.name)
  assert.ok(!names.includes('done-one'), '已结束的应被清掉')
  assert.ok(names.includes('running-one'), '进行中的必须保留')
  finishTransfer(b)
  reset()
})

test('状态变化会通知界面重画，取消订阅后不再通知', () => {
  let hits = 0
  onTransferChange(() => hits++)
  const t = startTransfer({ name: 'a', direction: 'up', size: 10, from: 'a', to: '/a' })
  assert.ok(hits > 0, '开始传输就要通知')
  finishTransfer(t)
  const after = hits
  onTransferChange(null)
  startTransfer({ name: 'b', direction: 'up', size: 1, from: 'b', to: '/b' })
  assert.equal(hits, after, '取消订阅后不该再收到通知')
  reset()
})

test('字节格式化覆盖 B / KB / MB / GB', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(2048), '2.0 KB')
  assert.equal(formatBytes(5 * 1048576), '5.0 MB')
  assert.equal(formatBytes(3 * 1073741824), '3.00 GB')
  assert.equal(formatBytes(0), '0 B')
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
