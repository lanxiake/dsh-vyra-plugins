/**
 * 时计（Folia 原版）— the ported Folia `pendolo` renderer.
 *
 * `src/folia/` mirrors Folia's tree (components/visualizer/pendolo, utils,
 * services, stores) and `src/folia/pendolo.bundle.js` is compiled from it by
 * `scripts/build-pendolo.mjs`. This file is the only boundary: it builds Folia's
 * `VisualizerSharedProps` (MotionValue clock, Line[] with word timings, Theme, audio
 * bands), mounts the renderer once, and keeps every service Folia reads out of the
 * renderer itself.
 */

var FOLIA_PENDOLO = (function () {
  try {
    if (typeof __mpPendoloBundle !== 'function') return null
    return __mpPendoloBundle()
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[dsh-music] Folia pendolo unavailable:', error && error.message)
    }
    return null
  }
})()

/** Folia's default sans stack; the theme builder resolves it for the renderer. */
var FOLIA_PENDOLO_FONT_STACK = [
  'Inter',
  'Noto Sans CJK SC',
  'Source Han Sans SC',
  'PingFang SC',
  'Hiragino Sans GB',
  'Microsoft YaHei',
  'sans-serif',
]

/**
 * Folia's colour helpers parse hex/rgb() only; the plugin's cover accent arrives as
 * modern `hsl(h s% l%)`. Convert it once so alpha mixing and shader uniforms get real
 * channels instead of a passthrough string.
 */
