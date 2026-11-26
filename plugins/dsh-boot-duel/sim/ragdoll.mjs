/**
 * Ragdoll: six point masses (head, torso, two arms, two legs) held together by
 * distance constraints and integrated with Verlet.
 *
 * Verlet rather than forces because it stays stable at 60 Hz with six
 * constraint iterations, and because "position" is all the renderer needs.
 * The whole thing is a plain data structure with no DOM and no classes, so the
 * KO sequence can be unit-tested headlessly.
 */

import { ARENA } from './constants.mjs'

const GRAVITY = 0.31
const DAMPING = 0.995
const BOUNCE = 0.22
const FRICTION = 0.82
const ITERATIONS = 6
/** Nothing sensible exceeds this; clamping keeps NaN and infinities out. */
const MAX_IMPULSE = 120

/**
 * Rest lengths for a fighter about 88 design pixels tall, laid out relative to
 * the torso. Keyed by the constraint name so the renderer can draw limbs.
 */
const LIMB_PLAN = [
  { name: 'head', ox: 0, oy: -46, length: 18 },
  { name: 'armL', ox: -20, oy: -22, length: 22 },
  { name: 'armR', ox: 20, oy: -22, length: 22 },
  { name: 'legL', ox: -12, oy: 26, length: 26 },
  { name: 'legR', ox: 12, oy: 26, length: 26 },
]

function clampImpulse(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-MAX_IMPULSE, Math.min(MAX_IMPULSE, value))
}

function point(x, y, vx = 0, vy = 0) {
  // Verlet stores the previous position, which is where velocity comes from.
  return { x, y, px: x - clampImpulse(vx), py: y - clampImpulse(vy) }
}

/**
 * Build a ragdoll at (x, y) — the fighter's feet position — flying in the
 * direction of `impulse` (`{ x, y }` in pixels per frame).
 */
export function createRagdoll({ x, y, facing = 1, impulse = { x: 0, y: 0 } }) {
  const originY = y - 44 // torso center, halfway up an 88px body
  const dirX = clampImpulse(impulse.x) * (facing >= 0 ? 1 : 1)
  const dirY = clampImpulse(impulse.y)

  // Spread the impulse over the joints with a little spin: the head lags the
  // torso, the legs whip forward. This is what makes the fling look thrown
  // rather than slid.
  const points = [
    { name: 'torso', ...point(x, originY, dirX, dirY) },
  ]
  const constraints = []
  for (const [index, limb] of LIMB_PLAN.entries()) {
    const spin = (index % 2 === 0 ? 1 : -1) * 0.35
    const lag = limb.name === 'head' ? 0.6 : 1
    points.push({
      name: limb.name,
      ...point(x + limb.ox, originY + limb.oy, dirX * lag + spin * 2, dirY * lag + spin),
    })
    constraints.push({
      a: 0,
      b: points.length - 1,
      length: Math.hypot(limb.ox, limb.oy),
      name: limb.name,
    })
  }

  // Cross-brace the body so it folds instead of turning inside out. Braces are
  // soft: they shape the body, they do not define a limb's length, so they are
  // corrected at partial strength and never fight the limb constraints.
  const index = (name) => points.findIndex((p) => p.name === name)
  constraints.push(
    { a: index('armL'), b: index('armR'), length: 34, name: 'shoulders', stiffness: 0.25 },
    { a: index('legL'), b: index('legR'), length: 20, name: 'hips', stiffness: 0.25 },
    { a: index('head'), b: index('armL'), length: 30, name: 'neckL', stiffness: 0.25 },
  )

  return { points, constraints, restTimer: 0 }
}

function solveConstraints(ragdoll, iterations) {
  const { points, constraints } = ragdoll
  // Jacobi-style relaxation converges slowly on a body this tangled (arms and
  // legs share the torso), so weights are biased toward the smaller "external"
  // joints: that is what keeps limbs at their rest length while the torso
  // takes most of the correction. Six passes then land inside 1px.
  const weight = (index) => (index === 0 ? 0.25 : 0.75)
  for (let pass = 0; pass < iterations; pass++) {
    for (const constraint of constraints) {
      const a = points[constraint.a]
      const b = points[constraint.b]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy)
      if (distance === 0 || !Number.isFinite(distance)) continue
      const stiffness = constraint.stiffness ?? 1
      const difference = ((distance - constraint.length) / distance) * stiffness
      const total = weight(constraint.a) + weight(constraint.b)
      const offsetX = dx * difference / total
      const offsetY = dy * difference / total
      a.x += offsetX * weight(constraint.a)
      a.y += offsetY * weight(constraint.a)
      b.x -= offsetX * weight(constraint.b)
      b.y -= offsetY * weight(constraint.b)
    }
  }
}

/**
 * Advance one fixed frame. Points are integrated, relaxed, then pushed out of
 * the floor; friction bleeds horizontal speed on contact.
 */
export function stepRagdoll(ragdoll, { ground = ARENA.ground, iterations = ITERATIONS } = {}) {
  for (const p of ragdoll.points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      // Recover rather than propagate: a broken ragdoll must not freeze the
      // KO sequence or the page.
      p.x = Number.isFinite(p.px) ? p.px : ARENA.width / 2
      p.y = Number.isFinite(p.py) ? p.py : ground
    }
    const vx = (p.x - p.px) * DAMPING
    const vy = (p.y - p.py) * DAMPING
    p.px = p.x
    p.py = p.y
    p.x += vx
    p.y += vy + GRAVITY
  }

  solveConstraints(ragdoll, iterations)

  for (const p of ragdoll.points) {
    if (p.y > ground) {
      p.y = ground
      // Bounce a little, then settle: py is pulled toward y so the next
      // derived velocity points up by only BOUNCE.
      p.py = p.y + (p.py - p.y) * -BOUNCE
      // Friction on horizontal travel.
      p.px = p.x - (p.x - p.px) * FRICTION
    }
    // Keep the body inside the arena walls.
    const minX = ARENA.min - 40
    const maxX = ARENA.max + 40
    if (p.x < minX) {
      p.x = minX
      p.px = p.x + (p.px - p.x) * -0.3
    } else if (p.x > maxX) {
      p.x = maxX
      p.px = p.x + (p.px - p.x) * -0.3
    }
  }
}

/** Is everything effectively still? Used to stop spending frames on physics. */
export function ragdollAtRest(ragdoll) {
  const speed = Math.max(...ragdoll.points.map((p) => Math.hypot(p.x - p.px, p.y - p.py)))
  // Only the rigid limb segments are expected to hold; the soft braces shape
  // the silhouette and are free to stretch while the body lies on the floor.
  const stretched = ragdoll.constraints
    .filter((constraint) => (constraint.stiffness ?? 1) === 1)
    .some((constraint) => {
      const a = ragdoll.points[constraint.a]
      const b = ragdoll.points[constraint.b]
      return Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - constraint.length) > 1
    })
  return speed < 0.08 && !stretched
}

/** Plain serialisable copy for the renderer and for tests. */
export function ragdollSnapshot(ragdoll) {
  return {
    points: ragdoll.points.map((p) => ({ x: p.x, y: p.y, px: p.px, py: p.py, name: p.name })),
    constraints: ragdoll.constraints.map((c) => [c.a, c.b]),
  }
}
