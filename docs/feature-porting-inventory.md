# Lumii → DSH 功能移植清单

来源：`C:/myself/projects/my/open-source/lumii`（灵栖 Lumii，Electron 桌面 AI 伙伴）

判定表三列含义：

- **形态** — `技能` = 纯提示词/脚本，DSH 直接可用；`插件` = 需要新的 Cordis service seam；`不可移植` = 架构不兼容
- **DSH 现状** — DSH 是否已有同类能力
- **工作量** — S / M / L / XL

---

## 一、立即可用：技能（0 工作量）

Lumii 的 `SKILL.md` 格式与 DSH 的 `dsh-skill-filesystem` **完全兼容**：
两者都是 `<name>/SKILL.md` + YAML frontmatter，都要求 `name` + `description`。
DSH 的解析器只取它认识的键（`name` / `description` / `whenToUse` / `metadata` / `invocation`），
Lumii 多出来的 `homepage` / `license` / `metadata.mtbot.*` 被忽略，**不报错**。

> 直接把 `customSkillDirs` 指向 `lumii/apps/windows/bundled-skills/` 即可，零转换。

| # | 技能 | 类别 | 说明 | 注意 |
|---|---|---|---|---|
| 1 | `weather` | 通用 | wttr.in + Open-Meteo，无需 API key | 直接可用 |
| 2 | `coding-agent` | 代码开发 | 委派给 Codex / Claude Code 等外部编码 Agent | 依赖 ACP 后端，DSH 需另配 |
| 3 | `plugin-development` | 代码开发 | 插件开发指引 | 内容是 Lumii 的，需改写成 DSH 的 |
| 4 | `skill-creator` | 技能管理 | 创建/优化/评测技能，含 eval-viewer | 通用，直接可用 |
| 5 | `cli-hub` | 技能管理 | 命令行工具链管理 | 直接可用 |
| 6 | `skillnet` | 技能管理 | 技能商店客户端 | 需改指向本市场 |
| 7 | `docx` | 文档与分析 | Word 读写，含 ooxml 脚本 | 直接可用 |
| 8 | `pdf` | 文档与分析 | PDF 解析 | 直接可用 |
| 9 | `pptx` | 文档与分析 | PPT 生成，含脚本 | 直接可用 |
| 10 | `xlsx` | 文档与分析 | Excel 读写 | 直接可用 |
| 11 | `summarize` | 文档与分析 | URL/播客/本地文件摘要转写 | 直接可用 |
| 12 | `humanizer-zh` | 文档与分析 | 中文去 AI 味 | 直接可用 |
| 13 | `agent-team` | 智能体协作 | 多 Agent 团队协作 | DSH 有 `ctx.subagents` + `team`，需适配 |
| 14 | `Art` | 设计与可视化 | 图像生成工作流（含 Tools/Workflows） | 需接 DSH 的图像生成能力 |
| 15 | `canvas-design` | 设计与可视化 | 海报/艺术品 → PNG/PDF | 直接可用 |
| 16 | `frontend-design` | 设计与可视化 | 前端界面设计 | 直接可用 |
| 17 | `pixelorama` | 设计与可视化 | 像素画 | 直接可用 |
| 18 | `pet-creator` | 设计与可视化 | 桌宠形象生成 | 依赖 Lumii 桌宠，见 §5 |
| 19 | `pet-sprite-h3` | 设计与可视化 | 精灵图生成 | 依赖 Lumii 桌宠，见 §5 |
| 20 | `qwen3-tts-local` | 语音与音频 | 本地 TTS | 见 §4.4 |
| 21 | 小红书流水线（19 个子技能） | 内容创作与发布 | 选题→调研→写作→配图→发布全链路 | 直接可用，但需配平台凭证 |
| 22 | 视频创作（4 个 + 5 个子技能） | 视频创作 | 教学视频/产品宣传/视频流水线 | 依赖视频生成 API，见 §4.5 |
| 23 | `blueteam` | 逆向与复刻 | 把漏洞转成检测规则 | 见 §5 合规说明 |
| 24 | `redteam` | 逆向与复刻 | 对自有站点安全验证 | 见 §5 合规说明 |
| 25 | `reverse` | 逆向与复刻 | 二进制/APK/IPA 逆向分析 | 见 §5 合规说明 |
| 26 | `clone` | 逆向与复刻 | 网页复刻成工程 | 见 §5 合规说明 |

**合计约 50 个技能，其中约 40 个零改动可用。**

