# 渠道目标字段与限制

只有在目标没有出现在「从已聊会话选择」候选里时，才需要手动填写平台原生 ID。优先让用户在设置页选择。

| 渠道 | 目标类型 | 需要填写的字段 | 示例 |
| --- | --- | --- | --- |
| 微信 `weixin` | `user` | 微信用户 ID（`toUserId`） | — |
| 飞书 `feishu` | `user` / `group` | Open ID（`openId`）/ 群 Chat ID（`chatId`） | `ou_xxx` / `oc_xxx` |
| 钉钉 `dingtalk` | `user` / `group` | 用户 ID（`userId`）/ 群 Open Conversation ID（`openConversationId`） | — |
| 企业微信 `wecom` | `user` / `group` | 用户 ID / 群 `chatid`（路由字段都叫 `chatId`） | — |
| QQ `qq` | `user` / `group` | `user_openid` / `group_openid` | — |
| Slack `slack` | `conversation` / `thread` | `channelId`；Thread 另加 `threadTs` | `C0123456789` / `1712345678.123456` |
| Telegram `telegram` | `chat` / `topic` | `chatId`；Topic 另加正整数 `messageThreadId` | `-1001234567890` |
| Discord `discord` | `channel` | 可发消息的 `channelId`（私信/频道/Thread 同） | — |
| WhatsApp `whatsapp` | `user` / `group` | `jid` | `8613800000000@s.whatsapp.net` |
| Matrix `matrix` | 版本相关 | 设置页选择 | — |
| iMessage `imessage` | 版本相关 | 设置页选择 | — |
| 邮件 `email` | 版本相关 | 设置页选择 | — |

规则：

- 一个目标只接受所选渠道和类型要求的字段，额外字段会被拒绝（`invalid-target`）。
- `targetId`：大小写字母、数字、点、下划线、冒号、`@`、连字符，1–128 字符。保存后不可改。
- `botId + targetId` 在同一机器人下唯一；不同机器人可以重名。

## 长文本与分段

- 微信主动长文本 1800 字符一段，Markdown 代码块跨段时补齐围栏。
- 每段都占一次平台发送次数；中途失败不要重发已成功的段。
- 飞书主动卡片不分段；平台拒绝时不自动改发文本。

## 主动投递的硬限制

- 文字投递只发非空文字，不支持卡片或富文本。
- 主动文件已支持飞书、微信、企业微信（机器人/应用）、钉钉、QQ（`dsh_im_send_file` / `POST /api/dsh-im/delivery/files`），上限 30 MB；其他渠道返回 `capability-unavailable`。
- 不保存投递历史，不生成 `deliveryHandle` / `idempotencyKey`，不自动重试。
- 一个调用只发一个目标。
- 机器人离线时仍可编辑目标，但不能测试或发送。
- `{ sent: true }` 只代表平台接受，不代表送达/已读。

## 微信特别说明

主动投递、连接测试和延迟任务使用该机器人最近收到的对应用户 `context_token`。升级或重新绑定后，需要用户先发一条消息才能建立缓存。持续 `ret=-2 prepare failed` 时让目标用户先发消息再试，不要靠反复发送心跳续期。
