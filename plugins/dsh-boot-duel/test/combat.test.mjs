import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOVES, MAX_HP, PLAYER_HP_FLOOR, ARENA, WALK_SPEED, JUMP_VELOCITY, GRAVITY } from '../sim/constants.mjs'
import { createFighter, startAction, stepFighter, hitboxOf, hurtboxOf, phaseOf } from '../sim/fighter.mjs'
import { resolveHits, applyDamage } from '../sim/combat.mjs'

const idle = { left: false, right: false, jump: false, jab: false, kick: false, block: false }

function duelists(gap = 30) {
  const player = createFighter('player', 300, 1, MAX_HP)
  const enemy = createFighter('enemy', 300 + gap, -1, MAX_HP)
  return { player, enemy }
}

const advanceTo = (fighter, frame) => {
  while (fighter.actionFrame < frame) stepFighter(fighter, idle, ARENA)
}

test('jab produces no hitbox during windup and one during active frames', () => {
  const { player } = duelists()
  assert.equal(startAction(player, 'jab'), true)
  for (let i = 0; i < MOVES.jab.windup; i++) {
    assert.equal(hitboxOf(player), null, `windup frame ${i}`)
    stepFighter(player, idle, ARENA)
  }
  assert.notEqual(hitboxOf(player), null)
  assert.equal(phaseOf(player), 'active')
})

test('kick stays active exactly for its active window and then recovers', () => {
  const { player } = duelists()
  startAction(player, 'kick')
  advanceTo(player, MOVES.kick.windup)
  let active = 0
  while (hitboxOf(player)) {
    active++
    stepFighter(player, idle, ARENA)
  }
  assert.equal(active, MOVES.kick.active)
  assert.equal(phaseOf(player), 'recovery')
})

test('a committed fighter cannot start another action mid-swing', () => {
  const { player } = duelists()
  startAction(player, 'kick')
  stepFighter(player, idle, ARENA)
  assert.equal(startAction(player, 'jab'), false)
  assert.equal(player.action, 'kick')
})

test('same attack resolves once, not once per active frame', () => {
  const { player, enemy } = duelists()
  startAction(player, 'jab')
  advanceTo(player, MOVES.jab.windup)
  const first = resolveHits(player, enemy, {})
  const second = resolveHits(player, enemy, {})
  assert.equal(first.hit, true)
  assert.equal(second, null)
  // First hit of a chain: full damage.
  assert.equal(enemy.hp, MAX_HP - MOVES.jab.damage)
})

test('an out-of-range swing connects with nothing', () => {
  const { player, enemy } = duelists(400)
  startAction(player, 'jab')
  advanceTo(player, MOVES.jab.windup)
  assert.equal(resolveHits(player, enemy, {}), null)
  assert.equal(enemy.hp, MAX_HP)
})

test('block reduces damage by 80 percent and does not stagger', () => {
  const { player, enemy } = duelists()
  enemy.blocking = true
  startAction(player, 'jab')
  advanceTo(player, MOVES.jab.windup)
  const hit = resolveHits(player, enemy, {})
  assert.equal(hit.blocked, true)
  assert.equal(hit.damage, Math.round(MOVES.jab.damage * 0.2))
  assert.equal(enemy.hp, MAX_HP - hit.damage)
  assert.equal(enemy.stagger, 0)
})

test('hitting a staggered opponent is a counter', () => {
  const { player, enemy } = duelists()
  enemy.stagger = 10
  startAction(player, 'jab')
  advanceTo(player, MOVES.jab.windup)
  const hit = resolveHits(player, enemy, {})
  assert.equal(hit.counter, true)
  assert.ok(hit.damage >= MOVES.jab.damage, `counter damage ${hit.damage}`)
})

test('player health floors at 1 and never reports a KO', () => {
  const player = createFighter('player', 300, 1, MAX_HP)
  const enemy = createFighter('enemy', 330, -1, MAX_HP)
  startAction(enemy, 'kick')
  advanceTo(enemy, MOVES.kick.windup)

  let kos = 0
  for (let i = 0; i < 4000 && player.hp > PLAYER_HP_FLOOR; i++) {
    enemy.hitConsumed = false
    // Re-arm the swing: the active window only spans a few frames, so without
    // this the loop silently stops landing after `windup + active`.
    enemy.actionFrame = MOVES.kick.windup
    // Independent hits, not a combo: clear the victim's scaling streak so
    // this measures the health floor rather than the damage ladder.
    player.hitStreak = 0
    player.stagger = 0
    // Knockback is real: each hit shoves the target out of range, which is
    // correct behaviour and would end this loop long before the floor. Pin
    // the target back in place so the test measures the floor.
    // The enemy faces -1 (left), so the target belongs on its LEFT side.
    player.x = enemy.x - 30
    const hit = resolveHits(enemy, player, { player: true })
    if (hit && hit.ko) kos++
  }
  assert.equal(kos, 0)
  assert.equal(player.hp, PLAYER_HP_FLOOR)
  assert.equal(applyDamage(player, 999, { player: true }), false)
  assert.equal(player.hp, PLAYER_HP_FLOOR)
})

