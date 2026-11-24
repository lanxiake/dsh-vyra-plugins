import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import { handleSessionChanges } from './lib/routes.js'

/**
 * Build a zstd-framed session log the way the JSONL backend writes it, so the
 * test exercises the same multi-frame decode path as a real store.
 */
function writeFramedLog(directory, events) {
  const file = join(directory, 'session.v4.jsonl.zstd')
  const chunks = []
  for (let index = 0; index < events.length; index += 50) {
    const lines = events.slice(index, index + 50).map(event => JSON.stringify(event)).join('\n')
    chunks.push(zlib.zstdCompressSync(Buffer.from(`${lines}\n`, 'utf8')))
  }
  fs.writeFileSync(file, Buffer.concat(chunks))
  return file
}

/** The real session log shape: user text plus the injected contexts around it. */
const SESSION_EVENTS = [
  { type: 'session', version: 4, id: 's', createdAt: Date.now() - 600_000, cwd: '/ws' },
  { type: 'user/message', seq: 1, time: Date.now() - 500_000, data: { content: [{ type: 'text', text: '帮我整理素材' }], source: { kind: 'user' } } },
  { type: 'user/message', seq: 2, time: Date.now() - 500_000, data: { content: [{ type: 'text', text: '<system-reminder>注入的指令</system-reminder>' }], source: { kind: 'agent-instructions' } } },
  { type: 'user/message', seq: 3, time: Date.now() - 500_000, data: { content: [{ type: 'text', text: 'Current working directory: "/ws".' }], source: { kind: 'runtime-context' } } },
  { type: 'assistant/message', seq: 4, time: Date.now() - 490_000, data: {} },
  { type: 'user/message', seq: 5, time: Date.now() - 120_000, data: { content: [{ type: 'text', text: '再导出一份 PDF' }], source: { kind: 'user' } } },
  { type: 'user/message', seq: 6, time: Date.now() - 120_000, data: { content: [{ type: 'text', text: 'Time sampled while preparing turn 2' }], source: { kind: 'time-context' } } },
]

test('real session log shape yields one node per user prompt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-real-log-'))
  try {
    await mkdir(join(root, 'docs'), { recursive: true })
    await writeFile(join(root, 'docs', 'a.md'), 'hello')

    const logFile = writeFramedLog(root, SESSION_EVENTS)
    // Read the log back the way the Host would, through persistence only: this
    // is the surface that actually works on a running DSH Host.
    const raw = fs.readFileSync(logFile)
    const starts = []
    for (let i = 0; i + 4 <= raw.length; i += 1) {
      if (raw[i] === 0x28 && raw[i + 1] === 0xb5 && raw[i + 2] === 0x2f && raw[i + 3] === 0xfd) starts.push(i)
    }
    let text = ''
    for (let i = 0; i < starts.length; i += 1) {
      text += zlib.zstdDecompressSync(raw.subarray(starts[i], starts[i + 1] ?? raw.length)).toString('utf8')
    }
    const events = text.split('\n').filter(Boolean).map(line => JSON.parse(line))
    assert.equal(events.length, SESSION_EVENTS.length)

    let opens = 0
    let closes = 0
    const ctx = {
      workspaceFiles: { scopeOf: async sessionId => ({ sessionId, workspaceRoot: root }) },
      // Live services are absent on this Host — exactly the case that used to
      // return an empty timeline.
      get: name => name === 'sessionPersistence'
        ? {
          open: async () => {
            opens += 1
            return { read: async () => ({ events }), close: async () => { closes += 1 } }
          },
        }
        : undefined,
      fs: {
        async resolve(path, opts = {}) {
          const value = isAbsolute(path) ? path : join(opts.cwd ?? root, path)
          return { targetKey: value, displayPath: value }
        },
        contains(a, b) { const r = relative(a.displayPath, b.displayPath); return r === '' || (!r.startsWith('..') && !isAbsolute(r)) },
        processPath(t) { return t.displayPath },
      },
    }

    const response = await handleSessionChanges(new Request('http://host/api/vyra-media/session-changes?sessionId=s'), ctx)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.deepEqual(body.turns.map(turn => turn.prompt), ['再导出一份 PDF', '帮我整理素材'])
    assert.equal(body.probe.find(entry => entry.name === 'sessionPersistence').count, SESSION_EVENTS.length)
    assert.equal(opens, 1)
    assert.equal(closes, 1)
    assert.ok(body.turns.every(turn => Array.isArray(turn.files)))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an unreadable Host reports the probe instead of an empty timeline', async () => {
  const ctx = {
    workspaceFiles: { scopeOf: async sessionId => ({ sessionId, workspaceRoot: '/ws' }) },
    get: () => undefined,
    fs: { resolve: async path => ({ targetKey: path, displayPath: path }) },
  }
  const response = await handleSessionChanges(new Request('http://host/api/vyra-media/session-changes?sessionId=s'), ctx)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.reason, 'no-session-events')
  assert.deepEqual(body.probe.map(entry => entry.name), ['sessions', 'agents', 'agentLoop', 'sessionController', 'sessionProjectionCache', 'sessionPersistence'])
  assert.ok(body.probe.every(entry => entry.count === 0))
})