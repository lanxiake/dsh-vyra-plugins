// Does importing the native module twice register its koffi types only once?
//
//   node --test plugins/vyra-system-selection/test/
//
// The Host imports this module again whenever the plugin is re-enabled, updated
// or reinstalled inside a running process, and koffi registers its type names
// process-wide. A second import that re-registered them failed with
// "Duplicate type name 'POINT'", the entry never activated, and the plugin
// looked broken after an update while a remove-then-install happened to work.
//
// This imports the real module twice, through the real Node module system, and
// fails if the second import registers anything. koffi is a stand-in that
// refuses a repeated name, so the old behaviour reproduces exactly.
import { strict as assert } from 'node:assert'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')

/** A koffi stand-in that refuses a name it has already been asked to register. */
const KOFFI_STUB = `
const names = new Set()
const register = (kind) => (first) => {
  const name = kind === 'proto' ? /(\\w+)\\s*\\(/.exec(first)?.[1] : first
  if (names.has(name)) throw new Error("Duplicate type name '" + name + "'")
  names.add(name)
  return { kind, name }
}
module.exports = {
  struct: register('struct'),
  union: register('union'),
  proto: register('proto'),
  load: () => ({ func: () => () => undefined }),
  __names: names,
}
`

/**
 * Lay out a directory the module can resolve its koffi from, then import the
 * module twice through two cache-busting specifiers.
 * @returns {Promise<{registered: number, addedBySecond: number}>} what happened.
 */
async function loadModuleTwice() {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-native-'))
  try {
    // `loadKoffi` requires `<resourcesPath>/app.asar.unpacked/dsh/package.json`,
    // so the stub sits where that resolution reaches it.
    mkdirSync(join(dir, 'app.asar.unpacked/dsh/node_modules/koffi'), { recursive: true })
    writeFileSync(join(dir, 'app.asar.unpacked/dsh/package.json'), JSON.stringify({ name: 'dsh', version: '0.0.0' }))
    writeFileSync(join(dir, 'app.asar.unpacked/dsh/node_modules/koffi/package.json'),
      JSON.stringify({ name: 'koffi', version: '0.0.0-test', main: 'index.js' }))
    writeFileSync(join(dir, 'app.asar.unpacked/dsh/node_modules/koffi/index.js'), KOFFI_STUB)
    cpSync(join(root, 'native.js'), join(dir, 'native.js'))
    cpSync(join(root, 'core.js'), join(dir, 'core.js'))
    // The two loads differ by their query, so Node treats them as two modules
    // rather than collapsing them into one cache entry — as a re-import is.
    const url = (n) => `${pathToFileURL(join(dir, 'native.js')).href}?load=${n}`
    return await withFakeRequire(dir, async () => {
      await import(url(1))
      const stub = await import(pathToFileURL(join(dir, 'app.asar.unpacked/dsh/node_modules/koffi/index.js')).href)
      const names = stub.default?.__names ?? stub.__names
      const afterFirst = names.size
      await import(url(2))
      return { registered: afterFirst, addedBySecond: names.size - afterFirst }
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Run `body` with `process.resourcesPath` pointing at the fixture. */
async function withFakeRequire(dir, body) {
  const original = process.resourcesPath
  process.resourcesPath = dir
  try {
    return await body()
  } finally {
    if (original === undefined) delete process.resourcesPath
    else process.resourcesPath = original
  }
}

test('importing the native module twice registers each koffi type once', async (t) => {
  let outcome
  try {
    outcome = await loadModuleTwice()
  } catch (error) {
    // A repeated registration surfaces as this exact message, which is the
    // regression: report it as the failure it is, not as an unexpected throw.
    assert.fail(`the second import re-registered a koffi type: ${error.message}`)
  }
  assert.ok(outcome.registered > 0, 'the first import registered the types')
  assert.equal(outcome.addedBySecond, 0, 'the second import registered nothing new')
  t.diagnostic(`first import registered ${outcome.registered} koffi names; the second added none`)
})
