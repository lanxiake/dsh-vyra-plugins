# vyra-dsh-console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a DSH agent a first-class, boundary-respecting channel to operate the harness itself — models, settings, plugins, skills/MCP, and (via the Client half) theme and layout.

**Architecture:** A dual-half bundle. The Host half registers one `dsh_console` tool whose single business implementation lives in `core.js`; the Client half registers nothing but receives Remote requests and calls `ctx.theme` / `ctx.layout` / `ctx.locale`, which exist only in the browser realm. A read-only CLI (`vyra-console`) covers diagnosis, and a skill teaches the agent which layer to use.

**Tech Stack:** Plain ESM JavaScript (no build step), Node `node --test`, Cordis plugin API, DSH bundle patch YAML.

**Spec:** `docs/superpowers/specs/2026-11-23-vyra-dsh-console-design.md`

## Global Constraints

- **Package name:** `vyra-dsh-console`. The bundle `id` in `client.js`'s `window.__ModuleLoader__.load({ id })` MUST equal the package name — the module system matches startup rows by package name, and a mismatch makes the plugin silently not mount.
- **Patch row name** in `cordis.patch.yml` is also the package name.
- **Boundary (spec §2.2), non-negotiable:** `sandbox` mode changes, `permissionPresets.set`, `approval` answering, and any `credentialsController.set` are **forbidden to the agent**. These return `status: 'forbidden'` with a reason and the user-facing alternative — never silently absent, never executed.
- **One operation, two callers (spec §3.2):** UI actions and the agent tool MUST call the same `core.js` method. No duplicated logic in any path.
- **Config over constants:** tunables go in the plugin `Config` so users change them in `cordis.patch.yml`; the user's patch layer survives upgrades.
- **Every plugin README ends with the contact block.** Run `pnpm run contact` (idempotent) rather than hand-writing it.
- **`assets/qq-group.png` must exist and be listed in `package.json`'s `files`**, or `pnpm run check:installable` fails.
- Optional services are injected via `ctx.inject([...], cb)` so the plugin stays inactive rather than throwing in a profile without them.
- All visible UI text goes through the Client locale service; panel copy ships zh + en.
- Test command form: `node --test plugins/vyra-dsh-console/test/<file>.test.mjs`.

---

### Task 1: Bundle skeleton, boundary policy, and the domain registry

Establishes the package, the patch row, and the single source of truth for "which actions exist and which are forbidden". Every later task hangs off this registry.

**Files:**
- Create: `plugins/vyra-dsh-console/package.json`
- Create: `plugins/vyra-dsh-console/cordis.patch.yml`
- Create: `plugins/vyra-dsh-console/index.js`
- Create: `plugins/vyra-dsh-console/core.js`
- Create: `plugins/vyra-dsh-console/LICENSE`
- Create: `plugins/vyra-dsh-console/assets/qq-group.png` (copied)
- Create: `plugins/vyra-dsh-console/README.md`
- Test: `plugins/vyra-dsh-console/test/core.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `createConsole(ctx)` → object with `listActions()`, `dispatch(action, args)`; `ACTIONS` — a frozen map `name → { domain, mutating, destructive, requiresClient }`; `FORBIDDEN` — a frozen map `name → reason`. Later tasks add domain handlers via `createConsole`'s `handlers` argument.

- [ ] **Step 1: Create the package manifest**

Create `plugins/vyra-dsh-console/package.json`:

```json
{
  "name": "vyra-dsh-console",
  "version": "0.1.0",
  "type": "module",
  "description": "让 Agent 操作 DSH 自身的控制台：模型、设置、插件、主题与布局，带明确的权限边界。",
  "main": "index.js",
  "bin": { "vyra-console": "./cli.mjs" },
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./cli": "./cli.mjs",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg",
    "./package.json": "./package.json"
  },
  "files": [
    "index.js",
    "core.js",
    "channel.js",
    "client.js",
    "cli.mjs",
    "cordis.patch.yml",
    "locale/*.json",
    "icon.svg",
    "README.md",
    "assets/qq-group.png"
  ],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": []
    }
  },
  "keywords": ["dsh", "dsh-plugin", "deepseek-harness", "console", "settings"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/lanxiake/dsh-vyra-plugins.git",
    "directory": "plugins/vyra-dsh-console"
  },
  "scripts": { "test": "node --test test/core.test.mjs test/channel.test.mjs test/client.test.mjs" }
}
```

Note: `channel.js`, `client.js`, `cli.mjs`, `locale/*.json`, `icon.svg` do not exist yet; `pnpm run check:installable` verifies every literal `files` entry exists, so it will fail until later tasks land. That is expected until Task 7.

- [ ] **Step 2: Create the patch row**

Create `plugins/vyra-dsh-console/cordis.patch.yml`:

```yaml
# The DSH console row, inserted at the host plane.
#
# The Host half registers the `dsh_console` tool; the Client half answers
# theme/layout/locale requests, which exist only in the browser realm.
- insert:
    - id: vyra-dsh-console
      name: 'vyra-dsh-console'
```

- [ ] **Step 3: Write the failing test for the registry and the boundary**

Create `plugins/vyra-dsh-console/test/core.test.mjs`:

```js
// Boundary and dispatch self-check for the DSH console.
//
//   node --test plugins/vyra-dsh-console/test/core.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { createConsole, ACTIONS, FORBIDDEN } from '../core.js'

/** A ctx with no optional service present, to prove graceful degradation. */
function bareCtx() {
  return { get: () => undefined, logger: { warn() {} } }
}

test('every forbidden action is refused with a reason and an alternative', async () => {
  const console_ = createConsole(bareCtx())
  for (const name of Object.keys(FORBIDDEN)) {
    const result = await console_.dispatch(name, {})
    assert.equal(result.status, 'forbidden', `${name} must be forbidden`)
    assert.ok(result.reason, `${name} must explain why`)
    assert.ok(result.alternative, `${name} must name the user-facing alternative`)
  }
})

test('the permission boundary names exactly the authority-changing actions', () => {
  // These four are the spec's §2.2 exclusions. If one disappears, the agent
  // silently regains the ability to widen its own authority.
  for (const name of ['sandbox.setMode', 'permission.setPreset', 'approval.answer', 'credentials.set']) {
    assert.ok(FORBIDDEN[name], `${name} must be forbidden`)
  }
})

test('a non-mutating action is marked non-mutating and non-destructive', () => {
  const action = ACTIONS['console.actions']
  assert.equal(action.mutating, false)
  assert.equal(action.destructive, false)
})

test('an unknown action fails instead of throwing', async () => {
  const console_ = createConsole(bareCtx())
  const result = await console_.dispatch('nope.notReal', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /unknown action/i)
})

