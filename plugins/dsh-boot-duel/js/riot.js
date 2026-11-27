/**
 * 工位暴走 — the workdesk riot.
 *
 * The chosen finisher: the player does not throw a punch, they empty their OWN
 * desk onto the opponent — keyboard first, then the mug, then the monitor, then
 * the chair — and sign the whole thing with a 「已驳回」 work-order stamp.
 *
 * WHY ITS OWN MODULE. Every other effect in `effects.js` draws one frame from
 * one snapshot. This one is a TIMELINE: positions and rotations are a pure
 * function of elapsed milliseconds, so the demo can scrub to any beat, the
 * engine can stop time mid-swing, and a dropped frame cannot desync an object
 * from the hit it is supposed to land.
 *
 * The objects are drawn in the same flat two-tone office palette as the room,
 * so a flying monitor reads as furniture that got thrown rather than as a
 * sprite from another game.
 */

import { drawImpact } from './effects.js'

const TAU = Math.PI * 2
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, k) => a + (b - a) * k
const easeIn = (k) => k * k
const easeOut = (k) => 1 - (1 - k) * (1 - k)

/*
 * The timeline.
 *
 * Three beats of the finisher are authored here rather than in `arena.js`,
 * because they are the same three ideas every fighting game's super uses:
 *
 *   charge  the world stops and the move arms itself. Nothing has been thrown
 *           yet; the freeze IS the first hit. The furniture lifts off the desk
 *           in a staggered ring so the player can read what is about to happen.
 *   strike  the release. Objects leave in order of weight, lightest first, so
 *           the LAST projectile is the biggest.
 *   impact  the victim takes them one after another, then the verdict lands.
 *           Debris that does not disappear is what makes the aftermath read as
 *           a wrecked workstation rather than as four separate hits.
 *
 * The numbers here are the timetable the whole effect runs on; `arena.js` feeds
 * them the cinematic's own clock, and the demo scrubs them directly.
 */
export const RIOT = Object.freeze({
  /**
   * The move's name, as the player approved it: the workdesk riot staging with
   * the existing 破军 title. The concept is 「工位暴走」; the banner says 破军.
   */
  name: '破 军',
  /** Stamped onto the victim on the impact beat. */
  stamp: '已驳回',
  /** Beat boundaries, in ms from the cinematic's first frame. */
  chargeEnd: 420,
  nameEnd: 940,
  strikeEnd: 1240,
  impactEnd: 1700,
  end: 2040,
  /**
   * When the stamp slams down, and when the debris explodes.
   *
   * Both sit INSIDE the impact beat, after the chair has arrived — the verdict
   * is the last thing that happens, not something that lands while furniture is
   * still in the air.
   */
  stampAt: 1560,
  debrisAt: 1500,
})

/**
 * The four projectiles, in throw order.
 *
 * The sequence is a crescendo by design: the keyboard tick, the mug clank, the
 * monitor crash, then the chair — which does not get thrown but swung round,
 * so the last beat is a swing rather than a fourth projectile. When it lands
 * the victim is launched; that is the KO-scale burst in `drawRiot`.
 */
const THROWS = [
  { kind: 'keyboard', home: [232, 228], launch: 950, flight: 200, arc: 30, spin: 2.2, fall: 300 },
  { kind: 'mug', home: [262, 222], launch: 1000, flight: 220, arc: 52, spin: 3.4, fall: 280 },
  { kind: 'monitor', home: [206, 190], launch: 1060, flight: 280, arc: 66, spin: 0.7, fall: 330 },
  /**
   * The chair is the ONE object timed to the swing.
   *
   * `superMove` has its active window at 0.56–0.72 of a 0.95 s move, and the
   * move is released on the strike beat (940 ms), so the hit lands at about
   * 1472 ms. The chair therefore ARRIVES there: 1220 + 252. Its flight is
   * also the longest, so the eye reads the biggest object moving the slowest
   * — the crescendo the sequence is built for.
   */
  { kind: 'chair', home: [300, 252], launch: 1220, flight: 252, arc: 128, spin: 1.15, fall: 380 },
]

