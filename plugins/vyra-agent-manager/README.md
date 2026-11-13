# DSH Agent Manager

Visual agent creation and management panel for DeepSeek Harness, with agent-facing tools so the main agent can create agents programmatically.

## 功能特性

- ✅ **可视化 Agent 构建器**：通过精致的 UI 创建自定义 Agent，配置系统提示词、能力集、工具限制和优选技能
- ✅ **动态发现**：能力、工具和技能从运行时的 DSH 读取，无硬编码列表
- ✅ **对话中管理**：主 Agent 可通过 `agent_manager` 工具按同一规范创建/更新/列出/删除 Agent
- ✅ **系统预设查看**：系统预设卡片支持查看详情（能力配置、提示词等），只读模式
- ✅ **预设安装**：每个保存的 Agent 作为真实的 `@deepseek-ai/dsh-agent-preset` bundle 安装，可在新会话创建时选择
- ✅ **视觉设计**：渐变头像、卡片悬停效果、流畅动画、语义色彩（brand/success/warn/error 半透明混合），遵循 DSH `--dsw-alias-*` 主题 token

## Agent 与团队

**Agent 预设**（本插件管理）：
- 会话创建时选择的初始配置（prompt + tools + skills）
- 决定"这个 Agent 是什么样的"
- 创建的 Agent 可在新会话选择，每个会话独立运行

**Agent 团队**（`spawn_teammate` / `agentTeams` 服务）：
- 运行时 Lead Agent 派生的持久化子 Agent
- 共享工作目录、任务板、消息通信
- **技术限制**：`spawn_teammate` 目前不支持 `agentPreset` 参数，团队成员继承 Lead 配置或使用默认配置

**协作方案**：
1. 在新会话选择对应预设，然后用 `spawn_teammate` 组建团队
2. 或：用 `subagent` 工具 + `agent_preset` 参数做一次性协作（非持久化）

## Structure

```
dsh-agent-manager/
├── package.json          # Bundle manifest, exports client, tool-policy, locales
├── cordis.patch.yml      # Host plugin row
├── index.js              # Host entry: RPC route + agent_manager tool registration
├── core.js               # Agent CRUD: meta, listAgents, saveAgent, deleteAgent, getAgent
├── tool.js               # agent_manager tool definition (catalog/list/get/create/update/delete)
├── tool-policy.js        # Preset-mountable plugin: hides selected global tools from one agent
├── client.js             # React panel: tabs, cards, editor drawer, RPC fetch
├── icon.svg              # Sidebar icon (purple gradient topology)
└── locale/
    ├── en.json           # English metadata
    └── zh.json           # Chinese metadata
```

Generated agent bundles live in `~/.dsh/agent-manager/presets/<id>/` with:
- `package.json`, `cordis.patch.yml`, `locale/*.json`, `icon.svg` (generated hue-coded letter avatar)
- `agent.json` (full spec for editing)

## Capabilities

Capability definitions in `core.js` mirror the shipped `standard` preset structure and check availability against the live composition inventory:

| Capability | Tools | Risk | Description |
|------------|-------|------|-------------|
| `files` | read, write, edit, glob, grep | write | File I/O and search |
| `shell` | pwsh (Win) / bash (Unix) | exec | Command execution |
| `jobs` | job_list, job_output, job_kill | none | Background task management |
| `web` | web_search, web_fetch | none | Internet search and fetch |
| `skills` | skill | none | Load installed SKILL.md skills |
| `delegation` | subagent, subagent_fork, workflow | exec | Multi-agent orchestration |
| `schedule` | schedule_* | none | Scheduled tasks |
| `goal` | create_goal, get_goal, update_goal | none | Long-running goal tracking |
| `todo` | todo_write | none | Task checklist rendering |
| `ask-user` | ask_user_question | none | Interactive user questions |
| `present` | present | none | File delivery to user |
| `plugin-manager` | plugin_manager | admin | Plugin/bundle management (profile-only) |

Unavailable capabilities (missing modules in the live preset) are greyed out in the editor.

## RPC Operations

POST `/api/agent-manager/rpc` with `Content-Type: application/json`:

