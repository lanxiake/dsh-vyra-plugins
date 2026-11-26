/**
 * DEPRECATED — superseded by js/rig.js and js/render.js.
 *
 * This is the previous engine: keyframed pose tables and axis-aligned hit
 * boxes. It is kept only because the older test suite still exercises it;
 * nothing in the shipped bundle imports this file. New work belongs in js/.
 */

/**
 * dsh-boot-duel — the figure rig.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The first version posed fighters with `if (actionFrame < 4) arm = [..]`
 * literal coordinates: three frozen key poses per move, no interpolation,
 * no reach limit, and feet that slid because the body was translated as a
 * whole. That reads as a puppet, not as a fighter.
 *
 * This rig follows the approach of the MIT "stickman" film engine
 * (github.com/krishnagoswami52/stickman-skill — methods only, no art reused):
 *
 *   - every joint is derived from keyframed angles, so a move is a curve
 *     through coil -> contact -> settle rather than three stills;
 *   - hands and feet are placed by two-bone IK, so a reach is a reach and the
 *     limb cannot stretch past its own length;
 *   - the figure is drawn as tapered capsules, which hold their weight at
 *     small sizes where a 5px stroke washes out.
 *
 * COORDINATES. Rig units are y-DOWN-NEGATIVE and the origin sits on the
 * ground between the feet: `footY = 0`, `hipY = -212`, `crown ≈ -664`. The
 * arena's ground line is `ARENA.ground`, and the renderer translates by
 * `fighter.y` once. The previous version mixed a +485 "stand height" with a
 * +235 hip, which put the soles 156 world units below the ground line — the
 * legs were simply never on screen.
 *
 * Nothing here touches the DOM, so `node --test` can evaluate a pose.
 */

/** Rig units. An upright figure is 640 units from sole to crown. */
export const RIG = Object.freeze({
  /**
   * Rig units -> world units.
   *
   * The figure is 640 rig units tall. At 0.1095 that is a 70-unit body on the
   * 400-unit arena — a small figure with a lot of room around it, which is the
   * framing the fight wants: the stage reads as a space, not a backdrop, and
   * the two of them can circle each other instead of filling the shot.
   *
   * (History: 0.205 was tried once and read as puppets because the RIG was
   * misproportioned, not because it was small. With the joint heights fixed —
   * legs 54% of the body, head 1/5 — the small figure is the right one.)
   */
  scale: 0.1095,

  /*
   * HEIGHTS. `y` is up-negative and the sole is at 0, so the crown is -640.
   * The fractions are the measured row profile of the reference figure:
   * head 0-20%, neck 20-25%, torso 25-46%, legs 46-100%.
   *
   *   crown            -640
   *   head centre      -575   (radius 65 -> head spans -640..-510)
   *   neck joint       -510
   *   shoulder/chest   -480   (top of the torso)
   *   hip              -346   (the legs are 54% of the figure)
   *   sole                0
   */
  headCenterY: -575,
  neckY: -510,
  shoulderY: -480,
  hipY: -346,

  /** Head radius: 0.102 of 640, a true circle. */
  headRadius: 65,

  /** Half the shoulder span. The reference torso is one stroke wide. */
  shoulderHalf: 34,
  /** Half the hip span. */
  hipHalf: 20,

  /**
   * Bone lengths. The legs must reach the floor at the WIDEST stance, not just
   * straight down: the hip sits 346 up and the feet sit `stance` apart, so a
   * planted leg needs `thigh + shin >= hypot(stance, 346)` = 377. 200 + 190 =
   * 390 clears it, and the surplus is what the knee folds up in a wide stance.
   *
   * The arms sum to 172 against a 210-unit torso, which is the reference's
   * reach and keeps a straight-armed punch from looking telescopic.
   */
  upperArm: 90,
  foreArm: 82,
  thigh: 200,
  shin: 190,

  /**
   * Half-distance between the two feet in a neutral stance.
   *
   * Measured off the reference figure: its two feet sit 152px apart on a
   * 304px figure — HALF the body height. On a 640-unit rig that is 320 across,
   * so `stance` (the half-distance) is 160.
   *
   * The legs are 356 long and the hip sits 346 up, so a foot this far out is at
   * `hypot(160, 346) = 381` — just past the leg's reach. The IK resolves that
   * by folding the knees, and the figure settles into a wide, weight-down
   * stance with its feet still on the floor. That is the pose the reference
   * stands in, and `poseJoints` clips the foot inward by only a few units to
   * keep it reachable.
   */
  stance: 150,
})

