/**
 * Navidrome / Subsonic provider.
 *
 * Navidrome speaks the Subsonic API, so this module also covers Gonic, Airsonic,
 * Supysonic and any other Subsonic-compatible server. Unlike the other providers
 * here there is no QR sign-in and no unofficial endpoint: the user supplies a
 * server URL plus credentials, and every request is a plain Subsonic call.
 *
 * Auth: `?u=<user>&t=<md5(password + salt)>&s=<salt>`. Older servers also accept
 * a plaintext `p=` parameter, but Subsonic 1.13+ and Navidrome reject it by
 * default, so the salted token is the only supported form. The password itself
 * is never persisted — callers store the salt and token instead.
 *
 * @module dsh-music-panel/providers/navidrome
 */

import { createHash, randomBytes } from 'node:crypto'

const TIMEOUT_MS = 10_000
const API_VERSION = '1.16.1'
const CLIENT_NAME = 'dsh-music-panel'

/** Bound every response so a hostile/looping server cannot exhaust memory. */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024
/** The native login response is tiny; keep it bounded as well. */
const MAX_AUTH_BYTES = 256 * 1024

/** A salted auth pair. `salt` is hex; `token` is md5(password + salt) in hex. */
export function makeToken(password, salt) {
  const useSalt = typeof salt === 'string' && salt !== '' ? salt : randomBytes(8).toString('hex')
  const token = createHash('md5').update(String(password) + useSalt, 'utf8').digest('hex')
  return { salt: useSalt, token }
}

/** Round-trip a credentials payload into the stored {salt, token} shape. */
export function credentialsFromPassword(password) {
  return makeToken(String(password ?? ''), '')
}

/** Normalize a user-supplied server URL: trim, strip a trailing slash, reject non-http(s). */
export function normalizeServer(raw) {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text === '') return ''
  let url
  try {
    url = new URL(text)
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  // Navidrome lives under a sub-path when reverse-proxied; keep any path prefix.
  const pathname = url.pathname.replace(/\/+$/, '')
  return url.origin + pathname
}

/** Build one authenticated Subsonic query string. */
export function authQuery(config, extra = {}) {
  const params = new URLSearchParams({
    u: String(config.username ?? ''),
    t: String(config.token ?? ''),
    s: String(config.salt ?? ''),
    v: API_VERSION,
    c: CLIENT_NAME,
    f: 'json',
    ...extra,
  })
  return params.toString()
}

function endpoint(config, view, extra) {
  const server = normalizeServer(config.server)
  if (server === '') throw new Error('Navidrome 服务器地址无效')
  return server + '/rest/' + view + '?' + authQuery(config, extra)
}

