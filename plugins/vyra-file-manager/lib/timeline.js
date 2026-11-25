/**
 * Session timeline data for the panel: one node per user message, with the
 * files that turn produced.
 *
 * The Host answers `GET /api/vyra-media/session-changes` with the Session log's
 * `user/message` events. Each node prefers the `workspace/changes` summary for
 * its turn and falls back to the files whose mtime lies inside the turn's time
 * window, so an unrecorded summary never blanks the timeline.
 */
import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { joinWorkspacePath, targetPathOf } from './paths.js'
import { scanMediaCached } from './scan.js'


const MAX_NODES = 300
const MAX_PROMPT_CHARS = 120

/** Pull plain text out of a user message's content blocks. */
function messageText(data) {
  const content = data?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join(' ')
}

/** Collapse whitespace and cut the prompt to a single readable line. */
function promptOf(data) {
  const text = messageText(data).replace(/\s+/gu, ' ').trim()
  if (text.length <= MAX_PROMPT_CHARS) return text
  return `${text.slice(0, MAX_PROMPT_CHARS)}…`
}

/**
 * Read a Session's event log however this Host exposes it. Order:
 * the live Session, a live Agent's session, the projection cache, and finally
 * the Session Controller's event feed.
 * @param {object} ctx - Host context.
 * @param {string} sessionId - Session identity.
 * @returns {Array<object>} session events, oldest first.
 */
async function sessionEventsOf(ctx, sessionId) {
  const { events, sources } = await readSessionEvents(ctx, sessionId)
  return events
}

/**
 * Read a Session's event log and report where it came from, so an empty
 * timeline can say which Host surface failed instead of looking like a bug.
 * @param {object} ctx - Host context.
 * @param {string} sessionId - Session identity.
 * @returns {Promise<{ events: Array<object>, sources: Array<object> }>} events plus probe facts.
 */
export async function readSessionEvents(ctx, sessionId) {
  const sources = []
  const record = (name, events, error) => {
    sources.push({ name, count: Array.isArray(events) ? events.length : 0, ...(error === undefined ? {} : { error: String(error) }) })
    return Array.isArray(events) && events.length > 0 ? events : undefined
  }

  /**
   * Cordis rejects a one-argument ctx.get() when the service is not mounted;
   * the two-argument form returns undefined instead. Every probe therefore uses
   * the non-throwing form and its own try/catch so one missing service never
   * hides the log that another service can serve.
   */
  const serviceOf = name => {
    if (typeof ctx?.get !== 'function') return undefined
    try { return ctx.get(name, false) } catch { return undefined }
  }

  const fromSession = session => {
    if (Array.isArray(session)) return session
    if (typeof session?.snapshotEvents === 'function') {
      try { return session.snapshotEvents() } catch { return undefined }
    }
    if (Array.isArray(session?.events)) return session.events
    return undefined
  }

  const probes = [
    ['sessions', () => serviceOf('sessions')?.get?.(sessionId)],
    ['agents', () => serviceOf('agents')?.get?.(sessionId)?.session],
    ['agentLoop', () => serviceOf('agentLoop')?.sessions?.get?.(sessionId)?.session],
    ['sessionController', () => serviceOf('sessionController')?.sessions?.get?.(sessionId)],
  ]
  for (const [name, resolve] of probes) {
    let candidate
    try { candidate = resolve() } catch (error) { record(name, undefined, error); continue }
    const hit = record(name, fromSession(candidate))
    if (hit !== undefined) return { events: hit, sources }
  }

  try {
    const cached = serviceOf('sessionProjectionCache')
    if (typeof cached?.snapshot === 'function') {
      const hit = record('sessionProjectionCache', fromSession(cached.snapshot(sessionId)?.events))
      if (hit !== undefined) return { events: hit, sources }
    } else {
      record('sessionProjectionCache', undefined, 'missing')
    }
  } catch (error) { record('sessionProjectionCache', undefined, error) }

  const persistence = serviceOf('sessionPersistence')
  if (typeof persistence?.open === 'function') {
    let handle
    try {
      handle = await persistence.open(sessionId, 'read')
      const result = await handle.read()
      const hit = record('sessionPersistence', Array.isArray(result?.events) ? result.events : [])
      if (hit !== undefined) return { events: hit, sources }
    } catch (error) {
      record('sessionPersistence', undefined, error)
    } finally {
      try { await handle?.close?.() } catch { /* ignore */ }
    }
  } else {
    record('sessionPersistence', undefined, 'missing')
  }

  return { events: [], sources }
}

/**
 * Build the timeline nodes: user messages plus the files each produced.
 * @param {object} args - inputs.
 * @param {object} args.ctx - Host context.
 * @param {string} args.sessionId - Session identity.
 * @param {string} args.workspaceRoot - absolute workspace root.
 * @param {object} args.fs - `ctx.fs`.
 * @param {Array<object>} [args.events] - pre-read session events.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<Array<object>>} timeline nodes, newest first.
 */
