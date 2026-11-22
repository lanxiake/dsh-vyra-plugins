/**
 * control-drainer: the only consumer of the `music_control` queue.
 *
 * Tools enqueue on the Host; the browser applies them by asking `/music/control/pending`.
 * That poll has to outlive the music panel: 'folded into the dock', 'never opened' and 'another
 * window is playing' are all states where the panel component is not mounted, and a consumer
 * tied to it leaves the queue accumulating until someone opens the panel.
 *
 * Invariants this file keeps:
 *   1. started from the plugin lifecycle (`apply`), never from a slot that can unmount;
 *   2. only the window that may play drains (the Host drops whatever it hands out);
 *   3. one batch at a time, applied in order;
 *   4. an instruction that has waited longer than `CONTROL_MAX_AGE_MS` is dropped, not replayed.
 */

var CONTROL_INTERVAL_MS = 2000
// The first tick waits for the audio host to mount: an action applied before
// `player.attachAudio` reaches a player with no element and would be dropped.
var CONTROL_FIRST_DELAY_MS = 1000
// Queued actions are instructions, not state. Background tabs can be throttled past a
// minute (and frozen), so a wake-up must not fire 'play X' from ten minutes ago.
var CONTROL_MAX_AGE_MS = 5 * 60 * 1000

var controlDraining = false
var controlTimer = null
var controlFirstTimer = null

/** Apply one batch of queued actions, in order. Safe to call at any time. */
async function drainControlsOnce() {
  if (controlDraining) return
  // One audible player per browser profile: a follower would take an action and make no sound.
  if (typeof player === 'undefined' || typeof player.isLeader !== 'function' || !player.isLeader()) return
  controlDraining = true
  try {
    var body = await getJson(API + 'control/pending')
    var actions = body !== null && body !== undefined && Array.isArray(body.actions) ? body.actions : []
    var now = Date.now()
    var stale = 0
    for (var i = 0; i < actions.length; i += 1) {
      var action = actions[i]
      var at = Number(action && action.at) || 0
      if (at > 0 && now - at > CONTROL_MAX_AGE_MS) {
        stale += 1
        continue
      }
      try {
        await applyControlAction(action)
      } catch (error) {
        console.warn('[Control] action failed:', error)
      }
    }
    if (stale > 0) console.info('[Control] dropped ' + stale + ' stale action(s)')
  } catch (error) {
    // Offline or the Host is restarting: the next tick asks again.
  } finally {
    controlDraining = false
  }
}

/**
 * A Node-based harness (the client tests, a script that loads the bundle) must not be kept
 * alive by the drainer's interval: unref where the handle allows it.
 */
function unrefControlTimer(handle) {
  if (handle !== null && typeof handle === 'object' && typeof handle.unref === 'function') handle.unref()
  return handle
}

/** Start the one drainer for this window. Returns the disposer. */
function startControlDrainer() {
  if (controlTimer !== null) return function () {}
  controlFirstTimer = unrefControlTimer(
    setTimeout(function () {
      controlFirstTimer = null
      void drainControlsOnce()
    }, CONTROL_FIRST_DELAY_MS),
  )
  controlTimer = unrefControlTimer(
    setInterval(function () {
      void drainControlsOnce()
    }, CONTROL_INTERVAL_MS),
  )
  // A throttled or frozen tab resumes here instead of waiting for its next tick.
  var canListen = typeof document !== 'undefined' && typeof document.addEventListener === 'function'
  function onVisible() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    void drainControlsOnce()
  }
  if (canListen) document.addEventListener('visibilitychange', onVisible)
  return function () {
    if (controlFirstTimer !== null) clearTimeout(controlFirstTimer)
    controlFirstTimer = null
    if (controlTimer !== null) clearInterval(controlTimer)
    controlTimer = null
    if (canListen) document.removeEventListener('visibilitychange', onVisible)
  }
}
