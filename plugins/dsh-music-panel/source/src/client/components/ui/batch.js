/**
 * batch edit and duplicate cleanup dialogs.
 */

function BatchEditDialog(props) {
  var paths = props.layer.props.paths || []
  var pair = useState({ artist: '', album: '', genre: '', albumArtist: '' })
  var form = pair[0]
  var setForm = pair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  function field(key, label) {
    return h(
      'div',
      { className: 'mp-field' },
      h('label', null, label),
      h('input', {
        type: 'text',
        value: form[key] || '',
        placeholder: t('page.keepEmpty'),
        onChange: function (event) {
          var value = event.target.value
          setForm(function (previous) {
            var next = Object.assign({}, previous)
            next[key] = value
            return next
          })
        },
      }),
    )
  }

  function save() {
    if (busy) return
    var patch = {}
    ;['artist', 'album', 'genre', 'albumArtist'].forEach(function (key) {
      var value = String(form[key] || '').trim()
      if (value !== '') patch[key] = value
    })
    if (Object.keys(patch).length === 0) {
      showToast(t('page.batchEmpty'))
      return
    }
    setBusy(true)
    batchEditTags(paths, patch).then(function (result) {
      setBusy(false)
      popLayer()
      showToast(t('page.batchSaved', { n: result.done }))
      void loadLibrary(true)
    })
  }

  return h(
    KitModal,
    {
      title: t('page.batchEdit'),
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(
          Button,
          {
            key: 'save',
            variant: 'primary',
            disabled: busy,
            onClick: save,
          },
          busy ? t('page.saving') : t('page.save'),
        ),
      ],
    },
h(
        'div',
        { className: 'mp-kit-body' },
        h('div', { className: 'mp-set-desc' }, t('page.batchHint', { n: paths.length })),
        h(
          'div',
          { className: 'mp-d-grid' },
          field('artist', t('page.artist')),
          field('album', t('page.album')),
          field('genre', t('page.genre')),
          field('albumArtist', t('page.albumArtist')),
        ),
      ),

  )
}

function DuplicatesDialog(props) {
  var groups = props.layer.props.groups || []
  var removals = []
  var rows = groups.map(function (group) {
    var sorted = group.slice().sort(compareQuality)
    sorted.slice(1).forEach(function (track) {
      removals.push(track.path)
    })
    return { keep: sorted[0], drop: sorted.slice(1) }
  })

  function clean() {
    if (removals.length === 0) return
    pushLayer('confirm', {
      title: t('page.duplicatesTitle'),
      text: t('page.deleteDuplicatesConfirm', { n: removals.length }),
      onConfirm: function () {
        removeTracks(removals)
          .then(function (body) {
            showToast(t('page.duplicatesRemoved', { n: (body.moved || []).length }))
            removeLayer('duplicates')
          })
          .catch(function (error) {
            showToast(errorText(error))
          })
      },
    })
  }

  return h(
    KitModal,
    {
      title: t('page.duplicatesTitle') + ' · ' + groups.length,
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { removeLayer('duplicates') } }, t('page.cancel')),
        h(
          Button,
          {
            key: 'clean',
            variant: 'primary',
            disabled: removals.length === 0,
            onClick: clean,
          },
          t('page.deleteDuplicates'),
        ),
      ],
    },
h(
        'div',
        { className: 'mp-kit-body' },
        h('div', { className: 'mp-set-desc' }, t('page.duplicatesHint')),
        rows.map(function (row, index) {
          return h(
            'div',
            { key: String(index), className: 'mp-dupe-group' },
            h(
              'div',
              { className: 'mp-dupe-row is-keep' },
              icon('check', 13),
              h('span', { className: 'mp-ellipsis' }, trackTitleOf(row.keep) + ' · ' + trackArtistOf(row.keep)),
              h('span', { className: 'mp-dupe-meta' }, fmtKbps(row.keep.bitrate) || fmtKhz(row.keep.sampleRate) || ''),
            ),
            row.drop.map(function (track) {
              return h(
                'div',
                { key: track.path, className: 'mp-dupe-row is-drop' },
                icon('trash', 12),
                h('span', { className: 'mp-ellipsis' }, track.path),
                h('span', { className: 'mp-dupe-meta' }, fmtKbps(track.bitrate) || fmtKhz(track.sampleRate) || ''),
              )
            }),
          )
        }),
      ),

  )
}
