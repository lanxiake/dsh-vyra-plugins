/**
 * A fighter is a Verlet rig with a state machine on top.
 *
 *   upright states (idle / atk / hurt / air): the points are placed by a
 *   procedural pose every frame;
 *   rag / dead: the Verlet integrator owns the points — real weight, real flop;
 *   getup: the points are pulled back toward the idle pose.
 *
 * THE POSE MODEL, which is the whole trick. Rather than authoring a keyframe
 * per joint, a pose is **eleven normalised offsets** — how far the body leans,
 * where each foot is, where each hand is — and two-bone IK turns those into
 * joints. A move is then a single scalar `e` in [-1, 1] swept by an easing
 * curve, and every joint follows from it. That is why a punch reads as a whole
 * body: the lean, the hip travel, the planted foot and the counterweight arm
 * are all consequences of one number, so they can never disagree.
 *
 * (Method after Waleee7/ragdoll-riot, read for approach; see
 * THIRD_PARTY_NOTICES.md. This file is an independent implementation.)
 */

import {
  Rig, DT, B, N, HEAD, NECK, PELV, ELB_B, HAND_B, ELB_F, HAND_F,
  KNEE_B, FOOT_B, KNEE_F, FOOT_F,
} from './rig.js'

export { DT }
import { ease, lerp, clamp, rand } from './juice.js'

/**
 * ATTACK SPECS.
 *
 * `a`..`b` is the active (damaging) window as a FRACTION of `dur`, not a frame
 * count: a move is authored as a shape, so retiming one is a single number.
 *
 * `part` is the joint that carries the hit — the fist or the foot. The hit test
 * is a capsule around that point, which is why a punch lands where the fist is
 * drawn rather than inside an invisible box.
 *
 * `vx`/`vy` are launch velocities in units/second, later divided by the
 * victim's mass; `power` scales the hit reaction; `kb` is the shove for moves
 * that stagger instead of launching; `lunge` is the forward travel.
 */
export const ATK = Object.freeze({
  p1: { dur: 0.25, a: 0.30, b: 0.58, part: HAND_F, r: 17, dmg: 6, vx: 300, vy: -70, power: 0.30, launch: false, kb: 150, lunge: 90 },
  p2: { dur: 0.29, a: 0.32, b: 0.60, part: HAND_B, r: 18, dmg: 9, vx: 380, vy: -90, power: 0.42, launch: false, kb: 200, lunge: 110 },
  p3: { dur: 0.46, a: 0.38, b: 0.64, part: HAND_F, r: 21, dmg: 12, vx: 280, vy: -950, power: 0.78, launch: true, kb: 0, lunge: 50 },
  k: { dur: 0.50, a: 0.30, b: 0.58, part: FOOT_F, r: 23, dmg: 13, vx: 980, vy: -250, power: 0.92, launch: true, kb: 0, lunge: 100 },
  sweep: { dur: 0.58, a: 0.34, b: 0.62, part: FOOT_F, r: 26, dmg: 9, vx: 420, vy: -420, power: 0.7, launch: true, kb: 0, lunge: 80 },
  slide: { dur: 0.52, a: 0.04, b: 0.78, part: FOOT_F, r: 26, dmg: 7, vx: 240, vy: -640, power: 0.6, launch: true, kb: 0 },
  air: { dur: 0.34, a: 0.22, b: 0.62, part: FOOT_F, r: 20, dmg: 12, vx: 360, vy: -260, power: 0.7, launch: true, kb: 0, lunge: 0 },
  /** A jab thrown while airborne: the jump-in attack. */
  airPunch: { dur: 0.28, a: 0.18, b: 0.52, part: HAND_F, r: 18, dmg: 8, vx: 320, vy: -180, power: 0.45, launch: false, kb: 140, lunge: 0 },
  /** A stomp from the air: comes down, knocks down. */
  airStomp: { dur: 0.40, a: 0.42, b: 0.74, part: FOOT_F, r: 24, dmg: 11, vx: 200, vy: -140, power: 0.8, launch: false, kb: 220, lunge: 0, knockdown: true },
  /** The finisher: a two-handed blow with a long telegraph. */
  superMove: { dur: 0.95, a: 0.56, b: 0.72, part: HAND_F, r: 34, dmg: 34, vx: 900, vy: -700, power: 1.15, launch: true, kb: 0, lunge: 180, camera: true },
  /** The launcher's follow-up: a rising kick that juggles. */
  launchKick: { dur: 0.42, a: 0.30, b: 0.62, part: FOOT_F, r: 22, dmg: 10, vx: 300, vy: -820, power: 0.7, launch: true, kb: 0, lunge: 60 },
})

