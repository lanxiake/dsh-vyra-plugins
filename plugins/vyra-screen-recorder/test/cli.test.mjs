import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const cli = path.join(here, '..', 'bin', 'vsr.mjs')
const windows = process.platform === 'win32'
const timeout = 120000

test('vsr --version / --help', () => {
  const version = execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8', timeout }).trim()
  assert.match(version, /^\d+\.\d+\.\d+/)
  const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8', timeout })
  assert.match(help, /vsr shot/)
  assert.match(help, /vsr record/)
})

test('vsr sources --json', { skip: !windows, timeout }, () => {
  const output = execFileSync(process.execPath, [cli, 'sources', '--json'], { encoding: 'utf8', timeout, windowsHide: true })
  const data = JSON.parse(output)
  assert.equal(data.ok, true)
  assert.ok(data.virtual.w > 0)
  assert.ok(Array.isArray(data.monitors) && data.monitors.length >= 1)
})

test('vsr shot 写出 JPEG', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-cli-test-'))
  try {
    const file = path.join(dir, 'shot.jpg')
    const output = execFileSync(process.execPath, [cli, 'shot', '--out', file], { encoding: 'utf8', timeout, windowsHide: true })
    assert.match(output, /^file=/m)
    const buffer = await readFile(file)
    assert.ok(buffer.length > 1000)
    assert.deepEqual([...buffer.subarray(0, 3)], [0xff, 0xd8, 0xff])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('vsr files --json 读取设置目录', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'vsr-cli-home-'))
  try {
    const library = path.join(home, 'library')
    await mkdir(path.join(library, 'recordings'), { recursive: true })
    await mkdir(path.join(library, 'screenshots'), { recursive: true })
    await mkdir(path.join(home, 'vyra-screen-recorder'), { recursive: true })
    await writeFile(path.join(home, 'vyra-screen-recorder', 'settings.json'), JSON.stringify({ dir: library }))
    await writeFile(path.join(library, 'recordings', 'a.mp4'), 'x')
    await writeFile(path.join(library, 'screenshots', 'b.jpg'), 'y')
    const output = execFileSync(process.execPath, [cli, 'files', '--json'], {
      encoding: 'utf8', timeout, windowsHide: true, env: { ...process.env, DSH_HOME: home },
    })
    const data = JSON.parse(output)
    assert.equal(data.ok, true)
    assert.equal(data.root, library)
    assert.ok(data.files.some(file => file.name === 'a.mp4' && file.kind === 'video'))
    assert.ok(data.files.some(file => file.name === 'b.jpg' && file.kind === 'image'))
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
