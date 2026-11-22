/**
 * online: NetEase / QQ / KuGou state.
 *
 * Only the client half lives here: the Host performs every provider request.
 */

var ONLINE_HISTORY_KEY = 'mu.onlineHistory'
var ONLINE_HISTORY_MAX = 50

function readOnlineHistory() {
  var list = storageGet(ONLINE_HISTORY_KEY, [])
  return Array.isArray(list) ? list : []
}

function writeOnlineHistory(list) {
  storageSet(ONLINE_HISTORY_KEY, list.slice(0, ONLINE_HISTORY_MAX))
}

function onlineHistoryOfProvider(provider) {
  return onlineStore.get().history.filter(function (item) {
    return item.provider === provider
  })
}

var onlineStore = createStore({
  provider: 'netease',
  phase: 'idle', // idle | searching | ready | error
  query: '',
  results: [],
  searchPage: 1,
  searchTotal: 0,
  searchLoadingMore: false,
  error: '',
  playlistsPhase: 'idle',
  playlistsProvider: '',
  playlistsRefreshing: false,
  playlists: [],
  authExpired: '',
  playlistId: '',
  playlistName: '',
  playlistSongs: [],
  playlistTrackCount: 0,
  playlistHasMore: false,
  playlistNextOffset: 0,
  playlistLoadingMore: false,
  playlistPageError: '',
  playlistPhase: 'idle',
  playlistRefreshing: false,
  albumId: '',
  albumName: '',
  albumArtist: '',
  albumCover: '',
  albumProvider: '',
  albumSongs: [],
  albumPhase: 'idle',
  albumError: '',
  artistName: '',
  artistProvider: '',
  artistFrom: '',
  artistId: '',
  artistSongs: [],
  artistPhase: 'idle',
  artistError: '',
  history: readOnlineHistory(),
  liked: {},
  providers: {},
  providersPhase: 'idle',
})

var onlineSearchToken = 0
var playlistLoadToken = 0
var playlistCache = new Map()
var playlistInflight = new Map()
var PLAYLIST_CACHE_TTL = 60 * 1000
var searchCache = new Map()
var SEARCH_CACHE_TTL = 5 * 60 * 1000
var SEARCH_CACHE_LIMIT = 40

async function searchOnline(text, page, append) {
  var query = String(text || '').trim()
  if (query === '') return
  var targetPage = Math.max(1, Number(page) || 1)
  var more = append === true && targetPage > 1
  var state = onlineStore.get()
  var provider = state.provider
  var token = (onlineSearchToken += 1)
  var cacheKey = provider + '|' + query
  if (!more) {
    var cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL) {
      onlineStore.set({
        phase: 'ready',
        query: query,
        results: cached.results,
        searchPage: 1,
        searchTotal: cached.total,
        searchLoadingMore: false,
        error: '',
      })
      return
    }
  }
  if (more) {
    onlineStore.set({ searchLoadingMore: true })
  } else {
    onlineStore.set({
      phase: 'searching',
      query: query,
      error: '',
      results: [],
      searchPage: 1,
      searchTotal: 0,
      searchLoadingMore: false,
    })
  }
  try {
    var body = await getJson(
      API +
        'online/search?provider=' +
        encodeURIComponent(provider) +
        '&q=' +
        encodeURIComponent(query) +
        '&page=' +
        String(targetPage),
    )
    if (token !== onlineSearchToken) return
    var incoming = Array.isArray(body.results) ? body.results : []
    var results = more ? (onlineStore.get().results || []).slice() : []
    incoming.forEach(function (item) {
      var path = 'online:' + provider + ':' + item.id
      if (!results.some(function (existing) { return 'online:' + provider + ':' + existing.id === path })) {
        results.push(item)
      }
    })
    onlineStore.set({
      phase: 'ready',
      results: results,
      searchPage: Number(body.page) || targetPage,
      searchTotal: Number(body.total) || results.length,
      searchLoadingMore: false,
    })
    if (!more) {
      if (searchCache.size >= SEARCH_CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value)
      searchCache.set(cacheKey, { at: Date.now(), results: results.slice(), total: Number(body.total) || results.length })
    }
  } catch (error) {
    if (token !== onlineSearchToken) return
    if (more) {
      onlineStore.set({ searchLoadingMore: false })
      showToast(errorText(error))
    } else {
      onlineStore.set({ phase: 'error', error: errorText(error) })
    }
  }
}

