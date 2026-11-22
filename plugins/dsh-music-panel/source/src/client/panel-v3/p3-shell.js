/**
 * panel-v3 shell: top bar, view bar, content, player bar, queue and runtime.
 */

/**
 * One queue panel. Its open state lives here so every entry point asks for the same
 * surface: in-panel buttons toggle it, and from the chat the panel is brought up first
 * because `.mpv3-root` is unmounted while the host keeps the panel hidden.
 */
var p3QueueStore = createStore({ open: false })
/** Last watcher revision seen; 0 until the first poll establishes the baseline. */
var p3LastLibraryRevision = 0

function p3SetQueueOpen(open) {
  p3QueueStore.set({ open: open === true })
}

/** Open the queue from anywhere, bringing the panel up when it is not mounted. */
function p3OpenQueue() {
  p3SetQueueOpen(true)
  if (typeof document === 'undefined') return
  if (document.querySelector('.mpv3-root') !== null) return
  var row = document.querySelector('[data-music-panel-row]')
  if (row !== null && typeof row.click === 'function') row.click()
}

function p3AccountPictureSrc(url) {
  var text = String(url || '')
  if (text === '') return ''
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
    return text.replace(/^http:\/\//i, 'https://')
  }
  return text
}

function P3TopBar(props) {
  var route = useStore(p3RouteStore)
  var search = useStore(p3SearchStore)
  var collection = useStore(p3CollectionNavStore)
  var online = useStore(onlineStore)
  var prefs = usePrefs()
  var sourceRef = useRef(null)
  var [sourceOpen, setSourceOpen] = useState(false)
  var [draft, setDraft] = useState('')
  var source = route.source
  var info = p3SourceInfo(source)
  var meta = p3PageMeta(route, props.library, online, prefs)
  var loggedIn = p3SourceLoggedIn(source)
  var avatarUrl = p3AccountPictureSrc(info.avatarUrl)
  var sourceItems = p3SourceList().map(function (item) {
    return {
      key: item.id,
      label: item.name,
      logo: item.id === 'local' || item.pending === true ? null : item.id,
      icon: item.id === 'local' ? 'hardDrive' : item.pending === true ? 'server' : null,
      status: item.pending === true ? t('p3.statusLoading') : p3SourceStatus(item.id),
      disabled: item.pending === true,
      active: item.id === source,
    }
  })
  sourceItems.push({ separator: true, key: 'source-sep' })
  sourceItems.push({ key: 'manage', label: t('p3.manageSources'), icon: 'settings' })
  var accountItems = loggedIn
    ? [
        { key: 'relogin', label: t('p3.relogin'), icon: 'refresh' },
        { key: 'logout', label: t('p3.logout'), icon: 'logout', danger: true },
        { key: 'accountSettings', label: t('p3.sourceSettings'), icon: 'settings' },
      ]
    : [
        { key: 'login', label: t('p3.login'), icon: 'user' },
        { key: 'accountSettings', label: t('p3.sourceSettings'), icon: 'settings' },
      ]
  var menuItems = source !== 'local'
    ? accountItems.concat([{ separator: true, key: 'account-sep' }], sourceItems)
    : sourceItems

  function searchValue() {
    return search.open ? search.query : draft
  }

  function onFocusSearch() {
    // Focus is not navigation: typing the first character enters the search page.
  }

  function onChangeSearch(event) {
    var value = event.target.value
    setDraft(value)
    if (value === '' && !search.open) return
    p3SetSearchQuery(value)
  }

  function onSearchKey(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      var text = searchValue().trim()
      if (text === '') return
      p3SetSearchQuery(text)
      if (source !== 'local') void searchOnline(text)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (p3CanGoBack()) p3GoBack()
      else setDraft('')
    }
  }

  function clearSearch() {
    setDraft('')
    if (search.open) p3CloseSearch()
  }

  function pickMenuItem(item) {
    setSourceOpen(false)
    if (!item) return
    if (item.key === 'manage') {
      pushLayer('settings', { tab: 'online' })
      return
    }
    if (item.key === 'login' || item.key === 'relogin') {
      if (source === 'navidrome') pushLayer('settings', { tab: 'online' })
      else pushLayer('login', { provider: source })
      return
    }
    if (item.key === 'logout') {
      postJson(API + 'online/logout', { provider: source }).then(function () {
        void loadProviders()
        showToast(t('p3.loggedOut'))
      }).catch(function (error) { showToast(errorText(error)) })
      return
    }
    if (item.key === 'accountSettings') {
      pushLayer('settings', { tab: 'online' })
      return
    }
    p3SwitchSource(item.key)
  }

  function refresh() {
    if (source === 'local') {
      void loadLibrary(true)
      showToast(t('p3.refreshLocal'))
    } else {
      void loadProviders()
      void loadMyPlaylists(source)
      showToast(t('p3.refreshOnline'))
    }
  }

  return h(
    'header',
    { className: 'mpv3-topbar' },
    p3CanGoBack() ? h('button', {
      type: 'button',
      className: 'mpv3-back-btn',
      title: t('page.back'),
      'aria-label': t('page.back'),
      onClick: function () { p3GoBack() },
    }, icon('back', 16), h('span', null, t('page.back'))) : null,
    h('span', { className: 'mpv3-parent' }, meta.parent),
    h('div', { className: 'mpv3-source-wrap' },
      h('button', {
        type: 'button',
        ref: sourceRef,
        className: 'mpv3-source-btn',
        'aria-haspopup': 'menu',
        'aria-expanded': sourceOpen ? 'true' : 'false',
        'aria-label': t('p3.switchSource') + ' · ' + t('p3.account'),
        onClick: function () { setSourceOpen(!sourceOpen) },
        title: t('p3.switchSource'),
      },
        h('span', { className: cx('mpv3-source-avatar', source === 'local' && 'is-local') },
          avatarUrl
            ? h('img', { src: avatarUrl, alt: '' })
            : loggedIn && info.nickname
              ? h('span', { className: 'mpv3-source-initial' }, p3Initial(info.nickname || info.name))
              : source === 'local'
                ? icon('hardDrive', 14)
                : h('span', { className: 'mpv3-source-logo' }, providerLogo(source, 24)),
          source !== 'local' && (avatarUrl || (loggedIn && info.nickname))
            ? h('span', { className: 'mpv3-source-badge' }, providerLogo(source, 14))
            : null,
        ),
        h('span', { className: 'mpv3-source-name' }, p3SourceLabel(source)),
        loggedIn && info.vip === true ? h('span', { className: 'mpv3-source-vip', title: info.vipExpiresAt ? t('p3.vipUntil', { date: info.vipExpiresAt }) : t('p3.vip') }, 'VIP') : null,
        !loggedIn ? h('i', { className: 'mpv3-source-dot' }) : null,
        icon('chevronDown', 12),
      ),
      h(P3Menu, { open: sourceOpen, anchor: sourceRef.current, items: menuItems, align: 'left', onSelect: pickMenuItem, onClose: function () { setSourceOpen(false) } }),
    ),
    h('div', { className: 'mpv3-grow' }),
    h('div', { className: 'mpv3-search' },
      icon('search', 14),
      h('input', {
        id: 'p3-search',
        type: 'search',
        value: searchValue(),
        placeholder: t('p3.searchPlaceholder'),
        onFocus: onFocusSearch,
        onChange: onChangeSearch,
        onKeyDown: onSearchKey,
        'aria-label': t('page.search'),
      }),
      !collection.snapshot && searchValue() !== ''
        ? h('button', { type: 'button', className: 'mpv3-search-clear', title: t('p3.clearSearch'), onClick: clearSearch }, icon('close', 13))
        : null,
    ),
    h(IconButton, { icon: 'refresh', size: 16, title: t('page.refresh'), onClick: refresh }),
    h(IconButton, { icon: 'settings', size: 16, title: t('page.settings'), onClick: function () { pushLayer('settings') } }),
  )
}

