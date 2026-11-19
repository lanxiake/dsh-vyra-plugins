// End-to-end timing of the watch loop with a fake sidecar and session controller.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createWatcher } from '../lib/watch.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(predicate, timeout = 2_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (predicate()) return
    await sleep(10)
  }
  throw new Error('timed out waiting for the watch loop')
}

function policy(peer) {
  return {
    rules: {
      version: 2,
      enabled: true,
      private: true,
      groups: 'at_me',
      default_mode: 'ignore',
      reply_self: false,
      quiet_hours: { enabled: false, start: '23:00', end: '08:00' },
      peers: peer,
    },
  }
}

function msg(text, ts) {
  return {
    talker: 'friend',
    name: '好友',
    text,
    ts,
    time: `t${ts}`,
    type: 1,
    from_me: false,
    agent_sent: false,
  }
}

test('a burst waits for the merge window, then the reply cooldown batches what followed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-watch-'))
  const queue = [msg('在吗', 100)]
  const prompts = []
  const controller = {
    create: async () => ({ sessionId: 'session-1' }),
    rename: async () => {},
    prompt: async (request) => { prompts.push(request.content[0].text) },
  }
  const watcher = createWatcher({
    callJson: async (tool) => {
      if (tool === 'list_accounts') return { active: 'wxid_1', accounts: [{ wxid: 'wxid_1' }] }
      if (tool === 'poll_new') {
        const messages = queue.splice(0)
        const next = messages.length > 0 ? messages[messages.length - 1].ts : 100
        return { messages, next_since_ts: next }
      }
      return {}
    },
    readPolicy: async () => policy([{ id: 'friend', label: '好友', mode: 'auto', trigger: 'all', cooldown_seconds: 1 }]),
    restoreAccount: async () => {},
    getController: () => controller,
    statePath: join(dir, 'watch.json'),
    config: { watchSeconds: 0.02, mergeWindowSeconds: 0.05, replyTimeoutSeconds: 1, backlogSeconds: 300 },
  })
  try {
    watcher.start()
    await waitFor(() => prompts.length === 1)
    assert.match(prompts[0], /在吗/)
    assert.match(prompts[0], /dry_run=false/)
    assert.match(prompts[0], /talker="friend"/)

    // A second message arrives after the first batch was delivered and the agent replied.
    queue.push(msg('还在吗', 101))
    watcher.onToolResult('send_text', { talker: 'friend' }, [{
      type: 'text',
      text: JSON.stringify({ ok: true, dry_run: false, target_account: 'wxid_1', talker: 'friend' }),
    }])
    await waitFor(() => prompts.length === 2, 3_000)
    assert.match(prompts[1], /还在吗/)
  } finally {
    watcher.stop()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('notify peers are recorded but never wake the model', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-watch-'))
  const prompts = []
  const controller = { create: async () => ({ sessionId: 's' }), prompt: async () => { prompts.push('called') } }
  let delivered = false
  const watcher = createWatcher({
    callJson: async (tool) => {
      if (tool === 'list_accounts') return { active: 'wxid_1', accounts: [{ wxid: 'wxid_1' }] }
      if (tool === 'poll_new') {
        if (delivered) return { messages: [], next_since_ts: 100 }
        delivered = true
        return { messages: [msg('hi', 100)], next_since_ts: 100 }
      }
      return {}
    },
    readPolicy: async () => policy([{ id: 'friend', label: '好友', mode: 'notify', trigger: 'all' }]),
    restoreAccount: async () => {},
    getController: () => controller,
    statePath: join(dir, 'watch.json'),
    config: { watchSeconds: 0.02, mergeWindowSeconds: 0.05, replyTimeoutSeconds: 1 },
  })
  try {
    watcher.start()
    await waitFor(() => watcher.status().notifications.length === 1)
    await sleep(150)
    assert.equal(prompts.length, 0)
    assert.equal(watcher.status().notifications[0].name, '好友')
    assert.equal(watcher.status().notifications[0].text, 'hi')
  } finally {
    watcher.stop()
    rmSync(dir, { recursive: true, force: true })
  }
})