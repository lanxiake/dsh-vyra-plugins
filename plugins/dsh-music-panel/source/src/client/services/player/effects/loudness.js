/**
 * Self-contained EBU R128 integrated-loudness analysis.
 *
 * The browser's own decoder + OfflineAudioContext provide the K-weighting
 * filters, so no ffmpeg or npm runtime is required. Results are cached by
 * track path + file size and applied through the player's GainNode.
 */

var LOUDNESS_CACHE_KEY = 'music.loudness.v1'
var LOUDNESS_TARGET = -14
var loudnessDecoder = null
var loudnessCache = readLoudnessCache()

function readLoudnessCache() {
  try {
    var raw = window.localStorage.getItem(LOUDNESS_CACHE_KEY)
    var parsed = raw === null ? null : JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

function writeLoudnessCache(cache) {
  try {
    window.localStorage.setItem(LOUDNESS_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    // Quota/private mode: in-memory cache still works.
  }
}

function loudnessCacheKey(item, blob) {
  return String(item.path || '') + '|' + String(blob.size || 0)
}

function lookupLoudnessMeasurement(key) {
  var row = loudnessCache[key]
  if (!row || typeof row.loudness !== 'number' || !Number.isFinite(row.loudness)) return null
  return {
    loudness: row.loudness,
    peak: typeof row.peak === 'number' ? row.peak : null,
    leadIn: typeof row.leadIn === 'number' ? row.leadIn : 0,
  }
}

function storeLoudnessMeasurement(key, measured) {
  loudnessCache[key] = {
    loudness: measured.loudness,
    peak: measured.peak,
    leadIn: typeof measured.leadIn === 'number' ? measured.leadIn : 0,
    at: Date.now(),
  }
  var keys = Object.keys(loudnessCache)
  if (keys.length > 1200) {
    keys
      .sort(function (left, right) {
        return (loudnessCache[left].at || 0) - (loudnessCache[right].at || 0)
      })
      .slice(0, keys.length - 1200)
      .forEach(function (old) {
        delete loudnessCache[old]
      })
  }
  writeLoudnessCache(loudnessCache)
}

function loudnessContext() {
  if (loudnessDecoder !== null) return loudnessDecoder
  // Folia decodes at 22.05 kHz so the file measurement and the live meter use
  // the same analysis band. decodeAudioData resamples into this context.
  var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  try {
    if (Offline) loudnessDecoder = new Offline(2, 1, 22050)
    else loudnessDecoder = new (window.AudioContext || window.webkitAudioContext)()
  } catch (error) {
    loudnessDecoder = null
  }
  return loudnessDecoder
}

var profileAnalysisCache = null

function profileAnalysisApi() {
  if (profileAnalysisCache !== null) return profileAnalysisCache
  if (typeof __mpProfileBundle !== 'function') return null
  try {
    profileAnalysisCache = __mpProfileBundle()
    return profileAnalysisCache
  } catch (error) {
    return null
  }
}

var profileWorker = null
var profileWorkerId = 0
var profileWorkerPending = {}

function profileWorkerFor() {
  if (profileWorker !== null) return profileWorker
  if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined') return null
  if (typeof __mpProfileBundle !== 'function') return null
  try {
    var source = __mpProfileBundle.toString()
    var code = source + '\nvar __api = __mpProfileBundle(); self.onmessage = function (event) {'
      + ' var data = event.data; Promise.resolve(__api.analyseTrack(data.mono, data.sampleRate, { partial: data.partial, side: data.side }))'
      + ' .then(function (profile) { self.postMessage({ id: data.id, profile: profile }); })'
      + ' .catch(function (error) { self.postMessage({ id: data.id, error: String(error && error.message ? error.message : error) }); }); };'
    var url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    var worker = new Worker(url)
    URL.revokeObjectURL(url)
    worker.onmessage = function (event) {
      var pending = profileWorkerPending[event.data.id]
      if (!pending) return
      delete profileWorkerPending[event.data.id]
      if (event.data.error) pending.reject(new Error(event.data.error))
      else pending.resolve(event.data.profile)
    }
    worker.onerror = function (event) {
      Object.keys(profileWorkerPending).forEach(function (id) {
        var pending = profileWorkerPending[id]
        delete profileWorkerPending[id]
        pending.reject(new Error(event.message || 'profile worker failed'))
      })
      try { worker.terminate() } catch (error) {}
      profileWorker = null
    }
    profileWorker = worker
    return worker
  } catch (error) {
    profileWorker = null
    return null
  }
}

function fullProfileInWorker(mono, side, sampleRate, partial) {
  var worker = profileWorkerFor()
  if (worker === null) return null
  var id = (profileWorkerId += 1)
  return new Promise(function (resolve, reject) {
    profileWorkerPending[id] = { resolve: resolve, reject: reject }
    try {
      var transfer = [mono.buffer]
      if (side !== null) transfer.push(side.buffer)
      worker.postMessage({ id: id, mono: mono, side: side, sampleRate: sampleRate, partial: partial }, transfer)
    } catch (error) {
      delete profileWorkerPending[id]
      reject(error)
    }
  })
}

/** Folia's full track profile, from the same decoded buffer the loudness uses. */
function fullProfileOfBuffer(buffer, partial) {
  var api = profileAnalysisApi()
  if (!api || typeof api.analyseTrack !== 'function') return Promise.resolve(null)
  var left = buffer.getChannelData(0)
  var mid = new Float32Array(buffer.length)
  var side = buffer.numberOfChannels > 1 ? new Float32Array(buffer.length) : null
  var right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null
  for (var index = 0; index < buffer.length; index += 1) {
    var l = left[index]
    var r = right === null ? l : right[index]
    mid[index] = (l + r) / 2
    if (side !== null) side[index] = (l - r) / 2
  }
  var options = { partial: partial === true, side: side }
  var workerSide = side === null ? null : side.slice()
  var workerCall = fullProfileInWorker(mid.slice(), workerSide, buffer.sampleRate, partial === true)
  if (workerCall !== null) {
    return workerCall.catch(function () {
      return api.analyseTrack(mid, buffer.sampleRate, options)
    })
  }
  return api.analyseTrack(mid, buffer.sampleRate, options)
}

/** Folia's K-weighting + gated loudness, on a decoded buffer. */
function lufsWithFoliaMath(buffer) {
  var api = typeof balanceAudioApi === 'function' ? balanceAudioApi() : null
  if (!api || typeof api.kWeightStep !== 'function' || typeof api.gatedLoudness !== 'function') return null
  var sampleRate = buffer.sampleRate
  var stepLength = Math.round(sampleRate / 10)
  if (!(stepLength > 0)) return null
  var channels = []
  var filters = []
  var count = Math.min(2, buffer.numberOfChannels)
  for (var ch = 0; ch < count; ch += 1) {
    channels.push(buffer.getChannelData(ch))
    filters.push(api.kWeightStep(sampleRate))
  }
  if (channels.length === 0) return null
  var steps = []
  var power = 0
  var filled = 0
  var length = channels[0].length
  for (var index = 0; index < length; index += 1) {
    var weighted = 0
    for (var c = 0; c < channels.length; c += 1) {
      var value = filters[c](channels[c][index])
      weighted += value * value
    }
    power += weighted
    filled += 1
    if (filled === stepLength) {
      steps.push(power / stepLength)
      power = 0
      filled = 0
    }
  }
  var lufs = api.gatedLoudness(steps)
  return Number.isFinite(lufs) && lufs > -90 ? lufs : null
}

/** Integrated loudness in LUFS, following ITU-R BS.1770-4 / EBU R128. */
function lufsFromAudioBuffer(buffer) {
  var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Offline) return Promise.reject(new Error('OfflineAudioContext unavailable'))
  var folia = lufsWithFoliaMath(buffer)
  if (folia !== null) return Promise.resolve(folia)
  return new Promise(function (resolve, reject) {
    var offline
    try {
      offline = new Offline(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
      var source = offline.createBufferSource()
      source.buffer = buffer
      var shelf = offline.createBiquadFilter()
      shelf.type = 'highshelf'
      shelf.frequency.value = 1681.974450955533
      shelf.gain.value = 3.999843853973347
      shelf.Q.value = 0.7071752369554196
      var highpass = offline.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 38.13547087602444
      highpass.Q.value = 0.5003270373238773
      source.connect(shelf)
      shelf.connect(highpass)
      highpass.connect(offline.destination)
      source.start()
    } catch (error) {
      reject(error)
      return
    }
    offline
      .startRendering()
      .then(function (rendered) {
        var lufs = integratedLoudnessOf(rendered)
        if (lufs === null) reject(new Error('no gated loudness blocks'))
        else resolve(lufs)
      })
      .catch(reject)
  })
}

/** Mean square per gated 400 ms block, with surround channel weights. */
function integratedLoudnessOf(buffer) {
  var sampleRate = buffer.sampleRate
  var blockSize = Math.round(0.4 * sampleRate)
  var step = Math.round(0.1 * sampleRate)
  if (blockSize <= 0 || buffer.length < blockSize) return null
  var channels = []
  for (var channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel))
  }
  var weights = channels.map(function (_, index) {
    return index === 3 || index === 4 ? 1.41 : 1
  })
  var blocks = []
  for (var start = 0; start + blockSize <= buffer.length; start += step) {
    var energy = 0
    for (var ch = 0; ch < channels.length; ch += 1) {
      var data = channels[ch]
      var sum = 0
      for (var i = start; i < start + blockSize; i += 1) sum += data[i] * data[i]
      energy += weights[ch] * (sum / blockSize)
    }
    var loudness = -0.691 + 10 * Math.log10(energy)
    if (loudness > -70) blocks.push({ loudness: loudness, energy: energy })
  }
  if (blocks.length === 0) return null
  var absoluteEnergy =
    blocks.reduce(function (sum, block) {
      return sum + block.energy
    }, 0) / blocks.length
  var relativeGate = -0.691 + 10 * Math.log10(absoluteEnergy) - 10
  var gated = blocks.filter(function (block) {
    return block.loudness > relativeGate
  })
  if (gated.length === 0) return null
  var finalEnergy =
    gated.reduce(function (sum, block) {
      return sum + block.energy
    }, 0) / gated.length
  return -0.691 + 10 * Math.log10(finalEnergy)
}

/** Loudest sample of the decoded file, linear, for the balance's peak ceiling. */
function leadInOfAudioBuffer(buffer) {
  var sampleRate = buffer.sampleRate
  var block = Math.max(1, Math.round(sampleRate * 0.05))
  var threshold = Math.pow(10, -50 / 20)
  var channels = []
  for (var channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel))
  }
  for (var start = 0; start + block <= buffer.length; start += block) {
    for (var ch = 0; ch < channels.length; ch += 1) {
      var data = channels[ch]
      var sum = 0
      for (var index = start; index < start + block; index += 1) sum += data[index] * data[index]
      if (Math.sqrt(sum / block) > threshold) return start / sampleRate
    }
  }
  return 0
}

