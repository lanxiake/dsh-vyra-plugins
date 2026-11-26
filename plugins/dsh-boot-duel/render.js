/**
 * DEPRECATED — superseded by js/rig.js and js/render.js.
 *
 * This is the previous engine: keyframed pose tables and axis-aligned hit
 * boxes. It is kept only because the older test suite still exercises it;
 * nothing in the shipped bundle imports this file. New work belongs in js/.
 */

/**
 * dsh-boot-duel — browser-only half.
 *
 *   createAudio({ AudioContextCtor })          synthesised sound + CC0 samples
 *   createLoop({ now, raf, cancelRaf, step })  fixed-timestep frame loop
 *   createRenderer(canvas, ctx2d)              Canvas 2D drawing from a snapshot
 *
 * Everything here is plain ESM with no DOM access at module scope, so
 * `node --test` can import it and drive the audio and loop with fakes.
 *
 * ART DIRECTION. Measured off the reference (BV1mg41127tC), not guessed — the
 * numbers here came from dumping the video's frames to raw greyscale and
 * reading them, because "looks roughly like it" is not a measurement:
 *
 *   1. **One flat stage.** A single grey field (#9a9a9a) filling the frame. No
 *      horizon line, no gradient, no ground shadow, no texture, no vignette,
 *      no grain. I sampled 86 reference frames and 81 had exactly one
 *      background tone.
 *   2. **Two flat silhouettes.** Pure #000000 and #FFFFFF, no shade tone, no
 *      outline. Every limb is the same stroke weight (~1/16 of the figure)
 *      with round caps, and the head is a plain circle 1/5 of the height.
 *      Depth is carried only by which limb overlaps which.
 *   3. **One colour, and only in the hit.** The impact is a compact spiked
 *      burst in saturated amber (#FFC000) lasting about three frames. Nothing
 *      else in the frame is coloured. No damage numbers.
 *   4. **The whole body moves.** The reference's fighters lean, travel and
 *      plant their feet; the pose tables in `rig.js` are built that way. Smears
 *      come from the limb's own previous position, never from a ghost body.
 *
 * A static wide shot: the reference's stage rectangle does not move during an
 * exchange. The camera here only keeps both fighters in frame.
 */

import { RIG, poseJoints } from './rig.js'
import { ARENA } from './sim/constants.mjs'

/* ------------------------------------------------------------------ audio */

/**
 * Two layers: real CC0 recordings when the host serves them, synthesised
 * fallback otherwise. A missing sample must never be a missing sound.
 */
