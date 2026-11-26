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
import { Script } from 'node:vm'
import { unshippedModules, unresolvableImports } from './lib/check-imports.mjs'

/**
 * Package-manager hooks that run on the consumer's machine.
 *
 * Only `prepare` was observed blocking an install, but every hook here runs during one, and none
 * of them can work in a tarball: the inputs they name live in the development tree, which `files`
 * does not publish.
 */
const INSTALL_HOOKS = ['prepare', 'prepareModule', 'prepublish', 'prepublishOnly', 'prepack', 'postinstall', 'install']

/**
 * Package names carry the `dsh-` prefix, scoped names keeping it after the scope
 * (`@scope/dsh-*`). It is how someone scanning npm tells a DSH plugin apart from
 * an unrelated package with a similar name, so it is enforced here rather than
 * trusted to review. Every package in `plugins/` obeys it today, third-party
 * snapshots included.
 */
const NAME_PATTERN = /^(?:@[^/]+\/)?dsh-/u

/**
 * Packages allowed to keep a name without the prefix. Each needs a reason that
 * survives a rename; the list is empty, so every plugin under `plugins/` now
 * follows the `dsh-` convention.
 */
const NAME_EXCEPTIONS = new Set([])

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
/** Client bundles in load order, for the shared-lexical-scope compile check. */
const clientBundles = []

for (const dir of readdirSync(join(root, 'plugins'))) {
  const packageRoot = join(root, 'plugins', dir)
  const manifestPath = join(packageRoot, 'package.json')
  if (!existsSync(manifestPath)) continue

  // A hand-written manifest can carry a BOM; `ssh-terminal`'s does, and JSON.parse rejects it.
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^﻿/u, ''))
  const name = manifest.name ?? dir
  const at = (...segments) => join(packageRoot, ...segments)

  // The name is what a consumer reads in npm and in a profile, and it cannot be
  // fixed after publishing — a rename there is a new package. Third-party
  // snapshots keep upstream's name, and upstream follows the same rule.
  if (typeof manifest.name !== 'string') failures(dir, 'package.json has no "name"')
  else if (!NAME_PATTERN.test(manifest.name) && !NAME_EXCEPTIONS.has(manifest.name)) {
    failures(manifest.name, 'name lacks the "dsh-" prefix (scoped names: "@scope/dsh-...")')
  }

  for (const hook of INSTALL_HOOKS) {
    const command = manifest.scripts?.[hook]
    if (command !== undefined) failures(name, `declares "${hook}": ${String(command)}`)
  }

  const entry = entryOf(manifest)
  if (entry === undefined) failures(name, 'declares no entry point (`main` or `exports["."]`)')
  else if (!existsSync(at(entry.replace(/^\.\//, '')))) failures(name, `entry "${entry}" does not exist`)

  // Existence on disk is not publication. dsh-vyra-dsh-console 0.1.2 imported
  // tool.js and domains/*.js from index.js while `files` named neither, so every
  // installation failed with ERR_MODULE_NOT_FOUND at load and this script — which
  // only asked whether the entry file was present — stayed green. These two
  // checks ask the questions that release actually failed.
  if (entry !== undefined && existsSync(at(entry.replace(/^\.\//, '')))) {
    const entryAbs = at(entry.replace(/^\.\//, ''))
    for (const miss of unresolvableImports(entryAbs)) {
      failures(name, `entry imports "${miss.specifier}" from ${miss.from.split(/[\\/]plugins[\\/]/u).at(-1)}, which does not exist`)
    }
    for (const rel of unshippedModules(entryAbs, packageRoot, manifest.files)) {
      failures(name, `entry imports "${rel}" but files does not publish it`)
    }
  }

  const patch = manifest.dsh?.bundle?.patch
  if (patch !== undefined && !existsSync(at(String(patch).replace(/^\.\//, '')))) {
    failures(name, `dsh.bundle.patch "${patch}" does not exist`)
  }

  if (manifest.dsh?.client !== undefined) {
    const client = clientOf(manifest)
    if (client === undefined) failures(name, 'declares dsh.client but exports no "./client"')
    else if (!existsSync(at(client.replace(/^\.\//, '')))) failures(name, `"./client" "${client}" does not exist`)
    else {
      const text = readFileSync(at(client.replace(/^\.\//, '')), 'utf8')
      clientBundles.push({ name, file: client, text })
      // A package-local `require('./x')` never resolves in the browser: the
      // client module system's require knows only platform seeds, materialized
      // modules and registered factories, and only `require.async('./client.*.js')`
      // reaches a package-local chunk (client/modules/src/client/system.ts).
      // dsh-vyra-dsh-console shipped one, so its panel could never mount.
      for (const match of text.matchAll(/\brequire\s*\(\s*['"](\.[^'"]*)['"]\s*\)/gu)) {
        failures(name, `client bundle requires "${match[1]}" package-locally, which never resolves in the browser; inline it`)
      }
    }
  }

  // Every literal entry `files` promises. A glob is checked by `npm pack`, not here.
  for (const entry of manifest.files ?? []) {
    if (entry.includes('*')) continue
    if (!existsSync(at(entry.replace(/\/$/, '')))) failures(name, `files names "${entry}", which does not exist`)
  }

  // The contact block is a repository-wide development rule: every plugin README names
  // the group, and the QR it renders ships in `files` — otherwise the market detail
  // page renders a broken image. `pnpm run contact` writes the README half.
  const readme = at('README.md')
  if (!existsSync(readme)) failures(name, 'missing README.md (the contact block lives there)')
  else if (!readFileSync(readme, 'utf8').includes('1121362543')) {
    failures(name, 'README.md has no contact block (QQ group 1121362543); run "pnpm run contact"')
  }
  const qr = 'assets/qq-group.png'
  const shipsQr = (manifest.files ?? []).some((entry) => {
    const value = String(entry).replace(/\/$/, '')
    return value === 'assets' || (value.startsWith('assets/') && (value === qr || value.includes('*')))
  })
  if (!existsSync(at(qr))) failures(name, `missing ${qr} (contact QR)`)
  else if (!shipsQr) failures(name, `files does not include ${qr}`)
}

// Every plugin client bundle executes as a classic script on the same page, so their
// top-level lexical declarations (`const`, `let`, `class`) share ONE scope even when they
// arrive in different batches. Two plugins that both declare `const RPC` therefore throw
// "Identifier 'RPC' has already been declared" for every later bundle, and the loader
// reports each as "loaded without registering". Compiling the concatenation reproduces
// exactly that collision without a browser; wrap each bundle in an IIFE to keep its names
// private, or move the declarations inside the factory.
if (clientBundles.length > 0) {
  try {
    new Script(clientBundles.map((bundle) => `${bundle.text}\n;\n`).join(''))
  } catch (error) {
    const culprit = /Identifier '([^']+)' has already been declared/u.exec(String(error.message))?.[1]
    const owners = culprit === undefined
      ? clientBundles.map((bundle) => bundle.name).join(', ')
      : clientBundles
        .filter((bundle) => new RegExp(`\\b(?:const|let|class)\\s+${culprit}\\b`, 'u').test(bundle.text))
        .map((bundle) => bundle.name)
        .join(', ')
    failures('client bundles', `do not compile together (${String(error.message)}); shared top-level name${culprit === undefined ? '' : ` "${culprit}"`}; wrap each bundle in an IIFE or move declarations inside the factory. Declared by: ${owners}`)
  }
}

if (problems.length > 0) {
  console.error(`check-installable: ${String(problems.length)} problem(s)`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('check-installable: every plugin installs and loads')
