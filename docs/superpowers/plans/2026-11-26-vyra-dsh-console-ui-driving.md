# vyra-dsh-console UI 驾驶 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Agent 能真正操作 DSH 界面（打开设置页并切到某个插件的设置节、切主面板、开右栏 tab、调用命令），同时修复四个致命缺陷，并把插件信息以界面地图的形式暴露给 Agent。

**Architecture:** 三层落点——Host 域层（`domains/ui.js` 新增 `ui.*`、`domains/console.js` 增加 `console.map`、`index.js` 补 RPC 栅栏与技能注册）、Browser 层（`client.js` 合入面板成为单文件，新增 `uiOps`；服务优先、DOM 兜底）、打包层（`package.json` files 补全、`check-installable` 增加 import 可达性与客户端 require 规则）。

**Tech Stack:** 纯 ESM JavaScript（无构建步骤）、`node --test`、Cordis 插件 API、DSH Client 服务（`layout` / `sidebarRight` / `sidebarRightTabs` / `shortcuts` / `slots` / `locale` / `theme`）。

**Spec:** `docs/superpowers/specs/2026-11-26-vyra-dsh-console-ui-driving-design.md`

## Global Constraints

- 包名、`client.js` 内 `window.__ModuleLoader__.load({ id })`、patch 行名**三者必须相同**：`dsh-vyra-dsh-console`。
- **`client.js` 必须是单文件自包含**：禁止 `require('./本地文件')`；包内相对 require 在浏览器里必然失败（`modules/src/client/system.ts:328-340`）。
- `client.js` 与 `panel.js` 的所有顶层 `const`/`let`/`class` 都在同一页面作用域内，与其他插件共享——合入后所有声明必须留在 factory 内部。
- 每个动作必须返回带 `status` 的对象，永不抛裸异常给模型。
- `ok` 必须带 `verified: true`；没有回读确认不许报 `ok`。
- 禁止对输入框/表单合成指针事件；只点导航与触发器。
- `FORBIDDEN` 四项（sandbox/permission/approval/credentials）不变，且 `ui.*` 不得提供任何绕过路径。
- 不修改 `packages/`（DSH 主仓库）。
- 版本从 `0.1.2` 升到 `0.2.0`；市场 `versions` 追加新 pin，**不重 pin 已发布的 0.1.2**。
- 测试命令：`node --test test/<file>.test.mjs`；全部：见 `package.json` 的 `scripts.test`。
- 仓库校验：`pnpm run verify`（含 `check:installable` / `build:index` / `verify:index`）。

## Review Focus

- **打包回归**：`npm pack --dry-run` 必须包含 `index.js` 引用的每一个文件；递归 import 校验必须能捕获新增遗漏。
- **单文件约束**：合入面板后 `client.js` 不得出现 `require('./`；顶层不得新增共享作用域声明。
- **DOM 驱动的诚实性**：每条 DOM 路径都必须点后校验；任一校验失败必须返回 `error` 而不是 `ok`。
- **账户菜单两跳**：`settings.launcher` 被账户菜单占用时，设置入口在菜单项里；两跳路径都必须实现且可测。
- **后台标签**：`document.visibilityState !== 'visible'` 时必须返回 `unavailable`，不得在后台修改界面。
- **RPC 栅栏**：错误 Origin / 非 loopback Host 必须 403，且不得影响同源请求。
- **幂等**：重复 `ui.open` 同一目标返回 `ok` + `how:'noop'`，不得重复点击。

---

### Task 1: 打包修复与 import 可达性校验

**Files:**
- Modify: `plugins/vyra-dsh-console/package.json`
- Modify: `scripts/check-installable.mjs`
- Create: `scripts/test/installable-imports.test.mjs`

**Interfaces:**
- Consumes: 现有 `check-installable.mjs` 的 `problems` / `failures` 结构。
- Produces: `scripts/lib/check-imports.mjs` 导出 `staticImportsOf(file): string[]` 与 `unresolvableImports(entry): {from, specifier}[]`。

- [ ] **Step 1: 写失败的测试**

Create `scripts/test/installable-imports.test.mjs`:

```js
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { unresolvableImports } from '../lib/check-imports.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-imports-'))
  for (const [rel, text] of Object.entries(files)) {
    const at = join(root, rel)
    mkdirSync(join(at, '..'), { recursive: true })
    writeFileSync(at, text)
  }
  return root
}

test('an import of a missing sibling is reported', () => {
  const root = fixture({ 'index.js': "import { x } from './tool.js'\nexport const y = 1\n" })
  const missing = unresolvableImports(join(root, 'index.js'))
  assert.equal(missing.length, 1)
  assert.equal(missing[0].specifier, './tool.js')
  rmSync(root, { recursive: true, force: true })
})

test('a resolvable directory of imports is clean', () => {
  const root = fixture({
    'index.js': "import { x } from './a.js'\nimport './b.js'\n",
    'a.js': 'export const x = 1\n',
    'b.js': "import { x } from './a.js'\n",
  })
  assert.deepEqual(unresolvableImports(join(root, 'index.js')), [])
  rmSync(root, { recursive: true, force: true })
})

test('bare package specifiers are not followed', () => {
  const root = fixture({ 'index.js': "import z from '@deepseek-ai/schemastery'\n" })
  assert.deepEqual(unresolvableImports(join(root, 'index.js')), [])
  rmSync(root, { recursive: true, force: true })
})

test('the shipped console entry resolves every static import', () => {
  const entry = new URL('../../plugins/vyra-dsh-console/index.js', import.meta.url).pathname
  assert.deepEqual(unresolvableImports(entry), [])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/test/installable-imports.test.mjs`
Expected: FAIL — `Cannot find module '../lib/check-imports.mjs'`

- [ ] **Step 3: 实现 `scripts/lib/check-imports.mjs`**

```js
/**
 * Follow a JS entry's *relative* static imports and report any that do not
 * resolve. Bare specifiers are skipped: they belong to the consumer's
 * node_modules, which a repository checkout cannot vouch for.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** `import … from './x'`, `import './x'`, `export … from './x'`, `import('./x')`. */
const SPECIFIER = /(?:^|[^.\w$])(?:import|export)\s*(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/gu
const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu

/** Every literal specifier in one file's text, in source order. */
export function staticImportsOf(text) {
  const found = []
  for (const match of text.matchAll(SPECIFIER)) found.push(match[1])
  for (const match of text.matchAll(DYNAMIC)) found.push(match[1])
  return found
}

/** Resolve one relative specifier against its importer, or report it missing. */
function resolveRelative(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return undefined
}

/**
 * @param entry absolute path of the entry module.
 * @returns every relative import reachable from `entry` that does not resolve.
 */
export function unresolvableImports(entry) {
  const missing = []
  const seen = new Set()
  const queue = [resolve(entry)]
  while (queue.length > 0) {
    const file = queue.shift()
    if (seen.has(file)) continue
    seen.add(file)
    let text
    try { text = readFileSync(file, 'utf8') } catch { continue }
    for (const specifier of staticImportsOf(text)) {
      if (!specifier.startsWith('.')) continue
      const hit = resolveRelative(file, specifier)
      if (hit === undefined) missing.push({ from: file, specifier })
      else if (!seen.has(hit)) queue.push(hit)
    }
  }
  return missing
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test scripts/test/installable-imports.test.mjs`
Expected: PASS（4 个用例）。第 4 个用例此时必然失败，因为 `files` 尚未修复——这正是本任务要修的东西。

