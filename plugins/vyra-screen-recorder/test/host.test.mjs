import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { __test } from '../index.js'

const { safeName, normalizeSource, clamp, readFrames, countFrames } = __test

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
