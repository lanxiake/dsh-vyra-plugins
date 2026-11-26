/**
 * The arena: one fixed-timestep world holding two fighters, the juice, and the
 * particles.
 *
 * This is the only thing the browser half talks to. It owns the clock, the
 * input mapping, and the match state, and it exposes a snapshot the renderer
 * can draw from without reaching into any fighter's internals.
 *
 * Phases: `ready` -> `playing` -> `ko` -> `done`.
 */

import { Fighter, ATK, DT } from './fighter.js'
import { Juice, clamp, rand, lerp, ease } from './juice.js'
import { resolveAttacks } from './combat.js'
import { storyFor, createBarks } from './story.js'

/** The last story played, so a random draw never repeats it back to back. */
let lastStoryId = null
import { HEAD, NECK, PELV, HAND_B, HAND_F, FOOT_B, FOOT_F, KNEE_F, KNEE_B, ELB_F, ELB_B, N, G } from './rig.js'

/** World geometry. Design units: the stage is 960 wide and 400 tall. */
export const WORLD = Object.freeze({
  width: 960,
  height: 400,
  /** The floor the fighters stand on. */
  groundY: 300,
  /** How far in from the edges a fighter can walk. */
  minX: 60,
  maxX: 900,
})

/**
 * Player input to attack. The mapping is deliberately small: two punches, a
 * kick, a launcher and a slide, which is the vocabulary a hand-keyboard
 * fight needs before it needs more.
 */
const ATTACK_KEYS = {
  jab: 'p1',
  punch2: 'p2',
  kick: 'k',
  upper: 'p3',
  sweep: 'sweep',
  slide: 'slide',
  /** In the air, the same two buttons become the air attacks. */
  airPunch: 'airPunch',
  airStomp: 'airStomp',
}

export class Arena {
  /**
   * @param {object} opts
   * @param {boolean} [opts.reducedMotion]
   * @param {number} [opts.round] which story to tell this round (0..2 cycling)
   */
  constructor({ reducedMotion = false, round = 0 } = {}) {
    this.juice = new Juice({ reducedMotion })
    this.phase = 'ready'
    this.t = 0
    this.koT = 0
    this.particles = []
    this.popups = []
    this.hitFlash = null
    /** The most recent connection, for the renderer's impact overlay. */
    this.lastHit = null
    /** Which story this round tells. Set before the first reset. */
    this.round = round
    this.reset()
  }

  /**
   * Start over from the bell.
   *
   * \`reset()\` only rebuilds the two fighters; it does not move the phase, so a
   * restart called after a knockout stayed stranded in the outro. This is the
   * entry point the settings panel uses.
   */
  restart(round = this.round) {
    this.round = round
    this.phase = 'ready'
    this.reset()
    return this
  }

  reset() {
    this.player = new Fighter('player', WORLD.width / 2 - 110, WORLD.groundY)
    this.enemy = new Fighter('enemy', WORLD.width / 2 + 110, WORLD.groundY)
    this.enemy.ai.cd = 1.2
    this.phase = 'ready'
    this.t = 0
    this.koT = 0
    this.particles.length = 0
    this.popups.length = 0
    this.lastHit = null
    this.juice.reset()
    /** Consecutive hits the player has landed without being interrupted. */
    this.combo = 0
    /** Frames since the last hit that counted toward the combo. */
    this.comboT = 0
    /** A short pulse used to pop the combo counter. */
    this.comboPop = 0
    /** The super banner's 1 -> 0 life, or 0 when it is not showing. */
    this.superBanner = 0
    /**
     * The story this round is telling, and the barks that deliver it.
     *
     * The lines are BARKS, not a script: each one fires on a game event, so
     * the narrative lands on the beat that caused it — a combo line only when
     * the player lands a combo, a taunt only when the opponent earns it.
     */
    // `round` may be a number (fixed, for tests) or null (random, for play).
    // Either way, a repeat of the previous story is refused when random.
    this.story = Number.isFinite(this.round)
      ? storyFor(this.round)
      : storyFor(null, { avoid: lastStoryId })
    lastStoryId = this.story.id
    this.barks = createBarks(this.story)
    /** The line currently on screen: { speaker, text, mood, life, side }. */
    this.line = null
    /** Seconds before another bark may fire, so lines do not stack. */
    this.lineGap = 0
    /** The player's chain depth, for deciding when a combo line is due. */
    this.playerChain = 0
    /** Opening lines still to come, once the bubble is clear. */
    this.openQueue = 0
    /** Seconds left on a buffered super press. */
    this.superBuffer = 0
  }

