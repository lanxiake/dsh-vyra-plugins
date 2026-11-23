# vyra-dsh-console（DSH 控制台）设计

日期：2026-11-23
状态：待评审

## 1. 问题

DSH 里，「操作 harness 自己」这件事没有统一的 agent 入口。用户要切主题、换模型、
开关插件、改设置，都得自己在 UI 里点；agent 只能靠通用 shell 工具去猜配置文件在哪、
格式是什么，容易改坏，也没有回滚。

目标：**给 agent 一个受边界约束的、一等公民的自我操作通道**，覆盖 DSH 的配置与表现层；
同时给这个通道一条只读的 CLI 诊断路径，以及一份说明边界的 skill。

## 2. 范围

### 2.1 能力清单（每一项都已在运行实例上核验）

| 领域 | 动作 | 后端 |
|---|---|---|
| 模型 | 列目录 / 切默认 / 切本会话 | `llm.listModels`、`llm.listProviders`、`agentDefaultModel.currentSelection` / `saveSelection` |
| 设置 | 列命名空间 / 读 / 写 | `settings.describe` / `update` / `mutate` |
| 插件 | 列出 / 启停 / 装卸 / 更新 / 版本 | `pluginManager.listPlugins` / `listBundles` / `setPluginEnabled` / `setBundleEnabled` / `installBundle` / `removeBundle` / `updateBundle` / `inspect` / `listVersions` |
| 市场源 | 列源 / 改源 / 搜索 | `pluginMarket.listIndexes` / `setIndexes`、`plugin_market` 工具已有 |
| 技能 | 列已注册技能 | `skills.list` / `snapshot` |
| MCP | 列服务器 / 状态 / 重启 / 探测 | `mcpManager` |
| 外观 | 主题、字号、侧栏、右栏、语言 | **Client**：`theme.setTheme` / `setFontSize`、`layout.toggleSidebar` / `openRightbar` / `closeRightbar` / `selectPanel`、`locale.setLocale` |
| 会话·工作区 | 列表 / 归档 / 重命名 / 工作目录 | `workspaceRegistry`、`workingDirectory.get` / `set` |
| 诊断 | 服务目录、事件目录、插件清单、Token 压力 | `tokenMeter.contextPressure`、`configEditor`、`cordis_inspect_*` 的 Host 侧等价物 |

### 2.2 明确不做

**权限边界类操作对 agent 永久关闭**，由 `references/user-actions.md` 规定：

- 不改沙箱模式（`sandboxPolicy`），不改审批策略（`permissionPresets.set`）。
  agent 可**读**当前档位并陈述，改必须由用户操作。
- 不代替用户批准工具调用，不代替用户回答 agent 自己的提问（`ctx.approval` / `ctx.userQuestions`）。
- 不读取、不代填凭据（`ctx.credentials`）。`credentialsController.set` 只暴露给 UI。

**原则：agent 可以改变「表现与配置」，不能改变「自己的权限边界」。**

被排除的动作在 `dsh_console` 里以显式拒绝返回，并说明原因与替代做法（提示用户去
设置页），**不是静默不可见**——静默会让 agent 反复尝试。

### 2.3 非目标

- 不做「枚举一切并全部暴露」的通用反射层（DSH 无此 API，且会撞授权红线）。
- 不代理其它 agent 的授权，不做跨 profile 操作（只操作当前 profile）。

## 3. 架构

### 3.1 三层，职责不重叠

```
                  ┌─ Host 半 (index.js) ──────────────────────┐
  agent ─tool──▶  │  dsh_console 工具                          │
                  │    └─ core.js：唯一业务实现                 │
                  │         ├─ Host 服务（模型/插件/设置/MCP）   │
                  │         └─ Remote 请求 ──┐                  │
                  └──────────────────────────┼─────────────────┘
                                             │
                  ┌─ Client 半 (client.js) ──▼─────────────────┐
                  │  ctx.theme / ctx.layout / ctx.locale        │
                  └────────────────────────────────────────────┘

  用户点 UI 面板 ────▶ 同一条 Client 通道 ────▶ core.js（同一实现）
```

### 3.2 单实现、双调用方

`references/user-actions.md` 的硬约束：

> 一个操作只实现一次。UI 动作和 agent 工具调用**同一个方法**。

因此 `core.js` 是唯一业务实现；UI 面板与 `dsh_console` 工具都只是它的调用方。
**禁止**在 UI 路径和工具路径各写一份逻辑。这是本次实现最重要的 review 项。

### 3.3 为什么外观类必须走 Client 半

`ctx.theme`、`ctx.layout`、`ctx.locale` 只存在于浏览器 realm，Host 侧不可达。
仓库内 `vyra-theme-styles` 已是双半插件（`index.js` + `client.js` +
`dsh.client` 声明），通道有已验证先例，无需新发明。

**失败模式必须显式**：Client 未连接（无浏览器页）时，外观类动作返回
「界面未连接」而非静默成功。

## 4. 组件

