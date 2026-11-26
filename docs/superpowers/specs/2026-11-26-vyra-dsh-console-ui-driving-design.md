# vyra-dsh-console 优化：让 Agent 能真正操作 DSH 界面

日期：2026-11-26
状态：待实施
前序设计：`docs/superpowers/specs/2026-11-23-vyra-dsh-console-design.md`
实现计划：`docs/superpowers/plans/2026-11-26-vyra-dsh-console-ui-driving.md`

## 1. 问题

装上 `dsh-vyra-dsh-console` 后，Agent 仍然无法完成最基本的界面操作：打开设置页、
切到某个插件的设置节（例如「免费模型」）、切到某个主面板、打开右栏的某个 tab。

而最初的设计意图是：安装本插件后，Agent 能通过**技能 + CLI + 工具**三件套，
既知道这台机器上有哪些插件、各自贡献了哪些界面，也能直接把这些界面打开。

### 1.1 当前代码的四个致命缺陷（已逐条验证）

**缺陷 A：发布包漏了文件，Host 半加载即失败。**

`package.json` 的 `files` 只列了 `index.js`/`core.js`/`channel.js`/`client.js`/
`panel.js`/`cli.mjs`，而 `index.js:3-9` 静态 `import` 了 `./tool.js` 与六个
`./domains/*.js`。实测：

```
npm pack --dry-run           → 14 个文件，无 tool.js、无 domains/
node -e "import('.../dsh-vyra-dsh-console/index.js')"
  → ERR_MODULE_NOT_FOUND: Cannot find module '.../tool.js'
```

市场 pin 的 `4f4d01f` 与当前 HEAD 只差 README，因此**市场上没有任何人能装到能用的版本**：
`dsh_console` 工具不存在，`/api/vyra-console/rpc` 不存在，面板所有请求 404。

`scripts/check-installable.mjs:105-117` 只校验 `files` 中字面量文件存在，
**不校验入口的静态 import 是否可解析**，所以该缺陷逃过了 `pnpm run verify`。

**缺陷 B：面板的翻译器与 locale 传参错误。**

`client.js` 传 `t: () => t`（返回函数的函数）与 `localeApi: () => localeApi`，
而 `panel.js` 把它们当函数/服务直接使用。结果：面板文案全部渲染为空函数，
语言切换订阅永远不生效。测试从不真正实例化 `createPanel`，只取内部纯函数，所以没抓到。

**缺陷 C：面板在真实浏览器里根本装载不上。**

`client.js` 用 `require('./panel.js')` 取面板模块。DSH 客户端模块系统的 `require`
只认平台种子、已物化模块、已注册包工厂（`packages/client/modules/src/client/system.ts:328-340`），
包内相对路径必须走 `require.async('./client.*.js')` 且有构建产物。
本插件无构建步骤，仓库内所有同类插件（free-model、free-theme、agent-manager、
file-manager）的 `client.js` 都是单文件自包含，没有一个 `require('./本地文件')`。
测试里的 `require` 桩返回工厂，恰好把这一缺陷遮住。

**缺陷 D：没有任何「打开界面」的动作。**

`core.js` 的 19 个动作里，Client 侧只有 theme/fontSize/sidebar/rightbar/locale 六项。
没有 `settings.open`、没有 `main.select`、没有 `rightbar.open`。
设计文档 §2.1 写过的 `layout.selectPanel` 从未实现。

### 1.2 顺带发现的安全缺陷

`/api/vyra-console/rpc` 注册为 **exact** 路由（`index.js:505-511`），而
`WebServer.match` 精确表优先于 `/api` 前缀（`packages/host/webserver/src/index.ts:655-664`），
因此它**绕过了 `client-connection` 的 `admit()`**（Host 头 + Origin 防 DNS rebinding）。
本机任意进程都可 POST `plugin.install`、`settings.set`，或伪造外观请求的应答。

### 1.3 skill 与 CLI 没有兑现

- `skills/vyra-dsh-console/SKILL.md` 在仓库根 `skills/`，不在包 `files` 里，
  也没有运行时注册。`~/.dsh/skills/` 里只有 `dsh-vyra-free-theme` 与 `vyra-dsh-guide`
  ——**Agent 从未见过这份技能**。
- CLI `vyra-console` 是纯只读诊断，读的是 profile 文件，碰不到运行中的界面。
- 「把所有插件信息注入」不存在：没有界面地图，无法枚举设置页、主面板、右栏 tab、
  命令，也无法知道某个界面由哪个插件贡献。

## 2. 原理

### 2.1 两个世界，中间只有一条通道

