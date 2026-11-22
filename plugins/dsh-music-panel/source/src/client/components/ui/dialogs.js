/**
 * dialogs: context menu, login, tag editor, add-to-playlist, confirm and toast.
 */

function ContextMenu(props) {
  var layer = props.layer
  var track = layer.props.track
  var online = typeof track.onlineProvider === 'string' && track.onlineProvider !== ''
  var favorite = libraryStore.get().favorites.indexOf(track.path) >= 0
  var items = []
  var likedPair = useState(false)
  var liked = likedPair[0]
  var setLiked = likedPair[1]

  useEffect(
    function () {
      if (!online) return undefined
      var cancelled = false
      getJson(
        API +
          'online/liked?provider=' +
          encodeURIComponent(track.onlineProvider) +
          '&id=' +
          encodeURIComponent(track.onlineId || ''),
      )
        .then(function (body) {
          if (!cancelled) setLiked(body.liked === true)
        })
        .catch(function () {
          // Not signed in / unavailable: keep the neutral state.
        })
      return function () {
        cancelled = true
      }
    },
    [online, track.onlineProvider, track.onlineId],
  )

  useEffect(function () {
    function onDown(event) {
      var node = event.target
      if (node && typeof node.closest === 'function' && node.closest('.mp-ctx')) return
      removeLayer('menu')
    }
    function onScroll() {
      removeLayer('menu')
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return function () {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  var selection = selectionStore.get()
  // A single selected row keeps its normal track menu. Batch actions only make
  // sense once more than one track is actually selected.
  var multi =
    selection.active === true &&
    selection.paths.length > 1 &&
    selection.paths.indexOf(track.path) >= 0
  if (multi) {
    var selectedPaths = selection.paths.slice()
    if (online) {
      if (typeof layer.props.playSelected === 'function') {
        items.push({
          key: 'play',
          icon: 'play',
          label: t('page.playSelected'),
          run: function () {
            layer.props.playSelected()
          },
        })
      }
      items.push({
        key: 'select-none',
        icon: 'x',
        label: t('page.selectNone'),
        run: clearSelection,
      })
      items.push({
        key: 'done',
        icon: 'check',
        label: t('page.done'),
        run: function () {
          setSelectionMode(false)
        },
      })
      } else {
    var library = libraryStore.get()
    var favoriteSet = {}
    ;(library.favorites || []).forEach(function (path) {
      favoriteSet[path] = true
    })
    var allFavorite = selectedPaths.every(function (path) {
      return favoriteSet[path] === true
    })
    var selectedTracks = (library.tracks || []).filter(function (item) {
      return selectedPaths.indexOf(item.path) >= 0
    })
    if (Array.isArray(layer.props.visiblePaths) && layer.props.visiblePaths.length > 0) {
      var visiblePaths = layer.props.visiblePaths
      items.push({
        key: 'select-all',
        icon: 'checkCircle',
        label: t('page.selectAll'),
        run: function () {
          selectAllPaths(visiblePaths)
        },
      })
    }
    items.push({
      key: 'select-none',
      icon: 'x',
      label: t('page.selectNone'),
      run: clearSelection,
    })
    items.push({
      key: 'done',
      icon: 'check',
      label: t('page.done'),
      run: function () {
        setSelectionMode(false)
      },
    })
    items.push({ key: 'sep-select', separator: true })
    items.push({
      key: 'play',
      icon: 'play',
      label: t('page.playSelected'),
      run: function () {
        if (selectedTracks.length > 0) player.playList(selectedTracks, 0)
      },
    })
    items.push({
      key: 'fav',
      icon: 'heart',
      label: allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'),
      run: function () {
        var targets = allFavorite
          ? selectedPaths.slice()
          : selectedPaths.filter(function (path) {
              return favoriteSet[path] !== true
            })
        void (async function () {
          try {
            for (var index = 0; index < targets.length; index += 1) await toggleFavorite(targets[index])
            showToast(allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'))
          } catch (error) {
            showToast(errorText(error))
          }
        })()
      },
    })
    items.push({
      key: 'add',
      icon: 'plus',
      label: t('page.addToPlaylist'),
      run: function () {
        pushLayer('addTo', { paths: selectedPaths.slice() })
      },
    })
    items.push({
      key: 'batch',
      icon: 'edit',
      label: t('page.batchEdit'),
      run: function () {
        pushLayer('batchEdit', { paths: selectedPaths.slice() })
      },
    })
    items.push({ key: 'sep-multi', separator: true })
    items.push({
      key: 'delete',
      icon: 'trash',
      label: t('page.delete'),
      danger: true,
      run: function () {
        var paths = selectedPaths.slice()
        pushLayer('confirm', {
          title: t('page.delete'),
          text: t('v2.removeSelectedConfirm', { n: paths.length }),
          onConfirm: function () {
            removeTracks(paths)
              .then(function (body) {
                showToast(t('v2.removed', { n: (body.moved || []).length }))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      },
    })
    }
  } else {
  items.push({
    key: 'play',
    icon: 'play',
    label: t('page.play'),
    run: function () {
      if (layer.props.onPlay) layer.props.onPlay(track)
      else player.playList([track], 0)
    },
  })
  items.push({
    key: 'next',
    icon: 'list',
    label: t('page.next'),
    run: function () {
      player.enqueueNext(track)
      showToast(t('page.addedNext'))
    },
  })
  items.push({
    key: 'queue',
    icon: 'plus',
    label: t('page.addToQueue'),
    run: function () {
      // Folia's queueDefaultBehavior decides where 「加入队列」 puts it.
      if (readPrefs().queueAddBehavior === 'next') player.enqueueNext(track)
      else player.enqueue(track)
      showToast(t('page.addedToQueue'))
    },
  })
  if (online) {
    items.push({
      key: 'fav',
      icon: liked ? 'heartFill' : 'heart',
      label: liked ? t('page.unfavorite') : t('page.favorite'),
      run: function () {
        var next = !liked
        postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next })
          .then(function () {
            setLiked(next)
            refreshLikedPlaylist(next ? 1 : -1)
            showToast(next ? t('page.favorite') : t('page.unfavorite'))
          })
          .catch(function (error) {
            showToast(errorText(error))
          })
      },
    })
    items.push({
      key: 'add-cloud',
      icon: 'plus',
      label: t('online.addToCloudPlaylist'),
      run: function () {
        pushLayer('onlineAddTo', { track: track })
      },
    })
  } else {
    items.push({
      key: 'fav',
      icon: favorite ? 'heartFill' : 'heart',
      label: favorite ? t('page.unfavorite') : t('page.favorite'),
      run: function () {
        void toggleFavorite(track.path)
      },
    })
    items.push({
      key: 'add',
      icon: 'plus',
      label: t('page.addToPlaylist'),
      run: function () {
        pushLayer('addTo', { track: track })
      },
    })
  }
  if (layer.props.onRemove) {
    items.push({
      key: 'remove',
      icon: 'trash',
      label: online ? t('online.removeFromHistory') : t('page.removeTrack'),
      run: layer.props.onRemove,
    })
  }
  items.push({ key: 'sep1', separator: true })
  if (!online) {
    items.push({
      key: 'tags',
      icon: 'edit',
      label: t('page.editMeta'),
      run: function () {
        pushLayer('tag', { path: track.path })
      },
    })
    items.push({
      key: 'reveal',
      icon: 'folder',
      label: t('page.reveal'),
      run: function () {
        void revealTrackPath(track.path)
      },
    })
  }
  if (!online) {
    items.push({
      key: 'copy',
      icon: 'copy',
      label: t('page.copyPath'),
      run: function () {
        copyTextSafely(track.path)
        showToast(t('page.copied'))
      },
    })
  }
  // The same panel serves both kinds: a local file's stat and tags, or an online row's
  // provider metadata plus what the media cache holds for it.
  items.push({
    key: 'details',
    icon: 'info',
    label: t('page.details'),
    run: function () {
      pushLayer('details', { track: track })
    },
  })

    }
var width = 190
  var height = items.length * 32 + 8
  var left = Math.max(8, Math.min(layer.props.x || 0, Math.max(8, window.innerWidth - width - 12)))
  var top = Math.max(8, Math.min(layer.props.y || 0, Math.max(8, window.innerHeight - height - 12)))

  // Host menus anchor to a trigger and fall back to a corner; context menus
  // must follow the pointer, so always use the custom fixed menu here.
  var HostMenu = null
  if (HostMenu !== null) {
    var hostItems = items.map(function (item) {
      if (item.separator) return { type: 'separator', id: item.key }
      return { id: item.key, label: item.label, icon: icon(item.icon, 14) }
    })
    return h(HostMenu, {
      open: true,
      anchor: null,
      items: hostItems,
      contextual: true,
      portal: true,
      side: 'bottom',
      align: 'start',
      getAnchorRect: function () {
        return { left: left, top: top, right: left, bottom: top, width: 0, height: 0, x: left, y: top }
      },
      onSelect: function (id) {
        popLayer()
        var chosen = null
        items.forEach(function (item) {
          if (chosen === null && item.key === id) chosen = item
        })
        if (chosen !== null && typeof chosen.run === 'function') chosen.run()
      },
      onClose: function () {
        popLayer()
      },
    })
  }

  return h(
    'div',
    { className: 'mp-ctx', style: { left: left + 'px', top: top + 'px' }, role: 'menu' },
    items.map(function (item) {
      if (item.separator) return h('hr', { key: item.key })
      return h(
        'button',
        {
          key: item.key,
          type: 'button',
          role: 'menuitem',
          onClick: function () {
            popLayer()
            item.run()
          },
        },
        icon(item.icon, 14),
        item.label,
      )
    }),
  )
}

function AddToPlaylistDialog(props) {
  var library = useStore(libraryStore)
  var layerProps = props.layer.props || {}
  var paths = Array.isArray(layerProps.paths)
    ? layerProps.paths.slice()
    : layerProps.track
      ? [layerProps.track.path]
      : []
  var playlists = Array.isArray(library.playlists) ? library.playlists : []
  var pair = useState('')
  var name = pair[0]
  var setName = pair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  function addTo(id) {
    if (busy || paths.length === 0) return
    setBusy(true)
    addToPlaylist(id, paths).then(function (ok) {
      setBusy(false)
      if (ok) {
        popLayer()
        showToast(t('page.addedToPlaylist'))
      }
    })
  }

  function createAndAdd() {
    var value = name.trim()
    if (value === '' || busy) return
    setBusy(true)
    createPlaylist(value).then(function (created) {
      if (created && created.id) return addToPlaylist(created.id, paths)
      return false
    }).then(function (ok) {
      setBusy(false)
      if (ok !== false) {
        popLayer()
        showToast(t('page.addedToPlaylist'))
      }
    })
  }

  return h(
    KitModal,
    {
      title: t('page.addToPlaylist'),
      small: true,
      onClose: popLayer,
    },
    playlists.length === 0
      ? h('p', { className: 'mp-set-desc' }, t('v2.noPlaylists'))
      : playlists.map(function (playlist) {
          return h(
            'button',
            {
              key: playlist.id,
              type: 'button',
              className: 'mp-srow',
              onClick: function () {
                addTo(playlist.id)
              },
            },
            h('div', { className: 'mp-srow-cover' }, icon('list', 16)),
            h(
              'div',
              { className: 'mp-srow-main' },
              h('div', { className: 'mp-srow-title' }, playlist.name),
              h('div', { className: 'mp-srow-sub' }, (playlist.trackPaths || []).length + ''),
            ),
            icon('chevronRight', 14),
          )
        }),
    h(
      'div',
      { style: { display: 'flex', gap: '8px', paddingTop: '6px' } },
      h('input', {
        type: 'text',
        value: name,
        autoFocus: true,
        placeholder: t('v2.newPlaylist'),
        className: 'mp-kit-input',
        onChange: function (event) {
          setName(event.target.value)
        },
        onKeyDown: function (event) {
          if (event.key === 'Enter') createAndAdd()
        },
      }),
      h(
        Button,
        { variant: 'primary', icon: 'plus', disabled: busy || name.trim() === '', onClick: createAndAdd },
        t('page.create'),
      ),
    ),
  )
}

// The login window lives in src/render/login/login-dialog.js: Folia's own
// components (bundled from folia-src) draw it, so this file only hosts the other
// dialogs.

function LoginDialog(props) {
  var onlineState = useStore(onlineStore)
  var initial = props.layer.props.provider || 'netease'
  var selectedPair = useState(initial)
  var provider = selectedPair[0]
  var setProvider = selectedPair[1]
  var runPair = useState({ mode: props.layer.props.mode || 'qq', seq: 0 })
  var run = runPair[0]
  var setRun = runPair[1]
  var qrPair = useState(null)
  var qr = qrPair[0]
  var setQr = qrPair[1]
  var statusPair = useState('waiting')
  var status = statusPair[0]
  var setStatus = statusPair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  var servicePair = useState(null)
  var service = servicePair[0]
  var setService = servicePair[1]
  var expiresAtRef = useRef(0)
  var scannedAtRef = useRef(0)
  var finishedRef = useRef(false)
  var providerInfo = (onlineState.providers || {})[provider] || {}
  var providerKnown = Object.prototype.hasOwnProperty.call(onlineState.providers || {}, provider)
  var signedIn = providerInfo.loggedIn === true
  // Folia keeps server connections (Navidrome) in Settings; this window is for the
  // online platforms that sign in with a QR code.
  var providers = availableSources().filter(function (id) {
    return id !== 'local' && supports(id, 'loginQr')
  })

  useEffect(
    function () {
      void loadProviders()
    },
    [],
  )

  useEffect(
    function () {
      var cancelled = false
      getJson(API + 'online/login/local-service?provider=' + encodeURIComponent(provider))
        .then(function (body) {
          if (!cancelled) setService(body.localService || null)
        })
        .catch(function () {
          if (!cancelled) setService(null)
        })
      return function () {
        cancelled = true
      }
    },
    [provider],
  )

  function restartService() {
    setService(function (previous) {
      return Object.assign({}, previous || {}, { restarting: true })
    })
    void postJson(API + 'online/login/local-service/restart', { provider: provider })
      .then(function (body) {
        setService(body.localService || null)
        retry(run.mode)
      })
      .catch(function (error) {
        setService(function (previous) {
          return Object.assign({}, previous || {}, { restarting: false, error: errorText(error) })
        })
      })
  }

  function selectProvider(id) {
    if (id === provider) return
    setProvider(id)
    setError('')
    setStatus('waiting')
    setQr(null)
    finishedRef.current = false
    expiresAtRef.current = 0
    scannedAtRef.current = 0
    setRun({ mode: 'qq', seq: run.seq + 1 })
  }

  function cancel(key) {
    // Attempt-scoped: a window closing after a newer attempt started must only release
    // the QR it owns, never the newer one.
    var attemptKey = typeof key === 'string' && key !== '' ? key : (qr && qr.key) || ''
    void postJson(API + 'online/login/cancel', { provider: provider, key: attemptKey }).catch(function () {
      // The key may already have expired; closing the window is enough.
    })
  }

  function close() {
    cancel()
    popLayer()
  }

  function retry(nextMode) {
    setError('')
    setStatus('waiting')
    setQr(null)
    finishedRef.current = false
    expiresAtRef.current = 0
    scannedAtRef.current = 0
    setRun({ mode: nextMode || run.mode, seq: run.seq + 1 })
  }

  useEffect(
    function () {
      if (!providerKnown || signedIn) return undefined
      var cancelled = false
      var timer = null
      var polling = false
      var current = null

      function stop(nextStatus) {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
        if (!cancelled) setStatus(nextStatus)
      }

      function expire() {
        stop('expired')
        cancel(current && current.key)
      }

      function schedule() {
        if (cancelled) return
        timer = setTimeout(poll, 2000)
      }

      function poll() {
        if (cancelled || polling || current === null) return
        if (expiresAtRef.current > 0 && Date.now() > expiresAtRef.current) {
          expire()
          return
        }
        if (scannedAtRef.current > 0 && Date.now() - scannedAtRef.current > 60 * 1000) {
          expire()
          return
        }
        polling = true
        checkProviderLogin(provider, current.key, current.mode || run.mode)
          .then(function (next) {
            if (cancelled) return
            if (next === 'success') {
              finishedRef.current = true
              stop('success')
              resetOnlineAccountData()
              void loadProviders()
              void loadMyPlaylists(provider)
              showToast(t('online.loginSuccess'))
              popLayer()
              return
            }
            if (next === 'scanned') {
              if (scannedAtRef.current === 0) scannedAtRef.current = Date.now()
            } else if (next === 'waiting') {
              scannedAtRef.current = 0
            }
            setStatus(next)
            if (next === 'expired' || next === 'failed') {
              stop(next)
              cancel(current && current.key)
              return
            }
            schedule()
          })
          .catch(function (pollError) {
            if (cancelled) return
            if (pollError && pollError.body && pollError.body.error && pollError.body.error.code === 'LOGIN_STALE') {
              stop('failed')
              return
            }
            setError(errorText(pollError))
          })
          .finally(function () {
            polling = false
          })
      }

      startProviderLogin(provider, run.mode)
        .then(function (body) {
          if (cancelled) {
            // The window was closed while the key was being created.
            void postJson(API + 'online/login/cancel', { provider: provider, key: body.key }).catch(function () {})
            return
          }
          setQr(body)
          current = body
          expiresAtRef.current = Number(body.expiresAt) || 0
          scannedAtRef.current = 0
          schedule()
        })
        .catch(function (startError) {
          if (cancelled) return
          setError(errorText(startError))
          setStatus('failed')
        })
      return function () {
        cancelled = true
        if (timer !== null) clearTimeout(timer)
        // The key belongs to this attempt: after a refresh/newer start, releasing it is
        // harmless and the newer attempt is left untouched.
        if (!finishedRef.current) {
          void postJson(API + 'online/login/cancel', {
            provider: provider,
            key: current === null ? '' : current.key,
          }).catch(function () {})
        }
      }
    },
    [provider, run.mode, run.seq, providerKnown, signedIn],
  )

  var providerLabel = sourceLabelOf(provider)
  var failed = error !== '' || status === 'expired' || status === 'failed'
  var statusLabel =
    error !== ''
      ? error
      : status === 'scanned'
        ? t('online.statusscanned')
        : status === 'success'
          ? t('online.statussuccess')
          : status === 'expired'
            ? t('online.statusexpired')
            : status === 'failed'
              ? t('online.statusfailed')
              : t('online.statuswaiting')
  /** One provider mark in the switcher row; a dot marks accounts already signed in. */
  function providerChip(id) {
    var info = (onlineState.providers || {})[id] || {}
    var signed = info.loggedIn === true
    var label = sourceLabelOf(id)
    var labelText = signed && info.nickname ? label + ' · ' + info.nickname : label
    var avatar =
      signed && typeof info.avatarUrl === 'string' && info.avatarUrl !== ''
        ? h('img', {
            className: 'mp-login-chip-avatar',
            src: API + 'online/cover?provider=' + encodeURIComponent(id) + '&url=' + encodeURIComponent(info.avatarUrl),
            alt: '',
          })
        : null
    return h(
      'button',
      {
        key: id,
        type: 'button',
        className: cx('mp-login-chip', id === provider && 'is-on'),
        title: labelText,
        'aria-label': labelText,
        'aria-pressed': id === provider ? 'true' : 'false',
        onClick: function () {
          selectProvider(id)
        },
      },
      avatar === null
        ? h('span', { className: 'mp-login-chip-logo' }, providerLogo(id, 24))
        : avatar,
      signed ? h('i', { className: 'mp-login-chip-dot', 'aria-hidden': 'true' }) : null,
    )
  }

  function syncAccount() {
    void postJson(API + 'online/account-sync', { provider: provider })
      .then(function () {
        return loadProviders()
      })
      .then(function () {
        showToast(t('online.loginSuccess'))
      })
      .catch(function (error) {
        showToast(errorText(error))
      })
  }

  var footNote = h('span', { className: 'mp-login-secure' }, icon('checkCircle', 12), h('span', null, t('online.qrSecure')))

  function accountView() {
    var avatar = providerInfo.avatarUrl
      ? h('img', {
          className: 'mp-login-avatar',
          src: API + 'online/cover?provider=' + encodeURIComponent(provider) + '&url=' + encodeURIComponent(providerInfo.avatarUrl),
          alt: '',
        })
      : h('span', { className: 'mp-login-avatar is-fallback' }, (providerInfo.nickname || '?').slice(0, 1))
    return [
      h(
        'div',
        { key: 'body', className: 'mp-login-body' },
        h(
          'div',
          { className: 'mp-login-account' },
          avatar,
          h(
            'div',
            { className: 'mp-login-account-text' },
            h(
              'div',
              { className: 'mp-login-account-name' },
              providerInfo.nickname || t('online.loggedIn'),
              providerInfo.vip === true ? h(KitTag, { tone: 'warning' }, 'VIP') : null,
            ),
            h('div', { className: 'mp-login-view-sub' }, providerInfo.server || providerLabel),
          ),
        ),
      ),
      h(
        'div',
        { key: 'foot', className: 'mp-login-foot' },
        footNote,
        h(
          'div',
          { className: 'mp-login-foot-actions' },
          h(Button, { variant: 'ghost', icon: 'refresh', onClick: syncAccount, children: t('online.syncAccount') }),
          h(Button, {
            className: 'mp-login-signout',
            icon: 'x',
            onClick: function () {
              void logoutProvider(provider)
            },
            children: t('online.logout'),
          }),
        ),
      ),
    ]
  }

  // Folia's provider-specific notes: Qishui's code is a Douyin authorization (scan it in
  // the Douyin app), and Bodian/Kugou name their own app. Everything else is generic.
  var loginTitleText =
    provider === 'qishui'
      ? t('online.loginTitleQishui')
      : provider === 'bodian'
        ? t('online.loginTitleBodian')
        : provider === 'kugou' || provider === 'kugouLite'
          ? t('online.loginTitleKugou')
          : t('online.loginTitle', { provider: providerLabel })
  var loginNoteText =
    provider === 'qishui'
      ? t('online.loginNoteQishui')
      : provider === 'bodian'
        ? t('online.loginNoteBodian')
        : provider === 'kugou' || provider === 'kugouLite'
          ? t('online.loginNoteKugou')
          : t('online.qrDesc', { provider: providerLabel })

  var qrView = [
    h(
      'div',
      { key: 'body', className: 'mp-login-body' },
      h(
        'div',
        { className: 'mp-login-view' },
        h('div', { className: 'mp-login-view-title' }, loginTitleText),
        h('div', { className: 'mp-login-view-sub' }, loginNoteText),
        provider === 'qq'
          ? h(
              'div',
              { className: 'mp-login-methods', role: 'group', 'aria-label': t('online.loginMethods') },
              [
                { value: 'qq', label: t('online.loginQq') },
                { value: 'wx', label: t('online.loginWechat') },
              ].map(function (method) {
                return h(
                  KitPill,
                  {
                    key: method.value,
                    active: (run.mode === 'wx' ? 'wx' : 'qq') === method.value,
                    onClick: function () {
                      retry(method.value)
                    },
                  },
                  method.label,
                )
              }),
            )
          : null,
        h(
          'div',
          { className: 'mp-login-qr-shell' },
          h(
            'div',
            { className: cx('mp-login-qr-frame', status === 'scanned' && 'is-scanned') },
            qr && qr.imageDataUrl
              ? h('img', { className: 'mp-login-qr-img', src: qr.imageDataUrl, alt: '' })
              : h(
                  'div',
                  { className: 'mp-login-qr-loading' },
                  h('span', { className: 'mp-login-spinner' }),
                  h('span', null, t('online.qrLoading')),
                ),
            h('i', { className: 'mp-login-corner tl' }),
            h('i', { className: 'mp-login-corner tr' }),
            h('i', { className: 'mp-login-corner bl' }),
            h('i', { className: 'mp-login-corner br' }),
          ),
        ),
        h(
          'div',
          {
            className: cx(
              'mp-login-state',
              failed && 'is-error',
              status === 'scanned' && 'is-scanned',
              status === 'success' && 'is-success',
            ),
          },
          h('span', { className: 'mp-login-dot' }),
          h('span', null, statusLabel),
        ),
        h('div', { className: 'mp-login-hint' }, t('online.qrHintInline')),
      ),
    ),
    h(
      'div',
      { key: 'foot', className: 'mp-login-foot' },
      footNote,
      h(
        'div',
        { className: 'mp-login-foot-actions' },
        service && service.available === true && service.failed === true
          ? h(Button, {
              variant: 'ghost',
              icon: 'refresh',
              disabled: service.restarting === true,
              onClick: restartService,
              children: service.restarting === true ? t('online.restartingService') : t('online.restartService'),
            })
          : null,
        h(Button, {
          variant: failed ? 'primary' : 'ghost',
          icon: 'refresh',
          onClick: function () {
            retry(run.mode)
          },
          children: t('online.qrRefresh'),
        }),
      ),
    ),
  ]

  return h(
    KitModal,
    {
      title: t('online.loginWindowTitle'),
      className: 'mp-login-window',
      onClose: close,
    },
    h(
      'div',
      { className: 'mp-login' },
      h('div', { className: 'mp-login-chips', role: 'group', 'aria-label': t('online.loginAccounts') }, providers.map(providerChip)),
      signedIn ? accountView() : qrView,
    ),
  )
}

var TAG_FIELDS = [
  ['title', 'page.metaTitle'],
  ['artist', 'page.artist'],
  ['album', 'page.album'],
  ['albumArtist', 'page.albumArtist'],
  ['year', 'page.year'],
  ['genre', 'page.genre'],
  ['track', 'page.trackNo'],
  ['disc', 'page.discNo'],
  ['composer', 'page.composer'],
  ['lyricist', 'page.lyricist'],
  ['comment', 'page.comment'],
]

// Fields the editor keeps while the match window is open over the panel.
var tagEditorDraft = null

function TagDialog(props) {
  var path = props.layer.props.path
  var tagsPair = useState(null)
  var tags = tagsPair[0]
  var setTags = tagsPair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]
  var formPair = useState({})
  var form = formPair[0]
  var setForm = formPair[1]
  var coverPair = useState(null)
  var coverPreview = coverPair[0]
  var setCoverPreview = coverPair[1]
  useEffect(
    function () {
      var cancelled = false
      getJson(API + 'tags?path=' + encodeURIComponent(path))
        .then(function (body) {
          if (cancelled) return
          var loaded = body.tags || {}
          setTags(loaded)
          var next = {}
          TAG_FIELDS.forEach(function (entry) {
            var value = loaded[entry[0]]
            next[entry[0]] = value === undefined || value === null ? '' : String(value)
          })
          next.lyrics = typeof loaded.lyrics === 'string' ? loaded.lyrics : ''
          // Coming back from the match window: its lyrics (and whatever was typed
          // before) win over what is on disk.
          if (tagEditorDraft !== null && tagEditorDraft.path === path) {
            var draft = tagEditorDraft
            tagEditorDraft = null
            Object.keys(draft.form).forEach(function (key) {
              next[key] = draft.form[key]
            })
          }
          setForm(next)
        })
        .catch(function (loadError) {
          if (!cancelled) setError(errorText(loadError))
        })
      return function () {
        cancelled = true
      }
    },
    [path],
  )

  function setField(key, value) {
    setForm(function (previous) {
      var next = Object.assign({}, previous)
      next[key] = value
      return next
    })
  }

  function metaField(key, wide) {
    var labelKey = TAG_FIELDS.find(function (entry) { return entry[0] === key })[1]
    return h(
      'label',
      { className: 'mp-meta-field' + (wide === true ? ' is-wide' : '') },
      h('span', { className: 'mp-meta-label' }, t(labelKey)),
      h(KitInput, {
        className: 'mp-meta-input',
        value: form[key] || '',
        disabled: busy,
        onChange: function (value) {
          setField(key, value)
        },
      }),
    )
  }

  function openOnlineLyric() {
    // 匹配歌词 is an independent window inside the plugin panel; the editor is a host
    // modal, so it steps aside and returns with the chosen lyrics.
    tagEditorDraft = { path: path, form: form }
    var wantedPath = path
    var wantedForm = form
    popLayer()
    pushLayer('lyricMatch', {
      track: {
        path: wantedPath,
        title: wantedForm.title || '',
        artist: wantedForm.artist || '',
        album: wantedForm.album || '',
      },
      onApply: function (lrc) {
        tagEditorDraft = {
          path: wantedPath,
          form: Object.assign({}, wantedForm, { lyrics: lrc }),
        }
        pushLayer('tag', { path: wantedPath })
      },
    })
  }

  function save() {
    if (busy) return
    setBusy(true)
    setError('')
    var current = player.getSnapshot()
    var playingThis =
      current.index >= 0 && current.queue[current.index] && current.queue[current.index].path === path
    if (playingThis) player.suspend()
    function restorePlayback() {
      if (playingThis && !player.getSnapshot().playing) player.toggle()
    }
    sendJson('PUT', API + 'tags', {
      path: path,
      tags: form,
      coverUrl: coverPreview || '',
    })
      .then(function () {
        setBusy(false)
        restorePlayback()
        popLayer()
        showToast(t('page.metaSaved'))
        void loadLibrary(true)
      })
      .catch(function (saveError) {
        setBusy(false)
        restorePlayback()
        setError(errorText(saveError))
      })
  }

  var coverSrc =
    coverPreview !== null && coverPreview !== undefined
      ? API + 'online/cover?url=' + encodeURIComponent(coverPreview)
      : API + 'cover?path=' + encodeURIComponent(path)
  var fileName = String(path || '').split(/[\\/]/).pop() || ''
  var lyricLineCount = String(form.lyrics || '')
    .split(/\r?\n/)
    .filter(function (line) {
      return line.trim() !== ''
    }).length

  function section(title, body, extra, className) {
    return h(
      'section',
      { className: 'mp-meta-section' + (className ? ' ' + className : '') },
      h(
        'div',
        { className: 'mp-meta-section-head' },
        h('h3', { className: 'mp-set-label' }, title),
        extra ? h('div', { className: 'mp-meta-section-extra' }, extra) : null,
      ),
      body,
    )
  }

  var loading = tags === null
  var body =
    loading === true
      ? error !== ''
        ? h('div', { className: 'mp-meta-error', role: 'alert' }, error)
        : h('div', { className: 'mp-meta-loading' }, h(Spinner), h('span', null, t('v2.loading')))
      : h(
          'div',
          { className: 'mp-meta-body' },
          error !== '' ? h('div', { className: 'mp-meta-error', role: 'alert' }, error) : null,
          h(
            'div',
            { className: 'mp-meta-hero' },
            h(Cover, { src: coverSrc, className: 'mp-meta-cover', iconSize: 40 }),
            h(
              'div',
              { className: 'mp-meta-identity' },
              h('div', { className: 'mp-meta-title' }, form.title || fileName || t('page.editMeta')),
              h('div', { className: 'mp-meta-artist' }, form.artist || t('page.unknownArtist')),
              h(
                'div',
                { className: 'mp-meta-source' },
                tags && tags.format ? h(KitTag, { tone: 'neutral' }, tags.format) : null,
                h('span', { className: 'mp-meta-file' }, fileName),
              ),
            ),
            h(
              'div',
              { className: 'mp-meta-actions' },
              h(
                Button,
                { icon: 'search', disabled: busy, onClick: openOnlineLyric },
                t('page.onlineLyrics'),
              ),
              coverPreview !== null
                ? h(
                    Button,
                    {
                      variant: 'ghost',
                      icon: 'refresh',
                      disabled: busy,
                      onClick: function () {
                        setCoverPreview(null)
                      },
                    },
                    t('page.resetCover'),
                  )
                : null,
            ),
          ),
          h(
            'div',
            { className: 'mp-meta-work' },
            h(
              'div',
              { className: 'mp-meta-main' },
              section(
                t('page.metaBasic'),
                h(
                  'div',
                  { className: 'mp-meta-grid' },
                  metaField('title'),
                  metaField('artist'),
                  metaField('album'),
                  metaField('albumArtist'),
                ),
              ),
              section(
                t('page.metaDetail'),
                [
                  h(
                    'div',
                    { key: 'release', className: 'mp-meta-grid' },
                    metaField('year'),
                    metaField('genre'),
                    metaField('track'),
                    metaField('disc'),
                  ),
                  h(
                    'div',
                    { key: 'credits', className: 'mp-meta-grid' },
                    metaField('composer'),
                    metaField('lyricist'),
                  ),
                  h(
                    'div',
                    { key: 'comment', className: 'mp-meta-grid' },
                    metaField('comment', true),
                  ),
                ],
              ),
            ),
            section(
              t('page.lyrics'),
              h(
                'label',
                { className: 'mp-meta-field is-wide' },
                h('span', { className: 'mp-meta-label' }, t('page.lyrics')),
                h('textarea', {
                  className: 'mp-meta-textarea',
                  rows: 14,
                  value: form.lyrics || '',
                  placeholder: t('page.lyricsPlaceholder'),
                  disabled: busy,
                  onChange: function (event) {
                    setField('lyrics', event.target.value)
                  },
                }),
              ),
              h('span', { className: 'mp-meta-count' }, t('page.lyricsLineCount', { n: lyricLineCount })),
              'mp-meta-lyrics',
            ),
          ),
          h('p', { className: 'mp-meta-note' }, t('page.metaHint')),
        )

  return h(
    KitModal,
    {
      title: t('page.editMeta'),
      className: 'mp-meta-modal',
      onClose: popLayer,
      footer: h(
        'div',
        { className: 'mp-meta-footer' },
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(
          Button,
          {
            key: 'save',
            variant: 'primary',
            disabled: busy || loading,
            onClick: save,
          },
          busy ? t('page.saving') : t('page.save'),
        ),
      ),
    },
    body,
  )
}

function ConfirmDialog(props) {
  var layer = props.layer
  return h(
    KitModal,
    {
      title: layer.props.title || '',
      small: true,
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(
          Button,
          {
            key: 'ok',
            variant: 'primary',
            onClick: function () {
              var action = layer.props.onConfirm
              popLayer()
              if (typeof action === 'function') action()
            },
          },
          t('page.done'),
        ),
      ],
    },
    h('p', { className: 'mp-kit-text' }, layer.props.text || ''),
  )
}

function Toast(props) {
  var toast = useStore(toastStore)
  var HostToast = hostComponent('Toast')
  if (HostToast !== null && toast.text !== '') {
    return h(HostToast, {
      key: toast.seq,
      text: toast.text,
      holdMs: 1800,
      onDone: function () {
        if (toastStore.get().seq === toast.seq) toastStore.set({ text: '', seq: toast.seq })
      },
    })
  }
  return h(
    'div',
    { className: cx('mp-toast', toast.text !== '' && 'is-on'), role: 'status' },
    toast.text,
  )
}
