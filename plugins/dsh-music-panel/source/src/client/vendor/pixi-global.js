/**
 * pixi, evaluated once and only if a style asks for it.
 *
 * Like the framer bundle, the whole library sits in a function: a host or a test
 * environment where it cannot run must not take the panel down. `MP_PIXI` is null
 * then, and the stage falls back to the `classic` text renderer.
 */

var MP_PIXI = (function () {
  try {
    if (typeof __mpPixiBundle !== 'function') return null
    return __mpPixiBundle()
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[dsh-music] pixi unavailable, falling back to the text renderer:', error && error.message)
    }
    return null
  }
})()
