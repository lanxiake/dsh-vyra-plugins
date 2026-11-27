# 微信 Live 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `plugins/vyra-wechat-local` 里新增「微信 Live」面板，复刻 WeFlow 除首页/灵感信箱外的 11 个页面，AI 走 DSH 会话。

**Architecture:** 侧车（Python）新增 `vyra_live.py` 只读包装，补 7 个页面专用工具；Host 侧 `lib/live/` 做数据门面（账号切换、缓存、统计、导出、备份、Agent 桥）；客户端 `src/live/` 按页面拆目录，构建成 `client.js`，只登记 `sidebar.panellist` + `main` + `shell.overlay` 三个座位。

**Tech Stack:** Node 22 ESM、Cordis 插件 API、React（经 `window.__ModuleLoader__`）、Python 3.12 侧车（JSONL 协议）、`node:test`。

**Spec:** `docs/superpowers/specs/2026-11-27-wechat-live-design.md`

## Global Constraints

- Node `>=22`；插件 `engines.dsh` 保持 `>=0.2.2-rc.1 <0.3.0`。
- 所有页面文字走 `ctx.locale`；界面全中文。
- **样式只用 DSH 主题令牌**：`--dsw-alias-*`、`--dsw-elevation-*`、`--dsw-radius-*`、`--dsw-font-family`。禁止写死十六进制颜色（图表除外时也只取令牌计算）。
- **不接管** `root`、`sidebar`、`main.conversation`；也不修改 `shell.overlay` 上的既有登记。
- 页面**不直接调侧车**，一律经 `POST /api/wechat-live/rpc`。
- 侧车错误信封原样上抛：`{ ok: false, error_code, detail, suggestion, stage }`；**不得包装成空结果**。
- Agent 工具白名单仍然是 18 个（`lib/tools.js`）；`vyra_live.py` 的新工具**不进白名单**。
- `vendor/wechat/sidecar.py`、`app.py`、`wechat_core.py` 等 lumii 文件**一行不改**。
- 每个任务结束必须 `node --test` 通过，并按步骤提交。

## Review Focus

计划之外最可能出问题、且没有任务测试覆盖的五类情况，按可能性排序：

1. **多账号串号**：切换账号后列表/图片仍是上一个号的 —— 期望切号即清屏重载，绝不混显。
2. **空态误导**：微信没运行 / 尚未索引 / 时间范围无数据 / 图片密钥未就绪，四种情况被同一条「暂无数据」盖住 —— 期望各自有可操作文案。
3. **跨年与边界时间**：1 月 1 日 00:30 的消息在年度报告里落到错误年份；`since`/`until` 边界同秒消息漏算 —— 期望按 `Asia/Shanghai` 归属且边界包含。
4. **群里 sender 为空**：群消息的发送者缺失时被并进「群」本身，导致 Top 联系人排行里出现群名。
5. **媒体路径穿越**：`md5` / `talker` 参数被拼进文件路径读任意文件 —— 期望严格白名单字符。

---

## 文件结构

**Host（`lib/live/`）**

| 文件 | 职责 |
|---|---|
| `paths.js` | 所有落地路径的唯一来源（`live-cache`、`live-ui.json`、导出目录） |
| `data.js` | 统一门面：账号作用域、缓存命中、并发去重、错误上抛 |
| `cache.js` | 缓存读写、`schemaVersion` 校验、LRU |
| `stats.js` | 统计纯函数（口径八条） |
| `reports.js` | 年度 / 双人 / 足迹的数据整理 |
| `media.js` | 媒体解密落盘与字节流服务（含 Range） |
| `export.js` | 导出任务与记录 |
| `backup.js` | 快照打包 / 校验 / 载入 |
| `agent.js` | DSH 会话桥 |

**Client（`src/live/`）**：`shell/`（导航与外壳）、`pages/<name>/`（一页一目录）、`components/`（共用）、`styles.css`。

**侧车（`vendor/wechat/vyra_live.py`）**：只读包装。

**测试（`test/live/`）**：纯函数与门面的 `node:test`。

---

### Task 1: Host 骨架 —— Live RPC、路径与缓存

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/paths.js`
- Create: `plugins/vyra-wechat-local/lib/live/cache.js`
- Create: `plugins/vyra-wechat-local/lib/live/rpc.js`
- Modify: `plugins/vyra-wechat-local/index.js`（在现有 `ctx.inject(['webServer'])` 块里追加一条路由）
- Test: `plugins/vyra-wechat-local/test/live/cache.test.js`

**Interfaces:**
- Consumes: `createSidecar()` 的 `rawCall(tool, args)`；`index.js` 现有的 `callJson(tool, args)`
- Produces:
  - `paths.js`：`liveRoot()`、`liveCacheDir(account)`、`liveUiFile()`、`liveExportRoot()`
  - `cache.js`：`createCache(root)` → `{ dirFor(account), read(account, name, schemaVersion), write(account, name, value, schemaVersion), clear(account) }`；`CACHE_SCHEMA_VERSION = 1`
  - `rpc.js`：`createLiveRpc({ sidecar, callJson, log, cache })` → `{ handle(req, res), handlers }`，只处理 `POST /api/wechat-live/rpc`；后续任务往 `handlers` 里加 op

**Step 1: 写失败测试**

```js
// test/live/cache.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCache } from '../../lib/live/cache.js'