function isAuthError(message) {
  return /20017|登录态|重新扫码|未登录|登录.*(失效|过期)|session|cookie|token|鉴权|401|403/i.test(
    String(message || ''),
  )
}

function mergePlaylists(previous, incoming) {
  var next = new Map()
  ;(incoming || []).forEach(function (item) {
    if (item && item.id !== undefined) next.set(String(item.id), item)
  })
  var merged = []
  ;(previous || []).forEach(function (item) {
    var fresh = next.get(String(item.id))
    if (fresh) {
      merged.push(Object.assign({}, item, fresh))
      next.delete(String(item.id))
    }
  })
  next.forEach(function (item) {
    merged.push(item)
  })
  return merged
}

async function loadMyPlaylists(provider) {
  var target = provider || onlineStore.get().provider
  var token = (playlistLoadToken += 1)
  var snapshot = onlineStore.get()
  var keep = snapshot.playlistsProvider === target && (snapshot.playlists || []).length > 0
  onlineStore.set(
    keep
      ? { playlistsPhase: 'ready', playlistsRefreshing: true, playlistsProvider: target, error: '' }
      : { playlistsPhase: 'loading', playlistsRefreshing: false, playlistsProvider: target, playlists: [] },
  )
  try {
    var body = await getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(target))
    if (token !== playlistLoadToken) return
    var incoming = Array.isArray(body.playlists) ? body.playlists : []
    var current = onlineStore.get()
    onlineStore.set({
      playlistsPhase: 'ready',
      playlistsRefreshing: false,
      playlistsProvider: target,
      playlists: keep ? mergePlaylists(current.playlists, incoming) : incoming,
      error: '',
      authExpired: '',
    })
  } catch (error) {
    if (token !== playlistLoadToken) return
    var state = onlineStore.get()
    if (state.playlistsProvider === target && (state.playlists || []).length > 0) {
      // Stale-while-revalidate: keep the last good list visible.
      var message = errorText(error)
      onlineStore.set({
        playlistsPhase: 'ready',
        playlistsRefreshing: false,
        error: message,
        authExpired: isAuthError(message) ? target : '',
      })
    } else {
      onlineStore.set({
        playlistsPhase: 'error',
        playlistsRefreshing: false,
        playlistsProvider: target,
        playlists: [],
        error: errorText(error),
        authExpired: isAuthError(errorText(error)) ? target : '',
      })
    }
  }
}

/** Re-read the likes playlist after a cloud like/unlike from any surface. */
function refreshLikedPlaylist(delta) {
  var state = onlineStore.get()
  var liked = (state.playlists || []).find(function (item) {
    return item.isLike === true
  }) || (state.playlists || []).find(function (item) {
    return item.kind === 'default' || item.isDefault === true
  })
  if (liked) {
    var count = Math.max(0, (Number(liked.trackCount) || 0) + (Number(delta) || 0))
    var playlists = (state.playlists || []).map(function (item) {
      return String(item.id) === String(liked.id) ? Object.assign({}, item, { trackCount: count }) : item
    })
    onlineStore.set({ playlists: playlists, playlistsRefreshing: true })
    if (String(state.playlistId) === String(liked.id)) void openOnlinePlaylist(Object.assign({}, liked, { trackCount: count }), true)
  }
  void loadMyPlaylists(state.provider)
}

function resetOnlineAccountData() {
  playlistLoadToken += 1
  onlineSearchToken += 1
  artistLoadToken += 1
  playlistCache.clear()
  playlistInflight.clear()
  onlineStore.set({
    playlistsPhase: 'idle',
    playlistsRefreshing: false,
    playlistsProvider: '',
    playlists: [],
    playlistId: '',
    playlistName: '',
    playlistSongs: [],
    playlistTrackCount: 0,
    playlistHasMore: false,
    playlistNextOffset: 0,
    playlistLoadingMore: false,
    playlistPageError: '',
    playlistPhase: 'idle',
    playlistRefreshing: false,
    albumId: '',
    albumName: '',
    albumArtist: '',
    albumCover: '',
    albumProvider: '',
    albumSongs: [],
    albumPhase: 'idle',
    albumError: '',
    artistName: '',
    artistProvider: '',
    artistFrom: '',
    artistSongs: [],
    artistPhase: 'idle',
    artistError: '',
    liked: {},
    error: '',
    authExpired: '',
  })
}

