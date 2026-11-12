/**
 * End-to-end check with production-shaped event payloads: the `tool/call` and
 * `tool/result` bodies below are the exact field sets the executor appends, so
 * this fails if the plugin reads a field name the loop does not actually write.
 *
 * Run from the `dsh-Veyra` checkout:
 *
 *   npx tsx <path>/tests/session-e2e.ts
 *
 * A bare `Context` is used rather than a store-backed Session: `Session.append`
 * requires a store to assign sequence numbers, and the field names — which is
 * what this check exists to verify — are identical either way. The
 * `tool/result` payload shape is taken from `SessionEventMap` in
 * `packages/core/session/src/types.ts`.
 *
 * @module vyra-tool-usage-stats/session-e2e
 */

import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'

const ctx = new Context()
const warnings: string[] = []
ctx.provide('logger', { warn: (message: string) => warnings.push(message) } as never)

interface Route {
  path: string
  methods: readonly string[]
  fetch: (request: Request) => Promise<Response>
}
const routes = new Map<string, Route>()
ctx.provide('connection', {
  fetch: {
    register: (registered: Route) => {
      routes.set(registered.path, registered)
      return () => {}
    },
  },
} as never)

const plugin = await import('../lib/index.js') as { apply: (ctx: unknown) => void }
plugin.apply(ctx)
const route = routes.get('/api/vyra/tool-usage')
assert.ok(route !== undefined, 'the read endpoint must be registered')

const session = { id: 'e2e-session' }
const emit = (event: unknown): void => {
  ctx.emit('session/event' as never, session as never, event as never)
}

// Field sets copied from SessionEventMap.
const call = (callId: string, name: string): unknown => ({
  type: 'tool/call',
  data: { turn: 1, step: 1, callId, name, arguments: '{"command":"ls"}' },
})

const result = (callId: string, isError: boolean): unknown => ({
  type: 'tool/result',
  data: {
    turn: 1,
    step: 1,
    message: {
      role: 'tool',
      toolCallId: callId,
      content: [{ type: 'text', text: isError ? 'command failed' : 'file.txt' }],
      isError,
    },
    ...(isError ? { error: { name: 'HarnessError', code: 'BASH_FAILED' } } : {}),
  },
})

emit({ type: 'turn/start', data: { turn: 1 } })
emit(call('c1', 'bash'))
emit(result('c1', false))
emit(call('c2', 'read'))
emit(result('c2', true))
emit(call('c3', 'bash'))
emit(result('c3', false))
emit({ type: 'step/end', data: { turn: 1, step: 1 } })
emit({ type: 'turn/end', data: { turn: 1 } })

assert.deepEqual(warnings, [], `no warnings expected, got ${JSON.stringify(warnings)}`)

const response = await route.fetch(new Request('http://localhost/api/vyra/tool-usage'))
assert.equal(response.status, 200)

const body = await response.json() as {
  global: { rows: { tool: string; count: number; errorCount: number; errorRate: number }[]; tools: number; calls: number; failures: number }
  sessions: Record<string, { calls: number; failures: number }>
}

assert.equal(body.global.tools, 2, 'bash and read')
assert.equal(body.global.calls, 3)
assert.equal(body.global.failures, 1)

const bash = body.global.rows.find(row => row.tool === 'bash')!
assert.equal(bash.count, 2)
assert.equal(bash.errorCount, 0)
assert.equal(bash.errorRate, 0)

const read = body.global.rows.find(row => row.tool === 'read')!
assert.equal(read.count, 1)
assert.equal(read.errorCount, 1)
assert.equal(read.errorRate, 1)

assert.equal(body.global.rows[0]!.tool, 'bash', 'the most-used tool sorts first')
assert.deepEqual(body.sessions['e2e-session'], {
  rows: body.sessions['e2e-session']!.rows,
  tools: 2,
  calls: 3,
  failures: 1,
} as never)

console.log('session-e2e: production-shaped events folded, both views and the endpoint correct.')
console.log(JSON.stringify(body.global))
