/**
 * Opponent AI.
 *
 * The design goal is "a player who fights, not a wall that walks forward".
 * A real opponent does three things this AI had to learn:
 *
 *   1. **It disengages.** After committing to a swing it does not stand there
 *      and it does not grind forward into the player's face: it hops back to a
 *      working distance, then re-reads the gap. Staying glued to the player is
 *      what made the old AI feel like a bumper rather than an opponent.
 *   2. **It presses only on an opening.** It walks in when the player is
 *      recovering, backs off when the player is swinging, and takes a stagger
 *      as a free hit.
 *   3. **It mixes moves.** A jab from close, a kick from mid, a sweep when it
 *      wants a knockdown — chosen off the gap, so the same AI produces a
 *      different-looking exchange at different distances.
 *
 * Two invariants keep a round from deadlocking (both were real bugs found by
 * the balance test):
 *
 *   1. The AI must always move toward the distance where its own attacks can
 *      connect. A "comfort band" it never leaves strands the player at a range
 *      where nothing can land.
 *   2. Guarding is a limited budget, not a stance. The player's state machine
 *      leaves a jab "active" for several frames, so a player mashing J looks
 *      like a constant attack; without a budget the AI would brace forever.
 *
 * `decide(state, dtMs)` is a pure function of its inputs plus the seeded PRNG
 * state, so a fixed seed reproduces a whole fight — that is what makes the
 * "mashing doesn't win" test meaningful.
 */

import { ARENA, MOVES, STANDOFF } from './constants.mjs'

/**
 * Distances here are CENTRE TO CENTRE, which is what `gap` is.
 *
 * `MOVES.jab.range` is measured from the body EDGE outward, so the furthest
 * centre-to-centre gap a jab still reaches is the two hurtboxes plus the
 * reach. Deriving these as `STANDOFF - n` (the old form) silently broke every
 * time the fighters were resized: the AI ended up aiming at a distance its own
 * attack could not cover, and the symptom was an opponent that circled forever
 * and never swung.
 */
/*
 * DISTANCE BANDS, in centre-to-centre units. The design that drives this is
 * the fighting-game "neutral game": the AI's job at every band is different,
 * and the band boundaries are what make it feel like a player rather than a
 * pursuit.
 *
 *   point blank   < PRESSURE      the opponent is on top of it: LEAVE, or guard
 *   strike range  < CLOSE_IN      its own moves reach: attack, or feint
 *   mid range     < FAR           safe: creep in, stall, bait
 *   far           beyond FAR      walk in, rarely rush
 *
 * On a 280-unit figure these are roughly 0.2 / 0.35 / 0.6 / 0.8 of the height.
 */
const STRIKE_RANGE = ARENA.bodyHalfWidth * 2 + MOVES.jab.range
/** Below this the AI is being smothered: escape is the priority. */
const PRESSURE_RANGE = 31
/** Anything above this is "too far to swing": walk in. */
const CLOSE_IN_RANGE = STRIKE_RANGE + 14
/** The safe band: close enough to threaten, far enough not to be hit. */
const MID_RANGE = Math.round(ARENA.bodyHalfWidth * 2 + MOVES.kick.range + 22)
/** Beyond this, a slow approach. */
/** Foe attacks this close are worth dodging rather than blocking. */
const KNOCKOUT_GUARD = CLOSE_IN_RANGE + 10
const FAR_RANGE = MID_RANGE + 45
/**
 * The distance the AI retreats TO after escaping. It is the middle of its own
 * strike band, so it lands where it can attack immediately.
 */
const BACK_OFF_RANGE = Math.round(STRIKE_RANGE * 0.7)

export const AI_PROFILES = Object.freeze({
  easy: Object.freeze({
    attackInterval: [1200, 2000],
    blockChance: 0.25,
    counterChance: 0,
    /** Chance to jab into an opponent's windup, per frame. */
    punishWindup: 0.08,
    /** Easy never punishes an opponent who is already staggered. */
    punishesStagger: false,
    /** A guard lasts at most this long, then the AI must reopen. */
    guardHoldMs: 900,
    guardCooldownMs: 1600,
    /** Chance to hop out after its own swing instead of holding ground. */
    retreatAfterSwing: 0.55,
    /** Chance to hop out when the player is walking in on it. */
    retreatUnderPressure: 0.18,
    /** How long it will hold a distance instead of closing. */
    patienceMs: [260, 620],
    /** Chance, per decision, to escape from point-blank range. */
    pressureEscape: 0.34,
    /** Chance, per decision, to raise a guard instead of escaping. */
    pressureGuard: 0.28,
    /** Chance to step in and out of range without swinging, to bait. */
    feintChance: 0.16,
    /** Chance per frame to hop out of an opponent's windup. */
    evadeChance: 0.045,
    /** Chance, at mid range, to just stand there. */
    stallChance: 0.3,
  }),
  normal: Object.freeze({
    attackInterval: [700, 1300],
    blockChance: 0.45,
    counterChance: 0.3,
    punishWindup: 0.16,
    punishesStagger: true,
    guardHoldMs: 1400,
    guardCooldownMs: 1100,
    retreatAfterSwing: 0.35,
    retreatUnderPressure: 0.3,
    patienceMs: [160, 420],
  }),
})

