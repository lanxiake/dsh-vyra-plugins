/**
 * The source registry: the only list of installed sources.
 *
 * Every source (local library or an online platform) registers one object here.
 * Nothing above this layer is allowed to enumerate platforms by name; they ask the
 * registry. That is the property that makes "add a platform" a one-line change.
 *
 * State lives inside `createRegistry()` on purpose: a module-level Map would make
 * every "instance" share one list, which silently breaks tests and any second
 * registry.
 *
 * @module dsh-music-panel/sources/registry
 */

import { MusicError } from '../../services/core/errors.js'

export function createRegistry() {
  const sources = new Map()
  const listeners = new Set()
  let version = 0

  function announce() {
    version += 1
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // A broken listener must not break registration.
      }
    }
  }

  return {
    /** @param {object} source */
    register(source) {
      if (source === null || typeof source !== 'object' || typeof source.id !== 'string' || source.id === '') {
        throw new MusicError('a source needs a non-empty id', { code: 'invalid-response' })
      }
      sources.set(source.id, source)
      announce()
    },

    unregister(id) {
      const removed = sources.delete(id)
      if (removed) announce()
      return removed
    },

    /** @returns {object | null} */
    get(id) {
      return sources.get(id) ?? null
    },

    require(id) {
      const source = sources.get(id)
      if (source === undefined) {
        throw new MusicError(`source is not registered: ${id}`, { code: 'unavailable', sourceId: id })
      }
      return source
    },

    list() {
      return [...sources.values()]
    },

    /** Sources declaring `capabilities[key] === true`. */
    withCapability(key) {
      return [...sources.values()].filter((source) => Boolean(source.capabilities?.[key]))
    },

    /** Short, browser-safe view: identity, capabilities, quality and login methods. */
    summaries() {
      return [...sources.values()].map((source) => ({
        id: source.id,
        displayName: source.displayName ?? source.id,
        kind: source.kind ?? 'online',
        capabilities: source.capabilities ?? {},
        qualityLevels: Array.isArray(source.qualityLevels) ? source.qualityLevels.slice() : [],
        loginMethods: Array.isArray(source.loginMethods) ? source.loginMethods.slice() : [],
        loginTexts: source.loginTexts ?? null,
        availability: typeof source.availability === 'function'
          ? source.availability()
          : { configured: true },
        requiresAccount: source.requiresAccount !== false,
      }))
    },

    version() {
      return version
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Tests only. */
    clear() {
      sources.clear()
      announce()
    },
  }
}
