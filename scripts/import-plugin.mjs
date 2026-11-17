/**
 * Import a plugin maintained outside this repository into `plugins/<name>/`.
 *
 * Two shapes of source come through here. A hand-written bundle carries its
 * whole distribution in the package root, so the copy is filtered by a
 * denylist. A package with a real build step declares `files`, which is
 * already the exact publish set — its `lib/` alone can be a megabyte of
 * emitted modules, and its tests, docs, and configs are large and useless to
 * an install — so that manifest wins and the denylist does not apply.
 *
 * Only the identity strings that must agree for the package to load are
 * rewritten: `package.json`'s `name`, the host half's `export const name`, the
 * cordis row's `name`, and the client bundle's
 * `__ModuleLoader__.load({ id })`. The client id must equal the package name
 * (packages/client/tsdown.client.ts:187) because the module system matches
 * rows by package name; a bundle registering the old name never satisfies the
 * row and the plugin silently never mounts.
 *
 * Not published, and kept out of the plugin's own `files`: this repo builds
 * each plugin from source, and an importer belongs to the act of importing.
 *
 * Usage: node scripts/import-plugin.mjs <source-dir> <target-name>
 *
 * @module dsh-vyra-plugins/import-plugin
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'

/** Directories never copied from a denylist-filtered source. */
const EXCLUDED = ['node_modules', '.git', 'src', 'test', 'tests', 'scripts', 'backups', 'ui']

/** Extensions never copied: archives of the source tree, or dep manifests an install ignores. */
const EXCLUDED_FILES = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package-lock.json'])
const EXCLUDED_SUFFIXES = ['.tgz', '.tar.gz']

/** Entries npm packs regardless of `files`, so a filtered copy must carry them too. */
const ALWAYS_PACKED = new Set(['package.json', 'README.md', 'LICENSE'])

/**
 * `--keep-name` vendors somebody else's package instead of publishing our own.
 *
 * A plugin this repository owns is renamed onto the `vyra-` scope, which is
 * what makes the client bundle's registration id, the cordis row and the
 * manifest agree. A third-party package must keep its own name: renaming it
 * would strip the attribution off code we did not write, and the copy stays a
 * vendored snapshot rather than a fork we maintain.
 */
const keepName = process.argv.includes('--keep-name')
const args = process.argv.slice(2).filter(arg => arg !== '--keep-name')
const [sourceArg, targetArg] = args
if (sourceArg === undefined || targetArg === undefined) {
  console.error('usage: node scripts/import-plugin.mjs [--keep-name] <source-dir> <target-name>')
  process.exit(2)
}

const source = resolve(sourceArg)
const target = resolve(import.meta.dirname, '..', 'plugins', targetArg)
if (!existsSync(join(source, 'package.json'))) throw new Error(`${source} holds no package.json`)

/**
 * Whether one entry of the source belongs in the copy.
 *
 * `filter` runs for every entry at every depth, so the decision is made on the
 * entry's first path segment relative to the source root — a nested
 * `lib/adapter.js` is admitted because `lib` is published, not rejected
 * because `adapter.js` names nothing in `files`.
 *
 * A package declaring `files` is taken at its word: that declaration is the
 * publish set, and second-guessing it with the denylist is how an import
 * silently drops a directory the package needs.
 * @param relative - the entry's path relative to the source root, POSIX-separated.
 * @param declared - the source's `files`, when it declares any.
 * @returns whether to copy the entry.
 */
function wanted(relative, declared) {
  const head = relative.split('/')[0]
  if (head === '' || head === '.') return true
  if (head === 'node_modules' || head === '.git') return false
  if (relative.endsWith('.tgz') || relative.endsWith('.tar.gz')) return false
  if (declared === undefined) {
    return !EXCLUDED.includes(head)
      && !EXCLUDED_FILES.has(head)
      && !EXCLUDED_SUFFIXES.some(suffix => head.endsWith(suffix))
  }
  // npm packs these regardless of `files`: the manifest is the package, and
  // the licence text has to travel with the code it covers.
  if (ALWAYS_PACKED.has(head)) return true
  return declared.some(entry => {
    const named = entry.replace(/\/$/, '')

    // A declared directory admits its whole subtree. A declared *glob* has to
    // admit a path prefix too: `filter` runs for the directories on the way
    // down, so an entry naming `lib/**/*.js` that refuses `lib` and `lib/cli`
    // is an entry whose files are never reached — the glob matches nothing
    // because the walk stopped above it.
    const literalPrefix = named.slice(0, named.search(/[*?]/) === -1 ? named.length : named.lastIndexOf('/', named.search(/[*?]/)))
    if (literalPrefix !== '' && (relative === literalPrefix || relative.startsWith(`${literalPrefix}/`))) return true
    // A directory an entry lives under: `assets/logo.png` publishes `assets`
    // as a way through.
    if (named.startsWith(`${relative}/`)) return true

    if (!named.includes('*')) return relative === named
    // `**` spans directories, `*` does not, and `**/` also matches zero
    // directories — npm's own `files` semantics, which a plain `.*` gets wrong
    // by demanding at least one path segment (`lib/**/*.js` must match
    // `lib/index.js`).
    const pattern = named
      .replaceAll('.', '\\.')
      .replaceAll('**/', '(?:.*/)?')
      .replaceAll('**', '.*')
      .replaceAll('*', '[^/]*')
    return new RegExp(`^${pattern}$`).test(relative)
  })
}