/** Per-kind constants. `scale` 1 is a ~100-unit body. */
const KIND = {
  player: { scale: 1.0, hp: 150, mass: 1.0, speed: 255, lw: 6.4 },
  enemy: { scale: 1.0, hp: 150, mass: 1.0, speed: 255, lw: 6.4 },
}

/** The pose scratch. Reused every frame to avoid allocating in the loop. */
const P = {
  lean: 0, pdx: 0, crouch: 0, bob: 0, tilt: 0,
  ffx: 0, ffy: 0, fbx: 0, fby: 0, hfx: 0, hfy: 0, hbx: 0, hby: 0,
}
/** IK output scratch. */
const J = { jx: 0, jy: 0, ex: 0, ey: 0 }

/**
 * Two-bone IK. Writes the joint (knee/elbow) and the reachable end into `J`.
 * `bend` picks which way the joint folds, so a limb never snaps backwards.
 */
function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax
  let dy = ty - ay
  let d = Math.hypot(dx, dy) || 0.001
  const maxD = l1 + l2 - 0.01
  const minD = Math.abs(l1 - l2) + 0.01
  const cd = clamp(d, minD, maxD)
  const ux = dx / d
  const uy = dy / d
  const a = (l1 * l1 - l2 * l2 + cd * cd) / (2 * cd)
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0))
  J.ex = ax + ux * cd
  J.ey = ay + uy * cd
  J.jx = ax + ux * a + bend * -uy * h
  J.jy = ay + uy * a + bend * ux * h
}

export class Fighter {
  constructor(kind, x, groundY) {
    const k = KIND[kind] ?? KIND.enemy
    this.kind = kind
    this.team = kind === 'player' ? 'p' : 'e'
    this.k = k
    this.s = k.scale
    this.mass = k.mass
    this.maxHp = k.hp
    this.hp = k.hp
    this.groundY = groundY
    this.x = x
    this.y = groundY
    this.vx = 0
    this.vy = 0
    this.face = kind === 'player' ? 1 : -1
    this.onGround = true

    /** idle | atk | hurt | air | rag | dead | getup */
    this.state = 'idle'
    this.t = 0
    this.time = Math.random() * 6
    this.atk = null
    this.atkName = ''
    this.atkHit = new Set()
    this.chainT = 0
    /** True while the player holds the guard. */
    this.block = false
    /** True while crouching. */
    this.crouching = false
    /**
     * The qi meter. Landing a hit fills it; a full meter unlocks the super.
     * Starting empty means the finisher has to be EARNED inside the round.
     */
    this.superMeter = 0
    this.superReady = false
    /** How many links deep the current string is. */
    this.chainCount = 0
    this.lastPunch = -1
    this.stunT = 0
    this.flash = 0
    this.invuln = 0
    this.walkPh = Math.random() * 6
    this.tele = false
    this.ragT = 0
    this.restT = 0
    this.deadT = 0
    this.credit = false

    this.tx = new Float32Array(N)
    this.ty = new Float32Array(N)
    this.rig = new Rig(this.s, 1)

    this.ai = {
      engage: false,
      cd: 0.6 + Math.random() * 0.8,
      hover: 150 + Math.random() * 90,
      jitter: Math.random() * 6,
      // The disengage beat: how long the AI keeps the distance it just made.
      retreatT: 0,
      pendingRetreat: 0,
      patienceT: 0,
      /** Frames-seconds before another hop is allowed. */
      hopCd: 0,
    }

    // -- event flags the caller reads and clears --
    this.evLand = 0
    this.evGetup = false
    this.evHit = null

    this.pose()
    this.rig.snapPose(this.tx, this.ty)
  }

