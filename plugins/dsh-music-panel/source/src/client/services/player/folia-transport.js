/**
 * Folia transport: media elements and play/pause/seek, without React.
 *
 * The queue and source fetching stay in `player.js`; this layer only drives the
 * two decks the graph owns. It must not grow a second audio graph or its own
 * gain maths — every audible decision comes from `folia-graph.js` and the Folia
 * bundle behind it.
 */

function createFoliaTransport(options) {
  var config = options !== null && typeof options === 'object' ? options : {}
  var graph = config.graph
  if (!graph || typeof graph.ensure !== 'function') throw new Error('createFoliaTransport needs a graph')

  var onState = typeof config.onState === 'function' ? config.onState : function () {}
  var onTime = typeof config.onTime === 'function' ? config.onTime : function () {}
  var onError = typeof config.onError === 'function' ? config.onError : function () {}
  var onEnded = typeof config.onEnded === 'function' ? config.onEnded : function () {}

  var elements = { A: null, B: null }
  var listeners = []
  var activeDeck = 'A'
  var fadeEnabled = config.playbackFade !== false
  var fade = null
  var disposed = false

  function deckOf(element) {
    if (element === elements.A) return 'A'
    if (element === elements.B) return 'B'
    return null
  }

  function emitState(deck) {
    var element = elements[deck]
    if (!element) return
    onState({
      deck: deck,
      active: deck === activeDeck,
      playing: element.paused !== true && element.ended !== true,
      currentTime: Number(element.currentTime) || 0,
      duration: Number(element.duration) || 0,
    })
  }

  function emitTime(deck) {
    var element = elements[deck]
    if (!element) return
    onTime({
      deck: deck,
      active: deck === activeDeck,
      currentTime: Number(element.currentTime) || 0,
      duration: Number(element.duration) || 0,
      buffered: element.buffered && element.buffered.length > 0
        ? element.buffered.end(element.buffered.length - 1)
        : 0,
    })
  }

  function listen(element, type, handler) {
    element.addEventListener(type, handler)
    listeners.push({ element: element, type: type, handler: handler })
  }

  function bind(deck) {
    var element = elements[deck]
    if (!element) return
    listen(element, 'timeupdate', function () {
      emitTime(deck)
    })
    listen(element, 'durationchange', function () {
      emitTime(deck)
    })
    listen(element, 'loadedmetadata', function () {
      emitTime(deck)
    })
    listen(element, 'play', function () {
      emitState(deck)
    })
    listen(element, 'pause', function () {
      emitState(deck)
    })
    listen(element, 'ended', function () {
      emitState(deck)
      onEnded({ deck: deck, active: deck === activeDeck })
    })
    listen(element, 'error', function () {
      onError({
        deck: deck,
        active: deck === activeDeck,
        message: element.error && element.error.message ? element.error.message : '',
      })
    })
  }

  function bindDecks() {
    elements.A = graph.getDeckElement('A')
    elements.B = graph.getDeckElement('B')
    bind('A')
    bind('B')
    activeDeck = graph.getActiveDeck()
  }

  function fadeController() {
    if (fade !== null) return fade
    var audioApi = typeof __mpAudioBundle === 'function' ? __mpAudioBundle() : null
    if (audioApi === null) return null
    fade = audioApi.createPlaybackFadeController({
      getGraph: function () {
        return graph.getFadeGraph()
      },
      isEnabled: function () {
        return fadeEnabled
      },
    })
    return fade
  }

  function audioApi() {
    return typeof __mpAudioBundle === 'function' ? __mpAudioBundle() : null
  }

  function deckChain(deck) {
    return typeof graph.getDeckChain === 'function' ? graph.getDeckChain(deck) : null
  }

  /** Write the per-track gain Folia's balance owns. */
  function setDeckReplayGain(deck, db, seconds) {
    var api = audioApi()
    var chain = deckChain(deck)
    var context = typeof graph.getContext === 'function' ? graph.getContext() : null
    var value = Number(db)
    if (api === null || chain === null || context === null || !isFinite(value)) return false
    api.rampGainDb(context, chain.replayGain, value, seconds === undefined ? 0.1 : Number(seconds) || 0)
    return true
  }

  /** Write the blend's balance correction; zero outside a transition. */
  function setDeckTrim(deck, db, seconds) {
    var api = audioApi()
    var chain = deckChain(deck)
    var context = typeof graph.getContext === 'function' ? graph.getContext() : null
    var value = Number(db)
    if (api === null || chain === null || context === null || !isFinite(value)) return false
    api.rampGainDb(context, chain.trim, value, seconds === undefined ? 0.1 : Number(seconds) || 0)
    return true
  }

  function getBalanceMeter(deck) {
    var chain = deckChain(deck)
    return chain === null ? null : chain.balanceMeter
  }

  function getDeckAnalyser(deck) {
    var chain = deckChain(deck)
    return chain === null ? null : chain.analyser
  }

  function play(deck, playOptions) {
    var element = elements[deck]
    if (!element) return Promise.resolve(false)
    var withFade = !(playOptions !== null && typeof playOptions === 'object' && playOptions.fade === false)
    var controller = withFade ? fadeController() : null
    var token = controller === null ? null : controller.prepareFadeIn()
    var started
    try {
      started = element.play()
    } catch (error) {
      if (controller !== null) controller.abortFadeIn(token)
      onError({ deck: deck, active: deck === activeDeck, message: String(error && error.message ? error.message : error) })
      return Promise.resolve(false)
    }
    return Promise.resolve(started)
      .then(function () {
        if (disposed) return false
        if (controller !== null) controller.runFadeIn(token)
        emitState(deck)
        return true
      })
      .catch(function (error) {
        if (controller !== null) controller.abortFadeIn(token)
        if (!disposed) {
          onError({ deck: deck, active: deck === activeDeck, message: String(error && error.message ? error.message : error) })
        }
        return false
      })
  }

  function pause(deck) {
    var element = elements[deck]
    if (!element || element.paused) return Promise.resolve(false)
    var controller = fadeController()
    if (controller !== null && controller.fadeOutThen(function () {
      element.pause()
      emitState(deck)
    })) {
      return Promise.resolve(true)
    }
    element.pause()
    emitState(deck)
    return Promise.resolve(true)
  }

  function load(deck, source, loadOptions) {
    var element = elements[deck]
    if (!element) return Promise.resolve(false)
    var settings = loadOptions !== null && typeof loadOptions === 'object' ? loadOptions : {}
    if (typeof source !== 'string' || source === '') return Promise.resolve(false)
    if (graph.ensure() === null) return Promise.resolve(false)
    element.pause()
    element.src = source
    try {
      element.load()
    } catch (error) {
      onError({ deck: deck, active: deck === activeDeck, message: String(error && error.message ? error.message : error) })
      return Promise.resolve(false)
    }
    var startAt = Number(settings.startAt)
    if (isFinite(startAt) && startAt > 0) {
      var applyStart = function () {
        try {
          element.currentTime = startAt
        } catch (error) {
          // The element will start at zero if it refuses a seek before metadata.
        }
      }
      if (element.readyState >= 1) applyStart()
      else element.addEventListener('loadedmetadata', applyStart, { once: true })
    }
    if (settings.autoplay === true) return play(deck)
    return Promise.resolve(true)
  }

  function seek(deck, seconds) {
    var element = elements[deck]
    if (!element) return false
    var duration = Number(element.duration)
    var target = Number(seconds)
    if (!isFinite(target)) return false
    if (isFinite(duration) && duration > 0) target = Math.min(duration, Math.max(0, target))
    else target = Math.max(0, target)
    var apply = function () {
      try {
        element.currentTime = target
        emitTime(deck)
      } catch (error) {
        // A seek before metadata is retried by the caller after loadedmetadata.
      }
    }
    if (element.readyState >= 1) apply()
    else element.addEventListener('loadedmetadata', apply, { once: true })
    return true
  }

  function stop(deck) {
    var element = elements[deck]
    if (!element) return
    try {
      element.pause()
      element.removeAttribute('src')
      element.load()
    } catch (error) {
      // Already detached.
    }
    emitState(deck)
  }

  function crossfadeTo(deck, source, crossfadeOptions) {
    var targetDeck = deck === 'B' ? 'B' : 'A'
    var settings = crossfadeOptions !== null && typeof crossfadeOptions === 'object' ? crossfadeOptions : {}
    var outgoing = activeDeck
    var fadeSeconds = Number(settings.seconds)
    if (!(fadeSeconds > 0)) return Promise.resolve(false)
    return load(targetDeck, source, { autoplay: false, startAt: settings.startAt }).then(function (loaded) {
      if (!loaded) return false
      var gainDb = Number(settings.replayGainDb)
      if (isFinite(gainDb)) setDeckReplayGain(targetDeck, gainDb, 0.05)
      return play(targetDeck, { fade: false }).then(function (playing) {
        if (!playing || disposed) return false
        var scheduled = graph.scheduleCrossfade(
          fadeSeconds,
          settings.crossover,
          settings.hold,
          settings.together,
        )
        if (!scheduled) return false
        if (settings.setActive !== false) {
          activeDeck = targetDeck
          graph.setActiveDeck(activeDeck)
          emitState(outgoing)
          emitState(targetDeck)
        }
        return true
      })
    })
  }

  bindDecks()

  return {
    getState: function () {
      var element = elements[activeDeck]
      return {
        activeDeck: activeDeck,
        playing: Boolean(element && element.paused !== true && element.ended !== true),
        currentTime: element ? Number(element.currentTime) || 0 : 0,
        duration: element ? Number(element.duration) || 0 : 0,
      }
    },
    getDeckState: function (deck) {
      var element = elements[deck]
      return {
        deck: deck,
        active: deck === activeDeck,
        playing: Boolean(element && element.paused !== true && element.ended !== true),
        currentTime: element ? Number(element.currentTime) || 0 : 0,
        duration: element ? Number(element.duration) || 0 : 0,
      }
    },
    getActiveDeck: function () {
      return activeDeck
    },
    setActiveDeck: function (deck) {
      activeDeck = deck === 'B' ? 'B' : 'A'
      if (typeof graph.setActiveDeck === 'function') graph.setActiveDeck(activeDeck)
      emitState(activeDeck)
      return activeDeck
    },
    load: load,
    play: play,
    pause: pause,
    seek: seek,
    stop: stop,
    crossfadeTo: crossfadeTo,
    setDeckReplayGain: setDeckReplayGain,
    setDeckTrim: setDeckTrim,
    getBalanceMeter: getBalanceMeter,
    getDeckAnalyser: getDeckAnalyser,
    setPlaybackFade: function (enabled) {
      fadeEnabled = enabled !== false
    },
    isPlaybackFadeEnabled: function () {
      return fadeEnabled
    },
    dispose: function () {
      disposed = true
      for (var index = 0; index < listeners.length; index += 1) {
        var entry = listeners[index]
        try {
          entry.element.removeEventListener(entry.type, entry.handler)
        } catch (error) {
          // The element may already be gone.
        }
      }
      listeners = []
      if (fade !== null) fade.cancel()
      fade = null
      elements = { A: null, B: null }
    },
  }
}
