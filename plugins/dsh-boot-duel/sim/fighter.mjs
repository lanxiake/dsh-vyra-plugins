/**
 * Stick-fighter state machine.
 *
 * A fighter is in exactly one of these states, checked in this order:
 *
 *   knockdown  — on the floor, then pushing back up; cannot act
 *   juggled    — airborne because something launched them; cannot act, CAN be
 *                hit again (that is the whole point)
 *   attacking  — a move is in flight (`action` names which)
 *   free       — idle / block / walk / jump / back-step
 *
 * A move has three phases: windup (no hitbox), active (hitbox on), recovery
 * (no hitbox). That shape stops button mashing from working — a strike thrown
 * at the wrong moment leaves the fighter committed and open.
 *
 * CANCELLING is what makes a combo. Once `actionFrame` has passed the move's
 * `cancelFrom` frame AND the move has connected, a move listed in
 * `COMBO_CHAIN[current]` may start immediately, without waiting out recovery.
 * That is the whole difference between "press J nine times" and "chain a jab
 * into a hook into an uppercut".
 */

import {
  ARENA, BACK_HOP_DRIFT, BACK_HOP_VELOCITY, BACK_STEP_FRAMES, BACK_STEP_SPEED,
  COMBO_CHAIN, GRAVITY, MAX_COMBO_LINKS, JUGGLE_GRAVITY, JUGGLE_MAX_FRAMES,
  JUMP_FRAMES, JUMP_VELOCITY, KNOCKDOWN_FRAMES, KNOCKDOWN_GROUNDED_FRAMES, MOVES,
  STAGGER_FRAMES, WALK_SPEED, AIR_CONTROL, CANCEL_DELAY_FRAMES, COMBO_WINDOW_FRAMES,
} from './constants.mjs'

/**
 * Height of the hurtbox, in world units: the whole figure, soles to crown.
 * The rig's figure is 640 rig units at scale 0.1095, i.e. 70 world units.
 * Keep this derived from the rig, not remembered: leaving the old 280 here
 * made the hit target twice the body's height.
 */
const BODY_HEIGHT = 70

/**
 * Half-width of the HURTBOX, in world units.
 *
 * Wide on purpose. `ARENA.bodyHalfWidth` (9) is the collision radius two
 * bodies push against — sized to the torso alone — but a fighter in a stance
 * occupies far more: the planted feet are 66 units apart and an outstretched
 * arm reaches further still. Sizing the hit target to the collision radius made
 * swings sail through visibly connected limbs and read as "the game ignored my
 * punch", so the target is deliberately far more generous: 40 units each way
 * on a 70-unit figure.
 */
const BODY_HALF_WIDTH = 20

export function createFighter(id, x, facing, hp = 100) {
  return {
    id,
    x,
    /** Y of the fighter's feet; ARENA.ground on the floor. */
    y: ARENA.ground,
    vy: 0,
    /** Horizontal velocity, used by the back-hop and by launches. */
    vx: 0,
    facing: facing >= 0 ? 1 : -1,
    hp,
    /** null | a key of `MOVES`. */
    action: null,
    actionFrame: 0,
    /** Frames of stagger left; a staggered fighter cannot act. */
    stagger: 0,
    /** Which part of this body the last blow landed on: head / body / legs. */
    hitZone: null,
    /** Frames of knockdown left (includes the get-up). */
    knockdown: 0,
    /** True while the body is actually lying on the floor. */
    prone: false,
    /** True while a launch has the body off the ground and re-hittable. */
    juggled: false,
    juggleFrames: 0,
    blocking: false,
    onGround: true,
    jumpFramesLeft: 0,
    /** Frames left of a back-step; the fighter is committed during it. */
    backStep: 0,
    /**
     * Set once an attack has connected, so one swing cannot land twice and so
     * a cancel is only legal after contact.
     */
    hitConsumed: false,
    /** Extra recovery frames this swing costs, added on a clean hit. */
    recoveryBonus: 0,
    /** Set by the duel while the qi meter is full; gates the special. */
    specialReady: false,
    /** How many moves deep the current chain is; reset when the fighter is free. */
    comboCount: 0,
    /** The actionFrame at which the current move connected, for cancel timing. */
    hitFrame: 0,
    /** Frames since this fighter last CONNECTED with anything. */
    sinceHit: 999,
    /** How many hits of one chain this fighter has EATEN; drives damage scaling. */
    hitStreak: 0,
    /** Frames since this fighter was last struck; a quiet beat resets `hitStreak`. */
    sinceStruck: 999,
    /** The last move that connected, for the HUD and for the AI. */
    lastLanded: null,
    /** Purely cosmetic animation counter. */
    animFrame: 0,
  }
}

