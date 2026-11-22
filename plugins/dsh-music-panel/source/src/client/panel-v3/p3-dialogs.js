/**
 * panel-v3 playlist dialog: one small kit modal for create / rename / delete.
 */

var p3PlaylistDialogStore = createStore({ open: false, mode: 'create', playlist: null })

function openP3Playlist(mode, playlist) {
  p3PlaylistDialogStore.set({ open: true, mode: mode || 'create', playlist: playlist || null })
}

function closeP3Playlist() {
  p3PlaylistDialogStore.set({ open: false, mode: 'create', playlist: null })
}

function P3PlaylistDialog(props) {
  var state = useStore(p3PlaylistDialogStore)
  var mode = state.mode
  var playlist = state.playlist
  var [name, setName] = useState('')
  var [busy, setBusy] = useState(false)
  var [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(function () {
    if (!state.open) return
    setName(playlist && playlist.name ? playlist.name : '')
    setBusy(false)
    setConfirmDelete(false)
  }, [state.open, playlist && playlist.id])

  if (!state.open) return null

  function close() {
    if (busy) return
    closeP3Playlist()
  }

  function save() {
    var value = name.trim()
    if (value === '' || busy) return
    setBusy(true)
    if (mode === 'create') {
      createPlaylist(value).then(function (created) {
        setBusy(false)
        if (!created) return
        closeP3Playlist()
        p3OpenPlaylist(created)
      })
      return
    }
    if (!playlist) { setBusy(false); return }
    patchPlaylist(playlist.id, { name: value }).then(function (ok) {
      setBusy(false)
      if (!ok) return
      closeP3Playlist()
      showToast(t('p3.playlistRenamed'))
    })
  }

  function remove() {
    if (!playlist || busy) return
    setBusy(true)
    removePlaylist(playlist.id).then(function (ok) {
      setBusy(false)
      if (!ok) return
      var snapshot = p3CollectionNavStore.get().snapshot
      var top = snapshot && snapshot.stack.length > 0 ? snapshot.stack[snapshot.stack.length - 1] : null
      closeP3Playlist()
      if (top && top.type === 'playlist' && top.id === playlist.id && top.source === 'local') p3GoBack()
      showToast(t('p3.playlistDeleted'))
    })
  }

  var title = mode === 'create' ? t('v2.newPlaylist') : confirmDelete ? t('p3.playlistDeleteTitle') : t('p3.playlistManage')
  var footer = []
  footer.push(h(Button, { key: 'cancel', variant: 'ghost', onClick: close, disabled: busy }, t('page.cancel')))
  if (mode === 'manage' && !confirmDelete) {
    footer.push(h(Button, { key: 'delete', variant: 'ghost', onClick: function () { setConfirmDelete(true) }, disabled: busy }, t('page.delete')))
  }
  if (confirmDelete) {
    footer.push(h(Button, { key: 'remove', variant: 'primary', onClick: remove, disabled: busy }, t('page.delete')))
  } else {
    footer.push(h(Button, {
      key: 'save',
      variant: 'primary',
      disabled: busy || name.trim() === '',
      onClick: save,
    }, mode === 'create' ? t('page.create') : t('page.done')))
  }

  return h(
    KitModal,
    { title: title, small: true, onClose: close, footer: footer },
    confirmDelete
      ? h('p', { className: 'mp-kit-text' }, t('p3.playlistDeleteConfirm', { name: playlist && playlist.name || '' }))
      : h('div', { className: 'mpv3-dialog-field' },
          h(KitInput, {
            value: name,
            placeholder: t('v2.playlistName'),
            label: t('v2.playlistName'),
            disabled: busy,
            onChange: function (value) { setName(value) },
            onKeyDown: function (event) {
              if (event.key === 'Enter') {
                event.preventDefault()
                save()
              }
            },
          }),
        ),
  )
}

function P3PlaylistDialogHost() {
  var state = useStore(p3PlaylistDialogStore)
  return h(P3PlaylistDialog, {
    open: state.open,
    mode: state.mode,
    playlist: state.playlist,
    onClose: closeP3Playlist,
  })
}
