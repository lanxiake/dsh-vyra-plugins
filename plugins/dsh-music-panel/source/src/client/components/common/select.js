/**
 * selection + bulk actions + duplicate detection.
 */

var selectionStore = createStore({ active: false, paths: [] })

function selectedPaths() {
  return selectionStore.get().paths.slice()
}

function selectedPathSet() {
  var set = {}
  selectionStore.get().paths.forEach(function (path) {
    set[path] = true
  })
  return set
}

function setSelectionMode(active) {
  var state = selectionStore.get()
  selectionStore.set({ active: active === true, paths: active === true ? state.paths : [] })
}

function toggleSelected(path) {
  var state = selectionStore.get()
  var list = state.paths.slice()
  var at = list.indexOf(path)
  if (at >= 0) list.splice(at, 1)
  else list.push(path)
  selectionStore.set({ active: list.length > 0 ? state.active : false, paths: list })
}

function clearSelection() {
  selectionStore.set({ active: false, paths: [] })
}

function selectAllPaths(paths) {
  selectionStore.set({ active: true, paths: (paths || []).slice() })
}

var rangePick = { active: false, anchor: '' }

/** Select the whole current list (enters selection mode). */
function selectAllIn(list) {
  selectionStore.set({
    active: true,
    paths: (list || []).map(function (track) {
      return track.path
    }),
  })
}

/** Invert the selection within the current list. */
function invertSelectionIn(list) {
  var selected = selectedPathSet()
  selectionStore.set({
    active: true,
    paths: (list || [])
      .map(function (track) {
        return track.path
      })
      .filter(function (path) {
        return selected[path] !== true
      }),
  })
}

function beginRangePick() {
  rangePick.active = true
  rangePick.anchor = ''
  selectionStore.set({ active: true })
  showToast(t('v2.rangePickHint'))
}

function cancelRangePick() {
  rangePick.active = false
  rangePick.anchor = ''
}

/**
 * Click handler for list rows/cards: replace (or toggle with Ctrl), or handle
 * one range pick when the user chose 区域选择.
 */
function selectTrackIn(list, track, additive) {
  var paths = (list || []).map(function (item) {
    return item.path
  })
  if (rangePick.active) {
    if (rangePick.anchor === '') {
      rangePick.anchor = track.path
      selectionStore.set({ active: true, paths: [track.path] })
      return
    }
    var start = paths.indexOf(rangePick.anchor)
    var end = paths.indexOf(track.path)
    if (start < 0 || end < 0) {
      rangePick.anchor = track.path
      selectionStore.set({ active: true, paths: [track.path] })
      return
    }
    var from = Math.min(start, end)
    var to = Math.max(start, end)
    selectionStore.set({ active: true, paths: paths.slice(from, to + 1) })
    rangePick.active = false
    rangePick.anchor = ''
    return
  }
  var state = selectionStore.get()
  if (additive) {
    if (!state.active) selectionStore.set({ active: true, paths: [track.path] })
    else toggleSelected(track.path)
    return
  }
  if (state.active && state.paths.length === 1 && state.paths[0] === track.path) {
    clearSelection()
    return
  }
  selectionStore.set({ active: true, paths: [track.path] })
}

async function batchEditTags(paths, patch) {
  var done = 0
  var failed = 0
  for (var i = 0; i < paths.length; i += 1) {
    try {
      var body = await getJson(API + 'tags?path=' + encodeURIComponent(paths[i]))
      var tags = Object.assign({}, body.tags || {}, patch)
      await sendJson('PUT', API + 'tags', { path: paths[i], tags: tags })
      done += 1
    } catch (error) {
      failed += 1
    }
  }
  return { done: done, failed: failed }
}

async function removeTracks(paths) {
  var body = await postJson(API + 'remove', { paths: paths })
  await loadLibrary(true)
  clearSelection()
  return body
}

/** Higher bitrate, then higher sample rate, then larger file wins. */
function compareQuality(left, right) {
  var leftBitrate = Number(left.bitrate) || 0
  var rightBitrate = Number(right.bitrate) || 0
  if (leftBitrate !== rightBitrate) return rightBitrate - leftBitrate
  var leftRate = Number(left.sampleRate) || 0
  var rightRate = Number(right.sampleRate) || 0
  if (leftRate !== rightRate) return rightRate - leftRate
  return (Number(right.size) || 0) - (Number(left.size) || 0)
}

/** Same title + artist + rounded duration, at least two entries. */
function duplicateGroupsOf(tracks) {
  var map = {}
  ;(tracks || []).forEach(function (track) {
    var duration = Math.round(Number(track.durationSec) || 0)
    var title = String(track.title || '').trim().toLowerCase()
    var artist = String(track.artist || '').trim().toLowerCase()
    if (title === '' || duration <= 0) return
    var key = title + '\u0000' + artist + '\u0000' + duration
    if (!map[key]) map[key] = []
    map[key].push(track)
  })
  return Object.keys(map)
    .map(function (key) {
      return map[key]
    })
    .filter(function (group) {
      return group.length > 1
    })
}
