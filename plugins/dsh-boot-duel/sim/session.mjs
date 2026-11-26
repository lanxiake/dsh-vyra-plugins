/**
 * Session controller: keyboard mapping, pause, and the error escape hatch.
 *
 * This is the piece that must never trap the user. It owns two rules:
 *
 *   - A key that this session does not handle is dropped, never forwarded.
 *   - A throwing duel finishes the session rather than propagating, which is
 *     what lets the caller unmount the layer and show the home page.
 *
 * It has no DOM access; the React component wires `keyDown`/`keyUp` from its
 * own focus container and calls `frame` from the animation loop.
 */

/** Keys the duel consumes. Anything here is preventDefault()ed while it runs. */
export const GAME_KEYS = Object.freeze([
  'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'KeyH', 'KeyG', 'KeyF', 'KeyN', 'KeyC',
  'KeyL', 'KeyU', 'KeyI', 'ShiftLeft', 'ShiftRight', 'Escape', 'Enter', 'NumpadEnter',
])

/** Module-level "already passed" flag. Deliberately not persisted. */
let passed = false

export function hasPassed() {
  return passed
}

export function markPassed() {
  passed = true
}

/** Reset for tests and for a full page reload in a development session. */
export function resetPassed() {
  passed = false
}

const emptyInput = () => ({ left: false, right: false, jump: false, jab: false, kick: false, hook: false, sweep: false, uppercut: false, retreat: false, slide: false, crouch: false, block: false, special: false })

/** Map one physical key code onto the input it holds down. */
export function inputForCode(code) {
  switch (code) {
    case 'KeyA':
    case 'ArrowLeft':
      return 'left'
    case 'KeyD':
    case 'ArrowRight':
      return 'right'
    case 'Space':
    case 'KeyW':
      return 'jump'
    // The attack cluster, laid out as a hand: J poke, K heavy, H hook,
    // G sweep, F uppercut. That is five distinct moves within reach of each
    // other, which is what a combo needs.
    case 'KeyJ':
      return 'jab'
    // The slide: a low strike that carries the whole body forward.
    case 'KeyN':
      return 'slide'
    case 'KeyK':
      return 'kick'
    case 'KeyH':
      return 'hook'
    case 'KeyG':
      return 'sweep'
    case 'KeyF':
      return 'uppercut'
    case 'KeyL':
      return 'block'
    // Crouch: hold to duck under high strikes.
    case 'KeyS':
      return 'crouch'
    // Retreat: Shift is the dedicated back-hop key.
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'retreat'
    // The finishing art. U sits under the right hand next to J/K; I is the
    // alternative for anyone whose keyboard layout makes U awkward.
    case 'KeyU':
    case 'KeyI':
      return 'special'
    default:
      return null
  }
}

/**
 * `createSession({ duel, onError, onEvent })`.
 *
 * `keyDown(code)` returns `true` when the key was consumed by the game, so the
 * DOM handler knows whether to `preventDefault()`. `Esc` is consumed only while
 * the fight is running: during the KO outro it is a no-op so a double press
 * cannot disturb the sequence.
 */
export function createSession({ duel, onError = null, onEvent = null, binds = null } = {}) {
  /**
   * The player's own bindings, action -> KeyboardEvent.code.
   *
   * Looked up BEFORE the built-in table, so a rebound key wins and a bind
   * that happens to collide with a default still works. `null` means "use
   * the defaults", which is what a first run does.
   */
  let activeBinds = binds
  const boundCode = (code) => {
    const current = activeBinds
    if (current) {
      for (const [action, bound] of Object.entries(current)) {
        if (bound === code) return action
      }
    }
    return inputForCode(code)
  }
  const held = new Set()
  let finished = false
  let paused = false
  let reported = false

  function fail(error) {
    if (reported) return
    reported = true
    finished = true
    if (onError) {
      try { onError(error) } catch { /* an error reporter must not throw */ }
    } else {
      console.error('[dsh-boot-duel] session failed:', String(error?.message ?? error))
    }
  }

  return {
    /** Current input, derived from the held keys. */
    input() {
      const input = emptyInput()
      for (const code of held) {
        const field = boundCode(code)
        if (field) input[field] = true
      }
      return input
    },

    /** Replace the bindings at runtime (the settings panel calls this). */
    setBinds(next) {
      activeBinds = next || null
    },

    /** Returns whether the key belongs to the game. */
    keyDown(code) {
      if (finished) return false
      // Enter is the start gesture. In `ready` it begins the fight; once the
      // fight is live it is not a game key, so it is dropped rather than
      // forwarded (there is nothing under the layer worth submitting to).
      if (code === 'Enter' || code === 'NumpadEnter') {
        if (typeof duel.begin !== 'function') return false
        return duel.begin()
      }
      if (code === 'Escape') {
        // Skip once, from the opening stance or from play. The duel itself
        // refuses a second call, so this cannot restart an outro.
        if (paused) return true
        return duel.skip() ? true : false
      }
      // No game input exists before the fight begins: a stray A/J press must
      // not start a swing the player never meant to throw.
      if (duel.getState?.() === 'ready') {
        return boundCode(code) !== null
      }
      const field = boundCode(code)
      if (!field) return false
      held.add(code)
      return true
    },

    keyUp(code) {
      if (!GAME_KEYS.includes(code)) return false
      held.delete(code)
      return true
    },

    /** Forget every held key (focus loss, pause, blur). */
    releaseAll() {
      held.clear()
    },

    pause() {
      paused = true
      held.clear()
    },

    resume() {
      paused = false
    },

    isPaused: () => paused,

    isFinished: () => finished,

    /** Advance one display frame. Never throws. */
    frame(dtMs) {
      if (finished || paused) return null
      let result
      try {
        result = duel.update(dtMs, this.input())
      } catch (error) {
        fail(error)
        return null
      }
      if (onEvent && result) {
        for (const event of result.events) {
          try { onEvent(event) } catch { /* presentation failures are not fatal */ }
        }
      }
      if (!result || duel.getState() === 'done') finished = true
      return result
    },

    /** Tear down: no further frames, no further keys. */
    unmount() {
      finished = true
      held.clear()
    },
  }
}
