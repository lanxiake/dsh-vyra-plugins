/**
 * smart-compaction — agent-decided, tiered context compaction for DeepSeek Harness.
 *
 * Design source: the lumii agent runtime's `compact/` subsystem, reverse-engineered
 * in `docs/analysis/lumii-compaction-analysis.md`. Four of its ideas are ported
 * here, and nothing is rebuilt that this harness already owns:
 *
 *  1. A **pressure ladder** measured once per step by the singleton
 *     `ctx.tokenMeter`, with a cheap deterministic band well below the shipped
 *     summarizer's own trigger.
 *  2. A **generation-gated prune pass** inside that band: collapse duplicate tool
 *     results and replace an oversized old result with a small deterministic
 *     micro-summary that keeps the clue lines (tool, size, first/last lines) and
 *     says how to obtain the full text again. Only re-obtainable tools are
 *     eligible, the newest `protectLastN` surface nodes are never touched, and the
 *     original event stays in the append-only log (the replacement cites it
 *     through `sourceEventSeqs`).
 *  3. A **reclaim gate plus re-arm runway**: a pass whose estimated saving is
 *     below `pruneMinReclaimTokens` is abandoned before it writes anything, and
 *     after a committed pass nothing is re-scanned until pressure climbs past
 *     `after + max(reclaimed, triggerTokens, minReclaim)`. Rewriting a surface
 *     node invalidates the provider's warm prefix, so a marginal pass costs more
 *     than it frees.
 *  4. An **agent decision surface**: `context_report` turns the ladder into
 *     model-visible facts, and `compact_context` lets the model choose the
 *     quality, span, and retained tail instead of waiting for a threshold to fire
 *     on its behalf. The harness ships no model-facing compaction tool — its own
 *     README records that as an open question — which is exactly the gap.
 *
 * The shipped `ctx.compaction` backend keeps ownership of summarization,
 * retention policy, the log-recorded transaction bracket, and overflow recovery.
 * This plugin never registers a second backend and never calls `compactIfNeeded`
 * (that backend already does, on its own trigger). It adds the cheaper tiers
 * ahead of that trigger, plus the human and agent decision surfaces.
 *
 * @module vyra-smart-compaction
 */

/** Plugin name, as the Loader row declares it. */
export const name = 'vyra-smart-compaction'

/**
 * Services this plugin contributes to or reads positionally: `tools` and
 * `systemPrompt` are contributions, `agents` supplies the session lookup behind
 * the pressure endpoint. `tokenMeter`, `toolResultPruner`, `commands`,
 * `connection` and `compaction` are optional peers on other planes (the meter,
 * the pruner and the compaction backend live behind an agent preset), so each is
 * read through `ctx.get()` with a guard rather than injected — a hard injection
 * would fail the mount in profiles that compose fewer layers than this one.
 */
export const inject = ['agents', 'tools', 'systemPrompt']

/** Marker prefix that makes an archived result recognizable on re-scan (idempotency). */
const ARCHIVE_MARKER = '[tool result archived'
/** Marker prefix for a duplicate collapse. */
const DEDUP_MARKER = '[duplicate tool result'
/** Marker the shipped pruner emits, so this pass never re-wraps its output. */
const PRUNER_MARKER = '[... tool result middle pruned ...]'

/** Tool names whose results are re-obtainable by calling the tool again. */
const DEFAULT_REOBTAINABLE = [
  'read',
  'list_dir',
  'glob',
  'grep',
  'bash',
  'pwsh',
  'web_search',
  'web_fetch',
  // Read-only inspection and recall tools: calling them again costs one cheap
  // request and returns the same answer, so an archived result loses nothing.
  'cordis_inspect_query',
  'team_task_list',
  'team_task_get',
  'list_mcp_resources',
  'read_mcp_resource',
  'memory_search',
  'memory_read',
  'memory_project',
]

/** Fields accepted in the plugin Config; an unknown key is a load-time error. */
const CONFIG_KEYS = new Set([
  'pruneRatio',
  'triggerRatio',
  'emergencyRatio',
  'pruneMinReclaimTokens',
  'pruneMinResultChars',
  'dedupMinChars',
  'pruneRearm',
  'protectLastN',
  'keepRecentTurns',
  'maxNodesPerPass',
  'headChars',
  'tailChars',
  'microSummary',
  'reobtainableTools',
  'defaultContextWindow',
  'reportTopNodes',
  'pressureContextLine',
])

/** Defaults: lumii's numbers, mapped onto this harness's own thresholds. */
const DEFAULTS = Object.freeze({
  // lumii proactivePruneRatio 0.48: begin cheap deterministic work here.
  pruneRatio: 0.48,
  // lumii DEFAULT_COMPACTION_TRIGGER_RATIO 0.78, lowered to sit below the
  // shipped backend's own 0.80 trigger so the advisory band stays reachable.
  triggerRatio: 0.72,
  emergencyRatio: 0.9,
  // lumii proactive_prune_min_reclaim_tokens 4096.
  pruneMinReclaimTokens: 4096,
  // lumii proactive_prune_min_result_chars 8000; lowered to 3000 because the
  // pressure this tier is aimed at sits in many mid-sized results, not a few
  // huge ones. headChars + tailChars must leave room below this (resolveConfig).
  pruneMinResultChars: 3000,
  // lumii proactivePruneDedupMinChars 200.
  dedupMinChars: 200,
  pruneRearm: true,
  // lumii protectLastN 20.
  protectLastN: 20,
  // lumii DEFAULT_KEEP_RECENT_TURNS 6.
  keepRecentTurns: 6,
  maxNodesPerPass: 40,
  headChars: 1500,
  tailChars: 600,
  microSummary: true,
  reobtainableTools: DEFAULT_REOBTAINABLE,
  defaultContextWindow: 128000,
  reportTopNodes: 8,
  pressureContextLine: true,
})

/**
 * Validate and detach the row's configuration.
 * @param config - raw Loader row config.
 * @returns a frozen resolved configuration.
 */
