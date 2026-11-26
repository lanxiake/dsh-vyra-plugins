/**
 * Fixed-timestep frame loop.
 *
 * The same elapsed time produces the same number of `step` calls at 30 Hz,
 * 144 Hz, or anything in between, which is what keeps the fight's frame data
 * meaningful on every display. A long stall cannot fast-forward the fight, and
 * one throwing step stops the loop for good so the caller can unmount.
 */

/** Catch-up cap: a long stall must not fast-forward the whole fight. */
const MAX_STEPS_PER_FRAME = 5

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
