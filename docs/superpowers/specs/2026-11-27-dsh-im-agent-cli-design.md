# DSH-IM Agent CLI 化与会话分组 — 设计文档

- 日期：2026-11-27
- 目标插件：`plugins/dsh-im`（包名 `@lanxiake/dsh-im`，版本 5.13.0 → 6.0.0）
- 状态：等待用户 review
- 相关文档：`PROACTIVE_DELIVERY.md`（现有对外通道）、`docs/preset-workspaces.md`（Preset 分组）

---

## 1. 目标与成功标准

用户是三件事一起提的，本质是**把 DSH-IM 变成一个「Agent 可以像人一样操作」的插件**，并修掉会话全部堆在「未分组」的问题。

| # | 目标 | 成功标准（可验证） |
| --- | --- | --- |
| G1 | Agent 能通过 CLI 完成 DSH-IM 的配置管理 | 在不打开浏览器、不依赖 DSH 登录态的前提下，`dsh-im accounts / targets / target / settings / send` 全部能跑通并返回结构化 JSON |
| G2 | Agent 能通过 CLI 给用户发消息 | `dsh-im send --account <账号名> --target <targetId> --text ...` 成功投递；错误码与现有 `DeliveryService` 一致 |
| G3 | Agent 能查到「账号名 → targetId」的映射 | `dsh-im accounts` 返回账号显示名 + 渠道 + botId；`dsh-im targets --account <名>` 返回 targetId + 显示名 + 类型 |
| G4 | IM 新会话落到 `DSH-IM` 分组 | 新会话在侧栏出现在 `DSH-IM` 分组下，而不是「未分组」 |
| G5 | 已与上游分叉 | `package.json` 版本号、`docs/fork.md`、安装来源三者一致地表明这是独立仓库 |

**明确不做**：让 Agent 修改访问策略、凭据、删除机器人（见 §6.3）。

---

## 2. 现场事实（本次动手前实测）

以下是我在写这份文档之前读取本机与仓库得到的结论，它们是方案的前提：

1. **本地 `plugins/dsh-im` 与上游 `lanxiake/dsh-vyra-plugins@c0c8950` 逐字节相同**（`src`、`plugin-src`、`bin`、`skills`、`scripts`、`lib`、`assets`、`docs` 全等），版本 `5.13.0`。
2. **本机 profile 里装的是 `@xmanrui/dsh-im@5.10.0`**（旧上游），不是仓库代码。已在本次会话中把该包从 `~/.dsh/profiles/desktop/node_modules/@xmanrui/dsh-im` 删除，待重新安装。
3. **`~/.dsh/integrations/dsh-im/delivery-http.json` 指向 `127.0.0.1:3080`（过期）**，实际 GUI 在 `:52671`，且该路由要求 DSH 浏览器登录态（直连返回 401）。因此现有的 `dsh-im` CLI 在本机完全不可用。
4. **IM 会话未注册任何工作区**：`~/.dsh/storages/workspace.json` 中不存在 `~/.dsh/im`，所以全部落「未分组」。
5. 各渠道 Controller 暴露的方法在 14 个渠道上基本一致：`status()`、`reconnectBot(botId)`、`updateWorkspace/updateModel/updateAgentPreset/updateAlias/updateBusyMessageMode/updateContextEnhancement/updateAccessPolicy(botId, value)`、`sendConnectionTest(botId)`、`deleteBot(botId)`。
6. `plugin-src/host/index.mjs` 已通过 `ctx.provide('dshIm', ...)` 暴露 12 个方法（`contractVersion: 1`），**缺 `updateTarget` / `deleteTarget`**，而浏览器 RPC 有。

---

## 3. 总体架构

