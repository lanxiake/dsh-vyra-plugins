/**
 * Lyric match service — the backend of the "匹配歌词" window.
 *
 * Ported from Folia's lyric match flow: the tab order is the shared lyric-source
 * registry (NetEase, AMLL, QQ, KuGou Lite, Qishui), every candidate is scored with
 * the automatic pick's `calculateMatchScoreDetails`, and AMLL DB candidates keep
 * the platform their id belongs to so the preview asks the right platform endpoint.
 *
 * Media come from the unified source layer (`omni`), never from public web APIs, so
 * the window searches through the same transport playback uses.
 *
 * @module dsh-music-panel/lyrics-match-service
 */

import { calculateMatchScoreDetails } from './lyrics-match.js'
import { buildLyricSearchQuery, buildKugouLyricSearchQuery } from './lyrics-match-runner.js'
import { LYRIC_SOURCES } from './lyrics-sources.js'
import { buildLyricsUrl } from './amll.js'

const SOURCE_LABELS = {
  netease: 'NetEase Cloud Music',
  amll: 'AMLLDB',
  qq: 'QQ Music',
  kugouLite: 'KuGou Music',
  qishui: 'Qishui Music',
}

/** The tabs of the window, in Folia's order and with the plugin's provider ids. */
export const MATCH_SOURCES = LYRIC_SOURCES.map((source) => ({
  id: source.id,
  label: SOURCE_LABELS[source.id] || source.id,
}))

const AMLL_SEARCH_PAGE_SIZE = 50
const AMLL_MAX_RESULTS = 20
const AMLL_TITLE_SUFFIX = /(?:\s*[(\[（【][^)\]）】]*[)\]）】])+\s*$/u
const AMLL_ARTIST_SEPARATOR = /\s*[,，、&]\s*|\s+(?:feat\.?|ft\.?)\s+/iu

