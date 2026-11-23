// Self-check for the Agent manager's delete path.
//
// The bug this covers: a managed Agent whose profile dependency was lost (a
// profile restore, a hand-edited package.json) is still listed from its preset
// directory, but `pluginManager.removeBundle` does not know the name and answers
// `not-removable`. Deleting such an Agent must clean up what this plugin owns
// instead of making the person restart or edit files by hand.
//
//   node --test plugins/vyra-agent-manager/test/core.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createManager } from '../core.js'

async function fixture(bundle) {
  const home = await mkdtemp(join(tmpdir(), 'am-test-'))
  const profileDir = join(home, 'profiles', 'desktop')
  const presetDir = join(home, 'agent-manager', 'presets', 'foo')
  await mkdir(presetDir, { recursive: true })
  await mkdir(join(profileDir, 'node_modules', '@local'), { recursive: true })
  await writeFile(join(profileDir, 'node_modules', '@local', 'agent-preset-foo'), 'stale')
  await writeFile(join(presetDir, 'agent.json'), JSON.stringify({
    id: 'foo', name: 'Foo', description: 'test', summary: 'test', usage: 'test',
    systemPrompt: 'test', capabilities: [], denyTools: [], denyMcp: [], skills: [], team: [],
  }))
  process.env.DSH_HOME = home
  const calls = []
  const pluginManager = {
    listBundles: async () => (bundle === undefined ? [] : [bundle]),
    removeBundle: async (name) => { calls.push(name); return { application: 'applied', changed: true } },
  }
  const ctx = {
    get: (key) => ({
      profileContext: { dir: profileDir },
      agentPresets: { list: async () => [], inspectCompositions: () => [] },
      pluginManager,
    })[key],
    logger: { warn() {} },
  }
  return { home, presetDir, calls, manager: createManager(ctx), profileDir }
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

test('an Agent whose bundle record was lost is cleaned up instead of failing', async () => {
  const { manager, presetDir, calls, profileDir, home } = await fixture(undefined)
  try {
    const result = await manager.deleteAgent('foo')
    assert.equal(result.pruned, true, 'the delete reports a cleanup, not a normal uninstall')
    assert.deepEqual(calls, [], 'removeBundle is never asked about a name the profile does not list')
    assert.equal(await exists(presetDir), false, 'the preset directory is removed')
    assert.equal(await exists(join(profileDir, 'node_modules', '@local', 'agent-preset-foo')), false, 'the stale link is removed')
  } finally {
    delete process.env.DSH_HOME
    await rm(home, { recursive: true, force: true })
  }
})

test('a protected bundle is refused, and its preset directory is kept', async () => {
  const bundle = { name: '@local/agent-preset-foo', removable: false, enabled: true, availability: 'profile', optional: false }
  const { manager, presetDir, calls, home } = await fixture(bundle)
  try {
    await assert.rejects(() => manager.deleteAgent('foo'), /不能移除|拒绝移除|插件管理器/)
    assert.deepEqual(calls, [], 'removeBundle is not attempted for a bundle the manager refuses')
    assert.equal(await exists(presetDir), true, 'nothing is deleted when removal is refused')
  } finally {
    delete process.env.DSH_HOME
    await rm(home, { recursive: true, force: true })
  }
})

test('a removable bundle goes through removeBundle before the directory', async () => {
  const bundle = { name: '@local/agent-preset-foo', removable: true, enabled: true, availability: 'profile', optional: false }
  const { manager, presetDir, calls, home } = await fixture(bundle)
  try {
    const result = await manager.deleteAgent('foo')
    assert.equal(result.pruned, false)
    assert.deepEqual(calls, ['@local/agent-preset-foo'])
    assert.equal(await exists(presetDir), false)
  } finally {
    delete process.env.DSH_HOME
    await rm(home, { recursive: true, force: true })
  }
})

test('stats aggregate the projection cache by Agent preset', async () => {
  const home = await mkdtemp(join(tmpdir(), 'am-stats-'))
  const dir = join(home, 'storages', 'session_projcache', 'sessions')
  await mkdir(dir, { recursive: true })
  const record = (preset, subagent, stats, createdAt, lastPromptAt, tokens = {}) => ({
    version: 1,
    record: {
      identity: { formatVersion: 4, createdAt, cwd: '/w', isSeeded: false, inheritedEventCount: 0 },
      rows: {
        agentPreset: { val: preset },
        ...subagent === null ? {} : { subagent: { val: { identity: subagent } } },
        sessionStats: { val: stats },
        tokenUsage: { val: { totals: tokens } },
        sessionListMetadata: { val: { lastPromptAt } },
      },
    },
  })
  await writeFile(join(dir, 'a1.json'), JSON.stringify(record('alpha', null, { turns: 2, steps: 5, llmMs: 1000, toolMs: 100 }, 1000, 2000, { uncachedInputTokens: 10, outputTokens: 2 })))
  await writeFile(join(dir, 'a2.json'), JSON.stringify(record('alpha', { mode: 'continuable', label: 'team:worker' }, { turns: 1, steps: 2, llmMs: 500 }, 1500, 1500)))
  await writeFile(join(dir, 'b1.json'), JSON.stringify(record('beta', null, { turns: 3, steps: 3, llmMs: 300 }, 1200, 1200)))
  await writeFile(join(dir, 'broken.json'), '{ not json')
  process.env.DSH_HOME = home
  try {
    const ctx = { get: () => undefined, logger: { warn() {} } }
    const result = await createManager(ctx).stats()
    const alpha = result.presets.find((row) => row.id === 'alpha')
    assert.equal(alpha.sessions, 2)
    assert.equal(alpha.rootSessions, 1, 'a root session and a team-member session are distinguished')
    assert.equal(alpha.memberSessions, 1)
    assert.equal(alpha.turns, 3)
    assert.equal(alpha.steps, 7)
    assert.equal(alpha.llmMs, 1500)
    assert.equal(alpha.avgLlmMs, 750)
    assert.equal(alpha.inputTokens, 10)
    assert.equal(alpha.firstUsedAt, 1000)
    assert.equal(alpha.lastUsedAt, 2000)
    assert.equal(result.presets.find((row) => row.id === 'beta').sessions, 1)
    assert.equal(result.skipped, 1, 'a corrupt cache record is counted, not fatal')
    assert.equal(result.totals.sessions, 3)
  } finally {
    delete process.env.DSH_HOME
    await rm(home, { recursive: true, force: true })
  }
})

test('previewAgent validates without installing and reports the rows a save would use', async () => {
  const home = await mkdtemp(join(tmpdir(), 'am-preview-'))
  process.env.DSH_HOME = home
  try {
    const ctx = {
      get: (key) => (key === 'agentPresets' ? { list: async () => [], inspectCompositions: () => [] } : undefined),
      logger: { warn() {} },
    }
    const manager = createManager(ctx)
    const valid = await manager.previewAgent({
      id: 'reviewer', name: 'Reviewer', description: 'when', summary: 'what', usage: 'how',
      systemPrompt: 'prompt', capabilities: ['files'], denyTools: [], denyMcp: [], skills: [], team: [],
    })
    assert.deepEqual(valid.errors, [])
    assert.ok(valid.rows.length > 0, 'a valid spec previews the rows it would install')
    const invalid = await manager.previewAgent({ id: 'Reviewer', name: 'x' })
    assert.ok(invalid.errors.length > 0)
    assert.deepEqual(invalid.rows, [], 'an invalid spec previews no rows')
  } finally {
    delete process.env.DSH_HOME
    await rm(home, { recursive: true, force: true })
  }
})

console.log('vyra-agent-manager: core checks passed')