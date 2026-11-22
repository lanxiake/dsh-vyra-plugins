/**
 * store: the smallest possible subscription store used by every view.
 *
 * No React context: views read a module-level store through `useStore`, which
 * keeps the panel a single tree and avoids provider plumbing.
 */

function createStore(initial) {
  var state = initial
  var listeners = []
  return {
    get: function () {
      return state
    },
    set: function (patch) {
      var next = typeof patch === 'function' ? patch(state) : Object.assign({}, state, patch)
      if (next === state) return state
      state = next
      listeners.slice().forEach(function (fn) {
        try {
          fn(state)
        } catch (error) {
          // A broken listener must not stop the others.
        }
      })
      return state
    },
    subscribe: function (fn) {
      listeners.push(fn)
      return function () {
        var at = listeners.indexOf(fn)
        if (at >= 0) listeners.splice(at, 1)
      }
    },
  }
}

// Prefer React's external-store hook: it reads the snapshot during render and
// re-checks it after commit, so an update that lands between the render and the
// effect can no longer be missed (the panel used to show stale EQ state until
// something else re-rendered it). The hook set is fixed at load time, so the
// hook order stays stable across renders either way.
var useStore =
  typeof useSyncExternalStore === 'function'
    ? function (store) {
        return useSyncExternalStore(store.subscribe, store.get, store.get)
      }
    : function (store) {
        var pair = useState(store.get())
        var state = pair[0]
        var setState = pair[1]
        useEffect(
          function () {
            setState(store.get())
            return store.subscribe(setState)
          },
          [store],
        )
        return state
      }

/** In-view search: the query typed into the content header, filters that view. */
var contentFilterStore = createStore({ query: '' })

function useContentFilter() {
  return useStore(contentFilterStore)
}

function setContentFilter(query) {
  var value = typeof query === 'string' ? query : ''
  if (contentFilterStore.get().query === value) return
  contentFilterStore.set({ query: value })
}

function clearContentFilter() {
  setContentFilter('')
}
