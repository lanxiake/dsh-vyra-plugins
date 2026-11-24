import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTimeline } from './lib/timeline.js'

/**
 * A Cordis-shaped context: declared services work as properties, undeclared
 * ones throw exactly like the real host ("cannot get property ... without
 * inject"), and only the two-argument `get` is non-throwing.
 *
 * This is the regression that hid the timeline behind an HTTP 500 for several
 * releases, so it is pinned as a test rather than a comment.
 */
function strictCordisCtx({ events = [], declared = {} } = {}) {
  const declaredNames = new Set(Object.keys(declared))
  const target = {
    get(name, strict = true) {
      if (declaredNames.has(name)) return declared[name]
      if (strict === false) return undefined
      throw new Error(`cannot get property "${name}" without inject`)
    },
  }
  // Undeclared services throw on property access too, matching Cordis.
  return new Proxy(target, {
    get(source, key) {
      if (key in source) return source[key]
      if (typeof key === 'symbol') return Reflect.get(source, key)
      if (declaredNames.has(key)) return declared[key]
      if (key === 'then') return undefined
      throw new Error(`cannot get property "${String(key)}" without inject`)
    },
  })
}

const userEvent = (seq, text, offsetMs) => ({
  type: 'user/message',
  seq,
  time: Date.now() - offsetMs,
  data: { content: [{ type: 'text', text }], source: { kind: 'user' } },
})

test('buildTimeline never reads an undeclared service by property', async () => {
  const sessionPersistence = {
    open: async () => ({
      read: async () => ({ events: [userEvent(1, '生成封面', 60_000), { type: 'workspace/changes', seq: 2, data: { turn: 1 } }] }),
      close: async () => {},
    }),
  }
  // `workspaceChanges` is deliberately NOT declared: reading it as a property
  // must not throw, and the timeline must still build.
  const ctx = strictCordisCtx({ declared: { sessionPersistence } })

  const nodes = await buildTimeline({
    ctx,
    sessionId: 's',
    workspaceRoot: 'C:/ws',
    fs: { resolve: async path => ({ targetKey: path, displayPath: path }) },
  })
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].prompt, '生成封面')
})

test('a declared workspaceChanges service supplies per-turn file summaries', async () => {
  const events = [
    userEvent(1, '导出 PDF', 90_000),
    { type: 'workspace/changes', seq: 2, time: Date.now() - 80_000, data: { turn: 1 } },
  ]
  const workspaceChanges = {
    summary: (sessionId, seq) => seq === 2
      ? { turn: 1, time: Date.now() - 80_000, files: [{ path: 'out/a.pdf', display: 'out/a.pdf', added: 3, deleted: 0 }] }
      : undefined,
  }
  const ctx = strictCordisCtx({
    declared: {
      sessionPersistence: { open: async () => ({ read: async () => ({ events }), close: async () => {} }) },
      workspaceChanges,
    },
  })

  const nodes = await buildTimeline({
    ctx,
    sessionId: 's',
    workspaceRoot: 'C:/ws',
    fs: { resolve: async path => ({ targetKey: path, displayPath: path }) },
  })
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].files[0].path, 'out/a.pdf')
  assert.equal(nodes[0].source, 'summary')
})