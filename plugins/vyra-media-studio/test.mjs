import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, posix, relative } from 'node:path'
import test from 'node:test'
import { extensionOf, isTextExtension, kindOf, mimeOf } from './lib/media-types.js'
import { entityTagOf, parseRange } from './lib/range.js'
import { scanMedia } from './lib/scan.js'
import { serveMediaFile } from './lib/serve.js'
import { batchFiles, copyFileInto, deleteFile, readTextFile, renameFile, statFiles } from './lib/file-ops.js'
import { handleList, registerMediaRoutes } from './lib/routes.js'

test('file vocabulary', () => {
  assert.equal(extensionOf('a/b/c.MP4?x=1'), 'mp4')
  assert.equal(extensionOf('C:\\work\\clip.MOV'), 'mov')
  assert.equal(extensionOf('no-extension'), '')
  assert.equal(kindOf('mp4'), 'video')
  assert.equal(kindOf('JPG'), 'image')
  assert.equal(kindOf('mp3'), 'audio')
  assert.equal(kindOf('pdf'), 'document')
  assert.equal(kindOf('docx'), 'document')
  assert.equal(kindOf('zip'), 'archive')
  assert.equal(kindOf('ts'), 'code')
  assert.equal(kindOf('unknownext'), 'other')
  assert.equal(kindOf(''), 'other')
  assert.equal(isTextExtension('md'), true)
  assert.equal(isTextExtension('pdf'), false)
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
    processPath(value) { return value.targetKey },
    async readByteRange(value, { offset, length }) {
      return new Uint8Array(content.get(value.displayPath).subarray(offset, offset + length))
    },
  }
}

