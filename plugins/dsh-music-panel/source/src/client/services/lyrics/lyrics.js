/**
 * LRC parsing, translation merge and online path helpers.
 *
 * Extracted from client.js at the 0.11.1 baseline (3931c14).
 */

// ── online lyric helpers ──────────────────────────────────────────────
// The Host returns raw LRC for online tracks (local tracks get parsed lines
// from /lyrics), so the client needs a small parser of its own.
function parseLrcText(text) {
  var lines = []
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (raw) {
      var match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
      if (match === null) return
      var time = Number(match[1]) * 60 + Number(match[2])
      if (!isFinite(time)) return
      var content = match[3].trim()
      for (var i = 0; i < lines.length; i += 1) {
        if (lines[i].time === time) {
          if (lines[i].text === '' && content !== '') lines[i].text = content
          return
        }
      }
      lines.push({ time: time, text: content, translation: '' })
    })
  lines.sort(function (left, right) {
    return left.time - right.time
  })
  return lines
}

function isLyricMetadata(text) {
  var value = String(text || '').trim()
  if (value === '') return true
  if (/^(作词|作曲|编曲|制作|监制|出品|发行|录音|混音|母带|和声|吉他|贝斯|鼓|键盘|弦乐|词|曲)\s*[:：]/i.test(value)) {
    return true
  }
  return /^(lyrics?|composed|composer|arranged|arranger|producer|produced|mixed|mastered|written|music|words)\b[^:：]{0,24}[:：]/i.test(value)
}

function mergeLyricTranslation(lines, translationText) {
  var translated = parseLrcText(translationText)
  if (translated.length === 0) return lines

  // Match one translation line to one lyric line, globally nearest-first.
  // The old per-line nearest lookup reused the first translation on every
  // credit/meta line within 350ms (e.g. 作词/作曲/编曲 before the first verse).
  var candidates = []
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i]
    if (isLyricMetadata(line.text)) continue
    for (var j = 0; j < translated.length; j += 1) {
      if (isLyricMetadata(translated[j].text)) continue
      var diff = Math.abs(translated[j].time - line.time)
      if (diff <= 0.35) candidates.push({ line: i, trans: j, diff: diff })
    }
  }
  candidates.sort(function (left, right) {
    if (left.diff !== right.diff) return left.diff - right.diff
    return left.line - right.line
  })
  var usedLines = {}
  var usedTrans = {}
  candidates.forEach(function (pair) {
    if (usedLines[pair.line] === true || usedTrans[pair.trans] === true) return
    var line = lines[pair.line]
    var text = translated[pair.trans].text
    if (isLyricMetadata(text)) return
    line.translation = text
    usedLines[pair.line] = true
    usedTrans[pair.trans] = true
  })
  return lines
}

/** Canonical `[mm:ss.xx]` used when writing translated lyrics back to a file. */
function formatLrcTime(seconds) {
  var total = Math.max(0, Number(seconds) || 0)
  var minutes = Math.floor(total / 60)
  var rest = total - minutes * 60
  var whole = Math.floor(rest)
  var centis = Math.round((rest - whole) * 100)
  if (centis >= 100) {
    centis = 0
    whole += 1
  }
  if (whole >= 60) {
    whole -= 60
    minutes += 1
  }
  return '[' + pad2(minutes) + ':' + pad2(whole) + '.' + pad2(centis) + ']'
}

/**
 * Serialize parsed lines with translations back to the common bilingual LRC
 * shape: each translation repeats the original line's timestamp.
 *
 *   [00:05.12]原词
 *   [00:05.12]翻译词
 *
 * Metadata tags ([ti:], [ar:], [offset:], ...) are carried over unchanged.
 */