function playlistCacheKey(provider, id) {
  return String(provider || '') + ':' + String(id || '')
}

var albumLoadToken = 0
var artistLoadToken = 0

async function openOnlineAlbum(track) {
  if (!track || !track.album) return
  var provider = track.onlineProvider || onlineStore.get().provider
  // Providers without the albums capability have no album endpoint (Qishui's car API has
  // none); say so instead of opening a page that can only fail. Unknown capabilities
  // (providers not loaded yet, tests) do not block: the request decides then.
  var knownProvider = (onlineStore.get().providers || {})[provider]
  var caps = knownProvider && knownProvider.capabilities
  if (caps && caps.albums !== true) {
    showToast(t('online.albumUnsupported'))
    return
  }
  var token = (albumLoadToken += 1)
  onlineStore.set({
    albumId: String(track.albumId || ''),
    albumName: String(track.album || ''),
    albumArtist: String(track.artist || ''),
    albumCover: String(track.coverUrl || ''),
    albumProvider: provider,
    albumSongs: [],
    albumPhase: 'loading',
    albumError: '',
    // A search is sticky: the online views render the result list while a
    // query is active, and that check runs before every section branch. So a
    // row clicked under a search result would leave the panel on the search
    // list — the album view never gets a chance to render. Ending the search
    // here is what makes the click land, and it matches what opening an artist
    // already does.
    query: '',
    phase: 'idle',
    error: '',
  })
  setNav('album')
  try {
    var body = await getJson(
      API +
        'online/album?provider=' +
        encodeURIComponent(provider) +
        '&id=' +
        encodeURIComponent(track.albumId || '') +
        '&album=' +
        encodeURIComponent(track.album || '') +
        '&artist=' +
        encodeURIComponent(track.artist || ''),
    )
    if (token !== albumLoadToken) return
    onlineStore.set({
      albumName: body.name || track.album || '',
      albumArtist: body.artist || track.artist || '',
      albumCover: body.cover || track.coverUrl || '',
      albumSongs: Array.isArray(body.songs) ? body.songs : [],
      albumPhase: 'ready',
    })
  } catch (error) {
    if (token !== albumLoadToken) return
    onlineStore.set({
      albumSongs: [],
      albumPhase: 'error',
      albumError: errorText(error),
    })
  }
}

function closeOnlineAlbum() {
  albumLoadToken += 1
  onlineStore.set({
    albumId: '',
    albumName: '',
    albumArtist: '',
    albumCover: '',
    albumProvider: '',
    albumSongs: [],
    albumPhase: 'idle',
    albumError: '',
  })
}

/**
 * The artist a track points at: the id already carried by the row when there is
 * one, so the page can open on the provider's own artist endpoint.
 */
function onlineArtistTarget(track, artistOverride) {
  var names = trackArtistNames(track)
  var artist = String(artistOverride || (names.length > 0 ? names[0] : (track && track.artist)) || '').trim()
  if (artist === '') return null
  var provider = (track && track.onlineProvider) || onlineStore.get().provider
  var artistId = ''
  var detail = Array.isArray(track && track.artistsDetail) ? track.artistsDetail : []
  for (var detailIndex = 0; detailIndex < detail.length; detailIndex += 1) {
    var entry = detail[detailIndex] || {}
    if (String(entry.name || '').trim() === artist && entry.id) {
      artistId = String(entry.id)
      break
    }
  }
  if (artistId === '' && detail.length === 1 && detail[0] && detail[0].id) artistId = String(detail[0].id)
  return { artist: artist, provider: provider, artistId: artistId }
}

