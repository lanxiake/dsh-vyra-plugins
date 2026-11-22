/**
 * 歌词渲染器注册表 — Folia's player draws lyrics through a registry of renderers
 * (`VisualizerRenderer` per style) instead of styling one DOM list. Starting here:
 * a style is `{ id, labelKey, glyph, render(props) }`, the page asks the registry
 * for one, and today's DOM look becomes the `classic` entry rather than the only
 * way the panel can draw.
 */

var MP_STYLE_REGISTRY = []

/** The picker's pseudo style: it has no renderer, the page resolves it per song. */
var MP_RANDOM_STYLE_ID = 'random'
/** Songs without a usable duration still rotate; this is the slot length. */
var MP_RANDOM_STYLE_FALLBACK_SECONDS = 8

function mpRegisterStyle(entry) {
  if (typeof window !== 'undefined') window.__mpStyleIds = (window.__mpStyleIds || []).concat([entry && entry.id])
  if (!entry || typeof entry.id !== 'string') return
  // DOM styles provide render; canvas/pixi/three styles provide create instead.
  if (typeof entry.render !== 'function' && typeof entry.create !== 'function') return
  for (var index = 0; index < MP_STYLE_REGISTRY.length; index += 1) {
    if (MP_STYLE_REGISTRY[index].id === entry.id) {
      MP_STYLE_REGISTRY[index] = entry
      return
    }
  }
  MP_STYLE_REGISTRY.push(entry)
}

function mpStyleOf(id) {
  for (var index = 0; index < MP_STYLE_REGISTRY.length; index += 1) {
    if (MP_STYLE_REGISTRY[index].id === id) return MP_STYLE_REGISTRY[index]
  }
  return MP_STYLE_REGISTRY.length > 0 ? MP_STYLE_REGISTRY[0] : null
}

function mpStyleCatalog() {
  return MP_STYLE_REGISTRY.map(function (entry) {
    return { id: entry.id, labelKey: entry.labelKey, glyph: entry.glyph || 'note', order: entry.order }
  }).sort(function (a, b) {
    var left = typeof a.order === 'number' ? a.order : 1000
    var right = typeof b.order === 'number' ? b.order : 1000
    return left - right
  })
}

/** The picker shows every real style, then the random entry that drives them. */
function mpStylePickerCatalog() {
  return mpStyleCatalog().concat([
    { id: MP_RANDOM_STYLE_ID, labelKey: 'sheet.foliaStyleRandom', glyph: 'shuffle', order: 999 },
  ])
}

/** What random may choose from: every real style except 静止 (the plain one). */
function mpStyleRandomPool() {
  return mpStyleCatalog()
    .map(function (entry) {
      return entry.id
    })
    .filter(function (id) {
      return id !== 'still' && id !== MP_RANDOM_STYLE_ID
    })
}

/** FNV-1a: a tiny stable string hash for the per-song shuffle. */
function mpRandomStyleHash(text) {
  var value = 2166136261
  var source = String(text || '')
  for (var index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

/**
 * Fisher-Yates with a mulberry32 stream. The seed is the song, so a replay (or a
 * seek) sees the same order; a different song gets a different one.
 */
function mpRandomStyleOrder(ids, seed) {
  var order = ids.slice()
  var state = mpRandomStyleHash(seed) || 1
  function next() {
    state = (state + 0x6d2b79f5) >>> 0
    var value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  for (var index = order.length - 1; index > 0; index -= 1) {
    var swap = Math.floor(next() * (index + 1))
    var held = order[index]
    order[index] = order[swap]
    order[swap] = held
  }
  return order
}

/**
 * The style the page actually paints for a stored preference.
 *
 * A concrete preference passes through. `random` shuffles the non-静止 styles once
 * per song, then gives each one the same slice of the song (`duration / count`),
 * so a 100 s song with 13 choices changes every ~7.7 s. Time is the playback clock,
 * which makes pause, seek and replay behave: the style is a function of position,
 * not of when the page happened to render.
 */
function mpResolveLyricStyle(pref, options) {
  if (pref !== MP_RANDOM_STYLE_ID) return mpStyleFromPrefs(pref).id
  var opts = options !== null && typeof options === 'object' ? options : {}
  var pool = Array.isArray(opts.pool) ? opts.pool.slice() : mpStyleRandomPool()
  pool = pool.filter(function (id) {
    return typeof id === 'string' && id !== '' && id !== 'still' && id !== MP_RANDOM_STYLE_ID
  })
  if (pool.length === 0) return mpStyleFromPrefs('').id
  if (pool.length === 1) return pool[0]
  var order = mpRandomStyleOrder(pool, String(opts.seed || '') + '\u0000' + pool.join('\u0001'))
  var duration = Number(opts.duration)
  var time = Number(opts.time)
  if (!isFinite(time) || time < 0) time = 0
  var interval = isFinite(duration) && duration > 0 ? duration / order.length : MP_RANDOM_STYLE_FALLBACK_SECONDS
  var index = Math.floor(time / interval)
  if (!isFinite(index) || index < 0) index = 0
  // A known duration ends the song at its last slice; a stream keeps cycling.
  index = isFinite(duration) && duration > 0 ? Math.min(index, order.length - 1) : index % order.length
  return order[index]
}

/**
 * Old preferences stored a CSS variant (standard/glow/outline/karaoke/mirror).
 * They now select the `classic` renderer with that variant, so nobody's setting
 * is lost in the move.
 */
function mpStyleFromPrefs(pref) {
  var value = typeof pref === 'string' ? pref : ''
  if (value === MP_RANDOM_STYLE_ID) return { id: MP_RANDOM_STYLE_ID, variant: '' }
  if (mpStyleOf(value) !== null && mpStyleOf(value).id === value) return { id: value, variant: '' }
  return { id: 'monet', variant: '' }
}

/** The style id the page paints for a stored preference (legacy variants → monet). */
function mpStyleIdOf(pref) {
  return mpStyleFromPrefs(pref).id
}
/** The style's display name for a stored preference (legacy variants read 经典). */
function mpStyleLabelOf(pref) {
  var id = mpStyleFromPrefs(pref).id
  if (id === MP_RANDOM_STYLE_ID) return t('sheet.foliaStyleRandom')
  var entry = mpStyleOf(id)
  return entry === null ? '' : t(entry.labelKey)
}


