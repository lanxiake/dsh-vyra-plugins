/**
 * Unified online-music provider facade.
 *
 * The per-platform modules (netease.js / qq.js / kugou.js) are ported from the
 * MIT-licensed `kendu76/dsh-music-player` project (see lib/providers/README.md).
 * They talk to the official client endpoints and return normalised song data;
 * this module keeps the raw search objects for platforms whose stream lookup
 * needs the full object (KuGou), and exposes one small API to the Host routes.
 *
 * @module dsh-music-panel/providers
 */

import * as NC from './netease.js'
import * as QQ from './qq.js'
import * as KG from './kugou.js'
import * as KGL from './kugou-lite.js'
import { parseYrc } from './yrc.js'
import * as ND from './navidrome.js'
import { callUpstream as ncUpstream } from '../services/netease-api.js'
import { callUpstream as qqUpstream } from '../services/qq-api.js'
import { callKugou } from '../services/kugou-api.js'

export const PROVIDERS = ['netease', 'qq', 'kugouLite', 'navidrome']

/**
 * Navidrome keeps a server URL + token in the session object instead of a
 * cookie, and there is no QR login. Build the module's config from the stored
 * session so the call sites stay uniform.
 */
function navidromeConfig(session) {
  const s = session !== null && typeof session === 'object' ? session : {}
  return {
    server: String(s.server ?? ''),
    username: String(s.username ?? ''),
    salt: String(s.salt ?? ''),
    token: String(s.token ?? ''),
    // Only present when the user opted into the native complete-library list.
    password: String(s.password ?? ''),
    nativeSongs: s.nativeSongs === true,
  }
}

const rawSongs = new Map()

/** QQ `filename` prefix → the quality the server actually granted. */
const QQ_QUALITY = {
  Q000: '无损',
  Q001: '无损',
  AI00: '无损',
  F000: '无损',
  O801: 'OGG',
  M800: '320k',
  M500: '128k',
}

function shape(provider, song) {
  const id = provider === 'qq' ? song.songmid : song.id
  const payType = Number(song.payType) || 0
  // QQ spells the flag `pay.pay_play`; `payplay` is the legacy/camelCase shape.
  const payplay = Number(song.payplay ?? song.pay?.pay_play ?? song.pay?.payplay) || 0
  const fee = Number(song.fee) || 0
  const privilege = Number(song.privilege) || 0
  let qualityHint = ''
  if (provider === 'qq' && payplay === 1) qualityHint = 'VIP'
  if (provider === 'kugouLite' ? (privilege >= 10 || payType > 0) : (provider === 'kugou' && (payType > 0 || privilege > 0))) qualityHint = 'VIP'
  if (provider === 'netease' && fee === 1) qualityHint = 'VIP'
  const albumMid = String(song.albummid || '').trim()
  const coverUrl =
    song.cover ||
    (albumMid !== '' ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '')
  return {
    provider,
    id: String(id ?? ''),
    title: song.title || song.name || song.songname || song.SongName || song.audio_name || '',
    artist: Array.isArray(song.artists)
      ? song.artists.join(' / ')
      : String(song.artist || song.singer || song.author_name || ''),
    album: song.album || '',
    albumId: provider === 'qq' ? albumMid : String(song.albumId || song.album_id || ''),
    durationSec: Number(song.interval) || 0,
    coverUrl,
    qualityHint,

    // ── Full entity, so no provider field is silently dropped ────────────
    durationMs: Number(song.durationMs) || (Number(song.interval) || 0) * 1000,
    fee,
    artistsDetail: song.artistsDetail ?? null,
    albumDetail: song.albumDetail ?? null,
    aliases: song.aliases ?? [],
    translatedNames: song.translatedNames ?? [],
    publishTime: Number(song.publishTime) || 0,
    popularity: Number(song.popularity) || 0,
    songType: Number(song.songType) || 0,
    mvId: song.mvId ?? '',
    isVideo: song.isVideo === true,
    copyright: Number(song.copyright) || 0,
    resourceState: song.resourceState ?? null,
    noCopyright: song.noCopyright ?? null,
    privilegeDetail: song.privilegeDetail ?? null,
    availableQualities: song.availableQualities ?? [],
    variant: song.variant ?? null,
    fileId: song.fileId ?? 0,
  }
}

/**
 * @param {'netease'|'qq'|'kugou'} provider
 * @param {string} query
 * @param {string} [cookie]
 */
