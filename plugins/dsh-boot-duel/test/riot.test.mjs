/**
 * The finisher's integration check.
 *
 * The riot demo proves the PICTURE. This proves the TIMELINE: that the chair
 * arrives inside the swing's active window (so the hit has one damage path),
 * that the cinematic plays all five beats and returns control, and that the
 * wreck settles and then goes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel } from '../js/adapter.js'
import { RIOT } from '../js/riot.js'
import { ATK } from '../js/fighter.js'

const IDLE = {
  left: false, right: false, jump: false, jab: false, punch2: false, kick: false,
  upper: false, sweep: false, slide: false, retreat: false, block: false,
  crouch: false, special: false,
}

function ready() {
  const duel = createDuel({ seed: 7, difficulty: 'easy', round: 0 })
  duel.begin()
  const a = duel.arena
  for (let i = 0; i < 60 * 20 && a.openQueue > 0; i++) duel.update(1000 / 60, IDLE)
  a.player.x = 420
  a.enemy.x = 500
  a.player.vx = 0
  a.enemy.vx = 0
  a.player.face = 1
  a.enemy.ai.cd = 60
  a.player.superMeter = 100
  a.player.superReady = true
  return duel
}

test('the chair lands inside the swing, so one hit has one damage path', () => {
  // The cinematic releases `superMove` at the strike beat (940 ms). Its active
  // window is a..b of `dur`; the chair's arrival has to fall inside it.
  const releasedAt = RIOT.nameEnd
  const chair = { launch: 1220, flight: 252 }
  const arrive = chair.launch + chair.flight
  const a = releasedAt + ATK.superMove.a * ATK.superMove.dur * 1000
  const b = releasedAt + ATK.superMove.b * ATK.superMove.dur * 1000
  assert.ok(arrive >= a && arrive <= b,
    `chair arrives at ${arrive}ms; the swing is live ${a.toFixed(0)}..${b.toFixed(0)}ms`)
})

test('the finisher plays every beat and gives control back', () => {
  const duel = ready()
  duel.update(1000 / 60, { ...IDLE, special: true })
  const a = duel.arena
  assert.ok(a.superCine, 'the press has to start the cinematic')
  const seen = new Set()
  for (let i = 0; i < 60 * 4 && a.superCine; i++) {
    seen.add(a.superCine.phase)
    duel.update(1000 / 60, IDLE)
  }
  assert.equal(a.superCine, null, 'the cinematic must end on its own')
  for (const beat of ['charge', 'name', 'strike', 'impact', 'recover']) {
    assert.ok(seen.has(beat), `beat ${beat} never played; saw ${[...seen].join(',')}`)
  }
  assert.equal(a.player.state, 'idle', 'control has to come back')
})

test('the furniture hits the rival and leaves a wreck that settles', () => {
  const duel = ready()
  const before = duel.arena.enemy.hp
  duel.update(1000 / 60, { ...IDLE, special: true })
  const a = duel.arena
  for (let i = 0; i < 60 * 4 && a.superCine; i++) duel.update(1000 / 60, IDLE)
  assert.ok(a.enemy.hp < before, `the finisher dealt no damage (${a.enemy.hp}/${before})`)
  assert.ok(a.riot, 'the wreck should still be on screen right after the cinematic')
  for (let i = 0; i < 60 * 2; i++) duel.update(1000 / 60, IDLE)
  assert.equal(a.riot, null, 'the wreck has to leave once it has settled')
})

test('the beat table and the furniture table agree', () => {
  assert.ok(RIOT.debrisAt < RIOT.impactEnd, 'debris has to fire inside the impact beat')
  assert.ok(RIOT.stampAt < RIOT.impactEnd, 'the stamp has to land inside the impact beat')
  assert.ok(RIOT.stampAt > RIOT.debrisAt, 'the verdict comes after the wreck')
  assert.ok(RIOT.nameEnd === 940 && RIOT.strikeEnd === 1240,
    'these are the arena BEAT boundaries; changing one without the other desyncs the picture')
})