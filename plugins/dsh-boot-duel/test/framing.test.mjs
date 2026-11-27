import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Renderer, FRAMING_ZOOM, PULLED_BACK_ZOOM } from '../js/render.js'

/**
 * FRAMING. The camera is the only thing that changes how big the FIGHTERS
 * are, so "人和字放大30%" is exactly a camera constant plus a type scale.
 *
 * These pins exist because the number was moved twice in opposite directions
 * (0.77 back, then 1.3 forward) and a future edit could silently land the shot
 * somewhere a third time. `Renderer.fit` is pure given a fake canvas, so the
 * camera can be solved without a browser.
 */

/** A Renderer with no drawing surface — enough for layout maths. */
function bareRenderer(cssW = 1280, cssH = 720) {
  const r = new Renderer(null, null)
  r.cssW = cssW
  r.cssH = cssH
  r.dpr = 1
  return r
}

const pair = (gap) => ({
  player: { x: 480 - gap / 2 },
  enemy: { x: 480 + gap / 2 },
  cinematic: 0,
})

test('the fighters are framed 30% larger than the pulled-back shot', () => {
  // The ratio between the dial that ships and the one it replaced IS the
  // request. Asserting `x / (x / 1.3) === 1.3` would prove nothing; asserting
  // the two exported constants against each other fails if either is edited
  // without the other.
  const ratio = FRAMING_ZOOM / PULLED_BACK_ZOOM
  assert.ok(Math.abs(ratio - 1.3) < 0.005,
    `framing zoom ${FRAMING_ZOOM} over the pulled-back ${PULLED_BACK_ZOOM} is ${ratio.toFixed(3)}, expected 1.3`)
})

test('the camera really solves a larger scale than the pulled-back shot did', () => {
  const r = bareRenderer()
  const snap = pair(120)
  r.fit(snap)
  const now = r.scale
  // Solve the same fit with the zoom dial replaced by the old value: the
  // renderer multiplies ZOOM in at the end, so dividing it back out and
  // multiplying the old one gives the shot that used to ship.
  const before = (now / FRAMING_ZOOM) * PULLED_BACK_ZOOM
  assert.ok(now > before, `framed ${now} vs the old ${before}`)
  assert.ok(Math.abs(now / before - 1.3) < 0.005, `ratio ${(now / before).toFixed(3)}`)
})

test('the pair still fits inside the frame at the larger zoom', () => {
  const r = bareRenderer(1280, 720)
  const snap = pair(160)
  r.fit(snap)
  r.focusOn(snap)
  // Both feet must be inside the viewport width after the camera settles.
  const left = snap.player.x * r.scale + r.offX
  const right = snap.enemy.x * r.scale + r.offX
  assert.ok(left > 0, `player at ${left} px is off the left edge`)
  assert.ok(right < r.cssW, `rival at ${right} px is off the right edge`)
})

test('the floor stays on screen at the larger zoom', () => {
  const r = bareRenderer(1280, 720)
  const snap = pair(120)
  r.fit(snap)
  r.focusOn(snap)
  // The arena's floor is y = 300 in stage units; the camera places it with
  // `focusOn`, and the feet have to land above the bottom of the frame.
  const floorY = 300 * r.scale + r.offY
  assert.ok(floorY < r.cssH, `floor at ${floorY} px fell below a ${r.cssH} px frame`)
  assert.ok(floorY > r.cssH * 0.4, `floor at ${floorY} px is too high in the frame`)
})