/**
 * Which moves connect at which distances. This is the contract the user
 * complained about, stated as numbers.
 */
import { Fighter, ATK, DT } from '../js/fighter.js'
import { resolveAttacks } from '../js/combat.js'
const world = { groundY: 300, minX: 40, maxX: 920 }
const moves = ['p1', 'p2', 'p3', 'k', 'sweep']
console.log('gap  ' + moves.map((m) => m.padEnd(7)).join(''))
for (let gap = 20; gap <= 140; gap += 10) {
  const row = []
  for (const m of moves) {
    const a = new Fighter('player', 400, world.groundY)
    const v = new Fighter('enemy', 400 + gap, world.groundY)
    a.startAttack(m)
    let hit = false
    for (let f = 0; f < 120 && !hit; f++) {
      a.step(world)
      v.step(world)
      resolveAttacks([a, v], world, () => { hit = true })
    }
    row.push((hit ? 'HIT' : '.').padEnd(7))
  }
  console.log(String(gap).padStart(3) + '  ' + row.join(''))
}
