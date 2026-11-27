import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../lib/db.js'
import { createLinkService } from '../lib/link.js'

const mk = (overrides = {}) => {
  const store = createStore(join(mkdtempSync(join(tmpdir(), 'xianyu-link-')), 'd.sqlite'))
  let n = 0
  const netdisk = {
    id: 'quark',
    resolve: async (p) => ({ fid: 'F:' + p }),
    share: async () => ({ share_url: `https://pan.quark.cn/s/share${++n}`, passcode: 'ABCD', url_type: 2 }),
    verify: async () => ({ ok: true, status: 200 }),
    ...overrides,
  }
  return { store, netdisk, svc: createLinkService({ store, netdisk, account: () => 'A1' }) }
}

test('reuse returns the same live share for the same item', async () => {
  const { svc } = mk()
  const a = await svc.obtain({ itemId: 'I1', path: 'p/weflow.zip', strategy: 'reuse', expireDays: 7 })
  const b = await svc.obtain({ itemId: 'I1', path: 'p/weflow.zip', strategy: 'reuse', expireDays: 7 })
  assert.equal(a.share.share_url, b.share.share_url)
})

test('fresh creates one share per call', async () => {
  const { svc } = mk()
  const a = await svc.obtain({ itemId: 'I1', path: 'p/weflow.zip', strategy: 'fresh', expireDays: 7 })
  const b = await svc.obtain({ itemId: 'I1', path: 'p/weflow.zip', strategy: 'fresh', expireDays: 7 })
  assert.notEqual(a.share.share_url, b.share.share_url)
})

test('text matches what the buyer should see', async () => {
  const { svc } = mk()
  const { text } = await svc.obtain({ itemId: 'I1', path: 'p/weflow.zip', strategy: 'fresh', expireDays: 7 })
  assert.equal(text, '链接：https://pan.quark.cn/s/share1\n提取码：ABCD\n有效期 7 天')
})

test('a failed verify aborts and writes nothing to the ledger', async () => {
  const { store, svc } = mk({ verify: async () => ({ ok: false, status: 404, error: 'status_404' }) })
  await assert.rejects(
    () => svc.obtain({ itemId: 'I1', path: 'p/weflow.zip', strategy: 'reuse', expireDays: 7 }),
    /verify_failed:status_404/,
  )
  assert.equal(store.lastShare({ itemId: 'I1', provider: 'quark' }), null)
})

test('a missing path never reaches share', async () => {
  let shared = 0
  const { svc } = mk({
    resolve: async () => { throw Object.assign(new Error('path_not_found:weflow.zip'), { code: 'path_not_found' }) },
    share: async () => { shared += 1; return {} },
  })
  await assert.rejects(() => svc.obtain({ itemId: 'I1', path: 'weflow.zip', expireDays: 7 }), /path_not_found/)
  assert.equal(shared, 0)
})

test('blank path is rejected before touching the netdisk', async () => {
  const { svc } = mk()
  await assert.rejects(() => svc.obtain({ itemId: 'I1', path: '  ', expireDays: 7 }), /path_required/)
})