test('an action with no handler yet is reported, not thrown', async () => {
  // Task 1 declares only console.actions; Task 2 adds plugin.list together with
  // its domain handler. Until a domain exists, dispatch must say so clearly.
  const console_ = createConsole(bareCtx())
  const result = await console_.dispatch('plugin.list', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /unknown action/i)
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: FAIL — `Cannot find module '../core.js'`

- [ ] **Step 5: Implement the registry and dispatcher**

Create `plugins/vyra-dsh-console/core.js`:

```js
/**
 * The single business implementation of every DSH console operation.
 *
 * One operation, two callers: the `dsh_console` agent tool and the Client panel
 * both land here. Nothing in this file knows which of them called it.
 *
 * The boundary in FORBIDDEN is the point of this plugin as much as the actions
 * are: an agent may change how the harness looks and is configured, never how
 * much authority it holds. See docs/superpowers/specs/2026-11-23-vyra-dsh-console-design.md §2.2.
 */

/** Actions that change authority. Refused for every caller, permanently. */
export const FORBIDDEN = Object.freeze({
  'sandbox.setMode': {
    reason: 'Changing the sandbox mode widens or narrows your own file and process authority.',
    alternative: 'Ask the user to change it in Settings → Permissions, or via the /permission command.',
  },
  'permission.setPreset': {
    reason: 'A permission preset bundles the sandbox mode and approval policy; switching it changes your own authority.',
    alternative: 'Ask the user to pick a preset in the composer\'s permission control.',
  },
  'approval.answer': {
    reason: 'Answering an approval request would let you authorize your own tool calls.',
    alternative: 'The user answers it in the approval prompt.',
  },
  'credentials.set': {
    reason: 'Writing a credential is a secret-handling operation reserved for the user.',
    alternative: 'Ask the user to enter it in Settings.',
  },
})

/** Actions the console implements. `requiresClient` actions go through the Client half. */
export const ACTIONS = Object.freeze({
  'console.actions': { domain: 'console', mutating: false, destructive: false, requiresClient: false },
  'plugin.list': { domain: 'plugin', mutating: false, destructive: false, requiresClient: false },
})

/**
 * Build the console over a Cordis context.
 *
 * @param ctx a Cordis context, or a bare `{ get }` stub in tests.
 * @param handlers optional `{ [domain]: (ctx, request) => Promise<object> }`; later
 *   tasks pass their domain in, so this file never imports a service directly.
 *   Every domain in this plugin has the signature `(ctx, { action, args, spec })`.
 */
export function createConsole(ctx, handlers = {}) {
  async function dispatch(action, args = {}) {
    if (FORBIDDEN[action]) {
      return { status: 'forbidden', action, ...FORBIDDEN[action] }
    }
    const spec = ACTIONS[action]
    if (!spec) {
      return { status: 'error', action, reason: `unknown action "${action}"` }
    }
    const handler = handlers[spec.domain]
    if (!handler) {
      return { status: 'error', action, reason: `no handler for domain "${spec.domain}"` }
    }
    return handler(ctx, { action, args, spec })
  }

  return {
    dispatch,
    listActions: () =>
      Object.entries(ACTIONS).map(([name, spec]) => ({ name, ...spec })),
  }
}

/** Read an optional service, or report it missing instead of throwing. */
export function requireService(ctx, key, action) {
  const service = ctx.get(key)
  if (!service) {
    return { missing: { status: 'unavailable', action, reason: `this profile has no ${key} service` } }
  }
  return { service }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 7: Create the Host entry point**

Create `plugins/vyra-dsh-console/index.js`:

```js
import { createConsole } from './core.js'

export const name = 'vyra-dsh-console'
export const inject = ['tools']

export function apply(ctx) {
  const console_ = createConsole(ctx)
  ctx.logger?.info?.(`vyra-dsh-console: ${console_.listActions().length} actions`)
}
```

The tool registration lands in Task 2, once there is something to expose.

- [ ] **Step 8: Copy the license and the contact image, then generate the README block**

```sh
cp plugins/vyra-agent-manager/LICENSE plugins/vyra-dsh-console/LICENSE
mkdir -p plugins/vyra-dsh-console/assets
cp plugins/vyra-agent-manager/assets/qq-group.png plugins/vyra-dsh-console/assets/
```

Write `plugins/vyra-dsh-console/README.md` with a title, a one-paragraph description, and an
"安装" section, then run `pnpm run contact` to append the contact block.

- [ ] **Step 9: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): bundle skeleton, action registry and permission boundary"
```

---

### Task 2: The `dsh_console` tool and the plugin domain

**Files:**
- Create: `plugins/vyra-dsh-console/tool.js`
- Create: `plugins/vyra-dsh-console/domains/plugin.js`
- Modify: `plugins/vyra-dsh-console/core.js` (register `plugin.list`, `plugin.setEnabled`)
- Modify: `plugins/vyra-dsh-console/index.js` (register the tool)
- Test: `plugins/vyra-dsh-console/test/core.test.mjs` (extend)

**Interfaces:**
- Consumes: `createConsole`, `requireService`, `ACTIONS`, `FORBIDDEN` from `core.js`.
- Produces: `createConsoleTool(console_)` → a DSH `ToolDefinition` named `dsh_console`; `pluginDomain(ctx, { action, args })` → `{ status, ... }`.

- [ ] **Step 1: Write the failing test**

Replace the last test in `test/core.test.mjs` and add:

```js
import { createConsoleTool } from '../tool.js'
import { pluginDomain } from '../domains/plugin.js'

test('a missing pluginManager reports unavailable rather than throwing', async () => {
  const console_ = createConsole(bareCtx(), { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.list', {})
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /pluginManager/)
})

test('plugin.list returns the installed bundles and their enabled state', async () => {
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    listPlugins: async () => [{ id: 'a', enabled: true }, { id: 'b', enabled: false }],
  } : undefined) }
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.plugins.map((p) => p.id), ['a', 'b'])
})

test('the tool refuses a forbidden action without calling any handler', async () => {
  let called = false
  const console_ = createConsole({ get: () => undefined }, { plugin: () => { called = true } })
  const tool = createConsoleTool(console_)
  const result = await tool.execute({ action: 'sandbox.setMode' })
  assert.equal(result.status, 'forbidden')
  assert.equal(called, false, 'a forbidden action never reaches a domain handler')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: FAIL — `Cannot find module '../tool.js'`

- [ ] **Step 3: Implement the plugin domain**

Create `plugins/vyra-dsh-console/domains/plugin.js`:

```js
import { requireService } from '../core.js'

/** Plugin inventory and enablement, over the Host's own pluginManager. */
export async function pluginDomain(ctx, { action, args }) {
  const { service, missing } = requireService(ctx, 'pluginManager', action)
  if (missing) return missing

  switch (action) {
    case 'plugin.list': {
      const [plugins, bundles] = await Promise.all([service.listPlugins(), service.listBundles()])
      return {
        status: 'ok',
        plugins: plugins.map(({ id, enabled }) => ({ id, enabled })),
        bundles: bundles.map(({ name, version, enabled }) => ({ name, version, enabled })),
      }
    }
    case 'plugin.setEnabled': {
      return {
        status: 'error',
        reason: 'plugin.setEnabled is implemented in Task 3',
      }
    }
    default:
      return { status: 'error', action, reason: `plugin domain has no action "${action}"` }
  }
}
```

- [ ] **Step 4: Implement the tool**

Create `plugins/vyra-dsh-console/tool.js`:

```js
const DESCRIPTION = [
  'Operate this DeepSeek Harness installation: read and change models, settings, plugins, skills and MCP servers, and switch the theme, layout and language of the running interface.',
  'Call action=console.actions first to list every supported action and whether it mutates anything.',
  'Authority-changing actions (sandbox mode, permission presets, approvals, credentials) are refused: ask the user to change those in the UI instead.',
].join(' ')

export function createConsoleTool(console_) {
  return {
    name: 'dsh_console',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action id from action=console.actions, e.g. plugin.list.' },
        args: { type: 'object', description: 'Action-specific arguments.', additionalProperties: true },
        confirm: { type: 'boolean', description: 'Required for destructive actions when confirmDestructive is on.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async execute(input) {
      // `confirm` is declared as a top-level sibling of `args` — that is the
      // surface the model sees — but the dispatcher reads it off the args
      // object. Merge it across, and only when present: adding an
      // `undefined` key would make the arguments unserializable, and the
      // pipeline snapshots them before the call.
      const args = { ...(input?.args ?? {}) }
      if (input?.confirm !== undefined) args.confirm = input.confirm
      return console_.dispatch(input?.action ?? '', args)
    },
  }
}
```

- [ ] **Step 5: Register the tool and the domain**

Modify `plugins/vyra-dsh-console/index.js`:

```js
import { createConsole } from './core.js'
import { createConsoleTool } from './tool.js'
import { pluginDomain } from './domains/plugin.js'

export const name = 'vyra-dsh-console'
export const inject = ['tools']

export function apply(ctx) {
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  ctx.tools.register(createConsoleTool(console_))
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 7: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): dsh_console tool and the plugin inventory domain"
```

---

### Task 3: The model, settings and plugin-mutation domains

**Files:**
- Create: `plugins/vyra-dsh-console/domains/model.js`
- Create: `plugins/vyra-dsh-console/domains/settings.js`
- Modify: `plugins/vyra-dsh-console/domains/plugin.js` (add `plugin.setEnabled`, `plugin.install`, `plugin.remove`)
- Modify: `plugins/vyra-dsh-console/core.js` (register the new actions)
- Test: `plugins/vyra-dsh-console/test/core.test.mjs` (extend)

**Interfaces:**
- Consumes: `createConsole`, `requireService`; the `confirmDestructive` config flag (Task 4 passes it in).
- Produces: `modelDomain`, `settingsDomain`; `ACTIONS` gains `model.list`, `model.select`, `settings.list`, `settings.get`, `settings.set`, `plugin.setEnabled`, `plugin.install`, `plugin.remove`.

- [ ] **Step 1: Write the failing tests**

Add to `test/core.test.mjs`:

```js
import { modelDomain } from '../domains/model.js'
import { settingsDomain } from '../domains/settings.js'

test('model.list reports the configured default selection', async () => {
  const ctx = { get: (k) => (k === 'agentDefaultModel' ? {
    currentSelection: () => ({ provider: 'deepseek', model: 'deepseek-chat' }),
  } : undefined) }
  const console_ = createConsole(ctx, { model: modelDomain })
  const result = await console_.dispatch('model.list', {})
  assert.equal(result.status, 'ok')
  assert.equal(result.current.model, 'deepseek-chat')
})

test('model.select rejects a selection missing a provider', async () => {
  const console_ = createConsole(bareCtx(), { model: modelDomain })
  const result = await console_.dispatch('model.select', { model: 'x' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /provider/)
})

test('settings.set rejects a patch that is not an object', async () => {
  const console_ = createConsole(bareCtx(), { settings: settingsDomain })
  const result = await console_.dispatch('settings.set', { ns: 'x', patch: 'nope' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /object/)
})

test('a destructive action without confirm is refused when confirmation is on', async () => {
  const console_ = createConsole(bareCtx(), { plugin: pluginDomain }, { confirmDestructive: true })
  const result = await console_.dispatch('plugin.remove', { name: 'x' })
  assert.equal(result.status, 'confirm-required')
})

// The dispatch-level pair above proves only the `!== true` comparison. The gate
// is reached through the TOOL, so it must be tested there too: `execute` has to
// carry the top-level `confirm` into the args, or the model can never open it.
test('a destructive action is refused through the tool without confirm, and allowed with it', async () => {
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    removeBundle: async () => ({ application: 'applied', changed: true, stage: 'done', target: 'x' }),
  } : undefined) }
  const tool = createConsoleTool(createConsole(ctx, { plugin: pluginDomain }, { confirmDestructive: true }))

  const refused = await tool.execute({ action: 'plugin.remove', args: { name: 'x' } })
  assert.equal(refused.status, 'confirm-required')

  const allowed = await tool.execute({ action: 'plugin.remove', args: { name: 'x' }, confirm: true })
  assert.equal(allowed.status, 'ok')
})

test('the same destructive action proceeds without confirm when confirmation is off', async () => {
  const ctx = { get: (k) => (k === 'pluginManager' ? {
    removeBundle: async () => ({ application: 'applied', changed: true }),
  } : undefined) }
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  const result = await console_.dispatch('plugin.remove', { name: 'x' })
  assert.equal(result.status, 'ok')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: FAIL — `Cannot find module '../domains/model.js'`

- [ ] **Step 3: Implement the confirmation gate in the dispatcher**

Modify `core.js`'s `createConsole` signature to `createConsole(ctx, handlers = {}, options = {})` and add, immediately after the `FORBIDDEN` check and before the handler lookup:

```js
    if (spec.destructive && options.confirmDestructive && args.confirm !== true) {
      return {
        status: 'confirm-required',
        action,
        reason: `"${action}" is irreversible; re-run with confirm: true, or ask the user first.`,
      }
    }
```

Register the new actions:

```js
  'model.list': { domain: 'model', mutating: false, destructive: false, requiresClient: false },
  'model.select': { domain: 'model', mutating: true, destructive: false, requiresClient: false },
  'settings.list': { domain: 'settings', mutating: false, destructive: false, requiresClient: false },
  'settings.get': { domain: 'settings', mutating: false, destructive: false, requiresClient: false },
  'settings.set': { domain: 'settings', mutating: true, destructive: false, requiresClient: false },
  'plugin.setEnabled': { domain: 'plugin', mutating: true, destructive: false, requiresClient: false },
  'plugin.install': { domain: 'plugin', mutating: true, destructive: false, requiresClient: false },
  'plugin.remove': { domain: 'plugin', mutating: true, destructive: true, requiresClient: false },
```

- [ ] **Step 4: Implement the model and settings domains**

Create `plugins/vyra-dsh-console/domains/model.js`:

```js
import { requireService } from '../core.js'

/** Model discovery and selection over the Host's own services. */
export async function modelDomain(ctx, { action, args }) {
  if (action === 'model.list') {
    const { service, missing } = requireService(ctx, 'agentDefaultModel', action)
    if (missing) return missing
    const current = service.currentSelection()
    const llm = ctx.get('llm')
    const providers = llm ? await llm.listProviders() : []
    return { status: 'ok', current, providers: providers.map(({ id, name }) => ({ id, name })) }
  }
  if (action === 'model.select') {
    if (!args.provider || !args.model) {
      return { status: 'error', action, reason: 'model.select needs both provider and model' }
    }
    const { service, missing } = requireService(ctx, 'agentDefaultModel', action)
    if (missing) return missing
    await service.saveSelection({ provider: args.provider, model: args.model })
    return { status: 'ok', current: service.currentSelection() }
  }
  return { status: 'error', action, reason: `model domain has no action "${action}"` }
}
```

Create `plugins/vyra-dsh-console/domains/settings.js`:

```js
import { requireService } from '../core.js'

/** Read and write the profile's settings namespaces. */
export async function settingsDomain(ctx, { action, args }) {
  const { service, missing } = requireService(ctx, 'settings', action)
  if (missing) return missing

  switch (action) {
    case 'settings.list':
      return { status: 'ok', namespaces: service.describe().map(({ ns, title }) => ({ ns, title })) }
    case 'settings.get':
      return { status: 'ok', namespaces: service.describe() }
    case 'settings.set': {
      if (!args.ns || typeof args.ns !== 'string') {
        return { status: 'error', action, reason: 'settings.set needs a namespace string in ns' }
      }
      if (!args.patch || typeof args.patch !== 'object' || Array.isArray(args.patch)) {
        return { status: 'error', action, reason: 'settings.set needs patch to be an object' }
      }
      await service.update(args.ns, args.patch)
      return { status: 'ok', ns: args.ns }
    }
    default:
      return { status: 'error', action, reason: `settings domain has no action "${action}"` }
  }
}
```

- [ ] **Step 5: Add the plugin mutations**

Replace the `plugin.setEnabled` stub in `domains/plugin.js` and add the rest:

```js
    case 'plugin.setEnabled': {
      if (!args.id || typeof args.enabled !== 'boolean') {
        return { status: 'error', action, reason: 'plugin.setEnabled needs id and a boolean enabled' }
      }
      const change = await service.setBundleEnabled(args.id, args.enabled)
      return { status: 'ok', application: change.application, changed: change.changed }
    }
    case 'plugin.install': {
      if (!args.spec) return { status: 'error', action, reason: 'plugin.install needs an install spec' }
      const change = await service.installBundle(args.spec)
      return { status: 'ok', application: change.application, changed: change.changed }
    }
    case 'plugin.remove': {
      if (!args.name) return { status: 'error', action, reason: 'plugin.remove needs a package name' }
      const change = await service.removeBundle(args.name)
      return { status: 'ok', application: change.application, changed: change.changed }
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: PASS (13 tests)

- [ ] **Step 7: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): model, settings and plugin mutation domains"
```

---

### Task 3b: The skills and MCP domain

**Files:**
- Create: `plugins/vyra-dsh-console/domains/catalog.js`
- Modify: `plugins/vyra-dsh-console/core.js` (register the actions)
- Modify: `plugins/vyra-dsh-console/index.js` (wire the domain)
- Test: `plugins/vyra-dsh-console/test/core.test.mjs` (extend)

**Interfaces:**
- Consumes: `createConsole`, `requireService`.
- Produces: `catalogDomain`; `ACTIONS` gains `skill.list`, `mcp.list`, `mcp.restart`, `mcp.probe`.

- [ ] **Step 1: Write the failing tests**

```js
import { catalogDomain } from '../domains/catalog.js'

test('skill.list reports the registered skills', async () => {
  const ctx = { get: (k) => (k === 'skills' ? {
    list: async () => [{ name: 'brainstorming', description: 'd' }],
  } : undefined) }
  const console_ = createConsole(ctx, { catalog: catalogDomain })
  const result = await console_.dispatch('skill.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.skills.map((s) => s.name), ['brainstorming'])
})

test('mcp.list reports each server with its status state', async () => {
  const ctx = { get: (k) => (k === 'mcpManager' ? {
    list: () => [{ name: 'mcp', configured: true, status: { state: 'connected', toolCount: 3, connectedAt: 0 } }],
  } : undefined) }
  const console_ = createConsole(ctx, { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.list', {})
  assert.equal(result.status, 'ok')
  assert.equal(result.servers[0].state, 'connected')
})

test('mcp.restart needs a server name', async () => {
  const console_ = createConsole(bareCtx(), { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.restart', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /name/)
})

test('a missing mcpManager reports unavailable rather than throwing', async () => {
  const console_ = createConsole(bareCtx(), { catalog: catalogDomain })
  const result = await console_.dispatch('mcp.list', {})
  assert.equal(result.status, 'unavailable')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: FAIL — `Cannot find module '../domains/catalog.js'`

- [ ] **Step 3: Implement the domain**

Create `plugins/vyra-dsh-console/domains/catalog.js`:

```js
import { requireService } from '../core.js'

/** Installed skills and the MCP server fleet — inventory plus recovery actions. */
export async function catalogDomain(ctx, { action, args }) {
  if (action === 'skill.list') {
    const { service, missing } = requireService(ctx, 'skills', action)
    if (missing) return missing
    const skills = await service.list()
    return { status: 'ok', skills: skills.map(({ name, description }) => ({ name, description })) }
  }

  const { service, missing } = requireService(ctx, 'mcpManager', action)
  if (missing) return missing

  switch (action) {
    case 'mcp.list':
      return {
        status: 'ok',
        servers: service.list().map(({ name, configured, status }) => ({
          name,
          configured,
          state: status?.state ?? 'unknown',
          toolCount: status?.toolCount,
          lastError: status?.lastError,
        })),
      }
    case 'mcp.restart':
      if (!args.name) return { status: 'error', action, reason: 'mcp.restart needs a server name' }
      await service.restart(args.name)
      return { status: 'ok', name: args.name }
    case 'mcp.probe': {
      if (!args.name) return { status: 'error', action, reason: 'mcp.probe needs a server name' }
      const probe = await service.probe(args.name, { timeoutMs: args.timeoutMs })
      return { status: 'ok', ok: probe.ok, stage: probe.stage, toolNames: probe.toolNames, message: probe.message }
    }
    default:
      return { status: 'error', action, reason: `catalog domain has no action "${action}"` }
  }
}
```

- [ ] **Step 4: Register the actions**

Add to `ACTIONS` in `core.js`:

```js
  'skill.list': { domain: 'catalog', mutating: false, destructive: false, requiresClient: false },
  'mcp.list': { domain: 'catalog', mutating: false, destructive: false, requiresClient: false },
  'mcp.restart': { domain: 'catalog', mutating: true, destructive: false, requiresClient: false },
  'mcp.probe': { domain: 'catalog', mutating: false, destructive: false, requiresClient: false },
```

- [ ] **Step 5: Wire the domain in `index.js`**

Add `catalog: catalogDomain` to the handlers object passed to `createConsole`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: PASS (18 tests)

- [ ] **Step 7: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): skills inventory and MCP fleet domain"
```

---

### Task 4: Config, and wiring the domains into the plugin

**Files:**
- Modify: `plugins/vyra-dsh-console/index.js`
- Modify: `plugins/vyra-dsh-console/cordis.patch.yml`
- Test: `plugins/vyra-dsh-console/test/core.test.mjs` (extend)

**Interfaces:**
- Consumes: every domain from Task 3.
- Produces: a `Config` schema with `confirmDestructive` (boolean, default `false`); `apply(ctx, config)`.

- [ ] **Step 1: Write the failing test**

```js
test('the plugin declares a confirmDestructive config defaulting to false', async () => {
  const mod = await import('../index.js')
  const schema = mod.Config
  assert.ok(schema, 'the plugin exports a Config schema')
  const resolved = schema({})
  assert.equal(resolved.confirmDestructive, false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: FAIL — `schema is undefined`

- [ ] **Step 3: Implement the Config and wire everything**

Replace `plugins/vyra-dsh-console/index.js`:

```js
import Schema from '@deepseek-ai/schemastery'
import { createConsole } from './core.js'
import { createConsoleTool } from './tool.js'
import { pluginDomain } from './domains/plugin.js'
import { modelDomain } from './domains/model.js'
import { settingsDomain } from './domains/settings.js'
import { catalogDomain } from './domains/catalog.js'

export const name = 'vyra-dsh-console'
export const inject = ['tools']

export const Config = Schema.object({
  confirmDestructive: Schema.boolean()
    .default(false)
    .description('Require confirm: true on irreversible actions such as plugin.remove.'),
})

export function apply(ctx, config) {
  const resolved = Config(config ?? {})
  const console_ = createConsole(
    ctx,
    { plugin: pluginDomain, model: modelDomain, settings: settingsDomain, catalog: catalogDomain },
    { confirmDestructive: resolved.confirmDestructive },
  )
  ctx.tools.register(createConsoleTool(console_))
}
```

- [ ] **Step 4: Document the config in the patch**

Replace `plugins/vyra-dsh-console/cordis.patch.yml`:

```yaml
# The DSH console row, inserted at the host plane.
#
# The Host half registers the `dsh_console` tool; the Client half answers
# theme/layout/locale requests, which exist only in the browser realm.
#
# Set confirmDestructive to require an explicit confirm on irreversible actions
# such as plugin.remove. The user's patch layer survives plugin upgrades.
- insert:
    - id: vyra-dsh-console
      name: 'vyra-dsh-console'
      # config:
      #   confirmDestructive: true
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: PASS (14 tests)

- [ ] **Step 6: Verify the Config schema is what the Loader projects**

Run: `pnpm run verify`
Expected: the index build succeeds and `verify-index` passes.

- [ ] **Step 7: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): confirmDestructive config and full domain wiring"
```

---

### Task 5: The Host↔Client channel

The riskiest piece: `ctx.theme` / `ctx.layout` / `ctx.locale` live only in the browser, so the Host must ask the Client and must fail loudly when no Client is connected.

**Files:**
- Create: `plugins/vyra-dsh-console/channel.js`
- Create: `plugins/vyra-dsh-console/domains/appearance.js`
- Modify: `plugins/vyra-dsh-console/core.js` (register the appearance actions)
- Modify: `plugins/vyra-dsh-console/index.js` (wire the channel)
- Test: `plugins/vyra-dsh-console/test/channel.test.mjs`

**Interfaces:**
- Consumes: `createConsole`.
- Produces: `createChannel({ timeoutMs })` → `{ request(op, args), respond(reply), onRequest(handler), pendingCount() }`; `appearanceDomain` — requires the channel on `ctx.__consoleChannel`.

- [ ] **Step 1: Write the failing test**

Create `plugins/vyra-dsh-console/test/channel.test.mjs`:

```js
// Channel self-check: the Host asks, the Client answers, and every failure is
// explicit. A silent success would tell the agent the theme changed when it did not.
//
//   node --test plugins/vyra-dsh-console/test/channel.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { createChannel } from '../channel.js'

test('a request resolves with the answer the client posts back', async () => {
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({ id: req.id, ok: true, value: 'dark' }))
  const result = await channel.request('theme.set', { id: 'dark' })
  assert.deepEqual(result, { status: 'ok', value: 'dark' })
})

test('requests are rejected as unavailable when no client answers', async () => {
  const channel = createChannel({ timeoutMs: 30 })
  const result = await channel.request('theme.set', { id: 'dark' })
  assert.equal(result.status, 'unavailable')
  assert.match(result.reason, /no interface is connected/i)
})

test('a client-reported failure surfaces as an error with its reason', async () => {
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({ id: req.id, ok: false, error: 'no such theme' }))
  const result = await channel.request('theme.set', { id: 'nope' })
  assert.equal(result.status, 'error')
  assert.equal(result.reason, 'no such theme')
})