const totalFrames = (move, bonus = 0) => move.windup + move.active + move.recovery + bonus

/** True while the fighter may start a new action from neutral. */
export function canAct(fighter) {
  return fighter.stagger <= 0
    && fighter.knockdown <= 0
    && fighter.juggled === false
    && fighter.action === null
    && fighter.onGround
    && fighter.backStep <= 0
}

/**
 * True when `fighter` may start `name` right now.
 *
 * Two routes: from neutral, or as a CANCEL — deep enough in the current move,
 * after it has connected, into a move `COMBO_CHAIN` allows.
 */
export function canStart(fighter, name) {
  const move = MOVES[name]
  if (!move) return false
  if (name === 'special' && !fighter.specialReady) return false

  // AERIAL MOVES. `airKick` exists only in the air: `canAct` requires
  // `onGround`, so it needs its own gate. Everything else follows the normal
  // two routes.
  if (move.aerial) {
    return fighter.onGround === false
      && !fighter.juggled
      && fighter.knockdown <= 0
      && fighter.stagger <= 0
      && fighter.action === null
  }

  if (canAct(fighter)) return true
  const current = MOVES[fighter.action]
  if (!current) return false
  if (!fighter.hitConsumed) return false
  if (fighter.actionFrame < current.cancelFrom) return false
  // A cancel is not free: it must wait out `CANCEL_DELAY_FRAMES` measured from
  // the frame the move CONNECTED, not from when it started. Without this the
  // whole chain fires within a couple of frames of the first contact, and a
  // single opening deletes a health bar — the pacing problem the old
  // `HIT_RECOVERY_FRAMES` used to solve, reintroduced.
  if (fighter.actionFrame < (fighter.hitFrame || 0) + CANCEL_DELAY_FRAMES) return false
  // A chain has a ceiling: past `MAX_COMBO_LINKS` the attacker has to reset.
  if ((fighter.comboCount || 0) >= MAX_COMBO_LINKS) return false
  const allowed = COMBO_CHAIN[fighter.action] || []
  return allowed.includes(name)
}

/**
 * Begin `name`. Returns false when the fighter is committed, staggered, or the
 * move is not legal right now.
 */
export function startAction(fighter, name) {
  if (name === 'jump') {
    if (!fighter.onGround || fighter.stagger > 0 || fighter.knockdown > 0) return false
    fighter.vy = JUMP_VELOCITY
    fighter.onGround = false
    fighter.jumpFramesLeft = JUMP_FRAMES
    return true
  }
  if (name === 'backStep') {
    if (!canAct(fighter)) return false
    fighter.backStep = BACK_STEP_FRAMES
    // The retreat is a burst, not a hold: most of the distance lands in the
    // first few frames, which is what makes it read as a hop rather than a walk.
    fighter.vx = -fighter.facing * BACK_STEP_SPEED
    return true
  }
  if (name === 'backHop') {
    if (!canAct(fighter)) return false
    fighter.backStep = BACK_STEP_FRAMES
    fighter.vy = BACK_HOP_VELOCITY
    fighter.vx = -fighter.facing * BACK_HOP_DRIFT
    fighter.onGround = false
    fighter.jumpFramesLeft = JUMP_FRAMES
    return true
  }
  if (!canStart(fighter, name)) return false
  const cancelling = fighter.action !== null
  fighter.action = name
  fighter.actionFrame = 0
  fighter.hitConsumed = false
  fighter.recoveryBonus = 0
  fighter.comboCount = cancelling ? Math.min(MAX_COMBO_LINKS, fighter.comboCount + 1) : 0
  // A step forward is part of the move: it is what keeps an attacker in range
  // for the next link of a chain.
  const move = MOVES[name]
  if (move && move.step && fighter.onGround) {
    fighter.x += fighter.facing * move.step
  }
  return true
}

