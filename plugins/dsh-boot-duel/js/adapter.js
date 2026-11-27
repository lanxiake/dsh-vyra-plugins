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

/**
 * The buttons that fire on a press, not on a hold.
 *
 * Movement, guard and crouch are HELD states: the arena reads them every step.
 * Everything here is a one-shot action, and it must be delivered exactly once
 * no matter how the frame timing lands — see the note in `update`.
 */
const EDGE_KEYS = ['jump', 'retreat', 'special', 'jab', 'punch2', 'kick', 'upper', 'sweep', 'slide']

/**
 * The most simulation steps one `update` may run. A long stall (a tab
 * backgrounded for a second) must not replay the whole missing second in one
 * frame: the spiral-of-death guard. Five is a third of a second.
 */
const MAX_STEPS = 5

/**
 * The edge input to hand the arena, with the two-button shorthand resolved.
 *
 * A press that the shorthand turns into a named move (down + kick → sweep)
 * replaces the raw button: handing the arena BOTH would let the raw `kick`
 * fire first in its key order. The direction held on THIS frame is what the
 * reader uses, so the player never has to hold down a frame early.
 */
function edgeFor(pending, held) {
  const out = {}
  for (const key of EDGE_KEYS) out[key] = pending.has(key)
  // Explicit keys (H/G/F/N) win: they are the old layout and mean exactly
  // one thing each, so a chord never overrides them.
  const resolved = resolveMove(out, held)
  if (resolved) {
    out.jab = false
    out.kick = false
    out[resolved === 'p1' ? 'jab' : resolved === 'p3' ? 'upper' : resolved === 'k' ? 'kick' : resolved === 'sweep' ? 'sweep' : 'slide'] = true
  }
  return out
}

/**
 * Resolve a two-button input into the engine's single-move vocabulary.
 *
 * The game advertises J/K plus a direction; the engine's attack table has
 * one name per move. The READER must happen here, in the adapter, because
 * this is the layer that knows the HELD direction and the PRESSED button
 * together on the same frame:
 *
 *     J               jab            (p1)
 *     J + down        uppercut       (p3)   — a launcher
 *     K               kick           (k)
 *     K + down        sweep          (sweep)
 *     K toward foe    slide          (slide)
 *
 * Doing it in the engine meant the direction had to be simulated a step
 * ahead of the button, which is exactly what a two-button fighting game does
 * NOT require of its player. The engine still accepts the explicit keys
 * (hook/sweep/uppercut/slide) for anyone on the old layout.
 */
function resolveMove(input, held) {
// `held` is the direction as it stands this frame; `input` is the press.
if (input.jab) {
  if (held.crouch) return 'p3'
  return 'p1'
}
if (input.kick) {
  if (held.crouch) return 'sweep'
  // Toward the opponent is a slide; left/right is the player's own facing,
  // which the engine does not know here, so the arena resolves the "toward"
  // part when it applies the move.
  if (held.left || held.right) return 'slide'
  return 'k'
}
return null
}

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
export function createDuel({ reducedMotion = false, round = 0, difficulty = 'easy' } = {}) {
  const arena = new Arena({ reducedMotion, round, difficulty })
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
      /**
       * The costume mark. The adapter rebuilds the fighter field by field, so
       * anything the arena adds to its view and this list does not name is
       * silently dropped — which is how the topknot reached the renderer as
       * `undefined` and simply never drew.
       */
      topknot: f.topknot,
      /**
       * Motion state for the qi effects. `atkU` is how far through the current
       * move the fighter is (0..1), which is what decides when a strike is
       * committed enough to draw its 拳锋 streak; `vy` is the vertical speed,
       * which is what decides whether a foot is pushing off empty air.
       */
      atkU: f.atkU,
      vy: f.vy,
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
      /** The landing rings, for the 震地环. */
      land: s.land ?? null,
      combo: s.combo ?? 0,
      comboPop: s.comboPop ?? 0,
      superBanner: s.superBanner ?? 0,
      /** The finisher's five-beat cinematic, or null when none is playing. */
      superCine: s.superCine ?? null,
      cinematic: s.cinematic ?? 0,
      /** The finish's own beats, so the DOM overlay lands on the game's clock. */
      koBeat: s.koBeat ?? null,
      koT: s.koT ?? 0,
      /** 'win' | 'lose' | null — which stamp the finish shows. */
      result: s.result ?? null,
      block: s.block ?? false,
      crouching: s.crouching ?? false,
      impact: s.hit,
      fx: { shake: 0, flash: s.juice?.flashA ?? 0, shockwave: 0, zoom: 0, particles: s.particles },
    }
  }

  /**
 * The timer that drives the duel, wrapped so the order is explicit.
 *
 * `juice.update` returns how much SIMULATION time this real slice buys. When a
 * hit-stop is running it returns 0 — the screen is frozen — and NO arena step
 * runs. That is correct for the world, but it means the fixed-step accumulator
 * inherits a deadline that can be up to one full step away: right after a hit
 * the very next call can be 100 ms of real input applied to a clock that has
 * not moved yet. Input must never wait on that.
 */
