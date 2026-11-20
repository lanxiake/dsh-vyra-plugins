// End-to-end timing of the watch loop with a fake sidecar and session controller.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
  const created = []
  const controller = {
    create: async (request) => { created.push(request); return { sessionId: 'session-1' } },
    rename: async () => {},
    prompt: async (request) => { prompts.push(request.content[0].text) },
  }
  const watcher = createWatcher({
    createSession: async () => { created.push('created'); return 'session-1' },
    ensureSession: async () => {},
    callJson: async (tool) => {
      if (tool === 'check_env') return { weixin_running: true, db_ok: true, deps: { ok: true } }
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
    assert.match(prompts[0], /\[好友（friend） · 账号 wxid_1 · 直接代回\]/)
    assert.doesNotMatch(prompts[0], /你是用户的微信助理/)
    assert.equal(created.length, 1)

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

test('a closed WeChat is reported and polling stops', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-watch-'))
  let polls = 0
  const watcher = createWatcher({
    callJson: async (tool) => {
      if (tool === 'check_env') return { weixin_running: false, ok: false, reason: '微信没运行' }
      if (tool === 'poll_new') { polls += 1; return { messages: [], next_since_ts: 0 } }
      return {}
    },
    readPolicy: async () => ({ rules: { enabled: true } }),
    restoreAccount: async () => {},
    getController: () => ({ create: async () => ({ sessionId: 's' }), prompt: async () => {} }),
    statePath: join(dir, 'watch.json'),
    config: { watchSeconds: 0.02, mergeWindowSeconds: 0.05, replyTimeoutSeconds: 1 },
  })
  try {
    watcher.start()
    await waitFor(() => watcher.status().lastError !== '')
    await sleep(80)
    assert.match(watcher.status().lastError, /微信未运行/)
    assert.equal(polls, 0, 'polling must not run while WeChat is closed')
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
      if (tool === 'check_env') return { weixin_running: true, db_ok: true, deps: { ok: true } }
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

test('voice is transcribed and images are attached before delivery', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-watch-'))
  const imagePath = join(dir, 'image.png')
  writeFileSync(imagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0sAAAAASUVORK5CYII=', 'base64'))
  const requests = []
  const controller = {
    create: async () => ({ sessionId: 'session-media' }),
    rename: async () => {},
    prompt: async (request) => { requests.push(request) },
  }
  let delivered = false
  const watcher = createWatcher({
    callJson: async (tool) => {
      if (tool === 'check_env') return { weixin_running: true, db_ok: true, deps: { ok: true } }
      if (tool === 'list_accounts') return { active: 'wxid_1', accounts: [{ wxid: 'wxid_1', running: true }] }
      if (tool === 'transcribe_voice') return { ok: true, text: '你好呀' }
      if (tool === 'poll_new') {
        if (delivered) return { messages: [], next_since_ts: 101 }
        delivered = true
        return {
          messages: [
            { talker: 'friend', name: '好友', type: 34, ts: 100, time: 't100', text: '[语音 3秒]', voice_path: 'fake.silk', account: 'wxid_1' },
            { talker: 'friend', name: '好友', type: 3, ts: 101, time: 't101', text: '[图片]', image_path: imagePath, account: 'wxid_1' },
          ],
          next_since_ts: 101,
        }
      }
      return {}
    },
    readPolicy: async () => policy([{ id: 'friend', label: '好友', mode: 'auto', trigger: 'all', cooldown_seconds: 1 }]),
    restoreAccount: async () => {},
    getController: () => controller,
    createSession: async () => 'session-media',
    ensureSession: async () => {},
    statePath: join(dir, 'watch.json'),
    config: { watchSeconds: 0.02, mergeWindowSeconds: 0.05, replyTimeoutSeconds: 1 },
  })
  try {
    watcher.start()
    await waitFor(() => requests.length === 1)
    const content = requests[0].content
    const text = content.find((part) => part.type === 'text').text
    assert.match(text, /\[好友（friend） · 账号 wxid_1 · 直接代回\]/)
    assert.match(text, /\[语音\] 你好呀/)
    assert.match(text, /\[图片\]/)
    assert.ok(content.some((part) => part.type === 'image' && part.mediaType === 'image/png' && part.data.length > 0))
  } finally {
    watcher.stop()
    rmSync(dir, { recursive: true, force: true })
  }
})
test('a failed delivery retries the same batch without repeating image notes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-watch-'))
  const prompts = []
  let attempts = 0
  const controller = {
    create: async () => ({ sessionId: 'session-retry' }),
    rename: async () => {},
    prompt: async (request) => {
      attempts += 1
      if (attempts === 1) throw new Error('agent unavailable')
      prompts.push(request.content.find((part) => part.type === 'text').text)
    },
  }
  let delivered = false
  const watcher = createWatcher({
    callJson: async (tool) => {
      // A hidden (tray) window is still connected: keep polling and delivering.
      if (tool === 'check_env') {
        return {
          weixin_running: true, db_ok: true, deps: { ok: true }, ok: false,
          reason: '主窗口不可见（已收进托盘；发送时会先自动还原一次）',
        }
      }
      if (tool === 'list_accounts') return { active: 'wxid_1', accounts: [{ wxid: 'wxid_1', running: true }] }
      if (tool === 'poll_new') {
        if (delivered) return { messages: [], next_since_ts: 101 }
        delivered = true
        return {
          messages: [{ talker: 'friend', name: '好友', type: 3, ts: 101, time: 't101', text: '[图片 734KB]', local_id: 7, account: 'wxid_1' }],
          next_since_ts: 101,
        }
      }
      return {}
    },
    readPolicy: async () => policy([{ id: 'friend', label: '好友', mode: 'auto', trigger: 'all', cooldown_seconds: 1 }]),
    restoreAccount: async () => {},
    getController: () => controller,
    createSession: async () => 'session-retry',
    ensureSession: async () => {},
    readImage: async () => ({
      image: { mediaType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0sAAAAASUVORK5CYII=' },
      text: 'attach 3053',
    }),
    statePath: join(dir, 'watch.json'),
    config: { watchSeconds: 0.02, mergeWindowSeconds: 0.05, replyTimeoutSeconds: 1 },
  })
  try {
    watcher.start()
    await waitFor(() => prompts.length === 1, 3_000)
    assert.equal(prompts[0].split('attach 3053').length - 1, 1, 'the retry must not append the note twice')
  } finally {
    watcher.stop()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an image without a local path is fetched through read_image', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-watch-'))
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0sAAAAASUVORK5CYII='
  const requests = []
  const controller = {
    create: async () => ({ sessionId: 'session-image' }),
    rename: async () => {},
    prompt: async (request) => { requests.push(request) },
  }
  let delivered = false
  const watcher = createWatcher({
    callJson: async (tool) => {
      if (tool === 'check_env') return { weixin_running: true, db_ok: true, deps: { ok: true } }
      if (tool === 'list_accounts') return { active: 'wxid_1', accounts: [{ wxid: 'wxid_1', running: true }] }
      if (tool === 'poll_new') {
        if (delivered) return { messages: [], next_since_ts: 101 }
        delivered = true
        return {
          messages: [{ talker: 'friend', name: '好友', type: 3, ts: 101, time: 't101', text: '[图片 734KB]', local_id: 7, account: 'wxid_1' }],
          next_since_ts: 101,
        }
      }
      return {}
    },
    readPolicy: async () => policy([{ id: 'friend', label: '好友', mode: 'auto', trigger: 'all', cooldown_seconds: 1 }]),
    restoreAccount: async () => {},
    getController: () => controller,
    createSession: async () => 'session-image',
    ensureSession: async () => {},
    readImage: async () => ({ image: { mediaType: 'image/png', data: png }, text: 'variant=hd' }),
    statePath: join(dir, 'watch.json'),
    config: { watchSeconds: 0.02, mergeWindowSeconds: 0.05, replyTimeoutSeconds: 1 },
  })
  try {
    watcher.start()
    await waitFor(() => requests.length === 1)
    const content = requests[0].content
    assert.ok(content.some((part) => part.type === 'image' && part.mediaType === 'image/png'))
    assert.match(content.find((part) => part.type === 'text').text, /variant=hd/)
  } finally {
    watcher.stop()
    rmSync(dir, { recursive: true, force: true })
  }
})
