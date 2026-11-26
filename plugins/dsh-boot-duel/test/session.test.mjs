import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSession, inputForCode, GAME_KEYS, hasPassed, markPassed, resetPassed } from '../sim/session.mjs'
import { createDuel } from '../sim/duel.mjs'

const idle = { left: false, right: false, jump: false, jab: false, kick: false, block: false }

test('key codes map onto the documented controls', () => {
  assert.equal(inputForCode('KeyA'), 'left')
  assert.equal(inputForCode('ArrowLeft'), 'left')
  assert.equal(inputForCode('KeyD'), 'right')
  assert.equal(inputForCode('ArrowRight'), 'right')
  assert.equal(inputForCode('Space'), 'jump')
  assert.equal(inputForCode('KeyW'), 'jump')
  assert.equal(inputForCode('KeyJ'), 'jab')
  assert.equal(inputForCode('KeyK'), 'kick')
  assert.equal(inputForCode('KeyL'), 'block')
  assert.equal(inputForCode('KeyZ'), null)
})

test('Escape skips the fight while it is playing', () => {
  const duel = createDuel({ seed: 1, difficulty: 'easy' })
  duel.begin()
  const session = createSession({ duel })
  assert.equal(duel.getState(), 'playing')
  assert.equal(session.keyDown('Escape'), true)
  assert.equal(duel.getState(), 'ko')
})

test('Escape during the KO outro is not consumed', () => {
  const duel = createDuel({ seed: 2, difficulty: 'easy' })
  const session = createSession({ duel })
  session.keyDown('Escape')
  assert.equal(duel.getState(), 'ko')
  assert.equal(session.keyDown('Escape'), false, 'second Esc is a no-op')
  session.frame(16)
  assert.equal(session.keyDown('Escape'), false, 'still a no-op mid-outro')
})

test('keys the game does not know are not consumed', () => {
  const duel = createDuel({ seed: 3, difficulty: 'easy' })
  const session = createSession({ duel })
  assert.equal(session.keyDown('KeyZ'), false)
  assert.equal(session.keyUp('KeyZ'), false)
})

test('holding then releasing a key updates the input set', () => {
  const duel = createDuel({ seed: 4, difficulty: 'easy' })
  duel.begin()
  const session = createSession({ duel })
  session.keyDown('KeyD')
  session.keyDown('KeyJ')
  const input = session.input()
  assert.equal(input.right, true)
  assert.equal(input.jab, true)
  assert.equal(input.left, false)
  session.keyUp('KeyD')
  assert.equal(session.input().right, false)
})

test('pause releases held keys and blocks frames', () => {
  const duel = createDuel({ seed: 5, difficulty: 'easy' })
  const session = createSession({ duel })
  session.keyDown('KeyD')
  session.pause()
  assert.equal(session.input().right, false, 'holding nothing while paused')
  assert.equal(session.frame(16), null)
  session.resume()
  assert.notEqual(session.frame(16), null)
})

test('unmount stops further frames and never throws', () => {
  const duel = createDuel({ seed: 6, difficulty: 'easy' })
  const session = createSession({ duel })
  session.unmount()
  assert.doesNotThrow(() => session.frame(16))
  assert.equal(session.isFinished(), true)
})

test('a throwing duel is reported once and finishes the session', () => {
  const broken = {
    update() { throw new Error('boom') },
    skip() { return false },
    getState() { return 'playing' },
    getSnapshot() { return {} },
  }
  let errors = 0
  const session = createSession({ duel: broken, onError: () => { errors++ } })
  assert.doesNotThrow(() => session.frame(16))
  assert.equal(errors, 1)
  assert.equal(session.isFinished(), true)
  assert.equal(session.frame(16), null, 'no further frames after a failure')
})

test('a throwing error reporter cannot escape', () => {
  const broken = {
    update() { throw new Error('boom') },
    skip() { return false },
    getState() { return 'playing' },
  }
  const session = createSession({
    duel: broken,
    onError: () => { throw new Error('reporter broke') },
  })
  assert.doesNotThrow(() => session.frame(16))
})

test('a throwing event listener cannot escape', () => {
  const duel = createDuel({ seed: 7, difficulty: 'easy' })
  const session = createSession({
    duel,
    onEvent: () => { throw new Error('listener broke') },
  })
  assert.doesNotThrow(() => {
    for (let i = 0; i < 60; i++) session.frame(16)
  })
})

test('the session finishes itself once the duel reaches done', () => {
  const duel = createDuel({ seed: 8, difficulty: 'easy' })
  const session = createSession({ duel })
  session.keyDown('Escape')
  for (let i = 0; i < 400 && !session.isFinished(); i++) session.frame(16)
  assert.equal(session.isFinished(), true)
})

test('the passed flag is in-memory only', () => {
  resetPassed()
  assert.equal(hasPassed(), false)
  markPassed()
  assert.equal(hasPassed(), true)
  resetPassed()
  assert.equal(hasPassed(), false)
})

test('every documented key is in GAME_KEYS', () => {
  for (const code of ['Space', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW', 'KeyJ', 'KeyK', 'KeyL', 'Escape', 'Enter']) {
    assert.ok(GAME_KEYS.includes(code), `missing ${code}`)
  }
  for (const code of ['KeyU', 'KeyI']) {
    assert.ok(GAME_KEYS.includes(code), `missing finisher key ${code}`)
    assert.equal(inputForCode(code), 'special')
  }
  // The extended attack cluster: each key must map to its own move.
  for (const [code, field] of [['KeyH', 'hook'], ['KeyG', 'sweep'], ['KeyF', 'uppercut']]) {
    assert.ok(GAME_KEYS.includes(code), `missing ${code}`)
    assert.equal(inputForCode(code), field)
  }
  // Retreat: the Shift keys mean "give ground".
  for (const code of ['ShiftLeft', 'ShiftRight']) {
    assert.ok(GAME_KEYS.includes(code), `missing ${code}`)
    assert.equal(inputForCode(code), 'retreat')
  }
  // Crouch, guard, slide and the super each have exactly one key.
  assert.equal(inputForCode('KeyS'), 'crouch')
  assert.equal(inputForCode('KeyL'), 'block')
  assert.equal(inputForCode('KeyN'), 'slide')
  assert.equal(inputForCode('KeyU'), 'special')
  assert.equal(inputForCode('KeyI'), 'special')
  // Letters that belong to typing, not to the fight, stay out.
  for (const code of ['KeyB', 'KeyQ', 'KeyZ', 'Tab']) {
    assert.equal(GAME_KEYS.includes(code), false, `${code} must not be captured`)
  }
  void idle
})
