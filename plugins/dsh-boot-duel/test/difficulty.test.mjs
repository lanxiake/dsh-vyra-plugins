import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel } from '../js/adapter.js'

/**
 * The DIFFICULTY knob.
 *
 * It existed as a config value for a long time and did nothing: the client
 * read it, `createDuel` accepted it, and then the engine dropped it on the
 * floor. Two settings played an identical fight. These tests are the reason
 * that cannot quietly happen again.
 *
 * The contract, as the player asked for it:
 *
 *   easy    the player's damage is unchanged, the rival presses on a 0.7–1.3s
 *           clock and waits for its cooldown after being hit
 *   normal  the PLAYER'S damage is halved, the rival presses on 0.4–0.8s, and
 *           it arms its next swing 0.4s after taking a clean hit
 */

const IDLE = {
  left: false, right: false, jump: false, jab: false, punch2: false,
  kick: false, upper: false, sweep: false, slide: false, retreat: false,
  block: false, crouch: false, special: false,
}

/**
 * Get past the opening standoff.
 *
 * `begin()` now starts a scripted exchange that must be spoken before either
 * fighter can act — that is a deliberate change (the alternative was a fight
 * playing out under the subtitles, with the knockout landing mid-sentence).
 * A test that wants to measure combat has to wait it out.
 */
function openStandoff(duel) {
  const a = duel.arena
  for (let i = 0; i < 60 * 20 && a.openQueue > 0; i++) duel.update(1000 / 60, IDLE)
  return a
}

/** Put the two fighters at `gap` apart, both facing each other, at rest. */
function stage(duel, gap = 60) {
  const a = openStandoff(duel)
  a.player.x = 480
  a.enemy.x = 480 + gap
  a.player.vx = 0
  a.enemy.vx = 0
  a.player.face = 1
  a.enemy.face = -1
  a.enemy.ai.cd = 60 // keep the AI out of a damage measurement
}

/** Land exactly one jab and report how much HP the rival lost. */
function jabDamage(difficulty) {
  const duel = createDuel({ seed: 4, difficulty, round: 0 })
  duel.begin()
  stage(duel, 60)
  const before = duel.arena.enemy.hp

  // One frame with the button down is the rising edge the engine wants; the
  // following frames hold it and let the swing play out.
  duel.update(1000 / 60, { ...IDLE, jab: true })
  for (let i = 0; i < 40; i++) duel.update(1000 / 60, IDLE)
  return before - duel.arena.enemy.hp
}

test('easy leaves the player damage alone; normal halves it', () => {
  const easy = jabDamage('easy')
  const normal = jabDamage('normal')
  assert.ok(easy > 0, `easy jab should land, dealt ${easy}`)
  assert.ok(normal > 0, `normal jab should land, dealt ${normal}`)
  assert.equal(normal, Math.max(1, Math.round(easy * 0.5)),
    `normal dealt ${normal}, expected half of easy's ${easy}`)
})

test('the difficulty reaches the live fighters, not just the config', () => {
  const easy = createDuel({ seed: 1, difficulty: 'easy', round: 0 })
  const normal = createDuel({ seed: 1, difficulty: 'normal', round: 0 })
  assert.equal(easy.arena.player.dmgScale, 1)
  assert.equal(normal.arena.player.dmgScale, 0.5)
  // The rival's own damage is NOT raised — the opening must stay survivable.
  assert.equal(easy.arena.enemy.dmgScale, 1)
  assert.equal(normal.arena.enemy.dmgScale, 1)
})

test('normal presses faster than easy, measured at the same distance', () => {
  /**
   * Count swings over a fixed window with the rival glued to a distance where
   * it wants to attack. The AI is stochastic, so the assertion is a wide gap
   * between the two rates rather than an exact count.
   *
   * The gap has to be INSIDE the rival's reach (58 units at scale 1): parked
   * at 60 it decides to close the distance instead, and since the test pins
   * both x positions every frame it can never get there — zero swings for
   * both difficulties, which is a broken test rather than a broken engine.
   */
  function swings(difficulty, seed) {
    const duel = createDuel({ seed, difficulty, round: 0 })
    duel.begin()
    openStandoff(duel)
    let count = 0
    let wasAttacking = false
    for (let i = 0; i < 60 * 20; i++) {
      // Hold the pair at arm's length; the AI's own move decides the rest.
      const a = duel.arena
      a.player.x = 400
      a.enemy.x = 450
      a.enemy.vx = 0
      a.player.hp = 150
      duel.update(1000 / 60, IDLE)
      const attacking = a.enemy.state === 'atk'
      if (attacking && !wasAttacking) count++
      wasAttacking = attacking
    }
    return count
  }
  const easy = [1, 2, 3, 4].map((seed) => swings('easy', seed))
  const normal = [1, 2, 3, 4].map((seed) => swings('normal', seed))
  const avg = (list) => list.reduce((a, b) => a + b, 0) / list.length
  assert.ok(avg(normal) > avg(easy) * 1.3,
    `normal averaged ${avg(normal).toFixed(1)} swings, easy ${avg(easy).toFixed(1)}`)
})

test('normal arms a counter-attack after a clean hit; easy does not', () => {
  function cooldownAfterHit(difficulty) {
    const duel = createDuel({ seed: 9, difficulty, round: 0 })
    duel.begin()
    stage(duel, 60)
    const a = duel.arena
    // Park the rival's next swing far in the future so any change is the
    // retaliation rule and nothing else.
    a.enemy.ai.cd = 30

    a.enemy.hp = 150
    a.player.x = a.enemy.x - 60
    a.player.face = 1
    // Land one clean jab.
    duel.update(1000 / 60, { ...IDLE, jab: true })
    let frames = 1
    while (frames < 40 && a.enemy.ai.cd > 20) {
      duel.update(1000 / 60, IDLE)
      frames++
    }
    return { cd: a.enemy.ai.cd, hp: a.enemy.hp }
  }

  const normal = cooldownAfterHit('normal')
  const easy = cooldownAfterHit('easy')
  assert.ok(normal.hp < 150, 'the jab has to land for this test to mean anything')
  assert.ok(normal.cd <= 0.4 + 1e-6,
    `normal should arm a 0.4s counter, cd came out ${normal.cd.toFixed(2)}`)
  assert.ok(easy.cd > 20, `easy must leave the cooldown alone, cd came out ${easy.cd.toFixed(2)}`)
})

test('再来一局 honours a difficulty changed in the panel', () => {
  const duel = createDuel({ seed: 2, difficulty: 'easy', round: 0 })
  assert.equal(duel.arena.player.dmgScale, 1)
  duel.restart(null, { difficulty: 'normal' })
  assert.equal(duel.arena.player.dmgScale, 0.5)
  assert.equal(duel.arena.difficulty, 'normal')
})

test('an unknown difficulty falls back to easy instead of throwing', () => {
  const duel = createDuel({ difficulty: 'nightmare', round: 0 })
  assert.equal(duel.arena.difficulty, 'easy')
  assert.equal(duel.arena.player.dmgScale, 1)
})