/**
 * transition analysis: how a track starts and ends, measured from its samples.
 *
 * Deliberately narrow: we only need to know how many seconds at the beginning
 * and at the end sit well below the track's own average level. That is enough
 * to choose a crossfade point and length without pretending to understand the
 * music (no beat grid, no segment model).
 */

/** Window/hop for the level envelope (seconds). */
var TRANSITION_WINDOW = 0.1
var TRANSITION_HOP = 0.05
/** Only the first/last stretches can contain the transition. */
var TRANSITION_HEAD = 20
var TRANSITION_TAIL = 30
/** "Quiet" means this far below the track's own average level. */
var TRANSITION_QUIET_DB = -10
/**
 * "Silent" is absolute: only a genuinely empty intro may be skipped. A soft
 * musical intro is often 10 dB below the average, and skipping that would cut
 * real music off the front of the next track.
 */
var TRANSITION_SILENT_DB = -45

function transitionRmsDb(channels, start, length, weight) {
  var sum = 0
  var samples = 0
  for (var channel = 0; channel < channels.length; channel += 1) {
    var data = channels[channel]
    var end = Math.min(start + length, data.length)
    var energy = 0
    for (var index = start; index < end; index += 1) energy += data[index] * data[index]
    sum += (weight && weight[channel] ? weight[channel] : 1) * energy
    samples += Math.max(0, end - start)
  }
  if (samples <= 0) return -Infinity
  var mean = sum / samples
  if (!(mean > 0)) return -Infinity
  return 10 * Math.log10(mean)
}

/**
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 * @returns {{ duration: number, loudnessDb: number, introQuietSec: number, outroQuietSec: number } | null}
 */
function analyzeTransitionEnvelope(channels, sampleRate) {
  if (!Array.isArray(channels) || channels.length === 0) return null
  var rate = Number(sampleRate)
  if (!(rate > 0)) return null
  var length = channels[0].length
  if (!(length > 0)) return null
  var duration = length / rate
  var windowSize = Math.max(1, Math.round(TRANSITION_WINDOW * rate))
  var hop = Math.max(1, Math.round(TRANSITION_HOP * rate))

  // Average level over the whole file, sampled sparsely: enough to anchor the
  // quiet threshold without walking every sample.
  var overallSum = 0
  var overallCount = 0
  for (var channel = 0; channel < channels.length; channel += 1) {
    var data = channels[channel]
    for (var index = 0; index < data.length; index += 16) {
      overallSum += data[index] * data[index]
      overallCount += 1
    }
  }
  var loudnessDb = overallCount > 0 && overallSum > 0 ? 10 * Math.log10(overallSum / overallCount) : -Infinity
  var quietThreshold = loudnessDb + TRANSITION_QUIET_DB

  function windowDb(start) {
    return transitionRmsDb(channels, start, windowSize, null)
  }

  var headLimit = Math.min(length, Math.round(TRANSITION_HEAD * rate))
  var tailStart = Math.max(0, length - Math.round(TRANSITION_TAIL * rate))

  function round(value) {
    return Math.round(Math.max(0, value) * 10) / 10
  }

  // A file with no measurable level at all (silence, or a decode that produced
  // zeros): every edge counts as quiet, so let the caller clamp it.
  if (!isFinite(loudnessDb)) {
    return {
      duration: round(duration),
      loudnessDb: -70,
      introQuietSec: round(headLimit / rate),
      introSilentSec: round(headLimit / rate),
      outroQuietSec: round((length - tailStart) / rate),
    }
  }

  // Intro: walk forward from 0 until a window is no longer quiet. The silent
  // measurement is stricter and is the only one allowed to skip audio.
  var introQuietSec = headLimit / rate
  var introSilentSec = headLimit / rate
  var quietEnded = false
  var silentEnded = false
  for (var start = 0; start + windowSize <= headLimit; start += hop) {
    var level = windowDb(start)
    if (!quietEnded && level >= quietThreshold) {
      introQuietSec = start / rate
      quietEnded = true
    }
    if (!silentEnded && level >= TRANSITION_SILENT_DB) {
      introSilentSec = start / rate
      silentEnded = true
    }
    if (quietEnded && silentEnded) break
  }

  // Outro: walk backwards from the end until a window is loud again.
  var outroQuietSec = (length - tailStart) / rate
  for (var back = length - windowSize; back >= tailStart; back -= hop) {
    if (windowDb(back) >= quietThreshold) {
      outroQuietSec = (length - (back + windowSize)) / rate
      break
    }
  }

  return {
    duration: round(duration),
    loudnessDb: Math.round(loudnessDb * 10) / 10,
    introQuietSec: round(introQuietSec),
    introSilentSec: round(introSilentSec),
    outroQuietSec: round(outroQuietSec),
  }
}

/** Same analysis straight from a decoded AudioBuffer. */
function analyzeTransitionBuffer(buffer) {
  if (!buffer || typeof buffer.getChannelData !== 'function') return null
  var channels = []
  for (var index = 0; index < buffer.numberOfChannels; index += 1) {
    channels.push(buffer.getChannelData(index))
  }
  return analyzeTransitionEnvelope(channels, buffer.sampleRate)
}
