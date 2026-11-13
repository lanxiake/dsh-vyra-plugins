/**
 * Per-tool usage statistics that feed a self-improvement loop.
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
 * Those reasons are then put back to the agent. A scheduled job asks it to
 * diagnose the tools that keep failing and to propose a change; an approved
 * proposal replaces the tool's description, its parameters, or wraps its
 * implementation. The model reads what it proposed on the next step of the
 * session it is already in, not on a later one.
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
import { DEFAULT_POLICY, type AnalysisPolicy, type DiagnosisTarget } from './analysis.ts'
import {
  EMPTY_STATE, applyRun, describeTool, dismiss, prepareRun, resolveChange,
  type AppliedChange, type DiagnosisState, type PendingDiagnosis, type RegisteredTool,
} from './diagnose.ts'
import { LEGACY_KEY, SNAPSHOT_KEY, TABLE_NAME, toolUsageDomain, type Snapshot } from './storage.ts'

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
  /**
   * Failures since the last analysis before a tool is worth diagnosing. A
   * single transient failure does not justify asking the model about it.
   */
  minFailures?: number
  /** Minimum days between analyses of the same tool. */
  cooldownDays?: number
  /**
   * Hours between scheduled analysis runs. Zero disables the schedule and
   * leaves manual runs, which is the right choice for a deployment paying per
   * token.
   */
  analyzeEveryHours?: number
}

/** The session event members this plugin reads. */
interface SessionEvent {
  readonly type: string
  readonly data: unknown
}

/** A model-visible message the plugin contributes to a step. */
interface InjectableMessage {
  readonly role: 'user'
  readonly content: readonly { readonly type: 'text'; readonly text: string }[]
  readonly source: { readonly kind: string }
}

/**
 * What `agent/pre-step` hands its listeners.
 *
 * The agent is a field of the payload, not the payload itself: an early version
 * of this listener read `payload.session` and threw on every step, which the
 * contained catch turned into a silently absent diagnosis.
 */
interface PreStepPayload {
  readonly agent: AgentLike
  readonly messages: readonly unknown[]
  readonly turn: number
  readonly step: number
  readonly signal?: AbortSignal
}

/**
 * The step decision a `agent/pre-step` listener returns.
 *
 * Declared structurally rather than imported: an out-of-tree plugin has no
 * dependency on the harness packages, so the fields it reads and writes are
 * stated here.
 */
interface PreStepDecision {
  readonly kind: 'reject' | 'enter'
  readonly messages?: readonly unknown[]
  readonly [key: string]: unknown
}

/** Minimal Cordis surface this plugin uses, so the module needs no framework import. */
interface Context {
  on: {
    (event: 'session/event', listener: (session: { id: string }, event: SessionEvent) => void): void
    (event: 'session/flush', listener: () => Promise<void> | void): void
    (event: 'agent/pre-step', listener: (
      payload: PreStepPayload,
      next: () => Promise<PreStepDecision>,
    ) => Promise<PreStepDecision>): void
    (event: 'agent/created', listener: (payload: { agent: AgentLike }) => void): void
    (event: 'agent/disposed', listener: (payload: { agent: AgentLike }) => void): void
  }
  effect: (callback: () => (() => unknown) | undefined) => unknown
  get: (name: string) => unknown
  inject: (services: string[], callback: (scoped: Context) => void) => unknown
}

/** The agent members this plugin reads. */
interface AgentLike {
  readonly session: { readonly id: string }
  readonly ctx?: unknown
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
  /** Proposals awaiting a decision, and what has already been changed. */
  readonly diagnosis: {
    readonly pending: readonly PendingDiagnosis[]
    readonly applied: readonly AppliedChange[]
    readonly lastRunAt: number
    readonly analyzing: boolean
  }
}

/**
 * The live statistics: the counters, the failure audit, the diagnosis state,
 * and the durable handle.
 *
 * State is replaced wholesale on every fold so a snapshot handed to the store
 * or the HTTP response can never change underfoot.
 */
