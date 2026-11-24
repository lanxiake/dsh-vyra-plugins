# open-design — OpenDesign 技能库（按业务领域分包）

把 [OpenDesign](https://github.com/nexu-io/open-design) 的完整技能库接进 DeepSeek Harness，并按**业务领域**切成九个包：只开启你要用的领域，技能与 Agent 一起进来。

| 类别 | 数量 | 内容 |
| --- | --- | --- |
| 工艺技能 | 85 | 界面设计、动效、视频、演示、社媒、写作、品牌、前端、质检 |
| 设计系统契约 | 152 | 每套一套完整视觉令牌（Apple、Stripe、Linear、Swiss、Brutalist…） |

## 安装

```sh
dsh plugin --profile web add open-design
```

重启 DSH 后，启用的领域会出现在技能目录里。

## 九个领域

| id | 名称 | 技能 | 默认 |
| --- | --- | --- | --- |
| `od-visual-design` | 视觉设计 | 12 + 152 套设计系统 | ✅ |
| `od-motion` | 动效设计 | 13 | ✅ |
| `od-video` | 视频制作 | 17 | — |
| `od-presentation` | 演示汇报 | 10 | ✅ |
| `od-social-content` | 社媒图文 | 7 | — |
| `od-writing` | 内容写作 | 8 | ✅ |
| `od-brand` | 品牌资产 | 8 | — |
| `od-frontend` | 前端实现 | 6 | — |
| `od-review` | 质检审核 | 4 | — |

默认开 4 个高频领域，其余按需开启。每个技能只属于一个领域，九包合起来恰好覆盖全部 85 个工艺技能。

## 开关领域

```sh
odx domains list                 # 看九个领域与开关状态
odx domains enable od-video      # 开启（可一次给多个 id）
odx domains disable od-motion    # 关闭
odx domains enable-all           # 全开
odx domains disable-all          # 全关
odx agents list                  # 看已生成的 Agent
odx sync                         # 按当前配置重新同步
```

关掉一个领域会**删掉它的技能目录**，模型立刻看不到；重开则恢复。

配置存在 `$DSH_HOME/open-design/domains.json`，也可以手工编辑：

```json
{
  "version": 1,
  "enabled": ["od-visual-design", "od-motion", "od-presentation", "od-writing"]
}
```

文件损坏会自动回退到默认四个并留一份 `.bak`；写了不认识的领域 id 会被忽略并提示。

## Agent 与调用限制

每个领域配一个同名 Agent；另有一个编排 Agent **`od-director`（设计总监）**。

| Agent | 作用 |
| --- | --- |
| 九个领域 Agent | 各管一摊，`skills` 只含本领域技能 |
| `od-director` | 承接复合任务，拆解后派给领域 Agent，汇总验收 |

### 领域 Agent 不能互相调用

九个领域 Agent **不带 `delegation` 能力**，它们既不能互调，也不能再派子 Agent。跨领域的事交给 `od-director`。

这是刻意的：如果「视觉设计」能把活转给「动效设计」，「动效设计」又能转回来，任务就会在两者之间来回踢皮球。

### 别的 Agent 怎么调到它们

靠 `od-director` 的 `team` 字段。`vyra-agent-manager` 会把 `team` 展开成 `subagent` 工具的 `allowedAgentPresets` 白名单，`od-director` 因此**机制上**获得派发能力——不是靠提示词点名。

关掉某个领域时，它会同时从 `od-director` 的 `team` 里移除，编排层就够不到它了。

### ⚠️ Agent Teams 不支持

`dsh-agent-teams` 的 `spawn_teammate` **不支持 `agentPreset` 参数**，团队成员继承 Lead 的配置。所以**不要**用 `agent_teams_add_member` 挂这些领域 Agent。

能用的是：新建会话时直接选某个领域 Agent，或选 `od-director` 让它派发。

## 目录结构

```
plugins/open-design/
├── index.js              # 插件入口：挂载时同步并注册 Agent
├── domains.mjs           # 九个领域定义与技能归属（唯一数据源）
├── skills.mjs            # 技能发现 + 单领域 SKILL.md 渲染
├── config.mjs            # domains.json 读写与容错
├── agents.mjs            # 领域 Agent 与编排 Agent 的规格生成
├── sync.mjs              # 磁盘事务：写技能目录、写 Agent、清理
├── cli.mjs + bin/odx     # odx 命令
├── lifecycle.test.mjs    # 测试
├── cordis.patch.yml
└── vendor/open-design/   # 上游原样副本，勿改
    ├── skills/                       # 85 个工艺技能
    └── design-system-skills/         # 152 个设计系统契约
```

生成到磁盘的内容：

```
$DSH_HOME/skills/od-<领域>/SKILL.md          每个启用领域一个索引页
$DSH_HOME/agent-manager/presets/od-<领域>/   领域 Agent
$DSH_HOME/agent-manager/presets/od-director/ 编排 Agent
$DSH_HOME/open-design/domains.json           开关配置
```

## 二次开发

`vendor/open-design/` 保持上游原样，方便区分「上游内容」与「我们改的东西」。要改行为，改 `domains.mjs`（领域归属）或 `agents.mjs`（Agent 提示词）。

改完自检：

```sh
node plugins/open-design/lifecycle.test.mjs plugins/open-design
```

或在仓库根目录跑 `pnpm run test:open-design`。

测试覆盖：领域表分区（85 个技能恰一次、无重复无遗漏）、单领域渲染、配置容错（缺失/损坏/未知 id/空列表）、Agent 规格（含 `summary` ≤600 与 `usage` ≤1200 的工具上限）、同步幂等与关闭即删、CLI 全部命令、宿主接线（有/无 `pluginManager`、注册失败不崩）。

若要新增一个技能到某个领域，必须同时从原领域移除——分区测试会拦住重复分配。

## 许可

插件外壳 MIT（`LICENSE`）；`vendor/open-design/` 下技能内容保留各自许可，Apache-2.0 与 MIT 兼有。来源与逐项许可见 `NOTICE.md`。

OpenDesign 声明：引用品牌的设计系统包是**美学灵感**，不是官方品牌资产。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>