/**
 * Sound: CC0 recordings when the host serves them, a synthesiser otherwise.
 *
 * A missing sample must never be a missing sound, and a broken audio node must
 * never take the fight down — both rules are enforced here because audio is
 * the least essential and most failure-prone part of the layer.
 *
 * Extracted from the previous single-file renderer when the engine was
 * replaced; the cues are unchanged so the host wiring did not have to move.
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
