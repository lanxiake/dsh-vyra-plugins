/**
 * Folia playback graph: one AudioContext, two deck chains, one shared mix.
 *
 * This is the non-React replacement for the graph half of `player.ensureAnalyser()`.
 * It owns the Web Audio nodes only; the queue, source fetching, statistics and UI
 * stay in `player.js` until the transport is migrated too.
 *
 * The graph itself is built by Folia's `buildPlaybackGraph` from
 * `src/client/audio/engine.bundle.js`; this file is the DSH boundary that supplies
 * the two media elements and keeps the volume/EQ handles.
 */

function createFoliaGraph(options) {
  var settings = options !== null && typeof options === 'object' ? options : {}
  var createContext =
    typeof settings.createContext === 'function'
      ? settings.createContext
      : function () {
          var Ctor = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
          if (!Ctor) throw new Error('Web Audio is unavailable')
          return new Ctor()
        }
  var createAudioElement =
    typeof settings.createAudioElement === 'function'
      ? settings.createAudioElement
      : function () {
          if (typeof document === 'undefined') throw new Error('document is unavailable')
          return document.createElement('audio')
        }

  var audioApi = typeof __mpAudioBundle === 'function' ? __mpAudioBundle() : null
  if (audioApi === null) throw new Error('Folia audio bundle is missing')

  var context = null
  var analyser = null
  var waveData = null
  var graph = null
  var mixNode = null
  var chains = { A: null, B: null }
  var equalizerNodesRef = { current: [] }
  var elements = { A: null, B: null }
  var activeDeck = 'A'
  var volume = 1
  var muted = false
  var outputDeviceId = ''
  var eqSettings = audioApi.resolveAudioEqualizerSettings(audioApi.DEFAULT_AUDIO_EQUALIZER_SETTINGS)
  var disposed = false

  function otherDeck(deck) {
    return deck === 'A' ? 'B' : 'A'
  }

  function makeSecondary() {
    if (elements.B !== null) return elements.B
    var secondary = createAudioElement()
    secondary.preload = 'metadata'
    secondary.setAttribute('aria-hidden', 'true')
    secondary.className = 'mp-audio-host'
    var primary = elements.A
    if (primary !== null && primary.parentNode) primary.parentNode.insertBefore(secondary, primary.nextSibling)
    elements.B = secondary
    return secondary
  }

  function masterGain() {
    return graph === null ? null : graph.gainNode
  }

  function applyVolume(immediate, rampSeconds) {
    var target = muted ? 0 : volume
    var gain = masterGain()
    if (gain === null || context === null) {
      if (elements.A !== null) elements.A.volume = target
      if (elements.B !== null) elements.B.volume = target
      return
    }
    if (immediate === true) {
      try {
        gain.gain.cancelScheduledValues(context.currentTime)
        gain.gain.setValueAtTime(target, context.currentTime)
      } catch (error) {
        gain.gain.value = target
      }
      return
    }
    var ramp = Number(rampSeconds)
    audioApi.rampGain(context, gain, target, isFinite(ramp) && ramp >= 0 ? ramp : 0.015)
  }

  function applyEq() {
    if (graph === null || context === null) return
    audioApi.applyAudioEqualizerSettings(context, equalizerNodesRef.current, eqSettings, 0.015)
    graph.effectChain.apply(eqSettings.effects, eqSettings.enabled)
  }

  /** Put the context on the saved sink; a missing setSinkId leaves the default. */
  function applyOutputDevice() {
    if (context === null || typeof context.setSinkId !== 'function') return false
    var target = outputDeviceId === 'default' ? '' : outputDeviceId
    try {
      var pending = context.setSinkId(target)
      if (pending && typeof pending.catch === 'function') pending.catch(function () {})
      return true
    } catch (error) {
      return false
    }
  }

  function build() {
    if (graph !== null) return graph
    if (disposed) return null
    if (elements.A === null) return null
    makeSecondary()
    try {
      context = createContext()
      applyOutputDevice()
      analyser = context.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.6
      waveData = new Uint8Array(analyser.frequencyBinCount)

      graph = audioApi.buildPlaybackGraph({
        context: context,
        analyser: analyser,
        connectDecks: function (ctx, output) {
          mixNode = output
          chains.A = audioApi.connectAutomixDeck(ctx, elements.A, output)
          chains.B = elements.B === null ? null : audioApi.connectAutomixDeck(ctx, elements.B, output)
          return chains.A !== null && chains.B !== null
        },
        equalizerNodesRef: equalizerNodesRef,
        settings: eqSettings,
      })
      // With the graph in place, volume/mute belong to the master gain. The
      // element's own volume would otherwise attenuate the signal twice and
      // make the EQ/effects see a level the listener did not choose.
      elements.A.volume = 1
      elements.A.muted = false
      if (elements.B !== null) {
        elements.B.volume = 1
        elements.B.muted = false
      }
      applyVolume(true)
      applyEq()
      if (context.state === 'suspended') context.resume().catch(function () {})
      return graph
    } catch (error) {
      graph = null
      analyser = null
      waveData = null
      mixNode = null
      chains = { A: null, B: null }
      equalizerNodesRef = { current: [] }
      context = null
      return null
    }
  }

  function detachSecondary() {
    var secondary = elements.B
    if (secondary === null) return
    try {
      secondary.pause()
      secondary.removeAttribute('src')
      secondary.load()
    } catch (error) {
      // The element may already be detached.
    }
    if (secondary.parentNode) secondary.parentNode.removeChild(secondary)
    elements.B = null
  }

  function destroyGraph() {
    if (context !== null) {
      try {
        context.close()
      } catch (error) {
        // Already closed.
      }
    }
    context = null
    analyser = null
    waveData = null
    graph = null
    mixNode = null
    chains = { A: null, B: null }
    equalizerNodesRef = { current: [] }
  }

  var api = {
    /** Build the graph lazily; call from a user gesture so the context can start. */
    ensure: function () {
      return build()
    },

    /**
     * Hand the resident `<audio>` element to the engine. The spare deck is
     * created beside it, like the old engine did. A different element tears the
     * old graph down because `createMediaElementSource` can only bind once.
     */
    attach: function (element) {
      if (element === elements.A) return elements.B
      if (graph !== null) destroyGraph()
      detachSecondary()
      elements.A = element === undefined ? null : element
      if (elements.A === null) return null
      return makeSecondary()
    },

    /** The spare deck, so the transport can load a track into it. */
    getDeckElement: function (deck) {
      return deck === 'B' ? elements.B : elements.A
    },

    /** The active deck is the one the UI's transport controls. */
    getActiveDeck: function () {
      return activeDeck
    },
    setActiveDeck: function (deck) {
      activeDeck = deck === 'B' ? 'B' : 'A'
      return activeDeck
    },
    otherDeck: otherDeck,

    getDeckChain: function (deck) {
      return deck === 'B' ? chains.B : chains.A
    },
    getMixNode: function () {
      return mixNode
    },
    getEqualizerNodes: function () {
      return equalizerNodesRef.current
    },
    getContext: function () {
      return context
    },
    getAnalyser: function () {
      return analyser
    },
    getMasterGain: function () {
      return masterGain()
    },
    /** The transport fade node Folia's playbackFade controller owns. */
    getFadeGraph: function () {
      return graph === null ? null : { context: context, gain: graph.fadeNode }
    },

    getWave: function () {
      if (analyser === null || waveData === null) return null
      analyser.getByteFrequencyData(waveData)
      return waveData
    },

    getVolume: function () {
      return volume
    },
    isMuted: function () {
      return muted
    },
    setVolume: function (value, rampSeconds) {
      var next = Number(value)
      if (!isFinite(next)) return
      volume = Math.min(1, Math.max(0, next))
      applyVolume(false, rampSeconds)
    },
    setMuted: function (value, rampSeconds) {
      muted = value === true
      applyVolume(false, rampSeconds)
    },

    getEq: function () {
      return eqSettings
    },
    setEq: function (next) {
      eqSettings = audioApi.resolveAudioEqualizerSettings(next)
      applyEq()
    },
    getOutputDevice: function () {
      return outputDeviceId
    },
    setOutputDevice: function (deviceId) {
      outputDeviceId = deviceId === undefined || deviceId === null ? '' : String(deviceId)
      return applyOutputDevice()
    },

    /** Crossfade the two deck envelopes with Folia's scheduled curves. */
    scheduleCrossfade: function (seconds, crossover, hold, together) {
      if (graph === null || context === null || chains.A === null || chains.B === null) return false
      return audioApi.scheduleCrossfade(
        context,
        chains[activeDeck].fade,
        chains[otherDeck(activeDeck)].fade,
        seconds,
        crossover,
        hold,
        together,
      )
    },

    dispose: function () {
      disposed = true
      destroyGraph()
      detachSecondary()
      elements.A = null
    },
  }

  return api
}
