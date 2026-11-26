/**
 * Every advertised key must do something observable — tested through the REAL
 * input path (session key map -> adapter -> arena), because that is where a
 * field-name mismatch hides.
 */
import { inputForCode, GAME_KEYS } from '../sim/session.mjs'
import { createDuel } from '../js/adapter.js'

const idle = { left:false,right:false,jump:false,jab:false,kick:false,hook:false,sweep:false,uppercut:false,retreat:false,slide:false,crouch:false,block:false,special:false }
const IGNORE = new Set(['Escape','Enter','NumpadEnter','ArrowUp','ArrowDown'])

console.log('key        field        effect')
console.log('-'.repeat(52))
let fails = 0
for (const code of GAME_KEYS) {
  if (IGNORE.has(code)) continue
  const f = inputForCode(code)
  if (!f) { console.log(code.padEnd(11), '(unmapped)'); continue }

  const duel = createDuel()
  duel.begin()
  const arena = duel.arena
  arena.enemy.x = arena.player.x + 55
  arena.enemy.aiStep = () => ({ left:false, right:false, move:null })
  arena.player.face = 1
  arena.player.superMeter = 100       // so the super key has something to spend

  const hp0 = arena.enemy.hp
  const x0 = arena.player.x
  let dmg = 0, attack = null, air = false, guard = false, crouch = false, moved = false, supered = false

  for (let i = 0; i < 26; i++) {
    duel.update(1000 / 60, { ...idle, [f]: true })
    const s = arena.snapshot()
    dmg = Math.max(dmg, hp0 - arena.enemy.hp)
    if (arena.player.state === 'atk' && !attack) attack = arena.player.atkName
    if (arena.player.state === 'air') air = true
    if (arena.player.block) guard = true
    if (arena.player.crouching) crouch = true
    if (Math.abs(arena.player.x - x0) > 6) moved = true
    if (arena.player.atkName === 'superMove') supered = true
    void s
  }
  for (let i = 0; i < 40; i++) {
    duel.update(1000 / 60, idle)
    dmg = Math.max(dmg, hp0 - arena.enemy.hp)
    if (arena.player.state === 'atk' && !attack) attack = arena.player.atkName
    if (arena.player.atkName === 'superMove') supered = true
  }

  const out = []
  if (dmg) out.push(`dmg${dmg}`)
  if (attack) out.push(`atk:${attack}`)
  if (moved) out.push('moves')
  if (air) out.push('air')
  if (guard) out.push('guard')
  if (crouch) out.push('crouch')
  const ok = out.length > 0
  if (!ok) fails++
  console.log(code.padEnd(11), f.padEnd(12), ok ? out.join(' ') : '*** NOTHING ***')
}
console.log('\n' + (fails ? `${fails} DEAD KEYS` : 'ALL KEYS LIVE'))
process.exit(fails ? 1 : 0)