async function openOnlineArtist(track, artistOverride) {
  var names = trackArtistNames(track)
  var artist = String(artistOverride || (names.length > 0 ? names[0] : (track && track.artist)) || '').trim()
  if (artist === '') return
  var provider = (track && track.onlineProvider) || onlineStore.get().provider
  // Folia opens the artist page with the id the song already carries; a name-only
  // visit falls back to the Host resolving one.
  var artistId = ''
  var detail = Array.isArray(track && track.artistsDetail) ? track.artistsDetail : []
  for (var detailIndex = 0; detailIndex < detail.length; detailIndex += 1) {
    var entry = detail[detailIndex] || {}
    if (String(entry.name || '').trim() === artist && entry.id) {
      artistId = String(entry.id)
      break
    }
  }
  if (artistId === '' && detail.length === 1 && detail[0] && detail[0].id) artistId = String(detail[0].id)
  var state = onlineStore.get()
  // Folia keeps the artist resource in memory per key: going back to the same artist
  // in one session shows the list instead of fetching it again.
  if (
    String(state.artistProvider || '') === provider &&
    String(state.artistName || '') === artist &&
    Array.isArray(state.artistSongs) &&
    state.artistSongs.length > 0
  ) {
    setNav('artistSongs')
    return
  }
  var from = uiStore.get().nav
  var token = (artistLoadToken += 1)
  onlineStore.set({
    artistName: artist,
    artistProvider: provider,
    artistFrom: from,
    artistId: artistId,
    artistSongs: [],
    artistPhase: 'loading',
    artistError: '',
    query: '',
    phase: 'idle',
    error: '',
  })
  setNav('artistSongs')
  var base =
    API +
    'online/artist-songs?provider=' +
    encodeURIComponent(provider) +
    '&artist=' +
    encodeURIComponent(artist) +
    (artistId !== '' ? '&artistId=' + encodeURIComponent(artistId) : '')
  try {
    // Folia's artist page opens with ARTIST_TOP_SONG_LIMIT (10) songs: one small
    // request, first paint at once. The rest of the list fills in behind it.
    var head = await getJson(base + '&limit=10')
    if (token !== artistLoadToken) return
    var songs = Array.isArray(head.songs) ? head.songs : []
    onlineStore.set({ artistSongs: songs, artistPhase: 'ready' })
    // Only NetEase pages this endpoint today; the other providers answer the whole
    // list on the first request already.
    if (provider !== 'netease' || songs.length < 10) return
    var rest = await getJson(base + '&limit=200&offset=10')
    if (token !== artistLoadToken) return
    var more = Array.isArray(rest.songs) ? rest.songs : []
    if (more.length === 0) return
    var seen = {}
    songs.forEach(function (item) {
      seen[String(item.id)] = true
    })
    var merged = songs.concat(
      more.filter(function (item) {
        return seen[String(item.id)] !== true
      }),
    )
    onlineStore.set({ artistSongs: merged })
  } catch (error) {
    if (token !== artistLoadToken) return
    onlineStore.set({ artistSongs: [], artistPhase: 'error', artistError: errorText(error) })
  }
}

function closeOnlineArtist() {
  artistLoadToken += 1
  onlineStore.set({
    artistName: '',
    artistProvider: '',
    artistFrom: '',
    artistSongs: [],
    artistPhase: 'idle',
    artistError: '',
  })
}

function trimPlaylistCache() {
  if (playlistCache.size <= 24) return
  var old = []
  playlistCache.forEach(function (value, key) {
    old.push({ key: key, at: value.at || 0 })
  })
  old
    .sort(function (left, right) {
      return left.at - right.at
    })
    .slice(0, playlistCache.size - 24)
    .forEach(function (row) {
      playlistCache.delete(row.key)
    })
}

var PLAYLIST_PAGE_SIZE = 100
/** A page that never lands must not leave the page on skeletons for good (Host is bounded too). */
var PLAYLIST_REQUEST_TIMEOUT_MS = 20000

function playlistPageOf(hit, offset) {
  if (!hit || !hit.pages) return null
  return hit.pages[String(offset)] || null
}

/**
 * One page from the Host. The cache stores pages, never a synthetic full list;
 * a playlist of 10k tracks must not allocate 10k rows to paint the first screen.
 */
