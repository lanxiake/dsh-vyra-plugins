/**
 * Import a plugin maintained outside this repository into `plugins/<name>/`.
 *
 * The source packages are hand-written ESM/IIFE bundles with no build step of
 * their own, so this copies them verbatim and rewrites only the identity
 * strings that must agree for the package to load: `package.json`'s `name`,
 * the host half's `export const name`, the cordis row's `name`, and the client
 * bundle's `__ModuleLoader__.load({ id })`. The client id must equal the
 * package name (packages/client/tsdown.client.ts:187) because the module
 * system matches rows by package name; a bundle registering the old name never
 * satisfies the row and the plugin silently never mounts.
 *
 * Not published, and kept out of the plugin's own `files`: this repo builds
 * each plugin from source, and an importer belongs to the act of importing.
 *
 * Usage: node scripts/import-plugin.mjs <source-dir> <target-name>
 *
 * @module dsh-vyra-plugins/import-plugin
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

/** Directories never copied: build inputs a marketplace install cannot use. */
const EXCLUDED = ['node_modules', '.git', 'src', 'test', 'tests', 'scripts', 'backups', 'ui']

/** Extensions never copied: archives of the source tree, or dep manifests an install ignores. */
const EXCLUDED_FILES = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package-lock.json'])

const [sourceArg, targetArg] = process.argv.slice(2)
if (sourceArg === undefined || targetArg === undefined) {
  console.error('usage: node scripts/import-plugin.mjs <source-dir> <target-name>')
  process.exit(2)
}

const source = resolve(sourceArg)
const target = resolve(import.meta.dirname, '..', 'plugins', targetArg)
if (!existsSync(join(source, 'package.json'))) throw new Error(`${source} holds no package.json`)

/** Every string standing for the package's identity, replaced in one pass. */
function rewriteIdentity(file, replacements) {
  const path = join(target, file)
  if (!existsSync(path)) return false
  const before = readFileSync(path, 'utf8')
  let after = before
  for (const [from, to] of replacements) after = after.replaceAll(from, to)
  if (after === before) return false
  writeFileSync(path, after)
  return true
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(source, target, {
  recursive: true,
  filter: (from) => {
    const name = basename(from)
    if (EXCLUDED.includes(name)) return false
    return !EXCLUDED_FILES.has(name)
  },
})

// A hand-written manifest can carry a BOM (`ssh-terminal`'s does), which
// JSON.parse rejects. Dropping it here also strips it from the copy.
const manifestPath = join(target, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^﻿/u, ''))
const previous = manifest.name
const replacements = [
  [previous, targetArg],
  // The client bundle's id and the cordis row both spell the same name; a
  // preset bundle prefix (`@local/agent-preset-<id>`) is a runtime-generated
  // name for a *different* package and is deliberately left alone.
  [`'${previous}'`, `'${targetArg}'`],
  [`"${previous}"`, `"${targetArg}"`],
]

const touched = [
  'package.json', 'index.js', 'client.js', 'cordis.patch.yml',
  'core.js', 'tool.js', 'tool-policy.js', 'translate-core.js',
].filter(file => rewriteIdentity(file, replacements))

// `package.json` is rewritten as a parsed value so the copy keeps its own formatting.
manifest.name = targetArg
writeFileSync(join(target, 'package.json'), `${JSON.stringify(manifest, undefined, 2)}\n`)

console.log(`${previous} -> ${targetArg}`)
console.log(`  touched: ${touched.join(', ')}`)
