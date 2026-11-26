/**
 * Frame table and arena constants.
 *
 * Everything here is in 60 Hz frames: the fight simulation always steps at a
 * fixed rate, so these values mean the same thing on a 30 Hz display and a
 * 144 Hz one.
 *
 * MOVE DESIGN. The vocabulary follows the standard archetypes a fighting game
 * is built from, because they map one-to-one onto what a player can read:
 *
 *   - **fast, low commitment** (jab) — pokes, starts pressure, chains into
 *     more jabs;
 *   - **mid** (hook, kick) — the damage, with a real recovery to punish;
 *   - **sweep** (sweep) — reaches low, knocks the far fighter off their feet;
 *   - **launcher** (uppercut) — puts them in the air, so the next hit lands on
 *     a target that cannot block;
 *   - **follow-ups** (kickUp, airKick) — what a combo is made of.
 *
 * Frame data is the tempo. `windup` is startup (nothing can hit yet),
 * `active` is the window where the strike can connect, `recovery` is the
 * commitment the attacker pays whether or not it landed. A move that lands
 * additionally costs `HIT_RECOVERY_FRAMES`, which is what stops a mash from
 * being an infinite loop.
 */

/**
 * `range` is measured from the fighter's BODY EDGE (see `hitboxOf`), not from
 * the centre. `height`/`low` are the top and bottom of the strike band above
 * the floor. `knock` is the launching impulse applied on a clean hit; a `knock`
 * with positive `y` (down) and a `knockdownLift` above zero throws the target
 * into a knockdown instead of a stagger.
 */
export const MOVES = Object.freeze({
  // The figures stand 280 world units tall (70% of the 400-unit arena),
  // matching the reference art's own figure-to-stage ratio. The chest is
  // ~270 above the floor and the waist ~170.
  //
  // Two bodies collide at `bodyHalfWidth * 2 = 32` apart, so the reach here is
  // the extra distance past that: a jab connects across a gap of up to 82.
  jab: Object.freeze({
    windup: 3, active: 3, recovery: 6,
    damage: 6, range: 13, height: 69, low: 38,
    /** Chip of forward travel; a punch is also a step. */
    step: 2,
    /** Shortest it can be cancelled into another move after it lands. */
    cancelFrom: 3,
  }),
  /**
   * A hook: slower than the jab, swings around the guard, and the strike band
   * is wide enough to catch a crouching opponent.
   */
  hook: Object.freeze({
    windup: 8, active: 4, recovery: 12,
    damage: 11, range: 17, height: 72, low: 31,
    step: 4,
    cancelFrom: 8,
  }),
  kick: Object.freeze({
    windup: 8, active: 4, recovery: 16,
    damage: 13, range: 23, height: 61, low: 28,
    step: 3,
    cancelFrom: 8,
  }),
  /**
   * A low sweep: reaches further than a kick and knocks the target down. Its
   * strike band starts near the floor, so an opponent who is braced high does
   * not block it.
   */
  sweep: Object.freeze({
    windup: 11, active: 5, recovery: 20,
    damage: 9, range: 26, height: 25, low: 0,
    step: 4.5,
    /** Clean hit puts them on the ground. */
    knockdown: true,
    knockdownLift: 2.1,
    cancelFrom: 0,
  }),
  /**
   * An uppercut: the launcher. A grounded hit flings the target UP, where
   * they cannot block and the next hit lands free — the start of a combo.
   */
  uppercut: Object.freeze({
    windup: 9, active: 5, recovery: 26,
    damage: 11, range: 12, height: 84, low: 31,
    step: 3,
    /** Negative y is up. */
    launch: -5.75,
    /** Knockback (x) on a launch. */
    launchX: 1.6,
    cancelFrom: 0,
  }),
  /**
   * Kick a downed or airborne opponent back up: the juggle link. Short and
   * fast, it exists to be cancelled into from `uppercut`, not to be thrown
   * from neutral.
   */
  kickUp: Object.freeze({
    windup: 4, active: 4, recovery: 14,
    damage: 8, range: 15, height: 59, low: 23,
    step: 2,
    launch: -4.25,
    launchX: 1.2,
    /** Only usable on a target that is already off the ground. */
    airOnly: true,
    cancelFrom: 0,
  }),
  /**
   * A jumping downward kick: hits high-to-low, and counts as an overhead
   * because it is thrown while airborne.
   */
  airKick: Object.freeze({
    windup: 3, active: 6, recovery: 10,
    damage: 12, range: 15, height: 82, low: 31,
    step: 0,
    knockdown: true,
    knockdownLift: 1.7,
    cancelFrom: 0,
    /** Only legal while airborne. */
    aerial: true,
  }),
  /**
   * The finishing art (大招). Long windup the player has to earn, a wide
   * active window, and damage that ends a fight the player was already
   * winning. The windup is the price: it cannot be thrown from neutral
   * because it needs a full meter, and being interrupted wastes it.
   */
  special: Object.freeze({
    windup: 16, active: 8, recovery: 26,
    damage: 26, range: 42, height: 84, low: 8,
    step: 12,
    knockdown: true,
    knockdownLift: 3.25,
    cancelFrom: 0,
  }),
})

