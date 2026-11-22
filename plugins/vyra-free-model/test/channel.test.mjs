import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CHANNEL_METHODS, isChannelMethodAllowed, createApiRoutes } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const vendor = join(here, '..', 'vendor', 'channel-pack')

test('only the six UI methods are allowed through the proxy', () => {
  assert.deepEqual([...CHANNEL_METHODS].sort(), [
    'account.create', 'account.delete', 'account.list',
    'credits.claimAll', 'credits.status', 'provider.status',
  ])
  assert.equal(isChannelMethodAllowed('account.create'), true)
  assert.equal(isChannelMethodAllowed('backup.import'), false)
  assert.equal(isChannelMethodAllowed('account.resetAll'), false)
  assert.equal(isChannelMethodAllowed(''), false)
  assert.equal(isChannelMethodAllowed(undefined), false)
  assert.equal(isChannelMethodAllowed(null), false)
  assert.equal(isChannelMethodAllowed(42), false)
})

test('a look-alike method name does not slip past the list', () => {
  assert.equal(isChannelMethodAllowed('account.create '), false)
  assert.equal(isChannelMethodAllowed('ACCOUNT.CREATE'), false)
  assert.equal(isChannelMethodAllowed('credits.claimAll.extra'), false)
})

test('every module the channel pack needs to boot is present', () => {
  for (const name of ['pack.js', 'qoder-auth-wasm.wasm', 'LICENSE', 'NOTICE.md']) {
    assert.ok(existsSync(join(vendor, name)), `vendor/channel-pack/${name} must exist`)
  }
  // pack.js locates its wasm through import.meta.url, so a truncated or
  // relocated copy fails at load time rather than at review time.
  assert.ok(statSync(join(vendor, 'pack.js')).size > 1_000_000)
  assert.ok(statSync(join(vendor, 'qoder-auth-wasm.wasm')).size > 100_000)
})

test('the pack ships its licence text rather than a pointer to one', () => {
  const licence = readFileSync(join(vendor, 'LICENSE'), 'utf8')
  assert.ok(/MIT/i.test(licence))
  const notice = readFileSync(join(vendor, 'NOTICE.md'), 'utf8')
  assert.ok(notice.length > 100)
})

/** Drive one request through the routes with a given channel function. */
function call(handler, { method = 'POST', path = '/channel', body } = {}) {
  return new Promise(resolve => {
    const req = {
      method,
      url: `/api/vyra-free-model${path}`,
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
      end(payload) { resolve({ status: this.statusCode, body: payload === '' ? undefined : JSON.parse(payload) }) },
    }
    void handler(req, res)
  })
}

const deps = overrides => ({
  version: '0.1.0',
  settings: { enabled: true },
  catalog: () => [],
  laneOk: () => true,
  accounts: () => ({ state: 'ready', providers: [] }),
  usage: () => ({ input: 0, output: 0, total: 0 }),
  forward: () => ({ enabled: false, port: 0, key: '' }),
  refreshCatalog: async () => [],
  setForward: async () => ({ enabled: false, port: 0, key: '' }),
  ...overrides,
})

test('a destructive pack method cannot reach it through this proxy', async () => {
  let called = false
  const handler = createApiRoutes(deps({ channel: async () => { called = true; return {} } }))
  for (const method of ['backup.import', 'backup.export', 'account.resetAll', 'config.write', 'captcha.relay']) {
    const res = await call(handler, { body: { method } })
    assert.equal(res.status, 403, `${method} must be refused`)
    assert.equal(res.body.error, 'method-not-allowed')
  }
  assert.equal(called, false, 'the pack must never be reached for a refused method')
})

test('each allowed method is forwarded with its payload intact', async () => {
  const seen = []
  const handler = createApiRoutes(deps({ channel: async (method, payload) => { seen.push([method, payload]); return { echoed: method } } }))
  for (const method of CHANNEL_METHODS) {
    const res = await call(handler, { body: { method, payload: { marker: method } } })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.value, { echoed: method })
  }
  assert.deepEqual(seen.map(([method]) => method), [...CHANNEL_METHODS])
  assert.deepEqual(seen[0][1], { marker: 'provider.status' })
})

test('an unavailable pack answers 503, not a silent success', async () => {
  const handler = createApiRoutes(deps({ channel: undefined }))
  const res = await call(handler, { body: { method: 'provider.status' } })
  assert.equal(res.status, 503)
  assert.equal(res.body.error, 'channels-unavailable')
})

test('a pack failure becomes a 502 carrying its message, not a crash', async () => {
  const handler = createApiRoutes(deps({ channel: async () => { throw new Error('rpc exploded') } }))
  const res = await call(handler, { body: { method: 'account.list' } })
  assert.equal(res.status, 502)
  assert.ok(String(res.body.error).includes('rpc exploded'))
})

test('an oversized pack error message is trimmed rather than echoed whole', async () => {
  const handler = createApiRoutes(deps({ channel: async () => { throw new Error('x'.repeat(5000)) } }))
  const res = await call(handler, { body: { method: 'account.list' } })
  assert.equal(res.status, 502)
  assert.ok(String(res.body.error).length <= 300)
})

test('the summary reports an account state even before the pack settles', async () => {
  const handler = createApiRoutes(deps({ accounts: () => ({ state: 'pending', providers: [] }) }))
  const res = await call(handler, { method: 'GET', path: '/summary' })
  assert.equal(res.body.accounts.state, 'pending')
})