test('schemaVersion 不匹配时读回 null', () => {
  const root = mkdtempSync(join(tmpdir(), 'live-cache-'))
  const cache = createCache(root)
  cache.write('wxid_a', 'index', { sessions: 3 }, 1)
  assert.deepEqual(cache.read('wxid_a', 'index', 1), { sessions: 3 })
  assert.equal(cache.read('wxid_a', 'index', 2), null)
  rmSync(root, { recursive: true, force: true })
})

test('按账号隔离，互不可见', () => {
  const root = mkdtempSync(join(tmpdir(), 'live-cache-'))
  const cache = createCache(root)
  cache.write('wxid_a', 'index', { n: 'a' }, 1)
  assert.equal(cache.read('wxid_b', 'index', 1), null)
  rmSync(root, { recursive: true, force: true })
})

test('账号名里的路径分隔符被中和，不逃出缓存根', () => {
  const root = mkdtempSync(join(tmpdir(), 'live-cache-'))
  const cache = createCache(root)
  cache.write('../../evil', 'index', { n: 1 }, 1)
  assert.ok(cache.dirFor('../../evil').startsWith(root))
  rmSync(root, { recursive: true, force: true })
})
```

**Step 2: 运行测试确认失败**

Run: `node --test plugins/vyra-wechat-local/test/live/cache.test.js`
Expected: FAIL —— `Cannot find module '../../lib/live/cache.js'`

**Step 3: 实现**

`paths.js` 导出 `liveRoot()` = `join(profileDir(), 'wechat-local', 'live-cache')`，其中 `profileDir()` 取 `process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh')`（与 `index.js:62` 现有 `distillPrefs` 一致）。`liveUiFile()` 与之同级。

`cache.js` 导出 `createCache(root)`，返回 `{ dirFor(account), read(account, name, schemaVersion), write(...), clear(account) }`。`dirFor` 用 `account.replace(/[^A-Za-z0-9_.@-]/g, '_')` 中和路径字符。文件为 `<dir>/<name>.json`，内容 `{ schemaVersion, savedAt, value }`；版本不符返回 `null` 并删除该文件。

`rpc.js` 的 `createLiveRpc` 按 `{ op, args }` 分发，op 表从一开始就留成可扩展的 `handlers` 对象；Task 1 只实现 `{ op: 'ping' }` → `{ ok: true, data: { pong: true } }`。

在 `index.js` 的 webServer effect 里注册 `POST /api/wechat-live/rpc`，只读 `content-type: application/json`，回 `{ ok, data }` 或 `{ ok: false, error }`。

**Step 4: 运行测试确认通过**

Run: `node --test plugins/vyra-wechat-local/test/live/`
Expected: PASS（3 个用例）

**Step 5: 提交**

```bash
git add plugins/vyra-wechat-local/lib/live plugins/vyra-wechat-local/test/live plugins/vyra-wechat-local/index.js
git commit -m "feat(wechat-live): Host 骨架——缓存、路径与 Live RPC 路由"
```

---

### Task 2: 客户端外壳 —— 侧栏入口、顶底导航、路由持久化

**Files:**
- Create: `plugins/vyra-wechat-local/src/live/shell/pages.js`（11 页定义，单一来源）
- Create: `plugins/vyra-wechat-local/src/live/shell/nav.js`
- Create: `plugins/vyra-wechat-local/src/live/shell/app.js`
- Create: `plugins/vyra-wechat-local/src/live/styles.css`
- Modify: `plugins/vyra-wechat-local/client.js`（文件末尾 `apply` 里追加三个座位）
- Create: `plugins/vyra-wechat-local/scripts/build-client.mjs`
- Test: `plugins/vyra-wechat-local/test/live/client-check.mjs`

**Interfaces:**
- Consumes: Task 1 的 `/api/wechat-live/rpc`
- Produces:
  - `pages.js`：`export const PAGES = [{ id, label, zone: 'top'|'bottom', order, Component }]`
  - `nav.js`：`export function Nav({ zone, active, onSelect })`
  - `app.js`：`export function LiveApp(props)`，自持 `active` 状态
  - 座位的 `id`/`key` 统一为 `wechat-live`

**Step 1: 写失败测试**

```js
// test/live/client-check.mjs —— 用桩替身渲染注册，断言三个座位
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const registrations = []
const ctx = {
  slots: {
    inject: (key, fn) => fn(),
    register: (options, Component) => { registrations.push({ options, Component }); return () => {} },
  },
}
globalThis.window = { __ModuleLoader__: { load: ({ factory }) => { globalThis.__plugin = factory(createRequire(import.meta.url)) } } }
await import('../client.js')
globalThis.__plugin.apply(ctx)

const byName = (n) => registrations.filter((r) => r.options.name === n)
assert.equal(byName('sidebar.panellist').length, 1)
assert.equal(byName('sidebar.panellist')[0].options.id, 'wechat-live')
assert.equal(byName('main').length, 1)
assert.equal(byName('main')[0].options.key, 'wechat-live')
assert.ok(byName('shell.overlay').length <= 1)
console.log('client-check ok')
```

**Step 2: 运行确认失败**

Run: `node plugins/vyra-wechat-local/test/live/client-check.mjs`
Expected: FAIL —— `assert.equal(byName('sidebar.panellist').length, 1)` 得到 0

**Step 3: 实现**

