/**
 * three.js, evaluated once and only if a style asks for it. Same guard as pixi: a
 * host or test environment where it cannot run must not take the panel down.
 */
var MP_THREE = (function () {
  try {
    if (typeof __mpThreeBundle !== 'function') return null
    return __mpThreeBundle()
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[dsh-music] three unavailable, falling back to the text renderer:', error && error.message)
    }
    return null
  }
})()
