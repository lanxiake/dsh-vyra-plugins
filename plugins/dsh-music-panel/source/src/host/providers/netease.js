/**
 * NetEase transport, served by the upstream API package.
 *
 * This module **replaces** the hand-written protocol for the endpoints that carry
 * the product: search, stream URL, lyrics, QR login, account, playlists and
 * albums. Everything not migrated yet is re-exported unchanged from
 * `netease-legacy.js` via `export *` — explicit exports below win over the star,
 * so callers keep seeing one flat module with the same function names and the
 * same return shapes.
 *
 * Why upstream: signing/encryption is maintained by people who chase it; we only
 * adapt shapes. The endpoints are the documented NeteaseCloudMusicApi routes that
 * `services/netease-api.js` serves locally.
 *
 * @module dsh-music-panel/providers/netease
 */

export * from './netease-legacy.js'

import { callUpstream } from '../services/netease-api.js'
import { normalizeSong } from './netease-legacy.js'

const ANON = ''

/**
 * Folia registers an anonymous account when nobody is signed in and reuses that
 * cookie for every data request; NetEase answers differently with a cookie than
 * without one. Login/status endpoints are deliberately excluded (as Folia does),
 * otherwise a stale anonymous cookie would mask a real sign-in state.
 */
let anonymousCookieCache = ''

async function anonymousCookie() {
  if (anonymousCookieCache !== '') return anonymousCookieCache
  try {
    const json = await callUpstream('/register/anonimous', { timestamp: Date.now() }, {})
    const value = typeof json?.cookie === 'string' ? json.cookie : ''
    if (value !== '') anonymousCookieCache = value
  } catch {
    // Registration failing is not fatal: the request just goes out without a cookie.
  }
  return anonymousCookieCache
}

/** Cookie for data endpoints: the real sign-in, else the anonymous account. */
async function dataCookie(cookie) {
  if (typeof cookie === 'string' && cookie !== '') return cookie
  return await anonymousCookie()
}
const QR_TTL_MS = 5 * 60 * 1000

/** Upstream quality names, lowest first. */
const LEVEL_OF_QUALITY = {
  standard: 'standard',
  high: 'exhigh',
  lossless: 'lossless',
  hires: 'hires',
}

/** Human labels kept identical to the legacy module. */
const QUALITY_LABELS = {
  standard: '标准',
  higher: '高音质',
  exhigh: '高音质',
  lossless: '无损',
  hires: '无损',
  jyeffect: '无损',
  jymaster: '无损',
}

const QR_STATUS = { 800: 'expired', 801: 'waiting', 802: 'scanned', 803: 'success' }
const QR_MESSAGE = {
  expired: '二维码已过期',
  waiting: '等待扫码中',
  scanned: '已扫码，请在网易云音乐 App 中确认',
  success: '登录成功',
}

const META_TAG = /<\/?em(?:\s[^>]*)?>/gi

/** Strip the `<em>` markup upstream adds to matched terms. */
export function plain(value) {
  return String(value ?? '').replace(META_TAG, '').trim()
}

/**
 * Map one upstream song onto the shape the rest of the plugin expects.
 *
 * Upstream answers the modern shape (`ar` / `al` / `dt`) on most routes but the
 * old shape (`artists` / `album` / `duration`) on a few; both are accepted.
 */
export function songOf(row) {
  if (row === null || typeof row !== 'object') return null
  const modern = row.ar !== undefined || row.al !== undefined || row.dt !== undefined
  const shaped = modern
    ? row
    : {
        id: row.id,
        name: row.name,
        ar: row.artists,
        al: row.album && typeof row.album === 'object' ? row.album : undefined,
        dt: row.duration,
        fee: row.fee,
        privilege: row.privilege,
      }
  const song = normalizeSong(shaped)
  return song.id === '' ? null : song
}