/** Which phase of the current action the fighter is in. */
export function phaseOf(fighter) {
  const move = MOVES[fighter.action]
  if (!move) return null
  if (fighter.actionFrame < move.windup) return 'windup'
  if (fighter.actionFrame < move.windup + move.active) return 'active'
  return 'recovery'
}

/**
 * The current attack box in world coordinates, or null when there is none.
 *
 * `height` is the top of the strike band above the floor and `low` the bottom.
 * `range` is measured from the fighter's body EDGE, so the furthest gap a jab
 * connects across is `bodyHalfWidth * 2 + range`.
 */
export function hitboxOf(fighter) {
  const move = MOVES[fighter.action]
  if (!move || phaseOf(fighter) !== 'active') return null
  const top = fighter.y - move.height
  const bottom = fighter.y - (move.low ?? 0)
  const near = fighter.x + fighter.facing * ARENA.bodyHalfWidth
  const far = fighter.x + fighter.facing * (ARENA.bodyHalfWidth + move.range)
  return {
    x: Math.min(near, far),
    y: top,
    w: move.range,
    h: bottom - top,
    damage: move.damage,
    /** The renderer keys the drawn limb off this. */
    move: fighter.action,
  }
}

/**
 * The box incoming attacks are tested against.
 *
 * A downed fighter is a LOW box — you can still hit them, which is what makes
 * a follow-up on a knocked-down opponent land. A juggled body keeps its full
 * height, so a launcher chain can keep connecting.
 */
export function hurtboxOf(fighter) {
  if (fighter.prone) {
    return { x: fighter.x - 40, y: fighter.y - 12, w: 80, h: 12 }
  }
  return {
    x: fighter.x - BODY_HALF_WIDTH,
    y: fighter.y - BODY_HEIGHT,
    w: BODY_HALF_WIDTH * 2,
    h: BODY_HEIGHT,
  }
}

/**
 * Advance one fixed frame. `input` is `{ left, right, jump, jab, kick, sweep,
 * uppercut, retreat, block }` where the booleans mean "held/edge this frame";
 * rising edges are handled by the caller.
 */
