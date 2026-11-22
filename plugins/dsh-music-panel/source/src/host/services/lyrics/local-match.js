/**
 * The automatic lyric pick for a local file.
 *
 * Folia's `matchLyrics` (src/services/localMusicService.ts): search the lyric
 * sources in the configured order, keep a word-level match over a line-level one,
 * persist what won on the song's record. The candidate ids AMLL needs are found
 * the way Folia finds them — by asking NetEase first — but only when the pick
 * actually reaches AMLL.
 *
 * @module dsh-music-panel/local-match
 */

import { basename, extname } from 'node:path'
import { readTrackMeta } from '../media/meta.js'
import { createAmllClient } from './amll.js'
import { pickBestLyricCandidate } from './lyrics-match.js'
import {
  AUTO_MATCH_SEARCH_LIMIT,
  buildLyricSearchQuery,
  findBestLyrics,
  linesFromLrc,
  lrcTime,
} from './lyrics-match-runner.js'
import { buildLyricSourceOrder } from './lyrics-sources.js'

/** `track.mp3` → `track`, used when the file has no title tag. */
function stemOf(file) {
  const name = basename(file)
  return name.slice(0, name.length - extname(name).length)
}

/**
 * Folia's matching target: the file's own tags, the file name as the last resort.
 *
 * @param {string} file
 * @param {{ title?: string, artist?: string, album?: string, durationSec?: number }} meta
 */
export function resolveLocalMatchTarget(file, meta) {
  const title = String(meta?.title ?? '').trim() || stemOf(file)
  return {
    title,
    artist: String(meta?.artist ?? '').trim(),
    album: String(meta?.album ?? '').trim(),
    durationMs: Math.max(0, Math.round((Number(meta?.durationSec) || 0) * 1000)),
  }
}

/**
 * The lyric text to keep for a match, in the shape the client's parser accepts.
 *
 * The host's providers answer either a raw document (`{type:'local'|'qrc', …}`) or
 * only LRC text; both become one `{ text, formatHint }` pair here, so the stored
 * record needs nothing but the text, its format hint, and the parallel tracks.
 *
 * @param {{ raw?: { type?: string, lrcContent?: string, qrcContent?: string, formatHint?: string, tLrcContent?: string, rLrcContent?: string, translationContent?: string }, lrc?: string, translation?: string, romaji?: string, lyrics?: Array<{ t?: number, text?: string }> }} result
 * @returns {{ text: string, formatHint: string, translation: string, romaji: string } | null}
 */
export function payloadFromMatch(result) {
  if (result === null || typeof result !== 'object') return null
  const raw = result.raw !== null && typeof result.raw === 'object' ? result.raw : null
  const translation = typeof result.translation === 'string' ? result.translation : ''
  const romaji = typeof result.romaji === 'string' ? result.romaji : ''

  if (raw !== null && raw.type === 'qrc' && typeof raw.qrcContent === 'string' && raw.qrcContent.trim() !== '') {
    return {
      text: raw.qrcContent,
      formatHint: 'qrc',
      translation: String(raw.translationContent || translation || ''),
      romaji,
    }
  }
  if (raw !== null && typeof raw.lrcContent === 'string' && raw.lrcContent.trim() !== '') {
    return {
      text: raw.lrcContent,
      formatHint: String(raw.formatHint || ''),
      translation: String(raw.tLrcContent || translation || ''),
      romaji: String(raw.rLrcContent || romaji || ''),
    }
  }
  const lines = Array.isArray(result.lyrics) ? result.lyrics : []
  const text = typeof result.lrc === 'string' && result.lrc.trim() !== ''
    ? result.lrc
    : lines.map((line) => lrcTime(line?.t ?? 0) + String(line?.text ?? '')).join('\n')
  if (text.trim() === '') return null
  return { text, formatHint: '', translation, romaji }
}

/**
 * @param {{
 *   lyricState: { get: Function, patch: Function, writePayload: Function },
 *   omni: { searchPage: Function, lyric: Function },
 *   providerStore?: { cookie: Function, session: Function },
 *   amllClient?: { fetchLyrics: Function } | null,
 *   log?: (message: string) => void,
 * }} deps
 */
