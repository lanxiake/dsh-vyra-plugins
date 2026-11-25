import { parse as parseRangeHeader } from 'range-parser'

/** HTTP Range parsing for one media file. Pure and unit-tested. */

/**
 * @typedef {{ kind: 'none' }} NoRange
 * @typedef {{ kind: 'partial', start: number, end: number }} PartialRange
 * @typedef {{ kind: 'invalid' }} InvalidRange
 * @typedef {NoRange | PartialRange | InvalidRange} RangePlan
 */

/**
 * Parse a single-range `Range` header with the community `range-parser`
 * package, then keep only the one-range subset this route serves.
 *
 * Multiple ranges and malformed values return `none`: serving the complete
 * file is always a valid response. A syntactically valid range outside the
 * file returns `invalid` so the caller can answer 416.
 * @param {string | null} header - raw `Range` header.
 * @param {number} size - complete file size in bytes.
 * @returns {RangePlan} what the response should do.
 */
export function parseRange(header, size) {
  if (typeof header !== 'string' || header === '' || !Number.isFinite(size) || size <= 0) {
    return { kind: 'none' }
  }
  const parsed = parseRangeHeader(size, header, { combine: true })
  if (parsed.code === 2) return { kind: 'invalid' }
  if (parsed.code !== 0 || parsed.ranges.length !== 1) {
    // A reversed window is well-formed but cannot be satisfied; everything
    // else malformed falls back to the complete response.
    const reversed = /^\s*bytes\s*=\s*(\d+)\s*-\s*(\d+)\s*$/i.exec(header)
    if (reversed !== null && Number(reversed[1]) > Number(reversed[2])) return { kind: 'invalid' }
    return { kind: 'none' }
  }
  const [window] = parsed.ranges
  return { kind: 'partial', start: window.start, end: window.end }
}

/**
 * Quote a filesystem version for `ETag`/`If-Range` comparison.
 * @param {unknown} version - opaque filesystem version.
 * @returns {string} a quoted entity tag.
 */
export function entityTagOf(version) {
  return `"${String(version ?? '').replaceAll('"', '')}"`
}
