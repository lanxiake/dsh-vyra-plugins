/**
 * Feasibility probe: can a plugin restrict an agent's tool set from
 * `agent/created`, early enough to affect that agent's first prompt?
 *
 * The docs say `restrict()` must run inside the setup window and that
 * `agent/created` fires after setup completes. That would make automatic tool
 * trimming impossible from a plugin — the answer decides the whole design, so
 * it is measured rather than inferred.
 *
 * Run from the `dsh-Veyra` checkout:
 *
 *   npx tsx <path>/tests/restrict-probe.ts
 *
 * @module vyra-tool-usage-stats/restrict-probe
 */

import { Context } from '@deepseek-ai/cordis'
import {
  mountAgentLoopTestDependencies,
  mountAgentLoopTestHarness,
} from '@deepseek-ai/dsh-agent-loop-testkit'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { brandString } from '@deepseek-ai/dsh-brand'
import { defineTool } from '@deepseek-ai/dsh-tools'

const report: string[] = []
const note = (line: string): void => { report.push(line) }

const ctx = new Context()
await mountAgentLoopTestDependencies(ctx)
const harness = await mountAgentLoopTestHarness(ctx)

// Register a handful of tools so a restriction has something to act on.
const names = ['alpha_tool', 'beta_tool', 'gamma_tool']
for (const toolName of names) {
  ctx.tools.register(defineTool({
    name: toolName,
    description: `Probe tool ${toolName}.`,
    parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute() { return 'ok' },
  }))
}

const sessionId = brandString<SessionId>('probe-session')

// Capture what a listener can do at `agent/created`, and what the agent's
// visible tools look like at that moment.
let restrictAtCreatedThrew: string | undefined
let toolsVisibleAtCreated: string[] = []
let restrictFromCreatedWorked = false

ctx.on('agent/created' as never, ((payload: { agent: { ctx?: unknown } }) => {
  const agentCtx = payload?.agent?.ctx as {
    tools?: {
      definitions?: () => readonly { name: string }[]
      restrict?: (filter: { deny?: readonly string[] }) => () => void
    }
  } | undefined

  note(`agent/created: payload.agent.ctx present = ${agentCtx !== undefined}`)
  const tools = agentCtx?.tools
  note(`agent/created: agent.ctx.tools present = ${tools !== undefined}`)

  toolsVisibleAtCreated = (tools?.definitions?.() ?? []).map(t => t.name)
  note(`agent/created: visible tools = [${toolsVisibleAtCreated.join(', ')}]`)

  if (tools?.restrict === undefined) {
    note('agent/created: no restrict() on the scoped tools service')
    return
  }
  try {
    tools.restrict({ deny: ['gamma_tool'] })
    restrictFromCreatedWorked = true
    note('agent/created: restrict({ deny: [gamma_tool] }) accepted')
    note(`agent/created: visible tools after restrict = [${(tools.definitions?.() ?? []).map(t => t.name).join(', ')}]`)
  } catch (error) {
    restrictAtCreatedThrew = String(error)
    note(`agent/created: restrict threw: ${String(error).slice(0, 160)}`)
  }
}) as never)

const agent = await harness.create(sessionId)

// Ask the registry what this agent can actually see, after creation settled.
const scoped = (agent as unknown as { ctx: { tools: { definitions: () => readonly { name: string }[] } } }).ctx.tools
const visibleAfter = scoped.definitions().map(t => t.name)
note(`after create: agent-visible tools = [${visibleAfter.join(', ')}]`)
note(`after create: gamma_tool still visible = ${visibleAfter.includes('gamma_tool')}`)

console.log(report.join('\n'))
console.log('')
console.log(`VERDICT: restrict from agent/created ${restrictFromCreatedWorked ? 'WAS ACCEPTED' : 'was not applied'}`)
console.log(`VERDICT: restriction affected the agent's visible set = ${!visibleAfter.includes('gamma_tool')}`)
if (restrictAtCreatedThrew !== undefined) console.log(`VERDICT: it threw instead — ${restrictAtCreatedThrew.slice(0, 120)}`)

await ctx.stop?.()