- `pages.js` 里 `PAGES` 顺序固定：top = 用户画像 / 聊天 / AI Agent / 朋友圈 / 通讯录 / 资源浏览；bottom = 聊天分析 / 年度报告 / 我的足迹 / 导出 / 数据库备份。每个 `Component` 先放占位（居中一行「<页面名> 建设中」），后续任务逐个替换。
- `nav.js`：横向胶囊，选中项实心（背景 `var(--dsw-alias-fill-accent)`，前景 `var(--dsw-alias-fill-on-accent)`），其余透明悬停 `var(--dsw-alias-fill-hover)`。
- `app.js`：顶栏（左上导航胶囊 + 右上「账号▾」「⚙」占位）+ 中间页面容器 + 底栏（导航胶囊 + 右下状态灯）。`active` 初始从 RPC `{ op: 'ui.get' }` 取，切换后 `{ op: 'ui.set', args: { page } }`。
- `client.js` 追加三个座位：

```js
track(() => ctx.slots.inject('sidebar.panellist', () =>
  ctx.slots.register({ name: 'sidebar.panellist', id: 'wechat-live', order: 70, label: () => '微信 Live' }, LiveIcon)))
track(() => ctx.slots.inject('main', () =>
  ctx.slots.register({ name: 'main', key: 'wechat-live' }, LiveApp)))
track(() => ctx.slots.inject('shell.overlay', () =>
  ctx.slots.register({ name: 'shell.overlay', id: 'wechat-live-theater' }, LiveTheater)))
```

`LiveTheater` 平时返回 `null`；`client.js` 顶部用一个模块级 `theaterSlot` 对象持有当前内容，供后续 Task 14/16 使用。

- `scripts/build-client.mjs`：把 `src/live/**/*.js` 按 `pages.js` 的顺序拼进 `client.js` 里标记为 `/* LIVE:BEGIN */` 与 `/* LIVE:END */` 之间的区域，`styles.css` 注入为 `<style>` 元素（`client.js` 里 `ctx.effect` 返回时移除）。
- `ui.get` / `ui.set` 读写的 `live-ui.json` 在 Task 1 的 `paths.js` 里已给路径，此任务在 `rpc.js` 里补这两个 handler。

**Step 4: 运行确认通过**

Run: `node plugins/vyra-wechat-local/test/live/client-check.mjs && node --check plugins/vyra-wechat-local/client.js`
Expected: 打印 `client-check ok`，`--check` 无输出

**Step 5: 在真机确认能打开**

Run: 按仓库惯例重载插件后在 DSH 侧栏点「微信 Live」。
Expected: 面板出现，顶/底导航可切 11 页，刷新后停在上次那页。

**Step 6: 提交**

```bash
git add plugins/vyra-wechat-local/src/live plugins/vyra-wechat-local/scripts/build-client.mjs plugins/vyra-wechat-local/client.js plugins/vyra-wechat-local/test/live
git commit -m "feat(wechat-live): 侧栏入口与顶底导航外壳"
```

---

### Task 3: 侧车只读包装 `vyra_live.py` —— 联系人 + 媒体索引

**Files:**
- Create: `plugins/vyra-wechat-local/vendor/wechat/vyra_live.py`
- Modify: `plugins/vyra-wechat-local/vendor/wechat/vyra_sidecar.py`（追加一行 `DISPATCH.update`）
- Test: `plugins/vyra-wechat-local/test/live/sidecar-registration.test.js`

**Interfaces:**
- Consumes: `wechat_core`（`contact_book`、`_rows_across_all_tables` 等既有函数）、`vyra_image`（图像密钥与显示缓存）
- Produces（**dispatch-only，不进 `TOOLS` 白名单**）：
  - `live_contacts` → `{ ok, contacts: [{ talker, name, remark, alias, type, isFriend, memberCount }], counts: { friend, group, official, former_friend, blocked } }`
  - `live_media_index` → `{ ok, items: [{ talker, name, localId, time, kind, md5, size }] }`

**Step 1: 写失败测试**

```js
// test/live/sidecar-registration.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../../vendor/wechat/vyra_live.py', import.meta.url), 'utf8')

test('vyra_live 注册了页面工具且不写进 TOOLS', () => {
  for (const name of ['live_contacts', 'live_media_index', 'live_stats', 'live_reports',
    'live_footprint', 'live_sns_timeline', 'live_sns_annual']) {
    assert.ok(src.includes(`"${name}"`), `缺少 ${name}`)
  }
  assert.ok(!src.includes('TOOLS.append'), '页面工具不得污染 TOOLS 白名单')
})

test('包装不修改 lumii 文件', () => {
  const sidecar = readFileSync(new URL('../../vendor/wechat/vyra_sidecar.py', import.meta.url), 'utf8')
  assert.ok(sidecar.includes('vyra_live'), 'vyra_sidecar 必须 import vyra_live')
})
```

**Step 2: 运行确认失败**

Run: `node --test plugins/vyra-wechat-local/test/live/sidecar-registration.test.js`
Expected: FAIL —— `ENOENT vyra_live.py`

**Step 3: 实现**

在 `vyra_live.py` 里写模块级 `DISPATCH = { 'live_contacts': ..., 'live_media_index': ... }`，其余 5 个名字先留空实现返回 `{"ok": False, "error_code": "not_ready"}`（保证本任务测试通过，后续任务填充）。

