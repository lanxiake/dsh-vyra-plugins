/**
 * The full-panel player: composition and state. Presentation lives in the sibling
 * modules (capsule, seek bar, editor, cover accent, lyric scroll), mirroring Folia's
 * component boundaries rather than one 3000-line file.
 */

function NowPlaying(props) {
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var prefs = usePrefs()
  var track = snap.queue[snap.index] || null
  var trackPath = track ? track.path : ''
  // Fade the incoming cover/title/artist only. Removing the outgoing node with
  // a zero-length animation keeps rapid next/previous clicks responsive; the
  // old implementation kept it on screen for the whole fade and felt blocked.
  function incomingFade(el, action) {
    if (action !== 'add') return new KeyframeEffect(el, [], { duration: 0 })
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return new KeyframeEffect(el, [], { duration: 0 })
    }
    return new KeyframeEffect(
      el,
      [
        { opacity: 0.25, transform: 'scale(.985)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 170, easing: 'ease-out', fill: 'both' },
    )
  }
  var coverMotion = useAutoAnimate(incomingFade)
  var metaMotion = useAutoAnimate(incomingFade)
  var coverMotionRef = coverMotion[0]
  var metaMotionRef = metaMotion[0]
  var pair = useState([])
  var lyrics = pair[0]
  var setLyrics = pair[1]
  var loadingPair = useState(false)
  var setLyricsLoading = loadingPair[1]
  var errorPair = useState('')
  var setLyricError = errorPair[1]
  var settingsPair = useState(false)
  var editorPair = useState(false)
  var editorOpen = editorPair[0]
  var setEditorOpen = editorPair[1]
  var fsPair = useState(false)
  var isFullscreen = fsPair[0]
  var setIsFullscreen = fsPair[1]
  var settingsOpen = settingsPair[0]
  var setSettingsOpen = settingsPair[1]
  var settingsRef = useRef(null)
  var settingsBtnRef = useRef(null)
  var npRef = useRef(null)
  var coverImgRef = useRef(null)
  var settingsPosPair = useState(null)
  var settingsPos = settingsPosPair[0]
  var setSettingsPos = settingsPosPair[1]
  var extraPair = useState('')
  var extraPanel = extraPair[0]
  var setExtraPanel = extraPair[1]
  var sleepCustomPair = useState('')
  var sleepCustom = sleepCustomPair[0]
  var setSleepCustom = sleepCustomPair[1]
  var sleepRemaining = useCountdown(extraPanel === 'sleep' ? prefs.sleepDeadline : 0)
  var sleepRef = useRef(null)
  var audioRef = useRef(null)
  // Lyrics column width, dragged by the splitter on the right of the lyrics.
  var lyricWidthPair = useState(clamp(Number(prefs.npLyricWidth) || 560, 360, 900))
  var lyricWidth = lyricWidthPair[0]
  var setLyricWidth = lyricWidthPair[1]
  var paneGap = clamp(Number(prefs.npPaneGap) || 60, 12, 96)

  function applyLyricWidth(value, persist) {
    var next = clamp(Math.round(Number(value) || 560), 360, 900)
    setLyricWidth(next)
    if (persist === true) setPrefs({ npLyricWidth: next })
  }

  function beginLyricResize(event, side) {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    var handle = event.currentTarget
    if (handle && handle.classList) handle.classList.add('is-dragging')
    var startX = event.clientX
    // The rendered column may be narrower than the stored preference when the
    // window is small, so drag from what is actually on screen.
    var pane = document.querySelector('.mp-np-right')
    var startWidth = pane === null ? lyricWidth : pane.getBoundingClientRect().width
    var latest = Math.round(startWidth)
    // Never persist a width the current interface cannot fit; the CSS formula
    // caps it the same way.
    var fitMax = 900
    var body = document.querySelector('.mp-np-body')
    var cover = document.querySelector('.mp-np-left')
    if (body !== null && cover !== null) {
      var styles = window.getComputedStyle(body)
      var contentWidth =
        body.getBoundingClientRect().width -
        (parseFloat(styles.paddingLeft) || 0) -
        (parseFloat(styles.paddingRight) || 0)
      var leftSplit = document.querySelector('.mp-np-split[data-side="left"]')
      var rightSplit = document.querySelector('.mp-np-split[data-side="right"]')
      var gapWidth = leftSplit === null ? 24 : leftSplit.getBoundingClientRect().width
      var splitWidth = rightSplit === null ? 24 : rightSplit.getBoundingClientRect().width
      fitMax = Math.min(900, (contentWidth - 0.5 * cover.getBoundingClientRect().width - gapWidth - 2 * splitWidth) / 1.5)
    }
    document.body.style.userSelect = 'none'
    function move(moveEvent) {
      // The layout pins the midpoint of the two column centre lines to the
      // interface centre: the left boundary moves -1/4 and the right boundary
      // +3/4 of a width change, so each handle needs its own ratio to track the
      // pointer exactly.
      var dx = moveEvent.clientX - startX
      latest = clamp(side === 'left' ? startWidth - 4 * dx : startWidth + (4 * dx) / 3, 360, fitMax)
      setLyricWidth(latest)
    }
    function finish() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (handle && handle.classList) handle.classList.remove('is-dragging')
      document.body.style.userSelect = ''
      setPrefs({ npLyricWidth: Math.round(latest) })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  function onLyricSplitKey(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      applyLyricWidth(lyricWidth - 24, true)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      applyLyricWidth(lyricWidth + 24, true)
    } else if (event.key === 'Home') {
      event.preventDefault()
      applyLyricWidth(560, true)
    }
  }
  // Chorus windows from the provider still feed the lyric pipeline (hook lines and
  // their styling); there is no seek control for them.
  var sourcePair = useState('')
  var lyricSource = sourcePair[0]
  var setLyricSource = sourcePair[1]
  // Bottom sheet (cover / local / controls / queue / quality), opened from "词".
  var sheetPair = useState(false)
  var sheetOpen = sheetPair[0]
  var setSheetOpen = sheetPair[1]
  // Where the "词" control sits, so the card opens beside it (Folia anchors its panel
  // to the round handle the same way). -1 means "use the default corner".
  var anchorPair = useState({ right: -1, bottom: -1 })
  var sheetAnchor = anchorPair[0]
  var setSheetAnchor = anchorPair[1]
  var wordBtnRef = useRef(null)
  // Folia's player chrome auto-hides: the transport capsule and the bottom-right
  // handle fade out after 3 s without pointer activity and come back on the next move.
  // Any open panel keeps them visible.
  var chromePair = useState(true)
  var chromeVisible = chromePair[0]
  var setChromeVisible = chromePair[1]
  var chromePinned =
    sheetOpen || editorOpen || settingsOpen || extraPanel !== '' || props.queueOpen === true
  // The queue pops out beside whichever control opened it (capsule or secondary row):
  // the player page stays, and the popover is the panel's queue, only anchored here.
  var queueAnchorPair = useState(null)
  var queueAnchor = queueAnchorPair[0]
  var setQueueAnchor = queueAnchorPair[1]
  function toggleQueue(event) {
    var el = event && event.currentTarget
    if (el && typeof el.getBoundingClientRect === 'function') setQueueAnchor(el.getBoundingClientRect())
    if (typeof props.onToggleQueue === 'function') props.onToggleQueue()
  }
  function queuePopoverStyle(rect) {
    var width = Math.min(340, (window.innerWidth || 1400) - 16)
    var right = rect ? Math.max(8, window.innerWidth - rect.right) : 24
    var bottom = rect ? Math.max(8, window.innerHeight - rect.top + 10) : 96
    return {
      left: 'auto',
      right: right + 'px',
      top: 'auto',
      bottom: bottom + 'px',
      width: width + 'px',
      maxHeight: 'min(560px, 60vh)',
    }
  }
  useEffect(
    function () {
      if (props.open !== true) return undefined
      var timer = null
      function clear() {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
      }
      function arm() {
        clear()
        if (chromePinned) return
        timer = setTimeout(function () {
          setChromeVisible(false)
        }, 3000)
      }
      function wake() {
        setChromeVisible(true)
        arm()
      }
      var root = npRef.current
      if (root === null) return undefined
      root.addEventListener('pointermove', wake, { passive: true })
      root.addEventListener('pointerdown', wake, { passive: true })
      root.addEventListener('keydown', wake)
      if (chromePinned) {
        setChromeVisible(true)
        clear()
      } else {
        wake()
      }
      return function () {
        clear()
        root.removeEventListener('pointermove', wake)
        root.removeEventListener('pointerdown', wake)
        root.removeEventListener('keydown', wake)
      }
    },
    [props.open, chromePinned],
  )
  var offsetPair = useState(0)
  var offsetMs = offsetPair[0]
  var setOffsetMs = offsetPair[1]
  var reloadPair = useState(0)
  var lyricReload = reloadPair[0]
  var setLyricReload = reloadPair[1]
  useEffect(
    function () {
      if (!settingsOpen) return undefined
      function onDown(event) {
        var target = event.target
        if (settingsRef.current && settingsRef.current.contains(target)) return
        if (settingsBtnRef.current && settingsBtnRef.current.contains(target)) return
        setSettingsOpen(false)
      }
      function onKey(event) {
        if (event.key === 'Escape') setSettingsOpen(false)
      }
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('keydown', onKey)
      }
    },
    [settingsOpen],
  )
  useEffect(
    function () {
      if (extraPanel === '') return undefined
      function onDown(event) {
        if (sleepRef.current && sleepRef.current.contains(event.target)) return
        if (audioRef.current && audioRef.current.contains(event.target)) return
        setExtraPanel('')
      }
      function onKey(event) {
        if (event.key === 'Escape') setExtraPanel('')
      }
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('keydown', onKey)
      }
    },
    [extraPanel],
  )
  var cover = track ? trackCoverSrc(track) : ''
  var flowAccent = useCoverAccent(cover, coverImgRef)
  // Local theme source: generate once per song, entirely on this machine. The sheet's
  // "generate" button forces a fresh variation; this effect only fills the cache.
  useEffect(function () {
    if (props.open !== true || prefs.themeSource !== 'cover') return undefined
    if (trackPath === '' || typeof mpEnsureLocalTheme !== 'function') return undefined
    var text = lyrics.map(function (line) {
      if (!line) return ''
      return typeof line.fullText === 'string' ? line.fullText : typeof line.text === 'string' ? line.text : ''
    }).join('\n')
    mpEnsureLocalTheme({
      key: trackPath,
      cover: cover,
      lyricsText: text,
      songTitle: track ? trackTitleOf(track) : '',
      variation: 0,
    })
    return undefined
  }, [props.open, prefs.themeSource, trackPath, cover, lyrics])
  var pageHiddenPair = useState(false)
  var pageHidden = pageHiddenPair[0]
  var setPageHidden = pageHiddenPair[1]
  useEffect(function () {
    function sync() {
      setPageHidden(document.visibilityState === 'hidden')
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return function () {
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  // The player page's backdrop is Folia's shell background (src/render/styles/folia-backdrop.js);
  // the old blurred-cover/ambient layer is gone from the page.
  // Cached online streams carry real codec/sample-rate/bitrate facts; probe the
  // cache after playback starts and merge them into the current queue track.
  useEffect(
    function () {
      if (!track || !track.onlineProvider || !track.onlineId) return undefined
      var provider = track.onlineProvider
      var id = track.onlineId
      var path = track.path
      var cancelled = false
      var attempts = 0
      var timer = null
      function ask() {
        if (cancelled) return
        getJson(
          API +
            'online/info?provider=' +
            encodeURIComponent(provider) +
            '&id=' +
            encodeURIComponent(id),
        )
          .then(function (body) {
            if (cancelled) return
            var info = body && body.cached ? body.info : null
            if (info && (info.codec || info.sampleRate || info.bitrate)) {
              player.updateTrack(path, {
                codec: info.codec || '',
                sampleRate: Number(info.sampleRate) || 0,
                bitrate: Number(info.bitrate) || 0,
                size: Number(info.size) || 0,
              })
              return
            }
            if (attempts < 30) {
              attempts += 1
              timer = setTimeout(ask, 600)
            }
          })
          .catch(function () {
            if (cancelled) return
            if (attempts < 15) {
              attempts += 1
              timer = setTimeout(ask, 900)
            }
          })
      }
      ask()
      return function () {
        cancelled = true
        if (timer !== null) clearTimeout(timer)
      }
    },
    [trackPath, track && track.onlineProvider, track && track.onlineId],
  )
  var stagedPair = useState(false)
  var staged = stagedPair[0]
  var setStaged = stagedPair[1]
  useEffect(
    function () {
      if (props.open !== true) {
        setStaged(false)
        return undefined
      }
      // Let the 320ms slide-in finish before starting the wave rAF. Starting it
      // on the entrance frame competes with the paint and makes the page heavier.
      var timer = setTimeout(function () {
        setStaged(true)
      }, 360)
      return function () {
        clearTimeout(timer)
      }
    },
    [props.open],
  )
  var sourceInfoPair = useState(null)
  var sourceInfo = sourceInfoPair[0]
  var setSourceInfo = sourceInfoPair[1]
  // The engine is the authority on what the mode applied (Folia's replayGainAppliedDb).
  var gainMode = prefs.replayGainMode === 'off' || prefs.replayGainMode === 'track' || prefs.replayGainMode === 'album' ? prefs.replayGainMode : 'auto'

  // The local lyric pick depends on these settings; a change re-reads the track.
  // Declared before the effects that use it: a `var` below them would still be undefined
  // when their dependency arrays are built.
  var lyricPriorityKey = (prefs.lyricLocalPriority === 'online' ? 'online' : 'local')
    + '\u0000' + String(prefs.lyricPreferredSource || '')
    // The own-word-timing rule changes which source the upgrade asks: a change re-reads.
    + '\u0000' + (prefs.lyricKeepProviderWordTiming !== false ? 'keep-own' : 'all-sources')
    // A new sidecar order must re-read the current file, not wait for the next track.
    + '\u0000' + (Array.isArray(prefs.lyricFormatOrder) ? prefs.lyricFormatOrder.join(',') : '')

  useEffect(
    function () {
      setSourceInfo(null)
      if (trackPath === '') return undefined
      var cancelled = false
      if (track !== null && track.onlineProvider) {
        // A platform song has no file lyric: its record says "the platform's own" or
        // "the imported one" (Folia's SourceTab for an online track).
        getJson(
          API +
            'online/lyric-state?provider=' +
            encodeURIComponent(track.onlineProvider) +
            '&id=' +
            encodeURIComponent(track.onlineId || ''),
        )
          .then(function (body) {
            if (cancelled) return
            setSourceInfo({
              embedded: false,
              local: false,
              online: true,
              imported: String(body.imported || '') !== '',
              active: body.source === 'imported' ? 'imported' : 'online',
              source: body.source === undefined ? null : body.source,
              markedPureMusic: body.pureMusic === true,
            })
          })
          .catch(function () {
            if (!cancelled) {
              setSourceInfo({ embedded: false, local: false, online: true, imported: false, active: 'online', source: null, markedPureMusic: false })
            }
          })
        return function () {
          cancelled = true
        }
      }
      getJson(API + 'lyrics/sources?path=' + encodeURIComponent(trackPath) + '&priority=' + (prefs.lyricLocalPriority === 'online' ? 'online' : 'local'))
        .then(function (body) {
          if (!cancelled) setSourceInfo(body)
        })
        .catch(function () {
          if (!cancelled) setSourceInfo(null)
        })
      return function () {
        cancelled = true
      }
    },
    [trackPath, lyricReload, lyricPriorityKey],
  )

  // 本地 tab: the timeline offset, the lyric source's name, the lyric text to export.
  var lyricSourceLabel =
    lyricSource === 'embedded'
      ? t('sheet.srcEmbedded')
      : lyricSource === 'lrc' || lyricSource === 'local'
        ? t('sheet.srcLocal')
        : lyricSource === 'online'
          ? t('sheet.srcOnline')
          : lyricSource === 'imported'
            ? t('sheet.srcImported')
            : lyricSource === 'pure'
              ? t('sheet.srcPureMusic')
              : ''
  var lyricsText = lyrics
    .map(function (line) {
      var total = mpLineStart(line) || 0
      var minutes = Math.floor(total / 60)
      var seconds = total % 60
      var stamp =
        '[' + (minutes < 10 ? '0' : '') + String(minutes) + ':' + (seconds < 10 ? '0' : '') + seconds.toFixed(2) + ']'
      var text = stamp + String(line.fullText !== undefined ? line.fullText : line.text || '')
      if (line.translation) text += '\n' + stamp + String(line.translation)
      return text
    })
    .join('\n')

  // The parsed document the lines on screen came from, before the display-time pass:
  // a change of the listener's line rules re-runs that pass on it (Folia's setter does
  // the same, and its `lyricsBeforeRules` keeps the pre-rule lines for exactly this).
  var lyricDocRef = useRef(null)
  // Which priority/preferred-source pair the shared loader was filled with: a change means
  // the resolved lyrics on record may differ now, so its cache is dropped once.
  var lyricPrefsKeyRef = useRef(lyricPriorityKey)
  var lyricRulesKey = mpLyricRulesKey()
  // Folia loads icu-folia's engines lazily and re-bakes the shown lyrics when they land.
  // Armed with the first document that can carry a split; the reload is a module-level
  // one-shot (a per-run flag would re-arm every pass and loop: see the note in CHANGELOG).
  function armIcuFolia() {
    ensureIcuFoliaData().then(function (ready) {
      if (!ready || icuFoliaRebaked) return
      icuFoliaRebaked = true
      setLyricReload(function (value) {
        return value + 1
      })
    })
  }

  useEffect(
    function () {
      if (props.open !== true || trackPath === '') return undefined
      var cancelled = false
      if (lyricPrefsKeyRef.current !== lyricPriorityKey) {
        lyricPrefsKeyRef.current = lyricPriorityKey
        MPLyricLoader.invalidate()
      }
      lyricDocRef.current = null
      setLyrics([])
      setLyricSource('')
      setLyricError('')
      setLyricsLoading(true)
      var current = snap.queue[snap.index]
      // Folia's `autoUseBestLyric` runs in the shared loader once the first lyric is on its
      // way; this is where its replacement lands. The listener is also the diagnostics
      // point: an upgrade is a second lyric load, told apart from the platform's own.
      var unsubscribe = MPLyricLoader.subscribe(trackPath, function (next) {
        if (cancelled || next.upgraded === undefined) return
        setLyrics(next.document === null ? legacyLinesToFolia(next.lyrics) : next.lyrics)
        lyricDocRef.current = next.document === null
          ? null
          : { path: trackPath, document: next.document, chorusRanges: next.chorusRanges }
        if (typeof console !== 'undefined' && typeof console.info === 'function') {
          console.info(
            '[dsh-music] lyric upgrade',
            String((current && current.onlineProvider) || '') + '/' + String((current && current.onlineId) || ''),
            'from=' + String(next.upgraded.source || '') + '/' + String(next.upgraded.id || ''),
            'wordLevel=' + String(next.upgraded.wordLevel === true),
          )
        }
        if (typeof postJson === 'function' && typeof API === 'string') {
          void postJson(API + 'debug/report', {
            kind: 'lyric-upgrade',
            provider: String((current && current.onlineProvider) || ''),
            id: String((current && current.onlineId) || ''),
            from: String(next.upgraded.source || ''),
            fromId: String(next.upgraded.id || ''),
            hadRaw: next.document !== null,
            lines: next.lyrics.length,
          }).catch(function () {})
        }
        if (typeof showToast === 'function') {
          // Folia can settle on a line-level match too (the preferred source's translation,
          // say); only say "word-by-word" when it really is.
          showToast(
            t(next.upgraded.wordLevel === true ? 'sheet.lyricUpgraded' : 'sheet.lyricSwitched', {
              source: mpLyricSourceLabel(next.upgraded.source),
            }),
          )
        }
      })
      async function load() {
        try {
          // One load per song, shared with the player's start gate. Folia resolves the
          // lyric where playback starts, so this asks the same module the gate already
          // did instead of fetching a second copy.
          var loaded = await MPLyricLoader.load(current)
          var lyricsNow = loaded.lyrics
          var usedFolia = loaded.document !== null
          if (current.onlineProvider) {
            // One line of diagnostics per lyric load: if a word-by-word effect is missing,
            // this says whether the client ever received word timings at all.
            if (typeof console !== 'undefined' && typeof console.info === 'function') {
              console.info(
                '[dsh-music] lyric',
                String(current.onlineProvider || '') + '/' + String(current.onlineId || ''),
                'style=' + String(prefs.lyricStyle || ''),
                'lines=' + String(lyricsNow.length),
                'wordLevel=' + String(
                  lyricsNow.filter(function (line) {
                    return line && Array.isArray(line.words) && line.words.length > 1
                  }).length,
                ),
                usedFolia ? '(folia)' : '(legacy)',
              )
            }
            if (typeof postJson === 'function' && typeof API === 'string') {
              void postJson(API + 'debug/report', {
                kind: 'lyric',
                provider: String(current.onlineProvider || ''),
                id: String(current.onlineId || ''),
                style: String((typeof prefs !== 'undefined' && prefs && prefs.lyricStyle) || ''),
                usedFolia: usedFolia,
                hasFolia: typeof MPFoliaLyrics !== 'undefined' && MPFoliaLyrics !== null,
                hasRaw: loaded.document !== null,
                appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
                lines: lyricsNow.length,
                wordLevel: lyricsNow.filter(function (line) {
                  return line && Array.isArray(line.words) && line.words.length > 1
                }).length,
                first: lyricsNow[0]
                  ? {
                      start: mpLineStart(lyricsNow[0]),
                      end: mpLineEnd(lyricsNow[0]),
                      words: Array.isArray(lyricsNow[0].words) ? lyricsNow[0].words.length : 0,
                      text: String((lyricsNow[0].fullText !== undefined ? lyricsNow[0].fullText : lyricsNow[0].text) || '').slice(0, 40),
                    }
                  : null,
              }).catch(function () {})
            }
          }
          // Keep the parsed document: the display-time pass below, and again whenever the
          // listener's line rules change, runs on this rather than a new fetch.
          lyricDocRef.current = loaded.document === null
            ? null
            : { path: trackPath, document: loaded.document, chorusRanges: loaded.chorusRanges }
          // A lyric that is only the pure-music notice, or the song's stored instrumental
          // verdict, is no lyric at all: Folia does not auto-match over it either.
          if (loaded.pureMusic === true) {
            if (!cancelled) {
              setLyrics([])
              setLyricSource('pure')
              setOffsetMs(loaded.offsetMs)
            }
            return
          }
          // icu-folia's engines are armed here so their split lands on this surface too.
          armIcuFolia()
          if (!cancelled) {
            setLyrics(lyricsNow)
            // Folia's SourceTab names the imported lyric separately from the platform's.
            setLyricSource(String(loaded.source || ''))
            setOffsetMs(loaded.offsetMs)
          }
          // The auto-match wrote a new record: refresh the source switcher's data.
          if (loaded.matchedUpdated === true && !cancelled) {
            getJson(
              API +
                'lyrics/sources?path=' +
                encodeURIComponent(current.path) +
                '&priority=' +
                encodeURIComponent(prefs.lyricLocalPriority === 'online' ? 'online' : 'local'),
            )
              .then(function (body) {
                if (!cancelled) setSourceInfo(body)
              })
              .catch(function () {})
          }
          // The loader already asked the other sources for better timing (Folia's
          // `autoUseBestLyric`); a match arrives through the subscription above.
        } catch (error) {
          if (!cancelled) setLyricError(errorText(error))
        } finally {
          if (!cancelled) setLyricsLoading(false)
        }
      }
      load()
      return function () {
        cancelled = true
        // Stops the upgrade notification from reaching this song's UI.
        if (typeof unsubscribe === 'function') unsubscribe()
      }
    },
    [props.open, trackPath, lyricReload, lyricPriorityKey],
  )

  // A change of the listener's line rules re-runs the display pass on the document the
  // lines on screen came from. Folia's setter does the same: the rules run on the
  // pre-rule lines, so changing one never needs another fetch or another parse.
  useEffect(
    function () {
      var saved = lyricDocRef.current
      if (saved === null || saved.path !== trackPath) return
      setLyrics(mpPrepareLyrics(saved.document, saved.path, saved.chorusRanges).lyrics)
    },
    [lyricRulesKey],
  )

  // 存储与备份 → 清空歌词: re-read this song once the files and the loader cache are gone.
  useEffect(
    function () {
      function onLyricsCleared() {
        setLyricReload(function (value) {
          return value + 1
        })
      }
      window.addEventListener('dsh-music:lyrics-cleared', onLyricsCleared)
      return function () {
        window.removeEventListener('dsh-music:lyrics-cleared', onLyricsCleared)
      }
    },
    [],
  )

  // The per-song correction plus Folia's device-wide offset: one clock for every surface.
  var lyricGlobalOffsetMs = Math.max(-2000, Math.min(2000, Number(prefs.lyricGlobalOffsetMs) || 0))
  var lyricNow = lyricClock(time.currentTime, offsetMs, lyricGlobalOffsetMs)
  var active = lyricActiveIndex(lyrics, lyricNow)
  var duration = effectivePlayerDuration(time.duration, track ? track.durationSec : 0)
  var favorite = track !== null && props.favoriteSet[track.path] === true

  function applyOffset(delta) {
    if (!track) return
    var next = Math.max(-60000, Math.min(60000, offsetMs + delta))
    setOffsetMs(next)
    // Remembered per song, exactly as Folia's lyricOffsetMemory does for every track.
    rememberLyricOffset(trackPath, next)
    // Local tracks also keep the host-side offset (and can write it into the file).
    if (track.onlineProvider) return
    postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: next }).catch(function (error) {
      setLyricError(errorText(error))
    })
  }

  function setSleep(minutes) {
    var value = Number(minutes) || 0
    setPrefs({
      sleepTimerMinutes: value,
      sleepDeadline: value > 0 ? Date.now() + value * 60000 : 0,
    })
    setExtraPanel('')
  }

  function toggleFullscreen() {
    var node = npRef.current
    if (node === null) return
    if (document.fullscreenElement === node) {
      exitFullscreenQuietly()
      return
    }
    if (typeof node.requestFullscreen !== 'function') {
      showToast(t('page.fullscreenFailed'))
      return
    }
    try {
      var result = node.requestFullscreen()
      if (result && typeof result.catch === 'function') {
        result.catch(function () {
          showToast(t('page.fullscreenFailed'))
        })
      }
    } catch (error) {
      showToast(t('page.fullscreenFailed'))
    }
  }

  function applySleepCustom() {
    var value = Math.round(Number(sleepCustom))
    if (!Number.isFinite(value) || value < 1 || value > 720) return
    setSleep(value)
  }

  function writeLyricsBack() {
    if (!track || track.onlineProvider) return
    postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: offsetMs, write: true })
      .then(function () {
        setLyricReload(function (value) {
          return value + 1
        })
        showToast(t('page.lyricsSaved'))
      })
      .catch(function (error) {
        setLyricError(errorText(error))
      })
  }

  var lyricSegCount = mpSegmentationLineCount(lyrics, trackPath)

  /**
   * Bake (or drop) this song's saved word split over the lines on screen. A reset goes back
   * to the parsed document so the default split (icu-folia / Intl.Segmenter) returns: the
   * baked boundaries cannot be removed from an already-prepared copy.
   */
  function applyLyricSegmentation(record) {
    if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return
    if (!Array.isArray(lyrics) || lyrics.length === 0) return
    if (record === null) {
      var saved = lyricDocRef.current
      if (saved !== null && saved.path === trackPath) {
        setLyrics(mpPrepareLyrics(saved.document, saved.path, saved.chorusRanges).lyrics)
        return
      }
      setLyrics(
        lyrics.map(function (line) {
          var copy = Object.assign({}, line)
          delete copy.wordSegments
          return copy
        }),
      )
      return
    }
    var next = MPFoliaLyrics.applyLyricWordSegmentation({ lines: lyrics }, record)
    if (next && Array.isArray(next.lines)) setLyrics(next.lines)
  }

  function openLyricSegmentation() {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
      if (typeof showToast === 'function') showToast(t('sheet.lyricSegNoLyrics'))
      return
    }
    pushLayer('lyricSeg', { songKey: trackPath, lyrics: lyrics, onSaved: applyLyricSegmentation })
  }

  function openOnlineLyric() {
    if (!track) return
    // Folia's match window: the pick goes onto the song's record (lyrics) and, if asked,
    // into the file's tags (metadata and cover). An online song has no file, so the same
    // window keeps only the lyric half (`OnlineSongLyricMatch`).
    pushLayer('lyricMatch', {
      track: {
        path: track.path,
        title: trackTitleOf(track),
        artist: trackArtistOf(track),
        album: track.album || '',
        durationSec: Number(track.durationSec) || 0,
        coverUrl: cover,
        markedPureMusic: sourceInfo !== null && sourceInfo.markedPureMusic === true,
        onlineProvider: track.onlineProvider || '',
        onlineId: track.onlineId || '',
      },
      online: Boolean(track.onlineProvider),
      applyToRecord: true,
      onSaved: function () {
        MPLyricLoader.invalidate(track.path)
        setLyricReload(function (value) {
          return value + 1
        })
      },
    })
  }

  useEffect(
    function () {
      if (props.open !== true) setEditorOpen(false)
    },
    [props.open],
  )

  useEffect(
    function () {
      function onChange() {
        setIsFullscreen(typeof document !== 'undefined' && document.fullscreenElement === npRef.current)
      }
      onChange()
      document.addEventListener('fullscreenchange', onChange)
      return function () {
        document.removeEventListener('fullscreenchange', onChange)
        if (document.fullscreenElement === npRef.current) exitFullscreenQuietly()
      }
    },
    [],
  )

  useEffect(
    function () {
      if (props.open !== true && document.fullscreenElement === npRef.current) {
        exitFullscreenQuietly()
      }
    },
    [props.open],
  )

  function toggleLyricSettings() {
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }
    var np = npRef.current
    var btn = settingsBtnRef.current
    if (np !== null && btn !== null) {
      var nr = np.getBoundingClientRect()
      var br = btn.getBoundingClientRect()
      var width = Math.min(320, Math.max(240, nr.width - 24))
      var left = Math.max(12, Math.min(br.left - nr.left, nr.width - width - 12))
      var bottom = Math.max(12, nr.bottom - br.top + 10)
      setSettingsPos({ left: left, bottom: bottom, width: width })
    }
    setSettingsOpen(true)
  }

  // Folia puts the player panel behind one round button at the page's bottom-right.
  // The old "词" badge next to the translation toggle was the same panel; this is the
  // same trigger, moved out of the lyrics column so it is always reachable.
  function togglePlayerSheet() {
    if (sheetOpen) {
      setSheetOpen(false)
      return
    }
    var element = wordBtnRef.current
    if (element !== null && typeof element.getBoundingClientRect === 'function') {
      var rect = element.getBoundingClientRect()
      setSheetAnchor({
        right: Math.max(8, window.innerWidth - rect.right),
        bottom: Math.max(8, window.innerHeight - rect.top + 10),
      })
    }
    setSheetOpen(true)
  }

  // Folia seeds the visualizer with the displayed song's identity, not its
  // storage path (App.tsx: visualizerGeometrySeed = displaySong.id). Hanabi and
  // Lumiere use that seed for every deterministic layout choice; feeding them
  // "online:provider:id" instead of the provider's id selects different
  // variants, including vertical lyric layouts. Keep path only as a fallback
  // for tracks that do not expose a platform id.
  var visualizerSeed = track === null
    ? ''
    : track.onlineProvider
      ? String(track.onlineId || track.path || '')
      : String(track.id || track.path || '')
  var foliaBackdrop = h(FoliaBackgroundHost, {
    mode: mpLookId(MP_BG_MODES, prefs.bgMode),
    cover: cover,
    accent: flowAccent,
    seed: visualizerSeed,
    url: typeof prefs.bgUrl === 'string' ? prefs.bgUrl : '',
    latentDisplayMode: prefs.latentDisplayMode,
    latentColorSource: prefs.latentColorSource,
  })
  // 外观 · 随机: the page paints one concrete style per slice of the song. The same
  // resolved id drives both the stage and the `mp-style-*` class, so CSS variants and
  // the renderer never disagree. The clock is the raw playback position, not the
  // lyric offset, so a lyric nudge does not move the style boundaries.
  var lyricStyleId = mpResolveLyricStyle(prefs.lyricStyle, {
    seed: visualizerSeed,
    time: Number(time.currentTime) || 0,
    duration: duration,
  })
  var lyricStage = h(LyricStage, {
    lines: lyrics,
    // The stage builds its own clock from the player's position; hand it the combined
    // correction so the word sweep and the active line both honour the global offset.
    offsetMs: offsetMs + lyricGlobalOffsetMs,
    active: active,
    now: lyricNow,
    prefs: prefs,
    stylePref: lyricStyleId,
    seed: visualizerSeed,
    accent: mpAccentCss(flowAccent),
    coverUrl: cover,
    title: track && track.title ? track.title : '',
    artist: track && track.artist ? track.artist : '',
    album: track && track.album ? track.album : '',
    duration: Number(snap.duration) || (track && Number(track.durationSec)) || 0,
  })
  return h(
    'div',
    {
      className: cx(
        'mp-np',
        props.open === true && 'is-open',
        isFullscreen && 'is-fs',
        // 外观: the lyric style and backdrop mode come from the registry. A random
        // preference has already been resolved to a concrete id for this slice.
        'mp-style-' + lyricStyleId,
        // A visualizer style is a full stage (Folia's VisualizerShell): the cover
        // column steps aside and the lyrics take the whole page.
        lyricStyleId !== 'classic' && 'is-visualizer',
        chromeVisible !== true && 'is-chrome-hidden',
        'mp-bgmode-' + mpLookId(MP_BG_MODES, prefs.bgMode),
      ),
      ref: npRef,
      role: 'dialog',
      'aria-label': t('page.openPlayer'),
      'aria-hidden': props.open === true ? 'false' : 'true',
      style: {
        '--mp-lyric-w': lyricWidth + 'px',
        '--mp-pane-gap-w': paneGap + 'px',
        '--mp-look-accent': mpLookAccent(prefs, flowAccent),
      },
    },
    foliaBackdrop,
    h('div', { className: 'mp-np-shade' }),
    h(
      'div',
      { className: 'mp-np-head' },
      h(IconButton, { icon: 'chevronDown', size: 20, title: t('page.closePlayer'), onClick: props.onClose }),
    ),
    h(
      'div',
      { className: 'mp-np-fs' },
      h(IconButton, {
        icon: isFullscreen ? 'minimize' : 'maximize',
        size: 18,
        title: isFullscreen ? t('page.exitFullscreen') : t('page.fullscreen'),
        onClick: toggleFullscreen,
      }),
    ),
    settingsOpen
      ? h(NpSettingsPanel, {
          settingsRef: settingsRef,
          settingsPos: settingsPos,
          prefs: prefs,
          setPrefs: setPrefs,
          track: track,
          offsetMs: offsetMs,
          applyOffset: applyOffset,
          writeLyricsBack: writeLyricsBack,
          openOnlineLyric: openOnlineLyric,
        })
      : null,
    h(
      'div',
      { className: 'mp-np-body' },
      h(
        'div',
        { className: 'mp-np-left' },
        h(
          'div',
          { className: 'mp-np-meta', ref: metaMotionRef },
          h(
            'div',
            { key: 'title:' + trackPath, className: 'mp-np-title' },
            track ? trackTitleOf(track) : '—',
          ),
          h(
            'div',
            { key: 'artist:' + trackPath, className: 'mp-np-artist-row' },
            h('div', { className: 'mp-np-artist' }, track ? trackArtistOf(track) : ''),
            h(IconButton, {
              className: 'mp-np-meta-audio',
              icon: snap.muted ? 'mute' : 'volume',
              size: 20,
              active: snap.muted === true,
              title: t('page.volume'),
              onClick: function () {
                player.setMuted(!snap.muted)
              },
            }),
          ),
        ),
        h(
          'div',
          { className: 'mp-np-cover-stage', ref: coverMotionRef },
          h(
            'div',
            { key: 'cover:' + trackPath, className: 'mp-np-disc-wrap' },
          h(
            'div',
            { className: 'mp-np-disc' },
            h(
              'div',
              { className: 'mp-np-art' },
              cover !== ''
                ? h('img', { src: cover, alt: '', draggable: false, ref: coverImgRef })
                : icon('note', 96),
            ),
          ),
        ),
        ),
        h(
          'div',
          { className: 'mp-np-quality' },
          h('span', { className: 'mp-np-quality-name' }, 'AudioTrack'),
          track && track.codec ? h('span', null, track.codec) : null,
          track && track.sampleRate ? h('span', null, fmtKhz(track.sampleRate)) : null,
          track && track.bitrate ? h('span', null, fmtKbps(track.bitrate)) : null,
          track && track.qualityHint ? h('span', null, track.qualityHint) : null,
        ),
        h(NpTransportPill, {
          cover: cover,
          snap: snap,
          prefs: prefs,
          track: track,
          duration: duration,
          time: time,
          staged: staged,
          coverImgRef: coverImgRef,
        }),
        h(NpSecondaryActions, {
          extraPanel: extraPanel,
          setExtraPanel: setExtraPanel,
          sleepRef: sleepRef,
          audioRef: audioRef,
          prefs: prefs,
          sleepCustom: sleepCustom,
          setSleepCustom: setSleepCustom,
          sleepRemaining: sleepRemaining,
          applySleepCustom: applySleepCustom,
          setSleep: setSleep,
          snap: snap,
          track: track,
          onToggleQueue: toggleQueue,
          setSettingsOpen: setSettingsOpen,
          setEditorOpen: setEditorOpen,
        }),
      ),
      h('div', {
        className: 'mp-np-split',
        'data-side': 'left',
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': t('page.lyricWidth'),
        'aria-valuemin': 360,
        'aria-valuemax': 900,
        'aria-valuenow': lyricWidth,
        title: t('page.lyricWidth'),
        tabIndex: 0,
        onPointerDown: function (event) {
          beginLyricResize(event, 'left')
        },
        onKeyDown: onLyricSplitKey,
        onDoubleClick: function () {
          applyLyricWidth(560, true)
        },
      }),
      h(
        'div',
        { className: 'mp-np-right' },
        lyricStage,
      ),
      h(NowPlayingCapsule, { onToggleQueue: toggleQueue }),
      h(
        'div',
        { className: cx('mp-np-handle', sheetOpen && 'is-on') },
        h('div', { className: 'mp-np-handle-track', 'aria-hidden': 'true' }, icon('equalizer', 14)),
        h(
          'button',
          {
            type: 'button',
            ref: wordBtnRef,
            className: 'mp-np-handle-btn',
            title: t('page.settings'),
            'aria-label': t('page.settings'),
            'aria-expanded': sheetOpen ? 'true' : 'false',
            onClick: togglePlayerSheet,
          },
          icon('equalizer', 20),
        ),
      ),
      // Always mounted: AnimatePresence needs the child present to play the exit.
      h(PlayerSheet, {
            open: sheetOpen,
            // Same cover the page itself shows (local file cover or the provider's).
            cover: track === null ? '' : trackCoverSrc(track),
            songTitle: track ? trackTitleOf(track) : '',
            // One SongLike for both kinds of track (see src/47-likes.js).
            like: likeStateOf(track, props.favoriteSet),
            canLocate: track !== null,
            offsetMs: offsetMs,
            onOffsetChange: setOffsetMs,
            lyricSourceLabel: lyricSourceLabel,
            lyricsText: lyricsText,
            lyricsPath: trackPath,
            onLyricsSaved: function () {
              MPLyricLoader.invalidate(trackPath)
              setLyricReload(lyricReload + 1)
            },
            accentCss: mpAccentCss(flowAccent),
            gainAutoEstimated: snap.gainEstimated === true,
            gainAvailable: snap.gainAvailable === true,
            gainMode: gainMode,
            gainAppliedDb: typeof snap.gainAppliedDb === 'number' ? snap.gainAppliedDb : null,
            onGainModeChange: function (next) {
              // The panel writes the mode; the engine applies it at once (Folia's store select).
              if (player && typeof player.setGainMode === 'function') player.setGainMode(next)
              else setPrefs({ replayGainMode: next })
            },
            lyricSources: sourceInfo,
            // Folia keeps the choice on the song, not in a global setting: each switch
            // writes the record through the Host and the panel re-reads this track.
            onSwitchLyricSource: function (key) {
              var isOnline = track !== null && Boolean(track.onlineProvider)
              var request
              if (isOnline) {
                var record = {
                  provider: String(track.onlineProvider),
                  id: String(track.onlineId || ''),
                }
                request = key === 'pure'
                  ? postJson(API + 'online/lyric-choice', Object.assign({}, record, { pureMusic: true }))
                  : postJson(API + 'online/lyric-choice', Object.assign({}, record, { source: key === 'imported' ? 'imported' : 'online' }))
              } else {
                request = key === 'pure'
                  ? postJson(API + 'lyrics/pure-music', { path: trackPath, marked: true })
                  : postJson(API + 'lyrics/choice', { path: trackPath, source: key })
              }
              request
                .then(function () {
                  MPLyricLoader.invalidate(trackPath)
                  setLyricReload(function (value) {
                    return value + 1
                  })
                })
                .catch(function (error) {
                  if (typeof showToast === 'function') showToast(errorText(error))
                })
            },
            onResetLyricSource: function () {
              var request = track !== null && track.onlineProvider
                ? postJson(API + 'online/lyric-choice', {
                    provider: String(track.onlineProvider),
                    id: String(track.onlineId || ''),
                    source: null,
                  })
                : postJson(API + 'lyrics/choice', { path: trackPath, source: 'auto' })
              request
                .then(function () {
                  MPLyricLoader.invalidate(trackPath)
                  setLyricReload(function (value) {
                    return value + 1
                  })
                })
                .catch(function (error) {
                  if (typeof showToast === 'function') showToast(errorText(error))
                })
            },
            lyricSegCount: lyricSegCount,
            onOpenLyricSegmentation: openLyricSegmentation,
            onOpenLyricFile: function () {
              pushLayer('lyricFile', {
                path: trackPath,
                name: (trackPath.split(/[\\/]/).pop() || 'lyrics').replace(/\.[^.]+$/, ''),
                text: lyricsText,
                // An online song imports onto its record; there is no file to write.
                online: track !== null && track.onlineProvider
                  ? { provider: String(track.onlineProvider), id: String(track.onlineId || '') }
                  : null,
                onSaved: function () {
                  MPLyricLoader.invalidate(trackPath)
                  setLyricReload(lyricReload + 1)
                },
              })
            },
            anchor: sheetAnchor,
            onClose: function () {
              setSheetOpen(false)
            },
            track: track,
            favoriteSet: props.favoriteSet,
            onOpenLyricSettings: toggleLyricSettings,
            onAction: function (key) {
              if (key === 'favorite') {
                if (track !== null) toggleLikeTrack(track)
                return
              }
              if (key === 'addToPlaylist') {
                setSheetOpen(false)
                if (track === null) return
                if (track.onlineProvider) {
                  pushLayer('onlineAddTo', { provider: track.onlineProvider, song: track })
                } else {
                  pushLayer('addTo', { paths: [track.path] })
                }
                return
              }
              if (key === 'locate') {
                setSheetOpen(false)
                if (typeof props.onLocate === 'function') props.onLocate()
                return
              }
              if (key === 'home') {
                setSheetOpen(false)
                if (typeof props.onHome === 'function') props.onHome()
                return
              }
              if (key === 'settings') {
                setSheetOpen(false)
                if (typeof props.onOpenSettings === 'function') props.onOpenSettings()
                return
              }
              if (key === 'lyricSettings') {
                toggleLyricSettings()
                return
              }
              if (key === 'matchOnline') {
                // The 本地 tab's "在线匹配" row: open the match window over the panel.
                // Folia keeps this entry for online songs too (`OnlineSongLyricMatch`);
                // there it only writes the song's lyric record.
                setSheetOpen(false)
                if (track !== null) {
                  pushLayer('lyricMatch', {
                    track: {
                      path: track.path,
                      title: trackTitleOf(track),
                      artist: trackArtistOf(track),
                      album: track.album || '',
                      durationSec: Number(track.durationSec) || 0,
                      coverUrl: cover,
                      markedPureMusic: sourceInfo !== null && sourceInfo.markedPureMusic === true,
                      onlineProvider: track.onlineProvider || '',
                      onlineId: track.onlineId || '',
                    },
                    online: Boolean(track.onlineProvider),
                    applyToRecord: true,
                    onSaved: function () {
                      MPLyricLoader.invalidate(track.path)
                      setLyricReload(function (value) {
                        return value + 1
                      })
                    },
                  })
                }
                return
              }
              // The remaining actions only close the card; their destinations live
              // outside the player.
              setSheetOpen(false)
            },
          }),
      h('div', {
        className: 'mp-np-split',
        'data-side': 'right',
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': t('page.lyricWidth'),
        'aria-valuemin': 360,
        'aria-valuemax': 900,
        'aria-valuenow': lyricWidth,
        title: t('page.lyricWidth'),
        tabIndex: 0,
        onPointerDown: function (event) {
          beginLyricResize(event, 'right')
        },
        onKeyDown: onLyricSplitKey,
        onDoubleClick: function () {
          applyLyricWidth(560, true)
        },
      }),
    ),
    editorOpen
      ? h(NpEditor, {
          open: true,
          cover: cover,
          title: track ? trackTitleOf(track) : '',
          artist: track ? trackArtistOf(track) : '',
          onClose: function () {
            setEditorOpen(false)
          },
        })
      : null,
    // One queue implementation: the panel queue, popped out beside the control that
    // opened it. Opening it must not leave the player page.
    props.queueOpen === true
      ? h(P3Queue, {
          open: true,
          floating: true,
          style: queuePopoverStyle(queueAnchor),
          onClose: function () { props.onToggleQueue() },
          onLocate: function () {
            if (typeof props.onLocate === 'function') props.onLocate()
            props.onToggleQueue()
          },
        })
      : null,
  )
}