function P3ViewBar(props) {
  var route = useStore(p3RouteStore)
  var selection = useStore(selectionStore)
  var prefs = usePrefs()
  var sortRef = useRef(null)
  var selectRef = useRef(null)
  var [sortOpen, setSortOpen] = useState(false)
  var [selectOpen, setSelectOpen] = useState(false)
  var source = route.source
  var tabs = p3Tabs(source)
  var active = route.page
  var tracks = p3CurrentTracks(route, props.library, props.online, prefs)
  var selected = (selection.paths || []).map(function (path) {
    return tracks.filter(function (track) { return track.path === path })[0]
  }).filter(Boolean)
  var selecting = (selection.paths || []).length > 0
  var sortItems
  if (route.source !== 'local' && route.page === 'playlists') {
    sortItems = [
      { key: 'source', label: t('v2.sortSource'), icon: 'list', active: prefs.onlinePlaylistSort !== 'name' && prefs.onlinePlaylistSort !== 'count' },
      { key: 'name', label: t('v2.sortName'), icon: 'sort', active: prefs.onlinePlaylistSort === 'name' },
      { key: 'count', label: t('v2.sortCount'), icon: 'chart', active: prefs.onlinePlaylistSort === 'count' },
    ]
  } else {
    sortItems = [
      { key: 'title', label: t('v2.sortTitle'), icon: 'list', active: prefs.sortBy === 'title' },
      { key: 'artist', label: t('v2.sortArtist'), icon: 'user', active: prefs.sortBy === 'artist' },
      { key: 'duration', label: t('v2.sortDuration'), icon: 'clock', active: prefs.sortBy === 'duration' },
      { key: 'added', label: t('v2.sortAdded'), icon: 'clock', active: prefs.sortBy === 'added' },
      { separator: true, key: 'sep' },
      { key: 'asc', label: t('p3.asc'), icon: 'up', active: prefs.sortDir !== 'desc' },
      { key: 'desc', label: t('p3.desc'), icon: 'down', active: prefs.sortDir === 'desc' },
    ]
  }
  var selectItems = [
    { key: 'all', label: t('v2.selAll'), icon: 'checkCircle' },
    { key: 'none', label: t('v2.selNone'), icon: 'xCircle' },
    { key: 'range', label: t('v2.selRange'), icon: 'target' },
    { key: 'invert', label: t('v2.selInvert'), icon: 'refresh' },
  ]

  function pickSort(item) {
    setSortOpen(false)
    if (!item) return
    if (item.key === 'asc') setPrefs({ sortDir: 'asc' })
    else if (item.key === 'desc') setPrefs({ sortDir: 'desc' })
    else if (item.key === 'source' || item.key === 'name' || item.key === 'count') setPrefs({ onlinePlaylistSort: item.key })
    else setPrefs({ sortBy: item.key === 'duration' ? 'duration' : item.key })
  }

  function pickSelect(item) {
    setSelectOpen(false)
    if (!item) return
    if (item.key === 'all') selectAllIn(tracks)
    else if (item.key === 'none') setSelectionMode(false)
    else if (item.key === 'range') beginRangePick()
    else if (item.key === 'invert') invertSelectionIn(tracks)
  }

  function selectionAction(key) {
    if (key === 'done') { setSelectionMode(false); return }
    if (key === 'play') { if (selected.length > 0) p3PlayList(selected, 0); return }
    if (key === 'like') {
      selected.forEach(function (track) { likeStateOf(track, props.favoriteSet).onLike() })
      return
    }
    if (key === 'add') {
      if (source === 'local' && selected.length > 0) pushLayer('addTo', { paths: selected.map(function (track) { return track.path }) })
      else showToast(t('p3.onlineWriteUnsupported'))
      return
    }
    if (key === 'batch') {
      if (source === 'local' && selected.length > 0) pushLayer('batchEdit', { paths: selected.map(function (track) { return track.path }) })
      else showToast(t('p3.onlineWriteUnsupported'))
      return
    }
    if (key === 'delete') {
      if (source === 'local' && selected.length > 0) {
        pushLayer('confirm', {
          title: t('page.delete'),
          text: t('p3.removeConfirm', { n: selected.length }),
          onConfirm: function () { void removeTracks(selected.map(function (track) { return track.path })) },
        })
      }
      return
    }
  }

  if (selecting) {
    return h('div', { className: 'mpv3-viewbar' },
      h('div', { className: 'mpv3-selection-bar' },
        h('strong', { className: 'mpv3-selection-count' }, t('p3.selectedCount', { n: selected.length })),
        h('button', { type: 'button', className: 'mpv3-sel-btn', onClick: function () { selectionAction('play') } }, icon('play', 14), t('page.play')),
        h('button', { type: 'button', className: 'mpv3-sel-btn', onClick: function () { selectionAction('like') } }, icon('heart', 14), t('page.favorite')),
        h('button', { type: 'button', className: 'mpv3-sel-btn', onClick: function () { selectionAction('add') } }, icon('plus', 14), t('p3.addToPlaylist')),
        source === 'local' ? h('button', { type: 'button', className: 'mpv3-sel-btn', onClick: function () { selectionAction('batch') } }, icon('edit', 14), t('page.batchEdit')) : null,
        source === 'local' ? h('button', { type: 'button', className: 'mpv3-sel-btn is-danger', onClick: function () { selectionAction('delete') } }, icon('trash', 14), t('page.delete')) : null,
        h('span', { className: 'mpv3-grow' }),
        h('button', { type: 'button', className: 'mpv3-sel-btn is-primary', onClick: function () { selectionAction('done') } }, t('page.done')),
      ),
    )
  }

  var tabItems = tabs.map(function (tab) { return { value: tab, label: p3PageLabel(tab) } })
  return h('div', { className: 'mpv3-viewbar' },
    !props.rail && route.page !== 'search' && tabs.length > 0
      ? h('div', { className: 'mpv3-tabs' }, h(KitSegmentedTabs, {
          items: tabItems,
          value: active,
          size: 'sm',
          label: t('p3.sections'),
          onChange: function (next) { p3SelectBrowseTab(next) },
        }))
      : null,
    h('div', { className: 'mpv3-grow' }),
    tracks.length > 0 ? h(IconButton, { icon: 'play', size: 16, title: t('page.playAll'), onClick: function () { p3PlayAll(tracks) } }) : null,
    h('div', { className: 'mpv3-menu-anchor', ref: sortRef },
      h(IconButton, { icon: 'sort', size: 16, title: t('page.sort'), onClick: function () { setSortOpen(!sortOpen) } }),
      h(P3Menu, { open: sortOpen, anchor: sortRef.current, items: sortItems, align: 'right', onSelect: pickSort, onClose: function () { setSortOpen(false) } }),
    ),
    tracks.length > 0 ? h('div', { className: 'mpv3-menu-anchor', ref: selectRef },
      h(IconButton, { icon: 'checkCircle', size: 16, title: t('page.select'), onClick: function () { setSelectOpen(!selectOpen) } }),
      h(P3Menu, { open: selectOpen, anchor: selectRef.current, items: selectItems, align: 'right', onSelect: pickSelect, onClose: function () { setSelectOpen(false) } }),
    ) : null,
    route.source === 'local' && route.page === 'playlists' ? h(IconButton, { icon: 'plus', size: 16, title: t('v2.newPlaylist'), onClick: function () { openP3Playlist('create') } }) : null,
  )
}

