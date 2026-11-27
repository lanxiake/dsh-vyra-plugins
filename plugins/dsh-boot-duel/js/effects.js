/**
 * Fighting-game effects, in the King of Fighters idiom.
 *
 * What actually makes that style read, stripped to what a Canvas 2D layer can
 * do honestly:
 *
 *   1. **Impact frames** — a hit holds the whole screen for a beat while a
 *      white burst flashes ON TOP of both bodies. The freeze is the hit.
 *   2. **Speed lines** — radial strokes that converge on the point of impact,
 *      drawn for two or three frames only. They sell force, not motion.
 *   3. **Screen-edge impact flash** — the frame edges go white, so the blow
 *      feels like it happened to the picture, not inside it.
 *   4. **A super freeze** — the world desaturates, the fighter glows, and the
 *      move name is announced in a hard-edged banner.
 *   5. **Combo counter** — a number that climbs, with every hit it counts.
 *   6. **Hit sparks with a bright core and a dark rim**, so they read on both
 *      a black silhouette and a white one.
 */

const KOF = {
  white: '#ffffff',
  hot: '#fff6c8',
  amber: '#ffc400',
  orange: '#ff7a1a',
  red: '#ff2d55',
  ink: '#0b0b12',
  blue: '#57d8ff',
}

/** Draw the impact burst: a hot core, a dark rim, and radial spokes. */
export function drawImpact(ctx, hit, t) {
  const life = Math.max(0, hit.life)
  const grow = 1 - life
  const big = (hit.kill ? 1.7 : hit.guarded ? 0.6 : 1.0) * (0.65 + hit.power * 0.55)
  ctx.save()
  ctx.translate(hit.x, hit.y)
  ctx.globalAlpha = Math.min(1, life * 2.2)

  // Outer spokes: long, thin, uneven — the KOF starburst.
  const spokes = hit.kill ? 14 : 9
  ctx.lineCap = 'round'
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + (i % 3) * 0.31
    const len = (26 + (i % 4) * 11) * (0.45 + life * 0.75) * big
    // A dark rim under a bright spoke makes it read on any background.
    ctx.strokeStyle = KOF.ink
    ctx.lineWidth = (4.4 + (i % 3)) * life * big
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3)
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
    ctx.stroke()
    ctx.strokeStyle = i % 3 === 0 ? KOF.hot : KOF.amber
    ctx.lineWidth = (2.4 + (i % 3) * 0.8) * life * big
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3)
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
    ctx.stroke()
  }

  // The core: amber disc, then a white-hot centre.
  ctx.fillStyle = KOF.amber
  ctx.beginPath()
  ctx.arc(0, 0, (10 + grow * 12) * big, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = KOF.hot
  ctx.beginPath()
  ctx.arc(0, 0, (6 + grow * 6) * big, 0, Math.PI * 2)
  ctx.fill()

  // A thin ring, expanding.
  ctx.globalAlpha = Math.min(1, life * 1.6) * 0.7
  ctx.strokeStyle = KOF.hot
  ctx.lineWidth = 2.4 * life
  ctx.beginPath()
  ctx.arc(0, 0, (18 + grow * 64) * big, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  void t
}

/** Radial speed lines converging on (x, y). Two or three frames only. */
export function drawSpeedLines(ctx, x, y, life, power) {
  if (life <= 0.02) return
  const n = 22
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = Math.min(1, life * 2) * 0.36
  ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.77
    const r0 = 26 + (i % 5) * 8
    const r1 = r0 + (26 + (i % 7) * 14) * (0.4 + power * 0.7)
    ctx.strokeStyle = i % 4 === 0 ? KOF.hot : KOF.ink
    ctx.lineWidth = (1 + (i % 3) * 0.9) * life * 2.2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
    ctx.stroke()
  }
  ctx.restore()
}

