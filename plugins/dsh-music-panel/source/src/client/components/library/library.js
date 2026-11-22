/**
 * library: scanned tracks, favorites, playlists, stats and config.
 *
 * Views read this store; actions are plain async functions so they can be
 * called from event handlers without a hook layer.
 */

var libraryStore = createStore({
  phase: 'idle', // idle | loading | ready | error
  tracks: [],
  roots: [],
  warnings: [],
  error: '',
  scannedAt: 0,
  config: null,
  favorites: [],
  playlists: [],
  stats: {},
  statsRange: 'all',
})

var libraryToken = 0
// The in-flight load the control drainer shares with the panel: with the panel closed nothing
// else would fetch the tracks a local `play` action searches.
var libraryLoadPromise = null

async function loadLibrary(refresh) {
  var token = (libraryToken += 1)
  libraryStore.set({ phase: 'loading', error: '' })
  try {
    var body = await getJson(API + 'library' + (refresh === true ? '?refresh=1' : ''))
    if (token !== libraryToken) return
    libraryStore.set({
      phase: 'ready',
      tracks: Array.isArray(body.tracks) ? body.tracks : [],
      roots: Array.isArray(body.roots) ? body.roots : [],
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
      truncated: body.truncated === true,
      scannedAt: body.scannedAt || 0,
      config: body.config || libraryStore.get().config,
      error: '',
    })
  } catch (error) {
    if (token !== libraryToken) return
    libraryStore.set({ phase: 'error', error: errorText(error) })
  }
}

function tracksNow() {
  return libraryStore.get().tracks
}

/**
 * The library, for a caller outside the panel (the control drainer). Concurrent callers share
 * one request; a failed load is retried by the next caller.
 */
function ensureLibraryLoaded() {
  if (libraryStore.get().phase === 'ready') return Promise.resolve()
  if (libraryLoadPromise !== null) return libraryLoadPromise
  libraryLoadPromise = loadLibrary(false).then(function () {
    libraryLoadPromise = null
  }, function () {
    libraryLoadPromise = null
  })
  return libraryLoadPromise
}

function trackByPath(path) {
  var list = tracksNow()
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].path === path) return list[i]
  }
  return null
}

function favoritePaths(list) {
  var out = []
  if (!Array.isArray(list)) return out
  list.forEach(function (item) {
    var path = typeof item === 'string' ? item : item && typeof item.path === 'string' ? item.path : ''
    if (path) out.push(path)
  })
  return out
}

function favoriteSet() {
  var set = {}
  var list = favoritePaths(libraryStore.get().favorites)
  for (var i = 0; i < list.length; i += 1) set[list[i]] = true
  return set
}

async function loadFavorites() {
  try {
    var body = await getJson(API + 'favorites')
    libraryStore.set({ favorites: favoritePaths(body.favorites) })
  } catch (error) {
    // Favorites are optional; the panel still works without them.
  }
}

async function toggleFavorite(path) {
  if (!path) return
  try {
    var body = await postJson(API + 'favorites', { path: path })
    libraryStore.set({ favorites: favoritePaths(body.favorites) })
  } catch (error) {
    showToast(errorText(error))
  }
}
/**
 * Show a local file in its folder. The row menu and the details panel share this request so a
 * change to the route or the wording only has one place to go.
 */
async function revealTrackPath(path) {
  var value = String(path || '')
  if (value === '') return
  try {
    await postJson(API + 'reveal', { path: value })
    showToast(t('page.revealed'))
  } catch (error) {
    showToast(errorText(error))
  }
}

async function loadPlaylists() {
  try {
    var body = await getJson(API + 'playlists')
    libraryStore.set({ playlists: Array.isArray(body.playlists) ? body.playlists : [] })
  } catch (error) {
    libraryStore.set({ playlists: [] })
  }
}

async function createPlaylist(name) {
  try {
    var body = await postJson(API + 'playlists', { name: name })
    await loadPlaylists()
    return body.playlist
  } catch (error) {
    showToast(errorText(error))
    return null
  }
}

async function patchPlaylist(id, patch) {
  try {
    await sendJson('PATCH', API + 'playlists/' + encodeURIComponent(id), patch)
    await loadPlaylists()
    return true
  } catch (error) {
    showToast(errorText(error))
    return false
  }
}

async function removePlaylist(id) {
  try {
    await sendJson('DELETE', API + 'playlists/' + encodeURIComponent(id))
    await loadPlaylists()
    return true
  } catch (error) {
    showToast(errorText(error))
    return false
  }
}

async function addToPlaylist(id, paths) {
  var list = Array.isArray(paths) ? paths : [paths]
  return patchPlaylist(id, { add: list })
}

async function loadStats(range) {
  var next = range === 'week' || range === 'month' ? range : 'all'
  libraryStore.set({ statsRange: next })
  try {
    var body = await getJson(API + 'stats?range=' + encodeURIComponent(next))
    libraryStore.set({ stats: body.tracks || {} })
  } catch (error) {
    libraryStore.set({ stats: {} })
  }
}

async function loadConfig() {
  try {
    var body = await getJson(API + 'config')
    libraryStore.set({
      config: body.config || null,
      cacheDir: typeof body.effectiveCacheDir === 'string' ? body.effectiveCacheDir : '',
      defaultCacheDir: typeof body.defaultCacheDir === 'string' ? body.defaultCacheDir : '',
    })
    return body.config || null
  } catch (error) {
    return null
  }
}

/** Save settings that do not change the library (cache directory, folder watching). */
async function saveHostConfig(patch) {
  try {
    var body = await postJson(API + 'config', patch)
    libraryStore.set({
      config: body.config || null,
      cacheDir: typeof body.effectiveCacheDir === 'string' ? body.effectiveCacheDir : '',
      defaultCacheDir: typeof body.defaultCacheDir === 'string' ? body.defaultCacheDir : '',
    })
    return body
  } catch (error) {
    showToast(errorText(error))
    return null
  }
}

/** Show a plugin-owned directory in the OS file manager. */
async function revealHostDir(kind) {
  try {
    await postJson(API + 'reveal-dir', { kind: kind })
    showToast(t('page.revealed'))
  } catch (error) {
    showToast(errorText(error))
  }
}

async function saveConfig(patch) {
  try {
    var body = await postJson(API + 'config', patch)
    libraryStore.set({ config: body.config || null })
    await loadLibrary(true)
    return true
  } catch (error) {
    showToast(errorText(error))
    return false
  }
}

function playlistTracks(playlist) {
  if (!playlist || !Array.isArray(playlist.trackPaths)) return []
  var out = []
  for (var i = 0; i < playlist.trackPaths.length; i += 1) {
    var track = trackByPath(playlist.trackPaths[i])
    if (track !== null) out.push(track)
  }
  return out
}

function playlistById(id) {
  var list = libraryStore.get().playlists
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].id === id) return list[i]
  }
  return null
}