/* ------------------------------------------------------------- easing ---- */

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
/** Smoothstep — the default ease between keyframes. */
export const ease = (t) => { const x = clamp(t); return x * x * (3 - 2 * x) }
export const easeIn = (t) => clamp(t) ** 3
/** Fast out, slow in: the shape of a strike arriving. */
export const easeOut = (t) => 1 - (1 - clamp(t)) ** 3
/** Anticipate, then overshoot — used for recoil and cloth. */
export const easeBack = (t) => {
  const x = clamp(t)
  const c = 1.70158
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
}
/** Step: hold the previous key until the next one lands. Anime pose-holds. */
const easeHold = () => 0

const EASINGS = { ease, in: easeIn, out: easeOut, back: easeBack, hold: easeHold }

/**
 * `kf(t, [[time, value], ...])` — smooth interpolation between scalar keys.
 *
 * A key may carry a third element naming its easing (`'out'`, `'in'`,
 * `'back'`, `'hold'`). The ease applies to the segment *arriving* at that key,
 * which is how a strike gets its snap: `'out'` front-loads the motion so the
 * limb is already there two frames after the swing starts, and `'hold'` keeps
 * the previous pose until the contact frame rather than drifting toward it.
 */
export function kf(t, keys, fn = ease) {
  if (keys.length === 0) return 0
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [t0, v0] = keys[i - 1]
      const [t1, v1, name] = keys[i]
      const span = t1 - t0
      const curve = name ? EASINGS[name] ?? fn : fn
      return lerp(v0, v1, span <= 0 ? 1 : curve((t - t0) / span))
    }
  }
  return keys[keys.length - 1][1]
}

/**
 * `kfVec(t, [[time, [x, y]], ...])` — the same curve for a point.
 *
 * Kept separate from `kf`: a scalar interpolator handed a pair returns the
 * whole array at a key and a NaN between them, which is exactly how a
 * charging fighter once vanished in the middle of the finisher.
 */
export function kfVec(t, keys, fn = ease) {
  const mix = (i) => {
    const [t0, a] = keys[i - 1]
    const [t1, b, name] = keys[i]
    const span = t1 - t0
    const curve = name ? EASINGS[name] ?? fn : fn
    const k = span <= 0 ? 1 : curve((t - t0) / span)
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
  }
  if (keys.length === 0) return [0, 0]
  if (t <= keys[0][0]) return [...keys[0][1]]
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) return mix(i)
  }
  return [...keys[keys.length - 1][1]]
}

/* ------------------------------------------------------------------ IK ---- */

/**
 * Two-bone IK. Returns the elbow/knee and the reachable hand/foot, plus how
 * far the target was out of reach (`over`) — the renderer uses that to draw a
 * strained limb rather than a stretched one.
 *
 * `dir` is +1 or -1 and picks which way the joint bends (elbows down, knees
 * forward). This is what stops a limb from folding backwards.
 */
export function solveIK(origin, target, a, b, dir) {
  let dx = target[0] - origin[0]
  let dy = target[1] - origin[1]
  let d = Math.hypot(dx, dy)
  const reach = a + b - 0.5
  let end = target
  if (d > reach) {
    dx *= reach / d
    dy *= reach / d
    d = reach
    end = [origin[0] + dx, origin[1] + dy]
  }
  // A target exactly on the joint makes `d` zero and the angle undefined.
  // Nudge it out along +x so the limb folds instead of vanishing.
  if (d < 1e-6) {
    dx = 1
    dy = 0
    d = 1
    end = [origin[0] + dx, origin[1] + dy]
  }
  d = Math.max(d, Math.abs(a - b) + 1)
  // Floating point puts this a hair outside 0..1 often enough that acos
  // returns NaN — the bug that made a charging fighter disappear.
  const toJ = a * a + d * d - b * b
  const fromO = 2 * a * d
  const raw = fromO === 0 ? 1 : toJ / fromO
  const cos = raw > 1 ? 1 : raw < -1 ? -1 : raw
  const angle = Math.atan2(dy, dx) + dir * Math.acos(cos)
  return {
    joint: [origin[0] + Math.cos(angle) * a, origin[1] + Math.sin(angle) * a],
    end,
    over: Math.max(0, Math.hypot(target[0] - origin[0], target[1] - origin[1]) - reach),
  }
}

/* --------------------------------------------------------------- poses ---- */