const COL = {
  dark: '#2f3742',
  mid: '#4b5563',
  screen: '#8fb8c9',
  glow: '#c9e6f0',
  paper: '#fdfefb',
  line: '#8c949f',
  red: '#c8321e',
  hot: '#ffc400',
}

/* --------------------------------------------------------------- timeline --- */

/**
 * Build the riot for a given pair.
 *
 * `player` and `enemy` only need `{ x, y }` (the feet); every other anchor —
 * the raised fist, the enemy's chest, where a monitor settles — is derived
 * here, so the effect follows the fight rather than a fixed pixel grid.
 */
export function createRiot({ player, enemy, groundY = 300, face = 1 }) {
  const fist = [player.x + 22 * face, player.y - 108]
  const chest = [enemy.x - 10 * face, enemy.y - 94]
  const head = [enemy.x - 4 * face, enemy.y - 132]
  const gut = [enemy.x + 2 * face, enemy.y - 76]

  /**
   * Where each object waits in the ring above the fist, and where it lands.
   *
   * The slots are laid out on an actual circle rather than hand-placed, so
   * the charge reads as a ring of debris orbiting the raised hand whatever the
   * fighters' positions were when the super started.
   */
  const slot = (i, n, radius) => {
    const a = -Math.PI * 0.95 + (i / n) * Math.PI * 1.9
    return [fist[0] + Math.cos(a) * radius, fist[1] + Math.sin(a) * radius * 0.8]
  }
  const TARGETS = [chest, head, gut, gut]
  const SETTLE = [
    [enemy.x + 40 * face, groundY - 8, 0.55],
    [enemy.x + 74 * face, groundY - 7, 1.75],
    [enemy.x + 8 * face, groundY - 18, 0.14],
    [enemy.x - 30 * face, groundY - 14, -1.42],
  ]

  const items = THROWS.map((spec, i) => {
    const radius = spec.kind === 'monitor' ? 64 : spec.kind === 'chair' ? 78 : 54
    return {
      ...spec,
      order: i,
      slot: slot(i, THROWS.length, radius),
      to: TARGETS[i],
      settle: SETTLE[i],
      phase: i * 1.7,
      scale: 1,
    }
  })

  return {
    t: 0,
    anchors: { fist, enemy: [enemy.x, enemy.y], face, groundY },
    items,
    debris: buildDebris(enemy, face),
  }
}

/** Advance the timeline. The engine calls this once per simulation step. */
export function stepRiot(riot, dtSec) {
  riot.t += dtSec * 1000
  return riot
}

/**
 * The burst of office debris thrown off the impact point.
 *
 * Deterministic: each shard's velocity is derived from its index, so the same
 * impact looks identical in every round and a screenshot taken today still
 * matches the one in the docs.
 */
function buildDebris(enemy, face) {
  const out = []
  const ox = enemy.x + 6 * face
  const oy = enemy.y - 88
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + 0.3
    const sp = 120 + ((i * 53) % 9) * 34
    out.push({
      x: ox, y: oy,
      vx: Math.cos(a) * sp + 90 * face,
      vy: Math.sin(a) * sp - 210,
      size: 3 + ((i * 29) % 5) * 1.6,
      spin: (i % 2 ? 1 : -1) * (2 + (i % 4)),
      kind: i % 5 === 0 ? 'paper' : 'shard',
    })
  }
  return out
}

/* ---------------------------------------------------------------- sampling --- */

function arrived(item) {
  return item.launch + item.flight
}

