/**
 * Canvas renderer for the arena snapshot.
 *
 * ART DIRECTION, measured off the reference video rather than guessed:
 *
 *   1. **One flat stage.** A single grey field filling the frame — no horizon,
 *      no gradient, no texture, no vignette.
 *   2. **Two flat silhouettes.** Pure black and pure white, drawn as thick
 *      strokes with round caps; the head is a plain disc. Depth comes only from
 *      which limb overlaps which.
 *   3. **One colour, and only in the hit.** A compact amber burst.
 *   4. **Weight.** The strike point leaves a smear; the ragdoll is a real
 *      Verlet body, so a knockdown is a body falling, not a pose swap.
 */

import { B, HEAD, NECK, PELV, ELB_F, ELB_B, HAND_F, HAND_B, KNEE_F, FOOT_F, FOOT_B } from './rig.js'
import { drawImpact, drawSpeedLines, drawEdgeFlash, drawSuperBanner, drawCombo, drawInkSlash, drawQiRing, drawQiStreak, drawGroundRing, drawAirRipple, drawBubble, drawKoBeat, comboLink } from './effects.js'
import { OfficeBackdrop, drawFloorShadow } from './backdrop.js'
import { RIOT } from './riot.js'

/** The finisher's name, read once from the move's own definition. */
const RIOT_NAME = RIOT.name

const INK = {
  stage: '#9a9a9a',
  white: '#ffffff',
  black: '#000000',
  amber: '#ffc000',
  amberHot: '#fff0b8',
}

/**
 * The framing dial. 0.77 is 30% further back than the original framing, which
 * the player reported as "频繁拉近，最后太近": every impact punched the camera
 * in on top of the close shot, and the finisher ended nose-to-nose with the
 * victim's face. Pulling the whole shot back is the one change that fixes all
 * of them at once — the punch-in is now relative to a wide frame, so a hit
 * still reads without filling the screen.
 *
 * 1 / 1.30 = 0.77.
 */
/**
 * The global framing dial: 0.77 (the 30%-back shot) multiplied by the 1.3 the
 * player asked for after it — see `fit` for why the two numbers are here
 * rather than baked into one.
 */
const ZOOM = 1.0
/**
 * The framing this ZOOM replaced: the 30%-back shot. Exported so the framing
 * test can assert a real RATIO instead of a tautology — `ZOOM / PULLED_BACK`
 * is what "30% larger" actually means, and a future edit to either number that
 * silently negates the pair fails there.
 */
export const PULLED_BACK_ZOOM = 0.77
export const FRAMING_ZOOM = ZOOM

