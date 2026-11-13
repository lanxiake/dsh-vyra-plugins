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
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const here = import.meta.dirname
const packageRoot = resolve(here, '..')
const sourceRoot = process.env.DSH_SOURCE ?? resolve(packageRoot, '..', '..', '..', 'dsh-Veyra')

/** Run one command, exiting with its status on failure. */
function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('node', ['--test', 'tests/counters.test.ts'], packageRoot)

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
