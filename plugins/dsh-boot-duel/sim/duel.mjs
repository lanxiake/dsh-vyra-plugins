/**
 * Duel facade: the one thing the browser half talks to.
 *
 * It owns the two fighters, the AI, the KO sequence, and the clock. The
 * browser samples input, calls `update(dt, input)`, and draws whatever
 * `getSnapshot()` returns — it never reaches into fighter state itself. That
 * split is what lets the whole fight be tested under `node --test`.
 *
 * Phases: `ready` -> `playing` -> `ko` (outro) -> `done`.
 *
 * `ready` is the opening stance: both fighters breathe, the camera settles,
 * and **nothing can hurt anyone**. The player presses Enter (or clicks 开始)
 * to begin. Being punched before you have touched a key is not an opening
 * animation, it is a bug.
 *
 * Moving forward is one-way; `skip()` is the only shortcut, and it works from
 * `ready` and `playing` exactly once.
 */

import {
  ARENA, COUNTER_DAMAGE, FIXED_STEP_MS, HIT_STOP_MS, IMPACT_SLOW_MS, IMPACT_SLOW_SCALE,
  KO_FLASH_MS, KO_FADE_MS, KO_SLOW_MS, KO_TIME_SCALE, KO_TOTAL_MS, MAX_HP, METER, MOVES,
  READY, REDUCED_TIME_SCALE,
} from './constants.mjs'
import { applyDamage, clampHealth, resolveHits, separate } from './combat.mjs'
import { canAct, createFighter, stepFighter, startAction } from './fighter.mjs'
import { createAi } from './ai.mjs'
import { createRagdoll, stepRagdoll, ragdollSnapshot } from './ragdoll.mjs'

/** Knob that keeps the KO readable instead of a multi-second subtraction. */
const KO_KNOCKBACK = { x: 5.2, y: -3.7 }
const MAX_PARTICLES = 300
/** Every impact also throws this many sparks at the point of contact. */
const SPARK_COUNT = { hit: 14, counter: 26, blocked: 8 }

function makeParticles() {
  return { points: [], limit: MAX_PARTICLES }
}

/**
 * Spawn one burst. `mode` shapes it: `spark` is a sharp radial spray for a
 * connecting strike, `dust` a wide slow ring for a heavy landing.
 */
function spawnBurst(particles, point, count, tint, mode = 'spark') {
  for (let i = 0; i < count && particles.points.length < particles.limit; i++) {
    const angle = mode === 'dust'
      ? Math.PI * (1.05 + Math.random() * 0.9)
      : Math.random() * Math.PI * 2
    const speed = mode === 'dust'
      ? 0.6 + Math.random() * 1.5
      : 1.5 + Math.random() * 4
    particles.points.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (mode === 'dust' ? 0.6 : 2.2),
      life: 1,
      decay: mode === 'dust' ? 0.022 : 0.045,
      size: mode === 'dust' ? 2 + Math.random() * 2.5 : 0.8 + Math.random() * 1.3,
      tint,
      mode,
    })
  }
}

function stepParticles(particles, dtFrames) {
  for (const p of particles.points) {
    p.x += p.vx * dtFrames
    p.y += p.vy * dtFrames
    p.vy += (p.mode === 'dust' ? 0.02 : 0.1) * dtFrames
    p.vx *= p.mode === 'dust' ? 0.96 : 0.965
    p.life -= (p.decay ?? 0.04) * dtFrames
  }
  particles.points = particles.points.filter((p) => p.life > 0)
}

function emptyInput() {
  return {
    left: false, right: false, jump: false, jab: false, kick: false,
    hook: false, sweep: false, uppercut: false, retreat: false,
    block: false, special: false,
  }
}