/** White edge flashes: the blow lands on the PICTURE, not in it. */
export function drawEdgeFlash(ctx, w, h, amount) {
  if (amount <= 0.01) return
  const g = ctx.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, `rgba(255,255,255,${amount})`)
  g.addColorStop(0.18, 'rgba(255,255,255,0)')
  g.addColorStop(0.82, 'rgba(255,255,255,0)')
  g.addColorStop(1, `rgba(255,255,255,${amount})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

/**
 * The super freeze: a hard-edged banner with the move's name, a dark bar, and
 * the fighter's silhouette glowing at the centre.
 */
/**
 * The finisher's overlay, one drawing per beat.
 *
 * A single "big text over a dark bar" does not sell a super: the reason the
 * genre's supers land is that the game STOPS, names the move, then releases.
 * So the overlay is keyed to the cinematic's own phase (`snap.superCine`):
 *
 *   charge — letterbox closes from top and bottom, the frame darkens, a red
 *            edge burns in; the name has not arrived yet
 *   name   — 「破军」in one brush stroke, hard-shadowed, with a white flash and
 *            radial speed lines converging behind it
 *   strike — the bars snap open (no text: the eye is on the hit)
 *   impact — a full ring shockwave from the strike point, brief white
 *   recover — nothing; the fight is back
 *
 * `progress` is kept for the old call site (a plain banner), but the phase is
 * what the visual actually follows.
 */
export function drawSuperBanner(ctx, w, h, progress, label = '破 军', cine = null) {
  const life = Math.max(0, Math.min(1, progress))
  if (life <= 0 && !cine) return

  if (cine) {
    drawSuperCinematic(ctx, w, h, label, cine)
    return
  }

  const inK = Math.min(1, (1 - life) * 5)
  const outK = Math.min(1, life * 3.2)
  const bar = Math.min(inK, outK)
  ctx.save()
  ctx.fillStyle = `rgba(6,6,12,${0.42 * bar})`
  ctx.fillRect(0, 0, w, h)

  // Two hard bars, top and bottom, sliding in from the sides.
  const bh = h * 0.13
  ctx.fillStyle = `rgba(8,8,16,${0.86 * bar})`
  ctx.fillRect(0, h * 0.5 - bh / 2, w, bh)
  ctx.fillStyle = KOF.amber
  ctx.globalAlpha = bar
  ctx.fillRect(0, h * 0.5 - bh / 2, w, 2)
  ctx.fillRect(0, h * 0.5 + bh / 2 - 2, w, 2)

  if (bar > 0.3) {
    ctx.globalAlpha = (bar - 0.3) / 0.7
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = Math.round(Math.min(w, h) * 0.13)
    ctx.font = `900 ${size}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`
    ctx.fillStyle = KOF.ink
    ctx.fillText(label, w / 2 + size * 0.05, h * 0.5 + size * 0.05)
    ctx.fillStyle = KOF.hot
    ctx.fillText(label, w / 2, h * 0.5)
  }
  ctx.restore()
}

/** The five-beat overlay, drawn in screen space. */
function drawSuperCinematic(ctx, w, h, label, cine) {
  const { phase, bars, t } = cine
  const barH = h * 0.115
  ctx.save()

  // --- the letterbox: closes on `charge`, opens on `strike` ---------------
  const closed = Math.max(0, Math.min(1, bars))
  if (closed > 0.001) {
    ctx.fillStyle = 'rgba(4, 5, 10, 0.96)'
    ctx.fillRect(0, 0, w, barH * closed)
    ctx.fillRect(0, h - barH * closed, w, barH * closed)
    // A hot rim on the inner edge of each bar: gold while charging, white-hot
    // on the release.
    const rim = phase === 'charge' ? '#ffc400' : '#fff3c4'
    ctx.fillStyle = rim
    ctx.globalAlpha = 0.9 * closed
    ctx.fillRect(0, barH * closed - 2, w, 2)
    ctx.fillRect(0, h - barH * closed, w, 2)
    ctx.globalAlpha = 1
  }

  // --- the darkening: the world loses 55% of its light -------------------
  if (phase === 'charge' || phase === 'name') {
    const k = phase === 'charge' ? Math.min(1, closed) : 1
    ctx.fillStyle = `rgba(3, 4, 9, ${0.55 * k})`
    ctx.fillRect(0, barH * closed, w, h - barH * closed * 2)
  }

  // --- the name ----------------------------------------------------------
  if (phase === 'name') {
    // The name sits ABOVE the fighters, not on them: a title printed across a
    // face hides the pose the whole freeze exists to show.
    const nameY = h * 0.32

    // Speed lines converging ON the name, from the frame edges inward.
    ctx.save()
    ctx.translate(w / 2, nameY)
    ctx.strokeStyle = 'rgba(255, 246, 200, 0.55)'
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * Math.PI * 2 + t * 0.0004
      const r0 = Math.min(w, h) * 0.16
      const r1 = Math.min(w, h) * (0.42 + ((i * 37) % 23) / 55)
      ctx.globalAlpha = 0.22 + ((i * 13) % 10) / 20
      ctx.lineWidth = i % 5 === 0 ? 3 : 1
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      ctx.stroke()
    }
    ctx.restore()

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = Math.round(Math.min(w, h) * 0.155)
    ctx.font = `900 ${size}px "STKaiti","KaiTi","PingFang SC","Microsoft YaHei",serif`
    // Scale in over the first 120 ms: the name slams on, it does not fade in.
    const pop = Math.min(1, Math.max(0, t - 940) / 120)
    const k = 0.7 + 0.3 * (pop * pop * (3 - 2 * pop))
    ctx.translate(w / 2, nameY)
    ctx.scale(k, k)
    // A stack of dark offsets is the hard KOF edge.
    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    for (const [ox, oy] of [[7, 8], [4, 5], [2, 2]]) ctx.fillText(label, ox, oy)
    ctx.fillStyle = KOF.hot
    ctx.fillText(label, 0, 0)
    // A thin amber outline keeps the white off a white flash frame.
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 122, 26, 0.9)'
    ctx.strokeText(label, 0, 0)
    ctx.restore()
  }

  // --- the release: a white edge and a ring from the centre --------------
  if (phase === 'strike') {
    const k = Math.max(0, 1 - (t - 950) / 300)
    ctx.globalAlpha = k * 0.7
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, w - 6, h - 6)
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

/**
 * The finish's four beats, drawn in screen space.
 *
 * `koBeat` comes from the game (`launch` → `freeze` → `seal`), so the picture
 * and the DOM stamp share one clock. Each beat answers a different question:
 *
 *   launch — where did the body go?  radial speed lines from the point that
 *            was hit, and a short white edge
 *   freeze — hold it.  the lines fade, the frame narrows to the body
 *   seal   — the verdict.  a hard vignette slams in from the edges, a red
 *            wash behind the stamp
 *
 * `toScreen(x, y)` projects world coordinates; `snap` carries the fighters so
 * the effect starts where the hit actually landed.
 */
export function drawKoBeat(ctx, w, h, beat, koT, scale, toScreen, snap) {
  if (beat === 'launch') {
    // Speed lines from the victim's body, back along the direction of travel.
    const v = snap.enemy ?? snap.player
    const [sx, sy] = toScreen(v.x, v.y - 120)
    ctx.save()
    ctx.translate(sx, sy)
    const k = Math.max(0, 1 - koT / 0.5)
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + koT * 6
      const r0 = 40 * scale
      const r1 = (90 + ((i * 29) % 70)) * scale * (1 + koT * 2)
      ctx.globalAlpha = k * (0.35 + ((i * 11) % 10) / 22)
      ctx.strokeStyle = i % 4 === 0 ? KOF.hot : KOF.ink
      ctx.lineWidth = i % 4 === 0 ? 2.4 : 1.2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  if (beat === 'freeze') {
    // Two thin dark bars close in from the left and right: the frame narrows
    // to the body, which is what "hold on this" looks like in the genre.
    const k = Math.min(1, Math.max(0, (koT - 0.5) / 0.3))
    const bw = w * 0.09 * k
    ctx.save()
    ctx.fillStyle = `rgba(4, 5, 10, ${0.55 * k})`
    ctx.fillRect(0, 0, bw, h)
    ctx.fillRect(w - bw, 0, bw, h)
    ctx.restore()
    return
  }

  // seal: a red varnish over the whole frame, then a hard vignette.
  const k = Math.min(1, Math.max(0, (koT - 1.05) / 0.22))
  if (k <= 0) return
  ctx.save()
  ctx.fillStyle = `rgba(120, 12, 20, ${0.2 * k})`
  ctx.fillRect(0, 0, w, h)
  const g = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.22, w / 2, h * 0.5, Math.max(w, h) * 0.72)
  g.addColorStop(0, 'rgba(8, 4, 10, 0)')
  g.addColorStop(1, `rgba(8, 4, 10, ${0.72 * k})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
export function drawCombo(ctx, w, count, pop) {
  if (count < 2) return
  ctx.save()
  const size = Math.round(Math.min(w * 0.055, 54)) * (1 + pop * 0.25)
  ctx.font = `900 ${size}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const x = w * 0.06
  /**
   * BELOW the HUD, not in the corner. The counter used to be placed at 5% of
   * the viewport height, which put it on top of the player's health bar and
   * the qi gauge — three numbers in one corner, none of them legible. The HUD
   * plate is ~90 px tall, so the counter starts under it.
   */
  const y = Math.max(104, w * 0.05)
  ctx.fillStyle = KOF.ink
  ctx.fillText(String(count), x + 3, y + 3)
  ctx.fillStyle = KOF.hot
  ctx.fillText(String(count), x, y)
  const sub = Math.round(size * 0.42)
  ctx.font = `700 ${sub}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`
  ctx.fillStyle = KOF.ink
  ctx.fillText('连击', x + 3, y + size + 3)
  ctx.fillStyle = KOF.amber
  ctx.fillText('连击', x, y + size)
  ctx.restore()
}

/* ------------------------------------------------------------------ ink --- */

/**
 * Ink-and-brush strike effects, the wuxia idiom.
 *
 * A kung-fu film does not show a punch with sparks: it shows it with a BRUSH
 * mark — a hard, wet stroke of black ink laid over the frame for a couple of
 * beats, with splatter flying off the end. The vocabulary here:
 *
 *   - **the slash**: a tapering crescent, thick at the root and whipping to a
 *     point, drawn as a quadratic all the way through the strike;
 *   - **the splatter**: irregular blots thrown along the direction of the blow,
 *     shrinking as they travel — ink, not sparks;
 *   - **the seal**: a hard square of red at the centre of a heavy hit, the way
 *     a painter stamps a work;
 *   - **the dry-brush tail**: a broken streak of parallel hairs at the end of
 *     the stroke, which is what makes a brush stroke read as a brush.
 *
 * They are monochrome on purpose. On a cyberpunk board the ink reads as the
 * deliberate contrast, and it never fights the amber hit burst for attention.
 */

const INK = {
  wet: 'rgba(6, 8, 14, 0.92)',
  dry: 'rgba(10, 14, 22, 0.55)',
  highlight: 'rgba(232, 246, 255, 0.75)',
}

/**
 * A tapering brush stroke from `a` to `b`, bowed by `bow` perpendicular to the
 * travel. `wet` draws the solid body; `dry` draws the split hairs.
 */
function brushStroke(ctx, ax, ay, bx, by, width, bow, alpha) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const cx = (ax + bx) / 2 + nx * bow
  const cy = (ay + by) / 2 + ny * bow

  // The body: a filled crescent, thick at the root, a point at the tip.
  ctx.globalAlpha = alpha
  ctx.fillStyle = INK.wet
  ctx.beginPath()
  ctx.moveTo(ax + nx * width * 0.5, ay + ny * width * 0.5)
  ctx.quadraticCurveTo(cx + nx * width * 0.42, cy + ny * width * 0.42, bx, by)
  ctx.quadraticCurveTo(cx - nx * width * 0.18, cy - ny * width * 0.18, ax - nx * width * 0.5, ay - ny * width * 0.5)
  ctx.closePath()
  ctx.fill()

  // The hairs: a few parallel strokes that break off before the tip.
  ctx.strokeStyle = INK.dry
  ctx.globalAlpha = alpha * 0.7
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const k = 0.45 + i * 0.17
    const off = (i - 1.5) * width * 0.16
    ctx.lineWidth = Math.max(0.6, width * 0.07)
    ctx.beginPath()
    ctx.moveTo(ax + nx * off, ay + ny * off)
    ctx.quadraticCurveTo(
      ax + dx * 0.55 + nx * (bow + off),
      ay + dy * 0.55 + ny * (bow + off),
      ax + dx * k + nx * (bow * 0.6 + off),
      ay + dy * k + ny * (bow * 0.6 + off),
    )
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/**
 * The ink slash thrown by a strike.
 *
 * `hit` is the same object the amber burst uses. `dir` is +1 for a blow to the
 * right. The stroke is drawn ACROSS the direction of travel, because that is
 * what the eye reads as the edge of the blow.
 */
export function drawInkSlash(ctx, hit, scale = 1) {
  const life = Math.max(0, hit.life)
  const grow = 1 - life
  const power = hit.power ?? 0.6
  const dir = hit.dir ?? 1
  const size = (18 + power * 34) * scale * (0.7 + grow * 0.6)
  const alpha = Math.min(1, life * 2.0) * (0.7 + power * 0.4)

  ctx.save()
  ctx.translate(hit.x, hit.y)
  ctx.rotate(hit.angle ?? -0.5)
  ctx.scale(dir, 1)

  // The main stroke, swept through the contact point. Thinner than before:
  // this is an accent on the hit, not a curtain over it.
  brushStroke(ctx, -size * 0.9, size * 0.35, size * 0.95, -size * 0.3, size * 0.33, size * 0.4, alpha)

  // The crossing cut, only on a blow heavy enough to earn it.
  if (power > 0.78) {
    brushStroke(ctx, -size * 0.25, -size * 0.8, size * 0.5, size * 0.85, size * 0.16, -size * 0.28, alpha * 0.55)
  }

  // Splatter: blots flying along the blow, shrinking as they go.
  ctx.fillStyle = INK.wet
  const blots = 4 + Math.round(power * 4)
  for (let i = 0; i < blots; i++) {
    const t = (i + 1) / blots
    const a = (i * 2.399) % (Math.PI * 2)
    const r = size * (0.9 + t * 1.5)
    const x = Math.cos(a) * r * 0.7 + size * t * 1.4
    const y = Math.sin(a) * r * 0.55
    const rad = Math.max(0.7, size * 0.11 * (1 - t * 0.7))
    ctx.globalAlpha = alpha * (1 - t * 0.55)
    ctx.beginPath()
    ctx.ellipse(x, y, rad, rad * 0.7, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // (The red seal is gone: on a pale office wall a hard red square read as a
  // UI element pasted over the art, not as a painter's stamp.)

  ctx.restore()
}

/**
 * A wuxia "qi" ring: the circular shockwave a master's blow leaves, drawn as a
 * broken brush circle rather than a vector ring.
 */
export function drawQiRing(ctx, hit, scale = 1) {
  const life = Math.max(0, hit.life)
  if (life <= 0.02) return
  const grow = 1 - life
  const r = (18 + grow * 52) * scale
  ctx.save()
  ctx.translate(hit.x, hit.y)
  ctx.globalAlpha = Math.min(1, life * 2) * 0.38
  ctx.strokeStyle = INK.wet
  ctx.lineCap = 'round'
  // Four arcs with gaps: a circle drawn by hand, not by a compass.
  for (let i = 0; i < 4; i++) {
    const a0 = i * (Math.PI / 2) + 0.18
    ctx.lineWidth = (2.2 - i * 0.4) * (0.4 + life)
    ctx.beginPath()
    ctx.arc(0, 0, r * (1 - i * 0.02), a0, a0 + 1.05)
    ctx.stroke()
  }
  ctx.restore()
}

/* ------------------------------------------------------------- bubbles --- */

/**
 * A speech bubble over a fighter's head.
 *
 * The bubble has to work at a glance during a fight, which rules out a chat
 * window: a small rounded box, a tail pointing at the head, one name, one line.
 * The name is what makes two fighters talking readable — without it the barks
 * are just text appearing at random.
 *
 * `mood` tints the border: `smug` and `smooth` (the opponent's default) get a
 * warm edge, `hard` a red one, `tired` a cool one. That is the entire
 * characterisation budget — anything more and the bubble competes with the
 * fight it is describing.
 */
export function drawBubble(ctx, line, name, headX, headY, scale = 1) {
  if (!line || line.life <= 0.01) return
  const life = Math.max(0, Math.min(1, line.life))
  // Slide in over the first tenth and out over the last tenth of the life.
  const inK = Math.min(1, (1 - life) * 9)
  const outK = Math.min(1, life * 5)
  const appear = Math.min(inK, outK)
  const alpha = appear

  const fs2 = Math.max(12, 15 * scale)
  ctx.save()
  ctx.font = `600 ${fs2}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`
  const text = line.text ?? ''
  const nameText = name ?? ''
  const tw = ctx.measureText(text).width
  const padX = fs2 * 0.72
  const padY = fs2 * 0.5
  const nameH = fs2 * 1.18
  const w = tw + padX * 2
  const h = fs2 + padY * 2 + nameH

  // Anchor the bubble above the head, nudged so it never leaves the frame.
  const cx = headX
  const by = headY - 26 * scale - h
  const bx = cx - w / 2

  // Mood colours.
  const mood = line.mood ?? 'flat'
  /**
   * Mood -> border colour. Warm hues are the opponent being cheery or smooth;
   * cool ones are the player being worn down; red is a hard line being drawn.
   */
  const MOOD_EDGE = {
    hard: '#c8321e',
    warm: '#c8693f',
    cheery: '#c08a2a',
    smooth: '#c08a2a',
    airy: '#b8923f',
    tired: '#5c7d92',
    flat: '#8c949f',
    dry: '#7f8a96',
    confused: '#8a7bc0',
    baffled: '#8a7bc0',
    surprised: '#6a5cc0',
    nervous: '#8a5cc0',
    shaken: '#8a5cc0',
    beaten: '#7a8592',
  }
  const edge = MOOD_EDGE[mood] ?? '#8c949f'

  ctx.globalAlpha = alpha
  // A soft drop shadow keeps the bubble off a busy background.
  ctx.shadowColor = 'rgba(20, 24, 32, 0.28)'
  ctx.shadowBlur = 12 * scale
  ctx.shadowOffsetY = 3 * scale

  ctx.fillStyle = 'rgba(255, 253, 248, 0.97)'
  ctx.strokeStyle = edge
  ctx.lineWidth = Math.max(1.4, 1.8 * scale)
  const r = Math.min(h * 0.28, 9 * scale)
  roundRect(ctx, bx, by, w, h, r)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.stroke()

  // The tail: a triangle from the bubble's bottom toward the head.
  const tipX = Math.max(bx + r, Math.min(bx + w - r, headX))
  ctx.beginPath()
  ctx.moveTo(tipX - 7 * scale, by + h - 1)
  ctx.lineTo(tipX + 7 * scale, by + h - 1)
  ctx.lineTo(headX, headY - 10 * scale)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255, 253, 248, 0.97)'
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.stroke()

  // The name, in the mood colour.
  ctx.globalAlpha = alpha
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = edge
  ctx.font = `700 ${fs2 * 0.78}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`
  ctx.fillText(nameText, bx + padX, by + padY * 0.75)

  // The line.
  ctx.fillStyle = '#1c2128'
  ctx.font = `600 ${fs2}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`
  ctx.fillText(text, bx + padX, by + padY * 0.75 + nameH)

  ctx.restore()
}

/** A rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}