export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas
    this.ctx = ctx
    this.cssW = 0
    this.cssH = 0
    this.dpr = 1
    this.scale = 1
    this.offX = 0
    this.offY = 0
    this.prev = { player: null, enemy: null }
    /**
     * A short ring of past poses, for the afterimage trail. Three frames at
     * 60 Hz is 50 ms — enough to read as speed, short enough that the ghost
     * sits on the body and does not become a second fighter.
     */
    this.trail = { player: [], enemy: [] }
    this.trailMax = 3
  }

  resize(w, h, dpr = 1) {
    this.cssW = Math.max(1, Math.floor(w))
    this.cssH = Math.max(1, Math.floor(h))
    this.dpr = Math.max(1, Math.min(3, dpr))
    if (this.canvas) {
      this.canvas.width = Math.floor(this.cssW * this.dpr)
      this.canvas.height = Math.floor(this.cssH * this.dpr)
    }
  }

  /**
   * Fit the design space into the viewport and then magnify.
   *
   * A 100-unit fighter on a 400-unit stage is a quarter of the design height;
   * at 1:1 on a 16:9 window the pair is a speck in a sea of grey. `MAG` pushes
   * the camera in so the fighters occupy a readable slice, and `focus` keeps
   * them centred as they move apart.
   *
   * `ZOOM` is the one global framing dial, and it is BELOW 1 on purpose: with
   * regular hits pushing the camera in on every connection, the closer
   * framing read as the game leaning into the player's face, and the super's
   * push-in ended almost inside the victim. Everything — the shot, the hit
   * punch, the finisher's zoom — is 23% further back than it used to be.
   *
   * That is the pulled-back shot the player asked for (「拉远30%」), with 30%
   * then taken back off it once the fighters were readable again: the last
   * request was 「人和字放大30%」, and the framing is the only thing that moves
   * the FIGHTERS. 0.77 x 1.3 = 1.001 — the net is the original 30%-back
   * framing recovered, so the characters sit exactly where the first
   * pull-back was measured from and not one unit larger.
   */
  fit(snap, designW = 960, designH = 400) {
    const base = Math.min(this.cssW / designW, this.cssH / designH)
    // Pull back far enough that the pair always fits. A fixed magnification
    // loses one of them the moment a kick sends the other across the stage,
    // which is exactly when the fight is most worth watching.
    const spread = snap ? Math.abs(snap.player.x - snap.enemy.x) : 120
    // A FIXED wide shot, as in the reference: the camera does not chase the
    // fighters frame to frame, it holds a distance where the whole exchange
    // fits. Only `cinematic` moves it, and only in.
    //
    // The floor is clamped to 1.35 rather than 2.1 because the original
    // magnification put the pair at a third of the frame in the opening shot —
    // the player called that out as "镜头一直拉近". The upper bound also sets
    // how large the push-in on a hit can get, so the ceiling is the root fix
    // for "最后太近了" as well.
    const want = 380 + spread * 2.0
    const baseMag = Math.max(1.05, Math.min(1.55, (designW * 0.72) / want))
    const cine = snap ? (snap.cinematic ?? 0) : 0
    const MAG = baseMag * (1 + cine * 0.22) * ZOOM
    this.scale = base * MAG
    this.offX = (this.cssW - designW * base) / 2
    this.offY = (this.cssH - designH * base) / 2
  }

  /**
   * Where the camera looks. Horizontally it follows the pair; vertically it is
   * pinned so the FLOOR sits about three-quarters down the frame, which is the
   * framing the reference uses: room above for a launch, no dead space below.
   */
  focusOn(snap) {
    // The camera LERPS toward its target. Snapping is what made the pair look
    // like it jumped sideways between frames, and it also meant the shake had
    // nowhere to show.
    const mx = (snap.player.x + snap.enemy.x) / 2
    // The camera is solved against the CURRENT playing-field scale, so the
    // pair sits centred in the letterboxed stage rather than in the viewport.
    const tx = this.cssW / 2 - mx * this.scale
    /**
     * Vertical framing. Pulling the shot back (ZOOM) made the floor sit LOWER
     * in the frame relative to the bodies, which left the fighters marooned
     * and a field of empty wall above them. The floor line is solved from the
     * zoom so the pair — feet on the floor, heads 100 stage units above it —
     * sits in the middle band of the picture: the floor is 0.80 of the frame
     * at the wide shot, 0.74 at the close one.
     */
    const floorFrac = 0.74
    const ty = this.cssH * floorFrac - 300 * this.scale
    if (this.camX === undefined) { this.camX = tx; this.camY = ty; this.camS = this.scale }
    this.camX += (tx - this.camX) * 0.22
    this.camY += (ty - this.camY) * 0.22
    this.camS += (this.scale - this.camS) * 0.14
    this.scale = this.camS
    this.offX = this.camX
    this.offY = this.camY
  }

  /**
   * Draw one frame.
   *
   * `world` is an optional callback run INSIDE the world transform, after the
   * fighters and before the screen-space overlays. It exists for effects that
   * live in the stage's own coordinates — the finisher's flying furniture — so
   * they track the camera, the shake and the zoom without the caller having to
   * rebuild that transform and keep the two copies from drifting apart.
   */
  draw(snap, world = null) {
    const ctx = this.ctx
    if (!ctx) return
    this.fit(snap)
    this.focusOn(snap)
    const { juice } = snap

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // The stage is an office: a light room with a window wall, desks and a
    // floor. It is drawn in flat tones so it reads as a place without ever
    // competing with the two silhouettes.
    if (!this.backdrop) this.backdrop = new OfficeBackdrop(0x0ff1ce)
    this.backdrop.draw(ctx, { x: 480, y: 300, zoom: this.scale }, this.cssW, this.cssH)

    // --- world transform: fit, then the camera's shake/zoom -----------------
    ctx.save()
    ctx.translate(this.offX, this.offY)
    const s = this.scale
    ctx.scale(s, s)
    ctx.translate(480, 200)
    ctx.translate(juice.ox / s, juice.oy / s)
    if (juice.angle) ctx.rotate(juice.angle)
    if (juice.zoom > 0.0005) {
      const z = 1 + juice.zoom
      const fx = juice.fx - 480
      const fy = juice.fy - 200
      ctx.translate(fx, fy)
      ctx.scale(z, z)
      ctx.translate(-fx, -fy)
    }
    ctx.translate(-480, -200)

    // --- atmosphere --------------------------------------------------------
    ctx.restore()
    // A soft corner darkening only: on a light stage the room carries the
    // atmosphere, and a heavy vignette would read as dirt on the lens.
    {
      const v = ctx.createRadialGradient(
        this.cssW / 2, this.cssH * 0.5, Math.min(this.cssW, this.cssH) * 0.42,
        this.cssW / 2, this.cssH * 0.5, Math.max(this.cssW, this.cssH) * 0.78,
      )
      v.addColorStop(0, 'rgba(70, 78, 92, 0)')
      v.addColorStop(1, 'rgba(70, 78, 92, 0.22)')
      ctx.fillStyle = v
      ctx.fillRect(0, 0, this.cssW, this.cssH)
    }
    ctx.save()
    ctx.translate(this.offX, this.offY)
    ctx.scale(this.scale, this.scale)

    // --- ground ------------------------------------------------------------
    // A light floor seats the figures with a shadow, which is what a dark
    // stage got from its rim light. Drawn before the bodies.
    drawFloorShadow(ctx, snap.enemy.x, 300, 34 * snap.enemy.scale, 0.18)
    drawFloorShadow(ctx, snap.player.x, 300, 34 * snap.player.scale, 0.22)

    // --- fighters ----------------------------------------------------------
    // Draw the enemy first so the player reads in front.
    //
    // The afterimage goes UNDER both bodies: it is the past, and a past pose
    // painted on top of the present one is a smear over the face.
    const speedOf = (side) => {
      const now = snap[side].points?.[PELV]
      const then = this.trail[side][this.trail[side].length - 1]?.[PELV]
      if (!now || !then) return 0
      return Math.hypot(now[0] - then[0], now[1] - then[1])
    }
    this.drawAfterimage(ctx, this.trail.enemy, snap.enemy, 'white', INK.white, snap.enemy.lw * snap.enemy.scale, speedOf('enemy'))
    this.drawAfterimage(ctx, this.trail.player, snap.player, 'black', INK.black, snap.player.lw * snap.player.scale, speedOf('player'))
    this.drawFighter(ctx, snap.enemy, 'white', this.prev.enemy)
    this.drawFighter(ctx, snap.player, 'black', this.prev.player)
    for (const side of ['player', 'enemy']) {
      const ring = this.trail[side]
      ring.push(snap[side].points)
      if (ring.length > this.trailMax) ring.shift()
    }
    this.prev.player = snap.player.points
    this.prev.enemy = snap.enemy.points

    // --- effects -----------------------------------------------------------
    // The 拳锋, in WORLD space: the streak leaves the striking limb and lives
    // in the same coordinates as the arm that made it. Drawn behind the
    // particles so a spark can cross in front of the qi, which is what makes
    // the line read as air rather than as another limb.
    this.drawLiuFeng(ctx, snap)
    this.drawParticles(ctx, snap.particles)
    // (impact is drawn below, in screen space)

    // World-space effects from the caller: the finisher's debris and furniture.
    if (world) world(ctx, this)

    ctx.restore()

    // --- screen-space effects ---------------------------------------------
    // The impact follows the camera exactly as the fighters do, but it is
    // drawn after the transform is reset so nothing can clip it.
    if (snap.hit) {
      const [hx, hy] = this.project(snap.hit.x, snap.hit.y)
      ctx.save()
      ctx.translate(hx, hy)
      const k = this.scale / 2.2
      ctx.scale(k, k)
      // The link's tier comes from the combo the hit belongs to, so the same
      // code draws a single jab and the fourth hit of a string differently.
      drawComboLink(ctx, { ...snap.hit, x: 0, y: 0 }, k * 2.2, comboLink(snap.hit.combo), snap.t)
      ctx.restore()
    }

    // A landed hit flashes the FRAME edges, which is what makes the blow feel
    // like it happened to the picture rather than inside it.
    if (snap.hit && snap.hit.life > 0.5) {
      drawEdgeFlash(ctx, this.cssW, this.cssH, (snap.hit.life - 0.5) * 0.9)
    }

    // The super freeze takes over the whole frame. The cinematic's own phase
    // drives the overlay, so the letterbox, the name and the release each get
    // their own drawing instead of one banner recycled three ways.
    if (snap.superCine || snap.superBanner > 0.001) {
      drawSuperBanner(ctx, this.cssW, this.cssH, snap.superBanner ?? 0, RIOT_NAME, snap.superCine ?? null)
    }

    // The finish's own beats, drawn on the canvas so the picture carries the
    // impact and the DOM overlay only typesets the words.
    if (snap.koBeat) {
      drawKoBeat(ctx, this.cssW, this.cssH, snap.koBeat, snap.koT ?? 0, this.scale, this.project.bind(this), snap)
    }

    drawCombo(ctx, this.cssW, snap.combo ?? 0, snap.comboPop ?? 0)

    // --- the dialogue ------------------------------------------------------
    // Over the head of whoever is speaking. Placed in screen space because a
    // bubble that shrinks with the camera is unreadable at this zoom.
    if (snap.line) {
      const speaker = snap.line.side === 'player' ? snap.player : snap.enemy
      const head = speaker.points?.[0]
      if (head) {
        const [hx, hy] = this.project(head[0], head[1])
        const name = snap.line.speaker === 'you'
          ? (snap.cast?.you ?? '你')
          : (snap.cast?.rival ?? '对手')
        drawBubble(ctx, snap.line, name, hx, hy, Math.max(1, this.scale * 0.55))
      }
    }

    // --- full-frame flash --------------------------------------------------
    if (juice.flashA > 0.01) {
      ctx.globalAlpha = Math.min(1, juice.flashA)
      ctx.fillStyle = juice.flashColor
      ctx.fillRect(0, 0, this.cssW, this.cssH)
      ctx.globalAlpha = 1
    }
  }

  /**
   * Draw one fighter from its eleven points.
   *
   * A limb is a thick round-capped stroke; the head is a disc. That is the
   * entire style — no shading, no outline, one colour — because in a two-tone
   * fight the silhouette is the only thing the eye has.
   */
  drawFighter(ctx, f, ink, prevPoints) {
    const pts = f.points
    const colour = ink === 'white' ? INK.white : INK.black
    const s = f.scale
    const lw = f.lw * s
    const joint = (i) => pts[i]

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = f.state === 'dead' ? 0.9 : 1

    /**
     * One pass of the whole body. `width` scales every stroke, which is how
     * the rim pass is produced: the same skeleton, a few pixels fatter, in
     * the outline colour.
     */
    const body = (strokeColour, width) => {
      const stroke = (a, b, w) => {
        ctx.lineWidth = w * width
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.stroke()
      }
      const disc = (p, r) => {
        ctx.beginPath()
        ctx.arc(p[0], p[1], r * (width > 1 ? 1.16 : 1), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = strokeColour
      ctx.fillStyle = strokeColour
      // Far limbs, slightly thinner so the near ones read on top.
      // 0 HEAD 1 NECK 2 PELV 3 ELB_B 4 HAND_B 5 ELB_F 6 HAND_F
      // 7 KNEE_B 8 FOOT_B 9 KNEE_F 10 FOOT_F
      stroke(joint(1), joint(3), lw * 0.82)
      stroke(joint(3), joint(4), lw * 0.82)
      stroke(joint(2), joint(7), lw * 0.9)
      stroke(joint(7), joint(8), lw * 0.9)
      stroke(joint(2), joint(1), lw * 1.5)
      stroke(joint(1), joint(5), lw)
      stroke(joint(5), joint(6), lw)
      stroke(joint(2), joint(9), lw)
      stroke(joint(9), joint(10), lw)
      disc(joint(6), lw * 0.62)
      disc(joint(4), lw * 0.55)
      disc(joint(10), lw * 0.55)
      disc(joint(8), lw * 0.55)
      disc(joint(0), B.headR * s)
    }

    // The rim: a cool edge on the ink figure, a warm one on the white.
    // On a LIGHT stage the rim is a dark edge: it is the white figure that
    // would otherwise dissolve into the wall, and the black one that needs to
    // stay distinct from the dark monitors behind it.
    // The halo. Wide enough to survive the fill pass on top of it: a white
    // body on a pale wall needs a real dark edge, not a hairline.
    const haloColour = ink === 'white' ? 'rgba(32, 38, 50, 0.96)' : 'rgba(250, 251, 253, 0.22)'
    const haloGrow = ink === 'white' ? 1.62 : 1.34
    body(haloColour, haloGrow)
    // The silhouette itself.
    body(colour, 1)

    /**
     * The swordsman mark: a topknot on the crown.
     *
     * It is DERIVED from the eleven points and drawn after the body, so the
     * skeleton, the hitboxes and the ragdoll never learn it exists. That one
     * shape is what turns the figure from "a stick person" into "a wuxia
     * fighter" for the cost of a few strokes.
     *
     * It takes the same two-pass treatment as the body — a halo first, the ink
     * on top — because on the white fighter an outline is the only thing
     * separating the bun from the pale wall behind it. The halo is THINNER
     * than the body's, though: the body's is sized for a 6-unit limb, and spent
     * on a 3-unit lock of hair it doubles its apparent thickness.
     *
     * (A waist sash was drawn here too and has been CUT — on a 100-unit stick
     * figure, cloth trailing off the pelvis reads as a tail. See KIND in
     * fighter.js.)
     */
    const markRim = { colour: haloColour, grow: lw * 0.3 + 1.6 }
    if (f.topknot) this.drawTopknot(ctx, pts, f.face ?? 1, colour, lw, markRim)

    // A flash on the frame of a hit: the silhouette goes bright for a beat.
    const hurt = f.flash > 0

    // --- smears: the strike limb's arc from the previous frame --------------
    if (prevPoints && f.state === 'atk') {
      this.drawSmear(ctx, prevPoints, pts, colour, lw)
    }

    // A hurt flash: draw the whole silhouette bright for a couple of frames.
    if (hurt) {
      ctx.globalAlpha = Math.min(0.8, f.flash * 6)
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = INK.amberHot
      ctx.lineWidth = lw * 0.9
      ctx.beginPath()
      ctx.moveTo(joint(2)[0], joint(2)[1])
      ctx.lineTo(joint(1)[0], joint(1)[1])
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(joint(0)[0], joint(0)[1], B.headR * s * 1.06, 0, Math.PI * 2)
      ctx.fillStyle = INK.amberHot
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }

    ctx.restore()
  }

  /** World -> screen, using the camera this frame. */
  project(x, y) {
    return [x * this.scale + this.offX, y * this.scale + this.offY]
  }

  /**
   * The wuxia topknot: a bun on the crown and one lock of hair trailing back.
   *
   * Three attempts went into this, and the failures are the design:
   *
   *   1. bun at 0.86 of the head radius, radius of half a line width. Only 1.7
   *      units cleared the skull — at arena scale that is under two pixels, and
   *      it photographed as a lumpy head.
   *   2. bun on the crown with a cord stroked across it. The cord's stroke was
   *      drawn under a white fill on the white fighter and over it on the
   *      black, so the two inks disagreed AND the round bun with a line across
   *      it read as a ring, not a knot.
   *   3. a tapered lock flicking UP and back. At 3x it was a pair of rabbit
   *      ears; a topknot's tail hangs, it does not stand.
   *
   * So: one round bun that clearly overlaps the skull, and one tapered lock
   * that leaves the bun, passes BEHIND the head and hangs down-back. No cord —
   * the overlap between bun and skull is the knot, and it survives both inks.
   *
   * `rim` is the outline pass for the white fighter, whose white bun would
   * otherwise dissolve into the pale wall.
   */
  drawTopknot(ctx, pts, face, colour, lw, rim = null) {
    const head = pts[HEAD]
    const neck = pts[NECK]
    if (!head || !neck) return
    // The crown is the far side of the head from the neck, along that axis.
    const dx = head[0] - neck[0]
    const dy = head[1] - neck[1]
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const r = B.headR * (lw / 6.4)
    const bunR = r * 0.44
    // On the crown, nudged toward the back of the head.
    const bx = head[0] + ux * r * 1.02 - face * r * 0.26
    const by = head[1] + uy * r * 1.02

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const emit = () => {
      if (rim) {
        ctx.strokeStyle = rim.colour
        ctx.lineWidth = rim.grow
        ctx.stroke()
      }
      ctx.fillStyle = colour
      ctx.fill()
    }

    // The lock, drawn FIRST so the bun covers where it is tied on. It leaves
    // the bun, runs down the back of the skull and hangs a little past it.
    const hangX = bx - face * (r * 0.9) - ux * r * 0.5
    const hangY = by + r * 1.05
    const top = [bx - face * bunR * 0.3, by + bunR * 0.2]
    const midX = bx - face * r * 1.15 - ux * r * 0.2
    const midY = by + r * 0.25
    ctx.beginPath()
    ctx.moveTo(top[0], top[1])
    ctx.quadraticCurveTo(midX, midY, hangX, hangY)
    // Back up the outside of the lock, offset outward, to give it width.
    ctx.quadraticCurveTo(midX + face * r * 0.34, midY + r * 0.1, top[0], top[1] + bunR * 0.85)
    ctx.closePath()
    emit()

    // The bun: a disc sitting on the crown. Its overlap with the skull is the
    // entire "this is tied" cue, so it is placed to overlap by about a third.
    ctx.beginPath()
    ctx.arc(bx, by, bunR, 0, Math.PI * 2)
    emit()
    ctx.restore()
  }

  /**
   * The 拳锋 streak on a strike in progress, and the 震地环 / 踏空涟漪 that go
   * with leaving or meeting the ground.
   *
   * Everything here is read from the pose and the snapshot's clock, so it
   * cannot drift from the animation:
   *
   *   - a striking limb draws a streak along its own line, brightest at the
   *     active window and gone by the recovery;
   *   - a fighter in the air with an upward launch draws the air ripple under
   *     the pushing-off foot;
   *   - a fighter landing from a real fall draws the ground ring at the feet.
   *
   * `snap.land` is a life value the arena sets on a heavy landing; it fades the
   * ground ring without the renderer having to know when the landing happened.
   */
  drawLiuFeng(ctx, snap) {
    for (const side of ['player', 'enemy']) {
      const f = snap[side]
      const pts = f.points
      if (!pts || pts.length < 11) continue
      // The strike's own window, as a 0..1 amount of "this limb is committed".
      let strikeK = 0
      if (f.state === 'atk' && typeof f.atkU === 'number') {
        // The active window is roughly the middle third of a move; a smooth
        // bump over it keeps the streak from blinking on and off.
        strikeK = Math.sin(Math.min(1, Math.max(0, f.atkU)) * Math.PI)
      }
      if (strikeK > 0.02) {
        /**
         * `reach` measures how far the limb is EXTENDED, which is the joint's
         * distance from the SHOULDER (for an arm) or the HIP (for a leg) —
         * not from the pelvis.
         *
         * The pelvis was the first choice and it silently killed the effect:
         * a jab's fist sits about 52 units from the pelvis in the strike pose
         * while a resting hand sits at 50, so the gate never opened and the
         * streak never drew. Measured against the shoulder the same jab goes
         * from ~20 units (guard) to ~70 (extended), which is a real signal.
         */
        const neckPt = pts[NECK]
        const limbs = [
          [pts[ELB_F], pts[HAND_F], neckPt, 34],
          [pts[ELB_B], pts[HAND_B], neckPt, 34],
          [pts[KNEE_F], pts[FOOT_F], pts[PELV], 110],
        ]
        for (const [from, to, root, reachMax] of limbs) {
          if (!from || !to || !root) continue
          const out = Math.hypot(to[0] - root[0], to[1] - root[1])
          // A resting hand hangs near the hip (~50 from the neck); an extended
          // punch reaches 90+. Only the extended limb earns the mark.
          const reach = Math.min(reachMax, Math.max(0, out - 58) * 0.8)
          if (reach < 7) continue
          drawQiStreak(ctx, from, to, reach, strikeK * 0.85, 2.6 + strikeK * 1.6)
        }
      }

      // 踏空涟漪: a foot pushing off the air on the way up.
      if (!f.onGround && f.vy < -120) {
        const foot = pts[FOOT_B]
        if (foot) {
          const k = Math.min(1, Math.abs(f.vy) / 900)
          drawAirRipple(ctx, foot[0], foot[1] + 6, k, 0.9 * f.scale)
        }
      }
    }

    // 震地环: the floor ring a heavy landing punches out.
    if (snap.land) {
      for (const ring of snap.land) {
        if (!ring || ring.life <= 0.02) continue
        drawGroundRing(ctx, ring.x, ring.y, ring.life, ring.scale ?? 1)
      }
    }
  }

  /** The swept arc of a striking limb, drawn from where it was last frame. */
  drawSmear(ctx, prev, now, colour, lw) {
    // The striking joints: the hands and the front foot.
    for (const i of [HAND_F, HAND_B, FOOT_F]) {
      const a = prev[i]
      const b = now[i]
      if (!a || !b) continue
      // `prev` is the previous frame's point list; the trail frames share that
      // shape, so a missing entry means the body was not drawn last frame.
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const speed = Math.hypot(dx, dy)
      if (speed < 6) continue
      ctx.save()
      ctx.globalAlpha = Math.min(0.5, speed / 90)
      ctx.strokeStyle = colour
      ctx.lineCap = 'round'
      for (const [k, w] of [[0.3, 0.9], [0.6, 0.55], [0.85, 0.3]]) {
        ctx.lineWidth = lw * w
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.quadraticCurveTo(
          a[0] + dx * 0.55,
          a[1] + dy * 0.55,
          a[0] + dx * k,
          a[1] + dy * k,
        )
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  /**
   * The afterimage: the whole silhouette, ghosted, a few frames behind.
   *
   * This is the cheapest thing in the whole wuxia vocabulary and by far the
   * loudest. A single smear on the striking limb says "that hand moved"; a
   * trail of the WHOLE BODY says "that person moved faster than you could
   * see", which is the idea a 残影 is for.
   *
   * `history` is the renderer's ring of past poses — plain point arrays, pushed
   * once per drawn frame. Each ghost is the body as it was `lag` frames ago,
   * faded by its distance from the present. Only `speed` decides how bright it
   * gets, so a fighter standing still has NO already-faint ghost to explain
   * away.
   */
  drawAfterimage(ctx, history, snapNow, ink, colour, lw, speed) {
    if (!history || history.length < 2 || speed < 4) return
    // The ceiling is low on purpose. Even a quarter alpha over three full
    // silhouettes reads as a second fighter standing behind the first — the
    // first pass photographed exactly that. Twelve percent, with the tail
    // ghosts nearly gone, reads as motion blur instead of a clone.
    const strength = Math.min(0.13, (speed - 4) / 260)
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // Oldest first, so the newest ghost sits closest to the body. The falloff
    // is squared: a linear fade leaves the oldest ghost at a third strength,
    // which is still a body-shaped smudge.
    for (let i = 0; i < history.length; i++) {
      const pts = history[i]
      if (!pts) continue
      const age = (i + 1) / (history.length + 1)
      ctx.globalAlpha = strength * (1 - age) * (1 - age)
      ctx.strokeStyle = colour
      ctx.fillStyle = colour
      const ghostBody = () => {
        const stroke = (a, b, w) => {
          ctx.lineWidth = w
          ctx.beginPath()
          ctx.moveTo(a[0], a[1])
          ctx.lineTo(b[0], b[1])
          ctx.stroke()
        }
        const disc = (p, r) => {
          ctx.beginPath()
          ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
          ctx.fill()
        }
        stroke(pts[1], pts[3], lw * 0.82)
        stroke(pts[3], pts[4], lw * 0.82)
        stroke(pts[2], pts[7], lw * 0.9)
        stroke(pts[7], pts[8], lw * 0.9)
        stroke(pts[2], pts[1], lw * 1.5)
        stroke(pts[1], pts[5], lw)
        stroke(pts[5], pts[6], lw)
        stroke(pts[2], pts[9], lw)
        stroke(pts[9], pts[10], lw)
        disc(pts[0], B.headR * snapNow.scale)
      }
      ghostBody()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  /** Sparks and shock rings. */
  drawParticles(ctx, particles) {
    for (const p of particles) {
      if (p.kind === 'spark') {
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.strokeStyle = INK.amber
        ctx.lineWidth = p.size * 0.7
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.008, p.y - p.vy * 0.008)
        ctx.stroke()
      } else if (p.kind === 'ring') {
        const grow = 1 - p.life
        ctx.globalAlpha = Math.max(0, p.life) * 0.85
        ctx.strokeStyle = INK.amberHot
        ctx.lineWidth = 3 * p.life + 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, (p.size + grow * 30) * p.scale, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }


}

/**
 * The link's own drawing, scaled by the combo it belongs to.
 *
 * `comboLink(n)` says how many slashes, how many shutters and how hot the
 * frame should be; this function is the only place those numbers become
 * pixels. Keeping it here (rather than stacking extra passes in `draw`) means
 * the ladder can be retuned in one table without touching the render order.
 *
 * THE UPDATE is that the tier now drives the SIZE, not just the part count.
 * The first version added a second slash and a few speed lines to higher
 * links, but every one of them was drawn at the same radius — around 60 px on
 * a 1280-wide frame. Five tiers of a 60 px effect still read as one small
 * effect. The ladder now multiplies the whole burst by a per-tier scale, so
 * link 5 physically covers a third of the screen and the escalation is
 * visible from across a room.
 */
const LINK_SCALE = [1, 1, 1.45, 2.0, 2.5, 3.0]

function drawComboLink(ctx, hit, scale, link, t = 0) {
  const k = LINK_SCALE[Math.min(LINK_SCALE.length - 1, Math.max(0, link.tier))] ?? 1
  const big = scale * k
  // The frame's own reaction is part of the drawing: by link three the burst
  // carries a hot red rim, and by four a full white edge. This is the tier
  // saying "that was not the same kind of hit" without adding new shapes.
  const framed = { ...hit, hot: link.hot, spokes: link.spokes }
  // The qi ring: every link has one, and each is wider than the last.
  drawQiRing(ctx, framed, big)
  drawImpact(ctx, framed, t, k)

  // Slashes. The first link is the single stroke the game always had; the
  // second adds a crossing cut, which is what turns "a punch" into "a hit".
  drawInkSlash(ctx, framed, big)
  if (link.slashes > 1) {
    // A second stroke, mirrored through the contact point, so the pair reads
    // as one X laid over the body rather than as two unrelated marks.
    ctx.save()
    ctx.scale(-1, 1)
    drawInkSlash(ctx, { ...framed, angle: -(framed.angle ?? -0.45) }, big * 0.82)
    ctx.restore()
  }

  // Speed lines only from the second link, and they get denser as the chain
  // builds. A single jab does not need the whole frame pointing at it.
  if (link.speed > 0 && hit.life > 0.4) {
    drawSpeedLines(ctx, 0, 0, Math.min(1, (hit.life - 0.4) / 0.5), hit.power * link.speed, k)
  }
}

/**
 * The factory the client half calls.
 *
 * The renderer is a class here, but the host wiring was written against a
 * factory returning `{ resize, draw }`, and keeping that shape means the layer
 * that guards the exit did not have to change when the engine did.
 */
export function createRenderer(canvas, ctx) {
  const renderer = new Renderer(canvas, ctx)
  return {
    resize: (w, h, ratio) => renderer.resize(w, h, ratio),
    draw: (snap, world) => renderer.draw(snap, world),
    fit: () => renderer.fit(),
    scale: () => renderer.scale,
  }
}