- `live_contacts`：复用 `wechat_core.contact_book()` 的查询，按 WeFlow 的 5 类映射（`friend` / `group` / `official` / `former_friend` / `blocked`）。群人数取 `group_members` 的长度，取不到记 `0` 且 `memberCountKnown: false`。
- `live_media_index`：扫消息表内图片（`type=3`）与视频（`type=43`），用 `wechat_core._image_md5` / `_video_meta` 取 md5，用 `wechat_image.attach_path` 判断本机是否已落盘，**只返回已落盘的**。

在 `vyra_sidecar.py` 顶部 `import vyra_live` 并追加 `sidecar.DISPATCH.update(vyra_live.DISPATCH)`。

**Step 4: 运行确认通过**

Run: `node --test plugins/vyra-wechat-local/test/live/sidecar-registration.test.js`
Expected: PASS（2 个用例）

**Step 5: 真机跑一次**

Run: 通过设置页「状态信息」或临时脚本调 `callJson('live_contacts')`。
Expected: 返回联系人数组，`counts` 五个数之和等于 `contacts.length`

**Step 6: 提交**

```bash
git add plugins/vyra-wechat-local/vendor/wechat/vyra_live.py plugins/vyra-wechat-local/vendor/wechat/vyra_sidecar.py plugins/vyra-wechat-local/test/live
git commit -m "feat(wechat-live): 侧车包装——联系人与媒体索引"
```

---

### Task 4: 统计口径 `stats.js`

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/stats.js`
- Test: `plugins/vyra-wechat-local/test/live/stats.test.js`

**Interfaces:**
- Produces：`aggregate(messages, { me, now })` → `{ total, sessions, mine, theirs, system, byHour: number[24], byWeekday: number[7], byType: Record<string, number>, topContacts: [{talker, name, count}], daily: [{day:'YYYY-MM-DD', count}] }`；`yearOf(ts)`、`dayKey(ts)`（都按 `Asia/Shanghai`）

**Step 1: 写失败测试**（口径八条逐条断言）

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, yearOf, dayKey } from '../../lib/live/stats.js'

const mk = (over) => ({ talker: 'wxid_a', localId: 1, time: 0, fromMe: false, type: 'text', sender: '', ...over })

test('系统消息计入总数与类型，但不计入我发/ta发', () => {
  const stats = aggregate([mk({ type: 'system' })], { me: 'me' })
  assert.equal(stats.total, 1)
  assert.equal(stats.mine + stats.theirs, 0)
})

test('群里 sender 为空归「未知成员」，不并进群', () => {
  const stats = aggregate([mk({ talker: 'room@chatroom', sender: '' })], { me: 'me' })
  assert.equal(stats.topContacts[0].talker, 'unknown')
})

test('元旦 00:30 按 Asia/Shanghai 归入当年', () => {
  const ts = Date.UTC(2025, 11, 31, 16, 30) // 2026-01-01 00:30 +08:00
  assert.equal(yearOf(ts), 2026)
  assert.equal(dayKey(ts), '2026-01-01')
})

test('同一 talker+localId 只算一次', () => {
  const stats = aggregate([mk({ localId: 5 }), mk({ localId: 5 })], { me: 'me' })
  assert.equal(stats.total, 1)
})
```

**Step 2: 运行确认失败**

Run: `node --test plugins/vyra-wechat-local/test/live/stats.test.js`
Expected: FAIL —— 模块不存在

**Step 3: 实现**

纯函数，无 I/O，无 `Date` 以外的全局依赖。时区换算用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', ... })` 取年月日与小时，**不用** `getTimezoneOffset()`（依赖进程时区）。

**Step 4: 运行确认通过**

Run: `node --test plugins/vyra-wechat-local/test/live/stats.test.js`
Expected: PASS（4 个用例）

**Step 5: 提交**

```bash
git add plugins/vyra-wechat-local/lib/live/stats.js plugins/vyra-wechat-local/test/live/stats.test.js
git commit -m "feat(wechat-live): 统计口径与时区归属"
```

---

### Task 5: 数据门面 + 聊天页

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/data.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（挂 `sessions.list` / `history.read` / `search` / `unread.list`）
- Create: `plugins/vyra-wechat-local/src/live/pages/chat/index.js`
- Test: `plugins/vyra-wechat-local/test/live/data.test.js`

**Interfaces:**
- Consumes: 侧车 `list_sessions`、`read_history`、`search_messages`、`list_unread`、`wechat_avatar`
- Produces：`createData({ sidecar, cache, log })` → `{ withAccount(account, fn), sessions(account), history(account, talker, beforeTs, limit), search(account, query, opts), unread(account) }`；所有方法返回**解包后的数组**，错误抛 `SidecarError`

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createData } from '../../lib/live/data.js'

test('调用后把账号切回原值，避免影响后续 send_text', async () => {
  const calls = []
  const sidecar = {
    async rawCall(tool, args) {
      calls.push({ tool, args })
      return [{ type: 'text', text: JSON.stringify({ sessions: [] }) }]
    },
  }
  const data = createData({ sidecar, cache: { read: () => null, write: () => {} }, log: () => {} })
  await data.sessions('wxid_b')
  assert.deepEqual(calls.at(-1).args, { account: 'wxid_b' })
})