  get alive() { return this.hp > 0 }
  get ragdolled() { return this.state === 'rag' || this.state === 'dead' }
  get canAct() { return this.state === 'idle' }
  /** World position of a joint, for the hit test and the renderer. */
  joint(i) { return [this.rig.x[i], this.rig.y[i]] }
  /** The joint the current attack is carried by. */
  get strikePoint() {
    return this.atk ? this.joint(this.atk.part) : null
  }

  /* ------------------------------------------------------- state ------- */

  startAttack(name) {
    // Depth counts only punches strung together inside the cancel window.
    this.chainCount = (name[0] === 'p' && this.chainT > 0) ? this.chainCount + 1 : 1
    this.atkName = name
    this.atk = ATK[name]
    this.atkHit.clear()
    this.state = 'atk'
    this.t = 0
    this.chainT = 0
    const lunge = this.atk.lunge || 0
    if (lunge && this.onGround) this.vx += this.face * lunge
  }

  stagger(vx, dur) {
    this.state = 'hurt'
    this.t = 0
    this.stunT = dur
    this.vx = vx
    this.atk = null
    this.tele = false
    this.ai.engage = false
  }

  launch(vx, vy, spin = 0) {
    this.state = this.hp > 0 ? 'rag' : 'dead'
    this.t = 0
    this.ragT = 0
    this.restT = 0
    this.atk = null
    this.tele = false
    this.onGround = false
    this.ai.engage = false
    this.rig.launch(vx, vy, spin)
  }

  die() {
    if (this.state === 'rag') this.state = 'dead'
    this.deadT = 0
  }

  punchChain() { return this.chainT > 0 || (this.state === 'atk' && this.atkName[0] === 'p') }

  /**
   * A landed punch opens the chain window at once.
   *
   * The window used to open only when the move FINISHED, so the next punch
   * had to be pressed after recovery — which is not a combo, it is two
   * separate jabs. A cancel means: the hit connected, so the tail of this
   * move may be replaced by the next link.
   */
  openChain() {
    if (this.atkName && this.atkName[0] === 'p') this.chainT = 0.55
  }

  /* --------------------------------------------------------- step ------ */

  step(world) {
    this.groundY = world.groundY
    this.time += DT
    this.t += DT
    if (this.flash > 0) this.flash -= DT
    if (this.invuln > 0) this.invuln -= DT
    if (this.chainT > 0) this.chainT -= DT
    this.ai.cd -= DT
    this.ai.retreatT = Math.max(0, this.ai.retreatT - DT)
    this.ai.patienceT = Math.max(0, this.ai.patienceT - DT)
    this.ai.hopCd = Math.max(0, this.ai.hopCd - DT)

    if (this.state === 'rag' || this.state === 'dead') this.stepRag(world)
    else if (this.state === 'getup') this.stepGetup(world)
    else this.stepKin(world)
  }

  stepKin(w) {
    const r = this.rig
    if (!this.onGround) this.vy += 2400 * DT
    this.x += this.vx * DT
    this.y += this.vy * DT
    if (this.y >= w.groundY) {
      if (!this.onGround && this.vy > 380) this.evLand = this.vy
      this.y = w.groundY
      this.vy = 0
      this.onGround = true
    } else this.onGround = false
    this.x = clamp(this.x, w.minX, w.maxX)

    if (this.state === 'hurt') {
      this.vx *= 0.9
      if (this.t >= this.stunT) { this.state = 'idle'; this.t = 0 }
    } else if (this.state === 'atk') {
      // A slide keeps its momentum; a punch or a kick sheds it fast. That
      // difference is what makes a slide feel like a committed slide.
      this.vx *= this.atkName === 'slide' ? 0.972 : 0.86
      if (this.t >= this.atk.dur) {
        const wasPunch = this.atkName[0] === 'p'
        this.state = 'idle'
        this.t = 0
        this.atk = null
        this.tele = false
        // A punch leaves a short window to chain the next one.
        if (wasPunch) this.chainT = 0.38
        // Let the counter linger briefly so the camera can read it.
        this.chainhold = this.chainCount
      }
    }
    if (!this.onGround && this.state === 'idle') this.state = 'air'
    if (this.onGround && this.state === 'air') { this.state = 'idle'; this.t = 0 }

    if (this.onGround) this.walkPh += this.vx * this.face * DT * 0.075
    this.pose()
    r.setPose(this.tx, this.ty)
  }

