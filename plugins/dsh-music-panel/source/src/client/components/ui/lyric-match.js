/**
 * 匹配歌词 — the manual lyric-match window, laid out from Folia's
 * `LyricMatchWindow` and drawn with the plugin's DSH primitives:
 *
 *   host modal  KitModal(headless) — focus, Escape and stacking
 *   window      .mp-lym-window, 62% search/results | 38% preview
 *   header      title, song line, file (or "streaming track, no local file")
 *   footer      no-match / instrumental actions, cancel / save
 *
 * The window opens on the song title and searches immediately.
 * An online song picks the first result (Folia's pickOnlineResult); a local song
 * waits for a click. The right panel shows the song itself until a result is
 * picked, then the picked result's cover, names and lyric.
 */

function lyricMatchTitle(target) {
  var title = String(target.title || '').trim()
  var artist = String(target.artist || '').trim()
  if (title === '' || artist === '') return title
  var separator = title.match(/^(.+?)\s+-\s+(.+)$/u)
  if (separator === null) return title
  var normalize = function (value) { return String(value || '').toLowerCase().replace(/[\s\-_/]/g, '') }
  return normalize(separator[1]) === normalize(artist) ? separator[2].trim() : title
}

/**
 * The search box starts on the song title alone: providers search on one string, and
 * "title - artist - album" buries the title in a query they do not split the same way.
 * Artist/album/duration still go along as metadata, so ranking keeps using them.
 */
function lyricMatchSongQuery(target) {
  return lyricMatchTitle(target)
}

function lyricMatchSourceLabel(entry) {
  var id = entry && entry.id ? String(entry.id) : ''
  var key = 'lyricSource.' + id
  var translated = t(key)
  if (translated !== key) return translated
  return entry && entry.label ? String(entry.label) : id
}

function lyricMatchPickResult(results, track, onlineTrack) {
  if (!onlineTrack || !Array.isArray(results) || results.length === 0) return null
  if (track && track.onlineProvider === 'navidrome') {
    var wanted = String(track.title || '').trim().toLowerCase()
    for (var index = 0; index < results.length; index += 1) {
      if (String(results[index].title || '').trim().toLowerCase() === wanted) return results[index]
    }
  }
  return results[0]
}

