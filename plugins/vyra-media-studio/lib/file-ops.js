/**
 * File-manager operations behind the authenticated Fetch routes:
 * batched metadata, text snippets, rename, copy, delete-to-recycle-bin,
 * reveal-in-file-manager, open-with-system-app and small batch actions.
 *
 * Paths arrive as workspace-relative names. Every operation resolves through
 * `ctx.fs` and proves containment first; mutations then use the Host process
 * filesystem so binary files and whole folders can be renamed, copied and
 * deleted — the `ctx.fs` move API only handles UTF-8 text. Consequently
 * mutations are local-backend only, the same limitation the scan already has.
 */
import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { copyFile, cp, mkdir, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { containsTarget, joinWorkspacePath, pathContains, targetPathOf } from './paths.js'
import { extensionOf, isTextExtension, kindOf } from './media-types.js'
import { invalidateScanCache } from './scan.js'

const MAX_STAT_BATCH = 200
const MAX_BATCH_ACTION = 200
const MAX_TEXT_BYTES = 1024 * 1024
const DEFAULT_STAT_CONCURRENCY = 32
const ILLEGAL_NAME = /[\\/:*?"<>|\u0000-\u001f]/u

/**
 * @param {number} status - HTTP status.
 * @param {string} code - stable machine-readable code.
 * @param {string} message - human-readable reason.
 * @returns {Error} the tagged failure.
 */
function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

/** Case-insensitive path equality on Windows, exact elsewhere. */
function samePath(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}

/**
 * Resolve a workspace-relative entry and prove it stays inside the root.
 * @param {object} fs - `ctx.fs`.
 * @param {string} workspaceRoot - Session workspace root.
 * @param {string} path - workspace-relative path.
 * @param {AbortSignal} [signal] - request cancellation.
 * @param {{ target: object, path: string }} [root] - pre-resolved workspace root.
 * @returns {Promise<{ target: object, absolutePath: string, processPath: string, rootPath: string }>}
 */
async function resolveInside(fs, workspaceRoot, path, signal, root) {
  if (typeof path !== 'string' || path === '' || path.includes('\0')) {
    throw fail(400, 'bad-request', 'a workspace-relative path is required')
  }
  if (isAbsolute(path) || /^[A-Za-z]:[/\\]/u.test(path)) {
    throw fail(400, 'bad-request', 'only workspace-relative paths are accepted')
  }
  if (typeof fs?.resolve !== 'function') throw fail(503, 'fs-unavailable', 'ctx.fs is unavailable on this Host')

  const rootTarget = root?.target ?? await fs.resolve(workspaceRoot, { signal })
  const target = await fs.resolve(joinWorkspacePath(workspaceRoot, path), { signal })
  if (!containsTarget(fs, rootTarget, target)) {
    throw fail(403, 'outside-workspace', `"${path}" is outside the workspace`)
  }
  return {
    target,
    absolutePath: targetPathOf(fs, target),
    processPath: targetPathOf(fs, target),
    rootPath: root?.path ?? targetPathOf(fs, rootTarget),
  }
}

/** Refuse to mutate the workspace root itself. */
function assertMutable(resolved, verb) {
  if (samePath(resolved.processPath, resolved.rootPath)) {
    throw fail(403, 'forbidden', `cannot ${verb} the workspace root`)
  }
}

/** The workspace-relative spelling of an absolute process path. */
function relativeInside(rootPath, absolutePath) {
  const step = relative(rootPath, absolutePath).split('\\').join('/')
  if (step === '' || step.startsWith('..') || isAbsolute(step)) {
    throw fail(403, 'outside-workspace', 'the resulting path is outside the workspace')
  }
  return step
}

/** A user-supplied file or folder name that Windows and POSIX can both store. */
function validFileName(name) {
  if (typeof name !== 'string') return undefined
  const trimmed = name.trim()
  if (trimmed === '' || trimmed === '.' || trimmed === '..') return undefined
  if (ILLEGAL_NAME.test(trimmed)) return undefined
  if (trimmed !== trimmed.replace(/[. ]+$/u, '')) return undefined
  return trimmed
}

/** Run a process to completion with a bounded wait. */
function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    let child
    try {
      child = spawn(command, args, {
        env: options.env ?? process.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(error)
      return
    }
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(fail(504, 'timeout', `${command} timed out`))
    }, options.timeoutMs ?? 20_000)
    child.stdout?.on('data', chunk => { stdout += chunk })
    child.stderr?.on('data', chunk => { stderr += chunk })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolvePromise({ code, stdout, stderr })
      else reject(fail(500, 'command-failed', stderr.trim() || `${command} exited with ${code}`))
    })
  })
}

