// Checks that the native binding block registers its koffi types once per process.
//
//   node --test plugins/vyra-system-selection/test/
//
// This is the regression that made installing or updating the plugin inside a
// running Host fail with `Duplicate type name 'POINT'`: the block ran at module
// load, koffi registers those names process-wide, and a second load — which is
// exactly what an install, an update or a re-enable does — re-registered them.
//
// The check evaluates the block itself against a fake koffi that refuses a
// repeated name, so it needs no DSH installation, no desktop session and no
// native module.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root, 'native.js'), 'utf8')

/** The cached-IIFE the module registers its bindings through. */
const BLOCK = /globalThis\[Symbol\.for\('([^']+)'\)\] \?\?= \(\(\) => \{([\s\S]*?)\n\}\)\(\)/

/** A koffi stand-in that refuses a name it has already been asked to register. */
function makeKoffi(names) {
  const register = (kind) => (name) => {
    const key = kind === 'proto' ? /(\w+)\s*\(/.exec(name)?.[1] : name
    if (names.has(key)) throw new Error(`Duplicate type name '${key}'`)
    names.add(key)
    return { kind, name: key }
  }
  return {
    struct: register('struct'),
    union: register('union'),
    proto: register('proto'),
    load: () => ({ func: () => () => undefined }),
  }
}

/**
 * Evaluate the module's binding block the way the module does, against `koffi`.
 * @param {object} koffi - the koffi stand-in.
 * @param {object} cache - the process-wide cache the block reads and writes.
 */
function evaluateBlock(koffi, cache) {
  const found = BLOCK.exec(source)
  assert.ok(found !== null, 'native.js still caches its bindings on globalThis')
  const [, key, body] = found
  // The block is an arrow function body that ends with `return { … }`.
  const run = new Function('koffi', 'globalThis', `return (() => {${body}\n})()`)
  cache[key] ??= run(koffi, cache)
  return cache[key]
}

test('the block registers each type once and refuses to register it twice', () => {
  const names = new Set()
  const koffi = makeKoffi(names)
  const cache = {}
  const first = evaluateBlock(koffi, cache)
  assert.ok(names.size > 0, 'the first evaluation registered at least one name')
  for (const wanted of ['POINT', 'RECT', 'MONITORINFO', 'INPUT', 'WNDCLASSEXW', 'PROCESSENTRY32W', 'MSLLHOOKSTRUCT']) {
    assert.ok(names.has(wanted), `expected ${wanted} to be registered`)
  }
  // The fake refuses a repeated name, so this is what the Host hit before the
  // cache existed. With the cache in place the block is not entered again.
  const before = names.size
  const second = evaluateBlock(koffi, cache)
  assert.equal(names.size, before, 'the cached block registered nothing more')
  assert.equal(second, first, 'the second evaluation returned the cached bindings')
})

test('the block is actually wired to the cache', () => {
  // A block that registered eagerly at module load would satisfy the test above
  // by never being reached; this asserts the cache is what the module reads.
  const cache = {}
  const koffi = makeKoffi(new Set())
  const bindings = evaluateBlock(koffi, cache)
  assert.equal(Object.keys(cache).length, 1, 'the block wrote exactly one cache entry')
  assert.equal(cache[Object.keys(cache)[0]], bindings, 'the entry holds the returned bindings')
  assert.ok(bindings.F !== undefined, 'the bindings carry the FFI table')
  assert.ok(bindings.POINT !== undefined, 'the bindings carry the structs')
})