class ToolUsageStats {
  private counters: ToolUsageState = {}
  private failures: FailureLog = {}
  private diagnosis: DiagnosisState = EMPTY_STATE
  private applied: readonly AppliedChange[] = []
  /** Set while a scheduled analysis is in flight, so one run is not stacked on another. */
  private analyzing = false
  private readonly sessions = new Map<string, ToolUsageState>()

  /** The diagnosis settings the panel shows and edits. */
  settings: { analyzeEveryHours: number; minFailures: number; cooldownDays: number } =
    { analyzeEveryHours: 24, minFailures: 5, cooldownDays: 7 }

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
    return {
      counters: this.counters,
      failures: this.failures,
      diagnosis: {
        history: this.diagnosis.history,
        pending: this.diagnosis.pending,
        lastRunAt: this.diagnosis.lastRunAt,
      },
    }
  }

  /**
   * Adopt a snapshot loaded from durable storage.
   * @param loaded - the restored state.
   */
  restore(loaded: Snapshot): void {
    this.counters = loaded.counters
    this.failures = loaded.failures
    this.diagnosis = loaded.diagnosis === undefined
      ? EMPTY_STATE
      : {
        history: loaded.diagnosis.history,
        pending: loaded.diagnosis.pending,
        lastRunAt: loaded.diagnosis.lastRunAt,
      }
  }

  /** @returns the counters, for the analysis to read. */
  get currentCounters(): ToolUsageState {
    return this.counters
  }

  /** @returns the failure audit, for the analysis to read. */
  get currentFailures(): FailureLog {
    return this.failures
  }

  /** @returns the diagnosis state. */
  get diagnosisState(): DiagnosisState {
    return this.diagnosis
  }

  /** @returns whether a prepared run is waiting for a step to carry it. */
  get isAnalyzing(): boolean {
    return this.analyzing
  }

  /**
   * Record that a request is prepared and waiting to be delivered.
   *
   * Not a lock: a second request replaces the first, which is the honest
   * behaviour for "prepare the current diagnosis". A lock would strand the flag
   * whenever a user asked and then never sent a message.
   */
  beginAnalysis(): void {
    this.analyzing = true
  }

  /** Record that the prepared request has been delivered and settled. */
  endAnalysis(): void {
    this.analyzing = false
  }

  /**
   * Replace the diagnosis state.
   * @param next - the state to adopt.
   */
  setDiagnosis(next: DiagnosisState): void {
    this.diagnosis = next
  }

  /**
   * Drop one proposal and record nothing about it.
   * @param tool - the tool whose proposal to drop.
   */
  dismissProposal(tool: string): void {
    this.diagnosis = dismiss(this.diagnosis, tool)
  }

  /**
   * Record that a tool's definition changed, so it can be reviewed later.
   * @param change - what changed.
   */
  recordApplied(change: AppliedChange): void {
    // Newest first, bounded: the list is a review aid, not an audit log.
    this.applied = [change, ...this.applied].slice(0, 50)
  }

  /** @returns the applied changes, newest first. */
  get appliedChanges(): readonly AppliedChange[] {
    return this.applied
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
      diagnosis: {
        pending: this.diagnosis.pending,
        applied: this.applied,
        lastRunAt: this.diagnosis.lastRunAt,
        analyzing: this.analyzing,
        settings: this.settings,
      },
    }
  }
}

/** Day counts the read endpoint reports by default. */
const DEFAULT_WINDOWS = [7, 30] as const

/**
 * Whether two snapshots hold the same content.
 *
 * `snapshot()` builds a fresh object each call, so the outer references always
 * differ and comparing them would write on every tick. The diagnosis half is
 * compared by the revision of its parts, which is what changes when a run
 * finishes or a proposal is decided.
 *
 * @param left - the snapshot last written.
 * @param right - the candidate.
 * @returns whether persisting `right` after `left` would change anything.
 */
