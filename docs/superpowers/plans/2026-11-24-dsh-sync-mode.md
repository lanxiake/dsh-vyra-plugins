# dsh-sync 同步模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户只填仓库地址 + token、选一个「同步模式」就能在多机间真正同步，不必理解 4×4 策略矩阵；并修复「A 机器删掉的技能会被 B 机器推回来」的语义缺陷。

**Architecture:** 在 `src/index.js` 增加 `syncMode`（`mirror`/`backup`/`custom`）与一个纯函数 `resolveStrategies()`，把模式折叠成现有四个 `*Strategy` 键；策略读取点（`syncSpec`）统一走它。`migrateSyncMode()` 保证老用户升级后行为不变。`reconcileRemote` 增加删除传播分支。`client/index.js` 增加模式单选卡片、折叠矩阵、状态条。

**Tech Stack:** Node.js ≥ 22.5（CJS `src/index.js` + 浏览器端 `client/index.js`）、`node:test` 离线测试（无第三方测试框架）、`node:assert`。

**Spec:** `docs/superpowers/specs/2026-11-24-dsh-sync-mode-design.md`

## Global Constraints

- 插件根目录：`plugins/dsh-sync/`。工作区里只有这个目录是可编译产物的落点；`plugins/dsh-sync/source/` 是**上游 vendored 副本，本计划一律不改**（见 `plugins/dsh-sync/SOURCE.md`）。
- `src/index.js` 是 CommonJS，对外只经 `module.exports.__internals` 暴露可测函数。新增的纯函数必须加入 `__internals`，否则测试无法导入。
- `client/index.js` 是运行在浏览器 bundle 里的模块，**不能 `import` 任何 Node 内置模块**。
- 改动 `client/index.js` 后**必须**重新生成 `client/bundle.js`，否则页面跑的是旧界面。
- 本副本**没有** `scripts/` 目录，也没有 `test/` 目录，根 `package.json` 的 `scripts` 为空。构建脚本在 `plugins/dsh-sync/source/scripts/build-client.mjs`，它按 `scripts/../client/index.js` 解析路径 —— **直接运行 `node source/scripts/build-client.mjs` 会去写 `source/client/`，是错的**（见 Task 1）。
- 现有默认值 `DEFAULT_SYNC_SETTINGS` 的四键为 `{skills: 'union', sessions/settings/plugins: 'backup'}`，即 `mirror` 预设与之相同。**本计划不改变任何默认行为**，只改认知路径。
- 所有新增面向用户的文案必须中英双份，走 `client/index.js` 里已有的 `t()` 机制（中文表在文件上部，英文表在 `LANG` 分支里）。
- 提交信息用 `feat(dsh-sync):` / `fix(dsh-sync):` / `test(dsh-sync):` / `docs(dsh-sync):` 前缀。

---

## File Structure

| 文件 | 职责 | 本计划中的动作 |
|---|---|---|
| `plugins/dsh-sync/src/index.js` | 插件 host 侧：设置模型、影子仓库、同步循环、HTTP API | 修改（Task 2–7） |
| `plugins/dsh-sync/client/index.js` | 设置页 React 组件 + i18n 表 | 修改（Task 8–10） |
| `plugins/dsh-sync/client/bundle.js` | 由 `index.js` 生成的静态 bundle | 由构建重新生成（Task 10） |
| `plugins/dsh-sync/package.json` | 补 `scripts`（`check`/`test`/`build:client`） | 修改（Task 1） |
| `plugins/dsh-sync/scripts/build-client.mjs` | 本地化构建脚本（修正路径基准） | 新建（Task 1） |
| `plugins/dsh-sync/test/sync-mode.test.mjs` | 模式解析 / 迁移 / PUT 校验 | 新建（Task 2–5） |
| `plugins/dsh-sync/test/remote-delete.test.mjs` | 删除传播五分支 | 新建（Task 6–7） |
| `plugins/dsh-sync/test/client-sync-state.test.mjs` | 状态条映射 | 新建（Task 9） |
| `plugins/dsh-sync/README.md` | 使用章节与更新日志 | 修改（Task 11） |

---

## Task 1: 补齐本地构建与测试入口

当前 `plugins/dsh-sync/package.json` 的 `scripts` 为空，`client/index.js` 改完后无处构建；`test/` 目录也不存在。先把这个地基补上，否则后面每个任务都无法验证。

**Files:**
- Create: `plugins/dsh-sync/scripts/build-client.mjs`
- Modify: `plugins/dsh-sync/package.json`
- Test: `plugins/dsh-sync/test/smoke.test.mjs`

**Interfaces:**
- Consumes: 无
- Produces: `npm run check`（语法检查）、`npm test`（跑 `test/*.test.mjs`）、`npm run build:client`（由 `client/index.js` 生成 `client/bundle.js`）

- [ ] **Step 1: 写一个必然失败的冒烟测试**

创建 `plugins/dsh-sync/test/smoke.test.mjs`：

```js
// 入口自检：插件能加载，且 __internals 里该有的纯函数都在。
import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const plugin = require('../src/index.js')

test('插件导出 name 与 __internals', () => {
  assert.equal(plugin.name, 'dsh-sync')
  assert.ok(plugin.__internals && typeof plugin.__internals === 'object')
})

test('策略相关纯函数已导出', () => {
  const { DEFAULT_SYNC_SETTINGS } = plugin.__internals
  assert.ok(DEFAULT_SYNC_SETTINGS)
  assert.equal(DEFAULT_SYNC_SETTINGS.skillsStrategy, 'union')
  // 这两个键由 Task 2 引入，此刻必然缺失 —— 用来确认测试真的会红
  assert.equal(DEFAULT_SYNC_SETTINGS.syncMode, 'mirror')
})
```

- [ ] **Step 2: 运行测试，确认它失败**

Run: `cd plugins/dsh-sync && node --test test/smoke.test.mjs`
Expected: FAIL — `Expected values to be strictly equal: undefined !== 'mirror'`

- [ ] **Step 3: 新建本地构建脚本**

创建 `plugins/dsh-sync/scripts/build-client.mjs`。它与 `source/scripts/build-client.mjs` 内容一致，**唯一区别是补一句注释说明为什么必须放在 `plugins/dsh-sync/scripts/`**（脚本用 `here/..` 定位 client 目录，放到 `source/scripts/` 下就会写进 `source/client/`）：

```js
/**
 * Build `client/bundle.js` from `client/index.js`.
 *
 * 本地副本专用：与 source/scripts/build-client.mjs 逻辑一致，但必须放在
 * plugins/dsh-sync/scripts/ 下 —— 本脚本用 here/.. 定位 client 目录，
 * 放在 source/scripts/ 下会写进 source/client/（上游 vendored 副本，不发布）。
 *
 * Run: `npm run build:client`
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const sourcePath = join(here, '..', 'client', 'index.js')
const bundlePath = join(here, '..', 'client', 'bundle.js')

const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))

const source = readFileSync(sourcePath, 'utf8')

const banner = `/* Generated from client/index.js by scripts/build-client.mjs — do not edit by hand.
 * Regenerate with: npm run build:client
 */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })
    var React = require("react")
`

const footer = `
    return module.exports
  }
})
`

const indented = source
  .split('\n')
  .map((line) => (line.length === 0 ? line : '    ' + line))
  .join('\n')

writeFileSync(bundlePath, banner + indented + footer)
console.log(`built ${bundlePath}`)
```

- [ ] **Step 4: 给 package.json 补 scripts**

在 `plugins/dsh-sync/package.json` 里，`publishConfig` 之前插入 `scripts` 字段（保留现有其它字段不动）：

```json
  "scripts": {
    "check": "node --check src/index.js && node --check client/index.js && node --check scripts/build-client.mjs",
    "test": "node --test --test-timeout=120000 test/*.test.mjs",
    "build:client": "node scripts/build-client.mjs"
  },
```

- [ ] **Step 5: 验证构建脚本能跑通且产物正确**

运行构建，确认它写的是**根目录** `client/bundle.js`：

```bash
cd plugins/dsh-sync
npm run build:client
```

Expected: 输出 `built C:\...\plugins\dsh-sync\client\bundle.js`，且 `git status` 里 `client/bundle.js` **没有变化**（因为源码未改，重建应产出字节相同的文件）。若显示有 diff，说明 `client/index.js` 与现有 `bundle.js` 本来就不同步——记录这个差异并在 Task 10 重建时确认。

- [ ] **Step 6: 运行测试，确认现在仍然失败（因为 Step 3/4 与它无关）**

Run: `npm test`
Expected: FAIL — 仍是 `DEFAULT_SYNC_SETTINGS.syncMode` 那条断言。**这是预期的**：该字段由 Task 2 引入。

