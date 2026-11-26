/**
 * The stage: an office.
 *
 * A LIGHT stage, and that decides everything else. The reference's flat field
 * works because two silhouettes read against it; an office keeps that property
 * while giving the fight a place — a wall, a window, a row of desks, the things
 * an office is made of, drawn as clean flat shapes so they never compete with
 * a body.
 *
 * What makes an office read as an office rather than as "some furniture":
 *
 *   1. **A window wall** with a city outside — the single strongest cue, and
 *      it also gives the stage a light source.
 *   2. **A desk row** with monitors, chairs and cables: the mid-ground that
 *      says "work happened here".
 *   3. **Wall furniture**: a whiteboard, a wall clock, shelving, a door.
 *   4. **Floor**: a light floor with a subtle tile grid and a shadow band where
 *      the wall meets it.
 *   5. **Desk clutter**: mugs, papers, a plant — the small asymmetries that
 *      stop a drawn office looking like a diagram.
 *
 * Everything is drawn from a seeded generator so the room is the same every
 * round. A stage that reshuffles between frames is noise, not scenery.
 */

/** A tiny deterministic PRNG so the room is stable frame to frame. */
function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 0x100000000
  }
}

/**
 * The palette. Everything is a light, desaturated neutral with one cool accent
 * (the window) and one warm one (the lamp), so the room has depth without
 * colour of its own — the fighters must stay the only thing with contrast.
 */
const PAL = {
  ceiling: '#eef0f3',
  wallTop: '#e4e7ec',
  wallLow: '#d2d7de',
  wallShade: '#c2c8d1',
  floor: '#e8eaee',
  floorLine: '#d8dce2',
  deskTop: '#f4f5f7',
  deskEdge: '#c8ced6',
  deskSide: '#bcc3cc',
  monitor: '#3d4652',
  monitorScreen: '#8fb8c9',
  screenGlow: '#c9e6f0',
  chair: '#4a525d',
  plant: '#7d9a86',
  plantDark: '#5f7d69',
  glass: '#a8c2d1',
  city: '#93a8b6',
  cityFar: '#aebfca',
  ink: '#8c949f',
  accent: '#f0c27a',
}

export class OfficeBackdrop {
  constructor(seed = 0x0ff1ce) {
    const rng = makeRng(seed)
    this.desks = []
    this.props = []
    this.build(rng)
  }

  /** Lay out the room. */
  build(rng) {
    // Three desk stations along the back wall, spaced irregularly.
    const xs = [150, 470, 790]
    for (const x of xs) {
      const r = rng()
      this.desks.push({
        x,
        /** Where the desk sits, as a fraction of the wall height. */
        depth: 0.52 + rng() * 0.08,
        w: 150 + rng() * 40,
        monitor: r < 0.82,
        /** A chair pushed in, or rolled out. */
        chairOut: rng() < 0.45,
        /** Clutter on the desktop. */
        mug: rng() < 0.6,
        papers: rng() < 0.7,
        /** A monitor that is on, and its brightness. */
        on: rng() < 0.75,
      })
    }

    // Props scattered on the wall.
    this.props.push({ kind: 'clock', x: 620, y: 0.18, r: 26 })
    this.props.push({ kind: 'board', x: 230, y: 0.24, w: 190, h: 90 })
    this.props.push({ kind: 'shelf', x: 880, y: 0.3, w: 120 })
    this.props.push({ kind: 'door', x: 1050, y: 0.3, w: 78 })
    this.props.push({ kind: 'plant', x: 60, y: 0.62 })
    this.props.push({ kind: 'plant', x: 1000, y: 0.6 })
  }