function fetchPlaylistPage(provider, id, offset, force) {
  var key = playlistCacheKey(provider, id)
  var inflightKey = key + '|' + String(offset)
  if (!force && playlistInflight.has(inflightKey)) return playlistInflight.get(inflightKey)
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  var timer =
    controller === null
      ? null
      : setTimeout(function () {
          controller.abort()
        }, PLAYLIST_REQUEST_TIMEOUT_MS)
  var request = getJson(
    API +
      'online/playlist-songs?provider=' +
      encodeURIComponent(provider) +
      '&id=' +
      encodeURIComponent(id) +
      '&limit=' +
      String(PLAYLIST_PAGE_SIZE) +
      '&offset=' +
      String(offset),
    controller === null ? undefined : { signal: controller.signal },
  )
    .catch(function (error) {
      // An aborted page becomes a visible error with its retry, not an endless skeleton.
      if (error && error.name === 'AbortError') throw new Error(t('p3.requestTimeout'))
      throw error
    })
    .then(function (body) {
      var songs = Array.isArray(body.songs) ? body.songs : []
      var page = {
        songs: songs,
        name: body.name || '',
        cover: body.cover || '',
        trackCount: Number(body.trackCount) || 0,
        hasMore: body.hasMore === true,
        nextOffset: Number(body.nextOffset) || offset + songs.length,
      }
      var hit = playlistCache.get(key) || { pages: {}, at: 0 }
      hit.pages = hit.pages || {}
      hit.pages[String(offset)] = page
      hit.name = page.name || hit.name || ''
      hit.cover = page.cover || hit.cover || ''
      hit.trackCount = page.trackCount || hit.trackCount || 0
      hit.at = Date.now()
      playlistCache.set(key, hit)
      trimPlaylistCache()
      return page
    })
    .finally(function () {
      if (timer !== null) clearTimeout(timer)
      if (playlistInflight.get(inflightKey) === request) playlistInflight.delete(inflightKey)
    })
  playlistInflight.set(inflightKey, request)
  return request
}

/** Warm the first page when the pointer/focus reaches a playlist nav item. */
function prefetchOnlinePlaylist(playlist) {
  if (!playlist || !playlist.id) return
  var provider = onlineStore.get().provider
  var key = playlistCacheKey(provider, playlist.id)
  var hit = playlistCache.get(key)
  if (hit && playlistPageOf(hit, 0) && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL) return
  void fetchPlaylistPage(provider, playlist.id, 0, false).catch(function () {
    // Prefetch is best effort.
  })
}

async function openOnlinePlaylist(playlist, force) {
  if (!playlist || !playlist.id) return
  var provider = onlineStore.get().provider
  var key = playlistCacheKey(provider, playlist.id)
  if (force === true) playlistCache.delete(key)
  var hit = playlistCache.get(key)
  var first = playlistPageOf(hit, 0)
  var fresh = Boolean(first && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL)
  onlineStore.set({
    playlistId: playlist.id,
    playlistName: (first && first.name) || playlist.name || (hit && hit.name) || '',
    playlistPhase: first ? 'ready' : 'loading',
    playlistSongs: first ? first.songs : (hit && Array.isArray(hit.songs) ? hit.songs : []),
    playlistTrackCount: (hit && hit.trackCount) || (playlist && playlist.trackCount) || 0,
    playlistHasMore: first ? first.hasMore === true : false,
    playlistNextOffset: first ? first.nextOffset : 0,
    playlistLoadingMore: false,
    playlistPageError: '',
    playlistRefreshing: false,
  })
  if (fresh && force !== true) return
  if (hit) onlineStore.set({ playlistRefreshing: true })
  try {
    var page = await fetchPlaylistPage(provider, playlist.id, 0, force === true)
    var state = onlineStore.get()
    if (String(state.playlistId) !== String(playlist.id) || state.provider !== provider) return
    onlineStore.set({
      playlistPhase: 'ready',
      playlistRefreshing: false,
      playlistName: page.name || playlist.name || '',
      playlistSongs: page.songs,
      playlistTrackCount: page.trackCount || (playlist && playlist.trackCount) || 0,
      playlistHasMore: page.hasMore === true,
      playlistNextOffset: page.nextOffset,
      playlistLoadingMore: false,
      playlistPageError: '',
      error: '',
    })
  } catch (error) {
    var current = onlineStore.get()
    if (String(current.playlistId) !== String(playlist.id) || current.provider !== provider) return
    if (first) {
      onlineStore.set({ playlistPhase: 'ready', playlistRefreshing: false, error: errorText(error) })
    } else {
      onlineStore.set({ playlistPhase: 'error', playlistRefreshing: false, playlistSongs: [], error: errorText(error) })
    }
  }
}