test('concurrent requests settle independently', async () => {
  const channel = createChannel({ timeoutMs: 1000 })
  channel.onRequest((req) => channel.respond({ id: req.id, ok: true, value: req.op }))
  const [a, b] = await Promise.all([channel.request('theme.set', {}), channel.request('layout.toggleSidebar', {})])
  assert.equal(a.value, 'theme.set')
  assert.equal(b.value, 'layout.toggleSidebar')
  assert.equal(channel.pendingCount(), 0, 'a settled request leaves nothing pending')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/vyra-dsh-console/test/channel.test.mjs`
Expected: FAIL — `Cannot find module '../channel.js'`

- [ ] **Step 3: Implement the channel**

Create `plugins/vyra-dsh-console/channel.js`:

```js
/**
 * The Host side of the console's Host↔Client channel.
 *
 * Theme, layout and locale are Client-realm services: the Host cannot call them.
 * The Host therefore queues a request, the browser half answers it, and the
 * promise settles with the answer — or with an explicit failure.
 *
 * The one rule that matters: a request that nobody answers must NOT look like a
 * success. `unavailable` after the timeout is what tells the agent the interface
 * is not open, instead of leaving it reporting a theme change that never happened.
 */

export function createChannel({ timeoutMs = 5000 } = {}) {
  const pending = new Map()
  let nextId = 1
  let listener = () => {}

  function request(op, args = {}) {
    const id = String(nextId++)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        resolve({
          status: 'unavailable',
          op,
          reason: 'no interface is connected; open the DSH Web UI and retry',
        })
      }, timeoutMs)
      pending.set(id, { resolve, timer, op })
      listener({ id, op, args })
    })
  }

  function respond(reply) {
    const entry = pending.get(String(reply?.id))
    if (!entry) return false
    clearTimeout(entry.timer)
    pending.delete(String(reply.id))
    entry.resolve(
      reply.ok
        ? { status: 'ok', op: entry.op, value: reply.value }
        : { status: 'error', op: entry.op, reason: String(reply.error ?? 'client refused') },
    )
    return true
  }

  return {
    request,
    respond,
    onRequest(handler) { listener = handler },
    pendingCount: () => pending.size,
  }
}
```

- [ ] **Step 4: Run the channel test to verify it passes**

Run: `node --test plugins/vyra-dsh-console/test/channel.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement the appearance domain**