```
┌─ Host 进程（Node / Cordis）────────────┐        ┌─ Client（浏览器 realm）─────────────────┐
│ 插件 index.js  → apply(ctx)            │        │ 插件 client.js → window.__ModuleLoader__ │
│ ctx.tools / ctx.pluginManager          │        │ ctx.theme / ctx.layout / ctx.locale      │
│ ctx.settings / ctx.mcpManager          │        │ ctx.slots / ctx.shortcuts                │
│ ctx.skills / ctx.webServer             │        │ React 组件树 = 用户看到的界面             │
│ 能读文件、改配置、调服务                │        │ 弹窗开没开、哪个页选中、DOM 长什么样      │
└────────────────────────────────────────┘        └──────────────────────────────────────────┘
        ▲                                                         ▲
        └────────── HTTP long-poll 通道（唯一的桥）───────────────┘
```

关键事实：

- **界面状态只存在于浏览器**。「设置弹窗开着、停在免费模型那一页」没有任何 Host 侧对象记录。
  `ui-settings-general` 的 `createSettingsShellStore()` 只是浏览器里的一个 store。
- Agent 要操作界面，只能**在浏览器里执行动作**；改配置文件是「改下次启动的值」，
  不是「现在把这一页打开」。
- 因此 `requiresClient: true` 的动作，Host 侧只做校验与转发，执行全在浏览器。

### 2.2 桥的原理（已存在，直接复用）

`channel.js` + `index.js:createEndpoint`：

1. Host 维护 `pending: Map<id, {resolve, timer, op}>`。`request(op,args)` 登记、设超时、唤醒挂起的 GET。
2. 浏览器 `drain()` 循环长轮询 `GET /api/vyra-console/rpc`，拿到 `{requests:[{id,op,args}]}`，
   逐个执行，`POST {id, ok, value|error}` 回来。
3. Host `respond()` 按 id `settle` → resolve → 工具返回。
4. **无人应答 → 超时 → `unavailable`**，绝不把没做的事报成成功。

面板走同一端点，POST 形状 `{action,args}` 直达同一个 `core.js`。这就是「一个操作，两个调用方」。

### 2.3 界面分三类，能力不同

| 类别 | 例子 | 可否被外部代码驱动 | 原因 |
|---|---|---|---|
| **有公开服务** | 主面板 `ctx.layout.selectPanel`、右栏 `ctx.sidebarRight.openTab`、主题/语言 | ✅ 直接调用 | 这些包用 `ctx.reflect.provide(...)` 提供了能力 |
| **只有 slot 账本** | 设置页清单、主面板清单、右栏 tab kind、命令清单 | ✅ 可枚举，不可操作 | `ctx.slots.entries(key)` 是公开只读接口 |
| **只有 DOM** | 设置弹窗的开/关/切节 | ⚠️ 只能点击 | `openSection` 是发给 `settings.launcher` 的私有 owner prop，未 provide |

### 2.4 `registrant` 是「插件信息注入」的答案

每次 `ctx.slots.register({name:'settings.section', id:'dsh-vyra-free-model', ...}, Page)`
都会在账本里留一条 `StoredEntry`，其中 `registrant` 由渲染器用 `ctx.fiber.name` 盖章
（`ui-renderer/src/client/registry.ts:479`），而客户端 entry 名就是包名
（`modules/src/client/entries.ts:183`）。

于是**不需要每个插件上报元数据**：账本本身即是元数据。

- `settings.section` → 每个设置页属于哪个插件
- `sidebar.panellist` → 每个主面板属于哪个插件
- `sidebarRightTabs.entries()` → 每个右栏 tab 类型属于哪个插件

## 3. 目标动作面

```jsonc
// 整机地图：一次调用看全
console.map {}          // Host 清单 + Client 面 + 命令目录，每行带 source/registrant/unknown 原因

// Client 面操作
ui.list   {}            // settings{open,sections[]} main{panels[],active} rightbar{tabs[],expanded} commands[] modal
ui.open   { target:"settings", section:"dsh-vyra-free-model" }
ui.open   { target:"main", id:"plugins" }
ui.open   { target:"rightbar", kind:"browser", url:"https://…" }
ui.open   { target:"rightbar", address:"dsh-resource://file/…" }
ui.close  { target:"settings" } | { target:"modal" }
ui.state  {}            // 当前弹窗、当前设置节、当前主面板、右栏是否展开
ui.invoke { id:"settings.open" }
```

统一返回壳：

```jsonc
{ "status":"ok", "target":"settings",
  "resolved":{ "section":{ "id":"dsh-vyra-free-model", "label":"免费模型",
                          "registrant":"dsh-vyra-free-model" } },
  "how":"service"|"dom"|"noop", "verified":true }

{ "status":"error", "target":"settings", "reason":"…",
  "candidates":[ { "id":"vyra-market", "label":"插件市场" } ] }

{ "status":"unavailable", "target":"rightbar", "reason":"no session surface is mounted",
  "hint":"先打开或新建一个会话" }
```

