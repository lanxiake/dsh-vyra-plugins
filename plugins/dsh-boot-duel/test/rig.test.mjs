import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RIG, clamp, lerp, ease, easeOut, easeBack, kf, solveIK, poseJoints, poseFor, MOVES_RIG,
} from '../rig.js'
import { createDuel } from '../sim/duel.mjs'

/* ------------------------------------------------------------------ easing */

test('easing helpers stay inside 0..1 where they claim to', () => {
  for (const t of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
    for (const fn of [ease, easeOut]) {
      const v = fn(t)
      assert.ok(v >= 0 && v <= 1, `${fn.name}(${t}) = ${v}`)
    }
    assert.ok(clamp(t) >= 0 && clamp(t) <= 1)
  }
  // easeBack overshoots on purpose — that is what gives a recoil its snap.
  assert.ok(easeBack(0.7) > 1)
})

test('interpolation is continuous at the key times and clamps outside them', () => {
  const keys = [[0, 0], [1, 10], [2, 0]]
  assert.equal(kf(-5, keys), 0)
  assert.equal(kf(1, keys), 10)
  assert.equal(kf(5, keys), 0)
  // Monotonic on the way up, which is what keeps a swing from jittering.
  const mid = kf(0.5, keys)
  assert.ok(mid > 0 && mid < 10)
})

/* ---------------------------------------------------------------------- IK */

test('IK reaches a close target exactly', () => {
  const origin = [0, 0]
  const target = [120, 40]
  const { end, over } = solveIK(origin, target, RIG.upperArm, RIG.foreArm, 1)
  assert.equal(over, 0)
  assert.ok(Math.abs(end[0] - 120) < 0.001 && Math.abs(end[1] - 40) < 0.001)
})

test('IK never stretches a limb past its own length', () => {
  const reach = RIG.upperArm + RIG.foreArm
  const { end, over } = solveIK([0, 0], [9999, 0], RIG.upperArm, RIG.foreArm, 1)
  assert.ok(Math.hypot(end[0], end[1]) <= reach + 0.001)
  assert.ok(over > 0, 'an out-of-reach target reports how far it was')
})

test('IK keeps each limb segment at its bone length', () => {
  const { joint, end } = solveIK([0, 0], [60, 90], RIG.upperArm, RIG.foreArm, -1)
  assert.ok(Math.abs(Math.hypot(joint[0], joint[1]) - RIG.upperArm) < 0.001)
  assert.ok(Math.abs(Math.hypot(end[0] - joint[0], end[1] - joint[1]) - RIG.foreArm) < 0.001)
})

/* ------------------------------------------------------------------- poses */

function fighter(over = {}) {
  return {
    x: 480, y: 300, facing: 1, hp: 100, action: null, actionFrame: 0,
    blocking: false, stagger: 0, onGround: true, ...over,
  }
}

test('a neutral figure has joints in the expected places', () => {
  const j = poseJoints(fighter(), { time: 0 })
  assert.ok(j.head[1] < j.chest[1], 'head is above the chest')
  assert.ok(j.chest[1] < j.hip[1], 'chest is above the hips')
  assert.ok(j.footFront[1] > j.hip[1], 'feet are below the hips')
  // A standing figure is 640 rig units * 0.219 = 140 world units from the
  // crown to the sole, which is 35% of the 400-unit arena. The bound is
  // derived from the rig's own numbers rather than a literal, so resizing the
  // figure does not silently invalidate this test.
  const expected = 640 * RIG.scale
  const height = Math.abs(j.footFront[1] - (j.head[1] - j.headRadius))
  assert.ok(Math.abs(height - expected) < 6, `crown-to-sole ${height}, expected ~${expected}`)
})

test('a jab actually extends the front hand forward', () => {
  const idle = poseJoints(fighter(), { time: 0 })
  // Frame 5 is the contact frame of the jab (windup 4, active 3).
  // Frame 5 is the jab's contact frame (windup 3, active 3) — the one where
  // the fist is furthest out.
  const punch = poseJoints(fighter({ action: 'jab', actionFrame: 5 }), { time: 0 })
  // The extension is a fraction of the figure's own size, so it is asserted
  // that way: a seventh of the body height is the least that reads as a punch
  // at any zoom level, and it is bounded above by the arm's own length, which
  // is what stops the IK from drawing a telescoping limb.
  const bodyHeight = 640 * RIG.scale
  const armLength = (RIG.upperArm + RIG.foreArm) * RIG.scale
  const extended = punch.handFront[0] - idle.handFront[0]
  assert.ok(extended > bodyHeight * 0.14,
    `jab extends ${extended.toFixed(1)}, needs > ${(bodyHeight * 0.14).toFixed(1)}`)
  assert.ok(extended <= armLength,
    `jab extends ${extended.toFixed(1)}, longer than the arm (${armLength.toFixed(1)})`)
})