export function createLocalLyricMatcher(deps) {
  const lyricState = deps.lyricState
  const omni = deps.omni
  const providerStore = deps.providerStore
  const amll = deps.amllClient === undefined ? createAmllClient() : deps.amllClient
  const log = typeof deps.log === 'function' ? deps.log : (message) => console.log(`[LocalLyrics] ${message}`)

  const context = async (sourceId) => {
    const cookie = providerStore === undefined ? '' : await providerStore.cookie(sourceId)
    const session = providerStore === undefined ? {} : await providerStore.session(sourceId)
    return { cookie, session }
  }

  /**
   * The pick for one file. `preferred` is the listener's preferred source id (Folia's
   * `preferredAlternativeLyricSource`).
   *
   * @param {string} file
   * @param {{ preferred?: string, state?: object | null }} [options]
   */
  async function match(file, options = {}) {
    const state = options.state !== undefined ? options.state : await lyricState.get(file)
    if (state !== null && (state?.noAutoMatch === true || state?.markedPureMusic === true)) {
      return { matched: null, pureMusic: Boolean(state?.pureMusic), skipped: true }
    }

    const meta = await readTrackMeta(file)
    const target = resolveLocalMatchTarget(file, meta)
    const query = buildLyricSearchQuery(target)
    if (query === '') return { matched: null, pureMusic: false }
    const order = buildLyricSourceOrder(options.preferred).map((source) => source.id)

    // One search per source and query per run: the AMLL probe (below) and the
    // source's own step share it, as Folia's memoised candidates do.
    const searches = new Map()
    const search = async (sourceId, text, limit) => {
      const key = sourceId + '\u0000' + text
      if (!searches.has(key)) {
        searches.set(
          key,
          (async () => {
            const { cookie, session } = await context(sourceId)
            const paged = await omni.searchPage(sourceId, text, { cookie, session }, 1)
            const rows = Array.isArray(paged?.results) ? paged.results : []
            return rows.slice(0, limit).map((song) => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              coverUrl: song.coverUrl || song.cover || '',
              durationMs: Number(song.durationMs) || (Number(song.durationSec) || 0) * 1000,
            }))
          })(),
        )
      }
      return await searches.get(key)
    }

    const findNeteaseId = async () => {
      try {
        const songs = await search('netease', query, AUTO_MATCH_SEARCH_LIMIT)
        const best = pickBestLyricCandidate(target, songs)
        return best === null ? undefined : String(best.candidate.id)
      } catch (error) {
        log(`netease candidate: ${error.message}`)
        return undefined
      }
    }

    let result = null
    try {
      result = await findBestLyrics(target, {
        order,
        log,
        search,
        fetchLyric: async (sourceId, id) => {
          const { cookie, session } = await context(sourceId)
          const got = await omni.lyric(sourceId, id, { cookie, session })
          if (got === null || typeof got !== 'object') return null
          const lines = Array.isArray(got.lines) && got.lines.length > 0 ? got.lines : linesFromLrc(got.lrc)
          if (lines.length === 0) return null
          return {
            lines,
            lrc: got.lrc || '',
            translation: got.translation || '',
            romaji: got.romaji || '',
            ...(got.raw ? { raw: got.raw } : {}),
          }
        },
        ...(amll === null ? {} : {
          fetchAmll: (platform, id) => amll.fetchLyrics(platform, id),
          resolveAmllIds: async () => ({ neteaseId: await findNeteaseId() }),
        }),
      })
    } catch (error) {
      log(`match failed: ${error.message}`)
      return { matched: null, pureMusic: false }
    }

    if (result === null) return { matched: null, pureMusic: false }
    const payload = payloadFromMatch(result)
    if (payload === null) return { matched: null, pureMusic: false }

    const candidate = result.candidate !== null && typeof result.candidate === 'object' ? result.candidate : null
    await lyricState.writePayload(file, payload)
    const matched = await lyricState.patch(file, {
      matched: {
        source: result.source,
        id: String(result.id ?? ''),
        title: String(candidate?.title ?? target.title),
        artist: String(candidate?.artist ?? target.artist),
        album: String(candidate?.album ?? target.album),
        coverUrl: String(candidate?.coverUrl ?? ''),
        score: Number(result.score) || 0,
        wordLevel: result.wordLevel === true,
        at: Date.now(),
      },
      pureMusic: false,
    })
    const applied = matched?.matched ?? null
    log(
      `matched "${target.title}" with ${matched?.matched?.source ?? result.source}/${matched?.matched?.id ?? result.id} `
      + `score=${applied?.score ?? 0} wordLevel=${applied?.wordLevel === true}`,
    )
    return { matched: applied, pureMusic: false, payload }
  }

  return { match }
}
