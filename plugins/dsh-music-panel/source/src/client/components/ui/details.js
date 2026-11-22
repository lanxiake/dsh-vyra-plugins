/**
 * details: the read-only information panel behind the row menu's「详细信息」.
 *
 * Everything it shows is already known: a local file's stat and tags from the library scan,
 * or an online row's provider metadata plus the media-cache lookup. Nothing is re-read from
 * disk, so the panel cannot disagree with the list it was opened from.
 */


/** `44100` → `44.1 kHz`; unknown stays empty. */
function detailSampleRateText(value) {
  var rate = Number(value) || 0
  if (rate <= 0) return ''
  var kHz = rate / 1000
  return (kHz % 1 === 0 ? String(kHz) : kHz.toFixed(1)) + ' kHz'
}

/** The cache's quality label, in the words the settings already use. */
function detailQualityText(quality) {
  var keys = {
    standard: 'sheet.qStandard',
    high: 'sheet.qHigh',
    lossless: 'sheet.qLossless',
    hires: 'sheet.qHires',
    original: 'sheet.originalQuality',
  }
  var key = keys[String(quality || '')]
  return key === undefined ? '' : t(key)
}

/** `1723…` → a readable local date, or empty for an unknown stamp. */
function detailDateText(value, withTime) {
  var stamp = Number(value) || 0
  if (stamp <= 0) return ''
  return withTime === true ? new Date(stamp).toLocaleString() : new Date(stamp).toLocaleDateString()
}

function TrackDetailsDialog(props) {
  var asked = props.layer && props.layer.props ? props.layer.props.track : null
  // A row from a favorites / playlist / recent snapshot carries only the path: the library
  // record holds the stat and tag fields this panel exists to show.
  var track = asked === null || asked === undefined
    ? null
    : asked.onlineProvider
      ? asked
      : (trackByPath(asked.path) || asked)
  var provider = track !== null && typeof track.onlineProvider === 'string' ? track.onlineProvider : ''
  var online = provider !== ''
  var onlineId = track === null ? '' : String(track.onlineId || track.id || '')
  var cachePair = useState({ phase: online ? 'loading' : 'ready', info: null })
  var cache = cachePair[0]
  var setCache = cachePair[1]

  // Online rows have no file on disk; what the cache holds is the only size there is.
  useEffect(function () {
    if (!online || onlineId === '') return undefined
    var cancelled = false
    getJson(
      API +
        'online/info?provider=' +
        encodeURIComponent(provider) +
        '&id=' +
        encodeURIComponent(onlineId),
    )
      .then(function (body) {
        if (cancelled) return
        setCache({ phase: 'ready', info: body && body.cached === true && body.info ? body.info : null })
      })
      .catch(function () {
        if (cancelled) return
        setCache({ phase: 'ready', info: null })
      })
    return function () {
      cancelled = true
    }
  }, [online, provider, onlineId])

  // `options.mono`: monospace for paths and ids. `options.onClick`: the value is an action
  // (the path reveals the file in its folder), rendered as a link so it can be focused too.
  function row(key, label, value, options) {
    if (value === null || value === undefined) return null
    var settings = options === null || options === undefined ? {} : options
    var text = String(value)
    if (text.trim() === '') return null
    var body = text
    if (typeof settings.onClick === 'function') {
      body = h(
        'button',
        {
          type: 'button',
          className: 'mp-detail-link',
          title: settings.title || '',
          onClick: settings.onClick,
        },
        text,
      )
    }
    return h(
      'div',
      { key: key, className: 'mp-detail-row' },
      h('div', { className: 'mp-detail-label' }, label),
      h('div', { className: 'mp-detail-value' + (settings.mono === true ? ' is-mono' : '') }, body),
    )
  }

  var rows = []
  if (track === null) {
    rows.push(h('div', { key: 'none', className: 'mp-set-desc' }, t('page.infoUnavailable')))
  } else {
    var durationSec = Number(track.durationSec) || 0
    rows.push(row('title', t('page.infoSong'), track.title || track.name || ''))
    rows.push(row('artist', t('v2.artist'), track.artist || ''))
    rows.push(row('album', t('v2.album'), track.album || ''))
    rows.push(row('duration', t('page.infoDuration'), durationSec > 0 ? fmtTime(durationSec) : ''))
    if (online) {
      var quality = cache.info ? detailQualityText(cache.info.quality) : ''
      rows.push(row('source', t('page.infoSource'), sourceLabelOf(provider)))
      rows.push(row('songid', t('page.infoSongId'), onlineId, { mono: true }))
      rows.push(row('quality', t('sheet.quality'), quality))
      var cachedText = cache.phase === 'loading'
        ? t('v2.loading')
        : cache.info
          ? [fmtBytes(Number(cache.info.size) || 0), quality].filter(function (part) { return part !== '' }).join(' · ')
          : t('page.infoNotCached')
      rows.push(row('cache', t('page.infoCache'), cachedText))
    } else {
      var format = String(track.ext || '').toUpperCase()
      if (format !== '' && track.codec) format += ' · ' + String(track.codec)
      rows.push(row('format', t('page.infoFormat'), format))
      rows.push(row('size', t('page.infoSize'), Number(track.size) > 0 ? fmtBytes(Number(track.size)) : ''))
      rows.push(row('bitrate', t('page.infoBitrate'), fmtKbps(track.bitrate)))
      rows.push(row('samplerate', t('page.infoSampleRate'), detailSampleRateText(track.sampleRate)))
      rows.push(
        row('path', t('page.infoPath'), track.path, {
          mono: true,
          title: t('page.reveal'),
          onClick: function () {
            void revealTrackPath(track.path)
          },
        }),
      )
      rows.push(row('mtime', t('page.infoModified'), detailDateText(track.mtime, true)))
      rows.push(row('added', t('page.infoAdded'), detailDateText(track.addedAt, false)))
      rows.push(row('plays', t('page.infoPlays'), Number(track.plays) > 0 ? String(Number(track.plays)) : ''))
    }
  }

  var footer = []
  if (!online && track !== null && typeof track.path === 'string' && track.path !== '') {
    footer.push(
      h(
        Button,
        {
          key: 'copy',
          variant: 'ghost',
          onClick: function () {
            copyTextSafely(track.path)
            showToast(t('page.copied'))
          },
        },
        t('page.copyPath'),
      ),
    )
  }
  footer.push(h(Button, { key: 'close', variant: 'primary', onClick: function () { popLayer() } }, t('v2.close')))

  return h(
    KitModal,
    { title: t('page.details'), onClose: popLayer, footer: footer },
    h('div', { className: 'mp-detail' }, rows),
  )
}
