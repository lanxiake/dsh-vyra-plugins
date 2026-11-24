import test from 'node:test'
import assert from 'node:assert/strict'
import { createSummary, createApiRoutes } from '../index.js'

test('summary reports the lane, an empty account state and zero usage', () => {
  const summary = createSummary({
    version: '0.1.0',
    catalog: [{ id: 'a:free', name: 'A', contextWindow: 1, maxOutput: 1, vision: false }],
    laneOk: true,
    accounts: { state: 'ready', providers: [] },
    usage: { input: 0, output: 0, total: 0 },
    forward: { enabled: false, port: 0, key: '' },
  })
  assert.equal(summary.lane.ok, true)
  assert.equal(summary.lane.models.length, 1)
  assert.equal(summary.forward.enabled, false)
  assert.deepEqual(summary.usage, { input: 0, output: 0, total: 0 })
})

test('summary hides the forward key but says one exists', () => {
  const summary = createSummary({
    version: '0.1.0', catalog: [], laneOk: false,
    accounts: { state: 'ready', providers: [] },
    usage: { input: 0, output: 0, total: 0 },
    forward: { enabled: true, port: 8899, key: 'secret' },
  })
  assert.equal(summary.forward.hasKey, true)
  assert.equal(JSON.stringify(summary).includes('secret'), false)
})

test('summary carries the account state so the page can explain an unavailable pack', () => {
  const summary = createSummary({
    version: '0.1.0', catalog: [], laneOk: true,
    accounts: { state: 'owned-elsewhere', providers: [] },
    usage: { input: 0, output: 0, total: 0 },
    forward: { enabled: false, port: 0, key: '' },
  })
  assert.equal(summary.accounts.state, 'owned-elsewhere')
})

/** A minimal request/response pair over the handler. */
function call(handler, { method = 'GET', path = '/', body, headers = {} } = {}) {
  return new Promise(resolve => {
    const chunks = []
    const req = {
      method,
      url: `/api/dsh-vyra-free-model${path}`,
      headers,
      on(event, fn) {
        if (event === 'data' && body !== undefined) fn(Buffer.from(JSON.stringify(body)))
        if (event === 'end') fn()
        return req
      },
    }
    const res = {
      statusCode: 0,
      headers: {},
      writeHead(status, extra) { this.statusCode = status; Object.assign(this.headers, extra ?? {}) },
      end(payload) { resolve({ status: this.statusCode, body: JSON.parse(payload) }) },
    }
    void handler(req, res)
    void chunks
  })
}

function deps(overrides = {}) {
  return {
    version: '0.1.0',
    settings: { enabled: true },
    catalog: () => [{ id: 'a:free', name: 'A', contextWindow: 1, maxOutput: 1, vision: false }],
    laneOk: () => true,
    accounts: () => ({ state: 'ready', providers: [] }),
    usage: () => ({ input: 1, output: 2, total: 3 }),
    forward: () => ({ enabled: false, port: 0, key: '' }),
    refreshCatalog: async () => [],
    setForward: async () => ({ enabled: false, port: 0, key: '' }),
    channel: undefined,
    ...overrides,
  }
}

test('GET /summary serves the assembled summary', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { path: '/summary' })
  assert.equal(res.status, 200)
  assert.equal(res.body.lane.models.length, 1)
  assert.deepEqual(res.body.usage, { input: 1, output: 2, total: 3 })
})

test('POST /recheck refreshes and reports the new count', async () => {
  const handler = createApiRoutes(deps({ refreshCatalog: async () => [{ id: 'b:free' }] }))
  const res = await call(handler, { method: 'POST', path: '/recheck' })
  assert.equal(res.status, 200)
  assert.equal(res.body.count, 1)
})

test('an unknown path is 404', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { path: '/nope' })
  assert.equal(res.status, 404)
})

test('a wrong method on a known path is 405', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { method: 'GET', path: '/recheck' })
  assert.equal(res.status, 405)
})

test('a non-local request is refused', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { path: '/summary', headers: { 'x-forwarded-for': '10.0.0.9' } })
  assert.equal(res.status, 403)
})

test('the channel proxy refuses everything outside the allow-list', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { method: 'POST', path: '/channel', body: { method: 'backup.import' } })
  assert.equal(res.status, 403)
  assert.equal(res.body.error, 'method-not-allowed')
})

test('the channel proxy answers 503 when no pack is mounted', async () => {
  const handler = createApiRoutes(deps({ channel: undefined }))
  const res = await call(handler, { method: 'POST', path: '/channel', body: { method: 'provider.status' } })
  assert.equal(res.status, 503)
})

