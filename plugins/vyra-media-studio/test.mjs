import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import test from 'node:test'
import { extensionOf, kindOf, mimeOf } from './lib/media-types.js'
import { entityTagOf, parseRange } from './lib/range.js'
import { scanMedia } from './lib/scan.js'
import { serveMediaFile } from './lib/serve.js'
import { handleList, registerMediaRoutes } from './lib/routes.js'

test('media vocabulary', () => {
  assert.equal(extensionOf('a/b/c.MP4?x=1'), 'mp4')
  assert.equal(extensionOf('C:\\work\\clip.MOV'), 'mov')
  assert.equal(extensionOf('no-extension'), '')
  assert.equal(kindOf('mp4'), 'video')
  assert.equal(kindOf('JPG'), 'image')
  assert.equal(kindOf('mp3'), 'audio')
  assert.equal(kindOf('txt'), undefined)
  assert.equal(mimeOf('mp4'), 'video/mp4')
  assert.equal(mimeOf('svg'), 'image/svg+xml')
  assert.equal(mimeOf('unknown'), 'application/octet-stream')
})

test('range planning', () => {
  assert.deepEqual(parseRange(null, 1000), { kind: 'none' })
  assert.deepEqual(parseRange('bytes=0-99', 1000), { kind: 'partial', start: 0, end: 99 })
  assert.deepEqual(parseRange('bytes=900-', 1000), { kind: 'partial', start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=-100', 1000), { kind: 'partial', start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=500-2000', 1000), { kind: 'partial', start: 500, end: 999 })
  assert.deepEqual(parseRange('bytes=1000-', 1000), { kind: 'invalid' })
  assert.deepEqual(parseRange('bytes=5-4', 1000), { kind: 'invalid' })
  assert.deepEqual(parseRange('bytes=0-1,3-4', 1000), { kind: 'none' })
  assert.deepEqual(parseRange('bytes=0-', 0), { kind: 'none' })
  assert.equal(entityTagOf('v1'), '"v1"')
  assert.equal(entityTagOf('a"b'), '"ab"')
})

/** A fake `ctx.fs` over a path→Buffer map, using POSIX paths. */
function fakeFs(files, root = '/ws') {
  const content = new Map(Object.entries(files).map(([path, value]) => [path, Buffer.from(value)]))
  const target = path => ({ targetKey: path, displayPath: path })
  return {
    async resolve(path, opts = {}) {
      const absolute = path.startsWith('/') ? posix.normalize(path) : posix.resolve(opts.cwd ?? root, path)
      return target(absolute)
    },
    async stat(value) {
      const bytes = content.get(value.displayPath)
      if (bytes === undefined) return undefined
      return bytes === 'directory'
        ? { type: 'directory', version: 'v1' }
        : { type: 'file', size: bytes.length, version: 'v1' }
    },
    contains(parent, child) {
      const base = parent.displayPath.replace(/\/+$/u, '')
      return child.displayPath === base || child.displayPath.startsWith(`${base}/`)
    },
    async readByteRange(value, { offset, length }) {
      return new Uint8Array(content.get(value.displayPath).subarray(offset, offset + length))
    },
  }
}

function fileRequest(query, init = {}) {
  return new Request(`http://host/api/vyra-media/file?${query}`, init)
}