export function createAudio({
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  sampleBase = '/plugins/dsh-boot-duel/sfx/',
  fetchImpl = globalThis.fetch,
} = {}) {
  let context = null
  let muted = true
  let unavailable = AudioContextCtor === undefined || AudioContextCtor === null
  /** name -> AudioBuffer, or null once loading failed. */
  const buffers = new Map()
  let master = null

  const SAMPLES = {
    hit: ['impactpunch-medium-000.ogg', 'impactpunch-medium-001.ogg'],
    heavy: ['impactpunch-heavy-000.ogg', 'impactpunch-heavy-001.ogg', 'impactpunch-heavy-002.ogg'],
    metal: ['impactmetal-heavy-000.ogg', 'impactmetal-light-000.ogg'],
    cloth: ['cloth1.ogg', 'cloth2.ogg', 'cloth3.ogg'],
  }

  function ensureContext() {
    if (context || unavailable) return context
    try {
      context = new AudioContextCtor()
      master = context.createGain()
      master.gain.value = 0.9
      master.connect(context.destination)
      if (context.state === 'suspended' && typeof context.resume === 'function') {
        context.resume().catch(() => {})
      }
    } catch (error) {
      unavailable = true
      context = null
      console.error('[dsh-boot-duel] audio unavailable, continuing silently:', String(error?.message ?? error))
    }
    return context
  }

  /**
   * Fetch every sample once, lazily, after the first gesture. Failures are
   * recorded as null so the synthesiser takes over for that cue.
   */
  let prefetched = false
  function prefetch() {
    if (prefetched) return
    prefetched = true
    const ctx = context
    if (!ctx || typeof fetchImpl !== 'function' || typeof ctx.decodeAudioData !== 'function') return
    for (const [name, files] of Object.entries(SAMPLES)) {
      files.forEach((file, index) => {
        const key = index === 0 ? name : `${name}${index}`
        fetchImpl(`${sampleBase}${file}`, { cache: 'force-cache' })
          .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
          .then((bytes) => ctx.decodeAudioData(bytes))
          .then((buffer) => { buffers.set(key, buffer) })
          .catch(() => { buffers.set(key, null) })
      })
    }
  }

  function playSample(name) {
    const ctx = context
    if (!ctx || !master) return false
    const keys = [name, `${name}1`, `${name}2`].filter((key) => buffers.get(key))
    if (keys.length === 0) return false
    const buffer = buffers.get(keys[Math.floor(Math.random() * keys.length)])
    try {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      // A little pitch variance keeps repeated hits from sounding looped.
      source.playbackRate.value = 0.92 + Math.random() * 0.18
      const amp = ctx.createGain()
      amp.gain.value = 0.72
      source.connect(amp).connect(master)
      source.start()
      return true
    } catch {
      return false
    }
  }

  function tone({ frequency, type, duration, gain, sweepTo, delay = 0 }) {
    const ctx = context
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const at = ctx.currentTime + delay
    osc.type = type
    osc.frequency.setValueAtTime(frequency, at)
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, at + duration)
    amp.gain.setValueAtTime(0.0001, at)
    amp.gain.exponentialRampToValueAtTime(gain, at + duration * 0.12)
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    osc.connect(amp).connect(master ?? ctx.destination)
    osc.start(at)
    osc.stop(at + duration + 0.02)
  }

  function noise({ duration, gain, filterFrequency, delay = 0, type = 'lowpass' }) {
    const ctx = context
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const amp = ctx.createGain()
    const at = ctx.currentTime + delay
    amp.gain.setValueAtTime(gain, at)
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    let tail = source
    if (filterFrequency && ctx.createBiquadFilter) {
      const filter = ctx.createBiquadFilter()
      filter.type = type
      filter.frequency.setValueAtTime(filterFrequency, at)
      tail = source.connect(filter)
    }
    tail.connect(amp).connect(master ?? ctx.destination)
    source.start(at)
    source.stop(at + duration)
  }

  /**
   * The synthesised fallback. Each cue keeps the shape of the recorded
   * original, so a failed sample load still sounds like a hit, not like a beep.
   */
  const SYNTH = {
    whoosh: () => {
      noise({ duration: 0.17, gain: 0.09, filterFrequency: 3400, type: 'highpass' })
      noise({ duration: 0.1, gain: 0.05, filterFrequency: 1500, type: 'bandpass', delay: 0.02 })
    },
    /** Body blow: the low thump plus the crack on top. */
    hit: () => {
      tone({ frequency: 118, sweepTo: 44, type: 'square', duration: 0.2, gain: 0.28 })
      tone({ frequency: 70, sweepTo: 32, type: 'sine', duration: 0.3, gain: 0.24 })
      noise({ duration: 0.05, gain: 0.22, filterFrequency: 5000, type: 'highpass' })
    },
    heavy: () => {
      tone({ frequency: 96, sweepTo: 28, type: 'sawtooth', duration: 0.34, gain: 0.3 })
      tone({ frequency: 880, sweepTo: 500, type: 'triangle', duration: 0.24, gain: 0.09, delay: 0.01 })
      noise({ duration: 0.09, gain: 0.26, filterFrequency: 6200, type: 'highpass' })
    },
    counter: () => {
      tone({ frequency: 92, sweepTo: 26, type: 'sawtooth', duration: 0.4, gain: 0.32 })
      tone({ frequency: 1240, sweepTo: 700, type: 'triangle', duration: 0.28, gain: 0.11, delay: 0.01 })
      noise({ duration: 0.1, gain: 0.28, filterFrequency: 7000, type: 'highpass' })
    },
    /** A guard: metal on metal. */
    clink: () => {
      tone({ frequency: 2100, sweepTo: 1750, type: 'sine', duration: 0.14, gain: 0.13 })
      tone({ frequency: 3150, sweepTo: 2600, type: 'sine', duration: 0.1, gain: 0.07, delay: 0.01 })
      noise({ duration: 0.04, gain: 0.1, filterFrequency: 4200, type: 'highpass' })
    },
    boom: () => {
      tone({ frequency: 88, sweepTo: 22, type: 'sine', duration: 0.8, gain: 0.42 })
      tone({ frequency: 55, sweepTo: 18, type: 'triangle', duration: 0.95, gain: 0.3 })
      noise({ duration: 0.5, gain: 0.22, filterFrequency: 420 })
      noise({ duration: 0.09, gain: 0.3, filterFrequency: 5200, type: 'highpass' })
    },
    crash: () => {
      tone({ frequency: 400, sweepTo: 60, type: 'sawtooth', duration: 0.4, gain: 0.2 })
      tone({ frequency: 260, sweepTo: 48, type: 'square', duration: 0.34, gain: 0.14 })
      noise({ duration: 0.3, gain: 0.16, filterFrequency: 1200 })
    },
    /** The bell that opens the round. */
    gong: () => {
      tone({ frequency: 208, sweepTo: 188, type: 'sine', duration: 1.5, gain: 0.24 })
      tone({ frequency: 314, sweepTo: 284, type: 'sine', duration: 1.15, gain: 0.12, delay: 0.02 })
      tone({ frequency: 468, sweepTo: 440, type: 'sine', duration: 0.9, gain: 0.07, delay: 0.04 })
      noise({ duration: 0.22, gain: 0.05, filterFrequency: 900 })
    },
    select: () => tone({ frequency: 660, sweepTo: 990, type: 'triangle', duration: 0.1, gain: 0.1 }),
    special: () => {
      // A rising sweep into a deep boom: the finisher's announcement.
      tone({ frequency: 140, sweepTo: 900, type: 'sawtooth', duration: 0.5, gain: 0.14 })
      tone({ frequency: 70, sweepTo: 24, type: 'sine', duration: 1.2, gain: 0.4, delay: 0.42 })
      noise({ duration: 0.7, gain: 0.2, filterFrequency: 700, delay: 0.42 })
    },
    whiff: () => noise({ duration: 0.26, gain: 0.09, filterFrequency: 2000, type: 'bandpass' }),
  }

  /** Cues that prefer a real recording, and which one. */
  const SAMPLE_FOR = {
    hit: 'hit',
    thud: 'hit',
    heavy: 'heavy',
    counter: 'heavy',
    clink: 'metal',
    whoosh: 'cloth',
  }

  return {
    isMuted: () => muted,

    available: () => !unavailable,

    setMuted(next) {
      muted = Boolean(next)
      if (!muted) {
        ensureContext()
        prefetch()
      }
    },

    /** Assets are fetched lazily; callers may warm them early. */
    warm() {
      if (!muted) { ensureContext(); prefetch() }
    },

    /** True once at least one recorded sample decoded. */
    hasSamples: () => [...buffers.values()].some(Boolean),

    /** Fire one named sound. Unknown names and failures are ignored. */
    play(sound) {
      if (muted || unavailable) return
      if (!ensureContext()) return
      try {
        const sample = SAMPLE_FOR[sound]
        if (sample && playSample(sample)) return
        const make = SYNTH[sound]
        if (make) make()
      } catch (error) {
        // A broken audio node must never take the fight down with it.
        console.error(`[dsh-boot-duel] sound "${sound}" failed:`, String(error?.message ?? error))
      }
    },
  }
}

