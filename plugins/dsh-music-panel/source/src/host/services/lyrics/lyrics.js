/**
 * Lyrics for dsh-music-panel.
 *
 * Sources, in order:
 *   1. synced lyric frames embedded in the audio file (ID3 SYLT, FLAC
 *      SYNCEDLYRICS, …) — exact millisecond timeline, what desktop players
 *      like Salt Player read;
 *   2. the file's plain lyrics tag when it carries LRC timestamps;
 *   3. a sidecar `.lrc` with the same base name.
 *
 * Untimed plain lyrics are returned with `timed: false` and never scroll.
 *
 * @module dsh-music-panel/lyrics
 */

import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { parseFile } from 'music-metadata'

const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const META_TAG = /^\[(ar|al|ti|by|offset|re|ve|length)\s*:[^\]]*\]$/i
const CREDIT_TAG = /^(作词|作曲|编曲|制作|监制|出品|发行|录音|混音|母带|和声|吉他|贝斯|鼓|键盘|弦乐|词|曲)\s*[:：]/i
const CREDIT_EN = /^(lyrics?|composed|composer|arranged|arranger|producer|produced|mixed|mastered|written|music|words)\b[^:：]{0,24}[:：]/i

/** Timed credit lines must never be folded as a translation. */
function isCreditText(text) {
  const value = String(text || '').trim()
  return value !== '' && (CREDIT_TAG.test(value) || CREDIT_EN.test(value))
}

/** Two lines within this many seconds are treated as one translated pair. */
const PAIR_WINDOW_SEC = 0.25

/**
 * Sidecar lyric formats, in the order one is picked when a track has several.
 * Folia's own `.fia` export always wins; the rest follow Folia's
 * LOCAL_LYRIC_FILE_FORMATS (lrc, vtt, ttml, qrc, yrc, krc).
 */
const SIDECAR_FORMATS = ['fia', 'lrc', 'vtt', 'ttml', 'qrc', 'yrc', 'krc']

/** Formats whose text is word/line-timed by construction; the client parses them itself. */
const SIDECAR_FORMAT_HINT = { vtt: 'vtt', ttml: 'ttml', qrc: 'qrc', yrc: 'yrc', krc: 'krc' }

/**
 * The format hint for a lyric file the listener picked: the timed formats that
 * cannot be detected from the text itself. An empty string lets the client sniff
 * it (LRC, enhanced LRC, `.fia`).
 *
 * @param {string} name
 */
export function lyricFormatHintForName(name) {
  const ext = String(name ?? '').toLowerCase().split('.').pop() || ''
  return SIDECAR_FORMAT_HINT[ext] ?? ''
}

/** Canonical `[mm:ss.xxx]` LRC stamp (millisecond precision, the parser's own grain). */
function lrcStamp(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(total / 60)
  const rest = total - minutes * 60
  const whole = Math.floor(rest)
  const millis = Math.round((rest - whole) * 1000)
  const carry = millis >= 1000
  return (
    '[' +
    String(carry ? minutes + 1 : minutes).padStart(2, '0') +
    ':' +
    String(carry ? 0 : whole).padStart(2, '0') +
    '.' +
    String(carry ? 0 : millis).padStart(3, '0') +
    ']'
  )
}

/** Synced frames land on exact millisecond stamps; allow a small jitter. */
const SYNC_PAIR_WINDOW_SEC = 0.05

/** ID3 timestamp format 1 is MPEG frames, which cannot be converted here. */
const TIMESTAMP_FORMAT_FRAMES = 1

function secondsOf(match) {
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  const fraction = match[3] === undefined ? 0 : Number(`0.${match[3].padEnd(3, '0')}`)
  return minutes * 60 + seconds + fraction
}

/**
 * Parse LRC text into ordered lines with an optional translation.
 *
 * @param {unknown} raw
 * @returns {Array<{ time: number, text: string, translation: string }>}
 */
export function parseLrc(raw) {
  if (typeof raw !== 'string' || raw === '') return []

  const rows = []
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || META_TAG.test(line)) continue

    TIME_TAG.lastIndex = 0
    const times = []
    let match
    while ((match = TIME_TAG.exec(line)) !== null) times.push(secondsOf(match))
    if (times.length === 0) continue

    const body = line.replace(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g, '').trim()
    for (const time of times) rows.push({ time, text: body })
  }

  // Stable sort by time only: lines sharing a stamp keep their file order.
  rows.sort((left, right) => left.time - right.time)

  // Fold same-timestamp follow-up lines (translation, romanization, …) into
  // the lead line, one per line so multi-language lyrics survive.
  const merged = []
  for (const row of rows) {
    const last = merged[merged.length - 1]
    const credit = isCreditText(row.text)
    const lastCredit = last !== undefined && isCreditText(last.text)
    if (
      !credit &&
      !lastCredit &&
      last !== undefined &&
      row.text !== '' &&
      last.text !== row.text &&
      !last.translation.split('\n').includes(row.text) &&
      row.time - last.time <= PAIR_WINDOW_SEC
    ) {
      last.translation = last.translation === '' ? row.text : `${last.translation}\n${row.text}`
      continue
    }
    merged.push({ time: row.time, text: row.text, translation: '' })
  }
  return merged.filter((row) => row.text !== '' || row.translation !== '')
}

