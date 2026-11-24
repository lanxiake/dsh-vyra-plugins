# OpenDesign 按业务领域分包设计

日期：2026-11-24
状态：待实现

## 背景

`plugins/open-design` 把上游 237 个技能（85 个工艺技能 + 152 个设计系统）接入了 DeepSeek Harness。当前实现把它们聚合成**一个** `opendesign` 技能：一个约 51KB 的索引表整体进入模型上下文。

这带来两个问题：

1. 用户一次性用不到 237 个技能，但索引已经全部占用上下文；
2. 用户没有任何开关能力，只有 `enabled: true/false` 全开全关。

## 目标

按**业务领域**把技能切成 9 个包，每包绑定一个 agent preset。用户按领域开启/关闭，只加载用得到的。

## 非目标

- 不为 152 个设计系统单独切领域（会让开关爆炸，整体挂在「视觉设计」下）。
- 不重写上游技能内容，`vendor/open-design/` 保持原样。
- 不引入可视化面板（本期用 JSON 配置 + CLI）。

## 领域划分

九个领域，每个 = 1 个 agent preset + 一批技能。

| id | 显示名 | agent preset | 技能数 | 默认 |
|---|---|---|---|---|
| `od-visual-design` | 视觉设计 | `od-visual-design` | 12 ＋ 152 设计系统 | 开 |
| `od-motion` | 动效设计 | `od-motion` | 13 | 开 |
| `od-video` | 视频制作 | `od-video` | 17 | 关 |
| `od-presentation` | 演示汇报 | `od-presentation` | 10 | 开 |
| `od-social-content` | 社媒图文 | `od-social-content` | 7 | 关 |
| `od-writing` | 内容写作 | `od-writing` | 8 | 开 |
| `od-brand` | 品牌资产 | `od-brand` | 8 | 关 |
| `od-frontend` | 前端实现 | `od-frontend` | 6 | 关 |
| `od-review` | 质检审核 | `od-review` | 4 | 关 |

合计 85 个工艺技能（另有 152 个设计系统整体归入「视觉设计」）。

### 逐领域技能清单

**`od-visual-design` 视觉设计**（12）
frontend-design、design-taste-frontend、design-taste-frontend-v1、minimalist-ui、industrial-brutalist-ui、high-end-visual-design、redesign-existing-projects、stitch-design-taste、gpt-taste、design-brief、impeccable-design-polish、emil-design-eng ＋ `design-system-skills/` 全部 152 个

**`od-motion` 动效设计**（13）
gsap-core、gsap-timeline、gsap-scrolltrigger、gsap-react、gsap-plugins、gsap-performance、gsap-utils、gsap-frameworks、animate、ui-animation、emilkowalski-motion、motion-lab、review-animations

**`od-video` 视频制作**（17）
video-hyperframes、motion-design、huashu-art-motion、oil-motion、chat-motion-overlay、frame-glitch-title、frame-light-leak-cinema、frame-liquid-bg-hero、frame-logo-outro、frame-macos-notification、frame-data-chart-nyt、frame-flowchart-sticky、vfx-text-cursor、8-bit-orbit-video-template、after-hours-editorial-template、swiss-user-research-video-template、weread-year-in-review-video-template

**`od-presentation` 演示汇报**（10）
ppt-keynote、deck-swiss-international、deck-open-slide-canvas、deck-guizang-editorial、html-ppt-retro-quarterly-review、swiss-creative-mode-template、digits-fintech-swiss-template、editorial-burgundy-principles-template、field-notes-editorial-template、data-report

**`od-social-content` 社媒图文**（7）
card-twitter、card-xiaohongshu、social-x-post-card、social-reddit-card、social-spotify-card、poster-hero、mockup-device-3d

**`od-writing` 内容写作**（8）
article-magazine、doc-kami-parchment、faq-page、release-notes-one-pager、resume-modern、writing-guidelines、research-decision-room、full-output-enforcement

**`od-brand` 品牌资产**（8）
brandkit、brand-extract、creative-director、reference-design-contract、library-curator、ecommerce-image-workflow、imagegen-frontend-web、imagegen-frontend-mobile

**`od-frontend` 前端实现**（6）
image-to-code、web-clone、login-flow、agent-browser、hatch-pet、od-next-media-inputs

**`od-review` 质检审核**（4）
web-design-guidelines、pptx-html-fidelity-audit、pr-feedback-quality-gate、export-download-debugging

默认开启 4 个：`od-visual-design`、`od-motion`、`od-presentation`、`od-writing`。