- [ ] **Step 7: 临时把断言改成现状，让地基任务自己全绿**

把 `test/smoke.test.mjs` 里 Step 1 写的那条断言改为只检查策略键：

```js
  assert.equal(DEFAULT_SYNC_SETTINGS.skillsStrategy, 'union')
  assert.equal(DEFAULT_SYNC_SETTINGS.sessionsStrategy, 'backup')
```

（`syncMode` 的断言在 Task 2 里恢复。）

- [ ] **Step 8: 运行测试确认全绿**

Run: `npm test`
Expected: PASS，2 个用例通过。

- [ ] **Step 9: 提交**

```bash
git add plugins/dsh-sync/scripts/build-client.mjs plugins/dsh-sync/package.json plugins/dsh-sync/test/smoke.test.mjs
git commit -m "chore(dsh-sync): 补本地构建与测试入口（scripts/build-client.mjs + npm scripts）"
```

---

## Task 2: syncMode 配置键与 resolveStrategies 纯函数

**Files:**
- Modify: `plugins/dsh-sync/src/index.js`（`DEFAULT_SYNC_SETTINGS` 约 194-228 行、`syncSettingsSchema` 约 240-270 行、`syncSpec` 约 757-797 行、`__internals` 约 2204 行）
- Test: `plugins/dsh-sync/test/sync-mode.test.mjs`

**Interfaces:**
- Consumes: 无
- Produces:
  - `DEFAULT_SYNC_SETTINGS.syncMode: 'mirror'`、`DEFAULT_SYNC_SETTINGS.allowRemoteDelete: true`
  - `SYNC_MODE_VALUES: string[]` = `['mirror','backup','custom']`
  - `SYNC_MODE_PRESETS: { mirror: Strategies, backup: Strategies }`，其中 `Strategies = { skillsStrategy, sessionsStrategy, settingsStrategy, pluginsStrategy }`
  - `resolveStrategies(eff) → Strategies`（纯函数）

- [ ] **Step 1: 写失败的测试**

创建 `plugins/dsh-sync/test/sync-mode.test.mjs`：

```js
// syncMode 折叠成四个策略键：纯函数行为。
import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { __internals } = require('../src/index.js')
const { resolveStrategies, DEFAULT_SYNC_SETTINGS, SYNC_MODE_PRESETS, SYNC_MODE_VALUES } = __internals

test('DEFAULT_SYNC_SETTINGS 带 syncMode 与 allowRemoteDelete', () => {
  assert.equal(DEFAULT_SYNC_SETTINGS.syncMode, 'mirror')
  assert.equal(DEFAULT_SYNC_SETTINGS.allowRemoteDelete, true)
})

test('SYNC_MODE_VALUES 恰为三种', () => {
  assert.deepEqual(SYNC_MODE_VALUES, ['mirror', 'backup', 'custom'])
})

test('mirror 预设 = 技能 union、其余 backup', () => {
  assert.deepEqual(SYNC_MODE_PRESETS.mirror, {
    skillsStrategy: 'union', sessionsStrategy: 'backup',
    settingsStrategy: 'backup', pluginsStrategy: 'backup',
  })
})

test('backup 预设 = 四键全 backup', () => {
  assert.deepEqual(SYNC_MODE_PRESETS.backup, {
    skillsStrategy: 'backup', sessionsStrategy: 'backup',
    settingsStrategy: 'backup', pluginsStrategy: 'backup',
  })
})

test('resolveStrategies: 非法/缺失的键按模式预设回填', () => {
  // 四键都缺失 → 按 syncMode 取预设
  assert.deepEqual(resolveStrategies({ syncMode: 'mirror' }), SYNC_MODE_PRESETS.mirror)
  assert.deepEqual(resolveStrategies({ syncMode: 'backup' }), SYNC_MODE_PRESETS.backup)
})

test('resolveStrategies: 已有合法四键时优先用它们（保护 backupLayoutSpec 的强制覆盖）', () => {
  const forced = { syncMode: 'mirror', skillsStrategy: 'backup', sessionsStrategy: 'backup', settingsStrategy: 'backup', pluginsStrategy: 'backup' }
  assert.deepEqual(resolveStrategies(forced), SYNC_MODE_PRESETS.backup)
})

test('resolveStrategies: custom 模式用用户自己的四键', () => {
  const custom = { syncMode: 'custom', skillsStrategy: 'remote', sessionsStrategy: 'union', settingsStrategy: 'local', pluginsStrategy: 'backup' }
  assert.deepEqual(resolveStrategies(custom).skillsStrategy, 'remote')
  assert.deepEqual(resolveStrategies(custom).sessionsStrategy, 'union')
})

test('resolveStrategies: 无法识别的模式值退化为 mirror', () => {
  assert.deepEqual(resolveStrategies({ syncMode: 'nonsense' }), SYNC_MODE_PRESETS.mirror)
  assert.deepEqual(resolveStrategies({}), SYNC_MODE_PRESETS.mirror)
})
```

同时把 `test/smoke.test.mjs` 的断言恢复成带 `syncMode` 的版本（Task 1 Step 7 临时改掉的那条）：

```js
  assert.equal(DEFAULT_SYNC_SETTINGS.skillsStrategy, 'union')
  assert.equal(DEFAULT_SYNC_SETTINGS.syncMode, 'mirror')
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd plugins/dsh-sync && npm test`
Expected: FAIL — `resolveStrategies is not a function` / `DEFAULT_SYNC_SETTINGS.syncMode` 为 `undefined`

- [ ] **Step 3: 加默认值与常量**

在 `plugins/dsh-sync/src/index.js` 的 `DEFAULT_SYNC_SETTINGS` 里，`snapshotLocalKeep: 30,` 那一行之后插入：

```js
  // 统一的用户可见概念：一个模式 = 一套策略预设。四个 *Strategy 键退化为
  // custom 模式的载体（mirror/backup 下被预设覆盖），策略矩阵不再是必经之路。
  syncMode: 'mirror',         // 'mirror' | 'backup' | 'custom'
  allowRemoteDelete: true,    // union 组是否把远端删除镜像到本地（删除传播）
```

在 `const STRATEGY_VALUES = ['backup', 'union', 'remote', 'local']`（约 230 行）之后插入：

```js
const SYNC_MODE_VALUES = ['mirror', 'backup', 'custom']

/** 三种同步模式对应的策略预设。custom 无预设（由用户四键决定）。 */
const SYNC_MODE_PRESETS = {
  mirror: { skillsStrategy: 'union', sessionsStrategy: 'backup', settingsStrategy: 'backup', pluginsStrategy: 'backup' },
  backup: { skillsStrategy: 'backup', sessionsStrategy: 'backup', settingsStrategy: 'backup', pluginsStrategy: 'backup' },
}

const STRATEGY_KEYS = ['skillsStrategy', 'sessionsStrategy', 'settingsStrategy', 'pluginsStrategy']

/** 把 syncMode 折叠成实际生效的四个策略键。
 *
 *  优先级：eff 上已合法的四键 > SYNC_MODE_PRESETS[syncMode] > DEFAULT。
 *  「已合法的四键优先」是为了保住 backupLayoutSpec() 的语义 —— 它把四键强制
 *  改成 backup 再调 syncSpec，实现「纯备份协议永远走 backup 布局」；若预设反过来
 *  覆盖四键，syncMode=mirror 时 WebDAV/本地备份就会错写成共享路径。 */
function resolveStrategies(eff) {
  const src = eff && typeof eff === 'object' ? eff : {}
  const mode = SYNC_MODE_VALUES.includes(src.syncMode) ? src.syncMode : 'mirror'
  const preset = SYNC_MODE_PRESETS[mode] || SYNC_MODE_PRESETS.mirror
  const out = {}
  for (const key of STRATEGY_KEYS) {
    const v = src[key]
    out[key] = STRATEGY_VALUES.includes(v) ? v : preset[key]
  }
  return out
}
```

- [ ] **Step 4: 让 syncSpec 走 resolveStrategies**

把 `syncSpec()`（约 757-797 行）开头的四行：

```js
  const skillsStrategy = STRATEGY_VALUES.includes(eff.skillsStrategy) ? eff.skillsStrategy : 'union'
  const sessionsStrategy = STRATEGY_VALUES.includes(eff.sessionsStrategy) ? eff.sessionsStrategy : 'backup'
  const settingsStrategy = STRATEGY_VALUES.includes(eff.settingsStrategy) ? eff.settingsStrategy : 'backup'
  const pluginsStrategy = STRATEGY_VALUES.includes(eff.pluginsStrategy) ? eff.pluginsStrategy : 'backup'
```

替换为：