/** Small deterministic PRNG (xorshift32); seeds are normalised away from zero. */
function createRandom(seed) {
  let state = (Math.floor(Math.abs(seed)) % 0xffffffff) || 0x9e3779b9
  // Scramble the seed first: consecutive seeds otherwise emit highly
  // correlated first values, which makes two "different" fights identical.
  for (let i = 0; i < 8; i++) {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
  }
  return () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

const idleInput = () => ({ left: false, right: false, jump: false, jab: false, kick: false, hook: false, sweep: false, uppercut: false, retreat: false, block: false })

/** First frame index at which `move` has its hitbox out. */
function activeFrom(move) {
  return MOVES[move]?.windup ?? 0
}

/** Walk horizontally toward `targetX`. Selection is exclusive. */
function walkToward(input, selfX, targetX) {
  if (targetX < selfX - 2) input.left = true
  else if (targetX > selfX + 2) input.right = true
}

/** Walk away from `awayX`. */
function walkAway(input, selfX, awayX) {
  if (awayX <= selfX) input.right = true
  else input.left = true
}

/**
 * `state` is `{ self, foe }`, each `{ x, y, facing, action, actionFrame, stagger }`.
 */
export function createAi({ difficulty = 'easy', seed = 1 } = {}) {
  const profile = AI_PROFILES[difficulty] ?? AI_PROFILES.easy
  const random = createRandom(seed)

  let cooldown = 400 + random() * 600
  let nextAttackAt = pickInterval(random, profile)

  /** The AI's own last swing, so it does not press straight out of recovery. */
  let recovering = false

  /**
   * Guard budget. Without this the AI turtles forever against a player who
   * jabs on every frame, and the round deadlocks at full health.
   */
  let guardMs = 0
  let guardCooldownMs = 0

  /**
   * The disengage beat. After its own swing the AI decides whether to hold
   * ground or hop out of range; if it hops, this counts down while it keeps
   * its distance and then it walks back in. Without this it is one continuous
   * forward march, which is the thing that made it feel like a wall.
   */
  let retreatMs = 0
  /** A short "hold this distance" timer used instead of always closing. */
  let patienceMs = 0
  /** What the AI did after its last swing, so the decision is made once. */
  let swungThisSwing = false
  /** An escape scheduled for the first frame the AI is free to take it. */
  let pendingHop = 0
  /** Reset the once-per-swing latch. */
  const endSwing = () => { swungThisSwing = false }

  /**
   * How often the foe has swung recently, measured over a sliding window.
   * A player who throws a strike every few frames is mashing, and mashing
   * must cost something: the AI reads that cadence and answers it with the
   * counter window more aggressively.
   */
  let foePressure = 0
  let lastFoeAction = null

  return {
    profile,
    decide(state, dtMs = 1000 / 60) {
      const input = idleInput()
      const { self, foe } = state
      const gap = Math.abs(foe.x - self.x)

      cooldown += dtMs
      guardCooldownMs = Math.max(0, guardCooldownMs - dtMs)
      guardMs = Math.max(0, guardMs - dtMs)
      // Decrement here, once, at the top: every branch below reads these,
      // and a branch that early-returns must not stop its own timer.
      retreatMs = Math.max(0, retreatMs - dtMs)
      patienceMs = Math.max(0, patienceMs - dtMs)

      // Decay the pressure reading; a strike resets it upward.
      foePressure = Math.max(0, foePressure - dtMs / 900)
      if (foe.action && foe.action !== lastFoeAction) foePressure = Math.min(1, foePressure + 0.34)
      lastFoeAction = foe.action

      // Its own swing: do nothing but keep facing the foe. The state machine
      // advances the frames; the AI only needs to notice when it ended.
      if (self.action) {
        recovering = true
        // Roll ONCE per swing, on its final frame: by then the AI knows whether
        // the exchange went well and how close it ended up. A single roll per
        // swing is what the design asks for — "打完一套必须后撤拉开".
        if (!swungThisSwing && self.actionFrame >= activeFrom(self.action)) {
          swungThisSwing = true
          if (random() < profile.retreatAfterSwing && gap < STRIKE_RANGE + 30) {
            pendingHop = profile.patienceMs[0] + random() * profile.patienceMs[1]
          }
        }
        return input
      }

      if (self.stagger > 0) {
        recovering = false
        return input
      }

      const foeIsAttacking = Boolean(foe.action)
      const foeStaggered = foe.stagger > 0

      // Recovery beat after its own swing. This is where the AI decides to
      // *leave*: a real fighter resets the distance after committing, rather
      // than riding the same exchange until somebody falls over.
      // The swing has cleared: this is the first frame the AI may act again,
      // so an escape queued during the swing can finally be thrown.
      if (recovering) {
        recovering = false
        swungThisSwing = true
        if (pendingHop > 0) {
          if (gap < STRIKE_RANGE + 20) {
            input.retreat = true
            retreatMs = pendingHop
            patienceMs = pendingHop
          }
          pendingHop = 0
          endSwing()
          return input
        }
        if (gap > CLOSE_IN_RANGE) walkToward(input, self.x, foe.x)
        return input
      }

      // Fire the queued escape on the first frame it is legal. (The recovery
      // branch above returns on the frame the queue is set, so this is only
      // reached once the swing has actually cleared.)
      if (pendingHop > 0 && self.action === null && self.onGround && self.stagger <= 0
        && self.knockdown <= 0 && !self.juggled) {
        input.retreat = true
        retreatMs = pendingHop
        patienceMs = pendingHop
        pendingHop = 0
        return input
      }

      const foeInActive = foeIsAttacking && foe.actionFrame >= activeFrom(foe.action)

      // Decision order matters. Attacking first is what keeps the round alive:
      // if bracing were checked first, a player who jabs at any cadence would
      // hold the AI in a guard forever and the fight would stall. So the
      // cooldown gets first refusal, then the punish window, then defence.
      //
      // `owedSwing` uses the comfortable band rather than the narrow strike
      // range: the AI only walks inside `CLOSE_IN_RANGE`, so requiring the
      // tighter number here would park it in a band where it neither closes
      // nor swings — the deadlock this test is guarding against.
      // POINT BLANK comes before the offence decision: when the opponent is
      // on top of it, leaving is the priority. This is the single ordering
      // change that makes "it backs off instead of hugging you" true.
      if (gap < PRESSURE_RANGE) {
        const roll = random()
        if (roll < profile.pressureEscape) {
          input.retreat = true
          retreatMs = profile.patienceMs[0] + random() * profile.patienceMs[1]
          patienceMs = retreatMs
          return input
        }
        if (roll < profile.pressureEscape + profile.pressureGuard && guardCooldownMs <= 0) {
          input.block = true
          guardMs += dtMs
          return input
        }
        if (roll < 0.92) { input.jab = true; return input }
      }

      const owedSwing = cooldown >= nextAttackAt && gap <= CLOSE_IN_RANGE

      if (owedSwing) {
        cooldown = 0
        nextAttackAt = pickInterval(random, profile)
        // Mix the move off the distance, so the same AI produces a jab
        // exchange up close and a kick exchange at range.
        const roll = random()
        if (gap < STRIKE_RANGE - 9) {
          // Close: jab (fast) or a sweep (low, knocks down) or a hook.
          if (roll < 0.5) input.jab = true
          else if (roll < 0.78) input.hook = true
          else input.sweep = true
        } else if (gap < STRIKE_RANGE + 5) {
          // Mid: the kick is the honest option here.
          if (roll < 0.62) input.kick = true
          else if (roll < 0.82) input.hook = true
          else input.jab = true
        } else {
          input.kick = true
        }
        return input
      }

      // Punish a foe who is committed to a swing that has not reached its
      // active frames yet: that is the whole point of windup. A mashed jab
      // always spends frames here, and the more the foe mashes the higher the
      // chance the AI answers — that is what makes timing beat button speed.
      // EVADE A WINDING-UP ATTACK. The opponent's startup frames are the
      // window to get out: a hop back is safe, a block is not (a block still
      // pays chip and keeps you in the pressure).
      if (foeIsAttacking && !foeInActive && gap <= KNOCKOUT_GUARD && random() < profile.evadeChance) {
        input.retreat = true
        retreatMs = profile.patienceMs[0]
        patienceMs = retreatMs
        return input
      }

      const punishChance = profile.punishWindup * (1 + foePressure * 4)
      if (foeIsAttacking && !foeInActive && gap <= STRIKE_RANGE && random() < punishChance) {
        // Answer with a launcher or the longer kick: both are the payoff for
        // reading an attack. The uppercut starts the juggle that normal's
        // profile can then press.
        if (gap < STRIKE_RANGE - 10 && random() < 0.45) input.uppercut = true
        else input.kick = true
        return input
      }

      // Brace against an incoming swing from close in. A guard only pays off
      // against a swing that is actually in its active window: bracing through
      // someone's windup would let them wind up forever for free.
      if (foeIsAttacking && gap < STANDOFF + 18 && guardMs < profile.guardHoldMs && guardCooldownMs <= 0) {
        if (random() < profile.blockChance + 0.5) {
          input.block = true
          guardMs += dtMs
          if (guardMs >= profile.guardHoldMs) guardCooldownMs = profile.guardCooldownMs
          return input
        }
      }

      // Counter window: only the normal profile takes it.
      if (foeStaggered && profile.punishesStagger && random() < profile.counterChance) {
        if (gap > CLOSE_IN_RANGE) walkToward(input, self.x, foe.x)
        else input.jab = true
        return input
      }

      // --- spacing policy: four bands, each with its own job -----------
      //
      // Disengaging: keep the distance it just created, but only until it is
      // back in its strike band. A retreat that runs to the wall is as bad as
      // one that never happens.
      if (retreatMs > 0) {
        if (gap < BACK_OFF_RANGE) walkAway(input, self.x, foe.x)
        else if (gap > CLOSE_IN_RANGE) walkToward(input, self.x, foe.x)
        return input
      }

      // POINT BLANK. This is the band the design is most explicit about: an
      // AI being smothered leaves, it does not stand there trading. A back-hop
      // is the escape — it clears ground instantly and its landing recovery is
      // the punish for spamming it.
      if (gap < PRESSURE_RANGE) {
        const roll = random()
        if (roll < profile.pressureEscape) {
          input.retreat = true
          retreatMs = profile.patienceMs[0] + random() * profile.patienceMs[1]
          patienceMs = retreatMs
          return input
        }
        if (roll < profile.pressureEscape + profile.pressureGuard && guardCooldownMs <= 0) {
          input.block = true
          guardMs += dtMs
          return input
        }
        // Otherwise take the risky counter-swing; a fighter cornered does not
        // politely wait to be beaten.
        if (roll < 0.97) { input.jab = true; return input }
      }

      // STRIKE RANGE. It can hit from here, so this is where the pressure and
      // the feints live.
      if (gap <= CLOSE_IN_RANGE) {
        // Too deep in its own band: recover the spacing first.
        if (gap < BACK_OFF_RANGE) { walkAway(input, self.x, foe.x); return input }

        // FEINT / DISENGAGE. At its own strike range the AI alternates between
        // threatening and giving ground. A hop is the strong version — it
        // crosses the whole band — and a short stall is the weak one.
        const roll = random()
        if (roll < profile.feintChance * 0.5) {
          input.retreat = true
          retreatMs = profile.patienceMs[0]
          patienceMs = retreatMs
          return input
        }
        if (roll < profile.feintChance) {
          patienceMs = 80 + random() * 140
          return input
        }
        // FILL THE COOLDOWN. Between swings the AI must be doing something —
        // shuffling in, drifting out, or holding — because standing still in
        // striking distance is exactly what lets a masher connect every swing.
        if (gap < BACK_OFF_RANGE + 3) { walkAway(input, self.x, foe.x); return input }
        if (gap > BACK_OFF_RANGE + 26) { walkToward(input, self.x, foe.x); return input }
        // In the sweet spot: shuffle on the spot by alternating a half-step.
        walkAway(input, self.x, foe.x)
        return input
      }

      // MID RANGE. The neutral game: close slowly, sometimes not at all.
      if (gap <= MID_RANGE) {
        if (patienceMs > 0) return input
        if (random() < profile.stallChance) {
          patienceMs = profile.patienceMs[0] + random() * profile.patienceMs[1]
          return input
        }
        walkToward(input, self.x, foe.x)
        return input
      }

      // FAR. Walk in. Never rush from here — a dash from full screen is a
      // readable, punishable commitment.
      if (gap <= FAR_RANGE) {
        walkToward(input, self.x, foe.x)
        return input
      }
      walkToward(input, self.x, foe.x)

      return input
    },
  }
}

function pickInterval(random, profile) {
  const [min, max] = profile.attackInterval
  return min + random() * (max - min)
}