### 技能归属的唯一性

每个技能**只能属于一个领域**，避免同一个技能出现两次索引。跨领域复用的技能按「谁最常调用」归入：

- `reference-design-contract` → 品牌资产（用于把模糊需求固化为契约）
- `full-output-enforcement` → 内容写作（防止长文/长代码被截断）
- `review-animations` → 动效设计（审查动效代码）
- `agent-browser` → 前端实现（浏览器自动化测试）

实现时需要一个校验：9 个领域的技能集合两两不相交，且并集等于 85 个工艺技能的全体。该断言已用脚本对真实技能名核对通过（85 / 85 覆盖，0 重复、0 遗漏、0 虚构）。

## 配置与存储

单一真相文件：`$DSH_HOME/open-design/domains.json`

```json
{
  "version": 1,
  "enabled": ["od-visual-design", "od-motion", "od-presentation", "od-writing"]
}
```

- 文件不存在时，按默认 4 个领域初始化并写盘。
- 文件损坏时，回退到默认值并在日志中警告，**不抛出**。
- 未知领域 id 在 `enabled` 中被忽略（未来版本删除领域时不至于让旧配置报错）。

## 生成产物

插件挂载时（以及 CLI 每次执行后），按 `domains.json` 同步磁盘：

```
$DSH_HOME/skills/od-<domain>/SKILL.md     只为本期启用的领域生成，关闭即删除
$DSH_HOME/agent-presets/od-<domain>/      仅当启用时存在的 agent preset
```

关键行为：

- **关闭 = 彻底不加载**：删除对应目录，模型完全看不到该领域技能。
- **幂等**：重复执行产生逐字节相同的文件，不触碰 mtime。
- **事务性**：先写临时目录再原子替换，避免半写状态被技能 watcher 读到。

### 聚合技能的规模

每个领域的 `SKILL.md` 只含本领域技能索引：

| 领域 | 预计大小 |
|---|---|
| 视觉设计（含 152 设计系统） | 约 32KB |
| 其余 8 个领域 | 1–4KB |

对比现状的单个 51KB，默认 4 个领域合计约 40KB，且用户能按需进一步缩小。

## CLI

命令名 `odx`，随插件 `bin/` 分发。

```
odx domains list                列出九个领域、启用状态、技能数
odx domains enable <id...>      启用（可多个）
odx domains disable <id...>     关闭（可多个）
odx domains enable-all
odx domains disable-all
odx sync                        按当前配置重新同步磁盘
odx agents list                 列出已生成的领域 agent 与编排 agent
odx domains list --json         机器可读
```

- 每次写操作后立即同步磁盘（技能目录 + agent preset），无需重启。
- 未知 id 报错并列出可用 id，退出码 1。
- 全部操作幂等。

## Agent preset

九个领域 agent preset，每个的 `skills` 字段**只列本领域技能**，`summary` 以「什么时候选我」开头，`usage` 给 2–3 个示例。

agent 显示名与领域中文名一致（视觉设计、动效设计、……），便于用户在界面上对应。

`od-visual-design` 的 skills 需要列出 152 个设计系统 id 吗？——**不列**。设计系统达 152 个，逐个列入 preset 会让配置文件膨胀且难维护；改为在其 system prompt 中指明「设计系统清单见 `od-visual-design` 技能的索引表，按需读取」，preset 的 `skills` 只列 9 个工艺技能。

### 领域 agent 不开 delegation

九个领域 agent **不启用 `delegation` 能力**，即它们不能互相调用，也不能再派子 agent。跨领域需求由编排层（下节）承接。

理由：互调会引入循环委派（视觉设计把动效交给动效设计，动效设计又回头问视觉设计要令牌），且让职责边界变模糊。领域 agent 只管自己的一摊。

## 可调用性（编排层）

这一节解决「别的 agent 能不能发现并调用这些领域 agent」。

### 发现机制

agent preset 由 `@deepseek-ai/dsh-agent-preset-registry` 的 `agentPresets` 服务提供，通过 `presets.list()` 枚举。因此只要领域 agent 被正确安装为 preset，**任何能读到 registry 的地方都能发现它**。

### 调用机制的硬约束

`vyra-agent-manager` 在 `core.js` 里这样写：

```js
copy[0].config.find((r) => r.id === 'tool-subagent').config.allowedAgentPresets = spec.team;
```

也就是说，**`subagent` 工具的 `agent_preset` 参数只接受白名单里的 preset**，而该白名单由 preset 的 `team` 字段填充。没有 `team` 的 agent，其 `subagent` 工具不带白名单。

