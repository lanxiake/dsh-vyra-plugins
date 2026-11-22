/**
 * 音量平衡 — Folia's `balanceRules.ts` decisions for ReplayGain mode `auto`.
 *
 * Production asks the already-bundled Folia engine for the decision, because the
 * engine and the player must share one rule set. The local implementation below
 * is the fallback used by the pure tests / a runtime without Web Audio.
 */

var VOLUME_BALANCE_TARGET_DB = -14
var VOLUME_BALANCE_MAX_BOOST_DB = 6
var VOLUME_BALANCE_PEAK_CEILING_DB = -1.5
var TAG_TARGET_OFFSET_DB = 4
var VOLUME_BALANCE_TYPICAL_SIZE = 20
var VOLUME_BALANCE_TYPICAL_FALLBACK_DB = -5
var BALANCE_SILENCE_DB = -90
var BALANCE_SAME_GAIN_DB = 0.05
var BALANCE_EARLY_MOVE_SEC = 10
var BALANCE_EARLY_RAMP_SEC = 2
var BALANCE_LATE_MOVE_SEC = 30
var BALANCE_LATE_RAMP_SEC = 5
var BALANCE_LATE_MIN_CUT_DB = 3
var BALANCE_SET_RAMP_SEC = 0.1

var __mpBalanceAudio = null

function balanceAudioApi() {
  if (__mpBalanceAudio !== null) return __mpBalanceAudio
  if (typeof window !== 'undefined' && window.__mpFoliaAudio) {
    __mpBalanceAudio = window.__mpFoliaAudio
    return __mpBalanceAudio
  }
  if (typeof __mpAudioBundle !== 'function') return null
  try {
    __mpBalanceAudio = __mpAudioBundle()
  } catch (error) {
    __mpBalanceAudio = null
  }
  return __mpBalanceAudio
}

function isAudibleMeasurement(measured) {
  return Boolean(measured && typeof measured.loudness === 'number' && measured.loudness > BALANCE_SILENCE_DB)
}

/** A gain that may lift: no more than the cap, and only while the peak stays under the ceiling. */
function liftWithinPeak(gainDb, peak) {
  if (gainDb <= 0) return gainDb
  if (!(typeof peak === 'number' && peak > 0)) return 0
  var headroomDb = VOLUME_BALANCE_PEAK_CEILING_DB - 20 * Math.log10(peak)
  return Math.min(gainDb, VOLUME_BALANCE_MAX_BOOST_DB, Math.max(0, headroomDb))
}

function typicalGainDbFallback(gains) {
  var recent = (gains || [])
    .slice(-VOLUME_BALANCE_TYPICAL_SIZE)
    .filter(function (value) { return typeof value === 'number' && isFinite(value) })
    .sort(function (a, b) { return a - b })
  if (recent.length === 0) return VOLUME_BALANCE_TYPICAL_FALLBACK_DB
  var middle = Math.floor(recent.length / 2)
  var median = recent.length % 2 ? recent[middle] : (recent[middle - 1] + recent[middle]) / 2
  return Math.min(0, median)
}