---

## 二、需要新插件：DSH 确实没有的能力

这些是**真正值得做成 DSH 插件**的部分——每一项都需要设计一个新的 capability seam 三角色。

### 2.1 模型配置与凭据管理

| 项 | 内容 |
|---|---|
| Lumii 实现 | 多服务商配置（API Key / Base URL / 并发 / 重试策略），`SettingsPage` |
| DSH 现状 | **有** — `ctx.credentials` + `dsh-authorization` + `dsh-agent-default-model`，但**没有图形化的多服务商管理面板** |
| 形态 | 插件（Client UI + Host service） |
| 工作量 | M |
| 价值 | DSH 的模型配置目前偏命令行/配置文件；补一个可视化面板 |

### 2.2 用量与花费统计

| 项 | 内容 |
|---|---|
| Lumii 实现 | `usage-store` / `tool-usage-store`（两张表：累计 + 按日）/ `usage-service` / `UsageChart` |
| DSH 现状 | **部分有** — `ctx.tokenMeter` 提供 token 计量，但官方注明"是用户参考值，**不是计费或门控输入**"；`experimental/client-ui-stats` 有每轮统计，**但没有费用换算、没有跨会话聚合、没有按日趋势** |
| 形态 | 插件（Host 聚合 + Client 图表） |
| 工作量 | M |
| 缺口 | 需要**定价表**（每个 provider/model 的单价），DSH 没有 |

### 2.3 工具/技能/MCP 调用统计

| 项 | 内容 |
|---|---|
| Lumii 实现 | `tool-usage-store`：累计次数 + 失败次数 + 最后使用时间，**带 agent 维度**（按定义 id 归因，非实例 id） |
| DSH 现状 | **没有** — 只有 `tools/result` 事件可观察，无持久化统计 |
| 形态 | 插件（`tools/result` 监听器 + 存储 + Client 展示） |
| 工作量 | S–M |
| 亮点 | 监听 `tools/result` 即可，接口简单；价值是"哪些工具从没用过"可清理 |

### 2.4 Bash 工具进化

| 项 | 内容 |
|---|---|
| Lumii 实现 | `tool-evolution-engine`：近 7 天 bash 命令日志 → 规则聚类 → Top5 高频 → LLM 草拟新工具 → 质量门 → 用户审批。7 天冷却。 |
| DSH 现状 | **没有**，但**有完美落点** — `docs/architecture.md` 明确 `ctx.tools.register()` + `ctx.effect()` 支持运行时注册；`tools/result` 可采集；`ToolExecution.concludeTurn()` 等已有先例 |
| 形态 | 插件（`tools/result` 采集 + 定时挖掘 + 审批流） |
| 工作量 | L |
| 亮点 | DSH 的插件模型天然支持"热注册工具"，这比 Lumii 的直改代码库更干净 |

### 2.5 提示词常驻成本分析

| 项 | 内容 |
|---|---|
| Lumii 实现 | `context-usage-breakdown`：按**分类**拆解上下文占用（系统提示词各章节 / 工具定义 / 对话历史），固定部分用标定字符-token 比，对话历史独立估算 |
| DSH 现状 | **部分有** — `ctx.tokenMeter.measure()` 给出 `nodes`（每个 surface 事件的 token 定价），**但没有按"章节/工具定义"的分类聚合，也没有"常驻成本"这个概念** |
| 形态 | 插件（Client 视图 + 可能扩展 tokenMeter 投影） |
| 工作量 | M |
| 亮点 | DSH 的 `TokenSurfaceNode` 已带 `seq` 和逐节点定价，分类聚合是纯计算 |

### 2.6 反检测浏览器

| 项 | 内容 |
|---|---|
| Lumii 实现 | `cloak-browser-downloader` + `browser-service` + `profiles-service`（多隔离配置文件，防指纹关联） |
| DSH 现状 | **有** `ctx.browserUse`（3 个 provider）和 `ctx.computerUse`（3 个 provider），**没有反检测/指纹隔离** |
| 形态 | 插件（新的 `ctx.browserUse` provider） |
| 工作量 | L |
| 注意 | 需明确合规边界——反检测能力双用途，须有授权上下文 |

---

## 三、需要新插件：Lumii 有、DSH 完全没有

按价值排序。

### 3.1 长期记忆系统 ⭐ 高价值

