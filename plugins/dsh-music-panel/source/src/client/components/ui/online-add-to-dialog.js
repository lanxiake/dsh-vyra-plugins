/**
 * add one online song to one of the signed-in account's cloud playlists.
 */

function OnlineAddToDialog(props) {
  var layerProps = props.layer.props || {}
  var track = layerProps.track || null
  var provider = track && track.onlineProvider ? track.onlineProvider : ''
  var statePair = useState({ phase: 'loading', playlists: [], error: '' })
  var state = statePair[0]
  var setState = statePair[1]
  var busyPair = useState('')
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  useEffect(
    function () {
      if (provider === '') return undefined
      var cancelled = false
      getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(provider))
        .then(function (body) {
          if (cancelled) return
          setState({
            phase: 'ready',
            playlists: Array.isArray(body.playlists) ? body.playlists : [],
            error: '',
          })
        })
        .catch(function (error) {
          if (cancelled) return
          setState({ phase: 'error', playlists: [], error: errorText(error) })
        })
      return function () {
        cancelled = true
      }
    },
    [provider],
  )

  function addTo(playlist) {
    if (busy !== '' || track === null) return
    setBusy(playlist.id)
    postJson(API + 'online/playlist-add', {
      provider: provider,
      playlistId: playlist.id,
      song: track,
    })
      .then(function () {
        setBusy('')
        showToast(t('online.addedToCloudPlaylist'))
        popLayer()
      })
      .catch(function (error) {
        setBusy('')
        showToast(errorText(error))
      })
  }

  var body = null
  if (state.phase === 'loading') {
    body = h('div', { className: 'mp-folder-state' }, h(Spinner), h('span', null, t('v2.loading')))
  } else if (state.phase === 'error') {
    body = h('div', { className: 'mp-folder-state' }, state.error || t('page.loadFailed'))
  } else if (state.playlists.length === 0) {
    body = h('div', { className: 'mp-folder-state' }, t('online.noCloudPlaylists'))
  } else {
    body = h(
      'div',
      { className: 'mp-folder-list' },
      state.playlists.map(function (playlist) {
        return h(
          'button',
          {
            key: playlist.id,
            type: 'button',
            className: 'mp-srow',
            disabled: busy !== '',
            onClick: function () {
              addTo(playlist)
            },
          },
          h(
            'div',
            { className: 'mp-srow-cover' },
            playlist.cover
              ? h(Cover, { src: onlineCoverSrc({ coverUrl: playlist.cover }, undefined, 'playlist'), iconSize: 18 })
              : icon('list', 18),
          ),
          h(
            'div',
            { className: 'mp-srow-main' },
            h('div', { className: 'mp-srow-title' }, playlist.name || ''),
            h('div', { className: 'mp-srow-sub' }, (playlist.trackCount || 0) + ' · ' + t('v2.songs')),
          ),
          busy === playlist.id ? h(Spinner) : icon('plus', 14),
        )
      }),
    )
  }

  return h(
    KitModal,
    {
      title: t('online.addToCloudPlaylist'),
      onClose: popLayer,
      footer: h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('v2.close')),
    },
    h('div', { className: 'mp-set-desc' }, track ? track.title || '' : ''),
    body,
  )
}