function P3Content(props) {
  var route = useStore(p3RouteStore)
  var collection = useStore(p3CollectionNavStore)
  var selection = useStore(selectionStore)
  var snap = usePlayerSnapshot()
  var statsPage = route.source === 'local' && route.page === 'stats'
  useEffect(function () {
    if (statsPage) void loadStats(props.library.statsRange || 'all')
  }, [statsPage, props.library.statsRange])
  var favorites = useMemo(function () { return p3FavoriteSet(props.library.favorites) }, [props.library.favorites])
  var current = snap.queue[snap.index] || null
  var selectedSet = useMemo(function () {
    var set = {}
    ;(selection.paths || []).forEach(function (path) { set[path] = true })
    return set
  }, [selection.paths])
  var filter = route.filter
  var localLoading = route.source === 'local' && (props.library.phase === 'idle' || props.library.phase === 'loading') && (props.library.tracks || []).length === 0
  if (localLoading) {
    return h('main', { className: 'mpv3-content' },
      h(P3GridPage, { route: route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Skeleton, { count: 8 })),
    )
  }
  return h('main', { className: 'mpv3-content' },
    filter ? h('div', { className: 'mpv3-filterbar' },
      h('button', { type: 'button', className: 'mpv3-chip', onClick: function () { p3SetBrowseFilter(null) } },
        icon('folder', 12),
        h('span', null, filter.value),
        icon('close', 12),
      ),
    ) : null,
    h(P3PageSwitch, {
      route: route,
      collection: collection.snapshot && collection.snapshot.stack.length > 0 ? collection.snapshot.stack[collection.snapshot.stack.length - 1] : null,
      library: props.library,
      online: props.online,
      prefs: props.prefs,
      currentPath: current ? current.path : '',
      playing: snap.playing,
      favoriteSet: favorites,
      selectedSet: selectedSet,
    }),
  )
}

