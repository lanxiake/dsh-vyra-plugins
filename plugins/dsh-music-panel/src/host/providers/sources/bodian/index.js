/**
 * Bodian Music as a first-class source.
 *
 * The upstream package (`bodian-music-api`, AGPL-3.0) owns the signing and session
 * protocol; this module only adapts its shapes to our contract. It is registered
 * directly in the source registry instead of going through the legacy
 * `providers/index.js` factory, which is the pattern every new platform follows:
 * one directory, one registration line.
 *
 * Sessions are injected: the caller decides where credentials live. Until the
 * login rewrite lands, `createMemorySessions()` keeps them in memory.
 *
 * @module dsh-music-panel/sources/bodian
 */

import { capabilities as buildCapabilities, providerApi } from '../../../services/core/contract.js'
import { MusicError, toMusicError } from '../../../services/core/errors.js'
import { parseLrc } from '../lrc.js'

const SOURCE_ID = 'bodian'
const PAGE_SIZE = 60

/** Playback context remembered from the row that produced a track (Folia's providerData). */
const rowMeta = new Map()

/** Kuwo's CDN answers http links; Folia upgrades the kuwo hosts to https. */
function coverOf(value) {
  return String(value ?? '').replace(/^http:\/\/(?=[\w-]+\.kuwo\.cn\/)/, 'https://')
}

/** In-memory session repository shaped like the upstream package expects. */
export function createMemorySessions(initial = null) {
  let value = initial
  return {
    get: () => value,
    set: (next) => {
      value = next
    },
    clear: () => {
      value = null
    },
  }
}

/** One upstream search row → our `Track` shape. */
export function toTrack(row) {
  const item = row ?? {}
  const id = item.id ?? item.songId
  if (id === undefined || id === null || String(id) === '') return null

  const artists = Array.isArray(item.artists)
    ? item.artists.map((artist) => String(artist?.name ?? artist?.artistName ?? '')).filter(Boolean)
    : []
  const artist = String(item.artist ?? '')
  const cover = coverOf(item.albumPic ?? item.albumPic120 ?? '')
  const durationSec = Number(item.duration) || 0
  // `audio` needs the row's freeSign to resolve the account's playback rights; keep it
  // keyed by the track id for the later stream request (and for pages).
  const freeSign = String(item.freeSign ?? item.fsig ?? '')
  rowMeta.set(String(id), { freeSign })
  // The platform marks membership-only tracks in payInfo.feeType.vip ("1"); the same
  // field the web player badges. A missing value is not treated as free.
  const pay = item.payInfo && typeof item.payInfo === 'object' ? item.payInfo : {}
  const qualityHint = String(pay.feeType?.vip ?? '') === '1' ? 'VIP' : ''

  return {
    id: String(id),
    provider: SOURCE_ID,
    title: String(item.name ?? item.songName ?? item.FSONGNAME ?? '').trim(),
    artist: artist !== '' ? artist : artists.join(' / '),
    album: String(item.album ?? ''),
    albumId: String(item.albumId ?? ''),
    durationSec,
    durationMs: Math.round(durationSec * 1000),
    coverUrl: cover,
    qualityHint,
    sourceRef: { kind: 'online', sourceId: SOURCE_ID, ref: String(id) },
    providerData: {
      albumId: item.albumId ?? null,
      artistId: item.artistId ?? null,
      pay: item.payInfo ?? null,
      freeSign,
    },

    // ── Full entity, aligned with the online source contract ─────────────
    artistsDetail: Array.isArray(item.artists)
      ? item.artists.map((entry) => ({
          id: String(entry?.id ?? ''),
          name: String(entry?.name ?? ''),
          avatarUrl: String(entry?.pic ?? ''),
        }))
      : [],
    albumDetail: {
      id: String(item.albumId ?? ''),
      name: String(item.album ?? ''),
      coverUrl: cover,
      coverUrlSmall: coverOf(item.albumPic120 ?? ''),
    },
    aliases: item.subtitle ? [String(item.subtitle)] : [],
    translatedNames: [],
    publishTime: Number(item.releaseDate) || 0,
    popularity: 0,
    songType: 0,
    mvId: String(item.vid ?? ''),
    isVideo: item.isMv === true || String(item.isMv) === '1',
    mvDurationMs: (Number(item.mvduration) || 0) * 1000,
    copyright: 0,
    // `online: false` means the platform pulled the track.
    resourceState: item.online === undefined ? null : Boolean(item.online),
    preOnline: item.preOnline === true,
    noCopyright: null,
    privilegeDetail: item.payInfo ?? null,
    // Every bitrate the platform advertises is a selectable rung.
    availableQualities: Array.isArray(item.audios)
      ? item.audios
          .map((audio) => String(audio?.level ?? audio?.format ?? '').toLowerCase())
          .filter((level) => level !== '')
      : [],
    audioFormats: Array.isArray(item.audios)
      ? item.audios.map((audio) => ({
          bitrate: Number(audio?.bitrate) || 0,
          format: String(audio?.format ?? ''),
          level: String(audio?.level ?? ''),
          size: Number(audio?.size) || 0,
        }))
      : [],
  }
}

