/**
 * panel-v3 navigation: Folia-style browse / search / collection layers.
 *
 * The canonical state is three stores:
 * - browse: which source + library tab is underneath everything
 * - search: the search overlay and its query
 * - collection: { origin, stack } for album/artist/playlist detail pages
 *
 * p3RouteStore is only a derived read projection for the existing page
 * components; navigation actions never write it directly.
 */

var P3_NAV_KEY = 'music.ui.v4'
var P3_LEGACY_UI_KEY = 'music.ui.v3'
var P3_LEGACY_UI_KEY_V2 = 'music.ui.v2'

var p3SearchKindStore = createStore('song')

var p3BrowseStore = createStore({
  source: 'local',
  tab: 'songs',
  filter: null,
  scroll: {},
})

var p3SearchStore = createStore({
  open: false,
  query: '',
  submittedQuery: '',
  source: 'local',
  returnTab: 'songs',
  scroll: 0,
})

var p3CollectionNavStore = createStore({
  snapshot: null,
  scroll: {},
})

/** Top-descriptor payload kept for the existing detail page components. */
var p3Collection = createStore({ album: null, artist: null, playlist: null })

var p3RouteStore = createStore({
  source: 'local',
  page: 'songs',
  param: null,
  filter: null,
  query: '',
})

function p3NavDefaultTab(source) {
  return source === 'local' || source === 'navidrome' ? 'songs' : 'recent'
}

