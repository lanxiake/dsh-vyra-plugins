/**
 * 音量平衡的运行时 — Folia's `balanceMeter.ts` + `balanceRecords.ts`, ported.
 *
 * The meter taps a deck *ahead of* the balance gain (so it hears the song, not the
 * correction), K-weights each channel, gates 400 ms blocks the BS.1770 way, and
 * tracks how much of the media actually sounded. A whole play becomes a reading
 * for that song; the last readings give the typical gain used before anything is
 * known. Storage is localStorage (`music.balance.v1`).
 */

var BALANCE_METER_KEY = 'music.balance.v1'
var BALANCE_LIVE_MIN_SOUND_SEC = 10
var BALANCE_PLAY_MISS_TOLERANCE_SEC = 2
var BALANCE_BLOCK_SEC = 0.4
var BALANCE_STEP_SEC = 0.1
var BALANCE_ABS_GATE_LUFS = -70
var BALANCE_REL_GATE_LU = 10
var BALANCE_LUFS_OFFSET_DB = -0.691
var BALANCE_MAX_RECORDS = 600

function readBalanceStore() {
  try {
    var raw = window.localStorage.getItem(BALANCE_METER_KEY)
    var parsed = raw === null ? null : JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return { songs: {}, typical: [] }
    var songs = {}
    var sourceSongs = parsed.songs && typeof parsed.songs === 'object' ? parsed.songs : {}
    Object.keys(sourceSongs).forEach(function (path) {
      var entry = sourceSongs[path]
      if (entry === null || typeof entry !== 'object') return
      // v1 stored one flat reading; it was a whole-play reading.
      if (typeof entry.loudness === 'number') {
        songs[path] = {
          played: { loudness: entry.loudness, peak: typeof entry.peak === 'number' ? entry.peak : null },
          at: Number(entry.at) || 0,
        }
        return
      }
      var next = { at: Number(entry.at) || 0 }
      if (entry.file && typeof entry.file.loudness === 'number') {
        next.file = { loudness: entry.file.loudness, peak: typeof entry.file.peak === 'number' ? entry.file.peak : null }
      }
      if (entry.played && typeof entry.played.loudness === 'number') {
        next.played = { loudness: entry.played.loudness, peak: typeof entry.played.peak === 'number' ? entry.played.peak : null }
      }
      if (next.file || next.played) songs[path] = next
    })
    var typical = []
    ;(Array.isArray(parsed.typical) ? parsed.typical : []).forEach(function (entry, index) {
      if (typeof entry === 'number' && isFinite(entry)) {
        typical.push({ key: '', gainDb: entry })
      } else if (entry && typeof entry.gainDb === 'number' && isFinite(entry.gainDb)) {
        typical.push({ key: String(entry.key || ''), gainDb: entry.gainDb })
      }
    })
    return { songs: songs, typical: typical.slice(-VOLUME_BALANCE_TYPICAL_SIZE) }
  } catch (error) {
    return { songs: {}, typical: [] }
  }
}

var balanceStoreData = readBalanceStore()

/** Forget every balance record (设置 · 存储与备份 · 清除智能平衡数据). */
function clearBalanceStore() {
  balanceStoreData = { songs: {}, typical: [] }
  try {
    window.localStorage.removeItem(BALANCE_METER_KEY)
  } catch (error) {
    // Blocked storage: the in-memory copy is already empty.
  }
}

function writeBalanceStore() {
  try {
    window.localStorage.setItem(BALANCE_METER_KEY, JSON.stringify(balanceStoreData))
  } catch (error) {
    // Quota/private mode: the in-memory copy still works for this session.
  }
}

/** The file and whole-play loudness records for a song, as Folia keeps them. */
function balanceRecordFor(path) {
  var entry = path ? balanceStoreData.songs[path] : null
  if (!entry) return null
  var record = {}
  if (entry.file && typeof entry.file.loudness === 'number') record.file = entry.file
  if (entry.played && typeof entry.played.loudness === 'number') record.played = entry.played
  return record.file || record.played ? record : null
}

/** The gains of the last whole-track readings, oldest first. */
function balanceTypicalGains() {
  return balanceStoreData.typical.slice(-VOLUME_BALANCE_TYPICAL_SIZE).map(function (entry) { return entry.gainDb })
}

