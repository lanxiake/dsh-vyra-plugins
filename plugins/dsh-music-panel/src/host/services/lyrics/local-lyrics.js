/**
 * Which lyric a local file shows, and what it came from.
 *
 * A port of Folia's `selectLocalSongLyricsSource` + `resolveLocalSongLyrics`
 * (src/utils/lyrics/localSongLyrics.ts) onto this plugin's storage: the record
 * keeps the choice and the matched lyric, the file keeps its own sidecar/embedded
 * lyric.
 *
 * @module dsh-music-panel/local-lyrics
 */

import { readEmbeddedLyrics, readSidecarLyrics } from './lyrics.js'

/**
 * @typedef {'local' | 'embedded' | 'online' | null} ActiveLocalLyricSource
 * @typedef {Awaited<ReturnType<import('./lyrics.js').readSidecarLyrics>>} SidecarLyric
 * @typedef {Awaited<ReturnType<import('./lyrics.js').readEmbeddedLyrics>>} EmbeddedLyric
 */

export const EMPTY_LOCAL_LYRICS = {
  lines: [],
  timed: false,
  source: null,
  file: null,
  raw: '',
  translation: '',
  formatHint: '',
  pureMusic: false,
  matched: null,
  available: { sidecar: false, embedded: false },
}

/** A record store that never remembers anything: routes stay usable without one. */
export const NULL_LYRIC_STATE = {
  async get() {
    return null
  },
  async readPayload() {
    return null
  },
  async writePayload() {
    return null
  },
  async patch() {
    return null
  },
}

/**
 * Folia's rule, in order: the explicit choice, the instrumental mark, the
 * configured priority, then the file's own lyrics, then a stored match.
 *
 * @param {{
 *   state: object | null,
 *   hasSidecar: boolean,
 *   hasEmbedded: boolean,
 *   priority: 'local' | 'online',
 * }} input
 * @returns {ActiveLocalLyricSource}
 */
export function selectLocalLyricSource({ state, hasSidecar, hasEmbedded, priority }) {
  const record = state !== null && typeof state === 'object' ? state : null
  const source = record !== null && typeof record.source === 'string' ? record.source : null
  const hasMatched = record !== null && record.matched !== null && record.matched !== undefined

  if (source !== null) {
    if (source === 'online') return hasMatched ? 'online' : null
    if (source === 'embedded') return hasEmbedded ? 'embedded' : null
    // `local` is the file's sidecar (or an imported lyric kept on the record).
    if (source === 'local' || source === 'imported') {
      return record?.imported !== null && record?.imported !== undefined ? 'local' : hasSidecar ? 'local' : null
    }
    return null
  }

  // Marked instrumental: no lyric at all, whatever the priority says.
  if (record !== null && record.markedPureMusic === true) return 'online'
  if (priority === 'online' && hasMatched) return 'online'
  if (hasSidecar) return 'local'
  if (hasEmbedded) return 'embedded'
  if (hasMatched) return 'online'
  return null
}

function fromSidecar(sidecar) {
  return {
    lines: sidecar.lines,
    timed: sidecar.timed,
    source: 'local',
    file: sidecar.file ?? null,
    raw: sidecar.raw ?? '',
    translation: sidecar.translation ?? '',
    formatHint: sidecar.formatHint ?? '',
    pureMusic: false,
    matched: null,
  }
}

function fromEmbedded(embedded) {
  return {
    lines: embedded.lines,
    timed: embedded.timed,
    source: 'embedded',
    file: null,
    raw: embedded.raw ?? '',
    translation: embedded.translation ?? '',
    formatHint: embedded.formatHint ?? '',
    pureMusic: false,
    matched: null,
  }
}

function fromPayload(payload, source, state) {
  return {
    lines: [],
    timed: true,
    source,
    file: null,
    raw: payload.text,
    translation: payload.translation ?? '',
    formatHint: payload.formatHint ?? '',
    pureMusic: state?.pureMusic === true,
    matched: state?.matched ?? null,
  }
}

/**
 * Whether the automatic online pick should run for this file: Folia's
 * `needsLyricsMatch` (no local lyric, or online priority) minus the marks that
 * mean "do not search for this one".
 *
 * @param {{ state: object | null, hasSidecar: boolean, hasEmbedded: boolean, priority: 'local' | 'online' }} input
 */