/**
 * A move is a table of keyframes. Times are relative to the move's start, in
 * seconds, and are independent of the fixed-step simulation: the renderer maps
 * `actionFrame` onto this clock, so a 60 Hz step and a 144 Hz display read the
 * same pose at the same instant.
 *
 * Angles are degrees (positive = leaning toward `facing`). `hand` and
 * `backHand` are points in shoulder space: +x forward, +y down. `kickFoot` is
 * a point in hip space. `lunge` pushes the front foot forward, `crouch` folds
 * the knees, `stanceWidth` widens the base.
 *
 * Space available, on the 640-unit figure: the arm reaches 180 units from the
 * shoulder and the leg 346 from the hip. Every target below stays inside those
 * numbers on purpose — a keyframe past the reach gets clamped by the IK and
 * the limb stops reading as the same limb from frame to frame.
 *
 * THE RULE THAT MAKES THIS READ AS A FIGHT rather than as a mime: every
 * striking pose commits the whole body. In the reference (BV1mg41127tC) nobody
 * punches from a standing shoulder — the hip travels, the spine tips well past
 * 20 degrees, the back leg trails, and the back arm swings out as a
 * counterweight. A punch drawn from the shoulder alone is a gesture; a punch
 * drawn from the floor is a hit.
 *
 * Frame tables in `sim/constants.mjs`: jab 4/3/7, kick 8/4/12, special 16/8/26
 * at 60 Hz.
 */
