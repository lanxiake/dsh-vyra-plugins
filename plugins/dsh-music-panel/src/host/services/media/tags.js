/**
 * Read and rewrite the editable tag set of one audio file.
 *
 * Supported writers (pure JavaScript, no external binaries):
 *   - FLAC → Vorbis comments via `flac-tagger`
 *   - MP3  → ID3v2 via `node-id3`
 *
 * The rewrite always targets a sibling temp file and only replaces the
 * original after a read-back check, so a failed write cannot truncate or
 * corrupt the audio. Cover art and unedited tags are preserved.
 *
 * @module dsh-music-panel/tags
 */

import { copyFile, rename, unlink } from 'node:fs/promises'
import { extname } from 'node:path'
import NodeID3 from 'node-id3'
import { readFlacTags, writeFlacTags } from 'flac-tagger'

/** Editable fields, in UI order. */
export const TAG_FIELDS = [
  'title',
  'artist',
  'album',
  'year',
  'track',
  'disc',
  'genre',
  'albumArtist',
  'composer',
  'lyricist',
  'comment',
  'lyrics',
]

/** FLAC Vorbis comment key for each editable field. */
export const VORBIS_KEYS = {
  title: 'TITLE',
  artist: 'ARTIST',
  album: 'ALBUM',
  year: 'DATE',
  track: 'TRACKNUMBER',
  disc: 'DISCNUMBER',
  genre: 'GENRE',
  albumArtist: 'ALBUMARTIST',
  composer: 'COMPOSER',
  lyricist: 'LYRICIST',
  comment: 'COMMENT',
  lyrics: 'LYRICS',
}

/** Longest single-value field accepted by the writer. */
export const MAX_FIELD_LENGTH = 20_000
/** Lyrics get their own (larger) cap. */
export const MAX_LYRICS_LENGTH = 500_000
/** Largest cover image accepted from the network. */
const MAX_COVER_BYTES = 8 * 1024 * 1024
const COVER_TIMEOUT_MS = 10_000

function invalidCover(message) {
  return Object.assign(new Error(message), { code: 'INVALID_COVER' })
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true
  if (/^127\./.test(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
  return false
}

async function downloadCover(url) {
  let parsed
  try {
    parsed = new URL(String(url))
  } catch {
    throw invalidCover('封面地址不合法')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalidCover('封面地址必须是 http/https')
  }
  await assertPublicHttpUrl(parsed)
  if (isPrivateHost(parsed.hostname)) throw invalidCover('不允许内网封面地址')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), COVER_TIMEOUT_MS)
  try {
    const res = await fetch(parsed, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'dsh-music-panel/0.3.23' },
    })
    if (!res.ok) throw new Error(`封面下载失败：HTTP ${res.status}`)
    const type = String(res.headers.get('content-type') || '')
    if (!type.startsWith('image/')) throw new Error('封面不是图片')
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0) throw new Error('封面为空')
    if (buffer.length > MAX_COVER_BYTES) throw new Error('封面超过 8MB')
    return { buffer, mime: type.split(';')[0].trim() }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} file
 * @returns {'flac' | 'id3' | null}
 */
export function formatOf(file) {
  const ext = extname(file).toLowerCase()
  if (ext === '.flac') return 'flac'
  if (ext === '.mp3') return 'id3'
  return null
}

function unsupportedError(file) {
  return Object.assign(new Error(`当前格式不支持编辑元数据（仅 FLAC / MP3）：${extname(file) || file}`), {
    code: 'UNSUPPORTED_FORMAT',
  })
}

function textOf(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .join(' / ')
  }
  return ''
}

function pick(tagMap, key) {
  const lower = key.toLowerCase()
  for (const name of Object.keys(tagMap)) {
    if (name.toLowerCase() === lower) return tagMap[name]
  }
  return undefined
}

function drop(tagMap, key) {
  const lower = key.toLowerCase()
  for (const name of Object.keys(tagMap)) {
    if (name.toLowerCase() === lower) delete tagMap[name]
  }
}

/**
 * Coerce an untrusted patch object into the editable field set (strings only).
 *
 * @param {unknown} input
 * @returns {Record<string, string>}
 */
export function normalizeTags(input) {
  const out = {}
  for (const field of TAG_FIELDS) {
    const raw = input !== null && typeof input === 'object' ? input[field] : undefined
    out[field] = typeof raw === 'string' ? raw : ''
  }
  return out
}

/**
 * @param {Record<string, string>} tags
 * @returns {string | null} a human error, or null when acceptable
 */
