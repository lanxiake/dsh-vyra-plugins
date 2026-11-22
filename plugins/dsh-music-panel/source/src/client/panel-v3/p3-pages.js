/**
 * panel-v3 pages: local library, online browse/detail, search and statistics.
 */

function p3PlayAll(items) {
  if (!items || items.length === 0) return
  p3PlayList(items, 0)
}

function p3ShuffleAll(items) {
  if (!items || items.length === 0) return
  player.setOrder('random')
  p3PlayList(items, Math.floor(Math.random() * items.length))
}

function p3PageMeta(state, library, online, prefs) {
  var route = state || p3RouteStore.get()
  var page = route.page
  var source = route.source
  var title = p3PageLabel(page)
  var parent = p3ParentLabel(page)
  var count = ''
  if (page === 'songs') {
    if (source === 'local') {
      var songs = p3CurrentTracks(route, library, online, prefs)
      title = t('v2.allSongs')
      count = songs.length + ' ' + t('p3.unitSong')
    } else {
      title = t('v2.allSongs')
      count = (onlineStore.get().songsTotal || 0) + ' ' + t('p3.unitSong')
    }
  } else if (page === 'favorites') {
    var favorites = p3CurrentTracks(route, library, online, prefs)
    count = favorites.length + ' ' + t('p3.unitSong')
  } else if (page === 'albums') {
    count = source === 'local'
      ? p3LocalAlbums(library, prefs).length + ' ' + t('p3.unitAlbum')
      : (onlineStore.get().browseAlbumsTotal || 0) + ' ' + t('p3.unitAlbum')
  } else if (page === 'artists') {
    count = source === 'local'
      ? p3LocalArtists(library, prefs).length + ' ' + t('p3.unitArtist')
      : (onlineStore.get().browseArtistsTotal || 0) + ' ' + t('p3.unitArtist')
  } else if (page === 'folders') {
    count = p3LocalFolders(library).length + ' ' + t('p3.unitFolder')
  } else if (page === 'playlists') {
    count = source === 'local'
      ? (library.playlists || []).length + ' ' + t('p3.unitPlaylist')
      : (onlineStore.get().playlists || []).length + ' ' + t('p3.unitPlaylist')
  } else if (page === 'stats') {
    count = ''
  } else if (page === 'recent') {
    var recent = p3OnlineHistory(source)
    count = recent.length + ' ' + t('p3.unitSong')
  } else if (page === 'album') {
    var album = p3CurrentAlbum(source)
    title = album ? album.name : t('v2.album')
    count = album && album.tracks ? album.tracks.length + ' ' + t('p3.unitSong') : ''
  } else if (page === 'artist') {
    var artist = p3CurrentArtist(source)
    title = artist ? artist.name : t('v2.artist')
    count = artist && artist.tracks ? artist.tracks.length + ' ' + t('p3.unitSong') : ''
  } else if (page === 'playlist') {
    var playlist = p3CurrentPlaylist(source)
    title = playlist ? playlist.name : t('v2.playlist')
    var playlistCount = playlist ? (playlist.trackPaths ? playlist.trackPaths.length : (playlist.ids || []).length) : 0
    count = playlist ? playlistCount + ' ' + t('p3.unitSong') : ''
  } else if (page === 'search') {
    title = route.query ? t('p3.searchTitle', { q: route.query }) : t('page.search')
    count = ''
    parent = t('page.search')
  }
  var snapshot = p3CollectionNavStore.get().snapshot
  if (snapshot && snapshot.stack.length > 0) {
    var top = snapshot.stack[snapshot.stack.length - 1]
    var previous = snapshot.stack.length > 1 ? snapshot.stack[snapshot.stack.length - 2] : null
    parent = previous
      ? (previous.name || p3PageLabel(previous.type))
      : snapshot.origin === 'search' ? t('page.search') : p3PageLabel(p3BrowseStore.get().tab)
  }
  return { parent: parent, title: title, count: count }
}

function p3CurrentAlbum(source) {
  if (source === 'local') {
    var route = p3RouteStore.get()
    return p3LocalAlbums(libraryStore.get(), prefsStore.get()).filter(function (item) { return item.key === route.param })[0] || null
  }
  var album = p3Collection.get().album
  var store = onlineStore.get()
  if (!album && !store.albumName) return null
  return {
    name: store.albumName || (album && album.album) || '',
    artist: store.albumArtist || (album && album.artist) || '',
    coverSrc: store.albumCover || (album && album.coverUrl) || '',
    tracks: p3OnlineTrackList(store.albumSongs),
  }
}

function p3CurrentArtist(source) {
  if (source === 'local') {
    var route = p3RouteStore.get()
    return p3LocalArtists(libraryStore.get(), prefsStore.get()).filter(function (item) { return item.name === route.param })[0] || null
  }
  var artist = p3Collection.get().artist
  var store = onlineStore.get()
  if (!artist && !store.artistName) return null
  return {
    name: store.artistName || (artist && artist.artist) || '',
    coverSrc: (artist && artist.coverUrl) || '',
    tracks: p3OnlineTrackList(store.artistSongs),
  }
}

function p3CurrentPlaylist(source) {
  if (source === 'local') return playlistById(p3RouteStore.get().param)
  var playlist = p3Collection.get().playlist
  var store = onlineStore.get()
  return {
    id: store.playlistId || (playlist && playlist.id) || '',
    name: store.playlistName || (playlist && playlist.name) || '',
    ids: (store.playlistSongs || []).map(function (item) { return 'online:' + store.provider + ':' + item.id }),
  }
}

function p3SearchTotal(route, library, online) {
  if (route.source !== 'local') return onlineStore.get().searchTotal || 0
  var query = route.query || ''
  var lower = query.toLowerCase()
  var tracks = filterTracks(p3LocalTracks(library), query).length
  var albums = p3LocalAlbums(library, prefsStore.get(), query).length
  var artists = p3LocalArtists(library, prefsStore.get(), query).length
  var playlists = (library.playlists || []).filter(function (playlist) {
    return String(playlist.name || '').toLowerCase().indexOf(lower) >= 0
  }).length
  return tracks + albums + artists + playlists
}

function P3PageHeadFor(props) {
  var meta = p3PageMeta(props.route, props.library, props.online, props.prefs)
  return h(P3PageHead, { title: meta.title, count: meta.count })
}

function P3LocalList(props) {
  var selection = useStore(selectionStore)
  var selectedSet = useMemo(function () {
    var set = {}
    ;(selection.paths || []).forEach(function (path) { set[path] = true })
    return set
  }, [selection.paths])
  return h(P3List, {
    items: props.items,
    header: h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: selectedSet,
    resetKey: [props.route.source, props.route.page, props.route.param, props.route.query, props.prefs.sortBy, props.prefs.sortDir].join('|'),
    empty: props.empty || h(P3Empty, { icon: 'music', title: t('page.noResults') }),
  })
}

function P3GridPage(props) {
  return h('div', { className: 'mpv3-scroll' },
    h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
      props.children,
    ),
  )
}