Create `plugins/vyra-dsh-console/domains/appearance.js`:

```js
/**
 * Theme, layout and locale — the Client-realm half of the console.
 *
 * Every action here travels over the channel; none of them can be served from
 * the Host, so a missing interface is reported as unavailable rather than faked.
 */

const CLIENT_ACTIONS = new Set([
  'appearance.setTheme',
  'appearance.setFontSize',
  'appearance.toggleSidebar',
  'appearance.openRightbar',
  'appearance.closeRightbar',
  'appearance.setLocale',
  'appearance.state',
])

export async function appearanceDomain(ctx, { action, args }) {
  if (!CLIENT_ACTIONS.has(action)) {
    return { status: 'error', action, reason: `appearance domain has no action "${action}"` }
  }
  const channel = ctx.__consoleChannel
  if (!channel) {
    return { status: 'unavailable', action, reason: 'the console channel is not mounted' }
  }
  if (action === 'appearance.setFontSize' && typeof args.px !== 'number') {
    return { status: 'error', action, reason: 'appearance.setFontSize needs a numeric px' }
  }
  if (action !== 'appearance.state' && !args.role && action === 'appearance.setFontSize' && !args.role) {
    return { status: 'error', action, reason: 'appearance.setFontSize needs a role' }
  }
  return channel.request(action, args)
}
```

