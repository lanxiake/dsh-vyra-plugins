---
name: dsh-im-accounts
description: Find which IM accounts and delivery targets exist in DSH-IM, and turn a human name like 「我的微信」 into the botId/targetId a send needs. Use when asked "who can I send to", "which accounts are connected", "send to 某某", or when a send failed with unknown-account / unknown-target / ambiguous-account / ambiguous-target. Chinese triggers: 有哪些账号、发给谁、找目标、账号名、目标名。Not for actually sending (use dsh-im-delivery) and not for changing bot settings (use dsh-im-manage).
---

# 账号与目标查找

名字给人记，ID 给调用用。用户说「发给某某微信」，你要做的是把 `某某微信` 解析成 `botId`，再找到目标拿到 `targetId`，最后发送。

## 三步链路

```bash
dsh-im accounts                 # ① 有哪些账号：账号名 · 渠道 · botId
dsh-im targets --account 某某微信 # ② 这个账号有哪些目标：目标名 · 类型 · targetId
dsh-im send --account 某某微信 --target 发布告警群 --text "..."   # ③ 发送
```

三步都是**离线可读**的（①②），DSH 没在运行时也能查；只有 ③ 需要 DSH 在运行。

加 `--json` 拿结构化输出，便于你自己取字段。

## 名字从哪里来

账号名的优先级（CLI 在 `accountNameSource` 里告诉你用了哪一级）：

| `accountNameSource` | 来源 | 可靠性 |
| --- | --- | --- |
| `alias` | 用户在设置页起的别名 | 最可靠，用户自己定的 |
| `botName` | 渠道配置里存的机器人名 | 可靠 |
| `channel` | 渠道中文标签（如「微信」） | **兜底**：该账号从没起过名字 |

`channel` 兜底意味着这个名字**不唯一**：同一个渠道有两个没起名的账号时，两个都叫「微信」。看到 `accountNameSource: "channel"` 就提醒用户去设置页起个别名。

## 名字重复时不要猜

- `ambiguous-account`：多个账号同名。错误里带 `candidates`（每个的 `botId`），改用 `--account <botId>`。
- `ambiguous-target`：多个目标同名。错误里带 `candidates`（每个的 `targetId`），改用 `--target <targetId>`。

两者都是**故意拒绝**的。发错人是不可撤回的，宁可让用户确认一次。

## 目标名和账号名撞车（真实存在）

微信账号叫「我的微信」，它唯一的私聊目标**也叫**「我的微信」。这时 `dsh-im targets` 会给出告警：

> 目标名与账号名相同（均为「我的微信」，targetId …），建议在设置页给该目标起一个可区分的名字

遇到这条告警：

1. 先照常用 `targetId` 发送，功能不受影响；
2. **同时**提醒用户改名，否则下次他自己也会说不清「发给我的微信」到底指账号还是目标。

**用户接入新账号时主动提醒改名**：扫码连上后账号名通常是渠道标签或平台昵称，而第一个目标往往就是那唯一的私聊，很容易同名。

## 目标不存在

`unknown-target` 说明这个账号下没有这个目标。不要猜平台 ID，也不要编一个 `targetId`。两条路：

- 让用户在**设置 → IM机器人 → 机器人卡片 → 新建目标**里从最近会话里选一个；
- 或者用 `dsh-im target create` 新建（需要 `targetId`、显示名、类型，以及平台路由 JSON）。

`target create` 的 `--target` 是你**指定**的新 ID，不会被按名字解析。

## 平台路由

`--with-routes` 才返回 `route`（平台原生标识，如 `chatId`、`toUserId`）。只有排障时才需要；**发送时永远用 `targetId`**，不要拿 `route` 里的平台 ID 去猜别的目标。