/** The exact Folia fallback when the engine bundle is unavailable. */
function chooseBalanceFallback(inputs) {
  var whole = [
    ['file', inputs && inputs.file],
    ['played', inputs && inputs.played],
    ['profile', inputs && inputs.profile],
  ]
  for (var i = 0; i < whole.length; i += 1) {
    var reading = whole[i][0]
    var measured = whole[i][1]
    if (!isAudibleMeasurement(measured)) continue
    var gainDb = VOLUME_BALANCE_TARGET_DB - measured.loudness
    return { reading: reading, gainDb: gainDb, effectiveGainDb: liftWithinPeak(gainDb, measured.peak), estimated: false }
  }
  var tag = inputs && inputs.tag
  if (tag && typeof tag.gainDb === 'number' && isFinite(tag.gainDb)) {
    var fromTag = tag.gainDb + TAG_TARGET_OFFSET_DB
    return { reading: 'tag', gainDb: fromTag, effectiveGainDb: liftWithinPeak(fromTag, tag.peak), estimated: false }
  }
  var estimates = [
    ['head', inputs && typeof inputs.head === 'number' ? VOLUME_BALANCE_TARGET_DB - inputs.head : null],
    ['platform', inputs && typeof inputs.platformDb === 'number' ? inputs.platformDb : null],
    ['live', inputs && typeof inputs.live === 'number' ? VOLUME_BALANCE_TARGET_DB - inputs.live : null],
    ['typical', inputs && typeof inputs.typicalDb === 'number' ? inputs.typicalDb : null],
  ]
  for (var j = 0; j < estimates.length; j += 1) {
    var estimate = estimates[j][1]
    if (typeof estimate === 'number' && isFinite(estimate)) {
      return { reading: estimates[j][0], gainDb: estimate, effectiveGainDb: Math.min(0, estimate), estimated: true }
    }
  }
  return {
    reading: 'typical',
    gainDb: VOLUME_BALANCE_TYPICAL_FALLBACK_DB,
    effectiveGainDb: VOLUME_BALANCE_TYPICAL_FALLBACK_DB,
    estimated: true,
  }
}

function chooseBalance(inputs) {
  var api = balanceAudioApi()
  if (api && typeof api.chooseBalance === 'function') return api.chooseBalance(inputs)
  return chooseBalanceFallback(inputs)
}

function typicalGainDb(gains) {
  var api = balanceAudioApi()
  if (api && typeof api.typicalGainDb === 'function') return api.typicalGainDb(gains)
  return typicalGainDbFallback(gains)
}

/**
 * The Folia fallback: set before sound, one eased move in a play, hold while a
 * blend is audible, otherwise null.
 */
function planBalanceMoveFallback(question) {
  var nextDb = Number(question.nextDb)
  var currentDb = Number(question.currentDb) || 0
  if (!isFinite(nextDb)) return null
  if (Math.abs(nextDb - currentDb) < BALANCE_SAME_GAIN_DB) return null
  if (question.playSec <= 0) return 'set'
  if (question.moved) return null
  var rampSec =
    question.playSec < BALANCE_EARLY_MOVE_SEC
      ? BALANCE_EARLY_RAMP_SEC
      : question.playSec < BALANCE_LATE_MOVE_SEC && nextDb <= currentDb - BALANCE_LATE_MIN_CUT_DB
        ? BALANCE_LATE_RAMP_SEC
        : null
  if (rampSec === null) return null
  return question.blendAudible ? 'hold' : { rampSec: rampSec }
}

function planBalanceMove(question) {
  var api = balanceAudioApi()
  if (api && typeof api.planBalanceMove === 'function') return api.planBalanceMove(question)
  return planBalanceMoveFallback(question)
}

/** Why a play does not describe the whole song, or null. */
function whyNotWholePlay(play, question) {
  var api = balanceAudioApi()
  if (api && typeof api.whyNotWholePlay === 'function') return api.whyNotWholePlay(play, question)
  if (!play) return 'no play'
  if (play.broken) return play.broken
  if (question && question.clip) return 'not the whole song (' + question.clip + ')'
  var duration = Number(question && question.duration)
  if (!(Number.isFinite(duration) && duration > 0)) return 'length unknown'
  var leadIn = Number(question && question.leadInSec) || 0
  if (play.fromSec > Math.max(0, leadIn) + 2) return 'started at ' + play.fromSec.toFixed(1) + 's'
  if (duration - play.toSec > 2) return 'stopped at ' + play.toSec.toFixed(1) + 's'
  if (play.loudness <= BALANCE_SILENCE_DB) return 'silence'
  return null
}

// The reading the balance stands on is the player's own (its snapshot's `gainAppliedDb` /
// `gainEstimated`, Folia's replayGainAppliedDb / replayGainEstimated): one authority, so the
// 音频增益 row cannot show one figure while the deck is playing another.