- [ ] **Step 6: Register the appearance actions**

Add to `ACTIONS` in `core.js`:

```js
  'appearance.state': { domain: 'appearance', mutating: false, destructive: false, requiresClient: true },
  'appearance.setTheme': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.setFontSize': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.toggleSidebar': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.openRightbar': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.closeRightbar': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
  'appearance.setLocale': { domain: 'appearance', mutating: true, destructive: false, requiresClient: true },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs plugins/vyra-dsh-console/test/channel.test.mjs`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): Host-Client channel and the appearance domain"
```

---

### Task 6: The Client half, driven end to end

**Files:**
- Create: `plugins/vyra-dsh-console/client.js`
- Test: `plugins/vyra-dsh-console/test/client.test.mjs`

**Interfaces:**
- Consumes: the Client services `theme`, `layout`, `locale`.
- Produces: `client.js` registering under `id: 'vyra-dsh-console'` — the package name — and exporting `__internal.applyOp(services, op, args)` for testing.

- [ ] **Step 1: Write the failing test**

Create `plugins/vyra-dsh-console/test/client.test.mjs`:

```js
// Client-half self-check: the browser bundle calls exactly the Client services,
// and an unknown op is refused instead of silently doing nothing.
//
//   node --test plugins/vyra-dsh-console/test/client.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root, 'client.js'), 'utf8')

