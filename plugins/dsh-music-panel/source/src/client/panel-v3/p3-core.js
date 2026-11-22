/**
 * panel-v3 core: route store, runtime sources, data helpers and shared view parts.
 */

function trackTitleOf(track) {
  if (!track) return ''
  return track.title || stemOf(track.path || '') || basename(track.path || '')
}

function trackArtistOf(track) {
  if (!track) return ''
  return track.artist || t('page.unknownArtist')
}

/* ============================================================
   sources
   ============================================================ */

var P3_LOCAL_CAPS = {
  songs: true,
  albums: true,
  artists: true,
  folders: true,
  favorites: true,
  playlists: true,
  stats: true,
  likes: true,
  likeWrite: true,
  playlistAdd: true,
}

function p3ProviderMap() {
  return onlineStore.get().providers || {}
}

const P3_SOURCE_ORDER = ['netease', 'qq', 'kugouLite', 'navidrome', 'bodian', 'qishui']

function p3SourceList() {
  var state = onlineStore.get()
  var providers = state.providers || {}
  var phase = state.providersPhase || 'idle'
  var list = [{ id: 'local', name: t('page.tabLocal'), short: t('page.tabLocal'), local: true }]
  var seen = { local: true }
  // Render the known platforms immediately while /online/providers is in flight.
  // They are disabled placeholders, not tappable sources; the loaded metadata
  // replaces them in place. Without this the menu visibly grew on every first open.
  P3_SOURCE_ORDER.forEach(function (id) {
    if (providers[id]) {
      seen[id] = true
      list.push({ id: id, name: sourceLabelOf(id), short: sourceLabelOf(id), local: false })
    } else if (phase !== 'ready') {
      list.push({ id: id, name: sourceLabelOf(id), short: sourceLabelOf(id), local: false, pending: true })
    }
  })
  Object.keys(providers).forEach(function (id) {
    if (seen[id] === true || id === 'local') return
    list.push({ id: id, name: sourceLabelOf(id), short: sourceLabelOf(id), local: false })
  })
  return list
}

function p3SourceCaps(source) {
  if (source === 'local') return P3_LOCAL_CAPS
  var info = p3ProviderMap()[source]
  return (info && info.capabilities) || {}
}

function p3SourceInfo(source) {
  if (source === 'local') return { id: 'local', local: true, name: t('page.tabLocal') }
  return p3ProviderMap()[source] || { id: source, name: sourceLabelOf(source) }
}

function p3SourceLabel(source) {
  return source === 'local' ? t('page.tabLocal') : sourceLabelOf(source)
}

function p3SourceLoggedIn(source) {
  if (source === 'local') return true
  var info = p3SourceInfo(source)
  return info.loggedIn === true || info.configured === true
}

function p3SourceLoginMode(source) {
  if (source === 'local') return ''
  var info = p3SourceInfo(source)
  var methods = Array.isArray(info.loginMethods) ? info.loginMethods : []
  if (methods.indexOf('password') >= 0) return 'password'
  if (methods.indexOf('qr') >= 0) return 'qr'
  if (info.capabilities && info.capabilities.loginPassword === true) return 'password'
  if (info.capabilities && info.capabilities.loginQr === true) return 'qr'
  return ''
}

function p3SourceStatus(source) {
  if (source === 'local') return t('p3.statusLocal')
  var info = p3SourceInfo(source)
  if (info.configured === false) return t('p3.statusUnconfigured')
  if (info.loggedIn === true) return t('p3.statusOnline')
  return t('p3.statusOffline')
}