export function needsAutoMatch({ state, hasSidecar, hasEmbedded, priority }) {
  const record = state !== null && typeof state === 'object' ? state : null
  if (record === null) return priority === 'online' || (!hasSidecar && !hasEmbedded)
  if (record.markedPureMusic === true || record.noAutoMatch === true) return false
  if (record.matched !== null || record.pureMusic === true) return false
  // An explicit local/embedded choice must not trigger a network search.
  if (record.source !== null && record.source !== 'online') return false
  return record.source === 'online' || priority === 'online' || (!hasSidecar && !hasEmbedded)
}

/**
 * The lyric for one local file, with the source it actually came from.
 *
 * @param {string} file
 * @param {{
 *   lyricState: {
 *     get: (key: string) => Promise<object | null>,
 *     readPayload: (key: string) => Promise<{ text: string, formatHint: string, translation: string } | null>,
 *   },
 *   priority?: 'local' | 'online',
 *   probe?: { sidecar?: SidecarLyric | null, embedded?: EmbeddedLyric | null },
 * }} options `probe` lets a caller that already read the file's own lyrics reuse them
 */
export async function resolveLocalLyrics(file, options) {
  const priority = options?.priority === 'online' ? 'online' : 'local'
  const lyricState = options?.lyricState
  const state = lyricState === undefined ? null : await lyricState.get(file)
  const formatOrder = Array.isArray(options?.formatOrder) ? options.formatOrder : undefined
  const sidecar = options?.probe?.sidecar !== undefined
    ? options.probe.sidecar
    : await readSidecarLyrics(file, { formatOrder })
  const embedded = options?.probe?.embedded !== undefined ? options.probe.embedded : await readEmbeddedLyrics(file)
  const available = { sidecar: sidecar !== null, embedded: embedded !== null }
  const selection = selectLocalLyricSource({
    state,
    hasSidecar: available.sidecar,
    hasEmbedded: available.embedded,
    priority,
  })

  const markedPureMusic = state !== null && state.markedPureMusic === true
  // The instrumental mark is an answer: no lyric is shown even if one was matched before
  // (Folia clears the match when the mark is set; this keeps an older record honest too).
  if (markedPureMusic) {
    return {
      ...EMPTY_LOCAL_LYRICS,
      source: 'online',
      pureMusic: true,
      matched: state?.matched ?? null,
      available,
    }
  }
  if (selection === null) {
    return { ...EMPTY_LOCAL_LYRICS, pureMusic: false, available }
  }
  if (selection === 'local') {
    // An imported lyric lives on the record; it wins over the sidecar while it is there.
    if (state?.imported !== null && state?.imported !== undefined && lyricState !== undefined) {
      const payload = await lyricState.readPayload(file)
      if (payload !== null) return { ...fromPayload(payload, 'local', state), available }
    }
    if (sidecar !== null) {
      return { ...fromSidecar(sidecar), pureMusic: markedPureMusic, available }
    }
    return { ...EMPTY_LOCAL_LYRICS, pureMusic: markedPureMusic, available }
  }
  if (selection === 'embedded') {
    return { ...fromEmbedded(embedded), pureMusic: markedPureMusic, available }
  }
  // Online: the matched payload if it is still there, else the "no lyric" answer.
  if (state?.matched !== null && state?.matched !== undefined && lyricState !== undefined) {
    const payload = await lyricState.readPayload(file)
    if (payload !== null) return { ...fromPayload(payload, 'online', state), available }
  }
  return {
    ...EMPTY_LOCAL_LYRICS,
    source: 'online',
    pureMusic: markedPureMusic || state?.pureMusic === true,
    matched: state?.matched ?? null,
    available,
  }
}

/**
 * What the source switcher needs: which of the file's own lyrics exist, and what
 * the record says.
 *
 * @param {string} file
 * @param {object | null} state
 * @param {string[]} [formatOrder]
 */
export async function describeLocalSources(file, state, formatOrder) {
  const [sidecar, embedded] = await Promise.all([
    readSidecarLyrics(file, { formatOrder }),
    readEmbeddedLyrics(file),
  ])
  return {
    embedded: embedded !== null,
    local: sidecar !== null || (state?.imported !== null && state?.imported !== undefined),
    online: Boolean(state !== null && (state.matched !== null || state.pureMusic === true)),
  }
}