  begin() {
    if (this.phase !== 'ready') return false
    this.phase = 'playing'
    // The story opens with a short exchange rather than a greeting: the player
    // reads two or three lines before the fight, which is what makes the
    // first hit land on top of an argument instead of on silence.
    this.openQueue = 2 + Math.floor(Math.random() * 2)
    this.say('open', true)
    return true
  }

  get fighters() { return [this.player, this.enemy] }

  /**
   * Advance one fixed step at 60 Hz.
   *
   * The ORDER here is the fight's shape: read the player, let the AI decide,
   * move everyone, resolve the hits in flight, then apply the reactions to the
   * world. Doing it in that order means a hit lands on the position the
   * opponent actually has this frame, not the one they had before moving.
   */
  step(input) {
    this.t += DT
    const w = { groundY: WORLD.groundY, minX: WORLD.minX, maxX: WORLD.maxX }

    if (this.phase === 'ready') {
      // Idle breathing only: nobody can be hurt before the player starts.
      for (const f of this.fighters) { f.time += DT; f.pose(); f.rig.setPose(f.tx, f.ty) }
      return
    }

    if (this.phase === 'ko') {
      this.koT += DT
      for (const f of this.fighters) f.step(w)
      this.stepParticles()
      if (this.koT > 2.4) this.phase = 'done'
      return
    }

    if (this.phase === 'done') return

    // --- the player -----------------------------------------------------
    // The super flag is derived from the meter, every frame, so the meter is
    // the single source of truth.
    this.player.superReady = this.player.superMeter >= 100
    const p = this.player
    if (p.alive) this.applyPlayerInput(p, input)
    else { p.block = false; p.crouching = false }
    // Face the opponent whenever not committed to an attack.
    if (p.state === 'idle' || p.state === 'air') {
      if (Math.abs(p.vx) < 20) p.face = this.enemy.x >= p.x ? 1 : -1
    }

    // Remember this frame's buttons for the edge test next frame.
    this.prevInput = { ...input }

    // --- the enemy ------------------------------------------------------
    const e = this.enemy
    if (e.alive && !e.ragdolled && e.state !== 'getup') {
      const decision = e.aiStep(p)

      if (decision.move === 'retreat' && e.canAct) {
        // A back-hop: real air, real distance, and a landing recovery.
        e.vy = -540
        e.onGround = false
        e.vx = -e.face * 300
        e.state = 'air'
        e.t = 0
      } else if (decision.move && decision.move !== 'retreat' && e.canAct) {
        e.startAttack(decision.move)
      } else {
        // Steering applies while the AI is free AND while it is merely
        // holding a distance mid-hop — that is what lets it come back in.
        let vx = 0
        if (decision.left) vx -= e.k.speed * 0.55
        if (decision.right) vx += e.k.speed * 0.55
        if (vx !== 0) e.vx = vx
        else if (Math.abs(e.vx) < 30) e.vx *= 0.7
        if (e.canAct) e.block = Boolean(decision.block)
      }
      if (e.canAct || e.state === 'air') {
        if (Math.abs(e.vx) < 20) e.face = p.x >= e.x ? 1 : -1
      }
    }

    // --- move -----------------------------------------------------------
    for (const f of this.fighters) f.step(w)

    // --- resolve --------------------------------------------------------
    resolveAttacks(this.fighters, w, (hit) => this.onHit(hit))

    // --- world ----------------------------------------------------------
    this.keepApart()
    this.stepParticles()
    this.checkKo()

    this.stepBarks(DT)

    // Combo bookkeeping: a hit keeps the string alive for a beat.
    this.comboT += DT
    if (this.comboT > 1.1) { this.combo = 0; this.comboT = 0 }
    this.comboPop = Math.max(0, this.comboPop - DT * 5)
    if (this.superBanner > 0) this.superBanner = Math.max(0, this.superBanner - DT * 0.62)
  }

