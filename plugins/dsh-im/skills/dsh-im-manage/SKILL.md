---
name: dsh-im-manage
description: Change a DSH-IM bot's settings (workspace, Agent Preset, model, alias, message mode) and its delivery targets on the user's behalf, and explain which of those actions the user must perform themselves in Settings. Use when asked to switch a bot's workspace/model/preset, rename a bot, add or remove a delivery target, or when the user asks "can you configure 某某机器人". Chinese triggers: 改工作区、换模型、换预设、改别名、加目标、配置机器人。Not for sending messages (use dsh-im-delivery) and not for looking up account names (use dsh-im-accounts).
---

# 替用户配置 DSH-IM

## 两条路，先选一条

同一个设置项有两种改法，**生效时机不同**：

| 想做的事 | 用 CLI（你在 Agent 里做） | 用户自己在 IM 里发命令 |
| --- | --- | --- |
| 换机器人默认工作区 | `dsh-im settings set --account <名> --key workspace --value <绝对路径>` | `/workspace <序号或路径>` |
| 换机器人默认模型 | `settings set --key model --value provider/model` | `/models` → `/model <序号>` |
| 换机器人默认 Agent Preset | `settings set --key agentPreset --value <id>` | `/presetlist` → `/preset <序号>` |
| 改机器人别名 | `settings set --key alias --value <名>` | 设置页卡片 |
| 改忙碌时消息处理方式 | `settings set --key busyMessageMode --value steer` | — |
| 换**当前聊天的**工作区 | **做不到** | `/workspace <序号>`（只影响这个聊天） |
| 绑定某个已有会话 | **做不到** | `/session <Session ID>` |
| 开新会话 | 下次消息自然新建 | `/new` |

**关键区别**：CLI 改的是**机器人默认值**，只影响**之后新建的 Session**。已经在跑的会话、已经生成到一半的回复都不受影响。用户如果在某个聊天里问「为什么还是老模型」，答案就是这个——需要他在那个聊天里用 `/model` 改当前会话，或者在那边开新会话。

`/workspace` 和 `/model` 在 IM 里有「当前会话 vs 机器人默认」的区分，CLI 只能动默认值。要精确控制某个会话，明确告诉用户去那个聊天里发命令。

## CLI 用法

```bash
dsh-im settings get --account 我的微信            # 查看当前配置
dsh-im settings set --account 我的微信 --key alias --value 工作微信
dsh-im settings set --account 工作微信 --key workspace --value D:/work/project
dsh-im settings set --account 工作微信 --key model --value deepseek/deepseek-chat
dsh-im settings set --account 工作微信 --key agentPreset --value code-reviewer
```

允许的 `--key`：目前只有 `alias` 可以由 CLI 修改。

`workspace`、`agentPreset`、`model`、`busyMessageMode`、`contextEnhancement` **只能读不能改**：改工作区或模型会清除或重塑该机器人的 Session，属于用户自己在设置页里的决定。`settings set` 对这几个 key 会返回 `user-only-action`。

工作区必须是**绝对路径**且目录存在；相对路径会被拒。

## 管理投递目标

```bash
dsh-im target create --account 工作微信 --target release-alerts --name 发布告警群 --kind group \
  --route '{"chatId":"oc_xxx"}'
dsh-im target update --account 工作微信 --target 发布告警群 --name 发布群
dsh-im target delete --account 工作微信 --target 发布告警群
```

- `target create` 的 `--target` 是你指定的新 ID，不会被按名字解析；`--route` 必须是该渠道要求的平台标识（各渠道不同，拿不准就让用户在设置页从最近会话里选，那才是可靠路径）。
- `update` / `delete` 的 `--target` 接受 ID 或显示名。
- **删除目标会影响其他插件**：其他插件按 `botId + targetId` 引用目标，删掉后它们会收到 `unknown-target`。删之前要跟用户确认。

## 你不能做的事（`user-only-action`）

下面这些**必须用户自己在设置页操作**。CLI 和工具都不会替你执行，遇到就给出引导，不要假装做完了：

| 动作 | 为什么 |
| --- | --- |
| 改访问策略（谁能给机器人下命令、是否允许执行命令） | 这是授信动作，等于放宽访问控制 |
| 绑定 / 解除凭据、扫码登录 | 需要用户在设备上完成扫码或 OAuth |
| 删除机器人 | 不可逆，且会连带删除它的工作区和目标 |

引导话术可以直接说：「这一步需要你在 **设置 → IM机器人 → 选择渠道卡片** 里完成，扫码和权限我这边动不了。」

## 改之前的检查

1. 先用 `dsh-im accounts` 确认账号唯一；同名账号要求用户给 `botId`。
2. 改工作区前确认那是**绝对路径**、目录存在，且用户确实想换（切换会清除该机器人的旧会话映射）。
3. 改完告诉用户**什么时候生效**：默认值只影响之后新建的 Session。
4. 需要用户自己动手的，明确给出设置页位置，不要含糊地说「你去设一下」。