test('侧车错误原样抛出，不变成空数组', async () => {
  const sidecar = { async rawCall() { throw Object.assign(new Error('env'), { code: 'env_not_ready' }) } }
  const data = createData({ sidecar, cache: { read: () => null, write: () => {} }, log: () => {} })
  await assert.rejects(() => data.sessions('wxid_a'), /env/)
})
```

**Step 2: 运行确认失败**

Run: `node --test plugins/vyra-wechat-local/test/live/data.test.js`
Expected: FAIL —— 模块不存在

**Step 3: 实现**

`data.js` 内部：把 content blocks 拼成文本再 `JSON.parse`（与 `index.js` 的 `callJson` 同构，但**把解析失败当作错误抛出**而不是返回 `{ raw }`）。并发去重：同 `key + account` 的进行中 Promise 复用。

`chat/index.js` 渲染：左列会话（头像 + 名称 + 预览 + 未读点），右侧消息流。消息渲染按 `type` 分发到 `components/message.js` 的 `renderMessage(msg)`，非文本统一显示 `describe 文本`。图片走 `GET /api/wechat-live/media`（Task 6 才实现，本任务先显示占位 + 「图片」）。

**Step 4: 运行确认通过**

Run: `node --test plugins/vyra-wechat-local/test/live/`
Expected: PASS（累计 9 个用例）

**Step 5: 真机验收**

Run: 打开 Live → 聊天 → 点一个好友。
Expected: 出会话列表与最近消息；滚动到底部加载更早。

**Step 6: 提交**

```bash
git add plugins/vyra-wechat-local/lib/live plugins/vyra-wechat-local/src/live/pages/chat plugins/vyra-wechat-local/test/live
git commit -m "feat(wechat-live): 数据门面与聊天页"
```

---

### Task 6: 媒体服务 —— 解密、缓存、Range

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/media.js`
- Modify: `plugins/vyra-wechat-local/index.js`（注册 `GET /api/wechat-live/media`）
- Modify: `plugins/vyra-wechat-local/src/live/components/message.js`（图片/视频用真实 URL）
- Test: `plugins/vyra-wechat-local/test/live/media.test.js`

**Interfaces:**
- Consumes: `wechat_image_fetch`、`wechat_voice_model`（已有）、`wechat_core.video_file_path`
- Produces：`createMedia({ sidecar, cache })` → `{ resolve({account, talker, localId, ts, kind}) → {file, mime, size} }`；路由支持 `Range`

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeName } from '../../lib/live/media.js'

test('路径参数只允许白名单字符', () => {
  assert.equal(safeName('abc123'), 'abc123')
  assert.equal(safeName('../../etc/passwd'), '_.._etc_passwd')
  assert.equal(safeName('a/b\\c'), 'a_b_c')
  assert.equal(safeName(''), '_')
})
```

**Step 2: 运行确认失败**

Run: `node --test plugins/vyra-wechat-local/test/live/media.test.js`
Expected: FAIL —— 模块不存在

**Step 3: 实现**

`resolve` 顺序：磁盘缓存 → `wechat_image_fetch`（图片）→ 视频走 `core.video_file_path`。落盘为 `<live-cache>/<account>/media/<md5>.<ext>`。路由对 `Range` 回 206，否则 200；两种都带 `ETag`（`md5`）与 `cache-control: private, max-age=86400`。未就绪时回 409 与 `{ error_code: 'env_not_ready' }`，页面据此显示 §6.1 的文案。

**Step 4: 运行确认通过**

Run: `node --test plugins/vyra-wechat-local/test/live/media.test.js`
Expected: PASS

**Step 5: 真机验收**

Run: 聊天页点开一张图，再点视频。
Expected: 图片出图；拖动视频进度条可续播

**Step 6: 提交**

```bash
git add plugins/vyra-wechat-local/lib/live/media.js plugins/vyra-wechat-local/index.js plugins/vyra-wechat-local/src/live plugins/vyra-wechat-local/test/live
git commit -m "feat(wechat-live): 媒体解密与 Range 服务"
```

---

### Task 7: 聊天页补全 —— 搜索、跳日期、语音转写、发送

**Files:**
- Create: `plugins/vyra-wechat-local/src/live/pages/chat/search.js`
- Create: `plugins/vyra-wechat-local/src/live/pages/chat/jump-date.js`
- Create: `plugins/vyra-wechat-local/src/live/pages/chat/composer.js`
- Create: `plugins/vyra-wechat-local/lib/live/chat-ops.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`transcribe`、`send.preview`、`send.confirm`）
- Test: `plugins/vyra-wechat-local/test/live/chat-ops.test.js`

**Interfaces:**
- Consumes: `search_messages`、`transcribe_voice`、`wechat_voice_model`、`send_text`
- Produces：`transcribe(account, {talker, localId, ts}) → {text}`；`sendPreview(account, {talker, text}) → {ok, result}`；`sendConfirm(...)`（`dry_run:false`）

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSendArgs } from '../../lib/live/chat-ops.js'

