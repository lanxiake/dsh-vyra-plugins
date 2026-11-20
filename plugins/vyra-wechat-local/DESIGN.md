# vyra-wechat-local · 设计文档

把 [lumii](../../lumii) 项目里的**本机微信能力**集成成一个独立的 DSH 插件。

> 状态：已实现（12 个工具全部注册）。读取链路已在真机验证（`check_env` /
> `list_sessions` / `list_unread`）；发送类默认 `dry_run=true`，尚未真发验证。

## 1. 为什么是独立插件

`@xmanrui/dsh-im` 里**已经有**一个 `weixin` 渠道，但它和本机微信是**互补的两件事**：

| | dsh-im 的 `weixin` 渠道 | 本插件 |
|---|---|---|
| 身份 | **Bot** —— 别人加你的机器人，在微信里和 DSH 对话 | **你本人** —— 你的微信账号 |
| 数据来源 | 腾讯 iLink 远程 API（HTTPS 长轮询） | 本机微信的数据目录（SQLCipher 解密）+ 窗口自动化 |
| 能看到什么 | 只有绑定了 Bot 的那些会话 | 你微信的**全部**会话、群、历史、图片、语音 |
| 运行前提 | 能上外网 | 本机装了微信并登录 |
| 代码位置 | vendored 第三方（`xmanrui`，MIT） | 本仓库自己的插件 |

所以**不改 dsh-im**：那是别人的产品（vendored，MIT，未改名以保留出处），往里塞一整块能力会分叉上游、混淆归属，而且 10.6MB 的 Python 运行时会把它撑大。两者**并列共存**，各自解决一半问题。

## 2. 技术路线：复用现成的侧车协议

lumii 已经把这件事做完了，而且**接口就是为跨宿主复用设计的**。

### 2.1 上游有什么

`lumii/apps/windows/assets/wechat/`（MIT，Copyright (c) 2026 Lumii），约 690KB Python：

| 文件 | 职责 |
|---|---|
| `wechat_core.py` | 微信 4.x 本地数据**只读**读取：发现数据目录、取密钥、解密、查询 |
| `wxkey4.py` | 从微信进程内存扫数据库密钥（**只读**，`PROCESS_VM_READ`，不注入） |
| `wechat_sender.py` | **零注入**发送：窗口消息投递 + UIA 读数，发送后**回读数据库**确认 |
| `wechat_image.py` | 图片解密（原图是加密 `.dat`） |
| `exportcore.py` | 导出 md/html/json/csv/pdf |
| `autoreply.py` / `knowledge.py` | 自动回复规则与本地知识库 |
| `sidecar.py` | **集成接口**：JSONL over stdin/stdout |
| `app.py` | 工具实现与 `DISPATCH` 表 |

### 2.2 侧车协议（沿用 `sidecar.py` 的协议；入口是本地的 `vyra_sidecar.py` 包装）

`sidecar.py` 本身仍原样保留；我们启动的是 `vyra_sidecar.py`——它 import 未改动的
`sidecar.py`，只往 `DISPATCH` 里加一个 `wechat_avatar`（头像查询），然后进入原来的
主循环。协议、工具清单、错误信封都不变。

协议是**每行一个 UTF-8 JSON**，不是 MCP 的 JSON-RPC：

```
请求  {"id":1,"method":"initialize"}
      {"id":2,"method":"call","tool":"read_history","args":{"talker":"张三","limit":10},"progressToken":"..."}
      {"id":3,"method":"ping"}
      {"id":4,"method":"shutdown"}

应答  {"id":1,"ok":true,"data":{"tools":[...],"instructions":"...","version":"0.12.0"}}
      {"id":2,"ok":true,"content":[{"type":"text","text":"..."}]}
      {"id":2,"ok":false,"isError":true,"content":[{"type":"text","text":"ERROR: ..."}]}

进度  {"id":2,"type":"progress","message":"已定位输入框","progress":3,"total":5}
```

**三个关键约定，上游已经在注释里写明**：