test('the channel proxy forwards an allowed call', async () => {
  const seen = []
  const handler = createApiRoutes(deps({
    channel: async (method, payload) => { seen.push([method, payload]); return { ok: true } },
  }))
  const res = await call(handler, { method: 'POST', path: '/channel', body: { method: 'provider.status', payload: { a: 1 } } })
  assert.equal(res.status, 200)
  assert.deepEqual(seen, [['provider.status', { a: 1 }]])
})

test('a throwing channel call becomes a 502 rather than a hang', async () => {
  const handler = createApiRoutes(deps({ channel: async () => { throw new Error('rpc down') } }))
  const res = await call(handler, { method: 'POST', path: '/channel', body: { method: 'provider.status' } })
  assert.equal(res.status, 502)
})

test('POST /forward toggles and never echoes the key back', async () => {
  const handler = createApiRoutes(deps({
    setForward: async enabled => ({ enabled, port: enabled ? 8899 : 0, key: enabled ? 'k' : '' }),
  }))
  const on = await call(handler, { method: 'POST', path: '/forward', body: { enabled: true } })
  assert.equal(on.status, 200)
  assert.equal(on.body.forward.port, 8899)
  assert.equal(JSON.stringify(on.body).includes('"k"'), false)
})

test('the master switch goes through the injected setter, not a captured store', async () => {
  let enabled = true
  const handler = createApiRoutes(deps({
    isEnabled: () => enabled,
    setEnabled: async value => { enabled = value === true; return enabled },
  }))
  const off = await call(handler, { method: 'POST', path: '/enabled', body: { enabled: false } })
  assert.equal(off.status, 200)
  assert.equal(off.body.enabled, false)
  assert.equal(enabled, false)
  const summary = await call(handler, { path: '/summary' })
  assert.equal(summary.body.enabled, false)
})

test('the master switch reports 503 when the composition wires no setter', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { method: 'POST', path: '/enabled', body: { enabled: false } })
  assert.equal(res.status, 503)
})

// ── configure routes ────────────────────────────────────────────────────────

test('the configure status route lists both tools', async () => {
  const handler = createApiRoutes(deps({
    configureStatus: () => [{ tool: 'claude', configured: false }, { tool: 'codex', configured: true }],
  }))
  const res = await call(handler, { method: 'GET', path: '/configure/status' })
  assert.equal(res.status, 200)
  assert.equal(res.body.tools.length, 2)
  assert.equal(res.body.tools[1].configured, true)
})

test('a configure write answers 200 on success and 409 on refusal', async () => {
  const ok = createApiRoutes(deps({ configure: async () => ({ ok: true, tool: 'claude', command: 'claude-vyra' }) }))
  const good = await call(ok, { method: 'POST', path: '/configure', body: { tool: 'claude' } })
  assert.equal(good.status, 200)
  assert.equal(good.body.command, 'claude-vyra')

  const refused = createApiRoutes(deps({ configure: async () => ({ ok: false, reason: '请先打开端口' }) }))
  const bad = await call(refused, { method: 'POST', path: '/configure', body: { tool: 'claude' } })
  assert.equal(bad.status, 409)
  assert.ok(bad.body.reason.includes('端口'))
})

test('a configure write is 503 when the composition wires no writer', async () => {
  const handler = createApiRoutes(deps())
  const res = await call(handler, { method: 'POST', path: '/configure', body: { tool: 'claude' } })
  assert.equal(res.status, 503)
})

test('the restore route reports its refusal instead of pretending', async () => {
  const handler = createApiRoutes(deps({ restoreConfigure: async () => ({ ok: false, reason: '没有可用的备份。' }) }))
  const res = await call(handler, { method: 'POST', path: '/configure/restore', body: { tool: 'codex' } })
  assert.equal(res.status, 409)
  assert.ok(res.body.reason.includes('备份'))
})

test('the configure status route rejects a POST', async () => {
  const handler = createApiRoutes(deps({ configureStatus: () => [] }))
  const res = await call(handler, { method: 'POST', path: '/configure/status', body: {} })
  assert.equal(res.status, 405)
})

test('a configure write cannot be reached through a proxy', async () => {
  const handler = createApiRoutes(deps({ configure: async () => ({ ok: true }) }))
  const res = await new Promise(resolve => {
    const req = { method: 'POST', url: '/api/dsh-vyra-free-model/configure',
      headers: { 'x-forwarded-for': '10.0.0.1' }, on() { return req } }
    const out = { statusCode: 0, writeHead(s) { this.statusCode = s }, end(p) { resolve({ status: this.statusCode, body: JSON.parse(p) }) } }
    void handler(req, out)
  })
  assert.equal(res.status, 403)
})
