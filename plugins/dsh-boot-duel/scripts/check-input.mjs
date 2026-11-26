/** Every player action must actually change the world. */
import { Arena } from '../js/arena.js'
import { createDuel } from '../js/adapter.js'

let fail = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) fail++
}
const idle = { left: false, right: false, jump: false, jab: false, punch2: false, kick: false, upper: false, sweep: false, slide: false, retreat: false, block: false }

// JUMP
{
  const a = new Arena(); a.begin()
  const y0 = a.player.y
  a.step({ ...idle, jump: true })
  let peak = y0
  for (let i = 0; i < 40; i++) { a.step(idle); peak = Math.min(peak, a.player.y) }
  check(peak < y0 - 30, 'jump lifts the player', `y ${y0.toFixed(0)} -> ${peak.toFixed(0)}`)
  check(Math.abs(a.player.y - y0) < 2, 'and lands again', `y=${a.player.y.toFixed(0)}`)
}

// RETREAT
{
  const a = new Arena(); a.begin()
  a.enemy.x = a.player.x + 60
  const x0 = a.player.x
  a.step({ ...idle, retreat: true })
  for (let i = 0; i < 40; i++) a.step(idle)
  check(Math.abs(a.player.x - x0) > 60, 'retreat clears ground', `moved ${Math.abs(a.player.x - x0).toFixed(0)} units`)
}

// CHAIN: two punches in one string both land.
//
// The opponent is pinned in place so this measures the CHAIN and not the
// spacing: a real second punch has to re-close after the first one shoves the
// target away, which is a different (and also correct) behaviour.
{
  const a = new Arena(); a.begin()
  a.enemy.aiStep = () => ({ left: false, right: false, move: null })
  a.player.x = 400
  a.enemy.x = 455
  a.player.face = 1
  // Pin the target: only its health changes.
  const pin = a.keepApart.bind(a)
  a.keepApart = () => { a.enemy.x = a.player.x + 55 }
  void pin
  a.step({ ...idle, jab: true })
  let landed = 0
  let lastHp = a.enemy.hp
  for (let i = 0; i < 5; i++) { a.step(idle); if (a.enemy.hp < lastHp) { landed++; lastHp = a.enemy.hp } }
  a.step({ ...idle, jab: true })     // chain window is open
  for (let i = 0; i < 30; i++) {
    a.step(idle)
    if (a.enemy.hp < lastHp) { landed++; lastHp = a.enemy.hp }
  }
  check(landed >= 2, 'jab chains into a second jab', `${landed} hits landed`)
}

// WALK
{
  const a = new Arena(); a.begin()
  const x0 = a.player.x
  for (let i = 0; i < 30; i++) a.step({ ...idle, right: true })
  check(a.player.x > x0 + 20, 'walking right moves the player', `${(a.player.x - x0).toFixed(0)} units`)
}

// The adapter carries all of it.
{
  const d = createDuel(); d.begin()
  const x0 = d.getSnapshot().player.x
  for (let i = 0; i < 40; i++) d.update(1000 / 60, { ...idle, right: true })
  check(Math.abs(d.getSnapshot().player.x - x0) > 15, 'adapter: walking works')
}

console.log(fail === 0 ? '\nINPUT OK' : `\n${fail} FAILED`)
process.exit(fail ? 1 : 0)
