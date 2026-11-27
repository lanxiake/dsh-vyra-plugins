import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../lib/db.js'
import { createNotifier } from '../lib/notify.js'

const mk = (sendImpl) => {
  const store = createStore(join(mkdtempSync(join(tmpdir(), 'xianyu-ntf-')), 'd.sqlite'))
  store.addChannel({ botId: 'B', targetId: 'T', channel: 'weixin', label: '我' })
  const sent = []
  let clock = 1_000_000
  const notifier = createNotifier({
    store,
    getDshIm: () => ({
      send: sendImpl ?? (async (b, t, text) => { sent.push(text); return { sent: true } }),
    }),
    logger: () => {},
    now: () => clock,
    // 测试里手动推进时钟
    ...(globalThis.__clock ? { now: () => globalThis.__clock } : {}),
  })
  return { store, sent, notifier, tick: (ms) => { clock += ms }, setClock: (v) => { clock = v } }
}

test('failure event is pushed to the configured channel', async () => {
  const { notifier, sent } = mk()
  const r = await notifier.emit('generate_failed', {
    orderNo: 'O1', itemTitle: 'weflow', buyerNick: '买家', detail: 'path_not_found',
  })
  assert.equal(r.state, 'sent')
  assert.equal(sent.length, 1)
  assert.match(sent[0], /O1/)
  assert.match(sent[0], /path_not_found/)
})

test('notification text never contains private delivery fields', async () => {
  const { notifier, sent } = mk()
  await notifier.emit('send_failed', { orderNo: 'O2', detail: 'im closed' })
  assert.doesNotMatch(sent[0], /收货地址|手机号|186\*\*\*\*|\d{11}/)
})

test('daily_digest is off by default', async () => {
  const { notifier, sent } = mk()
  const r = await notifier.emit('daily_digest', {})
  assert.equal(r.suppressed, true)
  assert.equal(sent.length, 0)
})

test('same kind inside the cooldown window is suppressed', async () => {
  const { notifier, sent, store } = mk()
  await notifier.emit('send_failed', { orderNo: 'O1' })
  await notifier.emit('send_failed', { orderNo: 'O2' })
  assert.equal(sent.length, 1)
  const suppressed = store.recentNotify(10).filter((n) => n.state === 'suppressed')
  assert.equal(suppressed.length, 1)
})

test('a failing dsh-im records a failed notification for the panel', async () => {
  const { store, notifier } = mk(async () => { throw new Error('bot-not-connected') })
  const r = await notifier.emit('send_failed', { orderNo: 'O3' })
  assert.equal(r.state, 'failed')
  assert.equal(store.unsentNotifyCount(), 1)
  assert.match(store.recentNotify(1)[0].error, /bot-not-connected/)
})

test('no channel at all still leaves a trace', async () => {
  const store = createStore(join(mkdtempSync(join(tmpdir(), 'xianyu-ntf2-')), 'd.sqlite'))
  const notifier = createNotifier({ store, getDshIm: () => ({ send: async () => {} }), logger: () => {} })
  const r = await notifier.emit('invalid_content', { orderNo: 'O4' })
  assert.equal(r.error, 'no_channel')
  assert.equal(store.unsentNotifyCount(), 1)
})

test('test notification bypasses the cooldown', async () => {
  const { notifier, sent } = mk()
  await notifier.emit('test', {})
  const r = await notifier.test()
  assert.equal(r.state, 'sent')
  assert.equal(sent.length, 2)
})
