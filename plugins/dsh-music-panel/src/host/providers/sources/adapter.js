/**
 * Adapter factory: one uniform surface over the per-platform protocol modules.
 *
 * The protocol modules in `lib/providers/` already handle every platform behind a
 * `(provider, …)` first argument. This factory turns that into an object per
 * source, so callers stop passing provider strings around. The protocol layer is
 * deliberately untouched in P1: swapping it for upstream packages is P2, and the
 * adapter surface is what shields the routes from that change.
 *
 * Context shape: `{ cookie, session }`. Adapters never read the session store
 * themselves — the caller decides where credentials come from.
 *
 * @module dsh-music-panel/sources/adapter
 */

import { allowedBy, capabilities as buildCapabilities, loginMethodsOf, providerApi } from '../../services/core/contract.js'
import { MusicError } from '../../services/core/errors.js'
import * as providers from '../index.js'

/** @param {{ cookie?: string, session?: object }} [ctx] */
function parts(ctx) {
  const cookie = typeof ctx?.cookie === 'string' ? ctx.cookie : ''
  const session = ctx?.session !== null && typeof ctx?.session === 'object' ? ctx.session : {}
  return { cookie, session }
}

/**
 * @param {{
 *   id: string,
 *   displayName: string,
 *   capabilities: Record<string, boolean>,
 *   providerKey?: string,
 * }} spec
 */