function P3LocalSongsPage(props) {
  var items = p3CurrentTracks(props.route, props.library, props.online, props.prefs)
  if (items.length === 0) {
    var emptyTitle = props.route.query || props.route.filter ? t('page.noResults') : t('v2.noTracks')
    var emptyHint = props.route.query || props.route.filter ? t('p3.noFilterMatch') : t('v2.noTracksHint')
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
      h(P3Empty, {
        icon: 'music',
        title: emptyTitle,
        hint: emptyHint,
        actions: props.route.query || props.route.filter ? null : h('div', null,
          h(Button, { variant: 'primary', onClick: function () { pushLayer('folderPicker') } }, t('v2.folderAdd')),
          h(Button, { variant: 'ghost', onClick: function () { void loadLibrary(true) } }, t('page.refresh')),
        ),
      }),
    ))
  }
  return h(P3LocalList, Object.assign({}, props, { items: items }))
}

function P3FavoritesPage(props) {
  var items = p3CurrentTracks(props.route, props.library, props.online, props.prefs)
  if (items.length === 0) {
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
      h(P3Empty, {
        icon: 'heart',
        title: t('v2.noFavorites'),
        hint: t('v2.noFavoritesHint'),
        actions: h(Button, { variant: 'primary', onClick: function () { p3SelectBrowseTab('songs') } }, t('p3.goSongs')),
      }),
    ))
  }
  return h(P3LocalList, Object.assign({}, props, { items: items }))
}

function P3PlaylistPage(props) {
  var source = props.route.source
  if (source !== 'local') return h(P3OnlinePlaylistPage, props)
  var items = p3CurrentTracks(props.route, props.library, props.online, props.prefs)
  var playlist = p3CurrentPlaylist('local')
  if (!playlist) {
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3Empty, { icon: 'list', title: t('p3.playlistMissing'), actions: h(Button, { variant: 'ghost', onClick: function () { p3GoBack() } }, t('page.back')) }),
    ))
  }
  var cover = items[0]
  return h(P3List, {
    items: items,
    header: h('div', null,
      h(P3Hero, {
        eyebrow: t('v2.playlist'),
        title: playlist.name,
        coverSrc: cover ? trackCoverSrc(cover) : '',
        meta: h('span', null, items.length + ' ' + t('p3.unitSong')),
        actions: h('div', { className: 'mpv3-hero-actions' },
          h(Button, { variant: 'primary', icon: 'play', onClick: function () { p3PlayAll(items) } }, t('page.playAll')),
          h(Button, { variant: 'ghost', icon: 'shuffle', onClick: function () { p3ShuffleAll(items) } }, t('p3.shuffle')),
          h(IconButton, { icon: 'more', title: t('page.more'), onClick: function () { openP3Playlist('manage', playlist) } }),
        ),
      }),
    ),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    resetKey: 'playlist:' + playlist.id,
    empty: h(P3Empty, { icon: 'list', title: t('p3.playlistEmpty'), hint: t('p3.playlistEmptyHint') }),
  })
}

function P3AlbumPage(props) {
  var source = props.route.source
  if (source !== 'local') return h(P3OnlineAlbumPage, props)
  var album = p3CurrentAlbum('local')
  if (!album) {
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3Empty, { icon: 'disc', title: t('p3.albumMissing'), actions: h(Button, { variant: 'ghost', onClick: function () { p3GoBack() } }, t('page.back')) }),
    ))
  }
  var items = p3CurrentTracks(props.route, props.library, props.online, props.prefs)
  return h(P3List, {
    items: items,
    header: h(P3Hero, {
      eyebrow: t('v2.album'),
      title: album.name,
      coverSrc: album.coverTrack ? trackCoverSrc(album.coverTrack) : '',
      meta: h('div', { className: 'mpv3-hero-meta-line' },
        h('button', { type: 'button', className: 'mpv3-text-link', onClick: function () {
          var names = items[0] ? trackArtistNames(items[0]) : []
          p3PushCollection(p3LocalArtistDescriptor({ name: names.length > 0 ? names[0] : album.artist }))
        } }, album.artist),
        album.year ? h('span', null, '· ' + album.year) : null,
        h('span', null, '· ' + items.length + ' ' + t('p3.unitSong')),
      ),
      actions: h('div', { className: 'mpv3-hero-actions' },
        h(Button, { variant: 'primary', icon: 'play', onClick: function () { p3PlayAll(items) } }, t('page.playAll')),
        h(Button, { variant: 'ghost', icon: 'shuffle', onClick: function () { p3ShuffleAll(items) } }, t('p3.shuffle')),
      ),
    }),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    resetKey: 'album:' + album.key,
  })
}

function P3ArtistPage(props) {
  var source = props.route.source
  if (source !== 'local') return h(P3OnlineArtistPage, props)
  var artist = p3CurrentArtist('local')
  if (!artist) {
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3Empty, { icon: 'user', title: t('p3.artistMissing'), actions: h(Button, { variant: 'ghost', onClick: function () { p3GoBack() } }, t('page.back')) }),
    ))
  }
  var items = p3CurrentTracks(props.route, props.library, props.online, props.prefs)
  var hot = items.slice(0, 8)
  var albums = p3LocalAlbums(props.library, props.prefs).filter(function (item) {
    return item.tracks.some(function (track) {
      var names = trackArtistNames(track)
      return (names.length > 0 ? names[0] : t('page.unknownArtist')) === artist.name
    })
  })
  return h('div', { className: 'mpv3-scroll' },
    h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3Hero, {
        eyebrow: t('v2.artist'),
        title: artist.name,
        coverSrc: artist.coverTrack ? trackCoverSrc(artist.coverTrack) : '',
        round: true,
        meta: h('span', null, albums.length + ' ' + t('p3.unitAlbum') + ' · ' + items.length + ' ' + t('p3.unitSong')),
        actions: h('div', { className: 'mpv3-hero-actions' },
          h(Button, { variant: 'primary', icon: 'play', onClick: function () { p3PlayAll(items) } }, t('page.playAll')),
          h(Button, { variant: 'ghost', icon: 'shuffle', onClick: function () { p3ShuffleAll(items) } }, t('p3.shuffle')),
        ),
      }),
      h('div', { className: 'mpv3-section' },
        h('div', { className: 'mpv3-section-head' },
          h('strong', null, t('p3.hotSongs')),
          h('button', { type: 'button', className: 'mpv3-text-link', onClick: function () { p3SelectBrowseTab('songs') } }, t('p3.allSongs')),
        ),
        h('div', { className: 'mpv3-plain-list' }, hot.map(function (track, index) {
          return h(P3Row, {
            key: track.path,
            track: track,
            index: index,
            list: items,
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: props.favoriteSet,
            selected: false,
            tabIndex: -1,
          })
        })),
      ),
      albums.length > 0 ? h('div', { className: 'mpv3-section' },
        h('div', { className: 'mpv3-section-head' }, h('strong', null, t('v2.albums'))),
        h(P3Grid, {
          items: albums.map(function (item) {
            return {
              key: item.key,
              name: item.name,
              subtitle: item.artist + (item.year ? ' · ' + item.year : ''),
              coverSrc: item.coverTrack ? trackCoverSrc(item.coverTrack) : '',
            }
          }),
          onOpen: function (item) { p3PushCollection(p3LocalAlbumDescriptor(item)) },
        }),
      ) : null,
    ),
  )
}