/** Moves the player can throw, and what each input means. */
export const INPUT_MOVES = Object.freeze({
  jab: 'jab',
  kick: 'kick',
  sweep: 'sweep',
  uppercut: 'uppercut',
})

/**
 * COMBO SCALING. Every hit after the first in a chain does less damage:
 * 100%, 85%, 72%, 61%, 52%... The reason every fighting game does this is
 * that a combo's reward is the ENTERTAINMENT of the chain plus one opening,
 * not "first player to touch wins". Without scaling a 5-hit chain does 5x one
 * hit and the round is over in three seconds — which is exactly what happened
 * when the chain was first added.
 */
export const COMBO_DAMAGE_SCALE = Object.freeze([1, 0.85, 0.72, 0.62, 0.55, 0.5, 0.46, 0.44])

/**
 * The deepest a chain can go before the next cancel is refused entirely. Three
 * links (jab -> hook -> uppercut -> juggle = four) is the ceiling: long enough
 * to feel like a combo, short enough that one opening is a big hit and not a
 * round.
 */
export const MAX_COMBO_LINKS = 3

/**
 * How long a chain survives without a connection. A combo is defined by
 * CONTINUED CONTACT: land, and the next hit is the second link; miss for a
 * third of a second and you are starting over. Without this the depth counter
 * never resets and the damage ladder decays forever.
 */
export const COMBO_WINDOW_FRAMES = 34

/**
 * The combo ladder. A landed move can be cancelled into any of these, but only
 * once per gate, so a chain has a shape instead of being a repeat of one
 * button:
 *
 *   jab -> jab -> hook -> uppercut -> kickUp -> airKick
 *
 * `MOVES.jab.cancelFrom` etc. give the earliest frame a cancel may happen on.
 * A cancel resets the attacker's frame counter but does NOT reset
 * `comboCount`, so the HUD can count the chain.
 */
export const COMBO_CHAIN = Object.freeze({
  jab: ['jab', 'hook', 'uppercut', 'kick'],
  hook: ['uppercut', 'sweep', 'kick'],
  kick: ['uppercut', 'sweep'],
  sweep: [],
  uppercut: ['kickUp', 'airKick'],
  kickUp: ['airKick'],
  airKick: [],
  special: [],
})

/**
 * The qi meter (气). Landing a strike charges it; taking one charges a little
 * too, so a player who is being beaten does not stay locked out of their own
 * finisher forever. A full meter is the only way to throw the special.
 */
export const METER = Object.freeze({
  max: 100,
  /** Per clean hit the player lands. */
  gainHit: 16,
  gainBlocked: 6,
  /** Per hit the player eats: the comeback valve. */
  gainTaken: 9,
  /** A landed special drains the whole meter. */
  spend: 100,
  /** Falling below this after a special is the normal starting point. */
  start: 0,
})

/** Both fighters start here; "empty the bar" is the only pass condition. */
export const MAX_HP = 100

/** The player is never judged defeated: health floors at 1. */
export const PLAYER_HP_FLOOR = 1

/** Blocking soaks 80% of incoming damage, rounding to the nearest point. */
export const BLOCK_REDUCTION = 0.8

/** A staggered opponent opens the counter window. */
export const COUNTER_DAMAGE = 14
export const STAGGER_FRAMES = 26

/**
 * Knockdown: a fighter thrown off their feet is out of the fight for this many
 * frames while they hit the floor and push back up. It is deliberately longer
 * than a stagger — that is the reward for landing a sweep or an overhead.
 */
export const KNOCKDOWN_FRAMES = 46
/** Frames of a knockdown spent lying on the floor before the get-up starts. */
export const KNOCKDOWN_GROUNDED_FRAMES = 26

