import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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