function P3PlaylistsPage(props) {
  var source = props.route.source
  var local = (props.library.playlists || []).map(function (playlist) {
    var tracks = playlistTracks(playlist)
    return {
      id: playlist.id,
      name: playlist.name,
      subtitle: tracks.length + ' ' + t('p3.unitSong'),
      coverSrc: tracks[0] ? trackCoverSrc(tracks[0]) : '',
      playlist: playlist,
    }
  })
  var online = sortOnlinePlaylists(props.online.playlists || []).map(function (playlist) {
    return {
      id: playlist.id,
      name: playlist.name || '',
      subtitle: (playlist.trackCount || 0) + ' ' + t('p3.unitSong'),
      coverSrc: p3OnlineCover(playlist, source, 'playlist'),
      playlist: playlist,
    }
  })
  var items = source === 'local' ? local : online
  if (source !== 'local' && items.length === 0 && props.online.playlistsPhase === 'loading') {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Skeleton, { count: 6 }))
  }
  if (source !== 'local' && items.length === 0 && props.online.playlistsPhase === 'error' && p3SourceLoggedIn(source)) {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: props.online.error, actions: h(Button, { variant: 'ghost', onClick: function () { void loadMyPlaylists(source) } }, t('p3.retry')) }),
    )
  }
  if (source !== 'local' && !p3SourceLoggedIn(source) && items.length === 0) {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, {
        icon: 'user',
        title: t('p3.loginForPlaylists'),
        hint: t('p3.loginForPlaylistsHint'),
        actions: h(Button, {
          variant: 'primary',
          onClick: function () {
            if (source === 'navidrome') pushLayer('settings', { tab: 'online' })
            else pushLayer('login', { provider: source })
          },
        }, t('p3.login')),
      }),
    )
  }
  return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
    items.length === 0
      ? h(P3Empty, {
          icon: 'list',
          title: t('v2.noPlaylists'),
          hint: t('page.playlistEmptyHint'),
          actions: source === 'local' ? h(Button, { variant: 'primary', onClick: function () { openP3Playlist('create') } }, t('v2.newPlaylist')) : null,
        })
      : h(P3Grid, {
          items: items,
          onOpen: function (item) { p3OpenPlaylist(item.playlist, source === 'local' ? '' : source) },
          onMenu: source === 'local' ? function (item) { openP3Playlist('manage', item.playlist) } : null,
        }),
  )
}

function P3AlbumsPage(props) {
  if (props.route.source !== 'local') return h(P3OnlineAlbumsPage, props)
  var albums = p3LocalAlbums(props.library, props.prefs, props.route.query)
  return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
    albums.length === 0
      ? h(P3Empty, { icon: 'disc', title: t('p3.noAlbums'), hint: t('p3.noAlbumsHint') })
      : h(P3Grid, {
          items: albums.map(function (album) {
            return {
              key: album.key,
              name: album.name,
              subtitle: album.artist + (album.year ? ' · ' + album.year : ''),
              coverSrc: album.coverTrack ? trackCoverSrc(album.coverTrack) : '',
            }
          }),
          onOpen: function (item) { p3PushCollection(p3LocalAlbumDescriptor(item)) },
        }),
  )
}

function P3ArtistsPage(props) {
  if (props.route.source !== 'local') return h(P3OnlineArtistsPage, props)
  var artists = p3LocalArtists(props.library, props.prefs, props.route.query)
  return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
    artists.length === 0
      ? h(P3Empty, { icon: 'user', title: t('p3.noArtists'), hint: t('p3.noArtistsHint') })
      : h('div', { className: 'mpv3-plain-list' }, artists.map(function (artist) {
          return h('button', {
            key: artist.name,
            type: 'button',
            className: 'mpv3-entity-row',
            onClick: function () { p3PushCollection(p3LocalArtistDescriptor(artist)) },
          },
            h('span', { className: 'mpv3-entity-cover', style: artist.coverTrack ? undefined : { background: p3Gradient(artist.name) } },
              artist.coverTrack ? h(Cover, { src: trackCoverSrc(artist.coverTrack), iconSize: 14 }) : h('span', null, p3Initial(artist.name)),
            ),
            h('span', { className: 'mpv3-entity-main' },
              h('span', { className: 'mpv3-entity-title' }, artist.name),
              h('span', { className: 'mpv3-entity-sub' }, artist.albumCount + ' ' + t('p3.unitAlbum') + ' · ' + artist.tracks.length + ' ' + t('p3.unitSong')),
            ),
            icon('right', 16),
          )
        })),
  )
}

function P3FoldersPage(props) {
  var folders = p3LocalFolders(props.library)
  return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
    folders.length === 0
      ? h(P3Empty, { icon: 'folder', title: t('p3.noFolders'), hint: t('p3.noFoldersHint') })
      : h('div', { className: 'mpv3-plain-list' }, folders.map(function (folder) {
          return h('button', {
            key: folder.path,
            type: 'button',
            className: 'mpv3-entity-row',
            onClick: function () {
              p3SelectBrowseTab('songs', { filter: { kind: 'folder', value: folder.path } })
            },
          },
            h('span', { className: 'mpv3-entity-cover is-folder' }, icon('folder', 15)),
            h('span', { className: 'mpv3-entity-main' },
              h('span', { className: 'mpv3-entity-title' }, folder.path),
              h('span', { className: 'mpv3-entity-sub' }, folder.tracks.length + ' ' + t('p3.unitSong')),
            ),
            icon('right', 16),
          )
        })),
  )
}

function P3StatsPage(props) {
  var entries = p3LocalStats(props.library)
  var totalSeconds = entries.reduce(function (sum, item) { return sum + item.seconds }, 0)
  var totalPlays = entries.reduce(function (sum, item) { return sum + item.plays }, 0)
  return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
    h('div', { className: 'mpv3-stat-cards' },
      h('div', { className: 'mpv3-stat-card' }, h('span', null, t('p3.totalTime')), h('strong', null, p3Duration(totalSeconds))),
      h('div', { className: 'mpv3-stat-card' }, h('span', null, t('p3.totalPlays')), h('strong', null, String(totalPlays))),
      h('div', { className: 'mpv3-stat-card' }, h('span', null, t('p3.topArtist')), h('strong', null, entries[0] ? trackArtistOf(entries[0].track) : '—')),
    ),
    entries.length === 0
      ? h(P3Empty, { icon: 'chart', title: t('p3.noStats'), hint: t('p3.noStatsHint') })
      : h('div', { className: 'mpv3-rank-list' }, entries.slice(0, 30).map(function (entry, index) {
          var max = entries[0].seconds || 1
          return h('button', {
            key: entry.path,
            type: 'button',
            className: 'mpv3-rank-row',
            onClick: function () { p3PlayTrack(entries.map(function (item) { return item.track }), entry.track) },
          },
            h('span', { className: 'mpv3-rank-n' }, String(index + 1)),
            h('span', { className: 'mpv3-rank-cover', style: entry.track.hasCover ? undefined : { background: p3Gradient(entry.track.title) } },
              h(Cover, { src: trackCoverSrc(entry.track), iconSize: 12 }),
            ),
            h('span', { className: 'mpv3-rank-main' },
              h('span', { className: 'mpv3-entity-title' }, trackTitleOf(entry.track)),
              h('span', { className: 'mpv3-entity-sub' }, trackArtistOf(entry.track)),
            ),
            h('span', { className: 'mpv3-rank-bar' }, h('i', { style: { width: Math.round((entry.seconds / max) * 100) + '%' } })),
            h('span', { className: 'mpv3-rank-meta' }, entry.plays + ' · ' + p3Duration(entry.seconds)),
          )
        })),
  )
}

