# vyra-wechat-local

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

## 行为边界

- **只读路径不碰窗口**：列会话、读记录、检索、取图都不抢前台。
- **发送会抢前台**：`send_text` / `send_file` / `send_batch` / `reply_to` 默认
  `dry_run=true`；真发时以你的身份发出，**不可撤回**。
- **失败不伪装成空结果**：错误信封的 `error_code`（`env_not_ready` /
  `target_not_found` / `bad_args` …）原样交给模型。
- 数据只在本机处理；插件不向任何远端发送内容。

## 设置页

插件设置页（设置 → 本机微信）显示侧车状态、运行方式、已注册工具，并可重启侧车、
运行环境自检（`check_env`）。

## 目录

```
index.js             Host：侧车生命周期、工具注册、设置页 RPC
client.js            设置页
lib/sidecar.js       JSONL 协议客户端
lib/runtime.js       uv / 配置的 Python
lib/tools.js         白名单与工具注册
vendor/wechat/       lumii 的 Python 侧车（MIT，见 THIRD_PARTY_NOTICES.md）
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