function sameSnapshot(left: Snapshot | undefined, right: Snapshot): boolean {
  if (left === undefined) return false
  if (left.counters !== right.counters || left.failures !== right.failures) return false
  return left.diagnosis?.lastRunAt === right.diagnosis?.lastRunAt
    && left.diagnosis?.pending === right.diagnosis?.pending
    && left.diagnosis?.history === right.diagnosis?.history
}

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

  /**
   * The targets a diagnosis request asked about, by session, held until the
   * answer arrives. Matching by session keeps an unrelated assistant message
   * from being read as a diagnosis.
   */
  const awaiting = new Map<string, readonly DiagnosisTarget[]>()

  /** A run a user asked for, sent on the next step of that session. */
  const requestedFrom = new Map<string, { prompt: string; targets: readonly DiagnosisTarget[] }>()

  /**
   * Changes the user approved, waiting for a step to apply them in.
   *
   * A swap has to run inside the agent's scope, and the only plugin code that
   * runs there is a step listener. The delay is one step, and the alternative —
   * applying from the request thread — cannot resolve the tool at all.
   */
  const queued: { tool: string; change: ResolvedChange }[] = []

  /**
   * Apply anything queued, from inside an agent's scope.
   * @param agent - the agent whose step is starting.
   */
  function applyQueued(agent: AgentLike | undefined): void {
    if (queued.length === 0) return
    const tools = (agent as { ctx?: { tools?: unknown } } | undefined)?.ctx?.tools
    if (tools === undefined) return

    for (const item of queued.splice(0, queued.length)) {
      const result = swapIn(tools as ToolRegistry, item.tool, item.change, swaps, stats, logger)
      if (!result.ok) {
        logger?.warn?.(`tool-usage-stats: cannot apply to ${item.tool}: ${result.detail}`)
      }
    }
  }

  /**
   * What this plugin has replaced, by tool name. A second change replaces this
   * registration rather than stacking another one on the original.
   */
  const swaps = new Map<string, () => void>()

  /**
   * The scheduled run.
   *
   * A plain interval rather than a job or a schedule record: `ctx.jobs` needs a
   * tool controller and a session owner, and `ctx.schedule` delivers a prompt to
   * a conversation rather than calling back into a plugin. Neither fits, and the
   * work here is only to decide whether a diagnosis is due — the request itself
   * still rides on a step.
   *
   * Zero disables it, which leaves manual runs and is the right choice for a
   * deployment paying per token.
   */
  const analyzeEveryHours = config.analyzeEveryHours ?? 24
  if (analyzeEveryHours > 0) {
    const timer = setInterval(() => {
      try {
        // Already waiting for a step to carry one: preparing again would only
        // replace an identical request and log the same line every tick.
        if (requestedFrom.size > 0) return
        // Nothing to deliver to until a session exists; the next tick retries.
        const agents = (ctx.get('agents') as { list?: () => readonly AgentLike[] } | undefined)
        const live = agents?.list?.() ?? []
        if (live.length === 0) return

        const prepared = prepareRun(
          stats.currentCounters, stats.currentFailures, stats.diagnosisState, policy, Date.now(),
        )
        if (prepared === undefined) return

        // Every live session may deliver it; whichever takes a step first does.
        // A session that never does costs nothing — the entry is replaced on the
        // next tick and dropped when that session's next step consumes it.
        for (const agent of live) {
          const id = agent?.session?.id
          if (id !== undefined) requestedFrom.set(id, prepared)
        }
        stats.beginAnalysis()
        logger?.warn?.(`tool-usage-stats: scheduled diagnosis queued for ${live.length} session(s)`)
      } catch (error) {
        // A scheduled extra must never take the process down.
        logger?.warn?.(`tool-usage-stats: scheduled analysis failed: ${String(error)}`)
      }
    }, analyzeEveryHours * 60 * 60 * 1000)
    timer.unref?.()
    ctx.effect(() => () => { clearInterval(timer) })
  }

  /** The durable table, once the storage service activates. */  let durable: {
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
        // Read the current key first, then the 0.1.x key: an installation
        // upgrading from 0.1.x keeps the history it was reading, and the first
        // flush after this rewrites it under the current key.
        const restored = table.get(SNAPSHOT_KEY) ?? table.get(LEGACY_KEY)
        if (restored !== undefined) stats.restore(restored as Snapshot)
        scoped.effect(() => () => { void domain.close() })
      } catch (error) {
        logger?.warn?.(`tool-usage-stats: storage unavailable, counters are in-memory only: ${String(error)}`)
      }
    })()
  }

  if (ctx.get('storageDomain') === undefined) ctx.inject(['storageDomain'], openDurable)
  else openDurable(ctx)

  /** The snapshot last handed to the store, so an unchanged one is not rewritten. */
  let lastFlushed: Snapshot | undefined
  const flush = (): Promise<void> => {
    if (durable === undefined) return Promise.resolve()
    const current = stats.snapshot()
    // Every part of the snapshot counts as a change: comparing only the counters
    // and the audit skipped writes when a diagnosis arrived, so a proposal was
    // produced, shown in memory, and then lost on exit.
    if (sameSnapshot(lastFlushed, current)) return Promise.resolve()
    lastFlushed = current
    return durable.put(SNAPSHOT_KEY, current).catch((error: unknown) => {
      logger?.warn?.(`tool-usage-stats: flush failed: ${String(error)}`)
    })
  }

  const flushTimer = setInterval(() => { void flush() }, FLUSH_MS)
  flushTimer.unref?.()
  ctx.effect(() => () => { clearInterval(flushTimer) })

  // `session/flush` is the awaited durability checkpoint the store dispatches
  // before a session's events are considered persisted, and a short-lived run
  // drains through it on teardown. The interval alone is not enough there: a
  // headless task finishes inside it and everything it observed is lost.
  // A disposer cannot cover this — a returned Promise is not awaited.
  ctx.on('session/flush' as never, (() => flush()) as never)

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

    if (event.type !== 'tool/result') {
      // An assistant message may carry the answer to a diagnosis request.
      if (event.type === 'assistant/message') readAnswer(session.id, event)
      return
    }
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

  // ── Diagnosis ────────────────────────────────────────────────────────────
  //
  // A run asks the model about the tools that keep failing, and the answer
  // becomes a proposal the user decides on. Nothing is applied automatically:
  // a diagnosis is a hypothesis, and changing a live tool on one is how a
  // misread becomes a silent behaviour change.

  const policy: AnalysisPolicy = {
    minFailures: config.minFailures ?? DEFAULT_POLICY.minFailures,
    cooldownDays: config.cooldownDays ?? DEFAULT_POLICY.cooldownDays,
  }
  stats.settings = {
    analyzeEveryHours: config.analyzeEveryHours ?? 24,
    minFailures: policy.minFailures,
    cooldownDays: policy.cooldownDays,
  }

  /** Definitions of the tools the registry currently holds, by name. */
  const toolDefinitions = (): Map<string, RegisteredTool> => {
    const tools = ctx.get('tools') as { definitions?: () => unknown } | undefined
    const definitions = tools?.definitions?.() ?? []
    const out = new Map<string, RegisteredTool>()
    for (const definition of definitions as readonly unknown[]) {
      const described = describeTool(definition)
      if (described.name !== '') out.set(described.name, described)
    }
    return out
  }

  /**
   * Ask the model to diagnose, from the session whose turn is running.
   *
   * The request goes into `decision.messages` rather than through
   * `agent.inject()`: an injected message is durable context the NEXT request
   * sees, and waits for one. A user who pressed a button expects the answer on
   * the step that follows.
   *
   * @param agent - the agent whose step is starting.
   * @param next - the downstream decision.
   * @returns the decision, with the diagnosis request appended when there is one.
   */
  const askOnStep = async (
    payload: PreStepPayload,
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    // The agent is a field of the payload, not the payload itself. Reading
    // `payload.session` here threw on every step once, and the contained catch
    // turned that into a silently absent diagnosis.
    const sessionId = payload?.agent?.session?.id
    // A pending change is applied here, not from the HTTP request that queued
    // it. Tool resolution is scope-bound: the plugin's own view returns
    // `undefined` for every tool, and only the agent's scope — live here —
    // resolves one. Measured in both places.
    if (sessionId !== undefined) applyQueued(payload?.agent)
    try {
      if (decision.kind === 'reject' || sessionId === undefined) return decision
      const requested = requestedFrom.get(sessionId)
      const prepared = requested ?? prepareRun(stats.currentCounters, stats.currentFailures, stats.diagnosisState, policy, Date.now())
      if (prepared === undefined) return decision

      // Remember what this run asked about, so the answer can be matched to it
      // when the assistant message arrives.
      awaiting.set(sessionId, prepared.targets)
      if (requested === undefined) {
        // A scheduled or automatic run: record it so the cooldown starts now and
        // the next step does not ask the same question again.
        stats.setDiagnosis({ ...stats.diagnosisState, lastRunAt: Date.now() })
      }
      requestedFrom.delete(sessionId)
      // The request is out, which is what the flag guarded. Releasing it here
      // rather than only on the answer keeps a request the user never follows up
      // on from blocking every later one.
      stats.endAnalysis()

      const text = diagnosisMessage(prepared.prompt)

      return {
        ...decision,
        messages: [
          ...(decision.messages ?? []),
          { role: 'user', content: [{ type: 'text', text }], source: { kind: 'vyra-tool-usage-stats' } },
        ],
      }
    } catch (error) {
      // A diagnosis is an extra; the step it rides on must still run.
      process.stderr.write(`[vyra] pre-step failed: ${String(error)}\n`)
      logger?.warn?.(`tool-usage-stats: diagnosis prompt failed: ${String(error)}`)
      return decision
    }
  }

  ctx.on('agent/pre-step' as never, askOnStep as never)

  /**
   * Read a completed diagnosis out of an assistant message and turn it into
   * proposals.
   *
   * Matched by session: the run's targets are held from the step that asked, so
   * an unrelated answer cannot be mistaken for a diagnosis.
   *
   * @param sessionId - the session the message belongs to.
   * @param event - the assistant message event.
   */
  const readAnswer = (sessionId: string, event: SessionEvent): void => {
    const targets = awaiting.get(sessionId)
    if (targets === undefined) return
    try {
      const data = event.data as { message?: { content?: unknown } }
      const content = data.message?.content
      if (!Array.isArray(content)) return
      const text = content
        .filter((block): block is { type: string; text: string } =>
          typeof block === 'object' && block !== null
          && (block as { type?: unknown }).type === 'text'
          && typeof (block as { text?: unknown }).text === 'string')
        .map(block => block.text)
        .join('\n')
      if (text === '') {
        return
      }

      awaiting.delete(sessionId)
      requestedFrom.delete(sessionId)
      const definitions = toolDefinitions()
      const next = applyRun(
        stats.diagnosisState,
        stats.currentCounters,
        targets,
        text,
        definitions,
        Date.now(),
      )
      stats.setDiagnosis(next)
      stats.endAnalysis()
    } catch (error) {
      awaiting.delete(sessionId)
      stats.endAnalysis()
      logger?.warn?.(`tool-usage-stats: reading a diagnosis failed: ${String(error)}`)
    }
  }

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

    const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
    const base = config.endpoint ?? '/api/vyra/tool-usage'

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
        // Requesting a diagnosis only queues it: the answer arrives on the next
        // step of a live session, which is the only place the model can be asked.
        connection.fetch.register({
          path: `${base}/diagnose`,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => ({})) as { sessionId?: unknown }
            const requested = typeof body.sessionId === 'string' ? body.sessionId : undefined

            const prepared = prepareRun(
              stats.currentCounters, stats.currentFailures, stats.diagnosisState, policy, Date.now(),
            )
            if (prepared === undefined) {
              return json({
                ok: false,
                detail: `没有达到分析条件的工具（需要新增失败 ≥ ${policy.minFailures} 次，且距上次分析 ≥ ${policy.cooldownDays} 天）`,
              }, 409)
            }

            // No session to deliver to? Make one and wake it. A diagnosis is a
            // plain question, so it needs a conversation and nothing else, and a
            // freshly created agent is idle — the request would sit unread
            // forever without the follow-up.
            let sessionId = requested
            let created = false
            if (sessionId === undefined) {
              const agents = ctx.get('agents') as {
                create?: (options: { sessionId: string }) => Promise<{ agent?: { followup?: (message: unknown) => void } }>
              } | undefined
              if (agents?.create === undefined) {
                return json({ ok: false, detail: '无法新建会话：agents 服务不可用' }, 503)
              }
              try {
                sessionId = `vyra-diagnosis-${Date.now().toString(36)}`
                const handle = await agents.create({ sessionId })
                created = true
                const agent = (handle as { agent?: { followup?: (message: unknown) => void } })?.agent
                // The prompt goes in as the conversation's first message so the
                // session is not empty, and so the request is the thing being
                // answered rather than an aside.
                agent?.followup?.({
                  role: 'user',
                  content: [{ type: 'text', text: diagnosisMessage(prepared.prompt) }],
                  source: { kind: 'user' },
                })
                stats.beginAnalysis()
                return json({
                  ok: true,
                  sessionId,
                  created,
                  targets: prepared.targets.map(target => target.tool),
                })
              } catch (error) {
                return json({ ok: false, detail: `新建会话失败：${String(error)}` }, 500)
              }
            }

            // Replaces any request already waiting: the user is asking for the
            // current diagnosis, and one prepared a moment ago is staler.
            stats.beginAnalysis()
            requestedFrom.set(sessionId, prepared)
            return json({
              ok: true,
              sessionId,
              created,
              targets: prepared.targets.map(target => target.tool),
            })
          },
        }),
        // Applying a proposal is the only path that changes a live tool.
        connection.fetch.register({
          path: `${base}/apply`,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => ({})) as { tool?: unknown }
            const toolName = typeof body.tool === 'string' ? body.tool : undefined
            if (toolName === undefined) return json({ ok: false, detail: '需要 tool' }, 400)

            const proposal = stats.diagnosisState.pending.find(entry => entry.tool === toolName)
            if (proposal === undefined) return json({ ok: false, detail: `没有 ${toolName} 的待处理建议` }, 404)

            const resolved = resolveChange(proposal.change)
            if (typeof resolved === 'string') return json({ ok: false, detail: resolved }, 422)

            // Queued, not applied here: a swap must run inside the agent's
            // scope, which no request thread is. The next step applies it.
            queued.push({ tool: toolName, change: resolved })
            stats.dismissProposal(toolName)
            return json({
              ok: true,
              tool: toolName,
              applied: proposal.change.kind,
              note: '改动会在该会话的下一步生效',
            })
          },
        }),
        // Dismissing costs nothing, so it succeeds even when the proposal is gone.
        connection.fetch.register({
          path: `${base}/dismiss`,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => ({})) as { tool?: unknown }
            const toolName = typeof body.tool === 'string' ? body.tool : undefined
            if (toolName === undefined) return json({ ok: false, detail: '需要 tool' }, 400)
            stats.dismissProposal(toolName)
            return json({ ok: true })
          },
        }),
        // Configuration is edited through the Host's own config editor rather
        // than by writing the profile file: the editor owns the file lock, the
        // bundle reconciliation, and the reload that makes a change take effect.
        connection.fetch.register({
          path: `${base}/config`,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => ({})) as {
              analyzeEveryHours?: unknown
              minFailures?: unknown
              cooldownDays?: unknown
            }

            const editor = ctx.get('configEditor') as {
              entries?: () => readonly { options: { id: string } }[]
              edit?: (
                entry: unknown,
                change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
              ) => Promise<void>
            } | undefined
            const entry = editor?.entries?.().find(candidate => candidate.options.id === name)
            if (editor?.edit === undefined || entry === undefined) {
              return json({ ok: false, detail: '该 profile 没有可编辑的本插件配置行（需要 Web 或 Desktop 客户端）' }, 503)
            }

            const next: Record<string, unknown> = {}
            const num = (value: unknown, min: number): number | undefined =>
              typeof value === 'number' && Number.isFinite(value) && value >= min ? value : undefined
            const hours = num(body.analyzeEveryHours, 0)
            const minFailures = num(body.minFailures, 1)
            const cooldown = num(body.cooldownDays, 0)
            if (hours !== undefined) next.analyzeEveryHours = hours
            if (minFailures !== undefined) next.minFailures = minFailures
            if (cooldown !== undefined) next.cooldownDays = cooldown
            if (Object.keys(next).length === 0) {
              return json({ ok: false, detail: '没有可写入的配置项' }, 400)
            }

            try {
              await editor.edit(entry, current => ({ ...current, ...next }))
              return json({ ok: true, config: next })
            } catch (error) {
              return json({ ok: false, detail: `写入配置失败：${String(error)}` }, 500)
            }
          },
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