/**
 * Convert synced lyric frames into timed lines.
 *
 * @param {unknown} syncText
 * @param {number | undefined} timeStampFormat
 * @returns {{ lines: Array<{ time: number, text: string, translation: string }>, timed: true, source: 'embedded' } | null}
 */
export function parseSyncText(syncText, timeStampFormat) {
  if (!Array.isArray(syncText) || syncText.length === 0) return null
  if (timeStampFormat === TIMESTAMP_FORMAT_FRAMES) return null

  const entries = syncText
    .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.text === 'string')
    .map((entry) => ({ time: Number(entry.timestamp) / 1000, text: entry.text.trim() }))
    .filter((entry) => entry.text !== '' && Number.isFinite(entry.time))
  if (entries.length === 0) return null

  entries.sort((left, right) => left.time - right.time)

  // Same-frame follow-ups (translation / romanization) fold into the lead line.
  const lines = []
  for (const entry of entries) {
    const last = lines[lines.length - 1]
    const credit = isCreditText(entry.text)
    const lastCredit = last !== undefined && isCreditText(last.text)
    if (
      !credit &&
      !lastCredit &&
      last !== undefined &&
      last.text !== entry.text &&
      !last.translation.split('\n').includes(entry.text) &&
      entry.time - last.time <= SYNC_PAIR_WINDOW_SEC
    ) {
      last.translation = last.translation === '' ? entry.text : `${last.translation}\n${entry.text}`
      continue
    }
    lines.push({ time: entry.time, text: entry.text, translation: '' })
  }

  // The same timeline as LRC for the client's parser (Folia's local-file pipeline): one
  // document for the lead lines and one for the folded translations, both by timestamp.
  const raw = lines.map((line) => lrcStamp(line.time) + line.text).join('\n')
  const translation = lines
    .filter((line) => line.translation !== '')
    .map((line) => line.translation.split('\n').map((part) => lrcStamp(line.time) + part).join('\n'))
    .join('\n')

  return { lines, timed: true, source: 'embedded', raw, translation }
}

/**
 * Turn one lyrics payload (embedded tag or sidecar text) into the wire shape.
 *
 * @param {string} text
 * @param {'embedded' | 'sidecar'} source
 */
export function parseLyricsText(text, source) {
  const parsed = parseLrc(text)
  if (parsed.length > 0) return { lines: parsed, timed: true, source }

  const plain = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  return {
    lines: plain.map((line) => ({ time: -1, text: line, translation: '' })),
    timed: false,
    source,
  }
}

/**
 * Read embedded lyrics from the audio file itself, if any.
 *
 * @param {string} audioFile
 */
export async function readEmbeddedLyrics(audioFile) {
  try {
    const meta = await parseFile(audioFile, { duration: false })
    const common = Array.isArray(meta.common.lyrics) ? meta.common.lyrics : []
    // `common.lyrics` is the normalised view; a file whose tag layout the parser only
    // exposes natively (some ID3 USLT/SYLT and FLAC SYNCEDLYRICS files) still has lyrics.
    const tags = common.length > 0 ? common : nativeLyricTags(meta)
    if (tags.length === 0) return null

    // 1. Synced frames: exact timeline.
    for (const tag of tags) {
      const synced = parseSyncText(tag && tag.syncText, tag && tag.timeStampFormat)
      if (synced !== null) return synced
    }

    // 2. Plain lyrics text that may itself be LRC.
    const text = tags
      .map((tag) => (tag && typeof tag.text === 'string' ? tag.text : ''))
      .filter((chunk) => chunk.trim() !== '')
      .join('\n')
    if (text.trim() === '') return null
    const parsed = parseLyricsText(text, 'embedded')
    // Only a timed tag can go through the client's parser: a plain-text tag parses to
    // zero lines there, so it keeps the Host's own untimed lines instead.
    return parsed.lines.length > 0
      ? { ...parsed, raw: parsed.timed ? text : '', translation: '', formatHint: '' }
      : null
  } catch {
    return null
  }
}

/**
 * Lyric tags from `meta.native`, in the shape `common.lyrics` would have given.
 *
 * @param {{ native?: Record<string, unknown> }} meta
 */
