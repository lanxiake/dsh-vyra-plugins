/**
 * Local folder watcher for the "automatically rescan imported folders" setting.
 *
 * Folia watches the local folders and runs an incremental scan when a file changes. This
 * plugin has no incremental scanner, so a change schedule one full refresh scan, debounced
 * and rate-limited: a batch import fires once, and a busy download folder cannot keep the
 * scanner running.
 *
 * @module dsh-music-panel/folder-watch
 */

import { watch } from 'node:fs'
import { resolve } from 'node:path'

/**
 * @param {{
 *   getConfig: () => Promise<{ roots: string[], hiddenRoots: string[], watchFolders: boolean }>,
 *   onChange: () => Promise<void> | void,
 *   debounceMs?: number,
 *   minGapMs?: number,
 * }} options
 */
export function createLibraryWatcher(options) {
  const debounceMs = Number(options.debounceMs) > 0 ? Number(options.debounceMs) : 2000
  const minGapMs = Number(options.minGapMs) >= 0 ? Number(options.minGapMs) : 30_000
  let watchers = []
  let timer = null
  let running = false
  let lastRun = 0

  function stopWatchers() {
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch {
        /* already gone */
      }
    }
    watchers = []
  }

  function schedule() {
    if (timer !== null) return
    const wait = Math.max(debounceMs, lastRun + minGapMs - Date.now())
    timer = setTimeout(() => {
      timer = null
      void run()
    }, wait)
    if (typeof timer.unref === 'function') timer.unref()
  }

  async function run() {
    if (running) {
      schedule()
      return
    }
    running = true
    lastRun = Date.now()
    try {
      await options.onChange()
    } catch {
      /* A failed scan is retried by the next change. */
    } finally {
      running = false
    }
  }

  /** Re-read the settings and watch exactly the configured, visible roots. */
  async function sync() {
    stopWatchers()
    let config
    try {
      config = await options.getConfig()
    } catch {
      return
    }
    if (config === null || config === undefined || config.watchFolders !== true) return
    const hidden = new Set(Array.isArray(config.hiddenRoots) ? config.hiddenRoots : [])
    for (const root of Array.isArray(config.roots) ? config.roots : []) {
      if (typeof root !== 'string' || root === '' || hidden.has(root)) continue
      const target = resolve(root)
      try {
        const watcher = watch(target, { recursive: true }, () => schedule())
        watcher.on('error', () => {})
        watchers.push(watcher)
      } catch {
        // A root that cannot be watched (missing, permission) is skipped; the scan still runs.
      }
    }
  }

  function stop() {
    stopWatchers()
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { sync, stop }
}