/** Where one object is at time `t`, as `{ x, y, rot, scale, alpha, phase }`. */
export function sampleItem(item, t) {
  const out = {
    kind: item.kind,
    x: item.home[0], y: item.home[1],
    rot: 0, scale: 1, alpha: 1,
    /** charge | held | fly | fall | rest */
    phase: 'rest',
  }

  // --- the charge: pulled off the desk toward the raised fist -----------
  if (t < item.launch) {
    /**
     * The lift is STAGGERED so the ring assembles instead of appearing whole:
     * the keyboard is up almost at once, the chair trails in last. The stagger
     * is a fixed fraction of the charge beat, not its own timer, so retiming
     * the cinematic retimes the lift with it.
     */
    const order = item.order
    const liftAt = RIOT.chargeEnd * 0.1 + order * RIOT.chargeEnd * 0.2
    const liftEnd = RIOT.nameEnd - 70
    const k = easeOut(clamp01((t - liftAt) / Math.max(1, liftEnd - liftAt)))
    out.x = lerp(item.home[0], item.slot[0], k)
    out.y = lerp(item.home[1], item.slot[1], k) - Math.sin(k * Math.PI) * 26
    out.rot = k * (item.kind === 'monitor' ? 0.12 : 0.55) * (order % 2 ? -1 : 1)
    out.scale = 1 + k * 0.16
    out.phase = k > 0.985 ? 'held' : 'charge'
    if (out.phase === 'held') {
      // Hovering: a shallow bob and a slow tilt, so the ring of objects looks
      // suspended rather than frozen.
      out.y += Math.sin(t * 0.011 + item.phase) * 3.2
      out.rot += Math.sin(t * 0.008 + item.phase) * 0.14
    }
    return out
  }

  // --- the throw --------------------------------------------------------
  const end = arrived(item)
  if (t < end) {
    const p = clamp01((t - item.launch) / item.flight)
    const e = easeIn(p)
    out.x = lerp(item.slot[0], item.to[0], e)
    out.y = lerp(item.slot[1], item.to[1], e) - Math.sin(Math.PI * p) * item.arc
    out.rot = p * item.spin * TAU
    out.scale = 1.16 + p * 0.22
    out.phase = 'fly'
    return out
  }

  // --- the fall: it does not vanish on contact, it drops -----------------
  const q = clamp01((t - end) / item.fall)
  const f = easeIn(q)
  out.x = lerp(item.to[0], item.settle[0], f)
  out.y = lerp(item.to[1], item.settle[1], f)
  out.rot = lerp(item.spin * TAU, item.settle[2], f)
  out.scale = lerp(1.38, 1, q)
  out.phase = q >= 1 ? 'rest' : 'fall'
  return out
}

/** How lit an impact burst is at `t`: 1 at arrival, 0 after 200 ms. */
function burst(item, t) {
  const end = arrived(item)
  const d = t - end
  if (d < 0 || d > 200) return 0
  return 1 - d / 200
}

/* ------------------------------------------------------------------ drawing --- */

function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.lineTo(x + w - k, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + k)
  ctx.lineTo(x + w, y + h - k)
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h)
  ctx.lineTo(x + k, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - k)
  ctx.lineTo(x, y + k)
  ctx.quadraticCurveTo(x, y, x + k, y)
  ctx.closePath()
}

function drawKeyboard(ctx) {
  ctx.fillStyle = COL.dark
  rr(ctx, -24, -9, 48, 18, 2.5)
  ctx.fill()
  ctx.fillStyle = COL.mid
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillRect(-18 + c * 4.6, -5.4 + r * 5.2, 3.2, 3.2)
    }
  }
  ctx.fillRect(-6, 4, 12, 2.4)
}

