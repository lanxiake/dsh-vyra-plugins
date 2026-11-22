/**
 * playback engine moved verbatim from 0.11.1. It relies on the helpers in 10-base / 20-api / 30-prefs keeping their names.
 *
 * Extracted from client.js at the 0.11.1 baseline (3931c14).
 */

function shuffleTracks(list, currentTrack) {
  var queue = list.slice()
  for (var j = queue.length - 1; j > 0; j -= 1) {
    var k = Math.floor(Math.random() * (j + 1))
    var tmp = queue[j]
    queue[j] = queue[k]
    queue[k] = tmp
  }
  if (currentTrack) {
    var at = queue.indexOf(currentTrack)
    if (at > 0) {
      queue.splice(at, 1)
      queue.unshift(currentTrack)
    }
  }
  return queue
}

// Three playback modes, mapped onto the engine's loop/order pair:
//   sequence → in order, stop at the end
//   random   → shuffled, looping
//   one      → repeat the current track
var PLAY_MODES = ['sequence', 'random', 'one']

function playModeOf(snap) {
  if (snap.loop === 'one') return 'one'
  if (snap.order === 'random') return 'random'
  return 'sequence'
}

function playModeLabel(mode) {
  return mode === 'one'
    ? t('page.modeOne')
    : mode === 'random'
      ? t('page.modeRandom')
      : t('page.modeSequence')
}

function playModeIcon(mode) {
  return mode === 'one' ? 'repeatOne' : mode === 'random' ? 'shuffle' : 'repeat'
}

function applyPlayMode(mode) {
  if (mode === 'one') {
    player.setLoop('one')
    player.setOrder('list')
    return
  }
  if (mode === 'random') {
    player.setLoop('all')
    player.setOrder('random')
    return
  }
  player.setLoop('none')
  player.setOrder('list')
}

function cyclePlayMode(snap) {
  var current = playModeOf(snap)
  applyPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(current) + 1) % PLAY_MODES.length])
}

function nextIndexOf(index, size) {
  if (size <= 1) return 0
  return (index + 1) % size
}

function prevIndexOf(index, size) {
  if (size <= 1) return 0
  return (index - 1 + size) % size
}

// ── playback engine (module-level: survives panel unmount) ───────────
// The <audio> element lives here rather than in the React tree, so
// selecting another main panel keeps the current track playing.

function sameQueue(left, right) {
  if (left.length !== right.length) return false
  for (var i = 0; i < left.length; i += 1) {
    if (!right[i] || left[i].path !== right[i].path) return false
  }
  return true
}

// One engine per page. Client modules can be re-executed by HMR or by a
// module-table rebuild; a second engine would own a second <audio> and
// play on top of the first.
var PLAYER_KEY = '__dshMusicPlayer'
/** The id of the bundle that is running (scripts/build-client.mjs stamps it). */
function currentClientBuild() {
  return typeof CLIENT_BUILD === 'string' ? CLIENT_BUILD : ''
}
/**
 * What a client bundle needs from the engine. Kept for diagnostics and tests: an engine
 * that predates these methods or state fields is by definition from another evaluation.
 */
var PLAYER_REQUIRED_API = [
  'subscribe',
  'subscribeTime',
  'getSnapshot',
  'attachAudio',
  'ensureAnalyser',
  'setGainMode',
  'getGainState',
]
/** The snapshot fields this bundle reads; an older engine's state has no such keys. */
var PLAYER_REQUIRED_STATE = ['gainAppliedDb', 'gainEstimated', 'gainAvailable', 'gainTags']

/** True when an engine object serves every method and state field this bundle reads. */
function playerApiComplete(player) {
  if (player === null || typeof player !== 'object') return false
  for (var i = 0; i < PLAYER_REQUIRED_API.length; i += 1) {
    if (typeof player[PLAYER_REQUIRED_API[i]] !== 'function') return false
  }
  var snapshot = null
  try {
    snapshot = player.getSnapshot()
  } catch (error) {
    snapshot = null
  }
  if (snapshot === null || typeof snapshot !== 'object') return false
  for (var k = 0; k < PLAYER_REQUIRED_STATE.length; k += 1) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, PLAYER_REQUIRED_STATE[k])) return false
  }
  return true
}

/**
 * Rebuild the page so the new bundle gets an engine of its own. An engine already on
 * `window` was made by an earlier evaluation of this module, with its own stores: the new
 * UI's `prefsStore` would never hear the old engine's writes, so controls would sit still
 * while the sound changed. Guarded by the build id, so a reload that did not help cannot loop.
 */
function reloadForPlayerApi(reason) {
  try {
    if (typeof window === 'undefined' || !window.location || typeof window.location.reload !== 'function') return
    var wanted = currentClientBuild() + '|' + PLAYER_REQUIRED_API.concat(PLAYER_REQUIRED_STATE).join(',')
    var storage = null
    try { storage = window.sessionStorage } catch (error) { storage = null }
    if (storage !== null && storage.getItem('music.playerReload') === wanted) return
    if (storage !== null) storage.setItem('music.playerReload', wanted)
    console.warn('[music] a new client bundle met the engine of an older one (' + reason + '); reloading once')
    window.location.reload()
  } catch (error) {
    // No reload available: keep the old engine rather than run two.
  }
}

/**
 * Playback engine, one per page.
 *
 * The <audio> element is owned by the `shell.overlay` seat (a resident
 * floating layer) and handed in through `attachAudio`. That keeps the
 * element inside the document — browsers treat detached media elements
 * differently for background playback, system media keys and autoplay —
 * while this engine stays the single source of playback state.
 */