/** Same shape as the legacy `normalizePlaylistItem`. */
function playlistOf(item) {
  const row = item ?? {}
  return {
    id: String(row.id ?? ''),
    name: plain(row.name),
    cover: plain(row.coverImgUrl || row.picUrl),
    playCount: Number(row.playCount) || 0,
    trackCount: Number(row.trackCount) || 0,
    creator: plain(row.creator?.nickname || row.copywriter),
    description: plain(row.description || row.copywriter),
    source: 'nc',
    link: row.id ? `https://music.163.com/#/playlist?id=${row.id}` : '',
  }
}

function requireSongId(id) {
  const value = String(id ?? '').trim()
  if (!/^[0-9]+$/.test(value)) throw new Error('bad song id')
  return value
}

// ── search ──────────────────────────────────────────────────────────────────

/** Same contract as the legacy `search`: `{ results, total, page }`. */
export async function search(keyword, cookie = '', page = 1, type = 1) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const limit = 30
  const kw = String(keyword ?? '').trim()
  if (kw === '') return { results: [], total: 0, page: p }

  const json = await callUpstream(
    '/cloudsearch',
    { keywords: kw, type, limit, offset: (p - 1) * limit },
    { cookie: await dataCookie(cookie) },
  )
  const result = json.result ?? {}
  const rows = Array.isArray(result.songs) ? result.songs : []
  return {
    results: rows.map(songOf).filter(Boolean),
    total: Number(result.songCount) || rows.length,
    page: p,
  }
}

// ── recommendations / cloud (Folia routes) ──────────────────────────────────

function dailyRows(json) {
  const data = json && typeof json.data === 'object' ? json.data : {}
  return data.dailySongs || data.songs || (json.recommendData && json.recommendData.dailySongs) || json.songs || []
}

/** Folia daily 30: /recommend/songs; afresh asks the platform for another pick. */
export async function dailySongs(cookie = '', refresh = false) {
  const json = await callUpstream(
    '/recommend/songs',
    { afresh: refresh ? 1 : 0, timestamp: Date.now() },
    { cookie: await dataCookie(cookie) },
  )
  return dailyRows(json).map((row) => normalizeSong(row)).filter(Boolean)
}

/** Folia personal FM: /personal_fm (the platform returns a few tracks per call). */
export async function personalFm(cookie = '') {
  const json = await callUpstream('/personal_fm', { timestamp: Date.now() }, { cookie: await dataCookie(cookie) })
  const rows = Array.isArray(json.data) ? json.data : (Array.isArray(json.result) ? json.result : [])
  return rows.map((row) => normalizeSong(row)).filter(Boolean)
}

/** Folia recommended collections: /personalized. */
export async function recommendedCollections(cookie = '', limit = 30) {
  const json = await callUpstream('/personalized', { limit: Math.max(1, Math.min(100, Number(limit) || 30)) }, { cookie: await dataCookie(cookie) })
  const rows = Array.isArray(json.result) ? json.result : []
  return rows.map(playlistOf).filter((playlist) => playlist.id !== '')
}

/** Folia cloud drive: /user/cloud; the rows are ordinary songs. */
export async function cloudSongs(cookie = '', limit = 200, offset = 0) {
  const json = await callUpstream('/user/cloud', { limit: Number(limit) || 200, offset: Number(offset) || 0 }, { cookie: await dataCookie(cookie) })
  const rows = Array.isArray(json.data) ? json.data : (Array.isArray(json.songs) ? json.songs : [])
  return rows.map((row) => normalizeSong(row.simpleSong || row)).filter(Boolean).map((song) => ({ ...song, variant: 'cloud' }))
}

/** Folia daily-history dates: /history/recommend/songs. */
export async function historyDates(cookie = '') {
  const json = await callUpstream('/history/recommend/songs', { timestamp: Date.now() }, { cookie: await dataCookie(cookie) })
  const rows = Array.isArray(json.data?.dates) ? json.data.dates : (Array.isArray(json.dates) ? json.dates : [])
  return rows.map((row) => (typeof row === 'string' ? row : row?.date)).filter((date) => typeof date === 'string' && date !== '')
}