function P3Rail(props) {
  var browse = useStore(p3BrowseStore)
  var selection = useStore(selectionStore)
  var source = browse.source
  var tabs = p3Tabs(source)
  var active = browse.tab
  var playlists = source === 'local' ? (props.library.playlists || []) : sortOnlinePlaylists(props.online.playlists || [])
  return h('aside', { className: 'mpv3-rail' },
    h('div', { className: 'mpv3-rail-group' },
      h('div', { className: 'mpv3-rail-label' }, t('v2.sectionLibrary')),
      tabs.filter(function (tab) { return tab !== 'playlists'; }).map(function (tab) {
        return h('button', {
          key: tab,
          type: 'button',
          className: cx('mpv3-rail-item', active === tab && 'is-on'),
          onClick: function () { p3SelectBrowseTab(tab) },
        }, icon(tab === 'albums' ? 'disc' : tab === 'artists' ? 'user' : tab === 'folders' ? 'folder' : tab === 'favorites' ? 'heart' : tab === 'stats' ? 'chart' : tab === 'recent' ? 'clock' : tab === 'discover' ? 'disc' : tab === 'cloud' ? 'download' : 'music', 15), h('span', null, p3PageLabel(tab)))
      }),
    ),
    tabs.indexOf('playlists') >= 0 ? h('div', { className: 'mpv3-rail-group' },
      h('div', { className: 'mpv3-rail-label' }, t('v2.playlists')),
      playlists.map(function (playlist) {
        return h('button', {
          key: playlist.id,
          type: 'button',
          className: cx('mpv3-rail-item'),
          onClick: function () { p3OpenPlaylist(playlist, source === 'local' ? '' : source) },
        }, icon('list', 15), h('span', null, playlist.name || t('v2.playlist')))
      }),
    ) : null,
  )
}

function P3SleepChip(props) {
  var remaining = useCountdown(props.deadline)
  if (remaining <= 0) return null
  return h('button', {
    type: 'button',
    className: 'mpv3-chip',
    title: t('v2.sleepCancel'),
    onClick: function () { setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 }) },
  }, icon('clock', 12), fmtClock(remaining / 1000))
}

