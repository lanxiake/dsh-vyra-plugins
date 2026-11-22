/**
 * Local library as a first-class source.
 *
 * Same shape as an online source, so playback, search and lyrics stop
 * special-casing "local". Dependencies are injected instead of imported: the
 * library instance owns scanning and caching, and lyrics already have their own
 * reader with an embedded/sidecar preference order.
 *
 * @module dsh-music-panel/sources/local
 */

import { capabilities as buildCapabilities, providerApi } from '../../services/core/contract.js'
import { MusicError } from '../../services/core/errors.js'

const SOURCE_ID = 'local'
/** Route the browser already uses for local audio. */
const DEFAULT_STREAM_PATH = 'music/stream'

/** Map one scanned track onto the shared `Track` shape. */
export function toTrack(track) {
  const path = String(track.path ?? '')
  return {
    id: path,
    title: String(track.title ?? track.name ?? ''),
    artist: String(track.artist ?? ''),
    album: String(track.album ?? ''),
    durationMs: Math.round(Number(track.durationSec ?? 0) * 1000),
    coverUrl: '',
    sourceRef: { kind: 'local', sourceId: SOURCE_ID, ref: path },
    providerData: {
      folder: track.folder,
      ext: track.ext,
      size: track.size,
      mtime: track.mtime,
      hasCover: track.hasCover,
    },
  }
}

/**
 * Local lyrics use `{ time: seconds, text, translation }`; `time: -1` marks an
 * untimed line, which the player cannot sync and therefore drops.
 */
export function toLyricLines(local) {
  const rows = Array.isArray(local?.lines) ? local.lines : []
  const lines = []
  for (const row of rows) {
    const time = Number(row?.time)
    if (!Number.isFinite(time) || time < 0) continue
    const text = String(row?.text ?? '')
    const translation = String(row?.translation ?? '')
    lines.push(translation === '' ? { timeMs: Math.round(time * 1000), text } : {
      timeMs: Math.round(time * 1000),
      text,
      translation,
    })
  }
  return lines
}

/** Case-insensitive match over title / artist / album, plus pinyin keys. */
function matches(track, needle) {
  if (needle === '') return true
  const haystack = `${track.title} ${track.artist} ${track.album}`.toLowerCase()
  if (haystack.includes(needle)) return true
  // `py` / `pyf` are the pinyin keys the scanner already computed, so an ASCII
  // query can find a Chinese title without re-running pinyin conversion.
  const py = String(track.py ?? '').toLowerCase()
  const pyf = String(track.pyf ?? '').toLowerCase()
  return py.includes(needle) || pyf.includes(needle)
}

/**
 * @param {{
 *   scan: (options?: object) => Promise<{ tracks: object[] }>,
 *   readLyrics?: (file: string) => Promise<{ lines: object[], source?: string|null }>,
 *   streamPath?: string,
 * }} deps
 */
export function createLocalSource(deps) {
  const streamPath = deps.streamPath ?? DEFAULT_STREAM_PATH

  async function scanTracks() {
    const result = await deps.scan()
    return Array.isArray(result?.tracks) ? result.tracks : []
  }

  const source = {
    id: SOURCE_ID,
    kind: 'local',
    displayName: 'Local library',
    capabilities: buildCapabilities({ search: true, playback: true, lyrics: true }),
    qualityLevels: ['original'],
    loginMethods: [],

    availability() {
      return { configured: true }
    },

    async search(query, _page, _ctx) {
      const needle = String(query ?? '').trim().toLowerCase()
      const tracks = await scanTracks()
      const songs = tracks.filter((track) => matches(track, needle)).slice(0, 200).map(toTrack)
      return { songs, total: songs.length, page: 1, hasMore: false }
    },

    /** The whole library; `options` is the same paging shape online sources use. */
    async songs(_ctx, options) {
      const tracks = await scanTracks()
      const offset = Math.max(0, Number(options?.offset) || 0)
      const limit = Number(options?.limit) > 0 ? Number(options.limit) : tracks.length
      const page = tracks.slice(offset, offset + limit).map(toTrack)
      return { songs: page, total: tracks.length, offset }
    },

    async getAudioSource(id) {
      const file = String(id ?? '')
      if (file === '') {
        throw new MusicError('a local track needs a file path', { code: 'invalid-response', sourceId: SOURCE_ID })
      }
      // The browser streams through the existing guarded route, which re-resolves
      // the path against the configured roots.
      return {
        url: `${streamPath}?path=${encodeURIComponent(file)}`,
        quality: 'original',
      }
    },

    async lyric(id) {
      if (typeof deps.readLyrics !== 'function') {
        return { lines: [], wordByWord: false, source: SOURCE_ID }
      }
      const local = await deps.readLyrics(String(id ?? ''))
      return {
        lines: toLyricLines(local),
        wordByWord: false,
        source: String(local?.source ?? SOURCE_ID),
        file: String(id ?? ''),
      }
    },
  }
  source.stream = source.getAudioSource
  source.api = providerApi(source)
  return source
}
