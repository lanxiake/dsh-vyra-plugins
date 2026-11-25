/**
 * Workspace file scan built on `fast-glob` (MIT).
 *
 * The scan only collects names, extensions and kinds. Size and modification
 * time are deliberately deferred to the batched `stat` route: calling `stat`
 * for every file is what made a workspace-wide file scan slow. The Host route
 * resolves the Session workspace with `workspaceFiles.scopeOf`, then this
 * module streams matching entries in one pass and caches the finished result
 * for a short window so tab switches do not re-walk the disk.
 */
import fg from 'fast-glob'
import { join, relative } from 'node:path'
import { extensionOf, kindOf } from './media-types.js'

/** Directories the scan never enters unless the caller opts in. */
export const VCS_DIRECTORIES = ['.git', '.hg', '.svn']

/** Everything skipped unless the caller opts into build/dependency folders. */
export const DEFAULT_SKIP_DIRECTORIES = [
  '.git', '.hg', '.svn', '.next', '.turbo', '.pnpm-store', '.yarn', '.cache',
  'node_modules', 'dist', 'build', 'coverage', 'vendor', 'out', 'target',
  '.venv', 'venv', '__pycache__', '.gradle', '.m2', 'Pods',
]

/** Default caps. The HTTP route accepts overrides within hard limits. */
export const SCAN_DEFAULTS = {
  maxEntries: 5000,
  maxDepth: 16,
  budgetMs: 12_000,
  includeHidden: false,
}

const CACHE_TTL_MS = 15_000
const CACHE_LIMIT = 8
const cache = new Map()
const inflight = new Map()

/**
 * Recursively collect every regular file under `root`.
 * @param {object} options - scan inputs.
 * @param {string} options.root - absolute directory to walk.
 * @param {string} options.workspaceRoot - absolute workspace root used for `relativePath`.
 * @param {number} [options.maxEntries] - entries to keep.
 * @param {number} [options.maxDepth] - directory levels below `root`.
 * @param {number} [options.budgetMs] - wall-clock budget.
 * @param {boolean} [options.includeHidden] - include dot-files and dot-directories.
 * @param {boolean} [options.includeBuild] - walk dependency and build directories.
 * @param {Set<string>} [options.skipDirectories] - directory names never entered.
 * @param {AbortSignal} [options.signal] - caller cancellation.
 * @returns {Promise<{ entries: Array<object>, folders: string[], scannedDirectories: number, truncated: boolean }>}
 */
export async function scanMedia(options) {
  const {
    root,
    workspaceRoot,
    maxEntries = SCAN_DEFAULTS.maxEntries,
    maxDepth = SCAN_DEFAULTS.maxDepth,
    budgetMs = SCAN_DEFAULTS.budgetMs,
    includeHidden = SCAN_DEFAULTS.includeHidden,
    includeBuild = false,
    skipDirectories = new Set(DEFAULT_SKIP_DIRECTORIES),
    signal,
  } = options

  const stream = fg.stream('**/*', {
    cwd: root,
    onlyFiles: false,
    markDirectories: true,
    dot: includeHidden,
    followSymbolicLinks: false,
    suppressErrors: true,
    unique: true,
    stats: false,
    caseSensitiveMatch: false,
    deep: maxDepth,
    ignore: [...(includeBuild ? VCS_DIRECTORIES : skipDirectories)].map(name => `**/${name}/**`),
  })

  const entries = []
  const folders = new Set()
  let truncated = false
  let timer
  const stop = () => { truncated = true; stream.destroy() }
  const onAbort = () => stop()

  timer = setTimeout(stop, budgetMs)
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    for await (const entryPath of stream) {
      if (signal?.aborted || entries.length >= maxEntries) { stop(); break }
      const relativePath = relative(workspaceRoot, join(root, entryPath)).split('\\').join('/')
      if (relativePath === '' || relativePath.startsWith('..')) continue

      if (entryPath.endsWith('/')) {
        const folder = relativePath.replace(/\\/g, '/').replace(/\/+$/u, '')
        if (folder === '') continue
        for (let current = folder; current !== '';) {
          folders.add(current)
          const index = current.lastIndexOf('/')
          current = index === -1 ? '' : current.slice(0, index)
        }
        continue
      }

      const slash = relativePath.lastIndexOf('/')
      const folder = slash === -1 ? '' : relativePath.slice(0, slash)
      entries.push({
        relativePath,
        name: slash === -1 ? relativePath : relativePath.slice(slash + 1),
        ext: extensionOf(relativePath),
        kind: kindOf(extensionOf(relativePath)),
        folder,
      })
      // Every ancestor is a folder, even when it holds no direct file.
      for (let current = folder; current !== '';) {
        folders.add(current)
        const index = current.lastIndexOf('/')
        current = index === -1 ? '' : current.slice(0, index)
      }
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
  return {
    entries,
    folders: [...folders].sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true })),
    scannedDirectories: folders.size,
    truncated,
  }
}

/** Cache key for one scan shape. */
function cacheKey(options) {
  return JSON.stringify([
    options.root,
    options.workspaceRoot,
    options.maxEntries,
    options.maxDepth,
    options.includeHidden === true,
    options.includeBuild === true,
  ])
}

/**
 * Scan with a short-lived cache. Concurrent callers share one walk; a finished
 * walk is reused for {@link CACHE_TTL_MS}. Mutations call
 * {@link invalidateScanCache} so the next read sees the change.
 * @param {object} options - same inputs as {@link scanMedia}, without `signal`.
 * @returns {Promise<object>} the scan result.
 */
export async function scanMediaCached(options) {
  const key = cacheKey(options)
  const hit = cache.get(key)
  if (hit !== undefined && Date.now() - hit.at < CACHE_TTL_MS) return hit.result

  const pending = inflight.get(key)
  if (pending !== undefined) return pending

  const run = scanMedia({ ...options, signal: undefined })
    .then(result => {
      cache.set(key, { at: Date.now(), result })
      if (cache.size > CACHE_LIMIT) {
        const oldest = [...cache.entries()].sort((left, right) => left[1].at - right[1].at)[0]
        if (oldest !== undefined) cache.delete(oldest[0])
      }
      return result
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, run)
  return run
}

/** Drop cached scans after a mutation or an explicit refresh. */
export function invalidateScanCache() {
  cache.clear()
}
