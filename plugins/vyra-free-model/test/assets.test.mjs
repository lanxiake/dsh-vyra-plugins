import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createApiRoutes } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', 'assets')

/** A request/response pair that keeps the body as raw bytes. */
function call(handler, { path, headers = {} } = {}) {
  return new Promise(resolve => {
    const req = {
      method: 'GET',
      url: `/api/vyra-free-model${path}`,
      headers,
      on() { return req },
    }
    const res = {
      statusCode: 0,
      headers: {},
      writeHead(status, extra) { this.statusCode = status; Object.assign(this.headers, extra ?? {}) },
      end(payload) { resolve({ status: this.statusCode, headers: this.headers, body: payload }) },
    }
    void handler(req, res)
  })
}

const handler = createApiRoutes({})

test('the QQ group image is served from this package', async () => {
  const answer = await call(handler, { path: '/assets/qq-group.png' })
  assert.equal(answer.status, 200)
  assert.equal(answer.headers['content-type'], 'image/png')
  // A real PNG: the signature, not a placeholder.
  assert.equal(answer.body.subarray(0, 4).toString('hex'), '89504e47')
  assert.equal(Number(answer.headers['content-length']), answer.body.length)
  assert.ok(answer.body.length > 1000)
})

test('the shipped asset exists where the route reads it', () => {
  assert.ok(existsSync(join(assets, 'qq-group.png')))
})

test('the asset route will not read files outside assets/', async () => {
  for (const path of [
    '/assets/../../index.js',
    '/assets/..%2F..%2Fpackage.json',
    '/assets/index.js',
    '/assets/',
  ]) {
    const answer = await call(handler, { path })
    assert.notEqual(answer.status, 200, `${path} must not be served`)
  }
})

test('the asset route refuses a proxied request like every other route', async () => {
  const answer = await call(handler, {
    path: '/assets/qq-group.png',
    headers: { 'x-forwarded-for': '10.0.0.1' },
  })
  assert.equal(answer.status, 403)
})