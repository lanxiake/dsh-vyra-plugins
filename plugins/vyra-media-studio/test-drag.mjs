import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

/**
 * The drag module must start a drag on mouse movement, not cancel it. This was
 * a real regression: the touch long-press rule applied to mice too, so any
 * normal press-and-move cancelled the drag and nothing happened.
 */
const source = fs.readFileSync(new URL('./src/client/drag.js', import.meta.url), 'utf8')

test('mouse drag begins on movement instead of cancelling', () => {
  assert.match(source, /if \(!current\.touch\) \{/)
  assert.match(source, /if \(moved\) \{ cleanup\(\); begin\(\) \}/)
  assert.match(source, /MOUSE_THRESHOLD/)
})

test('touch still waits for the long press and cancels on scroll', () => {
  assert.match(source, /event\.pointerType === 'touch'/)
  assert.match(source, /window\.setTimeout\(begin, LONG_PRESS_MS\)/)
})

test('drop targets are read from the DOM, not a dialog', () => {
  assert.match(source, /data-vms-drop-folder/)
  assert.match(source, /data-vms-dropzone/)
  assert.equal(source.includes('vms-drop-panel'), false)
})