function P3PlayerBar(props) {
  var snap = usePlayerSnapshot()
  var prefs = usePrefs()
  var time = usePlayerTime()
  var [preview, setPreview] = useState(null)
  var current = snap.queue[snap.index] || null
  var duration = effectivePlayerDuration(time.duration, current ? current.durationSec : 0)
  if (!current) {
    return h('footer', { className: 'mpv3-player is-empty' },
      h('div', { className: 'mpv3-player-track' },
        h('div', { className: 'mpv3-player-cover' }, icon('music', 16)),
        h('div', { className: 'mpv3-player-meta' }, h('div', { className: 'mpv3-player-title' }, t('page.noTrack')), h('div', { className: 'mpv3-player-artist' }, t('p3.pickTrack'))),
      ),
      h('div', { className: 'mpv3-player-center' },
        h(IconButton, { icon: 'prev', size: 17, title: t('page.prev'), disabled: true }),
        h('button', { type: 'button', className: 'mpv3-player-play', disabled: true }, icon('play', 15)),
        h(IconButton, { icon: 'next', size: 17, title: t('page.next'), disabled: true }),
      ),
      h('div', { className: 'mpv3-player-right' }, h(P3SleepChip, { deadline: prefs.sleepDeadline })),
    )
  }
  var like = likeStateOf(current, props.favoriteSet)
  return h('footer', {
    className: 'mpv3-player',
    onClick: function (event) {
      if (event.target.closest('button,input,[role="slider"],.mpv3-queue')) return
      props.onOpenPlayer()
    },
  },
    h('div', { className: 'mpv3-player-seek' }, h(SeekBar, { fallbackDuration: current.durationSec || 0, onPreview: setPreview })),
    h('div', { className: 'mpv3-player-track' },
      h('button', { type: 'button', className: 'mpv3-player-cover', onClick: props.onOpenPlayer, title: t('page.openPlayer') },
        h(Cover, { src: trackCoverSrc(current), iconSize: 16 }),
        snap.playing ? h('span', { className: 'mpv3-player-eq' }, h('i'), h('i'), h('i')) : null,
      ),
      h('div', { className: 'mpv3-player-meta' },
        h('div', { className: 'mpv3-player-title', title: trackTitleOf(current) }, trackTitleOf(current)),
        h('div', { className: 'mpv3-player-artist', title: trackArtistOf(current) }, trackArtistOf(current)),
      ),
      h(IconButton, {
        icon: like.isLiked ? 'heartFill' : 'heart',
        size: 15,
        active: like.isLiked,
        disabled: like.disabled === true,
        title: like.disabled === true ? like.reason : like.isLiked ? t('page.unfavorite') : t('page.favorite'),
        onClick: like.onLike,
      }),
    ),
    h('div', { className: 'mpv3-player-center' },
      h(IconButton, { icon: 'shuffle', size: 16, active: snap.order === 'random', title: t('page.shuffle'), onClick: function () { player.setOrder(snap.order === 'random' ? 'list' : 'random') } }),
      h(IconButton, { icon: 'prev', size: 17, title: t('page.prev'), onClick: function () { player.prev() } }),
      h('button', { type: 'button', className: 'mpv3-player-play', title: snap.playing ? t('page.pause') : t('page.play'), onClick: function () { player.toggle() } }, icon(snap.playing ? 'pause' : 'play', 15)),
      h(IconButton, { icon: 'next', size: 17, title: t('page.next'), onClick: function () { player.next() } }),
      h(IconButton, {
        icon: snap.loop === 'one' ? 'repeatOne' : 'repeat',
        size: 16,
        active: snap.loop !== 'none',
        title: snap.loop === 'one' ? t('page.loopOne') : snap.loop === 'all' ? t('page.loopAll') : t('page.loopNone'),
        onClick: function () { player.setLoop(playerLoopNext(snap.loop)) },
      }),
    ),
    h('div', { className: 'mpv3-player-right' },
      h('span', { className: 'mpv3-player-time' }, fmtClock(preview !== null ? preview : time.currentTime) + ' / ' + fmtClock(duration)),
      h(P3SleepChip, { deadline: prefs.sleepDeadline }),
      h(IconButton, { icon: 'target', size: 16, className: 'mpv3-player-locate', title: t('page.locateCurrent'), onClick: props.onLocate }),
      h('div', { className: 'mpv3-player-vol' },
        h(IconButton, {
          icon: snap.muted || snap.volume === 0 ? 'mute' : 'volume',
          size: 16,
          title: t('page.mute'),
          onClick: function () { player.setMuted(!snap.muted) },
        }),
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          value: Math.round((snap.muted ? 0 : snap.volume) * 100),
          onChange: function (event) {
            var value = Number(event.target.value) / 100
            if (snap.muted && value > 0) player.setMuted(false)
            player.setVolume(value)
          },
          'aria-label': t('page.volume'),
        }),
      ),
      h(IconButton, { icon: 'playlist', size: 16, active: props.queueOpen, className: 'mpv3-queue-btn', title: t('page.queue'), onClick: props.onToggleQueue }),
      h(IconButton, { icon: 'chevronDown', size: 16, className: 'mpv3-player-expand', title: t('page.openPlayer'), onClick: props.onOpenPlayer }),
    ),
  )
}

