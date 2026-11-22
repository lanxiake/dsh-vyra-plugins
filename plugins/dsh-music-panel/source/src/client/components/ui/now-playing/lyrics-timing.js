/** The current timed lyric line, using Folia's last-line-at-or-before lookup. */
function lyricActiveIndex(lines, seconds) {
  if (!Array.isArray(lines) || lines.length === 0) return -1
  if (mpLineStart(lines[0]) < 0) return -1
  var low = 0
  var high = lines.length - 1
  var found = -1
  while (low <= high) {
    var mid = (low + high) >> 1
    if (mpLineStart(lines[mid]) <= seconds + 0.05) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}
