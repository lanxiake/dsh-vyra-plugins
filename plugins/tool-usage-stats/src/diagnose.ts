/**
 * Asking the main agent to diagnose repeatedly failing tools, and applying what
 * it proposes.
 *
 * The split matters: this module decides *when* a diagnosis is worth a request
 * and *what* the request says, while the agent decides what the cause is. A
 * count alone cannot say why a tool fails, and the reason text is the only
 * input that can.
 *
 * @module vyra-tool-usage-stats/diagnose
 */

import {
  buildPrompt, parseDiagnoses, selectTargets, type AnalysisHistory, type AnalysisPolicy,
  type Diagnosis, type DiagnosisTarget,
} from './analysis.ts'
import type { FailureLog, ToolUsageState } from './counters.ts'

/** One stored proposal awaiting a decision. */
export interface PendingDiagnosis extends Diagnosis {
  /** Epoch milliseconds it was produced. */
  readonly proposedAt: number
  /** The description in force when it was produced, so the change is reviewable. */
  readonly previousDescription: string
}

/** Everything the diagnosis flow persists. */
export interface DiagnosisState {
  readonly history: AnalysisHistory
  readonly pending: readonly PendingDiagnosis[]
  /** Epoch milliseconds of the last completed run. */
  readonly lastRunAt: number
}

/** An empty state, used before the first run. */
export const EMPTY_STATE: DiagnosisState = { history: {}, pending: [], lastRunAt: 0 }

/** What changed on a tool, so it can be undone. */
export interface AppliedChange {
  readonly tool: string
  /** The definition in force before the change. */
  readonly before: {
    readonly description: string
    readonly parameters: Record<string, unknown>
  }
  readonly appliedAt: number
  readonly kind: string
}

/** A tool as the registry exposes it. */
export interface RegisteredTool {
  readonly name: string
  readonly description: string
  readonly parameters: unknown
}

/**
 * Read the description and parameter schema a registry entry currently carries.
 *
 * @param definition - a registry entry.
 * @returns its description and parameters, both coerced to safe defaults.
 */
export function describeTool(definition: unknown): RegisteredTool {
  const typed = definition as { name?: unknown; description?: unknown; parameters?: unknown }
  return {
    name: typeof typed?.name === 'string' ? typed.name : '',
    description: typeof typed?.description === 'string' ? typed.description : '',
    parameters: typed?.parameters ?? {},
  }
}

/**
 * Decide what to ask the model about, and build the prompt.
 *
 * @param counters - current counters.
 * @param failures - the retained failure audit.
 * @param state - the persisted diagnosis state.
 * @param policy - the thresholds.
 * @param now - epoch milliseconds.
 * @returns the prompt, or `undefined` when nothing is worth asking about.
 */
export function prepareRun(
  counters: ToolUsageState,
  failures: FailureLog,
  state: DiagnosisState,
  policy: AnalysisPolicy,
  now: number,
): { prompt: string; targets: readonly DiagnosisTarget[] } | undefined {
  const targets = selectTargets(counters, failures, state.history, policy, now)
  if (targets.length === 0) return undefined
  return { prompt: buildPrompt(targets), targets }
}

/**
 * Fold a run's answer into the state.
 *
 * Every target is recorded as analyzed even when the model said nothing about
 * it. Otherwise a tool the model keeps declining to diagnose would be re-asked
 * on every run, spending a request each time to learn the same nothing.
 *
 * @param state - the state before the run.
 * @param counters - counters at the time of the run.
 * @param targets - what the run asked about.
 * @param answer - the model's answer.
 * @param definitions - current definitions, for the review snapshot.
 * @param now - epoch milliseconds.
 * @returns the state after the run.
 */
export function applyRun(
  state: DiagnosisState,
  counters: ToolUsageState,
  targets: readonly DiagnosisTarget[],
  answer: string,
  definitions: ReadonlyMap<string, RegisteredTool>,
  now: number,
): DiagnosisState {
  const proposed = parseDiagnoses(answer)
  const history: AnalysisHistory = { ...state.history }
  for (const target of targets) {
    history[target.tool] = {
      analyzedAt: now,
      failuresAtAnalysis: counters[target.tool]?.errorCount ?? 0,
    }
  }

  // A proposal for a tool that was not asked about, or one the registry does
  // not have, cannot be applied and would only sit in the list as noise.
  const wanted = new Set(targets.map(target => target.tool))
  const accepted = proposed.filter(diagnosis => wanted.has(diagnosis.tool) && definitions.has(diagnosis.tool))

  const pending = [
    ...accepted.map(diagnosis => ({
      ...diagnosis,
      proposedAt: now,
      previousDescription: definitions.get(diagnosis.tool)?.description ?? '',
    })),
    // Replace an earlier proposal for the same tool rather than stacking them.
    ...state.pending.filter(older => !accepted.some(accepted => accepted.tool === older.tool)),
  ]

  return { history, pending, lastRunAt: now }
}

/**
 * Drop one proposal.
 * @param state - the current state.
 * @param tool - the tool whose proposal to drop.
 * @returns the state without that proposal.
 */
export function dismiss(state: DiagnosisState, tool: string): DiagnosisState {
  return { ...state, pending: state.pending.filter(entry => entry.tool !== tool) }
}

/**
 * Validate a proposed parameter schema before it reaches the registry.
 *
 * The registry rejects a schema it cannot project, and a rejection at that point
 * would leave the tool unregistered — worse than the failure being fixed. So the
 * shape is checked here, where refusing costs nothing.
 *
 * @param parameters - the proposed schema.
 * @returns a reason it is unusable, or `undefined` when it is acceptable.
 */
export function rejectParameters(parameters: unknown): string | undefined {
  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    return '参数定义必须是一个对象'
  }
  const typed = parameters as Record<string, unknown>
  if (typed.type !== 'object') return '参数定义的 type 必须是 "object"'
  if (typed.properties !== undefined
    && (typeof typed.properties !== 'object' || typed.properties === null || Array.isArray(typed.properties))) {
    return 'properties 必须是一个对象'
  }
  return undefined
}

/** A change the registry can apply. */
export interface ResolvedChange {
  readonly description?: string
  readonly parameters?: Record<string, unknown>
}

/**
 * Resolve one proposal into concrete replacements.
 *
 * `implementation` is deliberately unresolvable: a diagnosis can describe what
 * the tool should do, but turning that into code is the maintainer's job, and a
 * generated body running unattended is a risk no review step here can cover.
 *
 * @param change - the proposal.
 * @returns the replacements, or a reason they cannot be applied.
 */
export function resolveChange(change: PendingDiagnosis['change']): ResolvedChange | string {
  if (change.kind === 'description') {
    if (change.description === undefined || change.description.trim() === '') {
      return '建议里没有给出新的描述'
    }
    return { description: change.description }
  }
  if (change.kind === 'parameters') {
    const invalid = rejectParameters(change.parameters)
    if (invalid !== undefined) return invalid
    return { parameters: change.parameters as Record<string, unknown> }
  }
  return '实现改动需要人工完成：请查看建议里的说明后手动修改工具'
}