function playerLoopNext(loop) {
  if (loop === 'none') return 'all'
  if (loop === 'all') return 'one'
  return 'none'
}

var P3_QUEUE_BANDS = [0, 3, 8, 20, 48]

/**
 * The playing row's index turns into live bars, so the queue says which row is sounding
 * even when the row is scrolled away from the transport. Bars fall back to a quiet static
 * shape while paused; the animation only runs for the visible row.
 */
function P3QueueWave(props) {
  var pair = useState([0.18, 0.3, 0.22, 0.14])
  var levels = pair[0]
  var setLevels = pair[1]
  useEffect(function () {
    if (props.playing !== true) {
      setLevels([0.18, 0.3, 0.22, 0.14])
      return undefined
    }
    var frame = 0
    var last = 0
    function tick(now) {
      frame = requestAnimationFrame(tick)
      if (now - last < 70) return
      last = now
      var data = player.getWave()
      if (data === null || data.length === 0) return
      var next = []
      for (var band = 0; band < P3_QUEUE_BANDS.length - 1; band += 1) {
        var start = P3_QUEUE_BANDS[band]
        var end = Math.min(P3_QUEUE_BANDS[band + 1], data.length)
        var sum = 0
        for (var i = start; i < end; i += 1) sum += data[i]
        var avg = end > start ? sum / (end - start) : 0
        next.push(0.08 + Math.pow(Math.max(0, Math.min(1, (avg - 4) / 240)), 1.3) * 0.92)
      }
      setLevels(next)
    }
    frame = requestAnimationFrame(tick)
    return function () {
      cancelAnimationFrame(frame)
    }
  }, [props.playing])
  return h(
    'span',
    { className: 'mpv3-queue-wave', 'aria-hidden': 'true' },
    levels.map(function (level, index) {
      return h('i', { key: index, style: { height: Math.round(3 + level * 9) + 'px' } })
    }),
  )
}

function P3Queue(props) {
  var snap = usePlayerSnapshot()
  var dragFrom = useRef(null)
  var listRef = useRef(null)
  var currentRowRef = useRef(null)
  var current = snap.queue[snap.index] || null

  // Folia's queue is the whole queue in order, the playing row in place. Opening it puts the
  // row before the playing one at the top, so what was just played stays in view.
  useEffect(function () {
    if (!props.open) return
    var list = listRef.current
    var rowEl = currentRowRef.current
    if (list === null || rowEl === null) return
    var offset = rowEl.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
    var previous = rowEl.previousElementSibling
    var lead = previous !== null && previous.classList && previous.classList.contains('mpv3-queue-row')
      ? previous.getBoundingClientRect().height
      : 0
    list.scrollTop = Math.max(0, Math.round(offset - lead))
  }, [props.open, snap.index])

  useEffect(function () {
    if (!props.open) return undefined
    function onDown(event) {
      var target = event.target
      if (!target || typeof target.closest !== 'function') return
      // Every queue control is ignored here, so clicking the same button again toggles
      // instead of closing on pointerdown and reopening on click.
      if (
        target.closest('.mpv3-queue') ||
        target.closest('.mpv3-queue-btn') ||
        target.closest('.mp-pb-queue-wrap') ||
        target.closest('.mp-composer-cluster')
      ) return
      // A confirmation/dialog opened from the queue should not dismiss it behind the dialog.
      if (target.closest('[role="dialog"]') || target.closest('.mp-overlay')) return
      props.onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return function () { document.removeEventListener('pointerdown', onDown, true) }
  }, [props.open, props.onClose])

  if (!props.open) return null

  var order = snap.order === 'random' ? player.getPlayOrder() : snap.queue.map(function (_, index) { return index })
  if (!Array.isArray(order) || order.length !== snap.queue.length) order = snap.queue.map(function (_, index) { return index })

  function selectQueue(index) {
    if (dragFrom.current !== null) return
    player.select(snap.queue, index)
  }

  function removeAt(index) {
    player.removeQueueAt(index)
  }

  function dropAt(position) {
    var from = dragFrom.current
    dragFrom.current = null
    if (from === null || from === position) return
    var indices = order.slice()
    var moved = indices.splice(from, 1)[0]
    indices.splice(position, 0, moved)
    player.reorderQueue(indices)
  }

  function row(track, index, position, isCurrent) {
    return h('div', {
      key: track.path + ':' + index,
      ref: isCurrent ? currentRowRef : undefined,
      role: 'button',
      tabIndex: 0,
      draggable: true,
      className: cx('mpv3-queue-row', isCurrent && 'is-cur'),
      'aria-current': isCurrent ? 'true' : undefined,
      onClick: function () { selectQueue(index) },
      onKeyDown: function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          selectQueue(index)
        }
      },
      onDragStart: function (event) {
        dragFrom.current = position
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', String(position))
        }
      },
      onDragOver: function (event) {
        if (dragFrom.current === null) return
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      },
      onDrop: function (event) {
        event.preventDefault()
        dropAt(position)
      },
      onDragEnd: function () { dragFrom.current = null },
    },
      h('span', { className: 'mpv3-queue-idx' }, isCurrent ? h(P3QueueWave, { playing: snap.playing }) : String(position + 1)),
      h('span', { className: 'mpv3-queue-cover' }, h(Cover, { src: trackCoverSrc(track), iconSize: 12 })),
      h('span', { className: 'mpv3-queue-main' }, h('span', { className: 'mpv3-queue-name' }, trackTitleOf(track)), h('span', { className: 'mpv3-queue-artist' }, trackArtistOf(track))),
      h('span', { className: 'mpv3-queue-time' }, fmtClock(track.durationSec || 0)),
      h(IconButton, {
        icon: 'x',
        size: 13,
        title: t('p3.removeFromQueue'),
        className: 'mpv3-queue-remove',
        onClick: function (event) {
          event.stopPropagation()
          removeAt(index)
        },
      }),
    )
  }

  return h('aside', {
    className: cx('mpv3-queue', props.floating === true && 'is-floating', props.className),
    style: props.style,
    role: 'dialog',
    'aria-label': t('page.queue'),
  },
    h('div', { className: 'mpv3-queue-head' },
      h('strong', null, t('page.queue')),
      h('span', null, snap.queue.length + ' ' + t('p3.unitSong') + ' · ' + (snap.order === 'random' ? t('page.shuffle') : t('p3.sequence'))),
      h('span', { className: 'mpv3-grow' }),
      snap.queue.length > 0 ? h(IconButton, { icon: 'trash', size: 15, title: t('p3.clearQueue'), onClick: function () {
        pushLayer('confirm', {
          title: t('p3.clearQueue'),
          text: t('p3.clearQueueConfirm'),
          onConfirm: function () { player.clearQueue(); props.onClose() },
        })
      } }) : null,
      h(IconButton, { icon: 'target', size: 15, title: t('page.locateCurrent'), onClick: function () { props.onLocate() } }),
      h(IconButton, { icon: 'x', size: 15, title: t('page.close'), onClick: props.onClose }),
    ),
    h('div', { className: 'mpv3-queue-list', ref: listRef },
      // The whole queue, in play order, the playing row marked where it stands — the list
      // used to drop everything before the current track, so nothing already played was left.
      order.map(function (index, position) {
        var track = snap.queue[index]
        if (!track) return null
        return row(track, index, position, index === snap.index)
      }),
      snap.queue.length === 0 ? h('div', { className: 'mpv3-queue-empty' }, icon('playlist', 24), h('span', null, t('p3.queueEmpty'))) : null,
    ),
  )
}

