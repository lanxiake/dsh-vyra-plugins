/**
 * prefs: user preferences, persisted in localStorage.
 *
 * The playback engine calls `readPrefs()` / `savePrefs()` directly, so the
 * shape below must stay compatible with 0.11.1 (loop / order / volume /
 * resumeOnStart / rememberPerTrack / sleepTimerMinutes).
 */

var PREFS_KEY = 'music.prefs.v2'
var LEGACY_PREFS_KEY = 'dsh-music.prefs'

var PREF_DEFAULTS = {
  layout: 'top',
  sortBy: 'title',
  sortDir: 'asc',
  /**
   * Folia's `localLyricsPriority`: which lyric a local file shows when it has both
   * its own file lyric and a matched online one. 'local' keeps the file's own.
   */
  lyricLocalPriority: 'local',
  /** Folia's `preferredAlternativeLyricSource`: asked first when another source is searched. */
  lyricPreferredSource: 'qq',
  /**
   * Folia's `keepProviderWordTiming`: a platform's own word-timed lyric is only replaced by
   * the preferred source, and only by a word-timed lyric; off, every source competes.
   */
  lyricKeepProviderWordTiming: true,
  /** Folia's device-wide lyric offset, added on top of the per-song one (limited to ±2000 ms). */
  lyricGlobalOffsetMs: 0,
  /** Folia's `subtitleOverlayBackground`: a soft halo behind the bottom subtitle line. */
  subtitleOverlayBackground: true,
  /** Folia's `localLyricFormatOrder`: which sidecar lyric file wins when several exist. */
  lyricFormatOrder: ['lrc', 'vtt', 'ttml', 'qrc', 'yrc', 'krc'],
  /** Preferred online audio level: standard | high | lossless | hires. */
  onlineQuality: 'high',
  /**
   * Folia's `enableMediaCache`: cache a song's audio only after it was played through.
   * Off by default, exactly as upstream; reads use the cache either way.
   */
  onlineCacheEnabled: false,
  /** Folia's `mediaCacheLimitGb`: 1/2/5/10/20/50, 0 = no ceiling. */
  onlineCacheLimitGb: 5,
  waveEnabled: true,
  showTranslation: true,
  /** Translation row size as a percentage of the lyric size (50–150). */
  translationScale: 90,
  /** Ready-made line filters (Folia's preset ids) and free words that hide a line. */
  lyricFilterPresets: [],
  lyricFilterWords: '',
  /** Lyrics column width in the player page (px), dragged by the splitter. */
  npLyricWidth: 560,
  /** Gap between the album column and the lyrics column (px), editable in the player editor. */
  npPaneGap: 60,
  /** Animated flowing-light background on the player page. */
  npFlowBg: true,
  /** 外观: lyric style, Folia shell background and where the accent comes from (28-look.js). */
  lyricStyle: 'monet',
  /** Folia's calm/normal/chaotic chip (used by the styles' animation tuning). */
  lyricIntensity: 'normal',
  /**
   * Folia's `autoUseBestLyric`: when the platform's own lyric has no word-level timing,
   * ask the other lyric sources for a matched word-by-word one. On by default there too.
   */
  autoUseBestLyric: true,
  /** Every Folia lyric style's font multiplier (设置 · 歌词 · 字号, and the ≋ quick control). */
  lyricsFontScale: 1,
  bgMode: 'latent',
  bgCoverOnly: false,
  /** Latent background layers: pixel dithering, fluid mesh, or both. */
  latentDisplayMode: 'both',
  latentColorSource: 'cover-theme',
  /** URL for the Folia "url" (embedded) background. */
  bgUrl: '',
  themeSource: 'default',
  themeAccent: '',
  /** Ambient backdrop motion (blurred cover). */
  npAmbientOn: true,
  npAmbientDrift: 300,
  npAmbientSpeed: 400,
  npBeatSensitivity: 200,
  npBeatAmount: 300,
  composerLyrics: false,
  composerTranslation: true,
  /**
   * The composer seat: one list button beside the chat input that opens the queue.
   * Off removes the seat, not just its content; the lyric strip keeps `composerLyrics`.
   */
  composerListButton: true,
  volume: 1,
  audioOutputDeviceId: '',
  playbackFade: true,
  // Writing a real play to a music account is opt-in, as Folia's scrobble switch is.
  playbackReports: false,
  /** Folia's voice-input pause: Windows microphone capture pauses playback. */
  voiceInputPause: false,
  /** External TTS/voice plugins may duck the music through the audio-focus API. */
  audioFocusDucking: true,
  /** Remaining volume while ducked (0.3 = 30%). */
  audioFocusDuckLevel: 0.3,
  /** Duck/release ramp in milliseconds. */
  audioFocusFadeMs: 300,
  /** Folia's replay-gain choice; `normalizeVolume` is the legacy on/off form. */
  replayGainMode: 'auto',
  loop: 'none',
  order: 'list',
  resumeOnStart: true,
  sleepTimerMinutes: 0,
  sleepDeadline: 0,
  autoResume: false,
  rememberPerTrack: false,
  normalizeVolume: true,
  eqEnabled: false,
  eqPreset: 'flat',
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  eqEffects: {
    highpass: 20,
    lowpass: 20000,
    drive: 0,
    crush: 0,
    wow: 0,
    noise: 0,
    width: 1,
    space: 0,
    punch: 0,
  },
  /** Written on the first EQ change; an empty value means "old band grid". */
  eqLayout: '',
  eqDevice: '',
  eqSlots: [
    { bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], effects: {} },
    { bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], effects: {} },
  ],
  /** Folia's automix/crossfade switch, kept apart from the maximum overlap. */
  crossfadeEnabled: false,
  /** Folia's `crossfadeMaxSec`: the upper bound of the automatic overlap. */
  crossfadeSeconds: 5,
  /** Folia's `queueAddBehavior`: where 「加入队列」 puts a song, after the current one or at the end. */
  queueAddBehavior: 'append',
  /** Folia's `autoSkipUnplayable`: a track that cannot be played is skipped instead of stopping. */
  autoSkipUnplayable: false,
  /** Folia's `shuffleRoundNoRepeat`: a shuffled queue is re-shuffled for every round. */
  shuffleRoundNoRepeat: false,
  /** Keep the screen awake while a song plays (Wake Lock, where the host offers it). */
  preventSleepDuringPlayback: false,
  onlinePlaylistSort: 'source',
  onboardingDone: true,
}

