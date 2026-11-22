/**
 * Folia's ReplayGain arithmetic, ported from
 * A_other/upstream/folia-major-main/src/utils/replayGain.ts.
 *
 * 选模式、专辑回退到单曲、正增益按 peak 防削波；'auto'（智能平衡）不在这里，
 * 它按每首歌的测量值由引擎的 balance 逻辑决定。
 */

function replayGainFinite(value) {
  if (typeof value === 'number') return isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  var parsed = Number(value)
  return isFinite(parsed) ? parsed : undefined
}

function replayGainLinearPeak(decibels) {
  var value = replayGainFinite(decibels)
  return value === undefined ? undefined : Math.pow(10, value / 20)
}

/**
 * @param {{trackGain?:number, trackPeak?:number, albumGain?:number, albumPeak?:number}|null} info
 * @param {'off'|'track'|'album'} mode
 * @returns {{gainDb:number, effectiveGainDb:number, peak?:number, linearGain:number}}
 */
function calculateReplayGain(info, mode) {
  if (info === null || info === undefined || mode === 'off') {
    return { gainDb: 0, effectiveGainDb: 0, linearGain: 1 }
  }
  var gainDb = mode === 'album'
    ? replayGainFinite(info.albumGain) ?? replayGainFinite(info.trackGain) ?? 0
    : replayGainFinite(info.trackGain) ?? 0
  var peak = mode === 'album'
    ? replayGainFinite(info.albumPeak) ?? replayGainFinite(info.trackPeak)
    : replayGainFinite(info.trackPeak)
  var effectiveGainDb = gainDb
  if (gainDb > 0 && peak !== undefined && peak > 0) {
    var clipSafeGainDb = -20 * Math.log10(peak)
    effectiveGainDb = Math.min(gainDb, clipSafeGainDb)
  }
  return {
    gainDb: gainDb,
    effectiveGainDb: effectiveGainDb,
    peak: peak,
    linearGain: Math.pow(10, effectiveGainDb / 20),
  }
}
