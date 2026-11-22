/**
 * 外观引擎 — the part of Folia's look that this plugin can honour today.
 *
 * Folia runs a pixi visualizer with ~20 lyric styles, a background registry and an
 * AI theme generator. This is the small, real subset: the same registry shape (an
 * id + a label key + what it changes), so adding a style later is one entry rather
 * than another `if` in the panel.
 *
 *   MP_LYRIC_STYLES  standard | glow | outline   → classes on the lyric lines
 *   MP_BG_MODES      common | monet | nomand | latent | sora | url | none
 *                    → Folia's shell backgrounds (src/render/styles/folia-backdrop.js)
 *   MP_THEME_SOURCES default | cover | custom    → where the accent colour comes from
 */

var MP_LYRIC_STYLES = [
  { id: 'standard', labelKey: 'sheet.styleStandard' },
  { id: 'glow', labelKey: 'sheet.styleGlow' },
  { id: 'outline', labelKey: 'sheet.styleOutline' },
  { id: 'karaoke', labelKey: 'sheet.styleKaraoke' },
  { id: 'mirror', labelKey: 'sheet.styleMirror' },
]

var MP_BG_MODES = [
  { id: 'common', labelKey: 'sheet.foliaBgCommon' },
  { id: 'monet', labelKey: 'sheet.foliaBgMonet' },
  { id: 'nomand', labelKey: 'sheet.foliaBgNomand' },
  { id: 'latent', labelKey: 'sheet.foliaBgLatent' },
  { id: 'sora', labelKey: 'sheet.foliaBgSora' },
  { id: 'url', labelKey: 'sheet.foliaBgUrl' },
  { id: 'none', labelKey: 'sheet.foliaBgNone' },
]

var MP_THEME_SOURCES = ['default', 'cover', 'custom']

function mpLookHas(list, id) {
  for (var index = 0; index < list.length; index += 1) {
    if (list[index].id === id) return true
  }
  return false
}

function mpLookLabel(list, id) {
  for (var index = 0; index < list.length; index += 1) {
    if (list[index].id === id) return t(list[index].labelKey)
  }
  return list.length > 0 ? t(list[0].labelKey) : ''
}

function mpLookId(list, id) {
  return mpLookHas(list, id) ? id : list[0].id
}

/**
 * The accent the panel paints with. `cover` derives it from the playing cover (the
 * page already measures it), `custom` keeps a stored colour, `default` follows the
 * host's business colour.
 */
function mpAccentCss(accent) {
  if (!accent || typeof accent !== 'object') return ''
  var hue = Number(accent.h)
  var sat = Number(accent.s)
  var light = Number(accent.l)
  if (!isFinite(hue) || !isFinite(sat) || !isFinite(light)) return ''
  return 'hsl(' + Math.round(hue) + ' ' + Math.round(sat) + '% ' + Math.round(light) + '%)'
}

function mpLookAccent(prefs, accent) {
  var source = MP_THEME_SOURCES.indexOf(prefs.themeSource) >= 0 ? prefs.themeSource : 'default'
  if (source === 'cover') {
    var fromCover = mpAccentCss(accent)
    if (fromCover !== '') return fromCover
  }
  if (source === 'custom' && typeof prefs.themeAccent === 'string' && prefs.themeAccent !== '') {
    return prefs.themeAccent
  }
  return 'var(--dsw-alias-state-business-primary,#f2607a)'
}

/** The scene layer: nothing, a vignette, or a film-grain wash. */

