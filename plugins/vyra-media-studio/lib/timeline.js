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
  const fromSession = session => Array.isArray(session)
    ? session
    : (typeof session?.snapshotEvents === 'function'
      ? session.snapshotEvents()
      : (Array.isArray(session?.events) ? session.events : undefined))

  const candidates = [
    ctx.get?.('sessions')?.get?.(sessionId),
    ctx.get?.('agents')?.get?.(sessionId)?.session,
    ctx.get?.('sessionController')?.sessions?.get?.(sessionId),
  ]
  for (const candidate of candidates) {
    const events = fromSession(candidate)
    if (Array.isArray(events) && events.length > 0) return events
  }

  const cached = ctx.get?.('sessionProjectionCache')
  if (typeof cached?.snapshot === 'function') {
    try {
      const snapshot = cached.snapshot(sessionId)
      const events = fromSession(snapshot?.events)
      if (Array.isArray(events) && events.length > 0) return events
    } catch { /* fall through */ }
  }
  // Persisted log: works for cold Sessions and Hosts that hide the live object.
  const persistence = ctx.get?.('sessionPersistence')
  if (typeof persistence?.open === 'function') {
    let handle
    try {
      handle = await persistence.open(sessionId, 'read')
      const result = await handle.read()
      const events = Array.isArray(result?.events) ? result.events : []
      return events
    } catch { /* fall through to empty */ } finally {
      try { await handle?.close?.() } catch { /* ignore */ }
    }
  }
  return []
}

/**
 * Build the timeline nodes: user messages plus the files each produced.
 * @param {object} args - inputs.
 * @param {object} args.ctx - Host context.
 * @param {string} args.sessionId - Session identity.
 * @param {string} args.workspaceRoot - absolute workspace root.
 * @param {object} args.fs - `ctx.fs`.
 * @param {AbortSignal} [args.signal] - cancellation.
 * @returns {Promise<Array<object>>} timeline nodes, newest first.
 */
export async function buildTimeline({ ctx, sessionId, workspaceRoot, fs, signal }) {
  const events = await sessionEventsOf(ctx, sessionId)
  if (events.length === 0) return []

  const prompts = []
  for (const event of events) {
    if (event?.type !== 'user/message') continue
    if (event.data?.source?.kind === 'subagent') continue
    const text = promptOf(event.data)
    if (text === '') continue
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
  const changes = new Map()
  for (const event of events) {
    if (event?.type !== 'workspace/changes') continue
    const turn = event.data?.turn
    const summary = typeof ctx.workspaceChanges?.summary === 'function'
      ? ctx.workspaceChanges.summary(sessionId, event.seq)
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