/**
 * Lyric source registry — a port of Folia's `src/utils/lyrics/lyricSources.ts`.
 *
 * One entry per place a song's lyrics can come from, in the order the automatic
 * pick asks them after the preferred one. Every list, order and capability check
 * about a source is read from here.
 *
 * Ids are the Host's provider ids (`kugouLite`, not `kugou`), because the
 * automatic pick resolves a source through the same registry playback uses.
 * Bodian is not a source: Folia keeps it out of the table too — its own songs
 * still show their own lyrics, they are just never used as another song's
 * candidate.
 *
 * @module dsh-music-panel/lyrics-sources
 */

/**
 * @typedef {object} LyricSourceEntry
 * @property {string} id               provider id
 * @property {boolean} platform        the platform's own catalogue (searched by text)
 * @property {boolean} [localMetadataIdentity] a selected local-song metadata identity may resume matching
 * @property {boolean} [needsAccount]  usable only while signed in
 * @property {boolean} [needsConfiguredProvider]
 * @property {boolean} [linesOnly]     line-level lyrics only, no word timing
 */

/** @type {readonly LyricSourceEntry[]} */
export const LYRIC_SOURCES = [
  // Folia's order, without the platforms this plugin does not have (Spotify, Apple Music)
  // and without a Qishui account requirement: free tracks work signed out.
  { id: 'netease', platform: true, localMetadataIdentity: true },
  // AMLL TTML DB keeps lyrics under NetEase / QQ song ids and is reached through them.
  { id: 'amll', platform: false },
  { id: 'qq', platform: true, localMetadataIdentity: true },
  { id: 'kugouLite', platform: true, localMetadataIdentity: true },
  { id: 'qishui', platform: true, localMetadataIdentity: true },
]

export const LYRIC_SOURCE_IDS = LYRIC_SOURCES.map((source) => source.id)

const BY_ID = new Map(LYRIC_SOURCES.map((source) => [source.id, source]))

// Old rows and protocol code still call the platform `kugou`; the source id is
// `kugouLite` because that is the registered provider id.
const SOURCE_ALIASES = new Map([['kugou', 'kugouLite']])

function sourceIdOf(id) {
  const key = String(id ?? '')
  return SOURCE_ALIASES.get(key) || key
}

export function isLyricSource(id) {
  return BY_ID.has(sourceIdOf(id))
}

export function getLyricSource(id) {
  return BY_ID.get(sourceIdOf(id))
}

/** The source whose lyrics a song of `providerId` has as its own. */
export function getPlatformLyricSource(providerId) {
  const source = BY_ID.get(sourceIdOf(providerId))
  return source !== undefined && source.platform === true ? source : undefined
}

/**
 * Preferred source first, then the registry order, skipping what is not offered.
 *
 * @param {string} [preferred]
 * @param {(source: LyricSourceEntry) => boolean} [isOffered]
 */
export function buildLyricSourceOrder(preferred, isOffered) {
  const allowed = typeof isOffered === 'function' ? isOffered : () => true
  const order = []
  const wanted = BY_ID.get(sourceIdOf(preferred || 'qq'))
  if (wanted !== undefined && allowed(wanted)) order.push(wanted)
  for (const source of LYRIC_SOURCES) {
    if (source.id === wanted?.id) continue
    if (allowed(source)) order.push(source)
  }
  return order
}

/**
 * Which sources may be asked right now.
 *
 * @param {{ platform?: string, hasAccount?: boolean, configured?: Record<string, boolean> }} context
 */
export function offeredSources(context) {
  return buildLyricSourceOrder(context.platform, (source) => {
    if (source.needsConfiguredProvider === true && context.configured?.[source.id] === false) return false
    if (source.needsAccount === true && context.hasAccount !== true) return false
    return true
  }).map((source) => source.id)
}
