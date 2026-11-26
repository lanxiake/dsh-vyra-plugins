import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAi, AI_PROFILES } from '../sim/ai.mjs'
import { ARENA, MOVES } from '../sim/constants.mjs'

/**
 * The centre-to-centre gap at which the AI's own jab connects. Everything
 * below is placed relative to this, so a resize does not silently move a test
 * fixture into a different distance band.
 */
const JAB_GAP = ARENA.bodyHalfWidth * 2 + MOVES.jab.range

/** A usable position for the self/foe pair at a given centre gap. */
const at = (gap) => ({ self: 500 - gap, foe: 500 })

const state = (over = {}) => ({
  self: { x: 500, y: ARENA.ground, facing: -1, action: null, actionFrame: 0, stagger: 0 },
  foe: { x: 400, y: ARENA.ground, facing: 1, action: null, actionFrame: 0, stagger: 0 },
  ...over,
})

test('easy profile attacks at most once per 1.2 seconds', () => {
  const ai = createAi({ difficulty: 'easy', seed: 7 })
  let attacks = 0
  // 12 seconds at 60 Hz; the easy interval floor is 1200ms, so at most 10.
  for (let i = 0; i < 60 * 12; i++) {
    const out = ai.decide(state(), 1000 / 60)
    if (out.jab || out.kick) attacks++
  }
  assert.ok(attacks <= 12, `attacks ${attacks}`)
  assert.equal(AI_PROFILES.easy.attackInterval[0], 1200)
  assert.equal(AI_PROFILES.easy.attackInterval[1], 2000)
})

test('easy ai never chains a follow-up on a staggered opponent', () => {
  const ai = createAi({ difficulty: 'easy', seed: 8 })
  const staggered = () => state({
    foe: { x: 400, y: ARENA.ground, facing: 1, action: null, actionFrame: 0, stagger: 40 },
  })
  // Put the AI in range and past its cooldown so only the stagger rule can
  // hold it back.
  for (let i = 0; i < 600; i++) ai.decide(staggered(), 16)
  let attacks = 0
  for (let i = 0; i < 3600; i++) {
    const out = ai.decide(staggered(), 1000 / 60)
    if (out.jab || out.kick) attacks++
  }
  assert.equal(attacks, 0, 'easy never punishes a stagger')
})

test('easy never accelerates onto a stagger, normal does', () => {
  // The contract is about the *decisive* punish: easy follows its own swing
  // clock and never takes a free shot at a reeling opponent, while normal
  // reads the stagger and presses it. Compare each profile against itself on
  // a non-staggered foe at the same distance.
  const run = (difficulty, foeStagger) => {
    const ai = createAi({ difficulty, seed: 8 })
    let attacks = 0
    // Inside its own strike range, so only the stagger rule can change what
    // it does.
    const foeX = 500 - JAB_GAP * 0.7
    for (let i = 0; i < 3600; i++) {
      const out = ai.decide(state({
        foe: { x: foeX, y: ARENA.ground, facing: 1, action: null, actionFrame: 0, stagger: foeStagger },
      }), 1000 / 60)
      if (out.jab || out.kick || out.hook || out.sweep || out.uppercut) attacks++
    }
    return attacks
  }
  const easyPlain = run('easy', 0)
  const easyOnStagger = run('easy', 40)
  const normalPlain = run('normal', 0)
  const normalOnStagger = run('normal', 40)

  assert.equal(easyOnStagger, easyPlain, 'easy does not change its rhythm for a stagger')
  assert.ok(normalOnStagger > normalPlain, `normal presses: ${normalOnStagger} vs ${normalPlain}`)
})

test('ai approaches when out of range', () => {
  const ai = createAi({ difficulty: 'easy', seed: 9 })
  const out = ai.decide(state({
    // Far outside every band, so walking in is the only sensible move.
    foe: { x: 500 - JAB_GAP * 4, y: ARENA.ground, facing: 1, action: null, actionFrame: 0, stagger: 0 },
  }), 16)
  assert.equal(out.left, true)
})

test('ai braces when the opponent swings from close in', () => {
  const ai = createAi({ difficulty: 'easy', seed: 3 })
  const attacked = () => state({
    // Close enough that the AI judges the swing a threat.
    foe: { x: 500 - JAB_GAP * 0.5, y: ARENA.ground, facing: 1, action: 'jab', actionFrame: 1, stagger: 0 },
  })
  let blocked = 0
  for (let i = 0; i < 200; i++) if (ai.decide(attacked(), 16).block) blocked++
  assert.ok(blocked > 0, 'blocks sometimes')
})

test('seeded ai is deterministic', () => {
  // Drive a varying state so the pressure reading and the random branches are
  // both exercised; a static state parks every seed on the same path.
  const trace = (seed) => {
    const ai = createAi({ difficulty: 'easy', seed })
    const self = { x: 500, y: ARENA.ground, facing: -1, action: null, actionFrame: 0, stagger: 0 }
    return Array.from({ length: 400 }, (_, i) => {
      const foe = {
        x: 440 + (i % 7) * 3,
        y: 300,
        facing: 1,
        action: i % 11 < 4 ? 'jab' : null,
        actionFrame: i % 11,
        stagger: i % 53 < 6 ? 20 : 0,
      }
      return JSON.stringify(ai.decide({ self, foe }, 16))
    })
  }
  assert.deepEqual(trace(11), trace(11))
  assert.notDeepEqual(trace(11), trace(12))
})

test('ai never acts while it is itself staggered', () => {
  const ai = createAi({ difficulty: 'normal', seed: 5 })
  for (let i = 0; i < 300; i++) {
    const out = ai.decide(state({
      self: { x: 500, y: ARENA.ground, facing: -1, action: null, actionFrame: 0, stagger: 20 },
    }), 16)
    // Nothing but "do nothing": no movement, no attack, no guard, no retreat.
    assert.equal(Object.values(out).some(Boolean), false, `acted while staggered: ${JSON.stringify(out)}`)
  }
})