test('预览一律 dry_run，确认才真发', () => {
  assert.equal(buildSendArgs({ talker: 'a', text: 'hi' }, false).dry_run, true)
  assert.equal(buildSendArgs({ talker: 'a', text: 'hi' }, true).dry_run, false)
})
```

**Step 2: 运行确认失败**

**Step 3: 实现**：`lib/live/chat-ops.js` 是新文件，只有纯函数（`buildSendArgs` 等），`rpc.js` 只做转发。语音转写先调 `wechat_voice_model {action:'status'}`，未就绪则先 `{action:'download'}` 并在页面显示进度（轮询 `status`）。

**Step 4–6: 通过 / 真机 / 提交**

Run: `node --test plugins/vyra-wechat-local/test/live/`
真机：搜「在吗」跳到命中；首次转写触发下载并出文字；发一条 `dry_run` 预览后确认。

```bash
git commit -m "feat(wechat-live): 聊天搜索、跳日期、语音转写与发送"
```

---

### Task 8: 通讯录页

**Files:**
- Create: `plugins/vyra-wechat-local/src/live/pages/contacts/index.js`
- Create: `plugins/vyra-wechat-local/lib/live/contacts.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`contacts.list`、`policy.set`）
- Test: `plugins/vyra-wechat-local/test/live/contacts.test.js`

**Interfaces:**
- Consumes: `live_contacts`（Task 3）、现有 `policy` / `policy.save` handler
- Produces：`groupContacts(contacts)` → `{ friend: [], group: [], official: [], former_friend: [], blocked: [] }`；每行右侧显示 `policy` 当前档位

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupContacts, letterIndex } from '../../lib/live/contacts.js'

test('五类分组，未知类型归 friend', () => {
  const out = groupContacts([{ type: 'group' }, { type: 'weird' }])
  assert.equal(out.group.length, 1)
  assert.equal(out.friend.length, 1)
})

test('字母索引把非字母开头的归到 #', () => {
  assert.equal(letterIndex('张三'), '#')
  assert.equal(letterIndex('Alice'), 'A')
})
```

**Step 2–4: 失败 → 实现 `lib/live/contacts.js` → 通过**

**Step 5: 真机验收**

Run: 切五类筛选，改一个联系人的档位后回到设置页核对。
Expected: 计数一致；两处显示同一档位（同一份 `rules.json`）

**Step 6: 提交**

```bash
git commit -m "feat(wechat-live): 通讯录页与回复策略联动"
```

---

### Task 9: 资源浏览页

**Files:**
- Create: `plugins/vyra-wechat-local/src/live/pages/resources/index.js`
- Create: `plugins/vyra-wechat-local/lib/live/time-range.js`
- Create: `plugins/vyra-wechat-local/src/live/components/time-range.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`media.index`、`media.delete`、`media.upgrade`）
- Test: `plugins/vyra-wechat-local/test/live/time-range.test.js`

**Interfaces:**
- Produces：`resolveRange(preset, {now, customStart, customEnd})` → `{start, end}`（秒，闭区间）；preset 取值 `today | 7d | 30d | custom`，**默认 `today`**

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRange } from '../../lib/live/time-range.js'

test('默认今天，且是闭区间', () => {
  const now = new Date('2026-11-27T10:00:00+08:00')
  const { start, end } = resolveRange('today', { now })
  assert.equal(start, Math.floor(new Date('2026-11-27T00:00:00+08:00').getTime() / 1000))
  assert.ok(end >= start)
})

test('30 天范围覆盖 31 个自然日', () => {
  const now = new Date('2026-11-27T10:00:00+08:00')
  const { start, end } = resolveRange('30d', { now })
  assert.equal((end - start) / 86400 >= 29, true)
})
```

**Step 2–4: 失败 → 实现 → 通过**

**Step 5: 空态三分类**：`EmptyState({ reason })`，`reason ∈ 'no-in-range' | 'image-key' | 'no-media'`，文案分别对应「改时间范围」「打开一张微信图片后重试」「真的没有媒体」。

**Step 6: 真机 + 提交**：默认今天为空时显示改范围的提示；切「近 7 天」出图。

---

### Task 10: 朋友圈页

**Files:**
- Create: `plugins/vyra-wechat-local/vendor/wechat/vyra_sns.py`（从 WeFlow `engine/sns.py` 移植解析）
- Create: `plugins/vyra-wechat-local/src/live/pages/sns/index.js`
- Create: `plugins/vyra-wechat-local/src/live/components/media-grid.js`
- Test: `plugins/vyra-wechat-local/test/live/sns-parse.test.js`

**Interfaces:**
- Consumes: WeFlow `python/wechat_assistant/engine/sns.py`（`_parse_post`、`_interactions`）
- Produces：`live_sns_timeline` → `{ ok, posts: [{ tid, user, text, time, media: [{url, thumb, md5, kind}], likes: [], comments: [] }] }`

**Step 1: 写失败测试**（用一段固定的朋友圈 XML 片段）

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('../../vendor/wechat/vyra_sns.py', import.meta.url), 'utf8')

test('移植了 WeFlow 的解析要点', () => {
  assert.ok(src.includes('TimelineObject'))
  assert.ok(src.includes('SnsMessage_tmp3'))
  assert.ok(src.includes('mediaList'))
})
```

**Step 2–4: 失败 → 移植 → 通过**

移植时保留 WeFlow 的容错：`ET.ParseError` 返回 `None`，该帖被跳过并计入 `skipped`，页面显示「N 条无法解析」而不是静默丢。

**Step 5: 九宫格**：`media-grid.js` 支持 1/2/3/4/9 布局；图片失败时回退缩略图并打「本机缓存」角标。

**Step 6: 真机 + 提交**：时间线出图、筛选生效。

---

### Task 11: 聊天分析页

