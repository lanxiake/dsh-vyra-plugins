/**
 * Online metadata search, mirroring the sources MusicTag uses.
 *
 *   - NetEase Cloud Music (unofficial web API)   — best Chinese coverage
 *   - QQ Music (unofficial search endpoint)      — best Chinese coverage
 *   - iTunes Search API (public, no key)         — western catalogue
 *   - MusicBrainz (public, needs a User-Agent)   — open database
 *
 * The NetEase/QQ endpoints are not official APIs: they can change or rate
 * limit at any time, and using them must respect their terms of service.
 * Every request is time-boxed and a failing source never blocks the others.
 *
 * @module dsh-music-panel/online
 */

const TIMEOUT_MS = 8_000
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) dsh-music-panel/0.3.19'

/** Search sources in display order. */
export const SOURCES = ['netease', 'qq', 'itunes', 'musicbrainz']

async function fetchJson(url, headers) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function textOf(value) {
  return typeof value === 'string' ? value : ''
}

function yearOf(stamp) {
  const value = Number(stamp)
  if (!isFinite(value) || value <= 0) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? '' : String(date.getFullYear())
}

function joinArtists(list) {
  if (!Array.isArray(list)) return ''
  return list
    .map((item) => (item !== null && typeof item === 'object' ? item.name : item))
    .filter((name) => typeof name === 'string' && name !== '')
    .join(' / ')
}

/** @param {unknown} song */
export function neteaseCandidate(song) {
  if (song === null || typeof song !== 'object') return null
  const album = song.album !== null && typeof song.album === 'object' ? song.album : {}
  return {
    source: 'netease',
    id: String(song.id ?? ''),
    title: textOf(song.name),
    artist: joinArtists(song.artists),
    album: textOf(album.name),
    year: yearOf(album.publishTime),
    track: '',
    disc: '',
    genre: '',
    coverUrl: textOf(album.picUrl) || textOf(song.album && song.album.picUrl),
    durationMs: Number(song.duration) || 0,
  }
}

/** @param {unknown} song */
export function qqCandidate(song) {
  if (song === null || typeof song !== 'object') return null
  const albummid = textOf(song.albummid)
  return {
    source: 'qq',
    id: String(song.songid ?? song.songmid ?? ''),
    title: textOf(song.songname),
    artist: joinArtists(song.singer),
    album: textOf(song.albumname),
    year: yearOf(Number(song.pubtime) * 1000),
    track: Number.isFinite(Number(song.trackNumber)) && Number(song.trackNumber) > 0 ? String(song.trackNumber) : '',
    // `cdIdx` is the disc index inside the result, not the track number; leave
    // both empty rather than writing a wrong value.
    disc: '',
    genre: '',
    coverUrl: albummid === '' ? '' : `https://y.qq.com/music/photo_new/T002R500x500M000${albummid}.jpg`,
    durationMs: (Number(song.interval) || 0) * 1000,
  }
}

/** @param {unknown} item */
export function itunesCandidate(item) {
  if (item === null || typeof item !== 'object') return null
  const artwork = textOf(item.artworkUrl100)
  return {
    source: 'itunes',
    id: String(item.trackId ?? ''),
    title: textOf(item.trackName),
    artist: textOf(item.artistName),
    album: textOf(item.collectionName),
    year: yearOf(Date.parse(textOf(item.releaseDate))),
    track: Number.isFinite(Number(item.trackNumber)) && Number(item.trackNumber) > 0 ? String(item.trackNumber) : '',
    disc: Number.isFinite(Number(item.discNumber)) && Number(item.discNumber) > 0 ? String(item.discNumber) : '',
    genre: textOf(item.primaryGenreName),
    coverUrl: artwork === '' ? '' : artwork.replace('100x100', '600x600'),
    durationMs: Number(item.trackTimeMillis) || 0,
  }
}

/** @param {unknown} item */
export function musicBrainzCandidate(item) {
  if (item === null || typeof item !== 'object') return null
  const releases = Array.isArray(item.releases) ? item.releases : []
  const release = releases[0] !== null && typeof releases[0] === 'object' ? releases[0] : {}
  const media = Array.isArray(release.media) ? release.media[0] : null
  const track = media !== null && typeof media === 'object' && Array.isArray(media.track) ? media.track[0] : null
  const date = textOf(release.date)
  const releaseId = textOf(release.id)
  return {
    source: 'musicbrainz',
    id: textOf(item.id),
    title: textOf(item.title),
    artist: joinArtists(item['artist-credit']),
    album: textOf(release.title),
    year: date.length >= 4 ? date.slice(0, 4) : '',
    track: track !== null && typeof track === 'object' && Number(track.number) > 0 ? String(track.number) : '',
    disc: '',
    genre: '',
    coverUrl: releaseId === '' ? '' : `https://coverartarchive.org/release/${releaseId}/front-500`,
    durationMs: Number(item.length) || 0,
  }
}

