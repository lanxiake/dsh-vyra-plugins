// Protocol check: frames in, frames out, errors stay errors. Run: node --test test/
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { createSidecar, SidecarError } from '../lib/sidecar.js'

const here = dirname(fileURLToPath(import.meta.url))
const fake = join(here, 'fake-sidecar.mjs')
const runtime = () => ({ command: process.execPath, args: [fake], source: 'test' })

test('initialize, call, progress, error and shutdown', async () => {
  const sidecar = createSidecar({ runtime, vendorDir: here })
  const info = await sidecar.start()
  assert.equal(info.version, 'test')
  assert.equal(info.tools[0].name, 'list_sessions')
  assert.deepEqual(sidecar.status().tools[0], {
    name: 'list_sessions',
    description: '列出微信会话',
  })

  const content = await sidecar.call('list_sessions', { query: '张三' })
  assert.deepEqual(JSON.parse(content[0].text), { query: '张三' })

  await assert.rejects(() => sidecar.call('boom', {}), (err) => {
    assert.ok(err instanceof SidecarError)
    assert.match(err.message, /env_not_ready/)
    return true
  })

  await sidecar.stop()
  assert.equal(sidecar.status().state, 'stopped')
})

test('restart starts a fresh sidecar', async () => {
  const sidecar = createSidecar({ runtime, vendorDir: here })
  await sidecar.start()
  const info = await sidecar.restart()
  assert.equal(info.version, 'test')
  assert.equal(sidecar.status().state, 'ready')
  await sidecar.stop()
})

test('aborted call rejects without killing the sidecar', async () => {
  const sidecar = createSidecar({ runtime, vendorDir: here })
  await sidecar.start()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => sidecar.call('list_sessions', {}, controller.signal), /取消/)
  assert.equal(sidecar.status().state, 'ready')
  await sidecar.stop()
})