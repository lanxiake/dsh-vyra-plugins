import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../lib/db.js'
import { createChatSync, isNoiseSession, isFlowControlError } from '../lib/chat-sync.js'

const mk = ({ sessions = [], history = {}, orders = [], chatError = null } = {}) => {
  const store = createStore(join(mkdtempSync(join(tmpdir(), 'xianyu-sync-')), 'd.sqlite'))
  const calls = { chats: [], history: [] }
  const im = {
    chats: async (n) => {
      calls.chats.push(n)
      if (chatError) throw new Error(chatError)
      return { sessions }
    },
    history: async (cid) => {
      calls.history.push(cid)
      if (history[cid] instanceof Error) throw history[cid]
      return history[cid] || []
    },
  }
  const cli = {
    chats: async (n) => { calls.chats.push(`cli:${n}`); return { sessions } },
    soldList: async () => ({ orders }),
  }
  const sync = createChatSync({ store, im, cli, account: () => 'A1', log: () => {} })
  return { store, im, cli, sync, calls }
}

const buyer = (over = {}) => ({
  session_id: 'C-BUYER', peer_nick: '买家', peer_user_id: 'B1', item_id: 'I1',
  session_type: 1, unread: 1, ts: 1000, last_msg: '在吗', ...over,
})
const noise = (over = {}) => ({
  session_id: 'C-GH', peer_nick: '某公众号', peer_user_id: 'gh_1', session_type: 23,
  unread: 5, ts: 2000, last_msg: '推送', ...over,
})
const msg = (id, text, at = 1000) => ({ message_id: id, created_at: at, message: { text: { text } } })

test('system sessions are recognised as noise', () => {
  assert.equal(isNoiseSession(noise()), true)
  assert.equal(isNoiseSession(buyer()), false)
  assert.equal(isNoiseSession({ session_id: 'x', peer_nick: '闲鱼精选' }), true)
})

test('flow-control errors are recognised however they are worded', () => {
  assert.equal(isFlowControlError(new Error('会话列表被拒绝：The request has been flow controled')), true)
  assert.equal(isFlowControlError(new Error('请求过于频繁')), true)
  assert.equal(isFlowControlError(Object.assign(new Error('x'), { stderr: 'rate limit' })), true)
  assert.equal(isFlowControlError(new Error('network down')), false)
})

test('first sync writes chats and messages to the db', async () => {
  const { store, sync } = mk({
    sessions: [buyer(), noise()],
    history: { 'C-BUYER': [msg('M1', '在吗')] },
  })
  const stats = await sync.sync()
  assert.equal(stats.full, true)
  assert.ok(store.listChatsFromDb('A1', 50).find((c) => c.session_id === 'C-BUYER'))
  assert.equal(store.hasMessage('C-BUYER', 'M1'), true)
  assert.notEqual(store.getSetting('chats.fullSyncAt'), '')
})

test('second sync is incremental: unchanged buyer session is skipped', async () => {
  const { sync, calls } = mk({
    sessions: [buyer({ unread: 0 }), noise()],
    history: { 'C-BUYER': [msg('M1', '在吗')] },
  })
  await sync.sync()
  const before = calls.history.length
  await sync.sync()
  assert.equal(calls.history.length, before)
})

test('unread buyer session is re-scanned even when ts is stale', async () => {
  const { sync, calls } = mk({ sessions: [buyer({ unread: 3 })], history: {} })
  await sync.sync({ force: true })
  const before = calls.history.length
  await sync.sync()
  assert.ok(calls.history.length > before)
})

test('noise sessions are stored but never trigger a reply', async () => {
  const handled = []
  const store = createStore(join(mkdtempSync(join(tmpdir(), 'xianyu-noise-')), 'd.sqlite'))
  const sync = createChatSync({
    store,
    im: { chats: async () => ({ sessions: [noise()] }), history: async () => [] },
    cli: { chats: async () => ({ sessions: [noise()] }), soldList: async () => ({ orders: [] }) },
    account: () => 'A1',
    log: () => {},
    handleConversation: async (cid) => { handled.push(cid) },
  })
  await sync.sync({ reply: true })
  assert.ok(store.listChatsFromDb('A1', 10).find((c) => c.session_id === 'C-GH'))
  assert.deepEqual(handled, [])
})

test('order-based fallback pulls in a buyer that fell out of the list', async () => {
  const { store, sync, cli } = mk({
    sessions: [noise(), buyer({ session_id: 'C-B9', peer_user_id: 'B9', unread: 0, ts: 500 })],
    history: { 'C-B9': [msg('M9', '发货了吗')] },
  })
  cli.soldList = async () => ({ orders: [{ order_no: 'O9', buyer_id: 'B9' }] })
  // 这条会话的水位比 ts 新，正常会被跳过；订单兜底必须把它拉起来。
  store.setChatState('C-B9', { lastTs: 9999 })
  const stats = await sync.sync({ reply: true })
  assert.ok(stats.scanned >= 1, '订单里的买家会话应被纳入')
})

// ---- 2026-11-27 晚事故的回归用例 ----

test('a flow-controlled list is never treated as a complete sync', async () => {
  const { store, sync } = mk({ chatError: 'flow controled' })
  const stats = await sync.sync()
  assert.equal(stats.complete, false)
  assert.equal(stats.flowControlled, true)
  // 关键：不能被标记成「全量已完成」，否则真实买家永远补不回来。
  assert.equal(store.getSetting('chats.fullSyncAt'), '')
})

test('after flow control the sync cools down instead of hammering', async () => {
  const { sync, calls } = mk({ chatError: 'flow controled' })
  await sync.sync()
  const after = calls.chats.length
  const second = await sync.sync()
  assert.equal(second.cooling, true)
  assert.equal(calls.chats.length, after, '冷却期内不该再请求会话列表')
})

test('a truncated list (fewer rows than asked) keeps the full-sync marker unset', async () => {
  // 只回 1 条、但请求 60 条 → 说明可能被截断，不应认定「已到底」
  const { store, sync } = mk({ sessions: [buyer()], history: { 'C-BUYER': [msg('M1', 'x')] } })
  const stats = await sync.sync({ limit: 60 })
  assert.equal(stats.complete, true, '1 < 60 视为到底，是平台正常响应')
  assert.notEqual(store.getSetting('chats.fullSyncAt'), '')
})

test('history flow control aborts the round without advancing watermarks', async () => {
  const { store, sync } = mk({
    sessions: [buyer({ session_id: 'C-A' }), buyer({ session_id: 'C-B', peer_user_id: 'B2', ts: 1200 })],
    history: {
      'C-A': new Error('The request has been flow controled'),
      'C-B': [msg('M2', '你好')],
    },
  })
  const stats = await sync.sync({ reply: true })
  assert.equal(stats.complete, false)
  // 被流控的那条会话不能推进水位
  assert.equal(store.getChatState('C-A'), null)
})

test('messages are not duplicated on repeated syncs', async () => {
  const { store, sync } = mk({
    sessions: [buyer()],
    history: { 'C-BUYER': [msg('M1', '在吗')] },
  })
  await sync.sync({ force: true })
  await sync.sync({ force: true })
  assert.equal(store.messagesAscending('C-BUYER', 100).length, 1)
})