async function searchSource(source, query) {
  if (source === 'netease') {
    const data = await fetchJson(
      `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(query)}&type=1&offset=0&total=true&limit=10`,
      { 'User-Agent': USER_AGENT, Referer: 'https://music.163.com/' },
    )
    const songs = data && data.result && Array.isArray(data.result.songs) ? data.result.songs : []
    return songs.map(neteaseCandidate).filter(Boolean)
  }
  if (source === 'qq') {
    const data = await fetchJson(
      `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(query)}&format=json&n=10&p=1`,
      { 'User-Agent': USER_AGENT, Referer: 'https://y.qq.com/' },
    )
    const list = data && data.data && data.data.song && Array.isArray(data.data.song.list) ? data.data.song.list : []
    return list.map(qqCandidate).filter(Boolean)
  }
  if (source === 'itunes') {
    const data = await fetchJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`,
      { 'User-Agent': USER_AGENT },
    )
    const results = data && Array.isArray(data.results) ? data.results : []
    return results.map(itunesCandidate).filter(Boolean)
  }
  if (source === 'musicbrainz') {
    const data = await fetchJson(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=10&inc=releases+artist-credits`,
      { 'User-Agent': `${USER_AGENT} (https://github.com/Aliboder/dsh-music-panel)` },
    )
    const recordings = data && Array.isArray(data.recordings) ? data.recordings : []
    return recordings.map(musicBrainzCandidate).filter(Boolean)
  }
  return []
}

/** Cheap relevance score: exact/near title and artist matches rank first. */
export function scoreCandidate(candidate, input) {
  const title = String(input.title || '').toLowerCase()
  const artist = String(input.artist || '').toLowerCase()
  const candidateTitle = String(candidate.title || '').toLowerCase()
  const candidateArtist = String(candidate.artist || '').toLowerCase()
  let score = 0
  if (title !== '' && candidateTitle !== '') {
    if (candidateTitle === title) score += 6
    else if (candidateTitle.includes(title) || title.includes(candidateTitle)) score += 3
  }
  if (artist !== '' && candidateArtist !== '') {
    if (candidateArtist === artist) score += 4
    else if (candidateArtist.includes(artist) || artist.includes(candidateArtist)) score += 2
  }
  if (candidate.coverUrl !== '') score += 1
  return score
}

/**
 * Search every source concurrently.
 *
 * @param {{ title?: string, artist?: string, album?: string }} input
 * @param {string[]} [enabled]
 * @returns {Promise<{ results: Array<object>, sources: Array<{ source: string, ok: boolean, count: number, error: string }> }>}
 */
export async function searchOnline(input, enabled) {
  const title = textOf(input && input.title).trim()
  const artist = textOf(input && input.artist).trim()
  const album = textOf(input && input.album).trim()
  const query = [title, artist, album].filter((part) => part !== '').join(' ')
  if (query === '') return { results: [], sources: [] }

  const wanted = Array.isArray(enabled) && enabled.length > 0 ? enabled.filter((s) => SOURCES.includes(s)) : SOURCES
  const settled = await Promise.allSettled(
    wanted.map(async (source) => {
      const results = await searchSource(source, query)
      return { source, results }
    }),
  )

  const results = []
  const sources = []
  settled.forEach((entry, index) => {
    const source = wanted[index]
    if (entry.status === 'fulfilled') {
      const count = entry.value.results.length
      results.push(...entry.value.results)
      sources.push({ source, ok: true, count, error: '' })
    } else {
      sources.push({
        source,
        ok: false,
        count: 0,
        error: String((entry.reason && entry.reason.message) || entry.reason),
      })
    }
  })

  const order = new Map()
  wanted.forEach((source, index) => order.set(source, index))
  const seen = new Set()
  const unique = []
  for (const candidate of results) {
    const key = `${candidate.source}:${candidate.id}`
    if (candidate.id !== '' && seen.has(key)) continue
    seen.add(key)
    unique.push(candidate)
  }
  unique.sort((left, right) => {
    const leftScore = scoreCandidate(left, { title, artist })
    const rightScore = scoreCandidate(right, { title, artist })
    if (rightScore !== leftScore) return rightScore - leftScore
    return (order.get(left.source) ?? 99) - (order.get(right.source) ?? 99)
  })

  return { results: unique.slice(0, 30), sources }
}
