/**
 * Round pacing: how long a fight lasts and how much of it is spent in each
 * state. "Both fighters flying around" is a symptom; these are the numbers.
 */
import { Arena, DT } from '../js/arena.js'
const idle = { left: false, right: false, jab: false, punch2: false, kick: false, upper: false, sweep: false, slide: false, block: false }

function run(seed) {
  const a = new Arena()
  a.begin()
  const counts = {}
  let frames = 0
  let press = 0
  for (let f = 0; f < 60 * 90; f++) {
    if (a.phase !== 'playing') break
    // A simple player: walk in, then alternate jab / kick.
    const gap = a.enemy.x - a.player.x
    press = (press + 1) % 24
    const inp = { ...idle }
    if (Math.abs(gap) > 70) inp[gap > 0 ? 'right' : 'left'] = true
    else if (press === 0) inp.jab = true
    else if (press === 12) inp.kick = true
    a.step(inp)
    for (const who of ['player', 'enemy']) {
      const s = a[who].state
      counts[who + ':' + s] = (counts[who + ':' + s] || 0) + 1
    }
    frames = f + 1
  }
  return { seconds: frames / 60, phase: a.phase, playerHp: a.player.hp, enemyHp: a.enemy.hp, counts }
}

for (const seed of [1, 2, 3]) {
  const r = run(seed)
  const total = Object.values(r.counts).reduce((x, y) => x + y, 0) / 2
  const pct = (k) => ((r.counts['enemy:' + k] || 0) / total * 100).toFixed(0) + '%'
  console.log(`round ${seed}: ${r.seconds.toFixed(1)}s  phase=${r.phase}  hp ${r.playerHp}/${r.enemyHp}`)
  console.log(`   enemy states: idle ${pct('idle')}  atk ${pct('atk')}  rag ${pct('rag')}  getup ${pct('getup')}  air ${pct('air')}`)
}