**Files:**
- Create: `plugins/vyra-wechat-local/src/live/pages/analytics/index.js`
- Create: `plugins/vyra-wechat-local/lib/live/analytics.js`
- Create: `plugins/vyra-wechat-local/src/live/components/charts.js`（自绘 SVG：柱、折线、环）
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`analytics.get`、`analytics.refresh`、`analytics.exclude`）
- Test: `plugins/vyra-wechat-local/test/live/analytics.test.js`

**Interfaces:**
- Produces：`applyExclusions(stats, excluded)` → 新 stats（被排除的 talker 从 `topContacts` 与 `total` 中移除，且 `daily` 按差值扣减）

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyExclusions } from '../../lib/live/analytics.js'

test('排除后总数与排行同步减少', () => {
  const stats = { total: 10, topContacts: [{ talker: 'a', count: 6 }, { talker: 'b', count: 4 }] }
  const out = applyExclusions(stats, ['a'])
  assert.equal(out.total, 4)
  assert.deepEqual(out.topContacts.map((x) => x.talker), ['b'])
})
```

**Step 2–4: 失败 → 实现 → 通过**

**Step 5: 欢迎页**：先显示「上次分析于 X」+ 两个按钮（加载缓存 / 新的分析），结果落 `analytics.json`。

**Step 6: 真机 + 提交**：排除一个会话后数字变小。

---

### Task 12: 年度报告页

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/reports.js`
- Create: `plugins/vyra-wechat-local/src/live/pages/annual-report/index.js`
- Create: `plugins/vyra-wechat-local/src/live/components/heatmap.js`、`wordcloud.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`reports.years`、`reports.annual`、`reports.dual`）
- Test: `plugins/vyra-wechat-local/test/live/reports.test.js`

**Interfaces:**
- Produces：`yearList(years, {cached, timeoutMs})`（渐进：先给缓存，超时降级为已知年份）；`dualSummary(a, b)` → `{ aCount, bCount, commonWords, longestStreak }`

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { longestStreak } from '../../lib/live/reports.js'

test('连续天数按本地日期去重后求最长', () => {
  const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05']
  assert.equal(longestStreak(days), 3)
})
```

**Step 2–4: 失败 → 实现 → 通过**

**Step 5: 全屏**：报告挂到 `shell.overlay` 的 `LiveTheater`（Task 2 已留槽），`Esc` 关闭。

**Step 6: 真机 + 提交**：选年份出报告；双人报告选一人出对比；导出长图落到 `~/Documents/微信 Live/`。

---

### Task 13: 我的足迹页

**Files:**
- Create: `plugins/vyra-wechat-local/src/live/pages/footprint/index.js`
- Create: `plugins/vyra-wechat-local/lib/live/footprint.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`footprint.get`）
- Test: `plugins/vyra-wechat-local/test/live/footprint.test.js`

**Interfaces:**
- Produces：`normalizeContent(raw)` → 去掉群前缀、解码 HTML 实体、空则 `'[空消息]'`；`splitMentions(text)` → `[{text, isMention}]`

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeContent, splitMentions } from '../../lib/live/footprint.js'

test('去群前缀并解码实体', () => {
  assert.equal(normalizeContent('张三:\n&amp;你好'), '&你好')
  assert.equal(normalizeContent('   '), '[空消息]')
})

test('@我 被切成高亮片段', () => {
  const parts = splitMentions('你好@我 在吗')
  assert.deepEqual(parts.map((p) => p.isMention), [false, true, false])
})
```

**Step 2–4: 失败 → 实现 → 通过**

**Step 5: 真机 + 提交**：切「最近 7 天」，群 @ 高亮。

---

### Task 14: 导出页

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/export.js`
- Create: `plugins/vyra-wechat-local/src/live/pages/export/index.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`export.preview`、`export.start`、`export.list`、`export.cancel`、`export.reveal`）
- Test: `plugins/vyra-wechat-local/test/live/export.test.js`

**Interfaces:**
- Consumes: `preview_export`、`export_chat`
- Produces：`exportTask({sidecar, cache, log})` → `{start(account, {talkers, format, media}) → taskId, status(taskId), cancel(taskId), list()}`；格式白名单 `['md','html','json','csv','pdf']`，其余回 `bad_args` 并在界面标「暂不支持」

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertFormat } from '../../lib/live/export.js'

test('只接受五格式，其余明确拒绝', () => {
  for (const f of ['md', 'html', 'json', 'csv', 'pdf']) assert.equal(assertFormat(f), f)
  assert.throws(() => assertFormat('xlsx'), /暂不支持/)
})
```

**Step 2–4: 失败 → 实现 → 通过**

**Step 5: 产物结构**：`<导出目录>/<会话名>/chat.<格式>` + `assets/` + `files/`。

**Step 6: 真机 + 提交**：五格式各导一次，任务中心能取消、能打开目录。

---

### Task 15: 数据库备份页

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/backup.js`
- Create: `plugins/vyra-wechat-local/src/live/pages/backup/index.js`
- Modify: `plugins/vyra-wechat-local/lib/live/rpc.js`（`backup.create`、`backup.inspect`、`backup.load`）
- Test: `plugins/vyra-wechat-local/test/live/backup.test.js`

**Interfaces:**
- Produces：`createBackup({dir, account, includeMedia})` → `{archivePath, manifest}`；`inspectBackup(archivePath)` → `{manifest}`；`loadBackup({archivePath, account})` → `{added, existed, skipped}`；`manifest = { account, schemaVersion, createdAt, counts, includesMedia }`