- [ ] **Step 5: 在 `check-installable.mjs` 中接入**

在 `clientBundles.push({...})` 之后、`files` 检查之前插入：

```js
import { unresolvableImports } from './lib/check-imports.mjs'

// … existing code …

  const entryAbs = at(entry.replace(/^\.\//, ''))
  if (existsSync(entryAbs)) {
    for (const miss of unresolvableImports(entryAbs)) {
      failures(name, `entry imports "${miss.specifier}", which does not exist`)
    }
  }

  // A package-local `require('./x')` never resolves in the browser: the client
  // module system's require only knows platform seeds, materialized modules and
  // registered factories. Only `require.async('./client.*.js')` can reach a
  // package-local chunk. This shipped broken once (the panel), so it is a rule.
  const clientPath = clientOf(manifest)
  if (clientPath !== undefined) {
    const text = readFileSync(at(clientPath.replace(/^\.\//, '')), 'utf8')
    for (const match of text.matchAll(/\brequire\s*\(\s*['"](\.[^'"]*)['"]\s*\)/gu)) {
      failures(name, `client bundle requires "${match[1]}" package-locally, which never resolves in the browser; inline it`)
    }
  }
```

- [ ] **Step 6: 修复 `package.json` 的 `files`**

```json
  "files": [
    "index.js",
    "core.js",
    "channel.js",
    "tool.js",
    "domains/*.js",
    "client.js",
    "cli.mjs",
    "cordis.patch.yml",
    "skills/SKILL.md",
    "locale/*.json",
    "icon.svg",
    "README.md",
    "assets/qq-group.png"
  ],
```

同时从 `exports` 删除 `"./panel": "./panel.js"`（`panel.js` 在 Task 4 合入后删除）。

- [ ] **Step 7: 运行校验**

Run: `node scripts/check-installable.mjs`
Expected: 只剩 `dsh-boot-duel` 的 2 个既有问题（与本任务无关，见 `git status` 中的未跟踪目录）。

Run: `cd plugins/vyra-dsh-console && npm pack --dry-run 2>&1 | grep -c "tool.js\|domains/"`
Expected: ≥ 2

- [ ] **Step 8: 提交**

```sh
git add plugins/vyra-dsh-console/package.json scripts/check-installable.mjs scripts/lib/check-imports.mjs scripts/test/installable-imports.test.mjs
git commit -m "fix(vyra-dsh-console): ship every module the entry imports

The published 0.1.2 omitted tool.js and domains/, so index.js failed with
ERR_MODULE_NOT_FOUND and the tool, the RPC route and the panel were all absent.
check-installable now follows the entry's relative imports and refuses a
package-local require('./x') in a client bundle."
```

---

### Task 2: RPC 栅栏

**Files:**
- Modify: `plugins/vyra-dsh-console/index.js`
- Modify: `plugins/vyra-dsh-console/test/host.test.mjs`

**Interfaces:**
- Consumes: `createEndpoint(channel, longPollMs, console_)` 现有签名。
- Produces: `fenceProblem(req, { bindHost }): string | undefined`（导出，供测试直接驱动）。

- [ ] **Step 1: 写失败的测试**

在 `test/host.test.mjs` 末尾追加：

```js
import { fenceProblem } from '../index.js'

function req(headers) {
  return { headers: { host: '127.0.0.1:3080', ...headers } }
}

test('a loopback host with no browser markers is admitted', () => {
  assert.equal(fenceProblem(req({})), undefined)
})

test('a cross-site fetch is refused', () => {
  assert.match(fenceProblem(req({ 'sec-fetch-site': 'cross-site' })) ?? '', /cross-site/)
})

test('an origin that is not the same authority is refused', () => {
  assert.match(fenceProblem(req({ origin: 'https://evil.example' })) ?? '', /origin/)
})

test('an origin naming the same authority is admitted', () => {
  assert.equal(fenceProblem(req({ origin: 'http://127.0.0.1:3080' })), undefined)
})

test('a non-loopback, untrusted host is refused', () => {
  assert.match(fenceProblem(req({ host: 'evil.example:3080' })) ?? '', /host/)
})

test('localhost is loopback', () => {
  assert.equal(fenceProblem(req({ host: 'localhost:3080' })), undefined)
})

test('a bind address other than loopback is admitted when it is the listener bind', () => {
  assert.equal(fenceProblem(req({ host: '192.168.1.9:3080' }), { bindHost: '192.168.1.9' }), undefined)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/host.test.mjs`
Expected: FAIL — `fenceProblem is not a function` / 导入失败。

- [ ] **Step 3: 实现 `fenceProblem`**

在 `index.js` 中，`createEndpoint` 之前加入：