test('KO fires only on the frame health reaches zero', () => {
  const { player, enemy } = duelists()
  enemy.hp = MOVES.jab.damage
  enemy.hitStreak = 0
  startAction(player, 'jab')
  advanceTo(player, MOVES.jab.windup)
  const hit = resolveHits(player, enemy, {})
  assert.equal(hit.ko, true)
  assert.equal(enemy.hp, 0)
  player.hitConsumed = false
  assert.equal(resolveHits(player, enemy, {}), null, 'no second KO on a dead opponent')
  assert.equal(enemy.hp, 0)
})

test('movement is clamped to the arena', () => {
  const { player } = duelists()
  // Walk far enough to reach the wall regardless of the walk speed: a fixed
  // frame count silently stops short whenever the speed is retuned.
  const frames = Math.ceil(ARENA.width / WALK_SPEED) + 10
  for (let i = 0; i < frames; i++) stepFighter(player, { ...idle, left: true }, ARENA)
  assert.equal(player.x, ARENA.min)
  for (let i = 0; i < frames; i++) stepFighter(player, { ...idle, right: true }, ARENA)
  assert.equal(player.x, ARENA.max)
})

test('jump leaves the ground and lands again', () => {
  const { player } = duelists()
  assert.equal(startAction(player, 'jump'), true)
  assert.equal(player.onGround, false)
  let air = 0
  while (!player.onGround && air < 200) {
    stepFighter(player, idle, ARENA)
    air++
  }
  // Airtime is derived from the launch velocity and gravity, so the bound has
  // to come from them too: `2|v|/g` frames, plus a frame of rounding.
  const expectedAirtime = Math.ceil((2 * Math.abs(JUMP_VELOCITY)) / GRAVITY) + 2
  assert.ok(air > 0 && air <= expectedAirtime, `airtime ${air}, expected <= ${expectedAirtime}`)
  assert.equal(player.y, ARENA.ground)
})

test('facing is the only thing that decides which side the hitbox sits on', () => {
  const player = createFighter('player', 300, -1, MAX_HP)
  startAction(player, 'jab')
  advanceTo(player, MOVES.jab.windup)
  const box = hitboxOf(player)
  assert.ok(box.x + box.w <= 300, 'hitbox projects left when facing left')
})

/* ------------------------------------------------------------- range ---- */

/**
 * The user's complaint was concrete: "很多时候打不到人". These lock the fix in.
 *
 * A move's USEFUL reach is the widest centre-to-centre gap at which its active
 * box overlaps a standing target's hurtbox. Every move has to clear a floor,
 * and the floor is expressed in body heights so it survives a resize.
 */
function reachOf(move) {
  const bodyHeight = 640 * 0.1095
  const probe = createFighter('probe', 0, 1, 100)
  let widest = 0
  for (let gap = 1; gap <= bodyHeight; gap += 0.5) {
    const attacker = createFighter('a', 100, 1, MAX_HP)
    const target = createFighter('t', 100 + gap, -1, MAX_HP)
    startAction(attacker, move)
    attacker.actionFrame = MOVES[move].windup
    const box = hitboxOf(attacker)
    const hurt = hurtboxOf(target)
    if (!box) continue
    const overlapsX = box.x < hurt.x + hurt.w && box.x + box.w > hurt.x
    const overlapsY = box.y < hurt.y + hurt.h && box.y + box.h > hurt.y
    if (overlapsX && overlapsY) widest = gap
  }
  void probe
  return widest
}

test('every strike reaches at least a third of a body height', () => {
  const bodyHeight = 640 * 0.1095
  for (const move of ['jab', 'hook', 'kick', 'sweep', 'uppercut']) {
    const reach = reachOf(move)
    assert.ok(reach > bodyHeight * 0.33,
      `${move} reaches only ${reach} units (${(reach / bodyHeight).toFixed(2)} bodies)`)
  }
})

test('the moves form a range ladder from short to long', () => {
  // Choice only exists if the reaches differ. A jab must be the shortest and a
  // sweep among the longest, or there is no reason to pick between them.
  const jab = reachOf('jab')
  const sweep = reachOf('sweep')
  const kick = reachOf('kick')
  assert.ok(jab < sweep, `jab (${jab}) must be shorter than sweep (${sweep})`)
  assert.ok(jab <= kick, `jab (${jab}) must not out-reach the kick (${kick})`)
})
