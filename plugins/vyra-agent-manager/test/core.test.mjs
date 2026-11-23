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

console.log('vyra-agent-manager: core checks passed')