/** Fire-and-forget launcher; the route reports only whether spawning failed. */
function launch(command, args, options = {}) {
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      windowsVerbatimArguments: options.verbatim === true,
    })
    child.on('error', () => {})
    child.unref()
  } catch (error) {
    throw fail(500, 'spawn-failed', error?.message ?? String(error))
  }
}

/** Stat one path, translating the usual errno codes. */
async function statPath(absolutePath) {
  try {
    return await stat(absolutePath)
  } catch (error) {
    if (error?.code === 'ENOENT') throw fail(404, 'not-found', 'the entry no longer exists')
    if (error?.code === 'EACCES' || error?.code === 'EPERM') throw fail(403, 'permission-denied', 'permission denied')
    throw fail(500, 'io-error', error?.message ?? String(error))
  }
}

/** A copy target that does not exist yet: `name.ext`, then `name (2).ext`. */
async function availableCopyPath(directory, name) {
  const extension = extname(name)
  const stem = extension === '' ? name : name.slice(0, -extension.length)
  for (let index = 1; ; index += 1) {
    const candidate = index === 1 ? name : `${stem} (${index})${extension}`
    const absolute = join(directory, candidate)
    try {
      await stat(absolute)
    } catch (error) {
      if (error?.code === 'ENOENT') return absolute
      throw fail(500, 'io-error', error?.message ?? String(error))
    }
  }
}

/**
 * Batched metadata for the visible page and the tree.
 * @param {object} args - request inputs.
 * @param {string[]} args.paths - workspace-relative paths (files or folders).
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<Array<object>>} one result per requested path.
 */
export async function statFiles({ paths, fs, workspaceRoot, signal }) {
  if (!Array.isArray(paths) || paths.length === 0) throw fail(400, 'bad-request', 'paths must be a non-empty array')
  if (paths.length > MAX_STAT_BATCH) throw fail(400, 'bad-request', `at most ${MAX_STAT_BATCH} paths per request`)

  const rootTarget = await fs.resolve(workspaceRoot, { signal })
  const root = { target: rootTarget, path: targetPathOf(fs, rootTarget) }
  const results = []
  let index = 0
  const worker = async () => {
    while (index < paths.length) {
      const current = index++
      const path = paths[current]
      try {
        const resolved = await resolveInside(fs, workspaceRoot, path, signal, root)
        const info = await statPath(resolved.processPath)
        const type = info.isFile() ? 'file' : info.isDirectory() ? 'directory' : 'other'
        if (type === 'other') { results[current] = { path, error: 'not-regular-file' }; continue }
        results[current] = {
          path,
          type,
          ...(type === 'file' ? { size: info.size } : {}),
          mtimeMs: Math.floor(info.mtimeMs),
          absolutePath: resolved.target.displayPath,
        }
      } catch (error) {
        results[current] = { path, error: error?.code ?? 'stat-failed' }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DEFAULT_STAT_CONCURRENCY, paths.length) }, worker))
  return results
}

/**
 * Read a UTF-8 text window for preview or the document thumbnail.
 * @param {object} args - request inputs.
 * @param {string} args.path - workspace-relative path.
 * @param {number} [args.maxBytes] - byte window, capped at 1 MiB.
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<object>} text plus truncation facts.
 */
