/**
 * Audio focus bridge.
 *
 * Host owns the platform probe; this service polls its status, pauses/resumes
 * playback for Windows voice input, and applies TTS/voice-preview ducking.
 *
 * window.__dshMusicAudioFocus is the same-window API for another client plugin:
 *
 *   window.__dshMusicAudioFocus.begin('tts', { level: 0.3, fadeMs: 300 })
 *   window.__dshMusicAudioFocus.end('tts')
 *
 * The same state is also available cross-process through
 * POST /music/audio-focus/duck, but the window API applies the duck immediately
 * instead of waiting for the next status poll.
 */

var AUDIO_FOCUS_POLL_MS = 1000
var AUDIO_FOCUS_DUCK_TTL_MS = 60000

var audioFocusStore = createStore({
  supported: false,
  platform: '',
  voiceInputPause: false,
  voiceInputActive: false,
  duck: { active: false, level: 1, fadeMs: 0, reasons: [] },
  error: '',
})

function audioFocusPrefs() {
  return prefsStore.get()
}

function audioFocusClamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function audioFocusDuckLevel(prefs) {
  var level = Number(prefs && prefs.audioFocusDuckLevel)
  return isFinite(level) ? audioFocusClamp(level, 0, 1) : 0.3
}

function audioFocusDuckFade(prefs) {
  var fade = Number(prefs && prefs.audioFocusFadeMs)
  return isFinite(fade) ? audioFocusClamp(Math.round(fade), 0, 5000) : 300
}

