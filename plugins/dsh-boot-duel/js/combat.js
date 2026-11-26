/**
 * Combat resolution: capsule hit test, damage, and the reaction ladder.
 *
 * WHY A CAPSULE AND NOT A RECTANGLE. The hit is centred on the joint that
 * carries it — the fist, or the foot — and tested against the target's own
 * BONE SEGMENTS. A rectangle is axis-aligned and does not rotate, so a kick
 * that visually passes through an opponent's knee can miss the rectangle
 * beside it; that is exactly the "我打不到人" complaint. Because the strike
 * point is the drawn joint and the target is the drawn skeleton, a hit lands
 * where the picture says it landed.
 *
 * The reaction ladder is ordered so a fight has weight:
 *
 *   blocked    — chip damage and a shove; no state change
 *   staggered  — the default: a short stun, still standing
 *   launched   — a launcher throws the body into the ragdoll, where it can be
 *                hit again (a juggle)
 *   knocked down— falls out of the ragdoll when it comes to rest, then gets up
 *
 * (Method after Waleee7/ragdoll-riot; independent implementation.)
 */

import { HEAD, NECK, PELV, ELB_B, ELB_F, HAND_B, HAND_F, KNEE_B, KNEE_F, FOOT_B, FOOT_F } from './rig.js'
import { ATK, DT } from './fighter.js'
import { clamp, sign, rand } from './juice.js'

/**
 * The skeleton segments a strike can connect with. Using every bone rather
 * than a single body box is what makes a leg-sweep and a head-shot both land.
 */
const SEGMENTS = [
  [NECK, PELV], [HEAD, NECK],
  [NECK, ELB_F], [ELB_F, HAND_F], [NECK, ELB_B], [ELB_B, HAND_B],
  [PELV, KNEE_F], [KNEE_F, FOOT_F], [PELV, KNEE_B], [KNEE_B, FOOT_B],
]

/**
 * Distance from point (hx, hy) to the segment a-b. Used for the capsule test:
 * a hit is "the strike centre is within `r` plus the limb's own radius of any
 * of the target's bones".
 */
