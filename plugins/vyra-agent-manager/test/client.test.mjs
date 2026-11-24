// Self-check for the Agent manager's system-preset reader: the entry-list YAML
// parser and the model that puts a system preset and a custom Agent into one
// detail layout.
//
//   node --test plugins/vyra-agent-manager/test/client.test.mjs
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root, 'client.js'), 'utf8')

let exports
const window = {
  __ModuleLoader__: {
    load: ({ id, factory }) => {
      assert.equal(id, 'dsh-vyra-agent-manager', 'the bundle registers under its package name')
      exports = factory(() => ({
        createElement: (type, props, ...children) => ({ type, props, children }),
        useState: () => [undefined, () => {}],
        useEffect: () => {},
        useMemo: () => undefined,
        useRef: () => ({ current: undefined }),
        useCallback: (fn) => fn,
        Component: class { constructor(props) { this.props = props; this.state = {}; } setState() {} },
      }))
    },
  },
}
new Function('window', 'document', source)(window, undefined)

const { parseEntryYaml, detailModel } = exports.__internal

const YAML = `- id: tool-fs
  name: '@deepseek-ai/dsh-tool-fs'
  config:
    applyPatch: false
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: |
      你是一个测试 Agent。
      第二行。
- id: delegation
  name: cordis:group
  isolate:
    workflowEngine: true
  config:
    - id: tool-subagent
      name: '@deepseek-ai/dsh-tool-subagent'
    - id: tool-workflow
      name: '@deepseek-ai/dsh-tool-workflow'
`

const rows = parseEntryYaml(YAML)
assert.ok(Array.isArray(rows), 'an entry list parses into an array')
assert.equal(rows.length, 3)
assert.equal(rows[0].id, 'tool-fs')
assert.equal(rows[0].name, '@deepseek-ai/dsh-tool-fs')
assert.equal(rows[0].config.applyPatch, false, 'booleans survive')
assert.equal(rows[1].config.prefix, '你是一个测试 Agent。\n第二行。', 'block text keeps its lines')
assert.equal(rows[2].config.length, 2, 'a nested entry list stays a list')
assert.equal(rows[2].config[1].name, '@deepseek-ai/dsh-tool-workflow')

assert.equal(parseEntryYaml('{ not: an entry list }'), null, 'a document that is not a list falls back to raw text')

const meta = {
  capabilities: [
    { id: 'files', label: 'files', modules: ['@deepseek-ai/dsh-tool-fs'] },
    { id: 'delegation', label: 'delegation', modules: ['@deepseek-ai/dsh-tool-subagent', '@deepseek-ai/dsh-tool-workflow'] },
  ],
}
const system = detailModel({
  managed: false,
  preset: { id: 'standard', name: 'Standard', description: '默认模式' },
  yaml: YAML,
  modules: [],
  capabilities: [],
  readError: '',
}, meta)
assert.equal(system.kind, 'system')
assert.equal(system.prompt, '你是一个测试 Agent。\n第二行。', 'the persona prefix becomes the prompt')
assert.deepEqual(system.modules.sort(), ['@deepseek-ai/dsh-persona', '@deepseek-ai/dsh-tool-fs', '@deepseek-ai/dsh-tool-subagent', '@deepseek-ai/dsh-tool-workflow'])
assert.deepEqual(system.capabilities.sort(), ['delegation', 'files'], 'capabilities are inferred from the declared modules')
assert.equal(system.promptExpression, false)

const custom = detailModel({
  managed: true,
  spec: {
    id: 'reviewer', name: 'Reviewer', description: '审查', summary: '只读', usage: '新建会话',
    systemPrompt: '你是审查员', capabilities: ['files'], denyTools: ['web_search'], skills: ['x'], team: [],
  },
  installed: true,
  bundle: { present: true, enabled: true },
  broken: null,
}, meta)
assert.equal(custom.kind, 'managed')
assert.equal(custom.summary, '只读')
assert.equal(custom.prompt, '你是审查员')
assert.deepEqual(custom.deniedTools, ['web_search'])

console.log('dsh-vyra-agent-manager: client checks passed')