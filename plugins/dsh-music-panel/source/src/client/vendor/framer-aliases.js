/**
 * The framer-motion surface, as factory-scope names.
 *
 * Loading is guarded: the bundled library needs the real React (contexts, refs,
 * layout effects), and a host or a test harness that provides a thinner surface
 * would throw during evaluation. When that happens `motion` stays null and the
 * player card falls back to its CSS layout instead of breaking the plugin.
 */

var MPFramer = {}
try {
  // A thin React (tests / older harness) has no `version`; framer needs a real host
  // instance, so keep the CSS fallback instead of half-loading the motion tree.
  if (typeof React === 'undefined' || typeof React.version !== 'string') {
    MPFramer = {}
  } else {
    MPFramer = __mpFramerBundle()
  }
} catch (error) {
  MPFramer = {}
  // Visible in devtools: tells us the host React could not host framer, and that
  // the card is running its CSS fallback.
  console.warn('[dsh-music] framer-motion unavailable, using the CSS card:', error && error.message)
}

var motion = MPFramer.motion || null
var AnimatePresence = MPFramer.AnimatePresence || null
var MotionConfig = MPFramer.MotionConfig || null
var LayoutGroup = MPFramer.LayoutGroup || null
var useFramerReducedMotion = MPFramer.useReducedMotion || null
var useMotionValue = MPFramer.useMotionValue || function useMotionValue(initial) {
  var value = initial
  return {
    get: function () { return value },
    set: function (next) { value = next },
    on: function () { return function () {} },
    subscribe: function () { return function () {} },
    destroy: function () {},
  }
}
var useTransformValue = MPFramer.useTransform || null
var useSpringValue = MPFramer.useSpring || null
var animateValue = MPFramer.animate || null
