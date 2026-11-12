/**
 * Per-tool usage statistics: call and failure counters, a failure audit, and
 * the HTTP endpoints the Web Client reads.
 *
 * Subscribes to `session/event` and folds the durable `tool/call` and
 * `tool/result` records — the events the log already carries, so no parallel
 * capture path can disagree with what actually ran.
 *
 * Two questions, two sources, deliberately not backing each other up:
 *
 * - **Cumulative counters** answer "was this tool ever used".
 * - **Daily buckets** answer "is it still in use".
 *
 * Reading the first as if it answered the second deletes tools that are
 * actively used, because a cumulative total is mostly history. A windowed read
 * therefore never falls back to the cumulative table.
 *
 * A count alone cannot say *why* a tool fails, and "why" is the whole input to
 * fixing it. Failures therefore also record a single-line summary of the reason
 * — from the model-facing content when the tool returns a failure, and from the
 * event's error member when it throws, because reading only one of those paths
 * leaves whole failure classes unattributable.
 *
 * The plugin never blocks, delays, or alters a tool call. Every failure here is
 * contained and logged.
 *
 * @module vyra-tool-usage-stats
 */

import {
  coverage, failureDetail, readResult, record, recordFailure, report, summarize, takeName, windowed,
  type Coverage, type FailureLog, type ToolUsageReport, type ToolUsageState,
} from './counters.ts'
import { SNAPSHOT_KEY, TABLE_NAME, toolUsageDomain, type Snapshot } from './storage.ts'

/** Plugin name. */
export const name = 'vyra-tool-usage-stats'

/** `sessions` supplies the event declaration this plugin listens on. */
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
  /** Failures retained per tool, newest first, for the audit. */
  retainFailures?: number
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
  inject: (services: string[], callback: (scoped: Context) => void) => unknown
}

/** What the Client receives from the read endpoint. */
interface StatsResponse {
  /** Cumulative counters over every observed call. */
  readonly global: ToolUsageReport
  /** Counters restricted to each requested window, keyed by day count. */
  readonly windows: Readonly<Record<string, ToolUsageReport>>
  /** One report per session this process observed. */
  readonly sessions: Readonly<Record<string, ToolUsageReport>>
  /** The retained failure audit, newest first per tool. */
  readonly failures: FailureLog
  /** Which days the daily buckets actually cover. */
  readonly coverage: Coverage
}

/**
 * The live statistics: the counters, the failure audit, and the durable handle.
 *
 * State is replaced wholesale on every fold so a snapshot handed to the store
 * or the HTTP response can never change underfoot.
 */
class ToolUsageStats {
  private counters: ToolUsageState = {}
  private failures: FailureLog = {}
  private readonly sessions = new Map<string, ToolUsageState>()

  /**
   * @param retainDays - daily buckets kept per tool.
   * @param retainFailures - failure samples kept per tool.
   */
  constructor(
    private readonly retainDays: number,
    private readonly retainFailures: number,
  ) {}

  /** @returns the snapshot to persist. */
  snapshot(): Snapshot {
    return { counters: this.counters, failures: this.failures }
  }

  /**
   * Adopt a snapshot loaded from durable storage.
   * @param loaded - the restored state.
   */
  restore(loaded: Snapshot): void {
    this.counters = loaded.counters
    this.failures = loaded.failures
  }

  /**
   * Record one tool result.
   * @param sessionId - the session the call ran in.
   * @param toolName - the tool that ran.
   * @param isError - whether its result was a failure.
   * @param at - epoch milliseconds of the observation.
   * @param failure - the reason summary and code, when it failed.
   */
  observe(
    sessionId: string,
    toolName: string,
    isError: boolean,
    at: number,
    failure: { summary: string; code?: string },
  ): void {
    this.counters = record(this.counters, toolName, isError, at, this.retainDays)
    const current = this.sessions.get(sessionId) ?? {}
    this.sessions.set(sessionId, record(current, toolName, isError, at, this.retainDays))

    if (isError) {
      this.failures = recordFailure(this.failures, {
        at,
        summary: failure.summary,
        tool: toolName,
        ...(failure.code === undefined ? {} : { code: failure.code }),
      }, this.retainFailures)
    }
  }

  /**
   * Build the response for one request.
   * @param windows - day counts to include, each 0 or less meaning cumulative.
   * @returns the report set.
   */
  view(windows: readonly number[]): StatsResponse {
    const now = Date.now()
    return {
      global: report(this.counters),
      windows: Object.fromEntries(
        windows
          .filter(days => days > 0)
          .map(days => [String(days), report(windowed(this.counters, days, now))]),
      ),
      sessions: Object.fromEntries(
        [...this.sessions].map(([id, state]) => [id, report(state)]),
      ),
      failures: this.failures,
      coverage: coverage(this.counters, this.retainDays),
    }
  }
}

/** Day counts the read endpoint reports by default. */
const DEFAULT_WINDOWS = [7, 30] as const

/** How often the durable snapshot is written. */
const FLUSH_MS = 15_000