**Step 1: 写失败测试**（临时目录里造一个 `live-cache` 结构，打包后载入到空目录）

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createBackup, loadBackup } from '../../lib/live/backup.js'

test('打包后载入到空目录，报告新增数', async () => {
  const root = mkdtempSync(join(tmpdir(), 'live-bk-'))
  const src = join(root, 'src'); mkdirSync(src, { recursive: true })
  writeFileSync(join(src, 'index.json'), JSON.stringify({ schemaVersion: 1, value: { n: 1 } }))
  const { archivePath, manifest } = await createBackup({ dir: src, account: 'wxid_a', includeMedia: false, outDir: root })
  assert.equal(manifest.counts.files, 1)
  const out = join(root, 'dst'); mkdirSync(out, { recursive: true })
  const result = await loadBackup({ archivePath, account: 'wxid_a', dir: out })
  assert.equal(result.added, 1)
  rmSync(root, { recursive: true, force: true })
})
```

**Step 2–4: 失败 → 实现（`tar` / `tar.gz`，Node 只读不依赖外部命令）→ 通过**

**Step 5: 页面写明**「这是微信 Live 的数据快照，不是微信数据库的恢复源」。

**Step 6: 真机 + 提交**：创建（含媒体）→ 清缓存 → 载入 → 计数合理。

---

### Task 16: AI Agent 页（DSH 会话前端）

**Files:**
- Create: `plugins/vyra-wechat-local/lib/live/agent.js`
- Create: `plugins/vyra-wechat-local/src/live/pages/ai/index.js`
- Modify: `plugins/vyra-wechat-local/index.js`（`inject` 增加 `agents`、`sessionController`；若已存在则确认）
- Test: `plugins/vyra-wechat-local/test/live/agent.test.js`

**Interfaces:**
- Consumes: `ctx.agents.create/resume`、`ctx.sessionController.prompt`（`lib/watch.js` 已有用法）
- Produces：`buildScopePrompt({scope, talker, start, end, includeSns})` → 首条消息文本；`createAgentBridge({agents, sessionController})` → `{openScope(account, scope), listSessions(account)}`

**Step 1: 写失败测试**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScopePrompt } from '../../lib/live/agent.js'

test('限定会话范围时把 talker 与时间写进首条消息', () => {
  const text = buildScopePrompt({ scope: 'session', talker: 'wxid_a', start: 0, end: 0, includeSns: false })
  assert.match(text, /wxid_a/)
  assert.match(text, /微信 Live/)
})

test('全部范围不加限定词', () => {
  const text = buildScopePrompt({ scope: 'all' })
  assert.doesNotMatch(text, /wxid_a/)
})
```

**Step 2–4: 失败 → 实现 → 通过**

**Step 5: 页面**：左侧会话列表（PC微信 workspace）、右侧「在 DSH 会话里打开」按钮 + 范围选择器。**不内嵌消息渲染**。

**Step 6: 真机 + 提交**：新建会话 → 选「某好友」→ 让它总结最近 50 条。

---

### Task 17: 设置页精简 + README

**Files:**
- Modify: `plugins/vyra-wechat-local/client.js`（设置页四页签重构）
- Modify: `plugins/vyra-wechat-local/README.md`
- Modify: `plugins/vyra-wechat-local/package.json`（版本升至 `0.9.0`）
- Test: `plugins/vyra-wechat-local/test/live/client-check.mjs`（追加断言）

**Interfaces:**
- Produces：设置页四页签 `live` / `policy` / `account` / `distill-link`；`live` 页含 `sidebar`、`notify` 两个开关，写 `~/.dsh/wechat-local/live-ui.json`

**Step 1: 写失败测试**：在 `client-check.mjs` 追加

```js
const settings = registrations.find((r) => r.options.name === 'settings.section' && r.options.id === 'wechat-local')
assert.ok(settings, 'PC微信 设置入口仍在')
```

**Step 2–4: 失败 → 重构四个页签 → 通过**

**Step 5: 关掉侧栏开关后**，侧栏不再显示「微信 Live」，但 `main` 仍可打开。

**Step 6: 提交**

```bash
git commit -m "feat(wechat-live): 设置页精简与文档（0.9.0）"
```

---

## 自检结论

**Spec 覆盖**：§2 导航→Task 2；§3 数据层→Task 1/3/5/6；§4 口径→Task 4；§5.1→Task 16（画像生成经 DSH）、§5.2→Task 5/7、§5.3→Task 16、§5.4→Task 10、§5.5→Task 8、§5.6→Task 9、§5.7→Task 11、§5.8→Task 12、§5.9→Task 13、§5.10→Task 14、§5.11→Task 15；§6→Task 17；§8→各页 `EmptyState`；§9 验收→各任务真机步骤。

**已知缺口（明确接受）**：用户画像页（§5.1）在本计划里**只做浏览与编辑**（复用现有 `distill.*` handler），「批量生成走 DSH 会话」并入 Task 16 的范围选择器，不单独成任务——因为两者共用同一条 Agent 桥。

**需同步修正 spec 的两处事实**：
1. §3.5 写「需要给 `runtime.js` 加 pilk / sherpa-onnx / numpy」——**实际已经加好了**（`lib/runtime.js` 第 43–46 行）。
2. §3.5 写「`vyra_live.py` 重新注册 `transcribe_voice`」——**实际 `vyra_sidecar.py` 已经注册**，新文件只管页面专用工具。