  stepRag(w) {
    const r = this.rig
    r.integrate()
    r.solve(w.groundY, w.minX, w.maxX)
    this.ragT += DT
    this.x = r.x[PELV]
    this.y = w.groundY
    this.vx = 0
    this.vy = 0
    this.onGround = r.grounded
    if (this.state === 'dead') { this.deadT += DT; return }
    if (r.grounded && r.energy() < 70) this.restT += DT
    else this.restT = 0
    if ((this.restT > 0.32 && this.ragT > 0.55) || this.ragT > 4.2) this.beginGetup(w)
  }

  beginGetup(w) {
    this.state = 'getup'
    this.t = 0
    this.x = clamp(this.rig.x[PELV], w.minX + 30, w.maxX - 30)
    this.y = w.groundY
    this.onGround = true
    this.vx = 0
    this.vy = 0
    this.evGetup = true
    // Standing up is a real opening, so the player is briefly protected from
    // being looped on; an enemy is not, so the player is rewarded for it.
    if (this.team === 'p') this.invuln = 1.1
  }

  stepGetup(w) {
    const T = 0.5
    this.pose()
    const k = 0.07 + 0.5 * ease.inQuad(clamp(this.t / T, 0, 1))
    this.rig.blendPose(this.tx, this.ty, k)
    this.x = this.rig.x[PELV]
    if (this.t >= T) {
      this.state = 'idle'
      this.t = 0
      this.ai.cd = Math.max(this.ai.cd, 0.4)
    }
  }

  /* --------------------------------------------------------- pose ------ */

  /**
   * Build the eleven joint targets for the current state.
   *
   * Every branch writes into the same eleven offsets, so blending between
   * states is just blending numbers — there is no separate skeleton per pose
   * and therefore no way for two of them to disagree about where the hip is.
   */
  pose() {
    const s = this.s
    const d = this.face

    // Neutral: a slight lean, feet a stance apart, hands a little forward.
    P.lean = 0.12; P.pdx = 0; P.crouch = 0; P.bob = 0; P.tilt = 0
    P.ffx = 14; P.ffy = 0; P.fbx = -14; P.fby = 0
    P.hfx = 20; P.hfy = -2; P.hbx = 12; P.hby = 8
    this.tele = false

    const st = this.state
    if (st === 'atk' && this.atk) this.poseAttack()
    else if (st === 'hurt') this.poseHurt()
    else if (!this.onGround) this.poseAir()
    else if (Math.abs(this.vx) > 14) this.poseWalk()
    else this.poseIdle()

    // --- the skeleton from the offsets ---
    const hipH = (B.thigh + B.shin) * s * 0.94
    const pelX = this.x + d * P.pdx * s
    const pelY = this.y - hipH + (P.crouch + P.bob) * s
    const lean = P.lean
    const neckX = pelX + d * Math.sin(lean) * B.torso * s
    const neckY = pelY - Math.cos(lean) * B.torso * s
    const hl = lean * 1.2 + P.tilt
    const headX = neckX + d * Math.sin(hl) * B.head * s
    const headY = neckY - Math.cos(hl) * B.head * s

    const tx = this.tx
    const ty = this.ty
    tx[HEAD] = headX; ty[HEAD] = headY
    tx[NECK] = neckX; ty[NECK] = neckY
    tx[PELV] = pelX; ty[PELV] = pelY

    const th = B.thigh * s
    const sh = B.shin * s
    const ua = B.uarm * s
    const fa = B.farm * s

    // Legs: knees bend toward the facing direction.
    ik(pelX, pelY, this.x + d * P.ffx * s, this.y - P.ffy * s, th, sh, -d)
    tx[KNEE_F] = J.jx; ty[KNEE_F] = J.jy; tx[FOOT_F] = J.ex; ty[FOOT_F] = J.ey
    ik(pelX, pelY, this.x + d * P.fbx * s, this.y - P.fby * s, th, sh, -d)
    tx[KNEE_B] = J.jx; ty[KNEE_B] = J.jy; tx[FOOT_B] = J.ex; ty[FOOT_B] = J.ey

    // Arms: elbows hang down and back.
    ik(neckX, neckY, neckX + d * P.hfx * s, neckY + P.hfy * s, ua, fa, d)
    tx[ELB_F] = J.jx; ty[ELB_F] = J.jy; tx[HAND_F] = J.ex; ty[HAND_F] = J.ey
    ik(neckX, neckY, neckX + d * P.hbx * s, neckY + P.hby * s, ua, fa, d)
    tx[ELB_B] = J.jx; ty[ELB_B] = J.jy; tx[HAND_B] = J.ex; ty[HAND_B] = J.ey
  }

