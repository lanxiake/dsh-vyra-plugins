/**
 * Put workspace files on the system clipboard so a paste in Explorer copies
 * them for real (`FileDrop`), with the plain paths attached as text.
 *
 * The browser cannot write files to the system clipboard; only the Host can.
 * Windows uses `clipboard.ps1` (WPF `SetFileDropList` + `Flush`), macOS uses
 * `osascript` with `POSIX file` aliases, Linux uses `xclip`'s `text/uri-list`.
 * A platform with no implementation reports that plainly instead of pretending.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { containsTarget, isAbsolutePath, joinWorkspacePath, pathContains, targetPathOf } from './paths.js'

/** One clipboard request may carry at most this many entries. */
export const MAX_CLIPBOARD_ITEMS = 100

const SCRIPT_PATH = fileURLToPath(new URL('./clipboard.ps1', import.meta.url))

/**
 * @param {number} status - HTTP status.
 * @param {string} code - stable machine-readable code.
 * @param {string} message - human-readable reason.
 * @returns {Error} the tagged failure.
 */
function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

/**
 * Resolve workspace-relative paths to absolute paths, proving every one stays
 * inside the workspace and still exists.
 * @param {object} args - request inputs.
 * @param {string[]} args.paths - workspace-relative paths.
 * @param {object} args.fs - `ctx.fs`.
 * @param {string} args.workspaceRoot - Session workspace root.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<string[]>} absolute paths in request order.
 */
export async function resolveClipboardPaths({ paths, fs, workspaceRoot, signal }) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw fail(400, 'bad-request', 'paths must be a non-empty array')
  }
  if (paths.length > MAX_CLIPBOARD_ITEMS) {
    throw fail(400, 'bad-request', `at most ${MAX_CLIPBOARD_ITEMS} paths per request`)
  }
  if (typeof fs?.resolve !== 'function') {
    throw fail(503, 'fs-unavailable', 'ctx.fs is unavailable on this Host')
  }

  const rootTarget = await fs.resolve(workspaceRoot, { signal })
  const absolute = []
  for (const path of paths) {
    if (typeof path !== 'string' || path === '' || path.includes('\0')) {
      throw fail(400, 'bad-request', 'every path must be a non-empty string')
    }
    // The caller names entries inside its workspace; an absolute path is a
    // different request (and would let a client probe the Host's filesystem).
    if (isAbsolutePath(path) || /^[A-Za-z]:[/\\]/u.test(path)) {
      throw fail(400, 'bad-request', 'paths must be workspace-relative')
    }
    const target = await fs.resolve(joinWorkspacePath(workspaceRoot, path), { signal })
    if (!containsTarget(fs, rootTarget, target)) {
      throw fail(403, 'outside-workspace', `"${path}" is outside the workspace`)
    }
    const resolvedPath = targetPathOf(fs, target)
    const info = await fs.stat(target, signal)
    if (info === undefined) throw fail(404, 'not-found', `"${path}" no longer exists`)
    absolute.push(resolvedPath)
  }
  return absolute
}

/**
 * Hand the paths to the script through a UTF-8 file rather than one argv string.
 *
 * A UNC path (`\\server\share\f.txt`) or a name containing `|`, a quote or a
 * newline is otherwise mangled by Node's argv escaping or by the payload's own
 * separator.
 * @param {object} args - run inputs.
 * @param {string[]} args.absolutePaths - validated absolute paths.
 * @param {Function} args.spawn - process seam.
 * @returns {{ status: number, stdout: string, stderr: string }} the child result.
 */
function runWithListFile({ absolutePaths, spawn }) {
  const directory = mkdtempSync(join(tmpdir(), 'vyra-clipboard-'))
  const listFile = join(directory, 'paths.txt')
  try {
    writeFileSync(listFile, `${absolutePaths.join('\n')}\n`, 'utf8')
    return spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT_PATH,
      '-Kind', 'files',
      '-ListFile', listFile,
    ])
  } finally {
    // The script has already copied the paths onto the clipboard by now; the
    // list is only the transport.
    try { rmSync(directory, { recursive: true, force: true }) } catch { /* best effort */ }
  }
}

/** Run one command and translate a non-zero exit into a stable code. */
function defaultSpawn(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20_000,
  })
  if (result.error !== undefined && result.error !== null) {
    return { status: 1, stdout: '', stderr: result.error.message ?? String(result.error) }
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** `file:///` URIs for `xclip -t text/uri-list`. */
function uriList(paths) {
  return paths
    .map(path => `file://${path.split('\\').join('/').replace(/^([A-Za-z]:)/u, '/$1')}`)
    .map(uri => encodeURI(uri).replace(/%2F/gu, '/').replace(/%3A/gu, ':'))
    .join('\n')
}

/** AppleScript that writes `POSIX file` aliases to the general pasteboard. */
function osascriptSource(paths) {
  const aliases = paths
    .map(path => `POSIX file ${JSON.stringify(path)}`)
    .join(', ')
  return `set the clipboard to {${aliases}}`
}

/**
 * Write absolute paths to the system clipboard.
 * @param {object} args - request inputs.
 * @param {string[]} args.absolutePaths - absolute paths, already validated.
 * @param {NodeJS.Platform} [args.platform] - platform override for tests.
 * @param {(command: string, args: string[], input?: string) => { status: number, stdout: string, stderr: string }} [args.spawn] - process seam.
 * @returns {Promise<void>}
 */
export async function copyPathsToClipboard({ absolutePaths, platform = process.platform, spawn = defaultSpawn }) {
  if (!Array.isArray(absolutePaths) || absolutePaths.length === 0) {
    throw fail(400, 'bad-request', 'nothing to copy')
  }

  let result
  if (platform === 'win32') {
    result = runWithListFile({ absolutePaths, spawn })
  } else if (platform === 'darwin') {
    result = spawn('osascript', ['-e', osascriptSource(absolutePaths)])
  } else if (platform === 'linux') {
    result = spawn('xclip', ['-selection', 'clipboard', '-t', 'text/uri-list'], uriList(absolutePaths))
  } else {
    throw fail(501, 'clipboard-unsupported', `no system clipboard writer for "${platform}"`)
  }

  if (result.status === 0) return
  // The script writes its own markers with Write-Output (stdout), while a
  // PowerShell parse or runtime failure lands on stderr — read both.
  const detail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  const marker = line => line.startsWith('CLIPBOARD_BUSY')
  const lines = detail.split(/\r?\n/u)
  if (lines.some(marker)) {
    throw fail(409, 'clipboard-busy', '剪贴板被其他程序占用，请稍后再试')
  }
  const missing = lines.find(line => line.startsWith('CLIPBOARD_MISSING:'))
  if (missing !== undefined) {
    throw fail(404, 'not-found', `文件不存在：${missing.slice('CLIPBOARD_MISSING:'.length).trim()}`)
  }
  if (lines.some(line => line.startsWith('CLIPBOARD_EMPTY'))) {
    throw fail(400, 'bad-request', '没有要复制的文件')
  }
  if (lines.some(line => line.startsWith('CLIPBOARD_NO_CMDLET'))) {
    throw fail(501, 'clipboard-unsupported', 'Set-Clipboard 不可用（需要 PowerShell 5.0+）')
  }
  throw fail(500, 'spawn-failed', detail || 'the clipboard writer exited unsuccessfully')
}

export { SCRIPT_PATH as CLIPBOARD_SCRIPT_PATH }
