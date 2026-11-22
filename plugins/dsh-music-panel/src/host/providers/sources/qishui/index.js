/**
 * Qishui Music as a first-class source.
 *
 * The upstream `qishui-music-api` package owns the car-protocol signing, QR
 * authorization and media-address selection. This file only adapts its shapes
 * to the plugin's source contract. Credentials stay in `sessions.js` and never
 * reach the client.
 *
 * @module dsh-music-panel/sources/qishui
 */

import { capabilities as buildCapabilities, providerApi } from '../../../services/core/contract.js'
import { MusicError } from '../../../services/core/errors.js'
import { parseKrc } from '../../krc.js'
import { parseLrc } from '../lrc.js'

const SOURCE_ID = 'qishui'
const PAGE_SIZE = 30

const ERROR_CODE = {
  network: 'network',
  'auth-required': 'auth-required',
  'not-playable': 'not-playable',
  unavailable: 'unavailable',
  unsupported: 'unavailable',
  'invalid-response': 'invalid-response',
}

function text(value) {
  return value === null || value === undefined ? '' : String(value)
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function image(raw) {
  if (typeof raw === 'string') return raw.startsWith('https://') ? raw : ''
  const value = record(raw)
  const url = Array.isArray(value.urls)
    ? value.urls.find((item) => typeof item === 'string' && item.startsWith('https://'))
    : ''
  if (!url || !value.uri || !url.endsWith('/')) return url || ''
  // Douyin's image CDN rejects the bare /img/<uri> URL; Folia appends the template
  // suffix (`~<template_prefix>-image.image`) and that is what returns the picture.
  return `${url}${value.uri}${value.template_prefix ? `~${value.template_prefix}-image.image` : ''}`
}

function artistsOf(item) {
  const related = record(item.related_info)
  const list = Array.isArray(related.artist_links)
    ? related.artist_links
    : record(item.base_info).song_maker_team?.composers
  return Array.isArray(list)
    ? list
        .filter((artist) => artist && artist.name)
        .map((artist) => ({ id: text(artist.id), name: text(artist.name) }))
    : []
}

/**
 * Whether the car payload says this song needs a membership. The platform marks such a
 * song with `commerce_info.icon_info.type` (`vip`/`svip`) and a membership condition;
 * `payment_type` alone is not used because free tracks carry their own value.
 */
function vipOf(item) {
  const commerce = record(item.commerce_info)
  const icon = text(commerce.icon_info?.type).toLowerCase()
  if (icon === 'vip' || icon === 'svip') return true
  return /membership_type/.test(text(commerce.playable_condition))
}

/** One upstream track → the plugin's track shape. */
export function toTrack(raw) {
  const item = record(raw)
  const base = record(item.base_info)
  const id = text(base.id || item.id)
  if (!/^\d+$/.test(id)) return null
  const related = record(item.related_info)
  const album = record(related.album_link)
  const artists = artistsOf(item)
  const durationMs = Math.max(0, Number(base.duration_ms) || 0)
  const coverUrl = image(item.display_info?.cover_url)
  return {
    id,
    provider: SOURCE_ID,
    title: text(base.name),
    artist: artists.map((artist) => artist.name).join(' / '),
    album: text(album.name),
    albumId: text(album.id),
    durationSec: Math.round(durationMs / 1000),
    durationMs,
    coverUrl,
    qualityHint: vipOf(item) ? 'VIP' : '',
    sourceRef: { kind: 'online', sourceId: SOURCE_ID, ref: id },
    providerData: {
      albumId: text(album.id),
      artists,
    },
    artistsDetail: artists,
    albumDetail: { id: text(album.id), name: text(album.name), coverUrl },
    aliases: [],
    translatedNames: [],
    availableQualities: ['standard'],
  }
}

/** One upstream playlist → the shape the online page already understands. */
export function toCollection(raw, type = 'playlist') {
  const item = record(raw)
  const base = record(item.base_info)
  if (base.id === undefined || base.id === null || String(base.id) === '') return null
  const owner = record(item.relation_info?.owner)
  return {
    id: text(base.id),
    name: text(base.title || base.name),
    type,
    coverUrl: image(type === 'artist' ? base.url_avatar : item.display_info?.url_cover),
    description: text(base.desc || base.intro),
    trackCount: item.resource_cnt?.track_cnt == null ? undefined : Number(item.resource_cnt.track_cnt),
    creator: owner.id ? { id: text(owner.id), nickname: text(owner.nickname) } : undefined,
    providerData: { ownerId: text(base.owner_id || owner.id) },
  }
}

function toArtist(raw) {
  const item = record(raw)
  const base = record(item.base_info)
  const id = text(base.id || item.id)
  if (id === '') return null
  return {
    id,
    name: text(base.title || base.name || item.name),
    cover: image(base.url_avatar || item.pic || item.display_info?.url_cover),
    description: text(base.desc || base.intro || item.intro),
    provider: SOURCE_ID,
  }
}

function lrcTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(value / 60)
  const rest = value - minutes * 60
  return `[${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}]`
}