export async function readTextFile({ path, maxBytes = 256 * 1024, fs, workspaceRoot, signal }) {
  if (!isTextExtension(extensionOf(path))) throw fail(415, 'not-text', 'this file type is not previewed as text')
  const window = Math.min(MAX_TEXT_BYTES, Math.max(1, Number.parseInt(String(maxBytes), 10) || 256 * 1024))
  const resolved = await resolveInside(fs, workspaceRoot, path, signal)
  const info = await statPath(resolved.processPath)
  if (!info.isFile()) throw fail(403, 'not-regular-file', 'not a regular file')

  const length = Math.min(window, info.size)
  const bytes = length === 0 ? new Uint8Array(0) : await fs.readByteRange(resolved.target, { offset: 0, length }, signal)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/u, '')
  return {
    path,
    ext: extensionOf(path),
    kind: kindOf(extensionOf(path)),
    size: info.size,
    mtimeMs: Math.floor(info.mtimeMs),
    absolutePath: resolved.target.displayPath,
    truncated: info.size > length,
    text,
  }
}

/**
 * Rename one file or folder inside its current directory.
 * @param {object} args - request inputs.
 * @param {string} args.path - current workspace-relative path.
 * @param {string} args.name - new name, without a directory.
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<object>} the renamed entry.
 */
export async function renameFile({ path, name, fs, workspaceRoot, signal }) {
  const cleanName = validFileName(name)
  if (cleanName === undefined) throw fail(400, 'invalid-name', 'name is empty or contains illegal characters')

  const resolved = await resolveInside(fs, workspaceRoot, path, signal)
  const info = await statPath(resolved.processPath)
  if (!info.isFile() && !info.isDirectory()) throw fail(403, 'not-regular-file', 'only files and folders can be renamed')
  assertMutable(resolved, 'rename')

  const destinationPath = join(dirname(resolved.processPath), cleanName)
  const destinationTarget = await fs.resolve(destinationPath, { signal })
  const rootTarget = await fs.resolve(workspaceRoot, { signal })
  if (!containsTarget(fs, rootTarget, destinationTarget)) {
    throw fail(403, 'outside-workspace', 'the new name escapes the workspace')
  }

  const same = samePath(destinationPath, resolved.processPath)
  if (same && basename(resolved.processPath) === cleanName) {
    throw fail(409, 'same-name', 'the new name is unchanged')
  }

  let destinationExists = true
  try {
    await stat(destinationPath)
  } catch (error) {
    if (error?.code === 'ENOENT') destinationExists = false
    else throw fail(500, 'io-error', error?.message ?? String(error))
  }
  if (destinationExists && !same) throw fail(409, 'already-exists', `"${cleanName}" already exists here`)

  try {
    await rename(resolved.processPath, destinationPath)
  } catch (error) {
    if (error?.code === 'EACCES' || error?.code === 'EPERM') throw fail(403, 'permission-denied', 'permission denied')
    throw fail(500, 'io-error', error?.message ?? String(error))
  }

  invalidateScanCache()
  return {
    from: path,
    type: info.isDirectory() ? 'directory' : 'file',
    relativePath: relativeInside(resolved.rootPath, destinationPath),
    absolutePath: destinationTarget.displayPath,
  }
}

/**
 * Copy one file or folder into a workspace folder, auto-numbering on a collision.
 * @param {object} args - request inputs.
 * @param {string} args.path - source workspace-relative path.
 * @param {string} args.toFolder - destination folder, `''` for the workspace root.
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<object>} the new entry.
 */