/**
 * Install the recorder, its durable store, and its endpoints.
 *
 * @param ctx - the Cordis context this row mounts into.
 * @param config - deployment's retention and endpoint choices.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const retainDays = config.retainDays ?? 90
  const retainFailures = config.retainFailures ?? 20
  const stats = new ToolUsageStats(retainDays, retainFailures)
  const logger = ctx.get('logger') as { warn?: (message: string) => void } | undefined

  // One map per session: results follow their call within the same session, and
  // the pairing map empties as results arrive.
  const pendingNames = new Map<string, Map<string, string>>()

  /** The durable table, once the storage service activates. */
  let durable: {
    get: (key: string) => unknown
    put: (key: string, value: unknown) => Promise<void>
  } | undefined

  // `storageDomain` — like `connection` below — is provided by a fiber that may
  // activate after this row, so it must be waited for. Reading it once at
  // activation yields undefined and the counters silently never persist.
  const openDurable = (scoped: Context): void => {
    const storageDomain = scoped.get('storageDomain') as {
      open: (spec: unknown) => Promise<{
        table: (name: string) => { get: (key: string) => unknown; put: (key: string, value: unknown) => Promise<void> }
        close: () => Promise<void>
      }>
    } | undefined
    if (storageDomain === undefined) return

    void (async () => {
      try {
        const domain = await storageDomain.open(toolUsageDomain)
        const table = domain.table(TABLE_NAME)
        durable = table
        const restored = table.get(SNAPSHOT_KEY)
        if (restored !== undefined) stats.restore(restored as Snapshot)
        scoped.effect(() => () => { void domain.close() })
      } catch (error) {
        logger?.warn?.(`tool-usage-stats: storage unavailable, counters are in-memory only: ${String(error)}`)
      }
    })()
  }

  if (ctx.get('storageDomain') === undefined) ctx.inject(['storageDomain'], openDurable)
  else openDurable(ctx)

  // Persisting on every tool call would write thousands of times per session.
  // A coarse interval keeps the durable copy close enough to survive a crash
  // while keeping the write path off the tool-call path entirely.
  let lastFlushed: Snapshot | undefined
  const flushTimer = setInterval(() => {
    if (durable === undefined) return
    const current = stats.snapshot()
    if (current.counters === lastFlushed?.counters && current.failures === lastFlushed?.failures) return
    lastFlushed = current
    void durable.put(SNAPSHOT_KEY, current).catch((error: unknown) => {
      logger?.warn?.(`tool-usage-stats: flush failed: ${String(error)}`)
    })
  }, FLUSH_MS)
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
    const result = readResult(event.data)
    if (result === undefined) return

    const names = pendingNames.get(session.id)
    // A resumed session's earlier calls predate this process, so their names
    // are unknown. Counting them under a placeholder would invent a tool that
    // does not exist, so they are skipped.
    const toolName = names === undefined ? undefined : takeName(names, result.callId)
    if (toolName === undefined) return

    try {
      const detail = failureDetail(event.data, result)
      stats.observe(session.id, toolName, result.isError, Date.now(), detail)
    } catch (error) {
      // Statistics are an observation, never a gate.
      logger?.warn?.(`tool-usage-stats: ${String(error)}`)
    }
  })

  // The Client reads through the Host's exact Fetch-route registry rather than
  // a Typert Remote method: Remotes require a declaration generated inside the
  // DSH repository, which an out-of-tree plugin cannot produce.
  const registerRoutes = (): boolean => {
    const connection = ctx.get('connection') as {
      fetch?: { register: (route: {
        path: string
        methods: readonly string[]
        requestBody: string
        fetch: (request: Request) => Promise<Response>
      }) => () => Promise<void> }
    } | undefined
    if (connection?.fetch === undefined) return false

    const json = (body: unknown): Response => new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    })

    try {
      const disposers = [
        connection.fetch.register({
          path: config.endpoint ?? '/api/vyra/tool-usage',
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const requested = new URL(request.url).searchParams.getAll('window')
              .map(value => Number.parseInt(value, 10))
              .filter(value => Number.isFinite(value))
            return json(stats.view(requested.length === 0 ? [...DEFAULT_WINDOWS] : requested))
          },
        }),
        // The audit export is a separate route because it is a download, not a
        // panel read: the Client hands it to the browser rather than rendering it.
        connection.fetch.register({
          path: config.endpoint === undefined ? '/api/vyra/tool-usage/export' : `${config.endpoint}/export`,
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: async () => new Response(JSON.stringify(buildExport(stats), undefined, 2), {
            headers: {
              'content-type': 'application/json',
              'content-disposition': `attachment; filename="tool-usage-${new Date().toISOString().slice(0, 10)}.json"`,
            },
          }),
        }),
      ]
      ctx.effect(() => () => { for (const dispose of disposers) void dispose() })
      return true
    } catch (error) {
      // This callback runs inside a deferred fiber, so a throw here would
      // otherwise vanish: the endpoints would silently never exist.
      logger?.warn?.(`tool-usage-stats: cannot register endpoints: ${String(error)}`)
      return true
    }
  }

  if (!registerRoutes()) ctx.inject(['connection'], () => { registerRoutes() })
}

/** The exported document shape. */
interface ExportPayload {
  readonly exportedAt: number
  readonly coverage: Coverage
  readonly totals: readonly { tool: string; count: number; errorCount: number; lastUsedAt: number }[]
  readonly failures: readonly { tool: string; at: number; code?: string; summary: string }[]
}

/**
 * Build the offline-analysis export.
 *
 * Optimizing a tool surface needs the raw material: which tools are called, how
 * often they fail, when they were last used, and what the failures said. The
 * panel shows all of it, and the export exists so it can leave the app and be
 * aggregated across machines.
 *
 * @param stats - the live statistics.
 * @returns the export document.
 */
function buildExport(stats: ToolUsageStats): ExportPayload {
  const view = stats.view([0])
  const failures = Object.values(view.failures)
    .flat()
    .sort((left, right) => right.at - left.at)
    .map(sample => ({
      tool: sample.tool,
      at: sample.at,
      ...(sample.code === undefined ? {} : { code: sample.code }),
      summary: sample.summary,
    }))

  return {
    exportedAt: Date.now(),
    coverage: view.coverage,
    totals: view.global.rows.map(row => ({
      tool: row.tool,
      count: row.count,
      errorCount: row.errorCount,
      lastUsedAt: row.lastUsedAt,
    })),
    failures,
  }
}

export { summarize }