/* ------------------------------------------------------------------- loop */

/** Catch-up cap: a long stall must not fast-forward the whole fight. */
const MAX_STEPS_PER_FRAME = 5

/**
 * Fixed-timestep loop. The same elapsed time produces the same number of
 * `step` calls at 30 Hz, 144 Hz, or anything in between, which is what keeps
 * the frame windows in `MOVES` meaningful on every display.
 */
export function createLoop({
  now = () => (globalThis.performance?.now?.() ?? Date.now()),
  raf = (fn) => globalThis.requestAnimationFrame(fn),
  cancelRaf = (handle) => globalThis.cancelAnimationFrame(handle),
  fixedStepMs = 1000 / 60,
  step = () => {},
  onError = null,
} = {}) {
  let handle = null
  let running = false
  let stopped = false
  let accumulator = 0
  let last = 0

  function advance(elapsedMs) {
    accumulator += Math.max(0, Math.min(elapsedMs, 250))
    let steps = 0
    while (accumulator >= fixedStepMs && steps < MAX_STEPS_PER_FRAME) {
      try {
        step()
      } catch (error) {
        // One failure ends the loop for good: a renderer that cannot draw will
        // not recover, and the caller unmounts the layer on this signal.
        stopped = true
        accumulator = 0
        if (onError) onError(error)
        else console.error('[dsh-boot-duel] frame step failed:', String(error?.message ?? error))
        return
      }
      accumulator -= fixedStepMs
      steps++
    }
  }

  function frame(timestamp) {
    if (!running || stopped) return
    advance(timestamp - last)
    last = timestamp
    if (running && !stopped) handle = raf(frame)
  }

  return {
    start() {
      if (running || stopped) return
      running = true
      last = now()
      accumulator = 0
      handle = raf(frame)
    },

    stop() {
      running = false
      if (handle !== null) {
        try { cancelRaf(handle) } catch { /* a stale handle is harmless */ }
        handle = null
      }
    },

    isRunning: () => running && !stopped,

    /** True once a `step` threw: the caller must tear the layer down. */
    isBroken: () => stopped,

    /**
     * Drive `frameCount` display frames of `frameMs` each without a real
     * clock. Used by tests to prove 30 Hz and 144 Hz tick alike.
     */
    ticks(frameCount, frameMs) {
      for (let i = 0; i < frameCount && !stopped; i++) advance(frameMs)
      return this
    },
  }
}

/** Particles are capped so a low-end machine never drowns in draw calls. */
export function particleLimit() {
  return 300
}

/* ---------------------------------------------------------------- palette */

/**
 * The stage. Measured off the reference art (BV1mg41127tC): the background is
 * a **dead flat mid-grey** (sampled at 0x99) filling the whole stage — no
 * horizon, no gradient, no ground shadow, no texture, no vignette. The
 * fighters are flat single-colour silhouettes, one pure black and one pure
 * white. The only colour anywhere in the frame is the impact burst, which is a
 * saturated amber (#FFC000).
 *
 * That discipline is the whole art direction. Every non-flat thing I add here
 * competes with the silhouettes, and the silhouettes are the fight.
 */
const INK = {
  /** The one stage tone. Sampled straight off the reference. */
  stage: '#9a9a9a',
  /** The fighters. Pure, so the edges read hard against the grey. */
  white: '#ffffff',
  black: '#000000',
  /** The impact. The only colour in the frame, in the reference too. */
  impact: '#ffc000',
  impactHot: '#fff0b8',
  /** Damage/glyph text, tinted to the same amber family. */
  gold: '#ffcf6a',
  flash: '#fffdf5',
  /** Retained for the KO flash and the finisher's ink. */
  inkDark: '#0a0a0a',
  paper: '#f2ede4',
}