/** Count one whole-track gain once per song, as Folia's noteWholeReading does. */
function noteTypicalReading(path, gainDb) {
  if (typeof gainDb !== 'number' || !isFinite(gainDb)) return
  var key = String(path || '')
  balanceStoreData.typical = balanceStoreData.typical.filter(function (entry) {
    return entry.key !== key
  })
  balanceStoreData.typical.push({ key: key, gainDb: gainDb })
  if (balanceStoreData.typical.length > VOLUME_BALANCE_TYPICAL_SIZE) {
    balanceStoreData.typical = balanceStoreData.typical.slice(-VOLUME_BALANCE_TYPICAL_SIZE)
  }
}

/** Keep a file / played reading; silence is not a reading. */
function noteBalanceMeasurement(path, kind, measured) {
  if (!path || (kind !== 'file' && kind !== 'played')) return
  if (!measured || typeof measured.loudness !== 'number') return
  if (!(measured.loudness > -90)) return
  var entry = balanceStoreData.songs[path] || {}
  entry[kind] = {
    loudness: measured.loudness,
    peak: typeof measured.peak === 'number' ? measured.peak : null,
  }
  entry.at = Date.now()
  balanceStoreData.songs[path] = entry
  noteTypicalReading(path, VOLUME_BALANCE_TARGET_DB - measured.loudness)
  var keys = Object.keys(balanceStoreData.songs)
  if (keys.length > BALANCE_MAX_RECORDS) {
    keys
      .sort(function (a, b) { return (balanceStoreData.songs[a].at || 0) - (balanceStoreData.songs[b].at || 0) })
      .slice(0, keys.length - BALANCE_MAX_RECORDS)
      .forEach(function (key) { delete balanceStoreData.songs[key] })
  }
  writeBalanceStore()
}

/** v1 API kept for callers that only know a played reading. */
function noteBalanceReading(path, measured, _gainDb) {
  noteBalanceMeasurement(path, 'played', measured)
}

/** K-weighting as two biquads, coefficients derived at the running sample rate. */
function balanceKWeight(sampleRate) {
  var shelfHz = 1681.974450955533
  var shelfGainDb = 3.999843853973347
  var shelfQ = 0.7071752369554196
  var k1 = Math.tan((Math.PI * shelfHz) / sampleRate)
  var vh = Math.pow(10, shelfGainDb / 20)
  var vb = Math.pow(vh, 0.4996667741545416)
  var d0 = 1 + k1 / shelfQ + k1 * k1
  var b0 = (vh + (vb * k1) / shelfQ + k1 * k1) / d0
  var b1 = (2 * (k1 * k1 - vh)) / d0
  var b2 = (vh - (vb * k1) / shelfQ + k1 * k1) / d0
  var a0 = (2 * (k1 * k1 - 1)) / d0
  var a1 = (1 - k1 / shelfQ + k1 * k1) / d0
  var hpHz = 38.13547087602444
  var hpQ = 0.5003270373238773
  var k2 = Math.tan((Math.PI * hpHz) / sampleRate)
  var d1 = 1 + k2 / hpQ + k2 * k2
  var c0 = (2 * (k2 * k2 - 1)) / d1
  var c1 = (1 - k2 / hpQ + k2 * k2) / d1
  var x1 = 0
  var x2 = 0
  var y1 = 0
  var y2 = 0
  var p1 = 0
  var p2 = 0
  var q1 = 0
  var q2 = 0
  return function (x) {
    var y = b0 * x + b1 * x1 + b2 * x2 - a0 * y1 - a1 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    var z = y + c0 * p1 + p2 - a0 * q1 - a1 * q2
    p2 = p1
    p1 = y
    q2 = q1
    q1 = z
    return z
  }
}

