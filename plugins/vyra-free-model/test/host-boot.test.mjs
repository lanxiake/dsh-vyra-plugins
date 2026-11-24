import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Boot the host half on a fake context and return its route handler. */
async function boot(extra = {}) {
  process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'vfm-boot-'))
  const { apply } = await import('../index.js')
  const routes = []
  const effects = []
  const services = {
    llm: {
      registerAdapter() {},
      emitAdaptersUpdated() {},
      async listModels() { return [] },
    },
    webServer: {
      register(route) { routes.push(route); return () => {} },
    },
    ...extra,
  }
  const ctx = {
    logger: { info() {}, warn() {} },
    effect(fn) { const value = fn(); effects.push(value); return value },
    inject(deps, callback) { if (deps.every(name => services[name])) callback(ctx) },
    get(name) { return services[name] },
    on() { return () => {} },
    ...services,
  }
  apply(ctx, {})
  const route = routes.find(entry => entry.path === '/api/dsh-vyra-free-model')
  assert.ok(route !== undefined, 'the API route is registered')
  return { handler: route.handler, effects }
}

function call(handler, { method = 'GET', path: suffix = '/', body } = {}) {
  return new Promise(resolve => {
    const req = {
      method,
      url: `/api/dsh-vyra-free-model${suffix}`,
      headers: {},
      on(event, fn) {
        if (event === 'data' && body !== undefined) fn(Buffer.from(JSON.stringify(body)))
        if (event === 'end') fn()
        return req
      },
    }
    const res = {
      statusCode: 0,
      writeHead(status) { this.statusCode = status },
      end(payload) { resolve({ status: this.statusCode, body: JSON.parse(payload) }) },
    }
    void handler(req, res)
  })
}

test('the plugin boots without the channel pack and still serves a summary', async () => {
  const { handler, effects } = await boot()
  const response = await call(handler, { path: '/summary' })
  assert.equal(response.status, 200)
  assert.equal(typeof response.body.lane.ok, 'boolean')
  assert.equal(response.body.lane.source.url, 'https://kilo.ai')
  assert.ok(Array.isArray(response.body.extras.models))
  assert.ok(Array.isArray(response.body.accounts.providers))
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})

test('an endpoint can be saved and its key never comes back', async () => {
  const { handler, effects } = await boot()
  const saved = await call(handler, {
    method: 'POST',
    path: '/endpoints',
    body: { action: 'save', endpoint: { name: 'Ark', baseUrl: 'https://ark.example/api/v3', apiKey: 'sk-secret' } },
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.endpoint.hasKey, true)
  assert.equal(JSON.stringify(saved.body).includes('sk-secret'), false)
  const summary = await call(handler, { path: '/summary' })
  assert.equal(JSON.stringify(summary.body).includes('sk-secret'), false)
  assert.equal(summary.body.extras.endpoints.length, 1)
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})

test('an unsupported endpoint scheme is refused', async () => {
  const { handler, effects } = await boot()
  const response = await call(handler, {
    method: 'POST',
    path: '/endpoints',
    body: { action: 'save', endpoint: { name: 'bad', baseUrl: 'file:///etc/passwd' } },
  })
  assert.equal(response.status, 409)
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})

test('the channel proxy refuses methods outside the allow-list', async () => {
  const { handler, effects } = await boot()
  const response = await call(handler, {
    method: 'POST',
    path: '/channel',
    body: { method: 'backup.export', payload: {} },
  })
  assert.equal(response.status, 403)
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})

test('the in-process channel service is used, and a login URL is handed to the host browser', async () => {
  process.env.VYRA_NO_OPEN_BROWSER = '1'
  const calls = []
  const { handler, effects } = await boot({
    channelPack: {
      async call(method, payload) {
        calls.push({ method, payload })
        if (method === 'account.create') return { ok: true, value: { accountId: 'a1', loginUrl: 'https://example.com/auth' } }
        if (method === 'account.list') return { ok: true, value: { accounts: [{ id: 'a1', nickname: '小明' }] } }
        return { ok: true, value: {} }
      },
    },
  })
  const response = await call(handler, {
    method: 'POST',
    path: '/channel',
    body: { method: 'account.create', payload: { provider: 'qodercn' } },
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.value.loginUrl, 'https://example.com/auth')
  assert.deepEqual(calls, [{ method: 'account.create', payload: { provider: 'qodercn' } }])
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
  delete process.env.VYRA_NO_OPEN_BROWSER
})

test('the automatic switch defaults on and can be turned off', async () => {
  const { handler, effects } = await boot()
  const before = await call(handler, { path: '/summary' })
  assert.equal(before.body.autoSwitch, true)
  const off = await call(handler, { method: 'POST', path: '/auto-switch', body: { enabled: false } })
  assert.equal(off.status, 200)
  assert.equal(off.body.autoSwitch, false)
  const after = await call(handler, { path: '/summary' })
  assert.equal(after.body.autoSwitch, false)
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})

test('credits claim and balances pass through the channel service', async () => {
  const calls = []
  const { handler, effects } = await boot({
    channelPack: {
      async call(method, payload) {
        calls.push({ method, payload })
        if (method === 'credits.claimAll') return { ok: true, value: { results: [] } }
        if (method === 'credits.balances') return { ok: true, value: { accounts: [] } }
        return { ok: true, value: {} }
      },
    },
  })
  const claim = await call(handler, { method: 'POST', path: '/credits/claim', body: { provider: 'trae' } })
  assert.equal(claim.status, 200)
  assert.deepEqual(calls[0], { method: 'credits.claimAll', payload: { provider: 'trae' } })
  const listed = await call(handler, { path: '/credits' })
  assert.equal(listed.status, 200)
  assert.deepEqual(listed.body.providers, {})
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})

test('account rows can be refreshed on demand', async () => {
  const { handler, effects } = await boot()
  const response = await call(handler, { method: 'POST', path: '/accounts/refresh' })
  assert.equal(response.status, 200)
  assert.ok(Array.isArray(response.body.providers))
  // Even without the channel pack the two Tencent products are always offered.
  assert.deepEqual(response.body.providers.map(row => row.id).sort(), ['buddy', 'workbuddy'])
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})

test('a second sign-in of the same nickname is removed as a duplicate', async () => {
  const calls = []
  const { handler, effects } = await boot({
    channelPack: {
      async call(method, payload) {
        calls.push({ method, payload })
        if (method === 'account.list') {
          return { ok: true, value: { accounts: [
            { id: 'a1', nickname: '小明', enabled: true },
            { id: 'a2', nickname: '小明', enabled: true },
          ] } }
        }
        if (method === 'account.delete') return { ok: true, value: undefined }
        if (method === 'provider.status') return { ok: true, value: { statuses: {} } }
        return { ok: true, value: {} }
      },
    },
  })
  const response = await call(handler, {
    method: 'POST',
    path: '/accounts/dedupe',
    body: { provider: 'trae', accountId: 'a2' },
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.duplicate, true)
  assert.equal(response.body.kept, '小明')
  assert.ok(calls.some(call => call.method === 'account.delete' && call.payload.accountId === 'a2'))
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})
