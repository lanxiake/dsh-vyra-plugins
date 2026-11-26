/**
 * Hit resolution: overlap test, damage, block, and the target's reaction.
 *
 * Kept separate from `fighter.mjs` because this is the only place health
 * changes. Every damage path goes through `applyDamage`, so the player's
 * health floor and the "KO happens once" rule live in exactly one function.
 *
 * HIT REACTION LADDER. What a target does when struck is the whole feel of a
 * fight, and it must be layered so a combo can be read as a combo:
 *
 *   1. **blocked**     — chip damage, a small shove, no state change;
 *   2. **staggered**   — the default: a short stun, still standing;
 *   3. **launched**    — a launcher flings them up; while airborne they cannot
 *                        block, so the next hit is guaranteed — the juggle;
 *   4. **knocked down**— a sweep or an overhead puts them on the floor, with a
 *                        get-up that is a real opening.
 *
 * Which one happens is the MOVE's data, not the damage number: a 11-damage
 * sweep knocks down and a 14-damage kick does not, because that is what makes
 * choosing between them interesting.
 */

import {
  BLOCK_REDUCTION, COMBO_DAMAGE_SCALE, COUNTER_DAMAGE, HIT_RECOVERY_FRAMES, KNOCKDOWN_GROUNDED_FRAMES,
  KO_TIME_SCALE, KNOCKBACK, MAX_HP, MOVES, PLAYER_HP_FLOOR, STAGGER_FRAMES, STANDOFF,
} from './constants.mjs'
import { applyKnockback, hurtboxOf, hitboxOf, knockDown, launch, stagger } from './fighter.mjs'

/** The fighter's standing height, world units (640 rig * 0.1095). */
const BODY_HEIGHT_W = 70
/** Height of mid-torso above the soles. */
const BODY_MID = 35

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Apply damage to `defender`.
 *
 * `opts.player` marks the player, who cannot be defeated: health stops at 1
 * and this returns false (never a KO). Otherwise health stops at 0.
 *
 * Returns whether this hit emptied the bar (the single KO trigger).
 */
export function applyDamage(defender, damage, opts = {}) {
  const amount = Math.max(0, Math.round(damage))
  const floor = opts.player ? PLAYER_HP_FLOOR : 0
  const next = Math.max(floor, defender.hp - amount)
  const emptied = next <= 0 && !opts.player
  defender.hp = next
  return emptied
}

/**
 * Test `attacker`'s active box against `defender` and settle one hit.
 *
 * Returns null when nothing connects or when this swing already landed, so
 * the caller can safely call it every active frame.
 */
