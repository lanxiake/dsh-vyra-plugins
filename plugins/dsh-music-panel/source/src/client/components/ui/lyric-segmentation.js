/**
 * 歌词分词 — Folia's manual word-segmentation exchange.
 *
 * Folia copies a song's split out as `词/词/词` rows (one per lyric line) and takes it
 * back the same way; its model path is off by default, so the manual exchange is the
 * working route in both apps. This is that exchange with the pieces this plugin has:
 * the rows are editable in a textarea, saving writes the record the lyric setter bakes
 * (lyric_segmentations), and 恢复默认 deletes it so icu-folia's split returns.
 */

function LyricSegmentationDialog(props) {
  var layer = props.layer || {}
  var payload = layer.props || {}
  var songKey = String(payload.songKey || '')
  var onSaved = payload.onSaved
  var source = Array.isArray(payload.lyrics) ? payload.lyrics : []
  // Only timed lines can carry a split, and only lines with text can be compared at all:
  // a legacy line (plain text, no timeline) has neither.
  var document = {
    lines: source.filter(function (line) {
      return line && typeof line.fullText === 'string' && line.fullText !== ''
    }),
  }

  // The exported rows are computed once, on mount: later renders must not overwrite what
  // the listener has typed.
  var initialRef = useRef(null)
  if (initialRef.current === null) {
    var initial = ''
    try {
      initial = document.lines.length === 0 ? '' : MPFoliaLyrics.buildSegmentationExportText(document)
    } catch (error) {
      initial = ''
    }
    initialRef.current = initial
  }
  var textPair = useState(initialRef.current)
  var text = textPair[0]
  var setText = textPair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  function save() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      var result = MPFoliaLyrics.parseSegmentationImport(text, document)
      var record = saveLyricSegmentation(songKey, result.lines)
      if (typeof onSaved === 'function') onSaved(record)
      if (typeof showToast === 'function') showToast(t('sheet.lyricSegSaved'))
      popLayer()
    } catch (saveError) {
      setBusy(false)
      setError(segmentationErrorText(saveError))
    }
  }

  function reset() {
    saveLyricSegmentation(songKey, null)
    if (typeof onSaved === 'function') onSaved(null)
    if (typeof showToast === 'function') showToast(t('sheet.lyricSegResetDone'))
    popLayer()
  }

  var empty = document.lines.length === 0

  return h(
    KitModal,
    {
      title: t('sheet.lyricSegTitle'),
      onClose: popLayer,
      className: 'mp-lym-modal',
      footer: [
        h(
          'button',
          { key: 'reset', type: 'button', className: 'mp-btn', disabled: busy || empty, onClick: reset, style: footerBtn() },
          icon('repeat', 15),
          t('sheet.lyricSegReset'),
        ),
        h('div', { key: 'gap', style: { flex: '1 1 auto' } }),
        h(
          'button',
          { key: 'cancel', type: 'button', className: 'mp-btn', onClick: popLayer, style: footerBtn() },
          t('sheet.cancel'),
        ),
        h(
          'button',
          { key: 'save', type: 'button', className: 'mp-btn', disabled: busy || empty, onClick: save, style: footerBtn(true) },
          busy ? t('sheet.saving') : t('sheet.save'),
        ),
      ],
    },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '320px' } },
      error !== '' ? h('div', { style: { fontSize: '12px', color: '#f87171' } }, error) : null,
      empty
        ? h('div', { style: { fontSize: '12.5px', opacity: '.7' } }, t('sheet.lyricSegNoTimedLines'))
        : h('textarea', {
            value: text,
            spellCheck: false,
            placeholder: t('sheet.lyricSegPlaceholder'),
            onChange: function (event) {
              setText(event.target.value)
            },
            style: {
              flex: '1 1 auto',
              minHeight: '300px',
              resize: 'vertical',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1))',
              background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
              color: 'inherit',
              font: 'inherit',
              fontSize: '12.5px',
              lineHeight: '20px',
              outline: 'none',
              whiteSpace: 'pre',
              overflow: 'auto',
            },
          }),
      h('div', { style: { fontSize: '11px', opacity: '.5' } }, t('sheet.lyricSegHint')),
    ),
  )
}

/** Folia's import errors carry a code (and the failing row); say what went wrong. */
function segmentationErrorText(error) {
  var code = error && error.message ? String(error.message) : ''
  var row = error && typeof error.row === 'number' ? error.row : 0
  if (code === 'empty') return t('sheet.lyricSegEmpty')
  if (code === 'invalid-json' || code === 'invalid-json-shape') return t('sheet.lyricSegBadFormat')
  if (code === 'line-count-mismatch') return t('sheet.lyricSegLineCount')
  if (code === 'line-text-mismatch') return t('sheet.lyricSegLineText', { row: String(row) })
  return t('sheet.lyricSegFailed')
}