/* --------------------------------------------------------------- renderer */

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const lerp = (a, b, t) => a + (b - a) * t

/** `#rrggbb` + alpha -> `rgba()`; anything else is returned as given. */
function hexA(hex, alpha) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const v = hex.slice(1)
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** A tapered capsule: the engine's `limb()`, which holds weight at any size. */
export function capsule(ctx, from, to, widthFrom, widthTo, colour) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const a = widthFrom / 2
  const b = widthTo / 2
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(from[0] + nx * a, from[1] + ny * a)
  ctx.lineTo(to[0] + nx * b, to[1] + ny * b)
  ctx.arc(to[0], to[1], b, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true)
  ctx.lineTo(from[0] - nx * a, from[1] - ny * a)
  ctx.arc(from[0], from[1], a, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true)
  ctx.closePath()
  ctx.fill()
}

/**
 * Limb widths in rig units, against a 640-unit figure.
 *
 * Measured off the reference art: the limb stroke is ~1/16 of the figure's
 * height (17px on a 304px figure), and it is **constant width** — the
 * reference does not taper limbs, it uses the same round-capped stroke from
 * shoulder to fingertip. So `thigh == knee`, `upperArm == elbow == wrist`, and
 * the only narrowing is at the ankle where the foot meets the floor.
 *
 * The torso is barely wider than one stroke either: the reference's silhouette
 * is a stick figure with a disc for a head, not a body builder.
 */
const WIDTH = Object.freeze({
  thigh: 40,
  knee: 40,
  ankle: 30,
  upperArm: 40,
  elbow: 40,
  wrist: 32,
  torsoHip: 46,
  torsoChest: 50,
  shoulder: 44,
  neck: 34,
})

/**
 * Canvas 2D renderer. It reads a snapshot and draws; it owns no state the
 * fight depends on, so a drawing bug can only look wrong, never change the
 * outcome.
 */
