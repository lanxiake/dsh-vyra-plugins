/**
 * online lyric search: pick a candidate, preview the LRC, hand it back.
 *
 * Used from the tag editor (fills the lyrics box) and from the player (writes
 * the lyrics straight into the file).
 */

function OnlineLyricDialog(props) {
  var track = props.layer.props.track || {}
  var onApply = props.layer.props.onApply
  var queryPair = useState((track.title || '').trim())
  var query = queryPair[0]
  var setQuery = queryPair[1]
  var phasePair = useState('idle')
  var phase = phasePair[0]
  var setPhase = phasePair[1]
  var listPair = useState([])
  var candidates = listPair[0]
  var setCandidates = listPair[1]
  var previewPair = useState(null)
  var preview = previewPair[0]
  var setPreview = previewPair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]

  function search() {
    var text = String(query || '').trim()
    if (text === '' || phase === 'loading') return
    setPhase('loading')
    setError('')
    setCandidates([])
    setPreview(null)
    getJson(API + 'lyrics/search?q=' + encodeURIComponent(text))
      .then(function (body) {
        setCandidates(Array.isArray(body.candidates) ? body.candidates : [])
        setPhase('ready')
      })
      .catch(function (searchError) {
        setError(errorText(searchError))
        setPhase('error')
      })
  }

  function choose(candidate) {
    if (!candidate || !candidate.id) return
    setError('')
    setPhase('loading')
    getJson(API + 'lyrics/fetch?id=' + encodeURIComponent(candidate.id))
      .then(function (body) {
        var lines = parseLrcText(body.lrc || '')
        if (body.translation) mergeLyricTranslation(lines, body.translation)
        setPreview({ lrc: body.lrc || '', lines: lines, title: candidate.title, artist: candidate.artist })
        setPhase('ready')
      })
      .catch(function (fetchError) {
        setError(errorText(fetchError))
        setPhase('error')
      })
  }

  function apply() {
    if (!preview || preview.lrc.trim() === '') return
    popLayer()
    if (typeof onApply === 'function') {
      var hasTranslation = preview.lines.some(function (line) {
        return line.translation !== ''
      })
      onApply(hasTranslation ? buildTranslatedLrc(preview.lines, preview.lrc) : preview.lrc)
    }
  }

  var previewLines =
    preview === null
      ? []
      : preview.lines.filter(function (line) {
          return String(line.text || '').trim() !== '' || String(line.translation || '').trim() !== ''
        })

  return h(
    KitModal,
    {
      title: t('page.onlineLyrics'),
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(Button, { key: 'apply', variant: 'primary', disabled: preview === null, onClick: apply }, t('page.lyricsApply')),
      ],
    },
h(
        'div',
        { className: 'mp-kit-body' },
        h(
          'div',
          { style: { display: 'flex', gap: '8px' } },
          h('input', {
            type: 'search',
            value: query,
            placeholder: t('page.lyricsSearchPlaceholder'),
            style: {
              flex: '1',
              height: '32px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
              background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
              color: 'inherit',
              font: 'inherit',
              outline: 'none',
            },
            onChange: function (event) {
              setQuery(event.target.value)
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') search()
            },
          }),
          h(Button, { variant: 'primary', disabled: phase === 'loading', onClick: search }, t('page.lyricsSearch')),
        ),
        error !== '' ? h('div', { className: 'mp-set-desc', style: { color: 'var(--dsw-alias-state-error-primary,#f87171)' } }, error) : null,
        phase === 'loading' ? h('div', { className: 'mp-empty', style: { padding: '20px' } }, h(Spinner)) : null,
        preview === null
          ? phase === 'ready' && candidates.length === 0
            ? h('div', { className: 'mp-empty', style: { padding: '24px' } }, h('span', null, t('page.lyricsNoResults')))
            : h(
                'div',
                { className: 'mp-lyr-candidates' },
                candidates.map(function (candidate) {
                  return h(
                    'button',
                    {
                      key: String(candidate.id),
                      type: 'button',
                      className: 'mp-lyr-candidate',
                      onClick: function () {
                        choose(candidate)
                      },
                    },
                    h(
                      'div',
                      { className: 'mp-lyr-candidate-main' },
                      h('div', { className: 'mp-srow-title' }, candidate.title || ''),
                      h('div', { className: 'mp-srow-sub' }, candidate.artist || ''),
                    ),
                    h('div', { className: 'mp-srow-meta' }, fmtTime(candidate.durationSec)),
                  )
                }),
              )
          : h(
              'div',
              { className: 'mp-lyr-preview-wrap' },
              h(
                'div',
                { className: 'mp-lyr-preview-head' },
                h(
                  'div',
                  { className: 'mp-lyr-preview-meta' },
                  h('div', { className: 'mp-lyr-preview-title' }, preview.title || ''),
                  h('div', { className: 'mp-lyr-preview-artist' }, preview.artist || ''),
                ),
                h('span', { className: 'mp-lyr-preview-count' }, t('page.lyricsLineCount', { n: previewLines.length })),
                h(
                  Button,
                  {
                    variant: 'ghost',
                    onClick: function () {
                      setPreview(null)
                    },
                  },
                  t('page.lyricsBack'),
                ),
              ),
              previewLines.length === 0
                ? h('div', { className: 'mp-set-desc' }, t('page.lyricsNoResults'))
                : h(
                    'div',
                    { className: 'mp-lyr-preview' },
                    previewLines.map(function (line, index) {
                      var meta = isLyricMetadata(line.text)
                      var stamp = formatLrcTime(line.time).slice(1, -1)
                      return h(
                        'div',
                        { key: String(index), className: cx('mp-lyr-line', meta && 'is-meta') },
                        h('span', { className: 'mp-lyr-time' }, stamp),
                        h(
                          'div',
                          { className: 'mp-lyr-copy' },
                          line.text ? h('div', { className: 'mp-lyr-orig' }, line.text) : null,
                          line.translation ? h('div', { className: 'mp-lyr-tr' }, line.translation) : null,
                        ),
                      )
                    }),
                  ),
            ),
      ),

  )
}