function buildTranslatedLrc(lines, sourceText) {
  var prefix = String(sourceText || '')
    .split(/\r?\n/)
    .filter(function (line) {
      return /^\s*\[[A-Za-z#]+:[^\]]*\]/.test(line)
    })
  var body = []
  ;(Array.isArray(lines) ? lines : []).forEach(function (line) {
    if (!line || !isFinite(line.time) || line.time < 0) return
    var stamp = formatLrcTime(line.time)
    var text = String(line.text || '')
    var translation = String(line.translation || '')
    if (text === '' && translation === '') return
    if (text !== '') body.push(stamp + text)
    if (translation !== '') {
      translation.split(/\r?\n/).forEach(function (part) {
        if (part !== '') body.push(stamp + part)
      })
    }
  })
  return prefix.concat(body).join('\n')
}

/** Split `online:<provider>:<id>` (null when the path is a local one). */
function onlinePathOf(path) {
  var match = /^online:([^:]+):(.+)$/.exec(String(path || ''))
  return match === null ? null : { provider: match[1], id: match[2] }
}

// ── word-level (karaoke) timeline ──────────────────────────────────────
// The Host returns `lines` from `/lyric/new` (word timing in seconds) next to
// the LRC text. Attach it to the parsed lines by timestamp so the player can
// colour each word as it is sung; tracks without it keep line-level colouring.

/**
 * Merge word timelines into parsed LRC lines, nearest-first and one-to-one.
 * @param {Array<{time:number,text:string,translation:string}>} lines
 * @param {Array<{t:number,end:number,words?:Array<{t:number,end:number,text:string}>}>} wordLines
 */
function attachWordTimeline(lines, wordLines) {
  if (!Array.isArray(lines) || lines.length === 0) return lines
  if (!Array.isArray(wordLines) || wordLines.length === 0) return lines
  var pool = wordLines.filter(function (row) {
    return row && Array.isArray(row.words) && row.words.length > 0 && isFinite(Number(row.t))
  })
  if (pool.length === 0) return lines

  var used = {}
  lines.forEach(function (line) {
    if (!line || !isFinite(line.time) || line.time < 0) return
    var best = -1
    var bestDiff = Infinity
    for (var i = 0; i < pool.length; i += 1) {
      if (used[i] === true) continue
      var diff = Math.abs(Number(pool[i].t) - line.time)
      if (diff < bestDiff) {
        bestDiff = diff
        best = i
      }
    }
    // Credits and translations sit on their own timestamps; 0.6s is enough to
    // match a sung line without stealing a neighbour's timeline.
    if (best < 0 || bestDiff > 0.6) return
    used[best] = true
    line.words = pool[best].words.map(function (word) {
      return {
        t: Number(word.t) || 0,
        end: Number(word.end) || 0,
        text: String(word.text || ''),
      }
    })
    if (isFinite(Number(pool[best].end))) line.end = Number(pool[best].end)
  })
  return lines
}

/**
 * Folia's `Line` is the player's lyric line, exactly as the parser produced it.
 *
 * Folia's own app keeps `LyricData.lines` in the store and hands those very objects
 * to the visualizers; there is no second shape. The plugin does the same: the player
 * stores these lines, the stage converts nothing, and `startTime`/`endTime`/`fullText`/
 * `words[].startTime` are read with Folia's names everywhere. Only legacy producers
 * (the Host's `/lyrics` route, the LRC fallback, the match dialogs) still emit
 * `{time, end, text, words:[{t,end,text}]}`, and they go through `legacyLinesToFolia`.
 */
function foliaLyricLines(document) {
  var source = document && Array.isArray(document.lines) ? document.lines : []
  return source.filter(function (line) {
    return line && isFinite(Number(line.startTime))
  })
}

/** Folia's parser always leaves line.words non-empty; the legacy bridge must too, or word-driven styles (partita/cadenza) draw nothing. */
function legacyWordTimeline(text, start, end) {
  var bundle = typeof FOLIA_PENDOLO !== 'undefined' ? FOLIA_PENDOLO : null
  if (bundle && typeof bundle.buildTimedWords === 'function') {
    return bundle.buildTimedWords(String(text || ''), Number(start) || 0, Number(end) || (Number(start) || 0) + 4)
  }
  return String(text || '') === ''
    ? []
    : [{ text: String(text), startTime: Number(start) || 0, endTime: Number(end) || (Number(start) || 0) + 4 }]
}

/** Legacy `{time,end,text,translation,words:[{t,end,text}]}` → Folia's `Line`. */
function legacyLinesToFolia(lines) {
  var source = Array.isArray(lines) ? lines : []
  return source
    .map(function (line, index) {
      if (!line || !isFinite(Number(line.time))) return null
      var start = Number(line.time) || 0
      // Folia's parser ends a line at the next line's start; only the last line
      // (and lines whose neighbour has no usable time) keeps a fallback span.
      var next = source[index + 1]
      var nextStart = next && isFinite(Number(next.time)) ? Number(next.time) : NaN
      var end = Number(line.end)
      if (!isFinite(end) || end <= start) {
        end = isFinite(nextStart) && nextStart > start ? nextStart : start + 4
      }
      return {
        fullText: String(line.text || ''),
        startTime: start,
        endTime: end,
        words: (function () {
          var mapped = (Array.isArray(line.words) ? line.words : [])
            .filter(function (word) {
              return word && String(word.text || '') !== ''
            })
            .map(function (word) {
              var wordStart = Number(word.t)
              var wordEnd = Number(word.end)
              return {
                text: String(word.text || ''),
                startTime: isFinite(wordStart) ? wordStart : start,
                endTime: isFinite(wordEnd) && wordEnd > wordStart ? wordEnd : start,
              }
            })
          // A line-level source has no words at all. Folia's parser synthesizes them; a
          // legacy line has to cross the same boundary or word-driven styles go blank.
          return mapped.length > 0 ? mapped : legacyWordTimeline(line.text, start, end)
        })(),
        translation: typeof line.translation === 'string' ? line.translation : '',
        ...(line.isChorus === true ? { isChorus: true } : {}),
      }
    })
    .filter(function (line) {
      return line !== null
    })
}

/** Folia's line start in seconds (Folia's `startTime`, legacy `time` for old producers). */
function mpLineStart(line) {
  if (!line) return NaN
  return isFinite(Number(line.startTime)) ? Number(line.startTime) : Number(line.time)
}

/** Folia's line end in seconds (Folia's `endTime`, legacy `end` for old producers). */
function mpLineEnd(line) {
  if (!line) return NaN
  return isFinite(Number(line.endTime)) ? Number(line.endTime) : Number(line.end)
}

/**
 * Folia's per-song manual timeline offset (lyricOffsetMemory): a number remembered
 * per song, restored when that song plays again. Online tracks had no offset control
 * at all before this; local tracks keep the host's file-level offset as the primary.
 */
function readSavedLyricOffset(path) {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return 0
  if (typeof MPFoliaLyrics.readLyricOffset !== 'function') return 0
  var value = Number(MPFoliaLyrics.readLyricOffset(path))
  return isFinite(value) ? value : 0
}

/** Remember (0 forgets) this song's offset. */
function rememberLyricOffset(path, offsetMs) {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return
  if (typeof MPFoliaLyrics.writeLyricOffset !== 'function') return
  MPFoliaLyrics.writeLyricOffset(path, Number(offsetMs) || 0)
}

/**
 * The listener's lyric line filters, built from the settings page's two lists:
 * ready-made presets (Folia's own ids) and free words (a line containing one goes).
 * Folia's engine (applyLyricLineRules) expects rules with ids and switches.
 */
function lyricFilterRules() {
  var state = typeof prefsStore !== 'undefined' && prefsStore !== null ? prefsStore.get() : {}
  var rules = []
  var presets = Array.isArray(state.lyricFilterPresets) ? state.lyricFilterPresets : []
  presets.forEach(function (id) {
    if (typeof id !== 'string' || id === '') return
    rules.push({ id: 'preset:' + id, on: true, shape: 'preset', text: id })
  })
  var words = String(state.lyricFilterWords || '')
  words
    .split(/[\n,，]/)
    .map(function (word) {
      return word.trim()
    })
    .filter(function (word) {
      return word !== ''
    })
    .forEach(function (word, index) {
      rules.push({ id: 'word:' + String(index), on: true, shape: 'contains', text: word })
    })
  return rules
}

/**
 * icu-folia's engines, from the Host's data (lib/assets/icu-folia, served gzipped).
 * Folia loads them as lazy Vite chunks; the plugin has one client script, so they are
 * fetched once on demand and the result is memoised. Resolves false when unavailable.
 */
var icuFoliaPromise = null
// The lyrics shown when the engines finish loading are re-baked exactly once.
var icuFoliaRebaked = false
function ensureIcuFoliaData() {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return Promise.resolve(false)
  if (typeof MPFoliaLyrics.loadIcuFoliaFromData !== 'function') return Promise.resolve(false)
  if (icuFoliaPromise !== null) return icuFoliaPromise
  icuFoliaPromise = Promise.all([
    fetch(API + 'assets/icu-folia/dict.json.gz').then(function (response) { return response.json() }),
    fetch(API + 'assets/icu-folia/hmm.json.gz').then(function (response) { return response.json() }),
  ])
    .then(function (data) {
      return MPFoliaLyrics.loadIcuFoliaFromData({ dict: data[0], hmm: data[1] })
    })
    .catch(function () {
      return false
    })
  return icuFoliaPromise
}

// ── saved word segmentation (one record per song) ─────────────────────
// Folia keeps this in IndexedDB behind a service; the plugin's convention is one
// localStorage map, as lyricOffsetMemory does for the timeline offset. The record
// shape and the baking are Folia's own (lyricSegmentationRecord.ts), so a record has
// the same meaning in both apps: line key -> the boundaries that rejoin to its text.
var LYRIC_SEGMENTATION_KEY = 'lyric_segmentations'
var LYRIC_SEGMENTATION_MAX = 300

// Parsed once and kept: the player asks for the count on every render, and the map can
// hold hundreds of records.
var lyricSegmentationCache = null

function lyricSegmentationMap() {
  if (lyricSegmentationCache !== null) return lyricSegmentationCache
  var map = {}
  if (typeof window !== 'undefined') {
    try {
      var raw = window.localStorage.getItem(LYRIC_SEGMENTATION_KEY)
      var parsed = raw === null ? null : JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) map = parsed
    } catch (error) {
      map = {}
    }
  }
  lyricSegmentationCache = map
  return map
}

function writeLyricSegmentationMap(map) {
  if (typeof window === 'undefined') return
  var keys = Object.keys(map)
  if (keys.length > LYRIC_SEGMENTATION_MAX) {
    keys
      .sort(function (left, right) {
        return (Number(map[left] && map[left].updatedAt) || 0) - (Number(map[right] && map[right].updatedAt) || 0)
      })
      .slice(0, keys.length - LYRIC_SEGMENTATION_MAX)
      .forEach(function (key) {
        delete map[key]
      })
  }
  lyricSegmentationCache = map
  try {
    window.localStorage.setItem(LYRIC_SEGMENTATION_KEY, JSON.stringify(map))
  } catch (error) {
    // Storage full or blocked: the lyrics in this session keep the split until a reload.
  }
}

/**
 * Forget every client-side lyric memory: the saved offsets (the bundle's map) and the
 * saved word-splits used by the player. 存储与备份 calls this so a clear also holds in the
 * running session, not only after a reload.
 */
function clearLyricClientCaches() {
  try {
    if (typeof MPFoliaLyrics !== 'undefined' && MPFoliaLyrics !== null && typeof MPFoliaLyrics.clearLyricOffsets === 'function') {
      MPFoliaLyrics.clearLyricOffsets()
    }
  } catch (error) {
    // A missing/older bundle leaves the offsets until reload; the key is removed below.
  }
  lyricSegmentationCache = null
  try {
    window.localStorage.removeItem(LYRIC_SEGMENTATION_KEY)
  } catch (error) {
    // Blocked storage: nothing to forget.
  }
  // The shared loader keeps up to 12 resolved lyrics; a clear has to drop them or the
  // current song keeps showing the lyric whose files were just removed.
  if (typeof MPLyricLoader !== 'undefined' && MPLyricLoader !== null && typeof MPLyricLoader.invalidate === 'function') {
    MPLyricLoader.invalidate()
  }
  // Let every lyric surface re-read now that the files and the memory copy are gone.
  try {
    window.dispatchEvent(new CustomEvent('dsh-music:lyrics-cleared'))
  } catch (error) {
    // A missing CustomEvent (old harness) keeps the cleared flag only.
  }
}

/** This song's saved segmentation record, or null when it has none (or it is malformed). */
function readLyricSegmentation(songKey) {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return null
  if (typeof MPFoliaLyrics.isLyricSegmentationRecord !== 'function') return null
  var key = String(songKey || '')
  if (key === '') return null
  var record = lyricSegmentationMap()[key]
  return MPFoliaLyrics.isLyricSegmentationRecord(record) ? record : null
}

/** Save (or, with null, forget) this song's segmentation. Returns what is now stored. */
function saveLyricSegmentation(songKey, boundaries) {
  var key = String(songKey || '')
  if (key === '' || typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return null
  var map = lyricSegmentationMap()
  if (boundaries === null) {
    delete map[key]
    writeLyricSegmentationMap(map)
    return null
  }
  var record = MPFoliaLyrics.createLyricSegmentationRecord(key, 'manual', boundaries)
  map[key] = record
  writeLyricSegmentationMap(map)
  return record
}

// ── one place where lyrics become what the visualizers draw ───────────
// Folia's `createLyricsSetter` order: line rules -> staff-credit policy -> chorus
// decoration -> the listener's saved segmentation -> icu-folia's default split.
// Everything ahead of the word split is a display decision taken on the finished
// timeline, so it runs again whenever the listener changes a rule (no re-fetch).

/** Chorus ranges from the Host's `/online/chorus` answer (empty when unknown). */
function mpChorusRanges(body) {
  var chorus = body && body.chorus ? body.chorus : null
  if (chorus === null || typeof chorus !== 'object') return []
  var start = Number(chorus.startSec)
  var end = Number(chorus.endSec)
  if (!isFinite(start) || !isFinite(end) || start < 0 || end <= start) return []
  return [{ startTime: start, endTime: end }]
}

/** How many of the lines on screen carry this song's saved split (0 when none does). */
function mpSegmentationLineCount(lines, songKey) {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return 0
  if (typeof MPFoliaLyrics.countAppliedSegmentationLines !== 'function') return 0
  var record = readLyricSegmentation(songKey)
  if (record === null) return 0
  return MPFoliaLyrics.countAppliedSegmentationLines({ lines: Array.isArray(lines) ? lines : [] }, record)
}

/** The name to show for the source a lyric came from (AMLL is a database, not a platform). */
function mpLyricSourceLabel(id) {
  var key = String(id || '')
  if (key === '') return ''
  if (key === 'amll') return 'AMLL'
  var info = typeof providerInfoOf === 'function' ? providerInfoOf(key) : null
  if (info !== null && typeof info === 'object' && typeof info.displayName === 'string' && info.displayName !== '') {
    return info.displayName
  }
  return key
}

/**
 * Apply the listener's line rules to already-converted Folia lines. The normal path filters
 * inside Folia's `prepare`; a legacy Host answer (no parseable document) has no document to
 * prepare, so the same rules run on the converted lines instead.
 */
function mpApplyLineRulesToFolia(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return lines
  var rules = lyricFilterRules()
  if (rules.length === 0) return lines
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return lines
  if (typeof MPFoliaLyrics.applyLyricLineRules !== 'function'
    || typeof MPFoliaLyrics.compileLyricLineRules !== 'function') return lines
  try {
    var filtered = MPFoliaLyrics.applyLyricLineRules({ lines: lines }, MPFoliaLyrics.compileLyricLineRules(rules))
    return filtered !== null && Array.isArray(filtered.lines) ? filtered.lines : lines
  } catch (error) {
    return lines
  }
}

/** A signature of the listener's display-pass settings, so a change re-runs it. */
function mpLyricRulesKey() {
  var state = typeof prefsStore !== 'undefined' && prefsStore !== null ? prefsStore.get() : {}
  var presets = Array.isArray(state.lyricFilterPresets) ? state.lyricFilterPresets : []
  return presets.join(',') + '\u0000' + String(state.lyricFilterWords || '')
}

/**
 * The lyric clock a surface should read: the player's position, shifted by the per-song
 * correction and Folia's device-wide offset. Both surfaces (stage and composer strip)
 * must use this, or the same lyric runs on two clocks.
 */
function lyricClock(seconds, offsetMs, globalOffsetMs) {
  return Number(seconds) - ((Number(offsetMs) || 0) + (Number(globalOffsetMs) || 0)) / 1000
}

/**
 * The Host's raw text as Folia's local-file source (LRC / enhanced LRC / TTML / VTT /
 * QRC / YRC / KRC / .fia), or null when there is nothing to parse.
 */
function mpLocalRawSource(body) {
  if (!body || typeof body.raw !== 'string' || body.raw === '') return null
  return {
    type: 'local',
    lrcContent: body.raw,
    ...(typeof body.translation === 'string' && body.translation !== '' ? { tLrcContent: body.translation } : {}),
    ...(typeof body.formatHint === 'string' && body.formatHint !== '' ? { formatHint: body.formatHint } : {}),
  }
}

/**
 * Local lyrics as the renderers need them, shared by every surface that shows a local
 * file's lyrics: the Host's raw text through Folia's pipeline, or the Host's own lines
 * when the text carries no timeline.
 *
 * `folia` says which shape `lyrics` is in: the pipeline's lines are Folia's `Line`,
 * the fallback is still the Host's `{time, text, translation}`.
 *
 * @returns {Promise<{ lyrics: Array<object>, pureMusic: boolean, isWordByWord: boolean, document: object|null, folia: boolean }>}
 */
async function mpLocalLyricLines(body, songKey) {
  var raw = mpLocalRawSource(body)
  if (raw !== null && typeof MPFoliaLyrics !== 'undefined' && MPFoliaLyrics !== null) {
    try {
      var parsed = await MPFoliaLyrics.parse(raw, { songId: 0 })
      if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        var shown = mpPrepareLyrics(parsed, songKey, [])
        return { lyrics: shown.lyrics, pureMusic: shown.pureMusic, isWordByWord: shown.isWordByWord, document: parsed, folia: true }
      }
    } catch (error) {
      // Fall through to the Host's own lines: a file the parser cannot read still shows.
    }
  }
  return {
    lyrics: Array.isArray(body && body.lines) ? body.lines : [],
    pureMusic: false,
    isWordByWord: false,
    document: null,
    folia: false,
  }
}

/**
 * The display-time pass over one parsed Folia document.
 * @returns {{ lyrics: Array<object>, pureMusic: boolean, isWordByWord: boolean }}
 */
function mpPrepareLyrics(document, songKey, chorusRanges) {
  if (!document || typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) {
    return { lyrics: [], pureMusic: false, isWordByWord: false }
  }
  // The source's own timing, taken before `prepare` rewrites anything: a word-level
  // lyric must be told apart from a line-level one whose words Folia synthesised, or
  // the automatic pick would think every LRC already has word timing.
  var isWordByWord = document.isWordByWord === true
  var next = document
  if (typeof MPFoliaLyrics.prepare === 'function') {
    next = MPFoliaLyrics.prepare(next, {
      policy: 'smart',
      rules: lyricFilterRules(),
      chorusRanges: Array.isArray(chorusRanges) ? chorusRanges : [],
    })
  }
  if (!next) return { lyrics: [], pureMusic: false, isWordByWord }
  // A lyric that is only "纯音乐，请欣赏" is no lyric at all (Folia's setter agrees).
  if (typeof MPFoliaLyrics.isPureMusicLyricLines === 'function'
    && MPFoliaLyrics.isPureMusicLyricLines(next.lines)) {
    return { lyrics: [], pureMusic: true, isWordByWord }
  }
  // The listener's saved split for this song, then icu-folia's default for the rest.
  var record = readLyricSegmentation(songKey)
  if (record !== null && typeof MPFoliaLyrics.applyLyricWordSegmentation === 'function') {
    next = MPFoliaLyrics.applyLyricWordSegmentation(next, record)
  }
  if (typeof MPFoliaLyrics.applyAutoWordSegmentation === 'function'
    && typeof MPFoliaLyrics.isIcuFoliaReady === 'function' && MPFoliaLyrics.isIcuFoliaReady()) {
    next = MPFoliaLyrics.applyAutoWordSegmentation(next)
  }
  return { lyrics: foliaLyricLines(next), pureMusic: false, isWordByWord }
}