function simStep(dtMs) {
  return arena.juice.update(dtMs / 1000)
}

function update(dtMs) {
    // The client calls `update` with real elapsed time; the arena steps at a
    // fixed 60 Hz, so accumulate and drain.
    const step = Math.max(0, Math.min(250, Number.isFinite(dtMs) ? dtMs : 0))
    clock += step
    const simScale = simStep(step)

    /**
     * LATCH NEW PRESSES.
     *
     * A press is latched only on the RISING EDGE as the client sees it: down
     * now, up last time. That is what makes a HELD key one press rather than a
     * press every frame, and what makes a tap that begins and ends between two
     * updates still fire.
     *
     * A latched press stays latched until an arena pass consumes it. That is
     * what lets it survive a frozen frame (hit-stop) and a sub-frame update
     * (120 Hz), either of which would otherwise swallow it before a step sees
     * it — which is exactly how a combo cancel got eaten on the frame the
     * player's own hit froze the world.
     */
    for (const key of EDGE_KEYS) {
      if (arenaInput[key] && !rawPrev[key]) pressed.add(key)
    }
    rawPrev = arenaInput

    const simMs = step * simScale
    updateAcc += simMs

    /**
     * The epsilon matters. `DT * 1000` is 16.666… ms; a 120 Hz display adds
     * 8.333… twice, which can land a fraction under the threshold and leave a
     * high-refresh player running at half speed forever.
     */
    const FRAME_MS = DT * 1000 - 1e-4
    let steps = 0
    while (updateAcc >= FRAME_MS && steps < MAX_STEPS) {
      // The presses that are due are the ones latched BEFORE this call. A
      // press that arrived this call gets its own input pass after the step,
      // so the arena has already seen the held direction ("down + punch").
      const due = new Set(pressed)
      for (const key of due) pressed.delete(key)

      arena.step({ ...heldInput, ...edgeFor(due, heldInput) })
      updateAcc -= FRAME_MS
      steps++
    }

    /**
     * THE INPUT PASS.
     *
     * A press that has not been consumed yet — because no step ran (hit-stop),
     * because the accumulator is sub-frame (120 Hz), or because it arrived
     * after the last step of this call — is delivered through the input-only
     * path. One press, one move: `pressed` is emptied here, and the held
     * keys stay held so movement and guard keep working.
     *
     * `stepFrozen` does not advance the clock, so this can run every frame
     * without speeding the fight up.
     */
    if (pressed.size > 0) {
      const due = new Set(pressed)
      pressed.clear()
      arena.stepFrozen({ ...heldInput, ...edgeFor(due, heldInput) })
    }

    const view = snapshot()
    lastView = view
    const out = { events, snapshot: view }
    events = []
    lastPhase = arena.phase
    return out
  }

  let arenaInput = toArenaInput({})
  /** What the client said LAST frame, for the rising-edge test. */
  let rawPrev = toArenaInput({})
  /** The held states (movement, guard) as of the last update. */
  let heldInput = toArenaInput({})
  /** Presses latched and not yet consumed by an arena pass. */
  const pressed = new Set()
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
    restart(round, opts = {}) {
      // The panel may have changed the difficulty since this duel was built;
      // `再来一局` is a new round, so it should honour the new setting.
      if (opts.difficulty === 'easy' || opts.difficulty === 'normal') {
        arena.difficulty = opts.difficulty
      }
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
      heldInput = {
        ...arenaInput,
        // The edges are carried by `pendingEdges`; leaving them latched here
        // as well would re-fire a press on a frozen frame.
        jump: false, retreat: false, special: false,
        jab: false, punch2: false, kick: false, upper: false, sweep: false, slide: false,
      }
      return update(dtMs)
    },
    tick(input) {
      const next = toArenaInput(input)
      arena.step(next)
      return { events: [], snapshot: snapshot() }
    },
    /** Exposed so a test or the preview can reach the engine directly. */
    arena,
  }
}

export { WORLD }