  /**
   * Turn the player's held keys into actions.
   *
   * Order matters:
   *
   *   1. **Jump** — a real leap with air control, available from neutral.
   *   2. **Retreat** — a back-hop: the escape that actually clears ground,
   *      which a plain walk-back cannot.
   *   3. **Attack** — including the CHAIN: a punch pressed while the previous
   *      punch is still playing continues the string instead of being dropped.
   *   4. **Walk** and **guard**.
   *
   * Attack is checked before movement so a pressed button always reads as a
   * swing rather than as a step, and the chain check is BEFORE the `canAct`
   * gate — that is what makes "jab, jab, kick" possible at all.
   */
  applyPlayerInput(p, input) {
    // --- 0. guard and crouch: held states, not edges -------------------
    // They are read FIRST and they do not consume the frame, so a player can
    // hold guard and still walk out of it.
    p.block = Boolean(input.block) && p.onGround && p.state !== 'atk'
    p.crouching = Boolean(input.crouch) && p.onGround && p.state !== 'atk'

    // --- 1. jump -------------------------------------------------------
    if (input.jump && !this.prevInput?.jump && p.onGround && p.state === 'idle' && !p.crouching) {
      p.vy = -760
      p.onGround = false
      p.state = 'air'
      p.t = 0
      if (input.left || input.right) p.vx = (input.right ? 1 : -1) * p.k.speed * 0.9
      return
    }

    // --- 2. retreat: a back-hop, not a walk ----------------------------
    if (input.retreat && !this.prevInput?.retreat && p.onGround && p.state === 'idle') {
      p.vy = -540
      p.onGround = false
      p.state = 'air'
      p.t = 0
      p.vx = -p.face * 380
      return
    }

    // --- 3. the super, with an input buffer ----------------------------
    // Pressing the button is remembered for a beat. Without this, a press
    // during recovery is silently lost and the player concludes the key is
    // broken — the classic "my special never comes out" complaint.
    if (input.special && !this.prevInput?.special) this.superBuffer = 0.22
    if (this.superBuffer > 0) this.superBuffer = Math.max(0, this.superBuffer - DT)
    if (this.superBuffer > 0 && p.superReady && p.canAct) {
      this.superBuffer = 0
      p.superReady = false
      p.superMeter = 0
      p.startAttack('superMove')
      this.superBanner = 1
      this.say('super', true)
      this.juice.hitstop(180)
      this.juice.slowmo(0.2, 420)
      this.juice.zoomPunch(0.2, 420, 480, 200)
      return
    }

    // --- 4. attack -----------------------------------------------------
    // EDGE-TRIGGERED. `this.prevInput` holds last frame's buttons; a move
    // fires on the transition from up to down, never on a held key. Without
    // this a held punch re-fired inside its own chain window forever.
    const pressed = (k) => Boolean(input[k]) && !Boolean(this.prevInput?.[k])
    const chainOpen = p.chainT > 0
    for (const [key, move] of Object.entries(ATTACK_KEYS)) {
      if (!pressed(key)) continue
      const punch = move === 'p1' || move === 'p2'
      if (!p.onGround) {
        // In the air only the air vocabulary exists.
        if (move === 'jab' || move === 'kick') p.startAttack(move === 'kick' ? 'airStomp' : 'airPunch')
        return
      }
      if (!p.canAct && !(punch && chainOpen)) continue
      // A launcher chained from a punch is the classic juggle starter; the
      // kick follows it up.
      if (move === 'p3' && chainOpen) { p.startAttack('launchKick'); return }
      p.startAttack(move)
      return
    }

    // --- 5. walk -------------------------------------------------------
    if (p.onGround) {
      const speed = p.crouching ? 0 : p.k.speed * (p.block ? 0.35 : 1)
      let vx = 0
      if (input.left) vx -= speed
      if (input.right) vx += speed
      if (vx !== 0) { p.vx = vx; p.face = Math.sign(vx) }
      else if (Math.abs(p.vx) < 20) p.vx *= 0.7
    }
  }