```js
  const resolved = resolveStrategies(eff)
  const skillsStrategy = resolved.skillsStrategy
  const sessionsStrategy = resolved.sessionsStrategy
  const settingsStrategy = resolved.settingsStrategy
  const pluginsStrategy = resolved.pluginsStrategy
```

- [ ] **Step 5: 加 schema 字段**

在 `syncSettingsSchema(S)`（约 240-270 行）里，`token: S.string(),` 之后插入：

```js
    syncMode: S.string(),
    allowRemoteDelete: S.boolean(),
```

（不照抄这一步，宿主 `describe()` 投影不到该键，面板保存会「成功但重启丢失」——0.4.3 的教训。）

- [ ] **Step 6: 导出到 __internals**

在 `module.exports.__internals`（约 2204 行）里，`STRATEGY_VALUES,` 之后插入：

```js
    SYNC_MODE_VALUES, SYNC_MODE_PRESETS, STRATEGY_KEYS, resolveStrategies,
```

- [ ] **Step 7: 运行测试确认通过**

Run: `npm test`
Expected: PASS — `sync-mode.test.mjs` 8 项 + `smoke.test.mjs` 2 项全绿。

- [ ] **Step 8: 提交**

```bash
git add plugins/dsh-sync/src/index.js plugins/dsh-sync/test/sync-mode.test.mjs plugins/dsh-sync/test/smoke.test.mjs
git commit -m "feat(dsh-sync): 引入 syncMode 与 resolveStrategies，策略读取统一折叠"
```

---

## Task 3: migrateSyncMode —— 老用户不被静默改行为

**Files:**
- Modify: `plugins/dsh-sync/src/index.js`（新增纯函数 + `syncSettings()` 接线，约 2316-2324 行）
- Test: `plugins/dsh-sync/test/sync-mode.test.mjs`

**Interfaces:**
- Consumes: `SYNC_MODE_VALUES`、`STRATEGY_KEYS`（Task 2）
- Produces: `migrateSyncMode(merged, sources) → string`，返回合法 `syncMode`；`sources` 是若干「键值对象」的数组，用于判定用户是否显式选过策略。

- [ ] **Step 1: 写失败的测试**

在 `plugins/dsh-sync/test/sync-mode.test.mjs` 末尾追加：

```js
const { migrateSyncMode } = __internals

test('migrateSyncMode: 已显式设置合法模式 → 原样返回（幂等）', () => {
  assert.equal(migrateSyncMode({ syncMode: 'custom' }, [{ skillsStrategy: 'union' }]), 'custom')
  assert.equal(migrateSyncMode({ syncMode: 'backup' }, []), 'backup')
})

test('migrateSyncMode: 全新用户（任何来源都没写过策略）→ mirror', () => {
  assert.equal(migrateSyncMode({}, []), 'mirror')
  assert.equal(migrateSyncMode({}, [{}, {}]), 'mirror')
})

test('migrateSyncMode: 只要有任一来源写过策略 → custom（保留原值，行为不变）', () => {
  assert.equal(migrateSyncMode({}, [{ sessionsStrategy: 'union' }]), 'custom')
  assert.equal(migrateSyncMode({}, [{}, { pluginsStrategy: 'remote' }]), 'custom')
})

test('migrateSyncMode: 来源里的非法策略值不算「写过」', () => {
  assert.equal(migrateSyncMode({}, [{ skillsStrategy: 'bogus' }]), 'mirror')
})

test('migrateSyncMode: 来源里 syncMode 非法时不算数', () => {
  assert.equal(migrateSyncMode({ syncMode: 'nonsense' }, []), 'mirror')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — `migrateSyncMode is not a function`

- [ ] **Step 3: 实现 migrateSyncMode**

在 `resolveStrategies` 之后插入：

```js
/** 决定「本次运行实际用哪个 syncMode」。
 *
 *  规则（spec §3.3）：
 *   - 已显式设置合法值 → 用它；
 *   - 三个来源层里没有任何一个 STRATEGY_KEY 被写过 → 'mirror'（新装用户走推荐档）；
 *   - 写过任意一个 → 'custom'，四个键原样保留，行为与升级前逐字节一致。
 *
 *  只返回判定结果，不写盘：用户下次在面板保存时才落盘。 */
function migrateSyncMode(merged, sources) {
  const src = merged && typeof merged === 'object' ? merged : {}
  if (SYNC_MODE_VALUES.includes(src.syncMode)) return src.syncMode
  const layers = Array.isArray(sources) ? sources : []
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue
    for (const key of STRATEGY_KEYS) {
      if (STRATEGY_VALUES.includes(layer[key])) return 'custom'
    }
  }
  return 'mirror'
}
```

- [ ] **Step 4: 在 syncSettings() 里接线**

把 `apply()` 内的 `syncSettings()`（约 2316-2324 行）改为：

```js
    const syncSettings = () => {
      const doc = (liveSettings && typeof liveSettings === 'object') ? liveSettings : {}
      const docSync = (doc.sync && typeof doc.sync === 'object') ? doc.sync : {}
      const hostWriteAt = Math.max(docUpdatedAt || 0, hostDocumentMtime())
      const fileLayer = pickFileSettingsLayer(fileSettings, fileSettingsMtime, hostWriteAt)
      const merged = { ...baseSettings(), ...docSync, ...fileLayer, ...settingsOverrides }
      // 墓碑最后压：被清除的键一律回默认值（否则 baseSettings 里的旧 config 值会复辟）
      for (const key of clearedKeys) merged[key] = DEFAULT_SYNC_SETTINGS[key]
      // syncMode 缺省时按「用户是否写过策略」判定：写过就锁定 custom（行为不变），
      // 没写过才落到推荐的 mirror。三个来源层都要看，漏一层就会误判。
      merged.syncMode = migrateSyncMode(merged, [settingsOverrides, fileLayer, docSync, (config.sync || {})])
      return merged
    }
```

- [ ] **Step 5: 导出**

在 `__internals` 的 `resolveStrategies,` 之后加 `migrateSyncMode,`：

```js
    SYNC_MODE_VALUES, SYNC_MODE_PRESETS, STRATEGY_KEYS, resolveStrategies, migrateSyncMode,
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`
Expected: PASS — 新增 5 项，合计 15 项全绿。

- [ ] **Step 7: 提交**

```bash
git add plugins/dsh-sync/src/index.js plugins/dsh-sync/test/sync-mode.test.mjs
git commit -m "feat(dsh-sync): migrateSyncMode 保证老用户升级后行为不变"
```

---

## Task 4: PUT 接收 syncMode 并展开预设

**Files:**
- Modify: `plugins/dsh-sync/src/index.js`（`PUT /dsh-sync/api/settings` 解析段，约 2726-2754 行；`GET /status` 回显，约 2656-2663 行）
- Test: `plugins/dsh-sync/test/sync-mode.test.mjs`

**Interfaces:**
- Consumes: `SYNC_MODE_VALUES`、`SYNC_MODE_PRESETS`（Task 2）
- Produces: `applySyncModePatch(body, patch, ignored)` — 纯函数，把 `body.syncMode` 校验后写入 `patch`（含展开的四个策略键），非法值 push 进 `ignored`。返回 `patch`。

- [ ] **Step 1: 写失败的测试**

在 `plugins/dsh-sync/test/sync-mode.test.mjs` 追加：

```js
const { applySyncModePatch } = __internals

test('applySyncModePatch: 选 backup 时同时展开四个策略键', () => {
  const patch = {}
  const ignored = []
  applySyncModePatch({ syncMode: 'backup' }, patch, ignored)
  assert.equal(patch.syncMode, 'backup')
  assert.deepEqual(
    [patch.skillsStrategy, patch.sessionsStrategy, patch.settingsStrategy, patch.pluginsStrategy],
    ['backup', 'backup', 'backup', 'backup'],
  )
  assert.deepEqual(ignored, [])
})

test('applySyncModePatch: 选 mirror 时展开为技能 union、其余 backup', () => {
  const patch = {}
  applySyncModePatch({ syncMode: 'mirror' }, patch, [])
  assert.equal(patch.skillsStrategy, 'union')
  assert.equal(patch.settingsStrategy, 'backup')
})

test('applySyncModePatch: custom 只写模式，不覆盖用户四键', () => {
  const patch = { skillsStrategy: 'remote' }
  applySyncModePatch({ syncMode: 'custom' }, patch, [])
  assert.equal(patch.syncMode, 'custom')
  assert.equal(patch.skillsStrategy, 'remote')
})

test('applySyncModePatch: 非法模式进 ignored，不写任何键', () => {
  const patch = {}
  const ignored = []
  applySyncModePatch({ syncMode: 'bogus' }, patch, ignored)
  assert.deepEqual(patch, {})
  assert.deepEqual(ignored, ['syncMode'])
})

