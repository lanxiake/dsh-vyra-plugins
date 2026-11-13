/**
 * Boot check: the built bundle must survive its own timers.
 *
 * A definition was removed from the source while a timer kept calling it, and
 * dsh died with `fatal uncaught exception` on the first tick — fifteen seconds
 * after startup, so nothing that only exercises the module synchronously saw it.
 * Every other check passed while the shipped build crashed.
 *
 * So this mounts the built bundle on a real Cordis context, waits past the
 * flush interval and the scheduled analysis tick, and fails on any uncaught
 * error.
 *
 * Run from the `dsh-Veyra` checkout:
 *
 *   npx tsx <path>/tests/boot-timers.ts
 *
 * @module vyra-tool-usage-stats/boot-timers
 */

import { Context } from '@deepseek-ai/cordis'

/** How long to wait. Long enough to cover the 15s flush interval twice. */
const WAIT_MS = Number(process.env.BOOT_WAIT_MS ?? 35_000)

const problems: string[] = []
process.on('uncaughtException', (error) => { problems.push(`uncaught: ${String(error)}`) })
process.on('unhandledRejection', (error) => { problems.push(`unhandled: ${String(error)}`) })

const ctx = new Context()
const warnings: string[] = []
ctx.provide('logger', { warn: (message: string) => warnings.push(message) } as never)

// A storage table that accepts writes, so the flush path really runs.
const tables = new Map<string, Map<string, unknown>>()
ctx.provide('storageDomain', {
  open: async () => ({
    table: (name: string) => {
      const table = tables.get(name) ?? new Map<string, unknown>()
      tables.set(name, table)
      return {
        get: (key: string) => table.get(key),
        put: async (key: string, value: unknown) => { table.set(key, value) },
      }
    },
    close: async () => {},
  }),
} as never)

// A job-capable agent registry, so the scheduled tick can find a session.
ctx.provide('agents', {
  list: () => [{ session: { id: 'boot-check' }, ctx: { tools: { get: () => undefined, register: () => () => {} } } }],
} as never)

const plugin = await import('../lib/index.js') as { apply: (ctx: unknown, config?: unknown) => void }
plugin.apply(ctx, { analyzeEveryHours: 0.001, minFailures: 1, cooldownDays: 0 })

// Drive a tool result so the fold, the audit, and a flush all really happen.
const session = { id: 'boot-check' }
const emit = (event: unknown): void => {
  ctx.emit('session/event' as never, session as never, event as never)
}
emit({ type: 'tool/call', data: { turn: 1, step: 1, callId: 'c1', name: 'boot_tool', arguments: '{}' } })
emit({
  type: 'tool/result',
  data: {
    turn: 1,
    step: 1,
    message: { role: 'tool', toolCallId: 'c1', content: [{ type: 'text', text: 'no such file' }], isError: true },
    error: { name: 'HarnessError', code: 'BOOT_CHECK', reason: 'no such file' },
  },
})

await new Promise(done => setTimeout(done, WAIT_MS))

if (problems.length > 0) {
  console.error('boot-timers FAILED:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exitCode = 1
} else {
  const stored = [...tables.values()].flatMap(table => [...table.values()]).length
  console.log(`boot-timers: survived ${WAIT_MS / 1000}s of timers; ${warnings.length} warning(s), ${stored} stored record(s).`)
  for (const warning of warnings.slice(0, 3)) console.log(`  warn: ${warning}`)
}
