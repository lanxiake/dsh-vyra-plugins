/**
 * AMLL TTML DB client, plus the small TTML parser its answers need.
 *
 * Folia reaches the same official API (`https://api.amll.dev`) and parses the
 * TTML itself; the DB keeps lyrics under NetEase / QQ song ids, so it is a lyric
 * source without being a platform.
 *
 * @module dsh-music-panel/amll
 */

const DEFAULT_BASE_URL = 'https://api.amll.dev'
const TIMEOUT_MS = 5000

/** Parse one TTML/SMIL time value into seconds. */
export function parseTtmlTime(value) {
  const text = String(value ?? '').trim()
  if (text === '') return null
  let match = /^(\d+(?:\.\d+)?)ms$/i.exec(text)
  if (match !== null) return Number(match[1]) / 1000
  match = /^(\d+(?:\.\d+)?)s$/i.exec(text)
  if (match !== null) return Number(match[1])
  match = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(text)
  if (match !== null) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  match = /^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(text)
  if (match !== null) return Number(match[1]) * 60 + Number(match[2])
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : null
}

function stripTags(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * Minimal TTML parser: `<p>` lines, `<span>` words.
 *
 * @returns {Array<{ t: number, end: number, text: string, words?: Array<{ t: number, end: number, text: string }> }>|null}
 */
export function parseTtml(text) {
  const source = String(text ?? '')
  if (!/<tt(?:\s|>)/i.test(source)) return null
  const lines = []
  const paragraph = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi
  let match
  while ((match = paragraph.exec(source)) !== null) {
    const attributes = match[1] ?? ''
    const body = match[2] ?? ''
    const beginMatch = /\bbegin\s*=\s*"([^"]*)"/i.exec(attributes)
    const endMatch = /\bend\s*=\s*"([^"]*)"/i.exec(attributes)
    let start = parseTtmlTime(beginMatch?.[1])
    if (start === null) continue

    const words = []
    const span = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi
    let spanMatch
    let plain = ''
    let previousEnd = null
    while ((spanMatch = span.exec(body)) !== null) {
      const spanAttrs = spanMatch[1] ?? ''
      const text = stripTags(spanMatch[2]).trim()
      const spanBegin = parseTtmlTime(/\bbegin\s*=\s*"([^"]*)"/i.exec(spanAttrs)?.[1])
      const spanEnd = parseTtmlTime(/\bend\s*=\s*"([^"]*)"/i.exec(spanAttrs)?.[1])
      plain += text
      if (text === '') continue
      if (spanBegin === null) continue
      const wordStart = previousEnd !== null && spanBegin < previousEnd ? previousEnd : spanBegin
      words.push({ t: wordStart, end: spanEnd ?? wordStart, text })
      previousEnd = spanEnd ?? wordStart
    }

    const lineText = (plain !== '' ? plain : stripTags(body)).trim()
    if (lineText === '') continue
    const end = parseTtmlTime(endMatch?.[1]) ?? (words.length > 0 ? words[words.length - 1].end : start)
    lines.push(words.length > 0 ? { t: start, end, text: lineText, words, wordLevel: true } : { t: start, end, text: lineText })
  }
  if (lines.length === 0) return null
  lines.sort((left, right) => left.t - right.t)
  return lines
}

/** Build the API URL for one platform id. */
export function buildLyricsUrl(platform, musicId, baseUrl) {
  const key = platform === 'qq' ? 'qqMusicId' : 'ncmMusicId'
  const search = new URLSearchParams({ [key]: String(musicId) })
  return `${baseUrl ?? DEFAULT_BASE_URL}/v1/lyrics/get?${search.toString()}`
}

/**
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   baseUrl?: string,
 *   timeoutMs?: number,
 * }} [options]
 */
export function createAmllClient(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS

  return {
    /**
     * @param {'ncm'|'qq'} platform
     * @param {string|number} musicId
     * @returns {Promise<{ lines: Array<object>, text: string, source: 'amll', platform: string, id: string } | null>}
     */
    async fetchLyrics(platform, musicId) {
      const id = String(musicId ?? '').trim()
      if (id === '') return null
      const response = await fetchImpl(buildLyricsUrl(platform, id, baseUrl), {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      })
      if (!response.ok) return null
      const body = await response.json()
      const ttml = body?.data?.lyrics
      const lines = parseTtml(ttml)
      if (lines === null) return null
      // The TTML text goes with the lines: the client parses it with Folia's own parser,
      // which is the only place word timing, credits policy and the split are applied.
      return { lines, text: typeof ttml === 'string' ? ttml : '', source: 'amll', platform, id }
    },
  }
}