| 项 | 内容 |
|---|---|
| Lumii 实现 | 三层（工作/短期/长期）+ 分段管线（`segmentation` → `memory-extractor` → `memory-consolidation`）+ `memory-injector` 语义检索注入 + 记忆宫殿可视化 + `soul.md` 人格 |
| DSH 现状 | **完全没有** — 无 `ctx.memory`，无记忆相关包 |
| 形态 | 插件（`agent/pre-step` 注入 + 存储 + 工具） |
| 工作量 | XL |
| DSH 落点 | `docs/architecture.md` 的 `agent.inject()` 是现成的注入通道；`SessionEventMap` 可扩展持久化 |
| 备注 | 这是 Lumii 最厚的模块（19 个源文件），也是 DSH 最大的空白 |

### 3.2 IM 多渠道接入 ⭐ 高价值

| 项 | 内容 |
|---|---|
| Lumii 实现 | 飞书 / 企业微信 / 微信个人 / IPC 四个适配器 + 出站路由 + 会话绑定 |
| DSH 现状 | **有部分基础设施** — `ctx.webhookRuntime`（外部事件 → 创建 Session），**但没有 IM 适配器** |
| 形态 | 插件（webhook provider adapter + 出站发送） |
| 工作量 | L（每个渠道独立） |
| 落点 | DSH 的 webhook seam 是现成的：`register(rule)` + `dispatch(delivery)` |

### 3.3 录屏与字幕

| 项 | 内容 |
|---|---|
| Lumii 实现 | FFmpeg 录制 + 系统音频/麦克风混音 + 旁白生成 + 字幕转写/SRT/烧录 + 标注 |
| DSH 现状 | **没有**（无录屏相关包） |
| 形态 | 插件（`ctx.screenRecord`? + 工具） |
| 工作量 | L |
| 备注 | 教程视频流水线是完整生产线，不止"录一段" |

### 3.4 桌面 UI 自动化增强

| 项 | 内容 |
|---|---|
| Lumii 实现 | 截屏（带坐标映射）+ 点击/输入/滚动 + 标注（框/箭头/文字）+ 窗口激活 + HTTP 服务 + 限流 |
| DSH 现状 | **有** `ctx.computerUse`（含 `cua-windows`） |
| 形态 | 增强 provider，**不建议重做** |
| 工作量 | S（补缺口） |

### 3.5 云同步

| 项 | 内容 |
|---|---|
| Lumii 实现 | 工作区同步到私有 Git 仓库（isomorphic-git），冲突由 Agent 判断 |
| DSH 现状 | **没有** |
| 形态 | 插件 |
| 工作量 | M |

### 3.6 自主进化

| 项 | 内容 |
|---|---|
| Lumii 实现 | 满意度评分 + 能力雷达 + 定期反思 + 目标审批（不自动执行） |
| DSH 现状 | **没有** |
| 形态 | 插件（`agent/turn-stopping` + 定时任务 + 审批） |
| 工作量 | L |
| 备注 | Lumii 自己也标注为"实验功能，默认保守" |

### 3.7 定时任务增强

| 项 | 内容 |
|---|---|
| Lumii 实现 | `at`/`every`/`cron` 三态 + 激活窗口（只在活跃时段跑）+ 流水线 DAG 可视化 + 失败重试 |
| DSH 现状 | **有** `ctx.schedule`（RFC 5545 recurrence）+ `dsh-tool-schedule` |
| 形态 | 增强，**不建议重做** |
| 缺口 | DSH 没有"活跃时段"和"DAG 流水线可视化" |

### 3.8 语音合成 TTS

| 项 | 内容 |
|---|---|
| Lumii 实现 | 三通道：Edge TTS（云端）/ MeloTTS（本地）/ Qwen3-TTS（本地声纹克隆） |
| DSH 现状 | **只有 ASR 方向** — `speech-to-text`、`speech-to-text-sensevoice`、`voice-input`；**无 TTS** |
| 形态 | 插件（`ctx.tts`?） |
| 工作量 | M |
| 亮点 | DSH 的 ASR 已有三角色 seam 先例，照抄结构即可 |

### 3.9 图像/视频生成

| 项 | 内容 |
|---|---|
| Lumii 实现 | RightCodes API + 本地 H3 MiniMax 直连，配置走 `draw-config.json` |
| DSH 现状 | **没有** |
| 形态 | 插件（provider seam） |
| 工作量 | M |

### 3.10 工作区版本快照

