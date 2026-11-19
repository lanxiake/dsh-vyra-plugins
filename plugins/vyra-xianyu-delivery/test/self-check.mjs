// 最小自检：幂等、卡密不重复消费、卡密耗尽、敏感词、退款、多数量、多规格、模板、多条消息、熔断。
// 跑法：node plugins/vyra-xianyu-delivery/test/self-check.mjs
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../lib/db.js'
import { createDispatcher } from '../lib/dispatch.js'
import { createGuard } from '../lib/guard.js'

const dir = mkdtempSync(join(tmpdir(), 'xianyu-delivery-'))
const file = join(dir, 'data.sqlite')

function makeCli(orders, { failSend = false, failConfirm = false } = {}) {
  const calls = []
  return {
    calls,
    soldList: async () => ({ orders }),
    confirm: async (orderNo) => {
      calls.push(['confirm', orderNo])
      if (failConfirm) throw new Error('confirm boom')
      return { ok: true }
    },
    send: async (msg) => {
      calls.push(['send', msg.text])
      if (failSend) throw new Error('send boom')
      return { ok: true }
    },
  }
}

try {
  const store = createStore(file)

  // ---- 基础：幂等 + 按序消费 ----
  store.addCard({ itemId: 'item-1', name: '卡密', content: 'CARD-A\n---\nCARD-B' })
  const cli1 = makeCli([{ order_no: 'O1', item_id: 'item-1', buyer_id: 'B1', amount: '9.90', quantity: 1 }])
  const d1 = createDispatcher({ store, cli: cli1, guard: createGuard({ minIntervalMs: 0 }), config: {} })

  await d1.tick()
  assert.deepEqual(cli1.calls.filter(([k]) => k === 'send').map(([, t]) => t), ['CARD-A'])
  assert.equal(store.getOrder('O1').state, 'completed')

  await d1.tick()
  assert.equal(cli1.calls.filter(([k]) => k === 'send').length, 1, '重复 tick 不得重复发货')

  // ---- 多数量：qty=3 消费 3 条，一个订单一条完成 ----
  store.addCard({ itemId: 'item-q', name: '批量', content: 'Q1\n---\nQ2\n---\nQ3' })
  const cli2 = makeCli([{ order_no: 'O2', item_id: 'item-q', buyer_id: 'B2', amount: '9.90', quantity: 3 }])
  const d2 = createDispatcher({ store, cli: cli2, guard: createGuard({ minIntervalMs: 0 }), config: {} })
  await d2.tick()
  assert.deepEqual(cli2.calls.filter(([k]) => k === 'send').map(([, t]) => t), ['Q1', 'Q2', 'Q3'])
  assert.equal(store.getOrder('O2').delivered, 3)
  assert.equal(store.getOrder('O2').state, 'completed')

  // ---- 部分发货：qty=2，只剩 1 张 ----
  store.addCard({ itemId: 'item-p', name: '残', content: 'P1' })
  const cli3 = makeCli([{ order_no: 'O3', item_id: 'item-p', buyer_id: 'B3', amount: '9.90', quantity: 2 }])
  const d3 = createDispatcher({ store, cli: cli3, guard: createGuard({ minIntervalMs: 0 }), config: {} })
  await d3.tick()
  assert.equal(store.getOrder('O3').state, 'partial')
  assert.equal(store.getOrder('O3').delivered, 1)
  assert.equal(store.getOrder('O3').fail_reason, 'card_exhausted')

  // ---- 多规格：精确优先，月卡退回通用 ----
  store.addCard({ itemId: 'item-s', specName: '规格', specValue: '年卡', name: '年卡', content: 'Y1' })
  store.addCard({ itemId: 'item-s', name: '通用', content: 'D1' })
  const cli4 = makeCli([
    { order_no: 'O4', item_id: 'item-s', spec_name: '规格', spec_value: '年卡', buyer_id: 'B4', amount: '9.90', quantity: 1 },
    { order_no: 'O5', item_id: 'item-s', spec_name: '规格', spec_value: '月卡', buyer_id: 'B5', amount: '9.90', quantity: 1 },
  ])
  const d4 = createDispatcher({ store, cli: cli4, guard: createGuard({ minIntervalMs: 0 }), config: {} })
  await d4.tick()
  assert.deepEqual(cli4.calls.filter(([k]) => k === 'send').map(([, t]) => t), ['Y1', 'D1'])

  // ---- 模板 + 多条消息（###### 拆分）----
  store.addCard({
    itemId: 'item-t', name: '模板',
    content: 'T1',
    template: '订单 {order_no} 的卡密：{card}######请及时保存，有效期 7 天',
  })
  const cli5 = makeCli([{ order_no: 'O6', item_id: 'item-t', buyer_id: 'B6', amount: '9.90', quantity: 1 }])
  const d5 = createDispatcher({ store, cli: cli5, guard: createGuard({ minIntervalMs: 0 }), config: {} })
  await d5.tick()
  const sends = cli5.calls.filter(([k]) => k === 'send').map(([, t]) => t)
  assert.equal(sends.length, 2, '###### 应拆成两条消息')
  assert.match(sends[0], /订单 O6 的卡密：T1/)
  assert.match(sends[1], /有效期/)

  // ---- 敏感词：不发、不消费 ----
  store.addCard({ itemId: 'item-x', name: '违规', content: '加微信领取' })
  const cli6 = makeCli([{ order_no: 'O7', item_id: 'item-x', buyer_id: 'B7', amount: '9.90', quantity: 1 }])
  const d6 = createDispatcher({ store, cli: cli6, guard: createGuard({ minIntervalMs: 0 }), config: {} })
  await d6.tick()
  assert.match(store.getOrder('O7').fail_reason, /^sensitive:/)
  assert.equal(cli6.calls.filter(([k]) => k === 'send').length, 0)

  // ---- 退款订单跳过 ----
  const cli7 = makeCli([{ order_no: 'O8', item_id: 'item-1', buyer_id: 'B8', amount: '9.90', in_refund: true }])
  const d7 = createDispatcher({ store, cli: cli7, guard: createGuard({ minIntervalMs: 0 }), config: {} })
  await d7.tick()
  assert.equal(store.getOrder('O8'), null)

  // ---- 熔断：连续 3 次发送失败后暂停 ----
  store.addCard({ itemId: 'item-f', name: '失败', content: 'F1\n---\nF2\n---\nF3\n---\nF4' })
  const guard8 = createGuard({ minIntervalMs: 0, failureThreshold: 3 })
  const cliF = makeCli([], { failSend: true })
  const dF = createDispatcher({ store, cli: cliF, guard: guard8, config: {} })
  for (let i = 1; i <= 3; i += 1) {
    cliF.soldList = async () => ({ orders: [{ order_no: `F${i}`, item_id: 'item-f', buyer_id: `BF${i}`, amount: '9.90', quantity: 1 }] })
    await dF.tick()
  }
  assert.equal(guard8.isPaused(), true, '连续失败 3 次应熔断')
  const paused = await dF.tick()
  assert.deepEqual(paused, { paused: true })

  console.log('self-check ok')
  store.db.close()
} finally {
  // Windows 上 SQLite 的 WAL 句柄可能还没释放；清理失败不影响测试结果。
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  } catch {
    // ignore
  }
}