export function createOnlineAdapter(spec) {
  const providerKey = spec.providerKey ?? spec.id
  const caps = buildCapabilities(spec.capabilities)

  const call = (method, ...args) => {
    if (!allowedBy(caps, method)) {
      throw new MusicError(`${spec.displayName} does not support ${method}`, {
        code: 'unavailable',
        sourceId: spec.id,
      })
    }
    return providers[method](providerKey, ...args)
  }

  const source = {
    id: spec.id,
    kind: 'online',
    displayName: spec.displayName,
    capabilities: caps,
    qualityLevels: Array.isArray(spec.qualityLevels) ? spec.qualityLevels.slice() : undefined,
    loginMethods: loginMethodsOf(caps),
    loginTexts: spec.loginTexts ?? null,

    // ── search / catalogue ────────────────────────────────────────────────
    search(query, ctx) {
      const { cookie, session } = parts(ctx)
      return call('search', query, cookie, session)
    },
    searchPage(query, ctx, page) {
      const { cookie, session } = parts(ctx)
      return call('searchPage', query, cookie, session, page)
    },
    searchAlbums(query, ctx, page) {
      const { cookie, session } = parts(ctx)
      return call('searchAlbums', query, cookie, session, page)
    },
    searchPlaylists(query, ctx, page) {
      const { cookie, session } = parts(ctx)
      return call('searchPlaylists', query, cookie, session, page)
    },
    artistSongs(artist, ctx) {
      const { cookie, session } = parts(ctx)
      // The artist page passes the id the song already carries (Folia does the same);
      // without it the provider resolves one by name.
      return call('artistSongs', artist, cookie, session, ctx && ctx.artistId ? ctx.artistId : '', (ctx && ctx.page) || {})
    },
    albumSongs(id, ctx, hint) {
      const { cookie, session } = parts(ctx)
      return call('albumSongs', id, cookie, session, hint)
    },
    artists(ctx) {
      const { cookie, session } = parts(ctx)
      return call('artists', cookie, session)
    },
    albums(ctx, size) {
      const { cookie, session } = parts(ctx)
      return call('albums', cookie, session, size)
    },
    artistAlbums(id, ctx) {
      const { cookie, session } = parts(ctx)
      return call('artistAlbums', id, cookie, session)
    },
    songs(ctx, size) {
      const { cookie, session } = parts(ctx)
      return call('songs', cookie, session, size)
    },
    nativeSongs(ctx, options) {
      const { session } = parts(ctx)
      return call('nativeSongs', session, options)
    },

    // ── recommendations / discovery ───────────────────────────────────────
  dailySongs(ctx) {
    const { cookie, session } = parts(ctx)
    return call('dailySongs', cookie, session)
  },
  recommendedCollections(ctx, limit) {
    const { cookie, session } = parts(ctx)
    return call('recommendedCollections', cookie, session, limit)
  },
  personalFm(ctx) {
    const { cookie, session } = parts(ctx)
    return call('personalFm', cookie, session)
  },
  cloudSongs(ctx, page) {
    const { cookie, session } = parts(ctx)
    return call('cloudSongs', cookie, session, page)
  },
  historyDates(ctx) {
    const { cookie } = parts(ctx)
    return call('historyDates', cookie)
  },
  historySongs(ctx, date) {
    const { cookie } = parts(ctx)
    return call('historySongs', cookie, date)
  },

  // ── playlists / likes ─────────────────────────────────────────────────
    myPlaylists(ctx) {
      const { cookie, session } = parts(ctx)
      return call('myPlaylists', cookie, session)
    },
    playlistSongs(id, ctx) {
      const { cookie, session } = parts(ctx)
      return call('playlistSongs', id, cookie, session)
    },
    playlistSongsPage(id, ctx, page) {
      const { cookie, session } = parts(ctx)
      return call('playlistSongsPage', id, cookie, session, page)
    },
    liked(id, ctx) {
      const { cookie, session } = parts(ctx)
      return call('onlineLiked', id, cookie, session)
    },
    likedIds(ctx) {
      const { cookie, session } = parts(ctx)
      return call('onlineLikedIds', cookie, session)
    },
    setLiked(song, on, ctx) {
      const { cookie, session } = parts(ctx)
      return call('setOnlineLiked', song, on, cookie, session)
    },
    addToPlaylist(song, playlistId, ctx) {
      const { cookie, session } = parts(ctx)
      return call('addOnlineSongToPlaylist', song, playlistId, cookie, session)
    },
    removeFromPlaylist(song, playlistId, ctx) {
      const { cookie, session } = parts(ctx)
      return call('removeOnlineSongFromPlaylist', song, playlistId, cookie, session)
    },
    subscriptionStatus(type, id, ctx) {
      const { cookie } = parts(ctx)
      return call('subscriptionStatus', type, id, cookie)
    },
    subscribeCollection(type, id, subscribed, ctx) {
      const { cookie } = parts(ctx)
      return call('subscribeCollection', type, id, subscribed, cookie)
    },

    // ── playback / lyrics ─────────────────────────────────────────────────
    stream(id, ctx, quality) {
      const { cookie, session } = parts(ctx)
      return call('resolveStream', id, cookie, session, quality)
    },
    // Optional: platforms without a hook answer null (Folia calls /song/chorus).
    chorus(id, ctx) {
      const { cookie, session } = parts(ctx)
      return call('chorus', id, cookie, session)
    },

    lyric(id, ctx) {
      const { cookie, session } = parts(ctx)
      return call('lyric', id, cookie, session)
    },
    // Optional: another name / artist spelling this platform knows, used only when a lyric
    // search found nothing (Folia's `getSearchAlias` / `getAlternateArtistName`).
    lyricSearchAlias(id) {
      return providers.lyricSearchAlias(providerKey, id)
    },
    alternateArtistName(id) {
      return providers.alternateArtistName(providerKey, id)
    },
    requiresVip(id) {
      return providers.requiresVip(providerKey, id)
    },
    listeningRank(range, ctx) {
      const { cookie, session } = parts(ctx)
      return call('listeningRank', range, cookie, session)
    },
    reportPlayback(song, report, ctx) {
      const { cookie } = parts(ctx)
      return call('reportPlayback', song, report, cookie)
    },

    // ── account ───────────────────────────────────────────────────────────
    vip(ctx) {
      const { cookie, session } = parts(ctx)
      return call('providerVip', cookie, session)
    },
    vipInfo(ctx) {
      const { cookie, session } = parts(ctx)
      return call('providerVipInfo', cookie, session)
    },
    profile(ctx) {
      const { cookie, session } = parts(ctx)
      return call('providerProfile', cookie, session)
    },
    loginStart(ctx, mode) {
      const { session } = parts(ctx)
      return call('loginStart', session, mode)
    },
    loginStatus(key, mode) {
      return providers.loginStatus(providerKey, key, mode)
    },
    // Platforms whose upstream has no keyed cancel are no-ops: releasing an
    // unknown/expired key is success, and the key expires on its own.
    async cancelLogin() {
      return true
    },
    async logout() {
      return true
    },
    forgetTokens() {
      return providers.forgetProviderTokens(providerKey)
    },

    /** Platform utility: build a fresh device identity (KuGou family). */
    createDevice() {
      return providers.createKugouDevice()
    },

    availability() {
      return { configured: true }
    },
  }
  source.api = providerApi(source)
  return source
}
