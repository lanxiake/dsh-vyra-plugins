/**
 * `react/jsx-runtime` for the bundled vendor code.
 *
 * The host exposes only `react` through the factory's `require`, so the automatic
 * JSX runtime is rebuilt on top of `React.createElement`. Props that carry
 * `children` are split out because createElement takes them as arguments.
 */

const React = globalThis.__MP_REACT__ || {}
const createElement = React.createElement

export const Fragment = React.Fragment

function build(type, props, key) {
  const attributes = {}
  let children
  for (const name of Object.keys(props || {})) {
    if (name === 'children') children = props[name]
    else if (name === 'key') continue
    else attributes[name] = props[name]
  }
  if (key !== undefined) attributes.key = key
  if (Array.isArray(children)) {
    return createElement.apply(null, [type, attributes].concat(children))
  }
  return children === undefined ? createElement(type, attributes) : createElement(type, attributes, children)
}

export function jsx(type, props, key) {
  return build(type, props, key)
}

export const jsxs = jsx
export const jsxDEV = jsx