export function createRenderer(canvas, ctx2d) {
  let cssWidth = 0
  let cssHeight = 0
  let dpr = 1
  let scale = 1
  let offsetX = 0
  let offsetY = 0

  /** Smoothed camera state, in world coordinates. */
  const cam = { x: 480, y: 240, zoom: 3.4, turn: 0, focus: 1 }
  let lastClock = 0
  /**
   * The previous frame's poses, per side. A smear is drawn from where a limb
   * *was* to where it is now; a trail that only translates the whole body is
   * the cheapest-looking thing in stick animation, and this is the fix.
   */
  const ghosts = { player: null, enemy: null }

  function resize(width, height, ratio = 1) {
    cssWidth = Math.max(1, Math.floor(width))
    cssHeight = Math.max(1, Math.floor(height))
    dpr = Math.max(1, Math.min(3, Number.isFinite(ratio) ? ratio : 1))
    if (canvas) {
      canvas.width = Math.floor(cssWidth * dpr)
      canvas.height = Math.floor(cssHeight * dpr)
    }
  }

  /**
   * Design space is 960x400 (`ARENA`); fit it into the viewport keeping the
   * aspect ratio so nothing is cropped on wide or tall windows.
   */
  function fit(viewWidth, viewHeight, designWidth = 960, designHeight = 400) {
    scale = Math.min(viewWidth / designWidth, viewHeight / designHeight)
    offsetX = (viewWidth - designWidth * scale) / 2
    offsetY = (viewHeight - designHeight * scale) / 2
    return scale
  }

  /* ---------------------------------------------------------- the world */

  /**
   * The stage, and that is the whole set.
   *
   * The reference is one flat grey rectangle filling the frame. Nothing else:
   * no horizon line, no floor gradient, no contact shadow, no paper streaks,
   * no vignette, no grain. I measured the reference's background at 24fps
   * across the whole video and 81 of 86 sampled frames had a single tone;
   * the ones that differed were impact frames where the burst itself tinted
   * the field.
   *
   * The temptation is to add "atmosphere". Resist it: every added element
   * lowers the contrast the silhouettes are drawn against, and in a fight
   * drawn in two colours the contrast *is* the legibility.
   */
  function paintStage(ctx) {
    ctx.fillStyle = INK.stage
    ctx.fillRect(-800, -600, 2600, 1600)
  }

  /* ----------------------------------------------------------- the rigs */

  /**
   * Draw one joint chain as a tapered silhouette. A single colour per limb is
   * the reference's look: one flat black arm reads harder than a gradient.
   */
  function drawLimbChain(ctx, points, widths, colour) {
    for (let i = 0; i < points.length - 1; i++) {
      capsule(ctx, points[i], points[i + 1], widths[i], widths[i + 1], colour)
    }
  }

  /**
   * A smeared limb: the fan swept between the previous joint position and the
   * current one, painted as three tapering strokes behind the limb. Only fast
   * limbs get this, and its opacity falls off with the smear length.
   */
  function paintSmear(ctx, from, to, width, colour, alpha) {
    if (alpha <= 0.02 || !from) return
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const speed = Math.hypot(dx, dy)
    if (speed < 6) return
    // Perpendicular offset: a fan of three arcs from the start joint, fanning
    // out to the end joint, which is what a fast sweep actually looks like.
    const nx = -dy / speed
    const ny = dx / speed
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = colour
    ctx.lineCap = 'round'
    for (const [k, w, a] of [[0.34, 1, 1], [0.62, 0.62, 0.8], [0.88, 0.34, 0.55]]) {
      ctx.globalAlpha = alpha * a
      ctx.lineWidth = width * w
      ctx.beginPath()
      ctx.moveTo(from[0], from[1])
      ctx.quadraticCurveTo(
        from[0] + dx * 0.5 + nx * speed * 0.16,
        from[1] + dy * 0.5 + ny * speed * 0.16,
        from[0] + dx * k,
        from[1] + dy * k,
      )
      ctx.stroke()
    }
    ctx.restore()
  }

  /**
   * One fighter. The caller supplies the joint table from `rig.js`; this only
   * draws, so a posing bug stays a visual bug.
   *
   * `ink` is `'black'` or `'white'` — the reference pairs the two fighters as
   * opposite silhouettes, which is why neither wears a colour.
   */
  function paintFighter(ctx, fighter, joints, ink, { ghost = 0, previous = null } = {}) {
    const k = joints.scale ?? RIG.scale
    const body = ink === 'white' ? INK.white : INK.black
    const colour = ghost > 0 ? hexA(body, 0.34) : body
    ctx.globalAlpha = ghost > 0 ? ghost : 1
    // `rig.js` returns a pose in the fighter's own frame; this is the one
    // place that puts it in the world. A missing translate here is why the
    // fighters once drew at the arena origin.
    ctx.save()
    ctx.translate(fighter.x, fighter.y)

    // --- smears -------------------------------------------------------
    // Drawn under the body, from the previous frame's joint positions, so a
    // fast arm paints the arc it travelled instead of teleporting.
    if (previous && ghost === 0) {
      paintSmear(ctx, previous.handBack, joints.handBack, WIDTH.wrist * k, colour, 0.22)
      paintSmear(ctx, previous.footBack, joints.footBack, WIDTH.ankle * k, colour, 0.2)
      paintSmear(ctx, previous.handFront, joints.handFront, WIDTH.wrist * k, colour, 0.3)
      paintSmear(ctx, previous.footFront, joints.footFront, WIDTH.ankle * k, colour, 0.26)
    }

    // --- back limbs ---------------------------------------------------
    // Same colour as the front limbs. The reference does not shade its far
    // limbs — depth is carried entirely by which limb overlaps which, and a
    // second tone turns a two-colour silhouette into a grey mass at fight
    // speed.
    drawLimbChain(ctx,
      [joints.hip, joints.kneeBack, joints.footBack],
      [WIDTH.thigh * k, WIDTH.knee * k, WIDTH.ankle * k], colour)
    drawLimbChain(ctx,
      [joints.shoulderBack, joints.elbowBack, joints.handBack],
      [WIDTH.upperArm * k, WIDTH.elbow * k, WIDTH.wrist * k], colour)

    // --- torso --------------------------------------------------------
    // A thick wedge from the hips to the shoulders, then a short neck. The
    // reference's torso is nearly as wide as the head is across.
    capsule(ctx, joints.hip, joints.chest, WIDTH.torsoHip * k, WIDTH.torsoChest * k, colour)
    capsule(ctx, joints.chest, joints.neck, WIDTH.shoulder * k, WIDTH.neck * k, colour)
    capsule(ctx, joints.neck, joints.head, WIDTH.neck * k, WIDTH.neck * 0.9 * k, colour)

    // --- front limbs --------------------------------------------------
    drawLimbChain(ctx,
      [joints.hip, joints.kneeFront, joints.footFront],
      [WIDTH.thigh * k, WIDTH.knee * k, WIDTH.ankle * k], colour)
    drawLimbChain(ctx,
      [joints.shoulderFront, joints.elbowFront, joints.handFront],
      [WIDTH.upperArm * k, WIDTH.elbow * k, WIDTH.wrist * k], colour)

    // Fist: the striking hand reads slightly larger.
    const fistR = WIDTH.wrist * 0.62 * k + Math.min(5 * k, joints.strain)
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.arc(joints.handFront[0], joints.handFront[1], fistR, 0, Math.PI * 2)
    ctx.fill()

    // --- head ---------------------------------------------------------
    // A solid disc, a clean circle, 1/5 of the figure. The reference head is
    // a perfect circle and nothing else — no face, no topknot, no hair. A
    // decoration on the crown reads as an antenna at any size and pulls the
    // eye off the limbs.
    const headR = joints.headRadius ?? RIG.headRadius * k
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.arc(joints.head[0], joints.head[1], headR, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
    ctx.globalAlpha = 1
  }

  /**
   * Shadow under a fighter's feet.
   *
   * The reference draws **no** ground shadow — the silhouettes sit directly on
   * the flat field. That is only readable when the feet are actually on the
   * floor; during a jump it leaves the fighter floating. So this is drawn only
   * while airborne, purely as a landing cue, and it is deliberately tiny.
   */
  function paintGroundShadow(ctx, fighter) {
    const lift = Math.max(0, ARENA.ground - fighter.y)
    if (lift <= 2) return
    const squash = Math.max(0.3, 1 - lift / 130)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.16 * squash})`
    ctx.beginPath()
    ctx.ellipse(fighter.x, ARENA.ground + 1, 26 * squash, 4 * squash, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  /** The ragdoll: six point masses, drawn as ink with the same silhouette. */
  function paintRagdoll(ctx, snapshot, ink) {
    const body = ink === 'white' ? INK.white : INK.black
    const points = snapshot.points
    for (const [a, b] of snapshot.constraints) {
      const from = points[a]
      const to = points[b]
      if (!from || !to) continue
      capsule(ctx, [from.x, from.y], [to.x, to.y], 26, 18, body)
    }
    const head = points.find((p) => p.name === 'head')
    if (head) {
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(head.x, head.y, RIG.headRadius * RIG.scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /* ---------------------------------------------------------- the effects */

  /**
   * The slash arc: a short white crescent swept through the contact point.
   *
   * The reference does not draw a separate slash — it draws a spiked burst.
   * Kept, but small and brief, because it is what sells the *direction* of the
   * strike in a single frame; the burst alone tells you where but not which
   * way the blow was travelling.
   */
  function paintSlash(ctx, impact) {
    if (!impact) return
    const life = clamp01(impact.life)
    const appear = Math.min(1, (1 - life) / 0.16)
    const alpha = life * (impact.blocked ? 0.3 : 0.7)
    const spread = 0.4 + appear * 0.5
    const dir = impact.facing >= 0 ? 1 : -1

    ctx.save()
    ctx.translate(impact.x, impact.y)
    ctx.scale(dir, 1)
    ctx.rotate(-0.5 + (1 - life) * 0.2)
    const scaleUp = impact.special ? 2.1 : 1
    for (const [radius, width, a] of [[34, 5, 1], [44, 2.4, 0.6]]) {
      ctx.strokeStyle = hexA(INK.impactHot, alpha * a)
      ctx.globalAlpha = 1
      ctx.lineCap = 'round'
      ctx.lineWidth = width * (0.6 + appear * 0.4) * scaleUp
      ctx.beginPath()
      ctx.arc(0, 0, radius * scaleUp * (0.85 + appear * 0.2), -spread, spread)
      ctx.stroke()
    }
    ctx.restore()
  }

  /**
   * The impact glyph: an amber spiked burst, and nothing else.
   *
   * Measured off the reference: the hit effect is a compact radial star of
   * tapered amber spikes (#FFC000) roughly one third of a body height across,
   * with a white-hot core, lasting about three frames. It is the **only**
   * colour in the frame, which is exactly why it lands — the eye has been
   * trained by a grey field and two monochrome figures.
   *
   * The reference draws no damage numbers and no text on a hit. Ours did; they
   * were the single biggest thing making the fight read as a game UI pasted
   * over an animation rather than as an animation.
   */
  function paintImpactGlyph(ctx, impact) {
    if (!impact) return
    const life = clamp01(impact.life)
    const grow = 1 - life
    const alpha = Math.min(1, life * 2.2)
    const big = impact.special ? 1.9 : (impact.counter ? 1.25 : 1)
    const amber = impact.blocked ? '#cfd8e0' : INK.impact

    ctx.save()
    ctx.translate(impact.x, impact.y)

    // Spikes first, so the bright core sits on top of their roots. Irregular
    // lengths: a symmetric star reads as a stock asset, a ragged one reads as
    // drawn by hand.
    const spikes = impact.counter ? 11 : 8
    ctx.lineCap = 'round'
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2 + hash(i * 3.1) * 0.7
      const len = (26 + hash(i * 7.7) * 30) * (0.55 + life * 0.65) * big
      ctx.strokeStyle = hexA(amber, 0.92 * alpha)
      ctx.lineWidth = (3.2 + hash(i * 5.3) * 3.4) * (0.45 + life) * big
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4)
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
      ctx.stroke()
    }

    // Solid amber core, then the white-hot centre.
    ctx.fillStyle = hexA(amber, 0.9 * alpha)
    ctx.beginPath()
    ctx.arc(0, 0, (9 + grow * 9) * big, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = hexA(INK.impactHot, alpha)
    ctx.beginPath()
    ctx.arc(0, 0, (4.5 + grow * 3) * big, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** Sparks, dust and ink blots. */
  function paintParticles(ctx, particles) {
    for (const p of particles) {
      const life = clamp01(p.life)
      if (p.mode === 'ink') {
        ctx.globalAlpha = life * 0.6
        ctx.fillStyle = 'rgba(18, 16, 20, 0.92)'
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, (p.size ?? 6) * (1.9 - life), (p.size ?? 6) * (1.4 - life * 0.7),
          p.x * 0.01, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      if (p.mode === 'dust') {
        ctx.globalAlpha = life * 0.3
        ctx.fillStyle = 'rgba(150, 152, 158, 0.9)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, (p.size ?? 4) * (1.7 - life * 0.6), 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.globalAlpha = life
      // Sparks are amber streaks, matching the burst they came out of. In the
      // reference nothing else in the frame is coloured, so stray white or
      // blue sparks read as debris rather than as the hit.
      ctx.strokeStyle = hexA(INK.impact, 0.95)
      ctx.lineWidth = (p.size ?? 2) * 0.95
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      // Sparks fly along their own velocity, which is what makes a burst look
      // like it is travelling rather than like a dot grid.
      ctx.lineTo(p.x - (p.vy ?? 8) * 1.4, p.y + (p.vx ?? 8) * 1.4)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  /**
   * The finisher: a wheel of brush strokes blooms at the cut, the world drops
   * to black, and speed lines sweep the frame. Deliberately drawn over the
   * fighters — this is the anime cut-away, not another hit spark.
   */
  function paintFinisher(ctx, snapshot) {
    const special = snapshot.special
    if (!special) return
    const life = clamp01(special.life)
    const age = 1 - life
    const land = special.beat === 'landed'
    // During the charge the frame just darkens and a ring gathers; the blast
    // itself is held until the cut lands.
    const intensity = land ? Math.min(1, life * 2.4) : Math.min(1, age * 4)

    ctx.save()
    if (land) {
      ctx.fillStyle = `rgba(5, 4, 3, ${0.62 * intensity})`
      ctx.fillRect(-460, -260, 1900, 960)
    } else {
      // Windup: the world dims and ink converges on the striker, so the
      // long charge reads as a charge instead of as a freeze.
      const charge = Math.min(1, age * 3)
      ctx.fillStyle = `rgba(5, 4, 3, ${0.36 * charge})`
      ctx.fillRect(-460, -260, 1900, 960)
      const pull = 1 - charge
      ctx.globalAlpha = charge
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + age * 2.4
        const r = 40 + pull * 200
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 236, 206, 0.75)' : 'rgba(18, 14, 12, 0.9)'
        ctx.lineWidth = 5 * (0.4 + (1 - pull))
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(special.x, ARENA.ground - 170, r, a, a + 0.5)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    ctx.translate(special.x, ARENA.ground - 160)
    ctx.globalAlpha = intensity
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + age * 1.6
      const reach = (land ? 1 : 0.32) * (120 + 200 * age)
      ctx.save()
      ctx.rotate(angle)
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(255, 247, 231, 0.95)' : 'rgba(20, 16, 14, 0.9)'
      ctx.lineCap = 'round'
      ctx.lineWidth = 17 * (1 - age * 0.55)
      ctx.beginPath()
      ctx.moveTo(reach * 0.22, 0)
      ctx.quadraticCurveTo(reach * 0.65, reach * 0.16, reach, reach * 0.03)
      ctx.stroke()
      ctx.restore()
    }

    if (land && life > 0.5) {
      const alpha = (life - 0.5) * 2
      ctx.globalAlpha = alpha * 0.9
      ctx.fillStyle = INK.flash
      ctx.beginPath()
      ctx.moveTo(-400, -12)
      ctx.lineTo(0, -56)
      ctx.lineTo(400, -10)
      ctx.lineTo(0, 34)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()

    if (land) {
      ctx.save()
      ctx.globalAlpha = intensity * 0.5
      ctx.strokeStyle = 'rgba(28, 26, 32, 0.85)'
      ctx.lineWidth = 2.2
      const dir = special.facing >= 0 ? 1 : -1
      for (let i = 0; i < 26; i++) {
        const y = 20 + hash(i * 4.1) * 360
        const len = 90 + hash(i * 8.3) * 240
        const x = 480 + dir * (240 + hash(i) * 180)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - dir * len, y)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  /** Knockback shockwave and the KO flash, in world space. */
  function paintBlast(ctx, snapshot, center) {
    const { shockwave, flash } = snapshot.fx
    if (shockwave > 0) {
      const radius = (1 - shockwave) * 560
      ctx.strokeStyle = `rgba(255, 255, 255, ${shockwave * 0.8})`
      ctx.lineWidth = 5 * shockwave + 1
      ctx.beginPath()
      ctx.arc(center[0], center[1], radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = `rgba(255, 255, 255, ${shockwave * 0.28})`
      ctx.lineWidth = 16 * shockwave
      ctx.beginPath()
      ctx.arc(center[0], center[1], radius * 0.82, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 252, 245, ${Math.min(1, flash)})`
      ctx.fillRect(-460, -260, 1900, 960)
    }
  }

  /* ---------------------------------------------------------- the camera */

  /**
   * One camera on one world. It follows the pair's midpoint and lands a small
   * punch-in on a heavy connect.
   *
   * The reference is a **static wide shot**: the stage rectangle never moves
   * through a whole exchange. The fighters travel within the frame; the frame
   * does not chase them. So the camera only keeps both of them inside the
   * viewport — a gentle follow, a slight pull-back when they separate.
   *
   * FRAMING. The arena is 960x400 and the figure is 280 tall, so a fighter
   * standing on `ARENA.ground` (340) reaches from y=340 up to y=60; the crown
   * only just fits under the top edge. The camera centre is therefore the
   * fighter's own mid-torso, `ground - 140`, which puts the ground line about
   * 60% of the way down the frame — the same framing as the reference, where
   * the feet sit well below centre with headroom above the crown.
   */
  function updateCamera(snapshot) {
    const dt = Math.max(0, Math.min(80, (snapshot.clock ?? 0) - lastClock))
    lastClock = snapshot.clock ?? 0
    const k = 1 - Math.exp(-dt / 260)

    const mid = (snapshot.player.x + snapshot.enemy.x) / 2
    const spread = Math.abs(snapshot.player.x - snapshot.enemy.x)
    const impactPush = snapshot.impact && !snapshot.impact.blocked
      ? clamp01(snapshot.impact.life) * (snapshot.impact.special ? 0.1 : 0.022)
      : 0
    // 1.0 is the arena exactly filling the frame. There is no room to push in
    // — the figure is already 70% of the frame height — so the zoom only ever
    // pulls BACK, and only a little, as the pair separates.
    // A 140-unit body on a 400-unit stage is 35% tall. Sitting at 1.0 leaves
    // most of the frame empty, so the shot is framed on the PAIR: zoom in to
    // 1.9 when they are close and back off as they separate, which is the
    // "static wide shot" of the reference adapted to a smaller body.
    const targetZoom = 3.4
      - clamp01((260 - spread) / 260) * 1.2
      + (snapshot.fx?.zoom ?? 0) * 0.2
      + impactPush

    // Feet at about three-quarters down, crown clear of the top: a 70-unit
    // body, focused 22 above the soles.
    const focusY = (snapshot.player.y + snapshot.enemy.y) / 2 - 22
    cam.x = lerp(cam.x, mid, k)
    cam.y = lerp(cam.y, focusY, k)
    cam.zoom = lerp(cam.zoom, targetZoom, k * 0.5)
  }

  /* -------------------------------------------------------------- draw */

  function draw(snapshot) {
    const ctx = ctx2d
    if (!ctx) return
    fit(cssWidth, cssHeight)
    updateCamera(snapshot)

    const shake = snapshot.fx.shake
    const jx = shake ? (Math.random() * 2 - 1) * shake : 0
    const jy = shake ? (Math.random() * 2 - 1) * shake : 0

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)
    ctx.globalAlpha = 1
    ctx.filter = 'none'

    /**
     * Apply the camera at a parallax factor. Factor 1 is the fight plane;
     * <1 is the backdrop (moves less), >1 the foreground (moves more).
     */
    const cameraAt = (parallax) => {
      const z = 1 + (cam.zoom - 1) * parallax
      const cx = 480 + (cam.x - 480) * parallax
      const cy = 300 + (cam.y - 300) * parallax
      ctx.setTransform(
        dpr * scale * z, 0, 0, dpr * scale * z,
        dpr * (offsetX + jx * scale) + dpr * scale * (480 - cx * z),
        dpr * (offsetY + jy * scale) + dpr * scale * (300 - cy * z),
      )
      return z
    }

    // --- stage ---------------------------------------------------------
    // Flat. The reference has no parallax, no texture and no grade; the stage
    // is a single grey plane and the camera is a static wide shot.
    cameraAt(1)
    paintStage(ctx)

    // --- fight plane ---------------------------------------------------
    paintGroundShadow(ctx, snapshot.player)
    paintGroundShadow(ctx, snapshot.enemy)

    const clock = snapshot.clock ?? 0
    const playerJoints = poseJoints(snapshot.player, {
      time: clock / 1000,
      breathing: snapshot.player.breathing ?? 0,
    })
    const enemyJoints = poseJoints(snapshot.enemy, {
      time: clock / 1000 + 1.7,
      breathing: snapshot.enemy.breathing ?? 0,
    })

    if (snapshot.ragdoll) {
      paintRagdoll(ctx, snapshot.ragdoll, 'white')
      paintFighter(ctx, snapshot.player, playerJoints, 'black')
    } else {
      // Painter's order: the far fighter first. The player is black, the
      // enemy white — the reference's pairing, and the reason neither needs a
      // colour to be told apart.
      paintFighter(ctx, snapshot.enemy, enemyJoints, 'white', { previous: ghosts.enemy })
      paintFighter(ctx, snapshot.player, playerJoints, 'black', { previous: ghosts.player })
    }
    // Remember where every limb was, for next frame's smears.
    ghosts.player = { handFront: playerJoints.handFront, handBack: playerJoints.handBack, footFront: playerJoints.footFront, footBack: playerJoints.footBack }
    ghosts.enemy = { handFront: enemyJoints.handFront, handBack: enemyJoints.handBack, footFront: enemyJoints.footFront, footBack: enemyJoints.footBack }

    // --- effects over the plane ---------------------------------------
    paintParticles(ctx, snapshot.fx.particles)
    paintSlash(ctx, snapshot.impact)
    paintImpactGlyph(ctx, snapshot.impact)
    paintFinisher(ctx, snapshot)
    paintBlast(ctx, snapshot, snapshot.ragdoll
      ? [snapshot.enemy.x, ARENA.ground - 150]
      : [(snapshot.player.x + snapshot.enemy.x) / 2, ARENA.ground - 150])

    // --- finish --------------------------------------------------------
    // Nothing. The reference frame is exactly: flat grey, two silhouettes, one
    // amber burst. No vignette, no grade, no grain, no lens.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  return {
    resize,
    draw,
    fit: (w, h) => fit(w, h),
    scale: () => scale,
    /** Exposed for tests: the parallax transform at a factor. */
    __camera: cam,
  }
}
