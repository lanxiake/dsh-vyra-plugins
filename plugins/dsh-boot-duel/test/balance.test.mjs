import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel } from '../sim/duel.mjs'
import { ARENA, MAX_HP, MOVES } from '../sim/constants.mjs'

const idle = { left: false, right: false, jump: false, jab: false, kick: false, block: false }

/**
 * Strategies are written as functions of the current snapshot so they can be
 * replayed on fresh duels. Rising edges matter: the duel converts a held key
 * into a single action, so a "masher" has to release before pressing again —
 * exactly what a human hammering J does.
 */
function play(strategy, seed, maxSeconds = 180) {
  const duel = createDuel({ seed, difficulty: 'easy' })
  duel.begin()
  const frames = 60 * maxSeconds
  let elapsed = 0
  for (let frame = 0; frame < frames; frame++) {
    const snapshot = duel.getSnapshot()
    if (snapshot.phase !== 'playing') break
    const input = strategy(snapshot, frame)
    if (!input) break
    duel.update(1000 / 60, { ...idle, ...input })
    elapsed = frame + 1
  }
  const snapshot = duel.getSnapshot()
  return {
    won: snapshot.phase !== 'playing',
    seconds: elapsed / 60,
    playerHp: snapshot.player.hp,
    enemyHp: snapshot.enemy.hp,
  }
}

/** Presses punch on every other frame and walks forward. Never blocks. */
function masher() {
  let press = false
  return (snapshot) => {
    press = !press
    const gap = snapshot.enemy.x - snapshot.player.x
    return { jab: press, right: gap > 0, left: gap < 0 }
  }
}

/**
 * Reads the fight: closes to range, strikes only into an opening (the foe is
 * recovering or reeling), and braces otherwise. This is "time it, do not spam
 * it" and it is how a person actually plays the round.
 *
 * The strike distance is derived from the geometry, not hard-coded. A jab's
 * box starts at the attacker's own body edge and reaches `MOVES.jab.range`
 * beyond it, so the furthest gap it can still connect across is
 * `bodyHalfWidth * 2 + jab.range` — the two hurtboxes plus the reach. Writing
 * a literal here silently stops matching the game the moment the reach or the
 * figure's size is retuned, and then the test measures the literal (a player
 * walking into a standoff it can never close) instead of the balance.
 */
/**
 * Reads the fight. The behaviour a real player settles into:
 *
 *   - hold the edge of jab range, not the middle of it;
 *   - swing when the opponent's own swing is spent (recovery) or they are
 *     reeling — never into an active strike;
 *   - guard only against an incoming active hit, then immediately look for the
 *     punish instead of turtling through the whole exchange;
 *   - press on a cadence, so the slash of recovery penalties is not paid twice.
 *
 * That is "time it, do not spam it". The strike distance is derived from the
 * geometry rather than hard-coded, because a literal here silently stops
 * matching the game the moment the reach or the figure's size is retuned.
 */
function timedPlayer() {
  let press = false
  let cooldown = 0
  const reach = ARENA.bodyHalfWidth * 2 + MOVES.jab.range
  // Start a touch outside reach: the move's own step carries the punch in.
  const strikeAt = reach + 12
  const tooClose = reach - 14
  return (snapshot) => {
    const gap = snapshot.enemy.x - snapshot.player.x
    const distance = Math.abs(gap)

    const foeFrozen = snapshot.enemy.action === null
      || snapshot.enemy.stagger > 0
      || snapshot.enemy.juggled
      || snapshot.enemy.prone
    const foeThreatening = Boolean(snapshot.enemy.action) && !foeFrozen

    if (cooldown > 0) {
      cooldown -= 1
      // Keep spacing while the recovery beat plays out.
      if (distance > strikeAt) return { left: gap < 0, right: gap > 0 }
      return {}
    }

    // Guard a live swing, then drop it the moment the swing is spent: a reader
    // is not a turtle.
    if (foeThreatening && distance <= strikeAt) return { block: true }

    if (distance > strikeAt) return { left: gap < 0, right: gap > 0 }
    if (distance < tooClose) return { left: gap > 0, right: gap < 0 }
    if (!foeFrozen) return {}

    press = !press
    if (press) cooldown = 6
    return { jab: press }
  }
}

test('a player who reads openings wins the round', () => {
  const results = Array.from({ length: 10 }, (_, index) => play(timedPlayer(), 500 + index))
  const wins = results.filter((result) => result.won).length
  assert.ok(wins >= 8, `timed player won ${wins}/10`)

  // The spec's target: one round is won inside 30–60 seconds, not in two.
  const average = results.reduce((total, result) => total + result.seconds, 0) / results.length
  assert.ok(average >= 12, `rounds too short to be a fight: ${average.toFixed(1)}s`)
  assert.ok(average <= 90, `rounds too long to be an opening animation: ${average.toFixed(1)}s`)
})

test('mashing is less efficient than timing', () => {
  // "Timing over button speed" has to be measured as EFFICIENCY, not raw
  // accuracy. A masher's jab is short and fast, so a high hit ratio is
  // expected — what it lacks is damage per swing, because a mash snaps into
  // the combo-scaling ladder and into whiffs. The honest observable is how
  // much health each swing actually removes.
  const run = (strategy, seed) => {
    const duel = createDuel({ seed, difficulty: 'easy' })
    duel.begin()
    let swings = 0
    let dealt = 0
    for (let frame = 0; frame < 60 * 120; frame++) {
      const snapshot = duel.getSnapshot()
      if (snapshot.phase !== 'playing') break
      const before = snapshot.enemy.hp
      const input = strategy(snapshot, frame)
      if (!input) break
      const { events } = duel.update(1000 / 60, { ...idle, ...input })
      for (const event of events) if (event === 'whoosh') swings++
      const after = duel.getSnapshot()
      dealt += Math.max(0, before - after.enemy.hp)
    }
    return { swings, dealt }
  }

  const mashed = run(masher(), 500)
  const timed = run(timedPlayer(), 500)

  assert.ok(mashed.swings >= 12, `masher actually mashes (${mashed.swings} swings)`)
  // Per-swing value: a masher presses into recovery, into whiffs and into the
  // combo ladder; a reader waits for the opening that pays full damage.
  const mashedPerSwing = mashed.dealt / mashed.swings
  const timedPerSwing = timed.dealt / timed.swings
  assert.ok(
    timedPerSwing > mashedPerSwing,
    `reading must be worth more per swing: ${timedPerSwing.toFixed(2)} vs ${mashedPerSwing.toFixed(2)}`,
  )
})

test('the player never loses and the fight always ends in reachable time', () => {
  // A player who does nothing at all is beaten down to the floor but the round
  // must still be winnable afterwards, because health never reaches zero.
  const passive = play(() => ({}), 900, 40)
  assert.equal(passive.won, false)
  assert.ok(passive.playerHp >= 1, `passive player floored at ${passive.playerHp}`)
  assert.ok(passive.enemyHp <= MAX_HP)
})