async function requestJson(config, view, extra) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(endpoint(config, view, extra), {
      headers: { 'User-Agent': CLIENT_NAME },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('响应过大')
    const text = await res.text()
    if (text.length > MAX_RESPONSE_BYTES) throw new Error('响应过大')
    const data = JSON.parse(text)
    const body = data && data['subsonic-response']
    if (!body) throw new Error('响应格式不符（缺少 subsonic-response）')
    if (body.status === 'failed') {
      const err = body.error || {}
      throw new Error('Subsonic 错误 ' + String(err.code ?? '') + '：' + String(err.message ?? 'unknown'))
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}

/** Verify the server answers and the credentials are accepted. */
export async function ping(config) {
  const body = await requestJson(config, 'ping.view', {})
  return {
    serverVersion: String(body.serverVersion ?? ''),
    type: String(body.type ?? ''),
    openSubsonic: body.openSubsonic === true,
  }
}

function artistsOf(item) {
  const list = Array.isArray(item.artists) ? item.artists : []
  const names = list
    .map((artist) => (artist !== null && typeof artist === 'object' ? String(artist.name ?? '') : ''))
    .filter((name) => name !== '')
  if (names.length > 0) return names.join(' / ')
  return typeof item.artist === 'string' ? item.artist : ''
}

function songOf(item) {
  if (item === null || typeof item !== 'object') return null
  const id = String(item.id ?? '')
  if (id === '') return null
  return {
    provider: 'navidrome',
    id,
    title: String(item.title ?? ''),
    artist: artistsOf(item),
    album: String(item.album ?? ''),
    // Subsonic's search3 and getAlbum both report albumId, so the panel can use
    // its shared album route (`/online/album?id=…`) exactly as it does for the
    // Chinese platforms instead of a Navidrome-only browse path.
    albumId: String(item.albumId ?? ''),
    albumArtist: String(item.albumArtist ?? item.displayAlbumArtist ?? item.artist ?? ''),
    durationSec: Number(item.duration) || 0,
    // Covers need the stored token, so the browser asks the Host proxy by id.
    // coverUrl stays empty: the generic /online/cover route would reject a
    // self-hosted host.
    coverUrl: '',
    coverArtId: String(item.coverArt ?? ''),
    // OpenSubsonic reports ReplayGain per song; Folia treats it as the song's tag
    // gain (with its +4 dB target offset applied by the balance rules).
    replayGain: replayGainOf(item),
    qualityHint: '',
  }
}

/**
 * Search songs by free text.
 *
 * `search3.view` is the current form (ID3); `search2.view`/`search.view` are the
 * legacy fallbacks for servers older than 1.8. Navidrome 0.64 supports search3.
 */
export async function search(config, query, options = {}) {
  const text = String(query ?? '').trim()
  if (text === '') return []
  const count = Math.min(Math.max(Number(options.count) || 200, 1), 500)
  const offset = Math.max(Number(options.offset) || 0, 0)
  const extra = {
    songCount: String(count),
    songOffset: String(offset),
    albumCount: '0',
    artistCount: '0',
    query: text,
  }
  let body
  try {
    body = await requestJson(config, 'search3.view', extra)
  } catch (error) {
    // Subsonic renamed this endpoint twice: search (1.0) -> search2 (1.4) ->
    // search3 (1.8). Walk the chain down so a pre-1.8 server still answers.
    if (!/错误 0|错误 10|错误 70|not found|HTTP 404/i.test(String(error && error.message))) throw error
    const legacy = { songCount: '30', songOffset: '0', query: text }
    try {
      body = await requestJson(config, 'search2.view', legacy)
    } catch {
      body = await requestJson(config, 'search.view', legacy)
    }
  }
  const result = body.searchResult3 || body.searchResult2 || body.searchResult || {}
  const songs = Array.isArray(result.song) ? result.song : []
  return songs.map(songOf).filter((song) => song !== null)
}

/**
 * Search albums by free text through search3. The search is a collection search,
 * not a song scan: songCount/artistCount stay zero so the server returns only albums.
 */
export async function searchAlbums(config, query, options = {}) {
  const text = String(query ?? '').trim()
  if (text === '') return { items: [], total: 0, page: 1 }
  const count = Math.min(Math.max(Number(options.count) || 30, 1), 100)
  const offset = Math.max(Number(options.offset) || 0, 0)
  const body = await requestJson(config, 'search3.view', {
    songCount: '0',
    albumCount: String(count),
    albumOffset: String(offset),
    artistCount: '0',
    query: text,
  })
  const result = body.searchResult3 || body.searchResult2 || body.searchResult || {}
  const albums = Array.isArray(result.album) ? result.album : []
  const items = albums.map(albumOf).filter((album) => album !== null)
  // Subsonic search3 does not report a total: keep a sentinel when the page is full so
  // the client can ask for the next page, and a real count when it is the last page.
  const total = offset + items.length + (items.length >= count ? 1 : 0)
  return { items, total, page: Math.floor(offset / count) + 1 }
}

/**
 * Resolve a playable URL. Subsonic answers with a redirect to the media file
 * or streams it directly; either way the host proxy already follows redirects
 * and forwards Range, so returning the URL is enough.
 *
 * @returns {Promise<{ url: string, quality: string }>}
 */
function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** OpenSubsonic `replayGain` blob → the two gains the balance understands. */
export function replayGainOf(item) {
  const raw = item === null || typeof item !== 'object' ? null : item.replayGain
  if (raw === null || typeof raw !== 'object') return null
  const trackGain = numberOrNull(raw.trackGain)
  const albumGain = numberOrNull(raw.albumGain)
  if (trackGain === null && albumGain === null) return null
  return {
    trackGain,
    albumGain,
    trackPeak: numberOrNull(raw.trackPeak),
    albumPeak: numberOrNull(raw.albumPeak),
  }
}

/**
 * The full song payload for one id: OpenSubsonic only sends ReplayGain here, so the
 * playing track's gain is read on demand rather than with every list.
 *
 * @returns {Promise<{ trackGain: number | null, albumGain: number | null }>}
 */
export async function songGain(config, id) {
  const songId = String(id ?? '')
  if (songId === '') return { trackGain: null, albumGain: null }
  try {
    const body = await requestJson(config, 'getSong.view', { id: songId })
    const song = body?.song && typeof body.song === 'object' ? body.song : null
    const gain = replayGainOf(song)
    return {
      trackGain: gain === null ? null : gain.trackGain,
      albumGain: gain === null ? null : gain.albumGain,
    }
  } catch {
    return { trackGain: null, albumGain: null }
  }
}

export async function resolveStream(config, id, quality = 'high') {
  const songId = String(id ?? '')
  if (songId === '') return { url: '', quality: '' }
  // OpenSubsonic servers expose a declared max bitrate; the plain `maxBitRate`
  // parameter caps it and the server transcodes when needed.
  const extra = { id: songId }
  const cap = quality === 'standard' ? '128' : quality === 'high' ? '320' : '0'
  if (cap !== '0') extra.maxBitRate = cap
  return { url: endpoint(config, 'stream.view', extra), quality: quality === 'standard' ? '128k' : '320k' }
}

/** Cover art URL for one coverArt id (album/artist art shares the same view). */
export function coverArtUrl(config, coverArtId) {
  const id = String(coverArtId ?? '')
  if (id === '') return ''
  return endpoint(config, 'getCoverArt.view', { id, size: '600' })
}

/**
 * A library-wide song list.
 *
 * Subsonic has no paginated "every song" view; `getRandomSongs` is the only
 * endpoint that returns tracks across albums without first walking the album
 * list. It is random per call, which is what the panel's 全部歌曲 entry shows:
 * a browseable sample of the library rather than a stable index.
 */
export async function songs(config, size = 200) {
  const count = Math.min(Math.max(Number(size) || 200, 1), 500)
  const body = await requestJson(config, 'getRandomSongs.view', { size: String(count) })
  const wrap = body.randomSongs || {}
  const list = Array.isArray(wrap.song) ? wrap.song : []
  return list.map(songOf).filter((song) => song !== null)
}

// ── Navidrome native API (opt-in, for a complete song list) ───────────────
//
// Subsonic has no paginated "every song" view, so browsing the whole library
// means getRandomSongs and whatever sample it hands back. Navidrome's own
// /api/song does paginate, but it is an internal surface (not documented as
// stable) and it authenticates with a JWT built from the user's password, not
// the salted token. It is therefore used only when the user opts in and the
// password is on file.
//
// Song ids are identical to Subsonic's, and a song's cover id is `mf-<id>`, so
// playback and cover art keep using the Subsonic paths unchanged.

const NATIVE_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const nativeTokens = new Map()

function nativeKey(config) {
  return normalizeServer(config.server) + '|' + String(config.username ?? '')
}

/** Drop a cached JWT, e.g. after the server answered 401. */
export function forgetNativeToken(config) {
  nativeTokens.delete(nativeKey(config))
}

/**
 * Drop every cached JWT.
 *
 * Used on logout, where the stored session has already been cleared and the
 * server + username needed to compute a key are gone. Without this, logging out
 * and back in — or changing the password — keeps reusing the old token until
 * its 12h TTL expires.
 */
export function forgetAllNativeTokens() {
  nativeTokens.clear()
}

async function nativeLogin(config) {
  const key = nativeKey(config)
  const now = Date.now()
  const cached = nativeTokens.get(key)
  if (cached !== undefined && cached.expiresAt > now) return cached.token

  const server = normalizeServer(config.server)
  if (server === '') throw new Error('Navidrome 服务器地址无效')
  const password = String(config.password ?? '')
  if (password === '') throw new Error('未保存密码，无法读取完整曲库')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(server + '/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'User-Agent': CLIENT_NAME },
      body: JSON.stringify({ username: String(config.username ?? ''), password }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('Navidrome 登录失败 HTTP ' + res.status)
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_AUTH_BYTES) throw new Error('登录响应过大')
    const text = typeof res.text === 'function' ? await res.text() : ''
    if (text.length > MAX_AUTH_BYTES) throw new Error('登录响应过大')
    const data = text !== '' ? JSON.parse(text) : await res.json()
    const token = String((data && data.token) || '')
    if (token === '') throw new Error('Navidrome 登录响应缺少 token')
    nativeTokens.set(key, { token, expiresAt: now + NATIVE_TOKEN_TTL_MS })
    return token
  } finally {
    clearTimeout(timer)
  }
}

function songFromNative(item) {
  if (item === null || typeof item !== 'object') return null
  const id = String(item.id ?? '')
  if (id === '') return null
  const hasCover = item.hasCoverArt === true || String(item.coverArtId ?? '') !== ''
  return {
    provider: 'navidrome',
    id,
    title: String(item.title ?? ''),
    artist: String(item.artist ?? ''),
    album: String(item.album ?? ''),
    // The native API reports albumId too, so paged rows also open the shared
    // album view.
    albumId: String(item.albumId ?? ''),
    albumArtist: String(item.albumArtist ?? item.artist ?? ''),
    durationSec: Math.round(Number(item.duration) || 0),
    coverUrl: '',
    // Navidrome serves a song's cover under `mf-<songId>`, the same id the
    // Subsonic layer reports, so the existing proxy keeps working.
    coverArtId: hasCover ? 'mf-' + id : item.albumId ? 'al-' + String(item.albumId) : '',
    qualityHint: '',
  }
}

/** Native sort fields, keyed by the panel's preference names. */
const NATIVE_SORT = {
  title: 'title',
  artist: 'artist',
  album: 'album',
  duration: 'duration',
  added: 'createdAt',
  recent: 'playDate',
}

async function nativeRequest(config, path, params, retry = true) {
  const server = normalizeServer(config.server)
  const token = await nativeLogin(config)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = server + path + '?' + params.toString()
    const res = await fetch(url, {
      headers: { 'x-nd-authorization': 'Bearer ' + token, 'User-Agent': CLIENT_NAME },
      signal: controller.signal,
    })
    // The JWT can expire between the TTL guess and the call; log in once more.
    if (res.status === 401 && retry) {
      forgetNativeToken(config)
      return nativeRequest(config, path, params, false)
    }
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const total = Number(res.headers.get('x-total-count'))
    const rows = await res.json()
    return { rows: Array.isArray(rows) ? rows : [], total: Number.isFinite(total) ? total : 0 }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One page of the complete library, ordered on the server so pages never
 * overlap or skip (client-side re-sorting would break that guarantee).
 *
 * @returns {Promise<{ songs: object[], total: number, offset: number }>}
 */
export async function nativeSongs(config, options = {}) {
  const offset = Math.max(Number(options.offset) || 0, 0)
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500)
  const sortField = NATIVE_SORT[String(options.sort ?? '')] ?? NATIVE_SORT.title
  const order = String(options.order ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const params = new URLSearchParams({
    _start: String(offset),
    _end: String(offset + limit),
    _sort: sortField,
    _order: order,
  })
  const { rows, total } = await nativeRequest(config, '/api/song', params)
  return { songs: rows.map(songFromNative).filter((song) => song !== null), total, offset }
}

function albumOf(item) {
  if (item === null || typeof item !== 'object') return null
  const id = String(item.id ?? '')
  if (id === '') return null
  return {
    provider: 'navidrome',
    id,
    name: String(item.name ?? ''),
    artist: String(item.artist ?? ''),
    artistId: String(item.artistId ?? ''),
    songCount: Number(item.songCount) || 0,
    year: Number(item.year) || 0,
    coverArtId: String(item.coverArt ?? ''),
  }
}

function artistOf(item) {
  if (item === null || typeof item !== 'object') return null
  const id = String(item.id ?? '')
  if (id === '') return null
  return {
    provider: 'navidrome',
    id,
    name: String(item.name ?? ''),
    albumCount: Number(item.albumCount) || 0,
    coverArtId: String(item.coverArt ?? ''),
  }
}

/**
 * Every artist, flattened from getArtists' alphabetical index groups.
 *
 * This feeds the header card only: opening one lists that artist's albums,
 * whose rows go through the shared album view, so no artist-detail endpoint is
 * needed.
 */
export async function artists(config) {
  const body = await requestJson(config, 'getArtists.view', {})
  const wrap = body.artists || {}
  const index = Array.isArray(wrap.index) ? wrap.index : []
  const out = []
  for (const group of index) {
    const list = Array.isArray(group.artist) ? group.artist : []
    for (const item of list) {
      const shaped = artistOf(item)
      if (shaped !== null) out.push(shaped)
    }
  }
  return out
}

/** Albums by name. Subsonic paginates this view; 500 is its documented ceiling. */
export async function albums(config, size = 200) {
  const count = Math.min(Math.max(Number(size) || 200, 1), 500)
  const body = await requestJson(config, 'getAlbumList2.view', {
    type: 'alphabeticalByName',
    size: String(count),
    offset: '0',
  })
  const wrap = body.albumList2 || {}
  const list = Array.isArray(wrap.album) ? wrap.album : []
  return list.map(albumOf).filter((album) => album !== null)
}

/**
 * One artist's albums.
 *
 * Used only to expand an artist card. Album rows still open the shared album
 * view, so this stays a plain list and there is no per-artist detail view.
 */
export async function artistAlbums(config, artistId) {
  const id = String(artistId ?? '')
  if (id === '') return { artist: null, albums: [] }
  const body = await requestJson(config, 'getArtist.view', { id })
  const wrap = body.artist || {}
  const list = Array.isArray(wrap.album) ? wrap.album : []
  return { artist: artistOf(wrap), albums: list.map(albumOf).filter((album) => album !== null) }
}

/**
 * One album plus its songs.
 *
 * The shared online album view (`/online/album?id=…`) drives every provider,
 * and Subsonic reports `albumId` on each song, so Navidrome plugs into that same
 * path rather than rendering an album view of its own.
 */
export async function albumSongs(config, albumId) {
  const id = String(albumId ?? '')
  if (id === '') return { album: null, songs: [] }
  const body = await requestJson(config, 'getAlbum.view', { id })
  const wrap = body.album || {}
  const list = Array.isArray(wrap.song) ? wrap.song : []
  return { album: albumOf(wrap), songs: list.map(songOf).filter((song) => song !== null) }
}

/**
 * Favorites (`star` / `unstar` from Subsonic 1.0). Both are standard endpoints,
 * so this works on any Subsonic-compatible server, not just Navidrome.
 */
export async function setStarred(config, id, on) {
  const songId = String(id ?? '')
  if (songId === '') return false
  await requestJson(config, on === true ? 'star.view' : 'unstar.view', { id: songId })
  return true
}

/** Ids of every starred song. */
export async function starredIds(config) {
  const body = await requestJson(config, 'getStarred2.view', {})
  const wrap = body.starred2 || {}
  const list = Array.isArray(wrap.song) ? wrap.song : []
  return list.map((song) => String(song.id ?? '')).filter((songId) => songId !== '')
}

/** Append a song to one of the user's playlists. */
export async function addSongToPlaylist(config, playlistId, songId) {
  const pid = String(playlistId ?? '')
  const sid = String(songId ?? '')
  if (pid === '' || sid === '') return false
  await requestJson(config, 'updatePlaylist.view', { playlistId: pid, songIdToAdd: sid })
  return true
}

/** User playlists, oldest API first-class since 1.0. */
export async function myPlaylists(config) {
  const body = await requestJson(config, 'getPlaylists.view', {})
  const wrap = body.playlists || {}
  const list = Array.isArray(wrap.playlist) ? wrap.playlist : []
  return list.map((item) => ({
    provider: 'navidrome',
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    trackCount: Number(item.songCount) || 0,
    coverUrl: '',
  }))
}

/** Songs inside one playlist. */
export async function playlistSongs(config, playlistId) {
  const body = await requestJson(config, 'getPlaylist.view', { id: String(playlistId ?? '') })
  const wrap = body.playlist || {}
  const entries = Array.isArray(wrap.entry) ? wrap.entry : []
  return entries.map(songOf).filter((song) => song !== null)
}

/**
 * Subsonic has no playlist paging; this adapter still honours the page contract
 * so callers do not need a provider-specific branch. The full list is read once
 * and kept briefly, so "load more" does not re-download the whole playlist for
 * every page (one request per page session instead of one per page).
 */
const playlistPageCache = new Map()
const PLAYLIST_PAGE_TTL_MS = 20 * 1000
const PLAYLIST_PAGE_CACHE_MAX = 24

export async function playlistSongsPage(config, playlistId, limit = 100, offset = 0) {
  const id = String(playlistId ?? '')
  const key = [config?.server || '', config?.username || '', id].join('|')
  let cached = playlistPageCache.get(key)
  if (cached === undefined || Date.now() - cached.at >= PLAYLIST_PAGE_TTL_MS) {
    const body = await requestJson(config, 'getPlaylist.view', { id })
    const wrap = body.playlist || {}
    const entries = Array.isArray(wrap.entry) ? wrap.entry : []
    cached = { at: Date.now(), name: wrap.name || '', songs: entries.map(songOf).filter((song) => song !== null) }
    playlistPageCache.set(key, cached)
    if (playlistPageCache.size > PLAYLIST_PAGE_CACHE_MAX) {
      let oldestKey = ''
      let oldestAt = Infinity
      playlistPageCache.forEach((entry, cacheKey) => {
        if (entry.at < oldestAt) {
          oldestAt = entry.at
          oldestKey = cacheKey
        }
      })
      if (oldestKey !== '') playlistPageCache.delete(oldestKey)
    }
  }
  const size = Math.max(1, Math.min(200, parseInt(limit, 10) || 100))
  const at = Math.max(0, parseInt(offset, 10) || 0)
  const songs = cached.songs.slice(at, at + size)
  return {
    name: cached.name, cover: '',
    trackCount: cached.songs.length,
    songs,
    hasMore: at + songs.length < cached.songs.length,
    nextOffset: at + songs.length,
  }
}

/**
 * Timed lyrics for one song.
 *
 * Navidrome reads a sidecar `.lrc` (or embedded tags) and serves it through
 * OpenSubsonic's getLyricsBySongId, whose `start` is an integer number of
 * **milliseconds**. Formatting those as seconds produced timestamps like
 * [358:50.00] instead of [00:35.84], so the conversion happens here.
 *
 * Lyrics are optional in Subsonic; any failure degrades to an empty lyric so
 * the player simply shows none rather than an error.
 */
export async function lyric(config, id) {
  try {
    const body = await requestJson(config, 'getLyricsBySongId.view', { id: String(id ?? '') })
    const wrap = body.lyricsList || {}
    const list = Array.isArray(wrap.structuredLyrics) ? wrap.structuredLyrics : []
    const first = list.length > 0 && list[0] !== null && typeof list[0] === 'object' ? list[0] : null
    if (first === null) return { lrc: '', translation: '' }
    const lines = Array.isArray(first.line) ? first.line : []
    const lrc = lines
      .map((line) => {
        const millis = Number(line && line.start) || 0
        const total = millis / 1000
        const minutes = Math.floor(total / 60)
        const seconds = (total % 60).toFixed(2).padStart(5, '0')
        return '[' + String(minutes).padStart(2, '0') + ':' + seconds + ']' + String((line && line.value) ?? '')
      })
      .join('\n')
    return { lrc, translation: '' }
  } catch {
    return { lrc: '', translation: '' }
  }
}