export async function search(provider, query, cookie = '', session = {}) {
  const text = String(query ?? '').trim()
  if (text === '') return []
  if (provider === 'navidrome') {
    const songs = await ND.search(navidromeConfig(session), text)
    return songs.map((song) => {
      rawSongs.set('navidrome:' + song.id, song)
      return song
    })
  }
  if (provider === 'netease') {
    const { results } = await NC.search(text, cookie)
    return (results || []).map((song) => {
      rawSongs.set('netease:' + song.id, song)
      return shape('netease', song)
    })
  }
  if (provider === 'qq') {
    const { results } = await QQ.search(text, cookie)
    return (results || []).map((song) => {
      rawSongs.set('qq:' + song.songmid, song)
      return shape('qq', song)
    })
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const { results } = await KG.search(text, cookie, 1, kugouPlatform(provider))
    return (results || []).map((song) => {
      const key = provider === 'kugouLite' ? 'kugouLite:' : 'kugou:'
      rawSongs.set(key + song.id, song)
      return shape(provider, song)
    })
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Paged search. QQ's search endpoint exposes a real page cursor; the other
 * providers currently return one comparable page.
 */
export async function searchPage(provider, query, cookie = '', session = {}, page = 1) {
  const target = Math.max(1, Number(page) || 1)
  if (provider === 'netease') {
    const text = String(query ?? '').trim()
    if (text === '') return { results: [], total: 0, page: target }
    const data = await NC.search(text, cookie, target)
    const results = (data.results || []).map((song) => {
      rawSongs.set('netease:' + song.id, song)
      return shape('netease', song)
    })
    return { results, total: Number(data.total) || results.length, page: Number(data.page) || target }
  }
  if (provider !== 'qq') {
    const results = await search(provider, query, cookie, session)
    return { results, total: results.length, page: 1 }
  }
  const text = String(query ?? '').trim()
  if (text === '') return { results: [], total: 0, page: target }
  const data = await QQ.search(text, cookie, target)
  const results = (data.results || []).map((song) => {
    rawSongs.set('qq:' + song.songmid, song)
    return shape('qq', song)
  })
  return { results, total: Number(data.total) || results.length, page: Number(data.page) || target }
}

/** One playlist row from a provider's playlist search, shaped for the shared card. */
function playlistCard(provider, raw) {
  const item = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    id: textOf(firstValue(item, ['id', 'dissid', 'specialid'])),
    name: textOf(firstValue(item, ['name', 'dissname', 'specialname'])),
    cover: textOf(firstValue(item, ['cover', 'imgurl', 'coverUrl'])),
    creator: textOf(firstValue(item, ['creator', 'nickname', 'author_name'])),
    trackCount: Number(firstValue(item, ['trackCount', 'song_count', 'songCount', 'total'])) || 0,
    playCount: Number(firstValue(item, ['playCount', 'listennum', 'play_count'])) || 0,
    source: provider,
    type: 'playlist',
  }
}

/** Folia daily recommendations for the platforms that expose the route. */
export async function dailySongs(provider, cookie = '', session = {}) {
  if (provider === 'netease') {
    const rows = await NC.dailySongs(cookie)
    return rows.map((song) => {
      rawSongs.set('netease:' + song.id, song)
      return shape('netease', song)
    }).filter((song) => song.id !== '')
  }
  if (provider === 'qq') {
    const rows = await QQ.dailySongs(cookie)
    return rows.map((song) => {
      rawSongs.set('qq:' + song.songmid, song)
      return shape('qq', song)
    }).filter((song) => song.id !== '')
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const platform = provider === 'kugouLite' ? 'lite' : 'standard'
    const rows = await KG.dailySongs(session, platform)
    return rows.map((song) => {
      rawSongs.set(provider + ':' + song.id, song)
      return shape(provider, song)
    }).filter((song) => song.id !== '')
  }
  throw new Error('该平台没有每日推荐')
}

/** Folia recommended collections for the platforms that expose the route. */
export async function recommendedCollections(provider, cookie = '', session = {}, limit = 30) {
  let rows = []
  if (provider === 'netease') rows = await NC.recommendedCollections(cookie, limit)
  else if (provider === 'qq') rows = await QQ.recommendedCollections(cookie, limit)
  else if (provider === 'kugou' || provider === 'kugouLite') {
    const data = await KG.getRecommendedPlaylists(session, 1)
    rows = Array.isArray(data.playlists) ? data.playlists : []
  } else throw new Error('该平台没有推荐歌单')
  return rows.map((playlist) => playlistCard(provider, playlist)).filter((playlist) => playlist.id !== '')
}

/** Folia personal FM for the platforms that expose the route. */
export async function personalFm(provider, cookie = '', session = {}) {
  let rows = []
  if (provider === 'netease') rows = await NC.personalFm(cookie)
  else if (provider === 'qq') rows = await QQ.personalFm(cookie)
  else if (provider === 'kugou' || provider === 'kugouLite') rows = await KG.personalFm(session, provider === 'kugouLite' ? 'lite' : 'standard')
  else throw new Error('该平台没有私人 FM')
  return rows.map((song) => {
    const key = provider === 'qq' ? song.songmid : song.id
    rawSongs.set(provider + ':' + key, song)
    return shape(provider, song)
  }).filter((song) => song.id !== '')
}

/** Folia cloud-drive tracks; NetEase/QQ/KuGou expose the route. */
export async function cloudSongs(provider, cookie = '', session = {}, page = 1) {
  const target = Math.max(1, Number(page) || 1)
  let rows = []
  if (provider === 'netease') rows = await NC.cloudSongs(cookie, 200, (target - 1) * 200)
  else if (provider === 'qq') rows = await QQ.cloudSongs(cookie, 100, (target - 1) * 100)
  else if (provider === 'kugou' || provider === 'kugouLite') rows = await KG.cloudSongs(session, target, 100, provider === 'kugouLite' ? 'lite' : 'standard')
  else throw new Error('该平台没有云盘')
  return rows.map((song) => {
    const key = provider === 'qq' ? song.songmid : song.id
    rawSongs.set(provider + ':' + key, song)
    return shape(provider, song)
  }).filter((song) => song.id !== '')
}

/** Folia daily-history dates for the platforms that expose the route. */
export async function historyDates(provider, cookie = '') {
  if (provider === 'netease') return await NC.historyDates(cookie)
  if (provider === 'qq') return await QQ.historyDates(cookie)
  throw new Error('该平台没有日推历史')
}

/** Folia daily-history songs for one date. */
export async function historySongs(provider, cookie = '', date = '') {
  let rows = []
  if (provider === 'netease') rows = await NC.historySongs(cookie, date)
  else if (provider === 'qq') rows = await QQ.historySongs(cookie, date)
  else throw new Error('该平台没有日推历史')
  return rows.map((song) => {
    const key = provider === 'qq' ? song.songmid : song.id
    rawSongs.set(provider + ':' + key, song)
    return shape(provider, song)
  }).filter((song) => song.id !== '')
}

/**
 * Album search for the providers that actually have a search endpoint for it.
 * Navidrome uses Subsonic search3; NetEase uses cloudsearch type 10. Platforms
 * without one are not registered with the capability, so this never becomes a
 * silent empty result.
 */
export async function searchAlbums(provider, query, cookie = '', session = {}, page = 1) {
  const text = String(query ?? '').trim()
  const target = Math.max(1, Number(page) || 1)
  if (text === '') return { items: [], total: 0, page: target }
  if (provider === 'netease') {
    const data = await NC.searchAlbums(text, cookie, target)
    return {
      items: (data.results || []).map((album) => Object.assign(albumCard('netease', album), { type: 'album' })),
      total: Number(data.total) || 0,
      page: Number(data.page) || target,
    }
  }
  if (provider === 'qq') {
    const data = await QQ.searchAlbums(text, cookie, target)
    return {
      items: (data.results || []).map((album) => Object.assign(albumCard('qq', album), { type: 'album' })),
      total: Number(data.total) || 0,
      page: Number(data.page) || target,
    }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const data = await KG.searchAlbums(text, cookie, target, provider === 'kugouLite' ? 'lite' : 'standard')
    return {
      items: (data.results || []).map((album) => Object.assign(albumCard(provider, album), { type: 'album' })),
      total: Number(data.total) || 0,
      page: Number(data.page) || target,
    }
  }
  if (provider === 'navidrome') {
    const data = await ND.searchAlbums(navidromeConfig(session), text, {
      count: 30,
      offset: (target - 1) * 30,
    })
    return {
      items: (data.items || []).map((album) => Object.assign(album, { type: 'album' })),
      total: Number(data.total) || 0,
      page: target,
    }
  }
  throw new Error('该平台没有专辑搜索')
}

/** Playlist search; NetEase / QQ / KuGou expose one, Navidrome does not. */
export async function searchPlaylists(provider, query, cookie = '', session = {}, page = 1) {
  const text = String(query ?? '').trim()
  const target = Math.max(1, Number(page) || 1)
  if (text === '') return { items: [], total: 0, page: target }
  let data = null
  if (provider === 'netease') data = await NC.searchPlaylists(text, cookie, target)
  else if (provider === 'qq') data = await QQ.searchPlaylists(text, cookie, target)
  else if (provider === 'kugou' || provider === 'kugouLite') data = await KG.searchPlaylists(text, cookie, target, provider === 'kugouLite' ? 'lite' : 'standard')
  else throw new Error('该平台没有歌单搜索')
  return {
    items: (data.results || []).map((playlist) => playlistCard(provider, playlist)),
    total: Number(data.total) || 0,
    page: Number(data.page) || target,
  }
}

/** True when a provider result belongs to the clicked artist. */
function artistMatches(track, artist) {
  const wanted = String(artist ?? '').trim().toLowerCase()
  const actual = String(track && track.artist ? track.artist : '').trim().toLowerCase()
  if (wanted === '' || actual === '') return false
  if (actual === wanted || actual.includes(wanted)) return true
  const actualParts = actual.split(/\s*[\/,&、]\s*/)
  return wanted.split(/\s*[\/,&、]\s*/).some((part) => part !== '' && actualParts.includes(part))
}

function textOf(value) {
  return value === null || value === undefined ? '' : String(value)
}

function firstValue(raw, keys) {
  for (const key of keys) {
    if (raw?.[key] !== undefined && raw[key] !== null && raw[key] !== '') return raw[key]
  }
  return ''
}

/** One album row, shaped for the online album cards (provider-agnostic). */
function albumCard(provider, raw) {
  const item = raw !== null && typeof raw === 'object' ? raw : {}
  const nested = item.album && typeof item.album === 'object' ? item.album : {}
  const artist = Array.isArray(item.artists) && item.artists[0]
    ? textOf(item.artists[0].name)
    : textOf(firstValue(item, ['singername', 'singerName', 'author_name', 'artistName']) || item.artist?.name || item.artist || firstValue(nested, ['artist']))
  return {
    id: textOf(firstValue(item, ['albummid', 'albumMid', 'album_id', 'albumId', 'albumID', 'id']) || firstValue(nested, ['id'])),
    name: textOf(firstValue(item, ['albumname', 'albumName', 'album_name', 'name', 'title']) || firstValue(nested, ['name'])),
    cover: textOf(firstValue(item, ['picUrl', 'coverUrl', 'pic', 'cover', 'sizable_cover']) || firstValue(nested, ['coverUrl', 'cover'])),
    artist,
    trackCount: Number(firstValue(item, ['song_count', 'songCount', 'size', 'trackCount', 'totalNum'])) || 0,
    provider,
  }
}

/** One artist row for the artist page header. */
function artistCard(provider, raw) {
  const item = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    id: textOf(firstValue(item, ['id', 'singermid', 'artist_id', 'author_id'])),
    name: textOf(firstValue(item, ['name', 'artist_name', 'author_name', 'singername'])),
    cover: textOf(firstValue(item, ['cover', 'avatar', 'imgurl', 'sizable_avatar', 'picUrl', 'pic'])),
    description: textOf(firstValue(item, ['briefDesc', 'description', 'intro', 'singer_brief'])),
    provider,
  }
}

/** The first song/album array inside a KuGou package envelope. */
function kugouList(body) {
  const queue = [body?.data ?? body?.body?.data ?? body]
  const keys = ['lists', 'list', 'info', 'songs', 'song_list', 'songlist', 'songList', 'audios', 'albums', 'items', 'records', 'data', 'result']
  const seen = new Set()
  while (queue.length > 0) {
    const current = queue.shift()
    if (Array.isArray(current)) return current
    if (current === null || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    for (const key of keys) {
      if (current[key] !== undefined && current[key] !== null) queue.push(current[key])
    }
  }
  return []
}

function kugouObject(body) {
  const data = body?.data ?? body?.body?.data ?? body?.body ?? body
  if (Array.isArray(data)) return data[0] ?? null
  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) return data.data
  return data !== null && typeof data === 'object' ? data : null
}

/**
 * Songs for one artist. QQ has a dedicated singer endpoint; the other providers
 * use their song search and filter to the clicked artist.
 */
