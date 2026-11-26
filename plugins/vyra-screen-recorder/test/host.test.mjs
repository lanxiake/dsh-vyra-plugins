import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { __test } from '../index.js'

const {
  safeName, normalizeSource, clamp, readFrames, countFrames,
  normalizeSettings, recordingsDir, screenshotsDir,
  captureShotFast, stopShotServer,
} = __test

test('safeName 去掉路径和非法字符', () => {
  assert.equal(safeName('../../evil.webm', 'x.webm'), 'evil.webm')
  assert.equal(safeName('a<b>c.webm', 'x.webm'), 'a-b-c.webm')
  assert.equal(safeName('   ', 'fallback.webm'), 'fallback.webm')
  assert.ok(safeName('长'.repeat(300) + '.webm', 'x').length <= 120)
})

test('clamp 夹到范围内', () => {
  assert.equal(clamp(11, 0, 10, 5), 10)
  assert.equal(clamp(-3, 0, 10, 5), 0)
  assert.equal(clamp('abc', 0, 10, 5), 5)
  assert.equal(clamp(4.6, 0, 10, 5), 5)
})

test('normalizeSource 接受桌面 / 显示器 / 区域 / 窗口', () => {
  assert.deepEqual(normalizeSource({ type: 'desktop' }), { type: 'desktop' })
  assert.deepEqual(normalizeSource({ type: 'monitor', x: 10, y: 20, w: 800, h: 600, name: 'DISPLAY1' }), {
    type: 'region', x: 10, y: 20, w: 800, h: 600, name: 'DISPLAY1',
  })
  assert.deepEqual(normalizeSource({ type: 'window', hwnd: 1234, title: 'x' }), {
    type: 'window', hwnd: 1234, title: 'x',
  })
  assert.throws(() => normalizeSource({ type: 'region', w: 4, h: 4 }), /区域太小/)
  assert.throws(() => normalizeSource({ type: 'window', hwnd: -1 }), /窗口句柄无效/)
})

test('视频/截图目录可以分别配置', () => {
  const settings = normalizeSettings({ videoDir: 'E:\\录屏', shotDir: 'E:\\截图' })
  assert.equal(recordingsDir(settings), 'E:\\录屏')
  assert.equal(screenshotsDir(settings), 'E:\\截图')
  const fallback = normalizeSettings({ dir: 'E:\\资料' })
  assert.equal(recordingsDir(fallback), path.join('E:\\资料', 'recordings'))
  assert.equal(screenshotsDir(fallback), path.join('E:\\资料', 'screenshots'))
  // 相对路径和空值都不接受，避免落到进程工作目录。
  const empty = normalizeSettings({ videoDir: 'relative/dir', shotDir: '   ' })
  assert.equal(empty.videoDir, '')
  assert.equal(empty.shotDir, '')
})

test('captureShotFast 用常驻服务抓 JPEG', { skip: process.platform !== 'win32', timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-host-shot-'))
  try {
    const file = path.join(dir, 'shot.jpg')
    const line = await captureShotFast({ out: file, quality: 80, region: '0,0,320,240' })
    assert.ok(line === null || /^OK hidden=\d+$/.test(line), '返回：' + line)
    if (line !== null) {
      const buffer = await readFile(file)
      assert.ok(buffer.length > 500)
      assert.deepEqual([...buffer.subarray(0, 3)], [0xff, 0xd8, 0xff])
    }
  } finally {
    stopShotServer()
    await rm(dir, { recursive: true, force: true })
  }
})

test('截图服务停掉后还能重新启动', { skip: process.platform !== 'win32', timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-host-shot-restart-'))
  try {
    const first = path.join(dir, 'first.jpg')
    assert.match(await captureShotFast({ out: first, quality: 70, region: '0,0,160,120' }), /^OK/)
    stopShotServer()
    const second = path.join(dir, 'second.jpg')
    assert.match(await captureShotFast({ out: second, quality: 70, region: '0,0,160,120' }), /^OK/)
    assert.ok((await readFile(second)).length > 200)
  } finally {
    stopShotServer()
    await rm(dir, { recursive: true, force: true })
  }
})

test('readFrames 忽略半行和坏行', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-host-test-'))
  try {
    await writeFile(path.join(dir, 'frames.jsonl'), [
      '{"i":0,"t":0,"file":"f000000.jpg"}',
      '{"i":1,"t":125,"file":"f000001.jpg"}',
      '{bad json',
      '',
      '{"i":2,"t":"x","file":"f000002.jpg"}',
    ].join('\n'))
    const frames = await readFrames(dir)
    assert.equal(frames.length, 2)
    assert.equal(frames[0].file, 'f000000.jpg')
    assert.equal(frames[1].t, 125)
    assert.equal(await countFrames(dir), 0)
    await writeFile(path.join(dir, 'f000000.jpg'), 'x')
    await writeFile(path.join(dir, 'f000001.jpg'), 'x')
    assert.equal(await countFrames(dir), 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// /agent/stop — ending an agent recording early.
//
// Before this route the only thing that ended a recording was its timer, so a
// pipeline that finished in four seconds had to sit out the whole duration or
// encode minutes of dead air. Stopping goes through the same finishAgentJob()
// the timer uses, so the browser half cannot tell the two apart.
// ---------------------------------------------------------------------------

/** A response object that records what a handler wrote. */
function captureRes() {
  const res = {
    status: undefined,
    body: undefined,
    writeHead(code, headers) { this.status = code; this.headers = headers; return this },
    end(body) { this.body = body },
    get json() { return this.body === undefined ? undefined : JSON.parse(this.body) },
  }
  return res
}

/** A request with a URL suffix and an empty body. */
function captureReq(method, suffix = '') {
  return {
    method,
    url: '/api/dsh-vyra-screen-recorder/agent/stop' + suffix,
    async *[Symbol.asyncIterator]() {},
  }
}

test('/agent/stop rejects a non-POST', async () => {
  const res = captureRes()
  await __test.handleAgentStop(captureReq('GET'), res)
  assert.equal(res.status, 405)
  assert.equal(res.json.ok, false)
})

test('/agent/stop with no running job answers stopped:false, not an error', async () => {
  // A caller that raced the timer must not see a failure: the recording it
  // wanted stopped is already stopped, which is the outcome it asked for.
  const res = captureRes()
  await __test.handleAgentStop(captureReq('POST', '?id=nope'), res)
  assert.equal(res.status, 200)
  assert.equal(res.json.ok, true)
  assert.equal(res.json.stopped, false)
  assert.match(res.json.reason, /没有这个 Agent 录制/u)
})

test('/agent/stop does not require an id to be well formed', async () => {
  // An id-less call is the same "nothing is running" case, and answering it with
  // a 400 would make the simplest call shape look broken.
  const res = captureRes()
  await __test.handleAgentStop(captureReq('POST'), res)
  assert.equal(res.status, 200)
  assert.equal(res.json.stopped, false)
})
