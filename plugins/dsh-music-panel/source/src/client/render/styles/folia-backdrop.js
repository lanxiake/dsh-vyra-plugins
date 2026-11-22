/**
 * Folia shell backgrounds — the player page backdrop.
 *
 * `src/folia/backgrounds/**` is Folia's background tree (六种背景: common,
 * monet, nomand, latent, sora, url); `backgrounds.bundle.js` compiles it. This file is
 * the boundary: it builds Folia's `VisualizerBackgroundConfig`/`Theme`/audio signals,
 * mounts the renderer once, and replaces the plugin's old ambient-cover background.
 */

var FOLIA_BG = (function () {
  try {
    if (typeof __mpBackgroundsBundle !== 'function') return null
    return __mpBackgroundsBundle()
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[dsh-music] Folia backgrounds unavailable:', error && error.message)
    }
    return null
  }
})()

var FoliaBackgroundRenderer = FOLIA_BG !== null && FOLIA_BG.VisualizerBackgroundRenderer
  ? (typeof React.memo === 'function' ? React.memo(FOLIA_BG.VisualizerBackgroundRenderer) : FOLIA_BG.VisualizerBackgroundRenderer)
  : null

/** Modes the player sheet offers; ids match Folia's registry. */
var FOLIA_BG_NONE = 'none'

function foliaBackgroundConfig(mode, url, transparent, latentDisplayMode, latentColorSource) {
  if (FOLIA_BG === null) return null
  var resolved = mode === FOLIA_BG_NONE ? FOLIA_BG.DEFAULT_VISUALIZER_BACKGROUND_MODE : mode
  var items = typeof url === 'string' && url.trim() !== ''
    ? [{ id: 'custom', url: url.trim(), note: '' }]
    : []
  return {
    mode: resolved,
    transparent: transparent === true || mode === FOLIA_BG_NONE,
    common: {
      useCoverColorBg: true,
      opacity: 0.75,
      disableGeometricBackground: false,
      disableVignette: false,
    },
    latent: {
      tuning: Object.assign({}, FOLIA_BG.DEFAULT_LATENT_BACKGROUND_TUNING, {
        displayMode: latentDisplayMode === 'dithering' || latentDisplayMode === 'mesh'
          ? latentDisplayMode
          : 'both',
        colorSource: latentColorSource === 'cover-only' ? 'cover-only' : 'cover-theme',
      }),
    },
    monet: { tuning: FOLIA_BG.DEFAULT_MONET_BACKGROUND_TUNING },
    nomand: { tuning: FOLIA_BG.DEFAULT_NOMAND_BACKGROUND_TUNING },
    sora: { tuning: FOLIA_BG.DEFAULT_SORA_BACKGROUND_TUNING },
    url: { items: items, selectedId: items.length > 0 ? 'custom' : null },
  }
}

function FoliaBackgroundStage(props) {
  var snapshot = usePlayerSnapshot()
  var pausedPair = React.useState(snapshot.playing !== true)
  var paused = pausedPair[0]
  var setPaused = pausedPair[1]
  var playingRef = useRef(snapshot.playing === true)
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
    function tick() {
      if (stopped) return
      try {
        // The resident element decides paused: a snapshot can lag behind the deck (and a
        // crossfade's second deck keeps the analyser's signal alive while the first pauses).
        var actuallyPlaying = foliaAudioIsPlaying()
        if (actuallyPlaying !== playingRef.current) {
          playingRef.current = actuallyPlaying
          setPaused(!actuallyPlaying)
        }
        var bands = foliaAudioBands(actuallyPlaying)
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
        // Bands are cosmetic; keep the last frame.
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return function () {
      stopped = true
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  var theme = useFoliaCoverTheme(props.cover, props.seed, props.accent)

  var config = useMemo(function () {
    return foliaBackgroundConfig(props.mode, props.url, props.transparent, props.latentDisplayMode, props.latentColorSource)
  }, [props.mode, props.transparent, props.url, props.latentDisplayMode, props.latentColorSource])

  if (config === null || FoliaBackgroundRenderer === null) {
    // A solid backdrop is still better than the old ambient layer when the bundle
    // cannot load; the page keeps its own base colour underneath.
    return null
  }
  if (config.transparent === true) return null

  return h(
    'div',
    {
      className: 'mp-folia-backdrop',
      'aria-hidden': 'true',
      style: {
        position: 'absolute',
        inset: '0',
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      },
    },
    h(FoliaBackgroundRenderer, {
      config: config,
      theme: theme,
      isDaylight: false,
      coverUrl: typeof props.cover === 'string' && props.cover !== '' ? props.cover : null,
      audioPower: power,
      audioBands: bandsRef.current,
      seed: typeof props.seed === 'string' && props.seed !== '' ? props.seed : 'folia',
      staticMode: false,
      paused: paused,
      blendMs: 0,
    }),
  )
}

function renderFoliaBackground(props) {
  if (FoliaBackgroundRenderer === null || typeof useMotionValue !== 'function') return null
  return h(FoliaBackgroundStage, props)
}

/** The player page mounts this; it checks the bundle before the hook-bearing stage. */
function FoliaBackgroundHost(props) {
  if (FoliaBackgroundRenderer === null || typeof useMotionValue !== 'function') return null
  return h(FoliaBackgroundStage, props)
}









