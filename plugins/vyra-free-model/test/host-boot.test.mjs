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
  const route = routes.find(entry => entry.path === '/api/vyra-free-model')
  assert.ok(route !== undefined, 'the API route is registered')
  return { handler: route.handler, effects }
}

function call(handler, { method = 'GET', path: suffix = '/', body } = {}) {
  return new Promise(resolve => {
    const req = {
      method,
      url: `/api/vyra-free-model${suffix}`,
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
