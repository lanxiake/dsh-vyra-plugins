/**
 * The `/online/*` HTTP surface.
 *
 * Moved verbatim out of `lib/routes.js` so online work no longer touches the
 * local-library routes. Each branch still ends with a bare `return`: the caller
 * has already been answered, so `handle` only reports whether it matched.
 *
 * Everything online-specific lives here: the upstream user agent, per-provider
 * referers, and the wire-shape helper the client relies on.
 *
 * @module dsh-music-panel/routes/online
 */

import { createReadStream } from 'node:fs'
import { open } from 'node:fs/promises'
import { fail, readJson, sendJson } from '../http.js'
import { isAllowedCoverUrl } from '../url-safety.js'
import { readTrackMeta } from '../../services/media/meta.js'
import { createCacheWriter } from '../../services/media/cache-writer.js'
import { omni } from '../../providers/sources/index.js'
import { resolveLegacyStream } from '../../providers/index.js'
import * as ND from '../../providers/navidrome.js'
import { createLoginBridge, createQrAdapter } from '../../providers/login/bridge.js'
import { loginFailureOf } from '../../services/core/login-failure.js'
import { neteaseServiceStatus, restartNeteaseService } from '../../services/netease-api.js'
import { qqServiceStatus, restartQqService } from '../../services/qq-api.js'
import { kugouServiceStatus, restartKugouService } from '../../services/kugou-api.js'
import { createAmllClient } from '../../services/lyrics/amll.js'
import { pickBestLyricCandidate } from '../../services/lyrics/lyrics-match.js'
import { buildLyricSourceOrder, isLyricSource } from '../../services/lyrics/lyrics-sources.js'
import {
  buildLyricSearchQuery,
  findBestLyrics,
  linesFromLrc,
  lrcTime,
} from '../../services/lyrics/lyrics-match-runner.js'

const ONLINE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const ONLINE_REFERERS = {
  netease: 'https://music.163.com/',
  qq: 'https://y.qq.com/',
  kugou: 'https://www.kugou.com/',
  kugouLite: 'https://www.kugou.com/',
  bodian: 'https://www.kuwo.cn/',
  qishui: 'https://music.douyin.com/',
}

/** A CDN often answers octet-stream; MSE and <audio> both need a real audio type. */
function onlineAudioMime(upstreamType, streamUrl, quality) {
  const type = String(upstreamType || '').split(';')[0].trim().toLowerCase()
  if (type.startsWith('audio/')) return type
  let path = ''
  try { path = new URL(streamUrl).pathname.toLowerCase() } catch (error) {}
  if (path.endsWith('.flac')) return 'audio/flac'
  if (path.endsWith('.m4a') || path.endsWith('.mp4')) return 'audio/mp4'
  if (path.endsWith('.ogg') || path.endsWith('.opus')) return 'audio/ogg'
  if (path.endsWith('.wav')) return 'audio/wav'
  if (path.endsWith('.mp3')) return 'audio/mpeg'
  if (quality === 'lossless' || quality === 'hires') return 'audio/flac'
  return 'audio/mpeg'
}

/**
 * Issue #28: NetEase's CDN labels a real FLAC file as `audio/mpeg`. The browser trusts the
 * label, tries to demux MP3, and reports a decode failure. Sniff the container from the first
 * bytes instead of believing the header; return null when the bytes say nothing.
 */