async function loadMoreOnlinePlaylist() {
  var state = onlineStore.get()
  if (!state.playlistId || state.playlistPhase !== 'ready' || state.playlistHasMore !== true || state.playlistLoadingMore === true) return
  var provider = state.provider
  var id = state.playlistId
  var offset = Number(state.playlistNextOffset) || 0
  onlineStore.set({ playlistLoadingMore: true, playlistPageError: '' })
  try {
    var page = await fetchPlaylistPage(provider, id, offset, false)
    var current = onlineStore.get()
    if (String(current.playlistId) !== String(id) || current.provider !== provider) return
    var seen = {}
    var merged = (current.playlistSongs || []).slice()
    merged.forEach(function (song) { seen[String(song.path || '')] = true })
    ;(page.songs || []).forEach(function (song) {
      var path = String(song.path || '')
      if (path !== '' && seen[path] === true) return
      if (path !== '') seen[path] = true
      merged.push(song)
    })
    var nextOffset = Number(page.nextOffset) || offset + page.songs.length
    if (nextOffset <= offset) nextOffset = offset + page.songs.length
    onlineStore.set({
      playlistSongs: merged,
      playlistTrackCount: page.trackCount || current.playlistTrackCount || merged.length,
      playlistHasMore: page.hasMore === true && nextOffset > offset,
      playlistNextOffset: nextOffset,
      playlistLoadingMore: false,
      playlistPageError: '',
    })
  } catch (error) {
    var latest = onlineStore.get()
    if (String(latest.playlistId) !== String(id) || latest.provider !== provider) return
    onlineStore.set({ playlistLoadingMore: false, playlistPageError: errorText(error) })
  }
}

function closeOnlinePlaylist() {
  onlineStore.set({
    playlistId: '',
    playlistName: '',
    playlistSongs: [],
    playlistTrackCount: 0,
    playlistHasMore: false,
    playlistNextOffset: 0,
    playlistLoadingMore: false,
    playlistPageError: '',
    playlistPhase: 'idle',
  })
}

async function loadProviders() {
  onlineStore.set({ providersPhase: 'loading' })
  try {
    var body = await getJson(API + 'online/providers')
    var providers = body.providers || {}
    onlineStore.set({ providers: providers, providersPhase: 'ready' })
    // Folia hydrates the liked set together with the source list. Without this
    // the heart had no state to read and rendered empty even for a liked song.
    Object.keys(providers).forEach(function (provider) {
      if (providers[provider] && providers[provider].loggedIn === true && typeof loadLikedIds === 'function') {
        void loadLikedIds(provider).catch(function () {
          // A provider can expose likes without a readable liked list; the
          // context menu still asks for the single-song state on demand.
        })
      }
    })
  } catch (error) {
    // Provider status only drives labels. Mark ready so the source menu never
    // waits forever for a failed background request.
    onlineStore.set({ providersPhase: 'ready' })
  }
}

function rememberOnline(track) {
  var entry = {
    provider: track.onlineProvider,
    id: track.onlineId || '',
    title: track.title || '',
    artist: track.artist || '',
    album: track.album || '',
    albumId: track.albumId || '',
    durationSec: track.durationSec || 0,
    coverUrl: track.coverUrl || '',
    // Without this the recent list loses artwork for self-hosted tracks once
    // the entry round-trips through storage.
    coverArtId: track.coverArtId || '',
    qualityHint: track.qualityHint || '',
    playedAt: Date.now(),
  }
  if (!entry.provider || entry.id === '') return
  var state = onlineStore.get()
  var next = [entry].concat(
    state.history.filter(function (item) {
      return !(item.provider === entry.provider && item.id === entry.id)
    }),
  )
  onlineStore.set({ history: next })
  writeOnlineHistory(next)
}

function removeHistory(entry) {
  var state = onlineStore.get()
  var next = state.history.filter(function (item) {
    return !(item.provider === entry.provider && item.id === entry.id)
  })
  onlineStore.set({ history: next })
  writeOnlineHistory(next)
}

function playOnlineResults(results, index) {
  var list = Array.isArray(results) ? results : []
  var wanted = list[index]
  // Do not pre-block VIP-labelled rows: the platform decides whether this
  // account gets a full stream, a preview clip, or no stream at all.
  var playable = list.filter(function (item) {
    return item && item.id
  })
  if (playable.length === 0) return
  var at = 0
  if (wanted) {
    for (var i = 0; i < playable.length; i += 1) {
      if (playable[i].provider === wanted.provider && playable[i].id === wanted.id) {
        at = i
        break
      }
    }
  }
  var tracks = playable.map(onlineTrackOf)
  player.playList(tracks, at)
  rememberOnline(tracks[at])
}

