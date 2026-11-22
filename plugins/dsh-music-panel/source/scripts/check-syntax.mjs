#!/usr/bin/env node
/** Syntax-check the shipped Host/Client source tree without keeping a path list. */
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOTS = ['index.js', 'client.js', 'src/host', 'src/client']
const SKIP = /(?:\.bundle\.js|node_modules|\/vendor\/)/

function walk(target, out = []) {
  const absolute = join(ROOT, target)
  if (statSync(absolute).isFile()) {
    out.push(absolute)
    return out
  }
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = join(absolute, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'vendor') continue
      walk(relative(ROOT, path), out)
    } else if (/\.(?:js|mjs)$/.test(entry.name) && !SKIP.test(relative(ROOT, path).split('\\').join('/'))) {
      out.push(path)
    }
  }
  return out
}

let checked = 0
const failures = []
for (const target of ROOTS) {
  for (const file of walk(target)) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
      checked += 1
    } catch (error) {
      failures.push(`${relative(ROOT, file)}: ${String(error.stderr || error.message).trim()}`)
    }
  }
}

if (failures.length > 0) {
  console.error('[syntax] failed:')
  for (const failure of failures) console.error('  - ' + failure)
  process.exitCode = 1
} else {
  console.log(`[syntax] ok: ${checked} files`)
}