**`verified` 是硬要求**：打开后必须回读确认，拿不到就报 `error`，绝不默认成功。

## 4. 每个面的实现路径

| 面 | 服务路径 | 兜底 | 枚举来源（含插件归属） |
|---|---|---|---|
| 主面板 | `ctx.layout.selectPanel(id)`，未注册 throw | — | `ctx.slots.entries('sidebar.panellist')` |
| 右栏 tab | `ctx.sidebarRight.openTab(kind,{params})` / `openResource(addr)` | — | `ctx.sidebarRightTabs.entries()` / `get(kind)` |
| 设置弹窗 | **无公开服务** | DOM | `ctx.slots.entries('settings.section')` |
| 命令 | `ctx.shortcuts` 无 `invoke` | 合成键事件 | `ctx.shortcuts.catalog.getSnapshot()` |
| 主题/语言/侧栏 | 现有 `appearance.*` | — | 不变 |

### 4.1 设置弹窗的 DOM 驱动

**打开**（按优先级）：

1. 已开着（`[data-shortcut-modal="settings"]` 存在）→ 直接切节，`how:'noop'`。
2. 从 `ctx.shortcuts.catalog` 读 `settings.open` 行的**有效 `aria`**（用户改过键位也是活的），
   选择器 `button[aria-keyshortcuts="<aria>"]`——`SettingsRoot.tsx:236-243` 的设置触发器唯一带该值。
   见 §4.3 的账户菜单分支。
3. 退化：`button[aria-haspopup="dialog"][aria-expanded]` 且不被任何 `[data-shortcut-modal]` 包含。
4. `.click()`。React 合成事件不校验 `isTrusted`，程序化点击与真人点击走同一个 `onClick`。
5. **点后校验**：轮询等待 `[data-shortcut-modal="settings"]` 出现（上限 800ms）。
   没出现 → `error`，附被点元素的描述。

**切节**：对话框内 `nav` 的按钮与 `settings.section` 账本同序（shell 按 `order` 升序渲染）。
用 **`order` 排序后的索引**定位——与语言无关；`aria-current="true"` 用于校验。

**关闭**：向 document 合成 `Escape`。`useModalLayer` 的 Escape 监听不检查 `isTrusted`，
且只对栈顶弹窗生效（`ui-primitives/src/useModalLayer.ts:69-75`），三平台一致。

**护栏**：

- 当前有**别的**弹窗（`[data-shortcut-modal]` 存在且非 settings）→ 拒绝，不替用户关别人的对话框。
- **绝不对输入框/表单合成指针事件**，只点导航与触发器。

### 4.2 命令调用

`ShortcutRegistry.invoke()` 存在（`ui-shortcuts/src/client/registry.ts:140`，强制 `source:'menu'`，
会正确经过各命令自己的 `modals` 判断），但**未进 `Shortcuts` 接口**。平台差异：

- **Web / Linux**：合成 `keydown`（code+modifiers 取自 catalog 的 `binding`）能被接住。
- **Windows / macOS 桌面**：`ui-shortcuts/src/client/index.ts:70` 以 `native=true` 安装，
  `dom.ts:91` 直接 `if (native) return`——**合成键事件对可配置命令完全无效**。

因此 `ui.invoke` 的逻辑是**运行时探测**：

1. `typeof ctx.shortcuts.invoke === 'function'` → 直接调用，`how:'service'`；
2. 否则 Web/Linux 合成键；
3. 否则 `unavailable` + 该命令的键位字符串，让 Agent 转告用户。

**本版不修改 core**。探测分支保证：将来 fork 若给 `Shortcuts` 加 `invoke`，本插件自动升级为服务路径。

### 4.3 设置触发器的两条 DOM 路径

当前 DSH 组合里 `settings.launcher` 被 `ui-settings-account` 占用（账户菜单），
设置入口**藏在菜单项里**：`AccountMenu.tsx:75` 把 `settingsShortcut` 传给 `Menu` 的 item，
`MenuRow.tsx:46` 渲染成 `aria-keyshortcuts`。因此：

- 路径 1：`button[aria-keyshortcuts="<settings.open 的 aria>"]` —— 命中侧栏账户菜单里的「设置」行。
- 路径 2：找不到上述按钮时，在账户菜单触发器（`[aria-haspopup="menu"]`）上点击展开，
  再找 `[role="menuitem"]` 内 `aria-keyshortcuts` 匹配的行并点击。

两条路径**都必须点后校验**；都失败则 `error` 并说明「无法定位设置入口」，附实际找到的候选。

## 5. 技能与 CLI

### 5.1 技能