export function resolveConfig(config = {}) {
  for (const key of Object.keys(config)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`smart-compaction: unknown config key "${key}"`)
  }
  const merged = { ...DEFAULTS, ...config }
  const ratio = (key) => {
    const value = merged[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
      throw new Error(`smart-compaction: ${key} must be a number in (0, 1], got ${String(value)}`)
    }
    return value
  }
  const integer = (key, min) => {
    const value = merged[key]
    if (!Number.isInteger(value) || value < min) {
      throw new Error(`smart-compaction: ${key} must be an integer >= ${min}, got ${String(value)}`)
    }
    return value
  }
  const resolved = {
    pruneRatio: ratio('pruneRatio'),
    triggerRatio: ratio('triggerRatio'),
    emergencyRatio: ratio('emergencyRatio'),
    pruneMinReclaimTokens: integer('pruneMinReclaimTokens', 0),
    pruneMinResultChars: integer('pruneMinResultChars', 200),
    dedupMinChars: integer('dedupMinChars', 0),
    pruneRearm: merged.pruneRearm === true,
    protectLastN: integer('protectLastN', 0),
    keepRecentTurns: integer('keepRecentTurns', 1),
    maxNodesPerPass: integer('maxNodesPerPass', 1),
    headChars: integer('headChars', 0),
    tailChars: integer('tailChars', 0),
    microSummary: merged.microSummary !== false,
    reobtainableTools: normalizeToolList(merged.reobtainableTools),
    defaultContextWindow: integer('defaultContextWindow', 1000),
    reportTopNodes: integer('reportTopNodes', 1),
    pressureContextLine: merged.pressureContextLine !== false,
  }
  if (!(resolved.pruneRatio < resolved.triggerRatio)) {
    throw new Error(
      `smart-compaction: pruneRatio (${resolved.pruneRatio}) must be below triggerRatio (${resolved.triggerRatio})`,
    )
  }
  if (!(resolved.triggerRatio <= resolved.emergencyRatio)) {
    throw new Error(
      `smart-compaction: triggerRatio (${resolved.triggerRatio}) must not exceed emergencyRatio (${resolved.emergencyRatio})`,
    )
  }
  if (resolved.headChars + resolved.tailChars + 64 > resolved.pruneMinResultChars) {
    throw new Error(
      'smart-compaction: headChars + tailChars must leave room below pruneMinResultChars, '
      + 'or a head/tail rewrite could grow a result',
    )
  }
  return Object.freeze(resolved)
}

/**
 * Normalize the re-obtainable tool list into a frozen lookup set.
 * @param value - configured array, or the default list.
 * @returns a frozen Set of tool names.
 */
function normalizeToolList(value) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error('smart-compaction: reobtainableTools must be an array of non-empty strings')
  }
  return Object.freeze(new Set(value))
}

/**
 * Count Unicode code points without splitting a surrogate pair.
 * @param text - text to measure.
 * @returns the code-point count.
 */
function codePointLength(text) {
  return Array.from(text).length
}

/** Convert a character saving into a token estimate (the meter's own 4-char heuristic). */
function charsToTokens(chars) {
  return Math.ceil(chars / 4)
}

/**
 * Join the text of a message's content blocks.
 * @param content - content blocks, however shaped.
 * @returns the concatenated text.
 */
export function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const block of content) {
    if (block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      out += block.text
    }
  }
  return out
}

/**
 * Build lumii's deterministic micro-summary: size, clue lines, and how to re-obtain.
 * @param toolName - tool that produced the result.
 * @param text - original result text.
 * @returns the replacement text.
 */
export function buildMicroSummary(toolName, text) {
  const lines = text.split(/\r?\n/)
  const nonEmpty = lines.filter((line) => line.trim().length > 0)
  const head = nonEmpty.slice(0, 2)
  const tail = nonEmpty.length > 2 ? nonEmpty.slice(-2) : []
  const clues = [...head, ...(tail.length > 0 ? ['…', ...tail] : [])]
    .map((line) => line.trim().slice(0, 120))
    .join(' | ')
  return `${ARCHIVE_MARKER} | tool=${toolName} | ${lines.length} lines/${codePointLength(text)} chars`
    + (clues ? ` | clue: ${clues}` : '')
    + `]\nThe full output stays in the session log; re-run ${toolName} (or a narrower query) to see it again.`
}

/**
 * Build a head+marker+tail replacement that is strictly smaller than its input.
 * @param text - original text.
 * @param headChars - leading code points kept.
 * @param tailChars - trailing code points kept.
 * @returns the replacement text.
 */
export function truncateText(text, headChars, tailChars) {
  const points = Array.from(text)
  const removed = Math.max(0, points.length - headChars - tailChars)
  const marker = `\n\n[... ${removed} characters pruned by smart-compaction ...]\n\n`
  return points.slice(0, headChars).join('') + marker + (tailChars > 0 ? points.slice(-tailChars).join('') : '')
}

/**
 * Stable order-independent content fingerprint used for duplicate detection.
 * @param text - normalized text to fingerprint.
 * @returns a short hex digest qualified by length.
 */
