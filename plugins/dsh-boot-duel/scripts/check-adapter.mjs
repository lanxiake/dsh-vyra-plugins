import { createDuel } from '../js/adapter.js'
let fail = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) fail++
}
const idle = { left: false, right: false, jab: false, hook: false, kick: false, uppercut: false, sweep: false, retreat: false, block: false }

const duel = createDuel()
check(duel.getState() === 'ready', 'adapter starts ready')
const s0 = duel.getSnapshot()
check(s0.player && s0.enemy, 'snapshot has both fighters')
check(Array.isArray(s0.player.points) && s0.player.points.length === 11, 'snapshot carries the skeleton')

check(duel.begin() === true, 'begin() works')
check(duel.getState() === 'playing', 'state advances to playing')

let ticks = 0
for (let i = 0; i < 600; i++) {
  const r = duel.update(1000 / 60, idle)
  ticks++
  if (r.events.length) { /* cues are fine */ }
}
const s1 = duel.getSnapshot()
check(ticks === 600, 'update() runs without throwing')
check(typeof s1.player.hp === 'number', 'hp is a number after a run')

// Skip jumps to the outro.
const d2 = createDuel()
d2.begin()
check(d2.skip() === true, 'skip() from playing works')
check(d2.getState() === 'ko' || d2.getState() === 'done', 'skip ends the fight')
check(d2.skip() === false, 'a second skip is refused')

console.log(fail === 0 ? '\nADAPTER OK' : `\n${fail} FAILED`)
process.exit(fail ? 1 : 0)