function readPrefs() {
  var merged = {}
  Object.keys(PREF_DEFAULTS).forEach(function (key) {
    merged[key] = PREF_DEFAULTS[key]
  })
  var raw = null
  try {
    raw = window.localStorage.getItem(PREFS_KEY)
  } catch (error) {
    raw = null
  }
  // One-time migration from the 0.11 key so nobody loses their settings.
  if (raw === null) {
    try {
      raw = window.localStorage.getItem(LEGACY_PREFS_KEY)
      if (raw !== null) window.localStorage.setItem(PREFS_KEY, raw)
    } catch (error) {
      raw = null
    }
  }
  if (raw === null) return merged
  var parsed = null
  try {
    parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return merged
    Object.keys(parsed).forEach(function (key) {
      if (parsed[key] !== undefined && parsed[key] !== null) merged[key] = parsed[key]
    })
  } catch (error) {
    // Corrupt value: defaults stand.
  }
  // The classic renderer is removed; legacy variant ids now select the default Monet style.
  if (['standard', 'glow', 'outline', 'karaoke', 'mirror', 'classic', 'cappella'].indexOf(merged.lyricStyle) >= 0) merged.lyricStyle = 'monet'
  // The player page switched from the old ambient/flow backdrop to Folia's six shell
  // backgrounds; a stored old id falls back to Folia's default (latent).
  var foliaBackgrounds = ['common', 'monet', 'nomand', 'latent', 'sora', 'url', 'none']
  if (foliaBackgrounds.indexOf(merged.bgMode) < 0) merged.bgMode = 'latent'
  // The old "lyric order" switch is gone: Folia's local/online priority decides, and the
  // sidecar always outranks the embedded lyric. A stored `lyricOrder` is simply ignored.
  delete merged.lyricOrder
  if (['off', 'auto', 'track', 'album'].indexOf(merged.replayGainMode) < 0) {
    merged.replayGainMode = merged.normalizeVolume === false ? 'off' : 'auto'
  }
  // The classic lyric list is gone: every style is a Folia renderer whose typography
  // inputs are multipliers, so the old px-based keys have no reader. Drop them once
  // instead of leaving stored values that look like they still do something.
  var deadLyricKeys = ['lyricSize', 'lyricGap', 'lyricBlur', 'lyricAlign', 'npLayoutV2', 'lyricAutoWordSegmentation']
  var dropped = false
  deadLyricKeys.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      delete merged[key]
      dropped = true
    }
  })
  var fontScale = Number(merged.lyricsFontScale)
  if (!isFinite(fontScale) || fontScale < 0.5 || fontScale > 2) merged.lyricsFontScale = PREF_DEFAULTS.lyricsFontScale
  var transScale = Number(merged.translationScale)
  if (!isFinite(transScale) || transScale < 50 || transScale > 150) merged.translationScale = PREF_DEFAULTS.translationScale
  var globalOffset = Number(merged.lyricGlobalOffsetMs)
  if (!isFinite(globalOffset)) globalOffset = PREF_DEFAULTS.lyricGlobalOffsetMs
  merged.lyricGlobalOffsetMs = Math.max(-2000, Math.min(2000, Math.round(globalOffset)))
  if (merged.queueAddBehavior !== 'next') merged.queueAddBehavior = 'append'
  // Before the switch existed, a positive seconds value was the switch itself. Fresh installs
  // (defaults above) stay off; old users keep exactly the state they had.
  var storedHadCrossfadeSwitch = parsed !== null && Object.prototype.hasOwnProperty.call(parsed, 'crossfadeEnabled')
  var storedCrossfadeSeconds = parsed === null ? NaN : Number(parsed.crossfadeSeconds)
  if (!storedHadCrossfadeSwitch) merged.crossfadeEnabled = isFinite(storedCrossfadeSeconds) && storedCrossfadeSeconds > 0
  var crossfadeSeconds = Number(merged.crossfadeSeconds)
  if (!isFinite(crossfadeSeconds) || crossfadeSeconds < 1) crossfadeSeconds = PREF_DEFAULTS.crossfadeSeconds
  merged.crossfadeSeconds = Math.min(25, Math.max(1, Math.round(crossfadeSeconds)))
  if (dropped) {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
    } catch (error) {
      // Best effort only.
    }
  }
  return merged
}

/** The settings a backup may carry; unknown keys in an imported file are ignored. */
function prefKeys() {
  return Object.keys(PREF_DEFAULTS)
}

function savePrefs(patch) {
  var next = readPrefs()
  if (patch !== null && typeof patch === 'object') {
    Object.keys(patch).forEach(function (key) {
      next[key] = patch[key]
    })
  }
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch (error) {
    // Private mode / quota: preferences are best effort.
  }
  if (prefsStore !== undefined) prefsStore.set(next)
  return next
}

var prefsStore = createStore(readPrefs())

function setPrefs(patch) {
  return savePrefs(patch)
}





