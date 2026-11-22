/**
 * Tiny queue between model tools and the browser player.
 *
 * Tools run on the Host, but playback happens in the Web client, so a tool
 * enqueues an action and the open music panel drains the queue over HTTP.
 *
 * @module dsh-music-panel/control
 */

const MAX_PENDING = 10

/** @type {{ action: string, query: string, at: number }[]} */
const pending = []

/**
 * @param {{ action?: unknown, query?: unknown }} input
 * @returns {boolean} whether an action was queued
 */
export function enqueueControl(input) {
  const action = String(input?.action ?? '').trim()
  if (action === '') return false
  pending.push({
    action,
    query: String(input?.query ?? '').trim(),
    source: String(input?.source ?? '').trim(),
    at: Date.now(),
  })
  while (pending.length > MAX_PENDING) pending.shift()
  return true
}

/** @returns {{ action: string, query: string, at: number }[]} */
export function takeControls() {
  return pending.splice(0, pending.length)
}