function p3Tabs(source) {
  var caps = p3SourceCaps(source)
  var tabs = []
  if (source === 'local') {
    tabs = ['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'stats']
    return tabs
  }
  if (caps.userPlaylists === true) tabs.push('playlists')
  if (caps.recommendations === true) tabs.push('discover')
  tabs.push('recent')
  if (caps.userCloud === true && p3SourceLoggedIn(source)) tabs.push('cloud')
  if (source === 'navidrome') tabs.push('songs')
  if (caps.browseAlbums === true) tabs.push('albums')
  if (caps.browseArtists === true) tabs.push('artists')
  if (caps.favorites === true && source === 'local') tabs.push('favorites')
  return tabs
}

function p3SearchKinds(source) {
  if (source === 'local') return ['song']
  var info = p3SourceInfo(source)
  if (Array.isArray(info.searchKinds) && info.searchKinds.length > 0) return info.searchKinds.slice()
  var caps = p3SourceCaps(source)
  var kinds = ['song']
  if (caps.searchAlbums === true) kinds.push('album')
  if (caps.searchPlaylists === true) kinds.push('playlist')
  return kinds
}

function p3DefaultPage(source) {
  if (source === 'local') return 'songs'
  if (p3SourceCaps(source).userPlaylists === true) return 'playlists'
  return 'recent'
}

function p3PageLabel(page) {
  var labels = {
    songs: t('v2.songs'),
    albums: t('v2.albums'),
    artists: t('v2.artists'),
    folders: t('v2.folders'),
    favorites: t('v2.favorites'),
    playlists: t('v2.playlists'),
    stats: t('v2.stats'),
    recent: t('v2.recent'),
    discover: t('p3.discover'),
    cloud: t('p3.cloud'),
    album: t('v2.album'),
    artist: t('v2.artist'),
    playlist: t('v2.playlist'),
    search: t('page.search'),
  }
  return labels[page] || page
}

function p3ParentLabel(page) {
  if (page === 'album') return t('v2.album')
  if (page === 'artist') return t('v2.artist')
  if (page === 'playlist') return t('v2.playlist')
  if (page === 'search') return t('page.search')
  if (page === 'favorites' || page === 'playlists' || page === 'stats') return t('v2.sectionCollection')
  if (page === 'recent' || page === 'discover' || page === 'cloud') return t('v2.sectionOnline')
  return t('v2.sectionLibrary')
}

/* ============================================================
   data
   ============================================================ */

function groupTracks(list, keyOf) {
  var map = {}
  var order = []
  ;(list || []).forEach(function (track) {
    var key = keyOf(track)
    if (!map[key]) {
      map[key] = { key: key, tracks: [] }
      order.push(key)
    }
    map[key].tracks.push(track)
  })
  return order.map(function (key) { return map[key] })
}

function p3FavoriteSet(favorites) {
  var set = {}
  ;(favorites || []).forEach(function (path) { set[path] = true })
  return set
}

function p3LocalTracks(library) {
  return (library && library.tracks) || []
}

var p3LocalCache = { albums: null, artists: null, folders: null, songs: null }

function p3SortLocal(list, prefs) {
  return sortTracks(list, prefs.sortBy || 'title', prefs.sortDir === 'desc' ? 'desc' : 'asc')
}

function p3LocalAlbumKey(track) {
  return (track.artist || t('page.unknownArtist')) + '|' + (track.album || t('page.unknownAlbum'))
}

function p3LocalAlbums(library, prefs, query) {
  var cacheKey = String(query || '') + '|' + String(prefs.sortBy || '') + '|' + String(prefs.sortDir || '')
  var cached = p3LocalCache.albums
  if (cached && cached.tracks === (library && library.tracks) && cached.key === cacheKey) return cached.value
  var tracks = filterTracks(p3LocalTracks(library), query || '')
  var groups = groupTracks(tracks, p3LocalAlbumKey)
  var albums = groups.map(function (group) {
    var first = group.tracks[0] || {}
    var cover = null
    for (var i = 0; i < group.tracks.length; i += 1) {
      if (group.tracks[i].hasCover === true) { cover = group.tracks[i]; break }
    }
    return {
      key: group.key,
      name: first.album || t('page.unknownAlbum'),
      artist: first.artist || t('page.unknownArtist'),
      year: first.year || 0,
      coverTrack: cover,
      tracks: group.tracks,
    }
  })
  albums.sort(function (a, b) {
    var key = prefs.sortBy === 'artist' ? 'artist' : 'name'
    return String(a[key] || '').localeCompare(String(b[key] || ''), 'zh') * (prefs.sortDir === 'desc' ? -1 : 1)
  })
  p3LocalCache.albums = { tracks: library && library.tracks, key: cacheKey, value: albums }
  return albums
}

function p3LocalArtists(library, prefs, query) {
  var cacheKey = String(query || '') + '|' + String(prefs.sortBy || '') + '|' + String(prefs.sortDir || '')
  var cached = p3LocalCache.artists
  if (cached && cached.tracks === (library && library.tracks) && cached.key === cacheKey) return cached.value
  var tracks = filterTracks(p3LocalTracks(library), query || '')
  var groups = groupTracks(tracks, function (track) {
    var names = trackArtistNames(track)
    return names.length > 0 ? names[0] : t('page.unknownArtist')
  })
  var artists = groups.map(function (group) {
    var albumKeys = {}
    group.tracks.forEach(function (track) { albumKeys[p3LocalAlbumKey(track)] = true })
    var cover = null
    for (var i = 0; i < group.tracks.length; i += 1) {
      if (group.tracks[i].hasCover === true) { cover = group.tracks[i]; break }
    }
    return {
      name: group.key,
      coverTrack: cover,
      tracks: group.tracks,
      albumCount: Object.keys(albumKeys).length,
    }
  })
  artists.sort(function (a, b) {
    if (prefs.sortBy === 'count') return (a.tracks.length - b.tracks.length) * (prefs.sortDir === 'desc' ? -1 : 1)
    return String(a.name).localeCompare(String(b.name), 'zh') * (prefs.sortDir === 'desc' ? -1 : 1)
  })
  p3LocalCache.artists = { tracks: library && library.tracks, key: cacheKey, value: artists }
  return artists
}

function p3LocalFolders(library) {
  var cached = p3LocalCache.folders
  if (cached && cached.tracks === (library && library.tracks)) return cached.value
  var groups = groupTracks(p3LocalTracks(library), function (track) { return trackDirOf(track) })
  var value = groups.map(function (group) {
    return { path: group.key, name: folderNameOf(group.key), tracks: group.tracks }
  }).sort(function (a, b) { return a.path.localeCompare(b.path, 'zh') })
  p3LocalCache.folders = { tracks: library && library.tracks, value: value }
  return value
}

function p3LocalStats(library) {
  var stats = (library && library.stats) || {}
  var entries = Object.keys(stats).map(function (path) {
    var track = trackByPath(path)
    var entry = stats[path] || {}
    return {
      path: path,
      track: track,
      seconds: Number(entry.seconds) || 0,
      plays: Number(entry.plays) || 0,
      lastPlayedAt: Number(entry.lastPlayedAt) || 0,
    }
  }).filter(function (entry) { return entry.track !== null })
  entries.sort(function (a, b) { return b.seconds - a.seconds })
  return entries
}

function p3PlaylistTracks(id) {
  var playlist = playlistById(id)
  return playlist ? playlistTracks(playlist) : []
}

function p3OnlineCover(item, source, kind) {
  if (!item) return ''
  return onlineCoverSrc({
    coverUrl: item.coverUrl || item.cover || '',
    id: item.id || item.albumId || item.artistId || '',
    coverArtId: item.coverArtId || '',
  }, source, kind)
}

function p3OnlineTrackList(raw) {
  return (raw || []).map(onlineTrackOf).filter(function (track) { return track !== null })
}

function p3OnlineHistory(source) {
  var list = onlineHistoryOfProvider(source)
  return p3OnlineTrackList(list)
}

function p3OnlineAlbumsFromStore() {
  return onlineStore.get().albumSongs || []
}

function p3OnlinePlaylistSongs() {
  return onlineStore.get().playlistSongs || []
}

function p3OnlineArtistSongs() {
  return onlineStore.get().artistSongs || []
}

function p3OnlineSearchResults() {
  return p3OnlineTrackList(onlineStore.get().results || [])
}

function p3LocalTracksFor(route, library, prefs) {
  var page = route.page
  var cacheKey = [
    page,
    route.param || '',
    route.query || '',
    route.filter && route.filter.kind ? route.filter.kind : '',
    route.filter && route.filter.value ? route.filter.value : '',
    prefs.sortBy || '',
    prefs.sortDir || '',
  ].join('|')
  var cached = p3LocalCache.songs
  if (
    cached &&
    cached.tracks === (library && library.tracks) &&
    cached.favorites === (library && library.favorites) &&
    cached.playlists === (library && library.playlists) &&
    cached.key === cacheKey
  ) {
    return cached.value
  }
  var value
  if (page === 'songs') {
    var songs = filterTracks(p3LocalTracks(library), route.query || '')
    if (route.filter && route.filter.kind === 'folder') {
      songs = songs.filter(function (track) { return trackDirOf(track) === route.filter.value })
    }
    value = p3SortLocal(songs, prefs)
  } else if (page === 'favorites') {
    var favorites = p3FavoriteSet(library.favorites)
    value = p3SortLocal(p3LocalTracks(library).filter(function (track) { return favorites[track.path] === true }), prefs)
  } else if (page === 'playlist') {
    value = p3PlaylistTracks(route.param)
  } else if (page === 'album') {
    var album = p3LocalAlbums(library, prefs).filter(function (item) { return item.key === route.param })[0]
    value = album ? p3SortLocal(album.tracks, prefs) : []
  } else if (page === 'artist') {
    var artist = p3LocalArtists(library, prefs).filter(function (item) { return item.name === route.param })[0]
    value = artist ? p3SortLocal(artist.tracks, prefs) : []
  } else if (page === 'search') {
    value = p3SortLocal(filterTracks(p3LocalTracks(library), route.query || ''), prefs)
  } else {
    value = []
  }
  p3LocalCache.songs = {
    tracks: library && library.tracks,
    favorites: library && library.favorites,
    playlists: library && library.playlists,
    key: cacheKey,
    value: value,
  }
  return value
}

function p3CurrentTracks(state, library, online, prefs) {
  var route = state || p3RouteStore.get()
  var page = route.page
  var source = route.source
  if (source === 'local') return p3LocalTracksFor(route, library, prefs)
  if (page === 'recent') return p3OnlineHistory(source)
  if (page === 'songs') return p3OnlineTrackList(online.songs || [])
  if (page === 'playlist') return p3OnlineTrackList(p3OnlinePlaylistSongs())
  if (page === 'album') return p3OnlineTrackList(p3OnlineAlbumsFromStore())
  if (page === 'artist') return p3OnlineTrackList(p3OnlineArtistSongs())
  if (page === 'search') return p3OnlineSearchResults()
  return []
}

function p3CurrentPaths(state, library, online, prefs) {
  var list = p3CurrentTracks(state, library, online, prefs)
  return list.map(function (track) { return track.path })
}

/* ============================================================
   selection / playback / menus
   ============================================================ */

function p3SelectTrack(list, track, additive) {
  selectTrackIn(list || [], track, additive === true)
}

function p3PlayList(list, index) {
  if (!list || list.length === 0) return
  var at = Math.max(0, Math.min(Number(index) || 0, list.length - 1))
  player.playList(list, at)
  if (list[at] && list[at].onlineProvider) rememberOnline(list[at])
}

function p3PlayTrack(list, track) {
  var index = -1
  ;(list || []).forEach(function (item, at) { if (item.path === track.path) index = at })
  p3PlayList(list || [track], index < 0 ? 0 : index)
}

function p3OpenTrackMenu(track, event, list, onRemove) {
  if (!track) return
  var paths = (list || []).map(function (item) { return item.path })
  pushLayer('menu', {
    track: track,
    x: event ? event.clientX : 20,
    y: event ? event.clientY : 20,
    visiblePaths: paths,
    ...(typeof onRemove === 'function'
      ? { onRemove: function () { onRemove(track) } }
      : {}),
    playSelected: function () {
      var selected = (list || []).filter(function (item) { return selectedPathSet()[item.path] === true })
      if (selected.length > 0) p3PlayList(selected, 0)
    },
  })
}

function p3LocalAlbumDescriptor(album) {
  return {
    type: 'album',
    source: 'local',
    id: album.key,
    param: album.key,
    name: album.name || '',
    artist: album.artist || '',
    year: Number(album.year) || 0,
    coverTrack: album.coverTrack || null,
    trackCount: Array.isArray(album.tracks) ? album.tracks.length : 0,
  }
}

function p3LocalAlbumDescriptorForTrack(track) {
  return {
    type: 'album',
    source: 'local',
    id: p3LocalAlbumKey(track),
    param: p3LocalAlbumKey(track),
    name: track.album || t('page.unknownAlbum'),
    artist: track.artist || t('page.unknownArtist'),
    year: Number(track.year) || 0,
    coverTrack: track,
    trackCount: 0,
  }
}

function p3LocalArtistDescriptor(artist) {
  return {
    type: 'artist',
    source: 'local',
    id: artist.name,
    param: artist.name,
    name: artist.name || '',
    artist: artist.name || '',
    coverTrack: artist.coverTrack || null,
    trackCount: Array.isArray(artist.tracks) ? artist.tracks.length : 0,
  }
}

function p3OnlineAlbumDescriptor(provider, album) {
  var raw = album !== null && typeof album === 'object' ? album : {}
  var id = String(raw.albumId || raw.albummid || raw.id || raw.key || '')
  var name = String(raw.album || raw.name || raw.title || '')
  var artist = String(raw.artist || raw.artistName || raw.singername || '')
  return {
    type: 'album',
    source: 'online',
    provider: provider,
    onlineProvider: provider,
    id: id,
    param: provider + ':' + id,
    albumId: id,
    album: name,
    name: name,
    artist: artist,
    coverUrl: String(raw.coverUrl || raw.cover || raw.picUrl || ''),
    coverArtId: String(raw.coverArtId || ''),
    trackCount: Number(raw.trackCount || raw.songCount || 0) || 0,
  }
}

function p3OnlineArtistDescriptor(provider, artist) {
  var raw = artist !== null && typeof artist === 'object' ? artist : {}
  var name = String(raw.artist || raw.name || '')
  var id = String(raw.artistId || raw.id || '')
  return {
    type: 'artist',
    source: 'online',
    provider: provider,
    onlineProvider: provider,
    id: id || name,
    param: provider + ':' + name,
    artist: name,
    name: name,
    artistId: id,
    coverUrl: String(raw.coverUrl || raw.cover || ''),
  }
}

function p3PlaylistDescriptor(playlist, provider) {
  var item = playlist || {}
  var online = provider || item.onlineProvider || item.provider
  if (online && online !== 'local') {
    return {
      type: 'playlist',
      source: 'online',
      provider: online,
      onlineProvider: online,
      id: String(item.id || ''),
      param: String(item.id || ''),
      name: item.name || '',
      cover: item.cover || item.coverUrl || '',
      coverUrl: item.coverUrl || item.cover || '',
      trackCount: Number(item.trackCount) || 0,
      isOwned: item.isOwned === true,
      kind: item.kind || '',
    }
  }
  return {
    type: 'playlist',
    source: 'local',
    id: String(item.id || ''),
    param: String(item.id || ''),
    name: item.name || '',
    cover: item.cover || '',
    trackCount: Number(item.trackCount) || 0,
  }
}

function p3OpenAlbum(track) {
  if (!track) return
  if (track.onlineProvider && track.onlineProvider !== 'local') {
    var albumCaps = p3SourceCaps(track.onlineProvider)
    if (albumCaps && albumCaps.albums === false) { showToast(t('online.albumUnsupported')); return }
    p3PushCollection(p3OnlineAlbumDescriptor(track.onlineProvider, track))
    return
  }
  p3PushCollection(p3LocalAlbumDescriptorForTrack(track))
}

function p3OpenArtist(track, name) {
  if (!track) return
  var artist = name || track.artist || ''
  if (track.onlineProvider && track.onlineProvider !== 'local') {
    var artistCaps = p3SourceCaps(track.onlineProvider)
    if (artistCaps && artistCaps.artists === false) { showToast(t('online.albumUnsupported')); return }
    var detail = Array.isArray(track.artistsDetail) ? track.artistsDetail : []
    var id = ''
    detail.forEach(function (item) { if (item && item.name === artist && item.id) id = String(item.id) })
    p3PushCollection(p3OnlineArtistDescriptor(track.onlineProvider, { artist: artist, artistId: id, coverUrl: track.coverUrl || '' }))
    return
  }
  p3PushCollection({ type: 'artist', source: 'local', id: artist, param: artist, name: artist, artist: artist })
}

function p3OpenPlaylist(playlist, provider) {
  if (!playlist) return
  p3PushCollection(p3PlaylistDescriptor(playlist, provider))
}

/* ============================================================
   menus
   ============================================================ */

function P3Menu(props) {
  var open = props.open === true
  var ref = useRef(null)
  var anchorRect = props.anchor && props.anchor.getBoundingClientRect ? props.anchor.getBoundingClientRect() : null
  var [position, setPosition] = useState(null)
  var focusedRef = useRef(false)
  useEffect(function () {
    if (!open || !anchorRect) return undefined
    var menu = ref.current
    if (!menu) return undefined
    var rect = menu.getBoundingClientRect()
    var left = props.align === 'right' ? anchorRect.right - rect.width : anchorRect.left
    var top = anchorRect.bottom + 6
    left = clamp(left, 8, window.innerWidth - rect.width - 8)
    if (top + rect.height > window.innerHeight - 8) top = anchorRect.top - rect.height - 6
    top = clamp(top, 8, window.innerHeight - rect.height - 8)
    setPosition({ left: left, top: top })
    return undefined
  }, [open, props.anchor, props.items])
  function focusAnchor() {
    if (props.anchor && typeof props.anchor.focus === 'function') props.anchor.focus()
  }
  useEffect(function () {
    if (!open) return undefined
    function close(event) {
      if (ref.current && event.target && ref.current.contains(event.target)) return
      if (typeof props.onClose === 'function') props.onClose()
    }
    function key(event) {
      if (event.key === 'Escape' && typeof props.onClose === 'function') {
        props.onClose()
        focusAnchor()
      }
    }
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', key)
    return function () {
      document.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', key)
    }
  }, [open, props.onClose])
  useEffect(function () {
    if (!open) { focusedRef.current = false; return }
    if (focusedRef.current) return
    var menu = ref.current
    if (!menu) return
    var chosen = menu.querySelector('.mpv3-menu-item.is-on') || menu.querySelector('.mpv3-menu-item:not(:disabled)')
    if (chosen && typeof chosen.focus === 'function') {
      chosen.focus()
      focusedRef.current = true
    }
  }, [open])
  function onMenuKey(event) {
    var entries = Array.prototype.slice.call(event.currentTarget.querySelectorAll('.mpv3-menu-item:not(:disabled)'))
    if (entries.length === 0) return
    var at = entries.indexOf(document.activeElement)
    var last = entries.length - 1
    if (event.key === 'Tab') {
      event.preventDefault()
      if (typeof props.onClose === 'function') props.onClose()
      focusAnchor()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      entries[at < last ? at + 1 : 0].focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      entries[at > 0 ? at - 1 : last].focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      entries[0].focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      entries[last].focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (typeof props.onClose === 'function') props.onClose()
      focusAnchor()
    }
  }
  if (!open) return null
  var items = Array.isArray(props.items) ? props.items : []
  return h(
    'div',
    { className: cx('mpv3-menu', props.className), ref: ref, role: 'menu', tabIndex: -1, onKeyDown: onMenuKey, style: position || { left: 8, top: 60, visibility: 'hidden' } },
    items.map(function (item) {
      if (item.separator === true) return h('div', { key: item.key, className: 'mpv3-menu-sep' })
      return h(
        'button',
        {
          key: item.key,
          type: 'button',
          role: 'menuitem',
          className: cx('mpv3-menu-item', item.danger === true && 'is-danger', item.active === true && 'is-on'),
          disabled: item.disabled === true,
          onClick: function () {
            if (typeof props.onSelect === 'function') props.onSelect(item)
          },
        },
        item.logo ? h('span', { className: 'mpv3-menu-logo' }, providerLogo(item.logo, 18)) : item.icon ? icon(item.icon, 15) : null,
        h('span', { className: 'mpv3-menu-label' }, item.label),
        item.active === true ? icon('check', 14) : item.status ? h('span', { className: 'mpv3-menu-status' }, item.status) : null,
      )
    }),
  )
}

/* ============================================================
   shared view parts
   ============================================================ */

function P3PageHead(props) {
  var count = props.count || ''
  return h(
    'div',
    { className: 'mpv3-page-head' },
    h('h1', { className: 'mpv3-page-title' }, props.title),
    count !== '' ? h('span', { className: 'mpv3-page-count' }, count) : null,
  )
}

function P3Empty(props) {
  return h(
    'div',
    { className: 'mpv3-empty-wrap' },
    h(
      'div',
      { className: 'mpv3-empty' },
      icon(props.icon || 'music', 28),
      h('strong', null, props.title || ''),
      props.hint ? h('span', null, props.hint) : null,
      props.actions ? h('div', { className: 'mpv3-empty-actions' }, props.actions) : null,
    ),
  )
}

function P3Skeleton(props) {
  var count = props.count || 8
  var rows = []
  for (var i = 0; i < count; i += 1) {
    rows.push(h('div', { key: i, className: 'mpv3-skeleton-row' },
      h('span', { className: 'mpv3-skeleton mpv3-skeleton-cover' }),
      h('span', { className: 'mpv3-skeleton-main' },
        h('span', { className: 'mpv3-skeleton mpv3-skeleton-line', style: { width: (34 + (i % 3) * 9) + '%' } }),
        h('span', { className: 'mpv3-skeleton mpv3-skeleton-line', style: { width: (18 + (i % 2) * 7) + '%' } }),
      ),
      h('span', { className: 'mpv3-skeleton mpv3-skeleton-time' }),
    ))
  }
  return h('div', { className: 'mpv3-skeleton-list' }, rows)
}

function p3Gradient(text) {
  var hash = 0
  var value = String(text || '')
  for (var i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0
  var index = Math.abs(hash) % 6
  var colors = [
    'linear-gradient(135deg,#4b6bff,#8b5cf6)',
    'linear-gradient(135deg,#ff6b6b,#ffa14a)',
    'linear-gradient(135deg,#0f9b8e,#43e0b0)',
    'linear-gradient(135deg,#f7b733,#fc4a1a)',
    'linear-gradient(135deg,#8e2de2,#4a00e0)',
    'linear-gradient(135deg,#2b5876,#4e4376)',
  ]
  return colors[index]
}

function p3Initial(value) {
  var text = String(value || '').trim()
  if (text === '') return '·'
  return Array.from(text)[0] || '·'
}

function P3Row(props) {
  var track = props.track
  var current = props.currentPath === track.path
  var selection = useStore(selectionStore)
  var selected = props.selected === true || (selection.paths || []).indexOf(track.path) >= 0
  var like = likeStateOf(track, props.favoriteSet)
  var artistNames = trackArtistNames(track)
  var album = track.album || ''
  return h(
    'div',
    {
      className: cx('mpv3-row', current && 'is-cur', selected && 'is-selected'),
      role: 'row',
      'aria-selected': selected ? 'true' : 'false',
      'data-path': track.path,
      'data-index': props.index,
      tabIndex: props.tabIndex === 0 ? 0 : -1,
      onClick: function (event) {
        if (event.detail > 1) return
        p3SelectTrack(props.list, track, event.metaKey || event.ctrlKey)
      },
      onDoubleClick: function (event) {
        if (event.target.closest('button')) return
        p3PlayTrack(props.list, track)
      },
      onContextMenu: function (event) {
        event.preventDefault()
        p3OpenTrackMenu(track, event, props.list, props.onRemove)
      },
      onKeyDown: function (event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          p3PlayTrack(props.list, track)
        }
      },
    },
    h('div', { className: 'mpv3-row-cover-wrap' },
      h('div', { className: 'mpv3-row-cover', style: track.hasCover === true || track.onlineProvider ? undefined : { background: p3Gradient(track.title) } },
        h(Cover, { src: trackCoverSrc(track), iconSize: 21 }),
      ),
      h('button', {
        type: 'button',
        className: 'mpv3-row-play',
        title: current && props.playing ? t('page.pause') : t('page.play'),
        onClick: function (event) {
          event.stopPropagation()
          if (current) player.toggle()
          else p3PlayTrack(props.list, track)
        },
      }, icon(current && props.playing ? 'pause' : 'play', 20)),
      selected ? h('span', { className: 'mpv3-row-check' }, icon('check', 13)) : null,
    ),
    h('div', { className: 'mpv3-row-main' },
      h('div', { className: 'mpv3-row-title' },
        h('span', { className: 'mpv3-row-title-text' }, trackTitleOf(track)),
        track.qualityHint === 'VIP' ? h('span', { className: 'mpv3-vip' }, 'VIP') : null,
        current && props.playing ? h('span', { className: 'mpv3-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')) : null,
      ),
      h('div', { className: 'mpv3-row-sub' },
        artistNames.length > 0
          ? artistNames.map(function (name, index) {
              return [
                index > 0 ? h('span', { key: 'sep-' + index, className: 'mpv3-artist-sep' }, ' / ') : null,
                h('button', {
                  key: 'artist-' + index,
                  type: 'button',
                  className: 'mpv3-text-link mpv3-artist-link',
                  onClick: function (event) { event.stopPropagation(); p3OpenArtist(track, name) },
                }, name),
              ]
            })
          : h('span', null, trackArtistOf(track)),
      ),
    ),
    h('button', {
      type: 'button',
      className: 'mpv3-row-album mpv3-text-link',
      title: album,
      onClick: function (event) { event.stopPropagation(); p3OpenAlbum(track) },
    }, album),
    h('span', { className: 'mpv3-row-time' }, fmtClock(track.durationSec || 0)),
    h('div', { className: 'mpv3-row-acts' },
      h(IconButton, {
        icon: like.isLiked ? 'heartFill' : 'heart',
        size: 20,
        active: like.isLiked,
        disabled: like.disabled === true,
        title: like.disabled === true ? like.reason : like.isLiked ? t('page.unfavorite') : t('page.favorite'),
        onClick: function (event) { event.stopPropagation(); like.onLike() },
      }),
      props.onRemove ? h(IconButton, {
        icon: 'trash',
        size: 20,
        title: t('p3.removeFromPlaylist'),
        onClick: function (event) { event.stopPropagation(); props.onRemove(track) },
      }) : null,
      h(IconButton, {
        icon: 'more',
        size: 20,
        title: t('page.more'),
        onClick: function (event) { event.stopPropagation(); p3OpenTrackMenu(track, event, props.list, props.onRemove) },
      }),
    ),
  )
}

function P3List(props) {
  var items = props.items || []
  var selection = useStore(selectionStore)
  var selectedSet = useMemo(function () {
    var set = {}
    ;(selection.paths || []).forEach(function (path) { set[path] = true })
    return set
  }, [selection.paths])
  var scrollRef = useRef(null)
  var [scrollTop, setScrollTop] = useState(0)
  var [viewport, setViewport] = useState(600)
  var [headerHeight, setHeaderHeight] = useState(0)
  var [focusPath, setFocusPath] = useState(props.focusPath || (items[0] ? items[0].path : ''))
  var rowHeight = 76
  var [moreBusy, setMoreBusy] = useState(false)

  useEffect(function () {
    var el = scrollRef.current
    if (!el) return undefined
    function measure() { setViewport(el.clientHeight || 600) }
    measure()
    var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (observer) observer.observe(el)
    window.addEventListener('resize', measure)
    return function () {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(function () {
    var header = scrollRef.current ? scrollRef.current.querySelector('.mpv3-list-header') : null
    if (!header) { setHeaderHeight(0); return }
    var update = function () { setHeaderHeight(header.offsetHeight || 0) }
    update()
    var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    if (observer) observer.observe(header)
    return function () { if (observer) observer.disconnect() }
  }, [props.header, items.length])

  useEffect(function () {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [props.resetKey])

  useEffect(function () {
    if (!focusPath && items[0]) setFocusPath(items[0].path)
  }, [items.length])

  function focusIndex(event) {
    var index = 0
    items.forEach(function (item, at) { if (item.path === focusPath) index = at })
    if (event.key === 'ArrowDown') index = Math.min(items.length - 1, index + 1)
    else if (event.key === 'ArrowUp') index = Math.max(0, index - 1)
    else if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = items.length - 1
    else return false
    var next = items[index]
    if (!next) return false
    setFocusPath(next.path)
    requestAnimationFrame(function () {
      var row = scrollRef.current ? scrollRef.current.querySelector('.mpv3-vrow[data-index="' + index + '"] .mpv3-row') : null
      if (row) {
        row.focus({ preventScroll: false })
        row.scrollIntoView({ block: 'nearest' })
      }
    })
    return true
  }

  var start = Math.max(0, Math.floor((scrollTop - headerHeight) / rowHeight) - 4)
  var end = Math.min(items.length, Math.ceil((scrollTop + viewport - headerHeight) / rowHeight) + 4)
  var visible = items.slice(start, end)
  var footerHeight = props.hasMore === true ? 56 : 0
  var total = headerHeight + items.length * rowHeight + footerHeight
  if (items.length === 0) total = headerHeight + 240

  function requestMore() {
    if (props.hasMore !== true || props.loadingMore === true || moreBusy || typeof props.onLoadMore !== 'function') return
    setMoreBusy(true)
    props.onLoadMore()
  }

  useEffect(function () {
    if (props.loadingMore !== true) setMoreBusy(false)
  }, [props.loadingMore, items.length])

  useEffect(function () {
    if (props.hasMore === true && items.length > 0 && total <= viewport + 400) requestMore()
  }, [items.length, total, viewport, props.hasMore, props.loadingMore])

  return h(
    'div',
    {
      className: 'mpv3-scroll',
      ref: scrollRef,
      tabIndex: 0,
      onScroll: function (event) {
        var top = event.currentTarget.scrollTop
        setScrollTop(top)
        if (top + viewport >= total - 400) requestMore()
      },
      onKeyDown: function (event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
          if (focusIndex(event)) event.preventDefault()
        }
      },
    },
    h('div', { className: 'mpv3-scroll-inner', style: { height: total + 'px' } },
      h('div', { className: 'mpv3-list-header' }, props.header),
      items.length === 0
        ? h('div', { className: 'mpv3-list-empty' }, props.empty)
        : visible.map(function (item, offset) {
            var index = start + offset
            return h('div', {
              key: item.path || index,
              className: 'mpv3-vrow',
              'data-index': index,
              style: { top: (headerHeight + index * rowHeight) + 'px', height: rowHeight + 'px' },
            }, h(P3Row, {
              track: item,
              index: index,
              list: items,
              currentPath: props.currentPath,
              playing: props.playing,
              favoriteSet: props.favoriteSet,
              selected: selectedSet[item.path] === true,
              tabIndex: item.path === focusPath ? 0 : -1,
              onRemove: props.onRemove,
            }))
          }),
      footerHeight > 0
        ? h('div', { className: 'mpv3-list-footer', style: { top: (headerHeight + items.length * rowHeight) + 'px', height: footerHeight + 'px' } },
            h('div', { className: 'mpv3-more' },
              h(Button, {
                variant: 'ghost',
                disabled: props.loadingMore === true || moreBusy,
                title: props.loadMoreError || '',
                onClick: requestMore,
              }, props.loadingMore === true || moreBusy ? t('p3.loadingMore') : t('p3.loadMore')),
            ),
          )
        : null,
    ),
  )
}

function P3Grid(props) {
  var items = props.items || []
  return h('div', { className: 'mpv3-grid' }, items.map(function (item) {
    return h('button', {
      key: item.key || item.id || item.name,
      type: 'button',
      className: 'mpv3-card',
      onClick: function () { props.onOpen(item) },
      onContextMenu: props.onMenu ? function (event) { event.preventDefault(); props.onMenu(item, event) } : undefined,
    },
      h('div', { className: 'mpv3-card-cover', style: item.coverSrc ? undefined : { background: p3Gradient(item.name || item.title) } },
        item.coverSrc ? h('img', { src: item.coverSrc, alt: '', loading: 'lazy' }) : h('span', null, p3Initial(item.name || item.title)),
      ),
      h('div', { className: 'mpv3-card-title' }, item.name || item.title || ''),
      h('div', { className: 'mpv3-card-sub' }, item.subtitle || item.artist || ''),
    )
  }))
}

function P3Hero(props) {
  return h('div', { className: 'mpv3-hero' },
    h('div', { className: cx('mpv3-hero-cover', props.round && 'is-round'), style: props.coverSrc ? undefined : { background: p3Gradient(props.title) } },
      props.coverSrc ? h('img', { src: props.coverSrc, alt: '' }) : h('span', null, p3Initial(props.title)),
    ),
    h('div', { className: 'mpv3-hero-info' },
      h('div', { className: 'mpv3-hero-eyebrow' }, props.eyebrow || ''),
      h('h1', { className: 'mpv3-hero-title' }, props.title),
      h('div', { className: 'mpv3-hero-meta' }, props.meta || null),
      h('div', { className: 'mpv3-hero-actions' }, props.actions || null),
    ),
  )
}
