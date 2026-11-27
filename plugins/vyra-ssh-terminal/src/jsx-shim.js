/** 把 h 映射到宿主注入的 React 上：JSX 与手写的 h(...) 都从这里出去。 */
import { hostReact } from './react.js'

export const h = (...args) => globalThis.__dshSshTerminalReact.createElement(...args)
export const Fragment = Symbol.for('react.fragment')
