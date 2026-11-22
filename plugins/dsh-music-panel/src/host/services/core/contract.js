/**
 * The shapes every source (local or online) must speak.
 *
 * Folia draws the same line with `types/onlineMusic.ts`: a song, a collection and
 * an audio source are provider-agnostic, and the provider identity travels inside
 * the song instead of being re-derived from context. Keeping these as plain
 * constants + JSDoc (no runtime validation) matches this plugin's zero-build
 * style: the shapes are enforced by tests, not by a schema library.
 *
 * @module dsh-music-panel/core/contract
 */

/** Stable ids. `local` is a source like any other. */
export const SOURCE_IDS = ['local', 'netease', 'qq', 'kugouLite', 'navidrome']

/** Where a track lives. Every track carries one. */
export const SOURCE_KIND = { LOCAL: 'local', ONLINE: 'online' }

/**
 * What a source can actually do.
 *
 * The UI reads these flags instead of asking "is this navidrome?" — that is the
 * whole point of the flag set. Unknown/absent flags are treated as `false`.
 */
export const CAPABILITIES = [
  'search',
  'searchAlbums',
  'searchPlaylists',
  'playback',
  'lyrics',
  'userPlaylists',
  'playlistSongs',
  'likes',
  'likeWrite',
  'playlistAdd',
  'artists',
  'albums',
  'browseArtists',
  'browseAlbums',
  'qualityLevels',
  'vip',
  'loginQr',
  'loginPassword',
  // Folia's provider contract carries these as well; a platform declares the ones
  // it really implements, and the UI reads the flags instead of the platform id.
  'auth',
  'userLibrary',
  'recommendations',
  'wordByWordLyrics',
  'userAlbums',
  'mutations',
  'playlistTrackMutations',
  'playlistSubscription',
  'externalPlayback',
  'explore',
  'personalFmModes',
  'playbackReports',
  'userCloud',
  'listeningRank',
  'historyRecommendations',
  'dailyStyleRecommendations',
  'recommendationPreferences',
]

/** Audio quality ladder, lowest first. */
export const QUALITY_ORDER = ['standard', 'high', 'lossless', 'hires']

/**
 * Highest listed quality at or below `wanted`; falls back to the lowest listed.
 * Providers that expose no ladder accept every value.
 */
export function resolveQuality(wanted, listed) {
  const allowed = Array.isArray(listed) && listed.length > 0 ? listed : QUALITY_ORDER
  const wantedIndex = QUALITY_ORDER.indexOf(wanted)
  if (wantedIndex < 0) return allowed[0] ?? 'standard'
  let best = null
  for (const quality of allowed) {
    if (QUALITY_ORDER.indexOf(quality) <= wantedIndex) best = quality
  }
  return best ?? allowed[0] ?? 'standard'
}

/** Declares capabilities, filling every unspecified flag with `false`. */
export function capabilities(declared) {
  const result = {}
  for (const key of CAPABILITIES) result[key] = Boolean(declared?.[key])
  return result
}

/**
 * Method name → capability that gates it.
 *
 * Method names are verbs (`lyric`, `stream`) while capabilities are nouns
 * (`lyrics`, `playback`); without this table a guard silently blocks everything.
 * A `null` entry means "no capability gates this". An array means "any of these".
 */