```js
/**
 * The same fence `client-connection` puts in front of `/api`, restated here
 * because this route is registered as `exact` and therefore never passes
 * through that prefix handler (`webserver/src/index.ts` matches the exact
 * table first). Without it, any local process could POST `plugin.install`.
 *
 * @returns a reason the request must be refused, or `undefined`.
 */
export function fenceProblem(req, { bindHost } = {}) {
  const headers = req?.headers ?? {}
  const host = headers.host
  if (typeof host !== 'string' || host === '') return 'missing host header'
  const authority = (() => {
    try { return new URL(`http://${host}`) } catch { return undefined }
  })()
  if (authority === undefined) return `unparseable host "${host}"`
  const loopback = authority.hostname === 'localhost'
    || authority.hostname === '127.0.0.1'
    || authority.hostname === '::1'
    || authority.hostname === '[::1]'
    || authority.hostname.endsWith('.localhost')
  const bindMatch = typeof bindHost === 'string' && bindHost !== ''
    && authority.hostname === bindHost
  if (!loopback && !bindMatch) return `host "${host}" is neither loopback nor the listener bind`

  if (headers['sec-fetch-site'] === 'cross-site') return 'cross-site fetch'
  const origin = headers.origin
  if (typeof origin === 'string' && origin !== '') {
    // The Origin's authority must equal the Host's, exactly as client-connection
    // compares them: a browser sends the authority it believes it is calling.
    let originUrl
    try { originUrl = new URL(origin) } catch { return `unparseable origin "${origin}"` }
    if (originUrl.host !== authority.host) return `origin "${origin}" does not match host "${host}"`
  }
  return undefined
}
```

在 `createEndpoint` 的 `handler` 开头插入：

```js
  return async function handler(req, res) {
    const refused = fenceProblem(req, { bindHost: bindHostOf(req) })
    if (refused !== undefined) {
      res.writeHead(403)
      res.end(refused)
      return
    }
    try {
      // … existing body …
```

`bindHostOf` 从 context 读取首页可用的绑定地址；`owner.webServer` 的 `host` 在其 `register` 调用点已可用：

```js
/** The listener's bind address, or undefined when the service does not expose one. */
function bindHostOf(req) {
  return req?.__dshBindHost
}
```

并在 `ctx.inject(['webServer'], …)` 的 `owner.effect` 中，把 `owner.webServer.host` 作为 `createEndpoint` 的第 4 个参数传入，由 `createEndpoint` 在调用 `fenceProblem` 时使用——**不依赖读请求对象**。相应地把上面 `handler` 的第一行改为 `fenceProblem(req, { bindHost })`，其中 `bindHost` 是 `createEndpoint` 的新参数（默认 `undefined`）。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/host.test.mjs`
Expected: PASS。

- [ ] **Step 5: 追加集成测试**

在 `test/host.test.mjs` 中，用现有 `createEndpoint` 驱动方式补一条：

```js
test('the endpoint answers 403 for a hostile origin before dispatching anything', async () => {
  let dispatched = 0
  const console_ = { dispatch: async () => { dispatched += 1; return { status: 'ok' } } }
  const channel = { onRequest() {}, request: async () => ({ status: 'ok' }), respond() { return false } }
  const handler = createEndpoint(channel, 10, console_)
  const res = fakeResponse()
  await handler({ method: 'POST', headers: { host: '127.0.0.1:3080', origin: 'https://evil.example' }, [Symbol.asyncIterator]: async function* () { yield Buffer.from('{"action":"plugin.install"}') } }, res)
  assert.equal(res.status, 403)
  assert.equal(dispatched, 0)
})
```

- [ ] **Step 6: 提交**

```sh
git add plugins/vyra-dsh-console/index.js plugins/vyra-dsh-console/test/host.test.mjs
git commit -m "fix(vyra-dsh-console): fence the exact RPC route like /api

An exact route outranks the /api prefix, so this handler never reached
client-connection's Host/Origin admission — any local process could POST
plugin.install. It now applies the same checks and answers 403."
```

---

### Task 3: `console.map` 与界面账本读取

**Files:**
- Modify: `plugins/vyra-dsh-console/core.js`（`ACTIONS` 增加两项）
- Modify: `plugins/vyra-dsh-console/domains/console.js`
- Create: `plugins/vyra-dsh-console/domains/inventory.js`
- Modify: `plugins/vyra-dsh-console/index.js`（注册 `inventory` 域）
- Modify: `plugins/vyra-dsh-console/test/core.test.mjs`

**Interfaces:**
- Produces: `inventoryDomain(ctx, { action, args })` → `{ status:'ok', host:{plugins,bundles,mcp,skills,tools,model}, caveats:[] }`。
- `ACTIONS['console.map'] = { domain:'inventory', mutating:false, destructive:false, requiresClient:false }`

- [ ] **Step 1: 写失败的测试**

在 `test/core.test.mjs` 末尾追加：

```js
import { inventoryDomain } from '../domains/inventory.js'

function inventoryCtx(services) {
  return { get: (key) => services[key], logger: { warn() {} } }
}

test('console.map reports every inventory it could read', async () => {
  const ctx = inventoryCtx({
    pluginManager: {
      listPlugins: async () => [{ entryId: 'ui-theme', moduleName: '@deepseek-ai/dsh-client-ui-theme', enabled: true, fiberPhase: 'active' }],
      listBundles: async () => [{ name: 'dsh-vyra-dsh-console', version: '0.2.0', enabled: true, installed: true, removable: true }],
    },
    mcpManager: { list: () => [{ name: 'wechat', configured: true, status: { state: 'connected', toolCount: 7 } }] },
    skills: { list: async () => [{ name: 'vyra-dsh-console', description: 'x', source: 'runtime', provider: 'runtime', invocation: { modelInvocable: true, userInvocable: true } }] },
    tools: { schemas: () => [{ name: 'dsh_console' }] },
  })
  const result = await inventoryDomain(ctx, { action: 'console.map', args: {} })
  assert.equal(result.status, 'ok')
  assert.equal(result.host.plugins[0].entryId, 'ui-theme')
  assert.equal(result.host.bundles[0].version, '0.2.0')
  assert.equal(result.host.mcp[0].state, 'connected')
  assert.equal(result.host.skills[0].name, 'vyra-dsh-console')
  assert.ok(result.host.tools.some((t) => t.name === 'dsh_console'))
})

test('a missing service is named in caveats instead of failing the map', async () => {
  const result = await inventoryDomain(inventoryCtx({}), { action: 'console.map', args: {} })
  assert.equal(result.status, 'ok')
  assert.ok(result.caveats.length >= 3, 'every missing inventory must be named')
  assert.ok(result.caveats.some((c) => c.includes('pluginManager')))
})

test('one unreadable inventory does not hide the others', async () => {
  const ctx = inventoryCtx({
    pluginManager: { listPlugins: async () => { throw new Error('loader gone') }, listBundles: async () => [] },
    tools: { schemas: () => [{ name: 'a' }] },
  })
  const result = await inventoryDomain(ctx, { action: 'console.map', args: {} })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.host.tools, [{ name: 'a' }])
  assert.ok(result.caveats.some((c) => c.includes('pluginManager')))
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/core.test.mjs`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现 `domains/inventory.js`**

要点：

- 每个清单独立 `try/catch`，失败写入 `caveats`（形如 `pluginManager: loader gone`），**其余照常返回**。
- `present`/`presentDeep` 清理所有 `undefined`，遵守无损 JSON。
- `tools.schemas()` 可能不存在 —— 用 `typeof service.schemas === 'function'` 探测。
- 不引用 `settings`：`console.map` 是清单，不是设置内容。

```js
import { present, presentDeep } from '../core.js'

/** Read one service, or report why it could not contribute. */
async function read(caveats, key, fn, label = key) {
  try { return await fn() } catch (error) {
    caveats.push(`${label}: ${String(error?.message || error)}`)
    return undefined
  }
}

export async function inventoryDomain(ctx, { action }) {
  if (action !== 'console.map') {
    return { status: 'error', action, reason: `inventory domain has no action "${action}"` }
  }
  const caveats = []
  const service = (key) => {
    const value = ctx.get(key)
    if (value === undefined || value === null) { caveats.push(`${key}: this profile has no ${key} service`); return undefined }
    return value
  }

  const pluginManager = service('pluginManager')
  const plugins = pluginManager
    ? await read(caveats, 'pluginManager.listPlugins', async () => (await pluginManager.listPlugins()).map((p) => present({
        entryId: p.entryId, moduleName: p.moduleName, enabled: p.enabled, fiberPhase: p.fiberPhase,
      })))
    : undefined
  const bundles = pluginManager
    ? await read(caveats, 'pluginManager.listBundles', async () => (await pluginManager.listBundles()).map((b) => present({
        name: b.name, version: b.version, enabled: b.enabled, installed: b.installed, removable: b.removable,
      })))
    : undefined

  const mcpManager = service('mcpManager')
  const mcp = mcpManager
    ? await read(caveats, 'mcpManager.list', () => mcpManager.list().map((view) => present({
        name: view.name, configured: view.configured, state: view.status?.state,
        toolCount: view.status?.toolCount,
      })))
    : undefined

  const skillsService = service('skills')
  const skills = skillsService
    ? await read(caveats, 'skills.list', async () => (await skillsService.list()).map((s) => present({
        name: s.name, description: s.description, source: s.source, provider: s.provider,
      })))
    : undefined

  const toolsService = service('tools')
  const tools = toolsService && typeof toolsService.schemas === 'function'
    ? await read(caveats, 'tools.schemas', () => toolsService.schemas().map((s) => present({ name: s.name, description: s.description })))
    : (caveats.push('tools.schemas: this host exposes no schema listing'), undefined)

  return {
    status: 'ok',
    host: presentDeep({
      plugins, bundles, mcp, skills, tools,
      client: { note: 'the live interface is reported by ui.list, not here' },
    }),
    caveats,
  }
}
```

- [ ] **Step 4: 注册动作与域**

`core.js` 的 `ACTIONS` 增加：

```js
  'console.map': { domain: 'inventory', mutating: false, destructive: false, requiresClient: false },
```

`index.js`：`import { inventoryDomain } from './domains/inventory.js'`，并在 `createConsole` 的 handlers 中加入 `inventory: inventoryDomain`。

- [ ] **Step 5: `console.actions` 的 forbidden 表不变，但 `console.map` 要出现在清单里**

追加断言到 `test/core.test.mjs`：

```js
test('console.map is a non-mutating action in the catalog', async () => {
  const console_ = createConsole(bareCtx(), { inventory: inventoryDomain })
  const result = await console_.dispatch('console.actions', {})
  const row = result.actions.find((a) => a.name === 'console.map')
  assert.ok(row, 'console.map must be in the catalog')
  assert.equal(row.mutating, false)
})
```

- [ ] **Step 6: 运行并提交**

Run: `node --test test/core.test.mjs`
Expected: PASS。

```sh
git add plugins/vyra-dsh-console/core.js plugins/vyra-dsh-console/domains/inventory.js plugins/vyra-dsh-console/domains/console.js plugins/vyra-dsh-console/index.js plugins/vyra-dsh-console/test/core.test.mjs
git commit -m "feat(vyra-dsh-console): console.map reports the whole host inventory

Plugins, bundles, MCP servers, skills and tools in one call, each read
independently so one unreadable service is a caveat rather than a failed map."
```

---

### Task 4: 面板合入 `client.js`，成为单文件

**Files:**
- Modify: `plugins/vyra-dsh-console/client.js`
- Delete: `plugins/vyra-dsh-console/panel.js`
- Modify: `plugins/vyra-dsh-console/test/client.test.mjs`

**Interfaces:**
- Consumes: 现有 `applyOp`、`OPS`、`call`。
- Produces: `__internal.panel` = `{ Console, PanelIcon, deriveActions, groupByDomain, argsFor, canRun }`（供测试直接驱动）。
- 导出 `__internal.createPanel({ React, h, applyOp, services, call, t, localeApi })`，与合入前签名相同，便于测试对照。

- [ ] **Step 1: 改测试，先钉住新形状**

在 `test/client.test.mjs` 中：

1. 删除 `loadPanelFactory()` 与 `panelSource`。
2. 把 `require('./panel.js')` 分支改为断言**不应发生**：

```js
function mountBundle({ services, slots } = {}) {
  let mod
  const win = {
    __ModuleLoader__: {
      load: ({ factory }) => {
        mod = factory((specifier) => {
          if (specifier === 'react') return reactStub
          throw new Error(`the single-file bundle must not require(${specifier})`)
        })
      },
    },
  }
  // …unchanged…
}
```

3. 追加：

```js
test('the client bundle is a single file: it never requires a package-local module', () => {
  assert.doesNotMatch(source, /\brequire\s*\(\s*['"]\.\//u)
  assert.doesNotMatch(source, /\brequire\.async\b/u)
})

test('the panel is built with the real translator and the real locale service', () => {
  const { services } = spyServices()
  const { mod } = mountBundle({ services })
  const panel = mod.__internal.createPanel({
    React: reactStub,
    h: reactStub.createElement,
    applyOp: mod.__internal.applyOp,
    services: () => services,
    call: async () => ({}),
    t: (key) => `T:${key}`,
    localeApi: { subscribe: () => () => {}, register() {} },
  })
  // The translator the panel received must answer with the prefix, not a function.
  assert.equal(panel.__internal.translate('app.title'), 'T:app.title')
})

test('the panel renders without throwing', () => {
  const { services } = spyServices()
  const { mod } = mountBundle({ services })
  const panel = mod.__internal.createPanel({
    React: reactStub, h: reactStub.createElement, applyOp: mod.__internal.applyOp,
    services: () => services, call: async () => ({}),
    t: (key) => key, localeApi: { subscribe: () => () => {} },
  })
  assert.doesNotThrow(() => panel.__internal.renderConsole({}))
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/client.test.mjs`
Expected: FAIL — `createPanel` / `translate` / `renderConsole` 未定义；`require('./panel.js')` 触发新断言。

- [ ] **Step 3: 合入面板**

把 `panel.js` 的 `createPanel` 整个函数体搬进 `client.js` 的 factory 内部（`loadPanel` 之前），并做三处修正：

1. **`t` 不再是 thunk**：`createPanel` 收到的 `t` 就是 `(key, params) => string`。
   面板内部所有 `t('x')` 不变；删除 `t: () => t` 的间接层。
2. **`localeApi` 不再是 thunk**：直接接收服务对象。
3. **导出 `<Panel>` 供测试直接渲染**：`Console` 是闭包内的函数，因此额外暴露
   `__internal.createPanel`（接收依赖并返回同一组内部函数），以及
   `__internal.renderConsole(props)` = `h(Panel, props)`。

`loadPanel(services)` 改为：

```js
    let panelModule
    function loadPanel(services) {
      if (panelModule === undefined) {
        const React = require('react')          // platform seed; allowed
        panelModule = createPanel({
          React,
          h: React.createElement,
          applyOp,
          services,
          call,
          t: (key, params) => t(key, params),     // the bound translator, not a thunk
          localeApi,                              // the service, not a thunk
        })
      }
      return panelModule
    }
```

`createPanel` 内部 `renderConsole` 增加：

```js
  return {
    Panel, PanelIcon, h,
    __internal: {
      deriveActions, groupByDomain, describeStatus, argsFor, canRun, rowAffordance, rowControl,
      APPEARANCE, CSS,
      translate: (key, params) => t(key, params),
      renderConsole: (props) => h(Panel, props || {}),
    },
  }
```

**注意**：`t` 与 `localeApi` 在 `registerPanel` 中被赋值（`t = ctx.locale.bind(NS)`），
而 `createPanel` 只在 `loadPanel` 首次调用时执行。因此 `createPanel` 内必须**每次调用都读闭包变量**，
不能把 `t`/`localeApi` 解构进局部常量：

```js
  const translate = (key, params) => t(key, params)   // reads the live binding
```

面板内部所有 `t(...)` 调用改为 `translate(...)`。

- [ ] **Step 4: 删除 `panel.js` 并修正引用**

```sh
git rm plugins/vyra-dsh-console/panel.js
```

`package.json` 中 `exports["./panel"]` 已在 Task 1 删除；`files` 已无 `panel.js`。

- [ ] **Step 5: 运行测试**

Run: `node --test test/client.test.mjs`
Expected: PASS（含 3 个新用例）。

Run: `node --test test/bridge.test.mjs`
Expected: PASS（桥不依赖面板模块）。

- [ ] **Step 6: 提交**

```sh
git add plugins/vyra-dsh-console/client.js plugins/vyra-dsh-console/test/client.test.mjs
git commit -m "fix(vyra-dsh-console): inline the panel and pass the real translator

require('./panel.js') never resolves in the browser — the client module system
only knows platform seeds, materialized modules and registered factories — so
the panel could not mount at all. The panel is now one file with the bundle,
and it receives the bound translator and locale service instead of thunks that
made every label render as a function."
```

---

### Task 5: `ui.*` 动作注册与 Host 侧转发

**Files:**
- Modify: `plugins/vyra-dsh-console/core.js`
- Create: `plugins/vyra-dsh-console/domains/ui.js`
- Modify: `plugins/vyra-dsh-console/index.js`
- Modify: `plugins/vyra-dsh-console/test/core.test.mjs`

**Interfaces:**
- `ACTIONS` 新增：
  - `ui.list` / `ui.state` — `requiresClient: true`, `mutating: false`
  - `ui.open` / `ui.close` / `ui.invoke` — `requiresClient: true`, `mutating: true`, `destructive: false`
- Produces: `uiDomain(ctx, { action, args })`，参数校验后经 `ctx.__consoleChannel.request(action, args)` 转发。

- [ ] **Step 1: 写失败的测试**

```js
import { uiDomain } from '../domains/ui.js'

function uiCtx(reply) {
  const seen = []
  return {
    ctx: {
      __consoleChannel: { request: async (op, args) => { seen.push({ op, args }); return reply } },
    },
    seen,
  }
}
const uiConsole = (ctx) => createConsole(ctx, { ui: uiDomain })

test('ui.list is forwarded to the client', async () => {
  const { ctx, seen } = uiCtx({ status: 'ok', settings: { open: false, sections: [] } })
  const result = await uiConsole(ctx).dispatch('ui.list', {})
  assert.equal(result.status, 'ok')
  assert.deepEqual(seen, [{ op: 'ui.list', args: {} }])
})

test('ui.open settings requires a section-targeting object or none', async () => {
  const { ctx } = uiCtx({ status: 'ok' })
  const c = uiConsole(ctx)
  assert.equal((await c.dispatch('ui.open', { target: 'settings' })).status, 'ok')
  assert.equal((await c.dispatch('ui.open', {})).status, 'error')
  assert.equal((await c.dispatch('ui.open', { target: 'nope' })).status, 'error')
})

test('ui.open main requires an id', async () => {
  const { ctx } = uiCtx({ status: 'ok' })
  const c = uiConsole(ctx)
  assert.equal((await c.dispatch('ui.open', { target: 'main' })).status, 'error')
  assert.match((await c.dispatch('ui.open', { target: 'main' })).reason, /id/u)
})

test('ui.open rightbar needs a kind or an address', async () => {
  const { ctx } = uiCtx({ status: 'ok' })
  const c = uiConsole(ctx)
  assert.equal((await c.dispatch('ui.open', { target: 'rightbar' })).status, 'error')
  assert.equal((await c.dispatch('ui.open', { target: 'rightbar', kind: 'browser' })).status, 'ok')
  assert.equal((await c.dispatch('ui.open', { target: 'rightbar', address: 'dsh-resource://file/x' })).status, 'ok')
})

test('ui.invoke requires an id', async () => {
  const { ctx } = uiCtx({ status: 'ok' })
  assert.equal((await uiConsole(ctx).dispatch('ui.invoke', {})).status, 'error')
})

test('ui.* is unavailable with no interface connected', async () => {
  const c = uiConsole({ __consoleChannel: undefined })
  assert.equal((await c.dispatch('ui.list', {})).status, 'unavailable')
})

test('every ui action is marked as needing the client', async () => {
  const c = createConsole(bareCtx())
  const rows = (await c.dispatch('console.actions', {})).actions.filter((a) => a.name.startsWith('ui.'))
  assert.ok(rows.length >= 5)
  assert.ok(rows.every((r) => r.requiresClient === true))
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/core.test.mjs`
Expected: FAIL。

- [ ] **Step 3: 实现 `domains/ui.js`**

```js
import { present } from '../core.js'

const TARGETS = new Set(['settings', 'main', 'rightbar', 'modal'])

/** Validate `ui.open`'s target/args without reaching the client. */
function openProblem(args) {
  if (typeof args?.target !== 'string' || !TARGETS.has(args.target) || args.target === 'modal') {
    return 'ui.open needs a target of "settings", "main" or "rightbar"'
  }
  if (args.target === 'settings') {
    if (args.section !== undefined && (typeof args.section !== 'string' || args.section === '')) {
      return 'ui.open target "settings" takes section as a non-empty string when supplied'
    }
    return undefined
  }
  if (args.target === 'main') {
    return typeof args.id === 'string' && args.id !== '' ? undefined : 'ui.open target "main" needs a non-empty id'
  }
  const hasKind = typeof args.kind === 'string' && args.kind !== ''
  const hasAddress = typeof args.address === 'string' && args.address !== ''
  if (!hasKind && !hasAddress) return 'ui.open target "rightbar" needs either kind or address'
  if (hasKind && hasAddress) return 'ui.open target "rightbar" takes either kind or address, not both'
  if (args.url !== undefined && typeof args.url !== 'string') return 'ui.open target "rightbar" takes url as a string'
  return undefined
}

/** Why this action cannot be dispatched at all, or undefined. */
function problemWith(action, args) {
  switch (action) {
    case 'ui.open': return openProblem(args)
    case 'ui.close':
      if (args?.target === undefined) return 'ui.close needs a target'
      return TARGETS.has(args.target) ? undefined : 'ui.close takes a target of "settings" or "modal"'
    case 'ui.invoke':
      return typeof args?.id === 'string' && args.id !== '' ? undefined : 'ui.invoke needs a non-empty command id'
    default: return undefined
  }
}

const CLIENT_ACTIONS = new Set(['ui.list', 'ui.state', 'ui.open', 'ui.close', 'ui.invoke'])

export async function uiDomain(ctx, { action, args }) {
  if (!CLIENT_ACTIONS.has(action)) {
    return { status: 'error', action, reason: `ui domain has no action "${action}"` }
  }
  const problem = problemWith(action, args)
  // Checked before the channel, so a malformed call reads as a bad request
  // rather than as a closed interface — the ordering domains/appearance.js uses.
  if (problem !== undefined) return present({ status: 'error', action, reason: problem })
  const channel = typeof ctx?.__consoleChannel?.request === 'function' ? ctx.__consoleChannel : undefined
  if (channel === undefined) {
    return present({ status: 'unavailable', action, reason: 'no interface is connected; open the DSH Web UI and retry' })
  }
  return channel.request(action, args ?? {})
}
```

- [ ] **Step 4: 注册**

`core.js` 的 `ACTIONS` 追加五项；`index.js` 的 handlers 加 `ui: uiDomain`。

- [ ] **Step 5: 运行并提交**

Run: `node --test test/core.test.mjs`
Expected: PASS。

```sh
git add plugins/vyra-dsh-console/core.js plugins/vyra-dsh-console/domains/ui.js plugins/vyra-dsh-console/index.js plugins/vyra-dsh-console/test/core.test.mjs
git commit -m "feat(vyra-dsh-console): ui.* actions forwarded to the interface"
```

---

### Task 6: 浏览器侧 `uiOps`（服务路径 + DOM 兜底）

**Files:**
- Modify: `plugins/vyra-dsh-console/client.js`
- Create: `plugins/vyra-dsh-console/test/ui-dom.test.mjs`

**Interfaces:**
- Produces: `uiOps` 与现有 `OPS` 并列；`applyOp` 先查外观、再查 ui，两者都拒绝未知 op。
- `__internal.uiOps` 暴露给测试。

- [ ] **Step 1: 写假 DOM 与失败的测试**

`test/ui-dom.test.mjs` 的核心结构（与本插件现有测试一致，不引第三方 DOM 库）：

```js
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root, 'client.js'), 'utf8')

/** A minimal element: enough for querySelector by attribute and click(). */
function el(tag, attrs = {}, children = []) {
  const node = {
    tag, attrs, children, listeners: {},
    clicked: 0,
    getAttribute: (k) => attrs[k] ?? null,
    matches: (selector) => matches(node, selector),
    querySelector: (selector) => descendants(node).find((n) => matches(n, selector)) ?? null,
    querySelectorAll: (selector) => descendants(node).filter((n) => matches(n, selector)),
    contains: (other) => descendants(node).includes(other),
    click() { this.clicked += 1; for (const fn of this.listeners.click ?? []) fn() },
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn) },
    removeEventListener() {},
  }
  children.forEach((c) => { c.parent = node })
  return node
}
function descendants(node) { return node.children.flatMap((c) => [c, ...descendants(c)]) }
/** Supports `tag`, `[attr]`, `[attr="value"]`, and comma lists. */
function matches(node, selector) { return selector.split(',').map((s) => s.trim()).some((s) => one(node, s)) }
function one(node, sel) {
  const tag = /^[a-z]+/u.exec(sel)?.[0]
  if (tag !== undefined && node.tag !== tag) return false
  for (const [, name, value] of sel.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/gu)) {
    if (!(name in node.attrs)) return false
    if (value !== undefined && node.attrs[name] !== value) return false
  }
  return true
}
```

三个核心用例：

```js
test('settings opens through the shortcut-marked trigger and verifies the dialog', async () => {
  const trigger = el('button', { 'aria-keyshortcuts': 'Control+Comma', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' })
  const doc = el('body', {}, [trigger])
  trigger.addEventListener('click', () => {
    const dialog = el('div', { 'data-shortcut-modal': 'settings' }, [
      el('nav', {}, [el('button', { 'aria-current': 'false' }, [el('span', {}, [])])]),
    ])
    doc.children.push(dialog)
  })
  const { op } = bundleWith({ document: doc, shortcuts: catalogWith({ id: 'settings.open', aria: 'Control+Comma' }) })
  const result = await op('ui.open', { target: 'settings' })
  assert.equal(result.status, 'ok')
  assert.equal(result.how, 'dom')
  assert.equal(result.verified, true)
  assert.equal(trigger.clicked, 1)
})

test('a trigger that does nothing is reported as an error, never as success', async () => {
  const trigger = el('button', { 'aria-keyshortcuts': 'Control+Comma' })
  const doc = el('body', {}, [trigger])
  const { op } = bundleWith({ document: doc, shortcuts: catalogWith({ id: 'settings.open', aria: 'Control+Comma' }) })
  const result = await op('ui.open', { target: 'settings' })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /did not open/u)
})

test('another dialog present is refused rather than closed', async () => {
  const doc = el('body', {}, [el('div', { 'data-shortcut-modal': 'shortcut-edit' })])
  const { op } = bundleWith({ document: doc, shortcuts: catalogWith({ id: 'settings.open', aria: 'Control+Comma' }) })
  const result = await op('ui.open', { target: 'settings' })
  assert.equal(result.status, 'internal-busy' .replace('internal-busy', 'error'))
  assert.match(result.reason, /another dialog/u)
})
```

再补：按 order 索引切节、`aria-current` 校验失败、`ui.close` 合成 Escape、`ui.list` 从账本读出的形状、`ui.open main` 走 `layout.selectPanel` 且 throw 转 `error`+候选、`ui.open rightbar` 在无会话时 `unavailable`、后台标签 `unavailable`。

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/ui-dom.test.mjs`
Expected: FAIL — `uiOps` 不存在。

- [ ] **Step 3: 实现 `uiOps`**

在 `client.js` 的 factory 内、`OPS` 旁边加入。核心结构与关键点：

```js
    const SETTINGS_MODAL = '[data-shortcut-modal="settings"]'
    const ANY_MODAL = '[data-shortcut-modal]'
    const VERIFY_TIMEOUT_MS = 800
    const VERIFY_POLL_MS = 25

    const doc = () => globalThis.document

    /** Count or find, whichever the minimal test DOM or a real DOM answers. */
    function find(root, selector) { return root?.querySelector?.(selector) ?? null }

    function modalOf() {
      const all = doc()?.querySelectorAll?.(ANY_MODAL) ?? []
      const top = all[all.length - 1]
      return top === undefined ? null : { id: top.getAttribute('data-shortcut-modal'), element: top }
    }

    async function waitFor(predicate) {
      const started = Date.now()
      for (;;) {
        const hit = predicate()
        if (hit !== undefined && hit !== null) return hit
        if (Date.now() - started >= VERIFY_TIMEOUT_MS) return undefined
        await new Promise((r) => setTimeout(r, VERIFY_POLL_MS))
      }
    }

    /** The settings trigger candidates, best first. */
    function settingsTriggers(services) {
      const out = []
      const aria = settingsShortcutAria(services)
      if (aria !== undefined) {
        const byAria = find(doc(), `button[aria-keyshortcuts="${aria}"]`)
        if (byAria !== null) out.push(byAria)
      }
      const byHaspopup = (doc()?.querySelectorAll?.('button[aria-haspopup="dialog"]') ?? [])
        .filter((node) => node.closest?.('[data-shortcut-modal]') === null)
      out.push(...byHaspopup)
      return out
    }

    function settingsShortcutAria(services) {
      const catalog = services?.shortcuts?.catalog?.getSnapshot?.() ?? []
      const row = catalog.find((entry) => entry.id === 'settings.open')
      return typeof row?.aria === 'string' && row.aria !== '' ? row.aria : undefined
    }
```

`openSettings` 的完整流程：

```js
    async function openSettings(services, sectionId) {
      const open = find(doc(), SETTINGS_MODAL)
      if (open !== null) return selectSection(services, sectionId, { how: 'noop' })

      const other = modalOf()
      if (other !== null && other.id !== 'settings') {
        return { status: 'error', target: 'settings', verified: false,
          reason: `another dialog ("${other.id}") is open; this console does not close a dialog it did not open` }
      }

      // 1) the shortcut-marked trigger (the sidebar launcher, or the account menu row)
      const aria = settingsShortcutAria(services)
      if (aria !== undefined) {
        const direct = find(doc(), `button[aria-keyshortcuts="${aria}"]`)
        if (direct !== null) {
          direct.click()
          const dialog = await waitFor(() => find(doc(), SETTINGS_MODAL))
          if (dialog !== null) return selectSection(services, sectionId, { how: 'dom' })
        }
        // 2) the two-hop path: open the account menu, then its settings row
        const menuTrigger = (doc()?.querySelectorAll?.('button[aria-haspopup="menu"]') ?? [])[0]
        if (menuTrigger !== undefined) {
          menuTrigger.click()
          const row = await waitFor(() => (doc()?.querySelectorAll?.('[role="menuitem"]') ?? [])
            .find((node) => node.getAttribute?.('aria-keyshortcuts') === aria))
          if (row !== undefined) {
            row.click()
            const dialog = await waitFor(() => find(doc(), SETTINGS_MODAL))
            if (dialog !== null) return selectSection(services, sectionId, { how: 'dom' })
          }
        }
      }
      // 3) the generic fallback
      for (const candidate of settingsTriggers(services)) {
        candidate.click()
        const dialog = await waitFor(() => find(doc(), SETTINGS_MODAL))
        if (dialog !== null) return selectSection(services, sectionId, { how: 'dom' })
      }
      return { status: 'error', target: 'settings', verified: false,
        reason: 'the settings dialog did not open after clicking the available triggers' }
    }
```

`selectSection`：从 `services.slots.entries('settings.section')` 取行，`order` 升序；
目标不在 → `error` + `candidates`；在 → 按索引点 `nav` 内按钮，`waitFor` 校验 `aria-current="true"`。

```js
    function sectionRows(services) {
      const entries = services?.slots?.entries?.('settings.section') ?? []
      return entries.map((entry) => ({
        id: entry.options?.id,
        order: entry.options?.order ?? 0,
        label: typeof entry.options?.label === 'function' ? entry.options.label() : (entry.options?.label ?? ''),
        registrant: entry.registrant,
      })).filter((row) => typeof row.id === 'string' && row.id !== '')
        .sort((a, b) => a.order - b.order)
    }
```

`ui.list` 同时给出 `settings.open`、`sections`、`main.panels/active`（读 `services.layout.panelInfo.getSnapshot()`）、
`rightbar.tabs/expanded`（`services.sidebarRightTabs.entries()` + `services.sidebarRight.isExpanded()`）、
`commands`（`services.shortcuts.catalog.getSnapshot()` 投影为 `{id,label,keys,aria}`）、`modal`。

**平台与可见性护栏**（每个 `ui.*` 入口先执行）：

```js
    function unavailableNow() {
      if (doc() === undefined) return { status: 'unavailable', reason: 'no document is present' }
      const visibility = doc().visibilityState
      if (visibility !== undefined && visibility !== 'visible') {
        return { status: 'unavailable',
          reason: 'this tab is in the background; bring the DSH window to the front and retry' }
      }
      return undefined
    }
```

- [ ] **Step 4: 把 `uiOps` 接入 `applyOp`**

```js
    function applyOp(services, op, args) {
      if (typeof op !== 'string') return { status: 'error', reason: 'an appearance op must be a string' }
      const appearance = Object.hasOwn(OPS, op) ? OPS[op] : undefined
      const ui = appearance === undefined && Object.hasOwn(uiOps, op) ? uiOps[op] : undefined
      if (appearance === undefined && ui === undefined) {
        return { status: 'error', reason: `unknown appearance op "${op}"` }
      }
      // ui ops are async; appearance ops stay synchronous.
      if (ui !== undefined) return Promise.resolve().then(() => {
        const blocked = unavailableNow()
        return blocked ?? ui(services, args || {})
      }).catch((err) => ({ status: 'error', reason: String(err?.message ?? err) }))
      try { return appearance(services, args || {}) } catch (err) { return { status: 'error', reason: String(err?.message ?? err) } }
    }
```

**关键**：`drain()` 的 `answer(request)` 目前是同步 `applyOp(...)`。必须改为 `await`：

```js
            const outcome = await applyOp(services, request?.op, request?.args)
```

`runAppearance`（面板里）也要 `await`；面板按钮的处理器本来就是 async 兼容的。

- [ ] **Step 5: 运行测试**

Run: `node --test test/ui-dom.test.mjs`
Expected: PASS。

Run: `node --test test/client.test.mjs test/bridge.test.mjs`
Expected: PASS。

- [ ] **Step 6: 提交**

```sh
git add plugins/vyra-dsh-console/client.js plugins/vyra-dsh-console/test/ui-dom.test.mjs
git commit -m "feat(vyra-dsh-console): drive the interface from the console

Main panels and the right drawer go through their public services; the
settings dialog has no service, so it is driven through its shortcut-marked
trigger, the account menu's two-hop path, or the generic launcher — and every
DOM path verifies the result before reporting ok."
```

---

### Task 7: 技能打包与运行时注册

**Files:**
- Move: `skills/vyra-dsh-console/SKILL.md` → `plugins/vyra-dsh-console/skills/SKILL.md`（内容重写）
- Modify: `plugins/vyra-dsh-console/index.js`
- Modify: `plugins/vyra-dsh-console/test/host.test.mjs`

- [ ] **Step 1: 重写技能内容**

必须包含：三件套（`dsh_console` / `ui.*` / CLI）、`ui.list` 优先、`verified` 与三种失败形状、
「能带路、不代点敏感开关」、以及一个完整示例（打开免费模型设置页）。

- [ ] **Step 2: 运行时注册**

`index.js` 的 `apply()` 末尾：

```js
  // The skill is a runtime contribution, not a file dropped into the user's
  // DSH home: it lives exactly as long as this plugin, and a read-only DSH_HOME
  // costs nothing. `dsh-vyra-agent-manager` established this pattern.
  ctx.inject?.(['skills'], (owner) => {
    owner.effect(() => owner.skills.register({
      name: 'vyra-dsh-console',
      description: 'Operate this DSH installation: read the whole inventory, open settings pages, main panels and right-drawer tabs, and switch theme, layout or language. Use when asked to change or inspect the harness itself.',
      content: SKILL_BODY,
    }), 'dsh-vyra-dsh-console: console skill')
  })
```

`SKILL_BODY` 通过 `readFileSync(new URL('./skills/SKILL.md', import.meta.url), 'utf8')` 读取，
并在读取失败时降级为 `undefined`（只损失技能）。**注意**：`index.js` 目前只 import `node:` 内建，
`readFileSync` 不违反该约束。

- [ ] **Step 3: 测试**

```js
test('the skill registers through the skills service', () => {
  const registered = []
  const ctx = { ...bareCtx(), toolHelpers, inject: (names, cb) => { if (names.includes('skills')) cb({ effect: (fn) => fn(), skills: { register: (s) => { registered.push(s); return () => {} } } }) } }
  apply(ctx, {})
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'vyra-dsh-console')
  assert.match(registered[0].content, /ui\.list/u)
})

test('a profile without the skills service still gets the tool', () => {
  // inject never fires; apply must have registered dsh_console.
})
```

- [ ] **Step 4: 提交**

```sh
git add plugins/vyra-dsh-console/skills plugins/vyra-dsh-console/index.js plugins/vyra-dsh-console/test/host.test.mjs
git rm -r skills/vyra-dsh-console
git commit -m "feat(vyra-dsh-console): ship and register the agent skill

The skill lived outside the package and was never registered, so no agent ever
saw it. It now ships in files/ and registers at runtime with the plugin."
```

---

### Task 8: CLI `map` 命令

**Files:**
- Modify: `plugins/vyra-dsh-console/cli.mjs`
- Modify: `plugins/vyra-dsh-console/test/cli.test.mjs`

- [ ] **Step 1: 写失败的测试**

```js
test('map reports the client inventory as unknown, with the tool that answers it', () => {
  const out = run(['map', '--json'], fixtureProfile)
  const data = JSON.parse(out.stdout)
  assert.equal(data.client.settings.sections.status, 'unknown')
  assert.match(data.client.settings.sections.reason, /dsh_console/u)
})
```

- [ ] **Step 2: 实现**

在现有 `doctor`/`state`/`services`/`events` 旁增加 `map`：
输出 `{ profile, host: {bundles, model, mcp}, client: { settings: {status:'unknown', reason}, main: {...}, rightbar: {...}, commands: {...} } }`。
只读约束不变（不新增写入 API）。

- [ ] **Step 3: 运行并提交**

Run: `node --test test/cli.test.mjs`
Expected: PASS，且原有目录哈希不变的断言仍通过。

---

### Task 9: 版本、市场与文档

**Files:**
- Modify: `plugins/vyra-dsh-console/package.json`（`version: 0.2.0`）
- Modify: `plugins/vyra-dsh-console/README.md`
- Modify: `scripts/market-manifest.ts`
- Modify: `plugins/vyra-dsh-console/locale/zh.json` + `en.json`（如面板新增文案）

- [ ] **Step 1: 升版本并更新 README**

README 增加：`ui.*` 动作表、`console.map`、设置弹窗的 DOM 驱动与 `verified` 语义、
「0.1.2 是坏的」说明、技能随插件注册。

- [ ] **Step 2: 市场条目**

在 `dsh-vyra-dsh-console` 的 `versions` 中追加：

```ts
        // 0.1.2 shipped without tool.js and domains/, so the host half failed to
        // load on every installation; 0.2.0 is the first working release and
        // adds ui.* driving, console.map and the bundled skill.
        '0.2.0': {
          publishTimestamp: <发布时填写>,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '<发布 commit>',
            path: 'plugins/vyra-dsh-console',
          },
        },