function unwrap(result, what) {
  if (result !== null && typeof result === 'object' && result.ok === true) return result.data
  const error = result?.error ?? {}
  throw new MusicError(String(error.message ?? `${what} failed`), {
    code: error.code === 'network' ? 'network' : 'protocol',
    sourceId: SOURCE_ID,
  })
}

/**
 * @param {{
 *   createApi: (options: object) => { request: (operation: string, params?: object) => Promise<object> },
 *   deviceId: string,
 *   sessions?: object,
 * }} options
 */
export function createBodianSource(options) {
  const sessions = options.sessions ?? createMemorySessions()
  const api = options.createApi({ deviceId: options.deviceId, sessions })
  const capabilities = buildCapabilities({
    search: true,
    playback: true,
    lyrics: true,
    loginQr: true,
    artists: true,
    albums: true,
    likes: true,
    likeWrite: true,
    userPlaylists: true,
    playlistSongs: true,
    playlistAdd: true,
  })

  async function request(operation, params) {
    try {
      // Registration starts the stored-session read in the background; a
      // request that arrives first waits for it instead of acting signed out.
      if (typeof sessions.whenReady === 'function') await sessions.whenReady()
      return unwrap(await api.request(operation, params), operation)
    } catch (error) {
      throw toMusicError(error, SOURCE_ID)
    }
  }

  // Rows restored from history carry only the singer's name. Resolve it through the
  // provider's own search once, the same way Folia's catalogRef would have brought it.
  async function resolveArtistId(name) {
    const wanted = String(name ?? '').trim()
    if (wanted === '') return ''
    try {
      const data = await request('search', { query: wanted, limit: 20, offset: 0 })
      const rows = Array.isArray(data?.resultList) ? data.resultList : []
      for (const row of rows) {
        const artists = Array.isArray(row?.artists) ? row.artists : []
        const match = artists.find(
          (artist) => String(artist?.name ?? '') === wanted && String(artist?.id ?? row?.artistId ?? '') !== '',
        )
        if (match !== undefined) return String(match.id ?? row.artistId)
        if (String(row?.artist ?? '') === wanted && row?.artistId !== undefined) return String(row.artistId)
      }
    } catch {
      // The caller reports the missing id with the provider's message.
    }
    return ''
  }

  const source = {
    id: SOURCE_ID,
    kind: 'online',
    displayName: 'Bodian Music',
    capabilities,
    qualityLevels: ['standard', 'high', 'lossless'],
    loginMethods: ['qr'],

    availability() {
      return { configured: true }
    },

    async search(query, page = 1, _ctx) {
      const keyword = String(query ?? '').trim()
      if (keyword === '') return { songs: [], total: 0, page: 1 }

      const data = await request('search', {
        query: keyword,
        limit: PAGE_SIZE,
        offset: Math.max(0, (Math.max(1, page) - 1) * PAGE_SIZE),
      })
      const rows = Array.isArray(data?.resultList) ? data.resultList : []
      const songs = rows.map(toTrack).filter(Boolean)
      return {
        songs,
        total: Number(data?.total) || songs.length,
        page: Math.max(1, page),
        hasMore: songs.length >= PAGE_SIZE,
      }
    },

    // ── catalogue pages (Folia's bodianCatalog operations) ────────────────
    async artistSongs(name, ctx = {}) {
      let artistId = String(ctx.artistId || '').trim()
      if (artistId === '') artistId = await resolveArtistId(name)
      if (artistId === '') {
        throw new MusicError('Bodian singer has no id', { code: 'unavailable', sourceId: SOURCE_ID })
      }
      const page = ctx.page ?? {}
      const wanted = Math.max(1, Number(page.limit) || 200)
      let offset = Math.max(0, Number(page.offset) || 0)
      const songs = []
      // The package rejects a limit above 100; walk pages until the route's ask is met.
      while (songs.length < wanted) {
        const limit = Math.min(100, wanted - songs.length)
        const data = await request('artist_songs', { id: artistId, limit, offset })
        const rows = Array.isArray(data?.resultList) ? data.resultList : []
        songs.push(...rows.map(toTrack).filter(Boolean))
        offset += rows.length
        if (rows.length < limit || data?.bodianPagination?.hasMore !== true) break
      }
      return songs
    },

    async albumSongs(id, _ctx, hint = {}) {
      const albumId = String(id || '').trim()
      if (albumId === '') {
        throw new MusicError('Bodian album has no id', { code: 'unavailable', sourceId: SOURCE_ID })
      }
      const songs = []
      let offset = 0
      // The car API caps a page at 100 rows; an album is normally a single page but the
      // pagination hint is honoured when it is not.
      for (;;) {
        const data = await request('album_tracks', { id: albumId, limit: 100, offset })
        const rows = Array.isArray(data?.resultList) ? data.resultList : []
        songs.push(...rows.map(toTrack).filter(Boolean))
        offset += rows.length
        if (rows.length < 100 || data?.bodianPagination?.hasMore !== true) break
        if (offset > 1000) break
      }
      let info = {}
      try {
        info = (await request('album_detail', { id: albumId }))?.albumInfo ?? {}
      } catch {
        // The track list is the page; a missing detail only loses its header.
      }
      return {
        id: albumId,
        name: String(info.name ?? hint.album ?? ''),
        artist: String(info.artist ?? hint.artist ?? ''),
        cover: coverOf(info.pic),
        trackCount: songs.length,
        songs,
      }
    },

    async artistAlbums(id) {
      const artistId = String(id || '').trim()
      if (artistId === '') return { artist: null, albums: [] }
      const data = await request('artist_albums', { id: artistId, limit: 100, offset: 0 })
      const rows = Array.isArray(data?.resultList) ? data.resultList : []
      const albums = rows
        .map((row) => {
          const cover = coverOf(row?.pic)
          return {
            id: String(row?.albumId ?? row?.id ?? ''),
            name: String(row?.name ?? ''),
            type: 'album',
            // Album cards read `cover` (the legacy collection shape); keep coverUrl too.
            cover,
            coverUrl: cover,
            trackCount: Number(row?.songNum ?? row?.total) || undefined,
            artist: String(row?.artist ?? ''),
          }
        })
        .filter((album) => album.id !== '')
      let artist = null
      try {
        const info = (await request('artist_detail', { id: artistId }))?.artistInfo ?? {}
        artist = {
          id: artistId,
          name: String(info.name ?? ''),
          cover: coverOf(info.pic),
          description: String(info.intro ?? ''),
        }
      } catch {
        // The album grid still stands without the header.
      }
      return { artist, albums }
    },

    async getAudioSource(mediaId, _ctx, quality) {
      const id = String(mediaId)
      let meta = rowMeta.get(id) ?? null
      if (meta === null) {
        // The queue may be restored after a restart: the row cache is empty then.
        try {
          const detail = await request('song_detail', { id })
          meta = { freeSign: String(detail?.freeSign ?? detail?.fsig ?? '') }
          rowMeta.set(id, meta)
        } catch {
          meta = { freeSign: '' }
        }
      }
      const data = await request('audio', {
        id,
        quality: ['standard', 'high', 'lossless', 'hires'].includes(quality) ? quality : 'high',
        freeSign: meta.freeSign || '',
      })
      const url = typeof data?.url === 'string' ? data.url : ''
      if (url === '') {
        throw new MusicError('this track has no playable URL', { code: 'not-playable', sourceId: SOURCE_ID })
      }
      const preview = data.preview ?? null
      return {
        url,
        quality: String(data.quality ?? quality ?? 'standard'),
        preview: preview !== null,
        clipStartMs: preview !== null ? Math.max(0, Number(preview.startTime) || 0) * 1000 : 0,
      }
    },

    async getLyrics(mediaId, _ctx) {
      const data = await request('lyrics', { id: String(mediaId) })
      const text = String(data?.mainText ?? '')
      const lines = parseLrc(text)
      if (lines.length === 0) {
        throw new MusicError('this track has no timed lyrics', { code: 'not-playable', sourceId: SOURCE_ID })
      }
      return { lines, wordByWord: false, source: SOURCE_ID }
    },

    // The plugin's facade calls `stream` / `lyric` (the legacy adapter vocabulary);
    // this source implements the newer names, so both are exposed.
    stream(id, ctx, quality) {
      return this.getAudioSource(id, ctx, quality)
    },
    // Routes consume the adapter-level shape `{ lrc, translation }` (the legacy
    // adapter converts `{ lyric, trans }` before answering; a native source must
    // speak that shape directly).
    async lyric(id) {
      const data = await request('lyrics', { id: String(id) })
      const text = String(data?.mainText ?? '')
      if (text.trim() === '') {
        throw new MusicError('this track has no lyrics', { code: 'not-playable', sourceId: SOURCE_ID })
      }
      return { lrc: text, translation: String(data?.transText ?? data?.translation ?? '') }
    },

    async myPlaylists() {
      const data = await request('user_playlists', { limit: 100, offset: 0 })
      const rowsOf = (value, field) => {
        if (Array.isArray(value)) return value
        return Array.isArray(value?.[field]) ? value[field] : []
      }
      const seen = new Set()
      const items = []
      const add = (raw, isOwned, isLike = false) => {
        const id = String(raw?.id ?? raw?.playlistId ?? raw?.listId ?? '')
        if (id === '' || seen.has(id)) return
        seen.add(id)
        items.push({
          provider: SOURCE_ID,
          id,
          name: String(raw?.name ?? raw?.title ?? '未命名歌单'),
          cover: coverOf(raw?.cover ?? raw?.pic ?? raw?.coverUrl ?? ''),
          trackCount: Number(raw?.songCount ?? raw?.trackCount ?? raw?.total ?? raw?.count ?? 0) || 0,
          creator: String(raw?.nickname ?? raw?.creator ?? ''),
          kind: isLike ? 'like' : isOwned ? 'own' : 'collect',
          isOwned,
          isLike,
          isDefault: isLike,
        })
      }
      if (data?.liked?.id !== undefined && data.liked !== null) add(data.liked, true, true)
      for (const raw of rowsOf(data?.owned, 'playLists')) add(raw, true)
      for (const raw of rowsOf(data?.collected, 'playLists')) add(raw, false)
      return items
    },

    async playlistSongs(id) {
      // Folia's bodianCatalog asks for a page; this Host route still returns one
      // array, so drain until the provider's total or a short page.
      const pageSize = 100
      const songs = []
      let offset = 0
      let total = 0
      for (let page = 0; page < 1000; page += 1) {
        const data = await request('playlist_tracks', { id: String(id), limit: pageSize, offset, source: 4 })
        const rows = Array.isArray(data?.resultList) ? data.resultList : Array.isArray(data?.list) ? data.list : []
        total = Number(data?.total) || total
        if (rows.length === 0) break
        songs.push(...rows.map(toTrack).filter(Boolean))
        offset += rows.length
        if (total > 0 && offset >= total) break
        if (rows.length < pageSize) break
      }
      return { name: '', cover: '', trackCount: total || songs.length, songs }
    },

    async playlistSongsPage(id, _ctx, page) {
      const limit = Math.max(1, Math.min(200, Number(page?.limit) || 100))
      const offset = Math.max(0, Number(page?.offset) || 0)
      const data = await request('playlist_tracks', { id: String(id), limit, offset, source: 4 })
      const rows = Array.isArray(data?.resultList) ? data.resultList : Array.isArray(data?.list) ? data.list : []
      const songs = rows.map(toTrack).filter(Boolean)
      const total = Number(data?.total) || 0
      return {
        name: '', cover: '',
        trackCount: total || songs.length,
        songs,
        hasMore: total > 0 ? offset + songs.length < total : rows.length >= limit,
        nextOffset: offset + songs.length,
      }
    },

    async addToPlaylist(song, playlistId) {
      const id = String(song?.id ?? '')
      const target = String(playlistId ?? '').trim()
      if (id === '' || target === '') throw new MusicError('missing song or playlist id', { code: 'invalid-response', sourceId: SOURCE_ID })
      await request('playlist_tracks_add', { id: target, trackIds: id })
      return true
    },

    async liked(id) {
      const ids = await this.likedIds()
      return ids.includes('online:' + SOURCE_ID + ':' + String(id))
    },

    async likedIds() {
      const ids = []
      const seen = new Set()
      for (let page = 0, offset = 0; page < 50; page += 1, offset += 100) {
        const data = await request('liked_songs', { limit: 100, offset })
        const rows = Array.isArray(data?.list) ? data.list : []
        let added = 0
        for (const row of rows) {
          const id = String(row?.id ?? '')
          if (id === '' || seen.has(id)) continue
          seen.add(id)
          ids.push('online:' + SOURCE_ID + ':' + id)
          added += 1
        }
        const total = Number(data?.total)
        if (rows.length < 100 || added === 0) break
        if (Number.isFinite(total) && offset + rows.length >= total) break
      }
      return ids
    },

    async setLiked(song, on) {
      const id = String(song?.id ?? song ?? '')
      if (id === '') throw new MusicError('missing song id', { code: 'not-playable', sourceId: SOURCE_ID })
      await request('like_song', { id, liked: on === true })
      return true
    },

    // Facade methods so `omni.loginStart/loginStatus` work like any other source.
    loginStart() {
      return this.auth.startLogin()
    },
    loginStatus(key) {
      return this.auth.checkLogin(key)
    },
    async profile() {
      return await this.auth.readUser()
    },
    async cancelLogin() {
      return true
    },
    async logout() {
      sessions.clear()
      rowMeta.clear()
      return true
    },

    // The logout route asks every source to drop native token caches; Bodian has none,
    // but it must still answer or the route rejects (which used to kill the Host).
    async forgetTokens() {
      sessions.clear()
      rowMeta.clear()
      return true
    },

    auth: {
      async startLogin() {
        const key = await request('login_qr_key', {})
        const keyId = String(key?.key ?? key?.qrcode ?? key?.unikey ?? '')
        if (keyId === '') throw new MusicError('Bodian did not return a QR key', { code: 'invalid-response', sourceId: SOURCE_ID })
        const created = await request('login_qr_create', { key: keyId })
        return {
          key: keyId,
          imageDataUrl: String(created?.imageUrl ?? created?.qrimg ?? created?.image ?? ''),
          url: String(created?.qrurl ?? ''),
          // The package keeps the QR for five minutes (its QR_TTL_MS); a shorter
          // deadline here would expire a code the platform still accepts.
          expiresAt: Date.now() + 5 * 60 * 1000,
        }
      },

      async checkLogin(key) {
        const result = await request('login_qr_check', { key })
        // The package's states are waiting / scanned / confirmed / expired; `confirmed`
        // is the successful scan (it has already written the session into the repository).
        const status = String(result?.state ?? result?.status ?? 'failed')
        if (status === 'confirmed' || status === 'success') {
          const session = result?.session ?? result?.credential ?? sessions.get()
          if (session !== null && session !== undefined) sessions.set(session)
          return {
            status: 'success',
            session: session ?? null,
            user: result?.user ?? session?.user ?? null,
          }
        }
        if (status === 'scanned') return { status: 'scanned', message: String(result?.message ?? '') }
        if (status === 'waiting' || status === 'new') {
          return { status: 'waiting', message: String(result?.message ?? '') }
        }
        if (status === 'expired') return { status: 'expired', message: String(result?.message ?? '') }
        return { status: 'failed', message: String(result?.message ?? '') }
      },

      async readUser() {
        try {
          const data = await request('login_status', {})
          // `login_status` returns the stored user itself (not `{ user }`); accept both
          // shapes and the upstream avatar spellings so a refresh keeps the avatar.
          const user = data?.userInfo ?? data?.user ?? data
          if (user === null || typeof user !== 'object') return null
          const id = String(user.id ?? user.uid ?? '')
          if (id === '') return null
          return {
            id,
            nickname: String(user.nickname ?? ''),
            avatarUrl: String(user.avatarUrl ?? user.headImg ?? user.head_img ?? user.avatar ?? ''),
          }
        } catch {
          return null
        }
      },
    },
  }
  source.api = providerApi(source)
  return source
}
