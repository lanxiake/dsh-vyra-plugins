// Tests for the client half's in-page selection helper.
//
// `verify-run.sh` has referenced this file since the plugin was written, but it was never
// committed — so the one defect that mattered, `RPC is not defined`, had nothing watching for it.
//
// The client bundle is not loadable as a module: it registers itself through
// `window.__ModuleLoader__` at import time and its handlers live in module scope. So the file is
// read and evaluated against a stub loader instead, which is enough to reach the helpers it
// exports for exactly this purpose (`__internal`).
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const SOURCE = readFileSync(join(import.meta.dirname, '..', 'client.js'), 'utf8')

/** Evaluate the bundle against a stub loader and return what its factory registered. */
function loadBundle() {
  let registered = null
  const loader = { load: (registration) => { registered = registration } }
  const window = { __ModuleLoader__: loader, addEventListener() {}, removeEventListener() {} }
  // The factory only builds components and exports helpers; nothing it runs at load time needs a
  // real DOM, so a permissive stub is enough to obtain `__internal`.
  const document = { addEventListener() {}, removeEventListener() {}, querySelector: () => null }
  const ctx = { slots: { inject() {}, register() {} }, effect: () => () => {} }

  // eslint-disable-next-line no-new-func -- the only way to run the CJS-shaped bundle body
  new Function('window', 'document', 'MutationObserver', SOURCE)(window, document, class {
    observe() {}
    disconnect() {}
  })
  assert.ok(registered, 'the bundle did not call __ModuleLoader__.load')
  assert.equal(registered.id, 'dsh-vyra-system-selection', 'the registration id must equal the package name')

  const require = (name) => (name === 'react' ? { createElement: () => null, useCallback: (f) => f, useEffect() {}, useState: (v) => [v, () => {}] } : {})
  const face = registered.factory(require)
  assert.ok(face.__internal, 'the bundle must export __internal for tests')
  return { face, ctx }
}

test('the bundle registers under its package name', () => {
  const { face } = loadBundle()
  assert.equal(typeof face.apply, 'function')
})

// The regression this file exists for: the endpoint used to be declared inside the factory while
// the pointer/context-menu handlers are module-level, so both handlers threw on their first line —
// before the fetch — and selecting text did nothing. The name is package-prefixed and the whole
// bundle is IIFE-wrapped so it cannot collide with another plugin's top-level constants, which
// are concatenated into the same classic-script scope.
test('the module-scope handlers can reach the RPC endpoint', () => {
  assert.match(SOURCE, /^const SYSTEM_SELECTION_RPC = /m, 'the endpoint must be a module-scope binding')
  const factoryBody = SOURCE.slice(SOURCE.indexOf('factory(require) {'), SOURCE.indexOf('__internal:'))
  assert.ok(!/const SYSTEM_SELECTION_RPC = /.test(factoryBody), 'the endpoint must not be re-declared inside the factory')
})

test('selectionFromDom rejects a collapsed or missing selection', () => {
  const { face } = loadBundle()
  const empty = { getSelection: () => null }
  assert.equal(face.__internal.selectionFromDom(empty, {}, null), null)
  assert.equal(face.__internal.selectionFromDom(
    { getSelection: () => ({ isCollapsed: true, rangeCount: 0 }) }, {}, null,
  ), null)
})

test('selectionFromDom refuses text inside an input, textarea or contenteditable', () => {
  const { face } = loadBundle()
  const win = {
    getSelection: () => ({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'typed text',
      anchorNode: { nodeType: 1, closest: (sel) => (sel.includes('textarea') ? {} : null) },
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 1, bottom: 1 }) }),
    }),
  }
  assert.equal(face.__internal.selectionFromDom(win, {}, null), null)
})

test('selectionFromDom converts the viewport rect to screen coordinates', () => {
  const { face } = loadBundle()
  const box = { left: 292, top: 218, right: 592, bottom: 238 }
  const win = {
    getSelection: () => ({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'selected words',
      anchorNode: null,
      getRangeAt: () => ({ getBoundingClientRect: () => box }),
    }),
  }
  // A click at screen (400,300) landing at viewport (292,218) puts the viewport origin at
  // (108,82) — the difference of the two, which is exact and needs no guess at frame thickness.
  const event = { screenX: 400, screenY: 300, clientX: 292, clientY: 218 }
  const picked = face.__internal.selectionFromDom(win, {}, event)
  assert.equal(picked.text, 'selected words')
  assert.deepEqual(picked.rect, { left: 400, top: 300, right: 700, bottom: 320 })
})

test('selectionFromDom still returns the text when the rectangle cannot be measured', () => {
  const { face } = loadBundle()
  const win = {
    getSelection: () => ({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'unmeasurable',
      anchorNode: null,
      getRangeAt: () => ({ getBoundingClientRect() { throw new Error('detached') } }),
    }),
  }
  const picked = face.__internal.selectionFromDom(win, {}, { screenX: 0, screenY: 0, clientX: 0, clientY: 0 })
  assert.equal(picked.text, 'unmeasurable')
  assert.equal(picked.rect, null)
})
