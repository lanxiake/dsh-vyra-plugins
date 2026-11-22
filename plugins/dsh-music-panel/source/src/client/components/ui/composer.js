/**
 * composer seats: the inline lyric line and the single queue button next to the chat
 * input. Both are optional and disappear when nothing is playing.
 */

function firstComposerTranslation(value) {
  var parts = String(value || '').split(/\r?\n/)
  for (var i = 0; i < parts.length; i += 1) {
    var text = parts[i].trim()
    if (text !== '') return text
  }
  return ''
}

/** The strip reads {time, text, translation}; Folia's lines carry the same data. */
function composerLyricRows(lines) {
  return (Array.isArray(lines) ? lines : []).map(function (line) {
    return {
      time: mpLineStart(line),
      text: String(line.fullText !== undefined ? line.fullText : line.text || ''),
      translation: typeof line.translation === 'string' ? line.translation : '',
    }
  })
}

function composerLyricContent(entry) {
  var translation = firstComposerTranslation(entry.translation)
  return [
    h('span', { key: 'main', className: 'mp-composer-lyric-main' }, entry.text),
    translation
      ? h('span', { key: 'trans', className: 'mp-composer-lyric-trans' }, translation)
      : null,
  ]
}

function ComposerLyricText(props) {
  var line = props.line
  var showTranslation = props.showTranslation === true
  var text = line ? line.text : props.fallback
  var translation = showTranslation && line ? firstComposerTranslation(line.translation) : ''
  var key = (props.index >= 0 ? props.index : 'fallback') + '|' + text + '|' + translation
  var pair = useState(function () {
    return { current: { key: key, text: text, translation: translation }, previous: null }
  })
  var view = pair[0]
  var setView = pair[1]
  useEffect(
    function () {
      setView(function (previous) {
        if (previous.current && previous.current.key === key) return previous
        return {
          current: { key: key, text: text, translation: translation },
          previous: previous.current,
        }
      })
    },
    [key, text, translation],
  )
  var current = view.current
  var leaving = view.previous
  return h(
    'span',
    { className: 'mp-composer-lyric-viewport' },
    leaving
      ? h(
          'span',
          { key: 'out-' + leaving.key, className: 'mp-composer-lyric-layer is-leaving', 'aria-hidden': 'true' },
          composerLyricContent(leaving),
        )
      : null,
    h(
      'span',
      { key: 'in-' + current.key, className: 'mp-composer-lyric-layer is-entering' },
      composerLyricContent(current),
    ),
  )
}

function ComposerLyrics() {
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var track = snap.queue[snap.index] || null
  var trackPath = track ? track.path : ''
  var pair = useState([])
  var lines = pair[0]
  var setLines = pair[1]
  var offsetPair = useState(0)
  var lyricOffsetMs = offsetPair[0]
  var setLyricOffsetMs = offsetPair[1]
  // The parsed document the strip's lines came from: a change of the line filters re-runs
  // the display pass on it, exactly as the player page does.
  var docRef = useRef(null)
  var lyricRulesKey = mpLyricRulesKey()
  // The same source settings the player page reloads for: the strip follows the same lyric.
  var lyricSourceKey = (prefs.lyricLocalPriority === 'online' ? 'online' : 'local')
    + '\u0000' + String(prefs.lyricPreferredSource || '')
    + '\u0000' + (prefs.lyricKeepProviderWordTiming !== false ? 'keep-own' : 'all-sources')
    + '\u0000' + (Array.isArray(prefs.lyricFormatOrder) ? prefs.lyricFormatOrder.join(',') : '')
  var lastSourceKeyRef = useRef(null)
  var reloadPair = useState(0)
  var lyricReload = reloadPair[0]
  var setLyricReload = reloadPair[1]

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

  useEffect(
    function () {
      if (prefs.composerLyrics !== true || trackPath === '') {
        setLines([])
        setLyricOffsetMs(0)
        docRef.current = null
        return undefined
      }
      var cancelled = false
      // A changed source setting invalidates the shared load before reading it again.
      if (lastSourceKeyRef.current !== null && lastSourceKeyRef.current !== lyricSourceKey) {
        MPLyricLoader.invalidate(trackPath)
      }
      lastSourceKeyRef.current = lyricSourceKey
      var active = snap.queue[snap.index]
      if (!active) return undefined
      var unsubscribe = MPLyricLoader.subscribe(trackPath, function (next) {
        if (cancelled || next.upgraded === undefined) return
        docRef.current = next.document === null
          ? null
          : { document: next.document, chorusRanges: next.chorusRanges }
        setLyricOffsetMs(Number(next.offsetMs) || 0)
        setLines(composerLyricRows(next.lyrics))
      })
      async function load() {
        try {
          // One resolved lyric for every surface: the strip follows the same source the
          // stage and the player card show, including a matched or imported online lyric.
          var loaded = await MPLyricLoader.load(active)
          if (cancelled) return
          docRef.current = loaded.document === null
            ? null
            : { document: loaded.document, chorusRanges: loaded.chorusRanges }
          setLyricOffsetMs(Number(loaded.offsetMs) || 0)
          setLines(composerLyricRows(loaded.lyrics))
        } catch (error) {
          if (!cancelled) setLines([])
        }
      }
      load()
      return function () {
        cancelled = true
        if (typeof unsubscribe === 'function') unsubscribe()
      }
    },
    [prefs.composerLyrics, trackPath, lyricSourceKey, lyricReload],
  )

  // A changed line filter re-bakes the strip from the same document (no new request).
  useEffect(
    function () {
      var saved = docRef.current
      if (saved === null || trackPath === '') return
      setLines(composerLyricRows(mpPrepareLyrics(saved.document, trackPath, saved.chorusRanges).lyrics))
    },
    [lyricRulesKey],
  )

  if (prefs.composerLyrics !== true || track === null) return null
  // Same clock as the player page: the lyric record's per-song offset plus the global one.
  var index = lyricActiveIndex(
    lines,
    lyricClock(time.currentTime, lyricOffsetMs, prefs.lyricGlobalOffsetMs),
  )
  var line = index >= 0 ? lines[index] : null
  return h(
    'div',
    { className: 'mp-composer-lyrics' },
    h('span', { className: 'mp-composer-lyric-icon' }, icon('note', 12)),
    h(ComposerLyricText, {
      line: line,
      index: index,
      fallback: trackTitleOf(track),
      showTranslation:
        prefs.composerTranslation !== false && prefs.showTranslation === true,
    }),
  )
}

