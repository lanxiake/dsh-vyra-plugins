/**
 * Recoverable "trash" for tracks removed from the library.
 *
 * Every moved file gets a `.info.json` sidecar with its original absolute path,
 * so the UI can offer a real restore instead of a permanent delete.
 *
 * @module dsh-music-panel/trash
 */

import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

const SIDECAR = '.info.json'

function entryError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

function stripPrefix(name) {
  return name.replace(/^[0-9a-z]+-[0-9a-z]{1,8}-/, '')
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Find a free restore target, keeping the original name when possible. */
async function freeTarget(path) {
  if (!(await exists(path))) return path
  const extension = extname(path)
  const stem = extension === '' ? path : path.slice(0, -extension.length)
  let index = 1
  for (;;) {
    const candidate = index === 1 ? `${stem} (restored)${extension}` : `${stem} (restored ${index})${extension}`
    if (!(await exists(candidate))) return candidate
    index += 1
  }
}

/**
 * @param {{ dir: string }} options
 */
export function createTrash({ dir, getRoots }) {
  async function moveIn(file, originalPath) {
    await mkdir(dir, { recursive: true })
    const target = join(
      dir,
      `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}-${basename(file)}`,
    )
    try {
      await rename(file, target)
    } catch {
      await copyFile(file, target)
      await unlink(file)
    }
    try {
      await writeFile(
        `${target}${SIDECAR}`,
        JSON.stringify({
          path: typeof originalPath === 'string' ? originalPath : '',
          name: basename(file),
          at: Date.now(),
        }),
        'utf8',
      )
    } catch {
      // A sidecar is best-effort; the file itself already moved safely.
    }
    return target
  }

  async function list() {
    let names
    try {
      names = await readdir(dir)
    } catch {
      return []
    }
    const entries = []
    for (const name of names) {
      if (name.endsWith(SIDECAR)) continue
      const file = join(dir, name)
      let info
      try {
        info = await stat(file)
      } catch {
        continue
      }
      if (!info.isFile()) continue
      let meta = {}
      try {
        meta = JSON.parse(await readFile(`${file}${SIDECAR}`, 'utf8'))
      } catch {
        meta = {}
      }
      entries.push({
        id: name,
        name: typeof meta.name === 'string' && meta.name !== '' ? meta.name : stripPrefix(name),
        size: info.size,
        mtime: info.mtimeMs,
        originalPath: typeof meta.path === 'string' ? meta.path : '',
      })
    }
    entries.sort((left, right) => right.mtime - left.mtime)
    return entries
  }

  async function restore(id) {
    if (typeof id !== 'string' || id === '' || id.includes('..') || /[\\/]/.test(id) || id.endsWith(SIDECAR)) {
      throw entryError('非法的回收站条目', 'BAD_ID')
    }
    const file = join(dir, id)
    let info
    try {
      info = await stat(file)
    } catch {
      throw entryError('回收站里没有这个文件', 'NOT_FOUND')
    }
    if (!info.isFile()) throw entryError('不是文件', 'BAD_ID')

    let meta = {}
    try {
      meta = JSON.parse(await readFile(`${file}${SIDECAR}`, 'utf8'))
    } catch {
      meta = {}
    }
    const original = typeof meta.path === 'string' ? meta.path : ''
    if (original === '' || !isAbsolute(original)) {
      throw entryError('这个条目的原路径未知，无法还原', 'NO_PATH')
    }

    if (typeof getRoots === 'function') {
      const roots = await getRoots()
      const absolute = resolve(original)
      const inside = (Array.isArray(roots) ? roots : []).some((root) => {
        const rel = relative(resolve(root), absolute)
        return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
      })
      if (!inside) throw entryError('原路径不在当前音乐目录内，无法还原', 'OUTSIDE_ROOT')
    }
    const target = await freeTarget(original)
    await mkdir(dirname(target), { recursive: true })
    try {
      await rename(file, target)
    } catch {
      await copyFile(file, target)
      await unlink(file)
    }
    await unlink(`${file}${SIDECAR}`).catch(() => {})
    return { path: target }
  }

  return { dir, moveIn, list, restore }
}
