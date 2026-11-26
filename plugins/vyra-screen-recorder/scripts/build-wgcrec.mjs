#!/usr/bin/env node
/**
 * Build the Windows.Graphics.Capture helper.
 *
 * `wgcrec` records a WINDOW's composed surface, so another window covering it
 * does not end up in the video — the thing the GDI path in `lib/frames.ps1`
 * cannot do, and the reason filming the app while a terminal was in front
 * produced the terminal.
 *
 * It is built rather than checked in: the binary is platform-specific and the
 * source is 300 lines, so a source file plus this script is a smaller, auditable
 * artifact than a blob. A machine without the .NET SDK simply skips it, and the
 * recorder falls back to GDI — which is why this script exits 0 when the SDK is
 * missing instead of failing an install.
 *
 * Usage: node scripts/build-wgcrec.mjs [--force]
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const project = join(root, 'native', 'wgcrec', 'wgcrec.csproj')
const output = join(root, 'native', 'wgcrec', 'bin', 'Release', 'net8.0-windows10.0.19041.0', 'wgcrec.exe')

if (process.platform !== 'win32') {
  console.log('build-wgcrec: skipped (Windows only)')
  process.exit(0)
}

if (existsSync(output) && !process.argv.includes('--force')) {
  console.log('build-wgcrec: already built at ' + output)
  process.exit(0)
}

/** The dotnet executable, from PATH or the default install location. */
function dotnet() {
  const fromPath = spawnSync('dotnet', ['--version'], { encoding: 'utf8' })
  if (fromPath.status === 0) return 'dotnet'
  const fallback = 'C:\\Program Files\\dotnet\\dotnet.exe'
  if (existsSync(fallback)) return fallback
  return undefined
}

const cli = dotnet()
if (cli === undefined) {
  // Not an error: the recorder works without this helper, just without the
  // occlusion-proof capture.
  console.log('build-wgcrec: .NET SDK not found; the GDI capture path will be used')
  process.exit(0)
}

console.log('build-wgcrec: building ' + project)
const result = spawnSync(cli, ['build', project, '-c', 'Release', '--nologo'], {
  encoding: 'utf8',
  windowsHide: true,
})

if (result.status !== 0) {
  console.error(result.stdout ?? '')
  console.error(result.stderr ?? '')
  console.error('build-wgcrec: build failed')
  process.exit(1)
}

if (!existsSync(output)) {
  console.error('build-wgcrec: build reported success but ' + output + ' is missing')
  process.exit(1)
}

console.log('build-wgcrec: ' + output)