export async function copyFileInto({ path, toFolder = '', fs, workspaceRoot, signal }) {
  if (typeof toFolder !== 'string' || toFolder.includes('\0')) throw fail(400, 'bad-request', 'invalid destination folder')
  if (isAbsolute(toFolder) || /^[A-Za-z]:[/\\]/u.test(toFolder)) throw fail(400, 'bad-request', 'the destination must be workspace-relative')

  const source = await resolveInside(fs, workspaceRoot, path, signal)
  const sourceInfo = await statPath(source.processPath)
  if (!sourceInfo.isFile() && !sourceInfo.isDirectory()) throw fail(403, 'not-regular-file', 'only files and folders can be copied')
  assertMutable(source, 'copy')

  const destinationDirectory = toFolder === ''
    ? (await fs.resolve(workspaceRoot, { signal })).displayPath
    : joinWorkspacePath(workspaceRoot, toFolder)
  const directoryTarget = await fs.resolve(destinationDirectory, { signal })
  const rootTarget = await fs.resolve(workspaceRoot, { signal })
  if (!containsTarget(fs, rootTarget, directoryTarget)) {
    throw fail(403, 'outside-workspace', 'the destination folder is outside the workspace')
  }
  const directoryProcessPath = targetPathOf(fs, directoryTarget)
  const directoryInfo = await statPath(directoryProcessPath)
  if (!directoryInfo.isDirectory()) throw fail(400, 'not-directory', 'the destination is not a directory')
  if (sourceInfo.isDirectory() && pathContains(source.processPath, directoryProcessPath)) {
    throw fail(400, 'copy-into-self', 'cannot copy a folder into itself or its own subtree')
  }

  const destination = await availableCopyPath(directoryProcessPath, basename(source.processPath))
  try {
    if (sourceInfo.isDirectory()) {
      await cp(source.processPath, destination, { recursive: true, errorOnExist: true, force: false })
    } else {
      await copyFile(source.processPath, destination, constants.COPYFILE_EXCL)
    }
  } catch (error) {
    if (error?.code === 'EEXIST') throw fail(409, 'already-exists', 'the copy target already exists')
    if (error?.code === 'EACCES' || error?.code === 'EPERM') throw fail(403, 'permission-denied', 'permission denied')
    throw fail(500, 'io-error', error?.message ?? String(error))
  }

  invalidateScanCache()
  const newTarget = await fs.resolve(destination, { signal })
  return {
    from: path,
    type: sourceInfo.isDirectory() ? 'directory' : 'file',
    relativePath: relativeInside(source.rootPath, destination),
    absolutePath: newTarget.displayPath,
  }
}

/** Move a file or folder to the platform recycle bin/trash. */
async function moveToRecycleBin(absolutePath, isDirectory) {
  if (process.platform === 'win32') {
    const call = isDirectory
      ? '[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($env:VYRA_DELETE_TARGET,'
        + '[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,'
        + '[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)'
      : '[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:VYRA_DELETE_TARGET,'
        + '[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,'
        + '[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)'
    const script = `Add-Type -AssemblyName Microsoft.VisualBasic; ${call}`
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      env: { ...process.env, VYRA_DELETE_TARGET: absolutePath },
    })
    return
  }

  if (process.platform === 'darwin') {
    const trashDirectory = join(homedir(), '.Trash')
    await mkdir(trashDirectory, { recursive: true })
    const target = await availableCopyPath(trashDirectory, basename(absolutePath))
    try {
      await rename(absolutePath, target)
    } catch {
      await cp(absolutePath, target, { recursive: isDirectory })
      await rm(absolutePath, { recursive: isDirectory, force: false })
    }
    return
  }

  try {
    await run('gio', ['trash', '--', absolutePath], { timeoutMs: 15_000 })
  } catch (error) {
    throw fail(501, 'recycle-unsupported', error?.message ?? 'no system trash tool is available')
  }
}

/**
 * Delete a file or folder, preferring the system recycle bin.
 * @param {object} args - request inputs.
 * @param {string} args.path - workspace-relative path.
 * @param {boolean} [args.permanent] - delete without the recycle bin.
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<{ recycled: boolean, type: string }>} whether it went to the bin.
 */
