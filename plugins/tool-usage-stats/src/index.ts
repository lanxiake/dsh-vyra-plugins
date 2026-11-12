/**
 * Per-tool usage statistics: a durable global counter set, a per-session view,
 * and an HTTP endpoint the Web Client reads.
 *
 * Subscribes to `session/event` and folds the durable `tool/call` and
 * `tool/result` records — the events the log already carries, so no parallel
 * capture path can disagree with what actually ran. Each result increments a
 * cumulative counter and a daily bucket; the pair separates "used a lot once"
 * from "still in use", and cleanup decisions that read only the cumulative
 * total delete tools that are actively used.
 *
 * The plugin never blocks, delays, or alters a tool call. Counter failures are
 * contained: the listener catches, logs, and returns, so a defect here degrades
 * the report rather than the agent.
 *
 * @module vyra-tool-usage-stats
 */

import { record, report, resultIsError, takeName, type ToolUsageState, type ToolUsageReport } from './counters.ts'
import { GLOBAL_KEY, TABLE_NAME, toolUsageDomain } from './storage.ts'

/** Plugin name. */
export const name = 'vyra-tool-usage-stats'

/** `sessions` supplies the event declaration; the rest are read opportunistically. */
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
  /**
   * Endpoint path the Web Client reads. Must sit below the transport's `/api`
   * prefix: the route registry rejects any path it cannot express as an
   * endpoint of the shared API channel.
   */
  endpoint?: string
}

/** The session event members this plugin reads. */
interface SessionEvent {
  readonly type: string
  readonly data: unknown
}

/** Minimal Cordis surface this plugin uses, so the module needs no framework import. */
interface Context {
  on: (event: 'session/event', listener: (session: { id: string }, event: SessionEvent) => void) => void
  effect: (callback: () => (() => unknown) | undefined) => unknown
  get: (name: string) => unknown
}

/** Wire payload the Client receives. */
interface StatsResponse {
  readonly global: ToolUsageReport
  readonly sessions: Readonly<Record<string, ToolUsageReport>>
}

/**
 * The live statistics: one persistent counter set plus one set per session.
 *
 * The global set is what survives a restart; per-session sets are derived from
 * this process's observations and are not persisted, because a session's own
 * log is already the durable record of what it ran.
 */
class ToolUsageStats {
  private global: ToolUsageState = {}
  private readonly sessions = new Map<string, ToolUsageState>()

  /**
   * @param retainDays - daily buckets kept per tool.
   */
  constructor(private readonly retainDays: number) {}

  /** @returns the persistent counter set, replaced wholesale on each fold. */
  get globalState(): ToolUsageState {
    return this.global
  }

  /**
   * Adopt a counter set loaded from durable storage.
   * @param state - the restored counters.
   */
  restore(state: ToolUsageState): void {
    this.global = state
  }

  /**
   * Record one tool result in both the global and the session set.
   * @param sessionId - the session the call ran in.
   * @param toolName - the tool that ran.
   * @param isError - whether its result was a failure.
   * @param at - epoch milliseconds of the observation.
   */
  observe(sessionId: string, toolName: string, isError: boolean, at: number): void {
    this.global = record(this.global, toolName, isError, at, this.retainDays)
    const current = this.sessions.get(sessionId) ?? {}
    this.sessions.set(sessionId, record(current, toolName, isError, at, this.retainDays))
  }

  /** @returns the global and per-session reports the Client renders. */
  snapshot(): StatsResponse {
    return {
      global: report([this.global]),
      sessions: Object.fromEntries(
        [...this.sessions].map(([id, state]) => [id, report([state])]),
      ),
    }
  }
}

