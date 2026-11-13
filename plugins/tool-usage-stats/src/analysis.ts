/**
 * Turning the failure audit into a diagnosis request, and turning a model's
 * answer back into an applicable change.
 *
 * Kept free of any Cordis reference so both halves are testable without booting
 * a context.
 *
 * @module vyra-tool-usage-stats/analysis
 */

import type { FailureLog, FailureSample, ToolUsageState } from './counters.ts'

/** A tool whose failures are worth asking about. */
export interface DiagnosisTarget {
  readonly tool: string
  /** Calls recorded in the analysis window. */
  readonly calls: number
  /** Failures recorded in the analysis window. */
  readonly failures: number
  /** Failures since this tool was last analyzed. */
  readonly newFailures: number
  /** Failures grouped by error code, largest group first. */
  readonly groups: readonly FailureGroup[]
}

/** Failures sharing one error code, represented by a bounded sample. */
export interface FailureGroup {
  /** The tool's own error code, or `(none)` when it reported no identity. */
  readonly code: string
  /** How many failures carried this code. */
  readonly count: number
  /** Representative reasons, at most {@link SAMPLES_PER_GROUP}. */
  readonly samples: readonly string[]
}

/**
 * Representative reasons kept per error code.
 *
 * Grouping is what makes the analysis affordable: 181 quota failures and 2 of
 * them produce the same diagnosis, so sending the other 179 buys nothing and
 * costs the whole prompt.
 */
export const SAMPLES_PER_GROUP = 2

/** How many tools one request asks about. */
export const MAX_TARGETS = 8

/**
 * Group a tool's failures by error code.
 *
 * @param samples - the retained failures, newest first.
 * @returns groups ordered by descending count, then by code for stability.
 */
