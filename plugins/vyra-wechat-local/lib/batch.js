// Per-peer batching for the WeChat watch loop.
//
// One WeChat conversation (friend or group) is one key. New eligible messages wait
// `mergeWindowMs` (20s) so a burst arrives as one batch; each new message restarts
// the window. After a batch is handed to the agent, further messages accumulate
// until the agent replies. A successful reply starts `cooldownMs` (the peer's
// configured cooldown, 60s by default); everything that arrives during the cooldown
// is delivered as one batch when it ends.
//
// Pure timers-injected scheduler so the timing rules are testable without waiting.

export function createBatchScheduler({
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  mergeWindowMs = 20_000,
  replyTimeoutMs = 120_000,
  onFlush,
} = {}) {
  /** key -> peer state */
  const peers = new Map()

  function stateOf(key) {
    let state = peers.get(key)
    if (state === undefined) {
      state = {
        key,
        messages: [],
        mode: 'draft',
        cooldownMs: 60_000,
        cooldownUntil: 0,
        awaitingUntil: 0,
        debounceTimer: null,
        cooldownTimer: null,
        awaitingTimer: null,
      }
      peers.set(key, state)
    }
    return state
  }

  function cancel(timer) {
    if (timer !== null) clearTimer(timer)
    return null
  }

  function scheduleDebounce(key) {
    const state = stateOf(key)
    state.debounceTimer = cancel(state.debounceTimer)
    if (state.messages.length === 0) return
    state.debounceTimer = setTimer(() => {
      state.debounceTimer = null
      flush(key)
    }, mergeWindowMs)
  }

  function scheduleCooldownEnd(state) {
    state.cooldownTimer = cancel(state.cooldownTimer)
    const left = state.cooldownUntil - now()
    if (left <= 0) {
      state.cooldownUntil = 0
      if (state.messages.length > 0) flush(state.key)
      return
    }
    state.cooldownTimer = setTimer(() => {
      state.cooldownTimer = null
      state.cooldownUntil = 0
      // Cooldown is the quiet period: deliver what accumulated in it now.
      if (state.messages.length > 0) flush(state.key)
    }, left)
  }

  function scheduleAwaitingEnd(state) {
    state.awaitingTimer = cancel(state.awaitingTimer)
    const left = state.awaitingUntil - now()
    if (left <= 0) {
      state.awaitingUntil = 0
      if (state.messages.length > 0) scheduleDebounce(state.key)
      return
    }
    state.awaitingTimer = setTimer(() => {
      state.awaitingTimer = null
      state.awaitingUntil = 0
      // The agent never replied: do not strand the next messages.
      if (state.messages.length > 0) scheduleDebounce(state.key)
    }, left)
  }

  function flush(key) {
    const state = stateOf(key)
    state.debounceTimer = cancel(state.debounceTimer)
    if (state.messages.length === 0) return
    const batch = state.messages.splice(0)
    state.awaitingUntil = now() + replyTimeoutMs
    scheduleAwaitingEnd(state)
    onFlush(key, batch, { mode: state.mode, cooldownMs: state.cooldownMs })
  }

  return {
    /**
     * Queue one eligible incoming message.
     * @param key peer key (account + talker)
     * @param message JSON-serializable message summary
     * @param decision policy outcome for this message ({ mode, cooldownMs })
     */
    push(key, message, decision) {
      const state = stateOf(key)
      if (decision?.mode) state.mode = decision.mode
      if (Number.isFinite(decision?.cooldownMs) && decision.cooldownMs >= 0) state.cooldownMs = decision.cooldownMs
      state.messages.push(message)
      if (state.cooldownUntil > now()) return
      if (state.awaitingUntil > now()) return
      scheduleDebounce(key)
    },

    /** A real (dry_run=false) reply went out: start the peer's cooldown. */
    reply(key, cooldownMs) {
      const state = stateOf(key)
      if (Number.isFinite(cooldownMs) && cooldownMs >= 0) state.cooldownMs = cooldownMs
      state.awaitingTimer = cancel(state.awaitingTimer)
      state.awaitingUntil = 0
      state.cooldownUntil = now() + state.cooldownMs
      scheduleCooldownEnd(state)
    },

    /** The user replied from their own phone: drop what was queued for the agent. */
    userSpoke(key) {
      const state = stateOf(key)
      state.messages = []
      state.debounceTimer = cancel(state.debounceTimer)
      state.cooldownTimer = cancel(state.cooldownTimer)
      state.awaitingTimer = cancel(state.awaitingTimer)
      state.cooldownUntil = 0
      state.awaitingUntil = 0
    },

    /** Put a failed delivery back at the front and retry after one merge window. */
    retry(key, messages, decision) {
      const state = stateOf(key)
      state.messages = [...messages, ...state.messages]
      if (decision?.mode) state.mode = decision.mode
      if (Number.isFinite(decision?.cooldownMs) && decision.cooldownMs >= 0) state.cooldownMs = decision.cooldownMs
      state.awaitingTimer = cancel(state.awaitingTimer)
      state.awaitingUntil = 0
      if (state.cooldownUntil > now()) return
      scheduleDebounce(key)
    },

    snapshot() {
      return [...peers.values()]
        .filter((state) => state.messages.length > 0 || state.awaitingUntil > now() || state.cooldownUntil > now())
        .map((state) => ({
          key: state.key,
          messages: state.messages,
          mode: state.mode,
          cooldownMs: state.cooldownMs,
          cooldownUntil: state.cooldownUntil,
          awaitingUntil: state.awaitingUntil,
        }))
    },

    restore(entries) {
      for (const entry of entries ?? []) {
        if (!entry?.key || !Array.isArray(entry.messages) || entry.messages.length === 0) continue
        const state = stateOf(entry.key)
        state.messages = entry.messages
        state.mode = entry.mode ?? state.mode
        state.cooldownMs = Number.isFinite(entry.cooldownMs) ? entry.cooldownMs : state.cooldownMs
        state.cooldownUntil = Number.isFinite(entry.cooldownUntil) ? entry.cooldownUntil : 0
        state.awaitingUntil = Number.isFinite(entry.awaitingUntil) ? entry.awaitingUntil : 0
        if (state.cooldownUntil > now()) scheduleCooldownEnd(state)
        else if (state.awaitingUntil > now()) scheduleAwaitingEnd(state)
        else scheduleDebounce(entry.key)
      }
    },

    /** Test/helper: force the pending batch out now. */
    flushNow(key) {
      flush(key)
    },

    /** Drop every timer (plugin unload). Pending messages stay in the snapshot. */
    stop() {
      for (const state of peers.values()) {
        state.debounceTimer = cancel(state.debounceTimer)
        state.cooldownTimer = cancel(state.cooldownTimer)
        state.awaitingTimer = cancel(state.awaitingTimer)
      }
    },
  }
}