/** Folia daily-history songs for one date. */
export async function historySongs(cookie = '', date = '') {
  const day = String(date || '').trim()
  if (day === '') return []
  const json = await callUpstream('/history/recommend/songs/detail', { date: day, timestamp: Date.now() }, { cookie: await dataCookie(cookie) })
  return dailyRows(json).map((row) => normalizeSong(row)).filter(Boolean)
}

/** Remove one song from an owned playlist (Folia mutations.updatePlaylistTracks). */
export async function removeFromPlaylist(song, playlistId, cookie = '') {
  const pid = String(playlistId || '').trim()
  const trackId = String(song?.id ?? song?.onlineId ?? '').trim()
  if (!/^[0-9]+$/.test(pid) || !/^[0-9]+$/.test(trackId)) throw new Error('缺少歌单或歌曲 id')
  const json = await callUpstream('/playlist/tracks', {
    op: 'del',
    pid,
    tracks: trackId,
    timestamp: Date.now(),
  }, { cookie: await dataCookie(cookie) })
  const code = Number(json?.body?.code ?? json?.code ?? 200)
  if (code !== 200) throw new Error('网易云拒绝从歌单移除歌曲（code=' + code + '）')
  return true
}

/** Folia subscription status for an album/playlist. */
export async function subscriptionStatus(type, id, cookie = '') {
  const key = String(id || '').trim()
  if (!/^[0-9]+$/.test(key)) return false
  const route = type === 'album' ? '/album/detail/dynamic' : '/playlist/detail/dynamic'
  const json = await callUpstream(route, { id: key }, { cookie: await dataCookie(cookie) })
  return type === 'album' ? Boolean(json.isSub) : Boolean(json.subscribed)
}

/** Folia subscribe/unsubscribe for an album/playlist. */
export async function subscribeCollection(type, id, subscribed, cookie = '') {
  const key = String(id || '').trim()
  if (!/^[0-9]+$/.test(key)) throw new Error('缺少专辑/歌单 id')
  const route = type === 'album' ? '/album/sub' : '/playlist/subscribe'
  const json = await callUpstream(route, { id: key, t: subscribed ? 1 : 2 }, { cookie: await dataCookie(cookie) })
  const code = Number(json?.code ?? 200)
  if (code !== 200) throw new Error('网易云拒绝订阅操作（code=' + code + '）')
  return true
}

// ── artist ──────────────────────────────────────────────────────────────────

const ARTIST_ID_CACHE = new Map()
const ARTIST_ID_CACHE_MAX = 400

/** One album row from upstream cloud search (type 10). */
function albumOf(row) {
  const item = row !== null && typeof row === 'object' ? row : {}
  const artist = Array.isArray(item.artists) && item.artists[0]
    ? plain(item.artists[0].name)
    : plain(item.artist?.name || item.artist)
  return {
    id: String(item.id ?? ''),
    name: plain(item.name),
    cover: plain(item.picUrl || item.pic || item.cover),
    artist,
    trackCount: Number(item.size ?? item.songCount) || 0,
    source: 'netease',
    type: 'album',
  }
}

/** Folia's cloud-search type 10: albums in the same request shape as songs. */
export async function searchAlbums(keyword, cookie = '', page = 1) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const limit = 30
  const kw = String(keyword ?? '').trim()
  if (kw === '') return { results: [], total: 0, page: p }
  const json = await callUpstream(
    '/cloudsearch',
    { keywords: kw, type: 10, limit, offset: (p - 1) * limit },
    { cookie: await dataCookie(cookie) },
  )
  const result = json.result ?? {}
  const rows = Array.isArray(result.albums) ? result.albums : []
  return {
    results: rows.map(albumOf).filter((album) => album.id !== '' && album.name !== ''),
    total: Number(result.albumCount) || rows.length,
    page: p,
  }
}

