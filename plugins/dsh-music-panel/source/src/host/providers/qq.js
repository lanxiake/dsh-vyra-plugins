/**
 * QQ Music transport, served by the upstream API package.
 *
 * Same strategy as NetEase: `export *` keeps every not-yet-migrated function from
 * `qq-legacy.js`, and the explicit exports below replace the hot paths (search,
 * stream URL, lyrics, QR login). Return shapes are byte-for-byte the legacy ones,
 * so nothing above this module changes.
 *
 * @module dsh-music-panel/providers/qq
 */

export * from './qq-legacy.js'

// `export *` re-exports but creates no local binding, so helpers we call here must
// be imported explicitly.
import { decodeEntities, getPlaylistSongs as legacyPlaylistSongs } from './qq-legacy.js'
import { callUpstream } from '../services/qq-api.js'

const QR_TTL_MS = 2 * 60 * 1000
const PAGE_SIZE = 60
const playlistMeta = new Map()

const QR_STATUS = { 800: 'expired', 801: 'waiting', 802: 'scanned', 803: 'success' }
const QR_MESSAGE = {
  expired: '二维码已过期',
  waiting: '等待扫码中',
  scanned: '已扫码，请在 QQ 中确认',
  success: '登录成功',
}

/** One upstream search item → the legacy `results[]` entry. */
export function toLegacyResult(item) {
  const row = item ?? {}
  const mid = String(row.mid ?? row.songmid ?? '')
  if (mid === '') return null
  return {
    id: mid,
    songmid: mid,
    title: decodeEntities(row.name ?? row.title ?? row.songname ?? row.audio_name ?? ''),
    songid: row.id ?? row.songid ?? 0,
    songtype: row.type ?? row.songtype ?? 0,
    artists: Array.isArray(row.singer) ? row.singer.map((singer) => decodeEntities(singer?.name ?? '')) : [],
    album: decodeEntities(row.album?.name ?? row.albumname ?? row.album_name ?? ''),
    albummid: String(row.album?.mid ?? row.albummid ?? row.album_mid ?? ''),
    interval: Number(row.interval) || 0,
    // QQ's own payload spells it `pay.pay_play`; the camelCase form appears in older
    // responses. Both mean "this song needs VIP to play".
    payplay: Number(row.pay?.pay_play ?? row.pay?.payplay ?? row.payplay ?? 0),
    pay: row.pay,
    source: 'qq',

    // ── Full entity ──────────────────────────────────────────────────────
    durationMs: (Number(row.interval) || 0) * 1000,
    artistsDetail: Array.isArray(row.singer)
      ? row.singer.map((singer) => ({ id: String(singer?.mid ?? singer?.id ?? ''), name: decodeEntities(singer?.name ?? '') }))
      : [],
    albumDetail: {
      id: String(row.album?.id ?? ''),
      name: decodeEntities(row.album?.name ?? ''),
      coverUrl: String(row.album?.mid ?? '') === '' ? '' : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${row.album.mid}.jpg`,
      mid: String(row.album?.mid ?? ''),
      subtitle: decodeEntities(row.album?.subtitle ?? ''),
      timePublic: String(row.album?.time_public ?? ''),
    },
    aliases: row.subtitle ? [decodeEntities(row.subtitle)] : [],
    translatedNames: [],
    publishTime: Date.parse(String(row.album?.time_public ?? '')) || 0,
    popularity: Number(row.bpm) || 0,
    songType: Number(row.type) || 0,
    mvId: String(row.mv?.vid ?? row.mvid ?? ''),
    isVideo: Boolean(row.mv?.vid ?? row.mvid),
    copyright: 0,
    resourceState: null,
    noCopyright: null,
    privilegeDetail: row.pay ?? null,
    // Sizes tell us which rungs the platform actually holds.
    availableQualities: [
      ['standard', row.file?.size_128mp3],
      ['high', row.file?.size_320mp3],
      ['lossless', row.file?.size_flac],
      ['hires', row.file?.size_hires],
    ].filter(([, size]) => Number(size) > 0).map(([level]) => level),
  }
}

/** Legacy contract: `{ results, total, page }`. */
export async function search(keyword, cookie = '', page = 1) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const kw = String(keyword ?? '').trim()
  if (kw === '') return { results: [], total: 0, page: p }

  const json = await callUpstream('/search', { keyword: kw, page: p, limit: PAGE_SIZE }, { cookie })
  const items = Array.isArray(json.items) ? json.items : []
  const results = items.map(toLegacyResult).filter(Boolean)
  return {
    results,
    total: Number(json.total) || results.length,
    page: p,
  }
}

/** Folia align: the backend's /search type=album returns albummid/name/pic/singer. */
export async function searchAlbums(keyword, cookie = '', page = 1) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const kw = String(keyword ?? '').trim()
  if (kw === '') return { results: [], total: 0, page: p }
  const json = await callUpstream('/search', { keyword: kw, type: 'album', page: p, limit: 30 }, { cookie })
  const rows = Array.isArray(json.items) ? json.items : []
  const results = rows.map((row) => {
    const item = row !== null && typeof row === 'object' ? row : {}
    return {
      id: String(item.albummid ?? item.albumMid ?? ''),
      name: decodeEntities(item.name ?? ''),
      cover: String(item.pic ?? item.cover ?? ''),
      artist: decodeEntities(item.singer ?? item.artist ?? ''),
      trackCount: Number(item.song_num ?? item.songCount ?? 0) || 0,
      source: 'qq',
      type: 'album',
    }
  }).filter((album) => album.id !== '' && album.name !== '')
  return { results, total: Number(json.total) || results.length, page: p }
}

/** Folia align: the backend's /search type=playlist returns dissid/dissname/logo. */
export async function searchPlaylists(keyword, cookie = '', page = 1) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const kw = String(keyword ?? '').trim()
  if (kw === '') return { results: [], total: 0, page: p }
  const json = await callUpstream('/search', { keyword: kw, type: 'playlist', page: p, limit: 30 }, { cookie })
  const rows = Array.isArray(json.items) ? json.items : []
  const results = rows.map((row) => {
    const item = row !== null && typeof row === 'object' ? row : {}
    return {
      id: String(item.dissid ?? item.dirId ?? ''),
      name: decodeEntities(item.dissname ?? item.name ?? ''),
      cover: String(item.logo ?? item.imgurl ?? item.pic ?? ''),
      creator: decodeEntities(item.nickname ?? item.creator ?? ''),
      trackCount: Number(item.songnum ?? item.songNum ?? item.total) || 0,
      playCount: Number(item.listennum ?? item.listenNum) || 0,
      source: 'qq',
      type: 'playlist',
    }
  }).filter((playlist) => playlist.id !== '' && playlist.name !== '')
  return { results, total: Number(json.total) || results.length, page: p }
}

// ── recommendations / cloud (Folia routes) ──────────────────────────────────

function qqSongRows(json) {
  return Array.isArray(json?.songs) ? json.songs : (Array.isArray(json?.data?.songs) ? json.data.songs : [])
}

/** Folia daily 30: /user/daily-songs. It needs a signed-in account. */
export async function dailySongs(cookie = '') {
  const json = await callUpstream('/user/daily-songs', {}, { cookie })
  return qqSongRows(json).map(toLegacyResult).filter(Boolean)
}

/** Folia personal FM: /user/personal-fm?page=1. */
export async function personalFm(cookie = '') {
  const json = await callUpstream('/user/personal-fm', { page: 1 }, { cookie })
  return qqSongRows(json).map(toLegacyResult).filter(Boolean)
}

/** Folia recommended collections: /recommend/playlists. */
export async function recommendedCollections(cookie = '', limit = 30) {
  const json = await callUpstream('/recommend/playlists', { limit: Math.max(1, Math.min(60, Number(limit) || 30)) }, { cookie })
  const rows = Array.isArray(json.playlists) ? json.playlists : []
  return rows.map((row) => {
    const item = row !== null && typeof row === 'object' ? row : {}
    return {
      id: String(item.dissid ?? item.id ?? ''),
      name: decodeEntities(item.dissname ?? item.name ?? ''),
      cover: String(item.logo ?? item.imgurl ?? item.pic ?? ''),
      creator: decodeEntities(item.nickname ?? item.creator ?? ''),
      trackCount: Number(item.songnum ?? item.songNum ?? item.total) || 0,
      playCount: Number(item.listennum ?? item.listenNum) || 0,
      source: 'qq',
      type: 'playlist',
    }
  }).filter((playlist) => playlist.id !== '' && playlist.name !== '')
}

/** Folia cloud drive: /user/cloud; only rows whose song is playable. */
export async function cloudSongs(cookie = '', limit = 100, offset = 0) {
  const json = await callUpstream('/user/cloud', { limit: Math.min(1000, Math.max(1, Number(limit) || 100)), offset: Math.max(0, Number(offset) || 0) }, { cookie })
  const rows = Array.isArray(json.data) ? json.data : []
  return rows
    .filter((entry) => entry && entry.playable === true && entry.song && typeof entry.song === 'object')
    .map((entry) => toLegacyResult(entry.song))
    .filter(Boolean)
    .map((song) => ({ ...song, variant: 'cloud' }))
}

/** Folia daily-history: /user/daily-songs/history. */
export async function historyDates(cookie = '') {
  const json = await callUpstream('/user/daily-songs/history/dates', {}, { cookie })
  return (Array.isArray(json.dates) ? json.dates : []).filter((date) => typeof date === 'string' && date !== '')
}

export async function historySongs(cookie = '', date = '') {
  const day = String(date || '').trim()
  if (day === '') return []
  const json = await callUpstream('/user/daily-songs/history', { date: day }, { cookie })
  return qqSongRows(json).map(toLegacyResult).filter(Boolean)
}

/** Remove one song from an owned playlist (Folia mutations.updatePlaylistTracks). */
export async function removeFromPlaylist(song, playlistId, cookie = '') {
  const tid = String(playlistId || '').trim()
  const songId = Number(song?.songid ?? song?.id)
  if (tid === '' || !Number.isSafeInteger(songId) || songId <= 0) throw new Error('缺少歌单或歌曲 id')
  const json = await callUpstream('/user/playlist/tracks', {}, {
    cookie,
    method: 'POST',
    body: { tid, op: 'del', songs: [{ id: songId, type: 0 }] },
  })
  if (json?.changed === false) throw new Error('QQ 音乐拒绝从歌单移除歌曲')
  return true
}

/** Folia subscription status; an unknown answer means "not subscribed". */
export async function subscriptionStatus(type, id, cookie = '') {
  const key = type === 'album' ? String(id || '').trim() : String(Number(id) || '')
  if (key === '') return false
  const json = await callUpstream('/user/subscription-status', { type, ids: key }, { cookie })
  const items = Array.isArray(json.items) ? json.items : []
  return items.some((item) => String(item?.id) === key && item?.status === 'subscribed')
}

/** Folia subscribe/unsubscribe. */
export async function subscribeCollection(type, id, subscribed, cookie = '') {
  if (type === 'album') {
    const albumMid = String(id || '').trim()
    if (albumMid === '') throw new Error('缺少专辑 mid')
    const json = await callUpstream('/user/album/subscribe', {}, {
      cookie,
      method: 'POST',
      body: { id: albumMid, subscribed },
    })
    if (json?.subscribed !== subscribed) throw new Error('QQ 音乐没有确认专辑订阅')
    return true
  }
  const tid = String(id || '').trim()
  if (tid === '') throw new Error('缺少歌单 tid')
  const json = await callUpstream('/user/playlist/subscribe', {}, {
    cookie,
    method: 'POST',
    body: { tid, subscribed },
  })
  if (json?.subscribed !== subscribed) throw new Error('QQ 音乐没有确认歌单订阅')
  return true
}

/** Own playlists and the built-in liked list, from the package's `/user/playlist`. */
export async function getMyPlaylists(cookie = '') {
  const json = await callUpstream('/user/playlist', {}, { cookie })
  const rows = Array.isArray(json.playlist) ? json.playlist : []
  return rows.map((row) => {
    const dirId = Number(row.dirId) || 0
    const tid = String(row.tid ?? '')
    const id = tid || String(dirId)
    const liked = dirId === 201
    // Folia distinguishes playlists this account created (dirName) from ones it
    // favourited (name/songnum/orderTime): a favourite also carries a creator's
    // dirId, but the credential-backed owned route loses paid songs there.
    const owned = row.dirName !== undefined || row.dirname !== undefined
    playlistMeta.set(id, { dirId, tid, liked, owned })
    return {
      source: 'qq',
      id,
      name: decodeEntities(row.dirName ?? row.dirname ?? row.name ?? row.dissname ?? ''),
      cover: String(row.picUrl || row.bigpicUrl || ''),
      trackCount: Number(row.songNum ?? row.songnum ?? row.trackCount) || 0,
      creator: decodeEntities(row.nick || row.nickname || ''),
      kind: liked ? 'default' : owned ? 'own' : 'collect',
      isLike: liked,
      isDefault: liked,
    }
  })
}

/**
 * A whole-playlist read kept briefly.
 *
 * The page route has to read the whole list for a playlist it cannot page (a favourite, or an
 * id the account list does not know). Without this every "load more" downloads the entire
 * playlist again; with it a page session costs one full read.
 */
const legacyPlaylistSongsCache = new Map()
const LEGACY_PLAYLIST_TTL_MS = 30 * 1000
const LEGACY_PLAYLIST_CACHE_MAX = 24

async function legacyPlaylistSongsCached(key, cookie) {
  const hit = legacyPlaylistSongsCache.get(key)
  if (hit && Date.now() - hit.at < LEGACY_PLAYLIST_TTL_MS) return hit.value
  const value = await legacyPlaylistSongs(key, cookie)
  legacyPlaylistSongsCache.set(key, { at: Date.now(), value })
  if (legacyPlaylistSongsCache.size > LEGACY_PLAYLIST_CACHE_MAX) {
    let oldestKey = ''
    let oldestAt = Infinity
    legacyPlaylistSongsCache.forEach((entry, cacheKey) => {
      if (entry.at < oldestAt) {
        oldestAt = entry.at
        oldestKey = cacheKey
      }
    })
    if (oldestKey !== '') legacyPlaylistSongsCache.delete(oldestKey)
  }
  return value
}

/** The page API needs the tid/dirid that only the account list carries; read it once on a miss. */
async function ensurePlaylistMeta(key, cookie) {
  if (playlistMeta.has(key)) return playlistMeta.get(key)
  try {
    await getMyPlaylists(cookie)
  } catch {
    // Not signed in, or the list failed: the legacy read below is the fallback either way.
  }
  return playlistMeta.get(key)
}

const PLAYLIST_PAGE_SIZE = 100
const PLAYLIST_MAX_PAGES = 100

/** Stable identity for one upstream song row; only used to stop duplicate pages. */
function playlistRowId(row) {
  return String(row?.mid ?? row?.songmid ?? row?.id ?? row?.songid ?? '')
}

/**
 * Folia's owned-playlist read is a page, not the whole list: the backend caps
 * `limit` at 100, and the caller advances `offset` until the total is covered.
 * The Host's legacy API returns one array, so this collects those pages here.
 */
export async function getPlaylistSongs(id, cookie = '') {
  const key = String(id ?? '')
  const meta = playlistMeta.get(key)
  // Favourites and public playlists stay on the anonymous route: Folia found the
  // credential-backed route drops paid songs from a favourite and lowers its total.
  if (!meta || meta.owned !== true) return await legacyPlaylistSongs(key, cookie)

  if (meta.liked) {
    const songs = []
    const seen = new Set()
    let offset = 0
    let total = 0
    for (let pageNumber = 0; pageNumber < PLAYLIST_MAX_PAGES; pageNumber += 1) {
      const page = await callUpstream('/user/liked-songs', { limit: PLAYLIST_PAGE_SIZE, offset }, { cookie })
      const rows = Array.isArray(page.songs) ? page.songs : []
      const pageTotal = Number(page.total)
      if (Number.isFinite(pageTotal) && pageTotal > 0) total = pageTotal
      let added = 0
      for (const row of rows) {
        const rowId = playlistRowId(row)
        if (rowId !== '' && seen.has(rowId)) continue
        if (rowId !== '') seen.add(rowId)
        songs.push(row)
        added += 1
      }
      if (rows.length === 0 || added === 0) break
      offset += rows.length
      const more = page.more === true || (total > 0 ? offset < total : rows.length >= PLAYLIST_PAGE_SIZE)
      if (!more) break
    }
    return {
      name: '我喜欢',
      cover: '',
      trackCount: total || songs.length,
      songs: songs.map(toLegacyResult).filter(Boolean),
    }
  }

  if (meta.tid === '') throw new Error('QQ playlist has no tid')
  const songs = []
  const seen = new Set()
  let offset = 0
  let total = 0
  for (let pageNumber = 0; pageNumber < PLAYLIST_MAX_PAGES; pageNumber += 1) {
    const page = await callUpstream('/user/playlist-detail', {
      tid: meta.tid,
      dirid: meta.dirId,
      offset,
      limit: PLAYLIST_PAGE_SIZE,
    }, { cookie })
    const rows = Array.isArray(page.songs) ? page.songs : []
    const pageTotal = Number(page.total)
    if (Number.isFinite(pageTotal) && pageTotal > 0) total = pageTotal
    let added = 0
    for (const row of rows) {
      const rowId = playlistRowId(row)
      if (rowId !== '' && seen.has(rowId)) continue
      if (rowId !== '') seen.add(rowId)
      songs.push(row)
      added += 1
    }
    if (rows.length === 0 || added === 0) break
    offset += rows.length
    // A full page with no total is not the end; a total is the authoritative stop.
    const more = page.more === true || (total > 0 ? offset < total : rows.length >= PLAYLIST_PAGE_SIZE)
    if (!more) break
  }
  return {
    name: '',
    cover: '',
    trackCount: total || songs.length,
    songs: songs.map(toLegacyResult).filter(Boolean),
  }
}

/** One page of an owned/liked playlist; the Host route returns pages, not summaries. */
export async function getPlaylistSongsPage(id, limit = 100, offset = 0, cookie = '') {
  const key = String(id ?? '')
  const size = Math.max(1, Math.min(200, parseInt(limit, 10) || 100))
  const at = Math.max(0, parseInt(offset, 10) || 0)
  const meta = await ensurePlaylistMeta(key, cookie)
  if (!meta || meta.owned !== true) {
    const full = await legacyPlaylistSongsCached(key, cookie)
    const songs = (full.songs || []).slice(at, at + size)
    return {
      name: full.name || '',
      cover: full.cover || '',
      trackCount: Number(full.trackCount) || (full.songs || []).length,
      songs,
      hasMore: at + songs.length < (full.songs || []).length,
      nextOffset: at + songs.length,
    }
  }
  if (meta.liked) {
    const page = await callUpstream('/user/liked-songs', { limit: size, offset: at }, { cookie })
    const rows = Array.isArray(page.songs) ? page.songs : []
    const total = Number(page.total) || 0
    return {
      name: '我喜欢', cover: '', trackCount: total || rows.length,
      songs: rows.map(toLegacyResult).filter(Boolean),
      hasMore: page.more === true || (total > 0 && at + rows.length < total),
      nextOffset: at + rows.length,
    }
  }
  if (meta.tid === '') throw new Error('QQ playlist has no tid')
  const page = await callUpstream('/user/playlist-detail', {
    tid: meta.tid, dirid: meta.dirId, offset: at, limit: size,
  }, { cookie })
  const rows = Array.isArray(page.songs) ? page.songs : []
  const total = Number(page.total) || 0
  return {
    name: '', cover: '', trackCount: total || rows.length,
    songs: rows.map(toLegacyResult).filter(Boolean),
    hasMore: page.more === true || (total > 0 && at + rows.length < total),
    nextOffset: at + rows.length,
  }
}

/** Legacy contract: `{ mids, songids }` for the liked songs. */
export async function getQQFavIds(cookie = '') {
  const mids = []
  const songids = []
  let offset = 0
  while (offset < 10000) {
    const page = await callUpstream('/user/liked-songs', { limit: 100, offset }, { cookie })
    const rows = Array.isArray(page.songs) ? page.songs : []
    for (const row of rows) {
      const mid = String(row.mid ?? row.songmid ?? '')
      if (mid !== '') mids.push(mid)
      if (Number(row.id)) songids.push(Number(row.id))
    }
    if (page.more !== true || rows.length === 0) break
    offset += rows.length
  }
  return { mids, songids }
}

async function setQqLiked(song, liked, cookie) {
  const mid = String(song?.songmid ?? song?.mid ?? '')
  const id = Number(song?.songid ?? song?.id ?? 0)
  if (mid === '' || !Number.isFinite(id) || id <= 0) throw new Error('QQ 喜欢写入缺少 songmid/songid')
  const response = await callUpstream('/user/song/like', {}, {
    cookie,
    method: 'POST',
    body: { song: { id, mid, type: 0 }, liked },
  })
  if (response?.liked !== liked) throw new Error('QQ 没有确认喜欢写入')
  return true
}

export async function addQQFav(song, cookie = '') {
  return await setQqLiked(song, true, cookie)
}

export async function removeQQFav(song, cookie = '') {
  return await setQqLiked(song, false, cookie)
}

/** Folia's QQ quality ladder: API tokens, not the semantic preference names. */
const QQ_QUALITY_FALLBACKS = {
  standard: ['128'],
  high: ['320', '128'],
  lossless: ['flac', '320', '128'],
  hires: ['flac', '320', '128'],
}

/** Legacy contract: `{ url, filename }`; an empty url means "not playable". */
export async function getDownloadURL(songmid, cookie = '', qualityOrVip = 'lossless') {
  const mid = String(songmid ?? '').trim()
  if (mid === '') throw new Error('bad song id')

  // Keep the historical boolean form working.
  const quality = typeof qualityOrVip === 'boolean'
    ? (qualityOrVip ? 'lossless' : 'standard')
    : String(qualityOrVip || 'lossless')

  // Folia asks QQ from the requested level down: 128 / 320 / flac, never the
  // semantic words "high"/"lossless". A level that answers without a URL is not
  // the end of the song; try the next one before giving up.
  const tiers = QQ_QUALITY_FALLBACKS[quality] || QQ_QUALITY_FALLBACKS.lossless
  let firstError = null
  for (const apiQuality of tiers) {
    try {
      const json = await callUpstream(`/getMusicPlay/${encodeURIComponent(mid)}`, { quality: apiQuality }, { cookie })
      const entry = json?.data?.playUrl?.[mid] ?? Object.values(json?.data?.playUrl || {})[0] ?? {}
      if (typeof entry.url === 'string' && entry.url !== '') {
        return {
          url: entry.url,
          filename: '',
          preview: entry.preview === true,
        }
      }
    } catch (error) {
      if (error && error.code === 'auth-required') throw error
      firstError = firstError || error
    }
  }
  if (cookie !== '') {
    try {
      const previewJson = await callUpstream(`/getMusicPlay/${encodeURIComponent(mid)}`, { quality: 'standard', preview: 1 }, { cookie })
      const previewEntry = previewJson?.data?.playUrl?.[mid]
        ?? Object.values(previewJson?.data?.playUrl || {})[0]
        ?? {}
      if (typeof previewEntry.url === 'string' && previewEntry.url !== '') {
        return {
          url: previewEntry.url,
          filename: '',
          preview: previewEntry.preview === true,
        }
      }
    } catch {
      // No preview is the same answer as no stream.
    }
  }
  if (firstError !== null) throw firstError
  return {
    url: '',
    filename: '',
    preview: false,
  }
}

/** Legacy contract: `{ lyric, trans }`. */
export async function getLyric(songmid, cookie = '') {
  const mid = String(songmid ?? '').trim()
  if (mid === '') throw new Error('bad song id')

  const json = await callUpstream('/getLyric', { songmid: mid }, { cookie })
  const payload = json.response ?? json.data ?? json
  const lyric = typeof payload.lyric === 'string' ? decodeEntities(payload.lyric) : ''
  if (lyric === '') throw new Error('未获取到歌词')
  return {
    lyric,
    trans: typeof payload.trans === 'string' ? decodeEntities(payload.trans) : '',
  }
}

/** Legacy contract: `{ source, key, imageDataUrl, expiresAt, extra }`. */
export async function createQRLogin() {
  return await createQrLogin('qq')
}

/** WeChat is the other package channel; it must not use the legacy wx endpoints. */
export async function createWXQRLogin() {
  return await createQrLogin('wechat')
}

async function createQrLogin(channel) {
  const keyJson = await callUpstream('/login/qr/key', { channel })
  const key = String(keyJson.data?.unikey ?? '')
  if (key === '') throw new Error('qq qr key missing')

  const created = await callUpstream('/login/qr/create', { key, qrimg: true })
  const imageDataUrl = String(created.data?.qrimg ?? '')
  const url = String(created.data?.qrurl ?? '')
  return {
    source: 'qq',
    key,
    imageDataUrl,
    url,
    expiresAt: Date.now() + QR_TTL_MS,
    extra: { unikey: key },
  }
}

/** Legacy contract: `{ source, key, status, message, extra, cookie? }`. */
export async function checkQRLogin(keyStr) {
  return await checkQrLogin(keyStr)
}

export async function checkWXQRLogin(keyStr) {
  return await checkQrLogin(keyStr)
}

async function checkQrLogin(keyStr) {
  const key = String(keyStr ?? '').trim()
  if (key === '') throw new Error('qq qr login key missing')

  // The poll answers 800–803 as the scan state; the generic success gate would
  // throw on every *waiting* answer and surface as "platform refused the login".
  const json = await callUpstream('/login/qr/check', { key }, { skipCodeCheck: true, includeHeaders: true })
  const status = QR_STATUS[Number(json.code)] ?? 'failed'
  // The package names the reason it recognised (loginHints): device limit, rate
  // limited, wrong scan app, restricted account. Carry it through so the login window
  // can say which one it was instead of "refused".
  const hint = json.failureHint !== null && typeof json.failureHint === 'object' ? json.failureHint : null
  const result = {
    source: 'qq',
    key,
    status,
    message: QR_MESSAGE[status] ?? String(json.message ?? '状态未知'),
    extra: {
      code: Number(json.code),
      hint: hint === null ? '' : String(hint.key ?? ''),
      hintMessage: hint === null ? '' : String(hint.message ?? ''),
      failureStage: String(json.failureStage ?? ''),
      failureReason: String(json.failureReason ?? ''),
      retryAfterMs: Number(json.retryAfterMs) || 0,
    },
  }
  if (status !== 'success') return result

  const bodyCookie = typeof json.cookie === 'string' ? json.cookie.trim() : ''
  // Node stores the session in the package repository; serverless/other builds may
  // return the sealed credential as the `qqmusic_session` Set-Cookie instead.
  const setCookies = Array.isArray(json.__setCookie) ? json.__setCookie : []
  const sealed = setCookies
    .map((line) => /(?:^|;\s*)qqmusic_session=([^;]+)/.exec(String(line)))
    .find((match) => match && match[1] !== '')
  const cookie = [bodyCookie, sealed ? 'qqmusic_session=' + sealed[1] : '']
    .filter((part) => part !== '')
    .join('; ')
  if (cookie === '') {
    result.status = 'failed'
    result.message = '登录成功但未取到 cookie，请重试'
    return result
  }
  result.cookie = cookie
  return result
}
