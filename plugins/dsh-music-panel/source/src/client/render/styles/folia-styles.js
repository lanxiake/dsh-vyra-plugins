/**
 * Folia lyric styles (batch 1: DOM / Canvas).
 *
 * `src/folia/styles.bundle.js` is compiled from Folia's own style directories;
 * this file is the boundary: one host builds Folia's VisualizerSharedProps (clock,
 * lines, theme, audio bands) and mounts the selected style once per song.
 */

var FOLIA_STYLES = (function () {
  try {
    if (typeof __mpStylesBundle !== 'function') return null
    return __mpStylesBundle()
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[dsh-music] Folia styles unavailable:', error && error.message)
    }
    return null
  }
})()

var FOLIA_STYLE_META = [
  // Same order values as each style's own entry.tsx in Folia.
  { id: 'sonnet', labelKey: 'sheet.foliaStyleSonnet', glyph: 'note', order: 10 },
  { id: 'tempera', labelKey: 'sheet.foliaStyleTempera', glyph: 'note', order: 20 },
  { id: 'lumiere', labelKey: 'sheet.foliaStyleLumiere', glyph: 'note', order: 25 },
  { id: 'hanabi', labelKey: 'sheet.foliaStyleHanabi', glyph: 'star', order: 26 },
  { id: 'nebbia', labelKey: 'sheet.foliaStyleNebbia', glyph: 'note', order: 29 },
  { id: 'cadenza', labelKey: 'sheet.foliaStyleCadenza', glyph: 'note', order: 40 },
  { id: 'partita', labelKey: 'sheet.foliaStylePartita', glyph: 'list', order: 50 },
  { id: 'fume', labelKey: 'sheet.foliaStyleFume', glyph: 'note', order: 60 },
  { id: 'tilt', labelKey: 'sheet.foliaStyleTilt', glyph: 'note', order: 70 },
  { id: 'claddagh', labelKey: 'sheet.foliaStyleCladdagh', glyph: 'disc', order: 80 },
  { id: 'monet', labelKey: 'sheet.foliaStyleMonet', glyph: 'disc', order: 90 },
  { id: 'diorama', labelKey: 'sheet.foliaStyleDiorama', glyph: 'disc', order: 120 },
  { id: 'still', labelKey: 'sheet.foliaStyleStill', glyph: 'note', order: 130 },
]

function foliaStyleEntry(mode) {
  if (FOLIA_STYLES === null) return null
  var entries = FOLIA_STYLES.FOLIA_STYLE_ENTRIES || {}
  return entries[mode] || null
}

/**
 * Convert once, then apply Folia's leading staff-credit policy (smart): a long intro
 * keeps the credits, a short one compacts or hides them. Without this a time-stamped
 * "作词：…" block stays in the article and the fume camera frames that credit instead of
 * the sung line.
 */
/** Folia's parser always synthesizes words, so every style may index them; legacy/line-level lines must too. */
function ensureStyleLineWords(line) {
  if (line === null || line === undefined) return line
  if (Array.isArray(line.words) && line.words.length > 0) return line
  var bundle = typeof FOLIA_PENDOLO !== 'undefined' ? FOLIA_PENDOLO : null
  var start = Number(line.startTime) || 0
  var end = Number(line.endTime) || start + 4
  var words = bundle && typeof bundle.buildTimedWords === 'function'
    ? bundle.buildTimedWords(String(line.fullText || ''), start, end)
    : (String(line.fullText || '') === '' ? [] : [{ text: String(line.fullText), startTime: start, endTime: end }])
  return words.length > 0 ? Object.assign({}, line, { words }) : line
}

function foliaStyleLines(raw, title, artist) {
  var lines = foliaPendoloLines(raw)
  if (FOLIA_STYLES !== null && typeof FOLIA_STYLES.applyLyricStaffPolicy === 'function') {
    try {
      var data = FOLIA_STYLES.applyLyricStaffPolicy(
        { lines: lines, title: title || '', artist: artist || '' },
        { policy: 'smart' },
      )
      if (data !== null && data !== undefined && Array.isArray(data.lines)) lines = data.lines
    } catch (error) {}
  }
  // The lines are already Folia's own (or converted by foliaPendoloLines above):
  // pass them on untouched, as Folia's app does. Only a line that crossed the
  // legacy boundary without words gets the parser's estimated timeline here.
  return lines
    .filter(function (line) {
      return line && typeof line.fullText === 'string' && line.fullText.trim() !== ''
    })
    .map(ensureStyleLineWords)
}