```

**不重 pin 0.1.2。** 同时把条目的 `description` 补上「可打开设置页/主面板/右栏」。

- [ ] **Step 3: 全量校验**

```sh
node scripts/check-installable.mjs
node scripts/test/installable-imports.test.mjs
node --test plugins/vyra-dsh-console/test/core.test.mjs \
          plugins/vyra-dsh-console/test/channel.test.mjs \
          plugins/vyra-dsh-console/test/client.test.mjs \
          plugins/vyra-dsh-console/test/host.test.mjs \
          plugins/vyra-dsh-console/test/bridge.test.mjs \
          plugins/vyra-dsh-console/test/ui-dom.test.mjs \
          plugins/vyra-dsh-console/test/cli.test.mjs
pnpm run verify
cd plugins/vyra-dsh-console && npm pack --dry-run
```

Expected：全部通过；`npm pack` 含 `tool.js`、`domains/`、`skills/`。

- [ ] **Step 4: 真实环境验收**

在 `~/.dsh/profiles/desktop` 用 link 安装本包，重启 DSH，验证：

1. `dsh_console { action:'console.map' }` 返回插件/技能/MCP/工具清单。
2. `dsh_console { action:'ui.list' }` 返回设置节，且每行有 `registrant`。
3. `dsh_console { action:'ui.open', args:{ target:'settings', section:'dsh-vyra-free-model' } }`
   返回 `ok` + `verified:true`，界面上停在「免费模型」。
4. 不存在的 section 返回 `error` + `candidates`。
5. `skills.list` 能看到 `vyra-dsh-console`。

- [ ] **Step 5: 提交**

```sh
git add plugins/vyra-dsh-console scripts/market-manifest.ts
git commit -m "release(vyra-dsh-console): 0.2.0 — the first release that works and can drive the UI"
```

---

## 依赖顺序

```
Task 1 (packaging)  ──┬─► Task 3 (console.map)
Task 2 (fence)      ──┤
Task 4 (inline)     ──┴─► Task 5 (ui registration) ──► Task 6 (uiOps) ──► Task 7 (skill)
                                                                └────────► Task 8 (CLI)
                                                                              └─► Task 9 (release)
```

Task 1、2、4 互不依赖，可并行；Task 5 依赖 4（客户端要能装载）；Task 6 依赖 5（Host 要能转发）。