  poseIdle() {
    P.bob = Math.sin(this.time * 4.2) * 1.3
    P.hfy = -2 + Math.sin(this.time * 4.2 + 1) * 1.5
    // Holding a guard raises both forearms across the chest and sinks the
    // weight; crouching drops the whole body and shortens the stance.
    if (this.block) {
      P.hfx = 14; P.hfy = -16
      P.hbx = -10; P.hby = -14
      P.crouch = 4
      P.lean = 0.02
    }
    if (this.crouching) {
      P.crouch = 26
      P.ffx = 20; P.fbx = -20
      P.lean = 0.22
      P.bob = 0
    }
  }

  poseWalk() {
    const ph = this.walkPh
    const sw = Math.sin(ph)
    const cw = Math.cos(ph)
    const run = clamp(Math.abs(this.vx) / this.k.speed, 0, 1.2)
    const amp = 16 + 8 * run
    P.ffx = 4 + sw * amp
    P.fbx = -4 - sw * amp
    P.ffy = Math.max(0, cw) * (6 + 6 * run)
    P.fby = Math.max(0, -cw) * (6 + 6 * run)
    P.bob = -Math.abs(cw) * 2.4
    P.lean = 0.12 + 0.12 * run
    P.hfx = 18 - sw * 6
    P.hbx = 10 + sw * 6
    P.hby = 8 - cw * 3
    P.hfy = -3 + cw * 3
  }

  poseAir() {
    P.lean = 0.06
    P.ffx = 20; P.ffy = 18; P.fbx = -8; P.fby = 10
    P.crouch = -2
    P.hfx = 24; P.hfy = -28; P.hbx = -2; P.hby = -24
  }

  poseHurt() {
    // A snap back, then a settle. The head leads — that is what sells "struck".
    const k = ease.outQuad(clamp(this.t / 0.1, 0, 1))
    P.lean = lerp(0.12, -0.4, k)
    P.tilt = -0.25 * k
    P.crouch = 3 * k
    P.hfx = lerp(20, -10, k); P.hfy = lerp(-2, -18, k)
    P.hbx = lerp(12, -26, k); P.hby = lerp(8, -4, k)
    P.ffx = 22; P.fbx = -18
  }

