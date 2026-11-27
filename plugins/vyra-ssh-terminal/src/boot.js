/** Export the bundle for the host module loader. */
import { setReact } from './react.js'

export function installReact(injected) {
  setReact(injected)
}