export async function deleteFile({ path, permanent = false, fs, workspaceRoot, signal }) {
  const resolved = await resolveInside(fs, workspaceRoot, path, signal)
  const info = await statPath(resolved.processPath)
  if (!info.isFile() && !info.isDirectory()) throw fail(403, 'not-regular-file', 'only files and folders can be deleted')
  assertMutable(resolved, 'delete')
  const isDirectory = info.isDirectory()

  if (permanent === true) {
    try {
      await rm(resolved.processPath, { recursive: isDirectory, force: false })
    } catch (error) {
      throw fail(500, 'io-error', error?.message ?? String(error))
    }
    invalidateScanCache()
    return { recycled: false, type: isDirectory ? 'directory' : 'file' }
  }

  try {
    await moveToRecycleBin(resolved.processPath, isDirectory)
  } catch (error) {
    const wrapped = fail(
      error?.status ?? 500,
      error?.code ?? 'recycle-failed',
      `移到回收站失败：${error?.message ?? String(error)}`,
    )
    wrapped.canPermanent = true
    throw wrapped
  }
  invalidateScanCache()
  return { recycled: true, type: isDirectory ? 'directory' : 'file' }
}

/**
 * Run a small batch of copies or deletes. Each path is validated independently
 * so one failure does not stop the rest.
 * @param {object} args - request inputs.
 * @param {'copy'|'delete'} args.action - operation.
 * @param {string[]} args.paths - workspace-relative paths.
 * @param {string} [args.toFolder] - copy destination.
 * @param {boolean} [args.permanent] - delete permanently.
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<Array<object>>} per-path results.
 */
/**
 * Move one file or folder into a workspace folder. Same-volume moves use a
 * rename; a cross-volume move copies then removes the source.
 * @param {object} args - request inputs.
 * @param {string} args.path - source workspace-relative path.
 * @param {string} args.toFolder - destination folder, `''` for the workspace root.
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<object>} the moved entry.
 */
export async function moveFile({ path, toFolder = '', fs, workspaceRoot, signal }) {
  if (typeof toFolder !== 'string' || toFolder.includes('\0')) throw fail(400, 'bad-request', 'invalid destination folder')
  if (isAbsolute(toFolder) || /^[A-Za-z]:[/\\]/u.test(toFolder)) {
    throw fail(400, 'bad-request', 'the destination must be workspace-relative')
  }

  const source = await resolveInside(fs, workspaceRoot, path, signal)
  const sourceInfo = await statPath(source.processPath)
  if (!sourceInfo.isFile() && !sourceInfo.isDirectory()) {
    throw fail(403, 'not-regular-file', 'only files and folders can be moved')
  }
  assertMutable(source, 'move')

  const destinationDirectory = toFolder === ''
    ? (await fs.resolve(workspaceRoot, { signal })).displayPath
    : joinWorkspacePath(workspaceRoot, toFolder)
  const directoryTarget = await fs.resolve(destinationDirectory, { signal })
  const rootTarget = await fs.resolve(workspaceRoot, { signal })
  if (!containsTarget(fs, rootTarget, directoryTarget)) {
    throw fail(403, 'outside-workspace', 'the destination folder is outside the workspace')
  }
  const directoryProcessPath = targetPathOf(fs, directoryTarget)
  const directoryInfo = await statPath(directoryProcessPath)
  if (!directoryInfo.isDirectory()) throw fail(400, 'not-directory', 'the destination is not a directory')

  const destination = join(directoryProcessPath, basename(source.processPath))
  if (samePath(destination, source.processPath)) return {
    path,
    relativePath: path,
    absolutePath: source.target.displayPath,
    type: sourceInfo.isDirectory() ? 'directory' : 'file',
    unchanged: true,
  }
  // Moving a folder into itself or its own subtree would detach it.
  if (sourceInfo.isDirectory() && (pathContains(source.processPath, directoryProcessPath)
    || samePath(directoryProcessPath, source.processPath))) {
    throw fail(400, 'move-into-self', 'cannot move a folder into itself or its own subtree')
  }

  let exists = true
  try {
    await stat(destination)
  } catch (error) {
    if (error?.code === 'ENOENT') exists = false
    else throw fail(500, 'io-error', error?.message ?? String(error))
  }
  if (exists) throw fail(409, 'already-exists', `"${basename(destination)}" already exists in the destination`)

  try {
    await rename(source.processPath, destination)
  } catch (error) {
    if (error?.code === 'EXDEV') {
      try {
        await cp(source.processPath, destination, { recursive: sourceInfo.isDirectory() })
        await rm(source.processPath, { recursive: sourceInfo.isDirectory(), force: false })
      } catch (inner) {
        await rm(destination, { recursive: sourceInfo.isDirectory(), force: true }).catch(() => {})
        if (inner?.code === 'EACCES' || inner?.code === 'EPERM') throw fail(403, 'permission-denied', 'permission denied')
        throw fail(500, 'io-error', inner?.message ?? String(inner))
      }
    } else if (error?.code === 'EACCES' || error?.code === 'EPERM') {
      throw fail(403, 'permission-denied', 'permission denied')
    } else {
      throw fail(500, 'io-error', error?.message ?? String(error))
    }
  }

  invalidateScanCache()
  const newTarget = await fs.resolve(destination, { signal })
  return {
    from: path,
    relativePath: relativeInside(source.rootPath, destination),
    absolutePath: newTarget.displayPath,
    type: sourceInfo.isDirectory() ? 'directory' : 'file',
  }
}