因此「建出 9 个 agent」不等于「别的 agent 能调它们」。必须显式建立编排层。

### `od-director` 编排 agent

新增一个编排 preset `od-director`：

| 字段 | 值 |
|---|---|
| name | 设计总监（编排） |
| capabilities | 含 `delegation`（团队靠子 agent 委派工作） |
| team | 全部九个领域 agent id |
| skills | 无专门技能；依赖被委派 agent 各自的技能 |

它会被 `agent_manager` 自动展开为带 `allowedAgentPresets` 的 `subagent` 工具，从而**机制性地**获得派发九个领域 agent 的能力，而不是靠提示词点名。

职责：拆解复合需求 → 判断该给哪个领域 → 并行或串行派发 → 汇总验收 → 向用户汇报。它自己不做具体设计工作。

### 明确不支持：Agent Teams 路径

`dsh-agent-teams` 的 `spawn_teammate` **不支持 `agentPreset` 参数**（见 `plugins/vyra-agent-manager/README.md`：「`spawn_teammate` 目前不支持 `agentPreset` 参数，团队成员继承 Lead 配置或使用默认配置」）。

所以 Agent Teams 那条路对自定义领域 agent 是断的。README 必须写明这一点，避免用户以为 `agent_teams_add_member` 能直接挂领域 agent。

### preset 的生成方式

领域 agent 与编排 agent 都在**同步过程中**生成到 `$DSH_HOME/agent-manager/presets/<id>/`，格式与 `agent_manager` 写出的完全一致（`agent.json` + `package.json` + `cordis.patch.yml` + `locale/` + `icon.svg` + `README.md`），并由插件调用插件管理器注册为真实 bundle。

关闭某领域时：

- 删除该领域的聚合技能目录；
- **保留**其 agent preset（用户仍可在新会话选用），但 `od-director` 的 `team` 中移除该项。

保留 agent 而非一并删除的理由：agent 是一个"模式入口"，删掉会让正在进行的会话失去引用；而它对应的技能已不可见，agent 自然拿不到那些技能，效果已经达成。

## 错误处理

| 情况 | 行为 |
|---|---|
| `domains.json` 不存在 | 用默认 4 个初始化并写盘 |
| `domains.json` 解析失败 | 回退默认 4 个，日志 warn，保留损坏文件为 `.bak` |
| `enabled` 含未知 id | 忽略该项，日志 info |
| 技能根目录不可写 | 日志 warn，不抛出，插件仍加载（只是无技能） |
| 删除目录时文件被占用 | 重试一次，仍失败则 warn 并继续 |

## 测试

`lifecycle.test.mjs` 扩展为覆盖：

1. 九个领域的技能集合两两不相交，并集 = 85 个工艺技能。
2. 默认配置生成 4 个聚合技能目录。
3. 关闭一个领域后，其目录被删除且不可见。
4. 重复同步幂等（逐字节相同）。
5. `domains.json` 损坏时回退默认值。
6. 未知 id 被忽略。
7. `enable-all` / `disable-all` 的极端值。
8. 每个聚合技能的行数 = 该领域技能数。
9. `od-director` 的 `team` 恰为九个领域 agent id，无遗漏。
10. 每个领域 agent 的 `skills` 为该领域清单，且不含设计系统。
11. 九个领域 agent 均不带 `delegation` 能力（不互调）。
12. `od-director` 带 `delegation` 能力。
13. 关闭领域后，`od-director` 的 `team` 不含该领域 id。
14. preset 目录结构与 `agent_manager` 写出的一致（`agent.json` 等文件齐备）。

## 迁移

现有 `$DSH_HOME/skills/opendesign/`（旧的单聚合技能）在首次同步时删除，避免与新的 `od-*` 目录并存造成重复索引。

## 影响文件

- `plugins/open-design/index.js` — 重写为领域化分发
- `plugins/open-design/domains.mjs` — 领域定义（技能归属表）
- `plugins/open-design/agents.mjs` — 9 个领域 agent + `od-director` 的规格生成
- `plugins/open-design/cli.mjs` + `bin/odx` — CLI
- `plugins/open-design/cordis.patch.yml` — 增加 `domains` 配置项
- `plugins/open-design/package.json` — 增加 `bin`
- `plugins/open-design/lifecycle.test.mjs` — 扩展测试
- `plugins/open-design/README.md` — 更新用法，含「Agent Teams 不支持」的说明