1. **`content` 就是 `AgentToolResult.content` 的形状**（`TextContent | ImageContent`）——TS 侧**原样透传**，`read_image` 的 base64 位图不必在 TS 里再拼一遍。
2. **stdout 纪律**：写协议前先锁住真 stdout，业务代码的 `print()` 全走 stderr。**一行 JSON 不会被切成两半**。
3. **业务逻辑一行不抄**：`app.py` 的工具实现（`DISPATCH` 里 36 个）、错误信封、版本门**全部原样复用**。

### 2.3 这带来什么

DSH 侧要写的只有：**spawn Python → 按行写 JSON → 按行读 JSON → 注册成工具**。没有解密、没有内存扫描、没有窗口自动化——那些都在 Python 里。

## 3. 上游的既成事实（照实记录，不擅自改）

写文档时实测到的、实现前必须知道的事：

### 3.1 侧车实际暴露 **31** 个工具

`app.py` 的 `TOOLS` 列表有 **32** 条（31 条字面量 + 末尾 `TOOLS.append(list_accounts)`），`sidecar.py` 摘掉了 1 个：

```python
_UNAVAILABLE_TOOLS = {"transcribe_voice"}
```

理由（上游注释原文）：`transcribe_voice` 依赖 `wechat_asr` + `pilk` + sherpa-onnx，**这三个没随侧车打包**，留着就是给 Agent 一个"点了必炸"的工具。**能力缺失要显式，不要静默报错**——这是对的，我们继承。

### 3.2 `TOOLS` ≠ `DISPATCH`

`DISPATCH` 里有 **36** 条，`TOOLS` 只列 **32** 条。差额 4 个：`list_contacts`、`tag_create`、`tag_rename`、`tag_delete`——**实现了但没在清单里**，所以 Agent 看不到。

这是**上游的现状**，不是 bug。我们的插件**不绕过它**：只注册 `initialize` 交出来的工具。若以后要开那几个，改上游的 `TOOLS` 列表，而不是在 DSH 侧旁路。

（实测确认：没有"在 `TOOLS` 却不在 `DISPATCH`"的条目——清单里的每个工具都调得通。）

### 3.3 工具清单（侧车交出的 31 个）

按用途分六类。**全部来自 `initialize`**，本插件不硬编码。

**读（只读，不碰窗口）**

| 工具 | 作用 |
|---|---|
| `list_sessions` | 列出你会话（显示名 + talker + 最新预览） |
| `read_history` | 读某会话聊天记录（支持 `before_ts` 翻页） |
| `read_image` | 取图片内容，返回 base64 位图（`ImageContent`） |
| `poll_new` | 增量盯新消息（自己发的也返回；群里 @ 你的带 `at_me`） |
| `search_messages` | 跨会话按关键词/时间检索 |
| `list_unread` | 未读会话列表 |

**导出**

| `preview_export` | 先看规模（条数/体积/命中会话），**不写文件** |
| `export_chat` | 导出 md/html/json/csv/pdf，可 `split=month` |

**画像与知识库（全本地，写 `~/.lumii/`）**

| `wechat_digest` | 本地统计：消息量、活跃时段、最常联系人、高频词、你自己的打字风格 |
| `wechat_profile_save` / `wechat_profile_get` | 存 / 读画像 |
| `wechat_distill_state` / `wechat_distill_clear` | 增量水位 / 删产物 |
| `kb_search` / `kb_save` / `kb_delete` | 本地知识库（话术、偏好、禁忌） |

**自动回复（一整套）**

| `autoreply_rules` | 闸门：`draft`（只出草稿）/ `auto`（允许自动发）；按对象配 ignore/notify/draft/auto |
| `autoreply_drafts` | 草稿审查队列 |
| `autoreply_stats` | 自动回复统计 |

**发送（默认 `dry_run=true`，会抢前台）**

| `send_text` | 以**你本人身份**发消息 |
| `send_file` | 发文件/图片（统一走「发送文件」入口） |
| `send_batch` | 群发，逐目标独立校验 |
| `reply_to` | 引用回复（**唯一仍需前台模拟键鼠的**） |

**通讯录打标签（写微信，异步）**

| `tag_plan` | 只读：出计划（每个标签的 to_add / already / not_taggable …） |
| `tag_start` | 真打标签（异步任务） |
| `tag_status` / `tag_cancel` | 查进度 / 取消 |

