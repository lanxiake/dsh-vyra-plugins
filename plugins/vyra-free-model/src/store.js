/**
 * Durable state for this plugin.
 *
 * A plain JSON file the plugin owns, rather than the harness settings seam: the
 * settings seam changed shape between the kernel lines this plugin targets, and
 * usage history is high-cardinality telemetry that does not belong in a
 * configuration document anyway. A file this plugin fully owns behaves the same
 * everywhere.
 *
 * Writes coalesce and land through a temp file plus `rename`, so a crash mid
 * write cannot leave a truncated document. A damaged file is kept beside the
 * fresh one instead of being silently overwritten — losing a user's settings
 * with nothing on disk to recover and nothing in the log to explain is worse
 * than a stray `.corrupt-` file.
 *
 * @module src/store.js
 */

import fs from 'node:fs'
import path from 'node:path'

const FLUSH_DELAY_MS = 800

export class JsonStore {
  /**
   * @param {string} file - absolute path
   * @param {object} initial - value used when the file does not exist yet
   * @param {{ log?: (message: string) => void }} [options]
   */
  constructor(file, initial, { log } = {}) {
    this.file = file
    this.value = initial
    this.dirty = false
    this.timer = undefined
    this.disposed = false
    this.log = log
    this.writeFailed = false
    this.load()
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this.value = { ...this.value, ...parsed }
      }
    } catch {
      this.backupCorrupt()
    }
  }

  /** Keep a damaged source beside the fresh default instead of erasing it. */
  backupCorrupt() {
    try {
      if (!fs.existsSync(this.file)) return
      const backup = `${this.file}.corrupt-${Date.now()}`
      fs.copyFileSync(this.file, backup)
      fs.chmodSync(backup, 0o600)
    } catch { /* a home we cannot write to is not this file's problem */ }
  }

  get() {
    return this.value
  }

  /** Merge a patch in and schedule the write. */
  update(patch) {
    if (this.disposed) return this.value
    this.value = { ...this.value, ...patch }
    this.schedule()
    return this.value
  }

  /** Read-modify-write through a callback. */
  edit(mutate) {
    if (this.disposed) return this.value
    const next = mutate(structuredClone(this.value))
    if (next !== undefined) this.value = next
    this.schedule()
    return this.value
  }

  schedule(delayMs = FLUSH_DELAY_MS) {
    if (this.disposed) return
    this.dirty = true
    if (this.timer !== undefined) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.flush()
    }, delayMs)
    // Telemetry must never hold the process open.
    this.timer.unref?.()
  }

  flush() {
    if (!this.dirty || this.disposed) return
    this.dirty = false
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const temp = `${this.file}.${process.pid}.tmp`
      fs.writeFileSync(temp, JSON.stringify(this.value, undefined, 2), { mode: 0o600 })
      fs.chmodSync(temp, 0o600)
      fs.renameSync(temp, this.file)
      this.writeFailed = false
    } catch (error) {
      // Re-arm so dispose()'s final flush retries a write that never landed.
      this.dirty = true
      if (!this.writeFailed) {
        this.writeFailed = true
        this.log?.(`dsh-vyra-free-model: could not persist ${path.basename(this.file)} (${error?.message ?? error}); changes are kept in memory only`)
      }
    }
  }

  dispose() {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    // Persist this generation's work, THEN lock: a late callback from a
    // hot-reloaded-away generation must never write over its successor's state.
    this.flush()
    this.disposed = true
    this.dirty = false
  }
}