function p3LocateCurrent(snap) {
  var current = snap.queue[snap.index] || null
  if (!current) { showToast(t('page.noTrack')); return }
  var source = current.onlineProvider || 'local'
  if (source !== p3BrowseStore.get().source) p3SwitchSource(source)
  p3SelectBrowseTab(current.onlineProvider ? 'recent' : 'songs')
  window.setTimeout(function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.mpv3-row'))
    var row = null
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].dataset && rows[i].dataset.path === current.path) { row = rows[i]; break }
    }
    if (row) {
      row.scrollIntoView({ block: 'center' })
      row.classList.add('is-located')
      window.setTimeout(function () { row.classList.remove('is-located') }, 1400)
    }
  }, 80)
}

function P3Shell() {
  var route = useStore(p3RouteStore)
  var browse = useStore(p3BrowseStore)
  var search = useStore(p3SearchStore)
  var collection = useStore(p3CollectionNavStore)
  var library = useStore(libraryStore)
  var online = useStore(onlineStore)
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  var queueOpen = useStore(p3QueueStore).open
  function setQueueOpen(open) {
    p3SetQueueOpen(open)
  }
  var [npOpen, setNpOpen] = useState(false)
  // The player page covers the panel, so its queue is a popover anchored to the
  // control that opened it (rendered by NowPlaying), not the workspace queue.
  var [npQueueOpen, setNpQueueOpen] = useState(false)
  var [guideOpen, setGuideOpen] = useState(startupGuideOpen)
  var [wide, setWide] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)

  useEffect(function () {
    function measure() { setWide(window.innerWidth) }
    window.addEventListener('resize', measure)
    return function () { window.removeEventListener('resize', measure) }
  }, [])

  // Leaving the panel drops its queue: reopening it must not resurrect a stale one.
  useEffect(function () {
    return function () {
      p3SetQueueOpen(false)
    }
  }, [])

  useEffect(function () {
    void loadLibrary(false)
    void loadFavorites()
    void loadPlaylists()
    void loadConfig()
    void loadProviders()
  }, [])

  // 自动扫描已导入文件夹: the host watcher bumps a revision after its debounced rescan; the
  // panel polls that number (a few bytes) and re-reads the library when it moves.
  useEffect(function () {
    var timer = setInterval(function () {
      var config = libraryStore.get().config
      if (!config || config.watchFolders !== true) return
      getJson(API + 'library/revision')
        .then(function (body) {
          var revision = Number(body && body.revision) || 0
          if (revision === 0) return
          if (p3LastLibraryRevision === 0) {
            p3LastLibraryRevision = revision
            return
          }
          if (revision !== p3LastLibraryRevision) {
            p3LastLibraryRevision = revision
            void loadLibrary(false)
          }
        })
        .catch(function () {})
    }, 4000)
    return function () {
      clearInterval(timer)
    }
  }, [])

  useEffect(function () {
    return player.subscribeError(function (info) {
      var reason = info && typeof info.reason === 'string' ? info.reason.trim() : ''
      showToast(reason ? t('page.playbackFailed', { reason: reason }) : t('page.playbackFailedNoReason'))
    })
  }, [])

  useEffect(function () {
    if (route.source !== 'local') {
      onlineStore.set({ provider: route.source })
      void loadProviders()
      void loadMyPlaylists(route.source)
    }
  }, [route.source])

  useEffect(function () {
    var providers = onlineStore.get().providers || {}
    if (Object.keys(providers).length === 0) return
    if (browse.source !== 'local' && !providers[browse.source]) {
      p3SwitchSource('local')
      return
    }
    var tabs = p3Tabs(browse.source)
    if (tabs.indexOf(browse.tab) < 0) {
      p3SelectBrowseTab(p3DefaultPage(browse.source))
    }
  }, [online.providers, browse.source, browse.tab])


  useEffect(function () {
    function onKey(event) {
      var tag = event.target && event.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (event.key === 'Escape' && event.target.blur) event.target.blur()
        return
      }
      if (event.key === 'Escape') {
        var hostModal = typeof document !== 'undefined' ? document.querySelector('[role="dialog"][aria-modal="true"]') : null
        if (hostModal !== null && hostModal.closest('.mpv3-root') === null) return
        if (isRangePicking()) { cancelRangePick(); return }
        if (popLayer()) return
        if (selectionStore.get().active === true) { setSelectionMode(false); return }
        if (queueOpen) { setQueueOpen(false); return }
        if (npQueueOpen) { setNpQueueOpen(false); return }
        if (npOpen) { setNpOpen(false); return }
        if (p3CanGoBack()) { p3GoBack(); return }
        return
      }
      if (event.code === 'Space') {
        if (event.target.closest('button')) return
        event.preventDefault()
        player.toggle()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowRight') { event.preventDefault(); player.next(); return }
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowLeft') { event.preventDefault(); player.prev(); return }
      if (event.key === '/') {
        event.preventDefault()
        var input = document.getElementById('p3-search')
        if (input) input.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return function () { window.removeEventListener('keydown', onKey) }
  }, [queueOpen, npOpen, npQueueOpen])

  var topLayout = prefs.layout !== 'rail' || wide < 1000
  var current = snap.queue[snap.index] || null

  return h('div', { className: cx('mpv3-root', !topLayout && !search.open && !collection.snapshot && 'is-rail') },
    h(P3TopBar, { library: library, online: online }),
    h('div', { className: 'mpv3-workspace' },
      !topLayout && !search.open && !collection.snapshot ? h(P3Rail, { library: library, online: online, prefs: prefs }) : null,
      h('div', { className: 'mpv3-main' },
        !search.open && !collection.snapshot ? h(P3ViewBar, { library: library, online: online, rail: !topLayout }) : null,
        h(P3Content, { library: library, online: online, prefs: prefs }),
      ),
      h(P3Queue, { open: queueOpen, onClose: function () { setQueueOpen(false) }, onLocate: function () { p3LocateCurrent(snap); setQueueOpen(false) } }),
    ),
    h(P3PlayerBar, {
      favoriteSet: p3FavoriteSet(library.favorites),
      queueOpen: queueOpen,
      onToggleQueue: function () { setQueueOpen(!queueOpen) },
      onOpenPlayer: function () { setNpOpen(true); setQueueOpen(false) },
      onLocate: function () { p3LocateCurrent(snap) },
    }),
    h(NowPlaying, {
      open: npOpen,
      favoriteSet: p3FavoriteSet(library.favorites),
      onClose: function () { setNpOpen(false); setNpQueueOpen(false) },
      queueOpen: npQueueOpen,
      onToggleQueue: function () { setNpQueueOpen(!npQueueOpen) },
      onToggleFavorite: function (track) { likeStateOf(track, p3FavoriteSet(library.favorites)).onLike() },
      onLocate: function () { p3LocateCurrent(snap) },
      onHome: function () { setNpOpen(false); setNpQueueOpen(false); p3SelectBrowseTab('songs') },
      onOpenSettings: function () { pushLayer('settings') },
    }),
    h(OverlayRoot),
    h(P3PlaylistDialogHost),
    h(Toast),
    h(StartupGuide, { open: guideOpen, onClose: function (disable) { dismissStartupGuide(disable === true); setGuideOpen(false) } }),
  )
}