**环境诊断**

| `check_env` | 自检：微信是否运行/窗口状态/数据目录 |
| `locate_db` | 定位微信 4.x 数据目录 |
| `list_accounts` | 多开时的账号/进程/窗口清单（`TOOLS.append` 追加） |
| `repair_env` | 一键修复可逆项（还原窗口、规范化尺寸、重探目录） |

> `transcribe_voice` 不在此表——上游已摘掉（§3.1）。

### 3.4 注册白名单：只向 Agent 暴露 12 个

侧车交出 31 个，但**插件只注册 12 个核心工具**。其余 19 个在 Python 里原样保留，
只是不出现在模型面前——每多一个工具，模型的选择成本就多一分。以后要开哪个，
改 `lib/tools.js` 的白名单一行即可。

| 类 | 工具 |
|---|---|
| 读 | `list_sessions` `read_history` `search_messages` `poll_new` `list_unread` `read_image` |
| 发 | `send_text` `send_file` `send_batch` `reply_to` |
| 诊断 | `check_env` |
| 导出 | `export_chat` |

**为什么砍掉这 19 个**（按实现判定，不按名字）：

- `tag_plan` ≡ `tag_start(confirm=false)`：`wechat_tags.mcp_start` 在 `!confirm` 时
  直接调用 `mcp_plan`，输出相同，后者还多给 `dry_run/need_confirm/hint`。
- `locate_db` ⊂ `check_env`：`check_env` 已返回 `db_root/db_source/db_ok`，
  `locate_db` 只多一个 `accounts`。
- `preview_export`：导出前的只读预演，让 Agent 直接 `export_chat` 更省一次往返。
- 画像/蒸馏（5）、通讯录打标签（4）、自动回复（3）、知识库（3）：完整产品功能，
  对「看微信、发消息」属于长尾。
- `repair_env`：开局修复用的可逆操作，不是日常工具。

**保留但功能有重叠的两组**（不砍，因为分页/错误语义不同）：

| 对 | 区别 |
|---|---|
| `read_history` / `search_messages(keyword='')` | 前者 cursor 翻页、边界那一秒补齐；后者 offset + scan 上限，会 `truncated` |
| `send_batch` 单目标 / `send_text` | 单目标时等价，但 `send_batch` 逐目标独立校验、一个失败不影响其余 |

> 白名单是**注册层**的事：不改 Python、不改上游 `TOOLS`。

## 4. 错误契约（继承上游，不要另立一套）

任何失败都返回**同一个信封**：

```json
{"ok": false, "detail": "发生了什么", "error_code": "...", "stage": "...", "suggestion": "该怎么办"}
```

`error_code` → `stage` 的映射（上游 `STAGE_BY_CODE`）：

| error_code | stage | 含义 |
|---|---|---|
| `env_not_ready` | `env` | 微信没运行 / 找不到数据目录 / 密钥扫不到 |
| `target_not_found` | `target` | 会话名对不上 |
| `bad_args` | `args` | 参数缺失或取值非法 |
| `not_archived` | `data` | 归档里没有这条（守护当时没跑） |
| `internal_error` | `internal` | 兜底 |

**本插件不得改写这五个码的语义**，也不得把失败包装成"空结果"——上游注释点名过，**静默 0 条与"真没数据"在 JSON 里长得一模一样**，这是这套工具最容易骗过模型的失败形态。

## 5. 版本门

上游在**每个工具结果**里附带 `version_warning`（不是只写在 `check_env` 里）。理由：内存偏移、窗口类名、AutomationId 都**硬绑微信版本**，"静默给错数据"是最坏的失败形态。

本插件**透传**这个字段，并在设置页提示。当前侧车版本 `SERVER_VERSION = "0.12.0"`。

## 6. 插件结构

