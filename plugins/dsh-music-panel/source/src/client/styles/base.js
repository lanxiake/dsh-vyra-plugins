/**
 * base: formatting, storage and small pure helpers.
 *
 * The playback engine (50-player) calls `clamp` and `pad2` directly and the
 * rest of the UI leans on the formatters, so these names are part of the
 * internal contract.
 */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/** Split a display artist string into distinct clickable artists. */
function trackArtistNames(track) {
  var raw = String((track && track.artist) || '').trim()
  if (raw === '') return []
  var names = []
  function push(text) {
    var value = String(text || '').trim()
    if (value !== '' && names.indexOf(value) < 0) names.push(value)
  }
  raw.split(/\s+\/\s+|\s*[、&,，;；]\s*|\s+(?:feat\.?|ft\.?)\s+/i).forEach(function (part) {
    var text = String(part || '').trim()
    if (text === '') return
    // Split a bare slash only for CJK names ("许嵩/莫诗旎"), so AC/DC stays whole.
    if (/[\u3400-\u9fff]/.test(text) && text.indexOf('/') >= 0) {
      text.split('/').forEach(push)
    } else {
      push(text)
    }
  })
  return names
}

function pad2(value) {
  return value < 10 ? '0' + value : String(value)
}

/** Duration for track lists: unknown durations read as `--:--`. */
function fmtTime(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return '--:--'
  var total = Math.floor(seconds)
  var s = total % 60
  var m = Math.floor(total / 60) % 60
  var hours = Math.floor(total / 3600)
  return hours > 0 ? hours + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s)
}

/** Player clock: always a number, zero reads as `0:00`. */
function fmtClock(seconds) {
  var total = Math.floor(isFinite(seconds) && seconds > 0 ? seconds : 0)
  var s = total % 60
  var m = Math.floor(total / 60) % 60
  var hours = Math.floor(total / 3600)
  return hours > 0 ? hours + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s)
}

function fmtKhz(sampleRate) {
  if (typeof sampleRate !== 'number' || !isFinite(sampleRate) || sampleRate <= 0) return ''
  var khz = Math.round(sampleRate / 100) / 10
  return String(khz).replace(/\.0$/, '') + ' kHz'
}

function fmtKbps(bitrate) {
  if (typeof bitrate !== 'number' || !isFinite(bitrate) || bitrate <= 0) return ''
  return Math.round(bitrate / 1000) + ' kbps'
}

function fmtBytes(bytes) {
  var n = Number(bytes)
  if (!isFinite(n) || n <= 0) return '0 B'
  var units = ['B', 'KB', 'MB', 'GB', 'TB']
  var i = 0
  while (n >= 1024 && i < units.length - 1) {
    n = n / 1024
    i += 1
  }
  return (i === 0 ? String(Math.round(n)) : n.toFixed(1)) + ' ' + units[i]
}

/** Last.fm / MusicBee play threshold: half the track or four minutes. */
function playThresholdOf(durationSec) {
  var duration = Number(durationSec)
  if (!isFinite(duration) || duration <= 0) return 240
  if (duration <= 30) return duration + 0.5
  return Math.min(duration / 2, 240)
}

function clampPref(value, min, max, fallback) {
  var number = Number(value)
  if (!isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/** Class name joiner: falsy values are dropped. */
function cx() {
  var out = []
  for (var i = 0; i < arguments.length; i += 1) {
    var part = arguments[i]
    if (typeof part === 'string' && part !== '') out.push(part)
  }
  return out.join(' ')
}

function storageGet(key, fallback) {
  try {
    var raw = window.localStorage.getItem(key)
    if (raw === null || raw === undefined) return fallback
    return JSON.parse(raw)
  } catch (error) {
    return fallback
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // Private mode / quota: best effort only.
  }
}

function errorText(error) {
  if (error === null || error === undefined) return ''
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message !== '') return error.message
  return String(error)
}

/**
 * Chromium's own pipeline words are a kernel detail, not a reason a listener can act on:
 * `PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN: MediaSource endOfStream…` reached the toast
 * whenever a refused stream answer was handed to the media element. It belongs in the log;
 * the toast says what it means in words.
 */
function isBrowserMediaFailureText(text) {
  return /PipelineStatus|DEMUXER_ERROR|MEDIA_ERR_|MediaSource endOfStream|audio decoder|Failed to demux/i.test(String(text || ''))
}
/** Copy text without throwing where the clipboard is blocked; the caller still confirms intent. */
function copyTextSafely(text) {
  var value = String(text || '')
  if (value === '') return
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) void navigator.clipboard.writeText(value)
  } catch (error) {
    // Clipboard can be blocked; the toast still confirms the intent.
  }
}

/** Absolute directory of a track (backslashes kept for display). */
function trackDirOf(track) {
  var path = String((track && track.path) || '')
  var at = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return at > 0 ? path.slice(0, at) : path
}

/** Last path segment of a directory; drive roots fall back to "D:". */
function folderNameOf(dir) {
  var text = String(dir || '').replace(/[\\/]+$/, '')
  var at = Math.max(text.lastIndexOf('\\'), text.lastIndexOf('/'))
  var name = at >= 0 ? text.slice(at + 1) : text
  return name || text || '/'
}

/** Stable, case-insensitive search across metadata, path and pinyin. */
function trackHaystack(track) {
  return [
    track.title,
    track.artist,
    track.album,
    track.name,
    track.folder,
    track.path,
    track.py,
    track.pyf,
  ]
    .map(function (part) {
      return String(part || '').toLowerCase()
    })
    .join('\n')
}

function filterTracks(list, query) {
  var text = String(query || '').trim().toLowerCase()
  if (text === '') return list
  var needles = text.split(/\s+/).filter(Boolean)
  if (needles.length === 0) return list
  return list.filter(function (track) {
    var hay = trackHaystack(track)
    for (var i = 0; i < needles.length; i += 1) {
      if (hay.indexOf(needles[i]) < 0) return false
    }
    return true
  })
}

function sortTracks(list, key, dir) {
  var out = list.slice()
  var desc = dir === 'desc'
  out.sort(function (left, right) {
    var a
    var b
    switch (key) {
      case 'artist':
        a = String(left.artist || '')
        b = String(right.artist || '')
        break
      case 'album':
        a = String(left.album || '')
        b = String(right.album || '')
        break
      case 'duration':
        a = left.durationSec || 0
        b = right.durationSec || 0
        break
      case 'added':
        a = left.addedAt || 0
        b = right.addedAt || 0
        break
      case 'plays':
        a = left.plays || 0
        b = right.plays || 0
        break
      case 'recent':
        a = left.lastPlayedAt || 0
        b = right.lastPlayedAt || 0
        break
      default:
        a = String(left.title || '')
        b = String(right.title || '')
    }
    if (typeof a === 'number' && typeof b === 'number') return desc ? b - a : a - b
    var result = String(a).localeCompare(String(b), 'zh')
    return desc ? -result : result
  })
  return out
}

function basename(path) {
  var text = String(path || '')
  var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'))
  return slash >= 0 ? text.slice(slash + 1) : text
}
