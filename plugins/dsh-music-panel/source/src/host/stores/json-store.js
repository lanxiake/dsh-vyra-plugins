/**
 * Small durable JSON helper shared by the plugin stores.
 *
 * The files here are tiny but user-owned (favourites, playlists, stats, last
 * playback state). A process killed mid-write must not leave a truncated JSON
 * file, and two requests must not overwrite each other's complete payload.
 *
 * @module dsh-music-panel/json-store
 */

import { copyFile, mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'

const locks = new Map()

/** Serialize all writes to one path within this process. */
export function withJsonLock(file, task) {
  const previous = locks.get(file) ?? Promise.resolve()
  const next = previous.then(task, task)
  const tracked = next.finally(() => {
    if (locks.get(file) === tracked) locks.delete(file)
  })
  locks.set(file, tracked)
  return tracked
}

export async function readJsonWithBackup(file) {
  for (const candidate of [file, `${file}.bak`]) {
    try {
      return JSON.parse(await readFile(candidate, 'utf8'))
    } catch {
      // Try the backup, then fall back to "missing".
    }
  }
  return null
}

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

/** Write JSON via temp file + fsync + rename, keeping a .bak of the old file. */
export async function writeJsonAtomic(file, value, options = {}) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  return withJsonLock(file, async () => {
    await mkdir(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`
    let handle = null
    try {
      handle = await open(temp, 'w', options.mode ?? 0o600)
      await handle.writeFile(text, 'utf8')
      await handle.sync()
      await handle.close()
      handle = null
      if (await exists(file)) {
        try {
          await copyFile(file, `${file}.bak`)
        } catch {
          // A backup is best effort; the atomic replace still protects the file.
        }
      }
      try {
        await rename(temp, file)
      } catch (error) {
        // Windows occasionally refuses rename-over-existing while a reader is
        // open. Retry once, then fall back to a complete copy.
        if (error?.code === 'EPERM' || error?.code === 'EBUSY' || error?.code === 'EEXIST') {
          await new Promise((resolve) => setTimeout(resolve, 40))
          try {
            await rename(temp, file)
          } catch {
            await copyFile(temp, file)
          }
        } else {
          throw error
        }
      }
      return value
    } finally {
      if (handle !== null) await handle.close().catch(() => {})
      await unlink(temp).catch(() => {})
    }
  })
}