export async function artistSongs(provider, artist, cookie = '', session = {}, artistId = '', page = {}) {
  const name = String(artist ?? '').trim()
  if (name === '') return []
  if (provider === 'qq') {
    const mid = String(artistId || '').trim()
    if (/^[A-Za-z0-9_-]+$/.test(mid)) {
      try {
        const limit = Math.max(1, Math.min(100, Number(page.limit) || 80))
        const pageNo = Math.floor(Math.max(0, Number(page.offset) || 0) / limit) + 1
        const answer = await qqUpstream('/getSingerHotsong', { singermid: mid, limit, page: pageNo }, { cookie })
        const rows = answer?.response?.singer?.data?.songlist
        if (Array.isArray(rows)) {
          return rows
            .map((row) => QQ.toLegacyResult(row))
            .filter((song) => song !== null)
            .map((song) => {
              rawSongs.set('qq:' + song.songmid, song)
              return shape('qq', song)
            })
        }
      } catch {
        // Older local backends may not expose this route; the name search below
        // is the documented fallback.
      }
    }
    const { results } = await QQ.searchArtistSongs(name, cookie)
    return (results || []).map((song) => {
      rawSongs.set('qq:' + song.songmid, song)
      return shape('qq', song)
    })
  }
  if (provider === 'netease') {
    // Folia opens the artist page with the id the song carries and asks
    // `/artist/songs` once. Searching by name was up to ten sequential page
    // requests, which is what made this page slow.
    let id = String(artistId || session.artistId || '').trim()
    if (!/^[0-9]+$/.test(id)) id = ''
    if (id === '') {
      try {
        id = await NC.findArtistId(name, cookie)
      } catch {
        id = ''
      }
    }
    if (id !== '') {
      try {
        const limit = Math.max(1, Math.min(500, Number(page.limit) || 200))
        const offset = Math.max(0, Number(page.offset) || 0)
        const result = await NC.getArtistSongs(id, cookie, { limit, offset, order: 'hot' })
        const songs = result.songs
          .map((song) => {
            rawSongs.set('netease:' + song.id, song)
            return shape('netease', song)
          })
          .filter((song) => song.id)
        if (songs.length > 0) return songs
      } catch {
        // Fall through to the name search below.
      }
    }
    // Fallback (no artist id, or the endpoint answered empty): page the name
    // search in parallel instead of one page at a time.
    const first = await NC.search(name, cookie, 1)
    const total = Number(first.total) || 0
    const pageCount = Math.min(10, Math.max(1, Math.ceil(total / 30) || 1))
    const rest = pageCount > 1
      ? await Promise.all(
          Array.from({ length: pageCount - 1 }, (_, index) => NC.search(name, cookie, index + 2).catch(() => ({ results: [] }))),
        )
      : []
    const collected = []
    ;[first, ...rest].forEach((data) => {
      ;(data.results || []).forEach((song) => {
        rawSongs.set('netease:' + song.id, song)
        collected.push(shape('netease', song))
      })
    })
    return collected.filter((song) => artistMatches(song, name))
  }
  if (provider === 'navidrome') {
    const songs = await ND.search(navidromeConfig(session), name, { count: 500 })
    songs.forEach((song) => rawSongs.set('navidrome:' + song.id, song))
    return songs.filter((song) => artistMatches(song, name))
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const artistKey = String(artistId || '').trim()
    if (/^\d+$/.test(artistKey)) {
      try {
        const limit = Math.max(1, Math.min(100, Number(page.limit) || 60))
        const pageNo = Math.floor(Math.max(0, Number(page.offset) || 0) / limit) + 1
        const platform = provider === 'kugouLite' ? 'lite' : 'standard'
        const answer = await callKugou(platform, 'artist_audios', {
          id: artistKey,
          page: pageNo,
          pagesize: limit,
          sort: 'hot',
        })
        const rows = kugouList(answer.body)
        if (rows.length > 0) {
          return rows
            .map((item) => shape(provider, KG.normalizePackageSong(item)))
            .filter((song) => song.id !== '')
        }
      } catch {
        // Fall back to the name search when the local KuGou package has no
        // artist_audios route.
      }
    }
  }
  const results = await search(provider, name, cookie, session)
  return results.filter((song) => artistMatches(song, name))
}

/**
 * Album songs for one provider.
 *
 * The four Chinese platforms go through their detail APIs with an
 * album-name search fallback. Navidrome addresses an album by id and has no
 * "unknown album" case, so it resolves directly and returns the same shape.
 */
export async function albumSongs(provider, id, cookie = '', session = {}, hint = {}) {
  if (provider === 'navidrome') {
    const result = await ND.albumSongs(navidromeConfig(session), id)
    for (const song of result.songs) rawSongs.set('navidrome:' + song.id, song)
    return {
      id: String(id || ''),
      name: (result.album && result.album.name) || hint.album || '',
      cover: '',
      coverArtId: (result.album && result.album.coverArtId) || '',
      artist: (result.album && result.album.artist) || hint.artist || '',
      songs: result.songs,
    }
  }
  if (provider === 'qq') {
    const mid = String(id || '').trim()
    if (mid !== '') {
      try {
        const answer = await qqUpstream('/getAlbumInfo', { albummid: mid }, { cookie })
        const album = answer?.response?.data
        if (album && Array.isArray(album.list)) {
          const songs = album.list
            .map((row) => QQ.toLegacyResult(row))
            .filter((song) => song !== null)
            .map((song) => {
              const shaped = shape('qq', song)
              if (!shaped.album) shaped.album = textOf(album.name || album.albumname || hint.album)
              rawSongs.set('qq:' + shaped.id, song)
              return shaped
            })
            .filter((song) => song.id !== '')
          if (songs.length > 0) {
            return {
              id: mid,
              name: textOf(album.name || album.albumname || hint.album),
              cover: textOf(album.pic || album.cover || songs[0].coverUrl),
              artist: textOf(album.singername || album.singer_name || hint.artist),
              songs,
            }
          }
        }
      } catch (error) {
        if (!hint.album) throw error
      }
    }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const platform = provider === 'kugouLite' ? 'lite' : 'standard'
    try {
      const detail = await callKugou(platform, 'album_detail', { id: String(id) })
      const rawAlbum = kugouObject(detail.body) ?? {}
      const songs = []
      for (let page = 1; page <= 20; page += 1) {
        const answer = await callKugou(platform, 'album_songs', {
          id: String(id),
          page,
          pagesize: 30,
        })
        const rows = kugouList(answer.body)
        if (rows.length === 0) break
        for (const item of rows) {
          const song = shape(provider, KG.normalizePackageSong(item))
          if (song.id !== '') songs.push(song)
        }
        const total = Number(answer.body?.total ?? answer.body?.data?.total) || 0
        if (total > 0 && songs.length >= total) break
        if (rows.length < 30) break
      }
      if (songs.length > 0) {
        return {
          id: String(id),
          name: textOf(firstValue(rawAlbum, ['album_name', 'albumname', 'name']) || hint.album || songs[0].album),
          cover: textOf(firstValue(rawAlbum, ['sizable_cover', 'cover', 'pic']) || songs[0].cover),
          artist: textOf(firstValue(rawAlbum, ['author_name', 'singername']) || hint.artist || songs[0].artist),
          songs,
        }
      }
    } catch (error) {
      if (!hint.album) throw error
    }
  }
  let payload = null
  try {
    if (provider === 'netease') payload = await NC.getAlbumSongs(id, cookie)
    else if (provider === 'qq') payload = await QQ.getAlbumSongs(id, cookie)
    else if (provider === 'kugou' || provider === 'kugouLite') payload = await KG.getAlbumSongs(id, session)
  } catch (error) {
    if (!hint.album) throw error
  }
  if (payload !== null) {
    const songs = (payload.songs || []).map((song) => {
      const key = provider === 'qq' ? song.songmid : song.id
      rawSongs.set(provider + ':' + key, song)
      const shaped = shape(provider, song)
      if (!shaped.album) shaped.album = payload.name || hint.album || ''
      return shaped
    }).filter((song) => song.id)
    return {
      id: String(id || payload.id || ''),
      name: payload.name || hint.album || '',
      cover: payload.cover || '',
      artist: payload.artist || hint.artist || '',
      songs,
    }
  }
  const query = [hint.artist, hint.album].filter(Boolean).join(' ').trim()
  if (query === '') throw new Error('缺少专辑信息')
  const target = String(hint.album || '').trim().toLowerCase()
  const results = await search(provider, query, cookie)
  const filtered = results.filter((song) => String(song.album || '').trim().toLowerCase() === target)
  if (filtered.length === 0) throw new Error('未找到该专辑曲目')
  return {
    id: String(id || ''),
    name: hint.album || '',
    cover: filtered[0].coverUrl || '',
    artist: hint.artist || filtered[0].artist || '',
    songs: filtered,
  }
}

/** Whether a cached search/playlist row is marked as a paid/VIP track. */
export function requiresVip(provider, id) {
  const raw = rawSongs.get(provider + ':' + String(id || ''))
  if (!raw) return null
  if (provider === 'netease') return Number(raw.fee) === 1 || Number(raw.fee) === 4
  if (provider === 'qq') {
    return Number(raw.payplay ?? raw.pay?.pay_play ?? raw.pay?.payplay) === 1
  }
  if (provider === 'kugou' || provider === 'kugouLite') return Number(raw.privilege) >= 10
  return null
}

const EMP_MARKUP = /<\/?em(?:\s[^>]*)?>/gi

/** Upstream search answers wrap the matched terms in `<em>`; a name has to be plain text. */
function plainText(value) {
  return String(value ?? '').replace(EMP_MARKUP, '').trim()
}

/**
 * Another name this platform lists the song under (Folia's `getSearchAlias`): a title that
 * carries a translation or a version suffix often has an original name beside it.
 *
 * @returns {{ title: string, artist?: string, album?: string } | null}
 */
export function lyricSearchAlias(provider, id) {
  const raw = rawSongs.get(provider + ':' + String(id || ''))
  if (raw === null || raw === undefined) return null
  // QQ's legacy shape keeps the decoded `name` as `title`, so a second spelling exists only
  // when the search row itself carried one.
  if (provider === 'qq') {
    const original = typeof raw.name === 'string' ? plainText(raw.name) : ''
    const current = String(raw.title ?? '')
    if (original === '' || original === current) return null
    const singer = Array.isArray(raw.singer)
      ? raw.singer.map((item) => plainText(item?.name ?? '')).filter(Boolean).join(' / ')
      : ''
    return { title: original, ...(singer === '' ? {} : { artist: singer }) }
  }
  return null
}

