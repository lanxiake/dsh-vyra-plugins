/**
 * The writer behind Folia's "played the whole song" cache rule.
 *
 * The client only reports a track after it reached its end. This service then fetches the
 * audio itself and decides whether what came back may stand in for the song: a preview clip,
 * an error page, a file shorter than half the song is never stored, and a copy already on
 * disk is only written over by a file proven to be (almost) the whole song. A successful write
 * also takes the cover, prunes the store, and clears the "this copy failed to play" mark.
 *
 * Everything here mirrors Folia's `playedTrackCache.ts` / `wholeSongCheck.ts` /
 * `mediaCacheGuard.ts`; the thresholds are theirs.
 *
 * @module dsh-music-panel/cache-writer
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MIN_CACHEABLE_AUDIO_BYTES } from '../../stores/media-cache.js'
import { readTrackMeta } from './meta.js'

/** Below half the stated length a file is a preview clip, not the song. */
const NOT_THE_SONG_SHARE = 0.5
/** At or above this share a file may write over a copy already on disk. */
const WHOLE_SONG_SHARE = 0.9
const DOWNLOAD_TIMEOUT_MS = 30_000
const COVER_TIMEOUT_MS = 10_000
const MAX_COVER_BYTES = 8 * 1024 * 1024
/** An error page, not audio. Folia uses the same blacklist so that odd CDNs still pass. */
const NON_AUDIO_CONTENT_TYPE = /^(text\/|application\/(json|xml|xhtml))|html/i

function keyOf(provider, id) {
  return String(provider) + ':' + String(id)
}

function limitBytesOf(limitGb) {
  const gigabytes = Number(limitGb)
  return Number.isFinite(gigabytes) && gigabytes > 0 ? Math.round(gigabytes * 1024 * 1024 * 1024) : 0
}

/**
 * @param {{
 *   mediaCache: object,
 *   omni: object,
 *   providerStore?: object,
 *   isAllowedCoverUrl: (url: string) => boolean,
 *   userAgent: string,
 *   refererFor: (provider: string) => string,
 * }} deps
 */
export function createCacheWriter(deps) {
  const { mediaCache, omni, providerStore, isAllowedCoverUrl, userAgent, refererFor } = deps
  /** Songs whose last stream was a provider-marked preview clip. */
  const previewed = new Set()
  /** Songs whose cached copy failed to play in this session (Folia's distrust mark). */
  const distrusted = new Set()

  function noteStream(provider, id, info = {}) {
    const key = keyOf(provider, id)
    if (info.preview === true) previewed.add(key)
    else previewed.delete(key)
  }

  function markDistrusted(provider, id) {
    distrusted.add(keyOf(provider, id))
  }

  function isDistrusted(provider, id) {
    return distrusted.has(keyOf(provider, id))
  }

  function clearDistrusted(provider, id) {
    distrusted.delete(keyOf(provider, id))
  }

  async function readPlayLength(buffer, mime) {
    let dir = null
    try {
      dir = await mkdtemp(join(tmpdir(), 'dsh-music-probe-'))
      const ext = String(mime || '').includes('flac') ? 'flac' : String(mime || '').includes('mp4') || String(mime || '').includes('m4a') ? 'm4a' : 'mp3'
      const file = join(dir, 'probe.' + ext)
      await writeFile(file, buffer)
      const meta = await readTrackMeta(file)
      return meta.durationSec
    } catch {
      return 0
    } finally {
      if (dir !== null) await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  async function resolveStream(provider, id, quality) {
    let cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
    let session = providerStore === undefined ? {} : await providerStore.session(provider)
    if ((provider === 'kugou' || provider === 'kugouLite') && (session.mid === undefined || session.mid === '')) {
      session = omni.createDevice(provider)
      if (providerStore !== undefined) await providerStore.setSession(provider, session)
    }
    let stream = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        stream = await omni.stream(provider, id, { cookie, session }, quality)
        break
      } catch (error) {
        if (attempt === 1) throw error
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
    }
    return stream
  }

  async function storeCover(provider, id, coverUrl) {
    if (typeof coverUrl !== 'string' || coverUrl === '') return false
    if (!isAllowedCoverUrl(coverUrl)) return false
    if (await mediaCache.hasCover(provider, id)) return false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), COVER_TIMEOUT_MS)
    try {
      const response = await fetch(coverUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': userAgent, Referer: refererFor(provider) },
      })
      if (!response.ok) return false
      const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (!mime.startsWith('image/')) return false
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length < 1024 || buffer.length > MAX_COVER_BYTES) return false
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
      const written = await mediaCache.writeCover({ provider, id, mime, ext, buffer })
      return written !== null
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Cache one song after it was played to its end.
   * @returns {Promise<{ stored: boolean, reason?: string, quality?: string, cover?: boolean }>}
   */
  async function storePlayed(input) {
    const provider = String(input?.provider || '').trim()
    const id = String(input?.id || '').trim()
    const quality = String(input?.quality || '')
    if (provider === '' || id === '') return { stored: false, reason: 'bad-request' }
    if (previewed.has(keyOf(provider, id))) {
      previewed.delete(keyOf(provider, id))
      return { stored: false, reason: 'preview' }
    }
    const existing = await mediaCache.lookup(provider, id)
    if (existing !== null && existing.quality === quality) {
      await mediaCache.touch(provider, id)
      return { stored: false, reason: 'cached', quality }
    }
    let stream = null
    try {
      stream = await resolveStream(provider, id, quality)
    } catch {
      return { stored: false, reason: 'no-stream' }
    }
    if (!stream || typeof stream.url !== 'string' || stream.url === '') {
      return { stored: false, reason: 'no-stream' }
    }
    if (stream.preview === true) return { stored: false, reason: 'preview' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
    try {
      const response = await fetch(stream.url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': userAgent, Referer: refererFor(provider) },
      })
      if (!response.ok) return { stored: false, reason: 'http-' + response.status }
      const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (NON_AUDIO_CONTENT_TYPE.test(mime)) return { stored: false, reason: 'not-audio' }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length < MIN_CACHEABLE_AUDIO_BYTES) return { stored: false, reason: 'too-small' }
      const measured = await readPlayLength(buffer, mime)
      const stated = Number(input?.durationSec) > 0 ? Number(input.durationSec) : 0
      // Folia's whole-song rule: under half the song is never the song; a copy on disk is
      // only replaced by a file proven to be (almost) all of it.
      if (stated > 0 && measured > 0 && measured < stated * NOT_THE_SONG_SHARE) {
        if (existing !== null) await mediaCache.remove(provider, id)
        return { stored: false, reason: 'clip' }
      }
      if (existing !== null) {
        if (!(stated > 0 && measured > 0 && measured >= stated * WHOLE_SONG_SHARE)) {
          return { stored: false, reason: 'not-whole' }
        }
      }
      const written = await mediaCache.store({
        provider,
        id,
        quality,
        replayGain: stream.replayGain || null,
        mime: mime || 'audio/mpeg',
        buffer,
        durationSec: measured > 0 ? measured : stated,
      })
      if (written === null) return { stored: false, reason: 'store-failed' }
      clearDistrusted(provider, id)
      await mediaCache.prune(limitBytesOf(input?.limitGb))
      const cover = await storeCover(provider, id, input?.coverUrl)
      return { stored: true, quality, cover }
    } catch (error) {
      return { stored: false, reason: error?.name === 'AbortError' ? 'timeout' : 'download-failed' }
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    noteStream,
    markDistrusted,
    isDistrusted,
    clearDistrusted,
    storePlayed,
    storeCover,
  }
}