test('serveMediaFile serves full, partial, HEAD and conditional responses', async () => {
  const fs = fakeFs({ '/ws/clip.mp4': 'hello' })

  const full = await serveMediaFile({ request: fileRequest('sessionId=s&path=clip.mp4'), fs, workspaceRoot: '/ws' })
  assert.equal(full.status, 200)
  assert.equal(await full.text(), 'hello')
  assert.equal(full.headers.get('content-type'), 'video/mp4')
  assert.equal(full.headers.get('accept-ranges'), 'bytes')
  assert.equal(full.headers.get('content-length'), '5')
  assert.equal(full.headers.get('etag'), '"v1"')
  assert.match(full.headers.get('content-disposition'), /filename\*=UTF-8''clip\.mp4/u)

  const partial = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4', { headers: { range: 'bytes=1-3' } }),
    fs, workspaceRoot: '/ws',
  })
  assert.equal(partial.status, 206)
  assert.equal(await partial.text(), 'ell')
  assert.equal(partial.headers.get('content-range'), 'bytes 1-3/5')
  assert.equal(partial.headers.get('content-length'), '3')

  const suffix = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4', { headers: { range: 'bytes=-2' } }),
    fs, workspaceRoot: '/ws',
  })
  assert.equal(await suffix.text(), 'lo')

  const invalid = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4', { headers: { range: 'bytes=9-' } }),
    fs, workspaceRoot: '/ws',
  })
  assert.equal(invalid.status, 416)
  assert.equal(invalid.headers.get('content-range'), 'bytes */5')

  const head = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4', { method: 'HEAD' }),
    fs, workspaceRoot: '/ws',
  })
  assert.equal(head.status, 200)
  assert.equal(head.body, null)
  assert.equal(head.headers.get('content-length'), '5')

  const cached = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4', { headers: { 'if-none-match': '"v1"' } }),
    fs, workspaceRoot: '/ws',
  })
  assert.equal(cached.status, 304)

  const ifRangeMiss = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4', { headers: { range: 'bytes=1-3', 'if-range': '"old"' } }),
    fs, workspaceRoot: '/ws',
  })
  assert.equal(ifRangeMiss.status, 200)
  assert.equal(await ifRangeMiss.text(), 'hello')
})

test('serveMediaFile rejects escapes, missing files and oversized files', async () => {
  const fs = fakeFs({ '/ws/clip.mp4': 'hello', '/secret.mp4': 'nope' })

  const escaped = await serveMediaFile({ request: fileRequest('sessionId=s&path=../secret.mp4'), fs, workspaceRoot: '/ws' })
  assert.equal(escaped.status, 403)

  const missing = await serveMediaFile({ request: fileRequest('sessionId=s&path=none.mp4'), fs, workspaceRoot: '/ws' })
  assert.equal(missing.status, 404)

  const missingParam = await serveMediaFile({ request: fileRequest('sessionId=s'), fs, workspaceRoot: '/ws' })
  assert.equal(missingParam.status, 400)

  const oversized = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4'), fs, workspaceRoot: '/ws', maxBytes: 3,
  })
  assert.equal(oversized.status, 413)
})