/**
 * Another spelling of the artist this platform knows (Folia's `getAlternateArtistName`):
 * NetEase carries the translated / alternative artist names on each artist row.
 *
 * @returns {string | null}
 */
export function alternateArtistName(provider, id) {
  const raw = rawSongs.get(provider + ':' + String(id || ''))
  if (raw === null || raw === undefined) return null
  if (provider === 'netease') {
    const artist = Array.isArray(raw.artistsDetail) && raw.artistsDetail.length > 0 ? raw.artistsDetail[0] : null
    if (artist === null) return null
    const candidates = []
    if (Array.isArray(artist.translatedNames)) candidates.push(...artist.translatedNames)
    if (Array.isArray(artist.aliases)) candidates.push(...artist.aliases)
    const current = String(raw.artist ?? '')
    for (const item of candidates) {
      const name = String(item ?? '').trim()
      if (name !== '' && name !== current) return name
    }
  }
  return null
}

/**
 * Resolve a playable URL for one song id (cookies unlock higher quality).
 * @returns {Promise<{ url: string, quality: string }>}
 */
export async function resolveStream(provider, id, cookie = '', session = {}, quality = 'high') {
  if (provider === 'navidrome') {
    return ND.resolveStream(navidromeConfig(session), id, quality)
  }
  if (provider === 'netease') {
    const dl = await NC.getDownloadURL(id, cookie, quality)
    return {
      url: dl.url || '',
      quality: dl.quality || '',
      code: dl.code || 0,
      fee: dl.fee || 0,
      preview: typeof dl.freeTrialInfo === 'object' && dl.freeTrialInfo !== null,
      replayGain: typeof dl.trackGain === 'number' ? { trackGain: dl.trackGain } : null,
    }
  }
  if (provider === 'qq') {
    const dl = await QQ.getDownloadURL(id, cookie, quality)
    const prefix = String(dl.filename || '').slice(0, 4)
    return { url: dl.url || '', quality: QQ_QUALITY[prefix] || '', preview: dl.preview === true }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const concept = provider === 'kugouLite'
    const song = rawSongs.get((concept ? 'kugouLite:' : 'kugou:') + id) || { hash: id }
    const ready = await ensureKugouDevice(session || {}, kugouPlatform(provider))
    const prefer =
      quality === 'standard'
        ? ['128']
        : quality === 'high'
          ? ['320', '128']
          : ['flac', '320', '128']
    const dl = concept ? await KGL.resolveStream(song, ready, prefer) : await KG.getDownloadURL(song, ready, prefer)
    return { url: dl.url || '', quality: dl.quality || '', replayGain: dl.replayGain || null }
  }
  throw new Error('未知平台：' + provider)
}

/**
 * KuGou's legacy play-info fallback, for when the current /song/url answer points
 * at a CDN object that has disappeared (HTTP 404). It is the same last resort
 * Folia keeps in its KuGou provider.
 */
export async function resolveLegacyStream(provider, id) {
  if (provider !== 'kugou' && provider !== 'kugouLite') return null
  return KGL.resolveLegacyStream(id)
}

/** Stable KuGou device identity (generated once, then persisted by the caller). */
export function createKugouDevice() {
  return KG.createDeviceIdentity()
}

/** KuGou's concept build is the package's `lite` platform; both are served by the same upstream package. */
function kugouPlatform(provider) {
  return provider === 'kugouLite' ? 'lite' : 'standard'
}

const kugouDevices = new Map()

/** KuGou stream lookup only works with a device identity registered by the platform (one per platform). */
const kugouRegistered = new Map()

async function ensureKugouDevice(session, platform = 'standard') {
  const now = Date.now()
  const registered = kugouRegistered.get(platform) ?? { dfid: '', at: 0 }
  if (session.dfid !== '' && session.dfid === registered.dfid && now - registered.at < 30 * 60 * 1000) {
    return session
  }
  try {
    const reg = await KG.registerDevice(session, platform)
    if (reg && reg.dfid) {
      kugouRegistered.set(platform, { dfid: reg.dfid, at: now })
      return { ...session, dfid: reg.dfid }
    }
  } catch {
    /* fall back to the stored identity */
  }
  return session
}

/**
 * Start a QR login. Returns the key to poll plus the QR image data URL.
 * @param {'netease'|'qq'|'kugou'} provider
 * @param {{ mid?: string, dfid?: string, guid?: string }} [session]
 */
