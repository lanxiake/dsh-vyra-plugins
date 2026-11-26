/**
 * Adapter: the new `Arena` engine behind the `duel` interface the client half
 * already speaks.
 *
 * WHY AN ADAPTER. The client layer (keyboard handling, pause, unmount, the
 * audio wiring) is finished, tested, and must never trap the user. The engine
 * underneath it was replaced wholesale — this file is the seam, and it exists
 * so that replacement did not require rewriting the layer that guards the exit.
 *
 * The `duel` contract, as the client uses it:
 *   begin()            leave the opening stance
 *   getSnapshot()      the current frame, safe to draw
 *   getState()         'ready' | 'playing' | 'ko' | 'done'
 *   update(dtMs, in)   advance by real time, return { events }
 *   skip()             jump to the outro
 */

import { Arena, WORLD, DT } from './arena.js'

/** Map one client input field onto the arena's input shape. */
function toArenaInput(input = {}) {
  return {
    left: Boolean(input.left),
    right: Boolean(input.right),
    jump: Boolean(input.jump),
    jab: Boolean(input.jab),
    punch2: Boolean(input.hook),
    kick: Boolean(input.kick),
    upper: Boolean(input.uppercut),
    sweep: Boolean(input.sweep),
    // Shift / S is the retreat, and the engine's answer to it is a back-hop.
    retreat: Boolean(input.retreat),
    slide: Boolean(input.slide),
    block: Boolean(input.block),
    crouch: Boolean(input.crouch),
    special: Boolean(input.special),
  }
}

/**
 * `createDuel({ reducedMotion })` — the engine, presented as the old facade.
 *
 * `events` are the cue names the audio layer already understands: `whoosh`
 * when a swing starts, `thud` when it lands, `clink` on a block, `boom` on a
 * knockout.
 */
export function createDuel({ reducedMotion = false, round = 0 } = {}) {
  const arena = new Arena({ reducedMotion, round })
  let events = []
  let lastPhase = arena.phase
  let clock = 0

  // The arena has no event queue of its own; hook the hit reaction so the
  // adapter can report it on the next update.
  const originalOnHit = arena.onHit.bind(arena)
  arena.onHit = (hit) => {
    originalOnHit(hit)
    if (hit.kill) events.push('boom')
    else if (hit.reaction === 'launch') events.push('heavy')
    else events.push('thud')
  }

  function begin() {
    return arena.begin()
  }

  function getState() {
    // The client looks for 'done' to unmount, and `ko` for the outro.
    if (arena.phase === 'ready') return 'ready'
    if (arena.phase === 'playing') return 'playing'
    if (arena.phase === 'ko') return 'ko'
    return 'done'
  }

  function snapshot() {
    const s = arena.snapshot()
    const fighter = (f) => ({
      x: f.x,
      y: f.y,
      facing: f.face,
      hp: f.hp,
      maxHp: f.maxHp,
      action: f.state === 'atk' ? 'attack' : null,
      actionFrame: 0,
      blocking: false,
      stagger: f.state === 'hurt' ? 1 : 0,
      onGround: f.y >= WORLD.groundY - 1,
      // The fields the new renderer needs, carried through untouched.
      state: f.state,
      scale: f.scale,
      time: f.time,
      flash: f.flash,
      tele: f.tele,
      points: f.points,
      lw: f.lw,
    })
    return {
      phase: getState(),
      clock,
      player: fighter(s.player),
      enemy: fighter(s.enemy),
      particles: s.particles,
      hit: s.hit,
      juice: s.juice,
      /** Carried for the HUD only. */
      meter: s.superMeter ?? 0,
      meterMax: 100,
      specialReady: Boolean(s.superReady),
      /** The line on screen, and who is in the round's story. */
      line: s.line ?? null,
      cast: s.cast ?? { you: '你', rival: '对手' },
      combo: s.combo ?? 0,
      comboPop: s.comboPop ?? 0,
      superBanner: s.superBanner ?? 0,
      cinematic: s.cinematic ?? 0,
      block: s.block ?? false,
      crouching: s.crouching ?? false,
      impact: s.hit,
      fx: { shake: 0, flash: s.juice?.flashA ?? 0, shockwave: 0, zoom: 0, particles: s.particles },
    }
  }

  function update(dtMs) {
    // The client calls `update` with real elapsed time; the arena steps at a
    // fixed 60 Hz, so accumulate and drain.
    const step = Math.max(0, Math.min(250, Number.isFinite(dtMs) ? dtMs : 0))
    clock += step
    const simScale = arena.juice.update(step / 1000)
    updateAcc += step * simScale
    let steps = 0
    while (updateAcc >= DT * 1000 && steps < 5) {
      arena.step(arenaInput)
      updateAcc -= DT * 1000
      steps++
    }
    const view = snapshot()
    lastView = view
    const out = { events, snapshot: view }
    events = []
    lastPhase = arena.phase
    return out
  }

  /** The most recent input the client handed us, applied on the next step. */
  let arenaInput = toArenaInput({})
  let updateAcc = 0
  /** The frame the last `update` produced, handed back verbatim. */
  let lastView = null

  return {
    get phase() { return getState() },
    getState,
    getSnapshot: () => lastView ?? snapshot(),
    begin,
    skip() {
      if (arena.phase === 'ready' || arena.phase === 'playing') {
        arena.enemy.hp = 0
        arena.phase = 'ko'
        arena.koT = 0
        return true
      }
      return false
    },
    /** Start a fresh round, for the settings panel's "再来一局". */
    restart(round) {
      arena.restart(round)
      events = []
      lastView = null
      clock = 0
      return true
    },
    forceKo() {
      arena.enemy.hp = 0
      arena.phase = 'ko'
      arena.koT = 0
    },
    counterReady: () => 0,
    update(dtMs, input) {
      arenaInput = toArenaInput(input)
      return update(dtMs)
    },
    tick(input) {
      arenaInput = toArenaInput(input)
      arena.step(arenaInput)
      return { events: [], snapshot: snapshot() }
    },
    /** Exposed so a test or the preview can reach the engine directly. */
    arena,
  }
}

export { WORLD }
