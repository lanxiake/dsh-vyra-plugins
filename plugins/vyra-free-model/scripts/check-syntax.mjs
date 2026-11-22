/**
 * Syntax gate for this plugin.
 *
 * There is no build step and no bundler, so a typo in any entry point reaches
 * the user as a blank settings page or a plugin that refuses to mount. This
 * walks every JavaScript file the package ships and asks Node to parse it.
 *
 * `client.js` is a browser bundle and is checked when it exists; a plugin still
 * being built has no client half yet, and that is not an error.
 *
 * @module scripts/check-syntax
 */

import { readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

/** Every `.js`/`.mjs` under one directory, recursively. */
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      out.push(...walk(full))
      continue
    }
    if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(full)
  }
  return out
}

const targets = [
  ...walk(join(root, 'src')),
  ...walk(join(root, 'test')),
  ...walk(join(root, 'scripts')),
  join(root, 'index.js'),
]
const client = join(root, 'client.js')
if (existsSync(client)) targets.push(client)

let failed = 0
for (const file of targets) {
  try {
    // `--check` parses without executing, so a browser-only bundle is safe here.
    await run(process.execPath, ['--check', file])
  } catch (error) {
    failed += 1
    console.error(`syntax error in ${file.replace(root + '/', '').replace(root + '\\', '')}`)
    console.error(String(error.stderr ?? error.message).trim())
  }
}

if (failed > 0) {
  console.error(`${failed} file(s) failed`)
  process.exit(1)
}
console.log(`syntax ok (${targets.length} files)`)
