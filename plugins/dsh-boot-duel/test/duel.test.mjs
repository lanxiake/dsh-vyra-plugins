import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel } from '../sim/duel.mjs'
import { MAX_HP, KO_TIME_SCALE, REDUCED_TIME_SCALE, KO_TOTAL_MS, PLAYER_HP_FLOOR } from '../sim/constants.mjs'

const idle = { left: false, right: false, jump: false, jab: false, kick: false, block: false }

test('the duel opens in the ready stance, not in a fight', () => {
  const duel = createDuel({ seed: 1, difficulty: 'easy' })
  const snapshot = duel.getSnapshot()
  assert.equal(duel.getState(), 'ready')
  assert.equal(snapshot.player.hp, MAX_HP)
  assert.equal(snapshot.enemy.hp, MAX_HP)
  assert.equal(snapshot.timeScale, 1)
  assert.equal(snapshot.ragdoll, null)
})

test('nobody can deal damage while the duel is ready', () => {
  const duel = createDuel({ seed: 21, difficulty: 'normal' })
  // Ten seconds of nothing: the opponent must not open the fight for you.
  for (let i = 0; i < 60 * 10; i++) duel.update(16, idle)
  const snapshot = duel.getSnapshot()
  assert.equal(snapshot.phase, 'ready')
  assert.equal(snapshot.player.hp, MAX_HP)
  assert.equal(snapshot.enemy.hp, MAX_HP)
  assert.equal(snapshot.fx.particles.length, 0, 'no swings, no sparks')
})

test('begin() moves ready to playing and only works once', () => {
  const duel = createDuel({ seed: 22, difficulty: 'easy' })
  assert.equal(duel.begin(), true)
  assert.equal(duel.getState(), 'playing')
  assert.equal(duel.begin(), false, 'a second Enter does nothing')
  assert.equal(duel.getState(), 'playing')
})

test('skip works from the opening stance too', () => {
  const duel = createDuel({ seed: 23, difficulty: 'easy' })
  assert.equal(duel.getState(), 'ready')
  assert.equal(duel.skip(), true)
  assert.equal(duel.getState(), 'ko')
})

test('KO sets the 0.25x time scale and spawns the ragdoll', () => {
  const duel = createDuel({ seed: 1, difficulty: 'easy' })
  duel.forceKo(1)
  const snapshot = duel.getSnapshot()
  assert.equal(duel.getState(), 'ko')
  assert.equal(snapshot.timeScale, KO_TIME_SCALE)
  assert.equal(snapshot.enemy.hp, 0)
  assert.notEqual(snapshot.ragdoll, null)
  assert.equal(snapshot.ragdoll.points.length, 6)
})

test('the KO outro settles on done after about 1.5s of real time', () => {
  const duel = createDuel({ seed: 2, difficulty: 'easy' })
  duel.forceKo(1)
  let elapsed = 0
  while (duel.getState() !== 'done' && elapsed < 6000) {
    duel.update(16, idle)
    elapsed += 16
  }
  assert.equal(duel.getState(), 'done')
  assert.ok(elapsed >= KO_TOTAL_MS - 40 && elapsed <= KO_TOTAL_MS + 200, `outro ${elapsed}ms`)
})

test('skip during play enters the outro; a second skip is a no-op', () => {
  const duel = createDuel({ seed: 3, difficulty: 'easy' })
  assert.equal(duel.skip(), true)
  assert.equal(duel.getState(), 'ko')
  const before = duel.getSnapshot().koElapsedMs
  assert.equal(duel.skip(), false)
  assert.equal(duel.getState(), 'ko')
  assert.equal(duel.getSnapshot().koElapsedMs, before)
})

test('skip is refused once the outro has finished', () => {
  const duel = createDuel({ seed: 4, difficulty: 'easy' })
  duel.forceKo(1)
  while (duel.getState() !== 'done') duel.update(50, idle)
  assert.equal(duel.skip(), false)
  assert.equal(duel.getState(), 'done')
})