function LyricMatchDialog(props) {
  var layer = props.layer
  var track = (layer.props && layer.props.track) || {}
  var onApply = (layer.props && (layer.props.onApply || layer.props.onApplied)) || null
  var closeSheet = typeof props.onClose === 'function' ? props.onClose : popLayer

  var sourcesPair = useState([])
  var sources = sourcesPair[0]
  var setSources = sourcesPair[1]
  var sourcePair = useState('netease')
  var source = sourcePair[0]
  var setSource = sourcePair[1]
  var queryPair = useState('')
  var query = queryPair[0]
  var setQuery = queryPair[1]
  var resultsPair = useState([])
  var results = resultsPair[0]
  var setResults = resultsPair[1]
  var selectedPair = useState(null)
  var selected = selectedPair[0]
  var setSelected = selectedPair[1]
  var previewPair = useState(null)
  var preview = previewPair[0]
  var setPreview = previewPair[1]
  var phasePair = useState('idle')
  var phase = phasePair[0]
  var setPhase = phasePair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  var savingPair = useState(false)
  var saving = savingPair[0]
  var setSaving = savingPair[1]
  var pureSavingPair = useState(false)
  var pureSaving = pureSavingPair[0]
  var setPureSaving = pureSavingPair[1]
  var markedPurePair = useState(track.markedPureMusic === true)
  var markedPureMusic = markedPurePair[0]
  var setMarkedPureMusic = markedPurePair[1]
  var embedPair = useState(true)
  var embedTags = embedPair[0]
  var setEmbedTags = embedPair[1]

  // Folia's three toggles under the cover; they only exist for a local file
  // whose match can also write tags. An online song only picks lyrics.
  var applyToRecord = layer.props && layer.props.applyToRecord === true
  var onlineTrack = layer.props && layer.props.online === true
  var embeddable = onlineTrack !== true && /\.(mp3|flac)$/i.test(String(track.path || ''))
  var coverPair = useState(onlineTrack !== true)
  var useCover = coverPair[0]
  var setUseCover = coverPair[1]
  var metadataPair = useState(false)
  var useMetadata = metadataPair[0]
  var setUseMetadata = metadataPair[1]
  var lyricsPair = useState(true)
  var useLyrics = lyricsPair[0]
  var setUseLyrics = lyricsPair[1]

  var target = {
    title: String(track.title || '').trim(),
    artist: String(track.artist || '').trim(),
    album: String(track.album || '').trim(),
    durationMs: (Number(track.durationSec) || 0) * 1000,
  }
  var songQuery = lyricMatchSongQuery(target)
  var initialQueryRef = useRef(songQuery)
  var searchSeq = useRef(0)
  var previewSeq = useRef(0)

  var FALLBACK_SOURCES = [
    { id: 'netease', label: 'NetEase Cloud Music' },
    { id: 'amll', label: 'AMLLDB' },
    { id: 'qq', label: 'QQ Music' },
    { id: 'kugouLite', label: 'KuGou Music' },
    { id: 'qishui', label: 'Qishui Music' },
  ]

  // Opens on the same text it shows (the song title) and searches without waiting for a
  // click. Source availability comes from the Host.
  useEffect(function () {
    setQuery(initialQueryRef.current)
    runSearch(initialQueryRef.current, 'netease')
    getJson(API + 'lyric-match/sources')
      .then(function (body) {
        var list = Array.isArray(body.sources) ? body.sources : []
        setSources(list.length > 0 ? list : FALLBACK_SOURCES)
      })
      .catch(function () {
        setSources(FALLBACK_SOURCES)
      })
  }, [])

  function clearSelection() {
    setResults([])
    setSelected(null)
    setPreview(null)
  }

  function loadPreview(candidate) {
    var seq = ++previewSeq.current
    setPreview(null)
    getJson(
      API +
        'lyric-match/preview?source=' +
        encodeURIComponent(candidate.source) +
        '&id=' +
        encodeURIComponent(candidate.id) +
        (candidate.platform ? '&platform=' + encodeURIComponent(candidate.platform) : ''),
    )
      .then(function (body) {
        if (seq === previewSeq.current) setPreview(body)
      })
      .catch(function (previewError) {
        if (seq === previewSeq.current) setPreview({ lrc: '', error: errorText(previewError) })
      })
  }

  function choose(candidate) {
    setSelected(candidate)
    loadPreview(candidate)
  }

  function runSearch(nextQuery, nextSource) {
    var text = String(nextQuery === undefined ? query : nextQuery).trim()
    if (text === '') return
    var activeSource = nextSource || source
    var seq = ++searchSeq.current
    setPhase('loading')
    setError('')
    setSelected(null)
    setPreview(null)
    setResults([])
    getJson(
      API +
        'lyric-match/search?source=' +
        encodeURIComponent(activeSource) +
        '&q=' +
        encodeURIComponent(text) +
        '&title=' +
        encodeURIComponent(target.title) +
        '&artist=' +
        encodeURIComponent(target.artist) +
        '&album=' +
        encodeURIComponent(target.album) +
        '&duration=' +
        encodeURIComponent(String(Math.round(target.durationMs / 1000))),
    )
      .then(function (body) {
        if (seq !== searchSeq.current) return
        var list = Array.isArray(body.candidates) ? body.candidates : []
        setResults(list)
        if (body.error) setError(String(body.error))
        var picked = lyricMatchPickResult(list, track, onlineTrack)
        if (picked) choose(picked)
        setPhase('ready')
      })
      .catch(function (searchError) {
        if (seq !== searchSeq.current) return
        setError(errorText(searchError))
        setPhase('error')
      })
  }

  function chooseSource(nextSource) {
    if (nextSource === source) return
    setSource(nextSource)
    clearSelection()
    setError('')
    // Folia's online/Navidrome variants reset the box to the song's own query on
    // a source change; a local file keeps what the listener typed.
    var text = onlineTrack ? initialQueryRef.current : query
    if (onlineTrack) setQuery(initialQueryRef.current)
    runSearch(text, nextSource)
  }

  function linesOf(body) {
    if (body === null) return []
    if (Array.isArray(body.lines) && body.lines.length > 0) {
      return body.lines.map(function (line) {
        return { text: String(line.text || ''), translation: '' }
      })
    }
    return parseLrcText(body.lrc || '')
  }

  /**
   * The text written into a file tag. A word-timed source becomes enhanced LRC
   * (`[line]<word>text...`), the only word timeline our local parser can read back
   * from USLT / FLAC LYRICS. Line-level sources stay plain LRC.
   */
  function embeddableLyricsText(body) {
    if (body === null || typeof body !== 'object') return ''
    var lrc = typeof body.lrc === 'string' ? body.lrc : ''
    if (body.wordLevel !== true) {
      var plain = linesOf(body)
      if (body.translation) mergeLyricTranslation(plain, body.translation)
      return body.translation ? buildTranslatedLrc(plain, lrc) : lrc
    }
    if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null
      || typeof MPFoliaLyrics.serializeEnhancedLrc !== 'function'
      || typeof legacyLinesToFolia !== 'function') return lrc
    try {
      var lines = Array.isArray(body.lines) && body.lines.length > 0
        ? body.lines.map(function (line) {
            var copy = Object.assign({}, line)
            if (!isFinite(Number(copy.time)) && isFinite(Number(copy.t))) copy.time = Number(copy.t)
            return copy
          })
        : parseLrcText(lrc)
      if (body.translation) mergeLyricTranslation(lines, body.translation)
      var document = { lines: legacyLinesToFolia(lines), isWordByWord: true }
      var text = MPFoliaLyrics.serializeEnhancedLrc(document, {
        includeTranslation: true,
        includeRomanization: true,
        wordTiming: 'word',
      })
      return typeof text === 'string' && text.trim() !== '' ? text : lrc
    } catch (error) {
      return lrc
    }
  }

  function canSave() {
    if (saving) return false
    if (selected === null) return false
    if (onlineTrack) return preview !== null && String(preview.lrc || '').trim() !== ''
    if (useLyrics && (preview === null || String(preview.lrc || '').trim() === '')) return false
    return useLyrics || (useMetadata && selectedHasMetadata) || (useCover && selectedHasCover)
  }

  function finishSaved(answer, message) {
    setSaving(false)
    closeSheet()
    var onSaved = layer.props && layer.props.onSaved
    if (typeof onSaved === 'function') onSaved()
    if (typeof showToast === 'function') {
      showToast(answer && answer.warning ? String(answer.warning) : (message || t('page.lyricsSaved')))
    }
  }

  function save() {
    if (!canSave()) return
    setSaving(true)
    setError('')
    var lyricText = embeddableLyricsText(preview)
    if (applyToRecord) {
      postJson(API + 'lyrics/match-apply', {
        path: track.path,
        provider: selected ? String(selected.source || '') : '',
        id: selected ? String(selected.id || '') : '',
        title: selected ? String(selected.title || '') : '',
        artist: selected ? (Array.isArray(selected.artists) ? selected.artists.join(' / ') : '') : '',
        album: selected ? String(selected.album || '') : '',
        coverUrl: selected ? String(selected.coverUrl || '') : '',
        lrc: lyricText,
        embeddedLrc: lyricText,
        embedTags: useLyrics === true && embedTags === true && embeddable === true,
        wordLevel: preview ? preview.wordLevel === true : false,
        score: selected ? Number(selected.score) || 0 : 0,
        applyLyrics: useLyrics === true,
        applyMetadata: useMetadata === true && selectedHasMetadata,
        applyCover: useCover === true && selectedHasCover,
        noAutoMatch: false,
        online: onlineTrack === true,
      })
        .then(finishSaved)
        .catch(function (saveError) {
          setSaving(false)
          setError(errorText(saveError))
        })
      return
    }
    if (preview === null || String(preview.lrc || '').trim() === '') {
      setSaving(false)
      return
    }
    if (typeof onApply === 'function') {
      setSaving(false)
      closeSheet()
      onApply(lyricText)
      return
    }
    if (!track.path) {
      setSaving(false)
      setError(t('sheet.noLocalFile'))
      return
    }
    postJson(API + 'lyrics/save', { path: track.path, lrc: lyricText })
      .then(function () {
        setSaving(false)
        closeSheet()
      })
      .catch(function (saveError) {
        setSaving(false)
        setError(errorText(saveError))
      })
  }

  function saveNoMatch() {
    if (saving || onlineTrack) return
    setSaving(true)
    setError('')
    postJson(API + 'lyrics/match-apply', {
      path: track.path,
      noAutoMatch: true,
      applyLyrics: false,
      online: false,
    })
      .then(function (answer) { finishSaved(answer, t('sheet.matchNoMatchSaved')) })
      .catch(function (saveError) {
        setSaving(false)
        setError(errorText(saveError))
      })
  }

  function togglePureMusic() {
    if (pureSaving || onlineTrack || !track.path) return
    var next = !markedPureMusic
    setPureSaving(true)
    setError('')
    postJson(API + 'lyrics/pure-music', { path: track.path, marked: next })
      .then(function (body) {
        setPureSaving(false)
        setMarkedPureMusic(body && body.pureMusic === true)
        var onSaved = layer.props && layer.props.onSaved
        if (typeof onSaved === 'function') onSaved()
        if (typeof showToast === 'function') {
          showToast(t(next ? 'sheet.matchPureMusic' : 'sheet.matchUnmarkPureMusic'))
        }
      })
      .catch(function (saveError) {
        setPureSaving(false)
        setError(errorText(saveError))
      })
  }

  var fileName = onlineTrack ? '' : track.path ? String(track.path).split(/[\\/]/).pop() : ''
  var songLine = [target.title, target.artist, target.album].filter(Boolean).join(' · ')
  var previewLines = mpPreviewLines(preview)
  var rightCover = selected && String(selected.coverUrl || '') !== '' ? String(selected.coverUrl) : String(track.coverUrl || '')
  var rightTitle = selected ? String(selected.title || '') : target.title
  var rightArtists = selected ? (Array.isArray(selected.artists) ? selected.artists.join(' / ') : '') : target.artist
  var rightAlbum = selected ? String(selected.album || '') : target.album
  // Folia's AMLL DB entries are lyric-library aliases, not a song's real metadata
  // or artwork; a result without a cover cannot supply one either.
  var selectedHasMetadata = selected === null || selected.source !== 'amll'
  var selectedHasCover = selected === null || String(selected.coverUrl || '') !== ''

  var header = h(
    'div',
    { className: 'mp-lym-head' },
    h(
      'div',
      { className: 'mp-lym-head-main' },
      h(
        'h2',
        { className: 'mp-lym-title' },
        t('sheet.matchLyricsTitle') + (track.onlineProvider === 'navidrome' ? ' (Navidrome)' : ''),
      ),
      songLine !== '' ? h('p', { className: 'mp-lym-song' }, songLine) : null,
      fileName !== ''
        ? h(
            'div',
            { className: 'mp-lym-file', title: fileName },
            icon('note', 12),
            h('span', null, t('sheet.file') + ':'),
            h('span', { className: 'mp-lym-file-name' }, fileName),
          )
        : onlineTrack
          ? h('div', { className: 'mp-lym-file' }, icon('note', 12), h('span', null, t('sheet.noLocalFile')))
          : null,
    ),
    h(IconButton, { icon: 'x', title: t('page.close'), onClick: closeSheet }),
  )

  var footer = h(
    'div',
    { className: 'mp-lym-foot' },
    applyToRecord && onlineTrack !== true
      ? h(
          'div',
          { className: 'mp-lym-foot-left' },
          h(
            Button,
            { variant: 'ghost', icon: 'x', className: 'mp-lym-danger', disabled: saving, onClick: saveNoMatch },
            t('sheet.matchNoMatch'),
          ),
          h(
            Button,
            {
              variant: 'ghost',
              icon: 'note',
              disabled: saving || pureSaving,
              onClick: togglePureMusic,
            },
            t(markedPureMusic ? 'sheet.matchUnmarkPureMusic' : 'sheet.matchPureMusic'),
          ),
        )
      : null,
    h('div', { className: 'mp-lym-foot-right' },
      h(Button, { variant: 'ghost', disabled: saving, onClick: closeSheet }, t('page.cancel')),
      h(
        Button,
        { variant: 'primary', disabled: !canSave(), onClick: save },
        saving ? t('sheet.saving') : t('page.save'),
      ),
    ),
  )

  var sourceItems = (sources.length > 0 ? sources : FALLBACK_SOURCES).map(function (entry) {
    return { value: String(entry.id), label: lyricMatchSourceLabel(entry) }
  })

  var leftPanel = h(
    'div',
    { className: 'mp-lym-left' },
    h(
      'div',
      { className: 'mp-lym-tools' },
      h('div', { className: 'mp-lym-tabs' }, h(KitSegmentedTabs, {
        items: sourceItems,
        value: source,
        size: 'sm',
        label: t('sheet.matchLyricsTitle'),
        onChange: chooseSource,
      })),
      h(
        'div',
        { className: 'mp-lym-search' },
        h(KitInput, {
          value: query,
          className: 'mp-lym-search-input',
          icon: 'search',
          placeholder: t('sheet.searchForSong'),
          label: t('sheet.searchForSong'),
          onChange: function (next) { setQuery(next) },
          onKeyDown: function (event) {
            if (event.key === 'Enter') runSearch()
          },
        }),
        h(
          Button,
          { variant: 'outline', icon: 'search', disabled: phase === 'loading', onClick: function () { runSearch() } },
          phase === 'loading' ? t('sheet.searching') : t('sheet.search'),
        ),
      ),
      error !== '' ? h('div', { className: 'mp-lym-error' }, error) : null,
    ),
    h(
      'div',
      { className: 'mp-lym-results' },
      phase === 'loading'
        ? h('div', { className: 'mp-lym-state' }, h(Spinner, null), h('span', null, t('sheet.searching')))
        : results.length === 0
          ? h(Empty, { icon: 'note', title: t('sheet.noResults') })
          : results.map(function (candidate) {
              var isSelected = selected !== null && selected.id === candidate.id && selected.source === candidate.source
              return h(
                'button',
                {
                  key: candidate.source + ':' + candidate.id,
                  type: 'button',
                  className: cx('mp-lym-result', isSelected && 'is-selected'),
                  onClick: function () { choose(candidate) },
                },
                h(Cover, {
                  className: 'mp-lym-result-cover',
                  src: candidate.coverUrl || '',
                  icon: 'note',
                  iconSize: 16,
                }),
                h(
                  'div',
                  { className: 'mp-lym-result-main' },
                  h(
                    'div',
                    { className: 'mp-lym-result-title-row' },
                    h('span', { className: 'mp-lym-result-title' }, String(candidate.title || '')),
                    h(KitTag, { tone: 'info' }, String(candidate.score || 0) + '%'),
                    candidate.durationMatched === true
                      ? h(KitTag, { tone: 'success' }, t('sheet.durationMatched'))
                      : null,
                  ),
                  h(
                    'div',
                    { className: 'mp-lym-result-meta' },
                    [Array.isArray(candidate.artists) ? candidate.artists.join(' / ') : '', candidate.album]
                      .filter(Boolean)
                      .join(' · '),
                  ),
                ),
                isSelected ? h('span', { className: 'mp-lym-result-check' }, icon('check', 16)) : null,
              )
            }),
    ),
  )

  var rightPanel = h(
    'div',
    { className: 'mp-lym-right' },
    h(
      'div',
      { className: 'mp-lym-right-scroll' },
      h(Cover, { className: 'mp-lym-cover', src: rightCover, icon: 'note', iconSize: 28 }),
      h(
        'div',
        { className: 'mp-lym-info' },
        h('h3', { className: 'mp-lym-info-title' }, rightTitle),
        rightArtists !== '' ? h('div', { className: 'mp-lym-info-artist' }, rightArtists) : null,
        rightAlbum !== '' ? h('div', { className: 'mp-lym-info-album' }, rightAlbum) : null,
      ),
      applyToRecord && onlineTrack !== true
        ? h(
            'div',
            { className: 'mp-lym-switches' },
            h(
              'div',
              { className: 'mp-lym-switch-row' },
              h('span', null, t('sheet.matchApplyLyrics')),
              h(Switch, { value: useLyrics, label: t('sheet.matchApplyLyrics'), onChange: setUseLyrics }),
            ),
            h(
              'div',
              { className: 'mp-lym-switch-row' },
              h('span', null, t('sheet.matchApplyMetadata')),
              h(Switch, {
                value: useMetadata && selectedHasMetadata,
                label: t('sheet.matchApplyMetadata'),
                disabled: !selectedHasMetadata,
                onChange: setUseMetadata,
              }),
            ),
            h(
              'div',
              { className: 'mp-lym-switch-row' },
              h('span', null, t('sheet.matchApplyCover')),
              h(Switch, {
                value: useCover && selectedHasCover,
                label: t('sheet.matchApplyCover'),
                disabled: !selectedHasCover,
                onChange: setUseCover,
              }),
            ),
            h(
              'div',
              { className: 'mp-lym-switch-row' },
              h(
                'span',
                null,
                t('sheet.matchEmbedTags'),
                embeddable !== true
                  ? h('span', { className: 'mp-lym-switch-note' }, t('sheet.matchEmbedTagsUnsupported'))
                  : null,
              ),
              h(Switch, {
                value: embedTags === true && embeddable,
                label: t('sheet.matchEmbedTags'),
                disabled: !embeddable || useLyrics !== true || preview === null || String(preview.lrc || '').trim() === '',
                onChange: setEmbedTags,
              }),
            ),
          )
        : null,
    ),
    h(
      'div',
      { className: 'mp-lym-preview' },
      h(
        'div',
        { className: 'mp-lym-badges' },
        preview && preview.wordLevel ? h(KitTag, { tone: 'info' }, t('sheet.badgeWord')) : null,
        preview && preview.translation ? h(KitTag, { tone: 'success' }, t('sheet.badgeTranslation')) : null,
        preview && preview.romaji ? h(KitTag, { tone: 'accent' }, t('sheet.badgeRomaji')) : null,
      ),
      h(LyricMatchPreview, {
        lines: previewLines,
        height: 92,
        activeColor: 'var(--dsw-alias-state-business-primary, #4176E6)',
        mutedColor: 'var(--dsw-alias-label-tertiary, #8a8a93)',
        emptyLabel: selected ? t('sheet.previewEmpty') : '',
      }),
    ),
  )

  var windowEl = h(
    'div',
    { className: 'mp-lym-window' },
    header,
    h('div', { className: 'mp-lym-body' }, leftPanel, rightPanel),
    footer,
  )

  if (props.embedded === true) {
    return h('div', { className: 'mp-lym-layer is-embedded' }, windowEl)
  }

  return h(
    KitModal,
    { headless: true, onClose: closeSheet, className: 'mp-lym-modal' },
    h('div', { className: 'mp-lym-layer' }, windowEl),
  )
}