export function stepFighter(fighter, input, arena = ARENA) {
  fighter.animFrame += 1

  // A combo is a SEQUENCE, not a tally. If the attacker has not connected for
  // a moment the chain is over and the next hit starts back at full damage.
  // Without this the counter only ever climbs, so the scaling ladder is
  // applied to hits that have nothing to do with each other and a long round
  // drifts permanently into chip damage.
  fighter.sinceHit = Math.min(999, (fighter.sinceHit ?? 999) + 1)
  if (fighter.sinceHit > COMBO_WINDOW_FRAMES) {
    fighter.comboCount = 0
    fighter.lastLanded = null
  }
  // The damage ladder follows the VICTIM, not the attacker: what decays is
  // "how many hits in a row is this body taking", which is the same thing a
  // player reads as "this is a combo".
  fighter.sinceStruck = Math.min(999, (fighter.sinceStruck ?? 999) + 1)
  if (fighter.sinceStruck > COMBO_WINDOW_FRAMES) fighter.hitStreak = 0

  // --- down, then getting up -------------------------------------------
  if (fighter.knockdown > 0) {
    fighter.knockdown -= 1
    fighter.blocking = false
    fighter.prone = fighter.knockdown > KNOCKDOWN_FRAMES - KNOCKDOWN_GROUNDED_FRAMES
    fighter.x += fighter.vx
    fighter.vx *= 0.82
    fighter.x = Math.max(arena.min, Math.min(arena.max, fighter.x))
    if (fighter.knockdown === 0) {
      fighter.prone = false
      fighter.vx = 0
      // Standing back up ends any chain that hit them before they fell.
      fighter.hitStreak = 0
      fighter.sinceStruck = 999
    }
    return fighter
  }

  // --- juggled: airborne, cannot act, can be hit again -------------------
  if (fighter.juggled) {
    fighter.juggleFrames -= 1
    fighter.x += fighter.vx
    fighter.y += fighter.vy
    fighter.vy += JUGGLE_GRAVITY
    fighter.vx *= 0.995
    fighter.blocking = false
    if (fighter.y >= arena.ground || fighter.juggleFrames <= 0) {
      fighter.y = arena.ground
      fighter.vy = 0
      fighter.vx = 0
      fighter.juggled = false
      fighter.onGround = true
      fighter.knockdown = KNOCKDOWN_FRAMES
      fighter.prone = true
      fighter.stagger = 0
    }
    fighter.x = Math.max(arena.min, Math.min(arena.max, fighter.x))
    return fighter
  }

  if (fighter.stagger > 0) {
    fighter.stagger -= 1
    fighter.blocking = false
  } else {
    fighter.blocking = Boolean(input.block) && fighter.action === null && fighter.onGround
  }

  // --- the back-step ----------------------------------------------------
  if (fighter.backStep > 0) {
    fighter.backStep -= 1
    // Horizontal travel happens in the air too: a back-hop `onGround` flag is
    // already false on the frame it starts, so gating this on `onGround` made
    // every hop go straight up and land where it began.
    fighter.x += fighter.vx
    // On the ground it decelerates fast (a shove); in the air it keeps its
    // speed so the hop actually crosses a distance band.
    if (fighter.onGround) fighter.vx *= 0.74
    if (fighter.backStep === 0) fighter.vx = 0
    if (!fighter.onGround) {
      fighter.y += fighter.vy
      fighter.vy += GRAVITY
      fighter.jumpFramesLeft = Math.max(0, fighter.jumpFramesLeft - 1)
      if (fighter.y >= arena.ground) {
        fighter.y = arena.ground
        fighter.vy = 0
        fighter.onGround = true
        fighter.jumpFramesLeft = 0
      }
    }
    fighter.x = Math.max(arena.min, Math.min(arena.max, fighter.x))
    return fighter
  }

  // --- an in-flight attack ----------------------------------------------
  if (fighter.action) {
    const move = MOVES[fighter.action]
    fighter.actionFrame += 1
    // Overextension: a swing that never connected pulls the attacker forward
    // into nothing, and recovering from that is the cost of whiffing. Without
    // it a masher's step keeps it permanently in range and every swing lands.
    if (move && !fighter.hitConsumed && fighter.actionFrame === move.windup + move.active) {
      fighter.x -= fighter.facing * (move.step || 0) * 0.85
    }
    if (fighter.actionFrame >= totalFrames(move, fighter.recoveryBonus || 0)) {
      fighter.action = null
      fighter.actionFrame = 0
      fighter.hitConsumed = false
      fighter.recoveryBonus = 0
      fighter.comboCount = 0
      fighter.lastLanded = null
    }
  }

  // --- movement ----------------------------------------------------------
  const speed = fighter.onGround ? WALK_SPEED : WALK_SPEED * AIR_CONTROL
  let dx = 0
  if (fighter.stagger <= 0 && !fighter.action) {
    if (input.left) dx -= speed
    if (input.right) dx += speed
  }
  // An attack roots a grounded fighter in place; jump momentum is kept.
  if (fighter.onGround && fighter.action) dx *= 0.15
  if (fighter.blocking) dx *= 0.25
  fighter.x += dx

  // --- vertical ----------------------------------------------------------
  if (!fighter.onGround) {
    fighter.y += fighter.vy
    fighter.vy += GRAVITY
    fighter.jumpFramesLeft = Math.max(0, fighter.jumpFramesLeft - 1)
    if (fighter.y >= arena.ground) {
      fighter.y = arena.ground
      fighter.vy = 0
      fighter.onGround = true
      fighter.jumpFramesLeft = 0
    }
  }

  fighter.x = Math.max(arena.min, Math.min(arena.max, fighter.x))
  return fighter
}