/** Folia's cloud-search type 1000: public playlists. */
export async function searchPlaylists(keyword, cookie = '', page = 1) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const limit = 30
  const kw = String(keyword ?? '').trim()
  if (kw === '') return { results: [], total: 0, page: p }
  const json = await callUpstream(
    '/cloudsearch',
    { keywords: kw, type: 1000, limit, offset: (p - 1) * limit },
    { cookie: await dataCookie(cookie) },
  )
  const result = json.result ?? {}
  const rows = Array.isArray(result.playlists) ? result.playlists : []
  return {
    results: rows.map(playlistOf).filter((playlist) => playlist.id !== ''),
    total: Number(result.playlistCount) || rows.length,
    page: p,
  }
}

/**
 * Artist id for a name.
 *
 * Folia's artist page is opened from a song and already carries the artist id, so
 * it never searches by name. When a caller has no id (a name typed in, an old
 * queue entry), one artist-typed search resolves it and the answer is cached.
 */
export async function findArtistId(name, cookie = '') {
  const keyword = String(name ?? '').trim()
  if (keyword === '') return ''
  const key = keyword.toLowerCase()
  const cached = ARTIST_ID_CACHE.get(key)
  if (cached !== undefined) return cached
  const json = await callUpstream(
    '/search',
    { keywords: keyword, type: 100, limit: 10 },
    { cookie: await dataCookie(cookie) },
  )
  const rows = Array.isArray(json.result?.artists) ? json.result.artists : []
  const exact = rows.find((row) => String(row?.name ?? '').trim().toLowerCase() === key) || rows[0]
  const id = String(exact?.id ?? '')
  if (/^[0-9]+$/.test(id)) {
    if (ARTIST_ID_CACHE.size >= ARTIST_ID_CACHE_MAX) {
      ARTIST_ID_CACHE.delete(ARTIST_ID_CACHE.keys().next().value)
    }
    ARTIST_ID_CACHE.set(key, id)
    return id
  }
  return ''
}

/**
 * The artist's songs by id — Folia's `getArtistSongs` (`/artist/songs`).
 *
 * One request for the whole first page. The old path paged a *name search* up to
 * ten times in sequence, which is why the artist page felt slow.
 */
export async function getArtistSongs(id, cookie = '', options = {}) {
  const artistId = String(id ?? '').trim()
  if (!/^[0-9]+$/.test(artistId)) throw new Error('bad artist id')
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 200))
  const offset = Math.max(0, Number(options.offset) || 0)
  const order = options.order === 'time' ? 'time' : 'hot'
  const json = await callUpstream(
    '/artist/songs',
    { id: artistId, limit, offset, order },
    { cookie: await dataCookie(cookie) },
  )
  const rows = Array.isArray(json.songs) ? json.songs : []
  return {
    songs: rows.map(songOf).filter(Boolean),
    more: json.more === true,
    total: Number(json.total) || rows.length,
  }
}

// ── playback ────────────────────────────────────────────────────────────────

/** Same contract as the legacy `getDownloadURL`. */
/**
 * Chorus window (`/song/chorus`) — Folia uses it to jump to the hook and to
 * highlight it. Times are milliseconds from the platform.
 */
export async function getChorus(id, cookie = '') {
  const songId = requireSongId(id)
  // The chorus endpoint only gets a real sign-in: an anonymous cookie makes it
  // answer empty (verified with and without one).
  const json = await callUpstream('/song/chorus', { id: songId }, { cookie })
  const entry = Array.isArray(json.chorus) ? json.chorus[0] : null
  if (entry === null) return null
  const startMs = Number(entry.startTime) || 0
  const endMs = Number(entry.endTime) || 0
  return {
    startMs,
    endMs,
    startSec: startMs / 1000,
    endSec: endMs / 1000,
    locked: Number(entry.ugcLocked) === 1,
  }
}

