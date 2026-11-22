#!/usr/bin/env node
/**
 * Dev install: copy this checkout's built package into a DSH profile.
 *
 * The desktop app (and `dsh web`) load a plugin from
 * `<DSH_HOME>/profiles/<profile>/node_modules/<name>`, a real copy — so editing and
 * rebuilding this repository changes nothing in the running app until the copy is
 * updated. This script does that copy, after checking that `client.js` is current.
 *
 *   node scripts/install-local.mjs                 # profile "desktop"
 *   node scripts/install-local.mjs web             # another profile
 *   node scripts/install-local.mjs desktop --home D:/dsh-home
 *
 * The installed directory's own `node_modules` (the plugin's dependencies) is kept.
 * A backup of the previous install goes to `<DSH_HOME>/backups/`.
 *
 * @module dsh-music-panel/install-local
 */

import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY_FILES = [
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'icon.svg',
  'README.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'CHANGELOG.md',
  'package.json',
]
// `src/` ships only the Host half (`src/host/**`); the client and the Folia styles are
// already bundled into `client.js`, and `locale/` is a directory of its own.
const HOST_SOURCE = join(ROOT, 'src', 'host')
const LOCALE_SOURCE = join(ROOT, 'locale')
// The plugin-details page reads meta.detail from locale and the document/image it names.
const DETAIL_FILES = ['docs/使用详情-英文.md', 'docs/使用详情.md', 'docs/preview.svg']

function argumentOf(argv, flag) {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
}

/** True when the path is a directory (a missing path is not an error here). */
async function directoryExists(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

const argv = process.argv.slice(2)
const requestedHome = argumentOf(argv, '--home')
const home = resolve(requestedHome ?? process.env.DSH_HOME?.trim() ?? join(homedir(), '.dsh'))
const profile = argv.find((arg, index) => !arg.startsWith('--') && (argv.indexOf('--home') < 0 || index !== argv.indexOf('--home') + 1))
  ?? 'desktop'

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
const target = join(home, 'profiles', profile, 'node_modules', pkg.name)

if (!(await directoryExists(target))) {
  console.error(`[install-local] not installed: ${target}`)
  console.error('[install-local] add the plugin to the profile first (Settings → Plugins, or pnpm add).')
  process.exit(1)
}

// A linked install already IS this checkout. Copying into it would write through
// the junction and, on the rm(src) step below, delete the repository itself.
if (await realpath(target) !== resolve(target)) {
  console.error(`[install-local] target is a link, not a profile copy: ${target}`)
  console.error('[install-local] linked installs already load this checkout; no copy is needed.')
  process.exit(1)
}

// A stale bundle is the whole reason this script exists: refuse to copy one.
const check = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-client.mjs'), '--check'], {
  cwd: ROOT,
  encoding: 'utf8',
})
if (check.status !== 0) {
  console.error('[install-local] client.js is not current — run `node scripts/build-client.mjs` first.')
  process.stderr.write(check.stdout || '')
  process.stderr.write(check.stderr || '')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = join(home, 'backups', `${pkg.name}-installed-${stamp}`)
await mkdir(backup, { recursive: true })
for (const name of [...ENTRY_FILES, 'src', 'locale', 'docs']) {
  const source = join(target, name)
  if (await directoryExists(source)) {
    await cp(source, join(backup, name), { recursive: true })
  } else {
    await cp(source, join(backup, name)).catch(() => {})
  }
  console.log(`[install-local] backed up ${name}`)
}

for (const name of ENTRY_FILES) {
  await cp(join(ROOT, name), join(target, name))
  console.log(`[install-local] copied ${name}`)
}
// The shipped package has `src/host` only; replacing the whole tree also removes files an
// earlier (mistaken) copy left behind.
await rm(join(target, 'src'), { recursive: true, force: true })
await mkdir(join(target, 'src'), { recursive: true })
await cp(HOST_SOURCE, join(target, 'src', 'host'), { recursive: true })
console.log('[install-local] copied src/host/')
await rm(join(target, 'locale'), { recursive: true, force: true })
await cp(LOCALE_SOURCE, join(target, 'locale'), { recursive: true })
console.log('[install-local] copied locale/')
for (const name of DETAIL_FILES) {
  await mkdir(dirname(join(target, name)), { recursive: true })
  await cp(join(ROOT, name), join(target, name))
}
console.log('[install-local] copied plugin details/')

console.log(`[install-local] ${pkg.name}@${pkg.version} → ${target}`)
console.log('[install-local] backup: ' + backup)
console.log('[install-local] fully quit and restart DSH to load it (a window reload keeps the old Host).')
