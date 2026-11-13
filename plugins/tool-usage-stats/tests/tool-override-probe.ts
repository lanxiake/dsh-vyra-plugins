/**
 * Third feasibility probe: can a plugin read an existing tool's definition and
 * replace it with an adjusted one?
 *
 * The plan is for a plugin to fix a misbehaving tool — its description,
 * parameters, or implementation — from what the failure audit recorded. That
 * needs two things to hold: the registry must expose the current definition,
 * and disposing the original registration followed by registering a replacement
 * must actually swap what the model sees.
 *
 * Run from the `dsh-Veyra` checkout:
 *
 *   npx tsx <path>/tests/tool-override-probe.ts
 *
 * @module vyra-tool-usage-stats/tool-override-probe
 */

import { Context } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { defineTool } from '@deepseek-ai/dsh-tools'

const ctx = new Context()
await mountAgentLoopTestDependencies(ctx)

/** Read what the registry currently exposes for a name. */
function describe(name: string): string {
  const definition = ctx.tools.get(name)
  if (definition === undefined) return '(absent)'
  const description = String((definition as { description?: unknown }).description ?? '')
  const parameters = JSON.stringify((definition as { parameters?: unknown }).parameters ?? {})
  return `description=${JSON.stringify(description)} parameters=${parameters.slice(0, 80)}`
}

// Stand in for a shipped tool with a Weakness: its description gives the model
// no hint about the argument it must pass.
let originalRuns = 0
const disposeOriginal = ctx.tools.register(defineTool({
  name: 'flaky_tool',
  description: 'Does a thing.',
  parameters: { target: { type: 'string', required: true, description: 'The target.' } },
  output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
  async execute() { originalRuns += 1; return 'original' },
}))

console.log('1. before override')
console.log(`   ${describe('flaky_tool')}`)
console.log(`   schemas() count = ${ctx.tools.schemas().length}`)

// Can a replacement re-enter the ORIGINAL implementation? The definition is
// borrowed, not copied, so the body is a closure the replacement cannot reach.
const original = ctx.tools.get('flaky_tool')
console.log('')
console.log('2. is the original body reachable from the definition object?')
const bodyKeys = original === undefined ? [] : Object.keys(original as object)
console.log(`   definition keys = [${bodyKeys.join(', ')}]`)
console.log(`   has callable execute = ${typeof (original as { execute?: unknown })?.execute === 'function'}`)

// Swap it: dispose the owning effect, register the replacement.
disposeOriginal()
let replacementRuns = 0
ctx.tools.register(defineTool({
  name: 'flaky_tool',
  description: 'Does a thing. Pass `target` as an absolute path; relative paths fail.',
  parameters: { target: { type: 'string', required: true, description: 'Absolute path to the target.' } },
  output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
  async execute() { replacementRuns += 1; return 'replacement' },
}))

console.log('')
console.log('3. after override')
console.log(`   ${describe('flaky_tool')}`)
console.log(`   schemas() count = ${ctx.tools.schemas().length}`)

// The replacement is what runs, and the original body is gone.
const schemas = ctx.tools.schemas()
const entry = schemas.find(s => s.name === 'flaky_tool')
console.log('')
console.log('4. what the model would receive')
console.log(`   description = ${JSON.stringify(entry?.description)}`)

console.log('')
console.log(`VERDICT: definition readable by a plugin = ${original !== undefined}`)
console.log(`VERDICT: original execute reachable = ${typeof (original as { execute?: unknown })?.execute === 'function'}`)
console.log(`VERDICT: replacement visible to schemas() = ${entry?.description?.includes('absolute path') === true}`)
console.log(`VERDICT: no duplicate registration = ${schemas.filter(s => s.name === 'flaky_tool').length === 1}`)

await ctx.stop?.()
