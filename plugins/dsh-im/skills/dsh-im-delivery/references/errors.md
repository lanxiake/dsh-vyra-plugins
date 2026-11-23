# 投递错误与排障

失败返回 `{ "error": { "code", "message", "details" } }`（工具错误把 code 写在消息开头）。

| 错误码 | HTTP | 含义 | 恢复动作 |
| --- | --- | --- | --- |
| `bad-request` | 400 | 结构、ID 格式、JSON 或文字无效 | 只传允许字段；检查文字非空 |
| `unknown-bot` | 404 | `botId` 不属于当前 Host | 重新 `dsh_im_delivery_targets`；别用旧 ID |
| `unknown-target` | 404 | 该机器人下没有这个 `targetId` | 让用户新建目标或核对别名 |
| `target-conflict` | 409 | 同一机器人下别名已存在 | 换别名 |
| `invalid-target` | 422 | 目标类型或平台原生 ID 不符合渠道规则 | 回设置页重选类型、核对 ID |
| `bot-not-connected` | 503 | 机器人离线 | 恢复连接后再发；不要循环重试 |
| `target-rejected` | 422 | 平台拒绝目标或缺少发送权限 | 检查平台权限和目标 ID |
| `delivery-failed` | 502 | 网络/平台失败，无法安全细分 | 停止并报告；不要自动重试 |
| `capability-unavailable` | 501 | 该渠道没有主动文件能力 | 飞书/微信/企业微信/钉钉/QQ 支持；其他渠道改用文字或当前会话内 `dsh_im_return_file` |
| `session-sync-unavailable` | — | 目标不是可确认的当前私聊，或渠道用了远程 Harness | 从已聊私聊建目标并建立 Session |
| `cancelled` | 408 | 调用被取消 | 按业务决定是否重新发起 |

协议层：`method-not-allowed`（405）、`unsupported-media-type`（415，必须 `application/json`）、`payload-too-large`（413，>1 MiB）。

## 测试成功但对方没看到

测试只证明平台接口接受了请求。继续查：机器人是否在目标会话里、平台权限、目标 ID、客户端过滤/归档、微信 `context_token` 是否建立。

## 重复消息

调用方超时后重试可能产生重复消息。给 `send` / `sendFile` 传 `idempotencyKey` 后，Host 在进程内 24h 内按 `botId + targetId + key` 抑制重复并返回 `duplicate: true`；失败的那次会释放 key，允许修正后重试。Host 重启后窗口丢失，跨重启的幂等仍由调用方自己保存事件 ID。

## 还是发不出去

1. `dsh-im endpoint` 确认 CLI 连的是当前 Host。
2. 设置页确认机器人显示已连接。
3. 在目标上点「测试」；测试失败看机器人权限。
4. 看 Host 日志里的 `delivery-failed` / 渠道错误，不要把凭据贴进聊天。
