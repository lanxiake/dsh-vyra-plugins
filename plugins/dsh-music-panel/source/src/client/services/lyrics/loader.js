/**
 * One lyric load per song, shared by the player and every surface that shows lyrics.
 *
 * Folia loads a song's lyric where playback starts, not where a panel happens to be
 * open: the visualizer and the player's start gate both need it. This module is that
 * place — `load()` answers the resolved lyric (local file, matched online lyric, or the
 * platform's own), `whenReady()` is what the player waits on before starting audio.
 *
 * It does not run the optional word-by-word upgrade: that is a display decision with a
 * toast and diagnostics, and it stays where the lyrics are shown.
 *
 * @module dsh-music-panel/lyric-loader
 */

var MPLyricLoader = (function () {
  /** Songs whose resolved lyric is kept (both decks and the panel rarely exceed this). */
  var CACHE_LIMIT = 12
  /** The gate never holds playback hostage to a slow network. */
  var GATE_TIMEOUT_MS = 8000

  var cache = new Map()
  var inflight = new Map()
  /** key -> Set of listeners waiting for the upgrade that replaces the first lyric. */
  var listeners = new Map()

  /** The identity of a song, the same key the Host's lyric record uses. */
  function keyOf(track) {
    if (track === null || typeof track !== 'object') return ''
    if (track.onlineProvider) {
      return 'online:' + String(track.onlineProvider) + ':' + String(track.onlineId || '')
    }
    return String(track.path || '')
  }

  function emptyResult(key) {
    return {
      key: key,
      lyrics: [],
      document: null,
      source: null,
      pureMusic: false,
      isWordByWord: false,
      offsetMs: 0,
      chorusRanges: [],
      matchedUpdated: false,
    }
  }

  function remember(key, result) {
    cache.set(key, result)
    while (cache.size > CACHE_LIMIT) {
      var oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }

  /**
   * The listener's preferences, read from the store. A component's `prefs` is its own
   * `usePrefs()` value, so this service must not borrow that name — it would throw.
   */
  function lyricPrefs() {
    if (typeof prefsStore !== 'undefined' && prefsStore !== null && typeof prefsStore.get === 'function') {
      var state = prefsStore.get()
      if (state !== null && typeof state === 'object') return state
    }
    return {}
  }

  async function loadOnline(track) {
    var key = keyOf(track)
    var provider = String(track.onlineProvider || '')
    var id = String(track.onlineId || '')
    var wanted = lyricPrefs()
    var query =
      API +
      'online/lyric?provider=' +
      encodeURIComponent(provider) +
      '&id=' +
      encodeURIComponent(id) +
      '&title=' +
      encodeURIComponent(track.title || '') +
      '&artist=' +
      encodeURIComponent(track.artist || '') +
      '&album=' +
      encodeURIComponent(track.album || '') +
      '&duration=' +
      encodeURIComponent(String(track.durationSec || 0)) +
      '&preferred=' +
      encodeURIComponent(String(wanted.lyricPreferredSource || ''))
    // The hook lines are part of the display pass (Folia marks them with the provider's
    // own ranges), so the chorus window is asked alongside the lyric.
    var chorusPromise = getJson(API + 'online/chorus?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(id)).catch(
      function () {
        return null
      },
    )
    var body = await getJson(query)
    var chorusRanges = mpChorusRanges(await chorusPromise)
    var result = emptyResult(key)
    result.chorusRanges = chorusRanges
    result.source = body.source === 'imported' ? 'imported' : 'online'
    result.override = body.override === true
    // What is on screen is the platform's own lyric (not an imported one, not a match from
    // another source): only then can Folia's keepProviderWordTiming apply.
    result.ownPlatform = result.source !== 'imported' && result.override !== true
    result.offsetMs = readSavedLyricOffset(key)
    if (body.pureMusic === true) {
      result.pureMusic = true
      return result
    }
    return Object.assign(result, await parseOnlineBody(track, body, chorusRanges))
  }

  /**
   * The lyric document of one platform answer (or of a borrowed match). Shared by the
   * first load and the upgrade, so both parse through Folia's pipeline the same way.
   */
  async function parseOnlineBody(track, body, chorusRanges) {
    var key = keyOf(track)
    var parsed = { lyrics: [], document: null, pureMusic: false, isWordByWord: false }
    var document = null
    if (body.raw && typeof MPFoliaLyrics !== 'undefined' && MPFoliaLyrics !== null) {
      try {
        var doc = await MPFoliaLyrics.parse(body.raw, { songId: Number(track.onlineId) || 0 })
        if (doc && Array.isArray(doc.lines) && doc.lines.length > 0) document = doc
      } catch (error) {
        document = null
      }
    }
    if (document !== null) {
      var shown = mpPrepareLyrics(document, key, chorusRanges)
      parsed.lyrics = shown.lyrics
      parsed.document = document
      parsed.pureMusic = shown.pureMusic === true
      parsed.isWordByWord = shown.isWordByWord === true
      return parsed
    }
    // No document the pipeline can parse (an older cache): the Host's LRC and its word
    // timeline, converted the way the legacy producers are.
    var lines = parseLrcText(body.lrc || '')
    if (body.translation) mergeLyricTranslation(lines, body.translation)
    attachWordTimeline(lines, body.lines)
    // A legacy answer has no document to prepare, but the line rules still apply.
    parsed.lyrics = mpApplyLineRulesToFolia(legacyLinesToFolia(lines))
    parsed.isWordByWord = body.wordLevel === true
    return parsed
  }

  async function loadLocal(track) {
    var key = keyOf(track)
    var wanted = lyricPrefs()
    var priority = wanted.lyricLocalPriority === 'online' ? 'online' : 'local'
    var formatOrder = Array.isArray(wanted.lyricFormatOrder) ? wanted.lyricFormatOrder.join(',') : ''
    var url =
      API +
      'lyrics?path=' +
      encodeURIComponent(track.path) +
      '&priority=' +
      encodeURIComponent(priority) +
      '&formatOrder=' +
      encodeURIComponent(formatOrder)
    var body = await getJson(url)
    var matchedUpdated = false
    // Folia's `matchLyrics`: none of the file's own lyrics is usable (or the listener chose
    // online) — ask once, then read the resolved lyric again.
    if (body.needsAutoMatch === true) {
      var auto = await getJson(
        API +
          'lyrics/auto?path=' +
          encodeURIComponent(track.path) +
          '&preferred=' +
          encodeURIComponent(String(wanted.lyricPreferredSource || '')),
      ).catch(function () {
        return null
      })
      if (auto !== null && auto.matched) {
        body = await getJson(url)
        matchedUpdated = true
      }
    }
    var shown = await mpLocalLyricLines(body, key)
    return {
      key: key,
      lyrics: shown.lyrics,
      document: shown.document,
      source: body.pureMusic === true ? 'pure' : String(body.source || ''),
      pureMusic: body.pureMusic === true || shown.pureMusic === true,
      isWordByWord: shown.isWordByWord === true,
      offsetMs: Number(body.offsetMs) || readSavedLyricOffset(key),
      chorusRanges: [],
      matchedUpdated: matchedUpdated,
    }
  }

  /** The resolved lyric for one song; concurrent callers share the same request. */
  function load(track) {
    var key = keyOf(track)
    if (key === '') return Promise.resolve(emptyResult(''))
    var hit = cache.get(key)
    if (hit !== undefined) return Promise.resolve(hit)
    var running = inflight.get(key)
    if (running !== undefined) return running
    var promise = (track.onlineProvider ? loadOnline(track) : loadLocal(track))
      .catch(function () {
        return emptyResult(key)
      })
      .then(function (result) {
        inflight.delete(key)
        remember(key, result)
        // Folia asks another source for better timing once the first lyric is on its way;
        // the surfaces are told when a match replaces it.
        maybeUpgrade(track, result)
        return result
      })
    inflight.set(key, promise)
    return promise
  }

  /**
   * Folia's light prefetch window: warm the lyric cache for neighbouring tracks so a queue
   * move starts with its lyric already local. Best effort, deduped like a normal load.
   */
  function prefetch(tracks) {
    if (!Array.isArray(tracks)) return
    for (var index = 0; index < tracks.length; index += 1) {
      var track = tracks[index]
      if (!track || !track.onlineProvider) continue
      load(track).catch(function () {})
    }
  }

  /**
   * A source with better timing for this song, or nothing. Never awaited by playback.
   * `options.only` restricts the search to one source and `options.requireWordLevel` makes
   * a line-level answer a miss: Folia's `keepProviderWordTiming` asks the preferred source
   * alone, for word timing or nothing.
   */
  async function upgrade(track, base, options) {
    var key = keyOf(track)
    var provider = String(track.onlineProvider || '')
    var wanted = lyricPrefs()
    var opts = options !== null && typeof options === 'object' ? options : {}
    try {
      var answer = await getJson(
        API +
          'online/best-lyric?provider=' +
          encodeURIComponent(provider) +
          '&id=' +
          encodeURIComponent(String(track.onlineId || '')) +
          '&title=' +
          encodeURIComponent(track.title || '') +
          '&artist=' +
          encodeURIComponent(track.artist || '') +
          '&album=' +
          encodeURIComponent(track.album || '') +
          '&duration=' +
          encodeURIComponent(String(track.durationSec || 0)) +
          '&preferred=' +
          encodeURIComponent(String(wanted.lyricPreferredSource || '')) +
          (opts.only === undefined || opts.only === '' ? '' : '&only=' + encodeURIComponent(String(opts.only))) +
          (opts.requireWordLevel === true ? '&requireWordLevel=1' : '') +
          // Remember the upgrade on the song record: the next play reads it from there.
          '&persist=1',
      )
      var match = answer && answer.match !== null && typeof answer.match === 'object' ? answer.match : null
      if (match === null) return null
      // The switch may have been turned off while the search was in flight; the answer must
      // not replace the lyric against the listener's current choice.
      if (lyricPrefs().autoUseBestLyric === false) return null
      // The platform's own lyric cannot replace itself.
      if (String(match.source || '') === provider) return null
      var parsed = await parseOnlineBody(
        track,
        {
          raw: match.raw && typeof match.raw === 'object' ? match.raw : null,
          lrc: typeof match.lrc === 'string' ? match.lrc : '',
          translation: typeof match.translation === 'string' ? match.translation : '',
          lines: Array.isArray(match.lines) ? match.lines : null,
          wordLevel: match.wordLevel === true,
        },
        base.chorusRanges,
      )
      if (parsed.pureMusic === true || parsed.lyrics.length === 0) return null
      // A line-level answer is no answer when word timing is what was asked for.
      if (opts.requireWordLevel === true && parsed.isWordByWord !== true) return null
      var next = Object.assign({}, base, parsed, {
        upgraded: {
          source: String(match.source || ''),
          id: String(match.id || ''),
          wordLevel: match.wordLevel === true,
        },
      })
      remember(key, next)
      notify(key, next)
      return next
    } catch (error) {
      return null
    }
  }

  function maybeUpgrade(track, result) {
    if (!track || !track.onlineProvider) return
    var wanted = lyricPrefs()
    if (wanted.autoUseBestLyric === false) return
    if (result.pureMusic === true || result.source === 'imported') return
    if (result.override === true) return
    // Folia's `keepProviderWordTiming`: the platform's own word timing is kept over every
    // source but the preferred one, and only a word-timed answer there replaces it.
    var preferred = String(wanted.lyricPreferredSource || '')
    var keepOwn = wanted.lyricKeepProviderWordTiming !== false
      && result.isWordByWord === true
      && result.ownPlatform === true
    if (keepOwn) {
      // AMLL is looked up under a platform id, so it cannot be asked on its own; the song's
      // own platform has nothing better to offer than what is already on screen.
      if (preferred === '' || preferred === 'amll' || preferred === String(track.onlineProvider || '')) return
      upgrade(track, result, { only: preferred, requireWordLevel: true }).catch(function () {})
      return
    }
    // Folia searches even when the platform has no lyric at all: the other sources may, and
    // a full "nothing anywhere" answer still tells the surface to stop looking.
    upgrade(track, result).catch(function () {})
  }

  function notify(key, result) {
    var set = listeners.get(key)
    if (set === undefined) return
    set.forEach(function (listener) {
      try {
        listener(result)
      } catch (error) {
        // A surface that throws must not stop the others.
      }
    })
  }

  /**
   * Listen for the upgrade that replaces a song's first lyric. The listener is called
   * immediately when the upgrade already landed (a slow subscriber would otherwise miss
   * the notification). Returns the unsubscribe function.
   */
  function subscribe(key, listener) {
    if (typeof listener !== 'function') return function () {}
    var id = String(key)
    var set = listeners.get(id)
    if (set === undefined) {
      set = new Set()
      listeners.set(id, set)
    }
    set.add(listener)
    var current = cache.get(id)
    if (current !== undefined && current.upgraded !== undefined) {
      try {
        listener(current)
      } catch (error) {
        // Same: one bad surface does not break the others.
      }
    }
    return function () {
      var live = listeners.get(id)
      if (live === undefined) return
      live.delete(listener)
      if (live.size === 0) listeners.delete(id)
    }
  }

  /**
   * What the player's start gate waits on. Always resolves: a timeout, a failed request
   * and "no loader" all mean "start the song anyway", never "never start".
   *
   * @param {object} track
   * @param {number} [timeoutMs]
   */
  function whenReady(track, timeoutMs) {
    var ms = typeof timeoutMs === 'number' && timeoutMs >= 0 ? timeoutMs : GATE_TIMEOUT_MS
    return new Promise(function (resolve) {
      var settled = false
      var timer = setTimeout(function () {
        if (settled) return
        settled = true
        if (typeof console !== 'undefined' && typeof console.info === 'function') {
          console.info('[dsh-music] lyric gate timed out for ' + keyOf(track))
        }
        resolve(null)
      }, ms)
      load(track).then(
        function (result) {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(result)
        },
        function () {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(null)
        },
      )
    })
  }

  /** Forget one song's resolved lyric (after the listener changes its source), or all. */
  function invalidate(key) {
    if (key === undefined) {
      cache.clear()
      return
    }
    cache.delete(String(key))
  }

  return { load: load, prefetch: prefetch, whenReady: whenReady, invalidate: invalidate, keyOf: keyOf, subscribe: subscribe }
})()