/** Integrated loudness (LUFS) from 100 ms mean squares, gated like BS.1770. */
function balanceLoudnessOf(steps) {
  var blockSteps = Math.round(BALANCE_BLOCK_SEC / BALANCE_STEP_SEC)
  var blocks = []
  for (var start = 0; start + blockSteps <= steps.length; start += 1) {
    var energy = 0
    for (var index = 0; index < blockSteps; index += 1) energy += steps[start + index]
    energy /= blockSteps
    if (energy > 0) blocks.push({ energy: energy, loudness: BALANCE_LUFS_OFFSET_DB + 10 * Math.log10(energy) })
  }
  var gated = blocks.filter(function (block) {
    return block.loudness > BALANCE_ABS_GATE_LUFS
  })
  if (gated.length === 0) return null
  var mean = gated.reduce(function (sum, block) {
    return sum + block.energy
  }, 0) / gated.length
  var relative = BALANCE_LUFS_OFFSET_DB + 10 * Math.log10(mean) - BALANCE_REL_GATE_LU
  var final = gated.filter(function (block) {
    return block.loudness > relative
  })
  if (final.length === 0) return null
  var energy = final.reduce(function (sum, block) {
    return sum + block.energy
  }, 0) / final.length
  return BALANCE_LUFS_OFFSET_DB + 10 * Math.log10(energy)
}

/**
 * One meter per deck, ticking from the player's timeupdate.
 *
 * @param {AnalyserNode} left tap on the left channel, ahead of the balance gain
 * @param {AnalyserNode} right tap on the right channel
 * @param {HTMLAudioElement} audio the deck it measures
 */
function createBalanceMeter(left, right, audio) {
  var size = left.fftSize
  var sampleRate = left.context.sampleRate
  var buffers = [new Float32Array(size), new Float32Array(size)]
  var weights = [balanceKWeight(sampleRate), balanceKWeight(sampleRate)]
  var stepLength = Math.round(sampleRate * BALANCE_STEP_SEC)
  var steps = []
  var power = 0
  var filled = 0
  var peak = 0
  var heard = 0
  var fromSec = null
  var toSec = 0
  var lastPosition = null
  var broken = null

  function reset() {
    weights = [balanceKWeight(sampleRate), balanceKWeight(sampleRate)]
    steps = []
    power = 0
    filled = 0
    peak = 0
    heard = 0
    fromSec = null
    toSec = 0
    lastPosition = null
    broken = null
  }

  reset()

  return {
    reset: reset,
    /** Read what the deck played since the last tick. */
    tick: function () {
      if (!audio || audio.paused || audio.readyState < 2) {
        lastPosition = audio ? audio.currentTime : null
        return
      }
      var at = audio.currentTime
      if (lastPosition !== null) {
        var advanced = at - lastPosition
        if (advanced > 0.5) broken = broken || 'seek'
        if (advanced > 0) {
          if (fromSec === null) fromSec = lastPosition
          toSec = at
          heard += advanced
        }
      }
      lastPosition = at
      left.getFloatTimeDomainData(buffers[0])
      right.getFloatTimeDomainData(buffers[1])
      for (var index = 0; index < size; index += 1) {
        var l = buffers[0][index]
        var r = buffers[1][index]
        var absL = l < 0 ? -l : l
        var absR = r < 0 ? -r : r
        if (absL > peak) peak = absL
        if (absR > peak) peak = absR
        var wl = weights[0](l)
        var wr = weights[1](r)
        power += wl * wl + wr * wr
        filled += 1
        if (filled >= stepLength) {
          steps.push(power / stepLength)
          power = 0
          filled = 0
        }
      }
    },
    heardSec: function () {
      return heard
    },
    /** The loudness heard so far, once enough of it was sound. */
    liveLoudness: function () {
      if (heard < BALANCE_LIVE_MIN_SOUND_SEC) return null
      return balanceLoudnessOf(steps)
    },
    /** This play so far, or null before it sounded. */
    play: function () {
      if (heard <= 0) return null
      return {
        loudness: balanceLoudnessOf(steps),
        peak: peak,
        heardSec: heard,
        fromSec: fromSec === null ? 0 : fromSec,
        toSec: toSec,
        broken: broken,
      }
    },
  }
}

/** Why this play is not the whole song, or null; the engine owns the rule. */
function balanceWholePlayIssue(play, durationSec, leadInSec) {
  if (!play) return 'no play'
  var issue = whyNotWholePlay(play, { duration: durationSec, leadInSec: Number(leadInSec) || 0 })
  return issue === null || issue === undefined ? null : String(issue).trim()
}

