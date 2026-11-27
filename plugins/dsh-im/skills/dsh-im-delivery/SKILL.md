---
name: dsh-im-delivery
description: Send proactive text through DSH-IM bots (WeChat, Feishu, WeCom, DingTalk, QQ, Telegram, Slack, Discord, WhatsApp, iMessage, Email, Matrix). Use when asked to push a notification, send to a person or group, list delivery targets, or wire up the dsh-im CLI/HTTP API. Chinese triggers: 推送、通知、发到群、发给某人、主动发送、IM 机器人。Not for replying inside an IM chat (the normal reply already lands there) and not for pushing files.
---

# DSH-IM 主动投递

一个「机器人 + 已保存目标」就是一条稳定的投递地址：`{ botId, targetId }`。不要保存 sessionId、消息 ID 或平台原生路由。

## 先选路径

| 场景 | 做法 |
| --- | --- |
| 正在 IM 聊天里回答用户 | **正常回复即可**，不要调用发送工具（会重复发一条） |
| 在 Web / CLI / 定时任务里推给已保存目标 | `dsh_im_send_message` |
| 不知道该发给谁、ID 是什么 | 先 `dsh-im accounts` → `dsh-im targets`（离线可读，见 `dsh-im-accounts` 技能） |
| 当前 IM 会话里要回传文件/图片 | `dsh_im_return_file`（只登记，回合结束后渠道发送） |
| 主动推文件到任意目标 | `dsh_im_send_file`（飞书、微信、企业微信、钉钉、QQ 支持；其他渠道报 `capability-unavailable`） |
| 外部脚本 / 非 DSH Agent | `dsh-im send` CLI 或 `POST /api/dsh-im/delivery/messages`（文件走 `/files`） |

## 目标必须先存在

`targetId` 是用户起的稳定别名，不是平台用户 ID；`botId` 是不透明字符串。两者都只能来自：

1. 设置 → IM机器人 → 机器人卡片齿轮 → 复制 `Bot ID`
2. 「新建目标」→ 从已聊会话选择或手动填平台 ID → 测试 → 保存 → 复制调用参数

Agent 不要猜、不要从机器人名称推断渠道、不要让用户手工填平台 ID 除非目标没有出现在候选里。目标不存在时明确告诉用户去设置页创建。

## 工具

```
dsh_im_delivery_targets {}                    # 列出所有机器人
dsh_im_delivery_targets { "botId": "bot_x" }  # 列出该机器人的目标
dsh_im_send_message {
  "botId": "bot_x",
  "targetId": "release-alerts",
  "text": "构建已完成",
  "format": "plain",       // plain | markdown
  "idempotencyKey": "evt-20261123-1"  // 可选；重试时复用
}
dsh_im_send_file {
  "botId": "bot_x",
  "targetId": "release-alerts",
  "path": "./dist/report.pdf",   // 相对 Session workspace 或绝对路径
  "asImage": false                // 可选；默认按扩展名判断
}
```

- 只在用户明确要求「通知 / 推送 / 发给…」或定时任务指令要求时发送；不要主动汇报进度。
- 一次调用只发一个目标；多目标分别调用、分别处理结果。
- `{ "sent": true }` 只表示平台接受请求，**不代表送达或已读**。回复用户时说「已发送」而不是「对方已收到」。
- 超时或 `delivery-failed` 后**不要盲目重试**：可能已经发出。必须重试时带同一个 `idempotencyKey`，Host 在进程内 24h 内会抑制重复；失败的那次会释放 key。
- 发文件前确认路径在 Host 机器上可读、≤30 MB；不要发 `.env`、密钥、私钥或无关的个人文件。

## CLI

读取类命令直接读配置文件，**DSH 没在运行时也能用**；发送类命令走 Host 的 HTTP 接口，需要 DSH 在运行。

```bash
dsh-im accounts                                    # 账号名 + 渠道 + botId
dsh-im targets --account 我的微信                   # targetId + 目标名
dsh-im send --account 我的微信 --target 发布告警群 --text "构建已完成" --idempotency-key evt-1
echo "构建已完成" | dsh-im send --account 我的微信 --target 发布告警群 --stdin
dsh-im send --account 我的微信 --target 发布告警群 --text "# 日报" --format markdown
dsh-im send-file --account 我的微信 --target 发布告警群 --file ./dist/report.pdf
dsh-im send-file --account 我的微信 --target 发布告警群 --file ./dist/chart.png --image
dsh-im endpoint                                    # 打印 Host 地址（诊断用）
```

