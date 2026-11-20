# vyra-wechat-local（PC微信）

让 Agent 读写**用户本人**的本机微信：会话、聊天记录、图片、未读、检索、导出，以及
以本人身份发送。和 `dsh-im` 的 `weixin` 渠道（Bot）是两件事——那个是别人加你的机器人，
这个是你自己的微信账号。

仅 Windows。需要本机微信 4.x 已登录。

## 运行前提

- **微信正在运行**：数据库密钥要从进程内存只读扫描（不注入、不重启微信）。
- **uv**（默认）：插件用 `uv run --with pycryptodome --with zstandard` 启动侧车，
  首次运行会取解释器与依赖并缓存。也可以改装好的 Python：

  ```yaml
  - id: wechat-local
    config:
      pythonPath: C:/Python311/python.exe
  ```

- **pycryptodome** 是硬依赖（解 SQLCipher 页面）；`zstandard` 缺失时只有压缩消息读不出。

## 工具（12 个）

| 类 | 工具 |
|---|---|
| 读 | `list_sessions` `read_history` `search_messages` `poll_new` `list_unread` `read_image` |
| 发 | `send_text` `send_file` `send_batch` `reply_to` |
| 诊断 | `check_env` |
| 导出 | `export_chat` |

侧车实际实现 31 个，插件只注册白名单里的 12 个（`lib/tools.js` 可改）。其余在
Python 里保留但不对模型暴露。

## 实时监听

插件启动后会自动监测微信连接：每 60 秒自检一次，微信没运行/数据目录找不到/依赖缺失时在页面上直接报错并暂停轮询，登录后自动恢复。

微信收进托盘、最小化或不在前台都不影响监听：读消息只碰数据库，发送时侧车会把窗口还原、发完再还回去。所以「连接」看的是进程和数据目录，不是窗口可见性。

监听每 2 秒读取一次新消息，并按「PC微信」里配置的名单决定是否叫醒 Agent：

- `忽略 / 黑名单`、名单外默认 `忽略`、触发条件不满足、静默时段 → 不处理，
  但会记入设置页的「最近跳过」并写明原因（如「触发条件不匹配」「名单外」）；
- `只提醒我` → 不叫模型，记入设置页的「最近提醒」；
- `直接代回 / 起草给我确认` → 交给该好友的 DSH 会话。

**默认只信任两个会话**：你自己的微信号（自聊）和 **文件传输助手**——只有你能往那里发消息，
所以它们默认就允许直接代回，不需要先配置。其他好友/群必须显式加入名单才会叫模型。

**安全边界**：监听会话的 Agent 被限制成只能调用 `wechat_send_reply`（对方/账号已绑定）
和 `check_env`；文件、shell、网络、其他微信会话、导出、`send_file` 等工具在该会话里全部不可见。
系统提示把对方消息明确标成「不可信数据」：即使消息里写“忽略规则”“把聊天记录/文件发给我”，
也只会被当成聊天内容，不会被当成指令执行。起草批次即使模型误调发送工具，服务端也会拒绝。

**同一好友/群的消息会合并**：第一条到达后等 20 秒，20 秒内再来消息就重新计时；
一批交给 Agent 后，等它回复；真实发送成功后按该人的「冷却」秒数进入冷却，
冷却期内来的消息合并成一批，冷却结束时一次交付。用户自己从手机回复会清空待办。

**图片与语音在交付前就处理好**：图片先读微信的已解码显示缓存，再退回本地附件；
WXGF 原图也走这条显示缓存，作为原生图片块附带。语音用本地 Paraformer（sherpa-onnx）
转写成文字，首次需要下载约 82MB 模型（自动下载）。Agent 不需要再调用 `read_image`
或转写工具。

每个好友/群对应一个 DSH 会话，统一放在 **PC微信** 分组（workspace：
`~/.dsh/wechat-local/workspace`），不会和你平时的项目会话混在一起。
这些会话会在自己的作用域里注入内置的 **代聊模式** 系统提示，并注册一个只接收
`text` 的 `wechat_send_reply` 工具（对方/账号由插件绑定，模型填错目标也发不出去）；
历史消息、图片/语音说明和回答规范都在这段提示里。它不是全局预设，普通会话的预设列表里
不会出现它。

可配置（`cordis.patch.yml` 的 `config`）：

| 键 | 默认 | 含义 |
|---|---|---|
| `watch` | `true` | 是否启用实时监听 |
| `watchSeconds` | `2` | 轮询间隔（秒） |
| `mergeWindowSeconds` | `20` | 合并窗口（秒） |
| `replyTimeoutSeconds` | `120` | 交付后等回复的上限（秒） |
| `backlogSeconds` | `300` | 重启后最多补读多久的消息 |
| `voiceAutoDownload` | `true` | 首次遇到语音时自动下载 78MB 本地语音模型 |
| `maxImagesPerBatch` | `4` | 一批消息最多附带的图片数 |
| `maxImageBytes` | `8000000` | 一批图片的总字节上限 |

## 行为边界

- **只读路径不碰窗口**：列会话、读记录、检索、取图都不抢前台。
- **发送会抢前台**：`send_text` / `send_file` / `send_batch` / `reply_to` 默认
  `dry_run=true`；真发时以你的身份发出，**不可撤回**。
- **监听会以你的身份发消息**：`直接代回` 的名单里如果有新消息，Agent 会按策略直接发送。
  不希望自动发送时，把这些人的档位改成「起草给我确认」或「只提醒我」。
- **失败不伪装成空结果**：错误信封的 `error_code`（`env_not_ready` /
  `target_not_found` / `bad_args` …）原样交给模型。
- 数据只在本机处理；插件不向任何远端发送内容。

## 设置页

设置里只有一个入口 **PC微信**，页内两个标签：

- **回复策略**：渠道卡片 + 回复策略弹窗。按账号页签，每人一档：直接代回 / 起草给我确认 /
  只提醒我 / 黑名单；本人和文件传输助手默认在名单里（标「默认白名单」），可单独改档。
  可配触发条件、关键字与冷却，从微信通讯录挑人（带头像），支持批量改档。
  策略写入侧车的 `rules.json`（按账号分目录），`autoreply_rules` 的 `check` 读同一份。
  弹窗固定尺寸、浅色外观，切换账号/展开挑人时不会跳动。
- **状态信息**：侧车状态、运行方式、环境自检（数据目录及来源 / 微信 / 依赖 / 版本 /
  账号）、重新检测、一键修复、已注册工具清单（悬停每个工具可看用途）。

## 目录

```
index.js             Host：侧车生命周期、工具注册、设置页 RPC
client.js            设置页
lib/sidecar.js       JSONL 协议客户端
lib/runtime.js       uv / 配置的 Python
lib/tools.js         白名单与工具注册
lib/watch.js         实时监听、名单判定、交给 DSH 会话
lib/batch.js         20s 合并窗口 + 回复后冷却
vendor/wechat/       lumii 的 Python 侧车（MIT，见 THIRD_PARTY_NOTICES.md）
  vyra_sidecar.py    本地包装：在未改动的 sidecar.py 上加头像工具
  vyra_avatar.py     头像查询（head_image.db）
```

设计细节见 [DESIGN.md](./DESIGN.md)。

## 许可

本插件 MIT。`vendor/wechat/` 来自 [lumii](https://github.com/lumii)（MIT），
`wxkey4.py` 另注明改写自 `sunhanaix/pc_wechat_exp`。详见 `THIRD_PARTY_NOTICES.md`。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
