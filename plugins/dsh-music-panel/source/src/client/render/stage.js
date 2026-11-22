/**
 * 歌词舞台 — the player asks this for a renderer instead of drawing lines itself,
 * so a new lyric style is a registry entry (see render/registry.js). Fallback is the
 * `classic` text renderer, which is what the panel drew before the refactor.
 */

function LyricStage(props) {
  var picked = mpStyleFromPrefs(props.stylePref)
  // Pages resolve `random` before they render, so the class on the stage matches
  // what is painted. Resolve here too for any caller that passes the raw preference.
  if (picked.id === MP_RANDOM_STYLE_ID) {
    picked = mpStyleFromPrefs(
      mpResolveLyricStyle(MP_RANDOM_STYLE_ID, {
        seed: props.seed,
        time: props.now,
        duration: props.duration,
      }),
    )
  }
  var entry = mpStyleOf(picked.id)
  if (entry === null) return null
  // Canvas styles draw themselves; everything else returns DOM.
  if (entry.kind === 'three') {
    if (MP_THREE === null) {
      var classicThree = mpStyleOf('monet')
      return classicThree === null ? null : classicThree.render(Object.assign({}, props, { variant: 'standard' }))
    }
    return h(ThreeLyricStage, {
      styleId: entry.id,
      lines: props.lines,
      active: props.active,
      now: props.now,
      accent: props.accent,
    })
  }
  if (entry.kind === 'pixi') {
    // A host that could not evaluate pixi keeps the text renderer rather than
    // an empty stage.
    if (MP_PIXI === null) {
      var classic = mpStyleOf('monet')
      return classic === null ? null : classic.render(Object.assign({}, props, { variant: 'standard' }))
    }
    return h(PixiLyricStage, {
      styleId: entry.id,
      lines: props.lines,
      active: props.active,
      now: props.now,
      accent: props.accent,
    })
  }
  if (entry.kind === 'canvas') {
    return h(CanvasLyricStage, {
      styleId: entry.id,
      lines: props.lines,
      active: props.active,
      now: props.now,
      accent: props.accent,
    })
  }
  return entry.render(
    Object.assign({}, props, {
      variant: picked.variant,
      seed: typeof props.seed === 'string' ? props.seed : '',
      styleId: picked.id,
      // What a renderer may draw with: the measured accent and the active theme.
      accent: typeof props.accent === 'string' ? props.accent : '',
    }),
  )
}



