/**
 * Persist the Bodian session across restarts.
 *
 * The upstream client keeps its session in a synchronous `{ get, set, clear }`
 * repository and writes to it whenever a sign-in completes. Our credential store
 * is async, so this adapter keeps a synchronous mirror and writes through in the
 * background; a failed persist must never break a request that already succeeded.
 *
 * @module dsh-music-panel/sources/bodian/sessions
 */

/**
 * @param {{ store?: { get: Function, save: Function, clear: Function } }} [options]
 */
export function createBodianSessions(options = {}) {
  const store = options.store ?? null
  let value = null
  let writing = Promise.resolve()
  let hydrating = null

  function persist(task) {
    if (store === null) return
    writing = writing.then(task, task).catch(() => undefined)
  }

  return {
    get: () => value,

    /** A request that needs the stored session waits for the startup read. */
    whenReady() {
      return hydrating ?? Promise.resolve()
    },

    set(next) {
      value = next
      persist(() => store.save('bodian', next ?? {}))
    },

    clear() {
      value = null
      persist(() => store.clear('bodian'))
    },

    /** Load the stored session once at startup. */
    async hydrate() {
      if (store === null) return null
      hydrating = (async () => {
        try {
          const entry = await store.get('bodian')
          value = entry === null ? null : entry.credentials ?? null
        } catch {
          value = null
        }
        return value
      })()
      return await hydrating
    },

    /** Flush pending writes (used by tests and shutdown). */
    async flush() {
      await writing
    },
  }
}
