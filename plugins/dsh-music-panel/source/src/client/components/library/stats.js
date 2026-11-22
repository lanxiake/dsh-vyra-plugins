/**
 * stats formatting and folder helpers.
 *
 * Extracted from client.js at the 0.11.1 baseline (3931c14).
 */

function basenameOf(path) {
  var parts = String(path || '').split(/[\\/]/)
  return parts.length > 0 ? parts[parts.length - 1] : String(path || '')
}

/** File name without its extension — the fallback "title" for untagged files. */
function stemOf(path) {
  var name = basenameOf(path)
  var dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** Normalized folder (directory) part of a track path, no trailing slash. */
function folderOf(filePath) {
  var normalized = String(filePath || '').replace(/\\/g, '/')
  var index = normalized.lastIndexOf('/')
  if (index <= 0) return ''
  return normalized.slice(0, index)
}

/** Human label for a folder: path relative to its scan root when possible. */
function folderLabelOf(folder, roots) {
  var normalized = String(folder || '').replace(/\\/g, '/')
  for (var index = 0; index < roots.length; index += 1) {
    var root = String(roots[index] || '')
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
    if (root !== '' && (normalized === root || normalized.indexOf(root + '/') === 0)) {
      var relative = normalized.slice(root.length).replace(/^\/+/, '')
      return relative === '' ? root.split('/').pop() : relative
    }
  }
  var parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

function fmtListenTime(seconds) {
  var total = Math.round(Number(seconds) || 0)
  if (total <= 0) return '—'
  var hours = Math.floor(total / 3600)
  var minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return hours + ' 小时 ' + minutes + ' 分'
  if (minutes > 0) return minutes + ' 分'
  return total + ' 秒'
}

function fmtRecent(ts) {
  var value = Number(ts)
  if (!isFinite(value) || value <= 0) return '—'
  var date = new Date(value)
  var now = new Date()
  var startOfDay = function (day) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  }
  var days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return days + ' 天前'
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

/**
 * Listening ranking: last week / month / all time, sorted by time, plays or
 * recency. Mirrors the NetEase "listening ranking" page, limited to what
 * the local library can know without a server.
 */