- 文件从仓库根 `skills/vyra-dsh-console/SKILL.md` **移入包内** `plugins/vyra-dsh-console/skills/SKILL.md`，
  `files` 增加 `skills/`。
- Host `apply()` 里 `ctx.inject(['skills'], …)` → `skills.register({ name, description, content })`
  （`packages/skill/skill/src/index.ts:439`，`dsh-vyra-agent-manager/index.js:50-56` 是成熟先例）。
  **单份来源、随插件生命周期卸载**，不写盘；registry 缺失时只损失技能、不损失工具。
- 内容重写：先 `ui.list` 拿 id → `ui.open` → `ui.state` 验证；解释 `verified`、`candidates`、
  `unavailable` 三种返回；说明「能带路、不能代点敏感开关」的边界。

### 5.2 CLI

保持只读。新增 `map --json`：输出 profile 文件能证明的部分；
运行中的界面显式标 `unknown` 并指向 `dsh_console ui.list`。
**不做写入型命令**（理由不变：只有 Host 工具走 profile 锁/激活/回滚）。

### 5.3 包内单文件化（缺陷 C 的修复方式）

- `panel.js` 的内容**合入 `client.js`**，成为单文件自包含 bundle；`panel.js` 从包中删除。
- 这同时消除了缺陷 B：面板直接闭包 `t` 与 `localeApi`，不再经过传参。
- `scripts/check-installable.mjs` 增加一条规则：`dsh.client` 包的 `client.js` 若出现
  `require('./…')`（非 `require.async('./client.*.js')`）即报错——这类 require 在浏览器里必然失败。

## 6. 健壮性与安全

- **多标签页**：请求由最先轮询到的标签应答。应答方 `document.visibilityState !== 'visible'` 时
  返回 `unavailable`（「该标签在后台，请把 DSH 窗口切到前台重试」），不在后台静默改页面。
- **幂等**：目标已就绪时返回 `ok` + `verified:true` + `how:'noop'`。
- **候选列表**：id 未命中返回同域最近 5 个 `{id,label}`，不猜。
- **RPC 栅栏**：`/api/vyra-console/rpc` 内部复刻 client-connection 的同一道校验
  （loopback/trusted Host + Origin 同源 + `sec-fetch-site !== 'cross-site'`），
  拒绝时返回 403 而非 JSON 结果。局域网/远程访问模式下不可用为**预期行为**。

## 7. 测试

| 层 | 内容 |
|---|---|
| `core.test.mjs` | `ACTIONS` 新增条目齐全；`ui.*` 全部 `requiresClient:true`；禁止动作仍被拒 |
| `client.test.mjs` | `uiOps` 纯函数（id 解析、候选匹配、返回壳）；`ui.list` 从假账本读出的形状；面板可实例化且 `t` 是真翻译器 |
| `test/ui-dom.test.mjs`（新） | 最小假 DOM：触发器选择器优先级、账户菜单两跳、点后校验失败、按 order 索引切节、Escape 关闭、别的弹窗时拒绝、后台标签返回 unavailable |
| `host.test.mjs` | `console.map` 聚合 Host 清单；RPC 栅栏（错误 Origin / 非 loopback Host → 403） |
| `cli.test.mjs` | `map --json` 输出与 `unknown` 标注 |
| `scripts/test/installable-imports.test.mjs`（新） | 从 `main` 与 `./client` 递归校验静态 import 可达；客户端 bundle 无非法 `require('./…')` |

## 8. 验收标准

1. `npm pack` 产物中 `index.js` 的全部静态 import 可达；`node -e "import(...)"` 成功。
2. 在真实 DSH 桌面上，`dsh_console { action:'ui.open', args:{ target:'settings', section:'dsh-vyra-free-model' } }`
   返回 `ok` + `verified:true`，且界面上设置弹窗确实停在「免费模型」页。
3. `ui.open` 一个不存在的主面板 id，返回 `error` + 候选列表，且界面无变化。
4. `ui.list` 返回的每个设置节都带 `registrant`，能据此回答「这个页是哪个插件的」。
5. 技能在 `~/.dsh` 只读时仍注册成功；`skills.list` 能看到 `vyra-dsh-console`。
6. 携带 `Origin: https://evil.example` 的 RPC 请求返回 403。
7. 现有 383 个测试全部通过；新增测试覆盖上表每一行。

## 9. 明确不做

- 不修改 `packages/`（含 `Shortcuts.invoke`）。`ui.invoke` 在 Windows/macOS 桌面诚实报 `unavailable`。
- 不实现「点击任意 DOM 元素」的通用驱动。只驱动：设置触发器、设置导航、主面板、右栏、命令。
- 不代点敏感开关（沙箱、权限预设、审批、凭据）。`FORBIDDEN` 不变。
- 不为 CLI 增加写入能力。