function amllSearchParams(query) {
  const parts = String(query || '')
    .split(/\s+-\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return []
  if (parts.length === 1) return [{ musicName: parts[0] }, { q: parts[0] }]
  const musicName = parts[0]
  const artistName = (parts[1].split(AMLL_ARTIST_SEPARATOR)[0] || '').trim()
  const baseName = musicName.replace(AMLL_TITLE_SUFFIX, '').trim() || musicName
  const params = []
  if (artistName !== '') params.push({ musicName, artistName })
  if (artistName !== '' && baseName !== musicName) params.push({ musicName: baseName, artistName })
  params.push({ musicName: baseName })
  return params
}

function toCandidate(source, song, target, platform) {
  const details = calculateMatchScoreDetails(target, {
    title: song.title,
    artist: song.artist,
    album: song.album,
    durationMs: Number(song.durationMs) || (Number(song.durationSec) || 0) * 1000,
  })
  return {
    source,
    id: String(song.id ?? ''),
    title: String(song.title ?? ''),
    artists: Array.isArray(song.artistsDetail)
      ? song.artistsDetail.map((entry) => entry.name)
      : String(song.artist ?? '')
          .split(/\s*\/\s*/)
          .filter(Boolean),
    album: String(song.album ?? ''),
    coverUrl: String(song.coverUrl ?? song.cover ?? ''),
    durationMs: Number(song.durationMs) || (Number(song.durationSec) || 0) * 1000,
    ...(platform ? { platform } : {}),
    score: details.score,
    titleMatched: details.titleMatched,
    durationMatched: details.durationMatched,
  }
}

/**
 * @param {{
 *   omni: { searchPage: Function, lyric: Function, summaries?: Function },
 *   providerStore?: { cookie: Function },
 *   fetchImpl?: typeof fetch,
 *   amllBaseUrl?: string,
 *   timeoutMs?: number,
 * }} deps
 */
export function createLyricMatchService(deps) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? 6000

  function availableSources() {
    if (typeof deps.omni.summaries !== 'function') return MATCH_SOURCES
    const registered = new Set(
      (deps.omni.summaries() || []).map((source) => String(source?.id ?? '')).filter(Boolean),
    )
    return MATCH_SOURCES.filter((source) => source.id === 'amll' || registered.has(source.id))
  }

  async function searchPlatform(source, query, target) {
    const cookie = deps.providerStore === undefined ? '' : await deps.providerStore.cookie(source)
    // Folia's KuGou provider searches with the title part only, even when the
    // window's default query is the structured "title - artist - album".
    const sourceQuery = source === 'kugouLite'
      ? (String(query).split(/\s+-\s+/u)[0] || '').trim()
      : query
    const paged = await deps.omni.searchPage(source, sourceQuery, { cookie }, 1)
    const rows = Array.isArray(paged.results) ? paged.results : []
    return rows
      .map((song) => toCandidate(source, song, target))
      .sort((left, right) => right.score - left.score)
  }

  async function searchAmll(query, target) {
    for (const params of amllSearchParams(query)) {
      const search = new URLSearchParams({ ...params, pageSize: String(AMLL_SEARCH_PAGE_SIZE) })
      const url = `${deps.amllBaseUrl ?? 'https://api.amll.dev'}/v1/lyrics/search?${search.toString()}`
      let body
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return []
        body = await response.json()
      } catch {
        return []
      }
      const items = Array.isArray(body?.data?.items) ? body.data.items : Array.isArray(body?.items) ? body.items : []
      const seen = new Set()
      const candidates = []
      for (const item of items) {
        const ncmId = Array.isArray(item.ncmMusicIds) && item.ncmMusicIds.length > 0 ? item.ncmMusicIds[0] : ''
        const qqId = Array.isArray(item.qqMusicIds) && item.qqMusicIds.length > 0 ? item.qqMusicIds[0] : ''
        const platform = String(ncmId) !== '' ? 'ncm' : String(qqId) !== '' ? 'qq' : ''
        const id = platform === 'ncm' ? ncmId : platform === 'qq' ? qqId : ''
        if (platform === '' || String(id) === '') continue
        const key = platform + ':' + String(id)
        if (seen.has(key)) continue
        seen.add(key)
        const title = Array.isArray(item.musicNames) ? String(item.musicNames[0] ?? '') : ''
        const artists = Array.isArray(item.artistNames) ? item.artistNames.map((name) => String(name)) : []
        const album = Array.isArray(item.albumNames) ? String(item.albumNames[0] ?? '') : ''
        const details = calculateMatchScoreDetails(target, { title, artist: artists.join(' / '), album })
        candidates.push({
          source: 'amll',
          id: String(id),
          title,
          artists,
          album,
          coverUrl: '',
          durationMs: 0,
          platform,
          score: details.score,
          titleMatched: details.titleMatched,
          durationMatched: details.durationMatched,
        })
      }
      if (candidates.length > 0) {
        return candidates
          .sort((left, right) => right.score - left.score)
          .slice(0, AMLL_MAX_RESULTS)
      }
    }
    return []
  }

  return {
    sources() {
      return availableSources().map((source) => ({ id: source.id, label: source.label }))
    },

    /**
     * @param {{ source: string, query?: string, target: { title: string, artist?: string, album?: string, durationMs?: number } }} input
     */
    async search(input) {
      const source = availableSources().find((entry) => entry.id === input.source)
      if (source === undefined) return { source: input.source, candidates: [], error: 'unknown source' }
      const typed = String(input.query ?? '').trim()
      const target = input.target || { title: '', artist: '', album: '', durationMs: 0 }
      const query = typed !== ''
        ? typed
        : source.id === 'kugouLite'
          ? buildKugouLyricSearchQuery(target)
          : buildLyricSearchQuery(target)
      if (query === '') return { source: source.id, candidates: [], error: '' }
      try {
        const candidates =
          source.id === 'amll'
            ? await searchAmll(query, target)
            : await searchPlatform(source.id, query, target)
        return { source: source.id, query, candidates, error: '' }
      } catch (error) {
        return { source: source.id, query, candidates: [], error: String(error?.message ?? error) }
      }
    },

    /**
     * What the preview panel shows for one candidate.
     *
     * @param {{ source: string, id: string, platform?: 'ncm'|'qq' }} input
     */
    async preview(input) {
      const id = String(input.id ?? '').trim()
      if (id === '') return { lrc: '', translation: '', romaji: '', lines: null, wordLevel: false, raw: null }
      if (input.source === 'amll') {
        const url = buildLyricsUrl(input.platform === 'qq' ? 'qq' : 'ncm', id, deps.amllBaseUrl)
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return { lrc: '', translation: '', romaji: '', lines: null, wordLevel: false, raw: null }
        const body = await response.json()
        const { parseTtml } = await import('./amll.js')
        const lines = parseTtml(body?.data?.lyrics)
        return {
          lrc: lines === null ? '' : lines.map((line) => line.text).join('\n'),
          translation: '',
          romaji: '',
          lines,
          wordLevel: lines !== null && lines.some((line) => Array.isArray(line.words)),
          raw: { type: 'local', lrcContent: String(body?.data?.lyrics ?? ''), formatHint: 'ttml' },
        }
      }
      const cookie = deps.providerStore === undefined ? '' : await deps.providerStore.cookie(String(input.source))
      const lyric = await deps.omni.lyric(String(input.source), id, { cookie })
      return {
        lrc: String(lyric?.lrc ?? ''),
        translation: String(lyric?.translation ?? ''),
        romaji: String(lyric?.romaji ?? ''),
        lines: Array.isArray(lyric?.lines) ? lyric.lines : null,
        wordLevel: lyric?.wordLevel === true,
        raw: lyric?.raw && typeof lyric.raw === 'object' ? lyric.raw : null,
      }
    },
  }
}