/** Knock the fighter back horizontally, clamped to the arena. */
export function applyKnockback(fighter, amount, arena = ARENA) {
  fighter.x = Math.max(arena.min, Math.min(arena.max, fighter.x + amount))
}

/** Put the fighter into hit-stun for `frames`, cancelling any attack. */
export function stagger(fighter, frames = STAGGER_FRAMES) {
  fighter.stagger = Math.max(fighter.stagger, frames)
  fighter.action = null
  fighter.actionFrame = 0
  fighter.hitConsumed = false
  fighter.blocking = false
  fighter.comboCount = 0
}

/**
 * Launch the fighter: they lose their footing and become juggle-able.
 * `vy` negative is up. `vx` is a horizontal push, world units per frame.
 */
export function launch(fighter, { vx = 0, vy = -9 } = {}) {
  fighter.action = null
  fighter.actionFrame = 0
  fighter.stagger = 0
  fighter.blocking = false
  fighter.hitConsumed = false
  fighter.comboCount = 0
  fighter.juggled = true
  fighter.juggleFrames = JUGGLE_MAX_FRAMES
  fighter.onGround = false
  fighter.prone = false
  fighter.knockdown = 0
  fighter.y = Math.min(fighter.y, ARENA.ground) - 1
  fighter.vy = vy
  fighter.vx = vx
}

/**
 * Throw the fighter to the floor.
 *
 * A small `lift` hops them into the fall so the knockdown has an arc instead of
 * snapping flat, which is the difference between "knocked down" and "switched
 * off". The hop uses the juggle integrator, so it lands on its own.
 */
export function knockDown(fighter, { vx = 0, lift = 4 } = {}) {
  fighter.action = null
  fighter.actionFrame = 0
  fighter.stagger = 0
  fighter.blocking = false
  fighter.hitConsumed = false
  fighter.comboCount = 0
  fighter.vy = 0
  fighter.vx = vx
  if (lift > 0) {
    fighter.juggled = true
    fighter.juggleFrames = 12
    fighter.y = ARENA.ground - 1
    fighter.vy = -lift
    fighter.onGround = false
    fighter.prone = false
    fighter.knockdown = 0
  } else {
    fighter.juggled = false
    fighter.onGround = true
    fighter.y = ARENA.ground
    fighter.knockdown = KNOCKDOWN_FRAMES
    fighter.prone = true
  }
}

/** Clear every transient state. Used when a round restarts. */
export function resetFighter(fighter, { x, facing, hp } = {}) {
  if (Number.isFinite(x)) fighter.x = x
  if (facing !== undefined) fighter.facing = facing >= 0 ? 1 : -1
  if (Number.isFinite(hp)) fighter.hp = hp
  fighter.y = ARENA.ground
  fighter.vx = 0
  fighter.vy = 0
  fighter.action = null
  fighter.actionFrame = 0
  fighter.stagger = 0
  fighter.knockdown = 0
  fighter.prone = false
  fighter.juggled = false
  fighter.juggleFrames = 0
  fighter.blocking = false
  fighter.onGround = true
  fighter.jumpFramesLeft = 0
  fighter.backStep = 0
  fighter.hitConsumed = false
  fighter.recoveryBonus = 0
  fighter.comboCount = 0
  fighter.lastLanded = null
  return fighter
}
