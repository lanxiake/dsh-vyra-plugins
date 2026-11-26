/**
 * Headless sanity check for the core: skeleton, poses, capsule hits.
 * Run: node scripts/check-core.mjs
 */
import { Fighter, ATK, DT } from '../js/fighter.js'
import { hitTest, resolveAttacks } from '../js/combat.js'
import { N, HEAD, HAND_F, FOOT_F, PELV } from '../js/rig.js'

const world = { groundY: 300, minX: 40, maxX: 920 }
let fail = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) fail++
}

const p = new Fighter('player', 400, world.groundY)
const e = new Fighter('enemy', 460, world.groundY)

// 1. Skeleton is fully positioned.
let finite = true
for (let i = 0; i < N; i++) if (!Number.isFinite(p.rig.x[i]) || !Number.isFinite(p.rig.y[i])) finite = false
check(finite, 'skeleton has 11 finite points')

// 2. Feet are near the floor at rest.
const footY = p.rig.y[FOOT_F]
check(Math.abs(footY - world.groundY) < 6, 'front foot rests on the floor', `y=${footY.toFixed(1)} vs ${world.groundY}`)

// 3. Head is above the pelvis, and the body is a sane height.
const height = world.groundY - (p.rig.y[HEAD] - 10.5)
check(p.rig.y[HEAD] < p.rig.y[PELV], 'head above pelvis')
check(height > 80 && height < 130, 'body is ~100 units tall', `h=${height.toFixed(0)}`)

// 4. A punch moves the fist forward substantially.
const restHand = p.rig.x[HAND_F]
p.startAttack('p1')
let maxAdvance = 0
for (let f = 0; f < Math.ceil(ATK.p1.dur / DT); f++) {
  p.step(world)
  maxAdvance = Math.max(maxAdvance, p.rig.x[HAND_F] - restHand)
}
check(maxAdvance > 25, 'punch extends the fist', `+${maxAdvance.toFixed(0)} units`)

// 5. The capsule hits a target it is touching and misses one across the room.
{
  const a = new Fighter('player', 400, world.groundY)
  const near = new Fighter('enemy', 445, world.groundY)
  const far = new Fighter('enemy', 800, world.groundY)
  a.startAttack('p1')
  let hitNear = false
  let hitFar = false
  for (let f = 0; f < Math.ceil(ATK.p1.dur / DT); f++) {
    a.step(world)
    const u = a.t / a.atk.dur
    if (u < a.atk.a || u > a.atk.b) continue
    const [hx, hy] = a.joint(a.atk.part)
    if (!hitNear && hitTest(hx, hy, a.atk.r * a.s, near)) hitNear = true
    if (!hitFar && hitTest(hx, hy, a.atk.r * a.s, far)) hitFar = true
  }
  check(hitNear, 'a jab connects with a target in front of it')
  check(!hitFar, 'a jab does not connect across the stage')
}

// 6. A kick launches the target into the ragdoll.
{
  const a = new Fighter('player', 400, world.groundY)
  const v = new Fighter('enemy', 440, world.groundY)
  let reaction = null
  a.startAttack('k')
  for (let f = 0; f < 90 && !reaction; f++) {
    a.step(world)
    v.step(world)
    resolveAttacks([a, v], world, (info) => { reaction = info.reaction })
  }
  check(reaction === 'launch' || reaction === 'ko', 'a kick launches or KOs', `reaction=${reaction}`)
  check(v.ragdolled || !v.alive, 'the launched body becomes a ragdoll')
}

// 7. The ragdoll settles and then gets up.
{
  const v = new Fighter('enemy', 500, world.groundY)
  v.launch(-300, -600, 2)
  let gotUp = false
  for (let f = 0; f < 600; f++) {
    v.step(world)
    if (v.state === 'getup') gotUp = true
    if (v.state === 'idle') break
  }
  check(gotUp, 'a ragdoll gets up again')
  check(v.state === 'idle' || v.state === 'air', 'and returns to a standing state', `state=${v.state}`)
}

// 8. Every move has a legal spec.
for (const [name, spec] of Object.entries(ATK)) {
  const ok = spec.dur > 0 && spec.a >= 0 && spec.b <= 1 && spec.a < spec.b && spec.r >= 0
  check(ok, `attack spec "${name}" is well-formed`)
}

console.log(fail === 0 ? '\nALL CORE CHECKS PASSED' : `\n${fail} CHECK(S) FAILED`)
process.exit(fail === 0 ? 0 : 1)