/** Rising edges only: a held key must not restart the same action. */
function edges(previous, current) {
  const out = emptyInput()
  // A retreat is a tap, not a hold: holding it must not chain hops.
  for (const key of ['jump', 'jab', 'kick', 'hook', 'sweep', 'uppercut', 'retreat', 'special']) {
    out[key] = Boolean(current[key]) && !previous[key]
  }
  for (const key of ['left', 'right', 'block']) out[key] = Boolean(current[key])
  return out
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createDuel({ seed = 1, difficulty = 'easy', reducedMotion = false } = {}) {
  const player = createFighter('player', ARENA.width / 2 - 55, 1, MAX_HP)
  const enemy = createFighter('enemy', ARENA.width / 2 + 55, -1, MAX_HP)
  const ai = createAi({ difficulty, seed })
  const particles = makeParticles()

  let phase = 'ready'
  /** Frames spent in the opening stance, for the breathing animation. */
  let readyFrames = 0
  /** Milliseconds spent in the KO outro (real time, not scaled). */
  let koElapsed = 0
  /** Milliseconds of hit-stop left: all simulation is frozen while it lasts. */
  let hitStopMs = 0
  let ragdoll = null
  let shake = 0
  let flash = 0
  let shockwave = 0
  /** Accumulated fixed-step remainder from `update`. */
  let accumulator = 0
  let previousPlayerInput = emptyInput()
  let clock = 0

  /** The strike that most recently connected, kept for a beat so the renderer
   * can draw its slash arc and impact glyph as a decaying overlay.
   */
  let impact = null
  /** Milliseconds of impact slow-motion left. */
  let impactSlowMs = 0
  /** The qi meter. Only the player has one; the opponent is a wall to test it on. */
  let meter = METER.start
  /** The finisher's own overlay: brush blast, calligraphy sweep, freeze frame. */
  let special = null

  const timeScale = () => {
    if (impactSlowMs > 0) return IMPACT_SLOW_SCALE
    if (phase !== 'ko') return 1
    if (koElapsed < KO_SLOW_MS) return reducedMotion ? REDUCED_TIME_SCALE : KO_TIME_SCALE
    return 1
  }

  function emit(events, name) {
    if (events) events.push(name)
  }

  /** Register a connection: hit-stop, slow-motion, sparks, shake, overlay. */
  function registerImpact(events, result, side) {
    const kind = result.ko ? 'ko' : result.counter ? 'counter' : result.blocked ? 'blocked' : 'hit'
    const stop = reducedMotion ? (kind === 'ko' ? 90 : 0) : HIT_STOP_MS[kind]
    hitStopMs = Math.max(hitStopMs, stop)
    if (kind !== 'blocked' && !reducedMotion) {
      impactSlowMs = Math.max(impactSlowMs, IMPACT_SLOW_MS)
      shake = Math.min(22, shake + (kind === 'counter' ? 13 : kind === 'ko' ? 18 : 6))
    }
    spawnBurst(particles, result.point, SPARK_COUNT[kind === 'ko' ? 'counter' : kind] ?? 10,
      side === 'player' ? 'player' : 'enemy', 'spark')
    if (kind === 'hit' || kind === 'counter') {
      spawnBurst(particles, result.point, 8, side === 'player' ? 'player' : 'enemy', 'dust')
    }
    impact = {
      x: result.point.x,
      y: result.point.y,
      kind,
      /** 1 -> 0 over ~260 ms of displayed time. */
      life: 1,
      /** Which direction the strike travelled, so the slash angle reads right. */
      facing: side === 'player' ? player.facing : enemy.facing,
      blocked: Boolean(result.blocked),
      counter: Boolean(result.counter),
      /** 'head' | 'body' | 'legs' — the renderer picks a matching reaction. */
      zone: result.zone ?? 'body',
      damage: result.damage,
      /** The finisher gets its own, much louder overlay. */
      special: result.move === 'special',
    }
    emit(events, kind === 'blocked' ? 'clink' : kind === 'counter' ? 'counter' : 'thud')
    return kind
  }

  /**
   * The finisher. It does not go through `resolveHits`: it is a whole-screen
   * art, not a hitbox. It costs the full meter and is refused unless the
   * meter is full and the player is actually in range.
   */
  function trySpecial(events) {
    if (meter < METER.max || phase !== 'playing') return false
    if (!canAct(player)) return false
    if (player.x !== undefined) {
      const gap = Math.abs(enemy.x - player.x)
      if (gap > MOVES.special.range) {
        emit(events, 'whiff')
        return false
      }
    }
    if (!startAction(player, 'special')) return false
    meter = 0
    player.specialReady = false
    special = {
      /** 1 -> 0 over the whole art. */
      life: 1,
      /** Where the brush blast landed. */
      x: enemy.x,
      facing: player.facing,
      /** Which beat of the sequence we are on. */
      beat: 'windup',
    }
    emit(events, 'special')
    return true
  }

  /** Resolve the finisher when its active window opens. */
  function resolveSpecial(events) {
    if (!special || player.action !== 'special') return
    const move = MOVES.special
    if (player.actionFrame < move.windup || player.hitConsumed) return
    // Whether the enemy is inside the sweeping art is a wide, forgiving test:
    // the point of the finisher is that it lands once the windup was survived.
    const gap = Math.abs(enemy.x - player.x)
    if (gap > move.range) {
      special.beat = 'miss'
      return
    }
    player.hitConsumed = true
    const blocked = Boolean(enemy.blocking)
    const damage = blocked ? Math.round(move.damage * 0.35) : move.damage
    const ko = applyDamage(enemy, damage, {})
    const point = { x: enemy.x, y: ARENA.ground - 52 }
    special = { ...special, x: point.x, beat: 'landed', damage, life: 1 }
    impact = {
      x: point.x,
      y: point.y,
      kind: ko ? 'ko' : 'hit',
      life: 1,
      facing: player.facing,
      blocked,
      counter: false,
      damage,
      special: true,
    }
    // The finisher is the biggest thing that happens in a round: longest
    // stop, hardest shake, a real freeze.
    hitStopMs = reducedMotion ? 120 : 340
    impactSlowMs = reducedMotion ? 0 : 260
    shake = reducedMotion ? 0 : 30
    flash = reducedMotion ? 0 : 0.9
    shockwave = 1
    spawnBurst(particles, point, 60, 'player', 'spark')
    spawnBurst(particles, { x: point.x, y: ARENA.ground }, 26, 'player', 'dust')
    emit(events, 'boom')
    if (ko) enterKo(events)
  }

  /** Enter the KO outro from either a real hit or a skip. */
  function enterKo(events, options = {}) {
    if (phase === 'ko' || phase === 'done') return
    const fromReady = phase === 'ready'
    phase = 'ko'
    koElapsed = 0
    hitStopMs = 0
    impactSlowMs = 0
    shake = reducedMotion ? 0 : (fromReady ? 6 : 22)
    flash = reducedMotion ? 0 : (fromReady ? 0 : 1)
    shockwave = fromReady ? 0 : 1
    ragdoll = fromReady
      ? null
      : createRagdoll({
        x: enemy.x,
        y: ARENA.ground,
        facing: 1,
        impulse: options.skip ? { x: 5, y: -3 } : KO_KNOCKBACK,
      })
    if (!fromReady) {
      spawnBurst(particles, { x: enemy.x, y: ARENA.ground - 50 }, 30, 'enemy', 'spark')
      spawnBurst(particles, { x: enemy.x, y: ARENA.ground }, 14, 'enemy', 'dust')
    }
    emit(events, 'ko')
    if (enemy.hp <= 0) emit(events, 'crash')
  }

  /**
   * The attack a set of edges asks for, in priority order.
   *
   * Uppercut first: it is the hardest move to reach and the one a player who
   * presses it is most certain about. `kickUp` is listed after `kick` so the
   * same key extends a juggle when the target is already airborne but throws a
   * normal kick when it is not.
   */
  function attackNames(inputNow, who) {
    const names = []
    const airborne = who && who.onGround === false && !who.juggled
    if (inputNow.uppercut) names.push('uppercut')
    if (inputNow.sweep) names.push('sweep')
    if (inputNow.hook) names.push('hook')
    if (inputNow.kick) {
      // In the air the kick button throws the AIR kick; on the ground it is a
      // normal kick, and after a launcher it extends the juggle.
      if (airborne) names.push('airKick')
      else names.push('kick', 'kickUp')
    }
    if (inputNow.jab) names.push('jab')
    return names
  }

  /** One fixed simulation step while the fight is live. */
  function stepFight(input, events) {
    const playerInput = edges(previousPlayerInput, input)
    previousPlayerInput = { ...input }

    if (phase === 'playing') {
      // The meter is the only thing that unlocks the finisher.
      player.specialReady = meter >= METER.max

      // ATTACK INPUT. Every entry is a rising edge, so holding a key is one
      // move; the state machine decides legality, including whether this is a
      // fresh move or a CANCEL out of the one already in flight.
      if (playerInput.jump) startAction(player, 'jump')
      // A retreat is a LEAP, not a hedge: it covers ground fast, which is what
      // makes disengaging a real option instead of a slow slide. Jumping while
      // holding a direction is the same leap in that direction.
      if (playerInput.retreat) startAction(player, 'backHop')
      if (playerInput.special) trySpecial(events)

      // The tree of attacks. An airborne attacker gets the air kick whatever
      // button they pressed; a launcher chains into the juggle follow-up
      // because `COMBO_CHAIN` allows it.
      for (const name of attackNames(playerInput, player)) {
        if (startAction(player, name)) {
          emit(events, 'whoosh')
          break
        }
      }

      player.blocking = Boolean(input.block)
      stepFighter(player, playerInput, ARENA)

      const enemyInput = ai.decide({ self: enemy, foe: player }, FIXED_STEP_MS)
      // The AI returns intentions; the state machine decides whether they are
      // legal. Skipping these calls would silently drop every enemy swing.
      if (enemyInput.jump) startAction(enemy, 'jump')
      if (enemyInput.retreat) startAction(enemy, 'backStep')
      for (const name of attackNames(enemyInput, enemy)) {
        if (startAction(enemy, name)) break
      }
      // A downed or juggled fighter keeps the facing the blow gave them.
      if (!enemy.juggled && !enemy.prone && enemy.knockdown === 0) {
        enemy.facing = player.x >= enemy.x ? 1 : -1
      }
      stepFighter(enemy, enemyInput, ARENA)
      separate(player, enemy)

      resolveSpecial(events)

      const playerHits = resolveHits(player, enemy, {})
      if (playerHits) {
        enemy.hitZone = playerHits.zone
        const kind = registerImpact(events, playerHits, 'player')
        meter = Math.min(METER.max, meter + (!playerHits.blocked ? METER.gainHit : METER.gainBlocked))
        if (kind === 'counter') meter = Math.min(METER.max, meter + METER.gainHit * 0.5)
      }

      const enemyHits = resolveHits(enemy, player, { player: true })
      if (enemyHits) {
        player.hitZone = enemyHits.zone
        registerImpact(events, enemyHits, 'enemy')
        meter = Math.min(METER.max, meter + METER.gainTaken)
      }

      clampHealth(player, enemy)
      if (playerHits && playerHits.ko) enterKo(events)
    }

    stepParticles(particles, 1)
    shake *= 0.86
    if (shake < 0.2) shake = 0
    flash = Math.max(0, flash - FIXED_STEP_MS / KO_FLASH_MS)
    shockwave = Math.max(0, shockwave - FIXED_STEP_MS / 520)
    decayOverlays(FIXED_STEP_MS)
    impactSlowMs = Math.max(0, impactSlowMs - FIXED_STEP_MS)
  }

  /** Age the impact glyph and the finisher overlay by real milliseconds. */
  function decayOverlays(ms) {
    if (impact) {
      impact.life -= ms / (impact.special ? 700 : 260)
      if (impact.life <= 0) impact = null
    }
    if (special) {
      special.life -= ms / 2200
      // The windup beat ends when the strike lands (or whiffs).
      if (special.life <= 0) special = null
    }
  }

  /** The opening stance: nothing moves, nothing hurts, nobody swings. */
  function stepReady() {
    readyFrames += 1
    // A slow breath so the figures are not statues; the renderer reads the
    // clock, but the sim keeps its own frame counter for a stable snapshot.
    stepParticles(particles, 1)
    shake *= 0.86
    if (shake < 0.2) shake = 0
    decayOverlays(FIXED_STEP_MS)
  }

  /** Advance the KO outro by real milliseconds. */
  function stepKo(dtMs) {
    koElapsed += dtMs
    const scaledFrames = (Math.min(dtMs, 50) * timeScale()) / FIXED_STEP_MS
    if (ragdoll) stepRagdoll(ragdoll, { ground: ARENA.ground, iterations: 6 })
    stepParticles(particles, scaledFrames)
    shake *= 0.9
    if (shake < 0.2) shake = 0
    flash = Math.max(0, flash - dtMs / KO_FLASH_MS)
    shockwave = Math.max(0, shockwave - dtMs / 700)
    decayOverlays(dtMs)
    if (koElapsed >= KO_TOTAL_MS) phase = 'done'
  }

  function snapshot() {
    const fadeProgress = phase === 'done'
      ? Math.min(1, Math.max(0, (koElapsed - KO_TOTAL_MS) / KO_FADE_MS))
      : 0
    const fighterView = (fighter, breathing) => ({
      x: fighter.x,
      y: fighter.y,
      facing: fighter.facing,
      hp: fighter.hp,
      action: fighter.action,
      actionFrame: fighter.actionFrame,
      blocking: fighter.blocking,
      stagger: fighter.stagger,
      hitZone: fighter.hitZone ?? null,
      onGround: fighter.onGround,
      /**
       * Body state. The renderer picks a pose from these, and the HUD uses
       * them to label a combo — a launched or downed opponent is what makes a
       * chain visible to the player.
       */
      juggled: fighter.juggled,
      prone: fighter.prone,
      knockdown: fighter.knockdown,
      backStep: fighter.backStep,
      comboCount: fighter.comboCount,
      lastLanded: fighter.lastLanded,
      breathing,
    })
    // During `ready` the figures breathe on their own slow offsets, so the
    // two silhouettes never pulse in lockstep.
    const breath = Math.sin(clock / 900)
    return {
      phase,
      clock,
      readyFrames,
      readyDone: phase !== 'ready',
      player: fighterView(player, phase === 'ready' ? breath * 0.5 + 0.5 : 0),
      enemy: fighterView(enemy, phase === 'ready' ? Math.sin(clock / 900 + 1.7) * 0.5 + 0.5 : 0),
      ragdoll: ragdoll ? ragdollSnapshot(ragdoll) : null,
      timeScale: timeScale(),
      koElapsedMs: koElapsed,
      fadeOpacity: 1 - fadeProgress,
      /** Non-null for a beat after a connection: slash arc + impact glyph. */
      impact: impact ? { ...impact } : null,
      hitStopMs,
      /** The qi meter and whether the finisher can be thrown right now. */
      meter,
      meterMax: METER.max,
      specialReady: meter >= METER.max,
      /** The finisher's own overlay, or null. */
      special: special ? { ...special } : null,
      fx: {
        shake,
        flash,
        shockwave,
        /** 0..1 camera push-in, used by the KO for a finishing zoom. */
        zoom: phase === 'ko'
          ? Math.min(1, koElapsed / KO_SLOW_MS) * (reducedMotion ? 0.35 : 1)
          : 0,
        particles: particles.points.map((p) => ({
          x: p.x, y: p.y, life: p.life, tint: p.tint, mode: p.mode, size: p.size,
        })),
      },
    }
  }

  const duel = {
    get phase() { return phase },

    getState() { return phase },

    getSnapshot() { return deepCopy(snapshot()) },

    /** Leave the opening stance and let the fight begin. */
    begin() {
      if (phase !== 'ready') return false
      phase = 'playing'
      accumulator = 0
      previousPlayerInput = emptyInput()
      return true
    },

    /**
     * Advance by real elapsed time using a fixed-step accumulator. The same
     * total elapsed time yields the same number of fight frames at any frame
     * rate; catch-up is capped so a long stall cannot fast-forward the fight.
     *
     * Hit-stop is consumed in real time before any simulation runs, so a
     * landed strike freezes the picture without desynchronising the clock.
     */
    update(dtMs, input = emptyInput()) {
      const events = []
      const step = Math.max(0, Math.min(Number.isFinite(dtMs) ? dtMs : 0, 250))
      clock += step

      if (hitStopMs > 0) {
        const used = Math.min(hitStopMs, step)
        hitStopMs -= used
        // The impact overlay and the shake must keep decaying, or the freeze
        // looks like a dropped frame rather than a deliberate pause.
        if (impact) {
          impact.life -= used / (impact.special ? 1400 : 260)
          if (impact.life <= 0) impact = null
        }
        if (special) {
          special.life -= used / 2200
          if (special.life <= 0) special = null
        }
        shake *= 0.985
        stepParticles(particles, (used / FIXED_STEP_MS) * 0.15)
        if (phase === 'ko') koElapsed += used
        return { events, snapshot: deepCopy(snapshot()) }
      }

      if (phase === 'ko' || phase === 'done') {
        stepKo(step)
        return { events, snapshot: deepCopy(snapshot()) }
      }

      if (phase === 'ready') {
        accumulator += step
        let steps = 0
        while (accumulator >= FIXED_STEP_MS && steps < 5) {
          stepReady()
          accumulator -= FIXED_STEP_MS
          steps++
        }
        return { events, snapshot: deepCopy(snapshot()) }
      }

      accumulator += step
      let steps = 0
      while (accumulator >= FIXED_STEP_MS && steps < 5) {
        stepFight(input, events)
        accumulator -= FIXED_STEP_MS
        steps++
        if (phase !== 'playing' || hitStopMs > 0) { accumulator = 0; break }
      }
      // Discard the remainder when the fight is over so a later skip does not
      // carry stale time into the outro.
      if (phase !== 'playing') accumulator = 0
      return { events, snapshot: deepCopy(snapshot()) }
    },

    /** Advance exactly one fight frame. */
    tick(input = emptyInput()) {
      const events = []
      if (phase === 'ready') stepReady()
      else if (phase === 'playing') stepFight(input, events)
      else stepKo(FIXED_STEP_MS)
      return { events, snapshot: deepCopy(snapshot()) }
    },

    /**
     * Skip the fight. Works from the opening stance and from play; once the
     * outro has started this returns false, so a second Esc cannot restart it.
     */
    skip() {
      if (phase !== 'ready' && phase !== 'playing') return false
      enterKo(null, { skip: true })
      return true
    },

    /**
     * Drive the fight to a KO for the outro and for tests: `1` flings the
     * opponent, `-1` flings it the other way.
     */
    forceKo(direction = 1) {
      if (phase === 'ready') phase = 'playing'
      enemy.hp = 0
      enterKo(null, { skip: direction < 0 })
    },

    /** Which counter window is open, if any — used by the HUD for flavour. */
    counterReady() {
      return phase === 'playing' && enemy.stagger > 0 ? COUNTER_DAMAGE : 0
    },
  }

  return duel
}