| 项 | 内容 |
|---|---|
| Lumii 实现 | `workspace-turn-snapshot`：每轮对话结束自动快照（isomorphic-git 轻量分支）+ 两轮间 diff |
| DSH 现状 | **部分有** — DSH 有 `deliverables`（记录工作区变更）、`session-checkpoint-policy`、`worktree`；**没有 turn 级自动快照** |
| 形态 | 插件（`turn/end` 监听 + git） |
| 工作量 | M |

### 3.11 MCP 预置注册表

| 项 | 内容 |
|---|---|
| Lumii 实现 | 预置 7 个常用 MCP 服务（excel-mcp / 资讯 / 民法典 / 12306 / 机票 / 高德 / ComfyUI）+ 一键启用 |
| DSH 现状 | **有** `dsh-mcp-client`，**没有预置清单** |
| 形态 | 插件（市场条目 + 配置模板） |
| 工作量 | S |
| 备注 | 适合放本市场（bundle 形式） |

### 3.12 ACP 编程助手后端

| 项 | 内容 |
|---|---|
| Lumii 实现 | Claude Code / Codex / Cursor / OpenCode 后端切换 + 一键安装 CLI |
| DSH 现状 | **有** — `packages/acp/acp` 是自动化 ACP 服务端；`dsh-subagent-claude-code` / `dsh-subagent-codex` 是既有先例 |
| 形态 | 增强，**不建议重做** |
| 工作量 | S |

---

## 四、不建议移植

| 项 | 原因 |
|---|---|
| **Live2D 桌宠**（`pet-core` / `pet-asset` / `pet-lab`） | 依赖 pixi.js + Electron 渲染进程。DSH 插件跑在 Cordis 上下文，**没有对应的渲染 seam**。要做只能改 DSH 客户端架构 |
| **三进程 IPC 架构** | Lumii 是 Electron main/preload/renderer；DSH 是 Cordis 插件树。范式不同，**不可逐层搬运** |
| **Lumii 扩展系统**（`plugin-core` / `create-lumii-extension`） | Lumii 自己的 manifest + IPC 注册模型。与 Cordis 插件模型**根本不同**，整体丢弃 |
| **Electron 打包链** | `electron-builder` / NSIS / 签名，DSH 有自己的 `apps/desktop` |
| **客户端 UI 框架**（React 18 + CSS Modules） | DSH 客户端有自己的渲染体系（`packages/client/*`，71 个包） |
| **`@mtbot/*` 包命名** | 命名空间应改为本项目自己的 |

---

## 五、合规边界（重要）

Lumii 的「逆向与复刻」技能组（`clone` / `reverse` / `redteam` / `blueteam`）能力双用途，移植时需保留 Lumii 自己的三条口径：

1. `/redteam` **第一步要用户写 `security/scope.md` 声明归属，没写就不开工** — 这个前置门禁必须保留
2. **不生成免杀载荷、不写 C2、不产出可直接利用的 exploit** — 产物是"洞在哪 + 怎么检测 + 怎么修"
3. **复刻只做外观与交互**，产物是正常 Next.js 工程 + 合规声明

反检测浏览器同理——需明确授权上下文，不能作为默认能力分发。

---

## 六、建议的实施顺序

按「价值 ÷ 工作量」排：

| 阶段 | 内容 | 理由 |
|---|---|---|
| **P0** | 挂载 `customSkillDirs`，跑通 50 个技能 | 0 工作量，立刻验证兼容性 |
| **P1** | 工具调用统计 + 提示词常驻成本分析 | 接口简单（监听 `tools/result`）、价值直接、DSH 确实缺 |
| **P2** | 用量与花费统计 | 需先设计定价表 |
| **P3** | 长期记忆系统 | 最大空白，但 XL，需要单独设计 |
| **P4** | IM 渠道 | DSH 有 webhook seam 可复用 |
| **P5** | TTS / 图像生成 | 照抄 DSH 已有 ASR seam 的结构 |
| **P6** | bash 工具进化 | 概念好，但需要采集+LLM+审批全链路 |
| **P7** | 录屏 / 云同步 / 自主进化 / 工作区快照 | 按需 |

---

## 七、待确认

1. **技能共享还是复制？** 直接指向 `lumii/apps/windows/bundled-skills/` 省事但耦合；复制进本仓库能独立演进但要同步
2. **P1 优先做哪个？** 我推荐「工具调用统计」——最小、最快见效
3. **定价表从哪来？** 用量与花费依赖每个 provider/model 的单价，DSH 没有这个数据
4. **逆向技能组要不要移？** 涉及双用途，建议单独决定