/**
 * Install the recorder, its durable store, and its HTTP endpoint.
 *
 * @param ctx - the Cordis context this row mounts into.
 * @param config - deployment's retention and endpoint choices.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const retainDays = config.retainDays ?? 90
  const endpoint = config.endpoint ?? '/api/vyra/tool-usage'
  const stats = new ToolUsageStats(retainDays)
  const logger = ctx.get('logger') as { warn?: (message: string) => void } | undefined

  // One map per session: results follow their call within the same session, and
  // the pairing map empties as results arrive.
  const pendingNames = new Map<string, Map<string, string>>()

  // Durable restore is best-effort. A composition without storageDomain keeps
  // the plugin working in memory, which is the documented degradation.
  const storageDomain = ctx.get('storageDomain') as {
    open: (spec: unknown) => Promise<{
      table: (name: string) => { get: (key: string) => unknown; put: (key: string, value: unknown) => Promise<void> }
      close: () => Promise<void>
    }>
  } | undefined

  let durable: {
    get: (key: string) => unknown
    put: (key: string, value: unknown) => Promise<void>
  } | undefined

  if (storageDomain !== undefined) {
    void (async () => {
      try {
        const domain = await storageDomain.open(toolUsageDomain)
        const table = domain.table(TABLE_NAME)
        durable = table
        const restored = table.get(GLOBAL_KEY)
        if (restored !== undefined) stats.restore(restored as ToolUsageState)
        ctx.effect(() => () => { void domain.close() })
      } catch (error) {
        // A broken store must not prevent recording.
        logger?.warn?.(`tool-usage-stats: storage unavailable, counters are in-memory only: ${String(error)}`)
      }
    })()
  }

  // Persisting on every tool call would write thousands of times per session.
  // A coarse interval keeps the durable copy close enough to survive a crash
  // while keeping the write path off the tool-call path entirely.
  const flushMs = 15_000
  let lastFlushed: ToolUsageState | undefined
  const flushTimer = setInterval(() => {
    if (durable === undefined || stats.globalState === lastFlushed) return
    lastFlushed = stats.globalState
    void durable.put(GLOBAL_KEY, stats.globalState).catch((error: unknown) => {
      logger?.warn?.(`tool-usage-stats: flush failed: ${String(error)}`)
    })
  }, flushMs)
  flushTimer.unref?.()
  ctx.effect(() => () => { clearInterval(flushTimer) })

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
    // The pairing id lives on the result message, not on the event: a
    // `tool/result` payload is `{ turn, step, message, error?, meta? }` and the
    // message carries `toolCallId`.
    const data = event.data as { message?: { toolCallId?: unknown } }
    const callId = data.message?.toolCallId
    if (typeof callId !== 'string') return

    const names = pendingNames.get(session.id)
    // A resumed session's earlier calls predate this process, so their names
    // are unknown. Counting them under a placeholder would invent a tool that
    // does not exist, so they are skipped.
    const toolName = names === undefined ? undefined : takeName(names, callId)
    if (toolName === undefined) return

    try {
      stats.observe(session.id, toolName, resultIsError(data), Date.now())
    } catch (error) {
      // Statistics are an observation, never a gate.
      logger?.warn?.(`tool-usage-stats: ${String(error)}`)
    }
  })

  // The Client reads through the Host's exact Fetch-route registry rather than
  // a Typert Remote method: Remotes require a declaration generated inside the
  // DSH repository, which an out-of-tree plugin cannot produce.
  const registerRoute = (): boolean => {
    const connection = ctx.get('connection') as {
      fetch?: { register: (route: {
        path: string
        methods: readonly string[]
        requestBody: string
        fetch: (request: Request) => Promise<Response>
      }) => () => Promise<void> }
    } | undefined

    if (connection?.fetch === undefined) return false

    try {
      const dispose = connection.fetch.register({
        path: endpoint,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => new Response(JSON.stringify(stats.snapshot()), {
          headers: { 'content-type': 'application/json' },
        }),
      })
      ctx.effect(() => () => { void dispose() })
      return true
    } catch (error) {
      // This callback runs inside a deferred fiber, so a throw here would
      // otherwise vanish: the endpoint would silently never exist.
      logger?.warn?.(`tool-usage-stats: cannot register ${endpoint}: ${String(error)}`)
      return true
    }
  }

  // `connection` belongs to the transport half of the composition, which may
  // activate after this row. Retry on the injectable service rather than
  // reading once at load, or the endpoint silently never appears.
  if (!registerRoute()) {
    logger?.warn?.('tool-usage-stats: connection not ready, waiting')
    const ctxWithInject = ctx as unknown as {
      inject?: (deps: string[], callback: (scoped: unknown) => void) => unknown
    }
    ctxWithInject.inject?.(['connection'], () => { registerRoute() })
  }
}