  /**
   * The strike, driven by one scalar `e` in [-1, 1]:
   *
   *   e < 0  the coil (a punch pulls the fist back, an uppercut sinks)
   *   e = 1  full extension, held through the active window
   *   then it falls back to 0
   *
   * Because the whole body reads `e`, the hip travel, the lean and the
   * counterweight arm can never drift out of step with the fist.
   */
  poseAttack() {
    const a = this.atk
    const name = this.atkName
    const u = clamp(this.t / a.dur, 0, 1)

    if (name === 'p1' || name === 'p2') {
      let e
      if (u < a.a) {
        const k = u / a.a
        e = k < 0.4 ? -0.3 * ease.outQuad(k / 0.4) : lerp(-0.3, 1, ease.inOutQuad((k - 0.4) / 0.6))
      } else if (u < a.b) e = 1
      else e = 1 - ease.inOutQuad((u - a.b) / (1 - a.b))

      if (name === 'p2') {
        // The back-hand swing: the far fist comes round, the body turns into it.
        P.hbx = 12 + e * 62
        P.hby = -3
        P.hfx = 18
        P.hfy = 0
        P.lean = 0.1 + 0.24 * e
        P.pdx = e * 12
        P.ffx = 20 + e * 8
        P.fbx = -16 - e * 4
      } else {
        P.hfx = 18 + e * 54
        P.hfy = -4 - e * 2
        P.hbx = 8
        P.hby = 6
        P.lean = 0.12 + 0.2 * e
        P.pdx = e * 9
        P.ffx = 16 + e * 8
      }
    } else if (name === 'p3') {
      // Uppercut: sink, then explode upward.
      if (u < a.a) {
        const k = ease.outQuad(u / a.a)
        P.crouch = 16 * k
        P.hfx = lerp(20, 12, k); P.hfy = lerp(-2, 28, k)
        P.lean = lerp(0.12, 0.3, k)
        P.hbx = 6; P.hby = 12
        P.ffx = 20; P.fbx = -18
      } else {
        const k = u < a.b ? ease.outCubic((u - a.a) / (a.b - a.a)) : 1 - ease.inOutQuad((u - a.b) / (1 - a.b)) * 0.9
        const q = clamp(k, 0, 1)
        P.crouch = lerp(16, -7, q)
        P.hfx = lerp(12, 24, q); P.hfy = lerp(28, -64, q)
        P.lean = lerp(0.3, -0.06, q)
        P.pdx = 8 * q
        P.hbx = 4; P.hby = lerp(12, -10, q)
        P.ffx = 22; P.ffy = 0; P.fbx = -18; P.fby = q * 8
      }
    } else if (name === 'k') {
      // The kick: knee leads, shin snaps out, the body leans away.
      let e
      if (u < a.a) e = 0.35 * ease.outQuad(u / a.a)
      else if (u < a.b) e = lerp(0.35, 1, ease.outCubic(Math.min(1, (u - a.a) / ((a.b - a.a) * 0.4))))
      else e = 1 - ease.inOutQuad((u - a.b) / (1 - a.b))
      P.ffx = lerp(14, 60, e); P.ffy = lerp(0, 42, e)
      P.pdx = 12 * e
      P.lean = lerp(0.12, -0.3, e); P.tilt = -0.2 * e
      P.fbx = -16 - 6 * e
      P.hfx = lerp(20, -4, e); P.hfy = lerp(-2, 12, e)
      P.hbx = lerp(12, -26, e); P.hby = lerp(8, -14, e)
    } else if (name === 'sweep') {
      // The sweep: drop onto the back leg, the front leg scythes along the floor.
      let e
      if (u < a.a) e = 0.4 * ease.outQuad(u / a.a)
      else if (u < a.b) e = lerp(0.4, 1, ease.outCubic(Math.min(1, (u - a.a) / ((a.b - a.a) * 0.45))))
      else e = 1 - ease.inOutQuad((u - a.b) / (1 - a.b))
      P.crouch = 30 * e
      P.lean = lerp(0.12, 0.75, e)
      P.tilt = 0.2 * e
      // The scything foot rides just above the floor and reaches far out.
      P.ffx = lerp(14, 74, e)
      P.ffy = lerp(0, 4, e)
      P.pdx = 14 * e
      P.fbx = lerp(-14, -20, e)
      P.hfx = lerp(20, 44, e); P.hfy = lerp(-2, 18, e)
      P.hbx = lerp(12, -34, e); P.hby = lerp(8, 20, e)
    } else if (name === 'slide') {
      // Feet first along the floor: drop in fast, rise out at the end.
      const e = ease.outQuad(clamp(u / 0.14, 0, 1)) * (1 - ease.inOutQuad(clamp((u - 0.76) / 0.24, 0, 1)))
      P.crouch = 30 * e
      P.lean = lerp(0.12, -0.95, e)
      P.tilt = 0.5 * e
      P.ffx = lerp(16, 58, e); P.ffy = 6 * e
      P.fbx = lerp(-16, 20, e); P.fby = 0
      P.hfx = lerp(18, 26, e); P.hfy = lerp(-2, -22, e)
      P.hbx = lerp(8, -28, e); P.hby = lerp(6, 28, e)
    } else if (name === 'air') {
      // The jumping kick: both legs trail, one drives down and forward.
      let e
      if (u < a.a) e = 0.3 * ease.outQuad(u / a.a)
      else if (u < a.b) e = lerp(0.3, 1, ease.outCubic(Math.min(1, (u - a.a) / ((a.b - a.a) * 0.5))))
      else e = 1 - ease.inOutQuad((u - a.b) / (1 - a.b))
      P.lean = lerp(0.06, 0.4, e)
      P.ffx = lerp(20, 66, e); P.ffy = lerp(18, 4, e)
      P.fbx = lerp(-8, -24, e); P.fby = lerp(10, 22, e)
      P.hfx = lerp(24, -14, e); P.hfy = lerp(-28, -6, e)
      P.hbx = lerp(-2, -30, e); P.hby = lerp(-24, -16, e)
    }
    this.tele = this.atk.tele ? u < a.a : false
  }