```
plugins/vyra-wechat-local/
├── package.json           # dsh.bundle + dsh.client（inject: dsh-client-ui-plugin-manager）
├── cordis.patch.yml
├── index.js               # host：侧车生命周期、工具注册、HTTP 路由
├── client.js              # 设置页：PC微信（回复策略 + 状态信息两个标签）
├── lib/
│   ├── sidecar.js         # JSONL 协议客户端（spawn / 写行 / 读行 / 进度帧 / 重启）
│   ├── runtime.js         # 解释器定位：uv run（自动取依赖）或配置的 python
│   ├── tools.js           # 把 initialize 的 tools 按白名单注册进 ctx.tools
│   ├── watch.js           # 实时监听：按名单决定是否唤醒 Agent，交给会话
│   └── batch.js           # 每会话 20s 合并窗口 + 回复后冷却合并
├── test/                  # 协议与注册的 node:test 检查
├── vendor/wechat/         # 从 lumii 拷来的 .py，原样，含 LICENSE
│   ├── vyra_sidecar.py    # 本地包装：在未改动的 sidecar.py 上加头像工具
│   └── vyra_avatar.py     # 头像查询（head_image.db）
├── .gitignore             # vendor 下的 __pycache__
├── README.md
└── THIRD_PARTY_NOTICES.md # lumii (MIT) + 其二次来源（见 §9）
```

**宿主端的四件事**：

1. **定位并启动侧车**：`uv run --with pycryptodome --with zstandard python -u vendor/wechat/vyra_sidecar.py`
2. **握手**：发 `initialize`，拿工具清单与 `instructions`
3. **注册工具**：只注册 §3.4 白名单里的 12 个，`execute` 转发到侧车
4. **生命周期**：插件卸载时 `shutdown` + 收尸；进程意外退出时报明确的错误，不静默重试

**不硬编码工具的 schema**——全部来自 `initialize`。上游加工具时我们自动跟上；
白名单里新增一个名字即可启用。

### 6.1 设置页（两个入口）

设置里只有一个入口 **PC微信**，页内用两个标签分开：

| 标签 | 内容 |
|---|---|
| **回复策略** | 渠道卡片 + 回复策略弹窗：按账号页签、每人一档（直接代回 / 起草给我确认 / 只提醒我 / 黑名单）、触发条件（每条 / @我 / 关键字）、冷却、从通讯录挑人（带微信头像）、批量改档、移出名单。保存到侧车的 `autoreply_rules`（`~/.lumii/` 下按账号分目录的 `rules.json`），与 `autoreply_rules check` 是同一份。 |
| **状态信息** | 侧车版本/状态、运行方式、环境自检（数据目录及来源 / 微信 / 依赖 / 版本 / 账号）、重新检测、一键修复、已注册工具 chips、侧车 stderr。 |

设置页通过 `list_accounts` / `list_contacts` / `autoreply_rules` 取数据；这些调用会把侧车
切到目标账号，Host 在每次设置调用后把账号切回原值，避免一次「看策略」把后续
`send_text` 的默认身份换掉。

> 回复策略的**执行**不属于本插件：侧车 `autoreply_rules check` 是闸门，真正起草/发送
> 由调用方 Agent 做。插件只负责把策略配置好并存进同一份规则。

### 6.2 实时监听与消息合并（`lib/watch.js` + `lib/batch.js`）

Host 每 `watchSeconds`（默认 2s）对每个账号调 `poll_new`，按**该账号的名单**逐条判定：

- `ignore` / 名单外且默认 `ignore` / 触发条件不满足 / 静默时段 → 丢弃；
- `notify` / 名单外且默认 `notify` → 不叫模型，记入设置页的「最近提醒」；
- `auto` / `draft` → 进入该会话的合并队列。

**合并规则（按同一个微信好友/群）**：

1. 一条新消息先等 `mergeWindowSeconds`（默认 20s）；窗口内再来消息就把计时**重置为 20s**；
2. 一批交给 Agent 后，进入「等回复」状态；这期间的新消息继续攒着，不再开新批次；
3. Agent **真实发送**成功（`dry_run=false` 且 `ok=true`）后，按该 peer 的
   `cooldown_seconds`（默认 60s）进入冷却；冷却期内到达的消息合并成一批，冷却结束时整批交付；
4. 用户自己从手机回复（`from_me` 且非 `agent_sent`）→ 清空该会话的待办，避免抢答。