function p3Duration(seconds) {
  var value = Math.max(0, Math.round(Number(seconds) || 0))
  if (value >= 3600) return Math.floor(value / 3600) + ' ' + t('p3.hour') + ' ' + Math.floor((value % 3600) / 60) + ' ' + t('p3.minute')
  return Math.max(1, Math.round(value / 60)) + ' ' + t('p3.minute')
}

function P3RecentPage(props) {
  var items = p3OnlineHistory(props.route.source)

  function removeRecent(track) {
    if (!track || !track.onlineProvider || !track.onlineId) return
    removeHistory({ provider: track.onlineProvider, id: track.onlineId })
    showToast(t('online.removedFromHistory'))
  }

  return h(P3List, {
    items: items,
    header: h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    onRemove: removeRecent,
    resetKey: 'recent:' + props.route.source,
    empty: h(P3Empty, { icon: 'clock', title: t('p3.noRecent'), hint: t('p3.noRecentHint') }),
  })
}

var P3_ONLINE_SONG_PAGE = 100

function P3DiscoverPage(props) {
  var source = props.route.source
  var [state, setState] = useState({ phase: 'loading', songs: [], playlists: [], error: '' })
  var [reload, setReload] = useState(0)
  var [fmBusy, setFmBusy] = useState(false)

  useEffect(function () {
    var cancelled = false
    setState({ phase: 'loading', songs: [], playlists: [], error: '' })
    getJson(API + 'online/discover?provider=' + encodeURIComponent(source))
      .then(function (body) {
        if (cancelled) return
        setState({
          phase: 'ready',
          songs: Array.isArray(body.songs) ? body.songs : [],
          playlists: Array.isArray(body.playlists) ? body.playlists : [],
          error: '',
        })
      })
      .catch(function (error) {
        if (cancelled) return
        setState({ phase: 'error', songs: [], playlists: [], error: errorText(error) })
      })
    return function () { cancelled = true }
  }, [source, reload])

  function startFm() {
    if (fmBusy) return
    setFmBusy(true)
    getJson(API + 'online/personal-fm?provider=' + encodeURIComponent(source))
      .then(function (body) {
        var tracks = p3OnlineTrackList(Array.isArray(body.songs) ? body.songs : [])
        if (tracks.length === 0) {
          showToast(t('p3.fmEmpty'))
          return
        }
        p3PlayAll(tracks)
      })
      .catch(function (error) { showToast(errorText(error)) })
      .finally(function () { setFmBusy(false) })
  }

  var items = p3OnlineTrackList(state.songs)
  var playlistItems = state.playlists.map(function (playlist) {
    return {
      id: playlist.id,
      name: playlist.name || '',
      subtitle: (playlist.trackCount || 0) + ' ' + t('p3.unitSong'),
      coverSrc: p3OnlineCover(playlist, source, 'playlist'),
      playlist: playlist,
    }
  })
  var actions = h('div', { className: 'mpv3-more' },
    h(Button, { variant: 'ghost', disabled: fmBusy, onClick: startFm }, fmBusy ? t('p3.loadingMore') : t('p3.personalFm')),
    h(Button, { variant: 'ghost', onClick: function () { setReload(reload + 1) } }, t('page.refresh')),
  )
  var playlistsBlock = playlistItems.length > 0 ? h('div', { className: 'mpv3-discover-playlists' },
    h(P3Grid, {
      items: playlistItems,
      onOpen: function (item) { p3OpenPlaylist(item.playlist, source) },
    }),
  ) : null
  var header = h('div', null,
    h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
    actions,
    playlistsBlock,
  )

  if (state.phase === 'loading') {
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
      h(P3Skeleton, { count: 8 }),
    ))
  }
  if (state.phase === 'error') {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: state.error, actions: h(Button, { variant: 'ghost', onClick: function () { setReload(reload + 1) } }, t('p3.retry')) }),
    )
  }
  if (items.length === 0 && playlistItems.length === 0) {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'music', title: t('p3.discoverEmpty'), hint: t('p3.discoverEmptyHint') }),
    )
  }
  if (items.length === 0) {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
      actions,
      playlistsBlock,
    )
  }
  return h(P3List, {
    items: items,
    header: header,
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    resetKey: 'online-discover:' + source + ':' + reload,
  })
}

function P3CloudPage(props) {
  var source = props.route.source
  var [state, setState] = useState({ phase: 'loading', items: [], page: 1, loadingMore: false, error: '' })
  var [page, setPage] = useState(1)
  var [reload, setReload] = useState(0)

  useEffect(function () {
    var cancelled = false
    if (page === 1) setState({ phase: 'loading', items: [], page: 1, loadingMore: false, error: '' })
    else setState(function (current) { return Object.assign({}, current, { loadingMore: true, error: '' }) })
    getJson(API + 'online/cloud?provider=' + encodeURIComponent(source) + '&page=' + String(page))
      .then(function (body) {
        if (cancelled) return
        var incoming = p3OnlineTrackList(Array.isArray(body.songs) ? body.songs : [])
        setState(function (current) {
          var merged = page === 1 ? incoming : current.items.concat(incoming)
          return { phase: 'ready', items: merged, page: page, loadingMore: false, error: '', hasMore: body.hasMore === true }
        })
      })
      .catch(function (error) {
        if (cancelled) return
        if (page === 1) setState({ phase: 'error', items: [], page: 1, loadingMore: false, error: errorText(error) })
        else {
          setState(function (current) { return Object.assign({}, current, { loadingMore: false, error: errorText(error) }) })
          showToast(errorText(error))
        }
      })
    return function () { cancelled = true }
  }, [source, page, reload])

  useEffect(function () { setPage(1) }, [source])
  if (state.phase === 'loading') {
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
      h(P3Skeleton, { count: 8 }),
    ))
  }
  if (state.phase === 'error') {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: state.error, actions: h(Button, { variant: 'ghost', onClick: function () { setPage(1); setReload(reload + 1) } }, t('p3.retry')) }),
    )
  }
  if (state.items.length === 0) {
    return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'download', title: t('p3.cloudEmpty'), hint: p3SourceLoggedIn(source) ? t('p3.cloudEmptyHintSignedIn') : t('p3.cloudEmptyHint') }),
    )
  }
  var more = state.hasMore === true
  return h(P3List, {
    items: state.items,
    header: h('div', null,
      h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
      more ? h('div', { className: 'mpv3-more' },
        h(Button, { variant: 'ghost', disabled: state.loadingMore === true, onClick: function () { if (!state.loadingMore) setPage(page + 1) } },
          state.loadingMore === true ? t('p3.loadingMore') : t('p3.loadMore')),
      ) : null,
    ),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    resetKey: 'online-cloud:' + source + ':' + reload,
  })
}

