// Checks the model-source feature this repository added: a CLI can be pointed at a provider
// DSH already has configured, and the settings page can switch each CLI between that and its
// own configuration.
//
//   node --test plugins/vyra-agent-cli-manager/test/
//
// The plugin's own vitest suite lives in the source repository this package is built from;
// this covers the surface this repository edits directly, so a published build can be checked
// without that checkout.
import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  defaultSourceFor,
  describeRoute,
  isModelSource,
  modelEnvironment,
  modelRoutesOf,
  readModelRoutes,
  resolveRoute,
} from '../lib/model-source.js'
import { cliHandler } from '../lib/cli/cli-routes.js'

/** Claude Code as this repository ships it: a DSH provider, plus the variables it reads. */
const CLAUDE = {
  id: 'claude',
  name: 'Claude Code',
  command: 'npx',
  args: ['-y', '@agentclientprotocol/claude-agent-acp@0.101.0'],
  models: {
    provider: 'ydy-ds',
    model: 'deepseek-v4.1-flash-1017',
    baseURLEnv: 'ANTHROPIC_BASE_URL',
    apiKeyEnv: 'ANTHROPIC_AUTH_TOKEN',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'ydy-ds/deepseek-v4.1-flash-1017',
  },
}

/** Codex reads OPENAI_*; it is here to prove nothing about Claude's names leaks across. */
const CODEX = {
  id: 'codex',
  name: 'Codex CLI',
  command: 'npx',
  args: ['-y', '@agentclientprotocol/codex-acp@2.5.0'],
  models: {
    provider: 'ydy-ds',
    model: 'glm-5.3',
    baseURLEnv: 'OPENAI_BASE_URL',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'ydy-ds/glm-5.3',
  },
}

/** A CLI that ships without a route, so it keeps its own account. */
const KIMI = { id: 'kimi', name: 'Kimi CLI', command: 'npx', args: ['-y', '@moonshot-ai/kimi-code@2.5.2', 'acp'] }

test('a CLI with a route follows DSH, and one without keeps its own configuration', () => {
  const routes = readModelRoutes([CLAUDE, CODEX, KIMI])
  assert.deepEqual([...routes.keys()], ['claude', 'codex'])
  assert.equal(routes.get('claude').provider, 'ydy-ds')
  assert.equal(routes.get('claude').model, 'deepseek-v4.1-flash-1017')
  assert.equal(defaultSourceFor(routes, 'claude'), 'dsh')
  assert.equal(defaultSourceFor(routes, 'kimi'), 'cli', 'no route means nothing to follow')
})

test('a route naming no provider is skipped rather than offered as a switch', () => {
  const blank = { ...CLAUDE, models: { provider: '', model: 'deepseek-v4.1-flash-1017', modelEnv: 'ANTHROPIC_MODEL' } }
  assert.equal(readModelRoutes([blank]).size, 0)
  assert.equal(readModelRoutes([{ ...CLAUDE, models: { provider: 'ydy-ds', model: '' } }]).size, 0)
  assert.equal(readModelRoutes(undefined).size, 0)
})

test('the variable names are read separately, because an empty one refuses the route', () => {
  const written = modelRoutesOf([CLAUDE], 'claude')
  assert.deepEqual(written, {
    baseURLEnv: 'ANTHROPIC_BASE_URL',
    apiKeyEnv: 'ANTHROPIC_AUTH_TOKEN',
    apiKeyEnvs: [],
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'ydy-ds/deepseek-v4.1-flash-1017',
  })
  assert.equal(modelRoutesOf([KIMI], 'kimi'), undefined)
  assert.equal(modelRoutesOf([{ id: 'kimi', models: {} }], 'kimi').baseURLEnv, '')
})

test('the endpoint and credential name come from DSH when the route does not repeat them', () => {
  const route = readModelRoutes([CLAUDE]).get('claude')
  const resolved = resolveRoute(route, () => ({ baseURL: 'https://vip.example.com/v1', apiKeyEnv: 'YDY_DS_API_KEY' }))
  assert.equal(resolved.baseURL, 'https://vip.example.com/v1')
  assert.equal(resolved.apiKeyEnv, 'ANTHROPIC_AUTH_TOKEN', 'a name the route wrote itself wins')
})

test('a route that writes its own endpoint keeps it', () => {
  const route = { provider: 'ydy-ds', model: 'm', baseURL: 'https://mine.example.com/v1', apiKeyEnv: 'MY_KEY' }
  const resolved = resolveRoute(route, () => ({ baseURL: 'https://theirs.example.com/v1', apiKeyEnv: 'THEIR_KEY' }))
  assert.equal(resolved.baseURL, 'https://mine.example.com/v1')
  assert.equal(resolved.apiKeyEnv, 'MY_KEY')
})

test('a provider with no address of its own falls back to its published endpoint', () => {
  const route = { provider: 'anthropic', model: 'claude-sonnet', providerBaseURL: 'https://api.anthropic.com' }
  assert.equal(resolveRoute(route, () => undefined).baseURL, 'https://api.anthropic.com')
  assert.equal(resolveRoute(route, () => ({ baseURL: 'https://configured.example.com' })).baseURL, 'https://configured.example.com')
})

test('the environment a CLI is launched with names the model and the endpoint', () => {
  const variables = {
    baseURL: { name: 'ANTHROPIC_BASE_URL' },
    apiKeyEnv: { name: 'ANTHROPIC_AUTH_TOKEN' },
    modelEnv: { name: 'ANTHROPIC_MODEL' },
    defaultModel: 'ydy-ds/deepseek-v4.1-flash-1017',
  }
  const route = { provider: 'ydy-ds', model: 'deepseek-v4.1-flash-1017', baseURL: 'https://vip.example.com/v1', apiKeyEnv: 'YDY_DS_API_KEY' }
  assert.deepEqual(modelEnvironment(route, 'default', 'sk-secret', variables), {
    ANTHROPIC_BASE_URL: 'https://vip.example.com/v1',
    ANTHROPIC_MODEL: 'ydy-ds/deepseek-v4.1-flash-1017',
    ANTHROPIC_AUTH_TOKEN: 'sk-secret',
  })
})

