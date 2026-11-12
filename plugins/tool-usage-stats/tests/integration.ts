/**
 * Integration check: mount the built Host bundle on a real Cordis context,
 * drive it with real `session/event` dispatches, and read back the endpoint
 * response the Client would receive.
 *
 * Run from the `dsh-Veyra` checkout, where `@deepseek-ai/cordis` resolves:
 *
 *   npx tsx <path>/tests/integration.ts
 *
 * This is the check that fails if `apply` stops subscribing, if the callId
 * pairing breaks, if the route stops registering, or if the response stops
 * carrying the global report — none of which the pure `counters.ts` tests can
 * catch.
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
ctx.provide('logger', { warn: (message: string) => warnings.push(message) } as never)

// Stand in for the Host's Fetch-route registry so the endpoint can be exercised
// without a browser carrier. `register` captures the handler the plugin submits.
let route: { path: string; methods: readonly string[]; fetch: (request: Request) => Promise<Response> } | undefined
ctx.provide('connection', {
  fetch: {
    register: (registered: typeof route) => {
      route = registered
      return () => {}
    },
  },
} as never)

plugin.apply(ctx)

assert.ok(route !== undefined, 'the plugin must register its endpoint')
assert.equal(route.path, '/api/vyra/tool-usage')
assert.deepEqual(route.methods, ['GET'])

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
  data: { turn: 1, step: 1, message: { role: 'tool', toolCallId: callId, content: [], isError } },
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

const response = await route.fetch(new Request('http://localhost/api/vyra/tool-usage'))
assert.equal(response.status, 200)
assert.equal(response.headers.get('content-type'), 'application/json')

const body = await response.json() as {
  global: { rows: { tool: string; count: number; errorCount: number }[]; tools: number; calls: number; failures: number }
  sessions: Record<string, { tools: number; calls: number }>
}

assert.equal(body.global.tools, 2, 'bash and read')
assert.equal(body.global.calls, 3, 'the unknown call is excluded')
assert.equal(body.global.failures, 1)

const read = body.global.rows.find(row => row.tool === 'read')!
assert.equal(read.count, 2)
assert.equal(read.errorCount, 1)

assert.equal(body.global.rows[0]!.tool, 'read', 'the most-used tool sorts first')

const perSession = body.sessions['probe-session']
assert.ok(perSession !== undefined, 'the session view must be present')
assert.equal(perSession.calls, 3)

console.log('integration: endpoint registered, 3 results recorded, unknown call excluded, both views reported.')
console.log(JSON.stringify(body.global, null, 2))