**交给 Agent 的方式**：每个 peer 一个 DSH 会话（标题「PC微信 · 名字」），用
`ctx.agents.create/resume` + `ctx.sessionController.prompt` 投递合并后的消息。会话建在
专用的 **PC微信** workspace（`~/.dsh/wechat-local/workspace`）里，会话列表按 workspace
分组，不会和项目会话混在一起。每个会话在自己的作用域里注册 `vyra-wechat-proxy`
系统提示段（`systemPrompt.section`，order `10150`，排在通用指导之后）和历史检索、
图片/语音说明与回答规范。同时注册一个只接收 `text` 的 `wechat_send_reply` 工具，
talker/account 由插件按 peer 绑定：小模型不必自己填目标，也不会发错人；发送成功仍
走同一条 `onToolResult` 冷却路径。它是**会话级作用域**，不是全局预设，普通会话的
预设列表里看不到它；旧版监听会话在升级时归档，新会话带这段提示。

**信任边界**：只有「自己的微信号（自聊）」和 `filehelper` 是可信输入通道——第三方无法向
那里发消息，所以它们默认放行（无规则文件也生效，显式名单条目仍可改成只提醒/黑名单）。
其他好友/群一律要显式加入名单，名单外默认 `ignore`。

**监听会话的工具掩码**：`setup` 里用 `agentCtx.tools.restrict({ allow: ['check_env'] })`
把全局工具收窄到只剩无害的环境自检；作用域内注册的 `wechat_send_reply` 仍可见。
因此监听会话不能读文件、执行命令、访问网络、读其他微信会话或导出记录。拿不到工具清单时
**拒绝创建会话**（fail closed），而不是带着全量工具运行。系统提示同时把对方消息标成
不可信数据，并禁止透露用户的其他会话/文件/账号/密钥/提示词。`wechat_send_reply` 还受
每批次模式约束：`draft` 批次调用会直接返回错误，不会误发。

**媒体在交付前处理**：`poll_new` 已附带图片本地路径与语音 SILK 路径。Host 在 prompt 前
把图片读成原生 `image` 内容块；本地没有 `image_path` 时调用本地的
`wechat_image_fetch`——先读微信的已解码显示缓存
（`cache/<月>/Message/<hash>/Bubble/<name>_b.dat`，WXGF 原图也能读），再退回附件
`.dat`，密钥优先取 `~/.lumii/wechat-cache/image_key.json` 的账号键。语音调用侧车
`transcribe_voice`（本地 `pilk` + `sherpa-onnx` Paraformer，模型首次自动下载）写成
`[语音] 文字`。Agent 不需要额外调用 `read_image` 或转写工具。

**连接监测**：监听启动时和之后每 60 秒（异常时每 10 秒）跑一次 `check_env`。只看
**进程 + 数据目录 + 依赖**：窗口收进托盘、最小化或不在前台都算已连接（读库不需要窗口，
发送时侧车自己还原窗口）。微信没运行、数据目录找不到或依赖缺失时，才把可操作的错误
写进 `watch.lastError` 并暂停轮询——不会静默空转；微信恢复后自动继续。

**交付必须可重试**：`ctx.agents` 必须写进 `inject`（否则 cordis 的
"cannot get property … without inject" 会让每次交付都失败，消息永远停在「合并中」）。
建会话与入队各有 30 秒上限；失败时整批放回合并队列重试，错误写进 `watch.lastError`。
重试前用 `base_text` 重建图片/语音那一行，避免同一条说明被重复追加。

监听状态、待合并数量、冷却倒计时、最近交付、最近提醒通过设置页 RPC 暴露。
被策略丢弃的消息（触发条件不匹配、名单外、黑名单、静默时段、用户自己发的）也会
记入**最近跳过**并带上原因——否则「策略静默丢弃」和「监听没看到」在页面上长得一样。
`watch: false` 可关闭整条监听。