  /**
   * Draw the room. `cam` is `{ x, y, zoom }`; everything below is in design
   * units, so the camera parallax applies to the whole thing.
   */
  draw(ctx, cam, w, h) {
    const H = 400
    const floorY = 300
    const wallY = 150

    // --- the shell -------------------------------------------------------
    // Ceiling band, wall, floor. Three tones, flat — no gradients, because the
    // reference's stage is flat and a gradient here would fight the ink.
    ctx.fillStyle = PAL.ceiling
    ctx.fillRect(0, 0, w, wallY * 0.55)
    ctx.fillStyle = PAL.wallTop
    ctx.fillRect(0, wallY * 0.55, w, wallY * 0.45)
    ctx.fillStyle = PAL.wallLow
    ctx.fillRect(0, wallY, w, floorY - wallY)
    ctx.fillStyle = PAL.floor
    ctx.fillRect(0, floorY, w, h - floorY)

    // The skirting and the shadow where the wall meets the floor: this single
    // line is what makes a flat field read as a room.
    ctx.fillStyle = PAL.wallShade
    ctx.fillRect(0, floorY - 7, w, 7)
    const sh = ctx.createLinearGradient(0, floorY, 0, floorY + 46)
    sh.addColorStop(0, 'rgba(150, 158, 170, 0.30)')
    sh.addColorStop(1, 'rgba(150, 158, 170, 0)')
    ctx.fillStyle = sh
    ctx.fillRect(0, floorY, w, 46)

    ctx.save()
    ctx.translate(w / 2, 0)
    ctx.scale(cam.zoom, cam.zoom)
    ctx.translate(-cam.x, 0)

    // --- the window wall --------------------------------------------------
    this.drawWindow(ctx, w, wallY, floorY)

    // --- wall props -------------------------------------------------------
    for (const p of this.props) this.drawProp(ctx, p, wallY, floorY)

    // --- desks ------------------------------------------------------------
    for (const d of this.desks) this.drawDesk(ctx, d, wallY, floorY)

    // --- floor tiles ------------------------------------------------------
    // A very faint grid, only on the floor: enough to show the ground plane,
    // not enough to look like graph paper.
    ctx.strokeStyle = 'rgba(160, 168, 180, 0.35)'
    ctx.lineWidth = 1
    const tile = 76
    for (let x = -400; x < 2000; x += tile) {
      ctx.beginPath()
      ctx.moveTo(x, floorY + 6)
      ctx.lineTo(x - 40, floorY + 160)
      ctx.stroke()
    }
    for (let i = 1; i < 4; i++) {
      const y = floorY + i * i * 9
      ctx.beginPath()
      ctx.moveTo(-400, y)
      ctx.lineTo(2000, y)
      ctx.stroke()
    }

    ctx.restore()
    void H
  }

  /** A window wall with a city behind it: the stage's light source. */
  drawWindow(ctx, w, wallTopY, wallBottomY) {
    const x0 = -60
    const x1 = w + 60
    const y0 = wallTopY * 0.62
    const y1 = wallBottomY - 22

    ctx.fillStyle = PAL.glass
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0)

    // The city: overlapping rectangles, far lighter, so it reads as distance.
    ctx.fillStyle = PAL.cityFar
    for (let i = 0; i < 26; i++) {
      const bx = x0 + ((i * 137) % (x1 - x0))
      const bw = 26 + ((i * 53) % 44)
      const bh = 40 + ((i * 71) % 90)
      ctx.fillRect(bx, y1 - bh, bw, bh)
    }
    ctx.fillStyle = PAL.city
    for (let i = 0; i < 18; i++) {
      const bx = x0 + ((i * 191 + 40) % (x1 - x0))
      const bw = 34 + ((i * 37) % 56)
      const bh = 26 + ((i * 97) % 64)
      ctx.fillRect(bx, y1 - bh, bw, bh)
    }

