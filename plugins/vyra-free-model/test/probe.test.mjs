import test from 'node:test'
import assert from 'node:assert/strict'
import { probeModel, probeAll } from '../src/probe.js'

/** A fetch stub that answers one status with a fixed body. */
function fetchWith(status, body = '') {
  return async () => new Response(body, { status, headers: { 'content-type': 'application/json' } })
}

test('a 200 means the model answered', async () => {
  const result = await probeModel('a/', { fetchImpl: fetchWith(200, 'data: {"model":"a/"}\n\n') })
  assert.equal(result.state, 'ok')
})

test('a 429 is the quota window, not a dead model', async () => {
  const result = await probeModel('a/', { fetchImpl: fetchWith(429, '{"error":{"message":"slow down"}}') })
  assert.equal(result.state, 'limited')
  assert.equal(result.reason, '上游限流')
})

test('a 404 or "unavailable" is the only verdict that hides a model', async () => {
  const missing = await probeModel('a/', { fetchImpl: fetchWith(404, '{"error":{"message":"not found"}}') })
  assert.equal(missing.state, 'unavailable')
  const refused = await probeModel('a/', { fetchImpl: fetchWith(400, '{"error":{"message":"Model is unavailable"}}') })
  assert.equal(refused.state, 'unavailable')
})

test('a 5xx does not condemn the model', async () => {
  const result = await probeModel('a/', { fetchImpl: fetchWith(503, 'busy') })
  assert.equal(result.state, 'unknown')
})

test('a dead connection is unknown rather than unavailable', async () => {
  const result = await probeModel('a/', { fetchImpl: async () => { throw new Error('ECONNRESET') } })
  assert.equal(result.state, 'unknown')
})

test('probeAll keeps input order and probes every id', async () => {
  const seen = []
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    seen.push(body.model)
    return new Response('', { status: body.model === 'b/' ? 404 : 200 })
  }
  const results = await probeAll(['a/', 'b/', 'c/'], { fetchImpl })
  assert.deepEqual(seen.sort(), ['a/', 'b/', 'c/'])
  assert.equal(results['a/'].state, 'ok')
  assert.equal(results['b/'].state, 'unavailable')
  assert.equal(results['c/'].state, 'ok')
})
