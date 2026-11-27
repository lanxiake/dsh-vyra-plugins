import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel } from '../js/adapter.js'
import { inputForCode } from '../sim/session.mjs'

/**
 * TWO BUTTONS PLUS A DIRECTION.
 *
 * The rail used to advertise six attack keys. The game now plays on J and K
 * with a held direction, and this file is the contract: a chord must produce
 * the named move, and the same chord must keep working at the frame rates the
 * game will actually run at (a hit-stop, or a 120 Hz display).
 *
 * Every test drives the REAL key codes through `inputForCode`, so a binding
 * change that breaks the shorthand fails here rather than in a player's hand.
 */

const IDLE = {
  left: false, right: false, jump: false, jab: false, hook: false, kick: false,
  uppercut: false, sweep: false, slide: false, retreat: false, block: false,
  crouch: false, special: false,
}

/** A keyboard chord: key codes in, an input object out, exactly like the client. */
function chord(codes) {
  const input = { ...IDLE }
  for (const code of codes) {
    const field = inputForCode(code)
    if (field) input[field] = true
  }
  return input
}

/** A duel parked in striking range with the rival out of the way. */
function ready() {
  const duel = createDuel({ difficulty: 'easy', round: 0 })
  duel.begin()
  const a = duel.arena
  for (let i = 0; i < 60 * 20 && a.openQueue > 0; i++) duel.update(16, IDLE)
  a.enemy.ai.cd = 999
  a.player.x = 450
  a.enemy.x = 480
  a.player.face = 1
  return { duel, a }
}

const CASES = [
  [['KeyJ'], 'p1', 'J is a jab'],
  [['KeyJ', 'KeyS'], 'p3', 'J + down is an uppercut'],
  [['KeyK'], 'k', 'K is a kick'],
  [['KeyK', 'KeyS'], 'sweep', 'K + down is a sweep'],
  [['KeyK', 'KeyD'], 'slide', 'K toward the rival is a slide'],
]

for (const [codes, expect, label] of CASES) {
  test(label, () => {
    const { duel, a } = ready()
    duel.update(16, chord(codes))
    assert.equal(a.player.atkName, expect,
      `${codes.join('+')} started ${a.player.atkName}, expected ${expect}`)
  })
}

test('the shorthand survives a 120 Hz display', () => {
  // A sub-frame update must not lose the press: the adapter holds it until a
  // simulation step runs.
  const { duel, a } = ready()
  for (let i = 0; i < 3; i++) duel.update(1000 / 120, chord(['KeyJ', 'KeyS']))
  assert.equal(a.player.atkName, 'p3', 'down + punch thrown at 120 Hz must still be the launcher')
})

test('a chord pressed as the hit lands cancels into the next link', () => {
  /**
   * The cancel window opens on the CONNECTION, not on the press, so the test
   * lands a jab first and then presses the next link inside the same window.
   * That is the frame the operator has to work on: their own hit freezes the
   * world, and the press that follows must still be delivered.
   */
  const { duel, a } = ready()
  duel.update(16, chord(['KeyJ']))
  assert.equal(a.player.atkName, 'p1', 'the jab has to start for this test to mean anything')
  // Let the swing land — that is what opens the cancel window.
  for (let i = 0; i < 6; i++) duel.update(16, IDLE)
  assert.ok(a.player.chainT > 0, 'a landed jab has to open the cancel window')
  duel.update(16, chord(['KeyK']))
  assert.equal(a.player.atkName, 'k', `the kick pressed inside the window did not cancel (still ${a.player.atkName})`)
})

test('mashing two buttons builds a string', () => {
  // A human mashing J/K at ~90 ms per press must reach three links. This is
  // the "连招" claim in one assertion.
  const { duel, a } = ready()
  let deepest = 0
  for (const key of ['KeyJ', 'KeyJ', 'KeyK', 'KeyJ', 'KeyJ', 'KeyK']) {
    duel.update(16, chord([key]))
    for (let f = 0; f < 5; f++) {
      duel.update(16, IDLE)
      deepest = Math.max(deepest, a.combo)
    }
  }
  assert.ok(deepest >= 3, `mashing reached a ${deepest}-hit combo; the chain is not joining up`)
})

test('the chain window is wide enough to be a player skill, not a frame trap', () => {
  // One landed jab has to leave the window open for more than a quarter of a
  // second of REAL time, or it is not something a person can learn.
  const { duel, a } = ready()
  duel.update(16, chord(['KeyJ']))
  let open = 0
  for (let i = 0; i < 60; i++) {
    duel.update(16, IDLE)
    if (a.player.chainT > 0) open++
  }
  assert.ok(open * 16 > 250, `the cancel window stayed open ${(open * 16).toFixed(0)}ms of real time`)
})