test('a kick lifts the front foot off the floor', () => {
  const idle = poseJoints(fighter(), { time: 0 })
  const kick = poseJoints(fighter({ action: 'kick', actionFrame: 11 }), { time: 0 })
  assert.ok(kick.footFront[1] < idle.footFront[1] - 25,
    `kick foot ${kick.footFront[1]} vs idle ${idle.footFront[1]}`)
})

test('the finisher charges low and cuts high, in that order', () => {
  const charge = poseJoints(fighter({ action: 'special', actionFrame: 15 }), { time: 0 })
  const cut = poseJoints(fighter({ action: 'special', actionFrame: 19 }), { time: 0 })
  // Charging sinks the hips and draws both hands up behind the head.
  assert.ok(charge.handFront[1] < charge.chest[1], 'charge: hands above the chest')
  // The cut throws the hands forward and down.
  assert.ok(cut.handFront[0] > charge.handFront[0] + 35, 'cut: hands travel forward')
  assert.ok(cut.handFront[1] > charge.handFront[1], 'cut: hands come down')
})

test('mirroring by facing keeps the rig symmetric', () => {
  const right = poseJoints(fighter({ facing: 1 }), { time: 0 })
  const left = poseJoints(fighter({ facing: -1 }), { time: 0 })
  // The spine and the ground contact mirror exactly — neither involves IK.
  assert.ok(Math.abs(right.chest[1] - left.chest[1]) < 0.001)
  assert.ok(Math.abs(right.hip[1] - left.hip[1]) < 0.001)
  assert.ok(Math.abs(right.footFront[1] - left.footFront[1]) < 0.001)
  assert.equal(right.kind, left.kind)
  // Limbs are mirrored in X, but an elbow bends in a fixed screen direction
  // (see `solveIK`), so the hand does not land at the same height on both
  // sides. That is deliberate — it is how the reference draws a side view,
  // where both fighters' elbows point down the screen. What must hold is that
  // the front hand leads the body on either side.
  const rightReach = right.handFront[0] - right.chest[0]
  const leftReach = left.handFront[0] - left.chest[0]
  assert.ok(rightReach > 10, `right hand leads, reach ${rightReach}`)
  assert.ok(leftReach < -10, `left hand leads, reach ${leftReach}`)
})

test('a staggered fighter is doubled over, not standing upright', () => {
  const upright = poseJoints(fighter(), { time: 0 })
  const reeling = poseJoints(fighter({ stagger: 8 }), { time: 0 })
  assert.equal(reeling.kind, 'stagger')
  assert.ok(reeling.head[0] < upright.head[0] - 5, 'head leans away from the blow')
})

test('poseFor picks the right table', () => {
  assert.equal(poseFor(fighter()), null)
  assert.equal(poseFor(fighter({ blocking: true })), 'block')
  assert.equal(poseFor(fighter({ action: 'jab' })), 'jab')
  assert.equal(poseFor(fighter({ action: 'jab', stagger: 4 })), 'stagger')
})

test('every move in the sim has a rig entry', () => {
  for (const move of ['jab', 'kick', 'special']) {
    assert.ok(MOVES_RIG[move], `rig missing ${move}`)
  }
})

test('a live duel produces poses for every frame of a round', () => {
  const duel = createDuel({ seed: 3, difficulty: 'easy' })
  duel.begin()
  for (let frame = 0; frame < 600; frame++) {
    const snapshot = duel.getSnapshot()
    for (const who of ['player', 'enemy']) {
      const j = poseJoints(snapshot[who], { time: frame / 60 })
      for (const [name, point] of Object.entries(j)) {
        if (!Array.isArray(point)) continue
        assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]),
          `${who}.${name} not finite at frame ${frame}: ${point}`)
      }
    }
    duel.update(1000 / 60)
  }
})
