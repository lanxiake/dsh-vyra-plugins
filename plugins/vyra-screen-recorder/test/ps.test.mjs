import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const lib = path.join(here, '..', 'lib')
const windows = process.platform === 'win32'
const timeout = 120000

function run(script, args) {
  return execFileSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', path.join(lib, script), ...args,
  ], { encoding: 'utf8', timeout, windowsHide: true })
}

test('shot.ps1 抓一张 JPEG', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-shot-test-'))
  try {
    const file = path.join(dir, 'shot.jpg')
    run('shot.ps1', ['-Out', file, '-Quality', '80'])
    const buffer = await readFile(file)
    assert.ok(buffer.length > 1000, 'JPEG 太小：' + buffer.length)
    assert.deepEqual([...buffer.subarray(0, 3)], [0xff, 0xd8, 0xff])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('sources.ps1 返回虚拟桌面和显示器', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-sources-test-'))
  try {
    const file = path.join(dir, 'sources.json')
    run('sources.ps1', ['-Out', file])
    const data = JSON.parse(await readFile(file, 'utf8'))
    assert.equal(data.ok, true)
    assert.ok(data.virtual.w > 0 && data.virtual.h > 0)
    assert.ok(Array.isArray(data.monitors) && data.monitors.length >= 1)
    assert.ok(Array.isArray(data.windows))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('frames.ps1 录出一组带时间戳的帧', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-frames-test-'))
  try {
    run('frames.ps1', ['-OutDir', dir, '-Region', '0,0,320,240', '-Fps', '5', '-MaxSeconds', '2', '-Quality', '60', '-MaxEdge', '0'])
    const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8'))
    assert.equal(meta.width, 320)
    assert.equal(meta.height, 240)
    assert.equal(meta.fps, 5)
    const lines = (await readFile(path.join(dir, 'frames.jsonl'), 'utf8')).trim().split('\n').filter(Boolean)
    assert.ok(lines.length >= 5, '帧数太少：' + lines.length)
    const first = JSON.parse(lines[0])
    assert.equal(first.t, 0)
    const info = await stat(path.join(dir, first.file))
    assert.ok(info.size > 500)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('audio.ps1 录出 WAV', { skip: !windows, timeout }, async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-audio-test-'))
  try {
    const file = path.join(dir, 'audio.wav')
    try {
      run('audio.ps1', ['-Out', file, '-MaxSeconds', '2'])
    } catch (error) {
      t.skip('没有可用的播放设备：' + String(error && error.message).slice(0, 200))
      return
    }
    const buffer = await readFile(file)
    assert.ok(buffer.length >= 44)
    assert.equal(buffer.subarray(0, 4).toString('ascii'), 'RIFF')
    assert.equal(buffer.subarray(8, 12).toString('ascii'), 'WAVE')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