/** Every string standing for the package's identity, replaced in one pass. */
function rewriteIdentity(file, replacements) {
  const path = join(target, file)
  if (!existsSync(path)) return false
  // `files` may name a directory (`lib`, `assets`), which carries no identity
  // string of its own.
  if (!statSync(path).isFile()) return false
  const before = readFileSync(path, 'utf8')
  let after = before
  for (const [from, to] of replacements) after = after.replaceAll(from, to)
  if (after === before) return false
  writeFileSync(path, after)
  return true
}

/**
 * Files this repository authors for the plugin rather than copying from the
 * source. The source directory is a working copy that carries none of them, so
 * a re-import has to carry the existing ones across its wipe — otherwise the
 * README and LICENSE the market shows disappear the second time someone
 * imports an updated build.
 */
const REPO_AUTHORED = ['README.md', 'LICENSE']

/** Read the repo-authored files before the wipe that preserves them across it. */
function preservedFiles() {
  const kept = new Map()
  for (const file of REPO_AUTHORED) {
    const path = join(target, file)
    if (existsSync(path)) kept.set(file, readFileSync(path))
  }
  return kept
}

// Read from the SOURCE: `files` and the old name must be known before the copy
// that filters and renames by them, and the target does not exist yet.
// A hand-written manifest can carry a BOM (`ssh-terminal`'s does), which
// JSON.parse rejects.
const sourceManifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8').replace(/^﻿/u, ''))
const previous = sourceManifest.name
const declaredFiles = Array.isArray(sourceManifest.files) ? sourceManifest.files : undefined

const preserved = preservedFiles()
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(source, target, {
  recursive: true,
  // Decided on the path relative to the source root: the root itself has no
  // relative form (the `''` case `wanted` admits), and nested entries are
  // judged by their first segment rather than their base name.
  filter: from => wanted(relative(source, from).split(sep).join('/'), declaredFiles),
})

const restored = []
for (const [file, bytes] of preserved) {
  // Only restore what the copy did not bring, so a source that does ship its
  // own README wins over the stale copy this repository held.
  if (existsSync(join(target, file))) continue
  writeFileSync(join(target, file), bytes)
  restored.push(file)
}

const replacements = [
  [previous, targetArg],
  // The client bundle's id and the cordis row both spell the same name; a
  // preset bundle prefix (`@local/agent-preset-<id>`) is a runtime-generated
  // name for a *different* package and is deliberately left alone.
  [`'${previous}'`, `'${targetArg}'`],
  [`"${previous}"`, `"${targetArg}"`],
]

// Every file the copy may have placed an identity string in: the root halves,
// the emitted modules under `lib/`, and whatever `files` declared.
const candidates = [
  'package.json', 'index.js', 'client.js', 'cordis.patch.yml',
  'core.js', 'tool.js', 'tool-policy.js', 'translate-core.js', 'themes.js',
  ...(declaredFiles ?? []).flatMap(entry => entry.includes('*') ? [] : [entry]),
  ...['lib/index.js', 'lib/client.js', 'lib/index.d.ts'],
]
// A vendored third-party copy keeps its name, so there is nothing to rewrite
// and no risk of renaming an inner reference that merely looks like the name.
const touched = keepName ? [] : [...new Set(candidates)].filter(file => rewriteIdentity(file, replacements))

// `package.json` is rewritten as a parsed value so the copy keeps its own
// formatting. A vendored copy keeps its own name, and therefore its manifest.
if (!keepName) {
  const copyManifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8').replace(/^﻿/u, ''))
  copyManifest.name = targetArg
  writeFileSync(join(target, 'package.json'), `${JSON.stringify(copyManifest, undefined, 2)}\n`)
}

console.log(keepName ? `vendored ${targetArg} (name kept)` : `${previous} -> ${targetArg}`)
console.log(`  touched: ${touched.join(', ') || '(nothing)'}`)