export function resolveHits(attacker, defender, opts = {}) {
  const box = hitboxOf(attacker)
  if (!box || attacker.hitConsumed) return null
  if (defender.hp <= 0) return null
  if (!overlaps(box, hurtboxOf(defender))) return null

  const move = MOVES_FOR(attacker.action)

  // A launcher-styled follow-up only exists to extend a juggle: whiffing it on
  // a grounded opponent is what stops the chain from being a free loop.
  if (move?.airOnly && !defender.juggled) return null

  attacker.hitConsumed = true
  attacker.lastLanded = attacker.action
  attacker.hitFrame = attacker.actionFrame
  attacker.sinceHit = 0

  // WHERE it landed. The strike's own BAND decides: a move that sweeps the
  // floor hits the legs, one that rides the chest hits the body, one that
  // reaches the crown hits the head. Taking the midpoint of the intersection
  // instead put every contact at mid-torso, so every hit read the same.
  //
  // `high` is the top of the strike band, measured up from the floor.
  const midBand = defender.y - (box.y + box.h / 2)
  const relative = midBand / BODY_HEIGHT_W
  // Head: the top fifth of the body. Legs: below the waist. Everything between
  // is the torso, which is most of it — as it should be.
  const zone = relative > 0.82 ? 'head' : relative > 0.42 ? 'body' : 'legs'

  const blocked = Boolean(defender.blocking) && !defender.juggled && !defender.prone
  // A counter is a hit that lands while the target is already reeling from a
  // DIFFERENT exchange. Inside a chain that is just "the combo working", so it
  // does not qualify — otherwise every link after the first pays counter
  // damage and the damage ladder never applies.
  const counter = !blocked && defender.stagger > 0 && (attacker.comboCount || 0) === 0
  const base = counter ? Math.max(box.damage, COUNTER_DAMAGE) : box.damage
  const damage = blocked ? Math.round(base * (1 - BLOCK_REDUCTION)) : base

  // Combo scaling follows the VICTIM's streak: the more hits this body has
  // taken without a break, the less each new one is worth.
  const depth = Math.min(COMBO_DAMAGE_SCALE.length - 1, Math.max(0, defender.hitStreak || 0))
  const scaledDamage = blocked ? damage : Math.max(1, Math.round(damage * COMBO_DAMAGE_SCALE[depth]))

  // Count this hit only AFTER it has been priced, so the first blow of a
  // chain lands at full value.
  defender.hitStreak = Math.min(8, (defender.hitStreak || 0) + 1)
  defender.sinceStruck = 0

  const ko = applyDamage(defender, scaledDamage, { player: Boolean(opts.player) })

  // Knockback distance. Sized so a jab leaves the target still inside jab
  // range: a chain has to be able to continue, and a hit that shoves the
  // target out of the attacker's own reach makes every combo one hit long.
  const push = (blocked ? KNOCKBACK * 0.2 : KNOCKBACK * 0.55) * (counter ? 1.5 : 1)
  const dir = attacker.facing
  // The attacker steps into the hit: a fighting game's "hit-push". Without it
  // the defender drifts out of range with every blow and a chain cannot land.
  if (!blocked) applyKnockback(attacker, dir * push * 0.5)

  // --- the reaction ladder -------------------------------------------
  let reaction = 'stagger'
  if (ko) {
    // The KO owns the body; the duel replaces it with a ragdoll.
    reaction = 'ko'
    applyKnockback(defender, dir * push)
  } else if (blocked) {
    reaction = 'blocked'
    applyKnockback(defender, dir * push)
  } else if (move?.launch) {
    reaction = 'launch'
    launch(defender, { vx: dir * (move.launchX ?? 2), vy: move.launch })
  } else if (move?.knockdown) {
    reaction = 'knockdown'
    knockDown(defender, { vx: dir * (move.knockdownLift ?? 3), lift: move.knockdownLift ?? 4 })
  } else {
    // A HEAD shot rocks the whole body: longer stun and a harder shove. A LEG
    // shot buckles the stance: shorter stun, but it costs the target its
    // footing. A BODY shot is the neutral case.
    const zoneScale = zone === 'head' ? 1.45 : zone === 'legs' ? 0.7 : 1
    applyKnockback(defender, dir * push * (zone === 'head' ? 1.35 : 1))
    stagger(defender, Math.round(STAGGER_FRAMES * zoneScale))
  }

  // A landed strike costs the attacker extra recovery. Without this a 14-frame
  // jab loop clears the bar in under two seconds no matter what the opponent
  // does; with it, committing to a swing is a real decision and mashing pays
  // for every hit it lands. A blocked hit costs nothing extra — chipping a
  // guard is already slow enough — and a LAUNCH is the exception the other
  // way: it exists to be cancelled out of, so it pays nothing.
  // A landed hit adds recovery — that is what makes committing matter — but
  // it must not swallow the cancel window. `HIT_RECOVERY_FRAMES` only extends
  // the tail of the move; `canStart` reads `cancelFrom`, which is unaffected.
  attacker.recoveryBonus = (blocked || reaction === 'launch') ? 0 : HIT_RECOVERY_FRAMES

  return {
    hit: true,
    damage: scaledDamage,
    blocked,
    counter,
    ko,
    reaction,
    /** 'head' | 'body' | 'legs' — which part of the target took it. */
    zone,
    /** Where to spawn impact particles, in world coordinates. */
    point: {
      x: Math.max(box.x, Math.min(box.x + box.w, defender.x)),
      y: box.y + box.h / 2,
    },
    move: box.move,
  }
}

/** The move table entry for an action name, or null. */
function MOVES_FOR(name) {
  return name ? (MOVES[name] ?? null) : null
}


/**
 * Keep the two fighters from occupying the same spot, and turn each to face
 * the other when neither is mid-swing.
 *
 * The minimum gap is the SUM OF BODIES, not a "standoff": two fighters who are
 * touching should be touching, and only a genuinely overlapping pair gets
 * pushed apart. The old value (`STANDOFF * 0.9`) kept them a third of a body
 * apart at all times, so the reference's close-quarters exchanges were
 * impossible to reproduce.
 */
export function separate(player, enemy, opts = {}) {
  const gap = enemy.x - player.x
  const minGap = (opts.minGap ?? (STANDOFF * 0.42))
  if (Math.abs(gap) < minGap) {
    const push = (minGap - Math.abs(gap)) / 2
    const dir = gap === 0 ? 1 : Math.sign(gap)
    applyKnockback(player, -dir * push)
    applyKnockback(enemy, dir * push)
  }
  if (!opts.freezeFacing) {
    // A juggled or downed fighter keeps whatever way they were thrown.
    if (player.action === null && !player.juggled && !player.prone) player.facing = gap >= 0 ? 1 : -1
    if (enemy.action === null && !enemy.juggled && !enemy.prone) enemy.facing = gap >= 0 ? -1 : 1
  }
}

/** Clamp both health values to their legal ranges (defensive). */
export function clampHealth(player, enemy) {
  player.hp = Math.max(PLAYER_HP_FLOOR, Math.min(MAX_HP, player.hp))
  enemy.hp = Math.max(0, Math.min(MAX_HP, enemy.hp))
}

export { KO_TIME_SCALE, KNOCKDOWN_GROUNDED_FRAMES }