```javascript
// Get catalog: capabilities, global tools, installed skills
{ "op": "meta" }
// → { ok: true, capabilities: [...], tools: [...], skills: [...], platform: "win32" }

// List all agents
{ "op": "agents" }
// → { ok: true, managed: [{ spec, installed, broken }], system: [{ id, name, ... }] }

// Create or update
{ "op": "save", "agent": { id, name, description, systemPrompt, capabilities, denyTools, skills }, "create": true }
// → { ok: true, id, application: "applied"|"restart-required", warnings: [...] }

// Delete
{ "op": "delete", "id": "<agent-id>" }
// → { ok: true, id }

// Errors: { ok: false, error: "..." }
```

## Agent Tool

The main agent calls `agent_manager({ action, ... })`:

| Action | Arguments | Returns |
|--------|-----------|---------|
| `catalog` | — | `{ status: "ok", capabilities, global_tools, skills }` |
| `list` | — | `{ status: "ok", managed: [...], system: [...] }` |
| `get` | `id` | `{ status: "ok", managed: true/false, spec or preset }` |
| `create` | `id, name, description, system_prompt, capabilities, deny_tools?, skills?` | `{ status: "ok", id, application, warnings, note }` |
| `update` | (same as create) | (same as create) |
| `delete` | `id` | `{ status: "ok", id }` |

All fields are validated; errors throw with descriptive messages.

## Templates

The editor offers starter templates:
- **Code reviewer**: files, todo; strict review checklist
- **Researcher**: web, files, present; source-backed conclusions
- **Doc writer**: files, present, ask-user; clean technical writing

## UI 功能

- **搜索**：按名称、ID 或描述筛选
- **分类标签**：全部 / 我的 Agent / 系统预设
- **编辑器抽屉**：从右侧滑入，背景模糊，流畅开关动画
- **系统预设详情**：点击"查看详情"按钮打开只读抽屉，显示能力配置、提示词（如可解析）
- **能力卡片**：按类别分组，风险标签（write/exec/admin），工具预览
- **工具屏蔽列表**：可搜索切换列表，隐藏额外安装的工具
- **技能选择器**：可搜索药丸切换（需要 `skills` 能力）
- **总结页脚**：实时显示工具、能力、技能、屏蔽计数
- **删除确认**：需要双击（3.5秒后自动解除）
- **Toast 通知**：成功/错误，带彩色指示点
- **骨架加载器**：获取 meta + agents 时显示

## Installation

```powershell
cd C:\Users\75791\Documents\deepseek-harness\default-workspace
# Assuming dsh-agent-manager/ is here

# Install in the active profile
$profileDir = "C:\Users\75791\.dsh\profiles\desktop"
plugin_manager install_bundle dsh-agent-manager/
# → application: "applied" (live) or "restart-required"
```

Verify:
```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:53661/api/agent-manager/rpc' `
  -Method POST -Body '{"op":"meta"}' -ContentType 'application/json'
# → StatusCode 200, JSON with capabilities/tools/skills
```

Check the sidebar: "Agent 管理" panel should appear (order 5).

## Development

Host changes (core, tool, index): reinstall the bundle or restart DSH.  
Client changes (client.js): reload the page (HMR with `pnpm run dev:web` from the DSH repo, if running).

Syntax check:
```powershell
node --check index.js
node --check core.js
node --check tool.js
node --check tool-policy.js
node --check client.js
```

## Notes

- Created agents are installed as bundles under `@local/agent-preset-<id>`, not `@local/dsh-agent-manager` itself
- The `tool-policy` module is mounted in each generated preset that has `denyTools`; it calls `ctx.tools.restrict({ deny: [...] })`
- Host row status `absent` is normal when the plugin has no config entry to manage — the route and tool register via `inject: ['tools']` and run immediately
- `systemPrompt` replaces the default persona; double braces `{{ }}` are forbidden (template engine would parse them)
- Skills declared in the editor are appended as a hint: "优先加载这些技能：…"
- Unavailable capabilities (missing from live composition) are disabled in the UI and rejected server-side
- Each agent bundle gets a generated SVG icon (hue from id hash, first letter of name)

## Troubleshooting

**RPC returns 401**: The route requires an authenticated browser session; shell `Invoke-WebRequest` tests need credentials (or run from authenticated contexts).

**Host row status `absent`**: Expected when there's no config row for this plugin itself — it registers effects via `inject`, not config.

**Agent not in preset list**: Check `application` result; `restart-required` means DSH needs a full restart to see the new preset.

**Capability greyed out**: The live preset composition doesn't include the required modules; check with `agentPresets.compositionInventory()` or verify the `standard` preset has those rows.

**Blank panel**: Open browser DevTools console for client errors; verify `/api/agent-manager/rpc` is reachable and returns `ok: true`.