test('applySyncModePatch: 非字符串模式进 ignored', () => {
  const ignored = []
  applySyncModePatch({ syncMode: 123 }, {}, ignored)
  assert.deepEqual(ignored, ['syncMode'])
})

test('applySyncModePatch: 未提供 syncMode 时不动 patch', () => {
  const patch = { repoUrl: 'x' }
  applySyncModePatch({}, patch, [])
  assert.deepEqual(patch, { repoUrl: 'x' })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — `applySyncModePatch is not a function`

- [ ] **Step 3: 实现纯函数**

在 `migrateSyncMode` 之后插入：

```js
/** PUT /settings 的 syncMode 解析（纯函数，便于单测）。
 *
 *  mirror/backup 时把预设同时展开写进四个 *Strategy 键：即使将来 syncMode 被
 *  外部清掉，落盘的策略仍是用户在选择那一刻看到的那套；custom 不展开，保留用户四键。 */
function applySyncModePatch(body, patch, ignored) {
  if (!body || body.syncMode === undefined) return patch
  if (!SYNC_MODE_VALUES.includes(body.syncMode)) { ignored.push('syncMode'); return patch }
  patch.syncMode = body.syncMode
  const preset = SYNC_MODE_PRESETS[body.syncMode]
  if (preset) Object.assign(patch, preset)
  return patch
}
```

- [ ] **Step 4: 接进 PUT 处理器**

在 `PUT /dsh-sync/api/settings` 的 `const patch = {}` / `const cleared = []` / `const ignored = []` 声明之后、`for (const key of ['repoUrl', ...])` 之前插入：

```js
            // syncMode 先解析：mirror/backup 会展开四个策略键，后面针对四键的
            // 逐项校验只在 custom 模式下才需要生效（展开值已是合法值）
            applySyncModePatch(body, patch, ignored)
            if (typeof body.allowRemoteDelete === 'boolean') patch.allowRemoteDelete = body.allowRemoteDelete
            else if (body.allowRemoteDelete !== undefined) ignored.push('allowRemoteDelete')
```

- [ ] **Step 5: 让四键解析不覆盖模式展开值**

把 PUT 里那段（约 2741-2744 行）：

```js
            for (const key of ['skillsStrategy', 'sessionsStrategy', 'settingsStrategy', 'pluginsStrategy']) {
              if (STRATEGY_VALUES.includes(body[key])) patch[key] = body[key]
              else if (body[key] !== undefined) ignored.push(key)
            }
```

改为：

```js
            // custom 模式下才采用客户端提交的四键；mirror/backup 由模式预设说了算，
            // 避免同一请求里「模式=镜像」又被旧表单里的四键值覆盖回去
            for (const key of STRATEGY_KEYS) {
              if (!SYNC_MODE_PRESETS[patch.syncMode] && STRATEGY_VALUES.includes(body[key])) patch[key] = body[key]
              else if (body[key] !== undefined && !SYNC_MODE_PRESETS[body.syncMode]) ignored.push(key)
            }
```

- [ ] **Step 6: 在 GET /status 里回显两个新键**

在 `/status` 的 `sendJson` 对象里、`strategies: {...}` 之前插入：

```js
              syncMode: eff.syncMode,
              allowRemoteDelete: eff.allowRemoteDelete !== false,
```

- [ ] **Step 7: 导出**

在 `__internals` 里 `migrateSyncMode,` 之后加 `applySyncModePatch,`：

```js
    SYNC_MODE_VALUES, SYNC_MODE_PRESETS, STRATEGY_KEYS, resolveStrategies, migrateSyncMode, applySyncModePatch,
```

- [ ] **Step 8: 运行测试确认通过**

Run: `npm test`
Expected: PASS — 新增 6 项，合计 21 项全绿。

- [ ] **Step 9: 提交**

```bash
git add plugins/dsh-sync/src/index.js plugins/dsh-sync/test/sync-mode.test.mjs
git commit -m "feat(dsh-sync): PUT 接收 syncMode 并展开策略预设，status 回显"
```

---

## Task 5: 备份协议与新配置的隔离断言

`mirror` 模式下 `backupLayoutSpec()` 必须仍然产出 `backup/<实例ID>/` 布局，否则 WebDAV / 本地文件夹备份会写错路径（这是 Task 2 那个「四键优先」设计的守门测试）。

**Files:**
- Test: `plugins/dsh-sync/test/sync-mode.test.mjs`

**Interfaces:**
- Consumes: `resolveStrategies`、`syncSpec`、`backupLayoutSpec`、`defaultRoots`（均已导出）
- Produces: 无新接口，只加断言

- [ ] **Step 1: 写失败测试**

在 `plugins/dsh-sync/test/sync-mode.test.mjs` 追加：

```js
test('mirror 模式下 backupLayoutSpec 仍产出 backup/<实例ID>/ 布局', () => {
  const { syncSpec, backupLayoutSpec, defaultRoots } = __internals
  const roots = defaultRoots()
  const eff = { syncMode: 'mirror', syncSkills: true, syncSessions: false, syncSettings: true, syncPlugins: true }
  const spec = backupLayoutSpec(eff, roots, 'mach1')
  const tos = spec.flatMap(g => g.sources.map(s => s.to.split('\\').join('/')))
  for (const to of tos) {
    assert.ok(to.startsWith('backup/mach1/'), `备份布局必须以 backup/mach1/ 开头，实际：${to}`)
  }
})

test('mirror 模式下 syncSpec 的技能路径是共享的（非 backup/ 前缀）', () => {
  const { syncSpec, defaultRoots } = __internals
  const eff = { syncMode: 'mirror', syncSkills: true, syncSessions: false, syncSettings: false, syncPlugins: false }
  const spec = syncSpec(eff, defaultRoots(), 'mach1')
  const tos = spec.flatMap(g => g.sources.map(s => s.to.split('\\').join('/')))
  assert.ok(tos.includes('skills/dsh'), `技能应走共享路径，实际：${JSON.stringify(tos)}`)
})

test('backup 模式下 syncSpec 的技能路径带 backup/ 前缀', () => {
  const { syncSpec, defaultRoots } = __internals
  const eff = { syncMode: 'backup', syncSkills: true, syncSessions: false, syncSettings: false, syncPlugins: false }
  const spec = syncSpec(eff, defaultRoots(), 'mach1')
  const tos = spec.flatMap(g => g.sources.map(s => s.to.split('\\').join('/')))
  assert.ok(tos.every(t => t.startsWith('backup/mach1/')))
})
```

- [ ] **Step 2: 运行测试，确认它揭示真问题**

Run: `npm test`
Expected: 前两项 PASS（Task 2 的设计已保证）。若有 FAIL，说明 `resolveStrategies` 的优先级写反了 —— 回 Task 2 Step 3 修正，不要改测试。

- [ ] **Step 3: 提交**

```bash
git add plugins/dsh-sync/test/sync-mode.test.mjs
git commit -m "test(dsh-sync): 锁定 mirror 模式下备份布局与共享路径互不串台"
```

---

## Task 6: 删除传播 —— 把「远端删除」镜像到 live

**Files:**
- Modify: `plugins/dsh-sync/src/index.js`（`reconcileRemote` 约 1283-1332 行的循环）
- Test: `plugins/dsh-sync/test/remote-delete.test.mjs`

**Interfaces:**
- Consumes: `strategyForPath`、`resolveLivePath`、`gitExec`、`gitShowBuf`、`atomicWriteFile`
- Produces: `reconcileRemote` 的返回值不变（`applied` / `bothModified` / `remoteDeleted` / `localKept` ...），但 `applied` 现在**包含被删除的路径**。

- [ ] **Step 1: 写失败的测试**

创建 `plugins/dsh-sync/test/remote-delete.test.mjs`。这里用真实临时目录 + stub 掉 git（`reconcileRemote` 通过 `binary` 参数调 `gitExec`，测试传一个假 binary 名并在 stub 里拦截）：

```js
// 删除传播：远端删除哪些文件会被镜像到 live。
//
// reconcileRemote 依赖闭包里的 gitExec / gitShowBuf / resolveSyncBase。测试用
// Task 6 Step 3 新增的 __setReconcileStubs 注入纯内存替身，因此不需要真实 bare repo
// —— 只需要一个存在 .git 的目录（函数入口会 access 它）与一棵真实 live 技能树。
import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { __internals } = require('../src/index.js')

/** 内存 git 替身：remoteFiles 是远端 main 的树，baseFiles 是基线提交的树。
 *  远端删掉 = 在 baseFiles 里有、在 remoteFiles 里没有。 */
function makeStubs({ remoteFiles = {}, baseFiles = {} }) {
  const calls = []
  return {
    calls,
    gitExec: async (_bin, args) => {
      calls.push(args.join(' '))
      const joined = args.join(' ')
      if (joined.startsWith('rev-parse --verify FETCH_HEAD')) return 'deadbeef'
      if (joined.startsWith('rev-parse HEAD')) return 'cafe'
      if (joined.startsWith('diff --name-only')) {
        const all = new Set([...Object.keys(remoteFiles), ...Object.keys(baseFiles)])
        return [...all].join('\n')
      }
      if (joined.startsWith('diff --name-only') || joined.startsWith('reset') || joined.startsWith('checkout')) return ''
      return ''
    },
    gitShowBuf: async (_bin, rev) => {
      const p = rev.slice(rev.indexOf(':') + 1)
      if (p in remoteFiles) return Buffer.from(remoteFiles[p])
      if (p in baseFiles) return Buffer.from(baseFiles[p])
      throw new Error('not found: ' + p)
    },
    baseCommit: 'abc',
  }
}

/** 临时 live 技能树 + 一个带 .git 的假影子仓库目录。 */
async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsync-rd-'))
  const skills = path.join(dir, 'skills')
  await fs.mkdir(path.join(skills, 'dsh', 'feed'), { recursive: true })
  await fs.mkdir(path.join(dir, 'repo', '.git'), { recursive: true })
  const roots = {
    dshSkills: skills,
    agentsSkills: path.join(dir, 'none-agents'),
    homeAgentsSkills: path.join(dir, 'none-home-agents'),
    agentsLock: path.join(dir, 'none-lock.json'),
    sessions: path.join(dir, 'none-sessions'),
    settingsFile: path.join(dir, 'none-settings.yaml'),
    profiles: path.join(dir, 'none-profiles'),
  }
  const ctxOf = (overrides = {}) => ({
    repoDir: path.join(dir, 'repo'),
    state: { instanceId: 'mach1', lastSyncedCommit: 'abc', pendingBoth: {} },
    logger: { warn() {}, info() {} },
    roots,
    ...overrides,
  })
  const effOf = (overrides = {}) => ({
    repoUrl: '/tmp/x', branch: 'main', gitBinary: 'git',
    syncSkills: true, syncSessions: false, syncSettings: false, syncPlugins: false,
    syncMode: 'mirror', allowRemoteDelete: true,
    skillsStrategy: 'union', sessionsStrategy: 'backup',
    settingsStrategy: 'backup', pluginsStrategy: 'backup',
    ...overrides,
  })
  return { dir, skills, ctxOf, effOf }
}

const SKILL = 'skills/dsh/feed/SKILL.md'

test('未改动的文件：远端删除 → 本地也删除', async () => {
  const { ctxOf, effOf, skills } = await setup()
  const live = path.join(skills, 'dsh', 'feed', 'SKILL.md')
  await fs.writeFile(live, 'v1\n')
  __internals.__setReconcileStubs(makeStubs({ remoteFiles: {}, baseFiles: { [SKILL]: 'v1\n' } }))
  try {
    const ctx = ctxOf()
    const res = await __internals.reconcileRemote('git', effOf(), ctx)
    assert.equal(await fs.stat(live).then(() => 'exists').catch(() => 'gone'), 'gone', '未改动的文件应被删除')
    assert.ok(res.applied.includes(SKILL))
    assert.equal(res.remoteDeleted.length, 0)
  } finally { __internals.__setReconcileStubs(null) }
})

test('本地改过的文件：远端删除 → 保留 live，计入 bothModified', async () => {
  const { ctxOf, effOf, skills } = await setup()
  const live = path.join(skills, 'dsh', 'feed', 'SKILL.md')
  await fs.writeFile(live, 'local edit\n')
  __internals.__setReconcileStubs(makeStubs({ remoteFiles: {}, baseFiles: { [SKILL]: 'v1\n' } }))
  try {
    const res = await __internals.reconcileRemote('git', effOf(), ctxOf())
    assert.equal(await fs.readFile(live, 'utf8'), 'local edit\n')
    assert.equal(res.bothModified.length, 1)
    assert.equal(res.bothModified[0].shadowPath, SKILL)
  } finally { __internals.__setReconcileStubs(null) }
})

test('allowRemoteDelete=false：一律不删', async () => {
  const { ctxOf, effOf, skills } = await setup()
  const live = path.join(skills, 'dsh', 'feed', 'SKILL.md')
  await fs.writeFile(live, 'v1\n')
  __internals.__setReconcileStubs(makeStubs({ remoteFiles: {}, baseFiles: { [SKILL]: 'v1\n' } }))
  try {
    const res = await __internals.reconcileRemote('git', effOf({ allowRemoteDelete: false }), ctxOf())
    assert.equal(await fs.readFile(live, 'utf8'), 'v1\n')
    assert.equal(res.remoteDeleted.length, 1)
  } finally { __internals.__setReconcileStubs(null) }
})

test('非 union 组（backup 模式）：远端删除不镜像', async () => {
  const { ctxOf, effOf, skills } = await setup()
  const live = path.join(skills, 'dsh', 'feed', 'SKILL.md')
  await fs.writeFile(live, 'v1\n')
  __internals.__setReconcileStubs(makeStubs({ remoteFiles: {}, baseFiles: { [SKILL]: 'v1\n' } }))
  try {
    await __internals.reconcileRemote('git', effOf({ syncMode: 'backup', skillsStrategy: 'backup' }), ctxOf())
    assert.equal(await fs.readFile(live, 'utf8'), 'v1\n')
  } finally { __internals.__setReconcileStubs(null) }
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — `__setReconcileStubs is not a function`（第 1、2 项），第 3、4 项因同样原因失败。

- [ ] **Step 3: 加测试注入点**

在 `plugins/dsh-sync/src/index.js` 的 `reconcileRemote` 之前插入：

```js
// 测试注入点：reconcileRemote 依赖 gitExec / gitShowBuf 两个闭包函数。离线测试
// 用 __setReconcileStubs 把它们换成纯内存替身，避免为每个分支都起一个真实 bare repo。
let reconcileStubs = null
function __setReconcileStubs(stubs) { reconcileStubs = stubs || null }
```

在 `reconcileRemote` 函数体第一行（`const fs = require('node:fs')` 之前）插入：

```js
  const git = reconcileStubs ? reconcileStubs.gitExec : gitExec
  const showBuf = reconcileStubs ? reconcileStubs.gitShowBuf : gitShowBuf
```

然后把 `reconcileRemote` 内所有 `gitExec(binary, [...]` 调用替换为 `git(binary, [...]`，所有 `gitShowBuf(binary, ...)` 替换为 `showBuf(binary, ...)`。**只改这个函数体内的调用**，不要动函数外的。

但 `resolveSyncBase()` 是另一个函数，它也调 `gitExec`。为了让测试可控，`reconcileRemote` 里的这行：

```js
  const syncBase = await resolveSyncBase(binary, repoDir, prevSynced, logger)
```

改为：

```js
  const syncBase = reconcileStubs
    ? (prevSynced ? reconcileStubs.baseCommit || prevSynced : null)
    : await resolveSyncBase(binary, repoDir, prevSynced, logger)
```

并在 `__internals` 里加 `__setReconcileStubs,`。

- [ ] **Step 4: 运行测试，确认现在能跑到真正的删除逻辑并失败**

Run: `npm test`
Expected: FAIL — 第 1 项「未改动的文件应被删除」失败（文件还在），说明注入点通了、行为还没改。这正是我们要的门槛。

- [ ] **Step 5: 实现删除传播**

把 `reconcileRemote` 里处理「远端已删除」的那段（约 1294-1300 行）：

```js
    if (remoteBuf === null) {
      // 远端为准：远端删了本地也删；其余策略远端删除从不镜像
      if (strategy === 'remote') { try { await fsP.unlink(livePath); applied.push(p) } catch {} }
      else remoteDeleted.push(p)
      delete state.pendingBoth[p]
      continue
    }
```

替换为：

```js
    if (remoteBuf === null) {
      // 远端删除的镜像判定（spec §4.2，按顺序命中第一条）：
      //   1 非 union 组            → 不是它的业务
      //   2 allowRemoteDelete 关闭 → 保持旧行为（只增不删）
      //   3 无共同基线             → 判断不了是否本地也动过，不删
      //   4 本地改过               → 保留 local，进 bothModified 交给 AI/人工
      //   5 本地未改动             → 删除 live
      // 曾经的 bug：远端删除一律只记 remoteDeleted 而不动 live，本机那份会在下一次
      // runPush 的 mirrorLiveToShadow 里被重新铺回影子仓库 → 删除被自己「复活」。
      const deletable = strategy === 'union' && eff.allowRemoteDelete !== false && !noCommonBase
      if (strategy === 'remote') {
        try { await fsP.unlink(livePath); applied.push(p) } catch {}
      } else if (deletable) {
        const fileBase = state.pendingBoth[p] || diffBase
        let baseBuf = null
        try { baseBuf = await showBuf(binary, `${fileBase}:${p}`, repoDir) } catch { baseBuf = Buffer.alloc(0) }
        let liveBuf = null
        try { liveBuf = await fsP.readFile(livePath) } catch {}
        const untouched = liveBuf === null ? false : Buffer.compare(liveBuf, baseBuf) === 0
        if (untouched) {
          try { await fsP.unlink(livePath); applied.push(p) } catch {}
        } else {
          if (!state.pendingBoth[p]) state.pendingBoth[p] = fileBase
          bothModified.push({ shadowPath: p, livePath, baseCommit: state.pendingBoth[p] })
          continue
        }
      } else {
        remoteDeleted.push(p)
      }
      delete state.pendingBoth[p]
      continue
    }
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`
Expected: PASS — `remote-delete.test.mjs` 4 项全绿，合计 25 项。

- [ ] **Step 7: 提交**

```bash
git add plugins/dsh-sync/src/index.js plugins/dsh-sync/test/remote-delete.test.mjs
git commit -m "fix(dsh-sync): union 组镜像远端删除，修复删除被本机推回的乒乓"
```

---

## Task 7: 删除传播的日志与状态可观测

删除是危险动作，必须在 `lastResult` 里留痕，否则用户只看到「文件没了」。

**Files:**
- Modify: `plugins/dsh-sync/src/index.js`（`reconcileRemote` 返回值 + `runSync` 的 `result` 汇总，约 2436-2497 行）
- Test: `plugins/dsh-sync/test/remote-delete.test.mjs`

**Interfaces:**
- Consumes: Task 6 的 `reconcileRemote`
- Produces: `reconcileRemote` 返回值新增 `deleted: string[]`；`status.lastResult.reconcile.deleted` 可见。

- [ ] **Step 1: 写失败测试**

在 `plugins/dsh-sync/test/remote-delete.test.mjs` 追加：

```js
test('reconcile 返回值带 deleted 名单，供状态条展示', async () => {
  const { ctxOf, effOf, skills } = await setup()
  await fs.writeFile(path.join(skills, 'dsh', 'feed', 'SKILL.md'), 'v1\n')
  __internals.__setReconcileStubs(makeStubs({ remoteFiles: {}, baseFiles: { [SKILL]: 'v1\n' } }))
  try {
    const res = await __internals.reconcileRemote('git', effOf(), ctxOf())
    assert.deepEqual(res.deleted, [SKILL])
  } finally { __internals.__setReconcileStubs(null) }
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — `res.deleted` 是 `undefined`

- [ ] **Step 3: 加 deleted 累积与返回**

在 `reconcileRemote` 的 `const remoteDeleted = []` 附近加：

```js
  const deleted = []        // 因远端删除而被删掉的 live 路径（删除传播）
```

在 Step 5 那段删除分支里，两处 `applied.push(p)` 中的**第二处**（`else if (deletable)` 内层 `if (untouched)`）改为同时记录：

```js
        if (untouched) {
          try { await fsP.unlink(livePath); applied.push(p); deleted.push(p) } catch {}
        } else {
```

在 `reconcileRemote` 的返回对象里加 `deleted,`：

```js
  return {
    reconciled: true, applied, bothModified, remoteDeleted, localKept, deleted, changed: changed.length,
```

- [ ] **Step 4: 在 lastResult 里透出**

在 `runSync` 的 `result.reconcile = await reconcileRemote(...)` 之后、`const fresh = ...` 之前加一行日志：

```js
            if (result.reconcile && Array.isArray(result.reconcile.deleted) && result.reconcile.deleted.length > 0) {
              ctx.logger.info(`dsh-sync: 远端删除已镜像到本地 ${result.reconcile.deleted.length} 个文件`)
            }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`
Expected: PASS — 合计 26 项。

- [ ] **Step 6: 提交**

```bash
git add plugins/dsh-sync/src/index.js plugins/dsh-sync/test/remote-delete.test.mjs
git commit -m "feat(dsh-sync): reconcile 返回值与日志透出删除传播结果"
```

---

## Task 8: 客户端 —— 同步模式单选卡片与折叠矩阵

**Files:**
- Modify: `plugins/dsh-sync/client/index.js`（中文 i18n 约 115-125 行、英文 i18n 约 265-275 行、`SettingsSection` 的 `g`/`gs` state 约 805-806 行、`refresh()` 回填约 848-849 行、`groupCard` 渲染约 1038-1043 行）

**Interfaces:**
- Consumes: `status.syncMode`、`status.strategies`、`status.allowRemoteDelete`（Task 4 新增）
- Produces: 表单新增 `syncMode` / `allowRemoteDelete` 两个字段随保存提交

- [ ] **Step 1: 加中英文案**

在中文表 `togglePlugins: '插件 plugins',` 之后插入：

```js
  syncModeTitle: '同步模式',
  syncModeMirror: '镜像同步（推荐）',
  syncModeMirrorHint: '两台机器保持一致：技能双向同步，设置 / 会话 / 插件清单按机器隔离',
  syncModeBackup: '仅备份',
  syncModeBackupHint: '各机独立存档，可从「浏览远端」或快照整机恢复',
  syncModeCustom: '自定义',
  syncModeCustomHint: '逐类指定策略（原有 4×4 矩阵）',
  syncModeCollapsedHint: '镜像同步下：技能跨机一致；设置 / 会话 / 插件清单留在这台机器。切到「自定义」可逐类调整。',
  backupModeCollapsedHint: '仅备份下：所有类别各存各的，本地永不被覆盖。切到「自定义」可逐类调整。',
  allowDeleteLabel: '镜像远端删除',
  allowDeleteHint: '开启后：别的机器删掉的技能，本机同步时也会删掉（本机改过的文件除外）。关闭则只增不删。',
```

在英文表 `togglePlugins: 'Plugins',` 之后插入对应英文：

```js
  syncModeTitle: 'Sync mode',
  syncModeMirror: 'Mirror (recommended)',
  syncModeMirrorHint: 'Keep machines in step: skills sync both ways; settings / sessions / plugin manifests stay per-machine',
  syncModeBackup: 'Backup only',
  syncModeBackupHint: 'Each machine stores its own copy; restore a whole machine from Browse remote or a snapshot',
  syncModeCustom: 'Custom',
  syncModeCustomHint: 'Pick a strategy per category (the original 4×4 matrix)',
  syncModeCollapsedHint: 'Under Mirror: skills are shared across machines; settings / sessions / plugin manifests stay on this machine. Switch to Custom to tune per category.',
  backupModeCollapsedHint: 'Under Backup only: every category is stored per machine and never read back over. Switch to Custom to tune per category.',
  allowDeleteLabel: 'Mirror remote deletions',
  allowDeleteHint: 'On: a skill deleted on another machine is deleted here too on sync (unless you edited it locally). Off: adds only, never deletes.',
```

- [ ] **Step 2: 加 state 与回填**

在 `const [gs, setGs] = useState({ skills: 'union', sessions: 'backup', settings: 'backup', plugins: 'backup' })` 之后插入：

```js
  const [syncMode, setSyncMode] = useState('mirror')
  const [allowRemoteDelete, setAllowRemoteDelete] = useState(true)
```

在 `refresh()` 里 `if (d.strategies) setGs(d.strategies)` 之后插入：

```js
      if (d.syncMode) setSyncMode(d.syncMode)
      setAllowRemoteDelete(d.allowRemoteDelete !== false)
```

- [ ] **Step 3: 渲染模式卡片并折叠矩阵**

在 `groupCard` 定义之前插入模式卡片构造器：

```js
    const modeOption = (value, label, hint) => h('label', {
      key: value,
      className: 'sk-gcard' + (syncMode === value ? ' on' : ''),
      style: { cursor: 'pointer', display: 'block', marginBottom: 6 },
    },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      h('input', { type: 'radio', name: 'syncMode', value, checked: syncMode === value,
        onChange: () => { setSyncMode(value); dirtyRef.current = true } }),
      h('strong', { style: { fontWeight: 600 } }, label)),
    h('span', { className: 'sk-dir', style: { display: 'block', marginInlineStart: 24 } }, hint))
    const modeCard = h('div', { className: 'sk-section' },
      h('div', { className: 'sk-dir', style: { marginBottom: 6 } }, t('syncModeTitle')),
      modeOption('mirror', t('syncModeMirror'), t('syncModeMirrorHint')),
      modeOption('backup', t('syncModeBackup'), t('syncModeBackupHint')),
      modeOption('custom', t('syncModeCustom'), t('syncModeCustomHint')))
    const collapsedHint = h('div', { className: 'sk-dir', style: { padding: '4px 0' } },
      syncMode === 'backup' ? t('backupModeCollapsedHint') : t('syncModeCollapsedHint'))
```

- [ ] **Step 4: 接进通用页签的渲染**

找到通用页签 `generalEl` 里渲染类别卡片的位置（`h(ButtonLite` 触发的保存区之前、`groupCard('skills', ...)` 系列所在的父节点）。把类别卡片那组外面包一层条件：

```js
      modeCard,
      syncMode === 'custom' ? h('div', null,
        h('div', { className: 'sk-dir', style: { marginBottom: 4 } }, t('groupHint')),
        ['skills', 'sessions', 'settings', 'plugins'].map(k => groupCard(k, t('toggle' + k[0].toUpperCase() + k.slice(1)))),
      ) : collapsedHint,
      syncMode === 'custom' ? null : h('label', { className: 'sk-toggle' + (allowRemoteDelete ? ' on' : ''), style: { alignSelf: 'flex-start' } },
        h('input', { type: 'checkbox', checked: allowRemoteDelete,
          onChange: e => { setAllowRemoteDelete(e.target.checked); dirtyRef.current = true } }),
        t('allowDeleteLabel')),
      syncMode === 'custom' ? null : h('span', { className: 'sk-dir', style: { display: 'block' } }, t('allowDeleteHint')),
```

（原有 `groupCard(...)` 的调用点被这组替换；`groupCard` 函数本身保留，`custom` 模式仍用它。）

- [ ] **Step 5: 随保存提交**

找到保存时构造请求体的地方（提交 `gs` 与 `g` 的位置），加入：

```js
      syncMode,
      allowRemoteDelete,
```

- [ ] **Step 6: 语法检查与构建**

```bash
cd plugins/dsh-sync
npm run check
npm run build:client
```

Expected: `check` 无输出、`build:client` 打印 `built .../client/bundle.js`。

- [ ] **Step 7: 提交**

```bash
git add plugins/dsh-sync/client/index.js plugins/dsh-sync/client/bundle.js
git commit -m "feat(dsh-sync): 设置页增加同步模式单选与矩阵折叠"
```

---

## Task 9: 客户端 —— 同步状态条

**Files:**
- Modify: `plugins/dsh-sync/client/index.js`（新增纯函数 `syncStateOf` + 顶部渲染）
- Test: `plugins/dsh-sync/test/client-sync-state.test.mjs`

**Interfaces:**
- Consumes: `status.lastResult`（现有）、`status.pendingConflict`
- Produces: `syncStateOf(lastResult, pendingConflict) → { tone: 'ok'|'warn'|'err'|'idle', key: string, branch?: string, prNumber?: number }`，挂在 `client/index.js` 的导出上供测试。

- [ ] **Step 1: 写失败测试**

创建 `plugins/dsh-sync/test/client-sync-state.test.mjs`。`client/index.js` 是浏览器模块（依赖 `React` 全局），测试只取其中的纯函数 —— 用 `node:vm` 在注入 `React` 替身的沙箱里求值：

```js
// 状态条映射：lastResult → 一句话 + 动作。纯函数，不碰 DOM。
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = readFileSync(path.join(here, '..', 'client', 'index.js'), 'utf8')

function loadSyncStateOf() {
  const sandbox = {
    React: { createElement: () => null, useState: (v) => [v, () => {}], useEffect: () => {}, useRef: () => ({ current: null }), useMemo: (f) => f() },
    window: {}, document: {},
    console,
  }
  vm.createContext(sandbox)
  // client/index.js 是 bundle 源：末段有 module.exports / exports 赋值
  vm.runInContext(`var module = { exports: {} }; var exports = module.exports;\n${src}\n;globalThis.__out = module.exports`, sandbox)
  return sandbox.__out.syncStateOf
}

test('无 lastResult → 尚未同步', () => {
  const syncStateOf = loadSyncStateOf()
  assert.equal(syncStateOf(null).key, 'idle')
})

test('合并成功 → ok', () => {
  const syncStateOf = loadSyncStateOf()
  assert.equal(syncStateOf({ push: { pushed: true, merged: true, prNumber: 7 } }).tone, 'ok')
})

test('合并被拒 → warn 且带分支号', () => {
  const syncStateOf = loadSyncStateOf()
  const s = syncStateOf({ push: { pushed: true, prConflict: true, mergeRejected: true, prNumber: 9, reason: 'HTTP 405' } })
  assert.equal(s.tone, 'warn')
  assert.equal(s.key, 'mergeRejected')
  assert.equal(s.prNumber, 9)
})

test('创建 PR 失败 → warn', () => {
  const syncStateOf = loadSyncStateOf()
  assert.equal(syncStateOf({ push: { pushed: true, prFailed: true, reason: 'HTTP 400' } }).key, 'prFailed')
})

test('托管方不支持 PR → warn，提示手动合并', () => {
  const syncStateOf = loadSyncStateOf()
  assert.equal(syncStateOf({ push: { pushed: true, prSkipped: true, branch: 'sync/x/1' } }).key, 'prSkipped')
})

test('pushError → err', () => {
  const syncStateOf = loadSyncStateOf()
  assert.equal(syncStateOf({ pushError: 'boom' }).tone, 'err')
  assert.equal(syncStateOf({ pullError: 'boom' }).tone, 'err')
  assert.equal(syncStateOf({ reconcileError: 'boom' }).tone, 'err')
})

test('无变更可提交 → ok', () => {
  const syncStateOf = loadSyncStateOf()
  assert.equal(syncStateOf({ push: { pushed: false, nothingToCommit: true } }).key, 'upToDate')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — `syncStateOf is not a function`

- [ ] **Step 3: 实现纯函数**

在 `client/index.js` 里（组件定义之前、`API` 常量之后）插入：

```js
/** lastResult → { tone, key, branch, prNumber }。
 *  纯函数：把同步循环的七种结局翻译成状态条的一行话与可用动作。
 *  优先级：错误 > 合并被拒 > PR 失败 > 不支持 PR > 合并成功 > 无变更 > 未同步。 */
function syncStateOf(lastResult, pendingConflict) {
  if (!lastResult || typeof lastResult !== 'object') return { tone: 'idle', key: 'never' }
  for (const k of ['pushError', 'pullError', 'reconcileError']) {
    if (lastResult[k]) return { tone: 'err', key: 'syncError', detail: String(lastResult[k]) }
  }
  const push = (lastResult.push && typeof lastResult.push === 'object') ? lastResult.push : null
  if (push) {
    if (push.mergeRejected) return { tone: 'warn', key: 'mergeRejected', prNumber: push.prNumber, detail: push.reason || '' }
    if (push.prFailed) return { tone: 'warn', key: 'prFailed', branch: push.branch, detail: push.reason || '' }
    if (push.prSkipped) return { tone: 'warn', key: 'prSkipped', branch: push.branch || '', detail: '' }
    if (push.merged) return { tone: 'ok', key: 'merged', prNumber: push.prNumber }
    if (push.nothingToCommit) return { tone: 'ok', key: 'upToDate' }
    if (push.prConflict) return { tone: 'warn', key: 'prConflict', prNumber: push.prNumber, detail: push.message || '' }
  }
  if (pendingConflict) return { tone: 'warn', key: 'prConflict', prNumber: pendingConflict.prNumber, branch: pendingConflict.branch || '' }
  return { tone: 'ok', key: 'synced' }
}
```

在 `client/index.js` 的 `module.exports` / `exports` 赋值处（文件末尾）加入 `syncStateOf`：

```js
exports.syncStateOf = syncStateOf
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS — `client-sync-state.test.mjs` 7 项，合计 33 项。

- [ ] **Step 5: 渲染状态条**

在 `SettingsSection` 顶部渲染区（状态错误行之后）插入：

```js
    const syncState = syncStateOf(status && status.lastResult, status && status.pendingConflict)
    const syncStateText = (() => {
      const d = status && status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : ''
      switch (syncState.key) {
        case 'never': return t('syncNever')
        case 'upToDate': return t('syncUpToDate') + ' · ' + d
        case 'merged': return t('syncMerged', { n: syncState.prNumber || '' }) + ' · ' + d
        case 'syncError': return t('syncErrorPrefix') + syncState.detail
        case 'mergeRejected': return t('syncMergeRejected') + (syncState.detail ? '：' + syncState.detail : '')
        case 'prFailed': return t('syncPrFailed') + (syncState.detail ? '：' + syncState.detail : '')
        case 'prSkipped': return t('syncPrSkipped', { branch: syncState.branch || status?.branch || 'main' })
        case 'prConflict': return t('syncPrConflict', { n: syncState.prNumber || '' })
        default: return t('syncMerged', { n: '' }) + ' · ' + d
      }
    })()
    const syncBarTone = syncState.tone === 'err' ? 'danger' : (syncState.tone === 'warn' ? 'warning' : undefined)
    const syncBar = h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' } },
      Tag ? h(Tag, { tone: syncBarTone }, syncStateText) : h('span', { className: 'sk-dir' }, syncStateText),
      (syncState.key === 'mergeRejected' || syncState.key === 'prConflict') ? h(ButtonLite, { small: true, onClick: () => doPrune() }, t('pruneBranches')) : null)
```

- [ ] **Step 6: 补文案与动作**

中英文各加：

```js
  syncNever: '尚未同步',
  syncUpToDate: '已是最新',
  syncMerged: '已同步（PR #{n}）',
  syncErrorPrefix: '同步出错：',
  syncMergeRejected: '分支已推送，合并被拒',
  syncPrFailed: '分支已推送，创建 PR 失败',
  syncPrSkipped: '已推送分支；该托管方需手动合并到 {branch}',
  syncPrConflict: 'PR #{n} 处于冲突状态，需要处理',
  pruneBranches: '清理遗留分支',
```

```js
  syncNever: 'Not synced yet',
  syncUpToDate: 'Up to date',
  syncMerged: 'Synced (PR #{n})',
  syncErrorPrefix: 'Sync error: ',
  syncMergeRejected: 'Branch pushed, merge rejected',
  syncPrFailed: 'Branch pushed, PR creation failed',
  syncPrSkipped: 'Branch pushed; this host requires a manual merge into {branch}',
  syncPrConflict: 'PR #{n} has conflicts and needs attention',
  pruneBranches: 'Prune leftover branches',
```

`doPrune()` 实现（调现有端点，失败弹 toast）：

```js
  const doPrune = async () => {
    try {
      const r = await fetch(API + '/prune-branches', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { onToast(d.error || ('HTTP ' + r.status)); return }
      onToast(t('pruneDone', { n: (d.deleted || []).length }))
      refresh()
    } catch (e) { onToast(String(e && e.message || e)) }
  }
```

文案：`pruneDone: '已清理 {n} 个遗留分支'` / `pruneDone: 'Pruned {n} leftover branches'`。

- [ ] **Step 7: 构建并检查**

```bash
cd plugins/dsh-sync
npm run check
npm run build:client
```

- [ ] **Step 8: 提交**

```bash
git add plugins/dsh-sync/client/index.js plugins/dsh-sync/client/bundle.js plugins/dsh-sync/test/client-sync-state.test.mjs
git commit -m "feat(dsh-sync): 同步状态条把各结局翻成人话并给出动作"
```

---

## Task 10: 页面真机验证 + bundle 一致性

**Files:**
- Modify: 无（只验证）

- [ ] **Step 1: 确认 bundle 由最新源码生成**

```bash
cd plugins/dsh-sync
npm run build:client
git status --porcelain client/bundle.js
```

Expected: 无输出（说明 bundle 已是最新）。若有输出，说明上一步漏了构建。

- [ ] **Step 2: 全量测试**

Run: `npm test`
Expected: PASS，33 项全绿。

- [ ] **Step 3: 在运行中的 Web UI 里人工核对**

打开 `http://127.0.0.1:55345` → 设置 → dsh-sync → 通用页签，确认：

1. 顶部出现「同步模式」三选一，默认选中「镜像同步（推荐）」；
2. 选「镜像同步」时，4 个类别开关与下拉框**折叠隐藏**，只显示一行灰字说明；
3. 切到「自定义」后矩阵出现，四个下拉框值与之前一致；
4. 顶部状态条显示当前同步结局；
5. 保存后刷新页面，模式选择**保持**（验证 Task 4 的落盘链路）。

- [ ] **Step 4: 提交（如有 bundle 重新生成）**

```bash
git add plugins/dsh-sync/client/bundle.js
git commit -m "build(dsh-sync): 重建 client bundle"
```

---

## Task 11: README 更新

**Files:**
- Modify: `plugins/dsh-sync/README.md`

- [ ] **Step 1: 改写「使用」章节**

把现有的 5 步用法（约 94-101 行）替换为：

```markdown
## 使用

1. 到 GitCode（默认）或 GitHub / GitLab / Gitee 创建一个**私有**仓库（插件不会代建）
2. 打开 Web UI → **设置页 → dsh-sync → Git 页签**，点选「仓库托管方」，填仓库地址与 access token，保存
3. 回到**通用页签**，在「同步模式」里选一档：
   - **镜像同步（推荐）**：技能跨机双向同步；设置 / 会话 / 插件清单按机器隔离，可用「浏览远端」或快照整机恢复
   - **仅备份**：各机独立存档
   - **自定义**：逐类指定策略（备份 / 并集 / 覆盖·远端为准 / 覆盖·本地为准）
4. 两台机器填**同一个私有仓库**，各自保存即可；之后每次同步，本机变更以 PR 形式提交并自动合并
5. 顶部状态条会显示最近一次同步的结局；出现「合并被拒」时可直接点「清理遗留分支」
```

- [ ] **Step 2: 追加更新日志小节**

在 `## 更新日志（0.4.3 → 0.4.10）` 之前插入：

```markdown
## 同步模式（0.4.13）

- 新增 **同步模式** 三选一（镜像同步 / 仅备份 / 自定义），把原来「4 个类别 × 4 个策略」的矩阵折叠成一个单选；四个 `*Strategy` 键保留为「自定义」模式的载体。
- **老用户行为不变**：只要曾经显式设置过任意一个策略，升级后自动归入「自定义」，四个键原样保留。全新安装默认「镜像同步」。
- 修复**删除不同步**：之前 A 机器删掉的技能会被 B 机器在下一次推送时重新复活，两台来回打；现在 union 类别的远端删除会镜像到本机（本机改过的文件除外），可用「镜像远端删除」开关关闭。
- 新增**同步状态条**：把「已合并 / 合并被拒 / PR 创建失败 / 托管方不支持 PR / 同步出错」翻成一句话，并给出「清理遗留分支」动作。
- 默认值不变：镜像同步 = 技能并集 + 其余三类按机器隔离。
```

- [ ] **Step 3: 提交**

```bash
git add plugins/dsh-sync/README.md
git commit -m "docs(dsh-sync): 使用章节改为「填仓库 → 选模式 → 保存」，补同步模式更新日志"
```

---

## Self-Review 记录

**1. Spec 覆盖检查**

| Spec 章节 | 对应任务 |
|---|---|
| §3.1 新键 `syncMode`/`allowRemoteDelete` | Task 2（默认值）、Task 2 Step 5（schema） |
| §3.2 `resolveStrategies` 纯函数 | Task 2 |
| §3.2 策略读取统一走它（含 `backupLayoutSpec` 保护） | Task 2 Step 4 + Task 5 守门测试 |
| §3.3 `migrateSyncMode` 迁移 | Task 3 |
| §3.4 PUT 校验与展开 | Task 4 |
| §4 删除传播五分支 | Task 6 + Task 7（可观测） |
| §5.1 模式卡片 + 折叠矩阵 | Task 8 |
| §5.2 状态条七种形态 | Task 9 |
| §5.2 清理遗留分支动作 | Task 9 Step 6 |
| §7 测试与验收 | Task 1（地基）、Task 2–9（离线）、Task 10（真机） |
| README | Task 11 |

无遗漏。说明一处与 spec 的行为对齐：「重试合并」在 spec §5.2 里与「清理遗留分支」并列。本计划 Task 9 只实现后者——因为前者没有现成端点：`POST /dsh-sync/api/conflict/run` 需要先构造冲突工作树（`prepareConflictTree`），不是「重试一次合并」的语义。状态条对 `mergeRejected` 给出的动作因此是**清理遗留分支**，并把 PR 号与拒绝原因直接显示出来，用户可去仓库网页端处理。这是 spec 与本计划的一处**有意的收窄**，若要补齐需先设计一个 `/api/merge/retry` 端点（下一轮再做，不在本次范围）。

**2. 占位符扫描**：无 TBD / TODO /「类似 Task N」。每个代码步骤都给了可直接粘贴的内容。

**3. 类型一致性**：`resolveStrategies(eff) → {skillsStrategy, sessionsStrategy, settingsStrategy, pluginsStrategy}` 在 Task 2 定义、Task 2 Step 4 与 Task 5 消费；`migrateSyncMode(merged, sources) → string` 在 Task 3 定义与消费；`applySyncModePatch(body, patch, ignored) → patch` 在 Task 4 定义与消费；`syncStateOf(lastResult, pendingConflict) → {tone,key,...}` 在 Task 9 定义与消费。`STRATEGY_KEYS` 在 Task 2 定义，Task 3/4 使用，命名一致。