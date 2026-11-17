// Tests for the DSH process-tree walk in native.js.
//
// The walk answers one question: does the process under the cursor belong to DSH? Getting it wrong
// in one direction makes the app swallow the whole desktop's selections; in the other, it makes
// the in-app gesture capture from the clipboard instead of letting the page report its own
// selection — a 220 ms stall per gesture, for nothing.
//
// `shellProcessIds` itself enumerates the live process list through koffi, so only the pure part
// is checked here: the executable-name comparison the walk uses to decide where to stop.
//
// native.js loads `koffi` from the DSH installation at import time, which needs the app present.
// This test skips rather than fails when it is not, so `verify-run.sh` stays honest on a machine
// without DSH installed.
import { strict as assert } from 'node:assert'
import test from 'node:test'

let native = null
try {
  native = await import('../native.js')
} catch (error) {
  test('native.js unavailable: process-tree checks skipped', { skip: `koffi not loadable (${error.message})` }, () => {})
}

if (native) {
  test('the executable name is lowercased and bare', () => {
    const name = native.ownImageNameForTest()
    assert.equal(typeof name, 'string')
    assert.equal(name, name.toLowerCase(), 'comparison against snapshot rows is case-insensitive')
    assert.ok(!name.includes('/'), 'must be the file name, not a path')
    assert.ok(!name.includes('\\'), 'must be the file name, not a path')
  })

  test('the shell pid set always contains this process', () => {
    const ids = native.shellProcessIdsForTest()
    assert.ok(ids instanceof Set)
    assert.ok(ids.has(process.pid), 'the walk seeds itself, or it can never match anything')
  })

  // The walk stops at the first ancestor not running the DSH executable. Seeding too much would
  // end it immediately, which is why only this process is seeded.
  test('the shell pid set is small enough to be a running app, not the whole desktop', () => {
    const ids = native.shellProcessIdsForTest()
    assert.ok(ids.size >= 1)
    assert.ok(ids.size < 200, `matched ${ids.size} processes — the walk probably ran past the shell`)
  })
}