function p3NavIsTab(page) {
  return ['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'stats', 'recent'].indexOf(page) >= 0
}

function p3CollectionKey(item) {
  if (!item) return ''
  return [item.source || 'local', item.provider || '', item.type || '', item.id || item.param || ''].join(':')
}

function p3ProjectedRoute() {
  var browse = p3BrowseStore.get()
  var search = p3SearchStore.get()
  var snapshot = p3CollectionNavStore.get().snapshot
  var route = {
    source: browse.source,
    page: browse.tab,
    param: null,
    filter: browse.filter || null,
    query: '',
  }
  if (snapshot && snapshot.stack.length > 0) {
    var top = snapshot.stack[snapshot.stack.length - 1]
    route.source = top.source === 'local' ? 'local' : (top.provider || browse.source)
    route.page = top.type
    route.param = top.param || top.id || null
    route.filter = null
    route.query = ''
    return route
  }
  if (search.open) {
    route.source = search.source || browse.source
    route.page = 'search'
    route.param = null
    route.filter = null
    route.query = search.query || ''
  }
  return route
}

function p3SyncCollectionPayload() {
  var snapshot = p3CollectionNavStore.get().snapshot
  var top = snapshot && snapshot.stack.length > 0 ? snapshot.stack[snapshot.stack.length - 1] : null
  p3Collection.set({
    album: top && top.type === 'album' ? top : null,
    artist: top && top.type === 'artist' ? top : null,
    playlist: top && top.type === 'playlist' ? top : null,
  })
}

function p3SyncRoute() {
  p3RouteStore.set(p3ProjectedRoute())
  p3SyncCollectionPayload()
}

function p3NavScrollTop() {
  var el = document.querySelector('.mpv3-scroll')
  return el ? el.scrollTop : 0
}

function p3NavScrollTo(top) {
  var el = document.querySelector('.mpv3-scroll')
  if (el) el.scrollTop = top || 0
}

function p3NavScrollKey() {
  var snapshot = p3CollectionNavStore.get().snapshot
  if (snapshot && snapshot.stack.length > 0) {
    return 'collection:' + p3CollectionKey(snapshot.stack[snapshot.stack.length - 1])
  }
  if (p3SearchStore.get().open) return 'search'
  return 'browse:' + p3BrowseStore.get().tab
}

function p3NavSaveScroll() {
  var top = p3NavScrollTop()
  var key = p3NavScrollKey()
  var snapshot = p3CollectionNavStore.get().snapshot
  if (snapshot && snapshot.stack.length > 0) {
    var scroll = Object.assign({}, p3CollectionNavStore.get().scroll)
    scroll[key] = top
    p3CollectionNavStore.set({ scroll: scroll })
    return
  }
  if (p3SearchStore.get().open) {
    p3SearchStore.set({ scroll: top })
    return
  }
  var browse = p3BrowseStore.get()
  var next = Object.assign({}, browse.scroll)
  next[browse.tab] = top
  p3BrowseStore.set({ scroll: next })
}

function p3NavRestoreScroll() {
  var key = p3NavScrollKey()
  var top = 0
  var snapshot = p3CollectionNavStore.get().snapshot
  if (snapshot && snapshot.stack.length > 0) top = p3CollectionNavStore.get().scroll[key] || 0
  else if (p3SearchStore.get().open) top = p3SearchStore.get().scroll || 0
  else top = p3BrowseStore.get().scroll[p3BrowseStore.get().tab] || 0
  window.requestAnimationFrame(function () { p3NavScrollTo(top) })
}

function p3SerializeCollection(snapshot) {
  if (!snapshot || snapshot.stack.length === 0) return null
  return {
    origin: snapshot.origin,
    stack: snapshot.stack.map(function (item) {
      return {
        key: p3CollectionKey(item),
        type: item.type,
        source: item.source,
        provider: item.provider || '',
        onlineProvider: item.onlineProvider || item.provider || '',
        id: item.id || '',
        param: item.param || item.id || '',
        name: item.name || '',
        artist: item.artist || '',
        album: item.album || item.name || '',
        albumId: item.albumId || item.id || '',
        artistId: item.artistId || '',
        coverUrl: item.coverUrl || '',
        coverArtId: item.coverArtId || '',
        trackCount: Number(item.trackCount) || 0,
        year: Number(item.year) || 0,
      }
    }),
  }
}

function p3SaveNav() {
  var snapshot = p3CollectionNavStore.get().snapshot
  storageSet(P3_NAV_KEY, {
    v: 4,
    browse: {
      source: p3BrowseStore.get().source,
      tab: p3BrowseStore.get().tab,
    },
    search: {
      open: p3SearchStore.get().open === true,
      query: p3SearchStore.get().query || '',
      submittedQuery: p3SearchStore.get().submittedQuery || '',
      source: p3SearchStore.get().source || p3BrowseStore.get().source,
      kind: p3SearchKindStore.get() || 'song',
      returnTab: p3SearchStore.get().returnTab || p3BrowseStore.get().tab,
    },
    collection: p3SerializeCollection(snapshot),
  })
}

function p3SyncNav(options) {
  p3SyncRoute()
  p3SaveNav()
  if (!options || options.scroll !== false) p3NavRestoreScroll()
}

function p3ReadStoredNav() {
  var saved = storageGet(P3_NAV_KEY, null)
  if (saved && typeof saved === 'object' && saved.v === 4) {
    var browse = saved.browse && typeof saved.browse === 'object' ? saved.browse : {}
    var search = saved.search && typeof saved.search === 'object' ? saved.search : {}
    var source = typeof browse.source === 'string' && browse.source !== '' ? browse.source : 'local'
    var tab = typeof browse.tab === 'string' && p3NavIsTab(browse.tab) ? browse.tab : p3NavDefaultTab(source)
    // Online sources now open on playlists; an old saved "recent" becomes the new default.
    if (source !== 'local' && tab === 'recent') tab = 'playlists'
    var searchSource = typeof search.source === 'string' && search.source !== '' ? search.source : source
    return {
      browse: { source: source, tab: tab, filter: null, scroll: {} },
      search: {
        open: search.open === true,
        query: typeof search.query === 'string' ? search.query : '',
        submittedQuery: typeof search.submittedQuery === 'string' ? search.submittedQuery : '',
        source: searchSource,
        returnTab: typeof search.returnTab === 'string' && p3NavIsTab(search.returnTab) ? search.returnTab : tab,
        scroll: 0,
      },
      kind: typeof search.kind === 'string' ? search.kind : 'song',
      collection: saved.collection && saved.collection.stack && saved.collection.stack.length > 0
        ? {
            origin: saved.collection.origin === 'search' ? 'search' : 'browse',
            stack: saved.collection.stack.filter(function (item) {
              return item && typeof item.type === 'string' && ['album', 'artist', 'playlist'].indexOf(item.type) >= 0
            }),
          }
        : null,
    }
  }

  var legacy = storageGet(P3_LEGACY_UI_KEY, null)
  if (legacy && typeof legacy === 'object') {
    var oldSource = typeof legacy.source === 'string' && legacy.source !== '' ? legacy.source : 'local'
    var oldPage = typeof legacy.page === 'string' ? legacy.page : 'songs'
    var oldParam = legacy.param === undefined || legacy.param === null ? '' : String(legacy.param)
    var oldTab = p3NavIsTab(oldPage) ? oldPage : p3NavDefaultTab(oldSource)
    if (oldSource !== 'local' && oldTab === 'recent') oldTab = 'playlists'
    var oldCollection = null
    if (oldPage === 'album' || oldPage === 'artist' || oldPage === 'playlist') {
      oldTab = oldPage === 'album' ? 'albums' : oldPage === 'artist' ? 'artists' : 'playlists'
      oldCollection = {
        origin: 'browse',
        stack: [p3LegacyCollectionDescriptor(oldPage, oldSource, oldParam)],
      }
    }
    return {
      browse: { source: oldSource, tab: oldTab, filter: null, scroll: {} },
      search: {
        open: false,
        query: '',
        submittedQuery: '',
        source: oldSource,
        returnTab: oldTab,
        scroll: 0,
      },
      kind: 'song',
      collection: oldCollection,
    }
  }

  var v2 = storageGet(P3_LEGACY_UI_KEY_V2, null)
  if (v2 && typeof v2 === 'object') {
    var v2Source = typeof v2.source === 'string' && v2.source !== '' ? v2.source : 'local'
    var v2Nav = typeof v2.nav === 'string' ? v2.nav : p3NavDefaultTab(v2Source)
    var v2Playlist = typeof v2.playlistId === 'string' ? v2.playlistId : ''
    var v2Collection = null
    if (v2Nav === 'playlist' && v2Playlist !== '') {
      v2Collection = { origin: 'browse', stack: [p3LegacyCollectionDescriptor('playlist', v2Source, v2Playlist)] }
      v2Nav = 'playlists'
    }
    if (!p3NavIsTab(v2Nav)) v2Nav = p3NavDefaultTab(v2Source)
    if (v2Source !== 'local' && v2Nav === 'recent') v2Nav = 'playlists'
    return {
      browse: { source: v2Source, tab: v2Nav, filter: null, scroll: {} },
      search: {
        open: false,
        query: '',
        submittedQuery: '',
        source: v2Source,
        returnTab: v2Nav,
        scroll: 0,
      },
      kind: 'song',
      collection: v2Collection,
    }
  }

  return {
    browse: { source: 'local', tab: 'songs', filter: null, scroll: {} },
    search: { open: false, query: '', submittedQuery: '', source: 'local', returnTab: 'songs', scroll: 0 },
    kind: 'song',
    collection: null,
  }
}

function p3LegacyCollectionDescriptor(type, source, param) {
  if (type === 'album') {
    if (source === 'local') {
      return { type: 'album', source: 'local', id: param, param: param, name: '', artist: '', album: '' }
    }
    var at = param.indexOf(':')
    var provider = at >= 0 ? param.slice(0, at) : source
    var albumId = at >= 0 ? param.slice(at + 1) : param
    return { type: 'album', source: 'online', provider: provider, id: albumId, param: provider + ':' + albumId, albumId: albumId, name: '', album: '', artist: '' }
  }
  if (type === 'artist') {
    if (source === 'local') {
      return { type: 'artist', source: 'local', id: param, param: param, name: param, artist: param }
    }
    var artistAt = param.indexOf(':')
    var artistProvider = artistAt >= 0 ? param.slice(0, artistAt) : source
    var artistName = artistAt >= 0 ? param.slice(artistAt + 1) : param
    return { type: 'artist', source: 'online', provider: artistProvider, id: artistName, param: artistProvider + ':' + artistName, name: artistName, artist: artistName }
  }
  return { type: 'playlist', source: source === 'local' ? 'local' : 'online', provider: source === 'local' ? '' : source, id: param, param: param, name: '' }
}

function p3InitNav() {
  var nav = p3ReadStoredNav()
  if (nav.search.open && String(nav.search.query || '').trim() === '') nav.search.open = false
  p3BrowseStore.set(nav.browse)
  p3SearchStore.set(nav.search)
  p3SearchKindStore.set(nav.kind)
  p3CollectionNavStore.set({ snapshot: nav.collection, scroll: {} })
  p3SyncRoute()
}

function p3CanGoBack() {
  return Boolean(p3CollectionNavStore.get().snapshot) || p3SearchStore.get().open === true
}

function p3OpenSearch() {
  var browse = p3BrowseStore.get()
  var search = p3SearchStore.get()
  if (search.open) return
  if (p3CollectionNavStore.get().snapshot) {
    p3CollectionNavStore.set({ snapshot: null, scroll: {} })
  }
  p3SearchStore.set({
    open: true,
    source: browse.source,
    returnTab: browse.tab,
  })
  p3SyncNav()
}

function p3CloseSearch() {
  if (!p3SearchStore.get().open) return
  if (p3CollectionNavStore.get().snapshot) return
  p3NavSaveScroll()
  p3SearchStore.set({ open: false })
  p3SyncNav()
}

function p3SetSearchQuery(value) {
  var text = String(value === undefined || value === null ? '' : value)
  if (p3CollectionNavStore.get().snapshot) {
    p3CollectionNavStore.set({ snapshot: null, scroll: {} })
  }
  var search = p3SearchStore.get()
  if (text === '') {
    // Deleting the whole query exits search instead of leaving a blank overlay
    // that hides the small back control.
    if (search.open) {
      p3SearchStore.set({ query: '', submittedQuery: '' })
      p3CloseSearch()
    }
    return
  }
  if (!search.open) {
    p3OpenSearch()
    search = p3SearchStore.get()
  }
  p3SearchStore.set({ query: text, submittedQuery: text, source: p3BrowseStore.get().source })
  p3SyncNav({ scroll: false })
}

function p3SetSearchKind(kind) {
  p3SearchKindStore.set(kind)
  p3SaveNav()
}

function p3SetBrowseFilter(filter) {
  p3NavSaveScroll()
  p3BrowseStore.set({ filter: filter || null })
  p3SyncNav()
}

function p3SelectBrowseTab(tab, options) {
  options = options || {}
  p3NavSaveScroll()
  p3CollectionNavStore.set({ snapshot: null, scroll: {} })
  p3SearchStore.set({ open: false })
  p3BrowseStore.set({
    tab: tab,
    filter: options.filter === undefined ? null : options.filter,
  })
  p3SyncNav()
}

function p3OpenCollection(item, origin) {
  if (!item) return
  var snapshot = p3CollectionNavStore.get().snapshot
  if (!snapshot || snapshot.stack.length === 0) {
    p3CollectionNavStore.set({
      snapshot: { origin: origin === 'search' || p3SearchStore.get().open ? 'search' : 'browse', stack: [item] },
      scroll: {},
    })
    p3SyncNav()
    return
  }
  var top = snapshot.stack[snapshot.stack.length - 1]
  if (p3CollectionKey(top) === p3CollectionKey(item)) return
  var previous = snapshot.stack.length >= 2 ? snapshot.stack[snapshot.stack.length - 2] : null
  if (previous && p3CollectionKey(previous) === p3CollectionKey(item)) {
    p3PopCollection()
    return
  }
  p3NavSaveScroll()
  p3CollectionNavStore.set({
    snapshot: { origin: snapshot.origin, stack: snapshot.stack.concat([item]) },
    scroll: p3CollectionNavStore.get().scroll,
  })
  p3SyncNav()
}

function p3PushCollection(item) {
  p3OpenCollection(item, p3SearchStore.get().open ? 'search' : 'browse')
}

function p3PopCollection() {
  var snapshot = p3CollectionNavStore.get().snapshot
  if (!snapshot || snapshot.stack.length === 0) return false
  p3NavSaveScroll()
  var stack = snapshot.stack.slice(0, -1)
  p3CollectionNavStore.set({
    snapshot: stack.length > 0 ? { origin: snapshot.origin, stack: stack } : null,
    scroll: p3CollectionNavStore.get().scroll,
  })
  p3SyncNav()
  return true
}

function p3GoBack() {
  if (p3CollectionNavStore.get().snapshot) {
    p3PopCollection()
    return
  }
  if (p3SearchStore.get().open) {
    p3CloseSearch()
  }
}

function p3SwitchSource(source) {
  var browse = p3BrowseStore.get()
  var search = p3SearchStore.get()
  var snapshot = p3CollectionNavStore.get().snapshot
  if (browse.source === source && !snapshot && !search.open) return
  p3NavSaveScroll()
  p3CollectionNavStore.set({ snapshot: null, scroll: {} })
  var defaultTab = typeof p3DefaultPage === 'function' ? p3DefaultPage(source) : p3NavDefaultTab(source)
  p3BrowseStore.set({ source: source, tab: defaultTab, filter: null, scroll: {} })
  if (search.open) {
    p3SearchStore.set({ source: source, query: '', submittedQuery: '', returnTab: defaultTab, scroll: 0 })
  }
  p3SyncNav()
}

p3InitNav()
