/**
 * crossfade: decisions only (the two-deck machinery lives in 50-player).
 *
 * The goal is one switch, like a "smart transition": the engine analyses how
 * the current track ends and how the next one begins, then picks both the cut
 * point and the overlap length itself. Loudness is the signal we can measure
 * cheaply and reliably — no beat grid, no segment model.
 */

var CROSSFADE_MAX_SECONDS = 25
var CROSSFADE_MIN_SECONDS = 1
/** Start analysing this early; analysis is fast but the fetch is not. */
var CROSSFADE_PREPARE_SECONDS = 28
/** Only a genuinely silent intro is skipped, and never more than this. */
var CROSSFADE_INTRO_SKIP_SECONDS = 2
var CROSSFADE_SKIP_LIMIT_SECONDS = 10
/**
 * How long the incoming track is actually audible. The overlap may be longer
 * when the outgoing track has a quiet tail — the outgoing fade uses that whole
 * tail, but the next track only rises during the last few seconds, so it never
 * "starts singing" long before the hand-over.
 */
var CROSSFADE_INCOMING_SECONDS = 2.5

/**
 * The overlap length in use, or 0 when the transition is off. The switch and the maximum
 * are two stored values (as Folia's automixEnabled / crossfadeMaxSec): turning the switch
 * off must not throw away the length the listener chose.
 */
function crossfadeFadeSeconds(prefs) {
  var settings = prefs !== null && typeof prefs === 'object' ? prefs : {}
  if (settings.crossfadeEnabled !== true) return 0
  var value = Number(settings.crossfadeSeconds)
  if (!isFinite(value) || value <= 0) return 0
  return Math.min(CROSSFADE_MAX_SECONDS, Math.max(CROSSFADE_MIN_SECONDS, value))
}

/** Same album (and same album artist when both sides have one). */
function crossfadeSameAlbum(current, next) {
  if (!current || !next) return false
  var album = String(current.album || '').trim().toLowerCase()
  var nextAlbum = String(next.album || '').trim().toLowerCase()
  if (album === '' || album !== nextAlbum) return false
  var artist = String(current.albumArtist || current.artist || '').trim().toLowerCase()
  var nextArtist = String(next.albumArtist || next.artist || '').trim().toLowerCase()
  return artist === '' || nextArtist === '' || artist === nextArtist
}

/**
 * Whether the pair may be blended at all. Consecutive tracks from one album
 * keep their original join: albums are authored as continuous works (live
 * records, DJ mixes, concept albums) and blending them smears the artist's
 * transition. This is fixed behaviour, not a setting.
 */
function crossfadeNextAllowed(prefs, current, next) {
  if (!current || !next) return false
  if (String(current.path) === String(next.path)) return false
  if (crossfadeSameAlbum(current, next)) return false
  return true
}

/**
 * Decide the blend from the two measured envelopes.
 *
 * `current.outroQuietSec` is how long the outgoing track has been quiet at its
 * end (0 when it ends loud), `next.introQuietSec` the same at the start of the
 * incoming one. We fade through the quiet tail; if there is none we still
 * overlap a minimum amount instead of hard-cutting. A long silent intro is
 * skipped so the new track is already audible when the old one stops.
 */
function crossfadePlan(current, next, options) {
  var settings = options !== null && typeof options === 'object' ? options : {}
  var limit = crossfadeFadeSeconds(settings.prefs)
  if (limit <= 0) return null
  var remaining = Number(settings.remaining)
  if (!isFinite(remaining) || remaining <= 0) return null
  var total = Number(current && current.duration)
  var outro = Number(current && current.outroQuietSec)
  var introSilent = Number(next && next.introSilentSec)
  var nextDuration = Number(next && next.durationSec)
  if (!isFinite(outro) || outro < 0) outro = 0
  if (!isFinite(introSilent) || introSilent < 0) introSilent = 0
  // Folia's plain crossfade is deliberately blind: it reads only where the
  // outgoing track stops sounding and how much of the incoming track exists.
  var soundingEnd = isFinite(total) && total > 0 ? Math.max(0, total - outro) : 0
  var at = isFinite(total) && total > 0 ? Math.max(0, total - remaining) : 0
  var tailRoom = soundingEnd > 0 ? Math.max(0, soundingEnd - at) : remaining
  var inStart = Math.max(0, introSilent - 0.1)
  var incomingRoom = isFinite(nextDuration) && nextDuration > 0
    ? Math.max(0, nextDuration - inStart)
    : Infinity
  var quarter = soundingEnd > 0 ? soundingEnd / 4 : Infinity
  var overlap = Math.min(limit, tailRoom, incomingRoom, quarter)
  if (overlap < CROSSFADE_MIN_SECONDS) return null
  return {
    overlap: Math.round(overlap * 100) / 100,
    startInNext: Math.round(inStart * 100) / 100,
  }
}

