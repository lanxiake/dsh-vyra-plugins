/**
 * ui state: source, section, filter, query and the two panel-level toggles.
 *
 * Persisted subset: source / nav / playlistId (localStorage `music.ui.v2`),
 * migrated once from the 0.11 keys `mu.source` and `mu.view`.
 */

var UI_KEY = 'music.ui.v2'
var LEGACY_UI_KEYS = ['mu.source', 'mu.view']

/** Every selectable playback source, in tab order. */
var UI_SOURCES = ['local', 'netease', 'qq', 'kugouLite', 'navidrome']

// Derived from UI_SOURCES so the list only exists once: a second hardcoded copy
// is exactly how `music_control`'s source whitelist drifted and started
// treating navidrome as a local search.
/** Provider metadata comes from /online/providers: displayName + capabilities. */
function providerInfoOf(source) {
  var providers = onlineStore.get().providers || {}
  return providers[source] || {}
}

/**
 * Every source the panel can show: `local` plus whatever the host registered.
 * UI_SOURCES keeps the built-in order; platforms registered outside the legacy
 * factory (Bodian today) are appended from the server response, so adding a
 * platform no longer needs a client change.
 */
function availableSources() {
  var list = ['local']
  for (var i = 0; i < UI_SOURCES.length; i++) {
    if (UI_SOURCES[i] !== 'local') list.push(UI_SOURCES[i])
  }
  var registered = Object.keys(onlineStore.get().providers || {}).sort()
  for (var j = 0; j < registered.length; j++) {
    if (registered[j] !== 'local' && list.indexOf(registered[j]) < 0) list.push(registered[j])
  }
  return list
}

function isOnlineSource(source) {
  if (source === 'local') return false
  return availableSources().indexOf(String(source || '')) >= 0
}

/** Capability check: ask "can this source do X", never "is it navidrome". */
function supports(source, capability) {
  var caps = providerInfoOf(source).capabilities
  if (caps !== undefined && caps !== null && Object.keys(caps).length > 0) {
    return caps[capability] === true
  }
  if (source === 'local') {
    return capability === 'search' || capability === 'playback' || capability === 'lyrics'
  }
  return false
}

function sourceLabelOf(source) {
  if (source === 'netease') return t('online.providerNetease')
  if (source === 'qq') return t('online.providerQq')
  if (source === 'kugouLite') return t('online.providerKugouLite')
  if (source === 'navidrome') return t('online.providerNavidrome')
  if (source === 'qishui') return t('online.providerQishui')
  if (source === 'bodian') return t('online.providerBodian')
  if (source !== 'local') {
    var info = providerInfoOf(source)
    if (info.displayName) return String(info.displayName)
    return String(source)
  }
  return t('page.tabLocal')
}

function rawStorageGet(key, fallback) {
  try {
    var value = window.localStorage.getItem(key)
    return value === null || value === undefined ? fallback : String(value)
  } catch (error) {
    return fallback
  }
}

