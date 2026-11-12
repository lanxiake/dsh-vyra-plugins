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

// Stand in for the Host's Fetch-route registry so the endpoints can be
// exercised without a browser carrier. `register` captures each handler.
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

plugin.apply(ctx)

const route = routes.get('/api/vyra/tool-usage')
assert.ok(route !== undefined, 'the plugin must register its read endpoint')
assert.deepEqual(route.methods, ['GET'])
assert.ok(routes.has('/api/vyra/tool-usage/export'), 'the plugin must register its export endpoint')

const session = { id: 'probe-session' }
const emit = (event: unknown): void => {
  ctx.emit('session/event' as never, session as never, event as never)
}

const call = (callId: string, name: string): unknown => ({
  type: 'tool/call',
  data: { turn: 1, step: 1, callId, name, arguments: '{}' },
})
const result = (callId: string, isError: boolean, detail?: string): unknown => ({
  type: 'tool/result',
  data: {
    turn: 1,
    step: 1,
    message: {
      role: 'tool',
      toolCallId: callId,
      content: [{ type: 'text', text: isError ? (detail ?? 'failed') : 'ok' }],
      isError,
    },
    ...(isError && detail !== undefined
      ? { error: { name: 'HarnessError', code: 'BASH_FAILED', reason: detail } }
      : {}),
  },
})

emit(call('c1', 'bash'))
emit(result('c1', false))
emit(call('c2', 'read'))
emit(result('c2', true, 'command exited with code 1'))
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
  windows: Record<string, { calls: number }>
  sessions: Record<string, { tools: number; calls: number }>
  failures: Record<string, { at: number; summary: string; code?: string; tool: string }[]>
  coverage: { since: string | null; until: string | null; retentionDays: number }
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

// The failure audit is the only thing that says what to fix.
const audit = body.failures.read
assert.ok(audit !== undefined, 'the failed tool must appear in the audit')
assert.equal(audit.length, 1)
assert.equal(audit[0]!.summary, 'command exited with code 1')
assert.equal(audit[0]!.code, 'BASH_FAILED')
assert.equal(body.failures.bash, undefined, 'a tool with no failures has no audit entry')

// Windows are reported from the daily buckets, so today's calls fall inside.
assert.equal(body.windows['7']?.calls, 3)
assert.equal(body.windows['30']?.calls, 3)
assert.ok(body.coverage.since !== null, 'the coverage span must be reported')

// The export is a separate route with its own content disposition.
const exportRoute = routes.get('/api/vyra/tool-usage/export')!
const exported = await exportRoute.fetch(new Request('http://localhost/api/vyra/tool-usage/export'))
assert.equal(exported.status, 200)
assert.match(exported.headers.get('content-disposition') ?? '', /attachment/)

const payload = await exported.json() as {
  exportedAt: number
  totals: { tool: string; count: number; errorCount: number }[]
  failures: { tool: string; summary: string; code?: string }[]
  coverage: { retentionDays: number }
}
assert.equal(payload.totals.length, 2)
assert.equal(payload.failures.length, 1)
assert.equal(payload.failures[0]!.summary, 'command exited with code 1')
assert.equal(payload.coverage.retentionDays, 90)

console.log('integration: endpoints registered, counters, audit, windows, and export all correct.')
console.log(JSON.stringify({ global: body.global, failures: body.failures }, null, 2))