function P3OnlineSongsPage(props) {
  var [state, setState] = useState({ phase: 'loading', items: [], total: 0, loadingMore: false, error: '' })
  var [page, setPage] = useState(1)
  var [reload, setReload] = useState(0)
  useEffect(function () {
    var cancelled = false
    if (page === 1) setState({ phase: 'loading', items: [], total: 0, loadingMore: false, error: '' })
    else setState(function (current) { return Object.assign({}, current, { loadingMore: true, error: '' }) })
    var offset = (page - 1) * P3_ONLINE_SONG_PAGE
    getJson(API + 'online/songs?provider=' + encodeURIComponent(props.route.source) + '&size=' + String(P3_ONLINE_SONG_PAGE) + '&offset=' + String(offset) + '&sort=' + encodeURIComponent(props.prefs.sortBy || 'title') + '&order=' + (props.prefs.sortDir === 'desc' ? 'desc' : 'asc'))
      .then(function (body) {
        if (cancelled) return
        var rawIncoming = Array.isArray(body.songs) ? body.songs : []
        var total = Number(body.total) || rawIncoming.length
        var rawMerged = page === 1 ? rawIncoming : (onlineStore.get().songs || []).slice()
        if (page > 1) {
          var seen = {}
          rawMerged.forEach(function (item) { seen[String(item.id)] = true })
          rawIncoming.forEach(function (item) { if (seen[String(item.id)] !== true) rawMerged.push(item) })
        }
        onlineStore.set({ songsTotal: total, songs: rawMerged })
        setState({ phase: 'ready', items: p3OnlineTrackList(rawMerged), total: total, loadingMore: false, error: '' })
      })
      .catch(function (error) {
        if (cancelled) return
        if (page === 1) setState({ phase: 'error', items: [], total: 0, loadingMore: false, error: errorText(error) })
        else {
          setState(function (current) { return Object.assign({}, current, { loadingMore: false, error: errorText(error) }) })
          showToast(errorText(error))
        }
      })
    return function () { cancelled = true }
  }, [props.route.source, props.prefs.sortBy, props.prefs.sortDir, page, reload])
  useEffect(function () { setPage(1) }, [props.route.source, props.prefs.sortBy, props.prefs.sortDir])
  if (state.phase === 'loading') return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' }, h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }), h(P3Skeleton, { count: 8 })))
  if (state.phase === 'error') return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: state.error, actions: h(Button, { variant: 'ghost', onClick: function () { setState({ phase: 'loading', items: [], total: 0, loadingMore: false, error: '' }); setPage(1); setReload(reload + 1) } }, t('p3.retry')) }))
  if (state.items.length === 0) return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Empty, { icon: 'music', title: t('page.noResults') }))
  var more = state.items.length < state.total
  return h(P3List, {
    items: state.items,
    header: h('div', null,
      h(P3PageHeadFor, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }),
      more ? h('div', { className: 'mpv3-more' },
        h(Button, { variant: 'ghost', disabled: state.loadingMore === true, onClick: function () { if (!state.loadingMore) setPage(page + 1) } },
          state.loadingMore === true ? t('p3.loadingMore') : t('p3.loadMore')),
      ) : null,
    ),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    resetKey: 'online-songs:' + props.route.source + ':' + props.prefs.sortBy + ':' + props.prefs.sortDir,
  })
}

function P3OnlineAlbumsPage(props) {
  var [state, setState] = useState({ phase: 'loading', items: [] })
  var [reload, setReload] = useState(0)
  useEffect(function () {
    var cancelled = false
    getJson(API + 'online/albums?provider=' + encodeURIComponent(props.route.source) + '&size=200')
      .then(function (body) {
        if (cancelled) return
        var items = Array.isArray(body.albums) ? body.albums : []
        onlineStore.set({ browseAlbumsTotal: items.length })
        setState({ phase: 'ready', items: items })
      })
      .catch(function (error) {
        if (cancelled) return
        setState({ phase: 'error', items: [], error: errorText(error) })
      })
    return function () { cancelled = true }
  }, [props.route.source, reload])
  if (state.phase === 'loading') return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Skeleton, { count: 6 }))
  if (state.phase === 'error') return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: state.error, actions: h(Button, { variant: 'ghost', onClick: function () { setState({ phase: 'loading', items: [] }); setReload(reload + 1) } }, t('p3.retry')) }))
  return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
    state.items.length === 0
      ? h(P3Empty, { icon: 'disc', title: t('p3.noAlbums') })
      : h(P3Grid, {
          items: state.items.map(function (album) {
            return { key: album.id, name: album.name, subtitle: album.artist || '', coverSrc: p3OnlineCover(album, props.route.source, 'album'), album: album }
          }),
          onOpen: function (item) { p3PushCollection(p3OnlineAlbumDescriptor(props.route.source, item.album)) },
        }),
  )
}

function P3OnlineArtistsPage(props) {
  var [state, setState] = useState({ phase: 'loading', items: [] })
  var [reload, setReload] = useState(0)
  useEffect(function () {
    var cancelled = false
    getJson(API + 'online/artists?provider=' + encodeURIComponent(props.route.source))
      .then(function (body) {
        if (cancelled) return
        var items = Array.isArray(body.artists) ? body.artists : []
        onlineStore.set({ browseArtistsTotal: items.length })
        setState({ phase: 'ready', items: items })
      })
      .catch(function (error) {
        if (cancelled) return
        setState({ phase: 'error', items: [], error: errorText(error) })
      })
    return function () { cancelled = true }
  }, [props.route.source, reload])
  if (state.phase === 'loading') return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Skeleton, { count: 6 }))
  if (state.phase === 'error') return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: state.error, actions: h(Button, { variant: 'ghost', onClick: function () { setState({ phase: 'loading', items: [] }); setReload(reload + 1) } }, t('p3.retry')) }))
  return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs },
    state.items.length === 0
      ? h(P3Empty, { icon: 'user', title: t('p3.noArtists') })
      : h('div', { className: 'mpv3-plain-list' }, state.items.map(function (artist) {
          return h('button', {
            key: artist.id || artist.name,
            type: 'button',
            className: 'mpv3-entity-row',
            onClick: function () { p3PushCollection(p3OnlineArtistDescriptor(props.route.source, artist)) },
          },
            h('span', { className: 'mpv3-entity-cover is-round', style: artist.cover ? undefined : { background: p3Gradient(artist.name) } },
              artist.cover ? h('img', { src: p3OnlineCover(artist, props.route.source, 'artist'), alt: '' }) : h('span', null, p3Initial(artist.name)),
            ),
            h('span', { className: 'mpv3-entity-main' },
              h('span', { className: 'mpv3-entity-title' }, artist.name),
              h('span', { className: 'mpv3-entity-sub' }, artist.albumCount ? artist.albumCount + ' ' + t('p3.unitAlbum') : ''),
            ),
            icon('right', 16),
          )
        })),
  )
}

function P3SubscribeButton(props) {
  var provider = props.provider
  var type = props.type
  var id = String(props.id || '')
  var enabled = id !== '' && p3SourceCaps(provider).playlistSubscription === true
  var [subscribed, setSubscribed] = useState(false)
  var [busy, setBusy] = useState(false)
  useEffect(function () {
    if (!enabled) return undefined
    var cancelled = false
    getJson(API + 'online/subscription?provider=' + encodeURIComponent(provider) + '&type=' + encodeURIComponent(type) + '&id=' + encodeURIComponent(id))
      .then(function (body) { if (!cancelled) setSubscribed(body.subscribed === true) })
      .catch(function () { /* a failed status leaves the star off */ })
    return function () { cancelled = true }
  }, [provider, type, id, enabled])
  if (!enabled) return null
  function toggle() {
    if (busy) return
    setBusy(true)
    postJson(API + 'online/subscription', { provider: provider, type: type, id: id, subscribed: !subscribed })
      .then(function (body) { setSubscribed(body.subscribed === true) })
      .catch(function (error) { showToast(errorText(error)) })
      .finally(function () { setBusy(false) })
  }
  return h(Button, { variant: 'ghost', icon: 'star', disabled: busy, onClick: toggle },
    subscribed ? t('p3.subscribed') : t('p3.subscribe'))
}

