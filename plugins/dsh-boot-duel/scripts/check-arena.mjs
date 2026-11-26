import { Arena, WORLD, DT } from '../js/arena.js'
import { N } from '../js/rig.js'

let fail = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) fail++
}
const idle = { left: false, right: false, jab: false, punch2: false, kick: false, upper: false, sweep: false, slide: false, block: false }

const arena = new Arena()
check(arena.phase === 'ready', 'starts in ready')

// Nothing can be hurt before the fight begins.
for (let i = 0; i < 120; i++) arena.step(idle)
check(arena.enemy.hp === arena.enemy.maxHp, 'ready phase is harmless')

arena.begin()
check(arena.phase === 'playing', 'begin() starts the fight')

// The AI should close the distance rather than stand still. Measured as the
// CLOSEST it ever gets, not the gap after a fixed time: the whole point of the
// design is that it closes in AND then backs off again, so sampling one
// instant catches it at a random point in that cycle.
{
  const a = new Arena()
  a.begin()
  const startGap = Math.abs(a.enemy.x - a.player.x)
  let closest = startGap
  for (let i = 0; i < 400; i++) {
    a.step(idle)
    closest = Math.min(closest, Math.abs(a.enemy.x - a.player.x))
  }
  check(closest < startGap * 0.6, 'the enemy closes in', `${startGap.toFixed(0)} -> closest ${closest.toFixed(0)}`)
}

// The player can land a punch.
{
  const a = new Arena()
  a.begin()
  a.enemy.x = a.player.x + 55
  a.enemy.aiStep = () => ({ left: false, right: false, move: null })
  a.player.face = 1
  let hp0 = a.enemy.hp
  a.step({ ...idle, jab: true })
  for (let i = 0; i < 40; i++) a.step(idle)
  check(a.enemy.hp < hp0, 'a jab damages the enemy', `${hp0} -> ${a.enemy.hp}`)
}

// A kick launches.
{
  const a = new Arena()
  a.begin()
  a.enemy.x = a.player.x + 60
  a.enemy.aiStep = () => ({ left: false, right: false, move: null })
  a.player.face = 1
  a.step({ ...idle, kick: true })
  let launched = false
  for (let i = 0; i < 60; i++) {
    a.step(idle)
    if (a.enemy.ragdolled) launched = true
  }
  check(launched, 'a kick puts the enemy in the ragdoll')
}

// Snapshot is drawable and finite.
{
  const s = arena.snapshot()
  let ok = true
  for (const who of ['player', 'enemy']) {
    for (const [x, y] of s[who].points) if (!Number.isFinite(x) || !Number.isFinite(y)) ok = false
  }
  check(ok, 'snapshot points are finite')
  check(s.player.points.length === N, 'snapshot carries the full skeleton')
}

console.log(fail === 0 ? '\nARENA OK' : `\n${fail} FAILED`)
process.exit(fail ? 1 : 0)
