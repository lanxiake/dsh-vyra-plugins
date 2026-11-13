/**
 * Rewrite the swap helpers: the registry must come from an agent's scope.
 *
 * Run once from the plugin directory. Kept as a file rather than an inline
 * shell heredoc because the replacement text contains characters a shell eats.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/index.ts'
const lines = readFileSync(path, 'utf8').split('\n')

const start = lines.findIndex(line => line.startsWith('function registryWith('))
const end = lines.findIndex(line => line.startsWith('/** The exported document shape. */'))
if (start < 0 || end < 0) {
  console.error(`boundaries not found: start=${start} end=${end}`)
  process.exit(1)
}

const replacement = `/** A tool registry, as much of it as this plugin uses. */
interface ToolRegistry {
  get: (name: string) => unknown
  register: (definition: unknown) => () => void
}

/**
 * Replace a tool's definition with one carrying a proposed change.
 *
 * The registry must come from an agent's scope, because tool resolution is
 * scope-bound: the plugin's own view returns \`undefined\` for every tool, and an
 * agent's view resolves one only while that agent's step is running. Both were
 * measured — the same \`get('pwsh')\` returned \`undefined\` from an HTTP request
 * and \`FOUND\` from a step listener.
 *
 * Two things make the replacement safe:
 *
 * - The original definition is readable, including its \`execute\`, so the
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
  if (current === undefined) return { ok: false, detail: \`工具 \${toolName} 不在注册表里\` }
  if (typeof current.execute !== 'function') {
    return { ok: false, detail: \`工具 \${toolName} 没有可复用的实现，无法安全替换\` }
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
    return { ok: false, detail: \`注册替换版本失败：\${String(error)}\` }
  }

  swaps.get(toolName)?.()
  swaps.set(toolName, dispose)

  stats.recordApplied({
    tool: toolName,
    before,
    appliedAt: Date.now(),
    kind: change.description === undefined ? 'parameters' : 'description',
  })
  logger?.warn?.(`tool-usage-stats: replaced \${toolName}`)
  return { ok: true }
}

`

lines.splice(start, end - start, replacement)
writeFileSync(path, lines.join('\n'))
console.log(`replaced lines ${start + 1}..${end} with ${replacement.split('\n').length} lines`)