function P3OnlinePlaylistPage(props) {
  var collection = p3Collection.get().playlist
  if (!collection && props.route.param) {
    var rawPlaylist = String(props.route.param)
    var playlistId = rawPlaylist.indexOf(':') >= 0 ? rawPlaylist.slice(rawPlaylist.indexOf(':') + 1) : rawPlaylist
    collection = { id: playlistId, name: '' }
  }
  var store = props.online
  useEffect(function () {
    if (!collection) return
    if (String(store.playlistId) !== String(collection.id) || store.playlistPhase === 'idle' || store.playlistPhase === 'error') void openOnlinePlaylist(collection)
  }, [props.route.param, props.route.source])
  var items = p3OnlineTrackList(props.online.playlistSongs)
  var totalCount = Number(props.online.playlistTrackCount) || items.length
  var canRemove = collection && collection.isOwned === true && p3SourceCaps(props.route.source).playlistTrackMutations === true
  function removeTrack(track) {
    if (!canRemove || !collection) return
    postJson(API + 'online/playlist-remove', {
      provider: props.route.source,
      playlistId: collection.id,
      song: {
        id: track.onlineId,
        songid: track.onlineId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        fileId: track.fileId,
      },
    })
      .then(function () {
        showToast(t('p3.removedFromPlaylist'))
        return openOnlinePlaylist(collection, true)
      })
      .catch(function (error) { showToast(errorText(error)) })
  }
  if (props.online.playlistPhase === 'loading') return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' }, h(P3Skeleton, { count: 8 })))
  if (props.online.playlistPhase === 'error') return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: props.online.error, actions: h(Button, { variant: 'ghost', onClick: function () { void openOnlinePlaylist(collection) } }, t('p3.retry')) }))
  return h(P3List, {
    items: items,
    header: h(P3Hero, {
      eyebrow: t('v2.playlist'),
      title: props.online.playlistName || (collection && collection.name) || t('v2.playlist'),
      coverSrc: collection && (collection.cover || collection.coverUrl) ? p3OnlineCover(collection, props.route.source, 'playlist') : (items[0] ? trackCoverSrc(items[0]) : ''),
      meta: h('span', null, totalCount + ' ' + t('p3.unitSong')),
      actions: h('div', { className: 'mpv3-hero-actions' },
        h(Button, { variant: 'primary', icon: 'play', onClick: function () { p3PlayAll(items) } }, t('page.playAll')),
        h(Button, { variant: 'ghost', icon: 'shuffle', onClick: function () { p3ShuffleAll(items) } }, t('p3.shuffle')),
        collection && collection.isOwned !== true ? h(P3SubscribeButton, { provider: props.route.source, type: 'playlist', id: collection.id }) : null,
      ),
    }),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    onRemove: canRemove ? removeTrack : undefined,
    hasMore: props.online.playlistHasMore === true,
    loadingMore: props.online.playlistLoadingMore === true,
    loadMoreError: props.online.playlistPageError || '',
    onLoadMore: function () { void loadMoreOnlinePlaylist() },
    resetKey: 'online-playlist:' + props.route.param,
    empty: h(P3Empty, { icon: 'list', title: t('p3.playlistEmpty') }),
  })
}

function P3OnlineAlbumPage(props) {
  var collection = p3Collection.get().album
  if (!collection && props.route.param) {
    var rawAlbum = String(props.route.param)
    var albumAt = rawAlbum.indexOf(':')
    collection = {
      onlineProvider: albumAt >= 0 ? rawAlbum.slice(0, albumAt) : props.route.source,
      albumId: albumAt >= 0 ? rawAlbum.slice(albumAt + 1) : rawAlbum,
      album: '',
      artist: '',
      coverUrl: '',
    }
  }
  useEffect(function () {
    if (!collection) return
    if (String(props.online.albumId) !== String(collection.albumId || collection.album || '') || props.online.albumPhase === 'idle' || props.online.albumPhase === 'error') void openOnlineAlbum(collection)
  }, [props.route.param, props.route.source])
  var items = p3OnlineTrackList(props.online.albumSongs)
  if (props.online.albumPhase === 'loading') return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' }, h(P3Skeleton, { count: 8 })))
  if (props.online.albumPhase === 'error') return h(P3GridPage, { route: props.route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: props.online.albumError, actions: h(Button, { variant: 'ghost', onClick: function () { void openOnlineAlbum(collection) } }, t('p3.retry')) }))
  return h(P3List, {
    items: items,
    header: h(P3Hero, {
      eyebrow: t('v2.album'),
      title: props.online.albumName || (collection && collection.album) || t('v2.album'),
      coverSrc: p3OnlineCover({ coverUrl: props.online.albumCover || (collection && collection.coverUrl) || '', id: collection && collection.albumId, coverArtId: collection && collection.coverArtId }, props.route.source, 'album'),
      meta: h('span', null, (props.online.albumArtist || '') + (items.length ? ' · ' + items.length + ' ' + t('p3.unitSong') : '')),
      actions: h('div', { className: 'mpv3-hero-actions' },
        h(Button, { variant: 'primary', icon: 'play', onClick: function () { p3PlayAll(items) } }, t('page.playAll')),
        h(Button, { variant: 'ghost', icon: 'shuffle', onClick: function () { p3ShuffleAll(items) } }, t('p3.shuffle')),
        h(P3SubscribeButton, { provider: props.route.source, type: 'album', id: collection && collection.albumId ? collection.albumId : String(props.route.param || '').split(':').pop() }),
      ),
    }),
    currentPath: props.currentPath,
    playing: props.playing,
    favoriteSet: props.favoriteSet,
    selectedSet: {},
    resetKey: 'online-album:' + props.route.param,
    empty: h(P3Empty, { icon: 'disc', title: t('page.noResults') }),
  })
}