test('scanMedia walks media, skips build and hidden directories, and honors caps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-scan-'))
  try {
    await mkdir(join(root, '作品', '开箱'), { recursive: true })
    await mkdir(join(root, '素材'), { recursive: true })
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await mkdir(join(root, '.hidden'), { recursive: true })
    await writeFile(join(root, '作品', '开箱', '正片.MP4'), 'video')
    await writeFile(join(root, '素材', '封面.JPG'), 'image')
    await writeFile(join(root, '素材', 'bgm.mp3'), 'audio')
    await writeFile(join(root, '作品', 'notes.txt'), 'text')
    await writeFile(join(root, 'node_modules', 'skip.mp4'), 'skip')
    await writeFile(join(root, '.hidden', 'skip.mp4'), 'skip')

    const result = await scanMedia({ root, workspaceRoot: root, maxDepth: 4 })
    assert.equal(result.truncated, false)
    assert.deepEqual(
      result.entries.map(entry => [entry.relativePath, entry.kind, entry.size]),
      [
        ['作品/开箱/正片.MP4', 'video', 5],
        ['素材/封面.JPG', 'image', 5],
        ['素材/bgm.mp3', 'audio', 5],
      ].sort((left, right) => left[0].localeCompare(right[0], 'zh-CN', { numeric: true })),
    )
    assert.ok(result.entries.every(entry => entry.mtimeMs > 0 && entry.ext === entry.ext.toLowerCase()))
    assert.ok(result.scannedDirectories >= 2)

    const hidden = await scanMedia({ root, workspaceRoot: root, includeHidden: true })
    assert.equal(hidden.entries.length, 4)

    const capped = await scanMedia({ root, workspaceRoot: root, maxEntries: 1 })
    assert.equal(capped.entries.length, 1)
    assert.equal(capped.truncated, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('handleList resolves a session root, scopes folders and returns metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-list-'))
  try {
    await mkdir(join(root, '作品'), { recursive: true })
    await writeFile(join(root, '作品', 'a.mp4'), 'hello')
    await mkdir(join(root, '作品', 'sub'), { recursive: true })
    await writeFile(join(root, '作品', 'sub', 'b.png'), 'img')
    await writeFile(join(root, '作品', 'readme.md'), 'text')

    const ctx = {
      workspaceFiles: { scopeOf: async (sessionId) => sessionId === 's' ? { sessionId, workspaceRoot: root } : undefined },
      fs: {
        async resolve(path, opts = {}) {
          const value = path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path)
            ? path
            : join(opts.cwd ?? root, path)
          return { targetKey: value, displayPath: value }
        },
        contains(parent, child) { return child.displayPath === parent.displayPath || child.displayPath.startsWith(`${parent.displayPath}\\`) || child.displayPath.startsWith(`${parent.displayPath}/`) },
        processPath(target) { return target.displayPath },
      },
    }

    const all = await handleList(new Request('http://host/api/vyra-media/list?sessionId=s'), ctx)
    assert.equal(all.status, 200)
    const body = await all.json()
    assert.equal(body.ok, true)
    assert.equal(body.root, root)
    assert.deepEqual(body.entries.map(entry => entry.relativePath).sort(), ['作品/a.mp4', '作品/sub/b.png'])

    const sub = await handleList(new Request('http://host/api/vyra-media/list?sessionId=s&root=作品/sub'), ctx)
    const subBody = await sub.json()
    assert.equal(subBody.entries.length, 1)
    assert.equal(subBody.entries[0].relativePath, '作品/sub/b.png')

    const unknown = await handleList(new Request('http://host/api/vyra-media/list?sessionId=none'), ctx)
    assert.equal(unknown.status, 404)

    const outside = await handleList(new Request('http://host/api/vyra-media/list?sessionId=s&root=..'), ctx)
    assert.equal(outside.status, 403)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('registerMediaRoutes mounts both exact Fetch routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-routes-'))
  try {
    await writeFile(join(root, 'clip.mp4'), 'hello')
    const ctx = {
      effect(callback) { callback() },
      workspaceFiles: { scopeOf: async (sessionId) => sessionId === 's' ? { sessionId, workspaceRoot: root } : undefined },
      fs: {
        async resolve(path, opts = {}) {
          const value = path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path) ? path : join(opts.cwd ?? root, path)
          return { targetKey: value, displayPath: value }
        },
        contains(parent, child) { return child.displayPath === parent.displayPath || child.displayPath.startsWith(`${parent.displayPath}/`) || child.displayPath.startsWith(`${parent.displayPath}\\`) },
        processPath(target) { return target.displayPath },
        async stat(target) {
          const info = await import('node:fs/promises').then(fs => fs.stat(target.displayPath).catch(() => undefined))
          return info === undefined ? undefined : { type: info.isFile() ? 'file' : 'other', size: info.size, version: String(info.mtimeMs) }
        },
        async readByteRange(target, { offset, length }) {
          const buffer = await import('node:fs/promises').then(fs => fs.readFile(target.displayPath))
          return new Uint8Array(buffer.subarray(offset, offset + length))
        },
      },
    }
    const routes = []
    const connection = { fetch: { register(route) { routes.push(route); return async () => {} } } }
    assert.equal(registerMediaRoutes(ctx, connection), true)
    assert.deepEqual(routes.map(route => [route.path, route.methods]), [
      ['/api/vyra-media/list', ['GET']],
      ['/api/vyra-media/file', ['GET', 'HEAD']],
    ])

    const list = await routes[0].fetch(new Request('http://host/api/vyra-media/list?sessionId=s'))
    assert.equal(list.status, 200)
    const body = await list.json()
    assert.deepEqual(body.entries.map(entry => entry.relativePath), ['clip.mp4'])

    const bytes = await routes[1].fetch(new Request('http://host/api/vyra-media/file?sessionId=s&path=clip.mp4', { headers: { range: 'bytes=1-3' } }))
    assert.equal(bytes.status, 206)
    assert.equal(await bytes.text(), 'ell')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

