/**
 * Folia's audio bands — the one write path every Folia surface reads.
 *
 * Upstream Folia keeps a single analyser and writes `audioPower`, five 0–255 band
 * values and the raw spectrum from one rAF loop
 * (`src/components/app/playback/bridges/usePlaybackVisualizerBridge.ts`, signals in
 * `src/stores/motionSignals.ts`). The plugin's three Folia stages (the lyric style,
 * the pendolo renderer and the shell background) each push this frame's values into
 * their own MotionValues, so the maths must be the upstream maths.
 *
 * Folia's own constants, unchanged: 1024 bins from fftSize 2048 at 44.1 kHz (21.5 Hz
 * per bin), energy averaged over fixed Hz ranges, then the power curve. The output
 * stays 0–255 because Folia's backgrounds map 10..200 through useTransform; a
 * normalized 0..1 would leave every visualizer static. With the analyser not built
 * yet (the AudioContext waits for a play gesture) Folia draws a slow breath instead
 * of freezing the bands at 0.
 */

var FOLIA_AUDIO_HZ_PER_BIN = 21.5

/** The player's active deck, or the resident <audio> before it is attached. */
function foliaActiveAudioElement() {
  if (typeof player !== 'undefined' && player !== null && typeof player.getActiveAudio === 'function') {
    var active = player.getActiveAudio()
    if (active !== null) return active
  }
  return typeof document !== 'undefined' ? document.querySelector('audio.mp-audio-host') : null
}

/** True while a crossfade's second deck sounds: the analyser is downstream of both. */
function foliaAudioCrossfading() {
  try {
    var state = typeof player !== 'undefined' && player !== null && typeof player.getCrossfadeState === 'function'
      ? player.getCrossfadeState()
      : null
    return state !== null && state.active === true
  } catch (error) {
    return false
  }
}

/**
 * Whether the page is hearing something. The resident element is authoritative; the
 * player snapshot is only the fallback for the moment the element is being remounted.
 * A blend keeps the last deck's bands alive instead of dropping to the idle breath.
 */
function foliaAudioIsPlaying() {
  var active = foliaActiveAudioElement()
  if (active !== null && typeof active.paused === 'boolean') {
    if (active.paused !== true && active.ended !== true) return true
    return foliaAudioCrossfading()
  }
  if (foliaAudioCrossfading()) return true
  try {
    var snapshot = typeof player !== 'undefined' && player !== null && typeof player.getSnapshot === 'function'
      ? player.getSnapshot()
      : null
    return snapshot !== null && snapshot.playing === true
  } catch (error) {
    return false
  }
}

/** Folia's idle frame: one slow breath on every band, no spectrum. */
function foliaAudioBreath() {
  var breath = (Math.sin(Date.now() / 2000) + 1) * 20
  return {
    bass: breath,
    lowMid: breath,
    mid: breath,
    vocal: breath,
    treble: breath,
    power: breath,
    spectrum: new Uint8Array(0),
  }
}

/**
 * One analyser wave (0..255 bins) → Folia's bands. Pure, so tests can drive it.
 *
 * The wave is the plugin analyser's reusable buffer, so the returned spectrum is a
 * copy: every frame's MotionValue value must survive the next `getByteFrequencyData`.
 */
function foliaAudioBandsFromWave(wave) {
  function average(minHz, maxHz) {
    var start = Math.max(0, Math.floor(minHz / FOLIA_AUDIO_HZ_PER_BIN))
    var end = Math.min(wave.length - 1, Math.floor(maxHz / FOLIA_AUDIO_HZ_PER_BIN))
    if (end < start) return 0
    var sum = 0
    for (var index = start; index <= end; index += 1) sum += Number(wave[index]) || 0
    return sum / (end - start + 1)
  }
  function process(value, boost) {
    var normalized = Math.max(0, Math.min(255, value)) / 255
    return Math.pow(normalized, boost) * 255
  }
  var bass = average(20, 150)
  var lowMid = average(150, 400)
  var mid = average(400, 1200)
  var vocal = average(1000, 3500)
  var treble = average(3500, 12000)
  return {
    bass: process(bass, 1.8),
    lowMid: process(lowMid, 2),
    mid: process(mid, 2),
    vocal: process(vocal, 1.5),
    treble: process(treble, 2),
    power: process((bass + lowMid) / 2, 3),
    spectrum: new Uint8Array(wave),
  }
}

/**
 * This frame's bands, or null while paused (the frame is not written, so the last
 * one stands still instead of fading with the analyser's smoothing). Called once per
 * rAF by each Folia stage; the analyser is built on demand from the play gesture.
 */
function foliaAudioBands(playing) {
  if (playing !== true) return null
  var wave = null
  try {
    wave = player.getWave()
  } catch (error) {
    wave = null
  }
  if ((wave === null || wave === undefined || wave.length === 0) && typeof player.ensureAnalyser === 'function') {
    try {
      player.ensureAnalyser()
      wave = player.getWave()
    } catch (error) {
      wave = null
    }
  }
  if (wave === null || wave === undefined || wave.length === 0) return foliaAudioBreath()
  return foliaAudioBandsFromWave(wave)
}
