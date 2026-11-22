/**
 * Online lyric lookup (NetEase), mirroring the metadata matcher:
 * search by "title artist", then fetch the LRC for the chosen song id.
 *
 * These are unofficial endpoints: they can change or rate-limit at any time,
 * so callers must treat failures as "no lyrics found", never as fatal.
 *
 * @module dsh-music-panel/lyrics-search
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const TIMEOUT_MS = 8000

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://music.163.com/',
        Accept: 'application/json',
      },
    })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} query title + artist, already concatenated
 * @returns {Promise<{ id: string, title: string, artist: string, album: string, durationSec: number }[]>}
 */
export async function searchLyricCandidates(query) {
  const text = String(query ?? '').trim()
  if (text === '') return []
  const url =
    'https://music.163.com/api/search/get/web?csrf_token=&s=' +
    encodeURIComponent(text) +
    '&type=1&offset=0&total=true&limit=10'
  const json = await fetchJson(url)
  const songs = Array.isArray(json?.result?.songs) ? json.result.songs : []
  return songs
    .map((song) => ({
      id: String(song?.id ?? ''),
      title: String(song?.name ?? ''),
      artist: Array.isArray(song?.artists)
        ? song.artists
            .map((artist) => String(artist?.name ?? ''))
            .filter(Boolean)
            .join(' / ')
        : '',
      album: String(song?.album?.name ?? ''),
      durationSec: Math.round((Number(song?.duration) || 0) / 1000),
    }))
    .filter((candidate) => candidate.id !== '' && candidate.title !== '')
}

/**
 * @param {string} id NetEase song id
 * @returns {Promise<{ lrc: string, translation: string }>}
 */
export async function fetchLyricById(id) {
  const url =
    'https://music.163.com/api/song/lyric?id=' +
    encodeURIComponent(String(id ?? '')) +
    '&lv=-1&kv=-1&tv=-1'
  const json = await fetchJson(url)
  return {
    lrc: typeof json?.lrc?.lyric === 'string' ? json.lrc.lyric : '',
    translation: typeof json?.tlyric?.lyric === 'string' ? json.tlyric.lyric : '',
  }
}
