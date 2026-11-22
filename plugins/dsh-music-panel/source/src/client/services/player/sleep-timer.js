/**
 * Folia's sleep timer, ported from
 * A_other/upstream/folia-major-main/src/hooks/useSleepTimer.ts + useSleepTimerStore.ts.
 *
 * Folia keeps the timer at the app root, not in a panel: a one-shot countdown armed by the
 * listener, ticking once a second, and pausing playback when it lands. This service is the
 * plugin's app-root equivalent — started from `apply()`, never from a slot that can unmount —
 * so folding the panel does not stop the timer.
 *
 * 时长是设置（随 prefs 持久化），截止时间只是运行态；到点后清掉这两项并暂停播放。
 */

var SLEEP_TIMER_TICK_MS = 1000

var sleepTimerHandle = null
var sleepTimerDeadline = 0
var sleepTimerAppliedMinutes = -1
var sleepTimerAppliedDeadline = -1
var sleepTimerApplying = false

function sleepTimerPrefs() {
  return typeof prefsStore !== 'undefined' && prefsStore !== null ? prefsStore.get() : {}
}

function sleepTimerWrite(patch) {
  if (typeof setPrefs === 'function') setPrefs(patch)
}

function sleepTimerClearHandle() {
  if (sleepTimerHandle !== null) {
    clearInterval(sleepTimerHandle)
    sleepTimerHandle = null
  }
}

function sleepTimerExpire() {
  sleepTimerClearHandle()
  sleepTimerDeadline = 0
  sleepTimerAppliedDeadline = 0
  sleepTimerAppliedMinutes = 0
  if (typeof player !== 'undefined' && player !== null && typeof player.pause === 'function') player.pause()
  sleepTimerWrite({ sleepTimerMinutes: 0, sleepDeadline: 0 })
  if (typeof showToast === 'function') showToast(t('settings.sleepTimerDone'))
}

function sleepTimerTick() {
  if (sleepTimerDeadline <= 0) return
  if (Date.now() < sleepTimerDeadline) return
  sleepTimerExpire()
}

function sleepTimerArm(minutes, deadline) {
  sleepTimerClearHandle()
  sleepTimerAppliedMinutes = minutes
  sleepTimerAppliedDeadline = deadline
  sleepTimerDeadline = deadline
  if (deadline <= 0) return
  sleepTimerHandle = setInterval(sleepTimerTick, SLEEP_TIMER_TICK_MS)
  if (sleepTimerHandle !== null && typeof sleepTimerHandle.unref === 'function') sleepTimerHandle.unref()
}

/**
 * Reconciles the runtime countdown with the prefs snapshot. A fresh activation (minutes changed
 * or armed from zero) writes a new deadline; a cleared timer stops ticking.
 */
function sleepTimerSync() {
  if (sleepTimerApplying) return
  var prefs = sleepTimerPrefs()
  var minutes = Math.max(0, Math.floor(Number(prefs.sleepTimerMinutes) || 0))
  var storedDeadline = Number(prefs.sleepDeadline) || 0
  if (minutes <= 0) {
    if (sleepTimerDeadline !== 0 || storedDeadline !== 0) sleepTimerWrite({ sleepDeadline: 0 })
    sleepTimerDeadline = 0
    sleepTimerAppliedMinutes = 0
    sleepTimerAppliedDeadline = 0
    sleepTimerClearHandle()
    return
  }
  if (sleepTimerAppliedMinutes === minutes && sleepTimerAppliedDeadline === storedDeadline && sleepTimerHandle !== null) return
  var deadline = storedDeadline
  if (deadline <= 0) {
    deadline = Date.now() + minutes * 60000
    sleepTimerApplying = true
    sleepTimerWrite({ sleepDeadline: deadline })
    sleepTimerApplying = false
  }
  sleepTimerArm(minutes, deadline)
  if (Date.now() >= deadline) sleepTimerExpire()
}

function startSleepTimer() {
  sleepTimerSync()
  var unsubscribe = null
  if (typeof prefsStore !== 'undefined' && prefsStore !== null && typeof prefsStore.subscribe === 'function') {
    unsubscribe = prefsStore.subscribe(sleepTimerSync)
  }
  return function stopSleepTimer() {
    if (typeof unsubscribe === 'function') unsubscribe()
    sleepTimerClearHandle()
    sleepTimerDeadline = 0
    sleepTimerAppliedMinutes = -1
    sleepTimerAppliedDeadline = -1
  }
}