export async function getDownloadURL(id, cookie = '', quality = 'lossless') {
  const songId = requireSongId(id)
  const level = LEVEL_OF_QUALITY[quality] ?? 'exhigh'
  const json = await callUpstream('/song/url/v1', { id: songId, level, randomCNIP: true, https: true }, { cookie: await dataCookie(cookie) })
  const entry = json.data?.[0] ?? {}
  const gain = Number(entry.gain)
  return {
    id: songId,
    url: typeof entry.url === 'string' ? entry.url : '',
    trackGain: Number.isFinite(gain) ? gain : null,
    level: entry.level ?? '',
    br: Number(entry.br) || 0,
    fee: Number(entry.fee) || 0,
    code: Number(entry.code) || 0,
    freeTrialInfo: entry.freeTrialInfo ?? null,
    quality: QUALITY_LABELS[entry.level] ?? '',
  }
}

// ── lyrics ──────────────────────────────────────────────────────────────────

/** Same contract as the legacy `getLyric`: `{ lyric, trans, roma, yrc }`. */
/** Same `[mm:ss.mmm]` formatting the provider layer uses for LRC lines. */
function lrcTime(t) {
  const seconds = Math.max(0, t)
  const minutes = Math.floor(seconds / 60)
  const rest = (seconds % 60).toFixed(3)
  return '[' + String(minutes).padStart(2, '0') + ':' + (rest.length < 6 ? '0' + rest : rest) + ']'
}

/**
 * `/lyric/new` answers its `lrc` as newline-delimited JSON:
 *   {"t":24810,"c":[{"tx":"晴天"},{"tx":"周杰伦","li":"…jpg","or":"orpheus://…"}]}
 * One document per lyric line. `yrc` uses the classic `[start,dur](wordStart,wordDur,pad)text`
 * form when the track has word-level timing.
 */
function lrcFromRichJson(raw) {
  const out = []
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const text = line.trim()
    if (text === '') continue
    if (!text.startsWith('{')) {
      out.push(text)
      continue
    }
    let doc
    try {
      doc = JSON.parse(text)
    } catch {
      continue
    }
    const at = Number(doc?.t)
    const content = (Array.isArray(doc?.c) ? doc.c : [])
      .map((segment) => String(segment?.tx ?? ''))
      .join('')
    if (!Number.isFinite(at)) continue
    out.push(lrcTime(at / 1000) + content)
  }
  return out.join('\n')
}

export async function getLyric(id, cookie = '') {
  const songId = requireSongId(id)
  // Same route Folia uses: one request returns the word-level `yrc` and the rich
  // `lrc` (credits with links), which the classic `/lyric` route cannot provide.
  let payload = null
  try {
    payload = await callUpstream('/lyric/new', { id: songId }, { cookie: await dataCookie(cookie) })
  } catch {
    payload = await callUpstream('/lyric', { id: songId }, { cookie: await dataCookie(cookie) })
  }
  const richOrLrc = payload.lrc?.lyric ?? payload.lyric ?? ''
  const lyric = richOrLrc.includes('{"t"') || richOrLrc.trim().startsWith('{') ? lrcFromRichJson(richOrLrc) : richOrLrc
  const yrc = payload.yrc?.lyric ?? ''
  if (lyric === '' && yrc === '') throw new Error('未获取到歌词')
  return {
    lyric,
    trans: payload.tlyric?.lyric ?? '',
    roma: payload.romalrc?.lyric ?? '',
    yrc,
  }
}

// ── QR login ────────────────────────────────────────────────────────────────

/** Same contract as the legacy `createQRLogin`. */
export async function createQRLogin() {
  const keyJson = await callUpstream('/login/qr/key', {})
  const key = String(keyJson.data?.unikey ?? '')
  if (key === '') throw new Error('网易云出码失败')

  const created = await callUpstream('/login/qr/create', { key, qrimg: true })
  const url = String(created.data?.qrurl ?? '')
  const imageDataUrl = String(created.data?.qrimg ?? '')
  return {
    source: 'nc',
    key,
    url,
    imageDataUrl,
    expiresAt: Date.now() + QR_TTL_MS,
    extra: { codekey: key },
  }
}

