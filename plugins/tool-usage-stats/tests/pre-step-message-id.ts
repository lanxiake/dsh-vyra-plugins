/**
 * Every message the plugin contributes to a step must carry an `id`.
 *
 * The harness's append path does not check for one; its load path refuses any
 * stored message event without it. A message contributed as a bare
 * `{role, content, source}` therefore wrote fine and turned the session into a
 * corrupt log that could not be reopened — this check exists so that failure
 * mode cannot come back.
 *
 * Run from the `dsh-Veyra` checkout:
 *
 *   npx tsx <path>/tests/pre-step-message-id.ts
 *
 * @module vyra-tool-usage-stats/pre-step-message-id
 */

import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'

const ctx = new Context()
const warnings: string[] = []
ctx.provide('logger', { warn: (message: string) => warnings.push(message) } as never)

const plugin = await import('../lib/index.js') as { apply: (ctx: unknown, config?: unknown) => void }
// minFailures 0 makes the first step after the failures below worth diagnosing,
// so the injection path runs without waiting on a threshold.
plugin.apply(ctx, { minFailures: 0, cooldownDays: 0, analyzeEveryHours: 0 })

const session = { id: 'id-check-session' }
const emit = (event: unknown): void => {
  ctx.emit('session/event' as never, session as never, event as never)
}

// Enough failures that `prepareRun` has something to ask about.
for (let i = 0; i < 6; i += 1) {
  const callId = `c${i}`
  emit({ type: 'tool/call', data: { turn: 1, step: 1, callId, name: 'bash', arguments: '{}' } })
  emit({
    type: 'tool/result',
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'tool',
        toolCallId: callId,
        content: [{ type: 'text', text: 'command failed' }],
        isError: true,
      },
      error: { name: 'HarnessError', code: 'BASH_FAILED' },
    },
  })
}

const agent = { session, tools: { definitions: () => [] } }
const decision = await ctx.waterfall('agent/pre-step' as never, { agent, messages: [], turn: 1, step: 1 } as never, () => Promise.resolve({ kind: 'enter', messages: [] })) as {
  messages: readonly { role: string; id?: unknown; source?: { kind?: string } }[]
}

const injected = decision.messages.filter(message => message.source?.kind === 'vyra-tool-usage-stats')
assert.equal(injected.length, 1, `expected one injected diagnosis request, got ${injected.length}`)
for (const message of decision.messages) {
  assert.equal(typeof message.id, 'string', `contributed message lacks an id: ${JSON.stringify(message).slice(0, 120)}`)
  assert.notEqual(message.id, '', 'contributed message has an empty id')
}

console.log('pre-step-message-id: every contributed message carries a non-empty id.')
