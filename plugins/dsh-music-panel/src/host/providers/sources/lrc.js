/**
 * Minimal LRC parser shared by online sources.
 *
 * The local library has its own lyric handling; online platforms hand back LRC
 * text (sometimes with translation tracks), and the UI wants timed lines.
 *
 * @module dsh-music-panel/sources/lrc
 */

const TAG = /^\[(ti|ar|al|by|offset|length|ver|hash):/i
const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

/**
 * @param {string} text
 * @returns {Array<{ timeMs: number, text: string }>}
 */
export function parseLrc(text) {
  const lines = []
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || TAG.test(line)) continue

    const stamps = []
    STAMP.lastIndex = 0
    let match
    while ((match = STAMP.exec(line)) !== null) {
      const fraction = String(match[3] ?? '0').padEnd(3, '0').slice(0, 3)
      stamps.push(Number(match[1]) * 60_000 + Number(match[2]) * 1000 + Number(fraction))
    }
    if (stamps.length === 0) continue

    const body = line.replace(STAMP, '').trim()
    for (const timeMs of stamps) lines.push({ timeMs, text: body })
  }
  lines.sort((left, right) => left.timeMs - right.timeMs)
  return lines
}

/**
 * Fold a translation track into the main one by exact timestamp.
 * Unmatched translations are dropped rather than guessed onto a neighbour.
 *
 * @param {Array<{ timeMs: number, text: string }>} main
 * @param {Array<{ timeMs: number, text: string }>} translation
 */
export function mergeTranslation(main, translation) {
  const byTime = new Map()
  for (const entry of translation) {
    if (entry.text !== '' && !byTime.has(entry.timeMs)) byTime.set(entry.timeMs, entry.text)
  }
  return main.map((entry) => {
    const text = byTime.get(entry.timeMs)
    return text === undefined ? entry : { ...entry, translation: text }
  })
}