- `--account` 接受账号名或 `botId`；`--bot` 是兼容别名，两者等价。
- `--target` 接受 `targetId` **或目标显示名**，重名会被拒绝并列出候选。发送时实际用的是 `targetId`。
- 所有命令都支持 `--json`，输出单个 JSON 文档。

写入类命令（`send`/`send-file`/`target`/`settings`）的地址发现顺序：`--url` > `DSH_IM_URL` > `~/.dsh/integrations/dsh-im/delivery-http.json` > `http://127.0.0.1:3080`。报 `unreachable` 时先确认 DSH 正在运行，再 `dsh-im endpoint` 看地址，不要猜端口。

`dsh-im` 不在 PATH 时，用 `<dshHome>/profiles/<profile>/node_modules/.bin/dsh-im` 或 `npx -y @lanxiake/dsh-im`。在 DSH Session 内优先用工具，不要为了发消息去装全局 CLI。

## HTTP（外部进程）

```bash
curl -X POST http://127.0.0.1:3080/api/dsh-im/delivery/messages \
  -H 'Content-Type: application/json' \
  -d '{"botId":"bot_x","targetId":"release-alerts","text":"构建已完成"}'
```

- 只接受 `botId`、`targetId`、`text`、`format`、`idempotencyKey`；多一个字段就 `bad-request`。
- 请求体上限 1 MiB；接口无鉴权、无 CORS，只能本机或可信网络用，不要暴露公网。
- 文件走 `POST /api/dsh-im/delivery/files`，body `{ botId, targetId, path, asImage? }`；`path` 由 Host 读取。
- 查询走 `POST /api/dsh-im/delivery/query`，body `{ op: "bots" }` 或 `{ op: "targets", botId }`。

## 渠道能力

| 渠道 | 通道名 | Markdown | 主动文件 | 备注 |
| --- | --- | --- | --- | --- |
| 飞书 | `feishu` | 原生卡片 | 支持 | 国内首选 |
| 微信 | `weixin` | 纯文本 | 支持 | 需最近收到该用户消息才有 `context_token`；1800 字分段 |
| 企业微信机器人 | `wecom` | Markdown | 支持 | |
| 企业微信应用 | `wecom-app` | 纯文本 | 支持 | |
| 钉钉 | `dingtalk` | Markdown，明确拒绝时回退文本 | 支持 | |
| QQ | `qq` | Markdown，分段级回退 | 支持 | |
| Telegram | `telegram` | Rich Markdown | 暂不支持 | |
| Slack | `slack` | Block，保留通知文本 | 暂不支持 | |
| Discord | `discord` | 原生 Markdown | 暂不支持 | |
| WhatsApp | `whatsapp` | 有限转换 | 暂不支持 | |
| Matrix | `matrix` | 清理后 HTML + 文本 | 暂不支持 | |
| iMessage | `imessage` | 纯文本 | 暂不支持 | |
| 邮件 | `email` | 纯文本 | 暂不支持 | |

长消息自动按渠道分段；每段都占平台发送次数。详细字段与限制见 `references/channels.md`。

## 错误码 → 动作

| 错误码 | 动作 |
| --- | --- |
| `unknown-bot` | 重新列出机器人；别复用旧 ID |
| `unknown-target` | 用户删了或 ID 抄错；让用户新建/核对 |
| `bot-not-connected` | 机器人离线；告诉用户恢复连接后再发，不要循环重试 |
| `target-rejected` | 平台拒绝：机器人权限或目标 ID 有问题 |
| `invalid-target` | 目标类型和平台 ID 不匹配；回设置页重选 |
| `delivery-failed` | 网络/平台故障；先停，别重复发 |
| `capability-unavailable` | 该渠道不支持主动发文件；飞书/微信/企业微信/钉钉/QQ 支持 |
| `cancelled` | 调用被取消；按业务决定是否重新发起 |
| `bad-request` | 字段名、格式或文字有问题；只传允许字段 |

完整排障见 `references/errors.md`。

## 发送前检查

1. 用户确实要求发；内容不含密钥、内部路径或不必要的个人信息。
2. 群聊里先确认群和对象；不要默认 @所有人。
3. 用 `format: markdown` 前确认渠道支持，否则用 `plain`。
4. 一条消息能说清就别拆多条；平台发送次数和频率有限制。
5. 发送后向用户报告「已提交给哪个机器人、哪个目标、结果码」，失败时给出恢复动作。
