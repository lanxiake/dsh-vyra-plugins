/**
 * in-view search: match a track against what the user typed in the header.
 *
 * Kept pure and separate from the store so the matching rules (case, spacing,
 * which fields) are testable without a browser.
 */

function contentFilterText(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .toLowerCase()
}

/** Case-insensitive substring over title, artist and album. */
function matchesContentFilter(track, query) {
  if (!track) return false
  var needle = contentFilterText(query)
  if (needle === '') return true
  var haystack = [track.title, track.artist, track.album]
    .map(function (value) {
      return contentFilterText(value)
    })
    .join('\n')
  return haystack.indexOf(needle) >= 0
}

/** Returns the original array when there is no query, so identity is stable. */
function filterTracksByQuery(tracks, query) {
  if (!Array.isArray(tracks)) return []
  if (contentFilterText(query) === '') return tracks
  return tracks.filter(function (track) {
    return matchesContentFilter(track, query)
  })
}