function segDist(ax, ay, bx, by, hx, hy) {
  const abx = bx - ax
  const aby = by - ay
  const t = clamp(((hx - ax) * abx + (hy - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1)
  const cx = ax + abx * t
  const cy = ay + aby * t
  return Math.hypot(hx - cx, hy - cy)
}

/**
 * Does a strike centred at (hx, hy) with radius `r` connect with `victim`?
 *
 * The limb thickness is added to the radius so a punch landing on the edge of
 * an arm still counts — the drawn silhouette has width, and the hit test
 * should agree with the picture.
 */
export function hitTest(hx, hy, r, victim) {
  const rg = victim.rig
  const s = victim.s
  const limb = 3.2 * s
  for (const [a, b] of SEGMENTS) {
    if (segDist(rg.x[a], rg.y[a], rg.x[b], rg.y[b], hx, hy) < r + limb) return true
  }
  // The head is a disc, not a point on a segment; give it its own radius.
  return Math.hypot(hx - rg.x[HEAD], hy - rg.y[HEAD]) < r + 10 * s
}

/**
 * The capsule the renderer draws for the active window, so the hitbox is
 * visible in a debug view and the player can learn the reach.
 */
export function strikeCapsule(attacker) {
  if (!attacker.atk) return null
  const p = attacker.joint(attacker.atk.part)
  return { x: p[0], y: p[1], r: attacker.atk.r * attacker.s }
}

/**
 * Resolve every in-flight attack in one step. `fighters` is the full list;
 * each is tested against everyone on the other team.
 *
 * Damage, reactions and the resulting juice go through `onHit`, so this module
 * stays free of rendering.
 */
export function resolveAttacks(fighters, world, onHit) {
  for (const a of fighters) {
    if (a.state !== 'atk' || !a.atk) continue
    const spec = a.atk
    const u = a.t / spec.dur
    if (u < spec.a || u > spec.b) continue

    const [hx, hy] = a.joint(spec.part)
    const r = spec.r * a.s

    for (const v of fighters) {
      if (v === a) continue
      if (v.team === a.team) continue
      if (a.atkHit.has(v)) continue
      if (v.state === 'dead') continue
      // A downed or rising fighter cannot be hit — that is the invulnerable
      // window that makes a knockdown worth having.
      if (v.ragdolled || v.state === 'getup') continue
      if (v.invuln > 0) continue
      if (!v.alive) continue
      if (!hitTest(hx, hy, r, v)) continue

      a.atkHit.add(v)
      applyHit(a, v, a.atkName, hx, hy, world, onHit)
    }
  }
}

/**
 * Settle one connection: damage, the physical response, and the feedback.
 *
 * The launch velocity is divided by the victim's mass, so the same kick throws
 * a light body further than a heavy one — the single cheapest way to make two
 * characters feel like different weights.
 */
export function applyHit(a, v, name, hx, hy, world, onHit) {
  const spec = ATK[name]
  const byPlayer = a.team === 'p'
  const dir = a.face || sign(v.x - a.x)
  const juggling = v.ragdolled

  // GUARD. A blocking fighter takes a fifth of the damage, is shoved rather
  // than launched, and stays on their feet — but a LOW move ignores the guard,
  // which is what makes crouching and sweeping worth having.
  const isLow = spec.part === FOOT_F || name === 'sweep' || name === 'slide'
  const guarding = v.block && !isLow && v.state !== 'atk'
  const dealt = guarding ? Math.max(1, Math.round(spec.dmg * 0.2)) : spec.dmg

  // The PLAYER floors at 1: this is an opening animation, not a game over.
  // An enemy at 0 is a knockout.
  const raw = v.hp - dealt
  v.hp = byPlayer ? Math.max(0, raw) : Math.max(1, raw)
  const kill = byPlayer && v.hp <= 0 && !guarding
  const I = clamp(spec.power * (kill ? 1.12 : 1), 0, 1.15)
  v.flash = 0.12
  // A connecting swing opens the attacker's chain: that is the cancel.
  a.openChain()

  // --- the physical response -----------------------------------------
  let reaction
  if (guarding) {
    // Absorbed: a shove back, no state change beyond a stagger-lite.
    reaction = 'guard'
    v.vx = dir * (spec.kb || 120) * 0.5 / v.mass
    v.stagger(dir * 40 / v.mass, 0.1)
  } else if (kill) {
    reaction = 'ko'
    const m = v.mass
    v.launch(dir * spec.vx * 1.3 / m, Math.min(spec.vy / Math.pow(m, 0.7), -300 / Math.pow(m, 0.6)), dir * rand(2, 6) * (0.6 + I))
    v.die()
  } else if (juggling) {
    reaction = 'juggle'
    const m = v.mass
    v.rig.kick(dir * spec.vx * 0.8 / m, Math.min(-380, spec.vy / Math.pow(m, 0.7) * 0.9))
    v.restT = 0
    v.ragT = Math.min(v.ragT, 1.6)
  } else if (spec.launch) {
    reaction = 'launch'
    const m = v.mass
    v.launch(dir * spec.vx / m, spec.vy / Math.pow(m, 0.7), dir * rand(2, 6) * (0.6 + I))
  } else {
    reaction = 'stagger'
    const m = v.mass
    v.stagger(dir * (spec.kb || 120) / m, 0.24 + 0.08 * I)
  }

  // --- the feedback ---------------------------------------------------
  // The victim of a hit is always knocked out of any attack it was in the
  // middle of: being hit has to beat being committed.
  if (reaction !== 'juggle') {
    v.atk = null
    v.tele = false
  }

  if (onHit) onHit({
    attacker: a,
    victim: v,
    name,
    x: hx,
    y: hy,
    damage: dealt,
    guarded: guarding,
    kill,
    reaction,
    power: I,
    juggle: juggling,
  })

  return reaction
}

export { DT }
