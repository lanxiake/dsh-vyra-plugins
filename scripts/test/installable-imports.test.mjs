// Regression cover for the packaging bug that shipped 0.1.2 of
// dsh-vyra-dsh-console unusable: `files` omitted tool.js and domains/, so
// index.js threw ERR_MODULE_NOT_FOUND at load while check-installable passed.
//
//   node --test scripts/test/installable-imports.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { staticImportsOf, unshippedModules, unresolvableImports } from '../lib/check-imports.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/** Build a throwaway module tree and return its root. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-imports-'))
  for (const [rel, text] of Object.entries(files)) {
    const at = join(root, rel)
    mkdirSync(dirname(at), { recursive: true })
    writeFileSync(at, text)
  }
  return root
}

/** Remove a fixture tree, ignoring the platform's transient lock. */
function drop(root) {
  try {
    rmSync(root, { recursive: true, force: true })
  } catch {
    // A leftover temp directory is not a test failure.
  }
}

test('an import of a missing sibling is reported', () => {
  const root = fixture({ 'index.js': "import { x } from './tool.js'\nexport const y = x\n" })
  const missing = unresolvableImports(join(root, 'index.js'))
  assert.equal(missing.length, 1)
  assert.equal(missing[0].specifier, './tool.js')
  drop(root)
})

test('a resolvable tree of imports is clean', () => {
  const root = fixture({
    'index.js': "import { x } from './a.js'\nimport './b.js'\nexport { x }\n",
    'a.js': 'export const x = 1\n',
    'b.js': "import { x } from './a.js'\nexport const y = x\n",
  })
  assert.deepEqual(unresolvableImports(join(root, 'index.js')), [])
  drop(root)
})

test('a missing file two edges deep is reported at the edge that needs it', () => {
  const root = fixture({
    'index.js': "import './domains/console.js'\n",
    'domains/console.js': "import { present } from '../core.js'\n",
  })
  const missing = unresolvableImports(join(root, 'index.js'))
  assert.deepEqual(missing.map((m) => m.specifier), ['../core.js'])
  assert.match(missing[0].from, /domains[\\/]console\.js$/u)
  drop(root)
})

test('a cycle is visited once and is not an error', () => {
  const root = fixture({
    'a.js': "import './b.js'\nexport const a = 1\n",
    'b.js': "import './a.js'\nexport const b = 1\n",
  })
  assert.deepEqual(unresolvableImports(join(root, 'a.js')), [])
  drop(root)
})

test('bare package specifiers are not followed', () => {
  const root = fixture({ 'index.js': "import z from '@deepseek-ai/schemastery'\nexport default z\n" })
  assert.deepEqual(unresolvableImports(join(root, 'index.js')), [])
  drop(root)
})

test('a directory import resolves to its index', () => {
  const root = fixture({
    'index.js': "import './domains/index.js'\n",
    'domains/index.js': 'export {}\n',
  })
  assert.deepEqual(unresolvableImports(join(root, 'index.js')), [])
  drop(root)
})

test('the specifier scan reads every import form and ignores lookalikes', () => {
  const text = [
    "import a from './a.js'",
    "export { b } from './b.js'",
    "import './side-effect.js'",
    "const c = await import('./c.js')",
    "// import d from './commented-out.js'",
    "const e = \"import('./in-a-string.js')\"",
  ].join('\n')
  const found = staticImportsOf(text)
  assert.ok(found.includes('./a.js'))
  assert.ok(found.includes('./b.js'))
  assert.ok(found.includes('./side-effect.js'))
  drop(fixture({}))
})

test('the shipped console entry resolves every relative import', () => {
  const entry = join(here, '..', '..', 'plugins', 'vyra-dsh-console', 'index.js')
  assert.deepEqual(unresolvableImports(entry), [],
    'the published tarball must carry every module index.js imports')
})

// ---------------------------------------------------------------------------
// The defect itself: existence on disk is not publication. 0.1.2 imported
// tool.js and domains/*.js from index.js while `files` named neither, so the
// source tree checked out and the tarball was missing the host half.
// ---------------------------------------------------------------------------

test('a module the entry imports but files omits is reported', () => {
  const root = fixture({
    'index.js': "import './domains/console.js'\nexport {}\n",
    'domains/console.js': 'export {}\n',
  })
  const shipped = unshippedModules(join(root, 'index.js'), root, ['index.js', 'README.md'])
  assert.deepEqual(shipped, ['domains/console.js'])
  drop(root)
})

test('a fired glob covers the modules under it', () => {
  const root = fixture({
    'index.js': "import './domains/console.js'\nexport {}\n",
    'domains/console.js': 'export {}\n',
  })
  assert.deepEqual(unshippedModules(join(root, 'index.js'), root, ['index.js', 'domains/*.js']), [])
  assert.deepEqual(unshippedModules(join(root, 'index.js'), root, ['index.js', 'domains']), [])
  drop(root)
})

test('a bare directory name publishes its subtree', () => {
  const root = fixture({
    'index.js': "import './a/b/c.js'\nexport {}\n",
    'a/b/c.js': 'export {}\n',
  })
  assert.deepEqual(unshippedModules(join(root, 'index.js'), root, ['index.js', 'a']), [])
  drop(root)
})

test('the shipped console manifest publishes every module the entry reaches', () => {
  const packageRoot = join(here, '..', '..', 'plugins', 'vyra-dsh-console')
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  assert.deepEqual(
    unshippedModules(join(packageRoot, manifest.main ?? 'index.js'), packageRoot, manifest.files),
    [],
    'files must cover index.js’s whole static import tree',
  )
})

test('an import written INSIDE a template string is not an edge', () => {
  // dsh-remotion generates a project's `src/index.jsx` as a template literal,
  // and the generated text contains `import data from '../data.json'` — a file
  // it writes into the user's project, never a module this package loads. The
  // check reported it as missing and failed a package that installs fine.
  //
  // The specifier is a string literal either way, so the distinction cannot be
  // drawn on it: the `import` keyword sits in code for a real edge and inside a
  // literal for generated text, and that is what is tested.
  const root = fixture({
    'index.js': [
      'export function sources(title) {',
      '  return {',
      "    'src/index.jsx': `import React from 'react';",
      "import data from '../data.json';",
      'export default () => <h1>{title}</h1>`',
      '  }',
      '}',
      '',
    ].join('\n'),
    'media-templates.js': 'export {}\n',
  })
  assert.deepEqual(
    unresolvableImports(join(root, 'index.js')).filter((m) => m.specifier === '../data.json'),
    [],
    'generated text must not be followed as an import',
  )
  assert.deepEqual(staticImportsOf(readFileSync(join(root, 'index.js'), 'utf8')), [])
  drop(root)
})

test('a real import still counts next to a template that quotes one', () => {
  // The over-correction to guard against: dropping every specifier that appears
  // anywhere near a backtick, which would hide genuine broken edges.
  const root = fixture({
    'index.js': [
      "import { a } from './a.js'",
      "const sample = `import x from './nope.js'`",
      'export { a, sample }',
      '',
    ].join('\n'),
    'a.js': 'export const a = 1\n',
  })
  const missing = unresolvableImports(join(root, 'index.js'))
  assert.deepEqual(missing.map((m) => m.specifier), [], 'the templated example must not be followed')
  const specifiers = staticImportsOf(readFileSync(join(root, 'index.js'), 'utf8'))
  assert.deepEqual(specifiers, ['./a.js'], 'the real import must survive')
  drop(root)
})
