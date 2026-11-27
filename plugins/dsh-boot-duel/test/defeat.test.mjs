import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel } from '../js/adapter.js'

/**
 * THE ROUND CAN BE LOST.
 *
 * The player was hard-floored at 1 hp, so the rival could never win: the
 * opening was an animation with a fight painted on it. The player asked for it
 * to be a real fight — 「玩家不要锁血，该被 OK 就 OK」 — and these tests are the
 * contract for that.
 *
 * They drive the real adapter, so what they measure is what ships.
 */

const IDLE = {
  left: false, right: false, jump: false, jab: false, hook: false, kick: false,
  uppercut: false, sweep: false, slide: false, retreat: false, block: false,
  crouch: false, special: false,
}

/** A duel past the opening standoff, with the rival frozen. */
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

test('the player is not floored: health can reach zero', () => {
  const { duel, a } = ready()
  // Hit the player with the heaviest move there is, over and over, pinning
  // them in range so knockback cannot make the test pass by accident.
  for (let i = 0; i < 400 && a.player.hp > 0; i++) {
    a.player.x = a.enemy.x - 34
    a.player.hp = Math.max(0, a.player.hp - 25)
    a.checkKo()
    if (a.phase !== 'playing') break
  }
  assert.equal(a.player.hp, 0, 'the player must be able to hit zero')
  assert.equal(a.phase, 'ko', 'zero health must end the round')
  assert.equal(a.result, 'lose')
  assert.equal(a.loser, 'player')
  void duel
})

test('a knockout of the player reads as a loss, not a win', () => {
  const { duel, a } = ready()
  a.enemy.startAttack('k')
  // Drive the fight until the player is down or the safety clock runs out.
  for (let i = 0; i < 60 * 90 && a.phase === 'playing'; i++) {
    a.enemy.ai.cd = 0
    a.player.x = a.enemy.x - 34
    duel.update(16, IDLE)
  }
  const snap = duel.getSnapshot()
  assert.equal(snap.phase !== 'playing', true, `the round ended (phase ${snap.phase})`)
  assert.equal(snap.player.hp, 0, `player hp ${snap.player.hp}`)
  assert.equal(snap.result, 'lose', `result ${snap.result}`)
})

test('the rival going down still reads as a win', () => {
  const { duel, a } = ready()
  a.enemy.hp = 0
  a.checkKo()
  // `getSnapshot()` hands back the last frame the UPDATE produced, so a state
  // change made outside `update` is invisible until one more frame runs.
  duel.update(16, IDLE)
  const snap = duel.getSnapshot()
  assert.equal(snap.result, 'win')
  assert.equal(a.loser, 'enemy')
  // The winner keeps their health; the loser is pinned at zero.
  assert.equal(a.enemy.hp, 0)
  assert.ok(a.player.hp > 0)
})

test('a loss ends in the same four beats a win does', () => {
  const { duel, a } = ready()
  a.player.hp = 0
  a.checkKo()
  const beats = new Set()
  // The ko phase is a few seconds long (its own real-time clock), so the loop
  // has to outlast it rather than assume a fixed frame count.
  for (let i = 0; i < 60 * 12 && a.phase !== 'done'; i++) {
    beats.add(duel.getSnapshot().koBeat)
    duel.update(16, IDLE)
  }
  assert.deepEqual([...beats].filter(Boolean).sort(), ['freeze', 'launch', 'seal'])
  assert.equal(a.phase, 'done', `phase ${a.phase}`)
})

test('the loser says the closing line, not the winner', () => {
  const { duel, a } = ready()
  a.player.hp = 0
  a.checkKo()
  // Drain the ko phase's own clock far enough for the first defeat line.
  for (let i = 0; i < 120; i++) duel.update(16, IDLE)
  // The line is the RIVAL's: the player lost, so the rival gets the last word.
  const line = a.line
  assert.ok(line, 'a closing line is shown')
  assert.equal(line.speaker, 'rival', `speaker ${line.speaker}`)
})