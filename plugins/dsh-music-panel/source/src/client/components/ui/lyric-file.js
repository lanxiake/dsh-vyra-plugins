/**
 * 导入 / 导出歌词 — Folia's lyric-file window: the text can be edited, imported
 * from a file, exported to a file, and saved back to the song.
 *
 * Folia renders this as its own window with drag-and-drop and format checks; this
 * is the same job with the pieces this plugin has (textarea, file picker, save).
 */

function LyricFileDialog(props) {
  var layer = props.layer || {}
  var path = String((layer.props && layer.props.path) || '')
  var baseName = String((layer.props && layer.props.name) || 'lyrics')
  var onSaved = layer.props && layer.props.onSaved

  var textPair = useState(String((layer.props && layer.props.text) || ''))
  var text = textPair[0]
  var setText = textPair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  // An online song has no file to write: its imported lyric is kept on its record
  // (Folia's `handleImportOnlineLyrics`).
  var online = layer.props && layer.props.online && typeof layer.props.online === 'object' ? layer.props.online : null

  function pick() {
    if (typeof document === 'undefined') return
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = '.lrc,.txt,text/plain'
    input.onchange = function () {
      var file = input.files && input.files[0]
      if (!file) return
      var reader = new FileReader()
      reader.onload = function () {
        setText(String(reader.result || ''))
      }
      reader.readAsText(file)
    }
    input.click()
  }

  function exportFile() {
    if (typeof document === 'undefined' || text.trim() === '') return
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    var url = URL.createObjectURL(blob)
    var link = document.createElement('a')
    link.href = url
    link.download = baseName + '.lrc'
    link.click()
    URL.revokeObjectURL(url)
  }

  function save() {
    if (busy || (online === null && path === '')) return
    setBusy(true)
    setError('')
    var request = online === null
      ? postJson(API + 'lyrics/save', { path: path, lrc: text })
      : postJson(API + 'online/lyric-import', {
          provider: String(online.provider || ''),
          id: String(online.id || ''),
          text: text,
          name: baseName + '.lrc',
        })
    request
      .then(function () {
        setBusy(false)
        popLayer()
        if (typeof showToast === 'function') showToast(t('sheet.lyricsImported'))
        if (typeof onSaved === 'function') onSaved()
      })
      .catch(function (saveError) {
        setBusy(false)
        setError(errorText(saveError))
      })
  }

  return h(
    KitModal,
    {
      title: t('sheet.lyricFileTitle'),
      onClose: popLayer,
      className: 'mp-lym-modal',
      footer: [
        h(
          'button',
          { key: 'import', type: 'button', className: 'mp-btn', onClick: pick, style: footerBtn() },
          icon('note', 15),
          t('sheet.lyricImport'),
        ),
        h(
          'button',
          { key: 'export', type: 'button', className: 'mp-btn', onClick: exportFile, style: footerBtn() },
          t('sheet.lyricExport'),
        ),
        h('div', { key: 'gap', style: { flex: '1 1 auto' } }),
        h(
          'button',
          { key: 'cancel', type: 'button', className: 'mp-btn', onClick: popLayer, style: footerBtn() },
          t('sheet.cancel'),
        ),
        h(
          'button',
          { key: 'save', type: 'button', className: 'mp-btn', disabled: busy, onClick: save, style: footerBtn(true) },
          busy ? t('sheet.saving') : t('sheet.save'),
        ),
      ],
    },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '320px' } },
      error !== '' ? h('div', { style: { fontSize: '12px', color: '#f87171' } }, error) : null,
      h('textarea', {
        value: text,
        spellCheck: false,
        placeholder: '[00:01.00]…',
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
      h(
        'div',
        { style: { fontSize: '11px', opacity: '.5' } },
        t('sheet.lyricFileHint'),
      ),
    ),
  )
}

function footerBtn(primary) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '0',
    background: primary ? '#3b82f6' : 'rgba(255,255,255,.06)',
    color: primary ? '#fff' : 'inherit',
    font: 'inherit',
    fontSize: '13px',
    cursor: 'pointer',
  }
}
