/**
 * The single facade for every source.
 *
 * Routes call this, never an adapter and never a protocol module. It does three
 * things and nothing else: resolve the source, refuse capabilities the source does
 * not declare, and normalise whatever it throws into a `MusicError` tagged with
 * the source id.
 *
 * @module dsh-music-panel/sources/omni
 */

import { allowedBy } from '../../services/core/contract.js'
import { MusicError, toMusicError } from '../../services/core/errors.js'

/**
 * @param {ReturnType<import('./registry.js').createRegistry>} registry
 */
export function createOmni(registry) {
  async function dispatch(sourceId, method, args) {
    const source = registry.get(sourceId)
    if (source === null) {
      throw new MusicError(`source is not registered: ${sourceId}`, { code: 'unavailable', sourceId })
    }
    const fn = source[method]
    if (typeof fn !== 'function') {
      throw new MusicError(`${source.displayName ?? sourceId} does not support ${method}`, {
        code: 'unavailable',
        sourceId,
      })
    }
    if (source.capabilities !== undefined && !allowedBy(source.capabilities, method)) {
      throw new MusicError(`${source.displayName ?? sourceId} does not support ${method}`, {
        code: 'unavailable',
        sourceId,
      })
    }
    try {
      return await fn.apply(source, args)
    } catch (error) {
      throw toMusicError(error, sourceId)
    }
  }

  const route = (method) => (sourceId, ...args) => dispatch(sourceId, method, args)

  return {
    /** Capability + identity list for the settings page. */
    summaries: () => registry.summaries(),
    capabilities: (sourceId) => registry.require(sourceId).capabilities ?? {},
    qualityLevels: (sourceId) => {
      const levels = registry.require(sourceId).qualityLevels
      return Array.isArray(levels) ? levels.slice() : []
    },
    loginMethods: (sourceId) => {
      const methods = registry.require(sourceId).loginMethods
      return Array.isArray(methods) ? methods.slice() : []
    },
    availability: (sourceId) => registry.require(sourceId).availability?.() ?? { configured: true },

    // ── catalogue / search ────────────────────────────────────────────────
    search: route('search'),

    /**
     * Paged search with a fallback: sources that only implement `search` are
     * adapted, so the route does not have to know which shape a platform chose.
     */
    async searchPage(sourceId, query, ctx, page) {
      const source = registry.get(sourceId)
      if (source === null) {
        throw new MusicError(`source is not registered: ${sourceId}`, { code: 'unavailable', sourceId })
      }
      if (typeof source.searchPage === 'function') {
        return dispatch(sourceId, 'searchPage', [query, ctx, page])
      }
      const result = await dispatch(sourceId, 'search', [query, page ?? 1, ctx])
      const songs = Array.isArray(result?.songs) ? result.songs : []
      return {
        results: songs,
        total: Number(result?.total) || songs.length,
        page: Number(result?.page) || page || 1,
        hasMore: Boolean(result?.hasMore),
      }
    },

    /**
     * The search kinds a source actually implements, in Folia's order:
     * songs everywhere, albums/playlists only where the provider has a search
     * endpoint and the matching capability.
     */
    searchKinds(sourceId) {
      const source = registry.get(sourceId)
      if (source === null) return []
      const caps = source.capabilities || {}
      const kinds = []
      if (caps.search === true) kinds.push('song')
      if (caps.searchAlbums === true && typeof source.searchAlbums === 'function') kinds.push('album')
      if (caps.searchPlaylists === true && typeof source.searchPlaylists === 'function') kinds.push('playlist')
      return kinds
    },

    /** Albums or playlists from one provider; an empty page where the kind is unsupported. */
    async searchCollections(sourceId, kind, query, ctx, page) {
      const target = Math.max(1, Number(page) || 1)
      if (kind !== 'album' && kind !== 'playlist') {
        return { items: [], total: 0, page: target, hasMore: false }
      }
      if (!this.searchKinds(sourceId).includes(kind)) {
        return { items: [], total: 0, page: target, hasMore: false }
      }
      const result = await dispatch(sourceId, kind === 'album' ? 'searchAlbums' : 'searchPlaylists', [query, ctx, target])
      const items = Array.isArray(result?.items) ? result.items : []
      const total = Number(result?.total) || items.length
      const pageNumber = Number(result?.page) || target
      return { items, total, page: pageNumber, hasMore: pageNumber * 30 < total }
    },

    artistSongs: route('artistSongs'),
    albumSongs: route('albumSongs'),
    artists: route('artists'),
    albums: route('albums'),
    artistAlbums: route('artistAlbums'),
    songs: route('songs'),
    nativeSongs: route('nativeSongs'),

    // ── playlists / likes ─────────────────────────────────────────────────
    myPlaylists: route('myPlaylists'),
    playlistSongs: route('playlistSongs'),
    /**
     * A page from the provider's catalogue. Sources that still only implement the
     * legacy full read are adapted here, so callers always get the page shape.
     */
    async playlistSongsPage(sourceId, id, ctx, page) {
      const source = registry.get(sourceId)
      if (source === null) {
        throw new MusicError(`source is not registered: ${sourceId}`, { code: 'unavailable', sourceId })
      }
      if (typeof source.playlistSongsPage === 'function') {
        return dispatch(sourceId, 'playlistSongsPage', [id, ctx, page])
      }
      const full = await dispatch(sourceId, 'playlistSongs', [id, ctx])
      const songs = Array.isArray(full?.songs) ? full.songs : []
      const limit = Math.max(1, Math.min(200, Number(page?.limit) || 100))
      const offset = Math.max(0, Number(page?.offset) || 0)
      const slice = songs.slice(offset, offset + limit)
      return {
        name: full?.name || '',
        cover: full?.cover || '',
        trackCount: Number(full?.trackCount) || songs.length,
        songs: slice,
        hasMore: offset + slice.length < songs.length,
        nextOffset: offset + slice.length,
      }
    },
    liked: route('liked'),
    likedIds: route('likedIds'),
    setLiked: route('setLiked'),
    addToPlaylist: route('addToPlaylist'),
  removeFromPlaylist: route('removeFromPlaylist'),
  subscriptionStatus: route('subscriptionStatus'),
  subscribeCollection: route('subscribeCollection'),

  // ── recommendations / cloud ──────────────────────────────────────────
  dailySongs: route('dailySongs'),
  recommendedCollections: route('recommendedCollections'),
  personalFm: route('personalFm'),
  historyDates: route('historyDates'),
  historySongs: route('historySongs'),
  cloudSongs: route('cloudSongs'),

    // ── playback / lyrics ─────────────────────────────────────────────────
    stream: route('stream'),
    lyric: route('lyric'),
    listeningRank: route('listeningRank'),
    reportPlayback: route('reportPlayback'),
    /**
     * Optional capability: a source without a chorus endpoint answers `null`
     * instead of failing, so the route stays 200 and the client just has no hook.
     */
    async chorus(sourceId, id, ctx) {
      const source = registry.get(sourceId)
      if (source === null) {
        throw new MusicError(`source is not registered: ${sourceId}`, { code: 'unavailable', sourceId })
      }
      if (typeof source.chorus !== 'function') return null
      return dispatch(sourceId, 'chorus', [id, ctx])
    },

    /**
     * The platform's other name for a song, or another spelling of its artist: used by the
     * lyric search only when nothing matched (Folia's lyric aliases). Optional, never throws.
     */
    async lyricSearchAlias(sourceId, id) {
      const source = registry.get(sourceId)
      if (source === null || typeof source.lyricSearchAlias !== 'function') return null
      try {
        return await source.lyricSearchAlias(id)
      } catch (error) {
        return null
      }
    },

    async alternateArtistName(sourceId, id) {
      const source = registry.get(sourceId)
      if (source === null || typeof source.alternateArtistName !== 'function') return null
      try {
        return await source.alternateArtistName(id)
      } catch (error) {
        return null
      }
    },

    // ── account ───────────────────────────────────────────────────────────
    vip: route('vip'),
    vipInfo: route('vipInfo'),
    profile: route('profile'),
    loginStart: route('loginStart'),
    loginStatus: route('loginStatus'),
    cancelLogin: route('cancelLogin'),
    logout: route('logout'),
    forgetTokens: route('forgetTokens'),
    createDevice: route('createDevice'),

    /** Synchronous helper: does this platform paywall the track? */
    requiresVip(sourceId, mediaId) {
      const source = registry.get(sourceId)
      if (source === null || typeof source.requiresVip !== 'function') return false
      try {
        return Boolean(source.requiresVip(mediaId))
      } catch {
        return false
      }
    },
  }
}
