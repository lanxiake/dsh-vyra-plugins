/**
 * Per-tool usage statistics for every Session this composition runs.
 *
 * Subscribes to `session/event` and folds durable `tool/call` and `tool/result`
 * records — the events the log already carries, so no parallel capture path can
 * disagree with what actually ran. Each result increments a cumulative counter
 * and a daily bucket; the pair is what separates "used a lot once" from "still
 * in use", and cleanup decisions that read only the cumulative total delete
 * tools that are actively used.
 *
 * The plugin never blocks, delays, or alters a tool call. Counter failures are
 * contained: the listener catches, logs, and returns, so a defect here degrades
 * the report rather than the agent.
 *
 * Counters live in memory for the life of the process. Durable storage is
 * deliberately absent from this version — see the README's Known Limitations.
 *
 * @module vyra-tool-usage-stats
 */

import { record, resultIsError, takeName, type ToolUsageState } from './counters.ts'

/** Plugin name. */
export const name = 'vyra-tool-usage-stats'

/** `sessions` supplies the `session/event` declaration this plugin listens on. */
export const inject = ['sessions']

/** Resolved plugin configuration. */
export interface Config {
  /**
   * Daily buckets retained per tool. Older buckets are dropped so a long-lived
   * installation does not grow without bound. Cumulative counters are never
   * trimmed: a tool's total answers "was this ever used", which trimming would
   * rewrite.
   */
  retainDays?: number
}

/** The subset of the Cordis context this plugin uses. */
interface Context {
  on: (event: 'session/event', listener: (session: { id: string }, event: SessionEvent) => void) => void
  get: (name: string) => unknown
}

/** The session event members this plugin reads. */
interface SessionEvent {
  readonly type: string
  readonly data: unknown
}

/**
 * The live counter set, exposed so a UI or command plugin can read it without
 * re-deriving from the log. Replaced on every fold, never mutated.
 */
class ToolUsageStats {
  private state: ToolUsageState = {}

  /**
   * @param retainDays - daily buckets kept per tool.
   */
  constructor(private readonly retainDays: number) {}

  /** @returns a snapshot of every counter, safe to serialize. */
  snapshot(): ToolUsageState {
    return this.state
  }

  /**
   * Record one tool result.
   * @param toolName - the tool that ran.
   * @param isError - whether its result was a failure.
   * @param at - epoch milliseconds of the observation.
   */
  observe(toolName: string, isError: boolean, at: number): void {
    this.state = record(this.state, toolName, isError, at, this.retainDays)
  }
}

/**
 * Install the recorder.
 * @param ctx - the Cordis context this row mounts into.
 * @param config - deployment's retention choice.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const stats = new ToolUsageStats(config.retainDays ?? 90)
  // `logger` is optional: a composition without it still records counters, and
  // a contained failure then has nowhere to report, which is preferable to
  // requiring a service this plugin does not need.
  const logger = ctx.get('logger') as { warn?: (message: string) => void } | undefined

  // One map per session: results always follow their call within the same
  // session, and the pairing map is emptied as results arrive. A call whose
  // result never arrives (process loss) leaves one entry per interrupted call,
  // which is bounded by the session's own call count.
  const pendingNames = new Map<string, Map<string, string>>()

  ctx.on('session/event', (session, event) => {
    if (event.type === 'tool/call') {
      const data = event.data as { callId?: unknown; name?: unknown }
      if (typeof data.callId !== 'string' || typeof data.name !== 'string') return
      let names = pendingNames.get(session.id)
      if (names === undefined) {
        names = new Map()
        pendingNames.set(session.id, names)
      }
      names.set(data.callId, data.name)
      return
    }

    if (event.type !== 'tool/result') return
    const data = event.data as { callId?: unknown }
    if (typeof data.callId !== 'string') return

    const names = pendingNames.get(session.id)
    // A resumed session's earlier calls predate this process, so their names
    // are unknown. Counting them under a placeholder would invent a tool that
    // does not exist, so they are skipped.
    const toolName = names === undefined ? undefined : takeName(names, data.callId)
    if (toolName === undefined) return

    try {
      stats.observe(toolName, resultIsError(data), Date.now())
    } catch (error) {
      // Statistics are an observation, never a gate.
      logger?.warn?.(`tool-usage-stats: ${String(error)}`)
    }
  })
}