  /* ----------------------------------------------------------- ai ------ */

  /**
   * Decide what to do this frame.
   *
   * The design goal is a fighter in the fighting-game sense: it works the
   * distance, leaves when it has over-committed, and only presses on an
   * opening. Every branch below is about SPACING first and offence second.
   */
  aiStep(foe) {
    const out = { left: false, right: false, jump: false, block: false, move: null }
    if (!this.alive) return out

    // HOLDING A DISTANCE is its own behaviour and it must run even while the
    // body is airborne, because the escape itself is a hop. Without this the
    // retreat timer stopped being honoured the moment the hop left the floor,
    // and the AI drifted to the far wall instead of resetting the spacing.
    if (this.ai.retreatT > 0) {
      const gap0 = Math.abs(foe.x - this.x)
      const dir0 = foe.x > this.x ? 1 : -1
      if (gap0 < 46 * this.s) { out.left = dir0 > 0; out.right = dir0 < 0 }
      else if (gap0 > 96 * this.s) { out.left = dir0 < 0; out.right = dir0 > 0 }
      return out
    }

    if (this.state !== 'idle' || !this.onGround) return out
    const a = this.ai
    const gap = Math.abs(foe.x - this.x)
    const dir = foe.x > this.x ? 1 : -1

    // Keep facing the opponent while free.
    this.face = dir

    const reach = 58 * this.s
    const pressure = 34 * this.s
    const mid = 96 * this.s
    const far = 190 * this.s

    // --- a queued escape fires on the first frame it is legal ---
    if (a.pendingRetreat > 0) {
      a.retreatT = a.pendingRetreat
      a.pendingRetreat = 0
      out.move = 'retreat'
      return out
    }
    // --- holding the distance it just made ---
    if (a.retreatT > 0) {
      if (gap < reach) { out.left = dir > 0; out.right = dir < 0 }
      else if (gap > mid) { out.left = dir < 0; out.right = dir > 0 }
      return out
    }

    // --- point blank: leaving is the priority, but not without limit ---
    if (gap < pressure) {
      const r = Math.random()
      if (r < 0.38 && a.hopCd <= 0) {
        a.hopCd = 1.25
        a.retreatT = 0.35 + Math.random() * 0.3
        out.move = 'retreat'
        return out
      }
      if (r < 0.66) { out.block = true; return out }
      if (a.cd <= 0) { a.cd = rand(0.8, 1.4); out.move = Math.random() < 0.5 ? 'p1' : 'p2'; return out }
      out.left = dir > 0; out.right = dir < 0
      return out
    }

    // --- inside its own reach: attack, feint, or give a step ---
    if (gap < reach) {
      if (a.patienceT > 0) return out
      if (a.cd <= 0) {
        a.cd = rand(0.7, 1.3)
        const r = Math.random()
        if (gap < reach * 0.62) out.move = r < 0.5 ? 'p1' : r < 0.8 ? 'p2' : 'p3'
        else out.move = r < 0.55 ? 'k' : r < 0.8 ? 'sweep' : 'p2'
        return out
      }
      // Between swings, keep shuffling: never stand still in range.
      if (gap < reach * 0.72) { out.left = dir > 0; out.right = dir < 0 }
      else { out.left = dir < 0; out.right = dir > 0 }
      return out
    }

    // --- mid: creep in, stall, bait ---
    if (gap < mid) {
      if (a.patienceT > 0) return out
      if (Math.random() < 0.02) { a.patienceT = rand(0.2, 0.5); return out }
      out.left = dir < 0; out.right = dir > 0
      return out
    }

    // --- far: walk in ---
    if (gap < far) { out.left = dir < 0; out.right = dir > 0; return out }
    out.left = dir < 0; out.right = dir > 0
    return out
  }
}