function nativeLyricTags(meta) {
  const out = []
  const native = meta.native !== null && typeof meta.native === 'object' ? meta.native : {}
  for (const list of Object.values(native)) {
    if (!Array.isArray(list)) continue
    for (const tag of list) {
      const id = String(tag?.id ?? '').toLowerCase()
      if (!(id.includes('lyric') || id.includes('uslt') || id.includes('sylt'))) continue
      const value = tag.value
      if (value === null || value === undefined) continue
      if (typeof value === 'string') {
        out.push({ text: value })
      } else if (typeof value === 'object') {
        if (Array.isArray(value.syncText)) {
          out.push({ syncText: value.syncText, timeStampFormat: value.timeStampFormat })
        } else if (typeof value.text === 'string') {
          out.push({ text: value.text })
        }
      }
    }
  }
  return out
}

/**
 * Read the sidecar lyric file next to the audio file, if present.
 *
 * Folia's scan: every format in the listener's order (`localLyricFormatOrder`, with
 * `.fia` always first), and both names a track can carry — `track.lrc` and
 * `track.mp3.lrc`. The translation is `<base>.t.<ext>` and may use a different format
 * from the main lyric (a `.lrc` main with a `.t.vtt` translation is fine).
 *
 * @param {string} audioFile
 * @param {{ formatOrder?: string[] }} [options]
 */
export async function readSidecarLyrics(audioFile, options = {}) {
  const dir = dirname(audioFile)
  const stem = basename(audioFile, extname(audioFile)).toLowerCase()
  // `track.mp3.lrc` is the other name Folia accepts: the audio file name itself, with the
  // lyric extension after it.
  const fullStem = basename(audioFile).toLowerCase()
  const bases = stem === fullStem ? [stem] : [stem, fullStem]
  const formatOrder = lyricFormatOrderOf(options.formatOrder)

  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }
  const names = new Map()
  for (const name of entries) names.set(name.toLowerCase(), name)

  for (const format of formatOrder) {
    for (const base of bases) {
      const hit = names.get(`${base}.${format}`)
      if (hit === undefined) continue

      let text
      try {
        text = await readFile(join(dir, hit), 'utf8')
      } catch {
        continue
      }
      if (text.trim() === '') continue

      const translation = await readTranslation(dir, names, base, format, formatOrder)

      const file = join(dir, hit)
      if (format === 'lrc') {
        const parsed = parseLyricsText(text, 'sidecar')
        // Untimed text is shown as a plain list by the player; `raw` stays empty so the
        // client does not hand it to a timed parser that would return no lines.
        return {
          lines: parsed.lines,
          timed: parsed.timed,
          source: 'sidecar',
          file,
          raw: parsed.timed ? text : '',
          translation: parsed.timed ? translation : '',
          formatHint: '',
        }
      }
      return {
        lines: [],
        timed: true,
        source: 'sidecar',
        file,
        raw: text,
        translation,
        formatHint: SIDECAR_FORMAT_HINT[format] ?? '',
      }
    }
  }
  return null
}

/** Folia's order, with `.fia` pinned first and unknown entries dropped. */
function lyricFormatOrderOf(order) {
  const wanted = Array.isArray(order) ? order.filter((format) => SIDECAR_FORMATS.includes(format)) : []
  const ordered = ['fia', ...wanted.filter((format) => format !== 'fia')]
  for (const format of SIDECAR_FORMATS) {
    if (!ordered.includes(format)) ordered.push(format)
  }
  return ordered
}

/** The translation beside one main lyric: same format first, then the listener's order. */
async function readTranslation(dir, names, base, mainFormat, formatOrder) {
  const formats = [mainFormat, ...formatOrder.filter((format) => format !== mainFormat)]
  for (const format of formats) {
    const name = names.get(`${base}.t.${format}`)
    if (name === undefined) continue
    try {
      const text = await readFile(join(dir, name), 'utf8')
      if (text.trim() !== '') return text
    } catch {
      // Try the next format.
    }
  }
  return ''
}

/**
 * Lyrics for one track, trying the requested sources in order.
 *
 * @param {string} audioFile
 * @param {string[]} [order] subset of ['embedded', 'lrc']
 * @returns {Promise<{ lines: Array<{ time: number, text: string, translation: string }>, timed: boolean, source: 'embedded' | 'sidecar' | null, file: string | null, raw: string, translation: string, formatHint: string }>}
 */
export async function readLyricsFor(audioFile, order) {
  const sequence = Array.isArray(order) && order.length > 0 ? order : ['embedded', 'lrc']

  for (const source of sequence) {
    if (source === 'embedded') {
      const embedded = await readEmbeddedLyrics(audioFile)
      if (embedded !== null) {
        return {
          lines: embedded.lines,
          timed: embedded.timed,
          source: 'embedded',
          file: null,
          raw: embedded.raw ?? '',
          translation: embedded.translation ?? '',
          formatHint: embedded.formatHint ?? '',
        }
      }
    } else if (source === 'lrc') {
      const sidecar = await readSidecarLyrics(audioFile)
      if (sidecar !== null) return sidecar
    }
  }

  return { lines: [], timed: false, source: null, file: null, raw: '', translation: '', formatHint: '' }
}