// Folia derives the visualizer theme from the cover palette (generateBuiltinDualTheme) and
// keeps it for the song. One cache is shared by every style and the backdrop, so a song
// extracts its cover once.
var MP_FOLIA_THEME_CACHE = {}

function mpThemeHash(text) {
  var value = 2166136261
  var source = String(text || '')
  for (var index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function mpSeededRandom(seed) {
  var state = mpThemeHash(seed) || 1
  return function () {
    state = (state + 0x6d2b79f5) >>> 0
    var t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mpMergeFoliaTheme(base, coverTheme) {
  if (coverTheme === null || coverTheme === undefined) return base
  return Object.assign({}, base, {
    name: coverTheme.name || base.name,
    description: coverTheme.description || base.description,
    backgroundColor: coverTheme.backgroundColor || base.backgroundColor,
    primaryColor: coverTheme.primaryColor || base.primaryColor,
    secondaryColor: coverTheme.secondaryColor || base.secondaryColor,
    accentColor: coverTheme.accentColor || base.accentColor,
    wordColors: coverTheme.wordColors || base.wordColors || [],
    lyricsIcons: coverTheme.lyricsIcons || base.lyricsIcons || [],
    fontStyle: base.fontStyle,
    fontWeight: base.fontWeight,
    fontFamily: base.fontFamily,
    fontFamilyStack: base.fontFamilyStack,
    animationIntensity: base.animationIntensity,
  })
}

function useFoliaCoverTheme(coverUrl, seed, accent) {
  var fallback = foliaPendoloTheme(accent)
  var prefs = usePrefs()
  // A locally generated theme (see folia-local-theme.js) wins while the source is the
  // local one; the cover-derived theme below stays as its fallback until it lands.
  var localState = useMpLocalTheme(seed)
  var localTheme = prefs.themeSource === 'cover' && localState.theme
    ? mpMergeFoliaTheme(fallback, localState.theme)
    : null
  var pair = React.useState(null)
  var theme = pair[0]
  var setTheme = pair[1]
  var currentTheme = theme === null ? fallback : theme

  React.useEffect(
    function () {
      var cancelled = false
      var cover = typeof coverUrl === 'string' ? coverUrl : ''
      if (cover === '' || FOLIA_STYLES === null || typeof FOLIA_STYLES.extractColors !== 'function') {
        setTheme(null)
        return function () {
          cancelled = true
        }
      }
      if (MP_FOLIA_THEME_CACHE[cover]) {
        setTheme(MP_FOLIA_THEME_CACHE[cover])
        return function () {
          cancelled = true
        }
      }
      FOLIA_STYLES.extractColors(cover, 5)
        .then(function (colors) {
          if (cancelled) return
          try {
            var dual = FOLIA_STYLES.generateBuiltinDualTheme({
              coverColors: Array.isArray(colors) ? colors : [],
              random: mpSeededRandom(seed || cover),
            })
            var next = mpMergeFoliaTheme(fallback, dual && dual.dark)
            MP_FOLIA_THEME_CACHE[cover] = next
            setTheme(next)
          } catch (error) {
            setTheme(null)
          }
        })
        .catch(function () {
          if (!cancelled) setTheme(null)
        })
      return function () {
        cancelled = true
      }
    },
    [coverUrl, seed, accent],
  )

  return localTheme !== null ? localTheme : currentTheme
}

/**
 * Folia's findLatestActiveLineIndex: the last line whose start has passed and whose
 * render window still contains `time`; gaps between lines are -1, not the previous line.
 */
function foliaLineIndex(lines, time) {
  for (var index = lines.length - 1; index >= 0; index -= 1) {
    var line = lines[index]
    if (!line || time < line.startTime) continue
    if (time <= ((line.renderHints && line.renderHints.renderEndTime) ?? line.endTime)) return index
  }
  return -1
}

function foliaLineForActive(lines, active) {
  var current = Number(active)
  if (!isFinite(current) || current < 0) return -1
  var mapped = -1
  for (var index = 0; index < lines.length; index += 1) {
    if (Number(lines[index].sourceIndex) <= current) mapped = index
  }
  return lines.length === 0 ? -1 : mapped
}

function FoliaStyleStage(props) {
  var snapshot = usePlayerSnapshot()
  var clock = useMotionValue(0)
  // The player's per-song lyric offset. Folia's playback engine exposes ONE shared,
  // offset-applied lyric clock; without it the active line (offset-applied) and the
  // word sweep (raw audio time) disagree whenever the song has an offset.
  var offsetRef = useRef(0)
  offsetRef.current = (Number(props.offsetMs) || 0) / 1000
  var probeRef = useRef({ lines: [], active: -1, mode: '' })
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
    // The player owns the active deck. A DOM query returns the first `audio` element,
    // which after a crossfade can be the old deck whose src was just cleared (time 0).
    function readTime() {
      if (player && typeof player.getPlaybackTime === 'function') {
        var playback = player.getPlaybackTime()
        return Number(playback && playback.currentTime) || 0
      }
      var time = player.getTime()
      return Number(time && time.currentTime) || 0
    }
    var probeFrame = 0
    function tick() {
      if (stopped) return
      try {
        clock.set(readTime() - offsetRef.current)
        probeFrame += 1
        if (probeFrame % 120 === 0 && typeof postJson === 'function') {
          var probe = probeRef.current
          var activeLine = probe.active >= 0 ? probe.lines[probe.active] : null
          void postJson(API + 'debug/report', {
            kind: 'tick',
            mode: probe.mode,
            now: Math.round(clock.get() * 100) / 100,
            active: probe.active,
            activeWords: activeLine && Array.isArray(activeLine.words) ? activeLine.words.length : 0,
            activeText: activeLine ? String(activeLine.fullText || '').slice(0, 40) : '',
            activeStart: activeLine ? activeLine.startTime : null,
            activeEnd: activeLine ? activeLine.endTime : null,
          }).catch(function () {})
        }
        // Paused frames are not written (the last bands stand still); see folia-audio.js.
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
      } catch (error) {}
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return function () {
      stopped = true
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  var lines = useMemo(function () {
    return foliaStyleLines(props.lines, props.title, props.artist)
  }, [props.lines, props.title, props.artist])
  // Folia computes the active line from the same lyric clock as the word sweep. The
  // parent's active prop is refreshed by timeupdate (~4 Hz), so using it directly puts
  // the line and the words on two clocks. Resolve it here at frame rate instead.
  var linePair = useState(function () {
    return foliaLineForActive(lines, props.active)
  })
  var lineIndex = linePair[0]
  var setLineIndex = linePair[1]
  var linesRef = useRef(lines)
  linesRef.current = lines
  useEffect(function () {
    setLineIndex(foliaLineIndex(lines, clock.get()))
  }, [lines])
  useEffect(function () {
    if (clock === null || typeof clock.on !== 'function') return undefined
    return clock.on('change', function (latest) {
      var next = foliaLineIndex(linesRef.current, latest)
      setLineIndex(function (previous) {
        return next === previous ? previous : next
      })
    })
  }, [clock])
  useEffect(function () {
    try {
      if (typeof postJson !== 'function' || typeof API !== 'string') return
      var wordLines = lines.filter(function (line) {
        return line && Array.isArray(line.words) && line.words.length > 0
      }).length
      void postJson(API + 'debug/report', {
        kind: 'stage',
        mode: String(props.mode || ''),
        lines: lines.length,
        wordLevel: wordLines,
        hasAudio: typeof player !== 'undefined' && player !== null && typeof player.getActiveAudio === 'function'
          ? player.getActiveAudio() !== null
          : (typeof document !== 'undefined' && document.querySelector('audio.mp-audio-host') !== null),
        primaryColor: theme && theme.primaryColor ? String(theme.primaryColor) : '',
        accentColor: theme && theme.accentColor ? String(theme.accentColor) : '',
        secondaryColor: theme && theme.secondaryColor ? String(theme.secondaryColor) : '',
        wordColors: theme && Array.isArray(theme.wordColors) ? theme.wordColors.length : 0,
        first: lines[0]
          ? {
              start: lines[0].startTime,
              end: lines[0].endTime,
              words: (lines[0].words || []).length,
              hints: Boolean(lines[0].renderHints),
              text: String(lines[0].fullText || '').slice(0, 40),
            }
          : null,
      }).catch(function () {})
    } catch (error) {}
  }, [props.mode, lines])
  probeRef.current.lines = lines
  probeRef.current.mode = String(props.mode || '')
  var theme = useFoliaCoverTheme(props.coverUrl, props.seed, props.accent)
  var prefs = props.prefs || {}
  var intensity = prefs.lyricIntensity === 'calm' || prefs.lyricIntensity === 'chaotic'
    ? prefs.lyricIntensity
    : 'normal'
  var styledTheme = Object.assign({}, theme, { animationIntensity: intensity })
  var lyricsFontScale = Number(prefs.lyricsFontScale)
  if (!isFinite(lyricsFontScale) || lyricsFontScale <= 0) lyricsFontScale = 1
  var translationScale = Number(prefs.translationScale)
  if (!isFinite(translationScale) || translationScale <= 0) translationScale = 90
  var showTranslation = prefs.showTranslation !== false
  // Folia's subtitle overlay draws a soft theme-coloured halo behind the bottom line. It is
  // a setting there too (`subtitleOverlayBackground`), on by default; ours mirrors it.
  var subtitleOverlayBackground = prefs.subtitleOverlayBackground !== false

  var currentLineIndex = lineIndex
  probeRef.current.active = currentLineIndex

  var seed = typeof props.seed === 'string' && props.seed !== '' ? props.seed : 'folia'
  var entry = foliaStyleEntry(props.mode)
  if (entry === null || typeof entry.render !== 'function') {
    return foliaPlainFallback(props)
  }

  var shared = {
    currentTime: clock,
    currentLineIndex: currentLineIndex,
    lines: lines,
    theme: styledTheme,
    subtitleTheme: styledTheme,
    audioPower: power,
    audioBands: bandsRef.current,
    showText: true,
    // Monet ignores hideTranslationSubtitle and only reads the content mode (resolveSubtitleContentMode
    // returns the given mode as-is), so the mode itself has to carry the translation switch.
    subtitleContentMode: showTranslation ? 'translation' : 'none',
    showSubtitleTranslation: showTranslation,
    lyricsFontScale: lyricsFontScale,
    subtitleFontScale: translationScale / 100,
    subtitleOverlayBackground: subtitleOverlayBackground,
    hideTranslationSubtitle: !showTranslation,
    isPlayerChromeHidden: false,
    isPreviewMode: false,
    paused: snapshot.playing !== true,
    staticMode: false,
    seed: seed,
    coverUrl: foliaAbsoluteUrl(typeof props.coverUrl === 'string' ? props.coverUrl : ''),
    duration: Number(props.duration) || 0,
    songTitle: props.title || '',
    songArtist: props.artist || '',
    songAlbum: props.album || '',
    isDaylight: false,
    // A lyric line's timestamp is raw audio time; the stage clock is shifted by the
    // offsets, so seeking to the raw value would stop on the neighbouring line.
    onLyricLineSeek: function (seconds) {
      player.seek((Number(seconds) || 0) + offsetRef.current)
    },
  }

  return h(React.Suspense, { fallback: null }, h(React.Fragment, { key: seed }, entry.render(shared)))
}

function foliaAbsoluteUrl(url) {
  if (typeof url !== 'string' || url === '') return ''
  try {
    return new URL(url, window.location.href).href
  } catch (error) {
    return url
  }
}

function foliaPlainFallback(props) {
  var lines = Array.isArray(props && props.lines) ? props.lines : []
  return h(
    'div',
    { className: 'mp-np-lyrics is-full' },
    h(
      'div',
      { className: 'mp-np-lyrics-inner' },
      lines.map(function (line, index) {
        return h(
          'div',
          { key: String(index), className: 'mp-np-line' + (index === Number(props && props.active) ? ' is-active' : '') },
          h('div', { className: 'mp-np-line-text' }, line && typeof line.fullText === 'string' ? line.fullText : line && typeof line.text === 'string' ? line.text : ''),
        )
      }),
    ),
  )
}

function FoliaStyleHost(props) {
  if (FOLIA_STYLES === null || typeof useMotionValue !== 'function') {
    return foliaPlainFallback(props)
  }
  if (typeof React.Component === 'function') {
    return h(
      FoliaStyleBoundary,
      { key: String(props.mode) + '|' + String(props.seed || ''), styleProps: props },
      h(FoliaStyleStage, props),
    )
  }
  return h(FoliaStyleStage, props)
}

/**
 * One style failing (WebGL context loss, a missing boundary shim) must not take the
 * player down: render the plain lyric fallback instead.
 */
class FoliaStyleBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[dsh-music] Folia style failed:', this.props.styleProps && this.props.styleProps.mode, error)
    }
  }

  render() {
    if (this.state.failed === true) {
      return foliaPlainFallback(this.props.styleProps)
    }
    return this.props.children
  }
}

function registerFoliaStyle(meta) {
  if (FOLIA_STYLES === null || foliaStyleEntry(meta.id) === null) return
  mpRegisterStyle({
    id: meta.id,
    labelKey: meta.labelKey,
    glyph: meta.glyph,
    order: meta.order,
    render: function (props) {
      return h(FoliaStyleHost, Object.assign({}, props, { mode: meta.id }))
    },
  })
}

FOLIA_STYLE_META.forEach(registerFoliaStyle)






