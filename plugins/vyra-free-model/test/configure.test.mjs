import test from 'node:test'
import assert from 'node:assert/strict'
import { planClaudeWrite, planCodexWrite, starterScript } from '../src/configure.js'

/**
 * A redacted copy of a real `~/.claude/settings.json`: it holds a working
 * third-party provider plus unrelated settings. The whole point of these tests
 * is that writing our key leaves every one of these bytes alone.
 */
const CLAUDE_ORIGINAL = JSON.stringify({
  env: {
    ANTHROPIC_AUTH_TOKEN: 'existing-token',
    ANTHROPIC_BASE_URL: 'https://ai.example.com',
    ANTHROPIC_MODEL: 'existing-model',
    DISABLE_TELEMETRY: '1',
  },
  permissions: { defaultMode: 'bypassPermissions' },
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'rtk hook' }] }] },
  statusLine: { type: 'command', command: 'ccusage statusline' },
  enabledPlugins: { 'figma@official': true },
}, null, 2)

/**
 * A redacted copy of a real `~/.codex/config.toml`: a working custom provider,
 * MCP servers and project trust entries.
 */
const CODEX_ORIGINAL = [
  'model_provider = "custom"',
  'model = "gpt-5.6-terra"',
  '',
  '[model_providers.custom]',
  'name = "link-Codex"',
  'base_url = "https://relay.example.com/v1"',
  'wire_api = "responses"',
  'requires_openai_auth = true',
  '',
  '[mcp_servers.postgres-mcp]',
  'command = "uvx"',
  'args = ["postgres-mcp"]',
  '',
  "[projects.'e:\\my-project\\app']",
  'trust_level = "trusted"',
  '',
].join('\n')

// ── Claude Code ─────────────────────────────────────────────────────────────

test('writing the claude entry keeps every existing byte', () => {
  const plan = planClaudeWrite(CLAUDE_ORIGINAL, {
    port: 8899, key: 'sk-new', model: 'kilo-auto/free',
  })
  const after = JSON.parse(plan.after)
  assert.deepEqual(after.env, JSON.parse(CLAUDE_ORIGINAL).env, 'the env block must not change')
  assert.deepEqual(after.permissions, JSON.parse(CLAUDE_ORIGINAL).permissions)
  assert.deepEqual(after.hooks, JSON.parse(CLAUDE_ORIGINAL).hooks)
  assert.deepEqual(after.statusLine, JSON.parse(CLAUDE_ORIGINAL).statusLine)
  assert.deepEqual(after.enabledPlugins, JSON.parse(CLAUDE_ORIGINAL).enabledPlugins)
})

test('the claude entry lands under its own key with the port, key and model', () => {
  const plan = planClaudeWrite(CLAUDE_ORIGINAL, { port: 8899, key: 'sk-new', model: 'some/model:free' })
  const after = JSON.parse(plan.after)
  assert.deepEqual(after.vyraFree, {
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:8899',
    ANTHROPIC_AUTH_TOKEN: 'sk-new',
    ANTHROPIC_MODEL: 'some/model:free',
  })
})

test('writing twice to the claude file is idempotent', () => {
  const first = planClaudeWrite(CLAUDE_ORIGINAL, { port: 8899, key: 'sk', model: 'm' })
  const second = planClaudeWrite(first.after, { port: 8899, key: 'sk', model: 'm' })
  assert.equal(second.after, first.after)
})

test('a claude file with no settings at all still gets a valid document', () => {
  const plan = planClaudeWrite('', { port: 8899, key: 'sk', model: 'm' })
  const after = JSON.parse(plan.after)
  assert.equal(after.vyraFree.ANTHROPIC_BASE_URL, 'http://127.0.0.1:8899')
})

test('a damaged claude file is refused rather than overwritten', () => {
  const plan = planClaudeWrite('{ not json', { port: 8899, key: 'sk', model: 'm' })
  assert.equal(plan.ok, false)
  assert.ok(String(plan.reason).length > 0)
  assert.equal(plan.after, undefined)
})

