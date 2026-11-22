/**
 * Workspace path helpers that behave the same whichever platform runs the Host.
 *
 * Two problems this solves:
 *
 * - `path.resolve`/`path.relative` follow the *host* platform, but a workspace
 *   root may be spelled either way (a POSIX root on Windows, or the reverse for
 *   a remote backend). Mixing them silently mis-resolves `..`, so the path
 *   flavour is chosen from the value being handled rather than from
 *   `process.platform`.
 * - `ctx.fs.contains` is the sanctioned containment check but is newer than some
 *   installed Hosts; a missing method turned every media request into an opaque
 *   500. The fallback compares execution-world paths, which is what `contains`
 *   compares anyway.
 */
import { posix, win32 } from 'node:path'

/** Whether a path uses a Windows drive or UNC spelling. */
export function isWindowsPath(value) {
  return /^[A-Za-z]:[/\\]/u.test(value) || value.startsWith('\\\\')
}

/** Whether a path is absolute in either accepted spelling. */
export function isAbsolutePath(value) {
  return value.startsWith('/') || isWindowsPath(value)
}

/** The path module matching a value's spelling. */
function pathApiFor(value) {
  return isWindowsPath(value) ? win32 : posix
}

/**
 * The execution-world path of a resolved target.
 * @param {object} fs - `ctx.fs`.
 * @param {object} target - resolved target.
 * @returns {string} a path this Host process can open.
 */
export function targetPathOf(fs, target) {
  if (typeof fs.processPath === 'function') {
    try { return fs.processPath(target) } catch { /* fall back to displayPath */ }
  }
  return target.displayPath
}

/**
 * Join a workspace-relative path onto a workspace root and normalize it with
 * the root's own spelling, so `a/../b.mp4` becomes `b.mp4` while `../x` stays
 * outside the root and is rejected by the containment check.
 * @param {string} root - workspace root in the execution world.
 * @param {string} path - relative path, or an absolute path already inside the root.
 * @returns {string} an absolute path.
 */
export function joinWorkspacePath(root, path) {
  if (path === '') return root
  if (isAbsolutePath(path)) return path
  return pathApiFor(root).resolve(root, path)
}

/**
 * Whether a resolved child path is the parent or sits below it.
 * @param {string} parentPath - resolved parent directory.
 * @param {string} childPath - resolved candidate path.
 * @returns {boolean} true when the child is inside the parent.
 */
export function pathContains(parentPath, childPath) {
  if (parentPath === '' || childPath === '') return false
  const api = pathApiFor(parentPath)
  const parent = api.resolve(parentPath)
  const child = api.resolve(childPath)
  if (api === win32) {
    if (child.toLowerCase() === parent.toLowerCase()) return true
  } else if (child === parent) {
    return true
  }
  const step = api.relative(parent, child)
  if (step === '' || step === '..' || step.startsWith(`..${api.sep}`)) return false
  return !isAbsolutePath(step) && !isWindowsPath(step)
}

/**
 * Whether `child` is `parent` or below it, preferring the filesystem's own check.
 * @param {object} fs - `ctx.fs`.
 * @param {object} parent - resolved directory target.
 * @param {object} child - resolved candidate target.
 * @returns {boolean} true when the child is inside the parent.
 */
export function containsTarget(fs, parent, child) {
  if (typeof fs.contains === 'function') {
    try { return fs.contains(parent, child) === true } catch { /* fall back to path comparison */ }
  }
  return pathContains(targetPathOf(fs, parent), targetPathOf(fs, child))
}
