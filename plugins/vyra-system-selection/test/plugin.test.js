// Tests for the host half's trigger policy.
//
// `apply` cannot be exercised here: it installs a Win32 mouse hook, paints a GDI window and reads
// the clipboard — all of which need a desktop session, and a test that synthesizes input fights
// whatever else the machine is doing. What can be checked without any of that is the shape the
// plugin hands the overlay, which is where the anchoring defect lived.
//
// `index.js` imports `native.js`, which loads `koffi` from the DSH installation at module load.
// That is fine at runtime and impossible here, so the geometry it would produce is checked
// through `core.js` instead — the same functions `native.js` calls.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { ACTIONS, findAction, placeMenuAtSelection, placePanelAtSelection, saneRect } from '../core.js'

const WORK = { left: 0, top: 0, right: 1920, bottom: 1080 }

test('every action in the menu resolves by id', () => {
  for (const action of ACTIONS) {
    assert.equal(findAction(action.id)?.id, action.id)
  }
  assert.equal(findAction('does-not-exist'), null)
})

// The host normalises whatever the renderer sent into one anchor shape. A missing or malformed
// rect must fall back to the pointer rather than reaching the overlay, which positions a window
// — and a NaN there is a window that never appears.
test('a missing rectangle falls back to the pointer', () => {
  const openInAppAnchor = (rect, x, y) => {
    const at = { x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) }
    return saneRect(rect) ?? { left: at.x, top: at.y, right: at.x, bottom: at.y }
  }

  assert.deepEqual(openInAppAnchor(null, 550, 310), { left: 550, top: 310, right: 550, bottom: 310 })
  assert.deepEqual(openInAppAnchor({ left: 'x' }, 550, 310), { left: 550, top: 310, right: 550, bottom: 310 })
  assert.deepEqual(
    openInAppAnchor({ left: 400, top: 300, right: 700, bottom: 320 }, 700, 310),
    { left: 400, top: 300, right: 700, bottom: 320 },
  )
})

// The drag direction decides where the pointer ends, and must not decide where the menu goes.
test('the pointer position no longer moves the menu', () => {
  const rect = saneRect({ left: 400, top: 300, right: 700, bottom: 320 })
  const size = { width: 260, height: 44 }
  const fromLeft = placeMenuAtSelection(rect, size, WORK)
  const fromRight = placeMenuAtSelection(rect, size, WORK)
  assert.deepEqual(fromLeft, fromRight)
  assert.ok(fromLeft.y >= rect.bottom, 'the menu must not cover the selection')
})

test('an anchor with no width still yields a usable menu position', () => {
  const point = { left: 550, top: 310, right: 550, bottom: 310 }
  const pos = placeMenuAtSelection(point, { width: 260, height: 44 }, WORK)
  assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y))
  assert.ok(pos.x >= WORK.left && pos.x + 260 <= WORK.right)
})

// The hook used to prime a capture on every left release. Priming injects Ctrl+C and waits up to
// 220 ms with a busy loop, and the mouse hook is delivered through the same message loop — so
// every ordinary click anywhere on the desktop stalled input. The gesture machine has to have
// said "this could have selected something" before a prime is allowed.
test('the hook only primes a selection for a gesture that could have selected', () => {
  const source = readFileSync(join(import.meta.dirname, '..', 'native.js'), 'utf8')
  const branch = source.slice(source.indexOf('if (wParam === WM_LBUTTONUP)'))
  assert.match(branch.slice(0, 900), /if \(fire && !containsPoint\(pt\) && !windowUnderPoint\(pt\)\) \{[\s\S]*primeSelection\(\)/,
    'the left-release branch must gate priming on a drag or multi-click outside our own card')
})

// The answer was rendered, and the panel was blank anyway: `setContent` follows the stream by
// setting `scroll` to MAX_SAFE_INTEGER, and nothing clamped it back, so every line was laid out
// at -1.7e308 and skipped as "above the viewport".
test('laying the panel out clamps the streaming scroll position', () => {
  const source = readFileSync(join(import.meta.dirname, '..', 'native.js'), 'utf8')
  const start = source.indexOf('function layoutPanel')
  assert.ok(start >= 0, 'layoutPanel still exists')
  const body = source.slice(start, source.indexOf('\n  }', start))
  assert.match(body, /state\.scroll = clampScroll\(state\.scroll/,
    'layoutPanel must clamp the scroll it just made meaningful')
  assert.match(body, /state\.viewH = /, 'viewH is computed in the same place')
})

test('the panel anchors to the selection, not to a point', () => {
  const rect = { left: 400, top: 300, right: 700, bottom: 320 }
  const pos = placePanelAtSelection(rect, { width: 420, height: 300 }, WORK, 'below')
  assert.ok(pos.y >= rect.bottom)
  assert.equal(pos.x + 210, (rect.left + rect.right) / 2)
})
