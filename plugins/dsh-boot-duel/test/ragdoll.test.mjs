import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRagdoll, stepRagdoll, ragdollSnapshot, ragdollAtRest } from '../sim/ragdoll.mjs'
import { ARENA } from '../sim/constants.mjs'

const make = (impulse = { x: 8, y: -4 }) =>
  createRagdoll({ x: 300, y: ARENA.ground, facing: 1, impulse })

test('ragdoll has six point masses', () => {
  const ragdoll = make()
  assert.equal(ragdoll.points.length, 6)
  assert.deepEqual(
    ragdoll.points.map((p) => p.name).sort(),
    ['armL', 'armR', 'head', 'legL', 'legR', 'torso'],
  )
})

test('limb segment lengths hold within 1px after solving', () => {
  const ragdoll = make()
  for (let i = 0; i < 120; i++) stepRagdoll(ragdoll, { ground: ARENA.ground, iterations: 6 })
  const limbs = ragdoll.constraints.filter((c) => (c.stiffness ?? 1) === 1)
  assert.equal(limbs.length, 5, 'head plus four limbs are rigid')
  for (const constraint of limbs) {
    const a = ragdoll.points[constraint.a]
    const b = ragdoll.points[constraint.b]
    const length = Math.hypot(a.x - b.x, a.y - b.y)
    assert.ok(
      Math.abs(length - constraint.length) < 1,
      `${constraint.name} drift ${Math.abs(length - constraint.length).toFixed(3)}`,
    )
  }
})

test('absurd impulse never produces NaN and stays out of the floor', () => {
  const ragdoll = make({ x: 1e9, y: -1e9 })
  for (let i = 0; i < 200; i++) stepRagdoll(ragdoll, { ground: ARENA.ground, iterations: 6 })
  for (const p of ragdoll.points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${p.name} not finite`)
    assert.ok(p.y <= ARENA.ground + 4, `${p.name} below ground: ${p.y}`)
  }
})

test('NaN already inside the ragdoll is recovered, not propagated', () => {
  const ragdoll = make()
  ragdoll.points[2].x = NaN
  ragdoll.points[2].y = NaN
  stepRagdoll(ragdoll, { ground: ARENA.ground, iterations: 6 })
  for (const p of ragdoll.points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
  }
})

test('ragdoll comes to rest on the ground', () => {
  const ragdoll = make({ x: 6, y: -3 })
  for (let i = 0; i < 600; i++) stepRagdoll(ragdoll, { ground: ARENA.ground, iterations: 6 })
  assert.equal(ragdollAtRest(ragdoll), true)
  const resting = ragdoll.points.filter((p) => p.y > ARENA.ground - 6)
  assert.ok(resting.length >= 2, 'something is lying on the floor')
})

test('snapshot is serialisable plain data', () => {
  const snapshot = ragdollSnapshot(make())
  assert.equal(snapshot.points.length, 6)
  assert.equal(snapshot.constraints.length, 8)
  assert.doesNotThrow(() => JSON.stringify(snapshot))
})