test('the outro is irreversible: it never returns to playing', () => {
  const duel = createDuel({ seed: 5, difficulty: 'easy' })
  duel.forceKo(1)
  for (let i = 0; i < 400; i++) {
    duel.update(16, { ...idle, jab: true, right: true })
    assert.notEqual(duel.getState(), 'playing')
  }
})

test('the snapshot is a copy; mutating it cannot corrupt the duel', () => {
  const duel = createDuel({ seed: 6, difficulty: 'easy' })
  const snapshot = duel.getSnapshot()
  snapshot.player.hp = 0
  snapshot.enemy.hp = 0
  snapshot.fx.particles.push({ x: 0, y: 0 })
  assert.equal(duel.getSnapshot().player.hp, MAX_HP)
  assert.equal(duel.getSnapshot().enemy.hp, MAX_HP)
})

test('reduced motion uses the 0.5x scale and no white flash', () => {
  const duel = createDuel({ seed: 7, difficulty: 'easy', reducedMotion: true })
  duel.forceKo(1)
  const snapshot = duel.getSnapshot()
  assert.equal(snapshot.timeScale, REDUCED_TIME_SCALE)
  assert.equal(snapshot.fx.flash, 0)
  assert.equal(snapshot.fx.shake, 0)
})

test('a non-reduced KO flashes and shakes', () => {
  const duel = createDuel({ seed: 8, difficulty: 'easy' })
  duel.forceKo(1)
  const snapshot = duel.getSnapshot()
  assert.ok(snapshot.fx.flash > 0, 'white flash on')
  assert.ok(snapshot.fx.shake > 0, 'screen shake on')
  assert.ok(snapshot.fx.shockwave > 0, 'shockwave on')
})

test('fade opacity runs from 1 toward 0 only after the outro ends', () => {
  const duel = createDuel({ seed: 9, difficulty: 'easy' })
  duel.forceKo(1)
  assert.equal(duel.getSnapshot().fadeOpacity, 1)
  while (duel.getState() !== 'done') duel.update(16, idle)
  assert.ok(duel.getSnapshot().fadeOpacity <= 1)
})

test('the player never loses: health floors and play continues', () => {
  const duel = createDuel({ seed: 10, difficulty: 'normal' })
  duel.begin()
  for (let i = 0; i < 60 * 60; i++) duel.update(16, idle)
  const snapshot = duel.getSnapshot()
  assert.equal(snapshot.phase, 'playing')
  assert.ok(snapshot.player.hp >= PLAYER_HP_FLOOR, `hp ${snapshot.player.hp}`)
  assert.ok(snapshot.player.hp > 0)
})

test('particles never exceed the 300 cap', () => {
  const duel = createDuel({ seed: 11, difficulty: 'easy' })
  for (let i = 0; i < 60 * 30; i++) duel.update(16, { ...idle, jab: true, interference: true })
  assert.ok(duel.getSnapshot().fx.particles.length <= 300)
})

test('a seed makes the fight reproducible', () => {
  const run = () => {
    const duel = createDuel({ seed: 42, difficulty: 'easy' })
    const trace = []
    for (let i = 0; i < 600; i++) {
      const { snapshot } = duel.update(16, { ...idle, right: i % 40 < 20, jab: i % 25 === 0 })
      trace.push(`${snapshot.enemy.x.toFixed(3)}:${snapshot.enemy.hp}`)
    }
    return trace.join('|')
  }
  assert.equal(run(), run())
})

test('update ignores absurd or negative deltas instead of corrupting state', () => {
  const duel = createDuel({ seed: 12, difficulty: 'easy' })
  for (const dt of [NaN, -100, Infinity, undefined, 1e9]) {
    assert.doesNotThrow(() => duel.update(dt, idle))
    const snapshot = duel.getSnapshot()
    assert.ok(Number.isFinite(snapshot.player.x))
    assert.ok(Number.isFinite(snapshot.enemy.x))
  }
})
