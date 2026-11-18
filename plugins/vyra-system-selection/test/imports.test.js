// Every name index.js uses from core.js or native.js must be imported.
//
//   node --test plugins/vyra-system-selection/
//
// `6b7b215` ("anchor the popups to the selection") called `saneRect` from
// `runAction` without adding it to the import list. The module still loaded —
// the call sits inside a function — so the plugin started, and then the Host
// died with `ReferenceError: saneRect is not defined` the first time someone
// used the toolbar. A load test cannot see that, so this checks the import list
// against the names the file actually uses.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (name) => readFileSync(join(root, name), 'utf8')

/** Every name a module exports. */
function exportedNames(source) {
  const names = new Set()
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gu)) {
    names.add(match[1])
  }
  return names
}

/** Every name a module imports from a relative path. */
function importedNames(source) {
  const names = new Set()
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/[^']+'/gu)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim()
      if (name !== undefined && name !== '') names.add(name)
    }
  }
  return names
}

/** Every identifier the source calls, ignoring property accesses and strings. */
function calledNames(source) {
  // Comments and string bodies first, so a word inside either cannot look like
  // a call site.
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/^\s*\/\/.*$/gmu, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\]|\\.)*"/gu, '""')
    .replace(/`(?:[^`\\]|\\.)*`/gu, '``')
  const names = new Set()
  for (const match of stripped.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/gu)) names.add(match[1])
  return names
}

const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'await', 'yield',
  'throw', 'do', 'delete', 'void', 'in', 'of', 'case', 'super', 'else',
])

test('index.js imports every core and native name it calls', () => {
  const source = read('index.js')
  const available = new Set([...exportedNames(read('core.js')), ...exportedNames(read('native.js'))])
  const imported = importedNames(source)
  const locals = new Set([...source.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/gu)].map((m) => m[1]))
  for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gu)) locals.add(match[1])

  // A call whose name one of our modules exports, that index.js neither
  // imported nor declared, is the defect this guards.
  const missing = [...calledNames(source)].filter((name) =>
    !KEYWORDS.has(name) && available.has(name) && !imported.has(name) && !locals.has(name))

  assert.deepEqual(missing, [], `index.js calls ${missing.join(', ')} without importing it`)
})

test('the guard sees the shape of the defect it exists for', () => {
  // The check above only helps if it would have caught the real thing: a call
  // to an exported name that the import list omits.
  const source = `import { other } from './core.js'\nexport function run() { return saneRect({}) }`
  const available = exportedNames(read('core.js'))
  const imported = importedNames(source)
  const missing = [...calledNames(source)].filter((name) => available.has(name) && !imported.has(name))
  assert.deepEqual(missing, ['saneRect'], 'an unimported exported name is reported')
})