export const MOVES_RIG = Object.freeze({
  jab: {
    total: 14,
    hand: [
      [0.000, [136, 128]],
      // Coil: the fist pulls back a hand's width, the shoulder loads.
      [0.045, [22, 74], 'out'],
      // Contact: shoulder, hip and spine all arrive together. 200 rig units
      // forward of the shoulder is outside the arm's 172 reach, so the IK
      // clamps it to a fully straight arm — which is exactly the pose a punch
      // should end in.
      [0.075, [200, -10], 'out'],
      // Hold the contact two frames — this is the frame the eye remembers.
      [0.115, [204, -6], 'hold'],
      [0.190, [84, 44]],
      [0.233, [136, 128]],
    ],
    backHand: [
      [0.000, [-118, 126]],
      [0.045, [-96, 128], 'out'],
      [0.075, [-156, 92], 'out'],
      [0.115, [-160, 88], 'hold'],
      [0.233, [-118, 126]],
    ],
    lean: [[0, 4], [0.045, -9, 'out'], [0.075, 20, 'out'], [0.115, 18, 'hold'], [0.190, 9], [0.233, 4]],
    hipShift: [[0, 0], [0.045, -13, 'out'], [0.075, 24, 'out'], [0.115, 22, 'hold'], [0.190, 6], [0.233, 0]],
    /** The front foot plants forward: the punch is a step, not a wave. */
    lunge: [[0, 0], [0.045, -8, 'out'], [0.075, 30, 'out'], [0.115, 28, 'hold'], [0.233, 0]],
    crouch: [[0, 0], [0.075, 16], [0.115, 13], [0.233, 0]],
    /** The back leg trails and its heel peels off the floor. */
    backFootLift: [[0, 0], [0.075, 46, 'out'], [0.115, 42, 'hold'], [0.233, 0]],
  },
  kick: {
    total: 24,
    hand: [
      [0.000, [136, 128]],
      [0.100, [12, 24]],
      [0.140, [-34, -20]],
      [0.200, [-70, -52]],
      [0.250, [-46, 4]],
      [0.400, [136, 128]],
    ],
    backHand: [
      [0.000, [-118, 126]],
      [0.100, [-96, -6]],
      [0.200, [-140, -52]],
      [0.250, [-104, 12]],
      [0.400, [-118, 126]],
    ],
    lean: [[0, 4], [0.100, -16], [0.155, -30], [0.200, -38], [0.250, -22], [0.400, 4]],
    hipShift: [[0, 0], [0.100, -16], [0.200, -26], [0.400, 0]],
    /**
     * The kicking foot in hip space, where +y points *down* toward the floor
     * (the direction an animator draws in). The hip sits 346 rig units above
     * the sole, so a planted foot is `[34, 350]`.
     *
     * The extension target is the one that has to be right: a foot at
     * `[325, 126]` lands 220 rig units above the floor, which is inside the
     * kick's 240..110 strike band. An earlier version aimed at `[286, -122]`,
     * i.e. 122 units *above* the hip and 468 above the floor — the leg
     * extended horizontally past the fighter's own head, which is why the
     * sheet showed a kick drawn as a line across the crown.
     *
     * Reach: `hypot(325, 126) = 349` against a 356-unit leg, so the shin is
     * nearly straight at full extension, as a committed kick should be.
     */
    kickFoot: [
      [0.000, [34, 350]],
      // Chamber: the heel comes up beside the hip, knee leading.
      [0.100, [24, 130, 'out']],
      [0.155, [96, 88, 'out']],
      // Extension: the leg drives out level with the waist.
      [0.200, [325, 126, 'out']],
      [0.245, [318, 118, 'hold']],
      [0.330, [78, 250]],
      [0.400, [34, 350]],
    ],
    /** The planted leg folds as the kicking leg rises. */
    plantBend: [[0, 0], [0.100, 24], [0.200, 40], [0.330, 14], [0.400, 0]],
    lunge: [[0, 0], [0.100, -8], [0.200, -14], [0.400, 0]],
    leanBack: [[0, 0], [0.200, 24], [0.400, 0]],
  },
  special: {
    /** The finisher: a long, readable charge, one cut, a proud settle. */
    total: 50,
    hand: [
      // Charge: both hands pull back past the shoulder, high and tight.
      [0.000, [136, 128]],
      [0.130, [-40, -20]],
      [0.230, [-84, -60]],
      [0.270, [-78, -72, 'hold']],
      // The cut: the blade comes down through the whole arc.
      [0.300, [110, -30, 'out']],
      [0.340, [170, 40, 'out']],
      [0.380, [174, 54, 'hold']],
      // Settle.
      [0.560, [92, 56]],
      [0.720, [56, 62]],
      [0.833, [136, 128]],
    ],
    backHand: [
      [0.000, [-118, 126]],
      [0.130, [-86, -16]],
      [0.230, [-126, -52]],
      [0.270, [-120, -62, 'hold']],
      [0.300, [84, -24, 'out']],
      [0.340, [152, 44, 'out']],
      [0.380, [156, 58, 'hold']],
      [0.560, [56, 62]],
      [0.833, [-118, 126]],
    ],
    /**
     * The charge tips the spine back only as far as a fighter can actually
     * lean — around 20 degrees. An earlier table used -42, which the sheet
     * showed as a figure falling over backwards; the body has to stay stacked
     * over its own feet or the pose reads as a stumble, not a wind-up.
     */
    lean: [[0, 4], [0.230, -16], [0.270, -20, 'hold'], [0.310, 40, 'out'], [0.380, 34, 'hold'], [0.560, 14], [0.833, 4]],
    /** Feet planted wide; the whole body sinks during the charge. */
    crouch: [[0, 0], [0.200, 62], [0.270, 76, 'hold'], [0.310, 34, 'out'], [0.400, 38], [0.620, 12], [0.833, 0]],
    stanceWidth: [[0, 46], [0.200, 74], [0.270, 80], [0.340, 68], [0.560, 54], [0.833, 46]],
    lunge: [[0, 0], [0.270, -22], [0.310, 62, 'out'], [0.380, 56, 'hold'], [0.560, 24], [0.833, 0]],
    footLift: [[0, 0], [0.270, 0], [0.310, 14], [0.400, 0]],
  },
  /** Staggered: doubled over, one hand clutching, head thrown back. */
  /**
   * Staggered, taking it in the BODY: doubled over, arms flung wide and loose.
   * The head does not snap back — that is the head-shot pose below.
   */
  stagger: {
    // Loose, not stacked: a reeling fighter's arms fall open, they do not
    // fold into a neat guard at the chin.
    hand: [[0, [116, 150]], [0.5, [92, 132]]],
    backHand: [[0, [-104, 140]], [0.5, [-84, 126]]],
    lean: [[0, -22], [0.5, -14]],
    hipShift: [[0, -16], [0.5, -10]],
    crouch: [[0, 26], [0.5, 18]],
    stanceWidth: [[0, 130], [0.5, 116]],
  },
  /**
   * Blocking: forearms up in front of the chest, weight back, chin tucked.
   *
   * The hands sit in FRONT of the shoulder (+x, in shoulder space) and just
   * below head height. Hands drawn above the shoulder (`y` negative) put the
   * forearms across the face, and the sheet showed a block pose with the head
   * completely hidden behind its own arms.
   */
  /**
   * Staggered by a HEAD shot: the skull snaps back, the spine arches away
   * from the blow, the arms fly up. This is the pose that reads as a knockout
   * punch even when the health bar barely moves.
   */
  staggerHead: {
    hand: [[0, [-100, 40]], [0.5, [-80, 70]]],
    backHand: [[0, [-150, 60]], [0.5, [-120, 80]]],
    // The spine bends BACK, away from the strike.
    lean: [[0, -48], [0.5, -30]],
    hipShift: [[0, -26], [0.5, -16]],
    crouch: [[0, 10], [0.5, 6]],
    stanceWidth: [[0, 140], [0.5, 126]],
  },
  /**
   * Staggered by a LEG shot: the knee buckles, the body folds DOWN and
   * forward, both hands drop toward the struck leg.
   */
  staggerLegs: {
    hand: [[0, [130, 230]], [0.5, [110, 200]]],
    backHand: [[0, [-70, 220]], [0.5, [-58, 190]]],
    lean: [[0, 46], [0.5, 34]],
    hipShift: [[0, 10], [0.5, 6]],
    crouch: [[0, 120], [0.5, 84]],
    stanceWidth: [[0, 150], [0.5, 138]],
  },
  block: {
    // Forearms up across the chest, hands at chin height. `y` is measured
    // DOWN from the shoulder, so a small positive value is just below it:
    // `[96, 46]` is a little forward and a little below, which puts the
    // guard in front of the chest instead of over the head.
    hand: [[0, [96, 46]]],
    backHand: [[0, [58, 58]]],
    lean: [[0, -6]],
    hipShift: [[0, -8]],
    crouch: [[0, 14]],
    stanceWidth: [[0, 120]],
  },
  jump: {
    hand: [[0, [58, 4]], [0.5, [40, -28]]],
    backHand: [[0, [-56, 14]], [0.5, [-38, -18]]],
    crouch: [[0, 48], [0.5, 62]],
  },

  /*
   * The extended vocabulary. The shapes below are the standard fighting-game
   * archetypes, drawn so they read at a glance:
   *
   *   hook    - the fist swings round the guard, so the wind-up is lateral
   *   sweep   - the whole body drops and one leg scythes along the floor
   *   uppercut- the body drives UP through the target
   *   kickUp  - the juggle follow-up: a rising kick into an airborne body
   *   airKick - both legs trail, one drives down
   *   downed  - face-down on the floor
   *   getUp   - pushing up off the floor, one knee under the body
   *   juggled - thrown: limbs trailing, body bent back by the hit
   *   backStep- the disengage: weight on the back leg, hands up
   */
  hook: {
    total: 20,
    hand: [
      [0.000, [136, 128]],
      // The hook coils ACROSS the body: the fist goes back and out.
      [0.075, [-40, 60], 'out'],
      [0.115, [-70, 30], 'out'],
      // ...then swings round through the far side of the target's guard.
      [0.160, [168, -30, 'out']],
      [0.200, [178, -12, 'hold']],
      [0.300, [104, 60]],
      [0.400, [136, 128]],
    ],
    backHand: [
      [0.000, [-118, 126]],
      [0.075, [-120, 110], 'out'],
      [0.160, [-168, 74], 'out'],
      [0.200, [-172, 70], 'hold'],
      [0.400, [-118, 126]],
    ],
    lean: [[0, 4], [0.075, -10], [0.160, 26], [0.200, 24], [0.400, 4]],
    hipShift: [[0, 0], [0.075, -18], [0.160, 30], [0.200, 28], [0.400, 0]],
    lunge: [[0, 0], [0.075, -12], [0.160, 40], [0.200, 38], [0.400, 0]],
    crouch: [[0, 0], [0.160, 18], [0.400, 0]],
  },
  /**
   * The sweep: the fighter drops onto the back leg and the front leg scythes
   * along the floor. The pose is LOW - the hip drops almost to the ground and
   * the head to knee height - because that silhouette is what tells the player
   * "this one goes under your guard".
   */
  sweep: {
    total: 36,
    hand: [
      [0.000, [136, 128]],
      // Down and out. The hand plants for balance, like a breakdance floor
      // sweep, which is the shape everyone recognises as a sweep.
      [0.120, [150, 210], 'out'],
      [0.200, [176, 246], 'hold'],
      [0.320, [150, 210]],
      [0.600, [136, 128]],
    ],
    backHand: [
      [0.000, [-118, 126]],
      [0.120, [-140, 190], 'out'],
      [0.200, [-150, 220], 'hold'],
      [0.600, [-118, 126]],
    ],
    lean: [[0, 4], [0.120, 38], [0.200, 48], [0.320, 40], [0.600, 4]],
    /** The hips drop: a sweep is all crouch. */
    crouch: [[0, 0], [0.120, 96], [0.200, 110], [0.320, 92], [0.600, 0]],
    hipShift: [[0, 0], [0.120, 26], [0.200, 34], [0.600, 0]],
    stanceWidth: [[0, 150], [0.200, 190], [0.600, 150]],
    /** The scything leg swings out along the floor. */
    // In hip space, +y is down. The crouch puts the hip ~50 units off the
    // floor, so the scything foot rides at y ~= 40 and sweeps outward for the
    // reach. Aiming at y=336 (the normal leg length) drove the foot a metre
    // through the floor and the silhouette read as standing.
    // In hip space, +y is DOWN. From the deep crouch the hip is only ~330 rig
    // units off the floor, so a foot at y = 250 rides just above the ground.
    // The x target has to clear the body by a wide margin or the pose reads as
    // a crouch instead of a sweep.
    // In hip space, +y is DOWN. The crouch leaves the hip only ~55 rig units
    // off the floor, so a foot that stays ON the floor is at y ≈ 55, and a
    // fully straightened leg reaches x ≈ 376. Any larger y drives the foot
    // through the floor; any smaller x leaves the knee folded and the pose
    // reads as a crouch rather than a sweep.
    // Hip space, +y down. With the hip 320 rig units up, a foot ON the floor
    // is at y = 320, and the leg reaches x = 187 there — so the sweep is a
    // nearly straight leg lying along the ground, which is exactly what the
    // move is.
    // With the hip 346-110 = 236 rig units up, a foot ON the floor is at
    // y = 236 and the leg reaches x = 339 there — most of its length laid
    // flat, which is the sweep.
    kickFoot: [
      [0.000, [150, 350]],
      [0.120, [190, 236], 'out'],
      [0.200, [330, 232], 'hold'],
      [0.320, [220, 250]],
      [0.600, [150, 350]],
    ],
    plantBend: [[0, 0], [0.200, 40], [0.600, 0]],
  },
  /**
   * The uppercut: the body uncoils upward, the striking fist rises through
   * where the target's chin was. It is the launcher, so the silhouette ends
   * tall and extended, not folded.
   */
  uppercut: {
    total: 36,
    hand: [
      [0.000, [136, 128]],
      // Coil down.
      [0.100, [40, 200], 'out'],
      [0.150, [10, 230], 'hold'],
      // Drive up through the target.
      [0.230, [96, -170], 'out'],
      [0.265, [104, -196], 'hold'],
      [0.420, [80, -40]],
      [0.600, [136, 128]],
    ],
    backHand: [
      [0.000, [-118, 126]],
      [0.100, [-90, 190], 'out'],
      [0.150, [-80, 210], 'hold'],
      [0.230, [-70, 70], 'out'],
      [0.600, [-118, 126]],
    ],
    lean: [[0, 4], [0.100, 20], [0.230, -22], [0.265, -26], [0.600, 4]],
    /** Down, then UP: the hips travel further than the fist. */
    crouch: [[0, 0], [0.100, 120], [0.150, 140], [0.230, -70], [0.265, -90], [0.600, 0]],
    hipShift: [[0, 0], [0.100, -12], [0.230, 30], [0.600, 0]],
    lunge: [[0, 0], [0.230, 26], [0.600, 0]],
    /** The front heel lifts as the body rises. */
    footLift: [[0, 0], [0.230, 40], [0.400, 0]],
  },
  /**
   * The juggle follow-up: a rising kick into a body that is already falling.
   * Short, fast, and it leans back because the weight is going up.
   */
  kickUp: {
    total: 22,
    hand: [
      [0.000, [136, 128]],
      [0.100, [30, 60], 'out'],
      [0.220, [-50, 10]],
      [0.400, [136, 128]],
    ],
    backHand: [
      [0.000, [-118, 126]],
      [0.100, [-130, 40], 'out'],
      [0.400, [-118, 126]],
    ],
    lean: [[0, 4], [0.100, -16], [0.220, -28], [0.400, 4]],
    kickFoot: [
      [0.000, [34, 350]],
      [0.100, [80, 180], 'out'],
      // Straight up through the falling body.
      [0.160, [120, -150], 'out'],
      [0.220, [128, -190], 'hold'],
      [0.400, [34, 350]],
    ],
    leanBack: [[0, 0], [0.220, 20], [0.400, 0]],
  },
  /** The air kick: both legs trail behind, one drives down and forward. */
  airKick: {
    total: 20,
    hand: [
      [0.000, [80, 20]],
      [0.090, [60, -40], 'out'],
      [0.220, [40, -60], 'hold'],
      [0.400, [80, 20]],
    ],
    backHand: [
      [0.000, [-70, 20]],
      [0.090, [-90, -40], 'out'],
      [0.400, [-70, 20]],
    ],
    lean: [[0, 12], [0.090, 26], [0.220, 30], [0.400, 12]],
    kickFoot: [
      [0.000, [40, 250]],
      [0.090, [130, 280], 'out'],
      [0.150, [220, 300], 'hold'],
      [0.400, [40, 250]],
    ],
    crouch: [[0, 40], [0.400, 40]],
  },
  /**
   * Downed: face-down on the floor. The rig's y=0 is the sole line, so a body
   * lying down is drawn by dropping the hip almost to the floor and pushing
   * everything forward.
   */
  downed: {
    hand: [[0, [150, 330]]],
    backHand: [[0, [-120, 320]]],
    lean: [[0, 84]],
    crouch: [[0, 300]],
    hipShift: [[0, 40]],
    stanceWidth: [[0, 120]],
  },
  /** Getting up: one knee under the body, one hand pushing off the floor. */
  getUp: {
    hand: [[0, [150, 260]]],
    backHand: [[0, [-60, 160]]],
    lean: [[0, 46]],
    crouch: [[0, 190]],
    hipShift: [[0, 24]],
    stanceWidth: [[0, 110]],
  },
  /** Juggled: thrown, limbs trailing, the spine bent back by the blow. */
  juggled: {
    hand: [[0, [-70, 40]]],
    backHand: [[0, [-120, 90]]],
    lean: [[0, -34]],
    crouch: [[0, 40]],
    stanceWidth: [[0, 120]],
    footLift: [[0, 60]],
    backFootLift: [[0, 50]],
  },
  /** The disengage: weight back, hands up, one foot lifting off. */
  backStep: {
    hand: [[0, [110, 60]]],
    backHand: [[0, [-90, 80]]],
    lean: [[0, -14]],
    crouch: [[0, 24]],
    stanceWidth: [[0, 110]],
  },
})