function P3OnlineArtistPage(props) {
  var collection = p3Collection.get().artist
  if (!collection && props.route.param) {
    var rawArtist = String(props.route.param)
    var artistAt = rawArtist.indexOf(':')
    collection = {
      onlineProvider: artistAt >= 0 ? rawArtist.slice(0, artistAt) : props.route.source,
      artist: artistAt >= 0 ? rawArtist.slice(artistAt + 1) : rawArtist,
      artistId: '',
      coverUrl: '',
    }
  }
  var [detail, setDetail] = useState(null)
  useEffect(function () {
    if (!collection) return
    if (String(props.online.artistName) !== String(collection.artist) || props.online.artistPhase === 'idle' || props.online.artistPhase === 'error') {
      void openOnlineArtist({
        onlineProvider: collection.onlineProvider,
        artist: collection.artist,
        artistsDetail: collection.artistId ? [{ name: collection.artist, id: collection.artistId }] : [],
      })
    }
    if (collection.artistId) {
      getJson(API + 'online/artist?provider=' + encodeURIComponent(collection.onlineProvider) + '&id=' + encodeURIComponent(collection.artistId))
        .then(function (body) { setDetail(body || null) })
        .catch(function () { setDetail(null) })
    }
  }, [props.route.param, props.route.source])
  var items = p3OnlineTrackList(props.online.artistSongs)
  var albums = detail && Array.isArray(detail.albums) ? detail.albums : []
  return h('div', { className: 'mpv3-scroll' },
    h('div', { className: 'mpv3-scroll-inner is-static' },
      h(P3Hero, {
        eyebrow: t('v2.artist'),
        title: props.online.artistName || (collection && collection.artist) || t('v2.artist'),
        coverSrc: p3OnlineCover(collection, props.route.source, 'artist'),
        round: true,
        meta: h('span', null, (albums.length ? albums.length + ' ' + t('p3.unitAlbum') + ' · ' : '') + items.length + ' ' + t('p3.unitSong')),
        actions: h('div', { className: 'mpv3-hero-actions' },
          h(Button, { variant: 'primary', icon: 'play', onClick: function () { p3PlayAll(items) } }, t('page.playAll')),
          h(Button, { variant: 'ghost', icon: 'shuffle', onClick: function () { p3ShuffleAll(items) } }, t('p3.shuffle')),
        ),
      }),
      props.online.artistPhase === 'loading' ? h(P3Skeleton, { count: 6 }) : null,
      props.online.artistPhase === 'error' ? h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: props.online.artistError, actions: h(Button, { variant: 'ghost', onClick: function () {
        void openOnlineArtist({ onlineProvider: collection && collection.onlineProvider || props.route.source, artist: collection && collection.artist || '', artistsDetail: collection && collection.artistId ? [{ name: collection.artist, id: collection.artistId }] : [] })
      } }, t('p3.retry')) }) : null,
      items.length > 0 ? h('div', { className: 'mpv3-section' },
        h('div', { className: 'mpv3-section-head' }, h('strong', null, t('p3.hotSongs'))),
        h('div', { className: 'mpv3-plain-list' }, items.slice(0, 10).map(function (track, index) {
          return h(P3Row, { key: track.path, track: track, index: index, list: items, currentPath: props.currentPath, playing: props.playing, favoriteSet: props.favoriteSet, selected: false, tabIndex: -1 })
        })),
      ) : null,
      albums.length > 0 ? h('div', { className: 'mpv3-section' },
        h('div', { className: 'mpv3-section-head' }, h('strong', null, t('v2.albums'))),
        h(P3Grid, {
          items: albums.map(function (album) {
            return { key: album.id, name: album.name, subtitle: album.artist || '', coverSrc: p3OnlineCover(album, props.route.source, 'album'), album: album }
          }),
          onOpen: function (item) { p3PushCollection(p3OnlineAlbumDescriptor(props.route.source, item.album)) },
        }),
      ) : null,
    ),
  )
}

function p3OnlineSearchGroups(tracks, source) {
  var albumMap = {}
  var albumOrder = []
  var artistMap = {}
  var artistOrder = []
  ;(tracks || []).forEach(function (track) {
    var albumKey = track.albumId ? 'id:' + track.albumId : 'name:' + (track.album || '')
    if (track.album && !albumMap[albumKey]) {
      albumMap[albumKey] = {
        key: albumKey,
        name: track.album,
        artist: track.artist || '',
        albumId: track.albumId || '',
        coverUrl: track.coverUrl || '',
        coverArtId: track.coverArtId || '',
      }
      albumOrder.push(albumKey)
    }
    var names = trackArtistNames(track)
    var artistName = names.length > 0 ? names[0] : (track.artist || '')
    var artistKey = artistName
    if (artistName !== '' && !artistMap[artistKey]) {
      var detail = Array.isArray(track.artistsDetail) ? track.artistsDetail : []
      var artistId = ''
      detail.forEach(function (item) { if (item && item.name === artistName && item.id) artistId = String(item.id) })
      artistMap[artistKey] = {
        name: artistName,
        artistId: artistId,
        coverUrl: track.coverUrl || '',
        coverArtId: track.coverArtId || '',
        tracks: [],
      }
      artistOrder.push(artistKey)
    }
    if (artistName !== '' && artistMap[artistName]) artistMap[artistName].tracks.push(track)
  })
  return {
    albums: albumOrder.map(function (key) { return albumMap[key] }),
    artists: artistOrder.map(function (key) { return artistMap[key] }),
  }
}

function p3SearchNameScore(name, query) {
  var q = String(query || '').trim().toLowerCase()
  var n = String(name || '').trim().toLowerCase()
  if (q === '' || n === '') return 0
  if (n === q) return 1000
  if (n.indexOf(q) === 0) return 800
  if (n.indexOf(q) >= 0) return 600
  return 0
}

/** The one artist that best matches the query: exact, prefix, substring, then track count. */
function p3BestSearchArtist(artists, query) {
  var best = null
  var bestScore = -1
  var bestCount = -1
  ;(artists || []).forEach(function (artist) {
    var score = p3SearchNameScore(artist && artist.name, query)
    var count = artist && Array.isArray(artist.tracks) ? artist.tracks.length : 0
    if (score > bestScore || (score === bestScore && count > bestCount)) {
      best = artist
      bestScore = score
      bestCount = count
    }
  })
  return bestScore > 0 ? best : null
}

