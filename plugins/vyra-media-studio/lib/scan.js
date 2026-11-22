/**
 * Local workspace media scan built on `fast-glob` (MIT). The Host route
 * resolves the Session workspace with `workspaceFiles.scopeOf`, then this
 * module streams matching files with size and mtime in one pass.
 */
import fg from 'fast-glob'
import { join, relative } from 'node:path'
import { MEDIA_EXTENSIONS, extensionOf, kindOf } from './media-types.js'

/** Directories the scan never enters. */
export const DEFAULT_SKIP_DIRECTORIES = [
  '.git', '.hg', '.svn', '.next', '.turbo', '.pnpm-store', '.yarn', '.cache',
  'node_modules', 'dist', 'build', 'coverage', 'vendor', 'out', 'target',
]

/** Default caps. The HTTP route accepts overrides within hard limits. */
export const SCAN_DEFAULTS = {
  maxEntries: 3000,
  maxDepth: 8,
  budgetMs: 12_000,
  includeHidden: false,
}

/**
 * Recursively collect media entries under `root`.
 * @param {object} options - scan inputs.
 * @param {string} options.root - absolute directory to walk.
 * @param {string} options.workspaceRoot - absolute workspace root used for `relativePath`.
 * @param {number} [options.maxEntries] - media entries to keep.
 * @param {number} [options.maxDepth] - directory levels below `root`.
 * @param {number} [options.budgetMs] - wall-clock budget.
 * @param {boolean} [options.includeHidden] - include dot-files and dot-directories.
 * @param {Set<string>} [options.skipDirectories] - directory names never entered.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @returns {Promise<{ entries: Array<object>, scannedDirectories: number, skippedEntries: number, truncated: boolean }>}
 */
export async function scanMedia(options) {
  const {
    root,
    workspaceRoot,
    maxEntries = SCAN_DEFAULTS.maxEntries,
    maxDepth = SCAN_DEFAULTS.maxDepth,
    budgetMs = SCAN_DEFAULTS.budgetMs,
    includeHidden = SCAN_DEFAULTS.includeHidden,
    skipDirectories = new Set(DEFAULT_SKIP_DIRECTORIES),
    signal,
  } = options

  const pattern = `**/*.{${[...MEDIA_EXTENSIONS].join(',')}}`
  const stream = fg.stream(pattern, {
    cwd: root,
    onlyFiles: true,
    dot: includeHidden,
    followSymbolicLinks: false,
    suppressErrors: true,
    unique: true,
    stats: true,
    caseSensitiveMatch: false,
    deep: maxDepth,
    ignore: [...skipDirectories].map(name => `**/${name}/**`),
  })

  const entries = []
  const directories = new Set()
  let truncated = false
  let timer
  const stop = () => { truncated = true; stream.destroy() }
  const onAbort = () => stop()

  timer = setTimeout(stop, budgetMs)
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    for await (const entry of stream) {
      if (signal?.aborted || entries.length >= maxEntries) { stop(); break }
      const extension = extensionOf(entry.path)
      const kind = kindOf(extension)
      if (kind === undefined) continue

      const relativePath = relative(workspaceRoot, join(root, entry.path)).split('\\').join('/')
      if (relativePath === '' || relativePath.startsWith('..')) continue

      const slash = relativePath.lastIndexOf('/')
      entries.push({
        relativePath,
        name: slash === -1 ? relativePath : relativePath.slice(slash + 1),
        ext: extension,
        kind,
        size: entry.stats?.size,
        mtimeMs: entry.stats?.mtimeMs === undefined ? undefined : Math.floor(entry.stats.mtimeMs),
      })
      if (slash !== -1) directories.add(relativePath.slice(0, slash))
      if (entries.length >= maxEntries) { stop(); break }
    }
  } catch (error) {
    // Destroying the stream is the normal stop path; surface real glob errors.
    if (!truncated && !signal?.aborted) throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'zh-CN', { numeric: true }))
  return { entries, scannedDirectories: directories.size, skippedEntries: 0, truncated }
}