export async function batchFiles({ action, paths, toFolder = '', permanent = false, fs, workspaceRoot, signal }) {
  if (action !== 'copy' && action !== 'delete' && action !== 'move') throw fail(400, 'bad-request', 'action must be copy, delete or move')
  if (!Array.isArray(paths) || paths.length === 0) throw fail(400, 'bad-request', 'paths must be a non-empty array')
  if (paths.length > MAX_BATCH_ACTION) throw fail(400, 'bad-request', `at most ${MAX_BATCH_ACTION} paths per batch`)

  const results = []
  for (const path of paths) {
    if (signal?.aborted) {
      results.push({ path, ok: false, code: 'aborted', error: 'request aborted' })
      continue
    }
    try {
      const result = action === 'copy'
        ? await copyFileInto({ path, toFolder, fs, workspaceRoot, signal })
        : action === 'move'
          ? await moveFile({ path, toFolder, fs, workspaceRoot, signal })
          : await deleteFile({ path, permanent, fs, workspaceRoot, signal })
      results.push({ path, ok: true, ...result })
    } catch (error) {
      results.push({
        path,
        ok: false,
        code: error?.code ?? 'failed',
        error: error?.message ?? String(error),
      })
    }
  }
  return results
}

/**
 * Show a file or folder in the OS file manager.
 * @param {object} args - request inputs.
 * @returns {Promise<void>}
 */
export async function revealFile({ path, fs, workspaceRoot, signal }) {
  const resolved = await resolveInside(fs, workspaceRoot, path, signal)
  await statPath(resolved.processPath)
  if (process.platform === 'win32') {
    launch('explorer.exe', [`/select,"${resolved.processPath}"`], { verbatim: true })
  } else if (process.platform === 'darwin') {
    launch('open', ['-R', resolved.processPath])
  } else {
    launch('xdg-open', [dirname(resolved.processPath)])
  }
}

/**
 * Open a file or folder with its system default application.
 * @param {object} args - request inputs.
 * @returns {Promise<void>}
 */
export async function openFileWithSystem({ path, fs, workspaceRoot, signal }) {
  const resolved = await resolveInside(fs, workspaceRoot, path, signal)
  await statPath(resolved.processPath)
  if (process.platform === 'win32') {
    launch('explorer.exe', [resolved.processPath])
  } else if (process.platform === 'darwin') {
    launch('open', [resolved.processPath])
  } else {
    launch('xdg-open', [resolved.processPath])
  }
}