function peakOfAudioBuffer(buffer) {
  var peak = 0
  for (var channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    var data = buffer.getChannelData(channel)
    for (var index = 0; index < data.length; index += 1) {
      var value = data[index] < 0 ? -data[index] : data[index]
      if (value > peak) peak = value
    }
  }
  return peak
}

function analyzeLoudnessBlob(item, blob, isCurrent, onMeasured) {
  if (!item || !blob || typeof isCurrent !== 'function') return Promise.resolve(null)
  var key = loudnessCacheKey(item, blob)
  var cached = lookupLoudnessMeasurement(key)
  if (cached !== null) {
    noteBalanceMeasurement(item.path, 'file', cached)
    if (profileFor(item.path) === null) {
      noteProfile(item.path, { programLoudness: cached.loudness, peak: cached.peak, leadIn: cached.leadIn, partial: false })
    }
    if (isCurrent() && typeof onMeasured === 'function') onMeasured(cached)
    return Promise.resolve(cached)
  }
  var decoder = loudnessContext()
  if (decoder === null) return Promise.resolve(null)
  var measuredBuffer = null
  return blob
    .arrayBuffer()
    .then(function (bytes) {
      return decoder.decodeAudioData(bytes)
    })
    .then(function (buffer) {
      if (!isCurrent()) return null
      measuredBuffer = buffer
      return fullProfileOfBuffer(buffer, false).then(function (profile) {
        if (profile && typeof profile.programLoudness === 'number' && profile.programLoudness > -90) return profile
        return lufsFromAudioBuffer(buffer).then(function (lufs) {
          return lufs === null ? null : {
            programLoudness: lufs,
            peak: peakOfAudioBuffer(buffer),
            leadIn: leadInOfAudioBuffer(buffer),
            partial: false,
          }
        })
      })
    })
    .then(function (profile) {
      if (!profile || typeof profile.programLoudness !== 'number' || !isCurrent()) return null
      var measured = {
        loudness: profile.programLoudness,
        peak: typeof profile.peak === 'number' ? profile.peak : peakOfAudioBuffer(measuredBuffer),
        leadIn: typeof profile.leadIn === 'number' ? profile.leadIn : leadInOfAudioBuffer(measuredBuffer),
        partial: false,
      }
      noteBalanceMeasurement(item.path, 'file', measured)
      noteProfile(item.path, Object.assign({}, profile, { partial: false }))
      storeLoudnessMeasurement(key, measured)
      if (typeof onMeasured === 'function') onMeasured(measured)
      return measured
    })
    .catch(function () {
      // Corrupt/unsupported file: keep the user volume.
      return null
    })
}

/** A library server's front: decode whatever the range prefix gave us. */
function analyzePartialLoudnessBlob(item, blob, isCurrent) {
  if (!item || !blob || (typeof isCurrent === 'function' && !isCurrent())) return Promise.resolve(null)
  var decoder = loudnessContext()
  if (decoder === null) return Promise.resolve(null)
  var measuredBuffer = null
  return blob
    .arrayBuffer()
    .then(function (bytes) { return decoder.decodeAudioData(bytes) })
    .then(function (buffer) {
      measuredBuffer = buffer
      return fullProfileOfBuffer(buffer, true).then(function (profile) {
        if (profile && typeof profile.programLoudness === 'number' && profile.programLoudness > -90) {
          return Object.assign({}, profile, { partial: true })
        }
        return lufsFromAudioBuffer(buffer).then(function (lufs) {
          return lufs === null ? null : {
            programLoudness: lufs,
            peak: peakOfAudioBuffer(buffer),
            leadIn: leadInOfAudioBuffer(buffer),
            partial: true,
          }
        })
      })
    })
    .then(function (measured) {
      if (!measured || (typeof isCurrent === 'function' && !isCurrent())) return null
      noteProfile(item.path, measured)
      return measured
    })
    .catch(function () { return null })
}