  /**
   * Stop the two bodies occupying the same spot. The gap is the sum of their
   * widths, not a "standoff" — two fighters who are touching should touch.
   */
  keepApart() {
    const a = this.player
    const b = this.enemy
    if (a.ragdolled || b.ragdolled) return
    // Two bodies never overlap. The gap has to stay INSIDE the shortest
    // attack's reach (46 units) or nothing can ever connect — 54 was above it
    // and produced rounds where the AI never landed a single blow.
    const minGap = 30
    const gap = Math.abs(b.x - a.x)
    if (gap < minGap) {
      const push = (minGap - gap) / 2
      const dir = b.x >= a.x ? 1 : -1
      a.x -= dir * push
      b.x += dir * push
    }
  }

  checkKo() {
    if (this.phase !== 'playing') return
    if (this.enemy.hp > 0) return
    this.phase = 'ko'
    this.koT = 0
    this.say('ko', true)
    this.juice.hitstop(240)
    this.juice.slowmo(0.28, 900)
    this.juice.shake(24)
    this.juice.flash(0.8)
    this.juice.zoomPunch(0.16, 500, WORLD.width / 2, WORLD.groundY - 150)
  }

  /* ----------------------------------------------------------- barks --- */

  /**
   * Say the next line for \`beat\`, if the story has one and nothing newer is on
   * screen. \`side\` decides which head the bubble sits over.
   *
   * Rate-limited to one line every couple of seconds: two people talking over
   * each other is noise, not dialogue.
   */
  say(beat, force = false) {
    // A fight bark never interrupts the opening exchange.
    if (beat !== 'open' && this.openQueue > 0) return
    if (!force && this.lineGap > 0) return
    const line = this.barks.next(beat)
    if (!line) return
    this.line = {
      ...line,
      /** 1 -> 0 over ~2.6 s. */
      life: 1,
      side: line.speaker === 'you' ? 'player' : 'enemy',
    }
    this.lineGap = force ? 0.4 : 2.2
  }

  /** Advance the bubble and its cooldown. */
  stepBarks(dt) {
    this.lineGap = Math.max(0, this.lineGap - dt)
    if (this.line) {
      this.line.life -= dt * 0.42
      if (this.line.life <= 0) this.line = null
    }
    // The opening exchange, drained in the first few seconds of the round.
    //
    // It OVERWRITES whatever is on screen rather than waiting for the bubble
    // to clear: a fight bark that fires during the opening would otherwise
    // replace the next scripted line, and "……现在？" would be answered by
    // "年底绩效我给你考虑". The story comes first; the fight's own barks wait
    // their turn.
    if (this.openQueue > 0 && this.t < 4.5) {
      if (this.lineGap <= 0.35) {
        this.openQueue -= 1
        this.say('open', true)
      }
    } else if (this.openQueue > 0) {
      this.openQueue = 0
    }
  }

  /* ------------------------------------------------------- reactions --- */

  onHit(hit) {
    const { victim, x, y, power, reaction, kill, juggle, name } = hit
    // Being knocked down is a beat of the player's story.
    if (hit.attacker.team !== 'p' && (reaction === 'launch' || reaction === 'knockdown')) {
      this.say('take')
    }

    // Earning the super: the player charges on anything they land, and a
    // little on anything they take, so a losing fighter is not locked out of
    // their own comeback.
    if (hit.attacker.team === 'p') {
      this.combo = this.comboT > 1.1 ? 1 : this.combo + 1
      this.playerChain = this.combo
      // The player's barks follow what they just did.
      if (this.combo === 3) this.say('chain')
      else if (reaction === 'launch' || reaction === 'knockdown') this.say('hit')
      else if (Math.random() < 0.35) this.say('hit')
      this.comboT = 0
      this.comboPop = 1
      this.player.superMeter = Math.min(100, this.player.superMeter + (hit.guarded ? 6 : 22))
    } else {
      this.player.superMeter = Math.min(100, this.player.superMeter + 9)
      // The opponent's barks: the rival taunts when it lands something big.
      if (reaction === 'launch' || reaction === 'knockdown' || power > 0.75) this.say('taunt')
      // Getting hit ends the player's string.
      this.combo = 0
      this.comboT = 0
    }
    this.player.superReady = this.player.superMeter >= 100
    const heavy = power > 0.7

    this.juice.hitstop(kill ? 200 : heavy ? 90 : 55)
    this.juice.shake(kill ? 22 : heavy ? 14 : 7)
    if (reaction === 'launch' || kill) this.juice.flash(0.32)
    this.juice.zoomPunch(kill ? 0.14 : heavy ? 0.06 : 0.028, kill ? 400 : 220, x, y)
    if (heavy || kill) this.juice.slowmo(0.45, 110)

    this.sparks(x, y, kill ? 34 : heavy ? 22 : 12, power)
    this.ring(x, y, kill ? 1.6 : heavy ? 1.1 : 0.7)

    // Direction and angle of the blow, for the ink stroke.
    const dir = hit.attacker.face || 1
    const angle = reaction === 'launch' ? -0.9 : reaction === 'knock' ? 0.5 : -0.45
    this.lastHit = {
      x, y,
      dir,
      angle,
      life: 1,
      power,
      kill,
      juggle,
      name,
      fromPlayer: hit.attacker.team === 'p',
    }
  }