/** Which pose table a fighter is currently in. */
export function poseFor(fighter) {
  // Body states first, and in the order that matters: a body on the floor is
  // not "staggered", and a launched body is not "jumping".
  if (fighter.knockdown > 0) return fighter.prone ? 'downed' : 'getUp'
  if (fighter.juggled) return 'juggled'
  if (fighter.stagger > 0) {
    // The reaction depends on WHERE it landed — a head shot and a leg shot
    // are different poses, which is the whole point of tracking the zone.
    if (fighter.hitZone === 'head') return 'staggerHead'
    if (fighter.hitZone === 'legs') return 'staggerLegs'
    return 'stagger'
  }
  if (fighter.action && MOVES_RIG[fighter.action]) return fighter.action
  if (fighter.blocking) return 'block'
  if (fighter.backStep > 0) return 'backStep'
  if (fighter.onGround === false) return 'jump'
  return null
}

/**
 * Seconds into the current action. `actionFrame` is in 60 Hz frames; the rig
 * clock is authored in seconds, so this is the one conversion in the rig.
 */
export function actionTime(fighter) {
  return Math.max(0, fighter.actionFrame) / 60
}

/**
 * Build the joint table for one fighter at a point in time.
 *
 * Returns local-space points for every joint the renderer needs, relative to
 * the fighter's own (x, y) with the soles on y = 0. `facing` is applied by
 * mirroring the x axis, so the same pose table serves both sides.
 */