/** Same contract as the legacy `checkQRLogin`. */
export async function checkQRLogin(keyStr) {
  const key = String(keyStr ?? '').trim()
  if (key === '') throw new Error('网易云扫码 key 缺失')

  // Same as QQ: 800/801/802/803 is the scan state, not an error code.
  const json = await callUpstream('/login/qr/check', { key, noCookie: true }, { skipCodeCheck: true })
  const status = QR_STATUS[Number(json.code)] ?? 'failed'
  const result = {
    source: 'nc',
    key,
    status,
    message: QR_MESSAGE[status] ?? String(json.message ?? '状态未知'),
    extra: { code: Number(json.code) },
  }
  if (status !== 'success') return result

  const cookie = String(json.cookie ?? json.data?.cookie ?? '').trim()
  if (cookie === '') {
    result.status = 'failed'
    result.message = '登录成功但未取到 cookie，请重试'
    return result
  }
  result.cookie = cookie
  return result
}

// ── account ─────────────────────────────────────────────────────────────────

/** Same contract as the legacy `getAccount` (null when not signed in). */
export async function getAccount(cookie = '') {
  if (!cookie) return null
  let json
  try {
    json = await callUpstream('/user/account', {}, { cookie })
  } catch (error) {
    // A stale cookie must read as "not signed in", not as a broken provider.
    if (error?.code === 'auth-required') return null
    throw error
  }
  const profile = json.profile
  if (profile === undefined || profile === null || !profile.userId) return null
  return {
    userId: String(profile.userId),
    nickname: profile.nickname ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    vipType: Number(profile.vipType) || 0,
    account: json.account ?? null,
  }
}

/** Same contract as the legacy `getMyPlaylists`. */
export async function getMyPlaylists(cookie = '', page = 1, pagesize = 100) {
  if (!cookie) throw new Error('未登录，无法读取我的歌单')
  const account = await getAccount(cookie)
  if (account === null) throw new Error('登录态已失效，请重新扫码登录')

  const p = Math.max(1, parseInt(page, 10) || 1)
  const n = Math.max(1, Math.min(100, parseInt(pagesize, 10) || 100))
  const json = await callUpstream(
    '/user/playlist',
    { uid: Number(account.userId) || 0, limit: n, offset: (p - 1) * n },
    { cookie },
  )
  const rows = Array.isArray(json.playlist) ? json.playlist : []
  return rows.map((row, index) => {
    const item = playlistOf(row)
    return {
      ...item,
      kind: index === 0 ? 'default' : row.subscribed === true ? 'collect' : 'own',
      isLike: index === 0,
    }
  })
}

const PLAYLIST_META_TTL = 5 * 60 * 1000
const playlistMetaCache = new Map()

async function playlistMeta(id, cookie) {
  const hit = playlistMetaCache.get(id)
  if (hit && Date.now() - hit.at < PLAYLIST_META_TTL) return hit.meta
  const json = await callUpstream('/playlist/detail', { id, n: 1, s: 8 }, { cookie })
  const playlist = json.playlist || {}
  const meta = {
    name: plain(playlist.name),
    cover: plain(playlist.coverImgUrl),
    trackCount: Number(playlist.trackCount) || 0,
  }
  playlistMetaCache.set(id, { at: Date.now(), meta })
  return meta
}