/**
 * Pure gate used by the player on every timeupdate: are we close enough to the
 * end to start analysing?
 */
function crossfadeShouldStart(input) {
  var s = input !== null && typeof input === 'object' ? input : {}
  if (crossfadeFadeSeconds(s.prefs) <= 0) return false
  if (s.playing !== true) return false
  if (s.hasGraph !== true) return false
  if (s.loop === 'one') return false
  var index = Number(s.index)
  var queueLength = Number(s.queueLength)
  if (!(index >= 0) || !(queueLength > 1)) return false
  if (s.loop === 'none' && index >= queueLength - 1) return false
  var duration = Number(s.duration)
  var time = Number(s.currentTime)
  if (!(duration > 0) || !(time >= 0)) return false
  var remaining = duration - time
  if (remaining > CROSSFADE_PREPARE_SECONDS) return false
  // Too close to the end to build anything that finishes inside the track.
  if (remaining <= 0.5) return false
  return true
}

/** Split an overlap into "outgoing only" + "both audible" segments. */
function crossfadeIncomingWindow(overlap) {
  var total = Math.max(0, Number(overlap) || 0)
  var window = Math.min(total, CROSSFADE_INCOMING_SECONDS)
  return { window: Math.round(window * 10) / 10, delay: Math.round((total - window) * 10) / 10 }
}

/* Folia's key relation: only the END of the outgoing and the START of the incoming matter. */
var CROSSFADE_MIN_KEY_CONFIDENCE = 0.25
var CROSSFADE_KEY_LENGTH_SCALE = {
  compatible: 1,
  adjacent: 0.85,
  neutral: 0.7,
  clashing: 0.4,
  unknown: 1,
}

function crossfadeKeyEstimate(profile, which) {
  if (!profile) return null
  var endpoint = which === 'outro' ? profile.outroKey : profile.introKey
  var usable = function (estimate) {
    return estimate && typeof estimate.key === 'number' && estimate.key >= 0 && typeof estimate.confidence === 'number' && estimate.confidence >= CROSSFADE_MIN_KEY_CONFIDENCE
      ? estimate
      : null
  }
  return usable(endpoint) || usable({
    key: profile.key,
    major: profile.major,
    confidence: profile.keyConfidence,
  })
}

function crossfadeKeyRelation(from, to) {
  var a = crossfadeKeyEstimate(from, 'outro')
  var b = crossfadeKeyEstimate(to, 'intro')
  if (!a || !b) return 'unknown'
  var interval = ((b.key - a.key) % 12 + 12) % 12
  if (a.major === b.major) {
    if (interval === 0 || interval === 7 || interval === 5) return 'compatible'
    if (interval === 2 || interval === 10) return 'adjacent'
  } else if ((a.major && interval === 9) || (!a.major && interval === 3)) {
    return 'compatible'
  } else if (interval === 0) {
    return 'adjacent'
  }
  if (interval === 1 || interval === 11 || interval === 6) return 'clashing'
  return 'neutral'
}

function crossfadeKeyLengthScale(relation) {
  return CROSSFADE_KEY_LENGTH_SCALE[relation] || 1
}

/** Equal-power pair for N+1 curve points (cos falls, sin rises). */
function crossfadeEqualPowerCurves(steps) {
  var points = Math.max(2, Math.floor(Number(steps) || 32)) + 1
  var out = new Float32Array(points)
  var incoming = new Float32Array(points)
  for (var index = 0; index < points; index += 1) {
    var ratio = index / (points - 1)
    out[index] = Math.cos((ratio * Math.PI) / 2)
    incoming[index] = Math.sin((ratio * Math.PI) / 2)
  }
  return { out: out, incoming: incoming }
}
