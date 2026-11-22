/**
 * trash: restore tracks that were moved out of the library.
 */

function TrashDialog(props) {
  var statePair = useState({ phase: 'loading', entries: [] })
  var state = statePair[0]
  var setState = statePair[1]
  var busyPair = useState('')
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  useEffect(function () {
    var cancelled = false
    getJson(API + 'trash')
      .then(function (body) {
        if (cancelled) return
        setState({ phase: 'ready', entries: Array.isArray(body.entries) ? body.entries : [] })
      })
      .catch(function (error) {
        if (cancelled) return
        setState({ phase: 'error', entries: [], error: errorText(error) })
      })
    return function () {
      cancelled = true
    }
  }, [])

  function restore(entry) {
    if (busy !== '') return
    setBusy(entry.id)
    postJson(API + 'trash/restore', { id: entry.id })
      .then(function () {
        setBusy('')
        setState(function (previous) {
          return {
            phase: previous.phase,
            entries: previous.entries.filter(function (item) {
              return item.id !== entry.id
            }),
          }
        })
        showToast(t('v2.restored', { name: entry.name }))
        void loadLibrary(true)
      })
      .catch(function (error) {
        setBusy('')
        showToast(errorText(error))
      })
  }

  var count = state.phase === 'ready' ? state.entries.length : 0
  var body = h('div', { className: 'mp-set-desc' }, t('v2.trashHint'))
  if (state.phase === 'loading') {
    body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, h(Spinner))
  } else if (state.phase === 'error') {
    body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, state.error || '')
  } else if (state.entries.length === 0) {
    body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, t('v2.trashEmpty'))
  } else {
    body = h(
      'div',
      { className: 'mp-trash-list' },
      state.entries.map(function (entry) {
        return h(
          'div',
          { key: entry.id, className: 'mp-trash-row' },
          h('span', { className: 'mp-trash-icon' }, icon('trash', 14)),
          h(
            'div',
            { className: 'mp-trash-main' },
            h('div', { className: 'mp-ellipsis' }, entry.name),
            h(
              'div',
              { className: 'mp-trash-path' },
              (entry.originalPath || t('v2.trashNoPath')) +
                ' · ' +
                fmtBytes(entry.size) +
                ' · ' +
                new Date(entry.mtime).toLocaleString(),
            ),
          ),
          h(
            Button,
            {
              variant: 'primary',
              disabled: busy !== '',
              onClick: function () {
                restore(entry)
              },
            },
            busy === entry.id ? t('page.saving') : t('v2.restore'),
          ),
        )
      }),
    )
  }

  return h(
    KitModal,
    {
      title: t('v2.trash') + (state.phase === 'ready' ? ' · ' + count : ''),
      onClose: popLayer,
      footer: h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('v2.close')),
    },
    h('div', { className: 'mp-set-desc' }, t('v2.trashHint')),
    body,
  )
}
