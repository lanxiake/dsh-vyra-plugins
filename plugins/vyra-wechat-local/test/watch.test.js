// Policy decisions the watch loop applies before waking the model.
import assert from 'node:assert/strict'
import test from 'node:test'
import { decideMessage, isTrustedChannel, summarize } from '../lib/watch.js'

function rules(overrides = {}) {
  return {
    version: 2,
    enabled: true,
    private: true,
    groups: 'at_me',
    default_mode: 'ignore',
    reply_self: false,
    quiet_hours: { enabled: false, start: '23:00', end: '08:00' },
    peers: [],
    ...overrides,
  }
}

const message = (overrides = {}) => ({
  talker: 'friend',
  name: '好友',
  text: '在吗',
  at_me: false,
  ...overrides,
})

test('a disabled gate drops everything', () => {
  assert.equal(decideMessage(rules({ enabled: false }), message()).action, 'drop')
})

test('only self and filehelper are trusted channels', () => {
  assert.equal(isTrustedChannel('filehelper', 'wxid_me'), true)
  assert.equal(isTrustedChannel('wxid_me', 'wxid_me'), true)
  assert.equal(isTrustedChannel('friend', 'wxid_me'), false)
  assert.equal(isTrustedChannel('wxid_me', 'wxid_other'), false)
})

test('self and filehelper are whitelisted by default, other friends are not', () => {
  const self = message({ talker: 'wxid_me', account: 'wxid_me' })
  const helper = message({ talker: 'filehelper', account: 'wxid_me' })
  // Even with no rules / the gate disabled: the control channel still works.
  assert.equal(decideMessage(undefined, self).action, 'auto')
  assert.equal(decideMessage(rules({ enabled: false, peers: [] }), helper).action, 'auto')
  assert.equal(decideMessage(rules({ peers: [] }), message({ account: 'wxid_me' })).action, 'drop')

  // An explicit entry still wins, so the user can silence them.
  const peers = [{ id: 'filehelper', mode: 'ignore', trigger: 'all' }]
  assert.equal(decideMessage(rules({ peers }), helper).action, 'drop')
})

test('an unlisted peer follows default_mode', () => {
  assert.equal(decideMessage(rules({ default_mode: 'notify' }), message()).action, 'notify')
  assert.equal(decideMessage(rules({ default_mode: 'ignore' }), message()).action, 'drop')
})

test('ignore and notify peers never wake the model', () => {
  const peers = [{ id: 'friend', label: '好友', mode: 'ignore', trigger: 'all' }]
  assert.equal(decideMessage(rules({ peers }), message()).action, 'drop')
  const notify = [{ id: 'friend', label: '好友', mode: 'notify', trigger: 'all' }]
  assert.equal(decideMessage(rules({ peers: notify }), message()).action, 'notify')
})

test('auto and draft peers carry the configured cooldown', () => {
  const peers = [{ id: 'friend', label: '好友', mode: 'auto', trigger: 'all', cooldown_seconds: 30 }]
  const decision = decideMessage(rules({ peers }), message())
  assert.equal(decision.action, 'auto')
  assert.equal(decision.cooldownMs, 30_000)

  const draft = decideMessage(rules({ peers: [{ ...peers[0], mode: 'draft' }] }), message())
  assert.equal(draft.action, 'draft')
})

test('an id matches even when the display name differs', () => {
  const peers = [{ id: 'wxid_abc', label: '妈妈', mode: 'auto', trigger: 'all' }]
  assert.equal(decideMessage(rules({ peers }), message({ talker: 'wxid_abc', name: '妈妈' })).action, 'auto')
})

test('keyword triggers only pass matching text', () => {
  const peers = [{ id: 'friend', mode: 'auto', trigger: 'keyword', keywords: ['报错', '上线'] }]
  assert.equal(decideMessage(rules({ peers }), message({ text: '帮我看看' })).action, 'drop')
  assert.equal(decideMessage(rules({ peers }), message({ text: '线上报错了' })).action, 'auto')
})

test('mention triggers apply to groups only', () => {
  const peers = [{ id: 'room@chatroom', mode: 'draft', trigger: 'mention' }]
  const group = { talker: 'room@chatroom', name: '群' }
  assert.equal(decideMessage(rules({ peers }), message({ ...group, at_me: false })).action, 'drop')
  assert.equal(decideMessage(rules({ peers }), message({ ...group, at_me: true })).action, 'draft')
})

test('private_off and quiet hours suppress delivery', () => {
  const peers = [{ id: 'friend', mode: 'auto', trigger: 'all' }]
  assert.equal(decideMessage(rules({ peers, private: false }), message()).action, 'drop')
  const quiet = { enabled: true, start: '00:00', end: '23:59' }
  assert.equal(decideMessage(rules({ peers, quiet_hours: quiet }), message()).action, 'drop')
})

test('summarize keeps the fields a prompt needs', () => {
  const summary = summarize({
    ts: 123,
    time: '2026-01-02 03:04:05',
    type: 3,
    text: 'x'.repeat(600),
    at_me: true,
    local_id: 9,
    name: '好友',
    talker: 'wxid_abc',
  })
  assert.equal(summary.ts, 123)
  assert.equal(summary.at_me, true)
  assert.equal(summary.talker, 'wxid_abc')
  assert.ok(summary.text.length <= 1001)
})