/** A fake `ctx.fs` backed by the real temp directory. */
function realFs(root) {
  return {
    async resolve(path, opts = {}) {
      const value = path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path)
        ? path
        : join(opts.cwd ?? root, path)
      return { targetKey: value, displayPath: value }
    },
    contains(parent, child) {
      const step = relative(parent.displayPath, child.displayPath)
      return step === '' || (!step.startsWith('..') && !isAbsolute(step))
    },
    processPath(target) { return target.targetKey },
    async readByteRange(target, { offset, length }) {
      const buffer = await readFile(target.displayPath)
      return new Uint8Array(buffer.subarray(offset, offset + length))
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

test('serveMediaFile lets the PDF viewer render in an iframe', async () => {
  const fs = fakeFs({ '/ws/report.pdf': '%PDF-1.4' })
  const response = await serveMediaFile({ request: fileRequest('sessionId=s&path=report.pdf'), fs, workspaceRoot: '/ws' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'")
})

test('serveMediaFile rejects escapes, missing files and oversized files', async () => {
  const fs = fakeFs({ '/ws/clip.mp4': 'hello', '/secret.mp4': 'nope' })

  const escaped = await serveMediaFile({ request: fileRequest('sessionId=s&path=../secret.mp4'), fs, workspaceRoot: '/ws' })
  assert.equal(escaped.status, 403)
  assert.equal(escaped.headers.get('x-vyra-media-error'), 'outside-workspace')

  // An absolute path is served outside the workspace, matching the platform's
  // own file route; only workspace-relative paths are confined to it.
  const absolute = await serveMediaFile({ request: fileRequest('sessionId=s&path=%2Fsecret.mp4'), fs, workspaceRoot: '/ws' })
  assert.equal(absolute.status, 200)
  assert.equal(await absolute.text(), 'nope')

  const missing = await serveMediaFile({ request: fileRequest('sessionId=s&path=none.mp4'), fs, workspaceRoot: '/ws' })
  assert.equal(missing.status, 404)

  const missingParam = await serveMediaFile({ request: fileRequest('sessionId=s'), fs, workspaceRoot: '/ws' })
  assert.equal(missingParam.status, 400)

  const oversized = await serveMediaFile({
    request: fileRequest('sessionId=s&path=clip.mp4'), fs, workspaceRoot: '/ws', maxBytes: 3,
  })
  assert.equal(oversized.status, 413)
})

test('scanMedia walks every file type, skips build and hidden directories, and honors caps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-scan-'))
  try {
    await mkdir(join(root, '作品', '开箱'), { recursive: true })
    await mkdir(join(root, '素材'), { recursive: true })
    await mkdir(join(root, '空文件夹'), { recursive: true })
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await mkdir(join(root, '.hidden'), { recursive: true })
    await mkdir(join(root, '.git', 'objects'), { recursive: true })
    await writeFile(join(root, '作品', '开箱', '正片.MP4'), 'video')
    await writeFile(join(root, '素材', '封面.JPG'), 'image')
    await writeFile(join(root, '素材', 'bgm.mp3'), 'audio')
    await writeFile(join(root, '作品', 'notes.txt'), 'text')
    await writeFile(join(root, '作品', '报告.pdf'), 'pdf')
    await writeFile(join(root, 'node_modules', 'skip.mp4'), 'skip')
    await writeFile(join(root, '.hidden', 'skip.mp4'), 'skip')
    await writeFile(join(root, '.git', 'objects', 'skip.mp4'), 'skip')

    const result = await scanMedia({ root, workspaceRoot: root, maxDepth: 4 })
    assert.equal(result.truncated, false)
    assert.deepEqual(
      result.entries.map(entry => [entry.relativePath, entry.kind]).sort((left, right) => left[0].localeCompare(right[0], 'zh-CN', { numeric: true })),
      [
        ['作品/开箱/正片.MP4', 'video'],
        ['作品/notes.txt', 'document'],
        ['作品/报告.pdf', 'document'],
        ['素材/封面.JPG', 'image'],
        ['素材/bgm.mp3', 'audio'],
      ].sort((left, right) => left[0].localeCompare(right[0], 'zh-CN', { numeric: true })),
    )
    assert.ok(result.entries.every(entry => entry.ext === entry.ext.toLowerCase()))
    assert.ok(result.entries.every(entry => entry.size === undefined && entry.mtimeMs === undefined))
    assert.ok(result.folders.includes('作品/开箱'))
    assert.ok(result.folders.includes('素材'))
    assert.ok(result.folders.includes('空文件夹'))

    const hidden = await scanMedia({ root, workspaceRoot: root, includeHidden: true })
    assert.equal(hidden.entries.length, 6)

    const build = await scanMedia({ root, workspaceRoot: root, includeBuild: true })
    assert.ok(build.entries.some(entry => entry.relativePath === 'node_modules/skip.mp4'))
    assert.ok(!build.entries.some(entry => entry.relativePath.startsWith('.git/')))

    const capped = await scanMedia({ root, workspaceRoot: root, maxEntries: 1 })
    assert.equal(capped.entries.length, 1)
    assert.equal(capped.truncated, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('file operations rename, copy, stat, read text and delete', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-ops-'))
  const fs = realFs(root)
  try {
    await mkdir(join(root, 'sub'), { recursive: true })
    await writeFile(join(root, 'a.txt'), 'hello')
    await writeFile(join(root, 'img.png'), Buffer.from([1, 2, 3, 4]))

    const stats = await statFiles({ paths: ['a.txt', 'img.png', 'missing.txt'], fs, workspaceRoot: root })
    assert.equal(stats[0].size, 5)
    assert.equal(stats[1].size, 4)
    assert.equal(stats[2].error, 'not-found')

    const text = await readTextFile({ path: 'a.txt', fs, workspaceRoot: root })
    assert.equal(text.text, 'hello')
    assert.equal(text.truncated, false)

    const renamed = await renameFile({ path: 'a.txt', name: 'b.txt', fs, workspaceRoot: root })
    assert.equal(renamed.relativePath, 'b.txt')
    assert.equal(await readFile(join(root, 'b.txt'), 'utf8'), 'hello')

    const copied = await copyFileInto({ path: 'b.txt', toFolder: 'sub', fs, workspaceRoot: root })
    assert.equal(copied.relativePath, 'sub/b.txt')
    assert.equal(await readFile(join(root, 'sub', 'b.txt'), 'utf8'), 'hello')

    const copiedAgain = await copyFileInto({ path: 'b.txt', toFolder: 'sub', fs, workspaceRoot: root })
    assert.equal(copiedAgain.relativePath, 'sub/b (2).txt')

    await deleteFile({ path: 'b.txt', permanent: true, fs, workspaceRoot: root })
    await assert.rejects(stat(join(root, 'b.txt')), error => error.code === 'ENOENT')

    await assert.rejects(renameFile({ path: 'img.png', name: '../escape.png', fs, workspaceRoot: root }),
      error => error.code === 'invalid-name')
    await assert.rejects(copyFileInto({ path: 'img.png', toFolder: '..', fs, workspaceRoot: root }),
      error => error.code === 'outside-workspace')
    const outside = await statFiles({ paths: ['../outside.txt'], fs, workspaceRoot: root })
    assert.equal(outside[0].error, 'outside-workspace')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('folders can be statted, renamed, copied and batch-deleted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-dirs-'))
  const fs = realFs(root)
  try {
    await mkdir(join(root, 'alpha', 'nested'), { recursive: true })
    await mkdir(join(root, 'target'), { recursive: true })
    await writeFile(join(root, 'alpha', 'nested', 'a.txt'), 'hello')

    const stats = await statFiles({ paths: ['alpha', 'target'], fs, workspaceRoot: root })
    assert.equal(stats[0].type, 'directory')
    assert.equal(stats[1].type, 'directory')

    const renamed = await renameFile({ path: 'alpha', name: 'beta', fs, workspaceRoot: root })
    assert.equal(renamed.type, 'directory')
    assert.equal(renamed.relativePath, 'beta')

    const copied = await copyFileInto({ path: 'beta', toFolder: 'target', fs, workspaceRoot: root })
    assert.equal(copied.type, 'directory')
    assert.equal(copied.relativePath, 'target/beta')
    assert.equal(await readFile(join(root, 'target', 'beta', 'nested', 'a.txt'), 'utf8'), 'hello')

    await assert.rejects(copyFileInto({ path: 'target', toFolder: 'target/beta', fs, workspaceRoot: root }),
      error => error.code === 'copy-into-self')

    const batch = await batchFiles({
      action: 'copy', paths: ['beta/nested/a.txt'], toFolder: 'target', fs, workspaceRoot: root,
    })
    assert.equal(batch[0].ok, true)
    assert.equal(await readFile(join(root, 'target', 'a.txt'), 'utf8'), 'hello')

    const removed = await batchFiles({
      action: 'delete', paths: ['target/beta/nested/a.txt', 'missing.txt'], permanent: true, fs, workspaceRoot: root,
    })
    assert.equal(removed[0].ok, true)
    assert.equal(removed[1].ok, false)

    const deleted = await deleteFile({ path: 'target/beta', permanent: true, fs, workspaceRoot: root })
    assert.equal(deleted.type, 'directory')
    await assert.rejects(stat(join(root, 'target', 'beta')), error => error.code === 'ENOENT')
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
      get: name => name === 'sessions' ? { get: id => id === 's' ? { header: { createdAt: 123456 } } : undefined } : undefined,
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
    assert.equal(body.sessionCreatedAt, 123456)
    assert.deepEqual(body.entries.map(entry => entry.relativePath).sort(), ['作品/a.mp4', '作品/readme.md', '作品/sub/b.png'])
    assert.deepEqual(body.folders.sort(), ['作品', '作品/sub'])
    assert.ok(body.entries.every(entry => entry.size === undefined && entry.mtimeMs === undefined))

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

test('registerMediaRoutes mounts every exact Fetch route', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-routes-'))
  try {
    await writeFile(join(root, 'clip.mp4'), 'hello')
    await writeFile(join(root, 'notes.md'), '# hello')
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
      ['/api/vyra-media/diagnose', ['GET']],
      ['/api/vyra-media/text', ['GET']],
      ['/api/vyra-media/stat', ['POST']],
      ['/api/vyra-media/rename', ['POST']],
      ['/api/vyra-media/copy', ['POST']],
      ['/api/vyra-media/delete', ['POST']],
      ['/api/vyra-media/reveal', ['POST']],
      ['/api/vyra-media/open', ['POST']],
      ['/api/vyra-media/batch', ['POST']],
    ])

    const list = await routes[0].fetch(new Request('http://host/api/vyra-media/list?sessionId=s'))
    assert.equal(list.status, 200)
    const body = await list.json()
    assert.deepEqual(body.entries.map(entry => entry.relativePath).sort(), ['clip.mp4', 'notes.md'])

    const bytes = await routes[1].fetch(new Request('http://host/api/vyra-media/file?sessionId=s&path=clip.mp4', { headers: { range: 'bytes=1-3' } }))
    assert.equal(bytes.status, 206)
    assert.equal(await bytes.text(), 'ell')

    const text = await routes[3].fetch(new Request('http://host/api/vyra-media/text?sessionId=s&path=notes.md'))
    const textBody = await text.json()
    assert.equal(textBody.ok, true)
    assert.equal(textBody.text, '# hello')

    const statRoute = await routes[4].fetch(new Request('http://host/api/vyra-media/stat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's', paths: ['clip.mp4'] }),
    }))
    const statBody = await statRoute.json()
    assert.equal(statBody.ok, true)
    assert.equal(statBody.entries[0].size, 5)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