/** Pageable playlist read; Folia's getPlaylistTracks(limit, offset). */
export async function getPlaylistSongsPage(id, limit = 100, offset = 0, cookie = '') {
  const playlistId = String(id ?? '').trim()
  if (!/^[0-9]+$/.test(playlistId)) throw new Error('bad playlist id')
  const requestCookie = await dataCookie(cookie)
  const meta = await playlistMeta(playlistId, requestCookie)
  const size = Math.max(1, Math.min(1000, parseInt(limit, 10) || 100))
  const at = Math.max(0, parseInt(offset, 10) || 0)
  const page = await callUpstream(
    '/playlist/track/all',
    { id: playlistId, limit: size, offset: at },
    { cookie: requestCookie },
  )
  const songs = (Array.isArray(page.songs) ? page.songs : []).map(songOf).filter(Boolean)
  const trackCount = meta.trackCount || songs.length
  return {
    name: meta.name,
    cover: meta.cover,
    trackCount,
    songs,
    hasMore: at + songs.length < trackCount || (trackCount === 0 && songs.length === size),
    nextOffset: at + songs.length,
  }
}

/** Same contract as the legacy `getPlaylistSongs`. */
export async function getPlaylistSongs(id, cookie = '') {
  const playlistId = String(id ?? '').trim()
  if (!/^[0-9]+$/.test(playlistId)) throw new Error('bad playlist id')

  const requestCookie = await dataCookie(cookie)
  const json = await callUpstream(
    '/playlist/detail',
    { id: playlistId, n: 1000, s: 8 },
    { cookie: requestCookie },
  )
  const playlist = json.playlist ?? {}
  let songs = Array.isArray(playlist.tracks) ? playlist.tracks.map(songOf).filter(Boolean) : []
  const trackCount = Number(playlist.trackCount) || 0

  // Detail omits tracks past its first page. Read the paged route until the
  // playlist's own trackCount is reached: one 1000-track request is a page, not
  // the whole playlist. Folia does the same paging at the provider boundary;
  // this host route returns one list, so it drains the pages here.
  if (trackCount === 0 || songs.length < trackCount) {
    try {
      const pageSize = 500
      const full = []
      let offset = 0
      while (trackCount === 0 || offset < trackCount) {
        const page = await callUpstream(
          '/playlist/track/all',
          { id: playlistId, limit: pageSize, offset },
          { cookie: requestCookie },
        )
        const batch = (Array.isArray(page.songs) ? page.songs : []).map(songOf).filter(Boolean)
        if (batch.length === 0) break
        full.push(...batch)
        offset += batch.length
        if (batch.length < pageSize) break
        // A defensive stop; a malformed trackCount must not become an endless
        // series of upstream requests.
        if (offset >= 100000) break
      }
      if (full.length > songs.length) songs = full
    } catch {
      // Keep what the detail route already returned.
    }
  }

  return {
    id: playlistId,
    name: plain(playlist.name),
    creator: plain(playlist.creator?.nickname),
    description: plain(playlist.description),
    cover: plain(playlist.coverImgUrl),
    trackCount: Number(playlist.trackCount) || songs.length,
    playCount: Number(playlist.playCount) || 0,
    source: 'nc',
    link: `https://music.163.com/#/playlist?id=${playlistId}`,
    songs,
  }
}

/** Same contract as the legacy `getAlbumSongs`. */
export async function getAlbumSongs(id, cookie = '') {
  const albumId = String(id ?? '').trim()
  if (albumId === '') throw new Error('缺少网易云专辑 ID')

  const json = await callUpstream('/album', { id: albumId }, { cookie: await dataCookie(cookie) })
  const album = json.album
  if (album === undefined || album === null) throw new Error('网易云专辑获取失败')
  // Folia's `getAlbumTracks` reads the top-level `songs`; the newer package's
  // `album.songs` can be empty while the same response carries the tracks there.
  const rows = Array.isArray(json.songs) ? json.songs : (Array.isArray(album.songs) ? album.songs : [])
  const songs = rows.map(songOf).filter(Boolean)
  return {
    id: albumId,
    name: plain(album.name || songs[0]?.album),
    cover: plain(album.picUrl || songs[0]?.cover),
    artist: plain(album.artist?.name),
    songs,
  }
}