/**
 * Airborne: a launched fighter is not "falling", they are in a juggle state
 * that runs until they land. `JUGGLE_GRAVITY` is lighter than the fighters'
 * own gravity so a launched body hangs a beat longer and the follow-up has a
 * window.
 */
export const JUGGLE_GRAVITY = 0.46
/** Frames a juggled body stays hittable before it can no longer be re-launched. */
export const JUGGLE_MAX_FRAMES = 46

/**
 * Extra recovery frames a fighter pays for a clean hit. This is the pacing
 * valve: without it a jab loops every 14 frames and empties a 100 HP bar in
 * under two seconds, which makes both timing and the opponent irrelevant.
 */
export const HIT_RECOVERY_FRAMES = 16

/**
 * How long after a move CONNECTS before it may be cancelled into the next
 * link of a chain. This is the pacing valve for combos: it makes a chain read
 * as a sequence of separate committed swings rather than one instant blur,
 * and it is what keeps a single opening from deleting a whole health bar.
 */
export const CANCEL_DELAY_FRAMES = 2

/** Jump keeps the fighter airborne for 24 frames. */
export const JUMP_FRAMES = 24

/** Bigger numbers pop: the KO hit is a slow-motion window in milliseconds. */
export const KO_SLOW_MS = 900
export const KO_TOTAL_MS = 1500
export const KO_FADE_MS = 400
export const KO_FLASH_MS = 120
export const KO_TIME_SCALE = 0.25
export const REDUCED_TIME_SCALE = 0.5

/**
 * Hit-stop: the whole simulation freezes for a few dozen milliseconds the
 * instant a strike lands. It is the single cheapest trick that makes a hit
 * read as *heavy* rather than as a number changing — the eye registers the
 * freeze before it registers the damage. A clean hit stops longer than a
 * guard, and a counter stops longest.
 */
export const HIT_STOP_MS = { hit: 62, counter: 104, blocked: 34, ko: 200 }

/** Impact slow-motion: a short scale dip after a heavy connect. */
export const IMPACT_SLOW_MS = 110
export const IMPACT_SLOW_SCALE = 0.55

/** The opening stance: the fight cannot start until the player says so. */
export const READY = Object.freeze({
  /** Frames of the fighters settling into stance before the frame is live. */
  introFrames: 24,
})

/** Simulation rate. Never tie this to the display refresh rate. */
export const FIXED_STEP_MS = 1000 / 60

/** Horizontal reach the AI keeps between itself and the player. */
export const STANDOFF = 20

/**
 * World coordinates are 960x400 "design pixels"; the renderer scales the
 * canvas to fit the viewport so the arena looks the same on any window size.
 */
export const ARENA = Object.freeze({
  width: 960,
  height: 400,
  /** Walkable floor band. */
  min: 130,
  max: 830,
  /** Y of the ground plane (fighters stand with their feet here). */
  ground: 310,
  /**
   * Fighter collision half-width. The reference figures are one limb-stroke
   * wide — about 17px on a 304px figure, i.e. 0.056 of the height. On our
   * 280-unit figure that is ~16 units.
   */
  bodyHalfWidth: 5,
})

/**
 * Per-frame movement speeds.
 *
 * The back-step is deliberately faster than the forward walk and covers more
 * ground, because the reference's fights are built on *disengaging*: a fighter
 * who is losing an exchange leaps back out of it rather than grinding forward.
 * A retreat that is slower than the approach is a retreat nobody uses.
 */
export const WALK_SPEED = 1.7
export const BACK_STEP_SPEED = 2.6
/** Frames a back-step takes to play out before the fighter can act again. */
export const BACK_STEP_FRAMES = 12
/** A back-hop covers this much air time and this much distance. */
export const BACK_HOP_VELOCITY = -3.8
export const BACK_HOP_DRIFT = 3.75
export const AIR_CONTROL = 0.25
export const GRAVITY = 0.31
export const JUMP_VELOCITY = -4.1

/**
 * Knockback applied on a clean hit, scaled by damage.
 *
 * The push is deliberately larger than the walk speed: a landed hit creates
 * space the attacker has to close again, which is what stops a mash from
 * chaining hits back to back and what makes each clean strike feel earned.
 */
export const KNOCKBACK = 4.5

/**
 * Input buffer: a move pressed within this many frames of becoming legal is
 * remembered and fires on the first legal frame. Without it every combo in
 * `COMBO_CHAIN` is unreachable, because a human cannot press on the exact
 * frame recovery ends.
 */
export const INPUT_BUFFER_FRAMES = 7
