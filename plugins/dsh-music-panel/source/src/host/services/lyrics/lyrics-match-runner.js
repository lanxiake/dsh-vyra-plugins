/**
 * Lyric match runner: asks the sources in Folia's order and returns the first
 * word-level lyric, keeping a line-level answer as the fallback.
 *
 * All I/O is injected (`search`, `fetchLyric`, `fetchAmll`) so this module never
 * touches the network and stays testable; the caller owns what each callback talks
 * to. Limits and timeouts are Folia's own numbers.
 *
 * @module dsh-music-panel/lyrics-match-runner
 */

import { AUTO_MATCH_MIN_SCORE, pickBestLyricCandidate } from './lyrics-match.js'
import { LYRIC_SOURCES } from './lyrics-sources.js'

/** Folia: `AUTO_MATCH_SEARCH_LIMIT`. */
export const AUTO_MATCH_SEARCH_LIMIT = 10
/** Folia: `PROVIDER_SEARCH_TIMEOUT_MS`. */
export const SEARCH_TIMEOUT_MS = 3500
/** Folia: `PROVIDER_LYRIC_TIMEOUT_MS`. */
export const LYRIC_TIMEOUT_MS = 5000

/** Reject with a labelled error once `ms` passes. */
export function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`)
      error.code = 'timeout'
      reject(error)
    }, ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** A lyric answer worth returning: at least one line with text (Folia checks `fullText` too). */
export function hasRenderableLyrics(lyrics) {
  if (lyrics === null || typeof lyrics !== 'object') return false
  const lines = Array.isArray(lyrics.lines) ? lyrics.lines : []
  return lines.some(
    (line) => String(line?.text ?? line?.fullText ?? '').trim() !== ''
      || String(line?.translation ?? '').trim() !== '',
  )
}

function isWordLevel(lyrics) {
  const lines = Array.isArray(lyrics?.lines) ? lyrics.lines : []
  return lines.some((line) => Array.isArray(line?.words) && line.words.length > 0)
}

/**
 * Turn an LRC string into the runner's line shape.
 *
 * Platform providers answer `{ lrc }` (text); AMLL and `/lyric/new` answer parsed
 * lines. Both must land in `{ t, end, text }` before the runner can compare them.
 */
export function linesFromLrc(text) {
  const lines = []
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
    if (match === null) continue
    const at = Number(match[1]) * 60 + Number(match[2])
    if (!Number.isFinite(at)) continue
    lines.push({ t: at, end: at, text: String(match[3] ?? '').trim() })
  }
  lines.sort((left, right) => left.t - right.t)
  return lines
}

/**
 * `[mm:ss.xxx]` stamp for a line captured in seconds (the inverse of linesFromLrc).
 * Rounded in milliseconds, so 59.9996 becomes `[01:00.000]` rather than `[00:60.000]`.
 */
export function lrcTime(seconds) {
  const millis = Math.round(Math.max(0, Number(seconds) || 0) * 1000)
  const minutes = Math.floor(millis / 60000)
  const rest = millis - minutes * 60000
  const secs = Math.floor(rest / 1000)
  return '[' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(rest - secs * 1000).padStart(3, '0') + ']'
}

const LYRIC_QUERY_ALBUM_MAX = 48

function normalizeLyricIdentity(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

function lyricTitle(track) {
  const title = String(track?.title ?? '').trim()
  const artist = String(track?.artist ?? '').trim()
  if (title === '' || artist === '') return title
  const match = /^(.+?)\s+-\s+(.+)$/u.exec(title)
  if (match === null) return title
  return normalizeLyricIdentity(match[1]) === normalizeLyricIdentity(artist) ? match[2].trim() : title
}

function lyricAlbum(track) {
  const album = String(track?.album ?? '').trim()
  if (album === '') return null
  if (album.length <= LYRIC_QUERY_ALBUM_MAX) return album
  const compact = album
    .replace(/\s*※.*$/u, '')
    .replace(/\s*(歌|歌唱|アーティスト|Artist)\s*[:：]?\s*.+$/iu, '')
    .trim()
  return compact.slice(0, LYRIC_QUERY_ALBUM_MAX).trim() || null
}

/** Folia's query: title - artist - album, with the title prefix and long albums normalised. */
export function buildLyricSearchQuery(track) {
  if (String(track?.title ?? '').trim() === '') return ''
  return [lyricTitle(track), String(track?.artist ?? '').trim(), lyricAlbum(track)]
    .filter((part) => typeof part === 'string' && part !== '')
    .join(' - ')
}

/** KuGou's lyric search works best with the title alone (Folia's own query), not the full structured string. */
export function buildKugouLyricSearchQuery(track) {
  const full = buildLyricSearchQuery(track)
  return full.split(/\s+-\s+/u)[0]?.trim() || full
}

/**
 * Try the AMLL DB first (it is the highest quality source when it has the song),
 * then each platform in order.
 *
 * @param {{ title: string, artist?: string, album?: string, durationMs?: number }} track
 * @param {{
 *   order?: string[],
 *   neteaseId?: string|number,
 *   qqId?: string|number,
 *   resolveAmllIds?: () => Promise<{ neteaseId?: string|number, qqId?: string|number }>,
 *   search: (sourceId: string, query: string, limit: number) => Promise<Array<object>>,
 *   fetchLyric: (sourceId: string, id: string, candidate: object) => Promise<object|null>,
 *   fetchAmll?: (platform: 'ncm'|'qq', id: string) => Promise<{ lines: Array<object>, text?: string }|null>,
 *   log?: (message: string) => void,
 * }} io
 */
/**
 * One pass over the sources for one title/artist. `findBestLyrics` wraps this with the
 * alias retries Folia's automatic pick does.
 */
async function searchOnce(track, io) {
  const query = buildLyricSearchQuery(track)
  if (query === '') return null
  const order = Array.isArray(io.order) && io.order.length > 0 ? io.order : LYRIC_SOURCES.map((source) => source.id)
  const log = typeof io.log === 'function' ? io.log : () => {}
  let fallback = null

  for (const sourceId of order) {
    if (sourceId === 'amll') {
      if (typeof io.fetchAmll !== 'function') continue
      // Folia probes AMLL with the candidate id it found for NetEase/QQ in this run. The
      // resolver is asked only when the pick reaches AMLL, so a word-level answer from an
      // earlier source never pays for the extra search.
      let musicIds = { neteaseId: io.neteaseId, qqId: io.qqId }
      if (typeof io.resolveAmllIds === 'function') {
        try {
          musicIds = { ...musicIds, ...(await io.resolveAmllIds()) }
        } catch (error) {
          log(`amll candidate: ${error.message}`)
        }
      }
      const ids = [
        ['ncm', musicIds.neteaseId],
        ['qq', musicIds.qqId],
      ].filter(([, id]) => String(id ?? '').trim() !== '')
      for (const [platform, id] of ids) {
        try {
          const found = await withTimeout(io.fetchAmll(platform, String(id)), LYRIC_TIMEOUT_MS, 'amll')
          if (found !== null && hasRenderableLyrics(found)) {
            // AMLL answers TTML: word-level when the DB has it, line-level otherwise. The
            // document itself travels with the answer, so the client parses it with Folia's
            // parser instead of trusting the shapes decided here.
            const result = {
              lyrics: found.lines,
              source: 'amll',
              id: String(id),
              score: 100,
              wordLevel: isWordLevel(found),
              ...(typeof found.text === 'string' && found.text !== ''
                ? { raw: { type: 'local', lrcContent: found.text, formatHint: 'ttml' } }
                : {}),
            }
            if (result.wordLevel) return result
            fallback = fallback ?? result
          }
        } catch (error) {
          log(`amll ${platform}/${String(id)}: ${error.message}`)
        }
      }
      continue
    }

    let candidates = []
    try {
      const sourceQuery = sourceId === 'kugouLite' || sourceId === 'kugou'
        ? buildKugouLyricSearchQuery(track)
        : query
      candidates = await withTimeout(
        io.search(sourceId, sourceQuery, AUTO_MATCH_SEARCH_LIMIT),
        SEARCH_TIMEOUT_MS,
        `${sourceId} search`,
      )
    } catch (error) {
      log(`${sourceId} search: ${error.message}`)
      continue
    }
    const best = pickBestLyricCandidate(track, candidates)
    if (best === null) continue

    let lyrics = null
    try {
      lyrics = await withTimeout(
        io.fetchLyric(sourceId, String(best.candidate.id), best.candidate),
        LYRIC_TIMEOUT_MS,
        `${sourceId} lyric`,
      )
    } catch (error) {
      log(`${sourceId} lyric: ${error.message}`)
      continue
    }
    if (lyrics === null || !hasRenderableLyrics(lyrics)) continue

    const result = {
      lyrics: lyrics.lines,
      source: sourceId,
      id: String(best.candidate.id),
      score: best.score,
      wordLevel: isWordLevel(lyrics),
      // The candidate itself travels with the answer, so a caller that persists the
      // match (a local song's record) keeps the title/artist/album/cover it came from.
      candidate: best.candidate,
      // The platform's own raw document, translation and romanization, when it sent any:
      // the client parses that with Folia's pipeline (words, credits, split) rather than
      // the line array this module compares.
      ...(lyrics.raw && typeof lyrics.raw === 'object' ? { raw: lyrics.raw } : {}),
      ...(typeof lyrics.translation === 'string' && lyrics.translation !== ''
        ? { translation: lyrics.translation }
        : {}),
      ...(typeof lyrics.romaji === 'string' && lyrics.romaji !== '' ? { romaji: lyrics.romaji } : {}),
    }
    // Word-level wins immediately; a line-level answer is kept only as a fallback.
    if (result.wordLevel) return result
    fallback = fallback ?? result
  }

  return fallback
}

/**
 * The automatic pick, with Folia's two retries: a song its platform lists under another
 * name is searched again as that name (only while no word-level answer is in hand), and
 * an artist the sources spell differently gets one more pass when nothing matched at all.
 *
 * @param {object} track
 * @param {object} io — `searchOnce`'s callbacks plus `searchAlias` / `alternateArtist`
 */
export async function findBestLyrics(track, io) {
  const match = await searchOnce(track, io)
  if (match !== null && match.wordLevel === true) return match

  if (typeof io.searchAlias === 'function') {
    let alias = null
    try {
      alias = await io.searchAlias()
    } catch (error) {
      alias = null
    }
    const title = alias !== null && typeof alias === 'object' ? String(alias.title ?? '').trim() : ''
    if (title !== '' && title !== String(track.title ?? '')) {
      const retried = await searchOnce(
        {
          ...track,
          title,
          artist: String(alias.artist ?? track.artist ?? ''),
          album: String(alias.album ?? track.album ?? ''),
        },
        io,
      )
      if (retried !== null && (match === null || retried.wordLevel === true)) return retried
    }
  }

  if (match !== null || typeof io.alternateArtist !== 'function') return match
  let artist = null
  try {
    artist = await io.alternateArtist()
  } catch (error) {
    artist = null
  }
  const wanted = String(artist ?? '').trim()
  if (wanted === '' || wanted === String(track.artist ?? '')) return match
  return await searchOnce({ ...track, artist: wanted }, io)
}

export { AUTO_MATCH_MIN_SCORE }