/** A tool registry, as much of it as this plugin uses. */
interface ToolRegistry {
  get: (name: string) => unknown
  register: (definition: unknown) => () => void
}

/**
 * Replace a tool's definition with one carrying a proposed change.
 *
 * The registry must come from an agent's scope, because tool resolution is
 * scope-bound: the plugin's own view returns `undefined` for every tool, and an
 * agent's view resolves one only while that agent's step is running. Both were
 * measured — the same `get('pwsh')` returned `undefined` from an HTTP request
 * and `FOUND` from a step listener.
 *
 * Two things make the replacement safe:
 *
 * - The original definition is readable, including its `execute`, so the
 *   replacement delegates to the original body. A plugin cannot reimplement a
 *   shipped tool, and it does not have to.
 * - The replacement is registered before the previous one is disposed, so the
 *   tool is never missing from the catalogue the model reads.
 *
 * @param tools - the agent-scoped registry.
 * @param toolName - the tool to replace.
 * @param change - the description and/or parameter schema to put in force.
 * @param swaps - the per-instance table of what this plugin has replaced.
 * @param stats - the statistics, which record what changed.
 * @param logger - optional logger.
 * @returns whether the swap happened, and why not when it did not.
 */
function swapIn(
  tools: ToolRegistry,
  toolName: string,
  change: ResolvedChange,
  swaps: Map<string, () => void>,
  stats: ToolUsageStats,
  logger: { warn?: (message: string) => void } | undefined,
): { ok: true } | { ok: false; detail: string } {
  const current = tools.get(toolName) as {
    description?: unknown
    parameters?: unknown
    output?: unknown
    execute?: unknown
  } | undefined
  if (current === undefined) return { ok: false, detail: "工具 " + toolName + " 不在注册表里" }
  if (typeof current.execute !== 'function') {
    return { ok: false, detail: "工具 " + toolName + " 没有可复用的实现，无法安全替换" }
  }

  const before = {
    description: typeof current.description === 'string' ? current.description : '',
    parameters: (current.parameters ?? {}) as Record<string, unknown>,
  }

  let dispose: (() => void) | undefined
  try {
    dispose = tools.register({
      ...current,
      name: toolName,
      description: change.description ?? before.description,
      parameters: change.parameters ?? before.parameters,
      // Borrowed deliberately: the registry is documented to accept a readonly
      // definition without copying it, so the original body keeps working.
      execute: current.execute,
      output: current.output,
    })
  } catch (error) {
    return { ok: false, detail: "注册替换版本失败：" + String(error) }
  }

  swaps.get(toolName)?.()
  swaps.set(toolName, dispose)

  stats.recordApplied({
    tool: toolName,
    before,
    appliedAt: Date.now(),
    kind: change.description === undefined ? 'parameters' : 'description',
  })
  logger?.warn?.("tool-usage-stats: replaced " + toolName)
  return { ok: true }
}

/**
 * Wrap a prepared prompt as the message the model answers.
 *
 * One function for both delivery paths — a step's `decision.messages` and a
 * fresh session's first follow-up — so the wording cannot drift between them.
 *
 * @param prompt - the grouped failure report.
 * @returns the text to send.
 */
function diagnosisMessage(prompt: string): string {
  return [
    '【工具诊断请求】',
    '',
    prompt,
    '',
    '（这是 vyra 工具用量插件自动发出的诊断请求。请只回复上面要求的内容。）',
  ].join('\n')
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