function playHistoryEntry(entry) {
  var track = onlineTrackOf(entry)
  player.playList([track], 0)
  rememberOnline(track)
}

async function startProviderLogin(provider, mode) {
  var body = await postJson(API + 'online/login/start', { provider: provider, mode: mode })
  return body
}

async function checkProviderLogin(provider, key, mode) {
  var body = await getJson(
    API +
      'online/login/status?provider=' +
      encodeURIComponent(provider) +
      '&key=' +
      encodeURIComponent(key) +
      '&mode=' +
      encodeURIComponent(mode || 'qq'),
  )
  return body.status
}


async function getLoginSession(provider) {
  return getJson(API + 'online/login/session?provider=' + encodeURIComponent(provider))
}

async function logoutProvider(provider) {
  try {
    await postJson(API + 'online/logout', { provider: provider })
    resetOnlineAccountData()
    await loadProviders()
    showToast(t('online.logoutDone'))
  } catch (error) {
    showToast(errorText(error))
  }
}

/**
 * Navidrome credentials form state.
 *
 * The password never leaves this component except in the one POST that trades
 * it for a salted token; the Host stores only salt + token.
 */
function useNavidromeForm() {
  var online = useStore(onlineStore)
  var known = online && online.providers && online.providers.navidrome ? online.providers.navidrome : null
  var serverPair = useState(known && typeof known.server === 'string' ? known.server : '')
  var userPair = useState(known && typeof known.nickname === 'string' ? known.nickname : '')
  var passPair = useState('')
  var phasePair = useState('idle') // idle | loading
  var errorPair = useState('')
  var noticePair = useState('')
  // Opt-in: keeping the password is what unlocks paging the whole library through
  // the native API; the Host otherwise stores only a salted token.
  var keepPair = useState(false)

  var setServer = serverPair[1]
  var setUsername = userPair[1]
  var setPassword = passPair[1]
  var setPhase = phasePair[1]
  var setError = errorPair[1]
  var setNotice = noticePair[1]
  var setKeepPassword = keepPair[1]

  // The providers endpoint already carries the stored server/username; fill them when the
  // form is opened after a load instead of making the listener retype a known server.
  useEffect(
    function () {
      if (known === null) return
      if (serverPair[0] === '' && typeof known.server === 'string' && known.server !== '') setServer(known.server)
      var name = typeof known.nickname === 'string' ? known.nickname : ''
      if (userPair[0] === '' && name !== '') setUsername(name)
    },
    [known, known && known.server, known && known.nickname, serverPair, userPair],
  )

  function reset() {
    setServer('')
    setUsername('')
    setPassword('')
    setPhase('idle')
    setError('')
    setNotice('')
    setKeepPassword(false)
  }

  async function connect() {
    var server = String(serverPair[0] || '').trim()
    var username = String(userPair[0] || '').trim()
    var password = String(passPair[0] || '')
    setError('')
    setNotice('')
    if (!/^https?:\/\//i.test(server)) {
      setError(t('online.navidromeBadServer'))
      return
    }
    if (username === '' || password === '') {
      setError(t('online.accountHint'))
      return
    }
    setPhase('loading')
    try {
      var result = await postJson(API + 'online/navidrome/login', {
        server: server,
        username: username,
        password: password,
        storePassword: keepPair[0] === true,
      })
      setPassword('')
      setPhase('idle')
      setNotice(t('online.navidromeOk', { version: (result && result.serverVersion) || 'ok' }))
      await loadProviders()
      showToast(t('online.loginSuccess'))
    } catch (error) {
      setPhase('idle')
      setError(errorText(error))
    }
  }

  return {
    server: serverPair[0],
    username: userPair[0],
    password: passPair[0],
    phase: phasePair[0],
    error: errorPair[0],
    notice: noticePair[0],
    keepPassword: keepPair[0],
    setServer: setServer,
    setUsername: setUsername,
    setPassword: setPassword,
    setError: setError,
    setNotice: setNotice,
    setKeepPassword: setKeepPassword,
    connect: connect,
    reset: reset,
  }
}