    // Mullions: the frame lines that make it read as a window rather than a
    // picture of a city.
    ctx.fillStyle = PAL.wallLow
    const pane = 210
    for (let x = x0; x < x1 + pane; x += pane) ctx.fillRect(x - 3, y0, 6, y1 - y0)
    ctx.fillRect(x0, y0 - 4, x1 - x0, 8)
    ctx.fillRect(x0, y0 + (y1 - y0) * 0.62, x1 - x0, 5)
  }

  /** Wall furniture: clock, whiteboard, shelf, door. */
  drawProp(ctx, p, wallTopY, wallBottomY) {
    const wallH = wallBottomY - wallTopY
    if (p.kind === 'clock') {
      const cy = wallTopY + wallH * p.y
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = PAL.ink
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(p.x, cy, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(p.x, cy); ctx.lineTo(p.x, cy - p.r * 0.62)
      ctx.moveTo(p.x, cy); ctx.lineTo(p.x + p.r * 0.45, cy + p.r * 0.24)
      ctx.stroke()
    } else if (p.kind === 'board') {
      const y = wallTopY + wallH * p.y
      ctx.fillStyle = '#fbfcfd'
      ctx.strokeStyle = PAL.deskEdge
      ctx.lineWidth = 2
      ctx.fillRect(p.x, y, p.w, p.h)
      ctx.strokeRect(p.x, y, p.w, p.h)
      // Scrawl: a few stroke marks, so it reads as "in use".
      ctx.strokeStyle = 'rgba(120, 130, 145, 0.55)'
      ctx.lineWidth = 1.6
      for (let i = 0; i < 4; i++) {
        const ly = y + 18 + i * 18
        ctx.beginPath()
        ctx.moveTo(p.x + 14, ly)
        ctx.lineTo(p.x + 14 + (p.w - 28) * (0.4 + ((i * 37) % 55) / 100), ly)
        ctx.stroke()
      }
    } else if (p.kind === 'shelf') {
      const y = wallTopY + wallH * p.y
      ctx.fillStyle = PAL.deskEdge
      ctx.fillRect(p.x, y, p.w, 5)
      ctx.fillRect(p.x, y + 32, p.w, 5)
      // Folders standing on it.
      for (let i = 0; i < 5; i++) {
        const fx = p.x + 8 + i * 20
        ctx.fillStyle = i % 2 ? '#d9dee5' : '#cbd2db'
        ctx.fillRect(fx, y - 22, 14, 22)
      }
    } else if (p.kind === 'door') {
      const y = wallTopY + wallH * p.y
      const dh = wallBottomY - y
      ctx.fillStyle = '#dfe3e9'
      ctx.strokeStyle = PAL.deskEdge
      ctx.lineWidth = 2
      ctx.fillRect(p.x, y, p.w, dh)
      ctx.strokeRect(p.x, y, p.w, dh)
      // A vision panel and a handle.
      ctx.fillStyle = PAL.glass
      ctx.fillRect(p.x + 14, y + 16, p.w - 28, dh * 0.32)
      ctx.fillStyle = PAL.ink
      ctx.beginPath(); ctx.arc(p.x + p.w - 12, y + dh * 0.55, 3, 0, Math.PI * 2); ctx.fill()
    } else if (p.kind === 'plant') {
      const baseY = wallBottomY + (p.y - 0.6) * 120 + 40
      // Pot.
      ctx.fillStyle = '#c9b8a4'
      ctx.beginPath()
      ctx.moveTo(p.x - 14, baseY - 26)
      ctx.lineTo(p.x + 14, baseY - 26)
      ctx.lineTo(p.x + 10, baseY)
      ctx.lineTo(p.x - 10, baseY)
      ctx.closePath()
      ctx.fill()
      // Leaves: a few blades, darker than the floor.
      ctx.fillStyle = PAL.plant
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.32
        const len = 34 + (i % 3) * 12
        ctx.beginPath()
        ctx.ellipse(
          p.x + Math.cos(a) * len * 0.5,
          baseY - 26 + Math.sin(a) * len * 0.5,
          len * 0.36, len * 0.16, a, 0, Math.PI * 2,
        )
        ctx.fill()
      }
      ctx.fillStyle = PAL.plantDark
      ctx.beginPath()
      ctx.ellipse(p.x, baseY - 30, 12, 18, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** One desk station: top, legs, monitor, chair, clutter. */
  drawDesk(ctx, d, wallTopY, wallBottomY) {
    const wallH = wallBottomY - wallTopY
    // Behind the fighters: high enough to sit against the wall, low enough
    // that a body in front of it reads clearly.
    const topY = 236
    const w = d.w
    const x = d.x

    // Chair behind the desk, if it is pushed in.
    if (!d.chairOut) {
      ctx.fillStyle = PAL.chair
      ctx.fillRect(x + w * 0.34, topY - 34, 46, 30)
      ctx.fillRect(x + w * 0.48, topY - 8, 6, 12)
    } else {
      ctx.fillStyle = PAL.chair
      ctx.fillRect(x + w * 0.72, topY + 4, 40, 26)
      ctx.fillRect(x + w * 0.84, topY + 30, 6, 16)
    }

    // Desk top and its front edge.
    ctx.fillStyle = PAL.deskTop
    ctx.fillRect(x, topY, w, 10)
    ctx.fillStyle = PAL.deskEdge
    ctx.fillRect(x, topY + 10, w, 4)
    // Legs.
    ctx.fillStyle = PAL.deskSide
    ctx.fillRect(x + 8, topY + 14, 6, 44)
    ctx.fillRect(x + w - 14, topY + 14, 6, 44)

    // Monitor.
    if (d.monitor) {
      const mw = 62
      const mh = 40
      const mx = x + w * 0.28
      const my = topY - mh - 12
      // Stand.
      ctx.fillStyle = PAL.desktop || PAL.deskSide
      ctx.fillRect(mx + mw / 2 - 4, my + mh, 8, 12)
      ctx.fillRect(mx + mw / 2 - 14, my + mh + 10, 28, 4)
      // Bezel and screen.
      ctx.fillStyle = PAL.monitor
      ctx.fillRect(mx, my, mw, mh)
      ctx.fillStyle = d.on ? PAL.monitorScreen : '#4a525d'
      ctx.fillRect(mx + 4, my + 4, mw - 8, mh - 8)
      if (d.on) {
        // A few rows of "text" on the screen, lighter than the screen itself.
        ctx.fillStyle = PAL.screenGlow
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(mx + 8, my + 9 + i * 6, (mw - 20) * (0.45 + ((i * 29) % 50) / 100), 2.4)
        }
      }
    }

    // A shadow under the desk seats it on the floor.
    ctx.fillStyle = 'rgba(150, 158, 170, 0.16)'
    ctx.fillRect(x + 4, topY + 58, w - 8, 6)

    // Clutter on the desktop.
    if (d.mug) {
      ctx.fillStyle = '#fbfcfd'
      ctx.strokeStyle = PAL.deskEdge
      ctx.lineWidth = 1.6
      const gx = x + w * 0.72
      ctx.fillRect(gx, topY - 12, 11, 12)
      ctx.beginPath()
      ctx.arc(gx + 13, topY - 6, 4, -1.2, 1.2)
      ctx.stroke()
    }
    if (d.papers) {
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = PAL.deskEdge
      ctx.lineWidth = 1
      const px = x + w * 0.55
      ctx.save()
      ctx.translate(px, topY - 3)
      ctx.rotate(-0.08)
      ctx.fillRect(0, -7, 26, 7)
      ctx.strokeRect(0, -7, 26, 7)
      ctx.restore()
    }
  }
}


// ---------------------------------------------------------------------------
// The floor is where the fight happens, so it gets its own light treatment.
// ---------------------------------------------------------------------------

/**
 * A light floor needs the opposite of a dark stage's treatment: instead of a
 * rim to lift the figures off black, the figures get a SHADOW to seat them on
 * the floor, and the white fighter gets an outline so it does not dissolve.
 */
export function drawFloorShadow(ctx, x, groundY, width, alpha = 0.16) {
  const g = ctx.createRadialGradient(x, groundY, 0, x, groundY, width)
  g.addColorStop(0, `rgba(60, 68, 82, ${alpha})`)
  g.addColorStop(1, 'rgba(60, 68, 82, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x, groundY + 2, width, width * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
}
