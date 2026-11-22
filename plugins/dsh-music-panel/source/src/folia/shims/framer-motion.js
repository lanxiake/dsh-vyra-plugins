/**
 * `framer-motion` for the ported Folia subtree.
 *
 * The plugin already bundles framer-motion once (`MPFramer`, see
 * src/vendor/10-framer-aliases.js) for the player card. A second copy would mean a
 * second React binding and its own motion context, so the ported components use the
 * instance that is already running in the client factory.
 *
 * `MotionValue` is only used as a type in Folia's code; the class below exists so a
 * value import of it cannot fail.
 */

import React from 'react'

const framer = typeof MPFramer !== 'undefined' && MPFramer !== null ? MPFramer : {}

// A host without the bundled framer (or a thin test React) must still be able to render
// the tree: plain DOM elements ignore the motion-only style keys, so the picture is
// static instead of crashing the player.
const motionFallback = new Proxy({}, {
  get: (_target, tag) => function MotionFallback(props) {
    return React.createElement(tag, props)
  },
})

export const motion = framer.motion || motionFallback
export const AnimatePresence = framer.AnimatePresence || ((props) => (props && props.children) || null)
export const MotionConfig = framer.MotionConfig || ((props) => (props && props.children) || null)
export const LayoutGroup = framer.LayoutGroup || ((props) => (props && props.children) || null)
export const useMotionValue = framer.useMotionValue || function useMotionValue(initial) {
  let value = initial
  return {
    get: () => value,
    set: (next) => { value = next },
    on: () => () => {},
    subscribe: () => () => {},
    destroy: () => {},
  }
}
export const useSpring = framer.useSpring || ((value) => value)
export const useTransform = framer.useTransform || ((value, map) => ({
  get: () => (typeof map === 'function' ? map(value && typeof value.get === 'function' ? value.get() : value) : 0),
  set: () => {},
  on: () => () => {},
  subscribe: () => () => {},
  destroy: () => {},
}))
export const useMotionValueEvent = framer.useMotionValueEvent || function useMotionValueEvent(value, event, callback) {
  React.useEffect(() => {
    if (!value || typeof value.on !== 'function') return undefined
    const unsubscribe = value.on(event, callback)
    // Folia components often initialize their state from the first change only; give
    // them the current value once so a paused/static clock still paints the right frame.
    if (event === 'change' && typeof value.get === 'function') callback(value.get())
    return typeof unsubscribe === 'function' ? unsubscribe : undefined
  }, [value, event, callback])
}
export const useDragControls = framer.useDragControls || (() => ({ start: () => {}, subscribe: () => () => {} }))
export const motionValue = framer.motionValue || ((initial) => {
  let value = initial
  return {
    get: () => value,
    set: (next) => { value = next },
    on: () => () => {},
    subscribe: () => () => {},
    destroy: () => {},
  }
})
export const useReducedMotion = framer.useReducedMotion || (() => false)
export const animate = framer.animate || (() => ({ stop: () => {} }))
export const MotionValue = function MotionValue() {}