function drawMug(ctx) {
  ctx.fillStyle = COL.paper
  ctx.strokeStyle = COL.line
  ctx.lineWidth = 1.2
  rr(ctx, -7, -11, 14, 22, 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(9, 0, 4.6, -1.2, 1.2)
  ctx.stroke()
  // Coffee inside, so the mug reads as full when it is spinning.
  ctx.fillStyle = '#8a5a3b'
  ctx.beginPath()
  ctx.ellipse(0, -10, 6.4, 1.6, 0, 0, TAU)
  ctx.fill()
}

function drawMonitor(ctx, wrecked) {
  ctx.fillStyle = COL.dark
  rr(ctx, -34, -24, 68, 44, 3)
  ctx.fill()
  ctx.fillStyle = COL.screen
  ctx.fillRect(-29, -19, 58, 34)
  ctx.fillStyle = COL.glow
  for (let i = 0; i < 3; i++) ctx.fillRect(-24, -13 + i * 8, 30 + i * 7, 2.6)
  if (wrecked) {
    // The crack: two hard white jagged lines, drawn only once it has landed.
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(-24, -18); ctx.lineTo(-6, -2); ctx.lineTo(-12, 12); ctx.lineTo(6, 6); ctx.lineTo(22, 14)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(2, -18); ctx.lineTo(-6, -2); ctx.lineTo(14, -8)
    ctx.stroke()
  }
  // The stand, snapped short so it reads as "pulled off the desk".
  ctx.fillStyle = COL.mid
  ctx.fillRect(-9, 20, 18, 4)
  ctx.fillRect(-4, 16, 8, 6)
}

function drawChair(ctx) {
  ctx.fillStyle = COL.mid
  // Backrest and seat.
  rr(ctx, -22, -30, 16, 34, 3)
  ctx.fill()
  rr(ctx, -22, -2, 42, 10, 3)
  ctx.fill()
  // Post and base.
  ctx.fillRect(-2, 8, 5, 22)
  ctx.beginPath()
  ctx.moveTo(-25, 30); ctx.lineTo(24, 30); ctx.lineTo(6, 30); ctx.lineTo(2, 18); ctx.lineTo(-2, 18)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = COL.dark
  ctx.beginPath(); ctx.arc(-21, 31, 3.4, 0, TAU); ctx.fill()
  ctx.beginPath(); ctx.arc(20, 31, 3.4, 0, TAU); ctx.fill()
}

/** One thrown object, drawn at its sampled placement. */
export function drawRiotItem(ctx, s, ghostAlpha = 1) {
  ctx.save()
  ctx.translate(s.x, s.y)
  ctx.rotate(s.rot)
  ctx.scale(s.scale, s.scale)
  ctx.globalAlpha = (s.alpha ?? 1) * ghostAlpha
  if (s.kind === 'keyboard') drawKeyboard(ctx)
  else if (s.kind === 'mug') drawMug(ctx)
  else if (s.kind === 'monitor') drawMonitor(ctx, s.phase === 'fall' || s.phase === 'rest')
  else drawChair(ctx)
  ctx.restore()
}

/**
 * The whole riot, in world space.
 *
 * Draw order is the story: the ringing shapes while charging, the objects in
 * flight (with two ghosts behind each so speed reads), the debris, then the
 * stamp on top of everything — the verdict has to be the last thing said.
 */
export function drawRiot(ctx, riot) {
  const t = riot.t
  if (t > RIOT.end + 240) return
  // The settling fade after the cinematic: the wreck is still on screen, on
  // its way out. Callers that build a riot by hand may pass no `fade`.
  const fade = riot.fade ?? 1
  if (fade <= 0) return

  ctx.save()
  ctx.globalAlpha = clamp01(fade)

  // --- the charge: arcs closing on the fist ----------------------------
  if (t < RIOT.nameEnd + 40 && t > 60) {
    const [fx, fy] = riot.anchors.fist
    const k = clamp01((t - 60) / (RIOT.chargeEnd - 60))
    ctx.save()
    ctx.strokeStyle = 'rgba(6, 8, 14, 0.5)'
    ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      const a0 = t * 0.004 + i * (TAU / 3)
      ctx.lineWidth = 2.2 - i * 0.5
      ctx.globalAlpha = 0.25 + k * 0.45
      ctx.beginPath()
      ctx.arc(fx, fy, 22 + k * 30 + i * 7, a0, a0 + 1.15)
      ctx.stroke()
    }
    ctx.restore()
  }

  // --- debris (behind the objects, thrown from the impact point) --------
  drawDebris(ctx, riot)

  for (const item of riot.items) {
    const s = sampleItem(item, t)
    // Two ghosts behind a thrown object: the trail is what sells the speed.
    if (s.phase === 'fly') {
      const g1 = sampleItem(item, t - 26)
      const g2 = sampleItem(item, t - 52)
      if (g1.phase === 'fly') drawRiotItem(ctx, g1, 0.28)
      if (g2.phase === 'fly') drawRiotItem(ctx, g2, 0.13)
    }
    drawRiotItem(ctx, s)

    const b = burst(item, t)
    if (b > 0) {
      const [tx, ty] = item.to
      const hit = { x: tx, y: ty, life: b, power: item.kind === 'chair' ? 1.05 : 0.7, kill: item.kind === 'chair' }
      drawImpact(ctx, hit, t, item.kind === 'chair' ? 1.5 : 1.1)
    }
  }

  // --- the verdict ------------------------------------------------------
  if (t >= RIOT.stampAt) drawStamp(ctx, riot)

  ctx.restore()
}

