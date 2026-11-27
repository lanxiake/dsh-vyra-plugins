import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDelivery } from '../lib/validate.js'

test('accepts a real quark share', () => {
  const r = validateDelivery('链接：https://pan.quark.cn/s/508e39403427\n提取码：GT3Q\n有效期 7 天', { expireDays: 7 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.errors, [])
})

test('rejects the placeholder text that shipped on 2026-11-27', () => {
  const r = validateDelivery('链接：暂无法生成（分享链接生成工具未就绪，稍后补发）\n提取码：无\n有效期 7 天', { expireDays: 7 })
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('placeholder:')))
})

test('rejects a URL-shaped placeholder', () => {
  const r = validateDelivery('链接：https://pan.quark.cn/s/待生成\n提取码：待生成', { expireDays: 7 })
  assert.equal(r.ok, false)
})

test('rejects missing passcode when url has no pwd', () => {
  const r = validateDelivery('链接：https://pan.quark.cn/s/508e39403427', { expireDays: 7 })
  assert.equal(r.ok, false)
  assert.ok(r.errors.includes('passcode:missing'))
})

test('accepts pwd embedded in url', () => {
  const r = validateDelivery('https://pan.quark.cn/s/abc123def?pwd=gt3q', { expireDays: 7 })
  assert.equal(r.ok, true)
})

test('rejects vendor ads leaking into delivery', () => {
  const r = validateDelivery('链接：https://pan.quark.cn/s/508e39403427\n提取码：GT3Q\n开通 SVIP+ 可享智能搜索', { expireDays: 7 })
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('ad:')))
})

test('rejects wrong expiry promise', () => {
  const r = validateDelivery('链接：https://pan.quark.cn/s/508e39403427\n提取码：GT3Q\n有效期 30 天', { expireDays: 7 })
  assert.equal(r.ok, false)
  assert.ok(r.errors.includes('expiry:mismatch'))
})

// 卡密商品不该被链接规则误伤，但占位文案与广告照样要拦。
test('code mode accepts a plain card secret', () => {
  const r = validateDelivery('CARD-A1B2-C3D4', { mode: 'code' })
  assert.equal(r.ok, true)
})

test('code mode still rejects placeholder text', () => {
  const r = validateDelivery('卡密待生成，稍后补发', { mode: 'code' })
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.startsWith('placeholder:')))
})

test('code mode rejects an empty delivery', () => {
  const r = validateDelivery('   ', { mode: 'code' })
  assert.equal(r.ok, false)
  assert.ok(r.errors.includes('empty'))
})

test('validationModeFor picks link for netdisk cards and code for secrets', async () => {
  const { validationModeFor } = await import('../lib/validate.js')
  assert.equal(validationModeFor({ mode: 'generate', content: '' }), 'link')
  assert.equal(validationModeFor({ mode: 'reuse', content: 'https://pan.quark.cn/s/abc12345?pwd=abcd' }), 'link')
  assert.equal(validationModeFor({ mode: 'pool', content: 'CARD-A\n---\nCARD-B' }), 'code')
  assert.equal(validationModeFor({ mode: 'reuse', type: 'text', content: 'hello' }), 'code')
})
