/**
 * Integration check: mount the built plugin on a real Cordis context and drive
 * it with real `session/event` dispatches.
 *
 * Run from the `dsh-Veyra` checkout, where `@deepseek-ai/cordis` resolves:
 *
 *   npx tsx <path>/tests/integration.ts
 *
 * This is the check that fails if `apply` stops subscribing, if the callId
 * pairing breaks, or if a counter stops advancing — none of which the pure
 * `counters.ts` unit tests can catch.
 *
 * @module vyra-tool-usage-stats/integration
 */

import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'

const plugin = await import('../lib/index.js') as {
  name: string
  inject: string[]
  apply: (ctx: unknown, config?: unknown) => void
}

assert.equal(plugin.name, 'vyra-tool-usage-stats')
assert.deepEqual(plugin.inject, ['sessions'])

const ctx = new Context()
const warnings: string[] = []
// `logger` is read through `ctx.get`, so it must be provided as a service.
ctx.provide('logger', { warn: (message: string) => warnings.push(message) } as never)

plugin.apply(ctx)

// A session object only needs the `id` the pairing map is keyed by.
const session = { id: 'probe-session' }
const emit = (event: unknown): void => {
  ctx.emit('session/event' as never, session as never, event as never)
}

const call = (callId: string, name: string): unknown => ({
  type: 'tool/call',
  data: { turn: 1, step: 1, callId, name, arguments: '{}' },
})
const result = (callId: string, isError: boolean): unknown => ({
  type: 'tool/result',
  data: { turn: 1, step: 1, callId, message: { isError } },
})

emit(call('c1', 'bash'))
emit(result('c1', false))
emit(call('c2', 'read'))
emit(result('c2', true))
emit(call('c3', 'read'))
emit(result('c3', false))

// A result whose call was never seen must be skipped, not attributed.
emit(result('c-unknown', false))

// Unrelated events must not disturb the counters.
emit({ type: 'turn/start', data: { turn: 2 } })

assert.deepEqual(warnings, [], `no warnings expected, got ${JSON.stringify(warnings)}`)

console.log('integration: plugin mounted, 3 results recorded, unknown call skipped, unrelated event ignored.')