export async function loginStart(provider, session = {}, mode = 'qq') {
  if (provider === 'navidrome') {
    // Navidrome has no QR flow: the user enters a server URL and credentials,
    // which the host stores via POST /online/navidrome/login.
    throw new Error('Navidrome 不支持扫码登录，请填写服务器地址与账号')
  }
  if (provider === 'netease') {
    const qr = await NC.createQRLogin()
    return { key: qr.key, imageDataUrl: qr.imageDataUrl || '', url: qr.url || '' }
  }
  if (provider === 'qq') {
    const qr = mode === 'wx' ? await QQ.createWXQRLogin() : await QQ.createQRLogin()
    return { key: qr.key, imageDataUrl: qr.imageDataUrl || '', url: '' }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const platform = kugouPlatform(provider)
    let device = session.mid ? session : createKugouDevice()
    try {
      // The token from a QR sign-in is bound to the device that asked for it, so register first.
      const reg = await KG.registerDevice(device, platform)
      if (reg && reg.dfid) device = { ...device, dfid: reg.dfid }
    } catch {
      /* keep the generated identity; the QR flow may still work */
    }
    const qr = await KG.createQRLogin(device, platform)
    // `createQRLogin` answers the identity it used (dfid included); keep that one for polling.
    kugouDevices.set(provider, qr.extra?.device ?? device)
    return { key: qr.key, imageDataUrl: qr.imageDataUrl || '', url: qr.url || '' }
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Poll one QR login. On success returns the cookie (NetEase/QQ) or token
 * fields (KuGou); the caller persists them.
 */
/** The package's login hint keys → Folia's login cases (login/linkFailureCase vocab). */
const QQ_LOGIN_CASE = {
  'login.device-limit': 'device-limit',
  'login.rate-limited': 'retry-later',
  'login.wrong-scan-app': 'wrong-scan-app',
  'login.account-restricted': 'account-restricted',
  'login.account-banned': 'account-restricted',
  'login.account-binding': 'account-restricted',
  'login.rejected': 'refused',
}

export async function loginStatus(provider, key, mode = 'qq') {
  if (provider === 'navidrome') {
    throw new Error('Navidrome 不支持扫码登录，请填写服务器地址与账号')
  }
  if (provider === 'netease') {
    const r = await NC.checkQRLogin(key)
    return {
      status: r.status,
      cookie: r.status === 'success' ? r.cookie || '' : '',
      message: String(r.message || ''),
    }
  }
  if (provider === 'qq') {
    const r = mode === 'wx' ? await QQ.checkWXQRLogin(key) : await QQ.checkQRLogin(key)
    return {
      status: r.status,
      cookie: r.status === 'success' ? r.cookie || '' : '',
      message: String(r.message || ''),
      case: QQ_LOGIN_CASE[String(r.extra?.hint || '')] || '',
      retryAfterMs: Number(r.extra?.retryAfterMs) || 0,
    }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const concept = provider === 'kugouLite'
    const device = kugouDevices.get(provider) || createKugouDevice()
    const r = await KG.checkQRLogin(key, device, kugouPlatform(provider))
    if (r.device) kugouDevices.set(provider, { ...device, ...r.device })
    return {
      status: r.status,
      cookie: '',
      token: r.tokenInfo ? String(r.tokenInfo.token || '') : '',
      userid: r.tokenInfo ? String(r.tokenInfo.userid || '') : '',
      nickname: r.tokenInfo ? String(r.tokenInfo.nickname || '') : '',
      vipType: r.tokenInfo ? String(r.tokenInfo.vip_type || '') : '',
      vipToken: r.tokenInfo ? String(r.tokenInfo.vip_token || '') : '',
      avatarUrl: r.tokenInfo ? String(r.tokenInfo.avatarUrl || '') : '',
      platform: concept ? 'lite' : 'standard',
      device: { mid: device.mid, dfid: device.dfid || '', guid: device.guid || '' },
    }
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Online lyric (LRC + optional translation). Unsupported combinations return
 * an empty lyric rather than throwing, so the player just shows "no lyrics".
 * @returns {Promise<{ lrc: string, translation: string }>}
 */
/**
 * Chorus window for platforms that expose one (Folia calls `/song/chorus` for the
 * same purpose: jump-to-hook and hook highlighting).
 */
export async function chorus(provider, id, cookie = '') {
  // A platform without a chorus endpoint is not an error: the client simply has
  // no hook to offer, so ask nothing of the UI.
  if (provider === 'netease') return await NC.getChorus(id, cookie)
  return null
}

export async function lyric(provider, id, cookie = '', session = {}) {
  try {
    if (provider === 'navidrome') {
      return await ND.lyric(navidromeConfig(session), id)
    }
    if (provider === 'netease') {
      const res = await NC.getLyric(id, cookie)
      let lrc = res.lyric || ''
      // YRC carries the word-level timeline. It used to be consulted only when
      // LRC was empty; now it is always parsed and returned, so the player can
      // render karaoke highlighting instead of line-level colouring.
      const parsedYrc = res.yrc ? parseYrc(res.yrc) : null
      if (parseLrcLines(lrc).length === 0 && parsedYrc !== null && parsedYrc.lines.length > 0) {
        lrc = parsedYrc.lines.map((line) => lrcTime(line.t) + line.text).join('\n')
      }
      return {
        lrc,
        translation: res.trans || '',
        romaji: res.roma || '',
        lines: parsedYrc === null ? null : parsedYrc.lines,
        wordLevel: parsedYrc !== null && parsedYrc.wordLevel === true,
        // Folia's raw source (buildNowPlayingLyricSource): the renderer parses it with
        // the ported pipeline instead of trusting a shape this Host decided on.
        raw: {
          type: 'local',
          lrcContent: String(res.yrc || lrc || ''),
          formatHint: res.yrc ? 'yrc' : 'lrc',
          ...(res.trans ? { tLrcContent: String(res.trans) } : {}),
          ...(res.roma ? { rLrcContent: String(res.roma) } : {}),
        },
      }
    }
    if (provider === 'qq') {
      const res = await QQ.getLyric(id, cookie)
      const base = res.lyric || ''
      // QRC is the only place QQ exposes word timing, and its only translation stream.
      // One extra request per track, cached with the lyric (v5 keeps the words).
      let qrc = null
      try {
        const info = await QQ.getSongInfoByMid(id, cookie)
        qrc = await QQ.getQrcLyric(
          {
            songid: info.songid,
            interval: info.interval,
            title: info.title,
            artist: info.artist,
            album: info.album,
          },
          cookie,
        )
      } catch {
        qrc = null
      }
      const wordLines = qrc !== null && Array.isArray(qrc.lines) ? qrc.lines : []
      const hasWords = wordLines.some((line) => Array.isArray(line.words) && line.words.length > 0)
      const translation = String((qrc && qrc.translation) || res.trans || '')
      if (hasWords) {
        // The LRC is built from the same lines, so the client's line times match the
        // word times exactly (attachWordTimeline pairs them by timestamp).
        return {
          lrc: wordLines.map((line) => lrcTime(line.t) + String(line.text ?? '')).join('\n'),
          translation,
          lines: wordLines,
          wordLevel: true,
          ...(qrc && typeof qrc.qrcContent === 'string' && qrc.qrcContent !== ''
            ? {
                raw: {
                  type: 'qrc',
                  qrcContent: qrc.qrcContent,
                  ...(translation.trim() !== '' ? { translationContent: translation } : {}),
                },
              }
            : {}),
        }
      }
      if (translation.trim() !== '') return { lrc: base, translation }
      const split = splitBilingual(base)
      return { lrc: split.lrc, translation: split.trans }
    }
    if (provider === 'kugou' || provider === 'kugouLite') {
      const res = await KG.getLyric({ hash: id }, kugouPlatform(provider))
      // The KRC stream carries both the word timeline and the translation; the plain
      // LRC is the fallback when the track has no KRC.
      let word = null
      try {
        word = await KG.getWordLines({ hash: id }, kugouPlatform(provider))
      } catch {
        word = null
      }
      const wordLines = word !== null && Array.isArray(word.lines) ? word.lines : []
      const hasWords = wordLines.some((line) => Array.isArray(line.words) && line.words.length > 0)
      let translation = ''
      if (word !== null && Array.isArray(word.translations)) {
        const parts = []
        for (let index = 0; index < wordLines.length; index += 1) {
          const text = word.translations[index]
          if (typeof text !== 'string' || text.trim() === '') continue
          parts.push(lrcTime(Math.max(0, Number(wordLines[index] && wordLines[index].t) || 0)) + text)
        }
        translation = parts.join('\n')
      }
      if (hasWords) {
        return {
          lrc: wordLines.map((line) => lrcTime(line.t) + String(line.text ?? '')).join('\n'),
          translation,
          lines: wordLines,
          wordLevel: true,
          ...(word !== null && typeof word.plain === 'string' && word.plain !== ''
            ? {
                raw: {
                  type: 'local',
                  lrcContent: word.plain,
                  formatHint: 'krc',
                  ...(translation.trim() !== '' ? { tLrcContent: translation } : {}),
                },
              }
            : {}),
        }
      }
      if (translation === '') {
        const split = splitBilingual(res.lyric || '')
        return { lrc: split.lrc, translation: split.trans }
      }
      return { lrc: res.lyric || '', translation }
    }
  } catch {
    return { lrc: '', translation: '' }
  }
  return { lrc: '', translation: '' }
}

// ── bilingual lyric splitter ─────────────────────────────────────────────
// Some providers put the translation on its own timestamped line right after
// the original (or share its timestamp). Detect which language class is the
// minority and emit it as translation lines.
function lyricClassOf(text) {
  const letters = (text.match(/[a-zA-Z]/g) || []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  if (letters >= 3 && cjk === 0) return 'latin'
  if (cjk >= 2 && letters === 0) return 'cjk'
  return 'other'
}

function parseLrcLines(text) {
  const lines = []
  String(text || '')
    .split(/\r?\n/)
    .forEach((raw) => {
      const match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
      if (match === null) return
      const t = Number(match[1]) * 60 + Number(match[2])
      if (!Number.isFinite(t)) return
      lines.push({ t, text: match[3].trim() })
    })
  return lines
}

function lrcTime(t) {
  const seconds = Math.max(0, t)
  const minutes = Math.floor(seconds / 60)
  const rest = (seconds % 60).toFixed(3)
  return '[' + String(minutes).padStart(2, '0') + ':' + (rest.length < 6 ? '0' + rest : rest) + ']'
}

function isCreditLine(text) {
  const value = String(text || '').trim()
  if (value === '') return false
  if (/^(作词|作曲|编曲|制作|监制|出品|发行|录音|混音|母带|和声|吉他|贝斯|鼓|键盘|弦乐|词|曲)\s*[:：]/i.test(value)) {
    return true
  }
  return /^(lyrics?|composed|composer|arranged|arranger|producer|produced|mixed|mastered|written|music|words)\b[^:：]{0,24}[:：]/i.test(value)
}

function splitBilingual(text) {
  const lines = parseLrcLines(text)
  if (lines.length === 0) return { lrc: text, trans: '' }
  let latinCount = 0
  let cjkCount = 0
  let firstClass = null
  for (const line of lines) {
    if (isCreditLine(line.text)) continue
    const cls = lyricClassOf(line.text)
    if (cls === 'latin') {
      latinCount += 1
      if (firstClass === null) firstClass = 'latin'
    } else if (cls === 'cjk') {
      cjkCount += 1
      if (firstClass === null) firstClass = 'cjk'
    }
  }
  const mainClass = latinCount > cjkCount ? 'latin' : cjkCount > latinCount ? 'cjk' : firstClass
  if (mainClass === null || mainClass === undefined) return { lrc: text, trans: '' }
  const transClass = mainClass === 'latin' ? 'cjk' : 'latin'
  const kept = []
  const trans = []
  let lastKeepT = null
  let lastTransT = null
  for (const line of lines) {
    const cls = lyricClassOf(line.text)
    const isTrans = cls === transClass && !isCreditLine(line.text)
    const afterKeep = lastKeepT !== null && Math.abs(line.t - lastKeepT) < 0.6
    const sameTrans = lastTransT !== null && line.t === lastTransT
    if (isTrans && (afterKeep || sameTrans)) {
      trans.push(lrcTime(line.t) + line.text)
      lastTransT = line.t
      continue
    }
    kept.push(line)
    lastKeepT = line.t
    lastTransT = null
  }
  if (trans.length === 0) return { lrc: text, trans: '' }
  return {
    lrc: kept.map((line) => lrcTime(line.t) + line.text).join('\n'),
    trans: trans.join('\n'),
  }
}

function shapePlaylist(item) {  return {
    provider: item.source || '',
    id: String(item.id || ''),
    name: item.name || '',
    cover: item.cover || '',
    trackCount: Number(item.trackCount) || 0,
    creator: item.creator || '',
    kind: item.kind || 'own',
    isOwned: item.isOwned === true || (item.kind || 'own') !== 'collect',
    isLike: item.isLike === true,
    isDefault: item.isDefault === true || item.isLike === true,
  }
}

/**
 * A browseable song list for one provider.
 *
 * Only Navidrome implements this: the Chinese platforms are search-driven, so
 * they return [] rather than inventing a listing.
 *
 * @returns {Promise<object[]>}
 */
export async function songs(provider, cookie = '', session = {}, size = 200) {
  if (provider === 'navidrome') {
    const list = await ND.songs(navidromeConfig(session), size)
    return list.map((song) => {
      rawSongs.set('navidrome:' + song.id, song)
      return song
    })
  }
  return []
}

/**
 * One page of the complete library via Navidrome's native API.
 *
 * Only used when the user opted in and a password is on file; callers must
 * check `session.nativeSongs` first. Returns { songs, total, offset }.
 */
export async function nativeSongs(provider, session = {}, options = {}) {
  if (provider !== 'navidrome') return { songs: [], total: 0, offset: 0 }
  const result = await ND.nativeSongs(navidromeConfig(session), options)
  for (const song of result.songs) rawSongs.set('navidrome:' + song.id, song)
  return result
}

/**
 * Drop cached provider tokens for a logout.
 *
 * Only Navidrome keeps one (the native-API JWT); the others are stateless once
 * their cookie is cleared.
 */
export function forgetProviderTokens(provider) {
  if (provider === 'navidrome') ND.forgetAllNativeTokens()
}

/** Every artist. Navidrome only; other providers answer with []. */
export async function artists(provider, cookie = '', session = {}) {
  if (provider === 'navidrome') return ND.artists(navidromeConfig(session))
  return []
}

/** Albums by name. Navidrome only; other providers answer with []. */
export async function albums(provider, cookie = '', session = {}, size = 200) {
  if (provider === 'navidrome') return ND.albums(navidromeConfig(session), size)
  return []
}

/** One artist's albums, for expanding an artist card. */
export async function artistAlbums(provider, id, cookie = '', session = {}) {
  if (provider === 'navidrome') {
    return ND.artistAlbums(navidromeConfig(session), id)
  }
  if (provider === 'qq') {
    const mid = String(id || '').trim()
    if (mid === '') return { artist: null, albums: [] }
    const detailAnswer = await qqUpstream('/getSingerHotsong', { singermid: mid, limit: 1, page: 1 }, { cookie })
    const data = detailAnswer?.response?.singer?.data
    const info = data?.singer_info ?? {}
    const answer = await qqUpstream('/getSingerAlbum', { singermid: mid, limit: 50, page: 0 }, { cookie })
    const rows = answer?.response?.singer?.data?.albumList
    const albums = Array.isArray(rows)
      ? rows.map((row) => albumCard('qq', row)).filter((album) => album.id !== '')
      : []
    return {
      artist: {
        id: mid,
        name: textOf(info.singer_name || info.name || ''),
        cover: textOf(info.singer_pic || info.pic || ''),
        description: textOf(data?.singer_brief || info.briefDesc || ''),
        provider: 'qq',
      },
      albums,
    }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const platform = provider === 'kugouLite' ? 'lite' : 'standard'
    const detail = await callKugou(platform, 'artist_detail', { id: String(id) })
    const rawArtist = kugouObject(detail.body) ?? {}
    const answer = await callKugou(platform, 'artist_albums', {
      id: String(id),
      page: 1,
      pagesize: 50,
    })
    const albums = kugouList(answer.body)
      .map((row) => albumCard(provider, row))
      .filter((album) => album.id !== '')
    return {
      artist: artistCard(provider, rawArtist),
      albums,
    }
  }
  if (provider === 'netease') {
    const detailAnswer = await ncUpstream('/artist/detail', { id: String(id) }, { cookie })
    const rawArtist = detailAnswer?.data?.artist ?? detailAnswer?.artist ?? {}
    const answer = await ncUpstream('/artist/album', { id: String(id), limit: 50, offset: 0 }, { cookie })
    const rows = answer?.hotAlbums
    const albums = Array.isArray(rows)
      ? rows.map((row) => albumCard('netease', row)).filter((album) => album.id !== '')
      : []
    return {
      artist: artistCard('netease', rawArtist),
      albums,
    }
  }
  return { artist: null, albums: [] }
}

/**
 * The signed-in account's playlists (requires a login cookie / session).
 * @returns {Promise<{ provider: string, id: string, name: string, cover: string, trackCount: number, creator: string, kind: string, isDefault: boolean }[]>}
 */
export async function myPlaylists(provider, cookie = '', session = {}) {
  if (provider === 'navidrome') {
    return (await ND.myPlaylists(navidromeConfig(session))).map(shapePlaylist)
  }
  if (provider === 'netease') {
    return (await NC.getMyPlaylists(cookie)).map(shapePlaylist)
  }
  if (provider === 'qq') {
    return (await QQ.getMyPlaylists(cookie)).map(shapePlaylist)
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    return (await (provider === 'kugouLite' ? KGL.getMyPlaylists(session) : KG.getMyPlaylists(session))).map(shapePlaylist)
  }
  throw new Error('未知平台：' + provider)
}

/**
 * One playlist's songs, normalised like search results.
 * @returns {Promise<{ name: string, cover: string, trackCount: number, songs: object[] }>}
 */
export async function playlistSongs(provider, id, cookie = '', session = {}) {
  let result
  if (provider === 'navidrome') {
    const songs = await ND.playlistSongs(navidromeConfig(session), id)
    return { name: '', cover: '', trackCount: songs.length, songs }
  }
  if (provider === 'netease') {
    result = await NC.getPlaylistSongs(id, cookie)
  } else if (provider === 'qq') {
    result = await QQ.getPlaylistSongs(id, cookie)
  } else if (provider === 'kugou' || provider === 'kugouLite') {
    // "我的歌单" ids are cloud-playlist listids (not public specialids): use the
    // cloudlist endpoints. Collected playlists only list songs through
    // get_other_list_file_nofilt (the local copy is often empty).
    let songs = []
    let meta = { name: '', cover: '', trackCount: 0 }
    let matched = false
    try {
      const mine = await (provider === 'kugouLite' ? KGL.getMyPlaylists(session) : KG.getMyPlaylists(session))
      const item = (mine || []).find((entry) => String(entry.id) === String(id))
      if (item) {
        matched = true
        meta = { name: item.name || '', cover: item.cover || '', trackCount: item.trackCount || 0 }
        if (item.kind === 'collect' && item.creatorGid) {
          songs = await KG.getCollectedPlaylistSongs(item.creatorGid, session)
        } else {
          songs = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(id, session) : KG.getMyPlaylistSongs(id, session))
        }
      }
    } catch {
      matched = false
    }
    if (!matched) {
      const detail = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(id, session) : KG.getPlaylistSongs(id, session))
      songs = detail.songs || []
      meta = { name: detail.name || '', cover: detail.cover || '', trackCount: detail.trackCount || songs.length }
    }
    result = {
      name: meta.name,
      cover: meta.cover,
      trackCount: meta.trackCount || songs.length,
      songs,
    }
  } else {
    throw new Error('未知平台：' + provider)
  }
  const songs = (result.songs || []).map((song) => {
    const shaped = shape(provider, song)
    rawSongs.set(provider + ':' + shaped.id, song)
    return shaped
  })
  return {
    name: result.name || '',
    cover: result.cover || '',
    trackCount: Number(result.trackCount) || songs.length,
    songs,
  }
}

function pageBounds(page) {
  return {
    limit: Math.max(1, Math.min(200, parseInt(page?.limit, 10) || 100)),
    offset: Math.max(0, parseInt(page?.offset, 10) || 0),
  }
}

function shapePlaylistSongs(provider, rows) {
  return (Array.isArray(rows) ? rows : []).map((song) => {
    const shaped = shape(provider, song)
    rawSongs.set(provider + ':' + shaped.id, song)
    return shaped
  })
}

/**
 * The account's playlist list for KuGou, kept briefly: every page of every playlist used to
 * re-read it upstream just to recognise one id.
 */
const kugouPlaylistListCache = new Map()
const KUGOU_PLAYLIST_LIST_TTL = 30 * 1000

async function kugouAccountPlaylists(provider, session) {
  const hit = kugouPlaylistListCache.get(provider)
  if (hit && Date.now() - hit.at < KUGOU_PLAYLIST_LIST_TTL) return hit.list
  try {
    const list = await (provider === 'kugouLite' ? KGL.getMyPlaylists(session) : KG.getMyPlaylists(session))
    if (Array.isArray(list)) {
      kugouPlaylistListCache.set(provider, { at: Date.now(), list })
      return list
    }
  } catch {
    // Fall through: an unrecognised id takes the legacy path, which asks again if it must.
  }
  return []
}

/**
 * One page of a playlist. Folia's catalogue contract is page-shaped; providers
 * with a native paged read return it directly, the rest are adapted from the
 * legacy full read until their page primitive is migrated.
 */
export async function playlistSongsPage(provider, id, cookie = '', session = {}, page = {}) {
  const { limit, offset } = pageBounds(page)
  if (provider === 'netease') {
    const result = await NC.getPlaylistSongsPage(id, limit, offset, cookie)
    return {
      name: result.name || '',
      cover: result.cover || '',
      trackCount: Number(result.trackCount) || 0,
      songs: shapePlaylistSongs(provider, result.songs),
      hasMore: result.hasMore === true,
      nextOffset: Number(result.nextOffset) || offset,
    }
  }
  if (provider === 'qq') {
    const result = await QQ.getPlaylistSongsPage(id, limit, offset, cookie)
    return {
      name: result.name || '',
      cover: result.cover || '',
      trackCount: Number(result.trackCount) || 0,
      songs: shapePlaylistSongs(provider, result.songs),
      hasMore: result.hasMore === true,
      nextOffset: Number(result.nextOffset) || offset,
    }
  }
  if (provider === 'navidrome') {
    const result = await ND.playlistSongsPage(navidromeConfig(session), id, limit, offset)
    return {
      name: result.name || '',
      cover: result.cover || '',
      trackCount: Number(result.trackCount) || 0,
      songs: shapePlaylistSongs(provider, result.songs),
      hasMore: result.hasMore === true,
      nextOffset: Number(result.nextOffset) || offset,
    }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    // kugouLite takes the row's own id (a cloud list id) straight in playlist_track_all, so it
    // is asked first: the account-list lookup below costs one or two extra upstream calls on
    // every page, and when one of them was slow or rate-limited the old order fell into the
    // legacy full-read path — the "stuck on skeletons until I switch away and back" report.
    // The standard client's page reader needs the cloud ids only its account list carries, so
    // it keeps the lookup (now cached for a moment) as its first step.
    if (provider === 'kugouLite') {
      let direct = null
      try {
        direct = await KGL.getMyPlaylistSongsPage(id, limit, offset, session)
      } catch {
        direct = null
      }
      const directSongs = direct !== null && Array.isArray(direct.songs) ? direct.songs : []
      const directTotal = direct === null ? 0 : Number(direct.trackCount) || 0
      if (direct !== null && (directSongs.length > 0 || directTotal > 0 || offset > 0)) {
        return {
          // The row already carries its name and cover; the page answer has no room for them.
          name: '',
          cover: '',
          trackCount: directTotal || directSongs.length,
          songs: shapePlaylistSongs(provider, directSongs),
          hasMore: direct.hasMore === true,
          nextOffset: Number(direct.nextOffset) || offset + directSongs.length,
        }
      }
    }
    const mine = await kugouAccountPlaylists(provider, session)
    const item = (mine || []).find((entry) => String(entry.id) === String(id))
    if (item && item.kind !== 'collect') {
      const result = await (provider === 'kugouLite'
        ? KGL.getMyPlaylistSongsPage(id, limit, offset, session)
        : KG.getMyPlaylistSongsPage(id, limit, offset, session))
      return {
        name: item.name || '',
        cover: item.cover || '',
        trackCount: Number(result.trackCount) || Number(item.trackCount) || 0,
        songs: shapePlaylistSongs(provider, result.songs),
        hasMore: result.hasMore === true,
        nextOffset: Number(result.nextOffset) || offset,
      }
    }
    if (provider === 'kugou') {
      const result = await KG.getPlaylistSongsPage(id, limit, offset, session)
      return {
        name: result.name || '',
        cover: result.cover || '',
        trackCount: Number(result.trackCount) || 0,
        songs: shapePlaylistSongs(provider, result.songs),
        hasMore: result.hasMore === true,
        nextOffset: Number(result.nextOffset) || offset,
      }
    }
  }
  const full = await playlistSongs(provider, id, cookie, session)
  const songs = full.songs.slice(offset, offset + limit)
  return {
    name: full.name || '',
    cover: full.cover || '',
    trackCount: full.trackCount || full.songs.length,
    songs,
    hasMore: offset + songs.length < full.songs.length,
    nextOffset: offset + songs.length,
  }
}


// =====================================================================
// Cloud writes: like one song / add it to one of the account's playlists.
// These reuse the provider modules' verified write endpoints and the raw
// search object cache, so the Host routes only pass provider + id.
// =====================================================================

async function resolveLikePlaylist(provider, cookie, session) {
  const list = await myPlaylists(provider, cookie, session)
  return (
    list.find((item) => item.isLike === true) ||
    list.find((item) => item.kind === 'default') ||
    list.find((item) => item.isDefault === true) ||
    null
  )
}

async function qqWriteSong(id, cookie) {
  const raw = rawSongs.get('qq:' + id) || null
  if (raw !== null && Number(raw.songid)) return raw
  const info = await QQ.getSongInfoByMid(id, cookie)
  return { songid: info.songid, songtype: 0, songmid: id }
}

function kgWriteSong(id, song) {
  const raw = rawSongs.get('kugou:' + id) || null
  if (raw !== null) return raw
  return { hash: id, title: (song && song.title) || '', interval: Number((song && song.durationSec) || 0) * 1000 }
}

export async function onlineLiked(provider, id, cookie = '', session = {}) {
  const target = String(id || '')
  if (target === '') return false
  if (provider === 'navidrome') {
    // Subsonic has no per-song status call; the starred list is the source of
    // truth. The player bar asks once per track, so one extra request is fine.
    const starred = await ND.starredIds(navidromeConfig(session))
    return starred.includes(target)
  }
  if (provider === 'qq') {
    const favs = await QQ.getQQFavIds(cookie)
    return (favs.mids || []).includes(target)
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const like = await resolveLikePlaylist(provider, cookie, session)
    if (like === null) return false
    const songs = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(like.id, session) : KG.getMyPlaylistSongs(like.id, session))
    return songs.some((song) => String(song.hash) === target)
  }
  const like = await resolveLikePlaylist(provider, cookie, session)
  if (like === null) return false
  const result = await NC.getPlaylistSongs(like.id, cookie)
  return (result.songs || []).some((song) => String(song.id) === target)
}

export async function setOnlineLiked(provider, song, on, cookie = '', session = {}) {
  const id = String((song && song.id) || '')
  if (id === '') throw new Error('缺少歌曲 id')
  if (provider === 'navidrome') return ND.setStarred(navidromeConfig(session), id, on === true)
  if (provider === 'qq') {
    const raw = await qqWriteSong(id, cookie)
    return on ? QQ.addQQFav(raw, cookie) : QQ.removeQQFav(raw, cookie)
  }
  if (provider === 'kugouLite') {
    const raw = rawSongs.get('kugouLite:' + id) || {
      id,
      hash: id,
      title: String((song && song.title) || ''),
      albumId: Number((song && song.albumId) || 0),
      mixSongId: Number((song && (song.mixSongId || song.albumAudioId)) || 0),
    }
    return KGL.setLiked(raw, on === true, session)
  }
  const like = await resolveLikePlaylist(provider, cookie, session)
  if (like === null) throw new Error('没有找到「我喜欢」歌单')
  if (provider === 'kugou') {
    if (on) {
      await KG.addSongToPlaylist(kgWriteSong(id, song), like.id, session)
      return true
    }
    const songs = await KG.getMyPlaylistSongs(like.id, session)
    const hit = songs.find((item) => String(item.hash) === id)
    if (!hit || !hit.fileId) throw new Error('未找到该歌曲')
    await KG.deleteSongFromPlaylist(hit.fileId, like.id, session)
    return true
  }
  await NC.manipulateTracks(like.id, [id], cookie, on ? 'add' : 'del')
  return true
}

export async function addOnlineSongToPlaylist(provider, song, playlistId, cookie = '', session = {}) {
  const id = String((song && song.id) || '')
  if (id === '') throw new Error('缺少歌曲 id')
  if (provider === 'navidrome') return ND.addSongToPlaylist(navidromeConfig(session), playlistId, id)
  if (provider === 'qq') {
    const raw = await qqWriteSong(id, cookie)
    await QQ.addSongToPlaylist(raw, playlistId, 0, cookie)
    return true
  }
  if (provider === 'kugou') {
    await KG.addSongToPlaylist(kgWriteSong(id, song), playlistId, session)
    return true
  }
  if (provider === 'kugouLite') {
    const raw = rawSongs.get('kugouLite:' + id) || {
      id,
      hash: id,
      title: String((song && song.title) || ''),
      albumId: Number((song && song.albumId) || 0),
      mixSongId: Number((song && (song.mixSongId || song.albumAudioId)) || 0),
    }
    return KGL.addSongToPlaylist(raw, playlistId, session)
  }
  await NC.manipulateTracks(playlistId, [id], cookie, 'add')
  return true
}


/** All liked track keys for one provider, shaped like client track.path. */
export async function onlineLikedIds(provider, cookie = '', session = {}) {
  // Navidrome has no "liked" playlist: favorites are the starred set itself.
  if (provider === 'navidrome') {
    const starred = await ND.starredIds(navidromeConfig(session))
    return starred.map((songId) => 'online:navidrome:' + songId)
  }
  const like = await resolveLikePlaylist(provider, cookie, session)
  if (like === null) return []
  if (provider === 'qq') {
    const favs = await QQ.getQQFavIds(cookie)
    return (favs.mids || []).map((mid) => 'online:qq:' + mid)
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const songs = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(like.id, session) : KG.getMyPlaylistSongs(like.id, session))
    return songs.map((song) => 'online:' + provider + ':' + song.hash)
  }
  const result = await NC.getPlaylistSongs(like.id, cookie)
  return (result.songs || []).map((song) => 'online:netease:' + song.id)
}

/**
 * One account's listening ranking, newest first. `week` and `all` follow the
 * platform's own spans (QQ's `all` is its year ranking; the name says so).
 *
 * @param {'netease'|'qq'|'kugou'|'kugouLite'} provider
 * @param {'week'|'all'} range
 * @returns {Promise<object[]>}
 */
export async function listeningRank(provider, range, cookie = '', session = {}) {
  const span = range === 'all' ? 'all' : 'week'
  if (provider === 'netease') {
    const account = await NC.getAccount(cookie)
    if (account === null) throw new Error('登录态已失效，请重新扫码登录')
    const answer = await ncUpstream('/user/record', {
      uid: Number(account.userId) || 0,
      type: span === 'week' ? 1 : 0,
    }, { cookie })
    const rows = span === 'week' ? answer?.weekData : answer?.allData
    if (!Array.isArray(rows)) throw new Error('网易云没有返回听歌排行')
    return rows
      .filter((row) => row && row.song && typeof row.song === 'object')
      .map((row) => {
        const song = NC.songOf(row.song)
        return song === null ? null : { ...song, listenCount: Number(row.playCount) || 0 }
      })
      .filter(Boolean)
  }
  if (provider === 'qq') {
    const answer = await qqUpstream('/user/listening-rank', {
      range: span === 'week' ? 'week' : 'year',
    }, { cookie })
    const items = Array.isArray(answer?.items) ? answer.items : []
    return items.flatMap((item) => {
      if (item === null || typeof item !== 'object' || item.track === null || typeof item.track !== 'object') return []
      const song = QQ.toLegacyResult(item.track)
      return song === null ? [] : [{ ...song, listenCount: Number(item.listenCount) || 0 }]
    })
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const platform = provider === 'kugouLite' ? 'lite' : 'standard'
    const answer = await callKugou(platform, 'user_listen', {
      userid: String(session.userid ?? ''),
      type: span === 'week' ? 0 : 1,
    })
    const rows = answer.body?.data?.lists
    if (!Array.isArray(rows)) throw new Error('酷狗没有返回听歌排行')
    return rows
      .map((item) => ({ ...KG.normalizeSong(item), listenCount: Number(item?.listen_count) || 0 }))
      .filter((song) => song.id !== '')
  }
  throw new Error('该平台没有听歌排行')
}

/** Remove one song from an owned playlist; each platform has its own write route. */
export async function removeOnlineSongFromPlaylist(provider, song, playlistId, cookie = '', session = {}) {
  if (provider === 'netease') return await NC.removeFromPlaylist(song, playlistId, cookie)
  if (provider === 'qq') return await QQ.removeFromPlaylist(song, playlistId, cookie)
  if (provider === 'kugou' || provider === 'kugouLite') {
    const key = provider === 'kugouLite' ? 'kugouLite:' : 'kugou:'
    const raw = rawSongs.get(key + String(song?.id ?? '')) || song
    const fileId = raw?.fileId ?? song?.fileId
    if (!fileId) throw new Error('酷狗歌曲缺少 fileId，无法从歌单移除')
    await KG.deleteSongFromPlaylist(fileId, playlistId, session)
    return true
  }
  throw new Error('该平台不支持从歌单移除歌曲')
}

/** Folia's collection subscription status. Kugou concept has no write route here. */
export async function subscriptionStatus(provider, type, id, cookie = '') {
  if (provider === 'netease') return await NC.subscriptionStatus(type, id, cookie)
  if (provider === 'qq') return await QQ.subscriptionStatus(type, id, cookie)
  return false
}

/** Subscribe/unsubscribe an album or playlist. */
export async function subscribeCollection(provider, type, id, subscribed, cookie = '') {
  if (provider === 'netease') return await NC.subscribeCollection(type, id, subscribed, cookie)
  if (provider === 'qq') return await QQ.subscribeCollection(type, id, subscribed, cookie)
  throw new Error('该平台不支持订阅')
}

/**
 * Report one real listen to the platform that owns the song. Only NetEase
 * declares this capability today; the Host keeps the platform vocabulary here.
 *
 * @param {object} song
 * @param {{ playedSeconds: number, totalSeconds?: number, quality?: string }} report
 */
export async function reportPlayback(provider, song, report, cookie = '') {
  if (provider !== 'netease') throw new Error('该平台不接受播放上报')
  const id = String(song?.id ?? '')
  if (!/^\d+$/.test(id) || Number(id) <= 0) throw new Error('这首歌不能上报')
  const quality = String(report?.quality ?? 'high')
  const level = quality === 'standard'
    ? { level: 'standard', bitrate: 128 }
    : quality === 'lossless'
      ? { level: 'lossless', bitrate: 999 }
      : quality === 'hires'
        ? { level: 'hires', bitrate: 1999 }
        : { level: 'exhigh', bitrate: 320 }
  const answer = await ncUpstream('/scrobble/v1', {
    id: Number(id),
    time: Math.max(1, Math.round(Number(report?.playedSeconds) || 0)),
    name: String(song?.title ?? ''),
    artist: String(song?.artist ?? ''),
    level: level.level,
    bitrate: level.bitrate,
    ...(Number(report?.totalSeconds) > 0 ? { total: Math.round(Number(report.totalSeconds)) } : {}),
  }, { cookie })
  const code = Number(answer?.code)
  if (!Number.isFinite(code)) throw new Error('网易云没有返回播放上报状态')
  if ([301, 401, 403].includes(code)) throw new Error('登录态已失效，不能上报播放')
  if (code !== 200) throw new Error(`播放上报被拒绝（${code}）`)
  return true
}
export async function providerVip(provider, cookie = '', session = {}) {
  if (provider === 'navidrome') {
    // A self-hosted library has no paid tier: everything the account can see
    // is playable, so there is nothing to gate.
    return false
  }
  if (provider === 'netease') {
    if (!cookie) return false
    const account = await NC.getAccount(cookie)
    return account === null ? false : Number(account.vipType) > 0
  }
  if (provider === 'qq') {
    if (!cookie) return false
    return await QQ.detectVip(cookie)
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    if (!session || !session.token) return false
    if (provider === 'kugouLite') return (await KGL.getVip(session)).vip
    try {
      const payload = await KG.getVip(session)
      const data = payload && payload.data ? payload.data : null
      if (data) {
        if (Number(data.is_vip) === 1) return true
        if (Number(data.vip_type) > 0) return true
        if (Number(data.svip_level) > 0 && data.su_vip_end_time) return true
      }
    } catch {
      // Fall back to the token/scan fields below.
    }
    const type = String(session.vipType || '').trim()
    return Number(type) > 0
  }
  return null
}

function vipTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000
  const text = String(value || '').trim()
  if (text === '') return 0
  if (/^\d+$/.test(text)) {
    const number = Number(text)
    return number > 1e12 ? number : number * 1000
  }
  const parsed = Date.parse(text.replace(' ', 'T') + '+08:00')
  return Number.isFinite(parsed) ? parsed : 0
}

