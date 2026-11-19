/**
 * Run every check for this plugin.
 *
 * Unit tests run straight through Node's test runner and type stripping.
 * The two harness checks need `@deepseek-ai/cordis` and the storage helpers, so
 * they run through `tsx` from the `dsh-Veyra` checkout, located by `DSH_SOURCE`.
 *
 * @module vyra-tool-usage-stats/check
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const here = import.meta.dirname
const packageRoot = resolve(here, '..')
const sourceRoot = process.env.DSH_SOURCE ?? resolve(packageRoot, '..', '..', '..', 'dsh-Veyra')

// The window selector and the request must name the same windows. The host
// answers only the windows a request names, so an offered entry the request
// omits renders as a permanently empty tab — which is exactly how "最近 3 天"
// and "今天" were blank while "所有" worked.
const clientSource = readFileSync(resolve(packageRoot, 'lib', 'client.js'), 'utf8')
const offered = [...clientSource.matchAll(/\{ value: "(\d+)", label: /g)]
  .map(match => match[1])
  .filter(value => value !== '0')
assert.ok(offered.length >= 2, 'the selector still offers windowed views')
assert.match(clientSource, /WINDOW_QUERY = WINDOWS\.filter/, 'the query is built from the selector')
assert.match(clientSource, /call\(`\$\{ENDPOINT\}\?\$\{WINDOW_QUERY\}`\)/, 'the request sends the built query')

/** Run one command, exiting with its status on failure. */
function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('node', ['--test', 'tests/counters.test.ts', 'tests/panel-copy.test.ts'], packageRoot)

if (!existsSync(sourceRoot)) {
  console.log(`check: harness checks skipped — no dsh-Veyra checkout at ${sourceRoot}`)
  console.log('       set DSH_SOURCE to run them.')
  process.exit(0)
}

for (const test of ['integration.ts', 'storage.ts', 'session-e2e.ts', 'boot-timers.ts']) {
  console.log(`\n=== ${test} ===`)
  run('npx', ['tsx', resolve(here, test)], sourceRoot)
}

console.log('\ncheck: all plugin checks passed.')
