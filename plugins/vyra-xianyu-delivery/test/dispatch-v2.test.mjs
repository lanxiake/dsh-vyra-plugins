import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../lib/db.js'
import { createDispatcher } from '../lib/dispatch.js'
import { createGuard } from '../lib/guard.js'

const setup = ({ links = null, card = null, order = {} } = {}) => {
  const store = createStore(join(mkdtempSync(join(tmpdir(), 'xianyu-d2-')), 'd.sqlite'))
  let sourceId = 0
  if (card) {
    // 生成型卡券必须绑定网盘路径，否则 dispatch 会在触碰 links 之前就判 path_required。
    if (card.mode === 'generate') {
      const src = store.upsertCardSource({ itemId: card.itemId, path: '开源项目资源/产品/wechat/weflow.zip' })
      sourceId = src.id
    }
    store.addCard({ ...card, sourceId })
  }
  const sent = []
  const notes = []
  const confirmed = []
  const cli = {
    soldList: async () => ({
      orders: [{
        order_no: 'O1', item_id: 'I1', buyer_id: 'B1', amount: '1.99', quantity: 1, ...order,
      }],
    }),
    confirm: async (no) => { confirmed.push(no); return { ok: true } },
    send: async (m) => { sent.push(m.text); return { ok: true } },
  }
  const d = createDispatcher({
    store, cli, links, guard: createGuard({ minIntervalMs: 0 }), config: {},
    notify: (kind, payload) => notes.push({ kind, payload }),
  })
  return { store, sent, notes, confirmed, d }
}

test('placeholder generated text is never sent and lands in pending tasks', async () => {
  const links = { obtain: async () => ({ text: '链接：暂无法生成\n提取码：无\n有效期 7 天', share: {} }) }
  const { store, sent, d, confirmed, notes } = setup({
    links, card: { itemId: 'I1', name: 'g', mode: 'generate', content: '' },
  })
  const r = await d.tick()
  assert.equal(sent.length, 0)
  assert.equal(confirmed.length, 0)
  assert.equal(r.results[0].state, 'blocked')
  assert.match(r.results[0].reason, /^invalid_content:/)
  assert.equal(store.listPendingTasks().length, 1)
  assert.equal(notes[0].kind, 'invalid_content')
})

test('link service failure marks blocked and notifies', async () => {
  const links = { obtain: async () => { throw new Error('path_not_found:weflow.zip') } }
  const { sent, d, notes } = setup({ links, card: { itemId: 'I1', name: 'g', mode: 'generate', content: '' } })
  const r = await d.tick()
  assert.equal(sent.length, 0)
  assert.match(r.results[0].reason, /path_not_found/)
  assert.ok(notes.length >= 1)
})

test('a passing generated text is sent once and confirmed', async () => {
  const links = { obtain: async () => ({ text: '链接：https://pan.quark.cn/s/abc12345\n提取码：GT3Q\n有效期 7 天', share: {} }) }
  const { sent, d, confirmed } = setup({ links, card: { itemId: 'I1', name: 'g', mode: 'generate', content: '' } })
  const r = await d.tick()
  assert.equal(sent.length, 1)
  assert.equal(confirmed.length, 1)
  assert.equal(r.results[0].state, 'completed')
})

test('card_exhausted is blocked without sending and is not marked send_failed', async () => {
  const { store, sent, d } = setup({ card: { itemId: 'I1', name: 'p', mode: 'pool', content: '' } })
  const r = await d.tick()
  assert.equal(sent.length, 0)
  assert.equal(r.results[0].reason, 'card_exhausted')
  assert.equal(store.getOrder('O1').state, 'blocked')
})

test('a send failure that consumed a card goes to resend queue', async () => {
  const store = createStore(join(mkdtempSync(join(tmpdir(), 'xianyu-d2b-')), 'd.sqlite'))
  store.addCard({ itemId: 'I1', name: 'p', mode: 'pool', content: '链接：https://pan.quark.cn/s/pool1234\n提取码：AB12\n有效期 7 天' })
  const cli = {
    soldList: async () => ({ orders: [{ order_no: 'O2', item_id: 'I1', buyer_id: 'B1', amount: '1.99', quantity: 1 }] }),
    confirm: async () => ({ ok: true }),
    send: async () => { throw new Error('im closed') },
  }
  const notes = []
  const d = createDispatcher({
    store, cli, guard: createGuard({ minIntervalMs: 0 }), config: {},
    notify: (kind) => notes.push(kind),
  })
  const r = await d.tick()
  assert.equal(r.results[0].state, 'send_failed')
  assert.equal(store.listPendingTasks()[0].kind, 'resend')
  assert.equal(notes[0], 'send_failed')
})

test('reconcile is idempotent across IM push and polling', async () => {
  const { sent, d } = setup({ card: { itemId: 'I1', name: 'r', mode: 'reuse', content: '链接：https://pan.quark.cn/s/keep1234\n提取码：AB12\n有效期 7 天' } })
  const first = await d.reconcile('O1')
  assert.equal(sent.length, 1)
  // 轮询再来一次（同订单），beginOrder 会把它当 duplicate，不会再发。
  await d.tick()
  assert.equal(sent.length, 1)
  assert.ok(first)
})

test('a reuse card with placeholder content is blocked, not sent', async () => {
  const { sent, d } = setup({ card: { itemId: 'I1', name: 'r', mode: 'reuse', content: '链接：待生成\n提取码：待生成' } })
  const r = await d.tick()
  assert.equal(sent.length, 0)
  assert.match(r.results[0].reason, /^invalid_content:/)
})