| 文件 | 职责 | 依赖 |
|---|---|---|
| `index.js` | Host 半：注册 `dsh_console` 工具与 Remote 端点 | `core.js` |
| `core.js` | 唯一业务实现：action 分发、参数校验、边界拒绝 | Host 服务、`channel.js` |
| `channel.js` | Host↔Client 请求/响应通道，含超时与「无客户端」错误 | Remote |
| `client.js` | Client 半：接收请求并调用 `ctx.theme` / `ctx.layout` / `ctx.locale`；注册 UI 面板 | Client 服务 |
| `panel.js` | UI 面板（React，走 slot），调用 `core.js` | `core.js` |
| `cli.mjs` | 只读 CLI `vyra-console`：`doctor` / `state` / `services` / `events` | 只读 |
| `cordis.patch.yml` | 一行，按包名引用 | — |
| `locale/*.json` | 面板文案，zh + en | — |

`core.js` 按领域拆函数、不按调用方拆。文件过大即信号，需要时按领域再分模块。

### 4.1 工具形态

单一工具 `dsh_console`，用 `action` 参数区分操作（与 `plugin_manager` 一致），
避免十几个工具挤占提示预算。只读动作与变更动作同工具：**只读动作立即执行，
变更动作按其是否不可逆决定是否需要 `confirm`**（规则见 §6），不另设 `apply` 参数。

## 5. CLI 与 skill 的分工

沿用 `vyra-plugin-market` 已验证的模式，但边界更严：

| 层 | 负责 | 不负责 |
|---|---|---|
| `dsh_console` 工具 | 所有变更，走 profile 锁与回滚路径 | — |
| `vyra-console` CLI | **只读**：`doctor`（一次 dump 模型/插件/主题/MCP 状态）、`state`、`services`、`events` | 不做变更（不像 market CLI 提供 `--apply`） |
| `skills/vyra-dsh-console/SKILL.md` | 教 agent 何时用哪层、边界在哪 | 不是执行层 |

CLI 只读是刻意的：变更必须走 Host 工具，因为只有它用与 Web UI 相同的
profile 锁、激活与回滚路径（`vyra-plugin-market` 的 SKILL.md 已记录此结论）。
`doctor` 的价值是排查「我的 DSH 现在什么配置」不必烧 tool call。

## 6. 确认策略（用户已定：可询问，不需审批）

- 变更类动作**不强制审批**；不可逆动作（卸载插件、删工作区、改市场源）
  在工具返回里标注 `destructive: true` 与影响范围，由调用方判断。
- `Config` 提供 `confirmDestructive` 开关，默认关闭；打开后不可逆动作要求
  调用方显式传 `confirm: true`，缺参数时返回需确认而非执行。
- 该类开关放 `Config`，用户经 `cordis.patch.yml` 调整，patch 层跨升级保留。

## 7. 错误处理

- 每个 action 返回显式状态；失败带原因，不抛裸异常给模型。
- 边界动作返回 `forbidden` + 原因 + 替代做法。
- Client 类动作在界面未连接时返回 `unavailable`。
- 参数非法与「服务缺失」（profile 未装该服务）区分开——后者用
  `ctx.inject([...])` 可选注入，插件在缺服务的 profile 里保持不激活而非抛错。

## 8. 测试

沿用仓库 `node --test`（同 `vyra-agent-manager`）：

1. `core.test.mjs` —— 每个 action 的成功 / 失败 / 非法参数，桩 Host 服务。
2. **边界测试** —— 断言 sandbox/approval/credentials 类 action 被拒绝且原因正确。
3. `channel.test.mjs` —— 桩 Client：正常响应、超时、无客户端时返回 `unavailable`。
4. `client.test.mjs` —— 桩 Client 服务，验证面板动作与工具动作走同一实现。

## 9. 仓库合规

- `README.md` 末尾交流群块（跑 `pnpm run contact`，幂等）
- `assets/qq-group.png` + `package.json` 的 `files` 含该图
- `scripts/market-manifest.ts` 加一条（含 `icon` 内联 SVG、`metadata.category`
  建议 `observability`、keywords）
- `skills/vyra-dsh-console/SKILL.md`
- 通过 `pnpm run check:installable` 与 `pnpm run verify`

## 10. 验收标准

1. agent 能通过 `dsh_console` 完成：切模型、改一项设置、启停一个插件、切主题。
2. 权限边界动作被拒绝，且返回原因与替代做法；有测试断言。
3. UI 面板的每个动作与工具走同一份 `core.js` 实现（代码审查确认，无重复逻辑）。
4. 无浏览器连接时，外观类动作返回 `unavailable`，不静默成功。
5. `vyra-console doctor` 在无 profile 写入的情况下输出当前配置摘要。
6. 插件出现在市场索引中，且 `pnpm run verify` 通过。

## 11. 未决问题

- UI 面板的落点（右侧栏 vs 设置页新 tab）留到实现时按 `Slots.listSubTree` 决定。
- 面板是否第一版就要有，还是先只做工具+CLI，面板后补。

**这两个问题在写实现计划前由用户确认。**