function sniffAudioMime(chunk) {
  if (chunk === null || chunk === undefined || chunk.length < 4) return null
  const tag = chunk.subarray(0, 4).toString('latin1')
  if (tag === 'fLaC') return 'audio/flac'
  if (tag === 'OggS') return 'audio/ogg'
  if (tag === 'RIFF') return 'audio/wav'
  if (tag === 'ID3') return 'audio/mpeg'
  if (chunk.length >= 8 && chunk.subarray(4, 8).toString('latin1') === 'ftyp') return 'audio/mp4'
  // MPEG audio frame sync: 11 set bits at the start of an MP3 frame.
  if (chunk[0] === 0xff && (chunk[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  return null
}

/**
 * The same sniff for a copy in Folia's media cache: its stored mime came from the CDN, and a
 * NetEase lossless copy carries the same wrong audio/mpeg label. Read the file's first bytes.
 */
async function sniffFileAudioMime(file) {
  if (typeof file !== 'string' || file === '') return null
  let handle = null
  try {
    handle = await open(file, 'r')
    const header = Buffer.alloc(16)
    const read = await handle.read(header, 0, header.length, 0)
    return sniffAudioMime(header.subarray(0, read.bytesRead))
  } catch (error) {
    return null
  } finally {
    if (handle !== null) await handle.close().catch(() => {})
  }
}

/** Read only the first chunk so the container can be sniffed before headers go out. */
async function peekFirstChunk(body) {
  if (body === null || typeof body.getReader !== 'function') return null
  const reader = body.getReader()
  try {
    const first = await reader.read()
    if (first.done) {
      try { reader.releaseLock() } catch (error) {}
      return null
    }
    return { first: Buffer.from(first.value), reader }
  } catch (error) {
    try { reader.releaseLock() } catch (releaseError) {}
    return null
  }
}

/**
 * Write the peeked first chunk (if any) and the rest of the upstream body. With no peek, the
 * original stream is iterated as before.
 */
async function writeUpstreamBody(res, upstream, firstChunk, reader, onStop) {
  // A Buffer is a Uint8Array, but writing one through a plain Node response is fine while a
  // fake/test sink stringifies it differently. Hand over a plain view either way.
  const writeChunk = (chunk) => {
    res.write(Buffer.isBuffer(chunk)
      ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
      : chunk)
  }
  if (firstChunk !== null && firstChunk.length > 0) {
    if (res.writableEnded || res.destroyed) {
      if (reader !== null) reader.cancel().catch(() => {})
      return
    }
    writeChunk(firstChunk)
  }
  if (reader !== null) {
    while (true) {
      const next = await reader.read()
      if (next.done) return
      if (res.writableEnded || res.destroyed) {
        if (typeof onStop === 'function') onStop()
        reader.cancel().catch(() => {})
        return
      }
      writeChunk(next.value)
    }
  }
  if (upstream.body === null) return
  for await (const chunk of upstream.body) {
    if (res.writableEnded || res.destroyed) {
      if (typeof onStop === 'function') onStop()
      break
    }
    res.write(chunk)
  }
}

function replayGainHeaders(gain) {
  const headers = {}
  if (gain === null || typeof gain !== 'object') return headers
  for (const [field, name] of [
    ['trackGain', 'x-music-track-gain'],
    ['albumGain', 'x-music-album-gain'],
    ['trackPeak', 'x-music-track-peak'],
    ['albumPeak', 'x-music-album-peak'],
  ]) {
    if (typeof gain[field] === 'number' && Number.isFinite(gain[field])) {
      headers[name] = String(gain[field])
    }
  }
  return headers
}

function onlineReferer(provider) {
  return ONLINE_REFERERS[provider] || 'https://www.kugou.com/'
}

/** Folia's quality ladder, lowest first; only used when a resolved URL is dead. */
const ONLINE_QUALITY_LADDER = ['standard', 'high', 'lossless', 'hires']

function rangeStartOf(value) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(String(value || '').trim())
  return match === null ? null : Number.parseInt(match[1], 10)
}

export function nextLowerOnlineQuality(quality) {
  const index = ONLINE_QUALITY_LADDER.indexOf(quality)
  return index > 0 ? ONLINE_QUALITY_LADDER[index - 1] : null
}

/**
 * A CDN answer that is about this request, not this song: a node rejecting the client it was
 * asked from (403), an object the node no longer has, throttling, or a node that is down. Worth
 * one more signed address before the listener is told the track is unavailable.
 */
function retriableCdnStatus(status) {
  const code = Number(status) || 0
  return code === 403 || code === 404 || code === 408 || code === 429 || code >= 500
}

/**
 * What a refused CDN answer means, in one line.
 *
 * Before this, only the status reached the client, and a status is not a reason: the client fed
 * the answer to its media element and Chromium reported the kernel's
 * `PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN` instead (issue #26).
 */
function cdnFailureMessage(status) {
  const code = Number(status) || 0
  if (code === 403) return '音乐平台 CDN 节点拒绝了取流请求（HTTP 403）'
  if (code === 404 || code === 410) return '音乐平台 CDN 上已没有这个文件（HTTP ' + code + '）'
  if (code === 429) return '音乐平台 CDN 正在限流，请稍后再试（HTTP 429）'
  if (code >= 500) return '音乐平台 CDN 暂时不可用（HTTP ' + code + '）'
  return '音乐平台 CDN 返回 HTTP ' + code
}

/** Client tracks carry onlineId; accept both wire shapes. */
export function onlineSongId(song) {
  if (song === null || typeof song !== 'object') return ''
  return String(song.id || song.onlineId || '')
}

/** The lyric record key for an online song (the same store local files use). */
export function onlineLyricKey(provider, id) {
  return `online:${String(provider ?? '')}:${String(id ?? '')}`
}

/**
 * @param {{
 *   providerStore: object,
 *   kugouSessions: object,
 *   lyricState?: object,
 *   profileState: (provider: string) => Promise<object | null>,
 *   vipInfoState: (provider: string) => Promise<{ vip: unknown, expiresAt: string }>,
 *   vipState: (provider: string) => Promise<unknown>,
 *   invalidateProviderCaches: (provider: string) => void,
 * }} deps
 */
export function createOnlineRoutes(deps) {
  // These are used without guards inside the handlers; a missing one used to fail
  // silently as a 502 at request time instead of loudly at wiring time.
  const REQUIRED_DEPS = ['settings', 'profileState', 'vipInfoState', 'vipState', 'invalidateProviderCaches']
  for (const key of REQUIRED_DEPS) {
    if (deps[key] === undefined) throw new Error(`createOnlineRoutes is missing dependency: ${key}`)
  }

  const { settings, providerStore, accountStore, accountReads, kugouSessions, profileState, vipInfoState, vipState, invalidateProviderCaches } =
    deps
  // The per-song lyric record shared with local files. Optional so a test can drive the
  // routes without one; nothing is remembered then.
  const lyricRecords = deps.lyricState ?? {
    get: async () => null,
    readPayload: async () => null,
    writePayload: async () => null,
    patch: async () => null,
    clearPayload: async () => {},
  }
  // Folia's media cache: written only after a full play, read before the provider is asked.
  const mediaCache = deps.mediaCache
  const cacheWriter = mediaCache === undefined
    ? null
    : createCacheWriter({
        mediaCache,
        omni,
        providerStore,
        isAllowedCoverUrl,
        userAgent: ONLINE_UA,
        refererFor: onlineReferer,
      })

  /**
   * One resolved CDN URL per song/quality for a few minutes. A media element asks
   * for a new byte range on every seek; re-resolving the provider each time makes
   * the resource look different to Chromium (and can return a fresh URL that does
   * not honour Range). Folia's element talks to one stable CDN URL.
   */
  const streamUrlCache = new Map()
  const STREAM_URL_TTL_MS = 4 * 60 * 1000
  function streamUrlKey(provider, id, quality) {
    return provider + ':' + id + ':' + quality
  }

  /**
   * Serve one song from Folia's media cache. A copy of another quality is passed over unless
   * `anyQuality` is set (the "no URL at all" fallback). Returns false when nothing is served.
   */
  async function serveCachedAudio(req, res, provider, id, options = {}) {
    if (mediaCache === undefined) return false
    if (cacheWriter !== null && cacheWriter.isDistrusted(provider, id)) return false
    const quality = typeof options.quality === 'string' && options.quality !== '' ? options.quality : ''
    const cached = await mediaCache.lookup(provider, id)
    if (cached === null) return false
    if (options.anyQuality !== true && cached.quality !== '' && quality !== '' && cached.quality !== quality) {
      return false
    }
    void mediaCache.touch(provider, id)
    if (cacheWriter !== null) cacheWriter.noteStream(provider, id, { preview: false })
    const rangeHeader = req.headers.range
    const cachedMime = await sniffFileAudioMime(cached.file)
    const baseHeaders = {
      'content-type': cachedMime || cached.mime,
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=604800',
    }
    if (options.anyQuality === true) baseHeaders['x-music-cache-fallback'] = '1'
    Object.assign(baseHeaders, replayGainHeaders(cached.replayGain))
    if (typeof rangeHeader === 'string' && rangeHeader !== '') {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
      let start = 0
      let end = cached.size - 1
      if (match !== null) {
        if (match[1] !== '') start = Number.parseInt(match[1], 10)
        if (match[2] !== '') end = Number.parseInt(match[2], 10)
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= cached.size) {
        res.writeHead(416, { 'content-range': 'bytes */' + cached.size })
        res.end()
        return true
      }
      end = Math.min(end, cached.size - 1)
      const length = end - start + 1
      res.writeHead(206, {
        ...baseHeaders,
        'content-length': length,
        'content-range': 'bytes ' + start + '-' + end + '/' + cached.size,
      })
      if (req.method === 'HEAD') {
        res.end()
        return true
      }
      createReadStream(cached.file, { start, end }).pipe(res)
      return true
    }
    res.writeHead(200, { ...baseHeaders, 'content-length': cached.size })
    if (req.method === 'HEAD') {
      res.end()
      return true
    }
    createReadStream(cached.file).pipe(res)
    return true
  }

  /** Addressable online sources come from the registry, never a literal list. */
  function isOnlineSource(id) {
    return omni.summaries().some((source) => source.id === id && source.kind === 'online')
  }

  /** QR sign-in is a capability of the source, not a platform name. */
  function supportsQrLogin(id) {
    const source = omni.summaries().find((entry) => entry.id === id)
    return source !== undefined && source.capabilities !== undefined && source.capabilities.loginQr === true
  }

  /** Local worker state for the platforms whose upstream runs in a Host worker. */
  async function localServiceStatus(provider) {
    let status
    if (provider === 'netease') status = await neteaseServiceStatus()
    else if (provider === 'qq') status = await qqServiceStatus()
    else if (provider === 'kugou' || provider === 'kugouLite') status = await kugouServiceStatus(provider)
    else return { available: false, failed: false, error: null, restarting: false }
    return {
      available: true,
      failed: status.running !== true && status.error !== null,
      error: status.error ?? null,
      restarting: false,
    }
  }

  async function restartLocalService(provider) {
    if (provider === 'netease') return await restartNeteaseService()
    if (provider === 'qq') return await restartQqService()
    if (provider === 'kugou' || provider === 'kugouLite') return await restartKugouService(provider)
    return null
  }

  // Playback reports write to a real account; the gate below refuses bursts no
  // listener could produce, whatever the client believed about its session.
  const recentReports = []
  function allowPlaybackReport() {
    const now = Date.now()
    while (recentReports.length > 0 && now - recentReports[0] >= 60 * 60 * 1000) recentReports.shift()
    if (recentReports.length >= 60) return false
    const last = recentReports[recentReports.length - 1]
    if (last !== undefined && now - last < 5000) return false
    recentReports.push(now)
    return true
  }

  // QR sign-in goes through the shared state machine; persistence still writes the
  // legacy provider store, so the rest of the plugin keeps reading one source.
  // The adapter is resolved from the registry at start time: platforms registered
  // after the routes were built (Bodian) are still found.
  const login = createLoginBridge({
    adapterFor: (id, kind) => {
      const source = omni.summaries().find((entry) => entry.id === id)
      if (source === undefined || source.capabilities?.loginQr !== true) return {}
      return createQrAdapter({
        sourceId: id,
        omni,
        mode: kind || 'qq',
        getSession: async () => (providerStore === undefined ? {} : await providerStore.session(id)),
        logout: async () => {
          if (typeof omni.logout === 'function') await omni.logout(id)
        },
      })
    },
    store: {
      save: async (id, credentials, user) => {
        if (providerStore !== undefined) {
          await providerStore.setLogin(id, {
            ...credentials,
            ...(user !== null && user.nickname !== '' ? { nickname: user.nickname } : {}),
          })
        }
        invalidateProviderCaches(id)
        // A sign-in is the best moment to read the account; the client does not
        // wait for it, and the snapshot is shown on the next providers read.
        if (accountReads !== undefined) void accountReads.read(id, 'sign-in')
      },
      clear: async (id) => {
        if (providerStore !== undefined) await providerStore.clear(id)
        if (accountReads !== undefined) await accountReads.signOut(id)
        invalidateProviderCaches(id)
      },
    },
  })

  /**
   * The I/O `findBestLyrics` runs on. Production reads the source registry and the AMLL
   * client; `deps.lyricMatchIo` replaces any of the three callbacks so the route can be
   * driven without the network (each one is Folia's own query/fetch question).
   */
  const lyricMatchIo =
    deps.lyricMatchIo !== undefined && deps.lyricMatchIo !== null && typeof deps.lyricMatchIo === 'object'
      ? deps.lyricMatchIo
      : null
  function ioOverride(name) {
    if (lyricMatchIo === null || typeof lyricMatchIo[name] !== 'function') return null
    return lyricMatchIo[name]
  }

  /**
   * Fetch one source's lyric in the shape the match runner and the payload repair
   * share. The provider's own cookie/session is used; without one, Kugou/KRC would
   * silently fall back to line-level LRC.
   */
  async function fetchLyricSource(sourceId, sourceSongId) {
    const override = ioOverride('fetchLyric')
    if (override !== null) return await override(sourceId, sourceSongId)
    const cookie = providerStore === undefined ? '' : await providerStore.cookie(sourceId)
    const session = providerStore === undefined ? {} : await providerStore.session(sourceId)
    const got = await omni.lyric(sourceId, sourceSongId, { cookie, session })
    if (got === null) return null
    const lines = Array.isArray(got.lines) && got.lines.length > 0 ? got.lines : linesFromLrc(got.lrc)
    if (lines.length === 0) return null
    return {
      lines,
      lrc: got.lrc || '',
      translation: got.translation || '',
      romaji: got.romaji || '',
      ...(got.raw ? { raw: got.raw } : {}),
    }
  }

  /** True when a cached payload really carries word timings, not just line text. */
  function payloadHasWords(payload) {
    return payload !== null
      && typeof payload === 'object'
      && Array.isArray(payload.lines)
      && payload.lines.some((line) => line && Array.isArray(line.words) && line.words.length > 0)
  }

  /**
   * The best lyric another source has for this track, in Folia's auto-match order:
   * the listener's preferred source first, then the registry order; a word-level match
   * outranks every line-level one. Shared by "the platform has none" and the
   * `/online/best-lyric` upgrade, so both ask the same question the same way.
   *
   * AMLL keeps its lyrics under NetEase / QQ song ids. For a track of one of those two
   * the id is in hand; any other platform's track asks NetEase first, exactly as Folia's
   * matcher does, and only when the pick reaches the AMLL step.
   */
  async function findMatchedLyric(provider, id, params) {
    const title = (params.get('title') || '').trim()
    if (title === '') return null
    const wantedTrack = {
      title,
      artist: (params.get('artist') || '').trim(),
      album: (params.get('album') || '').trim(),
      durationMs: Number(params.get('duration')) > 0 ? Number(params.get('duration')) * 1000 : 0,
    }
    const preferred = String(params.get('preferred') || '').trim() || undefined
    // Folia's `keepProviderWordTiming` asks the preferred source alone for word timing.
    const only = String(params.get('only') || '').trim()
    const searchOverride = ioOverride('search')
    const fetchAmllOverride = ioOverride('fetchAmll')
    // The AMLL client is only built when nothing injects it: a test that injects all three
    // must not construct (or ever call) the real one.
    const amll = fetchAmllOverride === null ? createAmllClient() : null
    const search = searchOverride ?? (async (sourceId, query, limit) => {
      const paged = await omni.searchPage(sourceId, query, {}, 1)
      return (Array.isArray(paged.results) ? paged.results : []).slice(0, limit).map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        coverUrl: song.coverUrl || song.cover || '',
        durationMs: Number(song.durationMs) || (Number(song.durationSec) || 0) * 1000,
      }))
    })
    try {
      return await findBestLyrics(wantedTrack, {
        // Folia keeps the song's own platform in the order: a word-level own lyric can win.
        order: only !== '' && isLyricSource(only)
          ? [only]
          : buildLyricSourceOrder(preferred).map((source) => source.id),
        search,
        fetchLyric: fetchLyricSource,
        fetchAmll: fetchAmllOverride ?? ((platform, musicId) => amll.fetchLyrics(platform, musicId)),
        // A song its own platform lists under another name (the original title beside a
        // translated one), or an artist the sources spell differently: one more pass when
        // the first found no word-level lyric (Folia's lyric aliases).
        searchAlias: async () => await omni.lyricSearchAlias(provider, id),
        alternateArtist: async () => await omni.alternateArtistName(provider, id),
        resolveAmllIds: async () => {
          if (provider === 'netease') return { neteaseId: id }
          if (provider === 'qq') return { qqId: id }
          const query = buildLyricSearchQuery(wantedTrack)
          if (query === '') return {}
          try {
            const songs = await search('netease', query, 10)
            const best = pickBestLyricCandidate(wantedTrack, songs)
            return best === null ? {} : { neteaseId: String(best.candidate.id) }
          } catch {
            return {}
          }
        },
      })
    } catch (error) {
      return null
    }
  }

  return async function handle(req, res, ctx) {
    const { url, pathname, method, params } = ctx

      if (pathname === '/online/search' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const query = (params.get('q') || '').trim()
        const kind = (params.get('kind') || 'song').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        if (query === '') return fail(res, 400, 'NO_QUERY', '缺少搜索词')
        if (kind !== 'song' && kind !== 'album' && kind !== 'playlist') {
          return fail(res, 400, 'BAD_KIND', '未知搜索种类')
        }
        try {
          var page = Math.max(1, Number(params.get('page')) || 1)
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          // Navidrome carries its server + token in the session rather than a
          // cookie, so search needs it too — without this the provider resolves
          // an empty server and every Navidrome search fails.
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          if (kind !== 'song') {
            const paged = await omni.searchCollections(provider, kind, query, { cookie, session }, page)
            return sendJson(res, 200, {
              ok: true,
              provider,
              query,
              kind,
              collections: paged.items,
              total: paged.total,
              page: paged.page,
              hasMore: paged.hasMore,
            })
          }
          const paged = await omni.searchPage(provider, query, { cookie, session }, page)
          return sendJson(res, 200, {
            ok: true,
            provider,
            query,
            kind: 'song',
            results: paged.results,
            total: paged.total,
            page: paged.page,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'SEARCH_FAILED',
            error instanceof Error ? error.message : '在线搜索失败',
          )
        }
      }

      if (pathname === '/online/artist-songs' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const artist = (params.get('artist') || '').trim()
        const artistId = (params.get('artistId') || '').trim()
        const page = {
          limit: Math.max(1, Math.min(500, Number(params.get('limit')) || 200)),
          offset: Math.max(0, Number(params.get('offset')) || 0),
        }
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        if (artist === '') return fail(res, 400, 'NO_ARTIST', '缺少歌手名')
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const songs = await omni.artistSongs(provider, artist, { cookie, session, artistId, page })
          return sendJson(res, 200, { ok: true, provider, artist, songs })
        } catch (error) {
          return fail(
            res,
            502,
            'ARTIST_FAILED',
            error instanceof Error ? error.message : '歌手歌曲获取失败',
          )
        }
      }

      if (pathname === '/online/stream' && (method === 'GET' || method === 'HEAD')) {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        // The platform decides whether this account gets a full stream, a preview
        // clip, or no stream. A VIP label on the row is metadata, not a gate: a
        // non-VIP account may still play the track or receive a free preview.
        // The client sends the default quality it shows in the panel; older URLs
        // without the parameter keep using the host's saved value.
        const config = await settings.read()
        const requestedQuality = (params.get('quality') || '').trim()
        const quality = ['standard', 'high', 'lossless', 'hires'].includes(requestedQuality)
          ? requestedQuality
          : config.onlineQuality || 'high'
        const legacyStreamRequest = params.get('legacy') === '1'
        try {
          // 1) A copy written after a full play (Folia's rule) plays before the platform is
          // asked, as long as it was fetched at the quality the option now asks for.
          if (await serveCachedAudio(req, res, provider, id, { quality })) return

          // 2) Miss: resolve the CDN URL and stream it through. Nothing is written here: a
          // song is cached only after /online/played says it was heard to its end.

          let cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          let session = providerStore === undefined ? {} : await providerStore.session(provider)
          if ((provider === 'kugou' || provider === 'kugouLite') && (session.mid === undefined || session.mid === '')) {
            session = omni.createDevice(provider)
            if (providerStore !== undefined) await providerStore.setSession(provider, session)
          }
          // Provider lookups occasionally fail on a transient network hiccup:
          // retry once before surfacing the error.
          let stream = null
          const resolvedKey = streamUrlKey(provider, id, quality)
          if (!legacyStreamRequest) {
            const cachedStream = streamUrlCache.get(resolvedKey)
            if (cachedStream !== undefined && Date.now() - cachedStream.at < STREAM_URL_TTL_MS && cachedStream.stream.url !== '') {
              stream = cachedStream.stream
            }
          }
          if (stream === null) {
            if (legacyStreamRequest) {
              stream = await resolveLegacyStream(provider, id)
            } else {
              for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                  stream = await omni.stream(provider, id, { cookie, session }, quality)
                  break
                } catch (error) {
                  if (attempt === 1) throw error
                  await new Promise((resolveDelay) => setTimeout(resolveDelay, 400))
                }
              }
            }
            if (stream !== null && stream.url !== '') {
              streamUrlCache.set(resolvedKey, { stream, at: Date.now() })
            }
          }
          if (stream === null) stream = { url: '' }
          if (stream.url === '') {
            // No address: a copy of another quality is better than no song (Folia's
            // `playCopyOfAnyLevel`). Only then is the failure reported.
            if (await serveCachedAudio(req, res, provider, id, { anyQuality: true })) return
            // NetEase answers 404 for region-locked / delisted tracks. Keep the
            // real reason visible instead of blaming the user's login state.
            const message =
              provider === 'netease' && Number(stream.code) === 404
                ? '网易云版权限制：该曲目在当前地区暂不可播放'
                : '该曲目暂不可播（可能需要登录或 VIP）'
            return fail(res, 404, 'NO_STREAM', message)
          }
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 15000)
          const upstreamHeaders = {
            'User-Agent': ONLINE_UA,
            Referer: onlineReferer(provider),
          }
          // Forward the browser's Range request so seeking streams from the
          // right offset.
          const rangeHeader = req.headers.range
          const hasRange = typeof rangeHeader === 'string' && rangeHeader !== ''
          // Always forward the browser's Range, including `bytes=0-`.
          // Chromium treats a 200 answer to a Range request as "not seekable"
          // and restarts playback when the user scrubs (Chromium issue 973357);
          // a proxied 206 is what keeps seeking working.
          if (hasRange) upstreamHeaders.Range = rangeHeader
          let upstream
          try {
            upstream = await fetch(stream.url, {
              redirect: 'follow',
              signal: controller.signal,
              headers: upstreamHeaders,
            })
          } catch (error) {
            // The platform gave an address but the request failed; a copy of another level
            // still beats silence, as in Folia's `loadOnlineSongAudioSource`.
            if (await serveCachedAudio(req, res, provider, id, { anyQuality: true })) return
            throw error
          } finally {
            clearTimeout(timer)
          }
          if (upstream.status === 416) {
            res.writeHead(416, { 'content-range': upstream.headers.get('content-range') || '' })
            res.end()
            return
          }
          if (!upstream.ok) {
            streamUrlCache.delete(resolvedKey)
            // KuGou's current /song/url can hand back an old CDN object for a
            // still-existing hash. Folia resolves that case through its legacy
            // mobile play-info endpoint; do the same before degrading quality.
            if ((provider === 'kugou' || provider === 'kugouLite') && upstream.status === 404 && !legacyStreamRequest) {
              let legacy = null
              try {
                legacy = await resolveLegacyStream(provider, id)
              } catch {
                // Fall through to the quality ladder.
              }
              if (legacy !== null && legacy.url !== '') {
                if (upstream.body !== null) await upstream.body.cancel().catch(() => {})
                const retryUrl = new URL(req.url ?? '/', 'http://localhost')
                retryUrl.searchParams.set('legacy', '1')
                return handle(
                  Object.assign(Object.create(req), { url: retryUrl.pathname + retryUrl.search }),
                  res,
                  { ...ctx, url: retryUrl, params: retryUrl.searchParams },
                )
              }
            }
            // Folia falls back down the quality ladder before giving up. A CDN
            // 404 for a resolved level means that level is unavailable to this
            // account, not that the song is unplayable: retry one level lower.
            if ((provider === 'kugou' || provider === 'kugouLite') && upstream.status === 404) {
              const lower = nextLowerOnlineQuality(quality)
              if (lower !== null) {
                if (upstream.body !== null) await upstream.body.cancel().catch(() => {})
                const retryUrl = new URL(req.url ?? '/', 'http://localhost')
                retryUrl.searchParams.set('quality', lower)
                return handle(
                  Object.assign(Object.create(req), { url: retryUrl.pathname + retryUrl.search }),
                  res,
                  { ...ctx, url: retryUrl, params: retryUrl.searchParams },
                )
              }
            }
            // The platform signed this address for one CDN node, and that node refused this
            // client (issue #26: NetEase hands an overseas listener a mainland node → HTTP 403,
            // while the same file is served fine by another node). Asking the platform again
            // mints a fresh signature, so retry once at the same quality (a new node), then once
            // a level lower (Folia's ladder), and only then report.
            const kugouAlreadyDegraded = (provider === 'kugou' || provider === 'kugouLite') && upstream.status === 404
            const refreshed = Math.max(0, Number(params.get('refresh')) || 0)
            const nextQuality = refreshed === 0 ? quality : nextLowerOnlineQuality(quality)
            if (!kugouAlreadyDegraded && retriableCdnStatus(upstream.status) && refreshed < 2 && nextQuality !== null) {
              if (upstream.body !== null) await upstream.body.cancel().catch(() => {})
              const retryUrl = new URL(req.url ?? '/', 'http://localhost')
              retryUrl.searchParams.set('refresh', String(refreshed + 1))
              if (nextQuality !== quality) retryUrl.searchParams.set('quality', nextQuality)
              return handle(
                Object.assign(Object.create(req), { url: retryUrl.pathname + retryUrl.search }),
                res,
                { ...ctx, url: retryUrl, params: retryUrl.searchParams },
              )
            }
            return fail(res, 502, 'UPSTREAM_FAILED', cdnFailureMessage(upstream.status), {
              upstreamStatus: Number(upstream.status) || 0,
            })
          }
          const seekStart = rangeStartOf(rangeHeader)
          // A container can only be sniffed from a request that starts at byte 0: a later
          // range begins mid-file. HEAD carries no body, so it keeps the header-derived type.
          const canSniff = method === 'GET'
            && upstream.body !== null
            && (!hasRange || seekStart === 0)
          const peeked = canSniff ? await peekFirstChunk(upstream.body) : null
          const firstChunk = peeked === null ? null : peeked.first
          const bodyReader = peeked === null ? null : peeked.reader
          const sniffedMime = sniffAudioMime(firstChunk)
          const headers = {
            // Issue #28: the bytes win over a CDN's wrong content-type (NetEase sends FLAC
            // as audio/mpeg at lossless/hires), because the media element trusts the label.
            'content-type': sniffedMime || onlineAudioMime(upstream.headers.get('content-type'), stream.url, quality),
            'cache-control': 'no-store',
            // We always proxy Range (cache hit serves it locally, a miss is
            // forwarded upstream), so advertise it even when the CDN omits the
            // header. Without this the browser refuses to seek and restarts.
            'accept-ranges': 'bytes',
          }
          if (stream.preview === true) headers['x-music-preview'] = '1'
          Object.assign(headers, replayGainHeaders(stream.replayGain))
          const totalHeader = upstream.headers.get('content-length')
          if (hasRange && seekStart === 0 && upstream.status === 200 && /^bytes=0-$/.test(String(rangeHeader || '').trim()) && totalHeader !== null) {
            // A media element's first Range probe is normally `bytes=0-`. If the
            // CDN answers 200, relay it as the valid full 206 it represents so
            // Chromium marks the resource seekable without buffering the file first.
            const total = Number(totalHeader)
            if (Number.isFinite(total) && total > 0) {
              headers['content-length'] = String(total)
              headers['content-range'] = 'bytes 0-' + (total - 1) + '/' + total
              res.writeHead(206, headers)
              if (method === 'HEAD') {
                if (upstream.body !== null) upstream.body.cancel().catch(() => {})
                res.end()
                return
              }
              await writeUpstreamBody(res, upstream, firstChunk, bodyReader)
              if (!res.writableEnded) res.end()
              return
            }
          }
          if (hasRange && seekStart !== null && seekStart > 0 && upstream.status === 200) {
            // Some CDNs answer a Range request with 200. Passing that through makes
            // Chromium restart from zero; slice it into a real 206 instead. The
            // resolved URL is cached, so repeated seeks reuse the same object.
            const bodyTimer = setTimeout(() => controller.abort(), 30000)
            try {
              const body = upstream.body === null ? Buffer.alloc(0) : Buffer.from(await upstream.arrayBuffer())
              const total = body.length
              if (seekStart >= total) {
                res.writeHead(416, { 'content-range': 'bytes */' + total })
                res.end()
                return
              }
              const slice = body.subarray(seekStart)
              headers['content-length'] = String(slice.length)
              headers['content-range'] = 'bytes ' + seekStart + '-' + (total - 1) + '/' + total
              res.writeHead(206, headers)
              if (method === 'HEAD') res.end()
              else res.end(slice)
              return
            } catch (error) {
              if (upstream.body !== null) upstream.body.cancel().catch(() => {})
              return fail(res, 502, 'UPSTREAM_RANGE_FAILED', error instanceof Error ? error.message : '音频范围请求失败')
            } finally {
              clearTimeout(bodyTimer)
            }
          }
          const length = upstream.headers.get('content-length')
          if (length !== null) headers['content-length'] = length
          const contentRange = upstream.headers.get('content-range')
          if (contentRange !== null) headers['content-range'] = contentRange
          res.writeHead(upstream.status === 206 ? 206 : 200, headers)
          if (method === 'HEAD') {
            if (upstream.body !== null) upstream.body.cancel().catch(() => {})
            res.end()
            return
          }
          await writeUpstreamBody(res, upstream, firstChunk, bodyReader, function () { controller.abort() })
          if (!res.writableEnded) res.end()
          // Remember how this stream turned out: /online/played only caches a song whose
          // last stream was the real thing, never a provider-marked preview clip.
          if (cacheWriter !== null) {
            cacheWriter.noteStream(provider, id, { preview: stream.preview === true })
          }
          return
        } catch (error) {
          if (res.headersSent) {
            if (!res.writableEnded) res.end()
            return
          }
          return fail(
            res,
            502,
            'STREAM_FAILED',
            error instanceof Error ? error.message : '在线播放失败',
          )
        }
      }

      if (pathname === '/online/info' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cached = mediaCache === undefined ? null : await mediaCache.lookup(provider, id)
          if (cached === null) {
            return sendJson(res, 200, { ok: true, cached: false })
          }
          const meta = await readTrackMeta(cached.file)
          const info = {
            codec: meta.codec || '',
            sampleRate: meta.sampleRate || 0,
            bitrate: meta.bitrate || 0,
            durationSec: meta.durationSec || 0,
            size: cached.size,
            quality: cached.quality,
          }
          return sendJson(res, 200, { ok: true, cached: true, info })
        } catch (error) {
          return fail(
            res,
            502,
            'INFO_FAILED',
            error instanceof Error ? error.message : '在线音频信息读取失败',
          )
        }
      }

      if (pathname === '/online/lyric' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          // Folia's `resolveOnlineLyrics`: the song's own record wins over anything the
          // platform would answer now — an imported lyric, a matched override, an
          // "instrumental" verdict, then the platform lyric cached by the last play.
          const lyricKey = onlineLyricKey(provider, id)
          const record = await lyricRecords.get(lyricKey)
          let payload = record === null ? null : await lyricRecords.readPayload(lyricKey)
          // A record written before the payload kept word timing can carry matched.wordLevel
          // but only line text. Re-read that same source once, the way Folia repairs an
          // override that has lost its word timeline, instead of degrading to estimated words.
          if (record !== null
            && record.matched !== null
            && record.matched.wordLevel === true
            && payload !== null
            && !payloadHasWords(payload)
            && String(record.matched.id ?? '') !== '') {
            try {
              const restored = await fetchLyricSource(record.matched.source, String(record.matched.id))
              if (restored !== null
                && Array.isArray(restored.lines)
                && restored.lines.some((line) => Array.isArray(line.words) && line.words.length > 0)) {
                await lyricRecords.writePayload(lyricKey, {
                  text: restored.lrc || payload.text,
                  formatHint: restored.raw?.formatHint || '',
                  translation: restored.translation || '',
                  romaji: restored.romaji || '',
                  lines: restored.lines,
                  wordLevel: true,
                  raw: restored.raw ?? null,
                })
                payload = await lyricRecords.readPayload(lyricKey)
              }
            } catch {
              // The current payload is still a usable line-level fallback.
            }
          }
          function lyricAnswer(source, extra) {
            return sendJson(res, 200, Object.assign({
              ok: true,
              lrc: payload === null ? '' : payload.text,
              translation: payload === null ? '' : payload.translation || '',
              romaji: payload === null ? '' : payload.romaji || '',
              lines: payload === null ? null : payload.lines ?? null,
              wordLevel: payload === null ? false : payload.wordLevel === true,
              raw: payload === null ? null : payload.raw ?? null,
              source,
            }, extra))
          }
          if (record !== null && record.pureMusic === true) {
            return sendJson(res, 200, {
              ok: true,
              lrc: '',
              translation: '',
              romaji: '',
              lines: null,
              wordLevel: false,
              raw: null,
              source: 'online',
              pureMusic: true,
              override: true,
            })
          }
          if (record !== null && record.source === 'imported' && payload !== null) {
            return lyricAnswer('imported', {
              // An imported file is parsed from the synthesized local document.
              raw: payload.raw ?? {
                type: 'local',
                lrcContent: payload.text,
                formatHint: payload.formatHint || '',
              },
              state: { source: record.source, importedName: record.imported?.name ?? '' },
            })
          }
          if (record !== null && record.matched !== null && payload !== null) {
            return lyricAnswer(record.matched.source, {
              override: true,
              state: { source: 'online', matched: record.matched, pureMusic: record.pureMusic === true },
            })
          }
          if (record !== null && record.lyric !== null && payload !== null) {
            return lyricAnswer('online', { cached: true })
          }
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          // Same trap as search: Navidrome keeps its server + token in the
          // session, so the lyric lookup needs it or it resolves nowhere.
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const lyric = await omni.lyric(provider, id, { cookie, session })
          // Cache the platform lyric with the song record (Folia's `lyric_<key>`). The
          // optional cross-source upgrade is a separate request, after this is on screen.
          if (lyric.lrc !== '') {
            await lyricRecords.writePayload(lyricKey, {
              text: lyric.lrc,
              formatHint: lyric.formatHint || '',
              translation: lyric.translation || '',
              romaji: lyric.romaji || '',
              lines: lyric.lines ?? null,
              wordLevel: lyric.wordLevel === true,
              raw: lyric.raw ?? null,
            })
            await lyricRecords.patch(lyricKey, { source: 'online', lyric: { v: 1, at: Date.now() } })
          }
          return sendJson(res, 200, {
            ok: true,
            lrc: lyric.lrc,
            translation: lyric.translation,
            romaji: lyric.romaji || '',
            lines: lyric.lines ?? null,
            wordLevel: lyric.wordLevel === true,
            raw: lyric.raw ?? null,
            source: provider,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'LYRIC_FAILED',
            error instanceof Error ? error.message : '在线歌词获取失败',
          )
        }
      }

      // Folia's `autoUseBestLyric`: the platform's own lyric is on screen, line-level,
      // and another source may have the same song word-by-word. Asked after the lyric is
      // shown (never in front of playback), and cached per track so a replay does not
      // search again.
      if (pathname === '/online/best-lyric' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        // Without a title there is nothing to search for, so the answer says nothing about
        // this track: it must not be cached (a miss cached here would hide the real answer
        // for a day once the client had the metadata).
        const matchable = (params.get('title') || '').trim() !== ''
        try {
          const matched = await findMatchedLyric(provider, id, params)
          const match =
            matched === null
              ? null
              : {
                  source: matched.source,
                  id: String(matched.id ?? ''),
                  score: Number(matched.score) || 0,
                  wordLevel: matched.wordLevel === true,
                  isPureMusic: matched.isPureMusic === true,
                  lrc:
                    typeof matched.lrc === 'string' && matched.lrc !== ''
                      ? matched.lrc
                      : matched.lyrics.map((line) => lrcTime(line.t) + String(line.text ?? '')).join('\n'),
                  translation: matched.translation || '',
                  romaji: matched.romaji || '',
                  lines: matched.lyrics,
                  raw: matched.raw ?? null,
                }
          // With `persist`, the upgrade is remembered the way Folia stores
          // `onlineOverrideLyrics`: next play reads it from the song's record, not the network.
          // A match from the song's own platform is not an override — its lyric is cached by
          // /online/lyric already, so only another source is written here.
          const persist = params.get('persist') === '1'
            && matchable
            && match !== null
            && match.source !== provider
            // A line-level answer must not be remembered when word timing was asked for.
            && (params.get('requireWordLevel') !== '1' || match.wordLevel === true)
          if (persist) {
            const lyricKey = onlineLyricKey(provider, id)
            await lyricRecords.writePayload(lyricKey, {
              text: match.lrc,
              formatHint: '',
              translation: match.translation,
              romaji: match.romaji,
              lines: match.lines,
              wordLevel: match.wordLevel,
              raw: match.raw,
            })
            await lyricRecords.patch(lyricKey, {
              source: 'online',
              matched: {
                source: match.source,
                id: match.id,
                wordLevel: match.wordLevel,
                isPureMusic: match.isPureMusic,
                at: Date.now(),
              },
              autoMatched: { at: Date.now(), pure: false },
            })
          }
          return sendJson(res, 200, { ok: true, match, persisted: persist })
        } catch (error) {
          return fail(res, 502, 'BEST_LYRIC_FAILED', error instanceof Error ? error.message : '逐字歌词检索失败')
        }
      }

      // Folia's OnlineLyricsState: "use the platform's lyric", "use the imported one",
      // or "this song is instrumental". One record per song, like the local one.
      if (pathname === '/online/lyric-state' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        const record = await lyricRecords.get(onlineLyricKey(provider, id))
        return sendJson(res, 200, {
          ok: true,
          source: record?.source ?? null,
          imported: record?.imported?.name ?? '',
          pureMusic: record?.pureMusic === true,
        })
      }

      if (pathname === '/online/lyric-choice' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider ?? '').trim()
        const id = String(body?.id ?? '').trim()
        if (!isOnlineSource(provider) || id === '') return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        const lyricKey = onlineLyricKey(provider, id)
        const requested = body?.source === null || body?.source === undefined || body?.source === 'auto'
          ? null
          : String(body.source)
        if (requested !== null && requested !== 'online' && requested !== 'imported') {
          return fail(res, 400, 'BAD_SOURCE', '未知的歌词来源')
        }
        if (requested === 'imported') {
          const payload = await lyricRecords.readPayload(lyricKey)
          if (payload === null) return fail(res, 400, 'NO_IMPORTED', '还没有导入歌词')
        }
        if (body?.pureMusic === true) {
          await lyricRecords.clearPayload?.(lyricKey)
          await lyricRecords.patch(lyricKey, {
            pureMusic: true,
            markedPureMusic: true,
            source: 'online',
            matched: null,
          })
        } else {
          await lyricRecords.patch(lyricKey, {
            source: requested,
            ...(requested === null ? {} : { pureMusic: false, markedPureMusic: false }),
          })
        }
        return sendJson(res, 200, { ok: true, source: requested, pureMusic: body?.pureMusic === true })
      }

      if (pathname === '/online/lyric-import' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider ?? '').trim()
        const id = String(body?.id ?? '').trim()
        if (!isOnlineSource(provider) || id === '') return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        const text = typeof body?.text === 'string' ? body.text : ''
        if (text.trim() === '') return fail(res, 400, 'EMPTY', '歌词为空')
        const lyricKey = onlineLyricKey(provider, id)
        const payload = await lyricRecords.writePayload(lyricKey, {
          text,
          formatHint: typeof body?.formatHint === 'string' ? body.formatHint : '',
        })
        if (payload === null) return fail(res, 400, 'EMPTY', '歌词为空')
        await lyricRecords.patch(lyricKey, {
          source: 'imported',
          imported: { name: typeof body?.name === 'string' ? body.name : '', at: Date.now() },
          pureMusic: false,
          markedPureMusic: false,
        })
        return sendJson(res, 200, { ok: true, source: 'imported' })
      }

      // The platform's own ReplayGain. Folia reads it for Navidrome only; the Chinese
      // platforms carry none, so the balance falls back to its own readings there.
      if (pathname === '/online/replaygain' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (provider !== 'navidrome') {
          // A cached copy keeps the provider's gain; a miss has no platform data.
          const cached = mediaCache === undefined ? null : await mediaCache.lookup(provider, id)
          const cachedGain = cached && cached.replayGain ? cached.replayGain : null
          return sendJson(res, 200, {
            ok: true,
            trackGain: cachedGain ? cachedGain.trackGain ?? null : null,
            albumGain: cachedGain ? cachedGain.albumGain ?? null : null,
            trackPeak: cachedGain ? cachedGain.trackPeak ?? null : null,
            albumPeak: cachedGain ? cachedGain.albumPeak ?? null : null,
          })
        }
        if (id === '') return fail(res, 400, 'BAD_REQUEST', '缺少 id')
        try {
          const session = providerStore === undefined ? {} : await providerStore.session('navidrome')
          // The session keeps the token + salt made at login (see /online/navidrome/login).
          const config = {
            server: session.server,
            username: session.username,
            token: session.token,
            salt: session.salt,
          }
          const gain = await ND.songGain(config, id)
          return sendJson(res, 200, {
            ok: true,
            trackGain: gain.trackGain,
            albumGain: gain.albumGain,
            trackPeak: gain.trackPeak,
            albumPeak: gain.albumPeak,
          })
        } catch (error) {
          return sendJson(res, 200, { ok: true, trackGain: null, albumGain: null })
        }
      }

      if (pathname === '/online/chorus' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const chorus = await omni.chorus(provider, id, { cookie })
          return sendJson(res, 200, { ok: true, chorus })
        } catch (error) {
          return fail(res, 502, 'CHORUS_FAILED', error instanceof Error ? error.message : '副歌信息获取失败')
        }
      }

      if (pathname === '/online/quality' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          let session = providerStore === undefined ? {} : await providerStore.session(provider)
          if (provider === 'kugou' && (session.mid === undefined || session.mid === '')) {
            session = omni.createDevice(provider)
            if (providerStore !== undefined) await providerStore.setSession('kugou', session)
          }
          const config = await settings.read()
          const stream = await omni.stream(provider, id, { cookie, session }, config.onlineQuality || 'high')
          return sendJson(res, 200, { ok: true, quality: stream.quality || '', playable: stream.url !== '' })
        } catch {
          // The badge is cosmetic: never surface a hard error here.
          return sendJson(res, 200, { ok: true, quality: '', playable: false })
        }
      }

      if (pathname === '/online/report-playback' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        const playedSeconds = Math.max(0, Number(body?.playedSeconds) || 0)
        if (playedSeconds < 30) return sendJson(res, 200, { ok: true, reported: false })
        if (omni.capabilities(provider)?.playbackReports !== true) {
          return sendJson(res, 200, { ok: true, reported: false })
        }
        if (!allowPlaybackReport()) return sendJson(res, 200, { ok: true, reported: false })
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await omni.reportPlayback(provider, {
            id: String(body?.id || ''),
            title: String(body?.title || ''),
            artist: String(body?.artist || ''),
          }, {
            playedSeconds,
            totalSeconds: Number(body?.totalSeconds) || 0,
            quality: String(body?.quality || 'high'),
          }, { cookie, session })
          return sendJson(res, 200, { ok: true, reported: true })
        } catch (error) {
          return fail(res, 502, 'PLAYBACK_REPORT_FAILED', error instanceof Error ? error.message : '播放上报失败')
        }
      }

      if (pathname === '/online/check-playable' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const ids = Array.isArray(body?.ids)
          ? body.ids
              .map((value) => String(value))
              .filter((value) => value !== '')
              .slice(0, 60)
          : []
        if (!isOnlineSource(provider) || ids.length === 0) {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / ids')
        }
        const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
        let session = providerStore === undefined ? {} : await providerStore.session(provider)
        if (provider === 'kugou' && (session.mid === undefined || session.mid === '')) {
          session = omni.createDevice(provider)
          if (providerStore !== undefined) await providerStore.setSession('kugou', session)
        }
        const config = await settings.read()
        const quality = config.onlineQuality || 'standard'
        const playable = {}
        // Small concurrency window: fast enough for a history sweep without
        // hammering the provider.
        for (let index = 0; index < ids.length; index += 6) {
          const slice = ids.slice(index, index + 6)
          await Promise.all(
            slice.map(async (id) => {
              try {
                const stream = await omni.stream(provider, id, { cookie, session }, quality)
                playable[id] = stream.url !== ''
              } catch {
                playable[id] = false
              }
            }),
          )
        }
        return sendJson(res, 200, { ok: true, playable })
      }

      if (pathname === '/online/login/start' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!supportsQrLogin(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const mode = String(body?.mode || 'qq')
          const snapshot = await login.start(provider, mode)
          if (snapshot.status === 'error') {
            const failure = loginFailureOf('start', {
              message: snapshot.message,
              code: snapshot.failure === null || snapshot.failure === undefined ? '' : snapshot.failure.code,
              retryAfterMs: snapshot.failure?.retryAfterMs,
            })
            return fail(res, 502, 'LOGIN_START_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
          }
          return sendJson(res, 200, {
            ok: true,
            provider,
            mode,
            key: snapshot.key,
            imageDataUrl: snapshot.imageDataUrl,
            url: snapshot.url,
            expiresAt: snapshot.expiresAt,
          })
        } catch (error) {
          const failure = loginFailureOf('start', error)
          return fail(res, 502, 'LOGIN_START_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
        }
      }


      // Folia-shaped account session: one snapshot for the client controller.
      // The Host owns the QR state machine; the client no longer passes keys
      // around or re-derives phases from a raw status string.
      if (pathname === '/online/login/status' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const key = (params.get('key') || '').trim()
        if (!supportsQrLogin(provider) || key === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / key')
        }
        // A poll belongs to the exact key it was started with. Without this an
        // answer from a replaced attempt would overwrite the current one.
        const current = login.snapshot(provider)
        if (String(current?.key ?? '') !== key) {
          return fail(res, 409, 'LOGIN_STALE', '这次登录已经被新的尝试取代')
        }
        try {
          const snapshot = await login.poll(provider)
          if (snapshot.status === 'error') {
            const failure = loginFailureOf('check', {
              message: snapshot.message,
              code: snapshot.failure === null || snapshot.failure === undefined ? '' : snapshot.failure.code,
              case: snapshot.failure?.case,
              retryAfterMs: snapshot.failure?.retryAfterMs,
              scanned: snapshot.detail === 'scanned',
            })
            return fail(res, 502, 'LOGIN_STATUS_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
          }
          const status = snapshot.status === 'authenticated'
            ? 'success'
            : snapshot.transient === true
              ? (snapshot.detail === 'scanned' ? 'scanned' : 'waiting')
              : snapshot.detail || snapshot.status
          return sendJson(res, 200, { ok: true, status, transient: snapshot.transient === true })
        } catch (error) {
          const failure = loginFailureOf('check', error)
          return fail(res, 502, 'LOGIN_STATUS_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
        }
      }

      if (pathname === '/online/login/session' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!supportsQrLogin(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '该平台没有扫码登录')
        }
        try {
          // Reading the session is a read: it must not poll the platform and
          // change the sign-in state under the caller.
          return sendJson(res, 200, {
            ok: true,
            provider,
            login: login.sessionOf(provider),
            lastLoginCompletion: null,
            setup: null,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'LOGIN_SESSION_FAILED',
            error instanceof Error ? error.message : '登录会话查询失败',
          )
        }
      }

      if (pathname === '/online/login/cancel' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!supportsQrLogin(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '该平台没有扫码登录')
        }
        // The key makes the cancel attempt-scoped: a window that closed after a newer
        // attempt started must not delete the newer one.
        await login.cancel(provider, String(body?.key || ''))
        return sendJson(res, 200, { ok: true })
      }

      // Navidrome/Subsonic has no QR flow: the client posts a server URL plus
      // credentials, we verify with ping, then persist only salt + token.
      if (pathname === '/online/account-sync' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        if (accountReads === undefined) return sendJson(res, 200, { ok: true, account: null })
        try {
          const account = await accountReads.read(provider, 'sync')
          return sendJson(res, 200, { ok: true, account })
        } catch (error) {
          return fail(res, 502, 'ACCOUNT_SYNC_FAILED', error instanceof Error ? error.message : '账号同步失败')
        }
      }

      if (pathname === '/online/account' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        return sendJson(res, 200, {
          ok: true,
          account: accountStore === undefined ? null : await accountStore.get(provider),
        })
      }

      if (pathname === '/online/login/local-service' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        return sendJson(res, 200, { ok: true, localService: await localServiceStatus(provider) })
      }

      if (pathname === '/online/login/local-service/restart' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        await restartLocalService(provider)
        return sendJson(res, 200, { ok: true, localService: await localServiceStatus(provider) })
      }

      if (pathname === '/online/login/self-check' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const checks = [{
          id: 'source',
          ok: isOnlineSource(provider),
          detail: isOnlineSource(provider) ? 'registered' : 'not registered',
        }]
        const local = await localServiceStatus(provider)
        if (local.available === true) {
          checks.push({
            id: 'local-service',
            ok: local.failed !== true,
            detail: local.error || (local.failed === true ? 'failed' : 'running or idle'),
          })
        }
        return sendJson(res, 200, { ok: checks.every((check) => check.ok), checks })
      }

      if (pathname === '/online/login/diagnostics' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const snapshot = login.snapshot(provider)
        const local = await localServiceStatus(provider)
        return sendJson(res, 200, {
          ok: true,
          lines: [
            `provider=${provider}`,
            `registered=${isOnlineSource(provider)}`,
            `phase=${snapshot?.status ?? 'unknown'}`,
            `failure=${snapshot?.failure?.code ?? 'none'}`,
            `local-service=${local.available ? (local.failed ? 'failed' : 'ok') : 'n/a'}`,
          ],
        })
      }

      if (pathname === '/online/navidrome/login' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const server = ND.normalizeServer(body?.server)
        const username = String(body?.username || '').trim()
        const password = String(body?.password || '')
        if (server === '') return fail(res, 400, 'BAD_SERVER', '服务器地址无效')
        if (username === '') return fail(res, 400, 'BAD_USER', '请填写用户名')
        if (password === '') return fail(res, 400, 'BAD_PASSWORD', '请填写密码')

        const { salt, token } = ND.makeToken(password)
        // Opt-in: keeping the password lets the host mint a native JWT, which is
        // the only way to page through the whole library. Without it we store
        // just the salted token and fall back to Subsonic's random sample.
        const storePassword = body?.storePassword === true
        try {
          const info = await ND.ping({ server, username, salt, token })
          if (storePassword) {
            // Prove the password really works before writing it to disk.
            try {
              await ND.nativeSongs({ server, username, password }, { limit: 1 })
            } catch {
              return fail(res, 400, 'NATIVE_LOGIN_FAILED', '原生接口登录失败，请检查密码')
            }
          }
          if (providerStore !== undefined) {
            await providerStore.setLogin('navidrome', {
              server,
              username,
              salt,
              token,
              password: storePassword ? password : '',
              nativeSongs: storePassword,
              nickname: username,
            })
          }
          return sendJson(res, 200, {
            ok: true,
            serverVersion: info.serverVersion,
            type: info.type,
            nativeSongs: storePassword,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'NAVIDROME_LOGIN_FAILED',
            error instanceof Error ? error.message : '连接服务器失败',
          )
        }
      }

      if (pathname === '/online/logout' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        // The bridge clears the stored session and drops any pending QR state.
        await login.logout(provider)
        if (accountReads !== undefined) await accountReads.signOut(provider)
        // The native-API token cache is optional per source; a source without one must
        // not turn a sign-out into a failed request (or an unhandled rejection).
        try {
          omni.forgetTokens(provider)
        } catch {
          // Best effort: the stored session is already gone.
        }
        return sendJson(res, 200, { ok: true })
      }

      // Browseable song list. Only Navidrome serves one; the Chinese platforms are
      // search-driven and answer with an empty list.
      //
      // Two modes: when the user opted into the native API we page the whole
      // library (ordered on the server so pages never overlap); otherwise we
      // serve Subsonic's getRandomSongs sample, which has no offset.
      if (pathname === '/online/discover' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        try {
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const caps = omni.capabilities(provider)
          if (caps.recommendations !== true) return sendJson(res, 200, { ok: true, provider, songs: [], playlists: [] })
          const [songs, playlists] = await Promise.all([
            omni.dailySongs(provider, { cookie, session }).catch(() => []),
            omni.recommendedCollections(provider, { cookie, session }, 30).catch(() => []),
          ])
          return sendJson(res, 200, { ok: true, provider, songs, playlists })
        } catch (error) {
          return fail(res, 502, 'DISCOVER_FAILED', error instanceof Error ? error.message : '推荐获取失败')
        }
      }

      if (pathname === '/online/personal-fm' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        try {
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const songs = await omni.personalFm(provider, { cookie, session })
          return sendJson(res, 200, { ok: true, provider, songs })
        } catch (error) {
          return fail(res, 502, 'FM_FAILED', error instanceof Error ? error.message : '私人 FM 获取失败')
        }
      }

      if (pathname === '/online/cloud' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        try {
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const page = Math.max(1, Number(params.get('page')) || 1)
          const songs = await omni.cloudSongs(provider, { cookie, session }, page)
          const pageSize = provider === 'netease' ? 200 : 100
          return sendJson(res, 200, { ok: true, provider, page, songs, hasMore: songs.length >= pageSize })
        } catch (error) {
          return fail(res, 502, 'CLOUD_FAILED', error instanceof Error ? error.message : '云盘获取失败')
        }
      }

      if (pathname === '/online/songs' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const size = Number(params.get('size')) || 200
          const offset = Math.max(Number(params.get('offset')) || 0, 0)
          if (provider === 'navidrome' && session.nativeSongs === true && session.password) {
            const page = await omni.nativeSongs(provider, { session }, {
              offset,
              limit: size,
              sort: params.get('sort') || '',
              order: params.get('order') || 'asc',
            })
            return sendJson(res, 200, {
              ok: true,
              provider,
              native: true,
              songs: page.songs,
              total: page.total,
              offset: page.offset,
            })
          }
          const songs = await omni.songs(provider, { cookie, session }, size)
          return sendJson(res, 200, { ok: true, provider, native: false, songs, total: songs.length, offset: 0 })
        } catch (error) {
          return fail(res, 502, 'SONGS_FAILED', error instanceof Error ? error.message : '歌曲列表获取失败')
        }
      }

      // Artist and album cards for a self-hosted library. These are lists
      // only: a row opens the shared /online/album view above, so there is no
      // provider-specific album detail path.
      if (pathname === '/online/artists' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const artists = await omni.artists(provider, { cookie, session })
          return sendJson(res, 200, { ok: true, provider, artists })
        } catch (error) {
          return fail(res, 502, 'ARTISTS_FAILED', error instanceof Error ? error.message : '歌手列表获取失败')
        }
      }

      if (pathname === '/online/albums' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const size = Number(params.get('size')) || 200
          const albums = await omni.albums(provider, { cookie, session }, size)
          return sendJson(res, 200, { ok: true, provider, albums })
        } catch (error) {
          return fail(res, 502, 'ALBUMS_FAILED', error instanceof Error ? error.message : '专辑列表获取失败')
        }
      }

      if (pathname === '/online/artist' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const result = await omni.artistAlbums(provider, id, { cookie, session })
          return sendJson(res, 200, { ok: true, provider, artist: result.artist, albums: result.albums })
        } catch (error) {
          return fail(res, 502, 'ARTIST_FAILED', error instanceof Error ? error.message : '歌手专辑获取失败')
        }
      }

      if (pathname === '/online/my-playlists' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const playlists = await omni.myPlaylists(provider, { cookie, session })
          // Folia lists the account's listening ranking among its collections.
          // The Host has no i18n, so the cards carry the Chinese names the rest of
          // this Host surface already speaks.
          if (omni.capabilities(provider)?.listeningRank === true) {
            const profile = await profileState(provider)
            const accountId = String(profile?.accountId || 'self')
            for (const range of ['week', 'all']) {
              try {
                const songs = await omni.listeningRank(provider, range, { cookie, session })
                if (!Array.isArray(songs) || songs.length === 0) continue
                playlists.unshift({
                  id: `listening-rank-${range}-${accountId}`,
                  name: range === 'week' ? '最近一周' : (provider === 'qq' ? '年度排行' : '所有时间'),
                  cover: songs.find((song) => song.coverUrl)?.coverUrl || '',
                  trackCount: songs.length,
                  type: 'listening',
                  listeningRank: range,
                  isOwned: false,
                  creator: profile?.nickname || '',
                })
              } catch {
                // A missing route or an unreadable ranking only omits the card.
              }
            }
          }
          return sendJson(res, 200, { ok: true, provider, playlists })
        } catch (error) {
          return fail(
            res,
            502,
            'PLAYLISTS_FAILED',
            error instanceof Error ? error.message : '歌单获取失败',
          )
        }
      }

      if (pathname === '/online/album' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        // The Chinese platforms may send only a name and let albumSongs fall
        // back to an album-name search, so an empty id stays valid for them.
        // Navidrome addresses albums purely by id and has no such fallback.
        if (provider === 'navidrome' && id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少专辑 id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const result = await omni.albumSongs(provider, id, { cookie, session }, {
            name: params.get('name') || '',
            album: params.get('album') || '',
            artist: params.get('artist') || '',
          })
          return sendJson(res, 200, { ok: true, provider, ...result })
        } catch (error) {
          return fail(
            res,
            502,
            'ALBUM_FAILED',
            error instanceof Error ? error.message : '专辑获取失败',
          )
        }
      }

      if (pathname === '/online/playlist-songs' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          if (id.startsWith('listening-rank-')) {
            const range = id.split('-')[2] === 'all' ? 'all' : 'week'
            const songs = await omni.listeningRank(provider, range, { cookie, session })
            return sendJson(res, 200, {
              ok: true,
              provider,
              name: range === 'week' ? '最近一周' : (provider === 'qq' ? '年度排行' : '所有时间'),
              cover: songs.find((song) => song.coverUrl)?.coverUrl || '',
              trackCount: songs.length,
              songs,
            })
          }
          const limit = params.get('limit')
          const offset = params.get('offset')
          const result = await omni.playlistSongsPage(provider, id, { cookie, session }, {
            limit: limit === null ? 100 : Number(limit),
            offset: offset === null ? 0 : Number(offset),
          })
          return sendJson(res, 200, {
            ok: true,
            provider,
            name: result.name,
            cover: result.cover,
            trackCount: result.trackCount,
            songs: result.songs,
            hasMore: result.hasMore === true,
            nextOffset: result.nextOffset,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'PLAYLIST_SONGS_FAILED',
            error instanceof Error ? error.message : '歌单歌曲获取失败',
          )
        }
      }

      if (pathname === '/online/liked' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const liked = await omni.liked(provider, id, { cookie, session })
          return sendJson(res, 200, { ok: true, liked })
        } catch (error) {
          return fail(res, 502, 'LIKE_STATE_FAILED', error instanceof Error ? error.message : '喜欢状态查询失败')
        }
      }

      if (pathname === '/online/liked-ids' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const ids = await omni.likedIds(provider, { cookie, session })
          return sendJson(res, 200, { ok: true, ids })
        } catch (error) {
          return fail(res, 502, 'LIKE_LIST_FAILED', error instanceof Error ? error.message : '喜欢列表读取失败')
        }
      }

      if (pathname === '/online/like' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const rawSong = body?.song && typeof body.song === 'object' ? body.song : null
        const songId = onlineSongId(rawSong)
        if (!isOnlineSource(provider) || rawSong === null || songId === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / song')
        }
        const song = { ...rawSong, id: songId }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await omni.setLiked(provider, song, body?.on === true, { cookie, session })
          return sendJson(res, 200, { ok: true, liked: body?.on === true })
        } catch (error) {
          return fail(res, 502, 'LIKE_FAILED', error instanceof Error ? error.message : '喜欢操作失败')
        }
      }

      if (pathname === '/online/playlist-add' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const playlistId = String(body?.playlistId || '')
        const rawSong = body?.song && typeof body.song === 'object' ? body.song : null
        const songId = String(rawSong?.id || rawSong?.onlineId || '')
        if (!isOnlineSource(provider) || playlistId === '' || rawSong === null || songId === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / playlistId / song')
        }
        const song = { ...rawSong, id: songId }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await omni.addToPlaylist(provider, song, playlistId, { cookie, session })
          return sendJson(res, 200, { ok: true })
        } catch (error) {
          return fail(res, 502, 'PLAYLIST_ADD_FAILED', error instanceof Error ? error.message : '加入歌单失败')
        }
      }

      if (pathname === '/online/subscription' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const type = (params.get('type') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || (type !== 'album' && type !== 'playlist') || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / type / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const subscribed = await omni.subscriptionStatus(provider, type, id, { cookie })
          return sendJson(res, 200, { ok: true, subscribed })
        } catch (error) {
          return fail(res, 502, 'SUBSCRIPTION_FAILED', error instanceof Error ? error.message : '订阅状态获取失败')
        }
      }

      if (pathname === '/online/subscription' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const type = String(body?.type || '')
        const id = String(body?.id || '')
        const subscribed = body?.subscribed === true
        if (!isOnlineSource(provider) || (type !== 'album' && type !== 'playlist') || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / type / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          await omni.subscribeCollection(provider, type, id, subscribed, { cookie })
          return sendJson(res, 200, { ok: true, subscribed })
        } catch (error) {
          return fail(res, 502, 'SUBSCRIPTION_FAILED', error instanceof Error ? error.message : '订阅操作失败')
        }
      }

      if (pathname === '/online/playlist-remove' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const playlistId = String(body?.playlistId || '')
        const rawSong = body?.song && typeof body.song === 'object' ? body.song : null
        const songId = String(rawSong?.id || rawSong?.onlineId || '')
        if (!isOnlineSource(provider) || playlistId === '' || rawSong === null || songId === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / playlistId / song')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await omni.removeFromPlaylist(provider, { ...rawSong, id: songId }, playlistId, { cookie, session })
          return sendJson(res, 200, { ok: true })
        } catch (error) {
          return fail(res, 502, 'PLAYLIST_REMOVE_FAILED', error instanceof Error ? error.message : '从歌单移除失败')
        }
      }

      // Self-hosted covers cannot go through /online/cover: that route only
      // allows the public provider CDNs, and a Navidrome server is by design a
      // private or user-owned host. This route builds the authenticated
      // getCoverArt URL from the stored session, so the caller supplies only an
      // id and can never point the proxy at an arbitrary host.
      if (pathname === '/online/subsonic-cover' && method === 'GET') {
        const provider = (params.get('provider') || 'navidrome').trim()
        const id = (params.get('id') || '').trim()
        if (provider !== 'navidrome' || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少封面 id')
        }
        const session = providerStore === undefined ? {} : await providerStore.session('navidrome')
        let target = ''
        try {
          target = ND.coverArtUrl(
            {
              server: String(session.server || ''),
              username: String(session.username || ''),
              salt: String(session.salt || ''),
              token: String(session.token || ''),
            },
            id,
          )
        } catch {
          return fail(res, 400, 'BAD_SERVER', '服务器地址无效')
        }
        if (target === '') return fail(res, 404, 'NO_COVER', '没有封面')
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        try {
          const upstream = await fetch(target, { signal: controller.signal, redirect: 'follow' })
          if (!upstream.ok) return fail(res, 502, 'COVER_FAILED', 'HTTP ' + upstream.status)
          const type = upstream.headers.get('content-type') || 'image/jpeg'
          if (!type.startsWith('image/')) return fail(res, 502, 'COVER_FAILED', '不是图片')
          const buffer = Buffer.from(await upstream.arrayBuffer())
          res.writeHead(200, {
            'content-type': type,
            'cache-control': 'private, max-age=86400',
            'content-length': String(buffer.length),
          })
          return res.end(buffer)
        } catch {
          return fail(res, 504, 'COVER_TIMEOUT', '封面获取超时')
        } finally {
          clearTimeout(timer)
        }
      }

      if (pathname === '/online/cover' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        const kind = (params.get('kind') || '').trim()
        // Stable resource identity: playlist/album covers use a kind prefix so a playlist
        // never shares a cache entry with a song or another collection id.
        const cacheId = kind !== '' ? kind + '-' + id : id
        // 1) A cover cached with a played-through song, or a collection cover cached on
        // first fetch (Folia caches covers by resource, not by the remote URL). The caller
        // also sends the remote URL, used when nothing is cached yet.
        if (mediaCache !== undefined && isOnlineSource(provider) && cacheId !== '') {
          const cachedCover = await mediaCache.coverFile(provider, cacheId)
          if (cachedCover !== null) {
            res.writeHead(200, {
              'content-type': cachedCover.mime,
              'cache-control': 'public, max-age=604800',
              'content-length': cachedCover.size,
            })
            createReadStream(cachedCover.file).pipe(res)
            return
          }
        }
        const target = (params.get('url') || '').trim()
        let parsed = null
        try {
          parsed = new URL(target)
        } catch {
          parsed = null
        }
        if (parsed === null || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
          return fail(res, 400, 'BAD_URL', '非法图片地址')
        }
        if (!isAllowedCoverUrl(target)) {
          return fail(res, 400, 'BAD_URL', '封面域名不在允许列表')
        }
        try {
          const upstream = await fetch(parsed.toString(), {
            redirect: 'follow',
            headers: {
              'User-Agent': ONLINE_UA,
              // Each platform's CDN may check its own Referer (Kuwo's artwork, Douyin's).
              Referer: isOnlineSource(provider) ? onlineReferer(provider) : 'https://y.qq.com/',
            },
          })
          if (!upstream.ok) return fail(res, 502, 'COVER_FAILED', 'HTTP ' + upstream.status)
          const contentType = upstream.headers.get('content-type') || 'image/jpeg'
          const headers = {
            'content-type': contentType,
            'cache-control': 'public, max-age=86400',
          }
          const buffer = Buffer.from(await upstream.arrayBuffer())
          if (mediaCache !== undefined && isOnlineSource(provider) && cacheId !== '' && /^image\//i.test(contentType)) {
            const ext = /png/i.test(contentType) ? 'png' : /webp/i.test(contentType) ? 'webp' : /gif/i.test(contentType) ? 'gif' : 'jpg'
            try {
              await mediaCache.writeCover({ provider, id: cacheId, buffer, mime: contentType, ext })
            } catch {
              // A cache write failure must not turn a valid cover into an error.
            }
          }
          headers['content-length'] = buffer.length
          res.writeHead(200, headers)
          return res.end(buffer)
        } catch (error) {
          return fail(
            res,
            502,
            'COVER_FAILED',
            error instanceof Error ? error.message : '封面代理失败',
          )
        }
      }

      if (pathname === '/online/played' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const id = String(body?.id || '')
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        if (cacheWriter === null) return sendJson(res, 200, { ok: true, stored: false, reason: 'unavailable' })
        const requestedQuality = String(body?.quality || '')
        const quality = ['standard', 'high', 'lossless', 'hires'].includes(requestedQuality)
          ? requestedQuality
          : (await settings.read()).onlineQuality || 'high'
        const result = await cacheWriter.storePlayed({
          provider,
          id,
          quality,
          limitGb: body?.limitGb,
          durationSec: body?.durationSec,
          coverUrl: body?.coverUrl,
        })
        return sendJson(res, 200, { ok: true, ...result })
      }

      if (pathname === '/online/cache/distrust' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const id = String(body?.id || '')
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        // The copy failed to decode: bypass it for the rest of this process, like Folia's
        // session-scoped distrust mark. A successful write clears it.
        if (cacheWriter !== null) cacheWriter.markDistrusted(provider, id)
        return sendJson(res, 200, { ok: true })
      }

      if (pathname === '/online/cache-info' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        const cached = mediaCache === undefined ? null : await mediaCache.lookup(provider, id)
        return sendJson(res, 200, {
          ok: true,
          cached: cached !== null,
          quality: cached === null ? '' : cached.quality,
          size: cached === null ? 0 : cached.size,
          replayGain: cached === null ? null : cached.replayGain,
        })
      }

      if (pathname === '/online/cache' && method === 'GET') {
        const stats =
          mediaCache === undefined
            ? { songs: 0, files: 0, bytes: 0, categories: { audio: { files: 0, bytes: 0 }, cover: { files: 0, bytes: 0 } } }
            : await mediaCache.stats()
        return sendJson(res, 200, { ok: true, ...stats })
      }

      if (pathname === '/online/cache' && method === 'POST') {
        let body = null
        try {
          body = await readJson(req)
        } catch {
          body = null
        }
        const category = body?.category === 'audio' || body?.category === 'cover' || body?.category === 'lyrics'
          ? body.category
          : 'all'
        let removed = 0
        if (category === 'lyrics') {
          removed = (await lyricRecords.clear?.()) ?? 0
        } else if (mediaCache !== undefined) {
          removed = await mediaCache.clear(category)
        }
        return sendJson(res, 200, { ok: true, removed, category })
      }

      if (pathname === '/online/providers' && method === 'GET') {
        if (kugouSessions !== undefined) {
          await kugouSessions.refreshIfDue('kugou')
          await kugouSessions.validate('kugouLite')
        }
        const summary = providerStore === undefined ? {} : await providerStore.summary()
        const accounts = accountStore === undefined ? {} : await accountStore.summary()
        // The registry also contains the local library (kind: 'local'). It is not an
        // online provider and must not be sent to the client's source list.
        const onlineSources = omni.summaries().filter((source) => source.kind === 'online')
        const registeredIds = new Set(onlineSources.map((source) => source.id))
        // Every registered platform the store knows about is refreshed; the
        // registry is the platform list, not this loop.
        for (const provider of Object.keys(summary)) {
          if (!registeredIds.has(provider)) continue
          if (summary[provider] && summary[provider].loggedIn === true) {
            const account = accounts[provider]
            if (account?.user) {
              if (account.user.nickname) summary[provider].nickname = account.user.nickname
              if (account.user.avatarUrl) summary[provider].avatarUrl = account.user.avatarUrl
              if (account.user.id) summary[provider].accountId = account.user.id
            }
            // Platform reads can be partial (QQ has only the session cookie, KuGou Lite's
            // verify endpoint often returns no profile). Ask the provider for whatever the
            // stored snapshot still misses instead of leaving the window without an avatar.
            if (!summary[provider].avatarUrl || !summary[provider].nickname) {
              const profile = await profileState(provider)
              if (profile) {
                if (profile.nickname && !summary[provider].nickname) summary[provider].nickname = profile.nickname
                if (profile.avatarUrl && !summary[provider].avatarUrl) summary[provider].avatarUrl = profile.avatarUrl
                if (profile.accountId && !summary[provider].accountId) summary[provider].accountId = profile.accountId
              }
            }
            if (!summary[provider].avatarUrl && provider === 'kugouLite') {
              // Both KuGou sources describe the same account; the full session can still
              // report the avatar when the lite one answers with an empty profile.
              const full = await profileState('kugou')
              if (
                full &&
                full.avatarUrl &&
                (full.accountId === '' ||
                  summary[provider].accountId === '' ||
                  full.accountId === summary[provider].accountId)
              ) {
                summary[provider].avatarUrl = full.avatarUrl
                if (!summary[provider].nickname && full.nickname) summary[provider].nickname = full.nickname
                if (!summary[provider].accountId && full.accountId) summary[provider].accountId = full.accountId
              }
            }
            const vipInfo = await vipInfoState(provider)
            summary[provider].vip = vipInfo.vip
            summary[provider].vipExpiresAt = vipInfo.expiresAt
            // Refresh in the background; this response carries the last snapshot.
            if (accountReads !== undefined) void accountReads.readIfStale(provider)
          }
        }
        // Sources registered outside the legacy provider store (Bodian today) are
        // merged in here so the client can list every platform with its
        // capabilities. A stored row for a platform this runtime cannot register
        // (optional package missing) is not shown.
        const merged = {}
        const registered = new Set()
        for (const source of onlineSources) {
          registered.add(source.id)
          const account = accounts[source.id] ?? null
          const signedIn = summary[source.id]?.loggedIn === true
          const row = summary[source.id] ?? null
          const storedUser =
            account?.user && (account.user.id || account.user.nickname || account.user.avatarUrl)
              ? account.user
              : null
          // The window reads `avatarUrl`/`nickname` from the row; expose the same fields as
          // a user object so every caller sees the profile even without a full account read.
          const rowUser =
            row && (row.accountId || row.nickname || row.avatarUrl)
              ? { id: String(row.accountId || ''), nickname: row.nickname || '', avatarUrl: row.avatarUrl || '' }
              : null
          merged[source.id] = {
            ...(summary[source.id] ?? {}),
            displayName: source.displayName,
            kind: source.kind,
            capabilities: source.capabilities,
            searchKinds: omni.searchKinds(source.id),
            qualityLevels: source.qualityLevels,
            loginMethods: source.loginMethods,
            availability: source.availability,
            // Navidrome is "configured" once a server is stored; the other platforms need
            // no configuration beyond signing in.
            configured: source.id === 'navidrome'
              ? Boolean(summary[source.id] && summary[source.id].server)
              : true,
            requiresAccount: source.requiresAccount,
            status: signedIn ? (account?.freshness === 'error' ? 'error' : 'authenticated') : 'anonymous',
            user: storedUser ?? rowUser,
            collections: Array.isArray(account?.collections) ? account.collections : [],
            freshness: account?.freshness ?? 'stale',
            lastUpdatedAt: Number(account?.savedAt) || 0,
            error: account?.error ?? undefined,
            hydration: 'ready',
          }
        }
        for (const [id, entry] of Object.entries(summary)) {
          if (registered.has(id) && merged[id] === undefined) merged[id] = entry
        }
        return sendJson(res, 200, { ok: true, providers: merged })
      }


    // Nothing matched: answer here instead of letting the caller write twice.
    fail(res, 404, 'NOT_FOUND', '接口不存在')
  }
}