function readUiState() {
  var saved = storageGet(UI_KEY, null)
  if (saved === null || typeof saved !== 'object') {
    // Migrate the 0.11 keys once so the panel opens where it was left.
    var legacySource = rawStorageGet(LEGACY_UI_KEYS[0], '')
    var legacyView = rawStorageGet(LEGACY_UI_KEYS[1], '')
    var source = UI_SOURCES.indexOf(legacySource) >= 0 ? legacySource : 'local'
    var nav = 'songs'
    if (source !== 'local') nav = 'recent'
    else if (['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'stats'].indexOf(legacyView) >= 0) {
      nav = legacyView
    }
    return { source: source, nav: nav, playlistId: '' }
  }
  var source = UI_SOURCES.indexOf(saved.source) >= 0 || (typeof saved.source === 'string' && saved.source !== '')
    ? saved.source
    : 'local'
  var nav = typeof saved.nav === 'string' && saved.nav !== '' ? saved.nav : 'songs'
  var playlistId = typeof saved.playlistId === 'string' ? saved.playlistId : ''
  if (nav === 'playlists') nav = source === 'local' ? 'songs' : 'recent'
  if (nav === 'playlist' && (source !== 'local' || playlistId === '')) nav = source === 'local' ? 'songs' : 'recent'
  // `artist` is this branch's own view: it needs a provider artist id that only
  // lives in memory, so a reload cannot restore it and would query with an empty
  // id. Fall back to the artist list it was opened from. The album view is left
  // to upstream's handling — reloading there behaves as it did before.
  if (nav === 'artist') nav = source === 'local' ? 'songs' : 'artists'
  if (nav === 'artistSongs') nav = source === 'local' ? 'songs' : 'recent'
  return { source: source, nav: nav, playlistId: playlistId }
}

var uiStore = createStore(
  Object.assign(
    {
      filter: null,
      query: '',
      npOpen: false,
    },
    readUiState(),
  ),
)

function setUi(patch) {
  return uiStore.set(patch)
}

function isLocalNav(nav) {
  return ['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'playlist', 'stats'].indexOf(nav) >= 0
}

/** Section groups for the current source (rail or top bar). */
/** Online playlist ordering is local-only; the platform order is kept as "source". */
function onlinePlaylistSortMode() {
  var mode = prefsStore.get().onlinePlaylistSort
  return mode === 'name' || mode === 'count' ? mode : 'source'
}

function onlinePlaylistSortLabel(mode) {
  if (mode === 'name') return t('v2.sortName')
  if (mode === 'count') return t('v2.sortCount')
  return t('v2.sortSource')
}

function sortOnlinePlaylists(list) {
  var mode = onlinePlaylistSortMode()
  var copy = (list || []).slice()
  if (mode === 'name') {
    copy.sort(function (left, right) {
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh')
    })
  } else if (mode === 'count') {
    copy.sort(function (left, right) {
      var delta = (Number(right.trackCount) || 0) - (Number(left.trackCount) || 0)
      return delta !== 0
        ? delta
        : String(left.name || '').localeCompare(String(right.name || ''), 'zh')
    })
  }
  return copy
}

function cycleOnlinePlaylistSort() {
  var mode = onlinePlaylistSortMode()
  var next = mode === 'source' ? 'name' : mode === 'name' ? 'count' : 'source'
  setPrefs({ onlinePlaylistSort: next })
}

function navGroupsFor(source, favoritesCount) {
  var library = libraryStore.get()
  if (isOnlineSource(source)) {
    var online = onlineStore.get()
    var playlists = sortOnlinePlaylists(online.playlists || [])
    var signedIn = (online.providers[source] || {}).loggedIn === true
    // Navidrome can enumerate a whole library, so it gets the same browse shape
    // as the local library — songs, artists, albums. Artist and album rows open
    // the shared album view, so these are navigation surfaces only. The Chinese
    // platforms are search-only and get none of them.
    var browse =
      source === 'navidrome'
        ? [
            { key: 'songs', label: t('v2.songs'), icon: 'note', count: null },
            { key: 'artists', label: t('v2.artists'), icon: 'user', count: null },
            { key: 'albums', label: t('v2.albums'), icon: 'disc', count: null },
          ]
        : []
    var groups = [
      {
        label: t('v2.sectionOnline'),
        items: browse.concat([
          { key: 'recent', label: t('v2.recent'), icon: 'clock', count: null },
        ]),
      },
    ]
    if (signedIn) {
      groups.push({
        label: t('v2.playlists'),
        showLabel: true,
        action: {
          icon: 'sort',
          title: t('v2.playlistSort') + ': ' + onlinePlaylistSortLabel(onlinePlaylistSortMode()),
          run: cycleOnlinePlaylistSort,
        },
        items: playlists.map(function (playlist) {
          return {
            key: 'online-playlist:' + playlist.id,
            label: playlist.name || '',
            icon: 'list',
            count: playlist.trackCount || 0,
            coverSrc: playlist.cover ? onlineCoverSrc({ coverUrl: playlist.cover }, undefined, 'playlist') : '',
            onlinePlaylist: playlist,
          }
        }),
      })
    }
    return groups
  }
  return [
    {
      label: t('v2.sectionLibrary'),
      items: [
        { key: 'songs', label: t('v2.songs'), icon: 'note', count: library.tracks.length },
        { key: 'albums', label: t('v2.albums'), icon: 'disc', count: null },
        { key: 'artists', label: t('v2.artists'), icon: 'user', count: null },
        { key: 'folders', label: t('v2.folders'), icon: 'folder', count: null },
      ],
    },
    {
      label: t('v2.sectionCollection'),
      items: [
        { key: 'favorites', label: t('v2.favorites'), icon: 'heart', count: favoritesCount },
        { key: 'stats', label: t('v2.stats'), icon: 'chart', count: null },
      ],
    },
    {
      label: t('v2.playlists'),
      showLabel: true,
      action: {
        icon: 'plus',
        title: t('v2.newPlaylist'),
        run: function () {
          pushLayer('newPlaylist')
        },
      },
      items: (library.playlists || []).map(function (playlist) {
        return {
          key: 'local-playlist:' + playlist.id,
          label: playlist.name || '',
          icon: 'list',
          count: (playlist.trackPaths || []).length,
          coverSrc: trackCoverSrc(playlistTracks(playlist)[0] || null),
          localPlaylistId: playlist.id,
          playlist: playlist,
        }
      }),
    },
  ]
}

/** One click path for every nav shape: plain sections, local/online playlists. */
function activateNavItem(item) {
  if (item.localPlaylistId) {
    openLocalPlaylist(item.localPlaylistId)
    return
  }
  if (item.onlinePlaylist) {
    void openOnlinePlaylist(item.onlinePlaylist)
    setNav('playlist')
    return
  }
  setNav(item.key)
}

function activeNavKey(nav) {
  var ui = uiStore.get()
  if (nav === 'playlist') {
    if (isOnlineSource(ui.source)) return 'online-playlist:' + (onlineStore.get().playlistId || '')
    return 'local-playlist:' + (ui.playlistId || '')
  }
  return nav
}

function sectionTitleOf(ui) {
  switch (ui.nav) {
    case 'songs':
      return t('v2.allSongs')
    case 'albums':
      return t('v2.albums')
    case 'artists':
      return t('v2.artists')
    case 'folders':
      return t('v2.folders')
    case 'favorites':
      return t('v2.favorites')
    case 'playlists':
      return t('v2.playlists')
    case 'playlist':
      return (playlistById(ui.playlistId) || {}).name || t('v2.playlists')
    case 'stats':
      return t('v2.stats')
    case 'recent':
      return t('v2.recent')
    case 'album':
      return onlineStore.get().albumName || t('online.album')
    default:
      return t('v2.songs')
  }
}

function setSource(source) {
  var ui = uiStore.get()
  if (ui.source === source) return
  selectionStore.set({ active: false, paths: [] })
  artistLoadToken = (artistLoadToken || 0) + 1
  uiStore.set({
    source: source,
    // Navidrome opens on the library list; the Chinese platforms are
    // search-driven and have nothing to show until the user types.
    nav: !isOnlineSource(source) ? 'songs' : source === 'navidrome' ? 'songs' : 'recent',
    filter: null,
    query: '',
    playlistId: '',
  })
  onlineStore.set({
    provider: isOnlineSource(source) ? source : onlineStore.get().provider,
    playlists: [],
    playlistsPhase: 'idle',
    playlistsProvider: '',
    liked: {},
    playlistId: '',
    playlistName: '',
    playlistSongs: [],
    playlistPhase: 'idle',
    artistName: '',
    artistProvider: '',
    artistFrom: '',
    artistSongs: [],
    artistPhase: 'idle',
    artistError: '',
    query: '',
    results: [],
    searchPage: 1,
    searchTotal: 0,
    searchLoadingMore: false,
    phase: 'idle',
    error: '',
  })
  if (isOnlineSource(source)) void loadProviders()
}

function setNav(nav) {
  selectionStore.set({ active: false, paths: [] })
  uiStore.set({ nav: nav, filter: null, playlistId: nav === 'playlist' ? uiStore.get().playlistId : '' })
}

function openLocalPlaylist(id) {
  selectionStore.set({ active: false, paths: [] })
  uiStore.set({ nav: 'playlist', playlistId: id, filter: null, query: '' })
}

function openOnlineSection(nav) {
  closeOnlinePlaylist()
  uiStore.set({ nav: nav, filter: null })
}

uiStore.subscribe(function (state) {
  // panel-v3 owns the route persistence; keeping the legacy key in sync would
  // recreate the dual-source-of-truth drift the v3 migration removed.
  if (typeof P3_OWNS_ROUTE !== 'undefined' && P3_OWNS_ROUTE === true) return
  storageSet(UI_KEY, {
    source: state.source,
    nav: state.nav,
    playlistId: state.playlistId,
  })
})