export const METHOD_CAPABILITY = {
  search: 'search',
  searchPage: 'search',
  searchAlbums: 'searchAlbums',
  searchPlaylists: 'searchPlaylists',
  songs: 'search',
  nativeSongs: 'search',
  artistSongs: 'artists',
  artistAlbums: 'artists',
  artists: 'artists',
  albumSongs: 'albums',
  albums: 'albums',
  myPlaylists: 'userPlaylists',
  playlistSongs: 'playlistSongs',
  playlistSongsPage: 'playlistSongs',
  liked: 'likes',
  likedIds: 'likes',
  setLiked: 'likeWrite',
  addToPlaylist: 'playlistAdd',
  removeFromPlaylist: 'playlistTrackMutations',
  subscriptionStatus: 'playlistSubscription',
  subscribeCollection: 'playlistSubscription',
  stream: 'playback',
  lyric: 'lyrics',
  chorus: 'lyrics',
  listeningRank: 'listeningRank',
  dailySongs: 'recommendations',
  recommendedCollections: 'recommendations',
  personalFm: 'recommendations',
  historyDates: 'historyRecommendations',
  historySongs: 'historyRecommendations',
  cloudSongs: 'userCloud',
  reportPlayback: 'playbackReports',
  vip: 'vip',
  vipInfo: 'vip',
  profile: null,
  forgetTokens: null,
  requiresVip: null,
  loginStart: ['loginQr', 'loginPassword'],
  loginStatus: ['loginQr', 'loginPassword'],
}

/**
 * Is `method` allowed by this capability set?
 *
 * @param {Record<string, boolean>} caps
 * @param {string} method
 */
export function allowedBy(caps, method) {
  const required = METHOD_CAPABILITY[method]
  if (required === undefined || required === null) return true
  if (Array.isArray(required)) return required.some((key) => caps?.[key] === true)
  return caps?.[required] !== false
}

/**
 * The namespaces a provider exposes, as Folia's `OnlineMusicProvider` does.
 * The flat method surface stays for the existing routes; this view is what new
 * code (and the login page) reads, so a platform is described by what it can do
 * rather than by a switch on its id.
 */
export const PROVIDER_API_GROUPS = Object.freeze({
  search: ['search', 'searchPage', 'songs', 'searchAlbums', 'searchPlaylists'],
  playback: ['stream'],
  lyrics: ['lyric', 'chorus'],
  auth: ['loginStart', 'loginStatus'],
  library: ['myPlaylists', 'playlistSongs', 'playlistSongsPage', 'liked', 'likedIds'],
  catalog: ['artists', 'albums', 'artistSongs', 'artistAlbums', 'albumSongs'],
  mutations: ['setLiked', 'addToPlaylist', 'removeFromPlaylist', 'subscriptionStatus', 'subscribeCollection'],
  recommendations: ['dailySongs', 'recommendedCollections', 'personalFm', 'historyDates', 'historySongs'],
  cloud: ['cloudSongs'],
})

/** Group a source's flat methods into the provider namespaces it implements. */
export function providerApi(source) {
  const api = {}
  for (const [group, methods] of Object.entries(PROVIDER_API_GROUPS)) {
    const entries = {}
    for (const method of methods) {
      if (typeof source?.[method] === 'function') entries[method] = source[method].bind(source)
    }
    if (Object.keys(entries).length > 0) api[group] = entries
  }
  return api
}

/** How the login page should offer this provider: QR, password, or a player outside the app. */
export function loginMethodsOf(caps) {
  const methods = []
  if (caps?.loginQr === true) methods.push('qr')
  if (caps?.loginPassword === true) methods.push('password')
  if (caps?.externalPlayback === true) methods.push('external')
  return methods
}

/**
 * Every track leaving a source looks like this.
 *
 * @typedef {object} Track
 * @property {string} id            stable within its source
 * @property {string} title
 * @property {string} artist
 * @property {string} album
 * @property {number} durationMs
 * @property {string} [coverUrl]
 * @property {{ kind: 'local'|'online', sourceId: string, ref: string }} sourceRef
 * @property {object} [providerData] source-specific extras the adapter needs later
 */

/**
 * A playable audio resource.
 *
 * @typedef {object} AudioSource
 * @property {string} url
 * @property {string} quality
 * @property {boolean} [preview]
 * @property {number} [clipStartMs]
 * @property {Record<string,string>} [headers]
 */

/**
 * @typedef {object} Collection
 * @property {string} id
 * @property {string} name
 * @property {string} [coverUrl]
 * @property {number} [trackCount]
 * @property {{ kind: 'local'|'online', sourceId: string, ref: string }} sourceRef
 */
