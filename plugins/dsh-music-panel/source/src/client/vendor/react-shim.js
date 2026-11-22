/**
 * The React the bundled vendor code sees.
 *
 * `client.js` is a single CJS factory that receives the host's `require`, so any
 * bundled library must take React from the host instance rather than pulling its
 * own copy (two Reacts would break hooks). The factory sets `globalThis.__MP_REACT__`
 * before this module is evaluated.
 */

const BaseReact = globalThis.__MP_REACT__ || {}
// Some test harnesses hand the factory a deliberately thin React. Bundled vendor code
// only calls `memo`/`forwardRef` at module scope, so fill those two in on a copy rather
// than letting a bundled renderer fail to even load.
const React = typeof BaseReact.memo === 'function' && typeof BaseReact.forwardRef === 'function'
  ? BaseReact
  : Object.assign({}, BaseReact, {
    memo: typeof BaseReact.memo === 'function' ? BaseReact.memo : (component) => component,
    forwardRef: typeof BaseReact.forwardRef === 'function' ? BaseReact.forwardRef : (render) => render,
    createContext: typeof BaseReact.createContext === 'function'
      ? BaseReact.createContext
      : (value) => ({ Provider: (props) => props.children, Consumer: () => null, _currentValue: value }),
    useContext: typeof BaseReact.useContext === 'function' ? BaseReact.useContext : () => null,
    lazy: typeof BaseReact.lazy === 'function' ? BaseReact.lazy : () => () => null,
    Suspense: BaseReact.Suspense || ((props) => (props && props.children) || null),
  })

export default React

export const Children = React.Children
export const createElement = React.createElement
export const cloneElement = React.cloneElement
export const isValidElement = React.isValidElement
export const createContext = React.createContext
export const forwardRef = React.forwardRef
export const memo = React.memo
export const Component = React.Component
export const Fragment = React.Fragment
export const StrictMode = React.StrictMode

export const useState = React.useState
export const useReducer = React.useReducer
export const useEffect = React.useEffect
export const useLayoutEffect = React.useLayoutEffect || React.useEffect
export const useInsertionEffect = React.useInsertionEffect || React.useLayoutEffect || React.useEffect
export const useRef = React.useRef
export const useMemo = React.useMemo
export const useCallback = React.useCallback
export const useContext = React.useContext
export const useId = React.useId || (() => '')
export const useImperativeHandle = React.useImperativeHandle
export const useDebugValue = React.useDebugValue || (() => undefined)
export const useSyncExternalStore = React.useSyncExternalStore || (() => undefined)
export const useTransition = React.useTransition || (() => [false, (run) => run()])
export const useDeferredValue = React.useDeferredValue || ((value) => value)
export const startTransition = React.startTransition || ((run) => run())
export const useOptimistic = React.useOptimistic || ((value) => value)
export const use = React.use
export const createRef = React.createRef
export const Suspense = React.Suspense
export const lazy = React.lazy
export const PureComponent = React.PureComponent
export const version = React.version