test('a model the CLI itself reported is passed through, not replaced by the default', () => {
  const variables = { baseURL: { name: 'B' }, modelEnv: { name: 'M' }, defaultModel: 'v/d' }
  const route = { provider: 'p', model: 'm', baseURL: 'https://e' }
  assert.deepEqual(modelEnvironment(route, 'haiku', 'k', variables), { B: 'https://e', M: 'haiku' })
  assert.deepEqual(modelEnvironment(route, 'haiku', undefined, variables), { B: 'https://e', M: 'haiku' }, 'no key, no variable')
})

test('a route with no endpoint produces no environment, so the CLI starts unchanged', () => {
  assert.deepEqual(modelEnvironment({ provider: 'p', model: 'm' }, 'default', 'k', { modelEnv: { name: 'M' } }), {})
  assert.deepEqual(modelEnvironment({ provider: 'p', model: 'm', baseURL: 'https://e' }, 'default', 'k', {}), {})
})

test('the same secret is written under every key variable the CLI might read', () => {
  const route = { provider: 'p', model: 'm', baseURL: 'https://e' }
  const env = modelEnvironment(route, 'default', 'k', {
    baseURL: { name: 'B' },
    modelEnv: { name: 'M' },
    apiKeyEnvs: [{ name: 'ANTHROPIC_AUTH_TOKEN' }, { name: 'ANTHROPIC_API_KEY' }],
  })
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, 'k')
  assert.equal(env.ANTHROPIC_API_KEY, 'k')
})

test('only the two sources this plugin offers are accepted', () => {
  assert.equal(isModelSource('dsh'), true)
  assert.equal(isModelSource('cli'), true)
  assert.equal(isModelSource('env'), false)
  assert.equal(isModelSource(undefined), false)
})

test('a description names the provider and model but never the credential', () => {
  const route = { provider: 'ydy-ds', model: 'deepseek-v4.1-flash-1017', baseURL: 'https://vip.example.com/v1', apiKeyEnv: 'YDY_DS_API_KEY' }
  const followed = describeRoute(route, 'dsh', true)
  assert.match(followed.title, /ydy-ds · deepseek-v4\.1-flash-1017/)
  assert.match(followed.hint, /DSH/)
  assert.doesNotMatch(`${followed.title}${followed.hint}`, /YDY_DS_API_KEY/, 'the panel never shows the key name it reads')
  const own = describeRoute(route, 'cli')
  assert.match(own.title, /CLI/)
})

/** A stand-in for the bridge's panel: rows by CLI id, and the picks it has recorded. */
function panel(rows) {
  const picks = new Map(rows.map((row) => [row.id, row.source]))
  return {
    list: () => rows.map((row) => ({ ...row, source: picks.get(row.id) ?? 'dsh' })),
    choose: (id, source) => {
      if (!picks.has(id) || !isModelSource(source)) return false
      picks.set(id, source)
      return true
    },
  }
}

function routeHandler(models) {
  return cliHandler(
    {
      host: { capture: async () => ({ exitCode: 1, stdout: '', stderr: '' }) },
      latest: async () => undefined,
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      home: '/tmp',
      readFile: async () => undefined,
      listDirectory: async () => undefined,
      writeFile: async () => {},
      skills: {},
      skillInstall: {},
      skillConsolidate: {},
      models,
    },
    { requestRejection: () => undefined },
    () => {},
  )
}

/** One request through the handler, answering the HTTP status and the parsed body. */
async function call(handler, path, body) {
  let status = 0
  let text = ''
  const res = {
    writeHead: (code) => { status = code },
    end: (chunk) => { text = chunk },
  }
  await handler({ method: 'POST', url: `/dsh-vyra-agent-cli-manager/cli/${path}`, headers: {}, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) } }, res)
  return { status, body: JSON.parse(text) }
}

const SOURCE_ROW = {
  id: 'claude',
  name: 'Claude Code',
  source: 'dsh',
  provider: 'ydy-ds',
  model: 'deepseek-v4.1-flash-1017',
  endpoint: 'https://vip.example.com/v1',
  endpointFromDSH: true,
  credential: 'YDY_DS_API_KEY',
  problem: null,
}

test('the model-sources route answers every CLI and records the picks it is given', async () => {
  const models = panel([SOURCE_ROW])
  const handler = routeHandler(models)
  const first = await call(handler, 'model-sources', { chosen: [{ id: 'claude', source: 'cli' }] })
  assert.equal(first.status, 200)
  assert.equal(first.body.success, true)
  assert.equal(first.body.data.sources[0].source, 'cli', 'the pick sent by the browser is what it reads back')
  const second = await call(handler, 'model-sources', {})
  assert.equal(second.body.data.sources[0].source, 'cli')
})

test('a pick for a CLI with no route is refused instead of stored', async () => {
  const models = panel([SOURCE_ROW])
  const handler = routeHandler(models)
  const answer = await call(handler, 'model-sources', { chosen: [{ id: 'kimi', source: 'dsh' }, { id: 'claude', source: 'bogus' }] })
  assert.equal(answer.body.data.sources[0].source, 'dsh', 'neither bad pick changed a row')
})

test('a composition with no model panel answers an empty list rather than failing', async () => {
  const answer = await call(routeHandler(undefined), 'model-sources', {})
  assert.equal(answer.status, 200)
  assert.deepEqual(answer.body.data.sources, [])
})
