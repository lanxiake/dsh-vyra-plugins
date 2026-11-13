/**
 * Second feasibility probe: if `restrict()` at `agent/created` is accepted but
 * has no effect, can it be applied at a later point that still precedes prompt
 * assembly?
 *
 * `resolveToolLoadout` in the reference implementation needed its restriction
 * to hold for the next request. This measures whether a plugin can reach a
 * moment where it does.
 *
 * Run from the `dsh-Veyra` checkout:
 *
 *   npx tsx <path>/tests/restrict-probe-late.ts
 *
 * @module vyra-tool-usage-stats/restrict-probe-late
 */

import { Context } from '@deepseek-ai/cordis'
import {
  mountAgentLoopTestDependencies,
  mountAgentLoopTestHarness,
} from '@deepseek-ai/dsh-agent-loop-testkit'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { brandString } from '@deepseek-ai/dsh-brand'
import { defineTool } from '@deepseek-ai/dsh-tools'

const ctx = new Context()
await mountAgentLoopTestDependencies(ctx)
const harness = await mountAgentLoopTestHarness(ctx)

for (const toolName of ['alpha_tool', 'beta_tool', 'gamma_tool']) {
  ctx.tools.register(defineTool({
    name: toolName,
    description: `Probe tool ${toolName}.`,
    parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute() { return 'ok' },
  }))
}

const sessionId = brandString<SessionId>('probe-late')

/** What the agent's own scoped registry currently exposes. */
function visible(agent: unknown): string[] {
  const scoped = (agent as { ctx: { tools: { definitions: () => readonly { name: string }[] } } }).ctx.tools
  return scoped.definitions().map(t => t.name)
}

let disposeRestriction: (() => void) | undefined
let preStepFired = false

ctx.on('agent/created' as never, ((payload: { agent: unknown }) => {
  const agent = payload.agent
  process.stderr.write(`[late] created; visible=[${visible(agent).join(',')}]\n`)

  // Apply the restriction from a later turn boundary instead: the registry is
  // already published by then, so this tests whether the layers still rebuild.
  ctx.on('agent/pre-step' as never, ((payload2: unknown, next: () => unknown) => {
    if (!preStepFired) {
      preStepFired = true
      const scoped = (agent as { ctx: { tools?: { restrict?: (f: { deny: readonly string[] }) => () => void } } }).ctx.tools
      try {
        disposeRestriction = scoped?.restrict?.({ deny: ['gamma_tool'] })
        process.stderr.write(`[late] restrict at pre-step accepted; visible=[${visible(agent).join(',')}]\n`)
      } catch (error) {
        process.stderr.write(`[late] restrict at pre-step threw: ${String(error).slice(0, 140)}\n`)
      }
    }
    return next()
  }) as never)
}) as never)

const agent = await harness.create(sessionId)
process.stderr.write(`[late] after create; visible=[${visible(agent).join(',')}]\n`)

console.log(`VERDICT: restriction applied at pre-step = ${disposeRestriction !== undefined}`)
console.log(`VERDICT: gamma_tool visible after create = ${visible(agent).includes('gamma_tool')}`)

await ctx.stop?.()