/** VIP flag plus the best available expiry string ('' when the platform does not expose it). */
export async function providerVipInfo(provider, cookie = '', session = {}) {
  if (provider === 'kugouLite') {
    const info = await KGL.getVip(session)
    return { vip: info.vip === true, expiresAt: info.expiresAt || '' }
  }
  if (provider === 'kugou') {
    if (!session || !session.token) return { vip: false, expiresAt: '' }
    try {
      const payload = await KG.getVip(session)
      const data = payload && payload.data ? payload.data : null
      if (data) {
        const candidates = [data.vip_end_time, data.su_vip_end_time]
          .map((value) => ({ text: String(value || '').trim(), at: vipTimestamp(value) }))
          .filter((row) => row.at > Date.now())
          .sort((left, right) => right.at - left.at)
        const active = Number(data.is_vip) === 1 || Number(data.vip_type) > 0
        return { vip: active, expiresAt: active && candidates.length > 0 ? candidates[0].text : '' }
      }
    } catch {
      // fall through to the token value
    }
    return { vip: Number(String(session.vipType || '').trim()) > 0, expiresAt: '' }
  }
  if (provider === 'netease') {
    if (!cookie) return { vip: false, expiresAt: '' }
    const account = await NC.getAccount(cookie)
    return { vip: account !== null && Number(account.vipType) > 0, expiresAt: '' }
  }
  if (provider === 'qq') {
    if (!cookie) return { vip: false, expiresAt: '' }
    return { vip: (await QQ.detectVip(cookie)) === true, expiresAt: '' }
  }
  return { vip: false, expiresAt: '' }
}