function foliaPendoloAccentColor(accent) {
  var value = typeof accent === 'string' ? accent.trim() : ''
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3]
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  var hsl = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(value)
  if (hsl !== null) {
    var h = ((Number(hsl[1]) % 360) + 360) % 360 / 360
    var s = Math.max(0, Math.min(1, Number(hsl[2]) / 100))
    var l = Math.max(0, Math.min(1, Number(hsl[3]) / 100))
    function hue(p, q, t) {
      var x = t < 0 ? t + 1 : t > 1 ? t - 1 : t
      if (x < 1 / 6) return p + (q - p) * 6 * x
      if (x < 1 / 2) return q
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
      return p
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s
    var p = 2 * l - q
    var rgb = [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
    return '#' + rgb.map(function (channel) {
      var hex = Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }
  var rgbMatch = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value)
  if (rgbMatch !== null) {
    return '#' + [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(function (channel) {
      var hex = Math.max(0, Math.min(255, Number(channel))).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }
  return '#f2607a'
}

/**
 * Build the Theme Folia's renderer expects. The cover palette is the plugin's accent
 * (the same value the ambient backdrop uses); the surfaces are Folia's dark defaults.
 */
function foliaPendoloTheme(accent) {
  var accentColor = foliaPendoloAccentColor(accent)
  return {
    name: 'dsh-music',
    description: 'DeepSeek Harness music panel',
    backgroundColor: '#09090b',
    primaryColor: '#f4f4f5',
    secondaryColor: '#a1a1aa',
    accentColor: accentColor,
    fontStyle: 'sans',
    fontFamilyStack: FOLIA_PENDOLO_FONT_STACK,
    fontWeight: 600,
    animationIntensity: 'normal',
    wordColors: [],
    lyricsIcons: [],
  }
}

/**
 * Plugin lyric lines → Folia `Line[]`.
 *
 * A line that already carries a word timeline keeps it; a line-synced LRC gets the
 * same evenly weighted estimate Folia's parsers use (`buildTimedWords`), and its end
 * time uses Folia's reading-time rule (`estimateLrcLineEndTime`). `fullText` is the
 * original text, as Folia requires.
 */
function foliaPendoloLines(lines) {
  var source = Array.isArray(lines) ? lines : []
  var out = []
  var bundle = FOLIA_PENDOLO

  function nextStart(index) {
    for (var i = index + 1; i < source.length; i += 1) {
      var value = mpLineStart(source[i])
      if (isFinite(value) && value >= 0) return value
    }
    return undefined
  }

  for (var index = 0; index < source.length; index += 1) {
    var line = source[index] || {}
    // Folia's own Line (the parser's output, passed through the player untouched):
    // hand it to the styles as it is. Only its wrapper index is added.
    if (typeof line.fullText === 'string' && isFinite(Number(line.startTime))) {
      out.push(Object.assign({}, line, { sourceIndex: index }))
      continue
    }
    var start = Number(line.time)
    if (!isFinite(start) || start < 0) continue
    var text = typeof line.text === 'string' ? line.text : ''
    var rawEnd = Number(line.end)
    var end = isFinite(rawEnd) && rawEnd > start
      ? rawEnd
      : (bundle && typeof bundle.estimateLrcLineEndTime === 'function'
        ? bundle.estimateLrcLineEndTime(text, start, nextStart(index))
        : start + Math.max(2, text.length * 0.4))

    var words
    if (Array.isArray(line.words) && line.words.length > 0) {
      words = line.words.map(function (word) {
        var wordStart = Number(word.t)
        var wordEnd = Number(word.end)
        return {
          text: String(word.text || ''),
          startTime: isFinite(wordStart) ? wordStart : start,
          endTime: isFinite(wordEnd) && wordEnd > wordStart ? wordEnd : start,
        }
      })
    } else {
      words = bundle && typeof bundle.buildTimedWords === 'function'
        ? bundle.buildTimedWords(text, start, end)
        : []
    }

    // A line that came through Folia's pipeline keeps every field the styles read
    // (render hints, saved segmentation, chorus marks); a legacy line gets the
    // estimate above.
    var original = line.folia !== null && typeof line.folia === 'object' ? line.folia : null
    out.push({
      id: 'folia-pendolo-line-' + index,
      // Kept so the wrapper can map the plugin's line index (which counts untimed
      // lines too) onto the converted array Folia sees.
      sourceIndex: index,
      fullText: text,
      startTime: start,
      endTime: end,
      words: words,
      translation: typeof line.translation === 'string' ? line.translation : '',
      romanization: typeof line.romanization === 'string' ? line.romanization : '',
      isChorus: original !== null ? original.isChorus === true : line.isChorus === true,
      ...(original !== null
        ? {
            renderHints: original.renderHints,
            wordSegments: original.wordSegments,
            autoWordSegments: original.autoWordSegments,
            chorusEffect: original.chorusEffect,
            songPart: original.songPart,
            blockIndex: original.blockIndex,
            alternateTexts: original.alternateTexts,
            backgroundVocal: original.backgroundVocal,
            backgroundVocals: original.backgroundVocals,
            agentId: original.agentId,
          }
        : {}),
    })
  }
  return out
}

// The band maths lives in folia-audio.js (Folia's own write path); this stage only
// pushes a frame of it into its MotionValues.

var FoliaPendoloRenderer = FOLIA_PENDOLO !== null && FOLIA_PENDOLO.VisualizerPendolo
  ? (typeof React.memo === 'function' ? React.memo(FOLIA_PENDOLO.VisualizerPendolo) : FOLIA_PENDOLO.VisualizerPendolo)
  : null

function FoliaPendoloStage(props) {
  var snapshot = usePlayerSnapshot()
  var clock = useMotionValue(0)
  // Folia's lyric clock is offset-applied; the player's active line already is.
  var offsetRef = useRef(0)
  offsetRef.current = (Number(props.offsetMs) || 0) / 1000
  var power = useMotionValue(0)
  var bass = useMotionValue(0)
  var lowMid = useMotionValue(0)
  var mid = useMotionValue(0)
  var vocal = useMotionValue(0)
  var treble = useMotionValue(0)
  var spectrum = useMotionValue(new Uint8Array(0))
  var bandsRef = useRef(null)
  if (bandsRef.current === null) {
    bandsRef.current = {
      bass: bass,
      lowMid: lowMid,
      mid: mid,
      vocal: vocal,
      treble: treble,
      spectrum: spectrum,
    }
  }

  useEffect(function () {
    var stopped = false
    var frame = 0

    // The player's active deck is the only clock source. Querying the first
    // `audio.mp-audio-host` is wrong after a crossfade: that can be the old deck
    // whose src was cleared, so the clock would sit at 0.
    function readTime() {
      if (player && typeof player.getPlaybackTime === 'function') {
        var playback = player.getPlaybackTime()
        return Number(playback && playback.currentTime) || 0
      }
      var time = player.getTime()
      return Number(time && time.currentTime) || 0
    }

    function tick() {
      if (stopped) return
      try {
        clock.set(readTime() - offsetRef.current)
        // Paused frames are not written (the last bands stand still), as the player
        // page requires; the analyser waits for the play gesture.
        var bands = foliaAudioBands(foliaAudioIsPlaying())
        if (bands !== null) {
          power.set(bands.power)
          bandsRef.current.bass.set(bands.bass)
          bandsRef.current.lowMid.set(bands.lowMid)
          bandsRef.current.mid.set(bands.mid)
          bandsRef.current.vocal.set(bands.vocal)
          bandsRef.current.treble.set(bands.treble)
          bandsRef.current.spectrum.set(bands.spectrum)
        }
      } catch (error) {
        // The clock is best effort; a failed read keeps the last frame.
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return function () {
      stopped = true
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  var lines = useMemo(function () {
    return foliaPendoloLines(props.lines)
  }, [props.lines])

  var theme = useFoliaCoverTheme(props.coverUrl, props.seed, props.accent)

  var seek = useCallback(function (seconds) {
    // The rail's timestamps are raw audio time; the clock is offset, so seek to the
    // line's place in the shifted clock or the next line becomes active.
    player.seek((Number(seconds) || 0) + offsetRef.current)
  }, [])

  var active = Number(props.active)
  var currentLineIndex = isFinite(active) ? active : -1
  if (currentLineIndex >= 0) {
    // The plugin's index counts untimed lines too; map it onto the converted array.
    var mapped = 0
    for (var lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (Number(lines[lineIndex].sourceIndex) <= currentLineIndex) mapped = lineIndex
    }
    currentLineIndex = lines.length === 0 ? -1 : mapped
  }
  var seed = typeof props.seed === 'string' && props.seed !== '' ? props.seed : 'pendolo'
  // The style host used to hardcode these three, so 字号 / 翻译缩放 / 翻译开关 did nothing
  // while 时计 was the style on screen. Read them the same way folia-styles.js does.
  var prefs = props.prefs || {}
  var lyricsFontScale = Number(prefs.lyricsFontScale)
  if (!isFinite(lyricsFontScale) || lyricsFontScale <= 0) lyricsFontScale = 1
  var translationScale = Number(prefs.translationScale)
  if (!isFinite(translationScale) || translationScale <= 0) translationScale = 90
  var showTranslation = prefs.showTranslation !== false
  var foliaProps = {
    // Folia's entry remounts the renderer per song (`key={props.seed}`); the rail's
    // scroll anchor and the clockwork's cover must not survive a track change.
    key: seed,
    currentTime: clock,
    currentLineIndex: currentLineIndex,
    lines: lines,
    theme: theme,
    subtitleTheme: theme,
    audioPower: power,
    audioBands: bandsRef.current,
    showText: true,
    subtitleContentMode: showTranslation ? 'translation' : 'none',
    showSubtitleTranslation: showTranslation,
    lyricsFontScale: lyricsFontScale,
    subtitleFontScale: translationScale / 100,
    subtitleOverlayBackground: prefs.subtitleOverlayBackground !== false,
    hideTranslationSubtitle: !showTranslation,
    isPlayerChromeHidden: false,
    isPreviewMode: false,
    paused: snapshot.playing !== true,
    staticMode: false,
    seed: seed,
    coverUrl: '',
    pendoloTuning: FOLIA_PENDOLO.DEFAULT_PENDOLO_TUNING,
    onLyricLineSeek: seek,
  }
  return h(FoliaPendoloRenderer, foliaProps)
}

function renderFoliaPendolo(props) {
  if (FoliaPendoloRenderer === null || typeof useMotionValue !== 'function') {
    var classic = mpStyleOf('monet')
    return classic === null ? null : classic.render(Object.assign({}, props, { variant: 'standard' }))
  }
  return h(FoliaPendoloStage, props)
}

mpRegisterStyle({
  id: 'pendolo',
  order: 60,
  labelKey: 'sheet.stylePendolo',
  glyph: 'clock',
  render: renderFoliaPendolo,
})