export function validateTags(tags) {
  for (const field of TAG_FIELDS) {
    const value = tags[field]
    if (typeof value !== 'string') return `字段 ${field} 必须是字符串`
    const limit = field === 'lyrics' ? MAX_LYRICS_LENGTH : MAX_FIELD_LENGTH
    if (value.length > limit) return `字段 ${field} 超长（上限 ${limit} 字符）`
  }
  return null
}

/**
 * @param {string} file absolute path already validated against the roots
 * @returns {Promise<{ format: 'flac' | 'id3', tags: Record<string, string> }>}
 */
export async function readTags(file) {
  const format = formatOf(file)
  if (format === null) throw unsupportedError(file)

  if (format === 'flac') {
    const { tagMap } = await readFlacTags(file)
    const tags = {}
    for (const field of TAG_FIELDS) tags[field] = textOf(pick(tagMap, VORBIS_KEYS[field]))
    return { format, tags }
  }

  const id3 = NodeID3.read(file, { exclude: ['APIC'] })
  if (id3 === null || id3 === undefined || typeof id3 !== 'object') {
    throw new Error('读取 ID3 标签失败')
  }
  const comment = id3.comment && typeof id3.comment === 'object' ? id3.comment.text : id3.comment
  const lyrics =
    id3.unsynchronisedLyrics && typeof id3.unsynchronisedLyrics === 'object'
      ? id3.unsynchronisedLyrics.text
      : ''
  return {
    format,
    tags: {
      title: textOf(id3.title),
      artist: textOf(id3.artist),
      album: textOf(id3.album),
      year: textOf(id3.year),
      track: textOf(id3.trackNumber),
      disc: textOf(id3.partOfSet),
      genre: textOf(id3.genre),
      albumArtist: textOf(id3.performerInfo),
      composer: textOf(id3.composer),
      lyricist: textOf(id3.textWriter),
      comment: textOf(comment),
      lyrics: textOf(lyrics),
    },
  }
}

/**
 * Rewrite the editable tags in place (atomic via temp file + read-back check).
 *
 * @param {string} file absolute path already validated against the roots
 * @param {unknown} input
 * @returns {Promise<{ format: 'flac' | 'id3', tags: Record<string, string> }>}
 */
export async function writeTags(file, input, coverUrl) {
  const format = formatOf(file)
  if (format === null) throw unsupportedError(file)
  const next = normalizeTags(input)
  const invalid = validateTags(next)
  if (invalid !== null) throw Object.assign(new Error(invalid), { code: 'INVALID_TAGS' })

  let cover = null
  if (typeof coverUrl === 'string' && coverUrl.trim() !== '') cover = await downloadCover(coverUrl.trim())

  const temp = `${file}.mu-tags.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp${extname(file)}`
  await copyFile(file, temp)
  try {
    if (format === 'flac') {
      const existing = await readFlacTags(temp)
      const tagMap = { ...existing.tagMap }
      for (const field of TAG_FIELDS) {
        const key = VORBIS_KEYS[field]
        if (next[field] === '') drop(tagMap, key)
        else tagMap[key] = next[field]
      }
      const picture = cover !== null ? { buffer: cover.buffer, mime: cover.mime } : existing.picture
      await writeFlacTags({ tagMap, picture }, temp)
    } else {
      const patch = {
        title: next.title,
        artist: next.artist,
        album: next.album,
        year: next.year,
        trackNumber: next.track,
        partOfSet: next.disc,
        genre: next.genre,
        performerInfo: next.albumArtist,
        composer: next.composer,
        textWriter: next.lyricist,
        comment: { language: 'chi', text: next.comment },
        unsynchronisedLyrics: { language: 'chi', text: next.lyrics },
      }
      if (cover !== null) {
        patch.image = {
          mime: cover.mime,
          type: { id: 3, name: 'front cover' },
          description: '',
          imageBuffer: cover.buffer,
        }
      }
      const result = NodeID3.update(patch, temp)
      if (result !== true) {
        throw new Error(`ID3 写入失败：${result instanceof Error ? result.message : String(result)}`)
      }
    }

    // Read back the temp file before touching the original. This catches a
    // writer that silently dropped a field or mangled the codec.
    const check = await readTags(temp)
    for (const field of TAG_FIELDS) {
      if (check.tags[field] !== next[field]) {
        throw new Error(`标签写入校验失败（${field}）`)
      }
    }
    if (cover !== null) {
      if (format === 'flac') {
        const coverCheck = await readFlacTags(temp)
        if (!coverCheck.picture || coverCheck.picture.buffer.length === 0) {
          throw new Error('封面写入校验失败')
        }
      } else {
        const id3Check = NodeID3.read(temp, { include: ['APIC'] })
        if (!id3Check || !id3Check.image) throw new Error('封面写入校验失败')
      }
    }

    await rename(temp, file)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }

  return readTags(file)
}