let exports
const window = {
  __ModuleLoader__: {
    load: ({ id, factory }) => {
      assert.equal(id, 'vyra-dsh-console', 'the bundle registers under its package name')
      exports = factory(() => ({}))
    },
  },
}
new Function('window', 'document', source)(window, undefined)

function spyServices() {
  const calls = []
  return {
    calls,
    services: {
      theme: {
        getTheme: () => ({ id: 'dark' }),
        setTheme: (id) => calls.push(['setTheme', id]),
        setFontSize: (role, px) => calls.push(['setFontSize', role, px]),
      },
      layout: {
        toggleSidebar: () => calls.push(['toggleSidebar']),
        openRightbar: () => calls.push(['openRightbar']),
        closeRightbar: () => calls.push(['closeRightbar']),
      },
      locale: {
        getLocale: () => ({ id: 'zh' }),
        setLocale: (id) => calls.push(['setLocale', id]),
      },
    },
  }
}

test('appearance.setTheme calls the Client theme service', () => {
  const { services, calls } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.setTheme', { id: 'dark' })
  assert.equal(result.status, 'ok')
  assert.deepEqual(calls, [['setTheme', 'dark']])
})

test('appearance.setFontSize forwards both the role and the size', () => {
  const { services, calls } = spyServices()
  exports.__internal.applyOp(services, 'appearance.setFontSize', { role: 'body', px: 15 })
  assert.deepEqual(calls, [['setFontSize', 'body', 15]])
})

test('appearance.toggleSidebar calls the Client layout service', () => {
  const { services, calls } = spyServices()
  exports.__internal.applyOp(services, 'appearance.toggleSidebar', {})
  assert.deepEqual(calls, [['toggleSidebar']])
})

test('an unknown op is refused rather than silently ignored', () => {
  const { services, calls } = spyServices()
  const result = exports.__internal.applyOp(services, 'appearance.nope', {})
  assert.equal(result.status, 'error')
  assert.deepEqual(calls, [], 'nothing is called for an unknown op')
})