export async function buildTimeline({ ctx, sessionId, workspaceRoot, fs, events: given, signal }) {
  const events = Array.isArray(given) ? given : await sessionEventsOf(ctx, sessionId)
  if (events.length === 0) return []

  const prompts = []
  for (const event of events) {
    if (event?.type !== 'user/message') continue
    // Only messages the user actually sent. The log also carries injected
    // context (agent instructions, runtime snapshot, skill catalog, time
    // context); those have their own `source.kind` and must not be nodes.
    const kind = event.data?.source?.kind
    if (kind !== undefined && kind !== 'user') continue
    const text = promptOf(event.data)
    if (text === '') continue
    // Injected reminders can still arrive with `kind: 'user'`; skip pure
    // system envelopes so the axis lists real prompts only.
    if (/^<system-reminder>/u.test(text)) continue
    prompts.push({
      seq: event.seq,
      time: typeof event.time === 'number' ? event.time : undefined,
      prompt: text,
      turn: undefined,
    })
  }
  if (prompts.length === 0) return []

  const recent = prompts.slice(-MAX_NODES)

  // Turn summaries the Host still holds, keyed by the announcing event's seq.
  // `workspaceChanges` is not declared in this plugin's `inject`, so a property
  // read throws on Cordis ("cannot get property ... without inject"); the
  // non-throwing two-argument get returns undefined instead.
  const changes = new Map()
  let workspaceChanges
  try {
    workspaceChanges = typeof ctx?.get === 'function' ? ctx.get('workspaceChanges', false) : undefined
  } catch { workspaceChanges = undefined }
  for (const event of events) {
    if (event?.type !== 'workspace/changes') continue
    const turn = event.data?.turn
    const summary = typeof workspaceChanges?.summary === 'function'
      ? workspaceChanges.summary(sessionId, event.seq)
      : undefined
    if (typeof turn === 'number' && summary !== undefined) changes.set(turn, { summary, seq: event.seq })
  }

  // Files with size/mtime, so the window fallback has real timestamps.
  let files = []
  try {
    const scan = await scanMediaCached({ root: workspaceRoot, workspaceRoot, maxDepth: 16 })
    files = typeof fs?.resolve === 'function'
      ? await statTimestamps(scan.entries, { fs, workspaceRoot, signal })
      : []
  } catch { /* timeline still lists prompts without files */ }

  const resolved = []
  for (let index = 0; index < recent.length; index += 1) {
    const node = recent[index]
    const next = recent[index + 1]
    const start = node.time
    const end = next?.time ?? Number.MAX_SAFE_INTEGER
    let produced = []
    let source = 'none'

    // Prefer a recorded turn summary whose window matches this message.
    const summaryEntry = [...changes.values()].find(entry => {
      const turnTime = typeof entry.summary?.time === 'number' ? entry.summary.time : undefined
      if (turnTime !== undefined && start !== undefined) return turnTime >= start && turnTime < end
      return false
    })
    if (summaryEntry !== undefined && Array.isArray(summaryEntry.summary.files)) {
      produced = summaryEntry.summary.files.map(file => ({
        path: file.path,
        display: file.display ?? file.path,
        added: file.added ?? 0,
        deleted: file.deleted ?? 0,
        binary: file.binary === true,
      }))
      source = 'summary'
    } else if (start !== undefined) {
      produced = files
        .filter(file => file.mtimeMs >= start && file.mtimeMs < end)
        .map(file => ({
          path: file.relativePath,
          display: file.relativePath,
          added: 0,
          deleted: 0,
          binary: false,
          mtimeMs: file.mtimeMs,
        }))
      if (produced.length > 0) source = 'window'
    }

    resolved.push({ seq: node.seq, time: node.time, prompt: node.prompt, files: produced, source })
  }

  return resolved.reverse()
}

/** Attach mtime to scanned entries; `ctx.fs.stat` carries no timestamp. */
async function statTimestamps(entries, { fs, workspaceRoot, signal }) {
  const results = []
  let index = 0
  const worker = async () => {
    while (index < entries.length) {
      const entry = entries[index]
      index += 1
      if (signal?.aborted) return
      try {
        const target = await fs.resolve(joinWorkspacePath(workspaceRoot, entry.relativePath), { signal })
        const info = await stat(targetPathOf(fs, target))
        if (!info.isFile()) continue
        results.push({ relativePath: entry.relativePath, mtimeMs: info.mtimeMs })
      } catch { /* skip unreadable entries */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(24, entries.length) }, worker))
  return results.sort((left, right) => left.mtimeMs - right.mtimeMs)
}

/** Open a folder in the platform file manager. */
export function openInFileManager(absolutePath) {
  const launch = (command, args, verbatim = false) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      windowsVerbatimArguments: verbatim,
    })
    child.on('error', () => {})
    child.unref()
  }
  if (process.platform === 'win32') launch('explorer.exe', [absolutePath])
  else if (process.platform === 'darwin') launch('open', [absolutePath])
  else launch('xdg-open', [absolutePath])
}