export function poseJoints(fighter, { time = 0, breathing = 0 } = {}) {
  const facing = fighter.facing >= 0 ? 1 : -1
  const kind = poseFor(fighter)
  const staticPose = kind === 'block' || kind === 'stagger' || kind === 'staggerHead' || kind === 'staggerLegs'
  const t = kind && !staticPose ? actionTime(fighter) : 0
  const table = kind ? MOVES_RIG[kind] : null

  // Base stance: a slight fighting crouch, hands low and forward.
  let crouch = 3
  let stanceWidth = RIG.stance
  let lean = 4
  let hipShift = 0
  let lunge = 0
  let footLift = 0
  let backFootLift = 0
  let kickFoot = null
  let plantBend = 0
  let leanBack = 0
  // Hands hang low, around the hips, with the elbows a little bent — the
  // reference's fighters stand in a loose ready stance, not a boxing guard.
  // Hands in shoulder space: +y is down, so `150` puts them just below the
  // hip line (the hip is 141 rig units below the shoulder) and `hypot(60,150)
  // = 161` stays inside the arm's 172-unit reach.
  //
  // Everything that starts or ends near neutral uses this same pair, so a
  // move returns to the stance it left from.
  let hand = [136, 128]
  let backHand = [-118, 126]

  if (table) {
    if (table.hand) hand = kfVec(t, table.hand)
    if (table.backHand) backHand = kfVec(t, table.backHand)
    if (table.lean) lean = kf(t, table.lean)
    if (table.hipShift) hipShift = kf(t, table.hipShift)
    if (table.footLift) footLift = kf(t, table.footLift)
    if (table.backFootLift) backFootLift = kf(t, table.backFootLift)
    if (table.crouch) crouch = kf(t, table.crouch) + 3
    if (table.stanceWidth) stanceWidth = kf(t, table.stanceWidth)
    if (table.lunge) lunge = kf(t, table.lunge)
    if (table.kickFoot) kickFoot = kfVec(t, table.kickFoot)
    if (table.plantBend) plantBend = kf(t, table.plantBend)
    if (table.leanBack) leanBack = kf(t, table.leanBack)
  }

  // Breathing lifts the chest a hair; the ready stance must not be a statue.
  const breath = Math.sin(time / 0.9) * 2.2 + breathing * 3
  const hipY = RIG.hipY + crouch - breath * 0.5
  const hip = [hipShift, hipY]

  // The spine tips about the hip. Everything above is derived from it, so a
  // lean carries the shoulders, neck, head and both arms with it.
  //
  // y is up-negative, so a height is `lower - higher`; writing it the other
  // way round gives a negative length, `Math.max(0, …)` flattens it to zero,
  // and the whole upper body collapses onto the hips. That is the exact bug
  // that once left a fighter as a torso-less pair of legs.
  const upright = hipY - RIG.shoulderY
  const rad = (lean * Math.PI) / 180
  const chest = [hip[0] + Math.sin(rad) * upright, hip[1] - Math.cos(rad) * upright]
  const neckLen = RIG.shoulderY - RIG.neckY
  const neck = [chest[0] + Math.sin(rad) * neckLen, chest[1] - Math.cos(rad) * neckLen]
  const headLen = RIG.neckY - RIG.headCenterY
  const head = [neck[0] + Math.sin(rad) * headLen, neck[1] - Math.cos(rad) * headLen]

  // Shoulders sit either side of the chest, perpendicular to the spine.
  // Perpendicular to (sin r, -cos r) is (cos r, sin r); that second component
  // is what makes the back shoulder sit slightly *above* the front one in a
  // forward lean, which is the depth cue that reads as a body rather than a
  // flat X.
  const perp = [Math.cos(rad), Math.sin(rad)]
  const shoulderFront = [
    chest[0] + facing * perp[0] * RIG.shoulderHalf,
    chest[1] + facing * perp[1] * RIG.shoulderHalf,
  ]
  const shoulderBack = [
    chest[0] - facing * perp[0] * RIG.shoulderHalf,
    chest[1] - facing * perp[1] * RIG.shoulderHalf,
  ]

  // Feet. A kick replaces the front foot with a target in hip space, where
  // **+y points down toward the floor** — the direction an animator thinks in.
  // World y here is up-negative, so "down" is also +y and the offset adds.
  // (Subtracting it flips the leg upward: that produced a fighter whose kick
  // planted its foot 156 units above the ground.)
  const footFrontY = -footLift
  let footFront = [stanceWidth + lunge, footFrontY]
  if (kickFoot) {
    footFront = [hip[0] + kickFoot[0] * facing, hip[1] + kickFoot[1]]
  }
  const footBack = [-stanceWidth + lunge * 0.35, -backFootLift + plantBend * 0.35]

  // Arms: the hand targets are in shoulder space, mirrored by facing.
  const handTarget = [shoulderFront[0] + hand[0] * facing, shoulderFront[1] + hand[1]]
  const backTarget = [shoulderBack[0] + backHand[0] * facing, shoulderBack[1] + backHand[1]]

  const frontArm = solveIK(shoulderFront, handTarget, RIG.upperArm, RIG.foreArm, facing)
  const backArm = solveIK(shoulderBack, backTarget, RIG.upperArm, RIG.foreArm, facing)
  const frontLeg = solveIK(hip, footFront, RIG.thigh, RIG.shin, -facing)
  const backLeg = solveIK(hip, footBack, RIG.thigh, RIG.shin, -facing)

  // Everything above is authored in rig units; the solo scale conversion is
  // here, so a pose table never has to think about how tall the arena is.
  const s = RIG.scale
  const scaled = (p) => [p[0] * s, p[1] * s]

  return {
    kind,
    facing,
    scale: s,
    /** Head radius in world units, so the renderer never guesses. */
    headRadius: RIG.headRadius * s,
    /** How far the spine tipped from vertical, in degrees (renderer uses it
     * to lay the silhouette's weight). */
    tilt: lean - leanBack,
    hip: scaled(hip),
    chest: scaled(chest),
    neck: scaled(neck),
    head: scaled(head),
    shoulderFront: scaled(shoulderFront),
    shoulderBack: scaled(shoulderBack),
    elbowFront: scaled(frontArm.joint),
    handFront: scaled(frontArm.end),
    elbowBack: scaled(backArm.joint),
    handBack: scaled(backArm.end),
    kneeFront: scaled(frontLeg.joint),
    footFront: scaled(frontLeg.end),
    kneeBack: scaled(backLeg.joint),
    footBack: scaled(backLeg.end),
    /** How far the front hand was out of reach; drawn as a strained fist. */
    strain: frontArm.over * s,
    airborne: !fighter.onGround,
    defeated: fighter.hp <= 0,
  }
}

/** Convert a rig joint to world coordinates for a fighter standing at (x, y). */
export function toWorld(joints, fighter, point) {
  return [fighter.x + point[0], fighter.y + point[1]]
}
