/**
 * Check that every plugin in this repository can actually be installed and loaded.
 *
 * Written after two publishing bugs reached a user, both of which this would have caught before
 * the push:
 *   - a package carrying `prepare: lefthook install`, which pnpm runs on a git install where the
 *     fetched tarball has no `.git` — the install aborts with ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED;
 *   - a package whose `main` pointed at a file the import had not copied.
 *
 * The checks are the ones a consumer's package manager and the harness's loader perform, in the
 * order they perform them: hooks first (they abort the install), then the entry points a loader
 * imports, then whatever `files` promises. A check that only looks at `files` would have passed
 * the `prepare` case, because that field is declared correctly and is simply wrong to have.
 *
 * Usage: node scripts/check-installable.mjs
 *
 * @module dsh-vyra-plugins/check-installable
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Package-manager hooks that run on the consumer's machine.
 *
 * Only `prepare` was observed blocking an install, but every hook here runs during one, and none
 * of them can work in a tarball: the inputs they name live in the development tree, which `files`
 * does not publish.
 */
const INSTALL_HOOKS = ['prepare', 'prepareModule', 'prepublish', 'prepublishOnly', 'prepack', 'postinstall', 'install']

const root = resolve(import.meta.dirname, '..')

/** What a manifest resolves its entry point to, accepting either spelling. */
function entryOf(manifest) {
  if (typeof manifest.main === 'string') return manifest.main
  const dot = manifest.exports?.['.']
  if (typeof dot === 'string') return dot
  if (typeof dot === 'object' && dot !== null && typeof dot.default === 'string') return dot.default
  return undefined
}

/** The `./client` export's path, in either of the two forms `exports` allows. */
function clientOf(manifest) {
  const client = manifest.exports?.['./client']
  if (typeof client === 'string') return client
  if (typeof client === 'object' && client !== null && typeof client.default === 'string') return client.default
  return undefined
}

const problems = []
const failures = (name, what) => problems.push(`${name}: ${what}`)

for (const dir of readdirSync(join(root, 'plugins'))) {
  const packageRoot = join(root, 'plugins', dir)
  const manifestPath = join(packageRoot, 'package.json')
  if (!existsSync(manifestPath)) continue

  // A hand-written manifest can carry a BOM; `ssh-terminal`'s does, and JSON.parse rejects it.
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^﻿/u, ''))
  const name = manifest.name ?? dir
  const at = (...segments) => join(packageRoot, ...segments)

  for (const hook of INSTALL_HOOKS) {
    const command = manifest.scripts?.[hook]
    if (command !== undefined) failures(name, `declares "${hook}": ${String(command)}`)
  }

  const entry = entryOf(manifest)
  if (entry === undefined) failures(name, 'declares no entry point (`main` or `exports["."]`)')
  else if (!existsSync(at(entry.replace(/^\.\//, '')))) failures(name, `entry "${entry}" does not exist`)

  const patch = manifest.dsh?.bundle?.patch
  if (patch !== undefined && !existsSync(at(String(patch).replace(/^\.\//, '')))) {
    failures(name, `dsh.bundle.patch "${patch}" does not exist`)
  }

  if (manifest.dsh?.client !== undefined) {
    const client = clientOf(manifest)
    if (client === undefined) failures(name, 'declares dsh.client but exports no "./client"')
    else if (!existsSync(at(client.replace(/^\.\//, '')))) failures(name, `"./client" "${client}" does not exist`)
  }

  // Every literal entry `files` promises. A glob is checked by `npm pack`, not here.
  for (const entry of manifest.files ?? []) {
    if (entry.includes('*')) continue
    if (!existsSync(at(entry.replace(/\/$/, '')))) failures(name, `files names "${entry}", which does not exist`)
  }
}

if (problems.length > 0) {
  console.error(`check-installable: ${String(problems.length)} problem(s)`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('check-installable: every plugin installs and loads')