  sparks(x, y, count, power) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = rand(180, 620) * (0.5 + power)
      this.particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        life: 1,
        decay: rand(1.6, 3.4),
        size: rand(1.2, 3.2),
      })
    }
  }

  ring(x, y, scale) {
    this.particles.push({ kind: 'ring', x, y, life: 1, decay: 3.2, size: 8, scale })
  }

  stepParticles() {
    for (const p of this.particles) {
      p.life -= p.decay * DT * 2
      if (p.kind === 'spark') {
        p.x += p.vx * DT
        p.y += p.vy * DT
        p.vy += G * 0.35 * DT
        p.vx *= 0.98
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    if (this.lastHit) {
      // Age in REAL time, not simulation time: during a hit-stop the sim is
      // frozen but the overlay must keep moving, or the freeze looks like a
      // dropped frame.
      this.lastHit.life -= DT * 1.4
      if (this.lastHit.life <= 0) this.lastHit = null
    }
  }

  /* -------------------------------------------------------- snapshot --- */

  /**
   * How much the camera should push in right now, 0..1.
   *
   * The default shot is a fixed wide view: the reference's fights happen at a
   * distance and the eye reads them as space. The camera only moves for the
   * three things worth moving for —
   *
   *   - a KO, which is the end of the round;
   *   - the third link of a chain or deeper, which is a real combo;
   *   - a launch, which is the moment a body leaves the floor.
   */
  cinematic() {
    if (this.phase === 'ko') return 1
    const p = this.player
    const chain = p.chainCount > 1
    const launching = this.enemy.ragdolled || this.player.ragdolled
    if (chain && launching) return 0.8
    if (chain) return 0.55
    if (launching) return 0.45
    return 0
  }

  snapshot() {
    const view = (f) => ({
      x: f.x,
      y: f.y,
      face: f.face,
      hp: f.hp,
      maxHp: f.maxHp,
      scale: f.s,
      state: f.state,
      facing: f.face,
      time: f.time,
      flash: f.flash,
      tele: f.tele,
      points: Array.from({ length: N }, (_, i) => [f.rig.x[i], f.rig.y[i]]),
      lw: f.k.lw,
    })
    return {
      phase: this.phase,
      t: this.t,
      player: view(this.player),
      enemy: view(this.enemy),
      particles: this.particles.map((p) => ({ ...p })),
      hit: this.lastHit ? { ...this.lastHit } : null,
      cinematic: this.cinematic(),
      /** The qi meter and whether the super can be thrown right now. */
      superMeter: this.player.superMeter,
      /** The line currently on screen, or null. */
      line: this.line ? { ...this.line } : null,
      /** Who the round's story is about, for the bubble's name tag. */
      cast: { you: this.story?.you ?? '你', rival: this.story?.rival ?? '对手' },
      superReady: this.player.superReady,
      combo: this.combo,
      comboPop: this.comboPop,
      /** 1 -> 0 while the super's freeze-frame banner is on screen. */
      superBanner: this.superBanner,
      block: this.player.block,
      crouching: this.player.crouching,
      juice: {
        ox: this.juice.ox, oy: this.juice.oy,
        angle: this.juice.angle,
        zoom: this.juice.zoom,
        fx: this.juice.fx, fy: this.juice.fy,
        flashA: this.juice.flashA,
        flashColor: this.juice.flashColor,
      },
    }
  }
}

export { ATK, DT, ease, lerp, clamp }