function createPlayer() {
  if (typeof window !== 'undefined' && window[PLAYER_KEY]) {
    // Reaching here means this module was evaluated a second time in the same page (a plugin
    // hot swap): the engine on window belongs to the first evaluation, with that evaluation's
    // prefs store. The two must not be paired — see reloadForPlayerApi.
    reloadForPlayerApi(playerApiComplete(window[PLAYER_KEY]) ? 'module evaluated again' : 'engine api missing')
    return window[PLAYER_KEY]
  }
  var prefs = readPrefs()
  /** Folia's SET_RAMP_SEC: how a gain set before a song sounds is put in. */
  var GAIN_SET_RAMP_SEC = 0.1
  var audio = null
  /** Folia graph/transport boundary; one per player instance. */
  var foliaGraph = null
  var foliaTransport = null
  /**
   * Second element used only for the incoming side of a crossfade. The active
   * deck is always the one in `audio`; the two swap roles when a fade lands, so
   * everything below keeps talking about "the current element".
   */
  var audioB = null
  var fadeNode = null
  var fadeNodeB = null
  /** The active deck's Folia `replayGain` node — where every mode's gain is written. */
  var replayGainNode = null
  var replayGainNodeB = null
  var objectUrlB = null
  /** Crossfade controller: token cancels stale fetches, timer lands the swap. */
  var xfadeToken = 0
  var xfadeActive = false
  var xfadePending = false
  var xfadeAdopted = false
  var xfadeTimer = null
  var xfadeNext = -1
  /** Blob of the track on the active deck, kept for the tail analysis. */
  var currentBlob = null
  /** Measured plan + fetched audio for the incoming side. */
  var xfadePrepared = null
  /** The track leaving on the ghost deck, kept until the fade lands (cache report, balance reading). */
  var xfadeOutgoing = null
  var xfadeOutgoingMeter = null
  /** Background download of the next track, so an uncached online song is ready. */
  var prefetchedNext = null
  var prefetchAbort = null
  var prefetchToken = 0
  /** Web Audio graph used by the bar visualizer (lazy, user-gesture bound). */
  var audioContext = null
  var analyser = null
  var gainNode = null
  /** `[{ band, node }]` — bands above Nyquist are skipped, so keep the mapping. */
  var eqNodes = []
  /** Resolved EQ settings; persisted through prefs on every change. */
  var eq = normalizeEqPrefs(prefs)
  var waveData = null
  /**
   * What the chosen 音频增益 mode applied to the active deck, in dB (Folia's
   * `replayGainAppliedDb`). One value, one node: the mode is the only authority on gain.
   */
  var appliedGainDb = 0
  var appliedGainEstimated = false
  var appliedGainAvailable = false
  /**
   * A song's ReplayGain figures, by track path — Folia's `song.replayGain`. They are not the
   * current track's alone: a local file's tags, a Navidrome song's own gain or a streaming
   * platform's own gain (from the stream's headers) all land here, and the panel, the tag
   * modes and the balance read the one record.
   */
  var gainRecords = {}
  var GAIN_RECORD_LIMIT = 200
  var replayGainToken = 0
  /** The mode the engine last applied, to notice a change from any UI (Folia's store select). */
  var gainModeSeen = ''
  /** Last shuffle-round signature tracked, and the round just reshuffled (Folia's guard). */
  var shuffleRoundTracked = ''
  var shuffleReshuffledGuard = ''
  var loudnessToken = 0
  /** Resolves when the current track's gain is ready (or analysis gave up). */
  var loudnessGate = null
  /** Active `blob:` URL for the loaded track (local media seeks reliably). */
  var objectUrl = null
  /** Live meter tapped ahead of the balance gain (see 49-balance-meter.js). */
  var balanceMeter = null
  /** What the balance asked for this play (null until it set one), and whether it already moved once. */
  var balanceMoved = false
  var balanceAppliedDb = null

var prefetchedProfilePath = ''
var profileToken = 0
var onlineMse = null
/** One direct-element retry per load when MSE cannot decode the stream (Folia plays direct). */
var mseFallbackToken = -1
  var currentLoudnessBlob = null
  /** In-flight track download. */
  var fetchAbort = null
  /** Bumped per load so a stale download cannot overwrite a newer track. */
  var loadToken = 0
  var pendingAutoplay = false
  var listeners = []
  var timeListeners = []
  var errorListeners = []
  var errorStreak = 0
  var lastPositionSync = 0
  var duckFactor = 1
  var duckRampSeconds = 0.3
  // The slider saves every change through savePrefs; a new engine must start from
  // that value, or a restart resets the visible and audible level to 1.
  var savedVolume = Number(prefs.volume)
  if (!isFinite(savedVolume)) savedVolume = 1
  var state = {
    queue: [],
    index: -1,
    playing: false,
    loop: prefs.loop === 'one' ? 'one' : 'none',
    order: prefs.order === 'random' && prefs.loop !== 'one' ? 'random' : 'list',
    volume: clamp(savedVolume, 0, 1),
    muted: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    /** Folia's replayGainAppliedDb / replayGainEstimated, and whether the mode had data to apply. */
    gainAppliedDb: 0,
    gainEstimated: false,
    gainAvailable: false,
    /** The current song's own figures (Folia's `currentSong.replayGain`), for the panel's readout. */
    gainTags: null,
  }

  // ── resume + listening statistics ───────────────────────────────────
  // Counting follows the Last.fm / MusicBee rule (half the track or four
  // minutes, whichever comes first); resume follows the NetEase / Spotify
  // pattern (restore the queue and position, then stay paused). The clock
  // only counts time that naturally advanced while playing, so dragging
  // the seek bar never inflates the statistics.
  var session = { path: '', seconds: 0, pending: 0, lastTime: 0, counted: false }
  var lastStateSave = 0
  var restoreAttempted = false
  var pendingResumeSeconds = null
  /** Only the tab holding the player lock may produce sound / write stats. */
  var leader = true
  var leaderTimer = null
  var tabId = 'music-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
  var LEADER_KEY = 'dsh-music-panel.player.leader'

  function resetSession(item) {
    session = {
      path: item ? item.path : '',
      seconds: 0,
      pending: 0,
      lastTime: 0,
      counted: false,
      reported: false,
      preview: false,
    }
  }

  /**
   * Send the one listening report a track earned, if its platform takes them.
   * The Host still checks the capability; this client-side check only avoids a
   * request for local tracks and platforms without reports.
   */
  function reportProviderPlayback(item) {
    if (item === null || item === undefined || session.reported === true) return
    if (session.preview === true) return
    if (session.seconds < 30) return
    if (readPrefs().playbackReports !== true) return
    var provider = String(item.onlineProvider || '')
    if (provider === '' || typeof supports !== 'function' || !supports(provider, 'playbackReports')) return
    session.reported = true
    try {
      postJson(API + 'online/report-playback', {
        provider: provider,
        id: String(item.onlineId || ''),
        title: trackTitleOf(item),
        artist: trackArtistOf(item),
        playedSeconds: Math.round(session.seconds),
        totalSeconds: Math.round(durationOf(item)),
        quality: String(readPrefs().onlineQuality || 'high'),
      }).catch(function () {
        // Reporting is a background courtesy; a failure never touches playback.
      })
    } catch (error) {
      // Best effort.
    }
  }

  /**
   * Folia caches an online song only once it was heard to its end: the Host downloads it
   * then. This says which song, at which quality, and with which stated length/cover — the
   * decision (preview / half song / limit) belongs to the Host.
   */
  function reportPlayed(item) {
    if (item === null || item === undefined) return
    if (!item.onlineProvider || !item.onlineId) return
    var settings = readPrefs()
    if (settings.onlineCacheEnabled !== true) return
    var limitGb = Number(settings.onlineCacheLimitGb)
    try {
      postJson(API + 'online/played', {
        provider: String(item.onlineProvider),
        id: String(item.onlineId),
        quality: String(settings.onlineQuality || 'high'),
        limitGb: isFinite(limitGb) && limitGb >= 0 ? limitGb : 5,
        durationSec: Number(item.durationSec) || 0,
        coverUrl: typeof item.coverUrl === 'string' ? item.coverUrl : '',
      }).catch(function () {
        // Caching is a background courtesy; a failure never touches playback.
      })
    } catch (error) {
      // Best effort.
    }
  }

  /**
   * Folia's light prefetch window (the next two songs and the previous one): a queue move
   * should start with its lyric already local. Lyrics only — the Host resolves stream URLs
   * per play, so there is nothing to prefetch for the audio.
   */
  function prefetchLyricsAround() {
    if (typeof MPLyricLoader === 'undefined' || MPLyricLoader === null) return
    if (typeof MPLyricLoader.prefetch !== 'function') return
    if (state.index < 0 || state.queue.length === 0) return
    var around = []
    for (var offset = -1; offset <= 2; offset += 1) {
      var at = state.index + offset
      if (at < 0 || at >= state.queue.length) continue
      var item = state.queue[at]
      if (item && item.onlineProvider) around.push(item)
    }
    if (around.length > 0) MPLyricLoader.prefetch(around)
  }

  /** The cached copy failed to play: the Host bypasses it until a new one is written. */
  function reportCacheDistrust(item) {    if (item === null || item === undefined) return
    if (!item.onlineProvider || !item.onlineId) return
    try {
      postJson(API + 'online/cache/distrust', {
        provider: String(item.onlineProvider),
        id: String(item.onlineId),
      }).catch(function () {})
    } catch (error) {
      // Best effort.
    }
  }

  function durationOf(item) {
    if (audio !== null && isFinite(audio.duration) && audio.duration > 0) return audio.duration
    return item && item.durationSec > 0 ? item.durationSec : 0
  }

  function recordStatsPlay(item) {
    try {
      postJson(API + 'play', { path: item.path }).catch(function () {})
    } catch (error) {
      // Statistics never block playback.
    }
  }

  /** Flush the seconds that have not been reported yet (>= 30s only). */
  function flushListening(force) {
    if (session.preview === true) return
    if (session.path === '' || session.pending <= 0) return
    if (session.seconds < 30) {
      if (force) session.pending = 0
      return
    }
    var seconds = session.pending
    session.pending = 0
    try {
      postJson(API + 'playback', { path: session.path, seconds: seconds }).catch(function () {})
    } catch (error) {
      // Best effort.
    }
  }

  function flushSessionPosition() {
    if (session.path === '' || readPrefs().rememberPerTrack !== true) return
    var item = currentItem()
    if (item === null || item.path !== session.path) return
    var seconds = state.currentTime
    if (!(seconds > 0)) return
    try {
      postJson(API + 'position', { path: session.path, seconds: seconds }).catch(function () {})
    } catch (error) {
      // Best effort.
    }
  }

  function playbackTrackSnapshot(track) {
    return {
      path: track.path,
      title: trackTitleOf(track),
      artist: trackArtistOf(track),
      album: track.album || '',
      albumId: track.albumId || '',
      durationSec: Number(track.durationSec) || 0,
      coverUrl: track.coverUrl || '',
      hasCover: track.hasCover === true,
      // Self-hosted artwork is addressed by id; persisting it keeps the
      // restored queue's covers intact.
      coverArtId: track.coverArtId || '',
      onlineProvider: track.onlineProvider || '',
      onlineId: track.onlineId || '',
      qualityHint: track.qualityHint || '',
      // The artist page opens on catalog ids; a restored queue must keep them too.
      artistsDetail: Array.isArray(track.artistsDetail) ? track.artistsDetail : [],
    }
  }

  function savePlaybackState() {
    if (!leader) return
    var item = currentItem()
    if (item === null) return
    var duration = state.duration > 0 ? state.duration : item.durationSec || 0
    // Keep the saved queue bounded (playback.json caps at 500): store a
    // window around the current track so restore never picks the wrong one.
    var queueItems = state.queue.map(playbackTrackSnapshot)
    var index = state.index
    if (queueItems.length > 500) {
      var start = Math.max(0, Math.min(index - 250, queueItems.length - 500))
      queueItems = queueItems.slice(start, start + 500)
      index -= start
    }
    try {
      postJson(API + 'state', {
        queue: queueItems,
        index: index,
        positionSec: state.currentTime,
        durationSec: duration,
        loop: state.loop,
        order: state.order,
      }).catch(function () {})
    } catch (error) {
      // Best effort.
    }
  }

  function trackListening() {
    if (audio === null) return
    var item = currentItem()
    if (item === null) return
    if (session.path !== item.path) resetSession(item)

    var current = audio.currentTime
    var expected = Number(item.durationSec) || 0
    if (
      session.preview !== true &&
      item.onlineProvider &&
      expected > 0 &&
      isFinite(audio.duration) &&
      audio.duration > 0 &&
      audio.duration < expected * 0.5
    ) {
      session.preview = true
      showToast(t('online.previewOnly'))
    }
    if (state.playing && !audio.paused) {
      var delta = current - session.lastTime
      // A seek produces a large or negative jump; only natural playback
      // advances count toward listening time.
      if (delta > 0 && delta <= 3) {
        session.seconds += delta
        session.pending += delta
      }
    }
    session.lastTime = current

    var duration = durationOf(item)
    var threshold = playThresholdOf(duration)
    if (!session.preview && !session.counted && duration > 30 && session.seconds >= threshold) {
      session.counted = true
      recordStatsPlay(item)
    }

    if (!session.preview && session.seconds >= 30 && session.pending >= 10) flushListening(false)

    var now = Date.now()
    if (now - lastStateSave >= 5000) {
      lastStateSave = now
      savePlaybackState()
    }
  }

  function trackFromSaved(entry, byPath) {
    if (typeof entry === 'string') return byPath[entry] || null
    if (entry === null || typeof entry !== 'object') return null
    if (entry.onlineProvider && entry.onlineId) {
      return {
        path: entry.path || 'online:' + entry.onlineProvider + ':' + entry.onlineId,
        title: entry.title || '',
        artist: entry.artist || '',
        album: entry.album || '',
        albumId: entry.albumId || '',
        durationSec: Number(entry.durationSec) || 0,
        hasCover: entry.hasCover === true,
        coverUrl: entry.coverUrl || '',
        coverArtId: entry.coverArtId || '',
        onlineUrl: onlineStreamUrl(entry.onlineProvider, entry.onlineId),
        onlineProvider: entry.onlineProvider,
        onlineId: entry.onlineId,
        qualityHint: entry.qualityHint || '',
        artistsDetail: Array.isArray(entry.artistsDetail) ? entry.artistsDetail : [],
        sampleRate: 0,
        size: 0,
        mtime: 0,
      }
    }
    return byPath[entry.path] || null
  }

  function restorePlayback(saved, tracks) {
    if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return false
    var byPath = {}
    ;(Array.isArray(tracks) ? tracks : []).forEach(function (track) {
      byPath[track.path] = track
    })
    var queue = []
    saved.queue.forEach(function (entry) {
      var track = trackFromSaved(entry, byPath)
      if (track !== null && typeof track.path === 'string' && track.path !== '') queue.push(track)
    })
    if (queue.length === 0) return false
    var wanted = saved.queue[saved.index]
    var wantedPath = typeof wanted === 'string' ? wanted : wanted && wanted.path ? wanted.path : ''
    var index = 0
    for (var i = 0; i < queue.length; i += 1) {
      if (wantedPath !== '' && queue[i].path === wantedPath) {
        index = i
        break
      }
    }
    state = Object.assign({}, state, {
      queue: queue,
      index: index,
      loop: saved.loop === 'one' ? 'one' : saved.order === 'random' ? 'all' : 'none',
      order: saved.order === 'random' && saved.loop !== 'one' ? 'random' : 'list',
      currentTime: saved.positionSec > 0 ? saved.positionSec : 0,
      duration: saved.durationSec > 0 ? saved.durationSec : 0,
      playing: false,
    })
    emit()
    syncMediaSession()
    resetSession(queue[index])
    pendingResumeSeconds = saved.positionSec > 0 ? saved.positionSec : null
    // Paused by default (NetEase/Spotify behaviour); the setting can ask
    // for playback to start right after restore.
    load(index, readPrefs().autoResume === true)
    return true
  }

  function tryRestore() {
    if (restoreAttempted) return
    restoreAttempted = true
    if (readPrefs().resumeOnStart !== true) return
    Promise.all([getJson(API + 'state'), getJson(API + 'library')])
      .then(function (results) {
        var saved = results[0] !== null && results[0].state !== undefined ? results[0].state : null
        var tracks = results[1] !== null && Array.isArray(results[1].tracks) ? results[1].tracks : []
        restorePlayback(saved, tracks)
      })
      .catch(function () {
        // Resume is best effort.
      })
  }

  function flushOnHide() {
    flushListening(true)
    flushSessionPosition()
    savePlaybackState()
  }

  function emit() {
    listeners.forEach(function (fn) {
      fn()
    })
    timeListeners.forEach(function (fn) {
      fn()
    })
  }

  function emitTime() {
    timeListeners.forEach(function (fn) {
      fn()
    })
  }

  // ── screen wake lock (Folia's 播放时阻止休眠) ─────────────────────────
  // The browser hands out a screen lock only while a page is visible; the sentinel is
  // released by the browser on hide, so a visibility change re-asks for it.
  var wakeLock = null
  var wakeLockWanted = false
  function wakeLockSupported() {
    return typeof navigator !== 'undefined'
      && navigator.wakeLock !== null
      && typeof navigator.wakeLock === 'object'
      && typeof navigator.wakeLock.request === 'function'
  }
  function releaseWakeLock() {
    wakeLockWanted = false
    if (wakeLock === null) return
    var sentinel = wakeLock
    wakeLock = null
    try {
      Promise.resolve(sentinel.release()).catch(function () {})
    } catch (error) {
      // Already released.
    }
  }
  function syncWakeLock(playing) {
    var wanted = readPrefs().preventSleepDuringPlayback === true && playing === true
    if (wanted === wakeLockWanted) return
    wakeLockWanted = wanted
    if (!wanted) {
      releaseWakeLock()
      return
    }
    if (!wakeLockSupported()) return
    try {
      navigator.wakeLock.request('screen').then(function (sentinel) {
        if (!wakeLockWanted) {
          Promise.resolve(sentinel.release()).catch(function () {})
          return
        }
        wakeLock = sentinel
        if (sentinel && typeof sentinel.addEventListener === 'function') {
          sentinel.addEventListener('release', function () {
            if (wakeLock === sentinel) wakeLock = null
          })
        }
      }).catch(function () {})
    } catch (error) {
      // A denied lock never blocks playback.
    }
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return
      if (!wakeLockWanted || wakeLock !== null) return
      wakeLockWanted = false
      syncWakeLock(state.playing === true)
    })
  }

  function patch(next) {
    var wasPlaying = state.playing
    state = Object.assign({}, state, next)
    if (state.playing !== wasPlaying) syncWakeLock(state.playing === true)
    emit()
  }

  function currentItem() {
    return state.index >= 0 && state.queue[state.index] ? state.queue[state.index] : null
  }

  // ── media session (system media keys, lock screen, OS media panel) ──

  function syncMediaPosition(force) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    var session = navigator.mediaSession
    if (typeof session.setPositionState !== 'function') return
    var now = Date.now()
    if (force !== true && now - lastPositionSync < 1000) return
    lastPositionSync = now
    try {
      var duration = Number(state.duration)
      var position = Number(state.currentTime)
      if (duration > 0 && isFinite(position)) {
        session.setPositionState({
          duration: duration,
          position: clamp(position, 0, duration),
          playbackRate: 1,
        })
      } else {
        session.setPositionState()
      }
    } catch (error) {
      // Media Session is best effort.
    }
  }

  function syncMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    var item = currentItem()
    try {
      if (item === null) {
        navigator.mediaSession.metadata = null
      } else if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.title,
          artist: item.artist || '',
          album: item.album || '',
          artwork: item.hasCover
            ? [{ src: new URL(coverUrl(item.path), window.location.href).href, sizes: '512x512' }]
            : [],
        })
      }
      if (typeof navigator.mediaSession.setPlaybackState === 'function') {
        navigator.mediaSession.setPlaybackState(state.playing ? 'playing' : 'paused')
      }
    } catch (error) {
      // Media Session is best effort.
    }
    syncMediaPosition(true)
  }

  function syncMediaHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.setActionHandler('play', function () {
        api.play()
      })
      navigator.mediaSession.setActionHandler('pause', function () {
        api.pause()
      })
      navigator.mediaSession.setActionHandler('previoustrack', function () {
        api.prev()
      })
      navigator.mediaSession.setActionHandler('nexttrack', function () {
        api.next()
      })
      navigator.mediaSession.setActionHandler('seekto', function (details) {
        if (details && typeof details.seekTime === 'number') api.seek(details.seekTime)
      })
    } catch (error) {
      // Older browsers expose a partial action list.
    }
  }

  // ── audio element wiring ───────────────────────────────────────────

  /**
   * Events from the spare deck must not touch state. Handlers receive the
   * Event when registered and a plain reason string when called internally.
   */
  function isActiveEvent(event) {
    return event === null || event === undefined || !event.target || event.target === audio
  }

  function stopOnlineMse() {
    if (onlineMse === null) return
    var session = onlineMse
    onlineMse = null
    session.stopped = true
    try { if (session.controller !== null) session.controller.abort() } catch (error) {}
    try { if (session.reader !== null) session.reader.cancel().catch(function () {}) } catch (error) {}
    if (session.url !== '') {
      try { URL.revokeObjectURL(session.url) } catch (error) {}
    }
  }

  function readReplayGainHeaders(headers) {
    if (!headers || typeof headers.get !== 'function') return null
    var fields = {
      trackGain: headers.get('x-music-track-gain'),
      albumGain: headers.get('x-music-album-gain'),
      trackPeak: headers.get('x-music-track-peak'),
      albumPeak: headers.get('x-music-album-peak'),
    }
    var out = {}
    Object.keys(fields).forEach(function (key) {
      if (fields[key] === null || fields[key] === '') return
      var value = Number(fields[key])
      if (Number.isFinite(value)) out[key] = value
    })
    return Object.keys(out).length > 0 ? out : null
  }

  /**
   * Folia's BalanceInputs, in its own order: what is known of the song (`file`, `played`,
   * `profile`), then its tag or the platform's gain, then the stand-ins.
   */
  function balanceInputs(item, extra) {
    var kind = playbackSourceKind(item)
    var info = gainRecordFor(item)
    var record = item === null || item === undefined ? null : balanceRecordFor(item.path)
    var prof = item === null || item === undefined ? null : profileFor(item.path)
    return {
      file: record && record.file ? record.file : null,
      played: record && record.played ? record.played : null,
      profile: prof && !prof.partial
        ? { loudness: prof.programLoudness, peak: prof.peak }
        : null,
      tag: kind !== 'online' && info && typeof info.trackGain === 'number'
        ? { gainDb: info.trackGain, peak: typeof info.trackPeak === 'number' ? info.trackPeak : null }
        : null,
      head: prof && prof.partial ? prof.programLoudness : null,
      live: extra && typeof extra.live === 'number' ? extra.live : null,
      platformDb: kind === 'online' && info && typeof info.trackGain === 'number' ? info.trackGain : null,
      typicalDb: typicalGainDb(balanceTypicalGains()),
    }
  }

  function applyBalancePlan(choice, plan, rampSec) {
    if (!choice) return
    if (plan === 'set') {
      applyBalanceChoice(choice, rampSec === undefined ? GAIN_SET_RAMP_SEC : rampSec)
      return
    }
    if (plan === 'hold' || plan === null || plan === undefined) return
    if (typeof plan === 'object' && typeof plan.rampSec === 'number') {
      balanceMoved = true
      applyBalanceChoice(choice, plan.rampSec)
    }
  }

  /**
   * 智能平衡 re-decides the song: before it sounds a better reading sets it, during a play
   * the rules allow one move, and never while a blend can be heard. The other modes never
   * reach here (Folia runs these rules only for `replayGainMode === 'auto'`).
   */
  function reconsiderBalance(live, rampSec) {
    if (!balancing()) return
    var choice = chooseBalance(balanceInputs(currentItem(), { live: live }))
    if (balanceAppliedDb === null) {
      applyBalanceChoice(choice, rampSec === undefined ? GAIN_SET_RAMP_SEC : rampSec)
      return
    }
    var plan = planBalanceMove({
      playSec: audio === null ? 0 : audio.currentTime,
      moved: balanceMoved,
      currentDb: balanceAppliedDb,
      nextDb: choice.effectiveGainDb,
      blendAudible: crossfadeActive(),
    })
    applyBalancePlan(choice, plan, rampSec)
  }

  function onTime(event) {
    if (balanceMeter !== null && balancing()) {
      reconsiderBalance(balanceMeter.liveLoudness())
    }
    if (!isActiveEvent(event)) return
    if (audio === null) return
    state = Object.assign({}, state, { currentTime: audio.currentTime })
    emitTime()
    trackListening()
    maybeCrossfade()
  }

  function onPlaying(event) {
    if (!isActiveEvent(event)) return
    errorStreak = 0
    // `play` only asks the element to start; `playing` means media is actually
    // advancing. The pause icon must not appear while a seek is still buffering.
    if (!state.playing) {
      patch({ playing: true })
      syncMediaSession()
    }
  }

  function onPlay(event) {
    if (!isActiveEvent(event)) return
    // Warm the next online track while this one plays (crossfade only).
    maybePrefetchNext()
  }

  function onPause(event) {
    if (!isActiveEvent(event)) return
    reportProviderPlayback(currentItem())
    flushListening(true)
    flushSessionPosition()
    savePlaybackState()
    if (state.playing) {
      patch({ playing: false })
      syncMediaSession()
    }
  }

  function onEnded(event) {
    // The song was heard whole: keep its reading for the next play. Only 智能平衡 measures.
    if (balancing()) commitBalanceReading(currentItem(), audio === null ? 0 : audio.duration)
    if (!isActiveEvent(event)) return
    // Folia's cache rule: the song was heard whole, so the Host may keep it.
    reportPlayed(currentItem())
    reportProviderPlayback(currentItem())
    flushListening(true)
    flushSessionPosition()
    if (state.queue.length === 0) return
    if (state.loop === 'one') {
      reportProviderPlayback(currentItem())
      resetSession(currentItem())
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(function () {})
      }
      return
    }
    if (state.loop === 'none' && state.index >= state.queue.length - 1) {
      patch({ playing: false })
      return
    }
    load(nextIndexOf(state.index, state.queue.length), true)
  }

  function onError(eventOrReason) {
    if (
      eventOrReason !== null &&
      typeof eventOrReason === 'object' &&
      eventOrReason.target &&
      eventOrReason.target !== audio
    ) {
      return
    }
    var reason =
      typeof eventOrReason === 'string'
        ? eventOrReason
        : eventOrReason && typeof eventOrReason.message === 'string'
          ? eventOrReason.message
          : ''
    // Chromium's pipeline text is a kernel detail: keep it in the log and say the rest in words.
    if (isBrowserMediaFailureText(reason)) {
      console.warn('[Player] Media pipeline failure:', reason)
      reason = ''
    }
    var failedTrack = state.queue[state.index] || null
    // Folia never decodes an online song through MediaSource: it hands the address to the
    // media element, which sniffs the container itself. Keep that as the safety net when an
    // MSE append/decoder rejects a stream whose declared type was wrong (issue #28).
    if (
      failedTrack !== null && failedTrack.onlineProvider &&
      onlineMse !== null &&
      mseFallbackToken !== loadToken
    ) {
      mseFallbackToken = loadToken
      var fallbackPlaying = state.playing === true
      console.warn('[Player] MSE could not decode the stream; playing it directly like Folia')
      stopOnlineMse()
      pendingAutoplay = fallbackPlaying
      startOnlineDirect(failedTrack, loadToken, { promise: Promise.resolve(), resolve: function () {} }, null)
      return
    }
    errorStreak += 1
    // An online track that could not be played says so: the queue stops on it, so the
    // "skipped to the next track" wording would be wrong there.
    if (reason === '' && failedTrack !== null && failedTrack.onlineProvider) reason = t('page.playbackFailedMedia')
    reportCacheDistrust(failedTrack)
    errorListeners.forEach(function (fn) {
      try {
        fn({ track: failedTrack, streak: errorStreak, reason: reason || '' })
      } catch {
        /* a listener must never break playback */
      }
    })
    // An online track that cannot be fetched (expired sign-in, rights restriction, provider
    // refusal) must not spin the queue: stop on it and let the toast name the reason.
    if (failedTrack !== null && failedTrack.onlineProvider) {
      // Folia's autoSkipUnplayable: a track the account cannot play is skipped like a
      // taken-down one instead of parking the queue on it. A run of failures stops.
      if (readPrefs().autoSkipUnplayable === true && state.queue.length > 1 && errorStreak <= 3) {
        load(nextIndexOf(state.index, state.queue.length), true)
        return
      }
      errorStreak = 0
      patch({ playing: false })
      return
    }
    if (errorStreak > 3 || state.queue.length <= 1) {
      errorStreak = 0
      patch({ playing: false })
      return
    }
    load(nextIndexOf(state.index, state.queue.length), true)
  }

  function releaseObjectUrl() {
    if (objectUrl === null) return
    try {
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      // Revoking twice is harmless.
    }
    objectUrl = null
  }

  function cancelPendingFetch() {
    if (fetchAbort === null) return
    try {
      fetchAbort.abort()
    } catch (error) {
      // Already settled.
    }
    fetchAbort = null
  }

  /**
   * Load one track through a local Blob URL.
   *
   * Playing from `blob:` is deliberate: on the Desktop (Electron) media
   * stack, writes to `currentTime` on this plugin's HTTP stream are
   * silently dropped while readyState is already 4, so seeking restarted
   * the track. A Blob is local media and seeks reliably. The download is a
   * loopback request, so it costs one disk read, not a network hop.
   */
  /** Element volume when no Web Audio graph exists to hold the deck's own gain. */
  function effectiveVolume() {
    if (gainNode !== null) return 1
    var trim = Math.min(1, gainDbToLinear(appliedGainDb))
    return clamp(state.volume * trim * duckFactor, 0, 1)
  }

  function applyOutputVolume(fadeSeconds) {
    var fade = fadeSeconds === undefined ? 0.015 : Math.max(0, Number(fadeSeconds) || 0)
    var target = clamp(state.volume * duckFactor, 0, 1)
    if (gainNode !== null && foliaGraph !== null) {
      foliaGraph.setVolume(target, fade)
      foliaGraph.setMuted(state.muted, fade)
      if (audio) audio.volume = 1
      if (audioB) audioB.volume = 1
      return
    }
    if (audio) audio.volume = effectiveVolume()
    if (audioB) audioB.volume = effectiveVolume()
  }

  function gainDbToLinear(db) {
    var value = Number(db)
    return Number.isFinite(value) ? Math.pow(10, value / 20) : 1
  }

  /** Push a linear gain into one deck's ReplayGain node (Folia's `rampGain`). */
  function applyTrimGain(node, linear, paused, rampSec) {
    if (node === null || audioContext === null) return
    try {
      var now = audioContext.currentTime
      var ramp = Number(rampSec)
      if (typeof node.gain.cancelAndHoldAtTime === 'function') node.gain.cancelAndHoldAtTime(now)
      else node.gain.cancelScheduledValues(now)
      if (paused || !isFinite(ramp) || ramp <= 0) {
        node.gain.setValueAtTime(linear, now)
        return
      }
      node.gain.setValueAtTime(node.gain.value, now)
      node.gain.linearRampToValueAtTime(linear, now + ramp)
    } catch (error) {
      node.gain.value = linear
    }
  }

  /**
   * Write the song's gain where Folia writes it: the active deck's own `replayGain` node.
   * Every mode ends here, so exactly one of them is in effect, and the song fading out
   * keeps its own gain on its own deck.
   */
  function writeDeckGain(db, rampSec) {
    var next = Number(db)
    appliedGainDb = Number.isFinite(next) ? next : 0
    if (replayGainNode !== null && audioContext !== null) {
      applyTrimGain(replayGainNode, gainDbToLinear(appliedGainDb), audio === null || audio.paused === true, rampSec)
    } else {
      applyOutputVolume()
    }
    patch({ gainAppliedDb: appliedGainDb, gainEstimated: appliedGainEstimated === true, gainAvailable: appliedGainAvailable === true })
  }

  /**
   * Routing a cross-origin media element through Web Audio silences it: the
   * browser has no CORS grant, so the graph only outputs zeros. The plugin
   * normally plays blobs (same-origin), but the stream fallback assigns a
   * remote URL, and one media element can only enter Web Audio once.
   */
  function canRouteThroughWebAudio(el) {
    var source = ''
    try {
      source = String(el.currentSrc || el.src || '')
    } catch (error) {
      source = ''
    }
    if (source === '') return true
    if (source.indexOf('blob:') === 0 || source.indexOf('data:') === 0) return true
    try {
      return new URL(source, window.location.href).origin === window.location.origin
    } catch (error) {
      return false
    }
  }

  /**
   * Push the current EQ settings into Folia's graph. The old preamp/headroom
   * path is gone: Folia owns the ten filters and the effect chain.
   */
  function applyEq(immediate) {
    if (foliaGraph === null) return
    foliaGraph.setEq({
      enabled: eq.enabled,
      gains: eq.bands,
      preset: 'custom1',
      effects: eq.effects,
    })
  }

  /** Web Audio is the whole mechanism; without it the panel must say so. */
  function eqSupported() {
    return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
  }

  function createLoudnessGate() {
    var resolveGate = null
    var promise = new Promise(function (resolve) {
      resolveGate = resolve
    })
    loudnessGate = promise
    return {
      promise: promise,
      resolve: function () {
        if (resolveGate !== null) {
          var finish = resolveGate
          resolveGate = null
          finish()
        }
      },
    }
  }

  /**
   * Folia's lyric gate: audio starts once the song's first lyric is resolved (the
   * optional word-by-word upgrade is not part of it). Always resolves, and is a no-op
   * when the loader is absent (tests, or a client built without the lyric surface).
   */
  function whenLyricReady(item) {
    var loader = typeof MPLyricLoader === 'undefined' ? null : MPLyricLoader
    if (loader === null || typeof loader !== 'object' || typeof loader.whenReady !== 'function') {
      return Promise.resolve(null)
    }
    try {
      return loader.whenReady(item).catch(function () {
        return null
      })
    } catch (error) {
      return Promise.resolve(null)
    }
  }

  function playAfterLoudness(token) {
    var gate = loudnessGate === null ? Promise.resolve() : loudnessGate
    // Both waits run at once: the lyric request is in flight while the loudness analysis
    // measures, instead of the song starting after one wait and then the other.
    var lyrics = whenLyricReady(currentItem())
    gate
      .then(function () {
        if (token !== loadToken || pendingAutoplay !== true || audio === null) return null
        return lyrics
      })
      .then(function () {
        if (token !== loadToken || pendingAutoplay !== true || audio === null) return
        pendingAutoplay = false
        var context = api.ensureAnalyser()
        if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
          audioContext.resume().catch(function () {
            // If the context cannot start, leave the media element untouched.
          })
        }
        if (foliaTransport !== null) {
          foliaTransport.play(foliaTransport.getActiveDeck()).catch(function () {
            // Autoplay may still be blocked; the play event will update the UI.
          })
        } else {
          audio.play().catch(function () {
            // Autoplay may still be blocked; the play event will update the UI.
          })
        }
      })
  }

  /** Apply the balance's decision to the active deck (Folia's balancePlay.setGain). */
  function applyBalanceChoice(choice, rampSec) {
    if (!choice) return
    balanceAppliedDb = Number(choice.effectiveGainDb) || 0
    appliedGainEstimated = choice.estimated === true
    appliedGainAvailable = true
    writeDeckGain(balanceAppliedDb, rampSec)
  }

  /** A whole play becomes a reading for this song, and joins the typical gains (Folia's learnPlayedSong). */
  function commitBalanceReading(item, durationSec, meter) {
    var heardBy = meter === undefined || meter === null ? balanceMeter : meter
    if (heardBy === null) return
    var play = heardBy.play()
    if (typeof heardBy.reset === 'function') heardBy.reset()
    if (!item) return
    var prof = profileFor(item.path)
    if (balanceWholePlayIssue(play, durationSec, prof ? prof.leadIn : 0) !== null) return
    noteBalanceMeasurement(item.path, 'played', play)
  }

  /** Folia's profile look-ahead: measure the next local track while this one plays. */
  function prefetchNextProfile() {
    var token = profileToken
    var stillCurrent = function () { return token === profileToken }
    if (state.index < 0 || state.queue.length < 2) return
    var next = nextIndexOf(state.index, state.queue.length)
    if (next === state.index) return
    var item = state.queue[next]
    if (!item || typeof item.path !== 'string' || item.path === '') return
    if (prefetchedProfilePath === item.path || profileFor(item.path) !== null) return
    if (item.onlineProvider && item.onlineProvider !== 'navidrome') {
      // Folia analyses an online track only when its bytes are already in hand:
      // the crossfade prefetch, or the Host's played-through media cache.
      if (prefetchedNext !== null && prefetchedNext.path === item.path) {
        prefetchedProfilePath = item.path
        analyzeLoudnessBlob(
          item,
          prefetchedNext.blob,
          stillCurrent,
          function () { /* the store is the result */ },
        ).catch(function () { /* optional */ })
        return
      }
      getJson(API + 'online/cache-info?provider=' + encodeURIComponent(item.onlineProvider) + '&id=' + encodeURIComponent(item.onlineId || ''))
        .then(function (info) {
          if (!info || info.cached !== true) return null
          prefetchedProfilePath = item.path
          return fetch(streamUrl(item.path))
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status)
              return response.blob()
            })
            .then(function (blob) {
              return analyzeLoudnessBlob(
                item,
                blob,
                stillCurrent,
                function () { /* the store is the result */ },
              )
            })
        })
        .catch(function () { /* optional */ })
      return
    }
    prefetchedProfilePath = item.path
    var request = item.onlineProvider === 'navidrome'
      ? fetch(onlineUrlFor(item), { headers: { Range: 'bytes=0-1572863' } })
      : fetch(streamUrl(item.path))
    request
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.blob()
      })
      .then(function (blob) {
        if (item.onlineProvider === 'navidrome') return analyzePartialLoudnessBlob(item, blob, stillCurrent)
        return analyzeLoudnessBlob(
          item,
          blob,
          stillCurrent,
          function () { /* the store is the result */ },
        )
      })
      .catch(function () {
        // A profile is optional; playback never waits for it.
      })
  }

  function scheduleLoudness(item, blob, done) {
    var token = (loudnessToken += 1)
    currentLoudnessBlob = blob || null
    var finish = typeof done === 'function' ? done : function () {}
    if (!item || !blob) {
      finish()
      return
    }
    if (!balancing()) {
      // Folia's automix profile is independent of the balance: analyse the bytes,
      // but only 智能平衡 makes playback wait for the reading.
      analyzeLoudnessBlob(
        item,
        blob,
        function () { return token === loudnessToken },
        function () { /* the store is the result */ },
      ).catch(function () { /* optional */ }).then(function () { prefetchNextProfile() })
      finish()
      return
    }
    analyzeLoudnessBlob(
      item,
      blob,
      function () {
        return token === loudnessToken
      },
      function (measured) {
        if (token !== loudnessToken) return
        reconsiderBalance(null)
      },
    )
      .then(function (measured) {
        if (token === loudnessToken && (measured === null || measured === undefined)) {
          reconsiderBalance(null)
        }
      })
      .catch(function () {
        if (token === loudnessToken) reconsiderBalance(null)
      })
      .then(function () {
        finish()
        prefetchNextProfile()
      })
  }

  /** Point the active deck at a source through Folia's transport. */
  function loadActiveSource(url) {
    if (foliaTransport !== null) {
      return foliaTransport.load(foliaTransport.getActiveDeck(), url, { autoplay: false })
    }
    if (audio !== null) {
      audio.src = url
      audio.load()
    }
    return Promise.resolve(true)
  }

  function prepareOnlineElement() {
    if (audio === null) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    releaseObjectUrl()
    currentBlob = null
    audio.preload = 'auto'
  }

  function applyPlatformGain(headers) {
    var gain = readReplayGainHeaders(headers)
    if (gain === null) return false
    // The gain belongs to the song (Folia's `song.replayGain`), so it is kept where the panel
    // and the balance can read it too — not only on the audio graph.
    rememberGainRecord(currentItem(), gain)
    // Folia gives an online song the platform's own figures in the tag modes too, not only
    // to the balance, so the mode is re-decided rather than only re-balanced.
    applyModeGain(GAIN_SET_RAMP_SEC)
    return true
  }

  /** Gain is metadata: HEAD only when the stream response did not carry it. */
  function loadOnlineHeadGain(item, token) {
    fetch(onlineUrlFor(item), { method: 'HEAD' })
      .then(function (response) {
        if (!response.ok || token !== loadToken) return
        applyPlatformGain(response.headers)
      })
      .catch(function () { /* metadata only */ })
  }

  /** A cached copy can supply the full profile without delaying sound. */
  function loadCachedOnlineProfile(item, token) {
    getJson(API + 'online/cache-info?provider=' + encodeURIComponent(item.onlineProvider) + '&id=' + encodeURIComponent(item.onlineId || ''))
      .then(function (info) {
        if (!info || info.cached !== true || token !== loadToken) return null
        return fetch(streamUrl(item.path))
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.blob()
          })
          .then(function (blob) {
            return analyzeLoudnessBlob(
              item,
              blob,
              function () { return token === loadToken },
              function () { /* the store is the result */ },
            )
          })
      })
      .catch(function () { /* optional */ })
  }

  /**
   * The Host answers a refused stream with `{ ok:false, error:{ code, message } }`, and that
   * message is the only part that says WHY (a CDN node refusing this client, a region lock).
   * The media element cannot see an HTTP answer at all: given the same URL it reports the
   * kernel's demuxer text instead, so the reason has to be read here.
   */
  function onlineStreamFailure(response) {
    return response.json().catch(function () { return null }).then(function (body) {
      var message = body && body.error && typeof body.error.message === 'string' ? body.error.message.trim() : ''
      var failure = new Error(message === '' ? 'HTTP ' + response.status : message)
      failure.onlineStreamRefused = true
      return failure
    })
  }

  /** The direct-element fallback cannot use the MSE session's seek queue; wait for metadata. */
  function applyDirectSavedStart(item, token) {
    function seekTo(seconds) {
      if (token !== loadToken || audio === null) return
      try {
        audio.currentTime = seconds
      } catch (error) {
        return
      }
      if (pendingAutoplay && audio.paused) playAfterLoudness(token)
    }
    function whenReady(seconds) {
      if (audio === null) return
      if (audio.readyState >= 1) {
        seekTo(seconds)
        return
      }
      audio.addEventListener('loadedmetadata', function () { seekTo(seconds) }, { once: true })
    }
    if (pendingResumeSeconds !== null) {
      var savedSeconds = pendingResumeSeconds
      pendingResumeSeconds = null
      if (savedSeconds > 0) whenReady(savedSeconds)
      return
    }
    if (readPrefs().rememberPerTrack !== true || typeof item.path !== 'string' || item.path === '') return
    getJson(API + 'position?path=' + encodeURIComponent(item.path))
      .then(function (body) {
        if (token !== loadToken) return
        var seconds = Number(body.lastPositionSec)
        if (isFinite(seconds) && seconds > 1) whenReady(seconds)
      })
      .catch(function () {})
  }

  function startOnlineDirect(item, token, loudness, headers) {
    if (token !== loadToken) return
    stopOnlineMse()
    prepareOnlineElement()
    loadActiveSource(onlineUrlFor(item))
    applyDirectSavedStart(item, token)
    loudness.resolve()
    if (pendingAutoplay) playAfterLoudness(token)
    if (headers === undefined || !applyPlatformGain(headers)) loadOnlineHeadGain(item, token)
    loadCachedOnlineProfile(item, token)
  }

  /** Folia-like current song, but with MediaSource owning the seekable ranges. */
  function playOnlineMse(item, token, loudness) {
    var MediaSourceCtor = typeof window !== 'undefined' ? (window.MediaSource || window.webkitMediaSource) : null
    if (typeof MediaSourceCtor !== 'function') {
      startOnlineDirect(item, token, loudness)
      return
    }
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    fetchAbort = controller
    fetch(onlineUrlFor(item), controller === null ? {} : { signal: controller.signal })
      .then(function (response) {
        if (token !== loadToken) {
          if (response.body !== null) response.body.cancel().catch(function () {})
          loudness.resolve()
          return null
        }
        // A refused answer is the Host speaking about this request, not audio. Read what it
        // said; the catch below reports it instead of handing the answer to the media element.
        if (!response.ok) return onlineStreamFailure(response).then(function (failure) { throw failure })
        applyPlatformGain(response.headers)
        var mime = String(response.headers.get('content-type') || 'audio/mpeg').split(';')[0].trim().toLowerCase()
        var mseMime = mime === 'audio/mp4' || mime === 'audio/m4a' || mime === 'audio/x-m4a'
          ? 'audio/mp4; codecs="mp4a.40.2"'
          : mime
        if (!MediaSourceCtor.isTypeSupported(mseMime) || response.body === null) {
          // Unsupported codec: fall back to the direct element rather than buffering the file.
          if (response.body !== null) response.body.cancel().catch(function () {})
          startOnlineDirect(item, token, loudness, response.headers)
          return null
        }
        prepareOnlineElement()
        var mediaSource = new MediaSourceCtor()
        var objectUrl = URL.createObjectURL(mediaSource)
        var session = {
          controller: controller,
          reader: null,
          stopped: false,
          url: objectUrl,
          seek: function (target) {
            if (covers(target)) {
              pendingSeek = null
              try { audio.currentTime = target } catch (error) {}
              return
            }
            pendingSeek = target
            if (audio !== null && !audio.paused) {
              resumeAfterSeek = true
              audio.pause()
            }
            if (state.playing) {
              patch({ playing: false })
              syncMediaSession()
            }
          },
          seeking: function () { return pendingSeek !== null },
        }
        onlineMse = session
        var sourceBuffer = null
        var queue = []
        var appending = false
        var done = false
        var ended = false
        var started = false
        var pendingSeek = null
        var resumeAfterSeek = false
        var failed = false
        function fallbackToDirect() {
          if (failed || session.stopped) return
          failed = true
          startOnlineDirect(item, token, loudness, response.headers)
        }
        function covers(target) {
          if (sourceBuffer === null || sourceBuffer.buffered.length === 0) return false
          for (var index = 0; index < sourceBuffer.buffered.length; index += 1) {
            if (target >= sourceBuffer.buffered.start(index) && target <= sourceBuffer.buffered.end(index)) return true
          }
          return false
        }
        function trySeek() {
          if (pendingSeek === null || sourceBuffer === null) return
          if (!covers(pendingSeek)) return
          var target = pendingSeek
          pendingSeek = null
          try {
            audio.currentTime = target
            state = Object.assign({}, state, { currentTime: target })
            emitTime()
          } catch (error) { /* waits for a later updateend */ }
          if (resumeAfterSeek) {
            resumeAfterSeek = false
            if (pendingAutoplay) playAfterLoudness(token)
            else audio.play().catch(function () {})
          } else if (pendingAutoplay && (audio === null || audio.paused)) {
            // The saved position was known before the first chunk arrived: seeking paused
            // the deck, so start it again at the restored point.
            playAfterLoudness(token)
          }
        }
        function pump() {
          if (sourceBuffer === null || appending || failed) return
          if (queue.length === 0) {
            if (done && !ended && mediaSource.readyState === 'open') {
              ended = true
              try { mediaSource.endOfStream() } catch (error) {}
            }
            return
          }
          var chunk = queue.shift()
          appending = true
          try {
            sourceBuffer.appendBuffer(chunk)
          } catch (error) {
            fallbackToDirect()
          }
        }
        function maybeStart() {
          if (started || failed) return
          if (sourceBuffer === null || sourceBuffer.buffered.length === 0) return
          started = true
          loudness.resolve()
          if (pendingAutoplay) playAfterLoudness(token)
        }
        /** Folia's startAtSec / 每首歌记住播放位置 on the MSE path too. */
        function applySavedStart() {
          if (pendingResumeSeconds !== null) {
            var savedSeconds = pendingResumeSeconds
            pendingResumeSeconds = null
            if (savedSeconds > 0) session.seek(savedSeconds)
            return
          }
          if (readPrefs().rememberPerTrack !== true || typeof item.path !== 'string' || item.path === '') return
          getJson(API + 'position?path=' + encodeURIComponent(item.path))
            .then(function (body) {
              if (token !== loadToken) return
              var seconds = Number(body.lastPositionSec)
              if (isFinite(seconds) && seconds > 1) session.seek(seconds)
            })
            .catch(function () {})
        }

        mediaSource.addEventListener('sourceopen', function () {
          if (session.stopped) return
          try {
            sourceBuffer = mediaSource.addSourceBuffer(mseMime)
          } catch (error) {
            console.warn('[OnlineMse] addSourceBuffer failed, falling back to direct media', error)
            fallbackToDirect()
            return
          }
          // Duration is metadata for the seek bar, not part of SourceBuffer
          // creation. A failure here must not throw away the MSE path.
          if (Number(item.durationSec) > 0 && Number.isFinite(Number(item.durationSec))) {
            try { mediaSource.duration = Number(item.durationSec) } catch (error) {}
          }
          sourceBuffer.addEventListener('updateend', function () {
            appending = false
            maybeStart()
            trySeek()
            pump()
          })
          session.reader = response.body.getReader()
          applySavedStart()
          function read() {
            session.reader.read().then(function (result) {
              if (failed || session.stopped) return
              if (result.done) {
                done = true
                pump()
                return
              }
              queue.push(result.value)
              pump()
              read()
            }).catch(function () {
              if (session.stopped) return
              fallbackToDirect()
            })
          }
          read()
        })
        loadActiveSource(objectUrl)
        if (!pendingAutoplay) loudness.resolve()
        return null
      })
      .catch(function (error) {
        if (token !== loadToken) {
          loudness.resolve()
          return
        }
        // The Host refused this stream: the same URL through the media element cannot become
        // audio, it only turns the answer into Chromium's DEMUXER_ERROR_COULD_NOT_OPEN.
        if (error && error.onlineStreamRefused === true) {
          loudness.resolve()
          onError(error.message)
          return
        }
        startOnlineDirect(item, token, loudness)
      })
      .then(function () {
        if (token === loadToken) fetchAbort = null
      })
  }

  function normalizeGainMode(mode) {
    return mode === 'off' || mode === 'track' || mode === 'album' ? mode : 'auto'
  }

  function replayGainModeOf() {
    return normalizeGainMode(readPrefs().replayGainMode)
  }

  /**
   * Folia's store select on `replayGainMode`: a change from any entry point re-decides the
   * playing song at once. Leaving 智能平衡 ends the play it was in (Folia's balancePlay.reset).
   */
  function syncGainMode(nextPrefs) {
    var mode = nextPrefs === undefined || nextPrefs === null
      ? replayGainModeOf()
      : normalizeGainMode(nextPrefs.replayGainMode)
    if (mode === gainModeSeen) return
    gainModeSeen = mode
    applyModeGain(GAIN_SET_RAMP_SEC)
  }

  function replayGainEndpoint(item) {
    if (item === null || item === undefined) return null
    if (typeof item.onlineProvider === 'string' && item.onlineProvider !== '') {
      // Folia reads Navidrome's gain from OpenSubsonic; a streaming platform's own gain is
      // what its play URL stated, which the Host keeps with the cached audio — the live copy
      // arrives with the stream's headers and wins over this answer.
      if (typeof item.onlineId !== 'string' || item.onlineId === '') return null
      return API + 'online/replaygain?provider=' + encodeURIComponent(item.onlineProvider)
        + '&id=' + encodeURIComponent(item.onlineId)
    }
    if (typeof item.path !== 'string' || item.path === '') return null
    return API + 'replaygain?path=' + encodeURIComponent(item.path)
  }

  function balancing() {
    return replayGainModeOf() === 'auto'
  }

  /** Folia's getPlaybackSourceRef kinds: a local file, a library server, or a streaming platform. */
  function playbackSourceKind(item) {
    if (item === null || item === undefined) return 'local'
    var provider = String(item.onlineProvider || '')
    if (provider === '') return 'local'
    return provider === 'navidrome' ? 'navidrome' : 'online'
  }

  /** The song's own figures, from wherever they were learned (tag, library server, platform). */
  function gainRecordFor(item) {
    if (item === null || item === undefined || typeof item.path !== 'string' || item.path === '') return null
    var record = gainRecords[item.path]
    return record === undefined ? null : record
  }

  /**
   * Keep a song's figures where Folia keeps them — on the song. A source that states only some
   * fields adds those; nothing ever overwrites a known figure with "no figure".
   */
  function rememberGainRecord(item, info) {
    if (item === null || item === undefined || typeof item.path !== 'string' || item.path === '') return
    if (!info || typeof info !== 'object') return
    var next = Object.assign({}, gainRecords[item.path] || {}, info)
    if (typeof next.trackGain !== 'number' && typeof next.albumGain !== 'number') return
    gainRecords[item.path] = next
    var keys = Object.keys(gainRecords)
    if (keys.length > GAIN_RECORD_LIMIT) delete gainRecords[keys[0]]
    // The panel reads the current song's record, so a late figure can show without a re-apply.
    if (currentItem() !== null && currentItem().path === item.path) patch({ gainTags: next })
  }

  /** Read the Host's ReplayGain answer into the four figures, dropping anything unusable. */
  function replayGainInfoOf(body) {
    var info = {}
    if (!body || typeof body !== 'object') return null
    if (typeof body.trackGain === 'number' && isFinite(body.trackGain)) info.trackGain = body.trackGain
    if (typeof body.trackPeak === 'number' && isFinite(body.trackPeak)) info.trackPeak = body.trackPeak
    if (typeof body.albumGain === 'number' && isFinite(body.albumGain)) info.albumGain = body.albumGain
    if (typeof body.albumPeak === 'number' && isFinite(body.albumPeak)) info.albumPeak = body.albumPeak
    return Object.keys(info).length > 0 ? info : null
  }

  /**
   * Folia's applyReplayGain: one mode decides this song's gain. 智能平衡 asks the balance
   * rules; 单曲 / 专辑 read the source's own figures; 关闭 is unity. Leaving 智能平衡 ends the
   * play it was balancing (Folia's balancePlay.reset()).
   */
  function applyModeGain(rampSec) {
    var ramp = rampSec === undefined ? GAIN_SET_RAMP_SEC : rampSec
    var mode = replayGainModeOf()
    if (mode === 'auto') {
      reconsiderBalance(balanceMeter === null ? null : balanceMeter.liveLoudness(), ramp)
      return
    }
    balanceAppliedDb = null
    balanceMoved = false
    appliedGainEstimated = false
    if (mode === 'off') {
      appliedGainAvailable = false
      writeDeckGain(0, ramp)
      return
    }
    var info = gainRecordFor(currentItem())
    var available = info !== null && (typeof info.trackGain === 'number' || typeof info.albumGain === 'number')
    appliedGainAvailable = available
    var calculation = calculateReplayGain(info, mode)
    writeDeckGain(available ? calculation.effectiveGainDb : 0, ramp)
  }

  /**
   * Ask the Host for the song's figures (Folia's applyReplayGain reads them from the local
   * metadata / Navidrome carrier / the platform's cached answer). What is already known — a
   * file's tags, a platform's gain from the stream, a previous play this session — is applied
   * first, so a slow answer never keeps the previous song's gain.
   */
  function loadReplayGainFor(item) {
    var token = (replayGainToken += 1)
    applyModeGain(GAIN_SET_RAMP_SEC)
    fetchReplayGainInfo(item).then(function (info) {
      if (token !== replayGainToken) return
      rememberGainRecord(item, info)
      applyModeGain(GAIN_SET_RAMP_SEC)
    })
  }

  /** The song's ReplayGain figures from the Host; never rejects, and null means it has none. */
  function fetchReplayGainInfo(item) {
    var url = replayGainEndpoint(item)
    if (url === null) return Promise.resolve(null)
    return getJson(url)
      .then(function (body) {
        return replayGainInfoOf(body)
      })
      .catch(function () {
        return null
      })
  }

  /**
   * What the mode decides for a song that is not playing yet (the incoming side of a blend):
   * the same inputs `applyModeGain` would see, minus the live meter.
   */
  function modeGainFor(item) {
    var mode = replayGainModeOf()
    if (mode === 'off') return { db: 0, available: false }
    var info = gainRecordFor(item)
    if (mode !== 'auto') {
      var available = info !== null
        && (typeof info.trackGain === 'number' || typeof info.albumGain === 'number')
      return {
        db: available ? calculateReplayGain(info, mode).effectiveGainDb : 0,
        available: available,
      }
    }
    var choice = chooseBalance(balanceInputs(item, { live: null }))
    return { db: choice ? choice.effectiveGainDb : 0, available: true }
  }

  /** Folia's shuffleRound: record the song now playing and reshuffle a finished round. */
  function trackShuffleRoundProgress() {
    if (readPrefs().shuffleRoundNoRepeat !== true) return
    if (state.order !== 'random' || state.index < 0) return
    var current = currentItem()
    if (current === null) return
    var keys = state.queue.map(shuffleRoundKeyOf).filter(function (key) { return key !== '' })
    var currentKey = shuffleRoundKeyOf(current)
    if (keys.indexOf(currentKey) < 0) return
    var signature = currentKey + '\u0000' + keys.join('\u0001')
    if (signature === shuffleRoundTracked) return
    shuffleRoundTracked = signature
    var step = decideShuffleRoundStep({
      state: readShuffleRoundState(),
      keys: keys,
      currentKey: currentKey,
      countedKeys: keys,
      loopMode: state.loop === 'all' ? 'all' : state.loop,
    })
    if (step.kind === 'write') {
      writeShuffleRoundState(step.state)
      return
    }
    if (step.kind !== 'reshuffle') return
    var round = readShuffleRoundState()
    var guard = currentKey + '\u0000' + (round === null ? '' : round.orderHash)
    if (guard === shuffleReshuffledGuard) return
    shuffleReshuffledGuard = guard
    var nextQueue = shuffleQueueInRounds(state.queue, current)
    state = Object.assign({}, state, { queue: nextQueue, index: 0 })
    emit()
    savePlaybackState()
    cancelPrefetch()
    maybePrefetchNext()
  }

  /** Folia's round shuffle when the setting is on; the old flat shuffle otherwise. */
  function shuffleForOrder(list, current) {
    if (readPrefs().shuffleRoundNoRepeat === true) return shuffleQueueInRounds(list, current)
    return shuffleTracks(list, current)
  }

  /**
   * Folia resolves a stream URL when it asks the provider for audio, not when the row was
   * built: the quality preference is read at play time. Do the same here, so changing
   * 在线音质 affects the next play even for songs already in the queue.
   */
  function onlineUrlFor(item) {
    if (item === null || item === undefined) return ''
    if (
      typeof item.onlineProvider === 'string' && item.onlineProvider !== '' &&
      typeof item.onlineId === 'string' && item.onlineId !== '' &&
      typeof onlineStreamUrl === 'function'
    ) {
      return onlineStreamUrl(item.onlineProvider, item.onlineId)
    }
    return typeof item.onlineUrl === 'string' ? item.onlineUrl : ''
  }

  function load(at, autoplay) {
    var item = state.queue[at]
    if (!item) return
    abortCrossfade()
    stopOnlineMse()
    cancelPrefetch()
    currentBlob = null
    // Close the previous listening session before switching tracks.
    reportProviderPlayback(currentItem())
    flushListening(true)
    flushSessionPosition()
    var token = (loadToken += 1)
    mseFallbackToken = -1
    prefetchedProfilePath = ''
    profileToken += 1
    state = Object.assign({}, state, {
      index: at,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      // The panel reads this song's own figures, whether this is its first play or its tenth.
      gainTags: gainRecordFor(item),
    })
    emit()
    syncMediaSession()
    pendingAutoplay = autoplay === true
    // A new session starts here. The play count is recorded later, and
    // only when the Last.fm / MusicBee threshold is reached.
    resetSession(item)
    // Folia's shuffleRound tracks the song now playing; a finished round reshuffles here.
    trackShuffleRoundProgress()
    // Folia's light prefetch window: the next two and the previous track's lyrics.
    prefetchLyricsAround()
    currentLoudnessBlob = null
    loudnessToken += 1
    // A new play: the balance starts over, and the mode sets the gain before sound
    // (Folia's balancePlay + SET_RAMP_SEC) — from what is known now, then again when
    // the source's own figures arrive.
    balanceMoved = false
    balanceAppliedDb = null
    if (balanceMeter !== null && typeof balanceMeter.reset === 'function') balanceMeter.reset()
    loadReplayGainFor(item)
    var loudness = createLoudnessGate()
    if (audio === null) {
      loudness.resolve()
      return
    }
    if (autoplay === true) {
      var visualizerContext = api.ensureAnalyser()
      if (visualizerContext !== null && audioContext !== null && audioContext.state === 'suspended') {
        audioContext.resume().catch(function () {
          // The visualizer simply stays flat if the context cannot start.
        })
      }
    }

    cancelPendingFetch()
    // MediaSource owns the online byte stream, so seek is decided by this
    // client rather than by Chromium's judgement of a proxy response. The
    // first appended chunk starts sound; no full-file blob and no analysis gate.
    if (onlineUrlFor(item) !== '') {
      prepareOnlineElement()
      playOnlineMse(item, token, loudness)
      return
    }
    // Detach the old blob before revoking it: a revoked URL still
    // assigned to the element fires a spurious `error`.
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    releaseObjectUrl()
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    fetchAbort = controller

    fetch(streamUrl(item.path), controller === null ? {} : { signal: controller.signal })
      .then(function (response) {
        if (response.ok) return response.blob()
        return response
          .json()
          .catch(function () {
            return null
          })
          .then(function (body) {
            var reason =
              body && body.error && typeof body.error.message === 'string' ? body.error.message : ''
            throw new Error(reason || 'HTTP ' + response.status)
          })
      })
      .then(function (blob) {
        if (token !== loadToken) {
          loudness.resolve()
          return
        }
        fetchAbort = null
        if (audio === null) {
          loudness.resolve()
          return
        }
        releaseObjectUrl()
        objectUrl = URL.createObjectURL(blob)
        currentBlob = blob
        loadActiveSource(objectUrl)
        scheduleLoudness(item, blob, loudness.resolve)
        if (pendingResumeSeconds !== null) {
          var resumeAt = pendingResumeSeconds
          pendingResumeSeconds = null
          api.seek(resumeAt)
        } else if (readPrefs().rememberPerTrack === true) {
          getJson(API + 'position?path=' + encodeURIComponent(item.path))
            .then(function (body) {
              if (token !== loadToken) return
              var seconds = Number(body.lastPositionSec)
              if (isFinite(seconds) && seconds > 1) api.seek(seconds)
            })
            .catch(function () {})
        }
        if (pendingAutoplay) playAfterLoudness(token)
      })
      .catch(function (error) {
        if (token !== loadToken) {
          loudness.resolve()
          return
        }
        fetchAbort = null
        loudness.resolve()
        if (error && error.name === 'AbortError') return
        onError(error && typeof error.message === 'string' ? error.message : '')
      })
  }

  // ── crossfade: two decks, equal-power overlap ───────────────────────
  //
  // The outgoing track keeps playing on the active element while the incoming
  // track starts on the spare one, each deck carrying its own song's gain. When the
  // fade lands, the two decks swap roles, so every other part of the engine keeps
  // working with `audio` and `replayGainNode`.

  function releaseObjectUrlB() {
    if (objectUrlB === null) return
    try {
      URL.revokeObjectURL(objectUrlB)
    } catch (error) {
      // Revoking twice is harmless.
    }
    objectUrlB = null
  }

  function releasePrefetched() {
    prefetchedNext = null
  }

  function cancelPrefetch() {
    prefetchToken += 1
    prefetchedNext = null
    if (prefetchAbort !== null) {
      try {
        prefetchAbort.abort()
      } catch (error) {
        // Already settled.
      }
      prefetchAbort = null
    }
  }

  /**
   * Warm the next online track while the current one plays. The 14 s prepare
   * window is not enough for a first-time download of a large file, so start
   * early instead of at the end; cached tracks make this a no-op.
   */
  function maybePrefetchNext() {
    if (xfadeActive || xfadePending || xfadePrepared !== null) return
    var settings = readPrefs()
    if (crossfadeFadeSeconds(settings) <= 0) return
    if (state.index < 0 || state.queue.length < 2) return
    var next = nextIndexOf(state.index, state.queue.length)
    if (next === state.index) return
    var item = state.queue[next]
    if (!item || onlineUrlFor(item) === '') return
    if (!crossfadeNextAllowed(settings, currentItem(), item)) return
    if (prefetchedNext !== null && prefetchedNext.path === item.path) return
    if (prefetchAbort !== null) return
    var token = prefetchToken
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    prefetchAbort = controller
    var itemPath = item.path
    var itemGain = null
    fetchTrackBlob(item, controller === null ? null : controller.signal, function (headers) {
      // The platform's own gain comes with the stream's headers; keep it for the blend.
      itemGain = readReplayGainHeaders(headers)
    })
      .then(function (blob) {
        if (token !== prefetchToken) return
        prefetchAbort = null
        // One track of memory at most; bigger files rely on the Host cache.
        prefetchedNext =
          blob.size > 80 * 1024 * 1024 ? null : { path: itemPath, blob: blob, gain: itemGain }
      })
      .catch(function () {
        if (token === prefetchToken) prefetchAbort = null
      })
  }

  /** Fetch one track the same way `load()` does, without touching the decks. */
  function fetchTrackBlob(item, signal, onHeaders) {
    var options = signal === undefined || signal === null ? {} : { signal: signal }
    var report = function (response) {
      if (typeof onHeaders === 'function' && response && response.headers) onHeaders(response.headers)
    }
    var resolvedOnlineUrl = onlineUrlFor(item)
    if (resolvedOnlineUrl !== '') {
      return fetch(resolvedOnlineUrl, options).then(function (response) {
        report(response)
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.blob()
      })
    }
    return fetch(streamUrl(item.path), options).then(function (response) {
      report(response)
      if (response.ok) return response.blob()
      return response
        .json()
        .catch(function () {
          return null
        })
        .then(function (body) {
          var reason = body && body.error && typeof body.error.message === 'string' ? body.error.message : ''
          throw new Error(reason || 'HTTP ' + response.status)
        })
    })
  }

  function decodeBlob(blob) {
    var decoder = loudnessContext()
    if (decoder === null) return Promise.reject(new Error('no audio decoder'))
    return blob.arrayBuffer().then(function (bytes) {
      return decoder.decodeAudioData(bytes)
    })
  }

  /**
   * Decode once and return what the transition needs: the level envelope. The gain is
   * not measured here — the song's 音频增益 mode owns it (Folia's applyReplayGain), and
   * the incoming deck is written with the mode's decision instead.
   */
  function analyzeTransitionBlob(blob) {
    return decodeBlob(blob).then(function (buffer) {
      return { envelope: analyzeTransitionBuffer(buffer) }
    })
  }

  /** Phase one: measure both sides while there is still time to fetch B. */
  function prepareCrossfade(nextAt) {
    var item = state.queue[nextAt]
    if (!item || audio === null || analyser === null) return
    var token = (xfadeToken += 1)
    xfadePending = true
    xfadeNext = nextAt
    var outgoingBlob = currentBlob
    var nextBlob = null
    /** The platform's own gain, seen on the incoming stream's headers. */
    var nextPlatformGain = null
    var cached = prefetchedNext !== null && prefetchedNext.path === item.path ? prefetchedNext : null
    var cachedBlob = cached === null ? null : cached.blob
    Promise.all([
      outgoingBlob
        ? analyzeTransitionBlob(outgoingBlob)
            .then(function (result) {
              return result.envelope
            })
            .catch(function () {
              return null
            })
        : Promise.resolve(null),
      (cachedBlob !== null
        ? Promise.resolve(cachedBlob).then(function (blob) {
            nextPlatformGain = cached === null ? null : cached.gain || null
            return blob
          })
        : fetchTrackBlob(item, undefined, function (headers) {
            nextPlatformGain = readReplayGainHeaders(headers)
          })
      )
        .then(function (blob) {
          nextBlob = blob
          return analyzeTransitionBlob(blob)
        })
        .catch(function () {
          return null
        }),
      // The incoming song's own figures, so its deck can carry the mode's gain before it sounds.
      fetchReplayGainInfo(item),
    ]).then(function (results) {
      if (token !== xfadeToken || audio === null) return
      var incoming = results[1]
      if (nextBlob === null || incoming === null) {
        abortCrossfade()
        return
      }
      // The prefetched blob now lives in the prepared plan.
      releasePrefetched()
      var duration = state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0
      var currentProfile = currentItem() === null ? null : profileFor(currentItem().path)
      var nextProfile = item === null ? null : profileFor(item.path)
      var plan = crossfadePlan(
        {
          duration: duration,
          outroQuietSec: results[0] && typeof results[0].outroQuietSec === 'number'
            ? results[0].outroQuietSec
            : currentProfile && typeof currentProfile.bodyOut === 'number' ? currentProfile.bodyOut : 0,
        },
        {
          durationSec: incoming.envelope ? incoming.envelope.duration : 0,
          introQuietSec: incoming.envelope ? incoming.envelope.introQuietSec : 0,
          introSilentSec: incoming.envelope && incoming.envelope.introSilentSec > 0
            ? incoming.envelope.introSilentSec
            : nextProfile && typeof nextProfile.leadIn === 'number' ? nextProfile.leadIn : 0,
        },
        { prefs: readPrefs(), remaining: duration - audio.currentTime },
      )
      if (plan === null) {
        abortCrossfade()
        return
      }
      var audioApi = typeof __mpAudioBundle === 'function' ? __mpAudioBundle() : null
      if (audioApi !== null && typeof window !== 'undefined') window.__mpFoliaAudio = audioApi
      var periodSec = nextProfile && typeof nextProfile.bpm === 'number' && nextProfile.bpm > 0 ? 60 / nextProfile.bpm : null
      var nextBeatIn = null
      if (periodSec !== null) {
        var phase = ((plan.startInNext - (typeof nextProfile.beatOffset === 'number' ? nextProfile.beatOffset : 0)) % periodSec + periodSec) % periodSec
        nextBeatIn = phase === 0 ? 0 : periodSec - phase
      }
      var shape = null
      if (audioApi !== null && typeof audioApi.planBlendShape === 'function') {
        shape = audioApi.planBlendShape({
          overlap: plan.overlap,
          outgoingDb: results[0] ? results[0].loudnessDb : null,
          nextBeatIn: nextBeatIn,
          periodSec: periodSec,
          minOverlap: CROSSFADE_MIN_SECONDS,
          maxOverlap: CROSSFADE_MAX_SECONDS,
        })
      }
      var styled = null
      var profileApi = typeof __mpProfileBundle === 'function' ? __mpProfileBundle() : null
      if (profileApi !== null && typeof profileApi.chooseTransitionStyle === 'function' && typeof profileApi.shapeBlend === 'function') {
        var styleChoice = profileApi.chooseTransitionStyle({ from: currentProfile, to: nextProfile })
        var baseOverlap = shape !== null && typeof shape.overlap === 'number' ? shape.overlap : plan.overlap
        var scaledOverlap = Math.max(
          CROSSFADE_MIN_SECONDS,
          Math.min(CROSSFADE_MAX_SECONDS, baseOverlap * (typeof styleChoice.lengthScale === 'number' ? styleChoice.lengthScale : 1)),
        )
        styled = profileApi.shapeBlend({
          style: styleChoice.style,
          room: Math.max(0, duration - audio.currentTime),
          overlap: scaledOverlap,
          crossover: shape !== null ? shape.crossover : 0.5,
          nextBeatIn: nextBeatIn,
          periodSec: periodSec,
          incomingLeadIn: plan.startInNext,
        })
      }
      if (styled !== null && typeof styled.overlap === 'number' && styled.overlap > 0) {
        plan.overlap = styled.overlap
      } else {
        var keyScale = crossfadeKeyLengthScale(crossfadeKeyRelation(currentProfile, nextProfile))
        if (keyScale !== 1) {
          plan.overlap = Math.max(CROSSFADE_MIN_SECONDS, Math.min(CROSSFADE_MAX_SECONDS, plan.overlap * keyScale))
        }
      }
      // The incoming song's figures are kept on the song now, so its deck can carry the
      // mode's gain before it sounds and the panel already knows them when it arrives.
      rememberGainRecord(item, playbackSourceKind(item) === 'online'
        ? nextPlatformGain
        : results[2] === undefined ? null : results[2])
      xfadePrepared = {
        nextAt: nextAt,
        plan: plan,
        crossover: styled !== null ? styled.crossover : shape !== null ? shape.crossover : 0.5,
        hold: styled !== null ? styled.hold : 0,
        together: styled !== null ? styled.together : 0,
        style: styled !== null ? styled.style : 'plainBlend',
        blob: nextBlob,
        duration: incoming.envelope ? incoming.envelope.duration : 0,
      }
      xfadePending = false
      maybeCrossfade()
    })
  }

  function maybeCrossfade() {
    if (xfadeActive || audio === null || analyser === null || audioContext === null) return
    var settings = readPrefs()
    if (crossfadeFadeSeconds(settings) <= 0) {
      abortCrossfade()
      return
    }
    var duration = state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0
    var remaining = duration - audio.currentTime
    if (xfadePrepared !== null) {
      if (remaining <= xfadePrepared.plan.overlap + 0.25) {
        if (remaining > 0.35) beginCrossfadePlayback(xfadePrepared)
        else abortCrossfade()
      }
      return
    }
    if (xfadePending) return
    if (state.index < 0 || state.queue.length < 2) return
    var next = nextIndexOf(state.index, state.queue.length)
    if (next < 0 || next === state.index) return
    if (!crossfadeNextAllowed(settings, currentItem(), state.queue[next])) return
    var should = crossfadeShouldStart({
      prefs: settings,
      playing: state.playing,
      hasGraph: true,
      loop: state.loop,
      index: state.index,
      queueLength: state.queue.length,
      duration: duration,
      currentTime: audio.currentTime,
    })
    if (!should) return
    prepareCrossfade(next)
  }

  function beginCrossfadePlayback(prepared) {
    if (prepared === null || prepared === undefined) return abortCrossfade()
    if (audioB === null || audioContext === null || foliaTransport === null) return abortCrossfade()
    var remaining = (state.duration > 0 ? state.duration : audio.duration || 0) - audio.currentTime
    var fade = Math.min(prepared.plan.overlap, remaining - 0.05)
    // Folia's beatCut is intentionally a few milliseconds; only a zero/negative window is refused.
    if (!(fade >= 0.02)) return abortCrossfade()
    var token = xfadeToken
    // The outgoing song never fires `ended` once the fade takes it off the active deck; its
    // "played whole" report is made when the fade lands, from this capture.
    xfadeOutgoing = { item: currentItem(), duration: state.duration > 0 ? state.duration : audio.duration || 0 }
    // Its deck's meter too: a blended song's balance reading is taken where the blend lands.
    xfadeOutgoingMeter = balanceMeter
    var incomingDeck = foliaGraph !== null && audio === foliaGraph.getDeckElement('A') ? 'B' : 'A'
    // The incoming song's own mode gain, on the incoming song's own deck (Folia's per-deck node).
    var incomingGain = modeGainFor(state.queue[prepared.nextAt])
    prepared.gainDb = incomingGain.db
    prepared.gainAvailable = incomingGain.available
    releaseObjectUrlB()
    objectUrlB = URL.createObjectURL(prepared.blob)
    xfadeActive = true
    xfadePending = false
    xfadeAdopted = false
    foliaTransport
      .crossfadeTo(incomingDeck, objectUrlB, {
        seconds: fade,
        crossover: prepared.crossover,
        hold: prepared.hold || 0,
        together: prepared.together || 0,
        startAt: prepared.plan.startInNext,
        replayGainDb: prepared.gainDb,
        setActive: false,
      })
      .then(function (started) {
        if (!started || token !== xfadeToken) return abortCrossfade()
        adoptIncoming(token)
        if (xfadeTimer !== null) clearTimeout(xfadeTimer)
        xfadeTimer = setTimeout(function () {
          xfadeTimer = null
          finishCrossfade(token)
        }, Math.max(200, fade * 1000 - 40))
      })
      .catch(function () {
        if (token === xfadeToken) abortCrossfade()
      })
  }

  function swapDecks() {
    var nextDeck = foliaGraph !== null && audio === foliaGraph.getDeckElement('A') ? 'B' : 'A'
    var element = audio
    audio = audioB
    audioB = element
    var fade = fadeNode
    fadeNode = fadeNodeB
    fadeNodeB = fade
    var gain = replayGainNode
    replayGainNode = replayGainNodeB
    replayGainNodeB = gain
    var url = objectUrl
    objectUrl = objectUrlB
    objectUrlB = url
    if (foliaTransport !== null) foliaTransport.setActiveDeck(nextDeck)
    if (foliaGraph !== null) balanceMeter = foliaGraph.getDeckChain(nextDeck).balanceMeter
  }

  /**
   * The fade has started, so the incoming deck is already audible: switch the
   * UI and every track-bound piece of state to it at once. The outgoing
   * element keeps playing (and fading) as a ghost until the curve lands.
   */
  function adoptIncoming(token) {
    if (token !== xfadeToken || xfadeAdopted) return
    var prepared = xfadePrepared
    if (prepared === null || audio === null || audioB === null) return abortCrossfade()
    var nextAt = prepared.nextAt
    if (nextAt < 0 || !state.queue[nextAt]) return abortCrossfade()
    flushListening(true)
    flushSessionPosition()
    swapDecks()
    var item = state.queue[nextAt]
    var duration = prepared.duration > 0 ? prepared.duration : item.durationSec > 0 ? item.durationSec : 0
    state = Object.assign({}, state, {
      index: nextAt,
      currentTime: audio.currentTime || 0,
      duration: duration,
      buffered: 0,
      playing: true,
    })
    currentBlob = prepared.blob
    currentLoudnessBlob = prepared.blob
    // The incoming song starts on the gain its deck was given, so 智能平衡 reasons from it
    // rather than from the song that is fading out.
    balanceAppliedDb = balancing() ? prepared.gainDb : null
    balanceMoved = false
    appliedGainDb = Number(prepared.gainDb) || 0
    appliedGainEstimated = false
    appliedGainAvailable = prepared.gainAvailable === true
    patch({
      gainAppliedDb: appliedGainDb,
      gainEstimated: false,
      gainAvailable: appliedGainAvailable,
      gainTags: gainRecordFor(item),
    })
    xfadePrepared = null
    xfadeAdopted = true
    xfadeNext = -1
    resetSession(item)
    session.lastTime = audio.currentTime || 0
    syncMediaSession()
    applyOutputVolume()
    trackShuffleRoundProgress()
    emit()
    savePlaybackState()
    loadReplayGainFor(item)
    prefetchLyricsAround()
    maybePrefetchNext()
  }

  /** The overlap is over: silence and release the outgoing element. */
  function finishCrossfade(token) {
    if (token !== xfadeToken) return
    // Timers can race under throttling; never leave the UI on the ghost.
    if (!xfadeAdopted && xfadePrepared !== null) adoptIncoming(token)
    xfadeActive = false
    xfadePending = false
    xfadeAdopted = false
    if (audioContext !== null) {
      var now = audioContext.currentTime
      if (fadeNode !== null) {
        try {
          fadeNode.gain.cancelScheduledValues(now)
          fadeNode.gain.setValueAtTime(1, now)
        } catch (error) {
          // Already at unity.
        }
      }
      if (fadeNodeB !== null) {
        try {
          fadeNodeB.gain.cancelScheduledValues(now)
          fadeNodeB.gain.setValueAtTime(0, now)
        } catch (error) {
          // Already silenced.
        }
      }
    }
    // The song that just faded out was heard whole: its balance reading lands here, where the
    // blend does (Folia's settle path — a blended song never fires `ended`).
    if (balancing() && xfadeOutgoing !== null) {
      commitBalanceReading(xfadeOutgoing.item, xfadeOutgoing.duration, xfadeOutgoingMeter)
    }
    xfadeOutgoingMeter = null
    if (audioB !== null) {
      try {
        // Before the ghost is silenced: did it reach the end of the song? The fade is
        // clamped to `remaining - 0.05`, so a completed crossfade always did.
        var reachedEnd =
          xfadeOutgoing !== null &&
          isFinite(audioB.duration) &&
          audioB.duration > 0 &&
          audioB.duration - audioB.currentTime <= 1.5
        if (reachedEnd) reportPlayed(xfadeOutgoing.item)
        audioB.pause()
        audioB.removeAttribute('src')
        audioB.load()
      } catch (error) {
        // Detached element: nothing to stop.
      }
    }
    xfadeOutgoing = null
    releaseObjectUrlB()
    maybePrefetchNext()
  }

  function abortCrossfade() {
    if (!xfadePending && !xfadeActive && xfadeTimer === null && xfadePrepared === null) return
    xfadeToken += 1
    xfadePending = false
    xfadeActive = false
    xfadeAdopted = false
    xfadeNext = -1
    xfadePrepared = null
    xfadeOutgoing = null
    xfadeOutgoingMeter = null
    if (xfadeTimer !== null) {
      clearTimeout(xfadeTimer)
      xfadeTimer = null
    }
    if (audioB !== null) {
      try {
        audioB.pause()
        audioB.removeAttribute('src')
        audioB.load()
      } catch (error) {
        // Detached element: nothing to stop.
      }
    }
    releaseObjectUrlB()
    if (audioContext !== null) {
      var now = audioContext.currentTime
      if (fadeNode !== null) {
        try {
          fadeNode.gain.cancelScheduledValues(now)
          fadeNode.gain.setValueAtTime(1, now)
        } catch (error) {
          // Already at unity.
        }
      }
      if (fadeNodeB !== null) {
        try {
          fadeNodeB.gain.cancelScheduledValues(now)
          fadeNodeB.gain.setValueAtTime(0, now)
        } catch (error) {
          // Already silenced.
        }
      }
    }
  }

  function crossfadeActive() {
    return xfadeActive === true
  }

  /** Forward a transport event only when it belongs to the deck on screen. */
  function transportIsActive(info) {
    return foliaTransport !== null && info !== null && info.deck === foliaTransport.getActiveDeck()
  }

  function transportStateChanged(info) {
    if (!transportIsActive(info)) return
    if (info.playing === true) {
      onPlaying({ target: audio })
      onPlay({ target: audio })
      return
    }
    onPause({ target: audio })
  }

  function transportTimeChanged(info) {
    // 智能平衡 meters every deck as it plays — either deck, so a blend's incoming side is
    // measured too — and no other mode meters at all (Folia's `balancing` gate).
    if (balancing() && foliaTransport !== null && foliaGraph !== null && audioContext !== null) {
      var chain = foliaGraph.getDeckChain(info.deck)
      if (chain !== null && chain.balanceMeter && typeof chain.balanceMeter.tick === 'function') {
        chain.balanceMeter.tick(audioContext.currentTime)
      }
    }
    if (!transportIsActive(info)) return
    state = Object.assign({}, state, {
      duration: Number(info.duration) || state.duration,
      buffered: Number(info.buffered) || 0,
    })
    if (onlineMse !== null && typeof onlineMse.seeking === 'function' && onlineMse.seeking()) return
    onTime({ target: audio })
    syncMediaPosition(false)
  }

  function transportFailed(info) {
    onError(info)
  }

  function transportEnded(info) {
    if (!transportIsActive(info)) return
    onEnded({ target: audio })
  }

  // The engine starts on the stored mode, and follows every later write (Folia's store select).
  gainModeSeen = replayGainModeOf()
  if (typeof prefsStore !== 'undefined' && prefsStore !== null && typeof prefsStore.subscribe === 'function') {
    prefsStore.subscribe(function (next) {
      syncGainMode(next)
    })
  }

  var api = {
    subscribe: function (fn) {
      listeners.push(fn)
      return function () {
        listeners = listeners.filter(function (item) {
          return item !== fn
        })
      }
    },
    subscribeTime: function (fn) {
      timeListeners.push(fn)
      return function () {
        timeListeners = timeListeners.filter(function (item) {
          return item !== fn
        })
      }
    },
    subscribeError: function (fn) {
      errorListeners.push(fn)
      return function () {
        errorListeners = errorListeners.filter(function (item) {
          return item !== fn
        })
      }
    },
    getSnapshot: function () {
      return state
    },
    /** Merge probed audio facts (codec/sampleRate/bitrate) into a queued track. */
    updateTrack: function (path, info) {
      if (!path || !info || typeof info !== 'object') return
      var found = false
      var queue = state.queue.map(function (item) {
        if (!item || item.path !== path) return item
        found = true
        return Object.assign({}, item, info)
      })
      if (!found) return
      state = Object.assign({}, state, { queue: queue })
      emit()
    },
    getTime: function () {
      return { currentTime: state.currentTime, duration: state.duration, buffered: state.buffered }
    },
    /**
     * The active deck's media time, read at frame rate. `getTime()` is driven by
     * timeupdate (~4 Hz) and is not enough for a lyric clock; this follows the deck
     * that is actually sounding, including after a crossfade swaps A and B.
     */
    getPlaybackTime: function () {
      var source = audio
      var currentTime = source !== null && isFinite(source.currentTime) ? source.currentTime : state.currentTime
      var duration = source !== null && isFinite(source.duration) ? source.duration : state.duration
      return {
        currentTime: Number(currentTime) || 0,
        duration: Number(duration) || 0,
        buffered: Number(state.buffered) || 0,
      }
    },
    /** The deck currently producing sound; the Folia stages read it instead of the first DOM audio. */
    getActiveAudio: function () {
      return audio
    },
    /** Queue indices in the current playback order (random mode). */
    getPlayOrder: function () {
      return state.queue.map(function (_, index) {
        return index
      })
    },
    /** Restore the last queue/position once (called by the resident host). */
    tryRestore: tryRestore,
    /** Flush statistics + resume state when the page is hidden/closed. */
    flushOnHide: flushOnHide,
    /**
     * Lazily build Folia's graph. Called from a user gesture so the
     * AudioContext can start; connecting a media element source silences
     * the element until the context runs, so it must never be automatic.
     */
    ensureAnalyser: function () {
      if (audio === null || foliaGraph === null) return null
      if (analyser !== null) return analyser
      if (!canRouteThroughWebAudio(audio)) return null
      var built = foliaGraph.ensure()
      if (built === null) return null
      audioContext = foliaGraph.getContext()
      analyser = foliaGraph.getAnalyser()
      gainNode = foliaGraph.getMasterGain()
      if (audioContext === null || analyser === null || gainNode === null) {
        analyser = null
        return null
      }
      var chainA = foliaGraph.getDeckChain('A')
      var chainB = foliaGraph.getDeckChain('B')
      if (chainA === null || chainB === null) {
        analyser = null
        return null
      }
      // Compatibility aliases while the transport half is still the old code:
      // the deck chain's fade and ReplayGain stages now back the old names. The old
      // preamp/limiter are not created any more.
      fadeNode = chainA.fade
      fadeNodeB = chainB.fade
      replayGainNode = chainA.replayGain
      replayGainNodeB = chainB.replayGain
      balanceMeter = chainA.balanceMeter
      eqNodes = []
      waveData = new Uint8Array(analyser.frequencyBinCount)
      writeDeckGain(appliedGainDb, 0)
      applyEq(true)
      applyOutputVolume()
      try {
        if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback'
      } catch (error) {
        // audioSession is optional.
      }
      if (audioContext.state === 'suspended') audioContext.resume().catch(function () {})
      return analyser
    },
    /** Latest frequency data (0..255 per bin) or null when unavailable. */
    getWave: function () {
      if (analyser === null || waveData === null) return null
      analyser.getByteFrequencyData(waveData)
      return waveData
    },
    /** Hand the resident <audio> element to the engine (null detaches). */
    attachAudio: function (el) {
      if (audio === el && (el === null || foliaGraph !== null)) return
      abortCrossfade()
      cancelPrefetch()
      if (audio !== null) audio = null
      if (audioB !== null) audioB = null
      if (foliaTransport !== null) {
        foliaTransport.dispose()
        foliaTransport = null
      }
      if (foliaGraph !== null) {
        foliaGraph.dispose()
        foliaGraph = null
      }
      audioB = null
      releaseObjectUrlB()
      audioContext = null
      analyser = null
      gainNode = null
      fadeNode = null
      fadeNodeB = null
      replayGainNode = null
      replayGainNodeB = null
      eqNodes = []
      waveData = null
      audio = el
      if (el === null) return
      foliaGraph = createFoliaGraph()
      foliaGraph.attach(el)
      foliaGraph.setOutputDevice(readPrefs().audioOutputDeviceId || '')
      audioB = foliaGraph.getDeckElement('B')
      foliaTransport = createFoliaTransport({
        graph: foliaGraph,
        playbackFade: readPrefs().playbackFade !== false,
        onState: transportStateChanged,
        onTime: transportTimeChanged,
        onError: transportFailed,
        onEnded: transportEnded,
      })
      el.preload = 'metadata'
      el.volume = effectiveVolume()
      el.muted = state.muted
      if (audioB !== null) {
        audioB.volume = effectiveVolume()
        audioB.muted = state.muted
      }
      var item = currentItem()
      if (item !== null) {
        if (objectUrl !== null) {
          loadActiveSource(objectUrl)
          if (pendingAutoplay) playAfterLoudness(loadToken)
        } else {
          load(state.index, pendingAutoplay || state.playing)
        }
      }
      syncMediaSession()
    },
    setQueue: function (list) {
      // Never replace a queue that is already playing or paused mid-track.
      if (state.index >= 0) return
      var queue = state.order === 'random' ? shuffleForOrder(list, null) : list.slice()
      state = Object.assign({}, state, { queue: queue, index: -1 })
      emit()
    },
    playList: function (list, at) {
      if (!list || list.length === 0) return
      var queue = list.slice()
      var index = at
      if (state.order === 'random') {
        queue = shuffleForOrder(queue, queue[at])
        index = 0
      }
      state = Object.assign({}, state, { queue: queue, index: index })
      load(index, true)
    },
    /** Insert one track immediately after the current one, without interrupting playback. */
    enqueueNext: function (track) {
      if (track === null || track === undefined || typeof track.path !== 'string' || track.path === '') return
      if (state.queue.length === 0 || state.index < 0) {
        api.playList([track], 0)
        return
      }
      var at = Math.min(state.index + 1, state.queue.length)
      var queue = state.queue.slice()
      queue.splice(at, 0, track)
      state = Object.assign({}, state, { queue: queue })
      emit()
      savePlaybackState()
    },
    /** Append one track to the queue without interrupting playback. */
    enqueue: function (track) {
      if (track === null || track === undefined || typeof track.path !== 'string' || track.path === '') return
      if (state.queue.length === 0) {
        api.playList([track], 0)
        return
      }
      state = Object.assign({}, state, {
        queue: state.queue.concat([track]),
        index: state.index < 0 ? 0 : state.index,
      })
      emit()
      savePlaybackState()
    },
    select: function (list, at) {
      if (!list || list.length === 0 || at < 0) return
      if (at === state.index && sameQueue(list, state.queue)) {
        if (state.playing) api.pause()
        else api.play()
        return
      }
      if (!sameQueue(list, state.queue)) {
        var queue = list.slice()
        var index = at
        if (state.order === 'random') {
          queue = shuffleForOrder(queue, queue[at])
          index = 0
        }
        state = Object.assign({}, state, { queue: queue, index: index })
        load(index, true)
        return
      }
      load(at, true)
    },
    clearQueue: function () {
      if (audio !== null) audio.pause()
      state = Object.assign({}, state, {
        queue: [],
        index: -1,
        playing: false,
        currentTime: 0,
        duration: 0,
      })
      emit()
      savePlaybackState()
    },
    moveQueue: function (from, to) {
      var length = state.queue.length
      if (from < 0 || from >= length || to < 0 || to >= length || from === to) return
      var list = state.queue.slice()
      var moved = list.splice(from, 1)[0]
      list.splice(to, 0, moved)
      var index = state.index
      if (from === index) {
        index = to
      } else {
        if (from < index) index -= 1
        if (to <= index) index += 1
      }
      state = Object.assign({}, state, { queue: list, index: index })
      emit()
      savePlaybackState()
    },
    /**
     * Reorder the queue to match the displayed order (drag & drop).
     * `indices` are original queue indices in their new visual order.
     * In random mode the new visual order becomes the play order too.
     */
    reorderQueue: function (indices) {
      var length = state.queue.length
      if (!Array.isArray(indices) || indices.length !== length) return
      var seen = {}
      for (var i = 0; i < length; i += 1) {
        var at = indices[i]
        if (!Number.isInteger(at) || at < 0 || at >= length || seen[at] === true) return
        seen[at] = true
      }
      var list = indices.map(function (at) {
        return state.queue[at]
      })
      var current = state.index >= 0 ? indices.indexOf(state.index) : -1
      state = Object.assign({}, state, { queue: list, index: current })
      emit()
      savePlaybackState()
    },
    removeQueueAt: function (at) {
      var length = state.queue.length
      if (at < 0 || at >= length) return
      var list = state.queue.slice()
      list.splice(at, 1)
      if (list.length === 0) {
        api.clearQueue()
        return
      }
      if (at === state.index) {
        var nextIndex = Math.min(at, list.length - 1)
        var shouldPlay = state.playing === true
        state = Object.assign({}, state, { queue: list })
        load(nextIndex, shouldPlay)
        return
      }
      var index = at < state.index ? state.index - 1 : state.index
      state = Object.assign({}, state, { queue: list, index: index })
      emit()
      savePlaybackState()
    },
    /** Move a queue entry to play right after the current track. */
    playNext: function (at) {
      var length = state.queue.length
      if (at < 0 || at >= length || state.index < 0) return
      var target = Math.min(state.index + 1, length - 1)
      if (at === state.index || at === target) return
      api.moveQueue(at, target)
    },
    play: function () {
      if (!leader) return
      if (state.index < 0) {
        if (state.queue.length > 0) load(0, true)
        return
      }
      if (audio === null) return
      var context = api.ensureAnalyser()
      if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
        audioContext.resume().catch(function () {
          // If the context cannot start, leave the media element untouched.
        })
      }
      pendingAutoplay = true
      // Wait for the current track's loudness result so the first audible
      // sample already has its final gain instead of ducking mid-play.
      playAfterLoudness(loadToken)
    },
    /** Called by the cross-tab coordinator; never plays in a follower tab. */
    setLeader: function (value) {
      var next = value === true
      if (leader === next) return
      leader = next
      if (!leader) {
        pendingAutoplay = false
        abortCrossfade()
        if (audio !== null) audio.pause()
        if (audioB !== null) audioB.pause()
        if (state.playing) patch({ playing: false })
      }
      emit()
    },
    isLeader: function () {
      return leader
    },
    /** Test/diagnostic view of the two-deck hand-over (no controls). */
    getCrossfadeState: function () {
      return {
        active: xfadeActive,
        pending: xfadePending,
        adopted: xfadeAdopted,
        secondary: audioB !== null,
        wired: foliaGraph !== null && analyser !== null,
        next: xfadeNext,
      }
    },
    pause: function () {
      pendingAutoplay = false
      abortCrossfade()
      if (foliaTransport !== null) foliaTransport.pause(foliaTransport.getActiveDeck())
      else if (audio) audio.pause()
    },
    /** Re-read the wake-lock preference after the settings switch changed. */
    refreshWakeLock: function () {
      syncWakeLock(state.playing === true)
    },
    toggle: function () {
      if (state.playing) api.pause()
      else api.play()
    },
    next: function () {
      if (state.queue.length === 0) return
      load(nextIndexOf(state.index, state.queue.length), true)
    },
    prev: function () {
      if (state.queue.length === 0) return
      load(prevIndexOf(state.index, state.queue.length), true)
    },
    seek: function (seconds) {
      if (audio === null) return
      // A seek during a fade would desync the two decks; drop the fade first.
      abortCrossfade()
      var el = audio
      var item = currentItem()
      // Media duration is unavailable or still growing until metadata/data lands.
      // With MediaSource el.duration is only what has been appended so far, so
      // clamping a 90%-of-track seek to the current appended prefix would land at
      // its end (e.g. 98s of a 276s song). The track's known duration is the ceiling
      // until MSE reports the whole duration.
      var mediaDuration = isFinite(el.duration) && el.duration > 0 ? el.duration : 0
      var scannedDuration = item && Number(item.durationSec) > 0 ? Number(item.durationSec) : 0
      var limit = onlineMse !== null && scannedDuration > 0
        ? Math.max(mediaDuration, scannedDuration)
        : mediaDuration > 0
          ? mediaDuration
          : scannedDuration
      var target = clamp(seconds, 0, limit > 0 ? limit : seconds)
      if (!isFinite(target)) return

      if (onlineMse !== null) {
        onlineMse.seek(target)
        state = Object.assign({}, state, { currentTime: target })
        emitTime()
        return
      }

      if (foliaTransport !== null) {
        foliaTransport.seek(foliaTransport.getActiveDeck(), target)
        state = Object.assign({}, state, { currentTime: target })
        emitTime()
        return
      }

      function apply() {
        try {
          el.currentTime = target
        } catch (error) {
          return
        }
        state = Object.assign({}, state, { currentTime: target })
        emitTime()
      }

      if (el.readyState >= 1) {
        apply()
        return
      }
      var once = function () {
        el.removeEventListener('loadedmetadata', once)
        apply()
      }
      el.addEventListener('loadedmetadata', once)
      try {
        el.currentTime = target
      } catch (error) {
        // The listener above retries once metadata is ready.
      }
    },
    /**
     * The 音频增益 mode (Folia's `replayGainMode`) — the only switch the engine reads.
     * Writing it is enough: the prefs subscription below re-decides the playing song at
     * once, so every entry point (设置 · 播放控制, the panel sheet, the quick panel) lands
     * on the same path. `normalizeVolume` is kept as the legacy mirror older builds read.
     */
    setGainMode: function (mode) {
      var next = mode === 'off' || mode === 'track' || mode === 'album' ? mode : 'auto'
      savePrefs({ replayGainMode: next, normalizeVolume: next === 'auto' })
      syncGainMode()
    },
    /**
     * What the mode applied and what the deck's own node holds. The panel reads the
     * snapshot (Folia's replayGainAppliedDb); `deckDb` is the same value at the node,
     * for diagnosing a path that bypassed `writeDeckGain`.
     */
    getGainState: function () {
      var deck = replayGainNode === null ? null : replayGainNode.gain.value
      return {
        mode: replayGainModeOf(),
        appliedDb: appliedGainDb,
        estimated: appliedGainEstimated === true,
        available: appliedGainAvailable === true,
        deckDb: replayGainNode === null ? null : 20 * Math.log10(Math.max(1e-6, deck)),
      }
    },
    /**
     * Update the equalizer. Every call persists, so the panel can drive this
     * directly without a second write path. Enabling builds the graph on the
     * spot: the click that flips the switch is the user gesture Web Audio needs.
     */
    setEq: function (patch) {
      var source = patch !== null && typeof patch === 'object' ? patch : {}
      var bands = source.bands === undefined ? eq.bands.slice() : normalizeEqBands(source.bands)
      var preset
      if (source.preset === undefined) {
        // A band edit without an explicit preset still has to name its curve.
        preset = source.bands === undefined ? eq.preset : eqPresetForBands(bands)
      } else if (source.preset === 'custom') {
        preset = 'custom'
      } else if (source.preset === 'device') {
        preset = 'device'
      } else if (isEqSoundPreset(source.preset)) {
        preset = String(source.preset)
      } else if (isEqCustomSlotId(source.preset)) {
        preset = String(source.preset)
      } else {
        preset = eqPresetById(source.preset) === null ? 'flat' : String(source.preset)
      }
      var next = {
        enabled: source.enabled === undefined ? eq.enabled : source.enabled === true,
        preset: preset,
        bands: bands,
        effects:
          source.effects === undefined ? normalizeEqEffects(eq.effects) : normalizeEqEffects(source.effects),
        slots:
          source.slots === undefined ? normalizeEqSlots(eq.slots) : normalizeEqSlots(source.slots),
        device:
          source.device === undefined
            ? preset === 'device'
              ? eq.device
              : ''
            : String(source.device || ''),
      }
      eq = next
      savePrefs({
        eqEnabled: next.enabled,
        eqPreset: next.preset,
        eqBands: next.bands,
        eqEffects: next.effects,
        eqSlots: next.slots,
        // Any EQ change also re-writes the layout tag, so a library upgrade can
        // tell which band grid the stored bands belong to.
        eqLayout: EQ_LAYOUT,
        eqDevice: next.device,
      })
      if (next.enabled && analyser === null) api.ensureAnalyser()
      applyEq(next.enabled !== true)
    },
    getEq: function () {
      return {
        enabled: eq.enabled,
        preset: eq.preset,
        bands: eq.bands.slice(),
        effects: normalizeEqEffects(eq.effects),
        slots: normalizeEqSlots(eq.slots),
        device: eq.device,
        /** False when the browser cannot host the graph (EQ is inert then). */
        available: eqSupported() && (analyser !== null || audio === null || canRouteThroughWebAudio(audio)),
      }
    },
    setVolume: function (value) {
      var next = clamp(value, 0, 1)
      state = Object.assign({}, state, { volume: next, muted: next > 0 ? state.muted : false })
      applyOutputVolume()
      savePrefs({ volume: next })
      emit()
    },
    /**
     * Lower the audible master gain without changing the saved volume. Used by
     * host audio focus (TTS ducking); level is the remaining volume and fadeMs the ramp.
     */
    setDuck: function (level, fadeMs) {
      var next = clamp(Number(level), 0, 1)
      if (!isFinite(next)) return duckFactor
      var fade = Number(fadeMs)
      if (!isFinite(fade) || fade < 0) fade = 300
      fade = Math.min(5000, Math.max(0, Math.round(fade))) / 1000
      if (next === duckFactor && fade === duckRampSeconds) return duckFactor
      duckFactor = next
      duckRampSeconds = fade
      applyOutputVolume(fade)
      emit()
      return duckFactor
    },
    getDuck: function () {
      return duckFactor
    },
    /** Select the AudioContext sink; harmless when the engine has no setSinkId. */
    setOutputDevice: function (deviceId) {
      var next = deviceId === undefined || deviceId === null ? '' : String(deviceId)
      savePrefs({ audioOutputDeviceId: next })
      if (foliaGraph !== null) foliaGraph.setOutputDevice(next)
      return next
    },
    setPlaybackFade: function (enabled) {
      var next = enabled !== false
      savePrefs({ playbackFade: next })
      if (foliaTransport !== null) foliaTransport.setPlaybackFade(next)
      return next
    },
    setMuted: function (value) {
      state = Object.assign({}, state, { muted: value })
      if (gainNode !== null && foliaGraph !== null) {
        applyOutputVolume()
      } else {
        if (audio) audio.muted = value
        if (audioB) audioB.muted = value
      }
      emit()
    },
    setLoop: function (value) {
      if (value === 'one') abortCrossfade()
      state = Object.assign({}, state, { loop: value })
      savePrefs({ loop: value })
      emit()
    },
    setOrder: function (value) {
      var next = value === 'random' ? 'random' : 'list'
      if (next === 'random' && state.queue.length > 1) {
        // Shuffle the canonical queue once; the panel order is the play order.
        var current = currentItem()
        var queue = shuffleForOrder(state.queue, current)
        state = Object.assign({}, state, { queue: queue, index: current ? 0 : state.index, order: next })
      } else {
        state = Object.assign({}, state, { order: next })
      }
      savePrefs({ order: next })
      emit()
      savePlaybackState()
      // The neighbour changed; drop the old prefetch and warm the new one.
      cancelPrefetch()
      maybePrefetchNext()
    },
    clear: function () {
      loadToken += 1
      cancelPendingFetch()
      abortCrossfade()
      cancelPrefetch()
      currentBlob = null
      releaseObjectUrl()
      if (foliaTransport !== null) {
        foliaTransport.stop(foliaTransport.getActiveDeck())
      } else if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      state = Object.assign({}, state, {
        queue: [],
        index: -1,
        playing: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
      })
      emit()
      syncMediaSession()
    },
    suspend: function () {
      if (foliaTransport !== null) foliaTransport.pause(foliaTransport.getActiveDeck())
      else if (audio) audio.pause()
    },
    destroy: function () {
      stopLeaderElection()
      loadToken += 1
      cancelPendingFetch()
      releaseObjectUrl()
      if (foliaTransport !== null) {
        foliaTransport.dispose()
        foliaTransport = null
      }
      if (foliaGraph !== null) {
        foliaGraph.dispose()
        foliaGraph = null
      }
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio = null
      }
    },
  }

  // ── cross-window leader (one audible player per browser profile) ─────
  function readLease() {
    try {
      var raw = window.localStorage.getItem(LEADER_KEY)
      var value = raw === null ? null : JSON.parse(raw)
      return value !== null && typeof value === 'object' ? value : null
    } catch {
      return null
    }
  }

  function claimLeader() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return true
    try {
      var now = Date.now()
      var lease = readLease()
      if (lease !== null && lease.id !== tabId && now - Number(lease.at || 0) < 7000) {
        if (leader) {
          leader = false
          if (audio !== null) audio.pause()
          if (state.playing) patch({ playing: false })
          emit()
        }
        return false
      }
      window.localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, at: now }))
      if (!leader) {
        leader = true
        emit()
      }
      return true
    } catch {
      return true
    }
  }

  function releaseLeader() {
    try {
      var lease = readLease()
      if (lease !== null && lease.id === tabId) window.localStorage.removeItem(LEADER_KEY)
    } catch {
      // Best effort.
    }
  }

  function startLeaderElection() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
    claimLeader()
    leaderTimer = setInterval(claimLeader, 2000)
    if (leaderTimer && typeof leaderTimer.unref === 'function') leaderTimer.unref()
    window.addEventListener('beforeunload', releaseLeader)
    window.addEventListener('pagehide', releaseLeader)
  }

  function stopLeaderElection() {
    if (leaderTimer !== null) clearInterval(leaderTimer)
    leaderTimer = null
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', releaseLeader)
      window.removeEventListener('pagehide', releaseLeader)
    }
    releaseLeader()
  }

  try {
    startLeaderElection()
  } catch {
    // localStorage can be unavailable in private/browser test modes.
  }

  syncMediaHandlers()
  /** The bundle that built this engine, so a later evaluation can tell it is not its own. */
  api.build = currentClientBuild()
  if (typeof window !== 'undefined') window[PLAYER_KEY] = api
  return api
}

var player = createPlayer()