test('the claude plan reports the file it will touch and the backup path', () => {
  const plan = planClaudeWrite(CLAUDE_ORIGINAL, { port: 8899, key: 'sk', model: 'm' })
  assert.ok(plan.path.endsWith('settings.json'))
  assert.ok(plan.backup.includes('.vyra-bak-'))
  assert.equal(plan.before, CLAUDE_ORIGINAL)
})

// ── Codex ───────────────────────────────────────────────────────────────────

test('writing the codex provider keeps the existing provider and every other section', () => {
  const plan = planCodexWrite(CODEX_ORIGINAL, { port: 8899 })
  assert.ok(plan.ok, plan.reason)
  for (const marker of [
    'model_provider = "custom"',
    'model = "gpt-5.6-terra"',
    '[model_providers.custom]',
    'name = "link-Codex"',
    'base_url = "https://relay.example.com/v1"',
    'requires_openai_auth = true',
    '[mcp_servers.postgres-mcp]',
    'command = "uvx"',
    'trust_level = "trusted"',
  ]) {
    assert.ok(plan.after.includes(marker), `the write dropped: ${marker}`)
  }
})

test('the default provider pointer is not touched', () => {
  const plan = planCodexWrite(CODEX_ORIGINAL, { port: 8899 })
  const top = plan.after.split('\n[model_providers.vyra-free]')[0]
  assert.ok(top.includes('model_provider = "custom"'), 'the user chose their provider; keep it')
})

test('the codex provider section carries the loopback base url and responses wire api', () => {
  const plan = planCodexWrite(CODEX_ORIGINAL, { port: 8899 })
  const section = plan.after.slice(plan.after.indexOf('[model_providers.vyra-free]'))
  assert.ok(section.includes('base_url = "http://127.0.0.1:8899/v1"'))
  assert.ok(section.includes('wire_api = "responses"'))
})

test('writing twice to the codex file replaces the section rather than duplicating it', () => {
  const first = planCodexWrite(CODEX_ORIGINAL, { port: 8899 })
  const second = planCodexWrite(first.after, { port: 9999 })
  const occurrences = second.after.split('[model_providers.vyra-free]').length - 1
  assert.equal(occurrences, 1, 'the section must appear exactly once')
  assert.ok(second.after.includes('http://127.0.0.1:9999/v1'))
  assert.equal(second.after.includes('8899'), false, 'the old port must be gone')
})

test('a codex file with no providers still gets a usable section', () => {
  const plan = planCodexWrite('', { port: 8899 })
  assert.ok(plan.ok)
  assert.ok(plan.after.includes('[model_providers.vyra-free]'))
})

test('rubbish that is not TOML is refused rather than guessed at', () => {
  // A stray table header with no key is not something to "repair" silently.
  const plan = planCodexWrite('[model_providers.custom\nname = "x"', { port: 8899 })
  assert.equal(plan.ok, false)
  assert.ok(String(plan.reason).length > 0)
})

// ── starter scripts ─────────────────────────────────────────────────────────

test('the claude starter script points at the local port and keeps user arguments', () => {
  const script = starterScript('claude', { port: 8899, key: 'sk-new', model: 'some/model:free' })
  assert.ok(script.includes('ANTHROPIC_BASE_URL=http://127.0.0.1:8899'))
  assert.ok(script.includes('ANTHROPIC_AUTH_TOKEN=sk-new'))
  assert.ok(script.includes('ANTHROPIC_MODEL=some/model:free'))
  assert.ok(script.includes('%*'), 'arguments must be forwarded')
  assert.ok(script.includes('claude'), 'it must run claude')
})

test('the codex starter script overrides the provider for this invocation only', () => {
  const script = starterScript('codex', { port: 8899 })
  assert.ok(script.includes('8899'))
  assert.ok(script.includes('%*'))
  assert.ok(script.includes('codex'))
})