function drawDebris(ctx, riot) {
  const dt = (riot.t - RIOT.debrisAt) / 1000
  if (dt <= 0 || dt > 1.35) return
  const ground = riot.anchors.groundY
  for (let i = 0; i < riot.debris.length; i++) {
    const d = riot.debris[i]
    const x = d.x + d.vx * dt
    let y = d.y + d.vy * dt + 0.5 * 900 * dt * dt
    if (y > ground - 2) y = ground - 2
    const life = clamp01(1 - dt / 1.3)
    ctx.save()
    ctx.globalAlpha = life
    ctx.translate(x, y)
    ctx.rotate(d.spin * dt + i)
    if (d.kind === 'paper') {
      ctx.fillStyle = COL.paper
      ctx.strokeStyle = 'rgba(140,148,159,0.8)'
      ctx.lineWidth = 0.6
      ctx.fillRect(-d.size, -d.size * 0.7, d.size * 2, d.size * 1.4)
      ctx.strokeRect(-d.size, -d.size * 0.7, d.size * 2, d.size * 1.4)
    } else {
      ctx.fillStyle = COL.dark
      ctx.beginPath()
      ctx.moveTo(-d.size, 0)
      ctx.lineTo(0, -d.size * 0.9)
      ctx.lineTo(d.size * 0.8, d.size * 0.4)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}

/**
 * The stamp: 「已驳回」 slammed onto the opponent.
 *
 * A red square on a pale office wall is the one piece of UI allowed to exist
 * inside the art, because in this story a rejected work order IS a physical
 * thing — it comes down like a hammer and it stays.
 */
function drawStamp(ctx, riot) {
  const t = riot.t
  const k = clamp01((t - RIOT.stampAt) / 110)
  if (k <= 0) return
  const [ex, ey] = riot.anchors.enemy
  const cx = ex + 6 * riot.anchors.face
  const cy = ey - 118
  // Slam: starts oversized and punches down to its resting size.
  const scale = lerp(3.1, 1, easeOut(k))
  const alpha = Math.min(1, k * 2.4)
  // Smaller than the first pass: at 92 the block covered the victim's head and
  // body, so the picture said "a sign" instead of "a sign ON somebody".
  const size = 78

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.19)
  ctx.scale(scale, scale)
  ctx.globalAlpha = alpha

  // A hard impact ring on the slam frame.
  if (k < 1) {
    ctx.strokeStyle = COL.red
    ctx.globalAlpha = (1 - k) * 0.65
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, size * (0.55 + k * 0.55), 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = alpha
  }

  ctx.strokeStyle = COL.red
  ctx.lineWidth = 5
  ctx.strokeRect(-size / 2, -size / 2, size, size)
  ctx.lineWidth = 1.6
  ctx.strokeRect(-size / 2 + 6, -size / 2 + 6, size - 12, size - 12)

  ctx.fillStyle = COL.red
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(size * 0.34)}px "STKaiti","KaiTi","PingFang SC","Microsoft YaHei",serif`
  ctx.fillText(RIOT.stamp, 0, 1)
  ctx.restore()
}