```
┌─────────────────────────────── Agent / 用户 ───────────────────────────────┐
│  浏览器设置页 ──▶ Connection RPC  ┐                                          │
│  Agent 工具 ─────▶ dsh_im_*       ├──▶ 各渠道 Controller / DeliveryService    │
│  第三方插件 ─────▶ ctx.dshIm      ┘        （唯一真源，校验只有一份）           │
│  Agent / 脚本 ───▶ dsh-im CLI ──▶ agent-api.mjs（本地直连，新增）             │
│  外部脚本 ───────▶ HTTP（保留，见 §5.4）                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**核心原则（来自 DSH 官方 `user-actions.md`）**：一个操作、多个调用方 —— CLI 不重写校验，直接复用 Controller / DeliveryService 的现有方法。`agent-api.mjs` 只是一张**方法表**，把散落在 14 个渠道里的同名方法集中起来，按 `botId` 路由。

---

## 4. 需求 7：账号名与目标的暴露

这是本轮被用户纠正过的关键点，语义是：

> **名称给人记，ID 给调用用。** Agent 需要 `账号名（或 botId）` + `targetId` 才能建立映射并发送。

### 4.1 CLI 输出契约

`dsh-im accounts --json`

```json
{
  "accounts": [
    {
      "accountName": "我的微信",
      "accountNameSource": "alias",
      "channel": "weixin",
      "botId": "wx_919f259577ca904002bbb196",
      "connected": null,
      "state": "unknown"
    }
  ],
  "warnings": []
}
```

- **`accountName` 的离线取值优先级**：`workspaces.json` 的 `aliases[botId]` → **`config.json` 的 `bots[].botName`** → channel 的中文标签。
  - 真实数据佐证：飞书 `config.json` 有 `"botName": "zxsc-dsh"`，微信走扫码、`config.json` 里没有昵称，只能落到标签。
  - `accountNameSource` 取值 `alias | botName | channel`，让 Agent 知道这个名字有多可靠。
- `describeAccount()`（实时平台昵称）**只在 Host 在线时**用于增强，失败静默降级，**不阻塞离线路径**。
- `connected` / `state` 在离线时为 `null` / `"unknown"`；Host 在线时填真实值。
- `accountName` 允许重复。**同名时所有写操作都要求用 `botId` 消除歧义**，并报 `ambiguous-account`（附所有候选 botId）。

`dsh-im targets --account 我的微信 --json`

```json
{
  "accountName": "我的微信",
  "channel": "weixin",
  "botId": "wx_919f259577ca904002bbb196",
  "targets": [
    { "targetId": "o9cq801...@im.wechat", "targetName": "我的微信", "kind": "user" }
  ]
}
```

**`warnings`（需求 7 的配套）**：当某个 `targetName` 与它所属的 `accountName` 相同，输出
`"目标名与账号名相同（均为「我的微信」），建议在设置页给目标起一个可区分的名字"`。
真实数据里就存在这种情形——微信账号与其唯一私聊目标都叫「我的微信」，Agent 无法凭名字分辨“发给谁”。
这条提示同时写进 `dsh-im-accounts` skill，让 Agent 在给用户连接新账号时**主动建议改名**。

### 4.2 平台原始 ID 的处理

- `targetId` **一律返回**（它是发送必需的）。
- 平台原始路由（如 openId、`chatId`、`toUserId`）**默认不返回**；用户已授权与平台 ID 等价的 `targetId` 暴露，但路由对象没有额外价值。
- 提供 `--with-routes` 显式开关返回 `route`，供排障使用。默认关闭的理由：路由结构因渠道而异，暴露给模型只会诱导它猜测未注册的地址。

### 4.3 离线数据源（CLI 读什么）

CLI 不启动渠道连接、不读凭据，只读两类文件：

| 文件 | 提供 | 缺省时 |
| --- | --- | --- |
| `integrations/dsh-<channel>/config.json` | `bots[]`：`botId`、`botName` | 该渠道无账号，跳过 |
| `integrations/dsh-<channel>/workspaces.json` | `aliases`、`workspaces`、`deliveryTargets`、`accessPolicies` | 视为空文档，不报错 |

**关键约束**：`workspaces.json` 里**没有机器人列表**——`aliases`/`models` 都以 `botId` 为键，但“哪些 bot 存在”只有 `config.json` 的 `bots[]` 和数据目录知道。所以 `accounts` 必须**同时读两个文件**，只读 `workspaces.json` 会得到空列表。

写操作走 HTTP（§5.4），因为写需要 Host 已经加载的 `BotWorkspaceStore` 写队列与校验。

---

## 5. 需求 1：CLI + skill

### 5.1 命令树（最终）

```
dsh-im
├── accounts                    # 离线可读：accountName / source / channel / botId
├── targets --account <名|botId># 离线可读：targetId / targetName / kind
├── send       --account ... --target <targetId|targetName> (--text|--stdin) [--format] [--idempotency-key]
├── send-file  --account ... --target <targetId|targetName> --file <path> [--image]
├── target
│   ├── create --account ... --target <targetId> --name <名> --kind <user|group> [--route <json>]
│   ├── update --account ... --target <targetId|targetName> --name <名> [--route <json>]
│   └── delete --account ... --target <targetId|targetName>
├── settings get --account <名|botId>
├── settings set --account <名|botId> --key <k> --value <v>
│   # 允许的 key：workspace / agentPreset / model / alias / busyMessageMode / contextEnhancement
├── sessions list --group DSH-IM   # 只读：列出该分组下的会话，供核对
├── login-hint                   # 只打印「请到设置页扫码」，不连 GUI
├── endpoint                     # 打印 DSH host:port（诊断用）
├── install / uninstall          # 保留
└── --json                       # 所有命令支持
```

**`--account` 解析**：先按 `accountName` 精确匹配 → 再按 `botId` 精确匹配 → 无匹配 `unknown-account` → 多匹配 `ambiguous-account`。
`--bot` 保留为 `--account` 的别名（兼容既有脚本，不做破坏性变更）。

**`--target` 解析**（两段，单独实现）：先按 `targetId` 精确匹配 → 再按 `targetName` 精确匹配 → 无匹配 `unknown-target` → 多匹配 `ambiguous-target`（附所有候选 `targetId`）。
**名称解析只允许用于 `--target` 参数**；`target create` 的 `--target` 是新建的 `targetId` 原文，不解析。

**离线 / 在线分工**：`accounts`、`targets`、`login-hint`、`endpoint` 在 DSH 未运行时可用；`send`、`send-file`、`target *`、`settings *` 走 HTTP，要求 DSH 在运行。DSH 未运行时报 `unreachable`，并提示「发送与修改配置需要 DSH 正在运行」。

### 5.2 `agent-api.mjs` 的定位

**离线只读投影**，不是 Host 的替身：

- 只读文件（§4.3），**不构造 Controller、不读凭据、不发起网络请求**。
- 输出上面 §4.1 的公开投影；校验仍然只有一份——写在 Host 里，因此**所有写操作走 HTTP**。
- CLI 通过 `import` 直接调用它，**不经过 HTTP、不需要浏览器登录态**。

> **为什么不能本地写**：`BotWorkspaceStore` 有写队列、incarnation 围栏、原子 `tmp→rename` 持久化；`Controller` 依赖 Host 注入的 `connection`/`credentials`/`typertGateway`。在 CLI 进程重建这些等于制造第二个真源。

### 5.3 skill 拆分

| skill | 作用 | 状态 |
| --- | --- | --- |
| `dsh-im-delivery` | Agent 主动发消息 / 发文件 | 保留；去掉「用 `dsh-im` CLI 时先跑 endpoint」的过期段落 |
| `dsh-im-accounts`（新） | 账号与目标查找映射；**名称歧义**的处理；连接新账号时建议给目标改名 | 新增 |
| `dsh-im-manage`（新） | 配置管理两条路：CLI（`settings set`）与 IM 命令（`/workspace`、`/model`、`/preset`…）；明确**不能改**的策略项 | 新增 |

`plugin-src/host/skills.mjs` 的 `installDeliverySkill` 改为**扫描整个 `skills/` 根目录**（现在硬编码只挂 `dsh-im-delivery`）。

**`dsh-im-manage` 必须覆盖「两条路」（用户第 7 轮第 3 条）**：同一个配置项，CLI 与 IM 命令等价，但生效时机不同——

| 想做的事 | 在 Agent 里（CLI） | 用户自己在 IM 里（命令） |
| --- | --- | --- |
| 换工作区 | `dsh-im settings set --key workspace --value <绝对路径>` | `/workspace <序号或路径>` |
| 换模型 | `settings set --key model --value provider/model` | `/models` → `/model <序号>` |
| 换 Agent Preset | `settings set --key agentPreset --value <id>` | `/presetlist` → `/preset <序号>` |
| 改别名 | `settings set --key alias --value <名>` | 设置页卡片 |
| 新会话 | —（下次消息自然新建） | `/new` |
| 绑定已有会话 | — | `/session <Session ID>` |

skill 里要说清：**CLI 改的是机器人默认值，只影响之后新建的 Session**；`/workspace`、`/model` 有“当前会话 vs 机器人默认”的区分，需要具体会话生效时由用户在 IM 里操作。

### 5.4 HTTP 通道

**保留**（用户第 3 条）。`delivery-http.mjs`、`/api/dsh-im/delivery/{messages,files,query}` 与 curl 文档全部不动。CLI 本地直连是**新增**路径，不替换 HTTP。

### 5.5 `ctx.dshIm` 扩展

补 `updateTarget(botId, targetId, target)` 与 `deleteTarget(botId, targetId)`，`contractVersion: 1 → 2`，**所有 v1 字段保持不变**。理由：`vyra-xianyu-delivery/lib/notify.js` 正在用 `listBots/listTargets/send`，破坏它就是跨插件回归。

---

## 6. 安全边界

### 6.1 Agent 可以做

- 读：账号、目标、连接状态、机器人设置、目标建议（`listSuggestions`）。
- 写：创建/修改/删除**投递目标**；修改**工作区、Agent Preset、模型、别名、消息处理模式、上下文增强**。
- 发：文本、文件。

### 6.2 Agent 不可以做（`user-only-action`）

| 动作 | 原因 |
| --- | --- |
| 修改 `accessPolicy`（谁能给机器人下命令） | 这是授信动作，等于放宽访问控制 |
| 绑定 / 解除凭据、扫码登录 | 需要用户在设备上完成 OAuth/扫码 |
| 删除机器人 | 不可逆，且会连带删除其工作区与目标 |

这些方法在 `agent-api.mjs` 里**不存在**，CLI 遇到会返回 `user-only-action` 并给出「请到设置页操作」的引导（配合用户已在用的「打开设置页」插件，无需本插件改造）。

### 6.3 审计

所有经 `agent-api.mjs` 的**写操作**写一条结构化日志：
`[dsh-im:audit] actor=agent method=<m> bot=<botId> target=<targetId> result=ok|fail`。不记录消息正文。

---

## 7. 需求 2：会话分组

### 7.1 机制

DSH 侧栏的分组来自 Harness 的 workspace registry。插件启动时：

1. 确保目录 `~/.dsh/im` 存在；
2. 复用**已有的** `ensurePresetWorkspace` 模式：`harness.rpc('workspace.list')` → 命中则**原样保留用户改过的标题** → 未命中才 `workspace.create(path)` + `workspace.rename(id, 'DSH-IM')`；
3. 之后所有 `cwd` 为该目录的新会话自动出现在 `DSH-IM` 分组。

**不复用 `preset-workspaces.mjs` 本身**，因为它带 `isUngroupedWorkspace` 前置判断和 `presets/<id>` 目录构造，与这里语义不同；但**照抄它的两处正确行为**：先 `list` 再决定是否 `create`、`existing.title !== title` 时保留用户标题。

**`~/.dsh/im` 与 `config.workspace` 的关系**：只有**仍使用默认目录**的机器人受影响。已把工作区改成别的路径的机器人，其会话进入各自目录对应的分组，不被 `DSH-IM` 收编。

**分组生命周期（保留，不释放）**：插件卸载、停用或 `sessionGroup` 被改成 `off` 时，**不删除、不释放**已注册的 `DSH-IM` 工作区，也不移动会话。理由（用户第 3 轮明确要求「保留分组」）：分组是用户的侧栏结构，会话里有聊天历史；插件退出不应该让用户的会话突然从分组里消失、或让分组标题被重置。重新启用插件时 `list` 命中已存在的工作区并保留标题，因此不会重复注册。

### 7.2 配置项

Host 配置新增 `sessionGroup`：

| 值 | 行为 |
| --- | --- |
| `DSH-IM`（**默认**） | 按上文注册分组 |
| `off` | 不注册，保持「未分组」 |
| 任意字符串 | 用该标题注册分组 |

`groupByAgentPreset: true` 优先级更高：已选 Preset 的机器人仍走 `presets/<id>` 分组，不受 `sessionGroup` 影响。

### 7.3 旧会话

- **不迁移**（用户第 5 条）：已存在的未分组 IM 会话位置不变，继续留在「未分组」。
- 提供 `dsh-im sessions list --group DSH-IM`：只读，列出当前挂在 `DSH-IM` 分组下的会话（sessionId + 标题），给用户核对。
- 用户想清掉旧会话时自行在侧栏归档；插件**不提供批量归档命令**，避免一条命令误删大量会话。

### 7.4 实现位置

新增 `plugin-src/host/session-group.mjs`，在 `activateChannels` 之前调用，通过 `harness.rpc('workspace.list'/'workspace.create'/'workspace.rename')` 接入；失败只记日志，不阻塞渠道启动。

### 7.5 文档同步（必须改，不能只改代码）

| 文件 | 要改的地方 |
| --- | --- |
| `README.md` | 「默认目录与未分组会话」一节的 **「插件不会为该目录创建工作区分组」** 已不成立 |
| `README.en.md` | 同上英文版 |
| `docs/机器人命令.md` | `/sessions` 说明里「默认 IM 目录也包含其中的未分组会话」 |
| `docs/preset-workspaces.md` | 补一段 `sessionGroup` 与 `groupByAgentPreset` 的优先级关系 |

不改文档 = 用户会照着文档以为会话还在未分组，并报 bug。

---

## 8. 其他优化

| # | 问题 | 改动 |
| --- | --- | --- |
| O1 | `dsh_im_send_file` 描述写「目前仅飞书」，实际 6 个渠道支持 | 描述改为按 `describeAccount().capabilities` 动态生成或统一为「支持主动文件的渠道」，与 `PROACTIVE_DELIVERY.md` 表格一致 |
| O2 | 工具描述没有提示「你正在这个 IM 会话里」 | `dsh_im_send_message` 描述补一句：先检查当前会话来源，避免重复发 |
| O3 | `skills.mjs` 只挂一个 skill | 改为扫描整个 `skills/` 根目录 |
| O4 | CLI 地址发现依赖过期的 `delivery-http.json` | 新增本地直连后，该文件仅用于 `endpoint` 诊断输出 |
| O5 | 配置变更无审计 | 见 §6.3 |

---

## 9. 分叉与升级

1. `package.json` 版本 `5.13.0 → 6.0.0`；`description`/`repository` 保持本仓库。
2. 新增 `docs/fork.md`：声明本仓库的 dsh-im 不再同步 `xmanrui/dsh-im` 与上游 commit；后续若需上游修复，手动 cherry-pick，不做版本跟踪。
3. 重新安装到 profile：用工作区路径安装（`dsh plugin --profile desktop add -w <本地路径>`），保证改完即可验证。

---

## 10. 验证计划

分两组：**离线组**不启动 Host，任何机器上都能跑；**宿主组**需要真实 DSH 与已配置的机器人。

### 离线组

| 验证 | 方式 | 判定 |
| --- | --- | --- |
| 渠道注册表 | `scripts/verify-agent-cli.mjs`：渠道数、标签、数据目录名 | 通过 |
| 账号/目标解析 | 同上：重名、别名撞 botId、`--target` 按名解析与歧义 | 通过 |
| 离线投影 | 同上：用**固定样例文件**（`config.json` + `workspaces.json`）断言 `accounts`/`targets` 输出，含 `accountNameSource` 与目标名歧义告警 | 通过 |
| 分组注册 | `scripts/verify-session-group.mjs`：首次注册、二次复用保留标题、`off` 不注册、无 registry 软失败 | 通过 |
| Agent 工具契约 | `scripts/verify-agent-tools.mjs`：三个 skill 挂载 + front matter、描述措辞 | 通过 |
| 打包完整性 | `scripts/verify-package.mjs`：版本 6.0.0、新文件进 `files`、`dshIm` v2 | 通过 |
| 既有回归 | `verify-cli.mjs`、`verify-service-file.mjs`、`verify-idempotency.mjs` | 通过 |

### 宿主组

| 验证 | 方式 |
| --- | --- |
| 本地 CLI | 真实安装后 `dsh-im accounts --json` 输出本机微信/飞书账号；`--json` 单文档、exit 0 |
| 分组 | `~/.dsh/storages/workspace.json` 出现 `DSH-IM`；新 IM 会话落在该分组 |
| 设置页冒烟 | Edge headless 跑 `verify-model-setting.mjs` |
| 发消息 | `dsh-im send --account <名> --target <targetName> --text ...` 实测到达 |

**不在本次范围**：`verify-injected-context.mjs`、`verify-lan-management.mjs`、`verify-interface-language.mjs` —— 它们需要指定 DSH 安装路径并拉起真实 Host，属于发布前检查，不是本次改动的验证项。

---

## 11. 风险与回滚

| 风险 | 处理 |
| --- | --- |
| CLI 读到过期的配置 | 只读投影每次调用都重新读文件，不做缓存；写操作一律走 Host，避免“CLI 改了文件而 Host 内存没变” |
| 同名账号导致误发 | 账号与目标都要求唯一匹配，否则分别报 `ambiguous-account` / `ambiguous-target` 并列出候选 |
| 目标名与账号名相同（真实存在） | `accounts` / `targets` 返回 `warnings`，skill 要求 Agent 建议用户改名 |
| `--target` 按名解析撞上重名目标 | 拒绝并给出全部候选 `targetId`，不猜 |
| 删除目标影响其他插件 | `vyra-xianyu-delivery` 引用的是 `botId+targetId`，删除后收到 `unknown-target`，与现状一致 |
| 分组行为改变用户侧栏 | `sessionGroup: off` 一键回退；不迁移旧会话；只影响仍使用默认目录的机器人 |
| 卸载后分组仍在 | **预期行为**（§7.1）；分组只是指向 `~/.dsh/im` 的侧栏条目 |
| 文档与实现不一致 | §7.5 列出的四处文档必须同批修改，验证脚本检查 README 不再出现「不会为该目录创建工作区分组」 |

---

## 12. 交付顺序

1. 分叉与升级（§9）→ 2. `agent-api.mjs` 离线投影（§4.3、§5.2）→ 3. CLI 命令树（§5.1）→ 4. `sessionGroup`（§7）→ 5. skills 三件套含「两条路」（§5.3）→ 6. `ctx.dshIm` 扩展（§5.5）→ 7. 其他优化（§8）→ 8. 文档同步（§7.5）→ 9. 验证（§10）。