test('a Client service that is missing reports an error, not a false success', () => {
  const result = exports.__internal.applyOp({}, 'appearance.setTheme', { id: 'dark' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /theme/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/vyra-dsh-console/test/client.test.mjs`
Expected: FAIL — `ENOENT: no such file or directory, open '.../client.js'`

- [ ] **Step 3: Implement the Client half**

Create `plugins/vyra-dsh-console/client.js`:

```js
// DSH console, Client half. Theme, layout and locale are Client-realm services,
// so this half is the only place they can be called. It renders no UI of its own
// (the panel arrives in Task 8); it answers the Host's requests.
//
// The id below MUST equal the package name: the module system matches startup
// rows by package name, and a mismatch means this half never mounts.
window.__ModuleLoader__.load({
  id: 'vyra-dsh-console',
  factory(require) {
    /** Apply one appearance op against the live Client services. */
    function applyOp(services, op, args) {
      const a = args || {}
      switch (op) {
        case 'appearance.state':
          return {
            status: 'ok',
            value: {
              theme: services.theme?.getTheme?.() ?? null,
              locale: services.locale?.getLocale?.() ?? null,
            },
          }
        case 'appearance.setTheme': {
          if (!services.theme) return { status: 'error', reason: 'the theme service is unavailable' }
          services.theme.setTheme(a.id)
          return { status: 'ok', value: a.id }
        }
        case 'appearance.setFontSize': {
          if (!services.theme) return { status: 'error', reason: 'the theme service is unavailable' }
          services.theme.setFontSize(a.role, a.px)
          return { status: 'ok', value: { role: a.role, px: a.px } }
        }
        case 'appearance.toggleSidebar': {
          if (!services.layout) return { status: 'error', reason: 'the layout service is unavailable' }
          services.layout.toggleSidebar()
          return { status: 'ok' }
        }
        case 'appearance.openRightbar': {
          if (!services.layout) return { status: 'error', reason: 'the layout service is unavailable' }
          services.layout.openRightbar(a.track !== false, Boolean(a.fullscreen))
          return { status: 'ok' }
        }
        case 'appearance.closeRightbar': {
          if (!services.layout) return { status: 'error', reason: 'the layout service is unavailable' }
          services.layout.closeRightbar()
          return { status: 'ok' }
        }
        case 'appearance.setLocale': {
          if (!services.locale) return { status: 'error', reason: 'the locale service is unavailable' }
          services.locale.setLocale(a.id)
          return { status: 'ok', value: a.id }
        }
        default:
          return { status: 'error', reason: `unknown appearance op "${op}"` }
      }
    }

    return {
      __internal: { applyOp },
      inject: ['theme', 'layout', 'locale'],
      apply(ctx) {
        const services = { theme: ctx.theme, layout: ctx.layout, locale: ctx.locale }
        ctx.effect(() => {
          // Poll for work rather than inventing a second transport: the Host
          // queues requests and this half drains them through the same
          // Remote-backed endpoint the tool uses.
          let stopped = false
          return () => { stopped = true }
        }, 'vyra-dsh-console: appearance bridge')
      },
    }
  },
})
```

Note: `applyOp` is the tested unit; the polling bridge above is deliberately inert until Task 7 supplies the endpoint it drains.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/vyra-dsh-console/test/client.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): client half answering theme, layout and locale ops"
```

---

### Task 7: The HTTP endpoint that connects the two halves

**Files:**
- Modify: `plugins/vyra-dsh-console/index.js`
- Modify: `plugins/vyra-dsh-console/client.js` (drain the endpoint)
- Test: `plugins/vyra-dsh-console/test/core.test.mjs` (extend)

**Interfaces:**
- Consumes: `createChannel`, the `webServer` service.
- Produces: `POST /api/vyra-console/rpc` accepting `{ op, args }` from the Client and `{ id, ok, value|error }` replies; `GET` on the same path returning queued requests.

- [ ] **Step 1: Write the failing test**

```js
import { createChannel } from '../channel.js'

test('the endpoint route is registered once webServer appears', async () => {
  const routes = []
  const ctx = {
    tools: { register() {} },
    get: () => undefined,
    logger: { info() {}, warn() {} },
    inject(names, cb) {
      if (names.includes('webServer')) cb({ effect: (fn) => fn(), webServer: { register: (r) => { routes.push(r); return () => {} } } })
    },
    effect: (fn) => fn(),
  }
  const mod = await import('../index.js')
  mod.apply(ctx, {})
  assert.equal(routes.length, 1, 'exactly one route is registered')
  assert.equal(routes[0].path, '/api/vyra-console/rpc')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/vyra-dsh-console/test/core.test.mjs`
Expected: FAIL — `routes.length` is 0

- [ ] **Step 3: Implement the endpoint**

Add to `index.js`, following the pattern `vyra-agent-manager` proved (register through `ctx.inject(['webServer'], …)` so a late-binding server still gets the route):

```js
import { createChannel } from './channel.js'

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function send(res, payload) {
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}
```

and inside `apply`, after the tool registration:

```js
  const channel = createChannel({ timeoutMs: resolved.clientTimeoutMs })
  ctx.__consoleChannel = channel
  const queue = []
  let waiter = null
  channel.onRequest((request) => {
    queue.push(request)
    if (waiter) { const w = waiter; waiter = null; w() }
  })

  ctx.inject(['webServer'], (owner) => {
    owner.effect(() => owner.webServer.register({
      kind: 'exact',
      path: '/api/vyra-console/rpc',
      handler: async (req, res) => {
        try {
          if (req.method === 'GET') {
            if (queue.length === 0) {
              await new Promise((resolve) => {
                waiter = resolve
                setTimeout(resolve, 25000)
              })
            }
            send(res, { ok: true, requests: queue.splice(0, queue.length) })
            return
          }
          const body = await readJson(req)
          send(res, { ok: channel.respond(body) })
        } catch (err) {
          send(res, { ok: false, error: String(err?.message || err) })
        }
      },
    }), 'vyra-dsh-console.route')
  })
```

Add `clientTimeoutMs` to `Config`, default `5000`.

- [ ] **Step 4: Make the Client half drain the endpoint**

Replace the inert `ctx.effect` body in `client.js` with a polling loop that GETs `/api/vyra-console/rpc`, applies each request through `applyOp`, and POSTs the reply:

```js
      apply(ctx) {
        const services = { theme: ctx.theme, layout: ctx.layout, locale: ctx.locale }
        ctx.effect(() => {
          let stopped = false
          const RPC = '/api/vyra-console/rpc'
          async function drain() {
            while (!stopped) {
              try {
                const res = await fetch(RPC, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
                const data = await res.json()
                for (const request of data?.requests ?? []) {
                  const outcome = applyOp(services, request.op, request.args)
                  await fetch(RPC, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ id: request.id, ok: outcome.status === 'ok', value: outcome.value, error: outcome.reason }),
                    cache: 'no-store',
                  })
                }
              } catch {
                await new Promise((r) => setTimeout(r, 1000))
              }
            }
          }
          void drain()
          return () => { stopped = true }
        }, 'vyra-dsh-console: appearance bridge')
      },
```

- [ ] **Step 5: Run all tests**

Run: `node --test plugins/vyra-dsh-console/test/`
Expected: PASS. Note `node --test` on a directory runs each `*.test.mjs`.

- [ ] **Step 6: Verify the plugin loads in the real installation**

Run: `pnpm run check:installable`
Expected: PASS, which also confirms every `files` entry now exists.

- [ ] **Step 7: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): HTTP endpoint bridging the host and client halves"
```

---

### Task 8: The read-only CLI

**Files:**
- Create: `plugins/vyra-dsh-console/cli.mjs`
- Create: `plugins/vyra-console` skill (Task 9 covers the skill; the CLI is here)

**Interfaces:**
- Consumes: the profile directory, read-only.
- Produces: `vyra-console <doctor|state|services|events> [--json] [--profile=<name>]`.

- [ ] **Step 1: Write the CLI**

Create `plugins/vyra-dsh-console/cli.mjs` with a `usage()` listing the four commands, `--json`, `--profile`, `--help`; resolve the profile dir exactly as the market CLI does (`join(homedir(), '.dsh', 'profiles', profile)`, profile defaulting to `process.env.DSH_PROFILE || 'desktop'`); and emit stable JSON on `--json`.

`doctor` must print one summary object: installed bundles and their enabled state (read from the profile's `package.json` dependencies), the current model if a settings document is readable, the theme/style plugins present, and the MCP servers listed in the patch. **It must never write to the profile.**

- [ ] **Step 2: Verify the CLI is read-only by construction**

Run: `node plugins/vyra-dsh-console/cli.mjs --help`
Expected: the usage text.

Run: `node plugins/vyra-dsh-console/cli.mjs doctor --json`
Expected: a JSON summary; then confirm nothing changed:

```bash
git status --porcelain
```

Expected: no changes outside `plugins/vyra-dsh-console/`.

- [ ] **Step 3: Update the README with the CLI section**

Add a "CLI" section documenting the four commands and stating plainly that the CLI is read-only and that changes go through the `dsh_console` tool.

- [ ] **Step 4: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): read-only vyra-console CLI"
```

---

### Task 9: The skill

**Files:**
- Create: `skills/vyra-dsh-console/SKILL.md`

**Interfaces:**
- Consumes: the tool and CLI from Tasks 2–8.
- Produces: a skill teaching layer choice and the boundary.

- [ ] **Step 1: Write the skill**

Create `skills/vyra-dsh-console/SKILL.md` with frontmatter (`name`, `description`) and sections: **Which layer** (tool for changes, CLI for read-only diagnosis), **The boundary** (what is refused and why, and to tell the user to use the UI), **Common actions** (worked examples for `plugin.list`, `model.select`, `settings.set`, `appearance.setTheme`), and **Boundaries** (the CLI never writes; appearance actions need the Web UI open).

Follow the `vyra-plugin-market` SKILL.md structure, including the fallback path for when the plugin is installed rather than being developed from the checkout.

- [ ] **Step 2: Verify the frontmatter parses**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('skills/vyra-dsh-console/SKILL.md','utf8');if(!/^---[\s\S]*?name:/.test(t))throw new Error('no frontmatter');console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add skills/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): skill teaching layer choice and the authority boundary"
```

---

### Task 10: The management panel (Client UI)

**Files:**
- Create: `plugins/vyra-dsh-console/panel.js`
- Create: `plugins/vyra-dsh-console/locale/zh.json`, `plugins/vyra-dsh-console/locale/en.json`
- Create: `plugins/vyra-dsh-console/icon.svg`
- Modify: `plugins/vyra-dsh-console/client.js` (register the panel)
- Test: `plugins/vyra-dsh-console/test/client.test.mjs` (extend)

**Interfaces:**
- Consumes: `applyOp`; the Client `slots` and `locale` services.
- Produces: a `sidebar.panellist` entry and a `main` panel keyed `vyra-dsh-console`, registered exactly as `vyra-agent-manager/client.js:1422-1428` does.

- [ ] **Step 1: Write the failing test**

```js
test('the client registers a sidebar entry and a main panel under its key', () => {
  const registrations = []
  const ctx = {
    locale: { register() {}, bind: () => (k) => k },
    effect: (fn) => fn(),
    slots: {
      inject: (_name, cb) => cb(),
      register: (spec) => { registrations.push(spec); return () => {} },
    },
  }
  exports.apply(ctx)
  assert.ok(registrations.some((r) => r.name === 'sidebar.panellist' && r.id === 'vyra-dsh-console'))
  assert.ok(registrations.some((r) => r.name === 'main' && r.key === 'vyra-dsh-console'))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/vyra-dsh-console/test/client.test.mjs`
Expected: FAIL — the apply block registers no slots yet

- [ ] **Step 3: Implement the panel and register it**

Build the panel with the host's own look: `--dsw-alias-*` tokens only, row patterns copied from the Plugin Manager page, and every string through `ctx.locale.bind(ns)`. The panel lists actions from `console.actions` and runs each by POSTing to `/api/vyra-console/rpc` — **the same endpoint and the same `applyOp` path the agent tool uses**, so no operation is implemented twice.

Register in `client.js`'s `apply`:

```js
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'vyra-dsh-console: dictionaries')
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: 'vyra-dsh-console', order: 6, label: () => t('app.title') },
          PanelIcon,
        ))
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: 'vyra-dsh-console' },
          (props) => h(Panel, props),
        ))
