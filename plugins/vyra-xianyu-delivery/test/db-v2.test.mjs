import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../lib/db.js'

const file = join(mkdtempSync(join(tmpdir(), 'xianyu-v2-')), 'data.sqlite')

test('handled events survive a reopen', () => {
  const a = createStore(file)
  a.markHandled('message', 'M1', { cid: 'C1', action: 'replied' })
  const b = createStore(file)
  assert.equal(b.isHandled('message', 'M1'), true)
  assert.equal(b.isHandled('message', 'M2'), false)
})

test('chat messages are stored and pruned by age', () => {
  const s = createStore(file)
  s.upsertMessage({ cid: 'C1', messageId: 'M1', text: '你好', createdAt: Date.now() - 40 * 86400000 })
  s.upsertMessage({ cid: 'C1', messageId: 'M2', text: '在吗', createdAt: Date.now() })
  s.pruneChatMessages(30)
  const rows = s.messages('C1', 10)
  assert.deepEqual(rows.map((r) => r.message_id), ['M2'])
})

test('pending tasks round-trip and dedupe per order', () => {
  const s = createStore(file)
  const id = s.addPendingTask({ kind: 'generate_failed', orderNo: 'O1', detail: 'no path' })
  assert.ok(id)
  // 同一单同一类失败不重复入队，避免每轮轮询堆一条。
  assert.equal(s.addPendingTask({ kind: 'generate_failed', orderNo: 'O1', detail: 'no path' }), null)
  assert.equal(s.listPendingTasks().length, 1)
  s.resolvePendingTask(id)
  assert.equal(s.listPendingTasks().length, 0)
})

test('reuse share is found only while unexpired', () => {
  const s = createStore(file)
  s.addShare({
    itemId: 'I1', provider: 'quark', shareUrl: 'https://pan.quark.cn/s/live1',
    passcode: 'ABCD', expiredAt: new Date(Date.now() + 86400000).toISOString(), verified: 1,
  })
  s.addShare({
    itemId: 'I1', provider: 'quark', shareUrl: 'https://pan.quark.cn/s/dead1',
    passcode: 'EFGH', expiredAt: new Date(Date.now() - 86400000).toISOString(), verified: 1,
  })
  const hit = s.lastShare({ itemId: 'I1', provider: 'quark' })
  assert.equal(hit.share_url, 'https://pan.quark.cn/s/live1')
})

test('channels and notifications are recorded', () => {
  const s = createStore(file)
  const ch = s.addChannel({ botId: 'B1', targetId: 'T1', channel: 'weixin', label: '我' })
  assert.equal(s.listChannels().length, 1)
  s.setChannelEnabled(ch.id, false)
  assert.equal(s.listChannels()[0].enabled, 0)
  s.recordNotify({ kind: 'send_failed', ref: 'O9', text: 'x', state: 'failed', error: 'bot-not-connected' })
  assert.equal(s.unsentNotifyCount(), 1)
})

test('card sources upsert per item and spec', () => {
  const s = createStore(file)
  s.upsertCardSource({ itemId: 'I1', specValue: '安装包', path: 'a/b.zip' })
  s.upsertCardSource({ itemId: 'I1', specValue: '安装包', path: 'a/c.zip' })
  assert.equal(s.listCardSources().length, 1)
  assert.equal(s.getCardSource('I1', '安装包').path, 'a/c.zip')
})