function linesOf(textValue, format) {
  const source = text(textValue)
  if (source.trim() === '') return []
  if (format === 'krc') {
    const parsed = parseKrc(source)
    return parsed === null
      ? []
      : parsed.lines.map((line) => ({ t: line.t, text: line.text, words: line.words }))
  }
  return parseLrc(source).map((line) => ({ t: line.timeMs / 1000, text: line.text }))
}

function toLrc(lines) {
  return lines.map((line) => lrcTime(line.t) + line.text).join('\n')
}

/**
 * @param {{
 *   createApi: (options: object) => { request: Function },
 *   deviceId: string,
 *   sessions: object,
 * }} options
 */
export function createQishuiSource(options) {
  const sessions = options.sessions
  const api = options.createApi({
    deviceId: options.deviceId,
    sessions,
    fetch: globalThis.fetch,
    log: (message) => console.warn('[Qishui]', message),
    warn: (message) => console.warn('[Qishui]', message),
  })

  async function request(operation, params = {}) {
    if (typeof sessions.whenReady === 'function') await sessions.whenReady()
    const answer = await api.request(operation, params)
    if (answer === null || typeof answer !== 'object') {
      throw new MusicError('Qishui returned no answer', { code: 'invalid-response', sourceId: SOURCE_ID })
    }
    if (answer.ok !== true) {
      const error = record(answer.error)
      throw new MusicError(text(error.message) || 'Qishui request failed', {
        code: ERROR_CODE[text(error.code)] ?? 'protocol',
        sourceId: SOURCE_ID,
        retryable: text(error.code) === 'network',
      })
    }
    return answer.data
  }

  // A row restored from history may carry only the singer's name; Folia's rows carry a
  // catalogRef. Resolve the id once through the provider's own search when it is missing.
  async function resolveArtistId(name) {
    const wanted = String(name ?? '').trim()
    if (wanted === '') return ''
    try {
      const data = await request('search', { query: wanted, limit: 20, offset: 0 })
      const items = Array.isArray(data?.items) ? data.items : []
      for (const item of items) {
        const match = artistsOf(item).find((artist) => artist.name === wanted && artist.id !== '')
        if (match !== undefined) return match.id
      }
    } catch {
      // The caller reports the missing id with the provider's message.
    }
    return ''
  }

  const capabilities = buildCapabilities({
    search: true,
    playback: true,
    lyrics: true,
    auth: true,
    userLibrary: true,
    userPlaylists: true,
    searchPlaylists: true,
    playlistSongs: true,
    likes: true,
    likeWrite: true,
    playlistAdd: true,
    artists: true,
    mutations: true,
    loginQr: true,
  })

  const source = {
    id: SOURCE_ID,
    kind: 'online',
    displayName: 'Qishui Music',
    capabilities,
    qualityLevels: ['standard'],
    loginMethods: ['qr'],

    availability() {
      return { configured: true }
    },

    async search(query, page = 1) {
      return await this.searchPage(query, {}, page)
    },

    async searchPage(query, _ctx, page = 1) {
      const keyword = String(query ?? '').trim()
      if (keyword === '') return { results: [], total: 0, page: 1, hasMore: false }
      const offset = (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE
      const data = await request('search', { query: keyword, limit: PAGE_SIZE, offset })
      const items = Array.isArray(data?.items) ? data.items : []
      const songs = items.map(toTrack).filter(Boolean)
      return {
        results: songs,
        total: Number(data?.total) || songs.length,
        page: Math.max(1, Number(page) || 1),
        hasMore: data?.hasMore === true,
      }
    },

    async searchPlaylists(query, _ctx, page = 1) {
      const keyword = String(query ?? '').trim()
      if (keyword === '') return { results: [], total: 0, page: 1, hasMore: false }
      const offset = (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE
      const data = await request('search_playlists', { query: keyword, limit: PAGE_SIZE, offset })
      const items = Array.isArray(data?.items) ? data.items : []
      const results = items.map((item) => toCollection(item)).filter(Boolean)
      return {
        results,
        total: Number(data?.total) || results.length,
        page: Math.max(1, Number(page) || 1),
        hasMore: data?.hasMore === true,
      }
    },

    async artistSongs(artist, ctx = {}) {
      let artistId = text(ctx.artistId)
      if (artistId === '') artistId = await resolveArtistId(artist)
      if (artistId === '') {
        throw new MusicError('Qishui singer has no id', { code: 'unavailable', sourceId: SOURCE_ID })
      }
      const page = record(ctx.page)
      const data = await request('artist_songs', {
        id: artistId,
        limit: Number(page.limit) || PAGE_SIZE,
        offset: Number(page.offset) || 0,
      })
      const items = Array.isArray(data?.items) ? data.items : []
      return items.map(toTrack).filter(Boolean)
    },

    async artistAlbums(id) {
      const data = await request('artist_detail', { id: String(id) })
      return { artist: toArtist(data), albums: [] }
    },

    async stream(id) {
      const data = await request('audio', { id: String(id), quality: 'standard' })
      const url = text(data?.url)
      if (url === '') throw new MusicError('Qishui did not return audio', { code: 'not-playable', sourceId: SOURCE_ID })
      return {
        url,
        quality: 'standard',
        preview: data?.preview === true,
        ...(Number.isFinite(Number(data?.clipStartMs)) ? { clipStartMs: Number(data.clipStartMs) } : {}),
      }
    },

    async lyric(id) {
      const data = await request('lyrics', { id: String(id) })
      const entity = record(data?.lyric_entity)
      const content = text(entity.content).replace(/\u0000/g, '')
      const format = text(entity.type) === 'krc' ? 'krc' : 'lrc'
      const lines = linesOf(content, format)
      if (lines.length === 0) return { lrc: '', translation: '' }
      const translations = record(data?.lang_translations)
      const translated = record(translations['zh-CN'] || translations['ZH-HANS-CN'] || Object.values(translations)[0])
      const translatedLines = linesOf(translated.content, text(translated.type) === 'krc' ? 'krc' : 'lrc')
      const byTime = new Map(translatedLines.map((line) => [Math.round(line.t * 1000), line.text]))
      return {
        lrc: toLrc(lines),
        translation: translatedLines.length > 0 ? toLrc(translatedLines) : '',
        lines: lines.map((line) => ({
          t: line.t,
          text: line.text,
          ...(Array.isArray(line.words) ? { words: line.words } : {}),
          ...(byTime.get(Math.round(line.t * 1000)) ? { translation: byTime.get(Math.round(line.t * 1000)) } : {}),
        })),
        wordLevel: lines.some((line) => Array.isArray(line.words)),
      }
    },

    async myPlaylists() {
      const data = await request('user_playlists', { limit: 50, offset: 0 })
      const items = Array.isArray(data?.items) ? data.items : []
      return items.map((item) => toCollection(item)).filter(Boolean)
    },

    async playlistSongs(id) {
      // Qishui returns a page plus hasMore; the Host route returns one array, so
      // keep asking until the bridge says the last page was reached.
      const pageSize = 60
      const songs = []
      let offset = 0
      let total = 0
      let hasMore = true
      for (let page = 0; page < 1000; page += 1) {
        const data = await request('playlist_tracks', { id: String(id), limit: pageSize, offset })
        const items = Array.isArray(data?.items) ? data.items : []
        total = Number(data?.total) || total
        if (items.length === 0) break
        songs.push(...items.map(toTrack).filter(Boolean))
        offset += items.length
        hasMore = data?.hasMore === true
        if (!hasMore) break
        if (total > 0 && offset >= total) break
        if (items.length < pageSize) break
      }
      return { name: '', cover: '', trackCount: total || songs.length, songs }
    },

    async playlistSongsPage(id, _ctx, page) {
      const limit = Math.max(1, Math.min(200, Number(page?.limit) || 100))
      const offset = Math.max(0, Number(page?.offset) || 0)
      const data = await request('playlist_tracks', { id: String(id), limit, offset })
      const items = Array.isArray(data?.items) ? data.items : []
      const songs = items.map(toTrack).filter(Boolean)
      const total = Number(data?.total) || 0
      return {
        name: '', cover: '',
        trackCount: total || songs.length,
        songs,
        hasMore: data?.hasMore === true || (total > 0 && offset + songs.length < total),
        nextOffset: offset + songs.length,
      }
    },

    async liked(id) {
      const ids = await this.likedIds()
      return ids.includes('online:qishui:' + String(id))
    },

    async likedIds() {
      const data = await request('liked_songs')
      const ids = Array.isArray(data?.ids) ? data.ids : []
      return ids.map((id) => 'online:qishui:' + String(id))
    },

    async setLiked(song, on) {
      await request('like_song', { id: String(song?.id ?? ''), liked: on === true })
      return true
    },

    async addToPlaylist(song, playlistId) {
      await request('playlist_add_tracks', { id: String(playlistId), ids: [String(song?.id ?? '')] })
      return true
    },

    async profile() {
      const session = sessions.get()
      if (session?.user) {
        return {
          id: text(session.user.id),
          nickname: text(session.user.nickname),
          avatarUrl: image(session.user.avatar),
        }
      }
      return null
    },

    async loginStart() {
      const key = text((await request('login_qr_key'))?.key)
      if (key === '') throw new MusicError('Qishui did not return a QR key', { code: 'invalid-response', sourceId: SOURCE_ID })
      const created = await request('login_qr_create', { key })
      return {
        key,
        imageDataUrl: text(created?.imageUrl),
        url: '',
        expiresAt: Date.now() + 5 * 60 * 1000,
      }
    },

    async loginStatus(key) {
      const result = record(await request('login_qr_check', { key }))
      const state = text(result.state || result.status)
      if (state === 'confirmed' || state === 'success') {
        const session = sessions.get()
        return {
          status: 'success',
          session,
          user: session?.user
            ? { id: text(session.user.id), nickname: text(session.user.nickname), avatarUrl: image(session.user.avatar) }
            : null,
        }
      }
      if (state === 'scanned' || state === 'waiting') return { status: state, message: text(result.message) }
      if (state === 'expired') return { status: 'expired', message: text(result.message) }
      // `error` carries the platform's own case (the package maps a refused scan to
      // `failure.case = 'refused'`); hand it to the Host so the window names the reason.
      return {
        status: 'failed',
        message: text(result.message),
        case: text(result.failure?.case),
      }
    },

    async cancelLogin(key) {
      await request('login_qr_cancel', { key })
      return true
    },

    async logout() {
      try {
        await request('logout')
      } finally {
        sessions.clear()
      }
    },

    async forgetTokens() {
      sessions.clear()
    },
  }
  source.api = providerApi(source)
  return source
}