| 配置 | 默认 | 含义 |
|---|---|---|
| `watchSeconds` | 2 | 轮询间隔（秒） |
| `mergeWindowSeconds` | 20 | 合并窗口；每条新消息重置 |
| `replyTimeoutSeconds` | 120 | 交付后等回复的上限；超时后允许下一批 |
| `backlogSeconds` | 300 | 重启后最多补读多久的消息，超过就从现在开始 |
| `watch` | true | 是否启用实时监听 |

## 7. Python 运行时

### 方案：`uv run`（已装即用，缺了自动取）

本仓库的 `vyra-xianyu-delivery` 已经把 `uvx` 作为运行外部 CLI 的约定。这里沿用同一
条路：`uv run --with pycryptodome --with zstandard python -u vyra_sidecar.py`。

- 解释器与两个依赖由 uv 在首次运行时取好并缓存，不把 10MB 运行时塞进 Git；
- 用户机器上没有 uv → 设置页明确报错，并允许在配置里指定已有的 `pythonPath`；
- 不手写 embeddable Python 的下载/解压/`site` 修复——那是 uv 已经做对的事。

### 依赖

**`pycryptodome` 是硬依赖**（`wxread4.py` 用 AES 解 SQLCipher 页；缺了读取全线不可用）：

| 库 | 用途 | 缺失时 |
|---|---|---|
| `pycryptodome` | 解 SQLCipher 页面 | 读取/发送全线失败（必须装） |
| `zstandard` | 解 zstd 压缩的消息内容 | 有 `try/except`；那种消息读不出，其余正常 |
| `openpyxl` | 导出 Excel | 函数内 import，只在真导出 Excel 时需要 |
| `wechat_asr` / `pilk` | 语音转写 | sidecar 已摘掉该工具（§3.1） |

## 8. 交付顺序

> 实现时两步一并写完了；下面保留分步验收口径，用来区分"已验证"与"尚待验证"。

### 第一步（先做，可验证）

骨架 + 侧车打通 + **7 个只读工具**：

`list_sessions`、`read_history`、`search_messages`、`poll_new`、`list_unread`、`read_image`，加上诊断用的 `check_env`（`locate_db` 已被 `check_env` 覆盖，见 §3.4）。

（`check_env` 要放在第一步：没有它，"读不到数据"到底是微信没开、还是密钥扫不到、还是目录找不到，就分不出来。它只读，不碰窗口。）

**验收标准**：
- 设置页显示 Python 状态、`check_env` 结果、工具清单
- 能让 Agent 列出你会话、读某人的聊天记录
- **全程不抢前台焦点**（只读路径不碰窗口）

### 第二步（第一步验证后）

其余 5 个：发送（4）与导出（1）。

**验收标准**：发送前 `dry_run=true` 校验；真发时明确提示会抢前台。

## 9. 已知代价

1. **依赖 uv**：首次使用由 uv 取解释器与依赖（缓存在 uv 自己的目录，**不进 Git**）；没有 uv 时需在配置里指一个装好 `pycryptodome` 的 Python
2. **首次使用需联网**让 uv 取依赖；离线环境要预先装好
3. **`transcribe_voice` 不可用**（上游摘掉，见 §3.1）
4. **发送会抢前台**（微信窗口不活跃时 Qt 会丢投递的 `WM_CHAR`，上游实测），第二步单独验收
5. **Windows only**：整套依赖 Win32 API（`ctypes`、UIA、窗口消息），其他平台不可用
6. **二次来源的许可链**：`wxkey4.py` 注释写明"改写自 `sunhanaix/pc_wechat_exp`"，`THIRD_PARTY_NOTICES.md` 要如实记录这一链，不只写 lumii
7. **上游是快照**：lumii 更新后需要重新 vendor，本仓库不会自动跟（与既有 vendored 插件的做法一致）

## 10. 不做的事

- **不改 `dsh-im`**：它是 vendored 第三方，改它会分叉上游
- **不改 lumii 的 Python**：原样 vendor，这样上游更新可以整目录替换
- **不绕过 `TOOLS` 清单**：`DISPATCH` 里有但清单没有的工具（§3.2）不注册
- **不重写业务逻辑**：解密、内存扫描、窗口自动化都在 Python 里，TS 侧只做协议转发
- **不静默失败**：五个 `error_code` 的语义照传，不包装成空结果（§4）
