/**
 * Qishui session repository.
 *
 * `qishui-music-api` wants a synchronous `{ deviceId, revision, get, set, clear }`
 * store. The Host's credential store is async, so this is a synchronous mirror
 * that writes through in the background, exactly like the Bodian adapter.
 *
 * @module dsh-music-panel/sources/qishui/sessions
 */

/**
 * @param {{ deviceId: string, store?: { get: Function, save: Function, clear: Function } }} options
 */
export function createQishuiSessions(options) {
  const store = options.store ?? null
  const deviceId = options.deviceId
  let value = null
  let revision = 0
  let writing = Promise.resolve()
  let hydrating = null

  function persist(task) {
    if (store === null) return
    writing = writing.then(task, task).catch(() => undefined)
  }

  return {
    deviceId,
    get revision() {
      return revision
    },
    get: () => value,
    whenReady() {
      return hydrating ?? Promise.resolve()
    },
    set(next) {
      value = next
      revision += 1
      const user = next?.user ?? null
      persist(() => store.save('qishui', { session: next }, user))
    },
    clear() {
      value = null
      revision += 1
      persist(() => store.clear('qishui'))
    },
    async hydrate() {
      if (store === null) return null
      hydrating = (async () => {
        try {
          const entry = await store.get('qishui')
          value = entry === null ? null : (entry.credentials?.session ?? entry.credentials ?? null)
        } catch {
          value = null
        }
        return value
      })()
      return await hydrating
    },
    async flush() {
      await writing
    },
  }
}