/**
 * Where the composer's queue pops out: above the bar, its right edge on the button's, clamped
 * into the window. Folia's rule for every queue surface — opening it must not move the page.
 */
function composerQueueStyle(rect) {
  var viewportWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1400
  var viewportHeight = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 900
  var width = Math.min(340, viewportWidth - 16)
  var right = rect ? Math.max(8, viewportWidth - rect.right) : 16
  var bottom = rect ? Math.max(8, viewportHeight - rect.top + 8) : 56
  return {
    // A popover opens in the top layer, whose margin:auto/inset:0 must be reset here.
    inset: 'auto',
    position: 'fixed',
    left: 'auto',
    right: right + 'px',
    top: 'auto',
    bottom: bottom + 'px',
    width: width + 'px',
    margin: 0,
    padding: 0,
    border: 0,
    background: 'transparent',
    overflow: 'visible',
    color: 'inherit',
  }
}

/**
 * The queue beside the composer, in the top layer.
 *
 * The chat input is the host's DOM: an ancestor with a transform or a backdrop-filter would
 * turn `position: fixed` into "fixed to that box" and clip the popover. Promoting the element
 * with the HTML popover API escapes that box (Chromium), and a browser without it simply
 * ignores the attribute — the same element then sits at the fixed coordinates.
 */
function ComposerQueuePopover(props) {
  var ref = useRef(null)
  useEffect(function () {
    var node = ref.current
    if (node === null || typeof node.showPopover !== 'function') return
    if (typeof node.matches === 'function' && node.matches(':popover-open')) return
    try {
      node.showPopover()
    } catch (error) {
      // Already open, or refused: the fixed coordinates still place it.
    }
  }, [])
  return h(
    'div',
    {
      ref: ref,
      popover: 'manual',
      className: 'mp-composer-queue-pop',
      style: composerQueueStyle(props.rect),
    },
    props.children,
  )
}

/**
 * The composer seat is one control: the current track's queue button. It opens the queue
 * beside itself — the page does not move (Folia's rule for every queue surface). Pause and
 * resume live one row above in the sidebar transport, which is always visible.
 */
function ComposerCluster() {
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  var anchorPair = useState(null)
  var anchor = anchorPair[0]
  var setAnchor = anchorPair[1]
  var openPair = useState(false)
  var open = openPair[0]
  var setOpen = openPair[1]
  var track = snap.queue[snap.index] || null
  useEffect(function () {
    if (!open) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return function () {
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  if (prefs.composerListButton === false || track === null) return null

  function toggle(event) {
    var el = event && event.currentTarget
    if (el && typeof el.getBoundingClientRect === 'function') setAnchor(el.getBoundingClientRect())
    setOpen(!open)
  }

  return h(
    'div',
    { className: 'mp-composer-cluster' },
    h(
      'button',
      {
        type: 'button',
        className: cx('mp-cbtn', open && 'is-on'),
        'data-queue-toggle': 'true',
        'aria-expanded': open ? 'true' : 'false',
        title: t('page.queue'),
        onClick: toggle,
      },
      icon('playlist', 14),
      h('span', null, trackTitleOf(track)),
    ),
    open
      ? h(
          ComposerQueuePopover,
          { rect: anchor },
          h(P3Queue, {
            open: true,
            style: { position: 'static', right: 'auto', bottom: 'auto', width: '100%', maxHeight: 'min(560px, 60vh)' },
            onClose: function () {
              setOpen(false)
            },
            onLocate: function () {
              // The one action that does move: the panel's queue, at the current track.
              setOpen(false)
              p3OpenQueue()
            },
          }),
        )
      : null,
  )
}