export function contentHash(text) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${hash.toString(16)}-${text.length}`
}

/**
 * Split a session's user turns into a compacted head and a retained tail.
 *
 * The two numbers are easy to confuse, and confusing them is not cosmetic: the
 * turn count reported to the model decides whether it trusts the summary. So
 * the split is computed here as a pure function and both callers read the same
 * answer.
 *
 * @param userTurnCount - user turns present on the surface, excluding the
 *   system prefix.
 * @param keepRecentTurns - user turns the caller promised to keep verbatim.
 * @returns `{ cutIndex, retainedTurns }`, where `cutIndex` indexes the user-turn
 *   list at the first retained turn and `retainedTurns` counts the turns left
 *   verbatim; or null when the tail is the whole conversation, so there is
 *   nothing to compact.
 */
export function tailPlan(userTurnCount, keepRecentTurns) {
  if (!Number.isInteger(userTurnCount) || !Number.isInteger(keepRecentTurns)) return null
  if (keepRecentTurns < 1 || userTurnCount <= keepRecentTurns) return null
  return { cutIndex: userTurnCount - keepRecentTurns, retainedTurns: keepRecentTurns }
}

/** Replace the definition's whole config object in place, preserving the entry id. */

/**
 * Install the pressure ladder, the deterministic prune pass, the decision tools,
 * the `/smart-compact` command, and the pressure endpoint.
 * @param ctx - the Loader context this row mounts into.
 * @param config - validated row configuration.
 */
export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  const logger = ctx.get('logger')

  /** Per-session ladder state. Dropped when the owning agent is disposed. */
  const state = new Map()
  /** Current turn number per session, learned from the log (never guessed). */
  const turns = new Map()

  const warn = (message) => {
    try {
      logger?.warn?.(`smart-compaction: ${message}`)
    } catch {
      /* logging is never a gate */
    }
  }

  const stateOf = (sessionId) => {
    let entry = state.get(sessionId)
    if (entry === undefined) {
      entry = {
        rearmTokens: null,
        lastTurnPruned: -1,
        prunes: 0,
        reclaimedTokens: 0,
        lastPressure: undefined,
        lastPruneOutcome: undefined,
        lastCompaction: undefined,
      }
      state.set(sessionId, entry)
    }
    return entry
  }

  // ── optional peer services, read defensively ──────────────────────────────
  const meterOf = () => ctx.get('tokenMeter')
  /**
   * Resolve the compaction backend for one agent.
   *
   * The backend is mounted inside the agent preset, not at the host plane this
   * plugin lives on, so `ctx.get('compaction')` is undefined here and the tool
   * would report "no backend" even though the session is compacting normally.
   * `agentPresets.serviceFor` resolves a service in the scope the agent actually
   * joined; the host-plane lookup stays as the fallback for profiles that mount
   * the backend at the host.
   * @param agent - the agent whose preset scope is searched.
   * @returns the compaction service, or undefined when none is mounted.
   */
  function compactionOf(agent) {
    const presets = ctx.get('agentPresets')
    if (agent !== undefined && typeof presets?.serviceFor === 'function') {
      try {
        const scoped = presets.serviceFor(agent, 'compaction')
        if (scoped !== undefined) return scoped
      } catch (error) {
        logger?.warn?.(`smart-compaction: preset service lookup failed: ${String(error?.message ?? error)}`)
      }
    }
    return ctx.get('compaction')
  }

  /**
   * Truncation budgets, taken from the mounted pruner so both tiers agree.
   * @returns head/tail/threshold code-point budgets.
   */
  function budgets() {
    const pruner = ctx.get('toolResultPruner')
    const head = Number.isInteger(pruner?.config?.headChars) ? pruner.config.headChars : resolved.headChars
    const tail = Number.isInteger(pruner?.config?.tailChars) ? pruner.config.tailChars : resolved.tailChars
    const threshold = Number.isInteger(pruner?.config?.thresholdChars)
      ? pruner.config.thresholdChars
      : resolved.pruneMinResultChars
    return { head, tail, threshold }
  }

  /**
   * Resolve the completion reservation the provider charges to the same window.
   * @param session - session whose latest request header is read.
   * @returns reserved completion tokens, or 0 when nothing declares a cap.
   */
  function reservedOutputTokens(session) {
    try {
      const header = session.requestHeader?.()
      const explicit = header?.config?.maxTokens
      if (Number.isFinite(explicit) && explicit > 0) return explicit
      const adapterDefault = header?.adapterDefaults?.maxTokens
      if (Number.isFinite(adapterDefault) && adapterDefault > 0) return adapterDefault
    } catch {
      /* an unresolvable reservation is 0, never an error */
    }
    return 0
  }

  /**
   * Measure one session once, resolving capacity and the output reservation.
   * @param session - session to measure.
   * @returns pressure facts, or null when no meter or session is available.
   */
  function pressureOf(session) {
    const meter = meterOf()
    if (meter === undefined || session === undefined || session === null) return null
    let measured
    try {
      measured = meter.measure(session)
    } catch (error) {
      warn(`measure failed: ${String(error)}`)
      return null
    }
    let contextWindow
    try {
      contextWindow = meter.contextPressure(session)?.contextWindow
    } catch {
      contextWindow = undefined
    }
    const window = Number.isFinite(contextWindow) && contextWindow > 0
      ? contextWindow
      : resolved.defaultContextWindow
    const reserved = reservedOutputTokens(session)
    // Reserving output keeps the last request of a nearly-full turn from
    // overflowing: the provider charges the completion cap to the same window.
    const usable = Math.max(1000, window - reserved)
    const tokens = measured.totalTokens
    return {
      tokens,
      contextWindow: window,
      reservedOutputTokens: reserved,
      usableTokens: usable,
      ratio: tokens / usable,
      measured,
    }
  }

  /** The ladder rung a pressure ratio sits on. */
  function rungOf(ratio) {
    if (ratio >= resolved.emergencyRatio) return 'emergency'
    if (ratio >= resolved.triggerRatio) return 'trigger'
    if (ratio >= resolved.pruneRatio) return 'prune'
    return 'calm'
  }

  // ── deterministic prune pass ───────────────────────────────────────────────

  /**
   * Resolve a tool/result event's tool name from its paired assistant tool call.
   * The result message carries only `callId`, so the current surface is walked
   * backwards to the assistant message that issued it. Callers pass the surface
   * and seq list so one pass walks them once, not once per candidate.
   * @param session - session owning the event.
   * @param callId - the result's originating tool call id.
   * @param nodes - the current surface seq list.
   * @param events - the surface events, aligned with `nodes`.
   * @returns the tool name, or undefined when the pair is not on the surface.
   */
  function toolNameOfEvent(callId, nodes, events) {
    if (callId === undefined) return undefined
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index]
      if (event?.type !== 'assistant/message') continue
      for (const block of event.data?.message?.content ?? []) {
        if (block?.type === 'tool-call' && block.id === callId) return block.name
      }
    }
    return undefined
  }

  /**
   * Read the current surface as an aligned seq/event snapshot.
   * @param session - session to snapshot.
   * @returns seqs and their events.
   */
  function surfaceOf(session) {
    const nodes = session.surface.nodes
    const events = nodes.map((seq) => session.eventAt(seq))
    return { nodes, events }
  }

  /**
   * Plan one prune pass without writing anything.
   *
   * Scans the current surface, keeps the newest `protectLastN` nodes untouched,
   * and decides per eligible tool result whether to collapse a duplicate or
   * replace an oversized text body with the deterministic micro-summary.
   *
   * @param session - session whose surface is planned.
   * @returns every possible edit, in surface order, with their total saving. The
   *   per-pass node cap is applied by the caller: the reclaim gate and the report
   *   both have to be answered against the whole surface, and a plan truncated
   *   here would make a capped pass look like a surface with nothing left.
   */
  function planPrune(session) {
    const { nodes, events } = surfaceOf(session)
    const empty = { edits: [], charsSaved: 0, scanned: 0, candidates: 0 }
    if (nodes.length <= resolved.protectLastN + 3) return empty

    const protectFrom = nodes.length - resolved.protectLastN
    const minChars = Math.max(resolved.pruneMinResultChars, resolved.dedupMinChars)
    const candidates = []
    let scanned = 0

    for (let index = 0; index < protectFrom; index++) {
      const event = events[index]
      if (event?.type !== 'tool/result') continue
      scanned++
      const callId = event.data?.message?.source?.callId
      const toolName = toolNameOfEvent(callId, nodes, events)
      if (toolName === undefined || !resolved.reobtainableTools.has(toolName)) continue
      const original = session.deriveEventMessage(event)
      const text = textOf(original?.content)
      const chars = codePointLength(text)
      if (chars < resolved.dedupMinChars) continue
      if (text.startsWith(ARCHIVE_MARKER) || text.startsWith(DEDUP_MARKER) || text.includes(PRUNER_MARKER)) continue
      candidates.push({ index, seq: nodes[index], event, toolName, original, text, chars })
    }

    // The oldest occurrence of each distinct result stays verbatim; later
    // duplicates collapse to a pointer. A group with more than one member keeps
    // that oldest copy verbatim even when it is large, or the pointer's promise
    // ("the full text stays in the session log") would be the only copy left and
    // a reader could not tell the surviving text from a summary of it.
    const oldestByHash = new Map()
    const groupSize = new Map()
    for (const candidate of candidates) {
      const hash = contentHash(candidate.text)
      if (candidate.chars < resolved.dedupMinChars) continue
      if (!oldestByHash.has(hash)) oldestByHash.set(hash, candidate.index)
      groupSize.set(hash, (groupSize.get(hash) ?? 0) + 1)
    }

    const edits = []
    let charsSaved = 0
    for (const candidate of candidates) {
      const hash = contentHash(candidate.text)
      const owner = oldestByHash.get(hash)
      const duplicated = (groupSize.get(hash) ?? 0) > 1

      if (candidate.chars >= resolved.dedupMinChars && duplicated && owner !== candidate.index) {
        const replacement = `${DEDUP_MARKER} identical to an earlier ${candidate.toolName} result in this session;`
          + ` the full text stays in the session log. Re-run ${candidate.toolName} if you need it again.]`
        const content = replaceTextContent(candidate.original.content, replacement)
        if (content !== null) {
          edits.push({ ...candidate, content, reason: 'dedup', charsAfter: codePointLength(replacement) })
          charsSaved += candidate.chars - codePointLength(replacement)
        }
        continue
      }

      // The surviving verbatim copy of a duplicated group is never summarized.
      if (duplicated && owner === candidate.index) continue
      if (candidate.chars < minChars) continue
      const replacement = resolved.microSummary
        ? buildMicroSummary(candidate.toolName, candidate.text)
        : truncateText(candidate.text, budgets().head, budgets().tail)
      const after = codePointLength(replacement)
      if (after >= candidate.chars) continue
      const content = replaceTextContent(candidate.original.content, replacement)
      if (content === null) continue
      edits.push({ ...candidate, content, reason: 'micro-summary', charsAfter: after })
      charsSaved += candidate.chars - after
    }

    return { edits, charsSaved, scanned, candidates: candidates.length }
  }

  /**
   * Replace every text block of one message with a single replacement text.
   * @param content - original content blocks.
   * @param replacement - the replacement text.
   * @returns new content blocks, or null when the message carries no text.
   */
  function replaceTextContent(content, replacement) {
    if (typeof content === 'string') return [{ type: 'text', text: replacement }]
    if (!Array.isArray(content)) return null
    let hasText = false
    const next = []
    let inserted = false
    for (const block of content) {
      if (block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
        hasText = true
        if (!inserted) {
          next.push({ ...block, text: replacement })
          inserted = true
        }
        continue
      }
      next.push(block)
    }
    return hasText ? next : null
  }

  /**
   * Commit a planned pass: one `compaction/prune` shadow-price record plus one
   * `tool/result` replacement per edit, each citing the node it shadows, so the
   * append-only log still holds the original text.
   * @param session - session to rewrite.
   * @param edits - planned edits.
   * @returns the number of committed replacements.
   */
  function commitPrune(session, edits) {
    const meter = meterOf()
    let committed = 0
    for (const edit of edits) {
      try {
        session.append('compaction/prune', {
          shadowedRange: { start: edit.seq, end: edit.seq },
          shadowedSeqs: [edit.seq],
          shadowedTokenCount: meter === undefined ? 0 : meter.estimateMessage(edit.original),
        })
        session.append('tool/result', {
          ...edit.event.data,
          message: Object.freeze({ ...edit.original, content: edit.content }),
        }, {
          surfaceOp: { op: 'replace', startSeq: edit.seq, endSeq: edit.seq },
          sourceEventSeqs: [edit.seq],
        })
        committed++
      } catch (error) {
        // A rejected replacement must not abort the pass's earlier commits and
        // must never fail the step: the surface simply keeps the original node.
        warn(`replacement at seq ${String(edit.seq)} rejected: ${String(error)}`)
      }
    }
    return committed
  }

  /**
   * Run the gated pass for one session when the ladder and the runway allow it.
   * @param session - session under pressure.
   * @param pressure - measured pressure facts.
   * @param options.force - bypass the band, the runway and the reclaim gate
   *   (used by the agent-decided path, where reclaiming is always worth it
   *   because a summarization request is about to read this same history).
   * @returns a short outcome record for the report.
   */
  function maybePrune(session, pressure, options = {}) {
    const entry = stateOf(session.id)
    const force = options.force === true
    if (!force && pressure.ratio < resolved.pruneRatio) return { skipped: 'below-prune-band' }
    if (!force && resolved.pruneRearm && entry.rearmTokens !== null && pressure.tokens < entry.rearmTokens) {
      return { skipped: 're-arm-runway', rearmTokens: entry.rearmTokens }
    }
    const turn = turns.get(session.id)
    // A resumed session may carry no observed turn yet: never treat "unknown" as
    // "already pruned this turn", or the first pass of every resumed session
    // would be suppressed forever.
    if (!force && turn !== undefined && entry.lastTurnPruned === turn) {
      return { skipped: 'already-pruned-this-turn' }
    }

    const plan = planPrune(session)
    if (plan.edits.length === 0) {
      // Nothing on the surface is reclaimable: re-arming is safe here.
      entry.rearmTokens = pressure.tokens + Math.max(1, charsToTokens(plan.charsSaved))
      return { skipped: 'nothing-to-reclaim', scanned: plan.scanned }
    }
    const estimated = charsToTokens(plan.charsSaved)
    // Reclaim gate: a marginal rewrite invalidates the provider's warm prefix and
    // costs more in cache misses than it frees (lumii's Reclaim Gate).
    if (!force && estimated < resolved.pruneMinReclaimTokens) {
      return { skipped: 'reclaim-gate', estimatedTokens: estimated, edits: plan.edits.length }
    }

    // Commit at most `maxNodesPerPass` replacements; the gate above and the
    // report are both answered against the full plan.
    const batch = plan.edits.slice(0, resolved.maxNodesPerPass)
    const before = pressure.tokens
    const committed = commitPrune(session, batch)
    if (committed === 0) return { skipped: 'commit-failed', edits: batch.length }

    const after = pressureOf(session)
    const afterTokens = after === null ? before - estimated : after.tokens
    const reclaimed = Math.max(0, before - afterTokens)
    entry.prunes++
    entry.reclaimedTokens += reclaimed
    entry.lastTurnPruned = turn
    // Re-arm runway (lumii: max(reclaimed, triggerTokens, minReclaim)).
    const triggerTokens = Math.floor(pressure.usableTokens * resolved.pruneRatio)
    entry.rearmTokens = afterTokens + Math.max(reclaimed, triggerTokens, resolved.pruneMinReclaimTokens)
    entry.lastPruneOutcome = {
      committed,
      edits: batch.length,
      remainingEdits: Math.max(0, plan.edits.length - batch.length),
      estimatedTokens: estimated,
      reclaimedTokens: reclaimed,
      tokensBefore: before,
      tokensAfter: afterTokens,
      rearmTokens: entry.rearmTokens,
    }
    return { pruned: true, ...entry.lastPruneOutcome }
  }

  // ── log-derived turn tracking ──────────────────────────────────────────────

  ctx.on('session/event', (session, event) => {
    if (event?.type === 'turn/start' && Number.isFinite(event.data?.turn)) {
      turns.set(session.id, event.data.turn)
      return
    }
    if (event?.type === 'compaction/summary') {
      // The summarizer replaced a range: the re-arm runway no longer describes
      // the surface it was computed for, so the ladder starts a fresh epoch.
      const entry = stateOf(session.id)
      entry.rearmTokens = null
      entry.lastCompaction = { turn: turns.get(session.id) ?? null, at: Date.now() }
    }
  })

  ctx.on('agent/disposed', ({ agent }) => {
    state.delete(agent.id)
    turns.delete(agent.id)
  })

  // ── the ladder: measure once per step, reclaim cheaply, never block a turn ─

  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    try {
      if (!signal?.aborted && agent !== undefined) {
        const session = agent.session
        const pressure = pressureOf(session)
        if (pressure !== null) {
          const entry = stateOf(session.id)
          entry.lastPressure = {
            tokens: pressure.tokens,
            usableTokens: pressure.usableTokens,
            contextWindow: pressure.contextWindow,
            ratio: pressure.ratio,
            rung: rungOf(pressure.ratio),
          }
          if (pressure.ratio >= resolved.pruneRatio) maybePrune(session, pressure)
        }
      }
    } catch (error) {
      warn(`pre-step ladder failed (the turn continues): ${String(error)}`)
    }
    return next()
  })

  // ── reporting ─────────────────────────────────────────────────────────────

  /**
   * One-line label for a surface node, used by the report ranking.
   * @param session - owning session.
   * @param event - the surface event.
   * @returns a short model-readable label.
   */
  function labelOfEvent(session, event) {
    if (event === undefined) return '(not on the current surface)'
    switch (event.type) {
      case 'tool/result': {
        const { nodes, events } = surfaceOf(session)
        const toolName = toolNameOfEvent(event.data?.message?.source?.callId, nodes, events)
        return `${toolName ?? 'tool'} result (${codePointLength(textOf(event.data?.message?.content))} chars)`
      }
      case 'assistant/message':
        return `assistant text (${codePointLength(textOf(event.data?.message?.content))} chars)`
      case 'user/message':
        return `user message (${codePointLength(textOf(event.data?.content))} chars)`
      default:
        return event.type
    }
  }

  /**
   * Describe the ladder's current advice in one model-readable sentence.
   * @param ratio - current pressure ratio.
   * @param plan - `{ charsSaved }` for the pending deterministic plan.
   * @returns the advice string.
   */
  function recommendationFor(ratio, plan) {
    if (ratio < resolved.pruneRatio) {
      return 'No action needed: context is below the deterministic prune band.'
    }
    const reclaimable = charsToTokens(plan.charsSaved)
    if (ratio < resolved.triggerRatio) {
      return reclaimable >= resolved.pruneMinReclaimTokens
        ? `Deterministic pruning can still free about ${reclaimable} tokens automatically; no compaction is needed yet.`
        : 'Below the compaction threshold and nothing cheaply reclaimable is left; keep working.'
    }
    if (ratio >= resolved.emergencyRatio) {
      return `Call compact_context now: pressure is at ${(ratio * 100).toFixed(1)}% of the usable window, `
        + 'and one more large tool result can overflow the request.'
    }
    return `Call compact_context before starting more large reads: pressure is at ${(ratio * 100).toFixed(1)}%, `
      + `past the ${(resolved.triggerRatio * 100).toFixed(0)}% compaction threshold. `
      + `It keeps the most recent ${resolved.keepRecentTurns} turns verbatim.`
  }

  /**
   * The reported form of a planned pass, capped to the per-pass node budget.
   * @param session - session whose surface is planned.
   * @returns `{ eligibleResults, plannedEdits, estimatedTokens, charsSaved }`.
   */
  function summarizePlan(session) {
    const plan = planPrune(session)
    return {
      eligibleResults: plan.candidates,
      plannedEdits: plan.edits.length,
      estimatedTokens: charsToTokens(plan.charsSaved),
      charsSaved: plan.charsSaved,
    }
  }

  /**
   * Build the report the model, the command and the pressure line all read.
   * @param session - session to report on.
   * @param topNodes - how many surface nodes to rank.
   * @returns the report payload.
   */
  function buildReport(session, topNodes) {
    const pressure = pressureOf(session)
    if (pressure === null) {
      return { ok: false, summary: 'Context pressure is unavailable: no token meter is mounted for this session.' }
    }
    const entry = stateOf(session.id)
    const measuredNodes = Array.isArray(pressure.measured?.nodes) ? pressure.measured.nodes : []
    const { nodes, events } = surfaceOf(session)
    const indexBySeq = new Map(nodes.map((seq, index) => [String(seq), index]))
    const ranked = measuredNodes
      .map((node) => {
        const index = indexBySeq.get(String(node.seq))
        const event = index === undefined ? undefined : events[index]
        return {
          seq: Number(node.seq),
          tokens: node.tokens,
          role: event?.type ?? 'unknown',
          label: labelOfEvent(session, event),
        }
      })
      .sort((left, right) => right.tokens - left.tokens)
      .slice(0, topNodes)

    // Where the tokens actually are, by node type. Without this the report names
    // only the top-N nodes, which cannot say whether the deterministic tier is
    // aimed at the right material (it only ever rewrites `tool/result` nodes).
    const typeTotals = new Map()
    let measuredSum = 0
    for (const node of measuredNodes) {
      const index = indexBySeq.get(String(node.seq))
      const type = index === undefined ? 'unknown' : (events[index]?.type ?? 'unknown')
      const slot = typeTotals.get(type) ?? { type, nodes: 0, tokens: 0 }
      slot.nodes += 1
      slot.tokens += node.tokens
      measuredSum += node.tokens
      typeTotals.set(type, slot)
    }
    const byType = [...typeTotals.values()].sort((left, right) => right.tokens - left.tokens)
    // Whatever the meter counts beyond the surface nodes: system prompt, tool
    // schemas, and the provider-reported baseline.
    const baselineTokens = Math.max(0, pressure.tokens - measuredSum)

    // The report and the reclaim gate both need the whole surface, which is what
    // planPrune returns; the per-pass node cap applies only at commit time.
    const plan = summarizePlan(session)
    return {
      ok: true,
      pressureTokens: pressure.tokens,
      usableTokens: pressure.usableTokens,
      contextWindow: pressure.contextWindow,
      reservedOutputTokens: pressure.reservedOutputTokens,
      usedRatio: Number(pressure.ratio.toFixed(4)),
      usedPercent: `${(pressure.ratio * 100).toFixed(1)}%`,
      rung: rungOf(pressure.ratio),
      thresholds: {
        pruneAt: `${(resolved.pruneRatio * 100).toFixed(0)}%`,
        suggestCompactAt: `${(resolved.triggerRatio * 100).toFixed(0)}%`,
        emergencyAt: `${(resolved.emergencyRatio * 100).toFixed(0)}%`,
        pruneMinReclaimTokens: resolved.pruneMinReclaimTokens,
      },
      rearmTokens: entry.rearmTokens,
      deterministicPrune: {
        eligibleResults: plan.eligibleResults,
        plannedEdits: plan.plannedEdits,
        estimatedTokens: plan.estimatedTokens,
      },
      history: {
        prunePasses: entry.prunes,
        tokensReclaimedByPrune: entry.reclaimedTokens,
        lastPrune: entry.lastPruneOutcome ?? null,
        lastCompaction: entry.lastCompaction ?? null,
      },
      tokensByType: byType,
      baselineTokens,
      biggestNodes: ranked,
      recommendation: recommendationFor(pressure.ratio, plan),
    }
  }

  /**
   * Render the report as the one text block both callers return.
   * @param report - a successful report.
   * @returns the summary text.
   */
  function renderReport(report) {
    const biggest = report.biggestNodes
      .map((node) => `seq ${node.seq} ${node.role} — ${node.tokens} tokens (${node.label})`)
      .join('\n  ')
    
    const typeBreakdown = report.tokensByType
      .slice(0, 8)
      .map(slot => `${slot.type} — ${slot.tokens} tokens (${slot.nodes} nodes)`)
      .join('\n  ')
    const baselineNote = report.baselineTokens > 0 
      ? `\nBaseline (system prompt + schemas): ${report.baselineTokens} tokens` 
      : ''
    
    return `Context pressure: ${report.pressureTokens} / ${report.usableTokens} usable tokens `
      + `(${report.usedPercent} of a ${report.contextWindow}-token window; ${report.reservedOutputTokens} reserved for output). `
      + `Rung: ${report.rung}.\n`
      + `Thresholds: deterministic prune at ${report.thresholds.pruneAt}, compaction suggested at `
      + `${report.thresholds.suggestCompactAt}, emergency at ${report.thresholds.emergencyAt}.\n`
      + `Deterministic pruning: ${report.deterministicPrune.plannedEdits} planned edit(s) over `
      + `${report.deterministicPrune.eligibleResults} eligible result(s), about `
      + `${report.deterministicPrune.estimatedTokens} tokens reclaimable`
      + (report.rearmTokens === null ? '.\n' : `; re-arm runway ends at ${report.rearmTokens} tokens.\n`)
      + `History: ${report.history.prunePasses} prune pass(es) freeing ${report.history.tokensReclaimedByPrune} tokens.\n`
      + `Token distribution by node type:\n  ${typeBreakdown}${baselineNote}\n`
      + `Largest items:\n  ${biggest || '(none)'}\n`
      + `Advice: ${report.recommendation}`
  }

  // ── drift guard for the retained tail ─────────────────────────────────────

  /**
   * Snap an end index backwards to the nearest tool-pairing-balanced cut.
   * An unbalanced cut would leave an assistant tool call without its result.
   * @param events - the surface events.
   * @param from - first candidate index.
   * @param end - proposed last index.
   * @returns the balanced index, or `from - 1` when none exists.
   */
  function snapBalanced(events, from, end) {
    let open = 0
    const balancedAt = []
    for (let index = from; index <= end; index++) {
      const event = events[index]
      if (event?.type === 'assistant/message') {
        open += (event.data?.message?.content ?? []).filter((block) => block?.type === 'tool-call').length
      } else if (event?.type === 'tool/result') {
        open -= 1
      }
      balancedAt.push(open === 0)
    }
    for (let index = end; index >= from; index--) {
      if (balancedAt[index - from] === true) return index
    }
    return from - 1
  }

  /**
   * Choose the span this pass may compact: everything before the retained tail,
   * snapped back to a tool-pairing-balanced cut.
   *
   * The retained tail is a promise, not a preference: when the surface holds
   * fewer user turns than `keepRecentTurns`, keeping "the most recent N" means
   * keeping everything, so there is no span to compact and this returns null.
   * Cutting anyway would replace the entire conversation while the result still
   * claims the recent turns survived.
   *
   * @param session - session to range over.
   * @param keepRecentTurns - user turns kept verbatim.
   * @returns `{ start, end, retainedTurns }` surface seqs, or null when no useful
   *   span exists.
   */
  function chooseSpan(session, keepRecentTurns) {
    const { nodes, events } = surfaceOf(session)
    if (nodes.length < 4) return null
    let firstContent = 0
    while (firstContent < nodes.length && events[firstContent]?.type === 'system/message') firstContent++

    const userIndexes = []
    for (let index = firstContent; index < nodes.length; index++) {
      if (events[index]?.type === 'user/message') userIndexes.push(index)
    }
    // Fewer user turns than the requested tail: the tail is the whole session.
    const plan = tailPlan(userIndexes.length, keepRecentTurns)
    if (plan === null) return null

    const tailStart = userIndexes[plan.cutIndex]
    const retainedTurns = plan.retainedTurns
    let end = tailStart - 1
    if (end < firstContent) return null
    end = snapBalanced(events, firstContent, end)
    if (end < firstContent) return null
    return { start: nodes[firstContent], end: nodes[end], retainedTurns }
  }

  // ── tools ──────────────────────────────────────────────────────────────────
  //
  // The registry projects `parameters` and `output.schema` straight to the
  // provider, so both are authored as raw JSON Schema in the harness's enforced
  // subset (object root, `properties`, `required` array, `additionalProperties`,
  // scalar `enum`). `defineTool`'s author DSL cannot be used here: this bundle
  // resolves only Node built-ins, so it cannot import `@deepseek-ai/dsh-tools`.

  const CONTEXT_REPORT_PARAMETERS = {
    type: 'object',
    additionalProperties: false,
    properties: {
      topNodes: {
        type: 'integer',
        description: `How many of the largest history items to list. Defaults to ${DEFAULTS.reportTopNodes}.`,
      },
    },
  }

  const CONTEXT_REPORT_OUTPUT = {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      usedPercent: { type: 'string' },
      rung: { type: 'string' },
      pressureTokens: { type: 'integer' },
      usableTokens: { type: 'integer' },
      contextWindow: { type: 'integer' },
      recommendation: { type: 'string' },
    },
    required: ['summary', 'usedPercent', 'rung', 'pressureTokens', 'usableTokens', 'contextWindow', 'recommendation'],
  }

  const COMPACT_CONTEXT_PARAMETERS = {
    type: 'object',
    additionalProperties: false,
    properties: {
      mode: {
        type: 'string',
        enum: ['recommended', 'range'],
        description: 'recommended (default) compacts everything before the retained tail; range compacts only startSeq through endSeq.',
      },
      keepRecentTurns: {
        type: 'integer',
        description: `User turns kept verbatim in recommended mode. Defaults to ${DEFAULTS.keepRecentTurns}; a larger tail keeps more detail and frees less.`,
      },
      startSeq: {
        type: 'integer',
        description: 'First surface seq to replace, inclusive. Required for mode "range"; take it from context_report.',
      },
      endSeq: {
        type: 'integer',
        description: 'Last surface seq to replace, inclusive. Required for mode "range"; both edges must not split an assistant tool call from its result.',
      },
    },
  }

  const COMPACT_CONTEXT_OUTPUT = {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      replacedItems: { type: 'integer' },
      replacedTokens: { type: 'integer' },
    },
    required: ['summary', 'replacedItems', 'replacedTokens'],
  }

  ctx.tools.register({
    name: 'context_report',
    description:
      'Report current context pressure for this session: tokens used against the usable window, which '
      + 'thresholds will fire next, what deterministic pruning could still free, the largest history items, and '
      + 'whether to compact now. Call it when a long session feels heavy, before a large read or search, or '
      + 'before deciding about compaction.',
    parameters: CONTEXT_REPORT_PARAMETERS,
    output: {
      schema: CONTEXT_REPORT_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: String(value?.summary ?? '') }],
    },
    execute: (args, exec) => {
      const top = Number.isInteger(args?.topNodes) && args.topNodes >= 1 ? args.topNodes : resolved.reportTopNodes
      const session = exec?.agent?.session
      // Every payload this tool returns must satisfy its own output schema: the
      // registry validates the value and fails the call as a tool-output error
      // otherwise, so a diagnostic has to travel inside `summary`.
      const report = session === undefined
        ? { ok: false, summary: 'Context pressure needs an owning session, and this call has none.' }
        : buildReport(session, top)
      if (report.ok !== true) {
        return {
          summary: report.summary,
          usedPercent: 'unavailable',
          rung: 'unavailable',
          pressureTokens: 0,
          usableTokens: 0,
          contextWindow: resolved.defaultContextWindow,
          recommendation: 'No action: context pressure cannot be measured in this composition.',
        }
      }
      stateOf(session.id).lastReport = report
      return {
        summary: renderReport(report),
        usedPercent: report.usedPercent,
        rung: report.rung,
        pressureTokens: report.pressureTokens,
        usableTokens: report.usableTokens,
        contextWindow: report.contextWindow,
        recommendation: report.recommendation,
      }
    },
  })

  ctx.tools.register({
    name: 'compact_context',
    description:
      'Compact older conversation history into a summary, keeping the most recent turns verbatim. Call '
      + 'context_report first when unsure: it says whether compaction is worth it and how much history would be '
      + 'replaced. Use this before starting a large read or search on a long session, or when the harness reports '
      + 'pressure past the compaction threshold.',
    parameters: COMPACT_CONTEXT_PARAMETERS,
    output: {
      schema: COMPACT_CONTEXT_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: String(value?.summary ?? '') }],
    },
    execute: async (args, exec) => {
      const session = exec?.agent?.session
      if (session === undefined) {
        return { summary: 'Compaction needs an owning session, and this call has none.', replacedItems: 0, replacedTokens: 0 }
      }
      const engine = compactionOf(exec.agent)
      if (engine === undefined) {
        return { summary: 'No compaction backend is mounted for this session, so history cannot be summarized.', replacedItems: 0, replacedTokens: 0 }
      }
      const before = pressureOf(session)
      // Reclaim deterministically first: every token a prune frees is a token the
      // summary request does not have to read, and it costs no model call.
      const prePrune = before !== null && before.ratio >= resolved.pruneRatio
        ? maybePrune(session, before, { force: true })
        : null
      const pruneNote = prePrune?.pruned === true
        ? ` A deterministic pre-prune freed ${prePrune.reclaimedTokens} tokens first (${prePrune.committed} result(s) rewritten).`
        : ''

      if (args?.mode === 'range') {
        if (!Number.isInteger(args.startSeq) || !Number.isInteger(args.endSeq)) {
          return { summary: 'mode "range" needs integer startSeq and endSeq.', replacedItems: 0, replacedTokens: 0 }
        }
        try {
          const result = await engine.compactRegion(args.startSeq, args.endSeq, exec.agent, exec.signal)
          return finishCompaction(session, before, result, pruneNote)
        } catch (error) {
          return compactionFailure(error, exec.signal)
        }
      }

      // Default: choose the largest tail-preserving span and compact exactly it.
      // The shipped manual entry point (`compactNow`) is deliberately idle-only
      // and whole-surface, so it cannot serve a mid-turn agent decision; the
      // region entry point can, and this plugin owns the drift guard for the
      // retained tail.
      const keep = Number.isInteger(args?.keepRecentTurns) && args.keepRecentTurns >= 1
        ? args.keepRecentTurns
        : resolved.keepRecentTurns
      const span = chooseSpan(session, keep)
      if (span === null) {
        return {
          summary: `Nothing can be compacted safely: the session has ${keep} or fewer user turns so the retained tail is the whole conversation,`
            + ' or every available cut would split an assistant tool call from its result.'
            + pruneNote,
          replacedItems: 0,
          replacedTokens: 0,
        }
      }
      try {
        const result = await engine.compactRegion(span.start, span.end, exec.agent, exec.signal)
        return finishCompaction(session, before, result, pruneNote, span.retainedTurns)
      } catch (error) {
        return compactionFailure(error, exec.signal)
      }
    },
  })

  /**
   * Build the success payload for one completed region compaction.
   * @param session - the compacted session.
   * @param before - pressure measured before the pass.
   * @param result - the backend's compaction result.
   * @param pruneNote - sentence describing the deterministic pre-prune, if any.
   * @param retainedTurns - user turns actually left outside the replaced span.
   * @returns the tool payload.
   */
  function finishCompaction(session, before, result, pruneNote, retainedTurns) {
    const after = pressureOf(session)
    const items = Array.isArray(result?.shadowedSeqs) ? result.shadowedSeqs.length : 0
    const summarized = Number.isFinite(result?.shadowedTokenCount) ? result.shadowedTokenCount : 0
    const entry = stateOf(session.id)
    entry.lastCompaction = { at: Date.now(), items, tokens: summarized }
    entry.rearmTokens = null
    const freed = before !== null && after !== null ? Math.max(0, before.tokens - after.tokens) : summarized
    const kept = retainedTurns === undefined
      ? ''
      : retainedTurns === 0
        ? ' No user turn was left verbatim: the summary replaces the whole conversation, and its own text is the only remaining record.'
        : ` The most recent ${retainedTurns} user turn${retainedTurns === 1 ? '' : 's'} stay${retainedTurns === 1 ? 's' : ''} verbatim.`
    return {
      summary: `Compacted ${items} history item${items === 1 ? '' : 's'} (~${summarized} tokens summarized). `
        + `Context pressure ${before === null ? '?' : before.tokens} → ${after === null ? '?' : after.tokens} tokens; `
        + `freed ${freed}.${kept} The replaced content remains in the session log.${pruneNote}`,
      replacedItems: items,
      replacedTokens: summarized,
    }
  }

  /**
   * Turn a failed compaction into an actionable tool result instead of a throw.
   * @param error - the backend's thrown failure.
   * @param signal - the call's cancellation signal.
   * @returns the tool payload.
   */
  function compactionFailure(error, signal) {
    const code = error?.code
    const reason = signal?.aborted
      ? 'the compaction was cancelled'
      : code === 'busy'
        ? 'another compaction is already running for this session'
        : code === 'changed'
          ? 'the selected history changed while the summary was being written; call context_report and retry'
          : code === 'summary'
            ? 'the summarizer produced no shorter useful summary for that range; try a narrower range'
            : code === 'commit'
              ? 'the replacement could not be committed cleanly; inspect the session before retrying'
              : code === 'persistence'
                ? 'the history was summarized but the session could not be saved'
                : `the compaction failed (${String(error?.message ?? error)})`
    return { summary: `Compaction did not run: ${reason}.`, replacedItems: 0, replacedTokens: 0 }
  }

  // ── human command ──────────────────────────────────────────────────────────

  const commands = ctx.get('commands')
  if (commands !== undefined) {
    ctx.effect(() => commands.register({
      name: 'smart-compact',
      description: 'Compact older history now, after a deterministic prune pass',
      handler: async ({ agent, signal, rawInput }) => {
        if (typeof rawInput === 'string' && rawInput.trim().length > 0) {
          return { kind: 'error', text: 'Usage: /smart-compact (no arguments)' }
        }
        const session = agent?.session
        if (session === undefined) return { kind: 'error', text: 'This command needs an owning session.' }
        const engine = compactionOf(agent)
        if (engine === undefined) return { kind: 'error', text: 'No compaction backend is mounted in this composition.' }
        const before = pressureOf(session)
        let pruneNote = ''
        if (before !== null && before.ratio >= resolved.pruneRatio) {
          const outcome = maybePrune(session, before, { force: true })
          if (outcome?.pruned === true) pruneNote = ` Deterministic prune freed ${outcome.reclaimedTokens} tokens first.`
        }
        try {
          const result = await engine.compactNow(agent, signal)
          if (result === null) return { kind: 'success', text: `No compactable history yet.${pruneNote}` }
          const items = Array.isArray(result?.shadowedSeqs) ? result.shadowedSeqs.length : 0
          const after = pressureOf(session)
          const entry = stateOf(session.id)
          entry.rearmTokens = null
          entry.lastCompaction = { at: Date.now(), items, tokens: result?.shadowedTokenCount ?? 0 }
          return {
            kind: 'success',
            text: `Compacted ${items} history item${items === 1 ? '' : 's'} (~${result?.shadowedTokenCount ?? 0} tokens summarized)`
              + (before !== null && after !== null ? `, pressure ${before.tokens} → ${after.tokens} tokens.` : '.')
              + pruneNote,
            sourceEventSeq: result?.summarySeq,
          }
        } catch (error) {
          if (signal?.aborted) return { kind: 'error', text: 'Compaction cancelled.' }
          const text = error?.code === 'busy'
            ? 'Compaction is unavailable because a compaction is already running, or the agent is not idle.'
            : `Compaction failed: ${String(error?.message ?? error)}`
          return { kind: 'error', text }
        }
      },
    }), 'smart-compaction command')
  }

  // ── live pressure line in the prompt ───────────────────────────────────────

  if (resolved.pressureContextLine) {
    const baseOrder = Number.isFinite(ctx.systemPrompt.getContextOrder('SUBAGENT_DELEGATION'))
      ? ctx.systemPrompt.getContextOrder('SUBAGENT_DELEGATION')
      : 120
    ctx.systemPrompt.context({
      name: 'smart-compaction:pressure',
      order: baseOrder + 5,
      text: ({ scope }) => {
        try {
          const session = scope?.session
          if (session === undefined) return ''
          const last = stateOf(session.id).lastPressure
          if (last === undefined || last.rung === 'calm') return ''
          const advice = last.rung === 'prune'
            ? `call context_report if you are about to add a lot more, otherwise cheap pruning continues automatically`
            : `call context_report, then compact_context (it keeps ${resolved.keepRecentTurns} user turns verbatim)`
          return `Context pressure ${last.tokens}/${last.usableTokens} tokens (${(last.ratio * 100).toFixed(1)}% of the usable window): ${advice}.`
        } catch {
          return ''
        }
      },
    })
  }

  // ── pressure read endpoint for the composer chip ───────────────────────────

  const registerRoute = () => {
    const connection = ctx.get('connection')
    if (connection?.fetch?.register === undefined) return false
    try {
      const disposer = connection.fetch.register({
        path: '/api/smart-compaction/pressure',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: (request) => {
          const json = (body, status = 200) => new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          })
          const sessionId = new URL(request.url).searchParams.get('session')
          const agent = sessionId === null ? undefined : ctx.agents.get(sessionId)
          const session = agent?.session
          if (session === undefined) return json({ ok: false, reason: 'unknown-session' }, 404)
          const report = buildReport(session, resolved.reportTopNodes)
          if (report.ok !== true) return json(report)
          return json({
            ok: true,
            usedPercent: report.usedPercent,
            usedRatio: report.usedRatio,
            rung: report.rung,
            pressureTokens: report.pressureTokens,
            usableTokens: report.usableTokens,
            contextWindow: report.contextWindow,
            recommendation: report.recommendation,
          })
        },
      })
      ctx.effect(() => () => void disposer(), 'smart-compaction pressure route')
      return true
    } catch (error) {
      warn(`cannot register the pressure route: ${String(error)}`)
      return true
    }
  }
  if (!registerRoute()) ctx.inject(['connection'], () => { registerRoute() })
}

/** Test seam: the deterministic helpers the unit checks exercise. */
export const internals = {
  ARCHIVE_MARKER,
  DEDUP_MARKER,
  PRUNER_MARKER,
  buildMicroSummary,
  truncateText,
  contentHash,
  textOf,
  codePointLength,
  charsToTokens,
  normalizeToolList,
  tailPlan,
  DEFAULT_REOBTAINABLE,
  DEFAULTS,
  CONFIG_KEYS,
}

/**
 * Configuration is validated by {@link resolveConfig} at activation, not by an
 * exported `Config` schema object: this bundle resolves only Node built-ins, so
 * it cannot import `@deepseek-ai/schemastery`, and a hand-rolled stand-in would
 * misdeclare the Loader's validation protocol. An invalid row therefore fails
 * activation with a named-field diagnostic instead of failing at first use.
 */