function P3SearchPage(props) {
  var route = props.route
  var query = String(route.query || '').trim()
  var source = route.source
  var local = source === 'local'
  var canAlbums = local || p3SearchKinds(source).indexOf('album') >= 0
  var [albumState, setAlbumState] = useState({ phase: canAlbums ? 'idle' : 'disabled', items: [], total: 0 })

  useEffect(function () {
    if (local) return undefined
    if (query === '') {
      onlineStore.set({ phase: 'idle', results: [], searchTotal: 0 })
      return undefined
    }
    var timer = setTimeout(function () { void searchOnline(query) }, 250)
    return function () { clearTimeout(timer) }
  }, [query, source, local])

  useEffect(function () {
    if (!canAlbums) {
      setAlbumState({ phase: 'disabled', items: [], total: 0 })
      return undefined
    }
    if (local) {
      setAlbumState({ phase: 'ready', items: [], total: 0 })
      return undefined
    }
    if (query === '') {
      setAlbumState({ phase: 'idle', items: [], total: 0 })
      return undefined
    }
    var cancelled = false
    setAlbumState({ phase: 'loading', items: [], total: 0 })
    var timer = setTimeout(function () {
      getJson(API + 'online/search?provider=' + encodeURIComponent(source) + '&kind=album&q=' + encodeURIComponent(query) + '&page=1')
        .then(function (body) {
          if (cancelled) return
          var items = Array.isArray(body.collections) ? body.collections : []
          setAlbumState({ phase: 'ready', items: items, total: Number(body.total) || items.length })
        })
        .catch(function () {
          if (cancelled) return
          // A failed album strip must not hide the song results; the section disappears.
          setAlbumState({ phase: 'error', items: [], total: 0 })
        })
    }, 250)
    return function () {
      cancelled = true
      clearTimeout(timer)
    }
  }, [canAlbums, local, query, source])

  var tracks = local
    ? p3SortLocal(filterTracks(p3LocalTracks(props.library), query), props.prefs)
    : p3OnlineSearchResults()
  var onlineGroups = local ? null : p3OnlineSearchGroups(tracks, source)
  var artistList = local ? p3LocalArtists(props.library, props.prefs, query) : (onlineGroups ? onlineGroups.artists : [])
  var bestArtist = p3BestSearchArtist(artistList, query)
  var albums = local ? p3LocalAlbums(props.library, props.prefs, query) : albumState.items
  var songTotal = local ? tracks.length : (props.online.searchTotal || tracks.length)
  var resultCount = songTotal + albums.length + (bestArtist ? 1 : 0)
  var artistCover = bestArtist
    ? (local ? (bestArtist.coverTrack ? trackCoverSrc(bestArtist.coverTrack) : '') : p3OnlineCover(bestArtist, source, 'artist'))
    : ''
  var artistCount = bestArtist && Array.isArray(bestArtist.tracks) ? bestArtist.tracks.length : 0

  var pageHead = h(P3PageHead, {
    title: query ? t('p3.searchTitle', { q: query }) : t('page.search'),
    count: query ? resultCount + ' ' + t('p3.unitResult') : '',
  })

  function goBackFromSearch() {
    if (p3CanGoBack()) {
      p3GoBack()
      return
    }
    p3SelectBrowseTab(p3DefaultPage(source))
  }

  var backAction = h(Button, { variant: 'primary', icon: 'back', onClick: goBackFromSearch }, t('page.back'))

  if (query === '') {
    return h(P3GridPage, { route: route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'search', title: t('p3.searchEmpty'), hint: t('p3.searchEmptyHint'), actions: backAction }))
  }

  if (!local && (props.online.phase === 'searching' || props.online.phase === 'idle')) {
    return h('div', { className: 'mpv3-scroll' }, h('div', { className: 'mpv3-scroll-inner is-static' },
      pageHead,
      h(P3Skeleton, { count: 8 }),
    ))
  }
  if (!local && props.online.phase === 'error') {
    return h(P3GridPage, { route: route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'warning', title: t('p3.loadFailed'), hint: props.online.error, actions: h(Button, { variant: 'ghost', onClick: function () { void searchOnline(query) } }, t('p3.retry')) }))
  }
  if (resultCount === 0) {
    return h(P3GridPage, { route: route, library: props.library, online: props.online, prefs: props.prefs },
      h(P3Empty, { icon: 'search', title: t('p3.searchNoResult'), hint: t('p3.searchNoResultHint'), actions: backAction }))
  }

  var artistRow = bestArtist ? h('div', { className: 'mpv3-search-artist' },
    h('button', {
      type: 'button',
      className: 'mpv3-search-artist-main',
      onClick: function () {
        if (local) p3PushCollection(p3LocalArtistDescriptor(bestArtist))
        else p3PushCollection(p3OnlineArtistDescriptor(source, bestArtist))
      },
    },
      h('span', { className: 'mpv3-search-artist-cover' },
        artistCover
          ? h('img', { src: artistCover, alt: '' })
          : h('span', null, p3Initial(bestArtist.name)),
      ),
      h('span', { className: 'mpv3-search-artist-meta' },
        h('span', { className: 'mpv3-search-artist-name' }, bestArtist.name),
        h('span', { className: 'mpv3-search-artist-sub' }, t('v2.artist') + ' · ' + artistCount + ' ' + t('p3.unitSong')),
      ),
      icon('right', 16),
    ),
  ) : null

  var albumRow = canAlbums && albums.length > 0 ? h('div', { className: 'mpv3-hrow' },
    albums.map(function (album) {
      var name = local ? album.name : album.name
      var subtitle = local ? album.artist : (album.artist || album.creator || '')
      var cover = local
        ? (album.coverTrack ? trackCoverSrc(album.coverTrack) : '')
        : p3OnlineCover(album, source, 'album')
      return h('button', {
        key: local ? album.key : album.id,
        type: 'button',
        className: 'mpv3-card mpv3-hcard',
        onClick: function () {
          if (local) p3PushCollection(p3LocalAlbumDescriptor(album))
          else p3PushCollection(p3OnlineAlbumDescriptor(source, album))
        },
      },
        h('span', { className: 'mpv3-card-cover' },
          cover ? h('img', { src: cover, alt: '' }) : h('span', { className: 'mpv3-hcard-fallback' }, icon('disc', 22)),
        ),
        h('span', { className: 'mpv3-card-title' }, name),
        h('span', { className: 'mpv3-card-sub' }, subtitle),
      )
    }),
  ) : null

  var songRows = tracks.map(function (track, index) {
    return h(P3Row, { key: track.path, track: track, index: index, list: tracks, currentPath: props.currentPath, playing: props.playing, favoriteSet: props.favoriteSet, selected: false, tabIndex: -1 })
  })

  return h('div', { className: 'mpv3-scroll' },
    h('div', { className: 'mpv3-scroll-inner is-static' },
      pageHead,
      bestArtist ? h('div', { className: 'mpv3-section' },
        h('div', { className: 'mpv3-section-head' }, h('strong', null, t('v2.artist')), h('span', null, '1')),
        artistRow,
      ) : null,
      albumRow ? h('div', { className: 'mpv3-section' },
        h('div', { className: 'mpv3-section-head' }, h('strong', null, t('v2.albums')), h('span', null, albums.length)),
        albumRow,
      ) : null,
      tracks.length > 0 ? h('div', { className: 'mpv3-section' },
        h('div', { className: 'mpv3-section-head' }, h('strong', null, t('v2.songs')), h('span', null, tracks.length)),
        h('div', { className: 'mpv3-plain-list' }, songRows),
      ) : null,
      !local && tracks.length < (props.online.searchTotal || 0) ? h('div', { className: 'mpv3-more' },
        h(Button, {
          variant: 'ghost',
          disabled: props.online.searchLoadingMore === true,
          onClick: function () { void searchOnline(query, (props.online.searchPage || 1) + 1, true) },
        }, props.online.searchLoadingMore === true ? t('p3.loadingMore') : t('p3.loadMore')),
      ) : null,
    ),
  )
}

function P3PageSwitch(props) {
  var route = props.route
  if (route.page === 'songs') {
    if (route.source === 'local') return h(P3LocalSongsPage, props)
    return h(P3OnlineSongsPage, props)
  }
  if (route.page === 'favorites') return h(P3FavoritesPage, props)
  if (route.page === 'albums') return h(P3AlbumsPage, props)
  if (route.page === 'artists') return h(P3ArtistsPage, props)
  if (route.page === 'folders') return h(P3FoldersPage, props)
  if (route.page === 'playlists') return h(P3PlaylistsPage, props)
  if (route.page === 'stats') return h(P3StatsPage, props)
  if (route.page === 'recent') return h(P3RecentPage, props)
  if (route.page === 'discover') return h(P3DiscoverPage, props)
  if (route.page === 'cloud') return h(P3CloudPage, props)
  if (route.page === 'album') return h(P3AlbumPage, props)
  if (route.page === 'artist') return h(P3ArtistPage, props)
  if (route.page === 'playlist') return h(P3PlaylistPage, props)
  if (route.page === 'search') return h(P3SearchPage, props)
  return h(P3GridPage, { route: route, library: props.library, online: props.online, prefs: props.prefs }, h(P3Empty, { icon: 'search', title: t('p3.pageMissing') }))
}