export function groupFailures(samples: readonly FailureSample[]): FailureGroup[] {
  const byCode = new Map<string, { count: number; samples: string[] }>()
  for (const sample of samples) {
    const code = sample.code ?? '(none)'
    let group = byCode.get(code)
    if (group === undefined) {
      group = { count: 0, samples: [] }
      byCode.set(code, group)
    }
    group.count += 1
    // Distinct reasons only: a repeated message adds no information.
    if (group.samples.length < SAMPLES_PER_GROUP && !group.samples.includes(sample.summary)) {
      group.samples.push(sample.summary)
    }
  }
  return [...byCode]
    .map(([code, group]) => ({ code, count: group.count, samples: group.samples }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
}

/** One tool's analysis state, persisted so the same failure is not re-analyzed. */
export interface AnalysisRecord {
  /** Epoch milliseconds the tool was last analyzed. */
  readonly analyzedAt: number
  /** Cumulative failure count at that moment, so "new" is a difference. */
  readonly failuresAtAnalysis: number
}

/** Per-tool analysis history. */
export type AnalysisHistory = Record<string, AnalysisRecord>

/** Thresholds deciding when a tool is worth asking about. */
export interface AnalysisPolicy {
  /**
   * Minimum failures recorded since the last analysis before the tool is
   * reconsidered. A single transient failure does not justify a diagnosis.
   */
  readonly minFailures: number
  /** Minimum days between analyses of the same tool. */
  readonly cooldownDays: number
}

/** Defaults: 5 new failures, at most one diagnosis per tool per week. */
export const DEFAULT_POLICY: AnalysisPolicy = { minFailures: 5, cooldownDays: 7 }

/**
 * Decide which tools to ask about, and why.
 *
 * Both thresholds must be met: enough new failures to be worth a prompt, and
 * enough time since the last one to not repeat the same answer. Either alone
 * mis-fires — a count alone re-asks about one chronic failure every run, and a
 * timer alone asks about tools that have not failed since.
 *
 * @param counters - the current counters.
 * @param failures - the retained failure audit.
 * @param history - when each tool was last analyzed.
 * @param policy - the thresholds.
 * @param now - epoch milliseconds.
 * @returns targets ordered by new failures, capped at {@link MAX_TARGETS}.
 */
export function selectTargets(
  counters: ToolUsageState,
  failures: FailureLog,
  history: AnalysisHistory,
  policy: AnalysisPolicy,
  now: number,
): DiagnosisTarget[] {
  const cooldownMs = policy.cooldownDays * 24 * 60 * 60 * 1000
  const targets: DiagnosisTarget[] = []

  for (const [tool, entry] of Object.entries(counters)) {
    if (entry.errorCount === 0) continue
    const record = history[tool]
    const since = record?.failuresAtAnalysis ?? 0
    const newFailures = Math.max(0, entry.errorCount - since)
    if (newFailures < policy.minFailures) continue
    if (record !== undefined && now - record.analyzedAt < cooldownMs) continue

    targets.push({
      tool,
      calls: entry.count,
      failures: entry.errorCount,
      newFailures,
      groups: groupFailures(failures[tool] ?? []),
    })
  }

  return targets
    .sort((left, right) => right.newFailures - left.newFailures || left.tool.localeCompare(right.tool))
    .slice(0, MAX_TARGETS)
}

/**
 * The question put to the model.
 *
 * It states what is known — counts, error identities, representative reasons —
 * and asks for a change that can be applied to the tool's description, its
 * parameters, or its implementation. It deliberately does not name a specific
 * fix: the reason text is what makes the cause identifiable, and prescribing an
 * answer would bias the diagnosis.
 *
 * @param targets - the tools to diagnose.
 * @returns the prompt text.
 */
export function buildPrompt(targets: readonly DiagnosisTarget[]): string {
  const blocks = targets.map((target) => {
    const rate = target.calls === 0 ? 0 : Math.round((target.failures / target.calls) * 100)
    const groups = target.groups
      .map((group) => {
        const reasons = group.samples.map(sample => `      - ${sample}`).join('\n')
        return `    ${group.code}：${group.count} 次${reasons === '' ? '' : `\n${reasons}`}`
      })
      .join('\n')
    return [
      `工具 ${target.tool}`,
      `  调用 ${target.calls} 次，失败 ${target.failures} 次（失败率 ${rate}%），其中新增 ${target.newFailures} 次`,
      '  按错误码分组：',
      groups === '' ? '    （没有保留的原因文本）' : groups,
    ].join('\n')
  }).join('\n\n')

  return [
    '以下工具在最近的使用中反复失败。请诊断原因，并给出可以直接应用的改进方案。',
    '',
    blocks,
    '',
    '对每个工具，输出一个 JSON 对象，放在 ```json 代码块里，形如：',
    '[',
    '  {',
    '    "tool": "工具名",',
    '    "diagnosis": "一句话说明根本原因",',
    '    "evidence": "哪条错误文本支持这个判断",',
    '    "change": {',
    '      "kind": "description",',
    '      "description": "改写后的完整工具描述（保留原有信息，补充避免该错误的操作指引）"',
    '    }',
    '  }',
    ']',
    '',
    '`change.kind` 只能是 "description"、"parameters" 或 "implementation"：',
    '- description：改写工具描述，告诉模型怎么做才不触发这个错误。最安全，优先选它。',
    '- parameters：给出完整的 "parameters" 对象（JSON Schema），用于修正参数定义。',
    '- implementation：说明要实现什么行为，用 "note" 字段描述，不要写代码。',
    '',
    '只输出 JSON 代码块，不要其他内容。若某个工具其实无法从这些信息判断原因，就跳过它。',
  ].join('\n')
}

/** One proposed change to a tool. */
export interface ProposedChange {
  readonly kind: 'description' | 'parameters' | 'implementation'
  /** Replacement description, for `description`. */
  readonly description?: string
  /** Replacement parameter schema, for `parameters`. */
  readonly parameters?: Record<string, unknown>
  /** What the implementation should do, for `implementation`. */
  readonly note?: string
}

/** One tool's diagnosis. */
export interface Diagnosis {
  readonly tool: string
  readonly diagnosis: string
  readonly evidence: string
  readonly change: ProposedChange
}

/**
 * Parse the model's answer.
 *
 * A model asked for JSON can still wrap it in prose or a fence, so the first
 * JSON array in the text is taken rather than requiring a bare document. An
 * answer that cannot be read yields nothing instead of a guessed change: a
 * malformed proposal applied to a tool is worse than no proposal.
 *
 * @param text - the model's answer.
 * @returns the diagnoses it contained, or an empty array.
 */
export function parseDiagnoses(text: string): Diagnosis[] {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = fenced?.[1] ?? text
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  if (start === -1 || end <= start) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(body.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: Diagnosis[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const typed = entry as Record<string, unknown>
    const tool = typed.tool
    const change = typed.change
    if (typeof tool !== 'string' || tool === '') continue
    if (typeof change !== 'object' || change === null) continue
    const typedChange = change as Record<string, unknown>
    const kind = typedChange.kind
    if (kind !== 'description' && kind !== 'parameters' && kind !== 'implementation') continue

    out.push({
      tool,
      diagnosis: typeof typed.diagnosis === 'string' ? typed.diagnosis : '',
      evidence: typeof typed.evidence === 'string' ? typed.evidence : '',
      change: {
        kind,
        ...(typeof typedChange.description === 'string' ? { description: typedChange.description } : {}),
        ...(typeof typedChange.parameters === 'object' && typedChange.parameters !== null
          ? { parameters: typedChange.parameters as Record<string, unknown> }
          : {}),
        ...(typeof typedChange.note === 'string' ? { note: typedChange.note } : {}),
      },
    })
  }
  return out
}
