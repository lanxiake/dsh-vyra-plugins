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

import { B, HAND_F, HAND_B, FOOT_F } from './rig.js'
import { drawImpact, drawSpeedLines, drawEdgeFlash, drawSuperBanner, drawCombo, drawInkSlash, drawQiRing, drawBubble } from './effects.js'
import { OfficeBackdrop, drawFloorShadow } from './backdrop.js'

const INK = {
  stage: '#9a9a9a',
  white: '#ffffff',
  black: '#000000',
  amber: '#ffc000',
  amberHot: '#fff0b8',
}

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
    const want = 380 + spread * 2.0
    const baseMag = Math.max(1.25, Math.min(2.1, (designW * 0.72) / want))
    const cine = snap ? (snap.cinematic ?? 0) : 0
    const MAG = baseMag * (1 + cine * 0.34)
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
    const ty = this.cssH * 0.74 - 300 * this.scale
    if (this.camX === undefined) { this.camX = tx; this.camY = ty; this.camS = this.scale }
    this.camX += (tx - this.camX) * 0.22
    this.camY += (ty - this.camY) * 0.22
    this.camS += (this.scale - this.camS) * 0.14
    this.scale = this.camS
    this.offX = this.camX
    this.offY = this.camY
  }

  draw(snap) {
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
    this.drawFighter(ctx, snap.enemy, 'white', this.prev.enemy)
    this.drawFighter(ctx, snap.player, 'black', this.prev.player)
    this.prev.player = snap.player.points
    this.prev.enemy = snap.enemy.points

    // --- effects -----------------------------------------------------------
    this.drawParticles(ctx, snap.particles)
    // (impact is drawn below, in screen space)

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
      drawQiRing(ctx, { ...snap.hit, x: 0, y: 0 }, k * 2.2)
      drawInkSlash(ctx, { ...snap.hit, x: 0, y: 0 }, k * 2.2)
      drawImpact(ctx, { ...snap.hit, x: 0, y: 0 }, snap.t)
      if (snap.hit.life > 0.55) {
        drawSpeedLines(ctx, 0, 0, (snap.hit.life - 0.55) / 0.45, snap.hit.power)
      }
      ctx.restore()
    }

    // A landed hit flashes the FRAME edges, which is what makes the blow feel
    // like it happened to the picture rather than inside it.
    if (snap.hit && snap.hit.life > 0.5) {
      drawEdgeFlash(ctx, this.cssW, this.cssH, (snap.hit.life - 0.5) * 0.9)
    }

    // The super freeze takes over the whole frame.
    if (snap.superBanner > 0.001) {
      drawSuperBanner(ctx, this.cssW, this.cssH, snap.superBanner, '破 军')
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
    body(ink === 'white' ? 'rgba(32, 38, 50, 0.96)' : 'rgba(250, 251, 253, 0.22)', ink === 'white' ? 1.62 : 1.34)
    // The silhouette itself.
    body(colour, 1)

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

  /** The swept arc of a striking limb, drawn from where it was last frame. */
  drawSmear(ctx, prev, now, colour, lw) {
    // The striking joints: the hands and the front foot.
    for (const i of [HAND_F, HAND_B, FOOT_F]) {
      const a = prev[i]
      const b = now[i]
      if (!a || !b) continue
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
    draw: (snap) => renderer.draw(snap),
    fit: () => renderer.fit(),
    scale: () => renderer.scale,
  }
}