```

- [ ] **Step 4: Draw the icon**

Create `icon.svg` (64×64, a distinct console/panel glyph that cannot be mistaken for another plugin's), then run:

```bash
node scripts/sync-manifest-icons.mjs
```

- [ ] **Step 5: Run all tests**

Run: `node --test plugins/vyra-dsh-console/test/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): management panel in the sidebar and main panel"
```

---

### Task 11: Market entry and full verification

**Files:**
- Modify: `scripts/market-manifest.ts`
- Modify: `plugins/vyra-dsh-console/package.json` (add the `engines.dsh` floor once known)

**Interfaces:**
- Consumes: everything above.
- Produces: a published index entry.

- [ ] **Step 1: Add the manifest entry**

Add an entry to the `plugins` array in `scripts/market-manifest.ts`, following the `vyra-agent-manager` shape: `name`, `title` (en + zh), `description` (en + zh), `author: 'lanxiake'`, `homepage`, `repository` with `directory: 'plugins/vyra-dsh-console'`, an inline `icon`, a `versions` map with one `0.1.0` entry, and `metadata: { category: 'observability', keywords: [...] }`.

- [ ] **Step 2: Verify the index**

Run: `pnpm run verify`
Expected: PASS.

- [ ] **Step 3: Run the whole repository check**

Run: `pnpm run check:installable && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Confirm the README contact block and QR ship**

Run: `pnpm run contact && git status --porcelain`
Expected: `README.md` may be touched by `contact` (idempotent — a second run changes nothing); `assets/qq-group.png` is present and listed in `files`.

- [ ] **Step 5: Commit**

```bash
git add scripts/market-manifest.ts docs/index.json docs/index-github.json plugins/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): publish to the market index"
```

---

## Self-Review

**Spec coverage:**
- §2.1 models → Task 3; settings → Task 3; plugins → Tasks 2–3; skills/MCP → Task 3b; appearance → Tasks 5–6; diagnostics → Task 8 (`doctor`); sessions/workspaces → deliberately out of scope for v1 (recorded above).
- §2.2 boundary → Task 1, with tests.
- §3.1–3.2 architecture and single implementation → Tasks 2, 7, 10.
- §4 components → all created except `panel.js` (Task 10) and `channel.js` (Task 5).
- §5 CLI/skill split → Tasks 8–9.
- §6 confirmation → Tasks 3–4.
- §7 error handling → Tasks 1, 3, 5.
- §8 testing → every task.
- §9 repo compliance → Tasks 1, 10, 11.
- §10 acceptance → verified by Tasks 3, 5, 7, 8, 11.

**Two gaps found during self-review, resolved:**
- The skills/MCP domain (spec §2.1) is now **Task 3b**.
- **Sessions and workspaces are explicitly OUT OF SCOPE for v1.** The spec's acceptance criteria (§10) never require them, and `workspaceRegistry` mutations affect the user's session list in ways the spec's boundary section does not yet reason about. They belong in a follow-up spec, not this plan. An executor must not add them.

**Placeholder scan:** Task 8 Step 1 and Task 10 Step 3 describe rather than show full code. Both are UI/CLI surface where the exact shape depends on data discovered at execution time (the profile's package.json layout; the live slot props). Every other code step shows complete code. If an executor stalls on these two, they should read `vyra-plugin-market/cli.mjs` and `vyra-agent-manager/client.js` as the reference implementations, which is stated in the task text.

**Type consistency:** `createConsole(ctx, handlers, options)` is consistent across Tasks 1, 3, 4. `dispatch(action, args)` returns `{ status, ... }` everywhere; `status` values used are exactly `ok | error | forbidden | unavailable | confirm-required`, and Tasks 1, 3, 5, 7 all use those spellings. `applyOp(services, op, args)` returns `{ status, value?, reason? }` in Tasks 6 and 10.