function startAudioFocus() {
  if (window.__dshMusicAudioFocusStop) window.__dshMusicAudioFocusStop()
  var stopped = false
  var timer = null
  var pausedByVoiceInput = false
  var lastDuckLevel = 1
  var lastDuckFade = 0
  var localDucks = {}

  function pruneLocalDucks(now) {
    for (var reason in localDucks) {
      if (!Object.prototype.hasOwnProperty.call(localDucks, reason)) continue
      var entry = localDucks[reason]
      if (entry.expiresAt > 0 && entry.expiresAt <= now) delete localDucks[reason]
    }
  }

  function localDuck() {
    pruneLocalDucks(Date.now())
    var level = 1
    var fade = 0
    var active = false
    var reasons = []
    for (var reason in localDucks) {
      if (!Object.prototype.hasOwnProperty.call(localDucks, reason)) continue
      var entry = localDucks[reason]
      active = true
      reasons.push(reason)
      if (entry.level < level) {
        level = entry.level
        fade = entry.fadeMs
      }
    }
    return { active: active, level: level, fadeMs: fade, reasons: reasons }
  }

  function applyDuck(hostStatus) {
    var prefs = audioFocusPrefs()
    if (prefs.audioFocusDucking === false) {
      if (lastDuckLevel !== 1) {
        lastDuckLevel = 1
        lastDuckFade = 0
        player.setDuck(1, 0)
      }
      return
    }
    var hostDuck = hostStatus && hostStatus.duck ? hostStatus.duck : null
    var local = localDuck()
    var hostActive = hostDuck !== null && hostDuck.active === true
    var hostLevel = hostActive ? audioFocusClamp(Number(hostDuck.level), 0, 1) : 1
    var hostFade = hostActive ? audioFocusClamp(Number(hostDuck.fadeMs), 0, 5000) : 0
    var target = Math.min(hostLevel, local.level)
    var releaseFade = audioFocusDuckFade(prefs)
    var fade = hostActive && hostDuck.level <= local.level
      ? hostFade
      : local.active
        ? local.fadeMs
        : releaseFade
    if (target === lastDuckLevel && fade === lastDuckFade) return
    lastDuckLevel = target
    lastDuckFade = fade
    player.setDuck(target, fade)
  }

  function applyVoiceInput(status) {
    var enabled = audioFocusPrefs().voiceInputPause === true
    var active = status && status.voiceInputActive === true
    var snapshot = player.getSnapshot()
    if (enabled && active && snapshot.playing === true && !pausedByVoiceInput) {
      pausedByVoiceInput = true
      player.pause()
      return
    }
    if (!active && pausedByVoiceInput) {
      pausedByVoiceInput = false
      if (!player.getSnapshot().playing) player.play()
    }
  }

  function applyStatus(status) {
    if (stopped || status === null || typeof status !== 'object') return
    audioFocusStore.set({
      supported: status.supported === true,
      platform: String(status.platform || ''),
      voiceInputPause: status.voiceInputPause === true,
      voiceInputActive: status.voiceInputActive === true,
      duck: status.duck && typeof status.duck === 'object'
        ? status.duck
        : { active: false, level: 1, fadeMs: 0, reasons: [] },
      error: '',
    })
    applyVoiceInput(status)
    applyDuck(status)
    if (
      status.supported === true &&
      (audioFocusPrefs().voiceInputPause === true) !== (status.voiceInputPause === true)
    ) {
      syncConfig()
    }
  }

  function refresh() {
    if (stopped) return
    getJson(API + 'audio-focus/status')
      .then(applyStatus)
      .catch(function (error) {
        if (!stopped) audioFocusStore.set({ error: errorText(error) })
      })
  }

  function syncConfig() {
    if (stopped) return
    var prefs = audioFocusPrefs()
    postJson(API + 'audio-focus/config', {
      voiceInputPause: prefs.voiceInputPause === true,
      // Cross-process ducks that do not state a level use the listener's settings.
      duckLevel: audioFocusDuckLevel(prefs),
      duckFadeMs: audioFocusDuckFade(prefs),
    }).catch(function () {
      // The status endpoint remains the source of truth.
    })
  }

  function beginDuck(reason, options) {
    var key = String(reason || '').trim()
    if (key === '') return
    var opts = options !== null && typeof options === 'object' ? options : {}
    var prefs = audioFocusPrefs()
    var level = opts.level === undefined ? audioFocusDuckLevel(prefs) : audioFocusClamp(Number(opts.level), 0, 1)
    var fadeMs = opts.fadeMs === undefined ? audioFocusDuckFade(prefs) : audioFocusClamp(Math.round(Number(opts.fadeMs)), 0, 5000)
    var ttlMs = opts.ttlMs === undefined ? AUDIO_FOCUS_DUCK_TTL_MS : audioFocusClamp(Math.round(Number(opts.ttlMs)), 0, 300000)
    localDucks[key] = { level: level, fadeMs: fadeMs, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0 }
    applyDuck(audioFocusStore.get())
    postJson(API + 'audio-focus/duck', {
      reason: key,
      active: true,
      level: level,
      fadeMs: fadeMs,
      ttlMs: ttlMs,
    }).catch(function () {})
    return { level: level, fadeMs: fadeMs }
  }

  function endDuck(reason) {
    var key = String(reason || '').trim()
    if (key === '') return
    delete localDucks[key]
    applyDuck(audioFocusStore.get())
    postJson(API + 'audio-focus/duck', { reason: key, active: false }).catch(function () {})
  }

  function stopAudioFocus() {
    if (stopped) return
    stopped = true
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    if (typeof unsubscribePrefs === 'function') unsubscribePrefs()
    if (pausedByVoiceInput) {
      pausedByVoiceInput = false
      if (!player.getSnapshot().playing) player.play()
    }
    player.setDuck(1, 0)
    localDucks = {}
    delete window.__dshMusicAudioFocus
    delete window.__dshMusicAudioFocusStop
  }

  var unsubscribePrefs = prefsStore.subscribe(function () {
    if (stopped) return
    if (audioFocusPrefs().voiceInputPause !== true && pausedByVoiceInput) {
      pausedByVoiceInput = false
      if (!player.getSnapshot().playing) player.play()
    }
    syncConfig()
    applyDuck(audioFocusStore.get())
  })

  window.__dshMusicAudioFocus = {
    begin: beginDuck,
    end: endDuck,
    getStatus: function () { return audioFocusStore.get() },
  }
  window.__dshMusicAudioFocusStop = stopAudioFocus
  syncConfig()
  refresh()
  timer = setInterval(refresh, AUDIO_FOCUS_POLL_MS)
  if (timer !== null && typeof timer.unref === 'function') timer.unref()
  return stopAudioFocus
}