function cookiePart(cookie, name) {
  const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(String(cookie || ''))
  return m ? m[1].trim() : ''
}

/** Public account profile for settings (nickname + avatar URL; never cookies). */
export async function providerProfile(provider, cookie = '', session = {}) {
  if (provider === 'navidrome') {
    const cfg = navidromeConfig(session)
    return cfg.username === '' ? null : { nickname: cfg.username, avatarUrl: '' }
  }
  if (provider === 'netease') {
    const account = await NC.getAccount(cookie)
    return account === null
      ? null
      : { accountId: String(account.userId || ''), nickname: account.nickname || '', avatarUrl: account.avatarUrl || '' }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    if (provider === 'kugouLite') {
      const info = await KGL.getProfile(session)
      return { nickname: info?.nickname || '', avatarUrl: info?.avatarUrl || '', accountId: String(session.userid || '') }
    }
    const info = await KG.getMyUserInfo(session)
    return { nickname: info.nickname || '', avatarUrl: info.pic || '', accountId: String(session.userid || '') }
  }
  if (provider === 'qq') {
    const uin =
      cookiePart(cookie, 'uin') ||
      cookiePart(cookie, 'musicid') ||
      cookiePart(cookie, 'p_uin') ||
      String(session.userid ?? session.musicid ?? session.uin ?? '').trim()
    const nickname = String(session.nickname ?? '').trim()
    return {
      nickname: nickname !== '' ? nickname : uin === '' ? '' : 'QQ ' + uin,
      avatarUrl: uin === '' ? '' : 'https://q.qlogo.cn/headimg_dl?dst_uin=' + encodeURIComponent(uin) + '&spec=100',
      accountId: uin,
    }
  }
  return null
}
